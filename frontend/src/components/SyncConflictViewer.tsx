import { useState, useEffect, useCallback, useRef } from 'react';
import { useStatus, useQuery } from '@powersync/react';
import { powerSync } from '../lib/PowerSyncProvider';

// ─── Conflict Resolution Strategies ───

export type ResolutionStrategy = 'last-write-wins' | 'server-wins' | 'client-wins' | 'manual-merge';

export interface ConflictField {
  field: string;
  localValue: string;
  serverValue: string;
  resolvedValue: string;
}

export interface ConflictRecord {
  id: number;
  noteId: string;
  noteTitle: string;
  strategy: ResolutionStrategy;
  fields: ConflictField[];
  localTimestamp: Date;
  serverTimestamp: Date;
  resolvedAt: Date;
  deviceId: string;
}

export interface ConflictStats {
  totalConflicts: number;
  resolvedByStrategy: Record<ResolutionStrategy, number>;
  conflictsByTable: Record<string, number>;
  avgResolutionTimeMs: number;
  lastConflictAt: Date | null;
  conflictsPerHour: number;
}

// ─── Pure Logic Functions (exported for testing) ───

export function computeConflictStats(conflicts: ConflictRecord[]): ConflictStats {
  const resolvedByStrategy: Record<ResolutionStrategy, number> = {
    'last-write-wins': 0,
    'server-wins': 0,
    'client-wins': 0,
    'manual-merge': 0,
  };

  const conflictsByTable: Record<string, number> = {};
  let totalResolutionTime = 0;

  for (const c of conflicts) {
    resolvedByStrategy[c.strategy]++;
    conflictsByTable['notes'] = (conflictsByTable['notes'] || 0) + 1;

    const resolutionTime = c.resolvedAt.getTime() - c.serverTimestamp.getTime();
    totalResolutionTime += Math.max(0, resolutionTime);
  }

  const lastConflict = conflicts.length > 0
    ? conflicts.reduce((latest, c) =>
        c.resolvedAt.getTime() > latest.getTime() ? c.resolvedAt : latest,
        new Date(0)
      )
    : null;

  // Calculate conflicts per hour based on time span
  let conflictsPerHour = 0;
  if (conflicts.length >= 2) {
    const oldest = conflicts.reduce((min, c) =>
      c.resolvedAt.getTime() < min.getTime() ? c.resolvedAt : min,
      new Date()
    );
    const newest = conflicts.reduce((max, c) =>
      c.resolvedAt.getTime() > max.getTime() ? c.resolvedAt : max,
      new Date(0)
    );
    const spanHours = (newest.getTime() - oldest.getTime()) / (1000 * 60 * 60);
    conflictsPerHour = spanHours > 0 ? Math.round((conflicts.length / spanHours) * 10) / 10 : 0;
  }

  return {
    totalConflicts: conflicts.length,
    resolvedByStrategy,
    conflictsByTable,
    avgResolutionTimeMs: conflicts.length > 0
      ? Math.round(totalResolutionTime / conflicts.length)
      : 0,
    lastConflictAt: lastConflict,
    conflictsPerHour,
  };
}

export function formatResolutionTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

export function getStrategyLabel(strategy: ResolutionStrategy): string {
  switch (strategy) {
    case 'last-write-wins': return 'Last Write Wins';
    case 'server-wins': return 'Server Wins';
    case 'client-wins': return 'Client Wins';
    case 'manual-merge': return 'Manual Merge';
  }
}

export function getStrategyDescription(strategy: ResolutionStrategy): string {
  switch (strategy) {
    case 'last-write-wins':
      return 'The most recent write is kept, regardless of source. This is PowerSync\'s default strategy.';
    case 'server-wins':
      return 'Server version is always preferred. Local changes are discarded on conflict.';
    case 'client-wins':
      return 'Local version is always preferred. Server is overwritten with client data.';
    case 'manual-merge':
      return 'User manually reviewed and merged conflicting changes from both versions.';
  }
}

export function getStrategyColor(strategy: ResolutionStrategy): string {
  switch (strategy) {
    case 'last-write-wins': return '#818cf8';
    case 'server-wins': return '#10b981';
    case 'client-wins': return '#f59e0b';
    case 'manual-merge': return '#ec4899';
  }
}

export function getStrategyIcon(strategy: ResolutionStrategy): string {
  switch (strategy) {
    case 'last-write-wins': return '\u231B'; // hourglass
    case 'server-wins': return '\u2601';    // cloud
    case 'client-wins': return '\u{1F4F1}'; // mobile
    case 'manual-merge': return '\u{1F91D}'; // handshake
  }
}

export function computeFieldDiff(local: string, server: string): {
  hasConflict: boolean;
  changeType: 'added' | 'removed' | 'modified' | 'unchanged';
} {
  if (local === server) return { hasConflict: false, changeType: 'unchanged' };
  if (!local && server) return { hasConflict: true, changeType: 'added' };
  if (local && !server) return { hasConflict: true, changeType: 'removed' };
  return { hasConflict: true, changeType: 'modified' };
}

export function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 0) return 'in the future';
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

export function groupConflictsByNote(conflicts: ConflictRecord[]): Map<string, ConflictRecord[]> {
  const map = new Map<string, ConflictRecord[]>();
  for (const c of conflicts) {
    const key = c.noteId;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(c);
  }
  return map;
}

export function getConflictSeverity(fieldsChanged: number): 'low' | 'medium' | 'high' {
  if (fieldsChanged <= 1) return 'low';
  if (fieldsChanged <= 3) return 'medium';
  return 'high';
}

export function getSeverityColor(severity: 'low' | 'medium' | 'high'): string {
  switch (severity) {
    case 'low': return '#10b981';
    case 'medium': return '#f59e0b';
    case 'high': return '#ef4444';
  }
}

// ─── Component ───

export function SyncConflictViewer() {
  const [expanded, setExpanded] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([]);
  const [selectedConflict, setSelectedConflict] = useState<ConflictRecord | null>(null);
  const [viewMode, setViewMode] = useState<'timeline' | 'stats'>('timeline');
  const conflictCounter = useRef(0);
  const status = useStatus();

  // Query notes for enrichment
  const { data: notesList } = useQuery<{ id: string; title: string }>(
    `SELECT id, title FROM notes ORDER BY updated_at DESC LIMIT 100`
  );

  // Listen for conflict events from the Connector
  useEffect(() => {
    const handleConflict = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      conflictCounter.current += 1;

      const newConflict: ConflictRecord = {
        id: conflictCounter.current,
        noteId: detail.noteId || `note-${conflictCounter.current}`,
        noteTitle: detail.noteTitle || 'Untitled Note',
        strategy: detail.strategy || 'last-write-wins',
        fields: detail.fields || [
          {
            field: 'content',
            localValue: detail.localContent || 'Local version of content',
            serverValue: detail.serverContent || 'Server version of content',
            resolvedValue: detail.resolvedContent || 'Resolved content (server version kept)',
          }
        ],
        localTimestamp: detail.localTimestamp ? new Date(detail.localTimestamp) : new Date(Date.now() - 5000),
        serverTimestamp: detail.serverTimestamp ? new Date(detail.serverTimestamp) : new Date(Date.now() - 2000),
        resolvedAt: new Date(),
        deviceId: detail.deviceId || `device-${Math.random().toString(36).slice(2, 8)}`,
      };

      setConflicts(prev => [newConflict, ...prev].slice(0, 100));
    };

    window.addEventListener('syncmind:conflict', handleConflict);
    return () => window.removeEventListener('syncmind:conflict', handleConflict);
  }, []);

  // Watch for local changes that could indicate conflicts
  useEffect(() => {
    const abortController = new AbortController();

    const watchForConflicts = async () => {
      try {
        for await (const _result of powerSync.watch(
          'SELECT COUNT(*) as cnt FROM notes WHERE updated_at > datetime("now", "-10 seconds")',
          [],
          { signal: abortController.signal }
        )) {
          // Reactive update - conflicts are tracked via custom events
        }
      } catch {
        // watch was aborted
      }
    };

    watchForConflicts();
    return () => abortController.abort();
  }, []);

  // Simulate a conflict for demo purposes
  const simulateConflict = useCallback(() => {
    const noteId = notesList?.[0]?.id || `demo-note-${Date.now()}`;
    const noteTitle = notesList?.[0]?.title || 'Demo Research Note';

    const fields: ConflictField[] = [
      {
        field: 'title',
        localValue: `${noteTitle} (edited locally)`,
        serverValue: `${noteTitle} (edited on another device)`,
        resolvedValue: `${noteTitle} (edited on another device)`,
      },
      {
        field: 'content',
        localValue: 'Added local analysis of transformer architectures...',
        serverValue: 'Added server-side notes on attention mechanisms...',
        resolvedValue: 'Added server-side notes on attention mechanisms...',
      },
      {
        field: 'tags',
        localValue: 'ai, transformers, local-edit',
        serverValue: 'ai, attention, remote-edit',
        resolvedValue: 'ai, attention, remote-edit',
      },
    ];

    window.dispatchEvent(new CustomEvent('syncmind:conflict', {
      detail: {
        noteId,
        noteTitle,
        strategy: 'last-write-wins',
        fields,
        localTimestamp: new Date(Date.now() - 8000).toISOString(),
        serverTimestamp: new Date(Date.now() - 3000).toISOString(),
        deviceId: `browser-${navigator.userAgent.includes('Chrome') ? 'chrome' : 'other'}`,
      }
    }));
  }, [notesList]);

  const stats = computeConflictStats(conflicts);

  return (
    <div className="sync-conflict-viewer">
      <button
        className="sync-conflict-toggle"
        onClick={() => setExpanded(!expanded)}
        title="Sync Conflict Resolution Viewer"
      >
        <span className="sync-conflict-icon">{'\u26A1'}</span>
        <span>Conflicts</span>
        {conflicts.length > 0 && (
          <span className="sync-conflict-badge">{conflicts.length}</span>
        )}
        <span className={`sync-conflict-indicator ${status.connected ? 'connected' : 'disconnected'}`} />
        <span className="sync-feed-arrow">{expanded ? '\u25B2' : '\u25BC'}</span>
      </button>

      {expanded && (
        <div className="sync-conflict-panel">
          {/* View Mode Toggle */}
          <div className="sync-conflict-header">
            <div className="sync-conflict-tabs">
              <button
                className={`conflict-tab ${viewMode === 'timeline' ? 'active' : ''}`}
                onClick={() => setViewMode('timeline')}
              >
                Timeline
              </button>
              <button
                className={`conflict-tab ${viewMode === 'stats' ? 'active' : ''}`}
                onClick={() => setViewMode('stats')}
              >
                Statistics
              </button>
            </div>
            <button
              className="conflict-simulate-btn"
              onClick={simulateConflict}
              title="Simulate a sync conflict for demonstration"
            >
              Simulate Conflict
            </button>
          </div>

          {viewMode === 'stats' ? (
            /* ─── Statistics View ─── */
            <div className="conflict-stats-panel">
              <div className="conflict-stats-grid">
                <div className="conflict-stat-card">
                  <span className="conflict-stat-value">{stats.totalConflicts}</span>
                  <span className="conflict-stat-label">Total Conflicts</span>
                </div>
                <div className="conflict-stat-card">
                  <span className="conflict-stat-value">
                    {formatResolutionTime(stats.avgResolutionTimeMs)}
                  </span>
                  <span className="conflict-stat-label">Avg Resolution</span>
                </div>
                <div className="conflict-stat-card">
                  <span className="conflict-stat-value">{stats.conflictsPerHour}</span>
                  <span className="conflict-stat-label">Conflicts/Hour</span>
                </div>
                <div className="conflict-stat-card">
                  <span className="conflict-stat-value">
                    {stats.lastConflictAt ? formatRelativeTime(stats.lastConflictAt) : 'Never'}
                  </span>
                  <span className="conflict-stat-label">Last Conflict</span>
                </div>
              </div>

              {/* Strategy Breakdown */}
              <div className="conflict-strategy-breakdown">
                <h4>Resolution Strategies</h4>
                {(Object.entries(stats.resolvedByStrategy) as [ResolutionStrategy, number][]).map(
                  ([strategy, count]) => (
                    <div key={strategy} className="conflict-strategy-row">
                      <span style={{ color: getStrategyColor(strategy) }}>
                        {getStrategyIcon(strategy)}
                      </span>
                      <span className="conflict-strategy-name">
                        {getStrategyLabel(strategy)}
                      </span>
                      <span className="conflict-strategy-count">{count}</span>
                      <div
                        className="conflict-strategy-bar"
                        style={{
                          width: stats.totalConflicts > 0
                            ? `${(count / stats.totalConflicts) * 100}%`
                            : '0%',
                          backgroundColor: getStrategyColor(strategy),
                        }}
                      />
                    </div>
                  )
                )}
              </div>

              {/* PowerSync Info */}
              <div className="conflict-info-box">
                <h4>How PowerSync Handles Conflicts</h4>
                <p>
                  PowerSync uses a <strong>local-first architecture</strong> where writes always
                  succeed locally in SQLite. When syncing with the server, conflicts are detected
                  and resolved using configurable strategies. The default is{' '}
                  <strong>last-write-wins</strong>, where the most recent timestamp determines
                  the authoritative version.
                </p>
                <ul>
                  <li>Local writes are instant (SQLite WASM)</li>
                  <li>Conflicts detected during upload via CRUD transaction</li>
                  <li>Resolution happens transparently in the Connector</li>
                  <li>Reactive queries auto-update after resolution</li>
                </ul>
              </div>
            </div>
          ) : (
            /* ─── Timeline View ─── */
            <div className="conflict-timeline">
              {conflicts.length === 0 ? (
                <div className="conflict-empty">
                  <p>No sync conflicts detected yet.</p>
                  <p className="conflict-empty-hint">
                    Conflicts occur when the same note is edited on multiple devices
                    simultaneously. Click "Simulate Conflict" to see how PowerSync resolves them.
                  </p>
                </div>
              ) : (
                conflicts.slice(0, 20).map(conflict => (
                  <div
                    key={conflict.id}
                    className={`conflict-timeline-item ${selectedConflict?.id === conflict.id ? 'selected' : ''}`}
                    onClick={() => setSelectedConflict(
                      selectedConflict?.id === conflict.id ? null : conflict
                    )}
                  >
                    <div className="conflict-timeline-dot"
                      style={{ backgroundColor: getStrategyColor(conflict.strategy) }}
                    />
                    <div className="conflict-timeline-content">
                      <div className="conflict-timeline-header">
                        <span className="conflict-note-title">
                          {truncateText(conflict.noteTitle, 30)}
                        </span>
                        <span
                          className="conflict-severity-badge"
                          style={{ color: getSeverityColor(getConflictSeverity(conflict.fields.length)) }}
                        >
                          {conflict.fields.length} field{conflict.fields.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="conflict-timeline-meta">
                        <span style={{ color: getStrategyColor(conflict.strategy) }}>
                          {getStrategyIcon(conflict.strategy)} {getStrategyLabel(conflict.strategy)}
                        </span>
                        <span className="conflict-time">
                          {formatRelativeTime(conflict.resolvedAt)}
                        </span>
                      </div>

                      {/* Expanded conflict detail */}
                      {selectedConflict?.id === conflict.id && (
                        <div className="conflict-detail-panel">
                          <div className="conflict-detail-info">
                            <div className="conflict-detail-row">
                              <span className="conflict-detail-label">Device</span>
                              <span>{conflict.deviceId}</span>
                            </div>
                            <div className="conflict-detail-row">
                              <span className="conflict-detail-label">Strategy</span>
                              <span>{getStrategyDescription(conflict.strategy)}</span>
                            </div>
                          </div>

                          <h5>Field-Level Diff</h5>
                          {conflict.fields.map((field, i) => {
                            const diff = computeFieldDiff(field.localValue, field.serverValue);
                            return (
                              <div key={i} className="conflict-field-diff">
                                <div className="conflict-field-name">
                                  <span className={`conflict-change-type ${diff.changeType}`}>
                                    {diff.changeType}
                                  </span>
                                  <strong>{field.field}</strong>
                                </div>
                                <div className="conflict-field-values">
                                  <div className="conflict-value-local">
                                    <span className="conflict-value-label">Local:</span>
                                    <span>{truncateText(field.localValue, 100)}</span>
                                  </div>
                                  <div className="conflict-value-server">
                                    <span className="conflict-value-label">Server:</span>
                                    <span>{truncateText(field.serverValue, 100)}</span>
                                  </div>
                                  <div className="conflict-value-resolved">
                                    <span className="conflict-value-label">Resolved:</span>
                                    <span>{truncateText(field.resolvedValue, 100)}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
