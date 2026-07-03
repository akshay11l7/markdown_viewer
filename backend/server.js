const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3001;
const JWT_SECRET = 'super-secret-key-for-markdown-viewer'; // In production, use environment variables

app.use(cors());
app.use(express.json());

// Initialize SQLite database
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT UNIQUE,
      password TEXT,
      auth_provider TEXT DEFAULT 'local'
    )`);
  }
});

// Helper function to generate JWT
const generateToken = (user) => {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
};

// Sign Up Endpoint
app.post('/api/signup', async (req, res) => {
  const { name, email, password } = req.body;
  
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  try {
    // Check if user exists
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (user) return res.status(400).json({ error: 'Email already exists' });

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Insert new user
      const sql = 'INSERT INTO users (name, email, password, auth_provider) VALUES (?, ?, ?, ?)';
      db.run(sql, [name, email, hashedPassword, 'local'], function (err) {
        if (err) return res.status(500).json({ error: 'Failed to create user' });
        
        const token = generateToken({ id: this.lastID, email });
        res.status(201).json({ message: 'User created successfully', token, user: { id: this.lastID, name, email } });
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Sign In Endpoint
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(400).json({ error: 'Invalid email or password' });
    if (user.auth_provider !== 'local') return res.status(400).json({ error: 'Please sign in with Google' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid email or password' });

    const token = generateToken(user);
    res.json({ message: 'Login successful', token, user: { id: user.id, name: user.name, email: user.email } });
  });
});

// Google Sign-In Endpoint (Mock implementation for now)
app.post('/api/google-login', (req, res) => {
  const { email, name } = req.body;
  // In a real app, you would verify the Google ID token sent from the client here
  
  if (!email) {
    return res.status(400).json({ error: 'Email is required from Google' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    if (user) {
      // User exists, login
      const token = generateToken(user);
      return res.json({ message: 'Google Login successful', token, user: { id: user.id, name: user.name, email: user.email } });
    } else {
      // User doesn't exist, create account via google
      const sql = 'INSERT INTO users (name, email, auth_provider) VALUES (?, ?, ?)';
      db.run(sql, [name || 'Google User', email, 'google'], function (err) {
        if (err) return res.status(500).json({ error: 'Failed to create Google user' });
        
        const token = generateToken({ id: this.lastID, email });
        res.status(201).json({ message: 'Google User created successfully', token, user: { id: this.lastID, name, email } });
      });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
