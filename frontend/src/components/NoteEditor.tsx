import { useState } from 'react';
import { v4 as uuid } from 'uuid';
import { usePowerSync } from '@powersync/react';
import { connector } from '../lib/PowerSyncProvider';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:6061';

export function NoteEditor({ onClose }: { onClose: () => void }) {
  const powerSync = usePowerSync();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleImportUrl = async () => {
    if (!sourceUrl.trim()) return;
    setImporting(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/ai/extract-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sourceUrl.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        if (!title.trim()) setTitle(data.title || '');
        setContent(prev => prev ? prev + '\n\n' + data.content : data.content);
      }
    } catch { /* offline or error - user can still type manually */ }
    setImporting(false);
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);

    const id = uuid();
    const now = new Date().toISOString();

    await powerSync.execute(
      `INSERT INTO notes (id, title, content, source_url, tags, ai_summary, ai_tags, ai_connections, is_processed, created_at, updated_at, owner_id)
       VALUES (?, ?, ?, ?, '', '', '', '', 0, ?, ?, ?)`,
      [id, title.trim(), content.trim(), sourceUrl.trim() || null, now, now, connector.userId]
    );

    // Trigger AI processing in background (retry with delay to allow sync to PostgreSQL)
    const triggerAI = async (noteId: string, retries = 5) => {
      for (let i = 0; i < retries; i++) {
        await new Promise(r => setTimeout(r, 2000 * (i + 1)));
        try {
          const res = await fetch(`${BACKEND_URL}/api/ai/process/${noteId}`, { method: 'POST' });
          if (res.ok) return;
          if (res.status !== 404) return; // only retry on 404 (sync not yet complete)
        } catch { /* network error, retry */ }
      }
    };
    triggerAI(id);

    setSaving(false);
    onClose();
  };

  return (
    <div className="note-editor">
      <h2>New Research Note</h2>
      <input
        type="text"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />
      <textarea
        placeholder="Paste your research content, article text, or notes..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={10}
      />
      <div className="url-import-row">
        <input
          type="url"
          placeholder="Source URL (optional) — paste a link to auto-import"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
        />
        {sourceUrl.trim() && (
          <button
            onClick={handleImportUrl}
            disabled={importing}
            className="btn-secondary btn-sm"
          >
            {importing ? 'Importing...' : 'Import'}
          </button>
        )}
      </div>
      <div className="editor-actions">
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={handleSave} disabled={saving || !title.trim()} className="btn-primary">
          {saving ? 'Saving...' : 'Save & Analyze'}
        </button>
      </div>
    </div>
  );
}
