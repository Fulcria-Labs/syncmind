import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { connector } from '../lib/PowerSyncProvider';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:6061';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function AgentChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

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
          history: messages,
          owner_id: connector.userId
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Request failed' }));
        setMessages([...updated, { role: 'assistant', content: `Error: ${err.message}` }]);
      } else {
        const data = await res.json();
        setMessages([...updated, { role: 'assistant', content: data.reply }]);
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
            {msg.role === 'assistant' ? (
              <ReactMarkdown>{msg.content}</ReactMarkdown>
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
