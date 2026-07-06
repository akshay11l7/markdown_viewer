/**
 * AI Service
 *
 * Clean, typed API for all AI features. Each method calls the backend
 * /api/ai/* endpoints. Supports both standard and streaming responses.
 *
 * Features:
 * - AbortController for request cancellation
 * - Response caching for repeated prompts
 * - Debounce protection
 * - Streaming via SSE (ReadableStream)
 */

import type {
  DocumentContext,
  AIResponse,
  StreamCallbacks,
  AIServiceError,
  PromptType,
  WritingTone,
  SummaryMode,
  ExplanationLevel,
  TranslateLanguage,
  DifficultyLevel,
} from '../types/ai';

// ─── Configuration ─────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
const AI_ENDPOINT = `${API_BASE}/api/ai`;

/** Debounce interval in ms */
const DEBOUNCE_MS = 1000;

/** Maximum cache entries */
const MAX_CACHE_SIZE = 50;

// ─── Internal State ────────────────────────────────────────────────────────────

let lastRequestTime = 0;
let activeController: AbortController | null = null;

/** Simple LRU cache for repeated prompts */
const responseCache = new Map<string, string>();

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Get the auth token from localStorage */
function getToken(): string {
  return localStorage.getItem('token') || '';
}

/** Generate a cache key from action + body */
function cacheKey(action: string, body: Record<string, unknown>): string {
  return `${action}:${JSON.stringify(body)}`;
}

/** Enforce debounce */
function enforceDebouce(): boolean {
  const now = Date.now();
  if (now - lastRequestTime < DEBOUNCE_MS) {
    return false; // too soon
  }
  lastRequestTime = now;
  return true;
}

/** Create a structured error */
function createError(code: number, message: string, retryable: boolean = false): AIServiceError {
  return { code, message, retryable };
}

/** Parse error response from backend */
async function parseErrorResponse(response: Response): Promise<AIServiceError> {
  try {
    const data = await response.json();
    return createError(
      data.code || response.status,
      data.error || response.statusText,
      data.retryable ?? response.status === 429
    );
  } catch {
    return createError(response.status, response.statusText, response.status >= 500);
  }
}

// ─── Core Request Functions ────────────────────────────────────────────────────

/**
 * Make a non-streaming AI request.
 *
 * @param action - The AI action endpoint
 * @param body - The request body
 * @returns The AI response content
 */
async function request(action: PromptType, body: Record<string, unknown>): Promise<AIResponse> {
  if (!enforceDebouce()) {
    return { success: false, content: '', error: 'Please wait a moment before making another request.' };
  }

  // Check cache
  const key = cacheKey(action, body);
  const cached = responseCache.get(key);
  if (cached) {
    return { success: true, content: cached };
  }

  // Cancel any active request
  if (activeController) {
    activeController.abort();
  }
  activeController = new AbortController();

  try {
    const response = await fetch(`${AI_ENDPOINT}/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify(body),
      signal: activeController.signal,
    });

    if (!response.ok) {
      const error = await parseErrorResponse(response);
      return { success: false, content: '', error: error.message };
    }

    const data = await response.json();

    // Cache the response
    if (data.content && responseCache.size < MAX_CACHE_SIZE) {
      responseCache.set(key, data.content);
    }

    return { success: true, content: data.content || '' };
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { success: false, content: '', error: 'Request was cancelled.' };
    }
    return {
      success: false,
      content: '',
      error: err instanceof Error ? err.message : 'Network error. Check your connection.',
    };
  } finally {
    activeController = null;
  }
}

/**
 * Make a streaming AI request using SSE.
 *
 * @param action - The AI action endpoint
 * @param body - The request body
 * @param callbacks - Streaming callbacks (onChunk, onStart, onComplete, onError)
 * @returns An abort function to cancel the stream
 */
function requestStream(
  action: PromptType,
  body: Record<string, unknown>,
  callbacks: StreamCallbacks
): () => void {
  if (!enforceDebouce()) {
    callbacks.onError?.(createError(429, 'Please wait a moment before making another request.', true));
    return () => {};
  }

  // Cancel any active request
  if (activeController) {
    activeController.abort();
  }
  const controller = new AbortController();
  activeController = controller;

  callbacks.onStart?.();

  let fullContent = '';

  (async () => {
    try {
      const response = await fetch(`${AI_ENDPOINT}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await parseErrorResponse(response);
        callbacks.onError?.(error);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        callbacks.onError?.(createError(500, 'Streaming not supported by browser.'));
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;

          const dataStr = trimmed.slice(5).trim();
          if (dataStr === '[DONE]') {
            callbacks.onComplete?.(fullContent);
            return;
          }

          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.error) {
              callbacks.onError?.(createError(500, parsed.error));
              return;
            }
            if (parsed.content) {
              fullContent += parsed.content;
              callbacks.onChunk(parsed.content);
            }
          } catch {
            // Skip malformed chunks
          }
        }
      }

      // If we exited the loop without [DONE], still complete
      callbacks.onComplete?.(fullContent);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        callbacks.onComplete?.(fullContent);
        return;
      }
      callbacks.onError?.(
        createError(0, err instanceof Error ? err.message : 'Network error', true)
      );
    } finally {
      if (activeController === controller) {
        activeController = null;
      }
    }
  })();

  // Return abort function
  return () => {
    controller.abort();
  };
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Cancel the current active AI request.
 */
export function cancelRequest(): void {
  if (activeController) {
    activeController.abort();
    activeController = null;
  }
}

/**
 * Clear the response cache.
 */
export function clearCache(): void {
  responseCache.clear();
}

/**
 * Chat with AI about the current document.
 */
export function chat(
  message: string,
  context: DocumentContext,
  callbacks: StreamCallbacks
): () => void {
  return requestStream('chat', { message, context }, callbacks);
}

/**
 * Summarize the current document.
 */
export function summarize(
  context: DocumentContext,
  mode: SummaryMode = 'medium',
  callbacks: StreamCallbacks
): () => void {
  return requestStream('summary', { mode, context }, callbacks);
}

/**
 * Explain selected text.
 */
export function explain(
  text: string,
  level: ExplanationLevel,
  context: DocumentContext,
  callbacks: StreamCallbacks
): () => void {
  return requestStream('explain', { text, level, context }, callbacks);
}

/**
 * Improve writing with specified tone.
 */
export function improveWriting(
  text: string,
  tone: WritingTone,
  context: DocumentContext,
  callbacks: StreamCallbacks
): () => void {
  return requestStream('improve', { text, tone, context }, callbacks);
}

/**
 * Fix grammar and spelling.
 */
export function grammarCheck(
  text: string,
  context: DocumentContext,
  callbacks: StreamCallbacks
): () => void {
  return requestStream('grammar', { text, context }, callbacks);
}

/**
 * Translate text to a target language.
 */
export function translate(
  text: string,
  targetLanguage: TranslateLanguage,
  context: DocumentContext,
  callbacks: StreamCallbacks
): () => void {
  return requestStream('translate', { text, targetLanguage, context }, callbacks);
}

/**
 * Generate a Table of Contents.
 */
export function generateTOC(
  context: DocumentContext,
  callbacks: StreamCallbacks
): () => void {
  return requestStream('toc', { context }, callbacks);
}

/**
 * Generate a Mermaid diagram from a description.
 */
export function generateMermaid(
  description: string,
  context: DocumentContext,
  callbacks: StreamCallbacks
): () => void {
  return requestStream('mermaid', { description, context }, callbacks);
}

/**
 * Convert plain text to formatted Markdown.
 */
export function convertToMarkdown(
  text: string,
  context: DocumentContext,
  callbacks: StreamCallbacks
): () => void {
  return requestStream('markdown', { text, context }, callbacks);
}

/**
 * Generate FAQ section.
 */
export function generateFAQ(
  context: DocumentContext,
  callbacks: StreamCallbacks
): () => void {
  return requestStream('faq', { context }, callbacks);
}

/**
 * Create study flashcards.
 */
export function createFlashcards(
  context: DocumentContext,
  callbacks: StreamCallbacks
): () => void {
  return requestStream('flashcards', { context }, callbacks);
}

/**
 * Generate interview questions.
 */
export function generateInterviewQuestions(
  difficulty: DifficultyLevel,
  context: DocumentContext,
  callbacks: StreamCallbacks
): () => void {
  return requestStream('interview', { difficulty, context }, callbacks);
}

/**
 * Analyze document and provide insights.
 */
export function analyzeDocument(
  context: DocumentContext,
  callbacks: StreamCallbacks
): () => void {
  return requestStream('insights', { context }, callbacks);
}

/**
 * Generate title suggestions.
 */
export function generateTitles(
  context: DocumentContext,
  callbacks: StreamCallbacks
): () => void {
  return requestStream('titles', { context }, callbacks);
}

/**
 * Non-streaming rewrite — used for inline editor replacements.
 */
export async function rewrite(
  text: string,
  tone: WritingTone,
  context: DocumentContext
): Promise<AIResponse> {
  return request('improve', { text, tone, context });
}

/**
 * Non-streaming grammar check — used for inline editor replacements.
 */
export async function grammarCheckSync(
  text: string,
  context: DocumentContext
): Promise<AIResponse> {
  return request('grammar', { text, context });
}

/**
 * Non-streaming explain — used for quick popups.
 */
export async function explainSync(
  text: string,
  level: ExplanationLevel,
  context: DocumentContext
): Promise<AIResponse> {
  return request('explain', { text, level, context });
}

/**
 * Non-streaming translate — used for inline editor replacements.
 */
export async function translateSync(
  text: string,
  targetLanguage: TranslateLanguage,
  context: DocumentContext
): Promise<AIResponse> {
  return request('translate', { text, targetLanguage, context });
}
