/**
 * AIActionBar — Quick Action Toolbar
 *
 * A compact toolbar shown in the editor area for quick access to common AI features.
 * Can be toggled with a keyboard shortcut (Ctrl+I).
 */

import React from 'react';
import {
  Sparkles,
  FileText,
  BookOpen,
  PenTool,
  Languages,
  Heading,
  HelpCircle,
  ClipboardList,
  GraduationCap,
  GitBranch,
  BarChart3,
  Lightbulb,
  X,
} from 'lucide-react';
import type { PromptType } from '../../types/ai';

type AIActionBarProps = {
  /** Whether the bar is visible */
  visible: boolean;
  /** Called when an action is selected */
  onAction: (action: PromptType, message: string) => void;
  /** Called to close the bar */
  onClose: () => void;
  /** Whether there is selected text */
  hasSelection: boolean;
};

type ActionItem = {
  label: string;
  action: PromptType;
  icon: React.ReactNode;
  message: string;
  needsSelection?: boolean;
};

export const AIActionBar: React.FC<AIActionBarProps> = ({
  visible,
  onAction,
  onClose,
  hasSelection,
}) => {
  if (!visible) return null;

  const actions: ActionItem[] = [
    { label: 'Summarize', action: 'summary', icon: <FileText size={14} />, message: 'Summarize this document' },
    { label: 'TOC', action: 'toc', icon: <Heading size={14} />, message: 'Generate Table of Contents' },
    { label: 'Insights', action: 'insights', icon: <BarChart3 size={14} />, message: 'Analyze document' },
    { label: 'FAQ', action: 'faq', icon: <HelpCircle size={14} />, message: 'Generate FAQ' },
    { label: 'Flashcards', action: 'flashcards', icon: <ClipboardList size={14} />, message: 'Create flashcards' },
    { label: 'Interview Qs', action: 'interview', icon: <GraduationCap size={14} />, message: 'Generate interview questions' },
    { label: 'Mermaid', action: 'mermaid', icon: <GitBranch size={14} />, message: 'Generate diagram' },
    { label: 'Titles', action: 'titles', icon: <Lightbulb size={14} />, message: 'Suggest titles' },
  ];

  const selectionActions: ActionItem[] = [
    { label: 'Explain', action: 'explain', icon: <BookOpen size={14} />, message: 'Explain selected text', needsSelection: true },
    { label: 'Improve', action: 'improve', icon: <PenTool size={14} />, message: 'Improve writing', needsSelection: true },
    { label: 'Fix Grammar', action: 'grammar', icon: <BookOpen size={14} />, message: 'Fix grammar', needsSelection: true },
    { label: 'Translate', action: 'translate', icon: <Languages size={14} />, message: 'Translate', needsSelection: true },
  ];

  const btnStyle: React.CSSProperties = {
    padding: '6px 12px',
    borderRadius: '8px',
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-bg-secondary)',
    color: 'var(--color-text-primary)',
    fontSize: '12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap' as const,
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: '8px',
        right: '16px',
        backgroundColor: 'var(--color-bg-primary)',
        border: '1px solid var(--color-border)',
        borderRadius: '12px',
        padding: '12px 16px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        zIndex: 4000,
        maxWidth: '500px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
          <Sparkles size={14} color="var(--color-accent)" />
          AI Actions
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
          <X size={12} />
        </button>
      </div>

      {/* Document-level actions */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
        {actions.map((a) => (
          <button
            key={a.action + a.label}
            onClick={() => onAction(a.action, a.message)}
            style={btnStyle}
          >
            {a.icon} {a.label}
          </button>
        ))}
      </div>

      {/* Selection-dependent actions */}
      {hasSelection && (
        <>
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '8px 0 6px', textTransform: 'uppercase' }}>
            Selected Text
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {selectionActions.map((a) => (
              <button
                key={a.action + a.label}
                onClick={() => onAction(a.action, a.message)}
                style={{ ...btnStyle, borderColor: 'var(--color-accent)' }}
              >
                {a.icon} {a.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
