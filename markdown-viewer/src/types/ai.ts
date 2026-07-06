/**
 * AI Service Type Definitions
 *
 * Strict TypeScript interfaces for the AI service layer.
 * No use of `any` — every type is explicit.
 */

// ─── Enums & Literal Types ────────────────────────────────────────────────────

/** All supported AI action types */
export type PromptType =
  | 'chat'
  | 'summary'
  | 'explain'
  | 'improve'
  | 'grammar'
  | 'translate'
  | 'toc'
  | 'mermaid'
  | 'markdown'
  | 'faq'
  | 'flashcards'
  | 'interview'
  | 'insights'
  | 'titles';

/** Writing tone options for the improve/rewrite action */
export type WritingTone =
  | 'professional'
  | 'simple'
  | 'technical'
  | 'academic'
  | 'friendly';

/** Summary length modes */
export type SummaryMode = 'short' | 'medium' | 'detailed';

/** Explanation depth levels */
export type ExplanationLevel = 'simplified' | 'technical' | 'beginner';

/** Supported translation languages */
export type TranslateLanguage =
  | 'english'
  | 'hindi'
  | 'french'
  | 'german'
  | 'japanese'
  | 'spanish';

/** Interview question difficulty levels */
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

// ─── Context ──────────────────────────────────────────────────────────────────

/** Full document context sent with every AI request */
export interface DocumentContext {
  /** The full markdown content of the current document */
  currentMarkdown: string;
  /** Name of the currently open file */
  fileName: string;
  /** The heading the cursor is currently under */
  currentHeading: string;
  /** User-selected text in the editor */
  selectedText: string;
  /** Cursor line and column */
  cursorLocation: { line: number; column: number };
  /** Name of the active workspace */
  workspaceName: string;
  /** Recent user prompts for context continuity */
  recentPrompts: string[];
  /** Conversation history for persistent chat */
  conversationHistory: AIMessage[];
}

// ─── Messages ─────────────────────────────────────────────────────────────────

/** A single message in the AI chat conversation */
export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** The action that triggered this message, if applicable */
  action?: PromptType;
  /** Timestamp of the message */
  timestamp: number;
}

/** A chunk received during streaming */
export interface StreamingChunk {
  /** The text content of this chunk */
  content: string;
  /** Whether this is the final chunk */
  done: boolean;
}

// ─── Requests ─────────────────────────────────────────────────────────────────

/** Base request sent to the backend AI endpoints */
export interface AIRequestBase {
  /** The document context */
  context: DocumentContext;
}

/** Request for the chat endpoint */
export interface ChatRequest extends AIRequestBase {
  /** The user's message */
  message: string;
}

/** Request for summarization */
export interface SummarizeRequest extends AIRequestBase {
  mode: SummaryMode;
}

/** Request for explanation */
export interface ExplainRequest extends AIRequestBase {
  text: string;
  level: ExplanationLevel;
}

/** Request for writing improvement */
export interface ImproveRequest extends AIRequestBase {
  text: string;
  tone: WritingTone;
}

/** Request for grammar correction */
export interface GrammarRequest extends AIRequestBase {
  text: string;
}

/** Request for translation */
export interface TranslateRequest extends AIRequestBase {
  text: string;
  targetLanguage: TranslateLanguage;
}

/** Request for TOC generation */
export interface TOCRequest extends AIRequestBase {}

/** Request for mermaid diagram generation */
export interface MermaidRequest extends AIRequestBase {
  description: string;
}

/** Request for markdown conversion */
export interface MarkdownConvertRequest extends AIRequestBase {
  text: string;
}

/** Request for FAQ generation */
export interface FAQRequest extends AIRequestBase {}

/** Request for flashcard generation */
export interface FlashcardRequest extends AIRequestBase {}

/** Request for interview question generation */
export interface InterviewRequest extends AIRequestBase {
  difficulty: DifficultyLevel;
}

/** Request for document insights */
export interface InsightsRequest extends AIRequestBase {}

/** Request for title generation */
export interface TitlesRequest extends AIRequestBase {}

// ─── Responses ────────────────────────────────────────────────────────────────

/** Standard AI response from the backend */
export interface AIResponse {
  /** Whether the request succeeded */
  success: boolean;
  /** The generated content */
  content: string;
  /** Error message if failed */
  error?: string;
}

/** Streaming callbacks for real-time responses */
export interface StreamCallbacks {
  /** Called when a new text chunk arrives */
  onChunk: (chunk: string) => void;
  /** Called when streaming starts */
  onStart?: () => void;
  /** Called when streaming completes */
  onComplete?: (fullContent: string) => void;
  /** Called on error */
  onError?: (error: AIServiceError) => void;
}

// ─── Errors ───────────────────────────────────────────────────────────────────

/** Structured AI service error */
export interface AIServiceError {
  /** HTTP status code or custom error code */
  code: number;
  /** Human-readable error message */
  message: string;
  /** Whether the request can be retried */
  retryable: boolean;
}

// ─── Store State ──────────────────────────────────────────────────────────────

/** Zustand store state for AI features */
export interface AIStoreState {
  /** Whether an AI request is in progress */
  loading: boolean;
  /** Whether we are currently receiving a streaming response */
  streaming: boolean;
  /** Chat message history */
  messages: AIMessage[];
  /** Full conversation history (persisted across sessions) */
  history: AIMessage[];
  /** The current streaming response being built */
  currentResponse: string;
  /** Currently selected text in the editor */
  selectedText: string;
  /** Current document content */
  currentDocument: string;
  /** Current file name */
  currentFileName: string;
  /** Last error encountered */
  error: AIServiceError | null;
}

/** Zustand store actions */
export interface AIStoreActions {
  /** Send a message or trigger an AI action */
  sendMessage: (message: string, action?: PromptType, options?: Record<string, string>) => Promise<void>;
  /** Cancel the current streaming request */
  cancel: () => void;
  /** Clear all messages */
  clear: () => void;
  /** Retry the last failed request */
  retry: () => Promise<void>;
  /** Reset the entire store to initial state */
  reset: () => void;
  /** Update the current document context */
  setDocument: (content: string, fileName: string) => void;
  /** Update the selected text */
  setSelectedText: (text: string) => void;
  /** Append a chunk to the current streaming response */
  appendChunk: (chunk: string) => void;
  /** Finalize streaming and add the response as a message */
  finalizeResponse: () => void;
  /** Set error state */
  setError: (error: AIServiceError | null) => void;
}

/** Combined Zustand store type */
export type AIStore = AIStoreState & AIStoreActions;
