import { useQuery } from '@powersync/react';
import type { NoteRecord, ConnectionRecord } from '../lib/AppSchema';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:6061';

interface NoteDetailProps {
  noteId: string;
  onNavigate: (id: string) => void;
}

export function NoteDetail({ noteId, onNavigate }: NoteDetailProps) {
  const { data: notes } = useQuery<NoteRecord & { id: string }>(
    `SELECT * FROM notes WHERE id = ?`,
    [noteId]
  );

  const { data: outConnections } = useQuery<ConnectionRecord & { id: string }>(
    `SELECT c.*, n.title as target_title FROM connections c
     LEFT JOIN notes n ON n.id = c.target_note_id
     WHERE c.source_note_id = ?`,
    [noteId]
  );

  const { data: inConnections } = useQuery<ConnectionRecord & { id: string }>(
    `SELECT c.*, n.title as source_title FROM connections c
     LEFT JOIN notes n ON n.id = c.source_note_id
     WHERE c.target_note_id = ?`,
    [noteId]
  );

  const note = notes[0];
  if (!note) return <div className="detail-empty">Note not found</div>;

  const handleReprocess = async () => {
    await fetch(`${BACKEND_URL}/api/ai/process/${noteId}`, { method: 'POST' });
  };

  const allConnections = [
    ...outConnections.map(c => ({ ...c, direction: 'out' as const })),
    ...inConnections.map(c => ({ ...c, direction: 'in' as const }))
  ];

  return (
    <div className="note-detail">
      <h2>{note.title}</h2>
      {note.source_url && (
        <a href={note.source_url} target="_blank" rel="noopener noreferrer" className="source-link">
          Source
        </a>
      )}

      <div className="content-section">
        <h3>Content</h3>
        <div className="note-content">{note.content}</div>
      </div>

      {note.ai_summary && (
        <div className="ai-section">
          <h3>AI Summary</h3>
          <p>{note.ai_summary}</p>
        </div>
      )}

      {note.ai_tags && (
        <div className="ai-section">
          <h3>AI Tags</h3>
          <div className="tags">
            {(note.ai_tags || '').split(',').filter(Boolean).map((tag: string) => (
              <span key={tag} className="tag">{tag.trim()}</span>
            ))}
          </div>
        </div>
      )}

      {allConnections.length > 0 && (
        <div className="ai-section">
          <h3>Connected Notes</h3>
          <div className="connections">
            {allConnections.map((conn) => (
              <div
                key={conn.id}
                className="connection-card"
                onClick={() => onNavigate(
                  (conn.direction === 'out' ? conn.target_note_id : conn.source_note_id) ?? ''
                )}
              >
                <span className="conn-title">
                  {(conn as any).target_title || (conn as any).source_title || 'Linked note'}
                </span>
                <span className="conn-rel">{conn.relationship}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="detail-actions">
        {!note.is_processed && (
          <button onClick={handleReprocess} className="btn-secondary">
            Re-analyze with AI
          </button>
        )}
      </div>
    </div>
  );
}
