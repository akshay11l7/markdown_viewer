/**
 * Context Builder
 *
 * Assembles a reusable DocumentContext object that is sent with every AI request.
 * Centralizes all contextual information the AI needs to provide relevant responses.
 */

import type { DocumentContext, AIMessage } from '../types/ai';

/** Maximum number of recent prompts to include in context */
const MAX_RECENT_PROMPTS = 10;

/** Maximum number of conversation history messages to include */
const MAX_HISTORY_MESSAGES = 20;

/**
 * Build a complete DocumentContext object for AI requests.
 *
 * @param params - All available context parameters
 * @returns A DocumentContext ready to send to the backend
 */
export function buildContext(params: {
  currentMarkdown?: string;
  fileName?: string;
  currentHeading?: string;
  selectedText?: string;
  cursorLocation?: { line: number; column: number };
  workspaceName?: string;
  recentPrompts?: string[];
  conversationHistory?: AIMessage[];
}): DocumentContext {
  return {
    currentMarkdown: params.currentMarkdown || '',
    fileName: params.fileName || 'Untitled.md',
    currentHeading: params.currentHeading || extractCurrentHeading(
      params.currentMarkdown || '',
      params.cursorLocation?.line || 1
    ),
    selectedText: params.selectedText || '',
    cursorLocation: params.cursorLocation || { line: 1, column: 1 },
    workspaceName: params.workspaceName || 'Workspace',
    recentPrompts: (params.recentPrompts || []).slice(-MAX_RECENT_PROMPTS),
    conversationHistory: (params.conversationHistory || []).slice(-MAX_HISTORY_MESSAGES),
  };
}

/**
 * Extract the heading the cursor is currently under.
 * Scans backwards from the cursor line to find the nearest heading.
 *
 * @param markdown - The full markdown content
 * @param cursorLine - The 1-indexed line number of the cursor
 * @returns The text of the nearest heading above the cursor, or empty string
 */
function extractCurrentHeading(markdown: string, cursorLine: number): string {
  const lines = markdown.split('\n');
  const headingRegex = /^#{1,6}\s+(.+)$/;

  // Scan backwards from cursor position
  for (let i = Math.min(cursorLine - 1, lines.length - 1); i >= 0; i--) {
    const match = lines[i].match(headingRegex);
    if (match) {
      return match[1].replace(/[*_`[\]]/g, '').trim();
    }
  }

  return '';
}

/**
 * Build a minimal context with just the essential fields.
 * Useful for quick actions that don't need full conversation history.
 *
 * @param markdown - The document content
 * @param selectedText - Currently selected text
 * @returns A minimal DocumentContext
 */
export function buildMinimalContext(
  markdown: string,
  selectedText: string = '',
  fileName: string = 'Untitled.md'
): DocumentContext {
  return buildContext({
    currentMarkdown: markdown,
    selectedText,
    fileName,
  });
}
