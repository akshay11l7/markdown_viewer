/**
 * SummaryCard — Document Summary Card
 *
 * Displays an AI-generated document summary with short/medium/detailed toggles.
 * Can also show document insights (reading time, difficulty, keywords).
 */

import React, { useState, useEffect } from 'react';
import { Loader2, FileText, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAIAction } from '../../hooks/useAI';
import type { SummaryMode } from '../../types/ai';
import { SUMMARY_MODE_LABELS } from '../../services/promptBuilder';

type SummaryCardProps = {
  /** Whether the card is visible */
  visible: boolean;
  /** Called when the card is dismissed */
  onClose: () => void;
};

export const SummaryCard: React.FC<SummaryCardProps> = ({ visible, onClose }) => {
  const { executeAction } = useAIAction();
  const [mode, setMode] = useState<SummaryMode>('medium');
  const [summary, setSummary] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = (summaryMode: SummaryMode) => {
    setLoading(true);
    setError(null);
    setSummary('');

    executeAction('summary', '', { mode: summaryMode })
      .then((result) => {
        setSummary(result);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to generate summary');
        setLoading(false);
      });
  };

  useEffect(() => {
    if (visible) {
      fetchSummary(mode);
    }
  }, [visible]);

  const handleModeChange = (newMode: SummaryMode) => {
    setMode(newMode);
    fetchSummary(newMode);
  };

  if (!visible) return null;

  const modes: SummaryMode[] = ['short', 'medium', 'detailed'];

  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '560px',
        maxHeight: '500px',
        backgroundColor: 'var(--color-bg-primary)',
        border: '1px solid var(--color-border)',
        borderRadius: '16px',
        boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
        zIndex: 5000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FileText size={18} color="var(--color-accent)" />
          <span style={{ fontWeight: 600, fontSize: '15px' }}>Document Summary</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => fetchSummary(mode)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              padding: '4px',
            }}
            title="Regenerate"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
              cursor: 'pointer',
              padding: '4px 12px',
              borderRadius: '6px',
              fontSize: '12px',
            }}
          >
            Close
          </button>
        </div>
      </div>

      {/* Mode Tabs */}
      <div
        style={{
          padding: '10px 20px',
          display: 'flex',
          gap: '6px',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        {modes.map((m) => (
          <button
            key={m}
            onClick={() => handleModeChange(m)}
            style={{
              padding: '6px 14px',
              borderRadius: '16px',
              border: mode === m ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
              backgroundColor: mode === m ? 'var(--color-accent)' : 'transparent',
              color: mode === m ? '#fff' : 'var(--color-text-secondary)',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {SUMMARY_MODE_LABELS[m]}
          </button>
        ))}
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          fontSize: '14px',
          lineHeight: 1.7,
          color: 'var(--color-text-primary)',
        }}
        className="ai-message-content"
      >
        {loading ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              color: 'var(--color-text-secondary)',
              padding: '40px 0',
            }}
          >
            <Loader2 size={16} className="spin" /> Generating summary...
          </div>
        ) : error ? (
          <div style={{ color: '#ff7b72', textAlign: 'center', padding: '40px 0' }}>
            {error}
          </div>
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
        )}
      </div>
    </div>
  );
};
