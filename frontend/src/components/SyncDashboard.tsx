import { useState, useEffect, useCallback, useRef } from 'react';
import { useStatus, useQuery } from '@powersync/react';
import { powerSync } from '../lib/PowerSyncProvider';

interface TableStats {
  name: string;
  rowCount: number;
  lastModified: string | null;
}

interface SyncMetrics {
  connected: boolean;
  uploading: boolean;
  downloading: boolean;
  lastSyncedAt: Date | null;
  uploadQueueSize: number;
  connectionUptime: number; // seconds
  syncCycles: number;
  tables: TableStats[];
}

export function SyncDashboard() {
  const [expanded, setExpanded] = useState(false);
  const [metrics, setMetrics] = useState<SyncMetrics>({
    connected: false,
    uploading: false,
    downloading: false,
    lastSyncedAt: null,
    uploadQueueSize: 0,
    connectionUptime: 0,
    syncCycles: 0,
    tables: []
  });
  const connectedSince = useRef<Date | null>(null);
  const syncCycleCount = useRef(0);
  const status = useStatus();

  // Track connection uptime
  useEffect(() => {
    if (status.connected && !connectedSince.current) {
      connectedSince.current = new Date();
    } else if (!status.connected) {
      connectedSince.current = null;
    }
  }, [status.connected]);

  // Count sync cycles
  useEffect(() => {
    if (status.dataFlowStatus?.downloading) {
      syncCycleCount.current += 1;
    }
  }, [status.dataFlowStatus?.downloading]);

  // Query table statistics from local SQLite via PowerSync
  const { data: noteStats } = useQuery<{ cnt: number; latest: string | null }>(
    `SELECT COUNT(*) as cnt, MAX(updated_at) as latest FROM notes`
  );
  const { data: connStats } = useQuery<{ cnt: number; latest: string | null }>(
    `SELECT COUNT(*) as cnt, MAX(created_at) as latest FROM connections`
  );
  const { data: tagStats } = useQuery<{ cnt: number; latest: string | null }>(
    `SELECT COUNT(*) as cnt, MAX(created_at) as latest FROM tags`
  );

  // Check upload queue size
  const checkUploadQueue = useCallback(async () => {
    try {
      const tx = await powerSync.getNextCrudTransaction();
      if (tx) {
        const size = tx.crud.length;
        // Don't complete it - just peek
        return size;
      }
      return 0;
    } catch {
      return 0;
    }
  }, []);

  // Refresh metrics periodically
  useEffect(() => {
    if (!expanded) return;

    const refresh = async () => {
      const queueSize = await checkUploadQueue();
      const uptime = connectedSince.current
        ? Math.floor((Date.now() - connectedSince.current.getTime()) / 1000)
        : 0;

      setMetrics({
        connected: status.connected,
        uploading: status.dataFlowStatus?.uploading ?? false,
        downloading: status.dataFlowStatus?.downloading ?? false,
        lastSyncedAt: status.dataFlowStatus?.downloading === false ? new Date() : metrics.lastSyncedAt,
        uploadQueueSize: queueSize,
        connectionUptime: uptime,
        syncCycles: syncCycleCount.current,
        tables: [
          {
            name: 'notes',
            rowCount: noteStats?.[0]?.cnt ?? 0,
            lastModified: noteStats?.[0]?.latest ?? null
          },
          {
            name: 'connections',
            rowCount: connStats?.[0]?.cnt ?? 0,
            lastModified: connStats?.[0]?.latest ?? null
          },
          {
            name: 'tags',
            rowCount: tagStats?.[0]?.cnt ?? 0,
            lastModified: tagStats?.[0]?.latest ?? null
          }
        ]
      });
    };

    refresh();
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, [expanded, status, noteStats, connStats, tagStats, checkUploadQueue, metrics.lastSyncedAt]);

  const formatUptime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const formatTime = (d: Date | null) => {
    if (!d) return 'never';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const totalRows = metrics.tables.reduce((sum, t) => sum + t.rowCount, 0);

  return (
    <div className="sync-dashboard">
      <button
        className="sync-dashboard-toggle"
        onClick={() => setExpanded(!expanded)}
        title="PowerSync Dashboard"
      >
        <span className="sync-dashboard-icon">{'\u{1F4CA}'}</span>
        <span>Sync Stats</span>
        <span className={`sync-dashboard-indicator ${metrics.connected ? 'connected' : 'disconnected'}`} />
        <span className="sync-feed-arrow">{expanded ? '\u25B2' : '\u25BC'}</span>
      </button>

      {expanded && (
        <div className="sync-dashboard-panel">
          {/* Connection Health */}
          <div className="sync-dashboard-section">
            <h4>Connection Health</h4>
            <div className="sync-metric-grid">
              <div className="sync-metric">
                <span className="sync-metric-label">Status</span>
                <span className={`sync-metric-value ${metrics.connected ? 'good' : 'warn'}`}>
                  {metrics.connected ? 'Connected' : 'Offline'}
                </span>
              </div>
              <div className="sync-metric">
                <span className="sync-metric-label">Uptime</span>
                <span className="sync-metric-value">
                  {metrics.connected ? formatUptime(metrics.connectionUptime) : '--'}
                </span>
              </div>
              <div className="sync-metric">
                <span className="sync-metric-label">Sync Cycles</span>
                <span className="sync-metric-value">{metrics.syncCycles}</span>
              </div>
              <div className="sync-metric">
                <span className="sync-metric-label">Last Sync</span>
                <span className="sync-metric-value">{formatTime(metrics.lastSyncedAt)}</span>
              </div>
            </div>
          </div>

          {/* Data Flow */}
          <div className="sync-dashboard-section">
            <h4>Data Flow</h4>
            <div className="sync-flow-indicators">
              <div className={`sync-flow-item ${metrics.uploading ? 'active' : ''}`}>
                <span className="sync-flow-arrow">{'\u2B06'}</span>
                <span>{metrics.uploading ? 'Uploading...' : 'Upload idle'}</span>
              </div>
              <div className={`sync-flow-item ${metrics.downloading ? 'active' : ''}`}>
                <span className="sync-flow-arrow">{'\u2B07'}</span>
                <span>{metrics.downloading ? 'Downloading...' : 'Download idle'}</span>
              </div>
              <div className="sync-flow-item">
                <span className="sync-flow-arrow">{'\u{1F4E6}'}</span>
                <span>Queue: {metrics.uploadQueueSize} ops</span>
              </div>
            </div>
          </div>

          {/* Local Database */}
          <div className="sync-dashboard-section">
            <h4>Local SQLite (PowerSync)</h4>
            <div className="sync-table-stats">
              <div className="sync-table-header">
                <span>Table</span>
                <span>Rows</span>
                <span>Last Modified</span>
              </div>
              {metrics.tables.map(table => (
                <div key={table.name} className="sync-table-row">
                  <span className="sync-table-name">{table.name}</span>
                  <span className="sync-table-count">{table.rowCount}</span>
                  <span className="sync-table-time">
                    {table.lastModified
                      ? new Date(table.lastModified).toLocaleDateString([], { month: 'short', day: 'numeric' })
                      : '--'}
                  </span>
                </div>
              ))}
              <div className="sync-table-row sync-table-total">
                <span className="sync-table-name">Total</span>
                <span className="sync-table-count">{totalRows}</span>
                <span />
              </div>
            </div>
          </div>

          {/* PowerSync Info */}
          <div className="sync-dashboard-section sync-dashboard-footer">
            <span>Powered by <strong>PowerSync</strong> — local-first sync engine</span>
            <span>SQLite WASM in-browser • Bidirectional sync • Conflict resolution</span>
          </div>
        </div>
      )}
    </div>
  );
}
