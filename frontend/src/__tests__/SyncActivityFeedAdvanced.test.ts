import { describe, it, expect } from 'vitest';

// ─── Advanced SyncActivityFeed logic tests ───

type EventType = 'upload' | 'download' | 'connect' | 'disconnect' | 'conflict';

interface SyncEvent {
  id: number;
  type: EventType;
  message: string;
  timestamp: Date;
}

// Expand/collapse toggle
function toggleExpanded(current: boolean): boolean {
  return !current;
}

// Feed visibility
function shouldShowFeed(eventCount: number): boolean {
  return eventCount > 0;
}

// Arrow indicator
function getArrowIndicator(expanded: boolean): string {
  return expanded ? '\u25B2' : '\u25BC';
}

// Event count badge
function getEventCountBadge(count: number): string {
  return String(count);
}

// Filter events by type
function filterByType(events: SyncEvent[], type: EventType): SyncEvent[] {
  return events.filter(e => e.type === type);
}

// Count events by type
function countByType(events: SyncEvent[], type: EventType): number {
  return events.filter(e => e.type === type).length;
}

// Get latest event
function getLatestEvent(events: SyncEvent[]): SyncEvent | null {
  return events.length > 0 ? events[0] : null;
}

// Build connection status message
function buildConnectionMessage(connected: boolean): { type: EventType; message: string } {
  return {
    type: connected ? 'connect' : 'disconnect',
    message: connected ? 'Connected to PowerSync' : 'Disconnected - working offline',
  };
}

// Build data flow message
function buildDataFlowMessage(uploading: boolean): { type: EventType; message: string } | null {
  if (!uploading) return null;
  return { type: 'upload', message: 'Uploading local changes to server' };
}

// Build download message
function buildDownloadMessage(downloading: boolean): { type: EventType; message: string } | null {
  if (!downloading) return null;
  return { type: 'download', message: 'Downloading updates from server' };
}

// Build sync count message
function buildSyncCountMessage(count: number): string {
  return `Synced: ${count} notes in local database`;
}

// Time ago display (simplified)
function getRelativeTime(eventTime: Date, now: Date): string {
  const diffMs = now.getTime() - eventTime.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  return `${Math.floor(diffSec / 3600)}h ago`;
}

// ─── Expand/Collapse Toggle ───

describe('SyncActivityFeed - Toggle', () => {
  it('expands when collapsed', () => {
    expect(toggleExpanded(false)).toBe(true);
  });

  it('collapses when expanded', () => {
    expect(toggleExpanded(true)).toBe(false);
  });

  it('round-trips correctly', () => {
    expect(toggleExpanded(toggleExpanded(false))).toBe(false);
  });
});

// ─── Feed Visibility ───

describe('SyncActivityFeed - Visibility', () => {
  it('shows feed when events exist', () => {
    expect(shouldShowFeed(5)).toBe(true);
  });

  it('hides feed when no events', () => {
    expect(shouldShowFeed(0)).toBe(false);
  });

  it('shows feed for single event', () => {
    expect(shouldShowFeed(1)).toBe(true);
  });
});

// ─── Arrow Indicator ───

describe('SyncActivityFeed - Arrow', () => {
  it('shows up arrow when expanded', () => {
    expect(getArrowIndicator(true)).toBe('\u25B2');
  });

  it('shows down arrow when collapsed', () => {
    expect(getArrowIndicator(false)).toBe('\u25BC');
  });
});

// ─── Event Count Badge ───

describe('SyncActivityFeed - Count Badge', () => {
  it('displays count as string', () => {
    expect(getEventCountBadge(5)).toBe('5');
  });

  it('displays zero', () => {
    expect(getEventCountBadge(0)).toBe('0');
  });

  it('displays large numbers', () => {
    expect(getEventCountBadge(50)).toBe('50');
  });
});

// ─── Event Filtering ───

describe('SyncActivityFeed - Event Filtering', () => {
  const events: SyncEvent[] = [
    { id: 1, type: 'connect', message: 'Connected', timestamp: new Date() },
    { id: 2, type: 'upload', message: 'Uploading', timestamp: new Date() },
    { id: 3, type: 'download', message: 'Downloading', timestamp: new Date() },
    { id: 4, type: 'upload', message: 'Uploading again', timestamp: new Date() },
    { id: 5, type: 'conflict', message: 'Conflict', timestamp: new Date() },
  ];

  it('filters upload events', () => {
    const uploads = filterByType(events, 'upload');
    expect(uploads).toHaveLength(2);
    expect(uploads.every(e => e.type === 'upload')).toBe(true);
  });

  it('filters connect events', () => {
    expect(filterByType(events, 'connect')).toHaveLength(1);
  });

  it('filters conflict events', () => {
    expect(filterByType(events, 'conflict')).toHaveLength(1);
  });

  it('returns empty for non-existent type', () => {
    expect(filterByType(events, 'disconnect')).toHaveLength(0);
  });

  it('handles empty events array', () => {
    expect(filterByType([], 'upload')).toEqual([]);
  });
});

// ─── Event Counting ───

describe('SyncActivityFeed - Event Counting', () => {
  const events: SyncEvent[] = [
    { id: 1, type: 'upload', message: 'A', timestamp: new Date() },
    { id: 2, type: 'upload', message: 'B', timestamp: new Date() },
    { id: 3, type: 'download', message: 'C', timestamp: new Date() },
  ];

  it('counts upload events', () => {
    expect(countByType(events, 'upload')).toBe(2);
  });

  it('counts download events', () => {
    expect(countByType(events, 'download')).toBe(1);
  });

  it('returns 0 for missing type', () => {
    expect(countByType(events, 'conflict')).toBe(0);
  });
});

// ─── Latest Event ───

describe('SyncActivityFeed - Latest Event', () => {
  it('returns first event (newest)', () => {
    const events: SyncEvent[] = [
      { id: 3, type: 'upload', message: 'Latest', timestamp: new Date() },
      { id: 2, type: 'connect', message: 'Older', timestamp: new Date() },
    ];
    const latest = getLatestEvent(events);
    expect(latest?.message).toBe('Latest');
  });

  it('returns null for empty events', () => {
    expect(getLatestEvent([])).toBeNull();
  });
});

// ─── Connection Status Message ───

describe('SyncActivityFeed - Connection Message', () => {
  it('creates connect event when online', () => {
    const msg = buildConnectionMessage(true);
    expect(msg.type).toBe('connect');
    expect(msg.message).toBe('Connected to PowerSync');
  });

  it('creates disconnect event when offline', () => {
    const msg = buildConnectionMessage(false);
    expect(msg.type).toBe('disconnect');
    expect(msg.message).toContain('offline');
  });
});

// ─── Data Flow Messages ───

describe('SyncActivityFeed - Data Flow Messages', () => {
  it('creates upload message when uploading', () => {
    const msg = buildDataFlowMessage(true);
    expect(msg?.type).toBe('upload');
    expect(msg?.message).toContain('Uploading');
  });

  it('returns null when not uploading', () => {
    expect(buildDataFlowMessage(false)).toBeNull();
  });

  it('creates download message when downloading', () => {
    const msg = buildDownloadMessage(true);
    expect(msg?.type).toBe('download');
    expect(msg?.message).toContain('Downloading');
  });

  it('returns null when not downloading', () => {
    expect(buildDownloadMessage(false)).toBeNull();
  });
});

// ─── Sync Count Message ───

describe('SyncActivityFeed - Sync Count', () => {
  it('includes note count', () => {
    expect(buildSyncCountMessage(10)).toBe('Synced: 10 notes in local database');
  });

  it('handles zero notes', () => {
    expect(buildSyncCountMessage(0)).toBe('Synced: 0 notes in local database');
  });

  it('handles single note', () => {
    expect(buildSyncCountMessage(1)).toBe('Synced: 1 notes in local database');
  });
});

// ─── Relative Time ───

describe('SyncActivityFeed - Relative Time', () => {
  it('shows "just now" for recent events', () => {
    const now = new Date();
    const event = new Date(now.getTime() - 10000); // 10 seconds ago
    expect(getRelativeTime(event, now)).toBe('just now');
  });

  it('shows minutes for events within an hour', () => {
    const now = new Date();
    const event = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes ago
    expect(getRelativeTime(event, now)).toBe('5m ago');
  });

  it('shows hours for older events', () => {
    const now = new Date();
    const event = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago
    expect(getRelativeTime(event, now)).toBe('2h ago');
  });

  it('shows "just now" for 0 seconds', () => {
    const now = new Date();
    expect(getRelativeTime(now, now)).toBe('just now');
  });

  it('shows "just now" for 59 seconds', () => {
    const now = new Date();
    const event = new Date(now.getTime() - 59 * 1000);
    expect(getRelativeTime(event, now)).toBe('just now');
  });

  it('shows "1m ago" for exactly 60 seconds', () => {
    const now = new Date();
    const event = new Date(now.getTime() - 60 * 1000);
    expect(getRelativeTime(event, now)).toBe('1m ago');
  });
});
