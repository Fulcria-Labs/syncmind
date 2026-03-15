import { useState, useEffect, useCallback } from 'react';
import { useStatus, useQuery } from '@powersync/react';
import ReactMarkdown from 'react-markdown';
import { PowerSyncProvider, connector } from './lib/PowerSyncProvider';
import { NoteEditor } from './components/NoteEditor';
import { NoteList } from './components/NoteList';
import { NoteDetail } from './components/NoteDetail';
import { AskAI } from './components/AskAI';
import { NoteSearch } from './components/NoteSearch';
import { KnowledgeGraph } from './components/KnowledgeGraph';
import { TagCloud } from './components/TagCloud';
import { SyncActivityFeed } from './components/SyncActivityFeed';
import { SyncDashboard } from './components/SyncDashboard';
import { SyncConflictViewer } from './components/SyncConflictViewer';
import { AgentChat } from './components/AgentChat';
import { ErrorBoundary } from './components/ErrorBoundary';
import './App.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:6061';

function SyncStatus() {
  const status = useStatus();
  return (
    <div className={`sync-status ${status.connected ? 'online' : 'offline'}`}>
      <span className="dot" />
      {status.connected ? 'Synced' : 'Offline'}
      {status.dataFlowStatus?.uploading && ' (syncing...)'}
      {!status.connected && status.dataFlowStatus?.uploading && (
        <span className="queue-badge">changes queued</span>
      )}
    </div>
  );
}

function OfflineBanner() {
  const status = useStatus();
  if (status.connected) return null;
  return (
    <div className="offline-banner">
      You're offline — local-first mode active. All features work locally. Changes sync when you reconnect.
    </div>
  );
}

function AppContent() {
  const [showEditor, setShowEditor] = useState(false);
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAsk, setShowAsk] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'graph'>('list');
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefContent, setBriefContent] = useState('');

  const [seedLoading, setSeedLoading] = useState(false);
  const [seedDone, setSeedDone] = useState(false);
  const [aiStatus, setAiStatus] = useState<{ provider: string; local: boolean; model: string } | null>(null);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/ai/status`).then(r => r.json()).then(setAiStatus).catch(() => {});
  }, []);

  const { data: noteCount } = useQuery<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM notes`);
  const count = noteCount[0]?.cnt ?? 0;

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't capture when typing in inputs
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      if (e.key === 'Escape') {
        target.blur();
        e.preventDefault();
      }
      return;
    }

    if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
      e.preventDefault();
      setShowEditor(true);
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      const searchInput = document.querySelector('.search-input') as HTMLInputElement;
      searchInput?.focus();
    } else if (e.key === 'Escape') {
      if (showEditor) setShowEditor(false);
      else if (showSearch) setShowSearch(false);
      else if (showAsk) setShowAsk(false);
      else if (briefContent) setBriefContent('');
      else if (selectedNote) setSelectedNote(null);
    } else if (e.key === 'g' && !e.metaKey && !e.ctrlKey) {
      setViewMode(prev => prev === 'list' ? 'graph' : 'list');
    }
  }, [showEditor, showSearch, showAsk, briefContent, selectedNote]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

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
      <OfflineBanner />
      <header>
        <div className="header-left">
          <h1>SyncMind</h1>
          <span className="subtitle">AI Research Assistant</span>
          {count > 0 && <span className="note-count">{count} note{count !== 1 ? 's' : ''}</span>}
        </div>
        <div className="header-right">
          {aiStatus && (
            <div className={`ai-provider-badge ${aiStatus.local ? 'local' : 'cloud'}`} title={`Model: ${aiStatus.model}`}>
              {aiStatus.local ? 'Local AI' : `${aiStatus.provider}`}
            </div>
          )}
          <SyncConflictViewer />
          <SyncDashboard />
          <SyncActivityFeed />
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
        <div className="view-toggle">
          <button
            onClick={() => setViewMode('list')}
            className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
          >
            List
          </button>
          <button
            onClick={() => setViewMode('graph')}
            className={`toggle-btn ${viewMode === 'graph' ? 'active' : ''}`}
          >
            Graph
          </button>
        </div>
        <button onClick={() => setShowSearch(!showSearch)} className="btn-secondary">
          {showSearch ? 'Close Search' : 'Deep Search'}
        </button>
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

      {showSearch && (
        <NoteSearch
          onSelectNote={(id) => {
            setSelectedNote(id);
            setShowSearch(false);
          }}
          onClose={() => setShowSearch(false)}
        />
      )}

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

      {viewMode === 'graph' ? (
        <div className="graph-layout">
          <div className="graph-container">
            <KnowledgeGraph onSelectNote={setSelectedNote} selectedId={selectedNote || undefined} />
          </div>
          {selectedNote && (
            <div className="graph-detail-panel">
              <NoteDetail
                noteId={selectedNote}
                onNavigate={setSelectedNote}
                onDeleted={() => setSelectedNote(null)}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="main-content">
          <div className="sidebar">
            <TagCloud onTagClick={(tag) => setSearchQuery(tag)} />
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
                <div className="empty-icon">&#128218;</div>
                <h2>{count === 0 ? 'Start Your Research' : 'Select a Note'}</h2>
                <p>{count === 0
                  ? 'Create your first note or load demo data to explore'
                  : 'Choose a note from the sidebar to view details'
                }</p>
                {count === 0 && !seedDone && (
                  <button
                    className="btn-primary seed-btn"
                    disabled={seedLoading}
                    onClick={async () => {
                      setSeedLoading(true);
                      try {
                        const res = await fetch(`${BACKEND_URL}/api/data/seed`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' }
                        });
                        const data = await res.json();
                        if (data.seeded) setSeedDone(true);
                      } catch { /* offline - can't seed */ }
                      setSeedLoading(false);
                    }}
                  >
                    {seedLoading ? 'Loading demo data...' : 'Load Demo Data (6 AI research notes)'}
                  </button>
                )}
                {seedDone && (
                  <p className="seed-success">Demo data loaded! Notes will appear shortly via PowerSync sync.</p>
                )}
                <div className="feature-grid">
                  <div className="feature-card">
                    <span className="feature-icon">&#9889;</span>
                    <strong>Offline-First</strong>
                    <span>Works without internet via local SQLite</span>
                  </div>
                  <div className="feature-card">
                    <span className="feature-icon">&#129302;</span>
                    <strong>AI Analysis</strong>
                    <span>Auto-summarize, tag, and connect notes</span>
                  </div>
                  <div className="feature-card">
                    <span className="feature-icon">&#128257;</span>
                    <strong>Real-Time Sync</strong>
                    <span>PowerSync keeps devices in sync</span>
                  </div>
                  <div className="feature-card">
                    <span className="feature-icon">&#128269;</span>
                    <strong>Ask AI</strong>
                    <span>Query your research in natural language</span>
                  </div>
                </div>
                <div className="keyboard-hints">
                  <span><kbd>Ctrl+N</kbd> New note</span>
                  <span><kbd>Ctrl+K</kbd> Search</span>
                  <span><kbd>G</kbd> Toggle graph</span>
                  <span><kbd>Esc</kbd> Close/back</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <AgentChat />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <PowerSyncProvider>
        <AppContent />
      </PowerSyncProvider>
    </ErrorBoundary>
  );
}

export default App;
