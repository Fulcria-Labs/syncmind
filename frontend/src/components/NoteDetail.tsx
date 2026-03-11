import { useState, useMemo } from 'react';
import { useQuery, useStatus } from '@powersync/react';
import { usePowerSync } from '@powersync/react';
import ReactMarkdown from 'react-markdown';
import type { NoteRecord, ConnectionRecord } from '../lib/AppSchema';
import { extractKeywords, localSummary } from '../lib/localKeywords';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:6061';

interface NoteDetailProps {
  noteId: string;
  onNavigate: (id: string) => void;
  onDeleted?: () => void;
}

export function NoteDetail({ noteId, onNavigate, onDeleted }: NoteDetailProps) {
  const powerSync = usePowerSync();
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [saving, setSaving] = useState(false);

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
  const status = useStatus();

  // Local keyword extraction - works offline, no AI needed
  const localKeywords = useMemo(
    () => note ? extractKeywords((note.title || '') + ' ' + (note.content || '')) : [],
    [note?.title, note?.content]
  );
  const localSummaryText = useMemo(
    () => note && !note.ai_summary ? localSummary(note.content || '') : '',
    [note?.content, note?.ai_summary]
  );

  if (!note) return <div className="detail-empty">Note not found</div>;

  const handleReprocess = async () => {
    await fetch(`${BACKEND_URL}/api/ai/process/${noteId}`, { method: 'POST' });
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${note?.title || 'this note'}"? This cannot be undone.`)) return;
    await powerSync.execute(`DELETE FROM connections WHERE source_note_id = ? OR target_note_id = ?`, [noteId, noteId]);
    await powerSync.execute(`DELETE FROM notes WHERE id = ?`, [noteId]);
    onDeleted?.();
  };

  const startEdit = () => {
    setEditTitle(note.title || '');
    setEditContent(note.content || '');
    setEditUrl(note.source_url || '');
    setEditing(true);
  };

  const handleSave = async () => {
    if (!editTitle.trim()) return;
    setSaving(true);
    const now = new Date().toISOString();
    await powerSync.execute(
      `UPDATE notes SET title = ?, content = ?, source_url = ?, updated_at = ?, is_processed = 0 WHERE id = ?`,
      [editTitle.trim(), editContent.trim(), editUrl.trim() || null, now, noteId]
    );
    // Re-trigger AI processing (with sync delay retry)
    const retryAI = async () => {
      for (let i = 0; i < 5; i++) {
        await new Promise(r => setTimeout(r, 2000 * (i + 1)));
        try {
          const res = await fetch(`${BACKEND_URL}/api/ai/process/${noteId}`, { method: 'POST' });
          if (res.ok || res.status !== 404) return;
        } catch { /* retry */ }
      }
    };
    retryAI();
    setSaving(false);
    setEditing(false);
  };

  const allConnections = [
    ...outConnections.map(c => ({ ...c, direction: 'out' as const })),
    ...inConnections.map(c => ({ ...c, direction: 'in' as const }))
  ];

  const handleExport = () => {
    const tags = (note.ai_tags || '').split(',').filter(Boolean).map((t: string) => t.trim());
    const md = [
      `# ${note.title}`,
      note.source_url ? `\nSource: ${note.source_url}` : '',
      `\nCreated: ${note.created_at}`,
      tags.length ? `\nTags: ${tags.join(', ')}` : '',
      `\n## Content\n\n${note.content || ''}`,
      note.ai_summary ? `\n## AI Summary\n\n${note.ai_summary}` : '',
      allConnections.length ? `\n## Connected Notes\n\n${allConnections.map(c =>
        `- ${(c as any).target_title || (c as any).source_title}: ${c.relationship}`
      ).join('\n')}` : ''
    ].filter(Boolean).join('\n');

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(note.title || 'note').replace(/[^a-z0-9]/gi, '-').toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (editing) {
    return (
      <div className="note-detail">
        <h2>Edit Note</h2>
        <div className="note-editor">
          <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Title" autoFocus />
          <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} placeholder="Content..." rows={10} />
          <input type="url" value={editUrl} onChange={(e) => setEditUrl(e.target.value)} placeholder="Source URL (optional)" />
          <div className="editor-actions">
            <button onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving || !editTitle.trim()} className="btn-primary">
              {saving ? 'Saving...' : 'Save & Re-analyze'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="note-detail">
      <div className="detail-header">
        <h2>{note.title}</h2>
        <div className="detail-header-actions">
          <button onClick={startEdit} className="btn-secondary btn-sm">Edit</button>
          <button onClick={handleDelete} className="btn-danger btn-sm">Delete</button>
        </div>
      </div>
      {note.source_url && (
        <a href={note.source_url} target="_blank" rel="noopener noreferrer" className="source-link">
          Source
        </a>
      )}

      <div className="content-section">
        <h3>Content</h3>
        <div className="note-content"><ReactMarkdown>{note.content || ''}</ReactMarkdown></div>
      </div>

      {note.ai_summary ? (
        <div className="ai-section">
          <h3>AI Summary</h3>
          <p>{note.ai_summary}</p>
        </div>
      ) : localSummaryText && (
        <div className="ai-section local-analysis">
          <h3>Local Summary {!status.connected && '(offline)'}</h3>
          <p>{localSummaryText}</p>
          {status.connected && <span className="hint">Full AI analysis pending...</span>}
        </div>
      )}

      {note.ai_tags ? (
        <div className="ai-section">
          <h3>AI Tags</h3>
          <div className="tags">
            {(note.ai_tags || '').split(',').filter(Boolean).map((tag: string) => (
              <span key={tag} className="tag">{tag.trim()}</span>
            ))}
          </div>
        </div>
      ) : localKeywords.length > 0 && (
        <div className="ai-section local-analysis">
          <h3>Local Keywords {!status.connected && '(offline)'}</h3>
          <div className="tags">
            {localKeywords.map(kw => (
              <span key={kw} className="tag local-tag">{kw}</span>
            ))}
          </div>
          {status.connected && <span className="hint">Full AI tagging pending...</span>}
        </div>
      )}

      <div className="ai-section">
        <h3>Connected Notes</h3>
        {allConnections.length > 0 ? (
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
                {conn.confidence && (
                  <span className="conn-confidence">{Math.round(Number(conn.confidence) * 100)}%</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="hint">
            {note.is_processed ? 'No connections discovered yet' : 'Connections will appear after AI analysis'}
          </p>
        )}
      </div>

      <div className="detail-actions">
        <button onClick={handleReprocess} className="btn-secondary">
          Re-analyze with AI
        </button>
        <button onClick={handleExport} className="btn-secondary" style={{ marginLeft: 8 }}>
          Export as Markdown
        </button>
      </div>
    </div>
  );
}
