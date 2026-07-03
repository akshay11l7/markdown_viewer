import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2, X, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { askAI, AIAction } from '../../services/ai';

type Message = {
  id: string;
  role: 'user' | 'ai';
  content: string;
  action?: AIAction;
};

type ChatPanelProps = {
  onClose?: () => void;
  documentContent: string;
  onApplyChange?: (content: string) => void;
};

export const ChatPanel: React.FC<ChatPanelProps> = ({ onClose, documentContent, onApplyChange }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'ai',
      content: 'Hello! I am your AI assistant. I can summarize this document, explain concepts, generate diagrams, or answer any questions you have about it.'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (text: string, action: AIAction = 'chat') => {
    if (!text.trim() && action === 'chat') return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: action === 'chat' ? text : `Action requested: ${action.toUpperCase()}`,
      action
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await askAI(action, text || documentContent, documentContent);
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: response
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', content: 'Sorry, I encountered an error while processing your request.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const suggestions: { label: string, action: AIAction }[] = [
    { label: 'Summarize', action: 'summary' },
    { label: 'Generate TOC', action: 'toc' },
    { label: 'Extract Interview Qs', action: 'chat' }
  ];

  return (
    <div className="chat-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--color-bg-primary)', borderLeft: '1px solid var(--color-border)' }}>
      <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
          <Sparkles size={18} color="var(--color-accent)" />
          AI Assistant
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {messages.map(msg => (
          <div key={msg.id} style={{ display: 'flex', gap: '12px', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
            <div style={{ 
              width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              backgroundColor: msg.role === 'user' ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
              color: msg.role === 'user' ? '#fff' : 'var(--color-text-primary)'
            }}>
              {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div style={{ 
              maxWidth: '85%', 
              backgroundColor: msg.role === 'user' ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
              color: msg.role === 'user' ? '#fff' : 'var(--color-text-primary)',
              padding: '10px 14px',
              borderRadius: '8px',
              borderTopRightRadius: msg.role === 'user' ? '2px' : '8px',
              borderTopLeftRadius: msg.role === 'ai' ? '2px' : '8px',
              fontSize: '13px',
              lineHeight: 1.5
            }} className={msg.role === 'ai' ? 'ai-message-content' : ''}>
              {msg.role === 'ai' ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.content}
                </ReactMarkdown>
              ) : (
                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div style={{ display: 'flex', gap: '12px' }}>
             <div style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-bg-secondary)' }}>
                <Bot size={16} />
             </div>
             <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '8px', borderTopLeftRadius: '2px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                <Loader2 size={14} className="spin" /> Thinking...
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--color-border)' }}>
        {messages.length === 1 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
            {suggestions.map(sugg => (
              <button 
                key={sugg.label}
                onClick={() => {
                   if (sugg.label === 'Extract Interview Qs') {
                     handleSend('Generate interview questions from this document', 'chat');
                   } else {
                     handleSend('', sugg.action);
                   }
                }}
                style={{ 
                  backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', 
                  padding: '6px 10px', borderRadius: '16px', fontSize: '12px', cursor: 'pointer',
                  color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '4px'
                }}
              >
                <Sparkles size={12} color="var(--color-accent)" /> {sugg.label}
              </button>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px', position: 'relative' }}>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(input); } }}
            placeholder="Ask AI about this document..."
            style={{ 
              flex: 1, padding: '10px 14px', borderRadius: '20px', 
              border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-secondary)',
              color: 'var(--color-text-primary)', outline: 'none'
            }}
          />
          <button 
            onClick={() => handleSend(input)}
            disabled={!input.trim() || isLoading}
            style={{ 
              width: '38px', height: '38px', borderRadius: '50%', border: 'none',
              backgroundColor: input.trim() && !isLoading ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
              color: input.trim() && !isLoading ? '#fff' : 'var(--color-text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() && !isLoading ? 'pointer' : 'default',
              transition: 'all 0.2s'
            }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
