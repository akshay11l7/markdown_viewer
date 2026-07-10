/**
 * AI Store — Zustand State Management
 *
 * Centralized state for all AI features. Manages messages, streaming state,
 * document context, errors, and provides actions for the UI.
 */

import { create } from 'zustand';
import type {
  AIStore,
  AIMessage,
  AIServiceError,
  PromptType,
} from '../types/ai';
import { buildContext } from '../services/contextBuilder';
import * as aiService from '../services/aiService';

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Generate a unique message ID */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Store ─────────────────────────────────────────────────────────────────────

/** Active cancel function for streaming */
let cancelStreamFn: (() => void) | null = null;

/** Last request info for retry */
let lastRequest: { message: string; action?: PromptType; options?: Record<string, string> } | null = null;

export const useAIStore = create<AIStore>((set, get) => ({
  // ── State ──────────────────────────────────────────────────────────────────
  loading: false,
  streaming: false,
  messages: [
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Hello! I\'m your AI assistant powered by Gemini. I can summarize, explain, translate, generate diagrams, and much more. Ask me anything about your document!',
      timestamp: Date.now(),
    },
  ],
  history: [],
  currentResponse: '',
  selectedText: '',
  currentDocument: '',
  currentFileName: '',
  error: null,

  // ── Actions ────────────────────────────────────────────────────────────────

  setDocument: (content: string, fileName: string) => {
    set({ currentDocument: content, currentFileName: fileName });
  },

  setSelectedText: (text: string) => {
    set({ selectedText: text });
  },

  setError: (error: AIServiceError | null) => {
    set({ error });
  },

  appendChunk: (chunk: string) => {
    set((state) => ({ currentResponse: state.currentResponse + chunk }));
  },

  finalizeResponse: () => {
    const { currentResponse, messages } = get();
    if (!currentResponse) return;

    const aiMessage: AIMessage = {
      id: generateId(),
      role: 'assistant',
      content: currentResponse,
      timestamp: Date.now(),
    };

    set({
      messages: [...messages, aiMessage],
      history: [...get().history, aiMessage],
      currentResponse: '',
      streaming: false,
      loading: false,
    });
  },

  sendMessage: async (message: string, action?: PromptType, options?: Record<string, string>) => {
    const state = get();

    // Save for retry
    lastRequest = { message, action, options };

    // Add user message
    const userMessage: AIMessage = {
      id: generateId(),
      role: 'user',
      content: message,
      action: action || 'chat',
      timestamp: Date.now(),
    };

    set({
      messages: [...state.messages, userMessage],
      history: [...state.history, userMessage],
      loading: true,
      streaming: true,
      currentResponse: '',
      error: null,
    });

    // Build context
    const context = buildContext({
      currentMarkdown: state.currentDocument,
      fileName: state.currentFileName,
      selectedText: state.selectedText,
      conversationHistory: state.history,
      recentPrompts: state.history
        .filter((m) => m.role === 'user')
        .map((m) => m.content),
    });

    // Build request body based on action
    const actionType = action || 'chat';
    let body: Record<string, unknown> = { context };

    switch (actionType) {
      case 'chat':
        body = { message, context };
        break;
      case 'summary':
        body = { mode: options?.mode || 'medium', context };
        break;
      case 'explain':
        body = { text: state.selectedText || message, level: options?.level || 'simplified', context };
        break;
      case 'improve':
        body = { text: state.selectedText || message, tone: options?.tone || 'professional', context };
        break;
      case 'grammar':
        body = { text: state.selectedText || message, context };
        break;
      case 'translate':
        body = { text: state.selectedText || state.currentDocument, targetLanguage: options?.targetLanguage || 'spanish', context };
        break;
      case 'toc':
        body = { context };
        break;
      case 'mermaid':
        body = { description: message, context };
        break;
      case 'markdown':
        body = { text: message || state.selectedText, context };
        break;
      case 'faq':
        body = { context };
        break;
      case 'flashcards':
        body = { context };
        break;
      case 'interview':
        body = { difficulty: options?.difficulty || 'medium', context };
        break;
      case 'insights':
        body = { context };
        break;
      case 'titles':
        body = { context };
        break;
      default:
        body = { message, context };
    }

    // Stream the response
    const cancel = aiService.chat(
      message,
      context,
      {
        onStart: () => {
          set({ streaming: true, loading: true });
        },
        onChunk: (chunk: string) => {
          get().appendChunk(chunk);
        },
        onComplete: () => {
          get().finalizeResponse();
        },
        onError: (error: AIServiceError) => {
          set({
            loading: false,
            streaming: false,
            error,
            currentResponse: '',
          });
          // Add error message to chat
          const errorMessage: AIMessage = {
            id: generateId(),
            role: 'assistant',
            content: `⚠️ **Error**: ${error.message}${error.retryable ? ' You can try again.' : ''}`,
            timestamp: Date.now(),
          };
          set((s) => ({ messages: [...s.messages, errorMessage] }));
        },
      }
    );

    // Override: actually call the specific action endpoint for non-chat actions
    if (actionType !== 'chat') {
      // Cancel the chat stream we just started
      cancel();

      const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
      const token = localStorage.getItem('token') || '';

      try {
        const response = await fetch(`${API_BASE}/api/ai/${actionType}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({ error: response.statusText }));
          throw { status: response.status, message: errData.error || response.statusText };
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw { status: 500, message: 'Streaming not supported' };
        }

        const decoder = new TextDecoder();
        let buf = '';
        let fullContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data:')) continue;
            const dataStr = trimmed.slice(5).trim();
            if (dataStr === '[DONE]') continue;

            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.error) {
                throw { status: 500, message: parsed.error };
              }
              if (parsed.content) {
                fullContent += parsed.content;
                set((s) => ({ currentResponse: s.currentResponse + parsed.content }));
              }
            } catch (parseErr: unknown) {
              if (parseErr && typeof parseErr === 'object' && 'status' in parseErr) throw parseErr;
            }
          }
        }

        // Finalize
        if (fullContent || get().currentResponse) {
          get().finalizeResponse();
        } else {
          set({ loading: false, streaming: false });
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : (err && typeof err === 'object' && 'message' in err ? String((err as Record<string, unknown>).message) : 'Request failed');
        set({ loading: false, streaming: false, currentResponse: '' });
        const errorMessage: AIMessage = {
          id: generateId(),
          role: 'assistant',
          content: `⚠️ **Error**: ${errorMsg}`,
          timestamp: Date.now(),
        };
        set((s) => ({ messages: [...s.messages, errorMessage] }));
      }
    } else {
      cancelStreamFn = cancel;
    }
  },

  cancel: () => {
    if (cancelStreamFn) {
      cancelStreamFn();
      cancelStreamFn = null;
    }
    aiService.cancelRequest();

    const { currentResponse } = get();
    if (currentResponse) {
      get().finalizeResponse();
    } else {
      set({ loading: false, streaming: false });
    }
  },

  clear: () => {
    set({
      messages: [
        {
          id: 'welcome',
          role: 'assistant',
          content:
            'Chat cleared. Ask me anything about your document!',
          timestamp: Date.now(),
        },
      ],
      history: [],
      currentResponse: '',
      error: null,
    });
  },

  retry: async () => {
    if (lastRequest) {
      await get().sendMessage(lastRequest.message, lastRequest.action, lastRequest.options);
    }
  },

  reset: () => {
    if (cancelStreamFn) {
      cancelStreamFn();
      cancelStreamFn = null;
    }
    aiService.cancelRequest();
    aiService.clearCache();

    set({
      loading: false,
      streaming: false,
      messages: [
        {
          id: 'welcome',
          role: 'assistant',
          content:
            'Hello! I\'m your AI assistant powered by Gemini. I can summarize, explain, translate, generate diagrams, and much more. Ask me anything about your document!',
          timestamp: Date.now(),
        },
      ],
      history: [],
      currentResponse: '',
      selectedText: '',
      error: null,
    });

    lastRequest = null;
  },
}));
