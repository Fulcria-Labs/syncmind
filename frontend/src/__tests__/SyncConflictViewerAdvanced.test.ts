import { describe, it, expect, vi } from 'vitest';

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

// ─── Helpers ───

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

// ═══════════════════════════════════════════════════════════
// formatResolutionTime - Boundary Cases
// ═══════════════════════════════════════════════════════════

describe('formatResolutionTime - Boundaries', () => {
  it('boundary: 999ms (last ms before seconds)', () => {
    expect(formatResolutionTime(999)).toBe('999ms');
  });

  it('boundary: 1000ms (first second)', () => {
    expect(formatResolutionTime(1000)).toBe('1.0s');
  });

  it('boundary: 59999ms (last ms before minutes)', () => {
    expect(formatResolutionTime(59999)).toBe('60.0s');
  });

  it('boundary: 60000ms (first minute)', () => {
    expect(formatResolutionTime(60000)).toBe('1m 0s');
  });

  it('handles very large values', () => {
    expect(formatResolutionTime(3600000)).toBe('60m 0s');
    expect(formatResolutionTime(7200000)).toBe('120m 0s');
  });

  it('handles decimal precision in seconds', () => {
    expect(formatResolutionTime(1100)).toBe('1.1s');
    expect(formatResolutionTime(2500)).toBe('2.5s');
    expect(formatResolutionTime(10300)).toBe('10.3s');
  });
});

// ═══════════════════════════════════════════════════════════
// truncateText - Advanced Cases
// ═══════════════════════════════════════════════════════════

describe('truncateText - Advanced', () => {
  it('handles multiline text', () => {
    const text = 'line 1\nline 2\nline 3';
    const result = truncateText(text, 10);
    expect(result.length).toBe(10);
  });

  it('handles tab characters', () => {
    const text = 'col1\tcol2\tcol3';
    const result = truncateText(text, 8);
    expect(result.length).toBe(8);
  });

  it('preserves text under limit exactly', () => {
    expect(truncateText('abc', 3)).toBe('abc');
    expect(truncateText('ab', 3)).toBe('ab');
    expect(truncateText('a', 3)).toBe('a');
  });

  it('truncates with ellipsis for text over limit', () => {
    expect(truncateText('abcd', 3)).toBe('...');
    expect(truncateText('abcde', 4)).toBe('a...');
    expect(truncateText('abcdef', 5)).toBe('ab...');
  });

  it('handles large maxLength with short text', () => {
    expect(truncateText('hi', 1000)).toBe('hi');
  });
});

// ═══════════════════════════════════════════════════════════
// formatRelativeTime - Edge Cases
// ═══════════════════════════════════════════════════════════

describe('formatRelativeTime - Edge Cases', () => {
  const now = new Date('2026-03-15T12:00:00Z');

  it('handles exactly 23h 59m 59s (last second before day)', () => {
    const date = new Date(now.getTime() - (23 * 3600 + 59 * 60 + 59) * 1000);
    expect(formatRelativeTime(date, now)).toBe('23h ago');
  });

  it('handles multi-day ranges', () => {
    const date = new Date(now.getTime() - 7 * 86400 * 1000);
    expect(formatRelativeTime(date, now)).toBe('7d ago');
  });

  it('handles 30 days ago', () => {
    const date = new Date(now.getTime() - 30 * 86400 * 1000);
    expect(formatRelativeTime(date, now)).toBe('30d ago');
  });

  it('uses floor for partial minutes', () => {
    // 2 minutes 30 seconds = should show 2m
    const date = new Date(now.getTime() - (2 * 60 + 30) * 1000);
    expect(formatRelativeTime(date, now)).toBe('2m ago');
  });

  it('uses floor for partial hours', () => {
    // 2 hours 45 minutes = should show 2h
    const date = new Date(now.getTime() - (2 * 3600 + 45 * 60) * 1000);
    expect(formatRelativeTime(date, now)).toBe('2h ago');
  });
});

// ═══════════════════════════════════════════════════════════
// computeFieldDiff - Additional Scenarios
// ═══════════════════════════════════════════════════════════

describe('computeFieldDiff - Additional', () => {
  it('handles JSON-like content differences', () => {
    const result = computeFieldDiff(
      '{"tags": ["ai", "ml"]}',
      '{"tags": ["ai", "dl"]}'
    );
    expect(result.hasConflict).toBe(true);
    expect(result.changeType).toBe('modified');
  });

  it('handles markdown content differences', () => {
    const result = computeFieldDiff(
      '# Title\n\nSome content',
      '# Title\n\nDifferent content'
    );
    expect(result.hasConflict).toBe(true);
  });

  it('handles HTML content differences', () => {
    const result = computeFieldDiff(
      '<p>Local paragraph</p>',
      '<p>Server paragraph</p>'
    );
    expect(result.hasConflict).toBe(true);
  });

  it('handles numeric strings', () => {
    const result = computeFieldDiff('42', '43');
    expect(result.hasConflict).toBe(true);
    expect(result.changeType).toBe('modified');
  });

  it('handles timestamp string differences', () => {
    const result = computeFieldDiff(
      '2026-03-15T10:00:00Z',
      '2026-03-15T10:00:01Z'
    );
    expect(result.hasConflict).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// groupConflictsByNote - Complex Scenarios
// ═══════════════════════════════════════════════════════════

describe('groupConflictsByNote - Complex', () => {
  it('handles conflicts with UUID noteIds', () => {
    const conflicts = [
      makeConflict({ id: 1, noteId: '550e8400-e29b-41d4-a716-446655440000' }),
      makeConflict({ id: 2, noteId: '550e8400-e29b-41d4-a716-446655440001' }),
      makeConflict({ id: 3, noteId: '550e8400-e29b-41d4-a716-446655440000' }),
    ];
    const grouped = groupConflictsByNote(conflicts);
    expect(grouped.size).toBe(2);
  });

  it('maintains chronological order within groups', () => {
    const conflicts = [
      makeConflict({ id: 1, noteId: 'note-A', resolvedAt: new Date('2026-03-15T10:00:00Z') }),
      makeConflict({ id: 2, noteId: 'note-A', resolvedAt: new Date('2026-03-15T11:00:00Z') }),
      makeConflict({ id: 3, noteId: 'note-A', resolvedAt: new Date('2026-03-15T12:00:00Z') }),
    ];
    const grouped = groupConflictsByNote(conflicts);
    const noteA = grouped.get('note-A')!;
    expect(noteA[0].id).toBe(1);
    expect(noteA[2].id).toBe(3);
  });

  it('handles 100 unique notes', () => {
    const conflicts = Array.from({ length: 100 }, (_, i) =>
      makeConflict({ id: i, noteId: `note-${i}` })
    );
    const grouped = groupConflictsByNote(conflicts);
    expect(grouped.size).toBe(100);
  });
});

// ═══════════════════════════════════════════════════════════
// computeConflictStats - Stress & Edge
// ═══════════════════════════════════════════════════════════

describe('computeConflictStats - Stress', () => {
  it('handles 1000 conflicts efficiently', () => {
    const conflicts = Array.from({ length: 1000 }, (_, i) =>
      makeConflict({
        id: i,
        strategy: (['last-write-wins', 'server-wins', 'client-wins', 'manual-merge'] as ResolutionStrategy[])[i % 4],
        resolvedAt: new Date('2026-03-15T10:00:00Z'),
        serverTimestamp: new Date('2026-03-15T09:59:00Z'),
      })
    );
    const stats = computeConflictStats(conflicts);
    expect(stats.totalConflicts).toBe(1000);
    expect(stats.resolvedByStrategy['last-write-wins']).toBe(250);
    expect(stats.resolvedByStrategy['server-wins']).toBe(250);
    expect(stats.resolvedByStrategy['client-wins']).toBe(250);
    expect(stats.resolvedByStrategy['manual-merge']).toBe(250);
  });

  it('computes correct average for varied resolution times', () => {
    const conflicts = [
      makeConflict({
        id: 1,
        serverTimestamp: new Date('2026-03-15T10:00:00Z'),
        resolvedAt: new Date('2026-03-15T10:00:01Z'), // 1s
      }),
      makeConflict({
        id: 2,
        serverTimestamp: new Date('2026-03-15T10:00:00Z'),
        resolvedAt: new Date('2026-03-15T10:00:03Z'), // 3s
      }),
      makeConflict({
        id: 3,
        serverTimestamp: new Date('2026-03-15T10:00:00Z'),
        resolvedAt: new Date('2026-03-15T10:00:05Z'), // 5s
      }),
    ];
    const stats = computeConflictStats(conflicts);
    expect(stats.avgResolutionTimeMs).toBe(3000); // (1+3+5)/3 = 3s
  });

  it('identifies correct last conflict from unordered list', () => {
    const conflicts = [
      makeConflict({ id: 1, resolvedAt: new Date('2026-03-15T08:00:00Z') }),
      makeConflict({ id: 2, resolvedAt: new Date('2026-03-15T14:00:00Z') }),
      makeConflict({ id: 3, resolvedAt: new Date('2026-03-15T10:00:00Z') }),
      makeConflict({ id: 4, resolvedAt: new Date('2026-03-15T06:00:00Z') }),
    ];
    const stats = computeConflictStats(conflicts);
    expect(stats.lastConflictAt!.getTime()).toBe(new Date('2026-03-15T14:00:00Z').getTime());
  });
});

// ═══════════════════════════════════════════════════════════
// Strategy combinations and transitions
// ═══════════════════════════════════════════════════════════

describe('Strategy Transitions', () => {
  it('all strategy labels are title case', () => {
    const strategies: ResolutionStrategy[] = ['last-write-wins', 'server-wins', 'client-wins', 'manual-merge'];
    for (const s of strategies) {
      const label = getStrategyLabel(s);
      const words = label.split(' ');
      for (const word of words) {
        expect(word[0]).toBe(word[0].toUpperCase());
      }
    }
  });

  it('all strategy descriptions end with a period', () => {
    const strategies: ResolutionStrategy[] = ['last-write-wins', 'server-wins', 'client-wins', 'manual-merge'];
    for (const s of strategies) {
      const desc = getStrategyDescription(s);
      expect(desc.endsWith('.')).toBe(true);
    }
  });

  it('strategy icons are all single-character-ish unicode', () => {
    const strategies: ResolutionStrategy[] = ['last-write-wins', 'server-wins', 'client-wins', 'manual-merge'];
    for (const s of strategies) {
      const icon = getStrategyIcon(s);
      // Unicode chars can be 1 or 2 code units
      expect(icon.length).toBeLessThanOrEqual(2);
    }
  });
});

// ═══════════════════════════════════════════════════════════
// Severity thresholds
// ═══════════════════════════════════════════════════════════

describe('Severity Thresholds', () => {
  it('boundary: 1 field = low', () => {
    expect(getConflictSeverity(1)).toBe('low');
  });

  it('boundary: 2 fields = medium', () => {
    expect(getConflictSeverity(2)).toBe('medium');
  });

  it('boundary: 3 fields = medium', () => {
    expect(getConflictSeverity(3)).toBe('medium');
  });

  it('boundary: 4 fields = high', () => {
    expect(getConflictSeverity(4)).toBe('high');
  });

  it('severity escalates monotonically', () => {
    const order = { low: 0, medium: 1, high: 2 };
    for (let i = 0; i < 10; i++) {
      for (let j = i; j < 10; j++) {
        const si = getConflictSeverity(i);
        const sj = getConflictSeverity(j);
        expect(order[si]).toBeLessThanOrEqual(order[sj]);
      }
    }
  });

  it('severity colors escalate from green to amber to red', () => {
    // Green (#10b981) -> amber (#f59e0b) -> red (#ef4444)
    const greenVal = parseInt('10b981', 16);
    const amberVal = parseInt('f59e0b', 16);
    const redVal = parseInt('ef4444', 16);

    expect(getSeverityColor('low')).toBe('#10b981');
    expect(getSeverityColor('medium')).toBe('#f59e0b');
    expect(getSeverityColor('high')).toBe('#ef4444');
  });
});

// ═══════════════════════════════════════════════════════════
// Conflict patterns (real-world scenarios)
// ═══════════════════════════════════════════════════════════

describe('Real-World Conflict Scenarios', () => {
  it('scenario: two users edit title simultaneously', () => {
    const conflict = makeConflict({
      noteTitle: 'AI Research',
      strategy: 'last-write-wins',
      fields: [
        {
          field: 'title',
          localValue: 'AI Research - Updated by Alice',
          serverValue: 'AI Research - Updated by Bob',
          resolvedValue: 'AI Research - Updated by Bob',
        },
      ],
    });
    expect(conflict.fields[0].resolvedValue).toBe('AI Research - Updated by Bob');
    expect(getConflictSeverity(conflict.fields.length)).toBe('low');
  });

  it('scenario: offline user creates tags that conflict with server', () => {
    const conflict = makeConflict({
      strategy: 'server-wins',
      fields: [
        {
          field: 'tags',
          localValue: 'ai, machine-learning, offline-tag',
          serverValue: 'ai, deep-learning, online-tag',
          resolvedValue: 'ai, deep-learning, online-tag',
        },
      ],
    });
    const diff = computeFieldDiff(
      conflict.fields[0].localValue,
      conflict.fields[0].serverValue
    );
    expect(diff.hasConflict).toBe(true);
  });

  it('scenario: AI processing updates collide with manual edits', () => {
    const conflict = makeConflict({
      strategy: 'manual-merge',
      fields: [
        {
          field: 'ai_summary',
          localValue: 'User wrote a manual summary',
          serverValue: 'AI-generated summary of the paper',
          resolvedValue: 'User wrote a manual summary (AI suggests: AI-generated summary of the paper)',
        },
        {
          field: 'ai_tags',
          localValue: 'user-tag-1, user-tag-2',
          serverValue: 'ai-tag-1, ai-tag-2, ai-tag-3',
          resolvedValue: 'user-tag-1, user-tag-2, ai-tag-1, ai-tag-2, ai-tag-3',
        },
      ],
    });
    expect(conflict.fields.length).toBe(2);
    expect(getConflictSeverity(conflict.fields.length)).toBe('medium');
  });

  it('scenario: full note rewrite on different devices', () => {
    const conflict = makeConflict({
      strategy: 'last-write-wins',
      fields: [
        { field: 'title', localValue: 'Local Title', serverValue: 'Server Title', resolvedValue: 'Server Title' },
        { field: 'content', localValue: 'Local Body', serverValue: 'Server Body', resolvedValue: 'Server Body' },
        { field: 'tags', localValue: 'local', serverValue: 'server', resolvedValue: 'server' },
        { field: 'ai_summary', localValue: 'Local AI', serverValue: 'Server AI', resolvedValue: 'Server AI' },
        { field: 'source_url', localValue: 'http://local', serverValue: 'http://server', resolvedValue: 'http://server' },
      ],
    });
    expect(conflict.fields.length).toBe(5);
    expect(getConflictSeverity(conflict.fields.length)).toBe('high');

    // All resolved to server values in LWW
    for (const f of conflict.fields) {
      expect(f.resolvedValue).toBe(f.serverValue);
    }
  });

  it('scenario: connection drops during sync', () => {
    const conflict = makeConflict({
      strategy: 'last-write-wins',
      deviceId: 'offline-chrome',
      localTimestamp: new Date('2026-03-15T08:00:00Z'),
      serverTimestamp: new Date('2026-03-15T12:00:00Z'),
      resolvedAt: new Date('2026-03-15T12:00:01Z'),
    });
    // 4-hour gap between local edit and server version
    const gap = conflict.serverTimestamp.getTime() - conflict.localTimestamp.getTime();
    expect(gap).toBe(4 * 3600 * 1000);
  });
});

// ═══════════════════════════════════════════════════════════
// Stats with mixed strategies
// ═══════════════════════════════════════════════════════════

describe('computeConflictStats - Mixed Strategies', () => {
  it('correctly distributes conflicts across strategies', () => {
    const strategies: ResolutionStrategy[] = ['last-write-wins', 'server-wins', 'client-wins', 'manual-merge'];
    const conflicts = strategies.flatMap((s, i) =>
      Array.from({ length: (i + 1) * 2 }, (_, j) =>
        makeConflict({
          id: i * 10 + j,
          strategy: s,
          resolvedAt: new Date(`2026-03-15T${10 + i}:${String(j).padStart(2, '0')}:00Z`),
          serverTimestamp: new Date('2026-03-15T09:00:00Z'),
        })
      )
    );

    const stats = computeConflictStats(conflicts);
    expect(stats.resolvedByStrategy['last-write-wins']).toBe(2);
    expect(stats.resolvedByStrategy['server-wins']).toBe(4);
    expect(stats.resolvedByStrategy['client-wins']).toBe(6);
    expect(stats.resolvedByStrategy['manual-merge']).toBe(8);
    expect(stats.totalConflicts).toBe(20);
  });
});

// ═══════════════════════════════════════════════════════════
// Field diff with special characters
// ═══════════════════════════════════════════════════════════

describe('computeFieldDiff - Special Characters', () => {
  it('handles newlines in field values', () => {
    const result = computeFieldDiff('line1\nline2', 'line1\nline3');
    expect(result.hasConflict).toBe(true);
  });

  it('handles escaped quotes', () => {
    const result = computeFieldDiff('He said "hello"', 'He said "goodbye"');
    expect(result.hasConflict).toBe(true);
  });

  it('handles backticks (markdown code)', () => {
    const result = computeFieldDiff('Use `useState`', 'Use `useEffect`');
    expect(result.hasConflict).toBe(true);
  });

  it('handles URLs', () => {
    const result = computeFieldDiff(
      'https://example.com/page1',
      'https://example.com/page2'
    );
    expect(result.hasConflict).toBe(true);
  });

  it('handles empty vs whitespace', () => {
    const result = computeFieldDiff('', ' ');
    expect(result.hasConflict).toBe(true);
    expect(result.changeType).toBe('added');
  });
});

// ═══════════════════════════════════════════════════════════
// Strategy consistency checks
// ═══════════════════════════════════════════════════════════

describe('Strategy Function Consistency', () => {
  const allStrategies: ResolutionStrategy[] = ['last-write-wins', 'server-wins', 'client-wins', 'manual-merge'];

  it('every strategy has a label', () => {
    for (const s of allStrategies) {
      expect(getStrategyLabel(s).length).toBeGreaterThan(0);
    }
  });

  it('every strategy has a description', () => {
    for (const s of allStrategies) {
      expect(getStrategyDescription(s).length).toBeGreaterThan(0);
    }
  });

  it('every strategy has a color', () => {
    for (const s of allStrategies) {
      expect(getStrategyColor(s)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('every strategy has an icon', () => {
    for (const s of allStrategies) {
      expect(getStrategyIcon(s).length).toBeGreaterThan(0);
    }
  });

  it('all labels are unique', () => {
    const labels = allStrategies.map(getStrategyLabel);
    expect(new Set(labels).size).toBe(allStrategies.length);
  });

  it('all colors are unique', () => {
    const colors = allStrategies.map(getStrategyColor);
    expect(new Set(colors).size).toBe(allStrategies.length);
  });

  it('all icons are unique', () => {
    const icons = allStrategies.map(getStrategyIcon);
    expect(new Set(icons).size).toBe(allStrategies.length);
  });
});
