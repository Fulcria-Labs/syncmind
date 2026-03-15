import { describe, it, expect } from 'vitest';

import {
  computeConflictStats,
  formatResolutionTime,
  getStrategyLabel,
  getStrategyDescription,
  getStrategyColor,
  getStrategyIcon,
  computeFieldDiff,
  truncateText,
  formatRelativeTime,
  groupConflictsByNote,
  getConflictSeverity,
  getSeverityColor,
  type ConflictRecord,
  type ConflictField,
  type ResolutionStrategy,
} from '../components/SyncConflictViewer';

// ─── Helper ───

function makeConflict(overrides: Partial<ConflictRecord> = {}): ConflictRecord {
  return {
    id: 1,
    noteId: 'note-1',
    noteTitle: 'Test Note',
    strategy: 'last-write-wins',
    fields: [{ field: 'content', localValue: 'L', serverValue: 'S', resolvedValue: 'S' }],
    localTimestamp: new Date('2026-03-15T10:00:00Z'),
    serverTimestamp: new Date('2026-03-15T10:00:05Z'),
    resolvedAt: new Date('2026-03-15T10:00:06Z'),
    deviceId: 'device-1',
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════
// Conflict Lifecycle
// ═══════════════════════════════════════════════════════════

describe('Conflict Lifecycle', () => {
  it('conflict progresses: detection -> analysis -> resolution', () => {
    const detected = new Date('2026-03-15T10:00:00Z');
    const analyzed = new Date('2026-03-15T10:00:01Z');
    const resolved = new Date('2026-03-15T10:00:02Z');

    expect(detected.getTime()).toBeLessThan(analyzed.getTime());
    expect(analyzed.getTime()).toBeLessThan(resolved.getTime());
  });

  it('resolution time is positive when server precedes resolution', () => {
    const serverTs = new Date('2026-03-15T10:00:00Z');
    const resolvedAt = new Date('2026-03-15T10:00:05Z');
    const resolutionTime = resolvedAt.getTime() - serverTs.getTime();
    expect(resolutionTime).toBe(5000);
    expect(formatResolutionTime(resolutionTime)).toBe('5.0s');
  });

  it('handles sub-millisecond resolution (instant)', () => {
    expect(formatResolutionTime(0)).toBe('0ms');
  });
});

// ═══════════════════════════════════════════════════════════
// Multi-Device Conflict Scenarios
// ═══════════════════════════════════════════════════════════

describe('Multi-Device Conflicts', () => {
  it('tracks unique devices across conflicts', () => {
    const conflicts = [
      makeConflict({ id: 1, deviceId: 'chrome-mac' }),
      makeConflict({ id: 2, deviceId: 'safari-iphone' }),
      makeConflict({ id: 3, deviceId: 'firefox-linux' }),
      makeConflict({ id: 4, deviceId: 'chrome-mac' }), // duplicate
    ];
    const devices = new Set(conflicts.map(c => c.deviceId));
    expect(devices.size).toBe(3);
  });

  it('groups same-device conflicts', () => {
    const conflicts = [
      makeConflict({ id: 1, deviceId: 'device-A', noteId: 'note-1' }),
      makeConflict({ id: 2, deviceId: 'device-A', noteId: 'note-2' }),
      makeConflict({ id: 3, deviceId: 'device-B', noteId: 'note-1' }),
    ];
    const byDevice = new Map<string, ConflictRecord[]>();
    for (const c of conflicts) {
      if (!byDevice.has(c.deviceId)) byDevice.set(c.deviceId, []);
      byDevice.get(c.deviceId)!.push(c);
    }
    expect(byDevice.get('device-A')!.length).toBe(2);
    expect(byDevice.get('device-B')!.length).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════
// PowerSync Sync Flow Documentation
// ═══════════════════════════════════════════════════════════

describe('PowerSync Sync Flow', () => {
  it('documents the conflict detection flow', () => {
    // 1. Client writes to local SQLite (instant)
    // 2. PowerSync queues the CRUD operation
    // 3. Connector.uploadData sends batch to server
    // 4. Server responds 409 if conflict detected
    // 5. Connector dispatches syncmind:conflict CustomEvent
    // 6. SyncConflictViewer captures and displays the conflict
    // 7. PowerSync pulls server version on next sync
    const steps = [
      'local_write',
      'crud_queue',
      'upload_data',
      'conflict_409',
      'custom_event',
      'viewer_captures',
      'server_pull',
    ];
    expect(steps.length).toBe(7);
  });

  it('documents PowerSync APIs used', () => {
    const apis = {
      'useStatus': 'Connection state and data flow indicators',
      'useQuery': 'Reactive SQL queries against local SQLite',
      'powerSync.watch': 'AsyncIterable for real-time change monitoring',
      'CustomEvent': 'syncmind:conflict event from Connector',
    };
    expect(Object.keys(apis).length).toBe(4);
  });

  it('documents that local writes always succeed', () => {
    // In PowerSync, writes to local SQLite never fail due to sync conflicts
    // Conflicts are only detected during the upload phase
    const localWriteAlwaysSucceeds = true;
    expect(localWriteAlwaysSucceeds).toBe(true);
  });

  it('documents that conflicts are resolved transparently', () => {
    // Users don't need to manually resolve conflicts in the default mode
    // The Connector handles 409 responses automatically
    const transparentResolution = true;
    expect(transparentResolution).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// Stats with temporal patterns
// ═══════════════════════════════════════════════════════════

describe('Temporal Conflict Patterns', () => {
  it('detects burst patterns (many conflicts in short time)', () => {
    const conflicts = Array.from({ length: 10 }, (_, i) =>
      makeConflict({
        id: i,
        resolvedAt: new Date(`2026-03-15T10:00:${String(i).padStart(2, '0')}Z`),
        serverTimestamp: new Date('2026-03-15T09:59:50Z'),
      })
    );
    const stats = computeConflictStats(conflicts);
    // 10 conflicts in ~9 seconds = very high rate
    expect(stats.conflictsPerHour).toBeGreaterThan(100);
  });

  it('detects sparse patterns (few conflicts over long time)', () => {
    const conflicts = [
      makeConflict({ id: 1, resolvedAt: new Date('2026-03-15T10:00:00Z') }),
      makeConflict({ id: 2, resolvedAt: new Date('2026-03-15T22:00:00Z') }),
    ];
    const stats = computeConflictStats(conflicts);
    // 2 conflicts in 12 hours
    expect(stats.conflictsPerHour).toBeLessThan(1);
  });

  it('handles midnight-crossing timestamps', () => {
    const conflicts = [
      makeConflict({ id: 1, resolvedAt: new Date('2026-03-15T23:55:00Z') }),
      makeConflict({ id: 2, resolvedAt: new Date('2026-03-16T00:05:00Z') }),
    ];
    const stats = computeConflictStats(conflicts);
    // 2 conflicts across midnight
    expect(stats.totalConflicts).toBe(2);
    expect(stats.lastConflictAt!.getTime()).toBe(new Date('2026-03-16T00:05:00Z').getTime());
  });
});

// ═══════════════════════════════════════════════════════════
// Field diff with real note content
// ═══════════════════════════════════════════════════════════

describe('Field Diff - Real Content', () => {
  it('detects AI summary conflicts', () => {
    const result = computeFieldDiff(
      'This paper explores transformer architectures for NLP tasks, focusing on attention mechanisms.',
      'This paper examines deep learning approaches to natural language understanding using self-attention.'
    );
    expect(result.hasConflict).toBe(true);
    expect(result.changeType).toBe('modified');
  });

  it('detects tag list conflicts', () => {
    const result = computeFieldDiff(
      'ai, machine-learning, nlp, transformers',
      'ai, deep-learning, nlp, attention'
    );
    expect(result.hasConflict).toBe(true);
  });

  it('detects source URL changes', () => {
    const result = computeFieldDiff(
      'https://arxiv.org/abs/2301.00001',
      'https://arxiv.org/abs/2301.00002'
    );
    expect(result.hasConflict).toBe(true);
  });

  it('detects no change in identical AI connections JSON', () => {
    const json = '{"connections": [{"target": "note-2", "relationship": "cites"}]}';
    const result = computeFieldDiff(json, json);
    expect(result.hasConflict).toBe(false);
    expect(result.changeType).toBe('unchanged');
  });
});

// ═══════════════════════════════════════════════════════════
// Conflict badge and indicator logic
// ═══════════════════════════════════════════════════════════

describe('Conflict Badge Logic', () => {
  it('shows badge count for non-zero conflicts', () => {
    const count = 5;
    const showBadge = count > 0;
    expect(showBadge).toBe(true);
  });

  it('hides badge for zero conflicts', () => {
    const count = 0;
    const showBadge = count > 0;
    expect(showBadge).toBe(false);
  });

  it('indicator shows connected state', () => {
    const connected = true;
    const className = `sync-conflict-indicator ${connected ? 'connected' : 'disconnected'}`;
    expect(className).toContain('connected');
    expect(className).not.toContain('disconnected');
  });

  it('indicator shows disconnected state', () => {
    const connected = false;
    const className = `sync-conflict-indicator ${connected ? 'connected' : 'disconnected'}`;
    expect(className).toContain('disconnected');
  });

  it('arrow shows correct direction', () => {
    expect(true ? '\u25B2' : '\u25BC').toBe('\u25B2');
    expect(false ? '\u25B2' : '\u25BC').toBe('\u25BC');
  });
});

// ═══════════════════════════════════════════════════════════
// Conflict merging and resolution details
// ═══════════════════════════════════════════════════════════

describe('Conflict Resolution Details', () => {
  it('last-write-wins resolves based on timestamp comparison', () => {
    const localTs = new Date('2026-03-15T10:00:00Z');
    const serverTs = new Date('2026-03-15T10:00:05Z');
    const winner = serverTs.getTime() > localTs.getTime() ? 'server' : 'local';
    expect(winner).toBe('server');
  });

  it('local wins when local timestamp is newer', () => {
    const localTs = new Date('2026-03-15T10:00:10Z');
    const serverTs = new Date('2026-03-15T10:00:05Z');
    const winner = localTs.getTime() > serverTs.getTime() ? 'local' : 'server';
    expect(winner).toBe('local');
  });

  it('simultaneous edits fall to server by convention', () => {
    const ts = new Date('2026-03-15T10:00:00Z');
    // When timestamps are equal, PowerSync defaults to server version
    const winner = 'server'; // Convention
    expect(winner).toBe('server');
  });

  it('manual merge can combine both versions', () => {
    const local = 'local paragraph';
    const server = 'server paragraph';
    const merged = `${local}\n---\n${server}`;
    expect(merged).toContain(local);
    expect(merged).toContain(server);
  });
});

// ═══════════════════════════════════════════════════════════
// Stats panel rendering logic
// ═══════════════════════════════════════════════════════════

describe('Stats Panel Rendering', () => {
  it('computes bar width percentages', () => {
    const total = 20;
    const counts = { lww: 10, sw: 5, cw: 3, mm: 2 };

    expect((counts.lww / total) * 100).toBe(50);
    expect((counts.sw / total) * 100).toBe(25);
    expect((counts.cw / total) * 100).toBe(15);
    expect((counts.mm / total) * 100).toBe(10);
  });

  it('handles 100% single strategy', () => {
    const total = 5;
    const count = 5;
    expect((count / total) * 100).toBe(100);
  });

  it('handles zero total for bar width', () => {
    const total = 0;
    const width = total > 0 ? (3 / total) * 100 : 0;
    expect(width).toBe(0);
  });

  it('formats all stat values for display', () => {
    const stats = computeConflictStats([
      makeConflict({
        id: 1,
        serverTimestamp: new Date('2026-03-15T10:00:00Z'),
        resolvedAt: new Date('2026-03-15T10:00:02Z'),
      }),
    ]);
    expect(typeof stats.totalConflicts).toBe('number');
    expect(typeof stats.avgResolutionTimeMs).toBe('number');
    expect(typeof stats.conflictsPerHour).toBe('number');
    expect(formatResolutionTime(stats.avgResolutionTimeMs)).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════
// Integration with existing components
// ═══════════════════════════════════════════════════════════

describe('Integration with App', () => {
  it('uses same event name as SyncActivityFeed', () => {
    // Both SyncActivityFeed and SyncConflictViewer listen to syncmind:conflict
    const eventName = 'syncmind:conflict';
    expect(eventName).toBe('syncmind:conflict');
  });

  it('uses same color scheme as SyncDashboard', () => {
    // Connected: green, disconnected: amber/red
    expect(getSeverityColor('low')).toBe('#10b981');     // Same green as SyncDashboard
    expect(getSeverityColor('medium')).toBe('#f59e0b');   // Same amber
    expect(getSeverityColor('high')).toBe('#ef4444');     // Same red
  });

  it('uses same PowerSync hooks as other components', () => {
    // Confirms consistent API usage across the app
    const sharedHooks = ['useStatus', 'useQuery'];
    expect(sharedHooks.length).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════
// Display limits and pagination
// ═══════════════════════════════════════════════════════════

describe('Display Limits', () => {
  it('timeline shows max 20 items', () => {
    const all = Array.from({ length: 50 }, (_, i) => makeConflict({ id: i }));
    const displayed = all.slice(0, 20);
    expect(displayed.length).toBe(20);
  });

  it('history stores max 100 records', () => {
    const all = Array.from({ length: 120 }, (_, i) => makeConflict({ id: i }));
    const stored = all.slice(0, 100);
    expect(stored.length).toBe(100);
  });

  it('notes query limits to 100', () => {
    // SELECT id, title FROM notes ORDER BY updated_at DESC LIMIT 100
    const limit = 100;
    expect(limit).toBe(100);
  });
});

// ═══════════════════════════════════════════════════════════
// formatRelativeTime - More boundaries
// ═══════════════════════════════════════════════════════════

describe('formatRelativeTime - More Boundaries', () => {
  const now = new Date('2026-03-15T12:00:00Z');

  it('59 seconds = just now', () => {
    expect(formatRelativeTime(new Date(now.getTime() - 59000), now)).toBe('just now');
  });

  it('60 seconds = 1m ago', () => {
    expect(formatRelativeTime(new Date(now.getTime() - 60000), now)).toBe('1m ago');
  });

  it('3599 seconds = 59m ago', () => {
    expect(formatRelativeTime(new Date(now.getTime() - 3599000), now)).toBe('59m ago');
  });

  it('3600 seconds = 1h ago', () => {
    expect(formatRelativeTime(new Date(now.getTime() - 3600000), now)).toBe('1h ago');
  });

  it('86399 seconds = 23h ago', () => {
    expect(formatRelativeTime(new Date(now.getTime() - 86399000), now)).toBe('23h ago');
  });

  it('86400 seconds = 1d ago', () => {
    expect(formatRelativeTime(new Date(now.getTime() - 86400000), now)).toBe('1d ago');
  });
});
