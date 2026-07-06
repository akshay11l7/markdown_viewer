/**
 * ChatPanel — AI Chat Sidebar Component
 *
 * Full-featured AI chat panel with streaming responses, action suggestions,
 * copy/insert buttons, and keyboard shortcuts.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Bot,
  User,
  Sparkles,
  Loader2,
  X,
  Copy,
  Check,
  RotateCcw,
  Trash2,
  StopCircle,
  FileText,
  Languages,
  BookOpen,
  HelpCircle,
  BarChart3,
  Lightbulb,
  ClipboardList,
  GraduationCap,
  GitBranch,
  Heading,
  PenTool,
  ChevronDown,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAIChat } from '../../hooks/useAI';
import type { PromptType } from '../../types/ai';

type ChatPanelProps = {
  onClose?: () => void;
  documentContent: string;
  fileName?: string;
  onInsertContent?: (content: string) => void;
};

type SuggestionItem = {
  label: string;
  action: PromptType;
  icon: React.ReactNode;
  options?: Record<string, string>;
  message?: string;
};

export const ChatPanel: React.FC<ChatPanelProps> = ({
  onClose,
  documentContent,
  fileName = 'Untitled.md',
  onInsertContent,
}) => {
  const {
    messages,
    currentResponse,
    loading,
    streaming,
    sendMessage,
    cancel,
    clear,
    retry,
  } = useAIChat(documentContent, fileName);

  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showActions, setShowActions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentResponse, scrollToBottom]);

  // Keyboard shortcut: Ctrl+Enter to submit
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'i') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSend = useCallback(
    (text: string, action?: PromptType, options?: Record<string, string>) => {
      if (!text.trim() && action === 'chat') return;
      sendMessage(text, action || 'chat', options);
      setInput('');
      setShowActions(false);
    },
    [sendMessage]
  );

  const handleCopy = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }, []);

  const handleInsert = useCallback(
    (content: string) => {
      if (onInsertContent) {
        onInsertContent(content);
      }
    },
    [onInsertContent]
  );

  // ── Suggestion Buttons ────────────────────────────────────────────────────

  const primarySuggestions: SuggestionItem[] = [
    { label: 'Summarize', action: 'summary', icon: <FileText size={12} />, message: 'Summarize this document' },
    { label: 'Generate TOC', action: 'toc', icon: <Heading size={12} />, message: 'Generate Table of Contents' },
    { label: 'Document Insights', action: 'insights', icon: <BarChart3 size={12} />, message: 'Analyze document and provide insights' },
  ];

  const allActions: SuggestionItem[] = [
    { label: 'Summarize (Short)', action: 'summary', icon: <FileText size={12} />, options: { mode: 'short' }, message: 'Summarize this document (short)' },
    { label: 'Summarize (Detailed)', action: 'summary', icon: <FileText size={12} />, options: { mode: 'detailed' }, message: 'Summarize this document (detailed)' },
    { label: 'Generate TOC', action: 'toc', icon: <Heading size={12} />, message: 'Generate Table of Contents' },
    { label: 'Generate FAQ', action: 'faq', icon: <HelpCircle size={12} />, message: 'Generate FAQ section' },
    { label: 'Create Flashcards', action: 'flashcards', icon: <ClipboardList size={12} />, message: 'Create study flashcards' },
    { label: 'Interview Questions', action: 'interview', icon: <GraduationCap size={12} />, message: 'Generate interview questions' },
    { label: 'Generate Mermaid', action: 'mermaid', icon: <GitBranch size={12} />, message: 'Generate a diagram from this document' },
    { label: 'Document Insights', action: 'insights', icon: <BarChart3 size={12} />, message: 'Analyze document and provide insights' },
    { label: 'Suggest Titles', action: 'titles', icon: <Lightbulb size={12} />, message: 'Generate 5 title suggestions' },
    { label: 'Improve Writing', action: 'improve', icon: <PenTool size={12} />, message: 'Improve the writing quality' },
    { label: 'Fix Grammar', action: 'grammar', icon: <BookOpen size={12} />, message: 'Fix grammar and spelling' },
    { label: 'Translate', action: 'translate', icon: <Languages size={12} />, options: { targetLanguage: 'spanish' }, message: 'Translate this document' },
  ];

  // ── Styles ────────────────────────────────────────────────────────────────

  const panelStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: 'var(--color-bg-primary)',
    borderLeft: '1px solid var(--color-border)',
  };

  const headerStyle: React.CSSProperties = {
    padding: '12px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid var(--color-border)',
    flexShrink: 0,
  };

  const messageAreaStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  };

  const inputAreaStyle: React.CSSProperties = {
    padding: '12px 16px',
    borderTop: '1px solid var(--color-border)',
    flexShrink: 0,
  };

  const bubbleBase: React.CSSProperties = {
    maxWidth: '90%',
    padding: '10px 14px',
    borderRadius: '12px',
    fontSize: '13px',
    lineHeight: 1.6,
  };

  const buttonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    color: 'var(--color-text-secondary)',
  };

  const suggestionBtnStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-bg-secondary)',
    border: '1px solid var(--color-border)',
    padding: '6px 10px',
    borderRadius: '16px',
    fontSize: '12px',
    cursor: 'pointer',
    color: 'var(--color-text-primary)',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap' as const,
  };

  return (
    <div className="chat-panel" style={panelStyle}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
          <Sparkles size={18} color="var(--color-accent)" />
          AI Assistant
          {streaming && (
            <span style={{ fontSize: '11px', color: 'var(--color-accent)', fontWeight: 400 }}>
              streaming...
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={clear} style={buttonStyle} title="Clear chat">
            <Trash2 size={14} />
          </button>
          {onClose && (
            <button onClick={onClose} style={buttonStyle} title="Close">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* ── Messages ────────────────────────────────────────────────────── */}
      <div style={messageAreaStyle}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              gap: '10px',
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
            }}
          >
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                backgroundColor:
                  msg.role === 'user' ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
                color: msg.role === 'user' ? '#fff' : 'var(--color-text-primary)',
              }}
            >
              {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
            </div>
            <div
              style={{
                ...bubbleBase,
                backgroundColor:
                  msg.role === 'user' ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
                color: msg.role === 'user' ? '#fff' : 'var(--color-text-primary)',
                borderTopRightRadius: msg.role === 'user' ? '2px' : '12px',
                borderTopLeftRadius: msg.role === 'assistant' ? '2px' : '12px',
              }}
              className={msg.role === 'assistant' ? 'ai-message-content' : ''}
            >
              {msg.role === 'assistant' ? (
                <>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  {msg.id !== 'welcome' && (
                    <div
                      style={{
                        display: 'flex',
                        gap: '4px',
                        marginTop: '8px',
                        borderTop: '1px solid rgba(255,255,255,0.1)',
                        paddingTop: '6px',
                      }}
                    >
                      <button
                        onClick={() => handleCopy(msg.content, msg.id)}
                        style={{ ...buttonStyle, fontSize: '11px', gap: '4px' }}
                        title="Copy response"
                      >
                        {copiedId === msg.id ? <Check size={12} color="#2ea043" /> : <Copy size={12} />}
                        {copiedId === msg.id ? 'Copied' : 'Copy'}
                      </button>
                      {onInsertContent && (
                        <button
                          onClick={() => handleInsert(msg.content)}
                          style={{ ...buttonStyle, fontSize: '11px', gap: '4px' }}
                          title="Insert into editor"
                        >
                          <FileText size={12} />
                          Insert
                        </button>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
              )}
            </div>
          </div>
        ))}

        {/* ── Streaming response ───────────────────────────────────────── */}
        {streaming && currentResponse && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                backgroundColor: 'var(--color-bg-secondary)',
              }}
            >
              <Bot size={14} />
            </div>
            <div
              style={{
                ...bubbleBase,
                backgroundColor: 'var(--color-bg-secondary)',
                color: 'var(--color-text-primary)',
                borderTopLeftRadius: '2px',
              }}
              className="ai-message-content"
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentResponse}</ReactMarkdown>
              <span className="streaming-cursor" style={{
                display: 'inline-block',
                width: '2px',
                height: '14px',
                backgroundColor: 'var(--color-accent)',
                marginLeft: '2px',
                animation: 'blink 1s step-end infinite',
                verticalAlign: 'text-bottom',
              }} />
            </div>
          </div>
        )}

        {/* ── Loading indicator ─────────────────────────────────────────── */}
        {loading && !currentResponse && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--color-bg-secondary)',
              }}
            >
              <Bot size={14} />
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                backgroundColor: 'var(--color-bg-secondary)',
                borderRadius: '12px',
                borderTopLeftRadius: '2px',
                fontSize: '13px',
                color: 'var(--color-text-secondary)',
              }}
            >
              <Loader2 size={14} className="spin" /> Thinking...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input Area ──────────────────────────────────────────────────── */}
      <div style={inputAreaStyle}>
        {/* Suggestion chips — shown only at start or when actions panel is open */}
        {(messages.length <= 1 || showActions) && (
          <div style={{ marginBottom: '12px' }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
              }}
            >
              {(showActions ? allActions : primarySuggestions).map((sugg, i) => (
                <button
                  key={`${sugg.action}-${i}`}
                  onClick={() =>
                    handleSend(sugg.message || '', sugg.action, sugg.options)
                  }
                  disabled={loading}
                  style={{
                    ...suggestionBtnStyle,
                    opacity: loading ? 0.5 : 1,
                  }}
                >
                  {sugg.icon} {sugg.label}
                </button>
              ))}
            </div>
            {!showActions && messages.length <= 1 && (
              <button
                onClick={() => setShowActions(true)}
                style={{
                  ...suggestionBtnStyle,
                  marginTop: '6px',
                  color: 'var(--color-accent)',
                  border: '1px solid var(--color-accent)',
                  backgroundColor: 'transparent',
                }}
              >
                <ChevronDown size={12} /> More actions...
              </button>
            )}
          </div>
        )}

        {/* Input row */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(input);
              }
            }}
            placeholder="Ask AI about this document..."
            disabled={streaming}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '20px',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg-secondary)',
              color: 'var(--color-text-primary)',
              outline: 'none',
              opacity: streaming ? 0.6 : 1,
            }}
          />

          {streaming ? (
            <button
              onClick={cancel}
              title="Stop generating"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: '#da3633',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <StopCircle size={16} />
            </button>
          ) : (
            <button
              onClick={() => handleSend(input)}
              disabled={!input.trim() || loading}
              title="Send message (Enter)"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor:
                  input.trim() && !loading
                    ? 'var(--color-accent)'
                    : 'var(--color-bg-secondary)',
                color:
                  input.trim() && !loading ? '#fff' : 'var(--color-text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: input.trim() && !loading ? 'pointer' : 'default',
                transition: 'all 0.2s',
              }}
            >
              <Send size={16} />
            </button>
          )}
        </div>

        {/* Retry button on error */}
        {!loading && messages.length > 1 && messages[messages.length - 1].content.startsWith('⚠️') && (
          <button
            onClick={retry}
            style={{
              ...suggestionBtnStyle,
              marginTop: '8px',
              color: 'var(--color-accent)',
              borderColor: 'var(--color-accent)',
              backgroundColor: 'transparent',
            }}
          >
            <RotateCcw size={12} /> Retry last request
          </button>
        )}
      </div>
    </div>
  );
};
