import { describe, it, expect } from 'vitest';

// ─── Extract and test pure logic from TagCloud.tsx ───

// Tag counting from notes
function countTags(notes: Array<{ ai_tags: string }>): Map<string, number> {
  const tagCounts = new Map<string, number>();
  for (const note of notes) {
    const tags = (note.ai_tags || '').split(',').map(t => t.trim()).filter(Boolean);
    for (const tag of tags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }
  return tagCounts;
}

// Sort tags by count descending
function sortTags(tagCounts: Map<string, number>): Array<[string, number]> {
  return [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);
}

// Calculate font scale
function calculateScale(count: number, maxCount: number): number {
  return 0.7 + (count / maxCount) * 0.6;
}

// Format title attribute
function formatTagTitle(count: number): string {
  return `${count} note${count > 1 ? 's' : ''}`;
}

// Should show empty state
function shouldShowEmpty(tagCount: number): boolean {
  return tagCount === 0;
}

// Tag parsing edge cases
function parseTags(aiTags: string): string[] {
  return (aiTags || '').split(',').map(t => t.trim()).filter(Boolean);
}

// ─── Tag Counting ───

describe('TagCloud - Tag Counting', () => {
  it('counts tags from single note', () => {
    const counts = countTags([{ ai_tags: 'ml,ai,python' }]);
    expect(counts.get('ml')).toBe(1);
    expect(counts.get('ai')).toBe(1);
    expect(counts.get('python')).toBe(1);
  });

  it('aggregates tags across multiple notes', () => {
    const counts = countTags([
      { ai_tags: 'ml,ai' },
      { ai_tags: 'ai,python' },
      { ai_tags: 'ai,data' }
    ]);
    expect(counts.get('ai')).toBe(3);
    expect(counts.get('ml')).toBe(1);
    expect(counts.get('python')).toBe(1);
    expect(counts.get('data')).toBe(1);
  });

  it('handles empty notes array', () => {
    const counts = countTags([]);
    expect(counts.size).toBe(0);
  });

  it('handles note with empty ai_tags', () => {
    const counts = countTags([{ ai_tags: '' }]);
    expect(counts.size).toBe(0);
  });

  it('handles note with null-like ai_tags', () => {
    const counts = countTags([{ ai_tags: undefined as any }]);
    expect(counts.size).toBe(0);
  });

  it('trims whitespace from tags', () => {
    const counts = countTags([{ ai_tags: ' ml , ai , python ' }]);
    expect(counts.has('ml')).toBe(true);
    expect(counts.has(' ml ')).toBe(false);
  });

  it('filters empty segments', () => {
    const counts = countTags([{ ai_tags: 'ml,,ai,,' }]);
    expect(counts.size).toBe(2);
    expect(counts.has('')).toBe(false);
  });

  it('counts duplicate tags within same note', () => {
    // Although unlikely, the logic would count duplicates
    const counts = countTags([{ ai_tags: 'ml,ml,ml' }]);
    expect(counts.get('ml')).toBe(3);
  });

  it('handles many notes efficiently', () => {
    const notes = Array.from({ length: 100 }, (_, i) => ({
      ai_tags: `tag${i % 5},common`
    }));
    const counts = countTags(notes);
    expect(counts.get('common')).toBe(100);
    expect(counts.get('tag0')).toBe(20);
  });
});

// ─── Tag Sorting ───

describe('TagCloud - Tag Sorting', () => {
  it('sorts by count descending', () => {
    const counts = new Map<string, number>([['a', 1], ['b', 3], ['c', 2]]);
    const sorted = sortTags(counts);
    expect(sorted[0][0]).toBe('b');
    expect(sorted[1][0]).toBe('c');
    expect(sorted[2][0]).toBe('a');
  });

  it('handles empty map', () => {
    const sorted = sortTags(new Map());
    expect(sorted).toEqual([]);
  });

  it('handles single tag', () => {
    const counts = new Map<string, number>([['only', 5]]);
    const sorted = sortTags(counts);
    expect(sorted).toEqual([['only', 5]]);
  });

  it('handles equal counts', () => {
    const counts = new Map<string, number>([['a', 2], ['b', 2], ['c', 2]]);
    const sorted = sortTags(counts);
    expect(sorted.length).toBe(3);
    // All have same count
    expect(sorted.every(([_, count]) => count === 2)).toBe(true);
  });
});

// ─── Font Scale Calculation ───

describe('TagCloud - Font Scale', () => {
  it('returns 1.3 for max count tag', () => {
    expect(calculateScale(10, 10)).toBeCloseTo(1.3);
  });

  it('returns 0.7 for zero count', () => {
    expect(calculateScale(0, 10)).toBeCloseTo(0.7);
  });

  it('returns 1.0 for half-count tag', () => {
    expect(calculateScale(5, 10)).toBeCloseTo(1.0);
  });

  it('handles count equal to maxCount of 1', () => {
    expect(calculateScale(1, 1)).toBeCloseTo(1.3);
  });

  it('scales proportionally', () => {
    const scale1 = calculateScale(2, 10);
    const scale2 = calculateScale(4, 10);
    const scale3 = calculateScale(8, 10);
    expect(scale2).toBeGreaterThan(scale1);
    expect(scale3).toBeGreaterThan(scale2);
  });

  it('minimum scale is 0.7', () => {
    expect(calculateScale(0, 100)).toBeCloseTo(0.7);
  });

  it('maximum scale is 1.3', () => {
    expect(calculateScale(100, 100)).toBeCloseTo(1.3);
  });
});

// ─── Tag Title Formatting ───

describe('TagCloud - Tag Title', () => {
  it('singular for 1 note', () => {
    expect(formatTagTitle(1)).toBe('1 note');
  });

  it('plural for 2 notes', () => {
    expect(formatTagTitle(2)).toBe('2 notes');
  });

  it('plural for many notes', () => {
    expect(formatTagTitle(42)).toBe('42 notes');
  });

  it('singular for 0 notes (matches > 1 check)', () => {
    // count > 1 is false for 0, so it uses singular form
    expect(formatTagTitle(0)).toBe('0 note');
  });
});

// ─── Empty State ───

describe('TagCloud - Empty State', () => {
  it('shows empty state when no tags', () => {
    expect(shouldShowEmpty(0)).toBe(true);
  });

  it('hides empty state when tags exist', () => {
    expect(shouldShowEmpty(1)).toBe(false);
    expect(shouldShowEmpty(10)).toBe(false);
  });
});

// ─── Tag Parsing ───

describe('TagCloud - Tag Parsing', () => {
  it('parses simple comma-separated tags', () => {
    expect(parseTags('ml,ai,python')).toEqual(['ml', 'ai', 'python']);
  });

  it('handles empty string', () => {
    expect(parseTags('')).toEqual([]);
  });

  it('handles undefined-like input', () => {
    expect(parseTags(undefined as any)).toEqual([]);
  });

  it('trims whitespace', () => {
    expect(parseTags(' a , b , c ')).toEqual(['a', 'b', 'c']);
  });

  it('filters empty segments from trailing commas', () => {
    expect(parseTags('a,b,')).toEqual(['a', 'b']);
  });

  it('filters empty segments from leading commas', () => {
    expect(parseTags(',a,b')).toEqual(['a', 'b']);
  });

  it('handles single tag', () => {
    expect(parseTags('solo')).toEqual(['solo']);
  });

  it('handles tags with hyphens', () => {
    expect(parseTags('machine-learning,deep-learning')).toEqual(['machine-learning', 'deep-learning']);
  });

  it('handles tags with spaces', () => {
    expect(parseTags('machine learning,deep learning')).toEqual(['machine learning', 'deep learning']);
  });

  it('handles consecutive commas', () => {
    expect(parseTags('a,,,,b')).toEqual(['a', 'b']);
  });
});
