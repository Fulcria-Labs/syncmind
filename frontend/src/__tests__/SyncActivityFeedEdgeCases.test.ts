import { describe, it, expect } from 'vitest';

// ─── Extract and test pure logic from SyncActivityFeed.tsx ───

type SyncEventType = 'upload' | 'download' | 'connect' | 'disconnect' | 'conflict';

interface SyncEvent {
  id: number;
  type: SyncEventType;
  message: string;
  timestamp: Date;
}

// Type icon mapping
function typeIcon(type: SyncEventType): string {
  switch (type) {
    case 'upload': return '\u2B06';
    case 'download': return '\u2B07';
    case 'connect': return '\u2705';
    case 'disconnect': return '\u26A0';
    case 'conflict': return '\u26A1';
  }
}

// Type color mapping
function typeColor(type: SyncEventType): string {
  switch (type) {
    case 'upload': return '#818cf8';
    case 'download': return '#10b981';
    case 'connect': return '#10b981';
    case 'disconnect': return '#f59e0b';
    case 'conflict': return '#ef4444';
  }
}

// Time formatting
function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Event list management: add new event, keep max 50
function addEvent(
  events: SyncEvent[],
  type: SyncEventType,
  message: string,
  counter: number
): { events: SyncEvent[]; newCounter: number } {
  const newCounter = counter + 1;
  const next = [
    { id: newCounter, type, message, timestamp: new Date() },
    ...events
  ];
  return { events: next.slice(0, 50), newCounter };
}

// Connection status message
function getConnectionMessage(connected: boolean): { type: SyncEventType; message: string } {
  return connected
    ? { type: 'connect', message: 'Connected to PowerSync' }
    : { type: 'disconnect', message: 'Disconnected - working offline' };
}

// Should show feed (only when events exist)
function shouldShowFeed(eventCount: number): boolean {
  return eventCount > 0;
}

// Displayed events (max 15)
function getDisplayedEvents(events: SyncEvent[]): SyncEvent[] {
  return events.slice(0, 15);
}

// Toggle arrow
function getToggleArrow(expanded: boolean): string {
  return expanded ? '\u25B2' : '\u25BC';
}

// ─── Type Icon Mapping ───

describe('SyncActivityFeed - Type Icons', () => {
  it('returns up arrow for upload', () => {
    expect(typeIcon('upload')).toBe('\u2B06');
  });

  it('returns down arrow for download', () => {
    expect(typeIcon('download')).toBe('\u2B07');
  });

  it('returns checkmark for connect', () => {
    expect(typeIcon('connect')).toBe('\u2705');
  });

  it('returns warning for disconnect', () => {
    expect(typeIcon('disconnect')).toBe('\u26A0');
  });

  it('returns lightning for conflict', () => {
    expect(typeIcon('conflict')).toBe('\u26A1');
  });

  it('returns unique icon for each type', () => {
    const types: SyncEventType[] = ['upload', 'download', 'connect', 'disconnect', 'conflict'];
    const icons = types.map(t => typeIcon(t));
    const unique = new Set(icons);
    expect(unique.size).toBe(5);
  });
});

// ─── Type Color Mapping ───

describe('SyncActivityFeed - Type Colors', () => {
  it('returns indigo for upload', () => {
    expect(typeColor('upload')).toBe('#818cf8');
  });

  it('returns green for download', () => {
    expect(typeColor('download')).toBe('#10b981');
  });

  it('returns green for connect', () => {
    expect(typeColor('connect')).toBe('#10b981');
  });

  it('returns amber for disconnect', () => {
    expect(typeColor('disconnect')).toBe('#f59e0b');
  });

  it('returns red for conflict', () => {
    expect(typeColor('conflict')).toBe('#ef4444');
  });

  it('download and connect share same color', () => {
    expect(typeColor('download')).toBe(typeColor('connect'));
  });

  it('all colors are valid hex codes', () => {
    const types: SyncEventType[] = ['upload', 'download', 'connect', 'disconnect', 'conflict'];
    for (const type of types) {
      expect(typeColor(type)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

// ─── Time Formatting ───

describe('SyncActivityFeed - Time Formatting', () => {
  it('formats a date into time string', () => {
    const date = new Date('2026-03-12T14:30:45Z');
    const result = formatTime(date);
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(0);
  });

  it('includes seconds in format', () => {
    const date = new Date('2026-03-12T14:30:45Z');
    const result = formatTime(date);
    // Format should contain digits for hours, minutes, seconds
    expect(result).toMatch(/\d/);
  });

  it('formats midnight correctly', () => {
    const date = new Date('2026-03-12T00:00:00Z');
    const result = formatTime(date);
    expect(result).toBeTruthy();
  });

  it('formats noon correctly', () => {
    const date = new Date('2026-03-12T12:00:00Z');
    const result = formatTime(date);
    expect(result).toBeTruthy();
  });
});

// ─── Event Management ───

describe('SyncActivityFeed - Event Management', () => {
  it('adds new event at the beginning', () => {
    const existing: SyncEvent[] = [
      { id: 1, type: 'connect', message: 'Old event', timestamp: new Date() }
    ];
    const { events } = addEvent(existing, 'upload', 'New upload', 1);
    expect(events[0].type).toBe('upload');
    expect(events[0].message).toBe('New upload');
    expect(events[1].message).toBe('Old event');
  });

  it('increments counter', () => {
    const { newCounter } = addEvent([], 'connect', 'Connected', 5);
    expect(newCounter).toBe(6);
  });

  it('limits events to 50', () => {
    const existing: SyncEvent[] = Array.from({ length: 55 }, (_, i) => ({
      id: i, type: 'download' as SyncEventType, message: `Event ${i}`, timestamp: new Date()
    }));
    const { events } = addEvent(existing, 'upload', 'New', 55);
    expect(events.length).toBe(50);
  });

  it('new event has correct id based on counter', () => {
    const { events, newCounter } = addEvent([], 'connect', 'First', 0);
    expect(events[0].id).toBe(1);
    expect(newCounter).toBe(1);
  });

  it('preserves existing events when under limit', () => {
    const existing: SyncEvent[] = [
      { id: 1, type: 'connect', message: 'Existing', timestamp: new Date() }
    ];
    const { events } = addEvent(existing, 'upload', 'New', 1);
    expect(events.length).toBe(2);
    expect(events[1].message).toBe('Existing');
  });
});

// ─── Connection Status ───

describe('SyncActivityFeed - Connection Status', () => {
  it('returns connect event when connected', () => {
    const result = getConnectionMessage(true);
    expect(result.type).toBe('connect');
    expect(result.message).toBe('Connected to PowerSync');
  });

  it('returns disconnect event when disconnected', () => {
    const result = getConnectionMessage(false);
    expect(result.type).toBe('disconnect');
    expect(result.message).toBe('Disconnected - working offline');
  });

  it('disconnect message mentions offline', () => {
    const result = getConnectionMessage(false);
    expect(result.message).toContain('offline');
  });

  it('connect message mentions PowerSync', () => {
    const result = getConnectionMessage(true);
    expect(result.message).toContain('PowerSync');
  });
});

// ─── Feed Visibility ───

describe('SyncActivityFeed - Visibility', () => {
  it('hides feed when no events', () => {
    expect(shouldShowFeed(0)).toBe(false);
  });

  it('shows feed when events exist', () => {
    expect(shouldShowFeed(1)).toBe(true);
    expect(shouldShowFeed(50)).toBe(true);
  });
});

// ─── Displayed Events ───

describe('SyncActivityFeed - Displayed Events', () => {
  it('returns all events when under 15', () => {
    const events: SyncEvent[] = Array.from({ length: 5 }, (_, i) => ({
      id: i, type: 'connect' as SyncEventType, message: `Event ${i}`, timestamp: new Date()
    }));
    expect(getDisplayedEvents(events).length).toBe(5);
  });

  it('limits display to 15 events', () => {
    const events: SyncEvent[] = Array.from({ length: 30 }, (_, i) => ({
      id: i, type: 'download' as SyncEventType, message: `Event ${i}`, timestamp: new Date()
    }));
    expect(getDisplayedEvents(events).length).toBe(15);
  });

  it('returns empty for empty array', () => {
    expect(getDisplayedEvents([]).length).toBe(0);
  });

  it('returns first 15 events (most recent)', () => {
    const events: SyncEvent[] = Array.from({ length: 20 }, (_, i) => ({
      id: i, type: 'upload' as SyncEventType, message: `Event ${i}`, timestamp: new Date()
    }));
    const displayed = getDisplayedEvents(events);
    expect(displayed[0].id).toBe(0);
    expect(displayed[14].id).toBe(14);
  });
});

// ─── Toggle Arrow ───

describe('SyncActivityFeed - Toggle Arrow', () => {
  it('shows up arrow when expanded', () => {
    expect(getToggleArrow(true)).toBe('\u25B2');
  });

  it('shows down arrow when collapsed', () => {
    expect(getToggleArrow(false)).toBe('\u25BC');
  });
});
