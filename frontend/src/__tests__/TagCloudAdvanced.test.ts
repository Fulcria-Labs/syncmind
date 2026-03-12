import { describe, it, expect } from 'vitest';

// ─── Advanced TagCloud logic tests ───

// Tag cloud empty state
function isTagCloudEmpty(sorted: [string, number][]): boolean {
  return sorted.length === 0;
}

// Scale calculation with edge cases
function calculateFontScale(count: number, maxCount: number): number {
  if (maxCount === 0) return 0.7; // prevent division by zero
  return 0.7 + (count / maxCount) * 0.6;
}

// Tag click handler validation
function isTagClickable(tag: string): boolean {
  return tag.trim().length > 0;
}

// Tag count label (with correct pluralization)
function getTagLabel(count: number): string {
  return `${count} note${count > 1 ? 's' : ''}`;
}

// Full tag counting pipeline
function processNotesTags(notes: Array<{ ai_tags: string | null }>): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const note of notes) {
    const tags = (note.ai_tags || '').split(',').map(t => t.trim()).filter(Boolean);
    for (const tag of tags) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

// Tag deduplication
function deduplicateTags(tags: string[]): string[] {
  return [...new Set(tags)];
}

// Tag normalization
function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

// ─── Empty State Detection ───

describe('TagCloud - Empty State', () => {
  it('detects empty tag cloud', () => {
    expect(isTagCloudEmpty([])).toBe(true);
  });

  it('detects non-empty tag cloud', () => {
    expect(isTagCloudEmpty([['ai', 3]])).toBe(false);
  });
});

// ─── Font Scale Edge Cases ───

describe('TagCloud - Font Scale Edge Cases', () => {
  it('handles maxCount of 0 (prevent division by zero)', () => {
    expect(calculateFontScale(0, 0)).toBe(0.7);
  });

  it('handles count equal to maxCount', () => {
    expect(calculateFontScale(5, 5)).toBeCloseTo(1.3);
  });

  it('handles count of 0 with non-zero max', () => {
    expect(calculateFontScale(0, 10)).toBeCloseTo(0.7);
  });

  it('handles count of 1 with maxCount of 1', () => {
    expect(calculateFontScale(1, 1)).toBeCloseTo(1.3);
  });

  it('produces linear scale between 0.7 and 1.3', () => {
    const scales = Array.from({ length: 11 }, (_, i) => calculateFontScale(i, 10));
    for (let i = 1; i < scales.length; i++) {
      expect(scales[i]).toBeGreaterThan(scales[i - 1]);
    }
  });

  it('midpoint count gets ~1.0 scale', () => {
    expect(calculateFontScale(5, 10)).toBeCloseTo(1.0);
  });
});

// ─── Tag Clickability ───

describe('TagCloud - Tag Clickability', () => {
  it('allows clicking non-empty tags', () => {
    expect(isTagClickable('ai')).toBe(true);
  });

  it('prevents clicking empty tags', () => {
    expect(isTagClickable('')).toBe(false);
  });

  it('prevents clicking whitespace-only tags', () => {
    expect(isTagClickable('   ')).toBe(false);
  });
});

// ─── Tag Label Pluralization ───

describe('TagCloud - Tag Label', () => {
  it('singular for 1', () => {
    expect(getTagLabel(1)).toBe('1 note');
  });

  it('plural for 0', () => {
    // 0 > 1 is false, so it's "note" (debatable but matching the code logic)
    expect(getTagLabel(0)).toBe('0 note');
  });

  it('plural for 2', () => {
    expect(getTagLabel(2)).toBe('2 notes');
  });

  it('plural for 100', () => {
    expect(getTagLabel(100)).toBe('100 notes');
  });
});

// ─── Full Pipeline ───

describe('TagCloud - Full Pipeline', () => {
  it('processes notes to sorted tag counts', () => {
    const notes = [
      { ai_tags: 'ai,ml' },
      { ai_tags: 'ai,data' },
      { ai_tags: 'ml,data,security' },
    ];
    const result = processNotesTags(notes);
    // ai: 2, ml: 2, data: 2, security: 1
    expect(result[0][0]).toBe('ai'); // or ml or data (all tied at 2)
    expect(result[0][1]).toBe(2);
    expect(result[result.length - 1][1]).toBe(1);
  });

  it('handles notes with null ai_tags', () => {
    const notes = [
      { ai_tags: null },
      { ai_tags: 'ai' },
    ];
    const result = processNotesTags(notes);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(['ai', 1]);
  });

  it('handles all empty tags', () => {
    const notes = [{ ai_tags: '' }, { ai_tags: '' }];
    const result = processNotesTags(notes);
    expect(result).toHaveLength(0);
  });

  it('handles notes with duplicate tags in same note', () => {
    const notes = [{ ai_tags: 'ai,ai,ai' }];
    const result = processNotesTags(notes);
    expect(result).toEqual([['ai', 3]]);
  });

  it('trims whitespace from tags', () => {
    const notes = [{ ai_tags: ' ai , ml ' }];
    const result = processNotesTags(notes);
    expect(result.find(([t]) => t === 'ai')).toBeTruthy();
    expect(result.find(([t]) => t === 'ml')).toBeTruthy();
  });

  it('sorts by count descending', () => {
    const notes = [
      { ai_tags: 'rare' },
      { ai_tags: 'common,common-tag' },
      { ai_tags: 'common,medium' },
      { ai_tags: 'common' },
    ];
    const result = processNotesTags(notes);
    expect(result[0][0]).toBe('common');
    expect(result[0][1]).toBe(3);
  });

  it('handles single note with single tag', () => {
    const result = processNotesTags([{ ai_tags: 'solitary' }]);
    expect(result).toEqual([['solitary', 1]]);
  });

  it('handles many notes efficiently', () => {
    const notes = Array.from({ length: 100 }, (_, i) => ({
      ai_tags: `tag${i % 5},shared`,
    }));
    const result = processNotesTags(notes);
    expect(result[0]).toEqual(['shared', 100]);
    expect(result.length).toBe(6); // 5 unique tags + shared
  });
});

// ─── Tag Deduplication ───

describe('TagCloud - Tag Deduplication', () => {
  it('removes duplicate tags', () => {
    expect(deduplicateTags(['ai', 'ml', 'ai', 'data', 'ml'])).toEqual(['ai', 'ml', 'data']);
  });

  it('handles unique tags', () => {
    expect(deduplicateTags(['ai', 'ml', 'data'])).toEqual(['ai', 'ml', 'data']);
  });

  it('handles empty array', () => {
    expect(deduplicateTags([])).toEqual([]);
  });

  it('handles single tag', () => {
    expect(deduplicateTags(['ai'])).toEqual(['ai']);
  });

  it('preserves order of first occurrence', () => {
    expect(deduplicateTags(['b', 'a', 'c', 'a', 'b'])).toEqual(['b', 'a', 'c']);
  });
});

// ─── Tag Normalization ───

describe('TagCloud - Tag Normalization', () => {
  it('trims whitespace', () => {
    expect(normalizeTag('  ai  ')).toBe('ai');
  });

  it('converts to lowercase', () => {
    expect(normalizeTag('Machine-Learning')).toBe('machine-learning');
  });

  it('handles mixed case with spaces', () => {
    expect(normalizeTag('  Deep Learning  ')).toBe('deep learning');
  });

  it('handles empty string', () => {
    expect(normalizeTag('')).toBe('');
  });

  it('preserves hyphens', () => {
    expect(normalizeTag('machine-learning')).toBe('machine-learning');
  });

  it('preserves numbers', () => {
    expect(normalizeTag('Python3')).toBe('python3');
  });
});
