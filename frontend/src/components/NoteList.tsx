import { useQuery } from '@powersync/react';
import type { NoteRecord } from '../lib/AppSchema';

interface NoteListProps {
  onSelect: (id: string) => void;
  selectedId?: string;
  searchQuery: string;
}

export function NoteList({ onSelect, selectedId, searchQuery }: NoteListProps) {
  const { data: notes } = useQuery<NoteRecord & { id: string }>(
    searchQuery
      ? `SELECT * FROM notes WHERE title LIKE ? OR content LIKE ? OR ai_tags LIKE ? ORDER BY updated_at DESC`
      : `SELECT * FROM notes ORDER BY updated_at DESC`,
    searchQuery ? [`%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`] : []
  );

  if (!notes.length) {
    return (
      <div className="empty-state">
        <p>{searchQuery ? 'No matching notes' : 'No research notes yet'}</p>
        <p className="hint">Add your first note to get started</p>
      </div>
    );
  }

  return (
    <div className="note-list">
      {notes.map((note) => (
        <div
          key={note.id}
          className={`note-card ${note.id === selectedId ? 'selected' : ''} ${note.is_processed ? 'processed' : 'pending'}`}
          onClick={() => onSelect(note.id)}
        >
          <h3>{note.title}</h3>
          {note.ai_summary && <p className="summary">{note.ai_summary}</p>}
          {!note.ai_summary && note.content && (
            <p className="preview">{note.content.slice(0, 120)}...</p>
          )}
          <div className="note-meta">
            {note.ai_tags && (
              <div className="tags">
                {note.ai_tags.split(',').filter(Boolean).slice(0, 3).map((tag) => (
                  <span key={tag} className="tag">{tag.trim()}</span>
                ))}
              </div>
            )}
            <span className="date">
              {new Date(note.created_at || '').toLocaleDateString()}
            </span>
            {!note.is_processed && <span className="badge pending">Analyzing...</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
