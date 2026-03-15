import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { connector } from '../lib/PowerSyncProvider';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:6061';

interface ToolCall {
  toolName: string;
  args?: Record<string, unknown>;
  resultSummary?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: ToolCall[];
}

const TOOL_LABELS: Record<string, string> = {
  'searchNotesTool': 'Searched notes',
  'getNoteDetailTool': 'Read note details',
  'listAllNotesTool': 'Listed all notes',
  'getTagsTool': 'Analyzed tags',
  'getConnectionGraphTool': 'Explored connections',
};

const TOOL_ICONS: Record<string, string> = {
  'searchNotesTool': '\uD83D\uDD0D',
  'getNoteDetailTool': '\uD83D\uDCDD',
  'listAllNotesTool': '\uD83D\uDCCB',
  'getTagsTool': '\uD83C\uDFF7\uFE0F',
  'getConnectionGraphTool': '\uD83D\uDD17',
};

function formatToolSummary(tc: ToolCall): string {
  const label = TOOL_LABELS[tc.toolName] || tc.toolName;
  const icon = TOOL_ICONS[tc.toolName] || '\u2699\uFE0F';

  if (tc.resultSummary) {
    return `${icon} ${label}: ${tc.resultSummary}`;
  }

  // Build a brief summary from args
  const args = tc.args;
  if (!args) return `${icon} ${label}`;

  if (tc.toolName === 'searchNotesTool' && args.query) {
    return `${icon} Searched '${args.query}'`;
  }
  if (tc.toolName === 'getNoteDetailTool' && args.note_id) {
    const shortId = String(args.note_id).slice(0, 8);
    return `${icon} Read note ${shortId}...`;
  }
  if (tc.toolName === 'listAllNotesTool') {
    return `${icon} Listed all notes`;
  }

  return `${icon} ${label}`;
}

export function AgentChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [expandedTools, setExpandedTools] = useState<Set<number>>(new Set());
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleCopy = useCallback(async (text: string, msgIdx: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(msgIdx);
      setTimeout(() => setCopiedIdx(null), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedIdx(msgIdx);
      setTimeout(() => setCopiedIdx(null), 2000);
    }
  }, []);

  const toggleToolExpansion = useCallback((msgIdx: number) => {
    setExpandedTools(prev => {
      const next = new Set(prev);
      if (next.has(msgIdx)) {
        next.delete(msgIdx);
      } else {
        next.add(msgIdx);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: input };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`${BACKEND_URL}/api/ai/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          history: messages.map(m => ({ role: m.role, content: m.content })),
          owner_id: connector.userId
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Request failed' }));
        setMessages([...updated, { role: 'assistant', content: `Error: ${err.message}` }]);
      } else {
        const data = await res.json();
        const toolsUsed: ToolCall[] = (data.toolCalls || []).map((tc: any) => ({
          toolName: tc.toolName || tc.name || 'unknown',
          args: tc.args,
          resultSummary: tc.resultSummary || undefined
        }));
        setMessages([...updated, {
          role: 'assistant',
          content: data.reply,
          toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined
        }]);
      }
    } catch {
      setMessages([...updated, { role: 'assistant', content: 'Failed to reach the agent. Are you online?' }]);
    }

    setLoading(false);
  };

  if (!isOpen) {
    return (
      <button className="agent-chat-fab" onClick={() => setIsOpen(true)} title="Research Agent">
        <span className="agent-icon">AI</span>
      </button>
    );
  }

  return (
    <div className="agent-chat-panel">
      <div className="agent-chat-header">
        <span>Research Agent</span>
        <span className="agent-badge">Mastra</span>
        <button className="agent-close" onClick={() => setIsOpen(false)}>x</button>
      </div>

      <div className="agent-chat-messages">
        {messages.length === 0 && (
          <div className="agent-welcome">
            <p><strong>SyncMind Research Agent</strong></p>
            <p>I can search your notes, find connections, generate briefs, and answer questions about your research.</p>
            <div className="agent-suggestions">
              {['What are my main research themes?', 'Summarize my recent notes', 'Find connections between my notes'].map(s => (
                <button key={s} className="suggestion-chip" onClick={() => { setInput(s); }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`agent-msg agent-msg-${msg.role}`}>
            {msg.role === 'assistant' && msg.toolsUsed && msg.toolsUsed.length > 0 && (
              <div className="agent-tools-trace">
                <button
                  className="tool-trace-toggle"
                  onClick={() => toggleToolExpansion(i)}
                >
                  <span className="tool-trace-icon">{expandedTools.has(i) ? '\u25BC' : '\u25B6'}</span>
                  <span className="tool-trace-summary">
                    Used {msg.toolsUsed.length} tool{msg.toolsUsed.length > 1 ? 's' : ''}
                  </span>
                </button>
                {expandedTools.has(i) && (
                  <div className="tool-trace-details">
                    {msg.toolsUsed.map((tc, j) => (
                      <div key={j} className="tool-trace-item">
                        {formatToolSummary(tc)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {msg.role === 'assistant' ? (
              <>
                <ReactMarkdown>{msg.content}</ReactMarkdown>
                <button
                  className="copy-btn"
                  onClick={() => handleCopy(msg.content, i)}
                  title="Copy response"
                >
                  {copiedIdx === i ? 'Copied!' : 'Copy'}
                </button>
              </>
            ) : (
              <p>{msg.content}</p>
            )}
          </div>
        ))}
        {loading && (
          <div className="agent-msg agent-msg-assistant">
            <div className="agent-typing">Thinking...</div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="agent-chat-input">
        <input
          type="text"
          placeholder="Ask the research agent..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          disabled={loading}
        />
        <button onClick={sendMessage} disabled={loading || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
