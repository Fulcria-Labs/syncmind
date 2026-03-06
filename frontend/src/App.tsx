import { useState } from 'react';
import { useStatus } from '@powersync/react';
import { PowerSyncProvider } from './lib/PowerSyncProvider';
import { NoteEditor } from './components/NoteEditor';
import { NoteList } from './components/NoteList';
import { NoteDetail } from './components/NoteDetail';
import { AskAI } from './components/AskAI';
import './App.css';

function SyncStatus() {
  const status = useStatus();
  return (
    <div className={`sync-status ${status.connected ? 'online' : 'offline'}`}>
      <span className="dot" />
      {status.connected ? 'Synced' : 'Offline'}
      {status.dataFlowStatus?.uploading && ' (uploading...)'}
    </div>
  );
}

function AppContent() {
  const [showEditor, setShowEditor] = useState(false);
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAsk, setShowAsk] = useState(false);

  return (
    <div className="app">
      <header>
        <div className="header-left">
          <h1>SyncMind</h1>
          <span className="subtitle">AI Research Assistant</span>
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
        <button onClick={() => setShowEditor(true)} className="btn-primary">
          + New Note
        </button>
      </div>

      {showAsk && <AskAI />}

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
            <NoteDetail noteId={selectedNote} onNavigate={setSelectedNote} />
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
