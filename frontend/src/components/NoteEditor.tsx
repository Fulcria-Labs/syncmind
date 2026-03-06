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

    // Trigger AI processing in background
    fetch(`${BACKEND_URL}/api/ai/process/${id}`, { method: 'POST' }).catch(() => {});

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
      <input
        type="url"
        placeholder="Source URL (optional)"
        value={sourceUrl}
        onChange={(e) => setSourceUrl(e.target.value)}
      />
      <div className="editor-actions">
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={handleSave} disabled={saving || !title.trim()} className="btn-primary">
          {saving ? 'Saving...' : 'Save & Analyze'}
        </button>
      </div>
    </div>
  );
}
