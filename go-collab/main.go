package main

import (
	"encoding/json"
	"log"
	"math/rand"
	"net/http"
	"os"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// Generate random string for Room IDs and Guest IDs
func generateID(length int) string {
	const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, length)
	for i := range b {
		b[i] = charset[rand.Intn(len(charset))]
	}
	return string(b)
}

type WSMessage struct {
	Type    string `json:"type"`
	RoomId  string `json:"roomId,omitempty"`
	GuestId string `json:"guestId,omitempty"`
	Content string `json:"content,omitempty"`
	FileId  string `json:"fileId,omitempty"`
}

type Room struct {
	ID           string
	Host         *Client
	Guests       map[*Client]bool
	WaitingGuests map[string]*Client // GuestId -> Client
}

type Hub struct {
	rooms      map[string]*Room
	clients    map[*Client]bool
	register   chan *Client
	unregister chan *Client
}

func newHub() *Hub {
	return &Hub{
		rooms:      make(map[string]*Room),
		clients:    make(map[*Client]bool),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

type Client struct {
	id     string
	hub    *Hub
	conn   *websocket.Conn
	send   chan []byte
	room   *Room
	isHost bool
}

func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = true
			log.Println("New client connected.")
		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				// Clean up room if host disconnects
				if client.isHost && client.room != nil {
					log.Println("Host disconnected, closing room:", client.room.ID)
					msg, _ := json.Marshal(WSMessage{Type: "room-closed"})
					for guest := range client.room.Guests {
						guest.send <- msg
						guest.room = nil
					}
					delete(h.rooms, client.room.ID)
				} else if client.room != nil {
					delete(client.room.Guests, client)
				}
				delete(h.clients, client)
				close(client.send)
				log.Println("Client disconnected.")
			}
		}
	}
}

func (c *Client) handleMessage(msgBytes []byte) {
	var msg WSMessage
	if err := json.Unmarshal(msgBytes, &msg); err != nil {
		return
	}

	switch msg.Type {
	case "host-room":
		roomId := generateID(6)
		room := &Room{
			ID:           roomId,
			Host:         c,
			Guests:       make(map[*Client]bool),
			WaitingGuests: make(map[string]*Client),
		}
		c.hub.rooms[roomId] = room
		c.room = room
		c.isHost = true
		c.id = "host"
		
		log.Println("Room created:", roomId)
		reply, _ := json.Marshal(WSMessage{Type: "room-created", RoomId: roomId})
		c.send <- reply

	case "join-room":
		room, ok := c.hub.rooms[msg.RoomId]
		if !ok {
			reply, _ := json.Marshal(WSMessage{Type: "error", Content: "Room not found or closed."})
			c.send <- reply
			return
		}
		
		c.id = generateID(8)
		room.WaitingGuests[c.id] = c
		log.Println("Guest", c.id, "waiting to join room", msg.RoomId)

		notifyMsg, _ := json.Marshal(WSMessage{Type: "guest-waiting", GuestId: c.id})
		room.Host.send <- notifyMsg

	case "accept-guest":
		if !c.isHost || c.room == nil { return }
		guest, ok := c.room.WaitingGuests[msg.GuestId]
		if ok {
			delete(c.room.WaitingGuests, msg.GuestId)
			c.room.Guests[guest] = true
			guest.room = c.room
			guest.isHost = false

			reply, _ := json.Marshal(WSMessage{Type: "join-accepted", RoomId: c.room.ID})
			guest.send <- reply

			// Tell host to send full content to guest
			notifyHost, _ := json.Marshal(WSMessage{Type: "guest-joined", GuestId: guest.id})
			c.send <- notifyHost
		}

	case "reject-guest":
		if !c.isHost || c.room == nil { return }
		guest, ok := c.room.WaitingGuests[msg.GuestId]
		if ok {
			delete(c.room.WaitingGuests, msg.GuestId)
			reply, _ := json.Marshal(WSMessage{Type: "join-rejected"})
			guest.send <- reply
		}

	case "update-content":
		if c.room == nil { return }
		broadcastMsg, _ := json.Marshal(msg)
		if c.isHost {
			for guest := range c.room.Guests {
				guest.send <- broadcastMsg
			}
		} else {
			c.room.Host.send <- broadcastMsg
			for guest := range c.room.Guests {
				if guest != c {
					guest.send <- broadcastMsg
				}
			}
		}

	case "sync-content":
		// Host sends full content to just-joined guests
		if !c.isHost || c.room == nil { return }
		broadcastMsg, _ := json.Marshal(WSMessage{Type: "update-content", Content: msg.Content})
		for guest := range c.room.Guests {
			guest.send <- broadcastMsg
		}
	}
}

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()
	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil { break }
		c.handleMessage(message)
	}
}

func (c *Client) writePump() {
	defer func() { c.conn.Close() }()
	for {
		select {
		case message, ok := <-c.send:
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil { return }
			w.Write(message)
			if err := w.Close(); err != nil { return }
		}
	}
}

func serveWs(hub *Hub, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil { return }
	client := &Client{hub: hub, conn: conn, send: make(chan []byte, 256)}
	client.hub.register <- client

	go client.writePump()
	go client.readPump()
}

func main() {
	rand.Seed(time.Now().UnixNano())
	hub := newHub()
	go hub.run()

	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		serveWs(hub, w, r)
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Println("🚀 Go WebSocket Server with Live Share started on :" + port)
	err := http.ListenAndServe(":" + port, nil)
	if err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}
