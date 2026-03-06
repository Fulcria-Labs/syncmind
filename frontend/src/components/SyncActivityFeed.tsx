import { useState, useEffect, useCallback } from 'react';
import { useStatus } from '@powersync/react';
import { powerSync } from '../lib/PowerSyncProvider';

interface SyncEvent {
  id: number;
  type: 'upload' | 'download' | 'connect' | 'disconnect';
  message: string;
  timestamp: Date;
}

let eventCounter = 0;

export function SyncActivityFeed() {
  const [events, setEvents] = useState<SyncEvent[]>([]);
  const [expanded, setExpanded] = useState(false);
  const status = useStatus();

  const addEvent = useCallback((type: SyncEvent['type'], message: string) => {
    setEvents(prev => {
      const next = [
        { id: ++eventCounter, type, message, timestamp: new Date() },
        ...prev
      ];
      return next.slice(0, 50);
    });
  }, []);

  useEffect(() => {
    if (status.connected) {
      addEvent('connect', 'Connected to PowerSync');
    } else {
      addEvent('disconnect', 'Disconnected - working offline');
    }
  }, [status.connected, addEvent]);

  useEffect(() => {
    if (status.dataFlowStatus?.uploading) {
      addEvent('upload', 'Uploading local changes to server');
    }
  }, [status.dataFlowStatus?.uploading, addEvent]);

  useEffect(() => {
    if (status.dataFlowStatus?.downloading) {
      addEvent('download', 'Downloading updates from server');
    }
  }, [status.dataFlowStatus?.downloading, addEvent]);

  // Watch for local changes via PowerSync onChange
  useEffect(() => {
    const abortController = new AbortController();

    const watchChanges = async () => {
      try {
        for await (const result of powerSync.watch(
          'SELECT COUNT(*) as cnt FROM notes',
          [],
          { signal: abortController.signal }
        )) {
          const count = result.rows?._array?.[0]?.cnt ?? result.rows?.item?.(0)?.cnt;
          if (count !== undefined && eventCounter > 0) {
            addEvent('download', `Synced: ${count} notes in local database`);
          }
        }
      } catch {
        // watch was aborted
      }
    };

    watchChanges();
    return () => abortController.abort();
  }, [addEvent]);

  const typeIcon = (type: SyncEvent['type']) => {
    switch (type) {
      case 'upload': return '\u2B06';
      case 'download': return '\u2B07';
      case 'connect': return '\u2705';
      case 'disconnect': return '\u26A0';
    }
  };

  const typeColor = (type: SyncEvent['type']) => {
    switch (type) {
      case 'upload': return '#818cf8';
      case 'download': return '#10b981';
      case 'connect': return '#10b981';
      case 'disconnect': return '#f59e0b';
    }
  };

  const formatTime = (d: Date) =>
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  if (events.length === 0) return null;

  return (
    <div className="sync-feed">
      <button
        className="sync-feed-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="sync-feed-icon">{'\u26A1'}</span>
        <span>Sync Activity</span>
        <span className="sync-feed-count">{events.length}</span>
        <span className="sync-feed-arrow">{expanded ? '\u25B2' : '\u25BC'}</span>
      </button>
      {expanded && (
        <div className="sync-feed-list">
          {events.slice(0, 15).map(ev => (
            <div key={ev.id} className="sync-feed-item">
              <span style={{ color: typeColor(ev.type) }}>{typeIcon(ev.type)}</span>
              <span className="sync-feed-msg">{ev.message}</span>
              <span className="sync-feed-time">{formatTime(ev.timestamp)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
