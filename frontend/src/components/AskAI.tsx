import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { connector } from '../lib/PowerSyncProvider';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:6061';

export function AskAI() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAsk = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setAnswer('');

    try {
      const res = await fetch(`${BACKEND_URL}/api/ai/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, owner_id: connector.userId })
      });
      const data = await res.json();
      setAnswer(data.answer || 'No answer available');
    } catch {
      setAnswer('Failed to get answer. Are you online?');
    }
    setLoading(false);
  };

  return (
    <div className="ask-ai">
      <h3>Ask Your Research</h3>
      <div className="ask-input">
        <input
          type="text"
          placeholder="Ask a question across all your notes..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
        />
        <button onClick={handleAsk} disabled={loading || !question.trim()}>
          {loading ? '...' : 'Ask'}
        </button>
      </div>
      {answer && (
        <div className="ai-answer">
          <ReactMarkdown>{answer}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
