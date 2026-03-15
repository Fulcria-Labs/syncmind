import { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { useQuery } from '@powersync/react';
import { connector } from '../lib/PowerSyncProvider';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:6061';

export function AskAI() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLocalResult, setIsLocalResult] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, []);

  // Keep all notes available for local search fallback
  const { data: allNotes } = useQuery<{
    id: string; title: string; content: string; ai_summary: string; ai_tags: string;
  }>('SELECT id, title, content, ai_summary, ai_tags FROM notes ORDER BY updated_at DESC');

  const localSearch = (q: string): string => {
    const terms = q.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    if (!terms.length || !allNotes.length) return 'No notes found matching your query.';

    const scored = allNotes.map(note => {
      const text = `${note.title} ${note.content} ${note.ai_summary} ${note.ai_tags}`.toLowerCase();
      const matches = terms.filter(t => text.includes(t));
      return { note, score: matches.length / terms.length };
    }).filter(s => s.score > 0).sort((a, b) => b.score - a.score);

    if (!scored.length) return 'No notes found matching your query. Try different keywords.';

    const top = scored.slice(0, 3);
    const parts = top.map(({ note, score }) => {
      const summary = note.ai_summary || note.content.slice(0, 200);
      const relevance = Math.round(score * 100);
      return `### ${note.title} (${relevance}% match)\n${summary}`;
    });

    return `*Local search results (offline mode):*\n\n${parts.join('\n\n---\n\n')}`;
  };

  const handleAsk = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setAnswer('');
    setIsLocalResult(false);

    try {
      const res = await fetch(`${BACKEND_URL}/api/ai/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, owner_id: connector.userId })
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setAnswer(data.answer || 'No answer available');
    } catch {
      // Fallback: local keyword search via PowerSync local DB
      setIsLocalResult(true);
      setAnswer(localSearch(question));
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
        <div className={`ai-answer ${isLocalResult ? 'local-result' : ''}`}>
          {isLocalResult && (
            <div className="local-badge">Searched locally via PowerSync SQLite</div>
          )}
          <ReactMarkdown>{answer}</ReactMarkdown>
          <button
            className="copy-btn"
            onClick={() => handleCopy(answer)}
            title="Copy response"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}
    </div>
  );
}
