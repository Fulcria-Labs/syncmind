import { describe, it, expect } from 'vitest';

// Extract and test pure logic from TagCloud.tsx

describe('TagCloud - Tag Counting', () => {
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

  it('should count tags from multiple notes', () => {
    const notes = [
      { ai_tags: 'ai,ml,deep-learning' },
      { ai_tags: 'ai,research,ml' },
      { ai_tags: 'data,research' },
    ];
    const counts = countTags(notes);
    expect(counts.get('ai')).toBe(2);
    expect(counts.get('ml')).toBe(2);
    expect(counts.get('research')).toBe(2);
    expect(counts.get('deep-learning')).toBe(1);
    expect(counts.get('data')).toBe(1);
  });

  it('should handle empty tags string', () => {
    const notes = [{ ai_tags: '' }];
    const counts = countTags(notes);
    expect(counts.size).toBe(0);
  });

  it('should handle null/undefined tags', () => {
    const notes = [{ ai_tags: null as unknown as string }];
    const counts = countTags(notes);
    expect(counts.size).toBe(0);
  });

  it('should trim whitespace from tags', () => {
    const notes = [{ ai_tags: ' ai , ml , data ' }];
    const counts = countTags(notes);
    expect(counts.has('ai')).toBe(true);
    expect(counts.has('ml')).toBe(true);
    expect(counts.has(' ai ')).toBe(false);
  });

  it('should ignore empty segments from trailing commas', () => {
    const notes = [{ ai_tags: 'ai,ml,' }];
    const counts = countTags(notes);
    expect(counts.size).toBe(2);
  });

  it('should handle single tag', () => {
    const notes = [{ ai_tags: 'ai' }];
    const counts = countTags(notes);
    expect(counts.get('ai')).toBe(1);
    expect(counts.size).toBe(1);
  });

  it('should handle many notes with same tags', () => {
    const notes = Array.from({ length: 20 }, () => ({ ai_tags: 'common' }));
    const counts = countTags(notes);
    expect(counts.get('common')).toBe(20);
  });
});

describe('TagCloud - Tag Sorting', () => {
  it('should sort by count descending', () => {
    const counts = new Map<string, number>();
    counts.set('rare', 1);
    counts.set('common', 10);
    counts.set('medium', 5);

    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    expect(sorted[0][0]).toBe('common');
    expect(sorted[1][0]).toBe('medium');
    expect(sorted[2][0]).toBe('rare');
  });

  it('should handle equal counts', () => {
    const counts = new Map<string, number>();
    counts.set('a', 3);
    counts.set('b', 3);
    counts.set('c', 3);

    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    expect(sorted).toHaveLength(3);
    // All have same count - order preserved from Map insertion
    expect(sorted.every(([, count]) => count === 3)).toBe(true);
  });
});

describe('TagCloud - Font Scaling', () => {
  function calculateScale(count: number, maxCount: number): number {
    return 0.7 + (count / maxCount) * 0.6;
  }

  it('should scale max count to 1.3rem', () => {
    expect(calculateScale(10, 10)).toBeCloseTo(1.3);
  });

  it('should scale min count (1) appropriately', () => {
    const scale = calculateScale(1, 10);
    expect(scale).toBeCloseTo(0.76);
    expect(scale).toBeGreaterThan(0.7);
  });

  it('should handle single-count situation (all equal)', () => {
    expect(calculateScale(5, 5)).toBeCloseTo(1.3);
  });

  it('should produce values between 0.7 and 1.3', () => {
    for (let count = 1; count <= 100; count++) {
      const scale = calculateScale(count, 100);
      expect(scale).toBeGreaterThanOrEqual(0.7);
      expect(scale).toBeLessThanOrEqual(1.3);
    }
  });

  it('should increase monotonically with count', () => {
    const maxCount = 10;
    let prev = 0;
    for (let c = 1; c <= maxCount; c++) {
      const scale = calculateScale(c, maxCount);
      expect(scale).toBeGreaterThan(prev);
      prev = scale;
    }
  });
});

describe('TagCloud - Title Tooltip', () => {
  function getTooltip(count: number): string {
    return `${count} note${count > 1 ? 's' : ''}`;
  }

  it('should pluralize for multiple notes', () => {
    expect(getTooltip(5)).toBe('5 notes');
  });

  it('should be singular for one note', () => {
    expect(getTooltip(1)).toBe('1 note');
  });

  it('should pluralize for two notes', () => {
    expect(getTooltip(2)).toBe('2 notes');
  });

  it('should handle large counts', () => {
    expect(getTooltip(1000)).toBe('1000 notes');
  });
});
