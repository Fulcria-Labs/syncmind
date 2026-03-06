import { useState } from 'react';
import { useStatus, useQuery } from '@powersync/react';
import ReactMarkdown from 'react-markdown';
import { PowerSyncProvider, connector } from './lib/PowerSyncProvider';
import { NoteEditor } from './components/NoteEditor';
import { NoteList } from './components/NoteList';
import { NoteDetail } from './components/NoteDetail';
import { AskAI } from './components/AskAI';
import './App.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:6061';

function SyncStatus() {
  const status = useStatus();
  return (
    <div className={`sync-status ${status.connected ? 'online' : 'offline'}`}>
      <span className="dot" />
      {status.connected ? 'Synced' : 'Offline'}
      {status.dataFlowStatus?.uploading && ' (uploading...)'}
      {!status.connected && status.dataFlowStatus?.uploading && (
        <span className="queue-badge">changes queued</span>
      )}
    </div>
  );
}

function AppContent() {
  const [showEditor, setShowEditor] = useState(false);
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAsk, setShowAsk] = useState(false);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefContent, setBriefContent] = useState('');

  const { data: noteCount } = useQuery<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM notes`);
  const count = noteCount[0]?.cnt ?? 0;

  const handleBrief = async () => {
    setBriefLoading(true);
    setBriefContent('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/ai/brief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner_id: connector.userId })
      });
      const data = await res.json();
      setBriefContent(data.brief || 'Could not generate brief.');
    } catch {
      setBriefContent('Failed to generate brief. Are you online?');
    }
    setBriefLoading(false);
  };

  return (
    <div className="app">
      <header>
        <div className="header-left">
          <h1>SyncMind</h1>
          <span className="subtitle">AI Research Assistant</span>
          {count > 0 && <span className="note-count">{count} note{count !== 1 ? 's' : ''}</span>}
        </div>
        <div className="header-right">
          <SyncStatus />
        </div>
      </header>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search notes, tags, content..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        <button onClick={() => setShowAsk(!showAsk)} className="btn-secondary">
          {showAsk ? 'Close' : 'Ask AI'}
        </button>
        {count >= 2 && (
          <button onClick={handleBrief} disabled={briefLoading} className="btn-secondary">
            {briefLoading ? 'Generating...' : 'Research Brief'}
          </button>
        )}
        <button onClick={() => setShowEditor(true)} className="btn-primary">
          + New Note
        </button>
      </div>

      {showAsk && <AskAI />}

      {briefContent && (
        <div className="brief-panel">
          <div className="brief-header">
            <h3>Research Brief</h3>
            <button onClick={() => setBriefContent('')} className="btn-secondary btn-sm">Close</button>
          </div>
          <div className="brief-content"><ReactMarkdown>{briefContent}</ReactMarkdown></div>
        </div>
      )}

      {showEditor && (
        <div className="modal-overlay" onClick={() => setShowEditor(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <NoteEditor onClose={() => setShowEditor(false)} />
          </div>
        </div>
      )}

      <div className="main-content">
        <div className="sidebar">
          <NoteList
            onSelect={setSelectedNote}
            selectedId={selectedNote || undefined}
            searchQuery={searchQuery}
          />
        </div>
        <div className="detail-pane">
          {selectedNote ? (
            <NoteDetail
              noteId={selectedNote}
              onNavigate={setSelectedNote}
              onDeleted={() => setSelectedNote(null)}
            />
          ) : (
            <div className="detail-empty">
              <h2>Select a note</h2>
              <p>Choose a note from the sidebar or create a new one</p>
              <p className="hint">
                Notes sync across devices and work offline.
                AI automatically analyzes and connects your research.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <PowerSyncProvider>
      <AppContent />
    </PowerSyncProvider>
  );
}

export default App;
