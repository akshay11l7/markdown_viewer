/**
 * ExplainPopup — Floating Explanation Popup
 *
 * Shows AI explanations near the selected text in the editor.
 * Supports simplified, technical, and beginner explanation levels.
 */

import React, { useState, useEffect } from 'react';
import { Loader2, X, Copy, Check, BookOpen, Code2, GraduationCap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAIAction } from '../../hooks/useAI';
import type { ExplanationLevel } from '../../types/ai';
import { EXPLANATION_LEVEL_LABELS } from '../../services/promptBuilder';

type ExplainPopupProps = {
  /** The selected text to explain */
  text: string;
  /** Position of the popup */
  position: { x: number; y: number };
  /** Called when the popup is closed */
  onClose: () => void;
  /** Called when user wants to insert the explanation */
  onInsert?: (content: string) => void;
};

export const ExplainPopup: React.FC<ExplainPopupProps> = ({
  text,
  position,
  onClose,
  onInsert,
}) => {
  const { executeAction } = useAIAction();
  const [level, setLevel] = useState<ExplanationLevel>('simplified');
  const [explanation, setExplanation] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Auto-explain on mount and when level changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setExplanation('');

    executeAction('explain', text, { level })
      .then((result) => {
        if (!cancelled) {
          setExplanation(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Failed to explain');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [text, level, executeAction]);

  const handleCopy = () => {
    navigator.clipboard.writeText(explanation).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const levels: { value: ExplanationLevel; icon: React.ReactNode }[] = [
    { value: 'simplified', icon: <BookOpen size={12} /> },
    { value: 'technical', icon: <Code2 size={12} /> },
    { value: 'beginner', icon: <GraduationCap size={12} /> },
  ];

  // Calculate popup position — ensure it stays within viewport
  const popupStyle: React.CSSProperties = {
    position: 'fixed',
    top: Math.min(position.y + 10, window.innerHeight - 400),
    left: Math.min(position.x, window.innerWidth - 420),
    width: '400px',
    maxHeight: '360px',
    backgroundColor: 'var(--color-bg-primary)',
    border: '1px solid var(--color-border)',
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    zIndex: 5000,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };

  return (
    <div style={popupStyle}>
      {/* Header */}
      <div
        style={{
          padding: '10px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', gap: '4px' }}>
          {levels.map((l) => (
            <button
              key={l.value}
              onClick={() => setLevel(l.value)}
              style={{
                padding: '4px 10px',
                borderRadius: '12px',
                border: level === l.value ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                backgroundColor: level === l.value ? 'var(--color-accent)' : 'transparent',
                color: level === l.value ? '#fff' : 'var(--color-text-secondary)',
                fontSize: '11px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.15s',
              }}
            >
              {l.icon} {EXPLANATION_LEVEL_LABELS[l.value]}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            padding: '2px',
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 14px',
          fontSize: '13px',
          lineHeight: 1.6,
          color: 'var(--color-text-primary)',
        }}
        className="ai-message-content"
      >
        {loading ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: 'var(--color-text-secondary)',
              padding: '16px 0',
              justifyContent: 'center',
            }}
          >
            <Loader2 size={14} className="spin" /> Generating explanation...
          </div>
        ) : error ? (
          <div style={{ color: '#ff7b72', textAlign: 'center', padding: '16px 0' }}>
            {error}
          </div>
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{explanation}</ReactMarkdown>
        )}
      </div>

      {/* Footer actions */}
      {explanation && !loading && (
        <div
          style={{
            padding: '8px 14px',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            gap: '8px',
            flexShrink: 0,
          }}
        >
          <button
            onClick={handleCopy}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              border: '1px solid var(--color-border)',
              backgroundColor: 'transparent',
              color: 'var(--color-text-secondary)',
              fontSize: '11px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {copied ? <Check size={12} color="#2ea043" /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          {onInsert && (
            <button
              onClick={() => onInsert(explanation)}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid var(--color-accent)',
                backgroundColor: 'var(--color-accent)',
                color: '#fff',
                fontSize: '11px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              Insert into editor
            </button>
          )}
        </div>
      )}
    </div>
  );
};
