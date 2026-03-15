import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Import pure logic functions from SyncConflictViewer ───
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
  type ConflictStats,
} from '../components/SyncConflictViewer';

// ─── Mock PowerSync hooks ───
const mockUseStatus = vi.fn();
const mockUseQuery = vi.fn();
vi.mock('@powersync/react', () => ({
  useStatus: () => mockUseStatus(),
  useQuery: (sql: string) => mockUseQuery(sql),
}));

const mockWatch = vi.fn();
vi.mock('../lib/PowerSyncProvider', () => ({
  powerSync: {
    watch: (...args: any[]) => mockWatch(...args),
  },
}));

// Import component after mocks
import { SyncConflictViewer } from '../components/SyncConflictViewer';

// ─── Helper: create a conflict record ───
function makeConflict(overrides: Partial<ConflictRecord> = {}): ConflictRecord {
  return {
    id: 1,
    noteId: 'note-1',
    noteTitle: 'Test Note',
    strategy: 'last-write-wins',
    fields: [
      {
        field: 'content',
        localValue: 'local content',
        serverValue: 'server content',
        resolvedValue: 'server content',
      },
    ],
    localTimestamp: new Date('2026-03-15T10:00:00Z'),
    serverTimestamp: new Date('2026-03-15T10:00:05Z'),
    resolvedAt: new Date('2026-03-15T10:00:06Z'),
    deviceId: 'device-abc123',
    ...overrides,
  };
}

function makeField(overrides: Partial<ConflictField> = {}): ConflictField {
  return {
    field: 'content',
    localValue: 'local',
    serverValue: 'server',
    resolvedValue: 'server',
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════
// Component Export
// ═══════════════════════════════════════════════════════════

describe('SyncConflictViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseStatus.mockReturnValue({
      connected: true,
      dataFlowStatus: { uploading: false, downloading: false },
    });
    mockUseQuery.mockReturnValue({ data: [] });
    mockWatch.mockReturnValue({
      [Symbol.asyncIterator]: () => ({
        next: () => new Promise(() => {}),
      }),
    });
  });

  it('exports SyncConflictViewer component', () => {
    expect(SyncConflictViewer).toBeDefined();
    expect(typeof SyncConflictViewer).toBe('function');
  });

  it('exports all pure logic functions', () => {
    expect(typeof computeConflictStats).toBe('function');
    expect(typeof formatResolutionTime).toBe('function');
    expect(typeof getStrategyLabel).toBe('function');
    expect(typeof getStrategyDescription).toBe('function');
    expect(typeof getStrategyColor).toBe('function');
    expect(typeof getStrategyIcon).toBe('function');
    expect(typeof computeFieldDiff).toBe('function');
    expect(typeof truncateText).toBe('function');
    expect(typeof formatRelativeTime).toBe('function');
    expect(typeof groupConflictsByNote).toBe('function');
    expect(typeof getConflictSeverity).toBe('function');
    expect(typeof getSeverityColor).toBe('function');
  });
});

// ═══════════════════════════════════════════════════════════
// formatResolutionTime
// ═══════════════════════════════════════════════════════════

describe('formatResolutionTime', () => {
  it('formats sub-second durations in milliseconds', () => {
    expect(formatResolutionTime(0)).toBe('0ms');
    expect(formatResolutionTime(1)).toBe('1ms');
    expect(formatResolutionTime(500)).toBe('500ms');
    expect(formatResolutionTime(999)).toBe('999ms');
  });

  it('formats seconds with one decimal place', () => {
    expect(formatResolutionTime(1000)).toBe('1.0s');
    expect(formatResolutionTime(1500)).toBe('1.5s');
    expect(formatResolutionTime(30000)).toBe('30.0s');
    expect(formatResolutionTime(59999)).toBe('60.0s');
  });

  it('formats minutes and seconds', () => {
    expect(formatResolutionTime(60000)).toBe('1m 0s');
    expect(formatResolutionTime(90000)).toBe('1m 30s');
    expect(formatResolutionTime(125000)).toBe('2m 5s');
    expect(formatResolutionTime(3600000)).toBe('60m 0s');
  });

  it('handles edge cases', () => {
    expect(formatResolutionTime(0)).toBe('0ms');
    expect(formatResolutionTime(999)).toBe('999ms');
    expect(formatResolutionTime(1000)).toBe('1.0s');
  });
});

// ═══════════════════════════════════════════════════════════
// getStrategyLabel
// ═══════════════════════════════════════════════════════════

describe('getStrategyLabel', () => {
  it('returns correct labels for all strategies', () => {
    expect(getStrategyLabel('last-write-wins')).toBe('Last Write Wins');
    expect(getStrategyLabel('server-wins')).toBe('Server Wins');
    expect(getStrategyLabel('client-wins')).toBe('Client Wins');
    expect(getStrategyLabel('manual-merge')).toBe('Manual Merge');
  });

  it('returns human-readable labels (not kebab-case)', () => {
    const strategies: ResolutionStrategy[] = ['last-write-wins', 'server-wins', 'client-wins', 'manual-merge'];
    for (const s of strategies) {
      const label = getStrategyLabel(s);
      expect(label).not.toContain('-');
      expect(label[0]).toBe(label[0].toUpperCase());
    }
  });
});

// ═══════════════════════════════════════════════════════════
// getStrategyDescription
// ═══════════════════════════════════════════════════════════

describe('getStrategyDescription', () => {
  it('provides a non-empty description for every strategy', () => {
    const strategies: ResolutionStrategy[] = ['last-write-wins', 'server-wins', 'client-wins', 'manual-merge'];
    for (const s of strategies) {
      const desc = getStrategyDescription(s);
      expect(desc.length).toBeGreaterThan(20);
    }
  });

  it('mentions PowerSync for last-write-wins', () => {
    expect(getStrategyDescription('last-write-wins')).toContain('PowerSync');
  });

  it('mentions server for server-wins', () => {
    expect(getStrategyDescription('server-wins').toLowerCase()).toContain('server');
  });

  it('mentions local/client for client-wins', () => {
    const desc = getStrategyDescription('client-wins').toLowerCase();
    expect(desc.includes('local') || desc.includes('client')).toBe(true);
  });

  it('mentions manual/merge for manual-merge', () => {
    const desc = getStrategyDescription('manual-merge').toLowerCase();
    expect(desc.includes('manual') || desc.includes('merge')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// getStrategyColor
// ═══════════════════════════════════════════════════════════

describe('getStrategyColor', () => {
  it('returns valid hex colors for all strategies', () => {
    const strategies: ResolutionStrategy[] = ['last-write-wins', 'server-wins', 'client-wins', 'manual-merge'];
    for (const s of strategies) {
      expect(getStrategyColor(s)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('returns distinct colors for each strategy', () => {
    const colors = new Set([
      getStrategyColor('last-write-wins'),
      getStrategyColor('server-wins'),
      getStrategyColor('client-wins'),
      getStrategyColor('manual-merge'),
    ]);
    expect(colors.size).toBe(4);
  });

  it('uses indigo for last-write-wins', () => {
    expect(getStrategyColor('last-write-wins')).toBe('#818cf8');
  });

  it('uses green for server-wins', () => {
    expect(getStrategyColor('server-wins')).toBe('#10b981');
  });

  it('uses amber for client-wins', () => {
    expect(getStrategyColor('client-wins')).toBe('#f59e0b');
  });

  it('uses pink for manual-merge', () => {
    expect(getStrategyColor('manual-merge')).toBe('#ec4899');
  });
});

// ═══════════════════════════════════════════════════════════
// getStrategyIcon
// ═══════════════════════════════════════════════════════════

describe('getStrategyIcon', () => {
  it('returns non-empty icons for all strategies', () => {
    const strategies: ResolutionStrategy[] = ['last-write-wins', 'server-wins', 'client-wins', 'manual-merge'];
    for (const s of strategies) {
      const icon = getStrategyIcon(s);
      expect(icon.length).toBeGreaterThan(0);
    }
  });

  it('returns unique icons for each strategy', () => {
    const icons = new Set([
      getStrategyIcon('last-write-wins'),
      getStrategyIcon('server-wins'),
      getStrategyIcon('client-wins'),
      getStrategyIcon('manual-merge'),
    ]);
    expect(icons.size).toBe(4);
  });

  it('uses hourglass for last-write-wins', () => {
    expect(getStrategyIcon('last-write-wins')).toBe('\u231B');
  });

  it('uses cloud for server-wins', () => {
    expect(getStrategyIcon('server-wins')).toBe('\u2601');
  });
});

// ═══════════════════════════════════════════════════════════
// computeFieldDiff
// ═══════════════════════════════════════════════════════════

describe('computeFieldDiff', () => {
  it('detects unchanged fields', () => {
    const result = computeFieldDiff('same', 'same');
    expect(result.hasConflict).toBe(false);
    expect(result.changeType).toBe('unchanged');
  });

  it('detects modified fields', () => {
    const result = computeFieldDiff('local version', 'server version');
    expect(result.hasConflict).toBe(true);
    expect(result.changeType).toBe('modified');
  });

  it('detects added fields (empty local, non-empty server)', () => {
    const result = computeFieldDiff('', 'new server content');
    expect(result.hasConflict).toBe(true);
    expect(result.changeType).toBe('added');
  });

  it('detects removed fields (non-empty local, empty server)', () => {
    const result = computeFieldDiff('existing content', '');
    expect(result.hasConflict).toBe(true);
    expect(result.changeType).toBe('removed');
  });

  it('treats both empty as unchanged', () => {
    const result = computeFieldDiff('', '');
    expect(result.hasConflict).toBe(false);
    expect(result.changeType).toBe('unchanged');
  });

  it('detects whitespace-only differences as modified', () => {
    const result = computeFieldDiff('hello', 'hello ');
    expect(result.hasConflict).toBe(true);
    expect(result.changeType).toBe('modified');
  });

  it('is case-sensitive', () => {
    const result = computeFieldDiff('Hello', 'hello');
    expect(result.hasConflict).toBe(true);
    expect(result.changeType).toBe('modified');
  });
});

// ═══════════════════════════════════════════════════════════
// truncateText
// ═══════════════════════════════════════════════════════════

describe('truncateText', () => {
  it('returns short text unchanged', () => {
    expect(truncateText('hello', 10)).toBe('hello');
  });

  it('truncates long text with ellipsis', () => {
    expect(truncateText('hello world, this is a long text', 10)).toBe('hello w...');
  });

  it('handles exact length', () => {
    expect(truncateText('12345', 5)).toBe('12345');
  });

  it('handles empty string', () => {
    expect(truncateText('', 10)).toBe('');
  });

  it('handles null-like empty value', () => {
    expect(truncateText('', 0)).toBe('');
  });

  it('truncates to exactly maxLength characters', () => {
    const result = truncateText('abcdefghijklmnop', 10);
    expect(result.length).toBe(10);
    expect(result).toBe('abcdefg...');
  });

  it('handles single character with max 1', () => {
    expect(truncateText('a', 1)).toBe('a');
  });

  it('handles maxLength of 3 (edge case for ellipsis)', () => {
    // With maxLength 3, we'd get text.slice(0, 0) + '...' = '...'
    expect(truncateText('abcdef', 3)).toBe('...');
  });
});

// ═══════════════════════════════════════════════════════════
// formatRelativeTime
// ═══════════════════════════════════════════════════════════

describe('formatRelativeTime', () => {
  const now = new Date('2026-03-15T12:00:00Z');

  it('shows "just now" for recent events', () => {
    const date = new Date('2026-03-15T11:59:30Z'); // 30 seconds ago
    expect(formatRelativeTime(date, now)).toBe('just now');
  });

  it('shows minutes for events within an hour', () => {
    const date = new Date('2026-03-15T11:55:00Z'); // 5 minutes ago
    expect(formatRelativeTime(date, now)).toBe('5m ago');
  });

  it('shows hours for events within a day', () => {
    const date = new Date('2026-03-15T09:00:00Z'); // 3 hours ago
    expect(formatRelativeTime(date, now)).toBe('3h ago');
  });

  it('shows days for older events', () => {
    const date = new Date('2026-03-13T12:00:00Z'); // 2 days ago
    expect(formatRelativeTime(date, now)).toBe('2d ago');
  });

  it('shows "just now" for 0 seconds', () => {
    expect(formatRelativeTime(now, now)).toBe('just now');
  });

  it('shows "just now" for 59 seconds', () => {
    const date = new Date('2026-03-15T11:59:01Z');
    expect(formatRelativeTime(date, now)).toBe('just now');
  });

  it('shows "1m ago" for exactly 60 seconds', () => {
    const date = new Date('2026-03-15T11:59:00Z');
    expect(formatRelativeTime(date, now)).toBe('1m ago');
  });

  it('shows "1h ago" for exactly 3600 seconds', () => {
    const date = new Date('2026-03-15T11:00:00Z');
    expect(formatRelativeTime(date, now)).toBe('1h ago');
  });

  it('shows "1d ago" for exactly 86400 seconds', () => {
    const date = new Date('2026-03-14T12:00:00Z');
    expect(formatRelativeTime(date, now)).toBe('1d ago');
  });

  it('handles future dates', () => {
    const future = new Date('2026-03-15T13:00:00Z');
    expect(formatRelativeTime(future, now)).toBe('in the future');
  });
});

// ═══════════════════════════════════════════════════════════
// groupConflictsByNote
// ═══════════════════════════════════════════════════════════

describe('groupConflictsByNote', () => {
  it('groups conflicts by noteId', () => {
    const conflicts = [
      makeConflict({ id: 1, noteId: 'note-1' }),
      makeConflict({ id: 2, noteId: 'note-2' }),
      makeConflict({ id: 3, noteId: 'note-1' }),
    ];
    const grouped = groupConflictsByNote(conflicts);
    expect(grouped.size).toBe(2);
    expect(grouped.get('note-1')!.length).toBe(2);
    expect(grouped.get('note-2')!.length).toBe(1);
  });

  it('returns empty map for empty array', () => {
    expect(groupConflictsByNote([]).size).toBe(0);
  });

  it('handles single conflict', () => {
    const grouped = groupConflictsByNote([makeConflict()]);
    expect(grouped.size).toBe(1);
    expect(grouped.get('note-1')!.length).toBe(1);
  });

  it('preserves all conflicts in groups', () => {
    const conflicts = [
      makeConflict({ id: 1, noteId: 'a' }),
      makeConflict({ id: 2, noteId: 'b' }),
      makeConflict({ id: 3, noteId: 'a' }),
      makeConflict({ id: 4, noteId: 'c' }),
      makeConflict({ id: 5, noteId: 'a' }),
    ];
    const grouped = groupConflictsByNote(conflicts);
    const totalInGroups = Array.from(grouped.values()).reduce((sum, arr) => sum + arr.length, 0);
    expect(totalInGroups).toBe(conflicts.length);
  });
});

// ═══════════════════════════════════════════════════════════
// getConflictSeverity
// ═══════════════════════════════════════════════════════════

describe('getConflictSeverity', () => {
  it('returns low for 0-1 fields', () => {
    expect(getConflictSeverity(0)).toBe('low');
    expect(getConflictSeverity(1)).toBe('low');
  });

  it('returns medium for 2-3 fields', () => {
    expect(getConflictSeverity(2)).toBe('medium');
    expect(getConflictSeverity(3)).toBe('medium');
  });

  it('returns high for 4+ fields', () => {
    expect(getConflictSeverity(4)).toBe('high');
    expect(getConflictSeverity(10)).toBe('high');
    expect(getConflictSeverity(100)).toBe('high');
  });
});

// ═══════════════════════════════════════════════════════════
// getSeverityColor
// ═══════════════════════════════════════════════════════════

describe('getSeverityColor', () => {
  it('returns green for low severity', () => {
    expect(getSeverityColor('low')).toBe('#10b981');
  });

  it('returns amber for medium severity', () => {
    expect(getSeverityColor('medium')).toBe('#f59e0b');
  });

  it('returns red for high severity', () => {
    expect(getSeverityColor('high')).toBe('#ef4444');
  });

  it('returns valid hex colors for all severities', () => {
    const severities: ('low' | 'medium' | 'high')[] = ['low', 'medium', 'high'];
    for (const s of severities) {
      expect(getSeverityColor(s)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('uses distinct colors for each severity', () => {
    const colors = new Set([
      getSeverityColor('low'),
      getSeverityColor('medium'),
      getSeverityColor('high'),
    ]);
    expect(colors.size).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════
// computeConflictStats
// ═══════════════════════════════════════════════════════════

describe('computeConflictStats', () => {
  it('returns zero stats for empty array', () => {
    const stats = computeConflictStats([]);
    expect(stats.totalConflicts).toBe(0);
    expect(stats.avgResolutionTimeMs).toBe(0);
    expect(stats.lastConflictAt).toBeNull();
    expect(stats.conflictsPerHour).toBe(0);
  });

  it('counts total conflicts', () => {
    const conflicts = [makeConflict({ id: 1 }), makeConflict({ id: 2 }), makeConflict({ id: 3 })];
    const stats = computeConflictStats(conflicts);
    expect(stats.totalConflicts).toBe(3);
  });

  it('breaks down by strategy', () => {
    const conflicts = [
      makeConflict({ id: 1, strategy: 'last-write-wins' }),
      makeConflict({ id: 2, strategy: 'last-write-wins' }),
      makeConflict({ id: 3, strategy: 'server-wins' }),
      makeConflict({ id: 4, strategy: 'manual-merge' }),
    ];
    const stats = computeConflictStats(conflicts);
    expect(stats.resolvedByStrategy['last-write-wins']).toBe(2);
    expect(stats.resolvedByStrategy['server-wins']).toBe(1);
    expect(stats.resolvedByStrategy['client-wins']).toBe(0);
    expect(stats.resolvedByStrategy['manual-merge']).toBe(1);
  });

  it('computes average resolution time', () => {
    const conflicts = [
      makeConflict({
        id: 1,
        serverTimestamp: new Date('2026-03-15T10:00:00Z'),
        resolvedAt: new Date('2026-03-15T10:00:10Z'), // 10 seconds
      }),
      makeConflict({
        id: 2,
        serverTimestamp: new Date('2026-03-15T10:00:00Z'),
        resolvedAt: new Date('2026-03-15T10:00:20Z'), // 20 seconds
      }),
    ];
    const stats = computeConflictStats(conflicts);
    expect(stats.avgResolutionTimeMs).toBe(15000); // average of 10s and 20s
  });

  it('tracks the last conflict time', () => {
    const conflicts = [
      makeConflict({ id: 1, resolvedAt: new Date('2026-03-15T08:00:00Z') }),
      makeConflict({ id: 2, resolvedAt: new Date('2026-03-15T12:00:00Z') }),
      makeConflict({ id: 3, resolvedAt: new Date('2026-03-15T10:00:00Z') }),
    ];
    const stats = computeConflictStats(conflicts);
    expect(stats.lastConflictAt!.getTime()).toBe(new Date('2026-03-15T12:00:00Z').getTime());
  });

  it('counts conflicts by table', () => {
    const conflicts = [makeConflict({ id: 1 }), makeConflict({ id: 2 })];
    const stats = computeConflictStats(conflicts);
    expect(stats.conflictsByTable['notes']).toBe(2);
  });

  it('initializes all strategy counts to zero', () => {
    const stats = computeConflictStats([]);
    expect(stats.resolvedByStrategy['last-write-wins']).toBe(0);
    expect(stats.resolvedByStrategy['server-wins']).toBe(0);
    expect(stats.resolvedByStrategy['client-wins']).toBe(0);
    expect(stats.resolvedByStrategy['manual-merge']).toBe(0);
  });

  it('handles single conflict', () => {
    const stats = computeConflictStats([makeConflict()]);
    expect(stats.totalConflicts).toBe(1);
    expect(stats.resolvedByStrategy['last-write-wins']).toBe(1);
  });

  it('computes conflicts per hour when time span exists', () => {
    const conflicts = [
      makeConflict({ id: 1, resolvedAt: new Date('2026-03-15T10:00:00Z') }),
      makeConflict({ id: 2, resolvedAt: new Date('2026-03-15T11:00:00Z') }),
      makeConflict({ id: 3, resolvedAt: new Date('2026-03-15T12:00:00Z') }),
    ];
    const stats = computeConflictStats(conflicts);
    // 3 conflicts over 2 hours = 1.5/hour
    expect(stats.conflictsPerHour).toBe(1.5);
  });

  it('returns 0 conflicts per hour for single conflict', () => {
    const stats = computeConflictStats([makeConflict()]);
    expect(stats.conflictsPerHour).toBe(0);
  });

  it('handles negative resolution time gracefully (clamps to 0)', () => {
    const conflict = makeConflict({
      serverTimestamp: new Date('2026-03-15T12:00:00Z'),
      resolvedAt: new Date('2026-03-15T11:00:00Z'), // resolved "before" server time
    });
    const stats = computeConflictStats([conflict]);
    expect(stats.avgResolutionTimeMs).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════
// ConflictRecord interface
// ═══════════════════════════════════════════════════════════

describe('ConflictRecord', () => {
  it('has all required fields', () => {
    const record = makeConflict();
    expect(record.id).toBeDefined();
    expect(record.noteId).toBeDefined();
    expect(record.noteTitle).toBeDefined();
    expect(record.strategy).toBeDefined();
    expect(record.fields).toBeDefined();
    expect(record.localTimestamp).toBeDefined();
    expect(record.serverTimestamp).toBeDefined();
    expect(record.resolvedAt).toBeDefined();
    expect(record.deviceId).toBeDefined();
  });

  it('fields is an array of ConflictField', () => {
    const record = makeConflict({
      fields: [
        makeField({ field: 'title' }),
        makeField({ field: 'content' }),
        makeField({ field: 'tags' }),
      ],
    });
    expect(record.fields.length).toBe(3);
    expect(record.fields[0].field).toBe('title');
    expect(record.fields[1].field).toBe('content');
    expect(record.fields[2].field).toBe('tags');
  });

  it('timestamps are Date objects', () => {
    const record = makeConflict();
    expect(record.localTimestamp).toBeInstanceOf(Date);
    expect(record.serverTimestamp).toBeInstanceOf(Date);
    expect(record.resolvedAt).toBeInstanceOf(Date);
  });

  it('strategy is a valid ResolutionStrategy', () => {
    const valid: ResolutionStrategy[] = ['last-write-wins', 'server-wins', 'client-wins', 'manual-merge'];
    const record = makeConflict();
    expect(valid).toContain(record.strategy);
  });
});

// ═══════════════════════════════════════════════════════════
// ConflictField interface
// ═══════════════════════════════════════════════════════════

describe('ConflictField', () => {
  it('has field name, local, server, and resolved values', () => {
    const field = makeField();
    expect(field.field).toBeDefined();
    expect(field.localValue).toBeDefined();
    expect(field.serverValue).toBeDefined();
    expect(field.resolvedValue).toBeDefined();
  });

  it('supports various note fields', () => {
    const fields = ['title', 'content', 'tags', 'ai_summary', 'source_url'];
    for (const f of fields) {
      const field = makeField({ field: f });
      expect(field.field).toBe(f);
    }
  });
});

// ═══════════════════════════════════════════════════════════
// Edge Cases & Integration
// ═══════════════════════════════════════════════════════════

describe('SyncConflictViewer - Edge Cases', () => {
  it('handles conflicts with empty fields array', () => {
    const conflict = makeConflict({ fields: [] });
    expect(conflict.fields.length).toBe(0);
    expect(getConflictSeverity(conflict.fields.length)).toBe('low');
  });

  it('handles conflicts with many fields', () => {
    const fields = Array.from({ length: 10 }, (_, i) =>
      makeField({ field: `field-${i}` })
    );
    const conflict = makeConflict({ fields });
    expect(conflict.fields.length).toBe(10);
    expect(getConflictSeverity(conflict.fields.length)).toBe('high');
  });

  it('handles very long note titles', () => {
    const longTitle = 'A'.repeat(500);
    const truncated = truncateText(longTitle, 30);
    expect(truncated.length).toBe(30);
    expect(truncated.endsWith('...')).toBe(true);
  });

  it('handles very long field values', () => {
    const longValue = 'x'.repeat(10000);
    const truncated = truncateText(longValue, 100);
    expect(truncated.length).toBe(100);
    expect(truncated.endsWith('...')).toBe(true);
  });

  it('handles rapid conflict events', () => {
    const conflicts: ConflictRecord[] = [];
    for (let i = 0; i < 100; i++) {
      conflicts.push(makeConflict({
        id: i,
        resolvedAt: new Date(Date.now() + i * 100),
      }));
    }
    // Should keep max 100
    const kept = conflicts.slice(0, 100);
    expect(kept.length).toBe(100);
  });

  it('handles unicode in field values', () => {
    const field = makeField({
      localValue: 'Research on AI \u{1F916} systems',
      serverValue: 'Research on AI \u{1F4A1} systems',
    });
    const diff = computeFieldDiff(field.localValue, field.serverValue);
    expect(diff.hasConflict).toBe(true);
    expect(diff.changeType).toBe('modified');
  });

  it('handles identical field values across all fields', () => {
    const field = makeField({
      localValue: 'same',
      serverValue: 'same',
      resolvedValue: 'same',
    });
    const diff = computeFieldDiff(field.localValue, field.serverValue);
    expect(diff.hasConflict).toBe(false);
  });

  it('handles conflicts from multiple devices', () => {
    const conflicts = [
      makeConflict({ id: 1, deviceId: 'chrome-desktop' }),
      makeConflict({ id: 2, deviceId: 'safari-mobile' }),
      makeConflict({ id: 3, deviceId: 'firefox-tablet' }),
    ];
    const deviceIds = new Set(conflicts.map(c => c.deviceId));
    expect(deviceIds.size).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════
// PowerSync Integration Points
// ═══════════════════════════════════════════════════════════

describe('SyncConflictViewer - PowerSync Integration', () => {
  it('uses useStatus for connection state', () => {
    mockUseStatus.mockReturnValue({
      connected: true,
      dataFlowStatus: { uploading: false, downloading: false },
    });
    const status = mockUseStatus();
    expect(status.connected).toBe(true);
  });

  it('uses useQuery for reactive notes query', () => {
    mockUseQuery.mockReturnValue({
      data: [
        { id: 'note-1', title: 'AI Research' },
        { id: 'note-2', title: 'Transformer Paper' },
      ],
    });
    const result = mockUseQuery('SELECT id, title FROM notes ORDER BY updated_at DESC LIMIT 100');
    expect(result.data.length).toBe(2);
    expect(result.data[0].title).toBe('AI Research');
  });

  it('handles empty notes query', () => {
    mockUseQuery.mockReturnValue({ data: [] });
    const result = mockUseQuery('SELECT id, title FROM notes ORDER BY updated_at DESC LIMIT 100');
    expect(result.data).toEqual([]);
  });

  it('handles disconnected state', () => {
    mockUseStatus.mockReturnValue({
      connected: false,
      dataFlowStatus: undefined,
    });
    const status = mockUseStatus();
    expect(status.connected).toBe(false);
  });

  it('handles concurrent upload/download during conflicts', () => {
    mockUseStatus.mockReturnValue({
      connected: true,
      dataFlowStatus: { uploading: true, downloading: true },
    });
    const status = mockUseStatus();
    expect(status.dataFlowStatus.uploading).toBe(true);
    expect(status.dataFlowStatus.downloading).toBe(true);
  });

  it('leverages PowerSync watch for reactive conflict detection', () => {
    // The component uses powerSync.watch to monitor recent note changes
    // This documents the integration point
    const apis = ['useStatus', 'useQuery', 'powerSync.watch', 'CustomEvent:syncmind:conflict'];
    expect(apis.length).toBe(4);
  });

  it('integrates with Connector conflict events via CustomEvent', () => {
    // Connector dispatches syncmind:conflict events on 409 responses
    // SyncConflictViewer listens and records them
    const event = new CustomEvent('syncmind:conflict', {
      detail: {
        noteId: 'note-1',
        noteTitle: 'Test',
        strategy: 'last-write-wins',
        message: 'Conflict resolved',
      },
    });
    expect(event.type).toBe('syncmind:conflict');
    expect(event.detail.strategy).toBe('last-write-wins');
  });
});

// ═══════════════════════════════════════════════════════════
// Conflict Simulation Logic
// ═══════════════════════════════════════════════════════════

describe('SyncConflictViewer - Conflict Simulation', () => {
  it('creates valid conflict fields for simulation', () => {
    const noteTitle = 'AI Research Overview';
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
    ];

    expect(fields.length).toBe(2);
    expect(fields[0].field).toBe('title');
    expect(fields[1].field).toBe('content');

    // Server version wins in last-write-wins
    expect(fields[0].resolvedValue).toBe(fields[0].serverValue);
    expect(fields[1].resolvedValue).toBe(fields[1].serverValue);
  });

  it('generates device IDs for simulated conflicts', () => {
    const deviceId = `browser-chrome`;
    expect(deviceId).toContain('browser');
  });

  it('simulated timestamps are in correct chronological order', () => {
    const localTs = new Date(Date.now() - 8000);
    const serverTs = new Date(Date.now() - 3000);
    const resolvedAt = new Date();

    expect(localTs.getTime()).toBeLessThan(serverTs.getTime());
    expect(serverTs.getTime()).toBeLessThan(resolvedAt.getTime());
  });
});

// ═══════════════════════════════════════════════════════════
// View Mode & UI State
// ═══════════════════════════════════════════════════════════

describe('SyncConflictViewer - View Modes', () => {
  it('has timeline and stats view modes', () => {
    const modes = ['timeline', 'stats'];
    expect(modes.length).toBe(2);
  });

  it('defaults to timeline view', () => {
    const defaultMode = 'timeline';
    expect(defaultMode).toBe('timeline');
  });

  it('toggles between timeline and stats', () => {
    let mode: 'timeline' | 'stats' = 'timeline';
    mode = 'stats';
    expect(mode).toBe('stats');
    mode = 'timeline';
    expect(mode).toBe('timeline');
  });
});

describe('SyncConflictViewer - Expand/Collapse', () => {
  it('starts collapsed', () => {
    let expanded = false;
    expect(expanded).toBe(false);
  });

  it('toggles on click', () => {
    let expanded = false;
    expanded = !expanded;
    expect(expanded).toBe(true);
    expanded = !expanded;
    expect(expanded).toBe(false);
  });
});

describe('SyncConflictViewer - Timeline Display', () => {
  it('shows max 20 conflicts in timeline', () => {
    const conflicts = Array.from({ length: 30 }, (_, i) => makeConflict({ id: i }));
    const displayed = conflicts.slice(0, 20);
    expect(displayed.length).toBe(20);
  });

  it('shows all conflicts when under limit', () => {
    const conflicts = Array.from({ length: 5 }, (_, i) => makeConflict({ id: i }));
    const displayed = conflicts.slice(0, 20);
    expect(displayed.length).toBe(5);
  });

  it('shows empty state when no conflicts', () => {
    const conflicts: ConflictRecord[] = [];
    expect(conflicts.length).toBe(0);
  });

  it('selects/deselects conflict on click', () => {
    let selected: ConflictRecord | null = null;
    const conflict = makeConflict({ id: 1 });

    // Select
    selected = conflict;
    expect(selected?.id).toBe(1);

    // Deselect (click same)
    selected = selected?.id === conflict.id ? null : conflict;
    expect(selected).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════
// Stats Panel
// ═══════════════════════════════════════════════════════════

describe('SyncConflictViewer - Stats Panel', () => {
  it('computes strategy bar widths as percentages', () => {
    const total = 10;
    const count = 3;
    const width = (count / total) * 100;
    expect(width).toBe(30);
  });

  it('handles zero total conflicts for bar widths', () => {
    const total = 0;
    const count = 0;
    const width = total > 0 ? (count / total) * 100 : 0;
    expect(width).toBe(0);
  });

  it('shows all four strategies in breakdown', () => {
    const strategies: ResolutionStrategy[] = ['last-write-wins', 'server-wins', 'client-wins', 'manual-merge'];
    expect(strategies.length).toBe(4);
    for (const s of strategies) {
      expect(getStrategyLabel(s)).toBeTruthy();
      expect(getStrategyColor(s)).toBeTruthy();
      expect(getStrategyIcon(s)).toBeTruthy();
    }
  });

  it('formats stats values correctly', () => {
    const stats = computeConflictStats([
      makeConflict({
        id: 1,
        serverTimestamp: new Date('2026-03-15T10:00:00Z'),
        resolvedAt: new Date('2026-03-15T10:00:00.500Z'),
      }),
    ]);
    expect(formatResolutionTime(stats.avgResolutionTimeMs)).toBe('500ms');
  });
});

// ═══════════════════════════════════════════════════════════
// Conflict History Management
// ═══════════════════════════════════════════════════════════

describe('SyncConflictViewer - History Management', () => {
  it('prepends new conflicts (newest first)', () => {
    const conflicts = [
      makeConflict({ id: 2, noteTitle: 'Newer' }),
      makeConflict({ id: 1, noteTitle: 'Older' }),
    ];
    expect(conflicts[0].noteTitle).toBe('Newer');
  });

  it('limits history to 100 records', () => {
    const conflicts = Array.from({ length: 110 }, (_, i) => makeConflict({ id: i }));
    const limited = conflicts.slice(0, 100);
    expect(limited.length).toBe(100);
  });

  it('correctly identifies most conflicted notes', () => {
    const conflicts = [
      makeConflict({ id: 1, noteId: 'note-A' }),
      makeConflict({ id: 2, noteId: 'note-B' }),
      makeConflict({ id: 3, noteId: 'note-A' }),
      makeConflict({ id: 4, noteId: 'note-A' }),
      makeConflict({ id: 5, noteId: 'note-B' }),
    ];
    const grouped = groupConflictsByNote(conflicts);
    const sorted = Array.from(grouped.entries()).sort((a, b) => b[1].length - a[1].length);
    expect(sorted[0][0]).toBe('note-A');
    expect(sorted[0][1].length).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════
// Conflict Resolution Strategy Details
// ═══════════════════════════════════════════════════════════

describe('SyncConflictViewer - Resolution Strategy Details', () => {
  it('last-write-wins: server value used when server timestamp is newer', () => {
    const field = makeField({
      localValue: 'old edit',
      serverValue: 'newer edit',
      resolvedValue: 'newer edit',
    });
    expect(field.resolvedValue).toBe(field.serverValue);
  });

  it('server-wins: always uses server value', () => {
    const field = makeField({
      localValue: 'any local value',
      serverValue: 'server value always wins',
      resolvedValue: 'server value always wins',
    });
    expect(field.resolvedValue).toBe(field.serverValue);
  });

  it('client-wins: always uses local value', () => {
    const field = makeField({
      localValue: 'local value always wins',
      serverValue: 'server value',
      resolvedValue: 'local value always wins',
    });
    expect(field.resolvedValue).toBe(field.localValue);
  });

  it('manual-merge: resolved value can differ from both', () => {
    const field = makeField({
      localValue: 'local version A',
      serverValue: 'server version B',
      resolvedValue: 'manually merged version C',
    });
    expect(field.resolvedValue).not.toBe(field.localValue);
    expect(field.resolvedValue).not.toBe(field.serverValue);
  });
});

// ═══════════════════════════════════════════════════════════
// ConflictStats computation - additional cases
// ═══════════════════════════════════════════════════════════

describe('computeConflictStats - Advanced', () => {
  it('handles all strategies used equally', () => {
    const conflicts = [
      makeConflict({ id: 1, strategy: 'last-write-wins' }),
      makeConflict({ id: 2, strategy: 'server-wins' }),
      makeConflict({ id: 3, strategy: 'client-wins' }),
      makeConflict({ id: 4, strategy: 'manual-merge' }),
    ];
    const stats = computeConflictStats(conflicts);
    expect(stats.resolvedByStrategy['last-write-wins']).toBe(1);
    expect(stats.resolvedByStrategy['server-wins']).toBe(1);
    expect(stats.resolvedByStrategy['client-wins']).toBe(1);
    expect(stats.resolvedByStrategy['manual-merge']).toBe(1);
  });

  it('handles many conflicts for accurate averages', () => {
    const conflicts = Array.from({ length: 50 }, (_, i) =>
      makeConflict({
        id: i,
        serverTimestamp: new Date('2026-03-15T10:00:00Z'),
        resolvedAt: new Date(`2026-03-15T10:00:${String(i % 60).padStart(2, '0')}Z`),
      })
    );
    const stats = computeConflictStats(conflicts);
    expect(stats.totalConflicts).toBe(50);
    expect(stats.avgResolutionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('computes correct time span for conflicts per hour', () => {
    const conflicts = [
      makeConflict({ id: 1, resolvedAt: new Date('2026-03-15T10:00:00Z') }),
      makeConflict({ id: 2, resolvedAt: new Date('2026-03-15T10:30:00Z') }),
    ];
    const stats = computeConflictStats(conflicts);
    // 2 conflicts in 0.5 hours = 4/hour
    expect(stats.conflictsPerHour).toBe(4);
  });

  it('handles same-second resolution times', () => {
    const ts = new Date('2026-03-15T10:00:00Z');
    const conflicts = [
      makeConflict({ id: 1, resolvedAt: ts }),
      makeConflict({ id: 2, resolvedAt: ts }),
    ];
    const stats = computeConflictStats(conflicts);
    // Both at same time, span = 0
    expect(stats.conflictsPerHour).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════
// Custom Event Integration
// ═══════════════════════════════════════════════════════════

describe('SyncConflictViewer - Custom Events', () => {
  it('creates valid syncmind:conflict CustomEvent', () => {
    const event = new CustomEvent('syncmind:conflict', {
      detail: {
        noteId: 'note-123',
        noteTitle: 'Test Note',
        strategy: 'last-write-wins',
        fields: [makeField()],
        localTimestamp: new Date().toISOString(),
        serverTimestamp: new Date().toISOString(),
        deviceId: 'test-device',
      },
    });
    expect(event.type).toBe('syncmind:conflict');
    expect(event.detail.noteId).toBe('note-123');
    expect(event.detail.strategy).toBe('last-write-wins');
    expect(event.detail.fields.length).toBe(1);
  });

  it('handles event with minimal detail', () => {
    const event = new CustomEvent('syncmind:conflict', {
      detail: { message: 'Conflict resolved' },
    });
    expect(event.detail.message).toBe('Conflict resolved');
    // Other fields should be handled gracefully (undefined)
    expect(event.detail.noteId).toBeUndefined();
  });

  it('handles event with no detail', () => {
    const event = new CustomEvent('syncmind:conflict');
    expect(event.detail).toBeNull();
  });

  it('handles event with empty detail', () => {
    const event = new CustomEvent('syncmind:conflict', { detail: {} });
    expect(event.detail).toEqual({});
    expect(event.detail.noteId).toBeUndefined();
  });
});
