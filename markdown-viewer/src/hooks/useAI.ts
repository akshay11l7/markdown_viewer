/**
 * AI React Hooks
 *
 * Convenient hooks that wrap the Zustand AI store for component usage.
 * Provides useAIChat for the chat panel and useAIAction for one-shot actions.
 */

import { useCallback, useEffect } from 'react';
import { useAIStore } from '../store/aiStore';
import type { PromptType } from '../types/ai';

/**
 * Main hook for the AI chat panel.
 * Provides all chat functionality and auto-syncs document context.
 */
export function useAIChat(documentContent: string, fileName: string) {
  const store = useAIStore();

  // Keep document context in sync
  useEffect(() => {
    store.setDocument(documentContent, fileName);
  }, [documentContent, fileName]);

  const sendMessage = useCallback(
    (message: string, action?: PromptType, options?: Record<string, string>) => {
      store.sendMessage(message, action, options);
    },
    []
  );

  const cancel = useCallback(() => {
    store.cancel();
  }, []);

  const clear = useCallback(() => {
    store.clear();
  }, []);

  const retry = useCallback(() => {
    store.retry();
  }, []);

  return {
    messages: store.messages,
    currentResponse: store.currentResponse,
    loading: store.loading,
    streaming: store.streaming,
    error: store.error,
    sendMessage,
    cancel,
    clear,
    retry,
  };
}

/**
 * Hook for one-shot AI actions (explain, improve, grammar, translate).
 * Used by editor context menu and inline popups.
 */
export function useAIAction() {
  const store = useAIStore();

  const executeAction = useCallback(
    async (
      action: PromptType,
      text: string,
      options?: Record<string, string>
    ): Promise<string> => {
      return new Promise((resolve, reject) => {
        const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
        const token = localStorage.getItem('token') || '';

        const context = {
          currentMarkdown: store.currentDocument,
          fileName: store.currentFileName,
          selectedText: text,
          currentHeading: '',
          cursorLocation: { line: 1, column: 1 },
          workspaceName: 'Workspace',
          recentPrompts: [] as string[],
          conversationHistory: [] as { id: string; role: 'user' | 'assistant'; content: string; timestamp: number }[],
        };

        fetch(`${API_BASE}/api/ai/${action}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ text, context, ...options }),
        })
          .then(async (response) => {
            if (!response.ok) {
              const errData = await response.json().catch(() => ({}));
              reject(new Error(errData.error || response.statusText));
              return;
            }
            const data = await response.json();
            resolve(data.content || '');
          })
          .catch((err) => {
            reject(err);
          });
      });
    },
    [store.currentDocument, store.currentFileName]
  );

  return {
    executeAction,
    loading: store.loading,
    error: store.error,
  };
}

/**
 * Hook to sync selected text into the AI store.
 * Call this whenever the editor selection changes.
 */
export function useAISelection() {
  const setSelectedText = useAIStore((s) => s.setSelectedText);

  return useCallback(
    (text: string) => {
      setSelectedText(text);
    },
    [setSelectedText]
  );
}
