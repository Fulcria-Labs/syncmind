import { describe, it, expect } from 'vitest';

// ─── Advanced NoteList logic tests ───

// Date formatting in note cards
function formatNoteDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return '';
  }
}

// Processing badge visibility
function shouldShowProcessingBadge(isProcessed: boolean | number): boolean {
  return !isProcessed;
}

// Search query normalization
function normalizeSearchQuery(query: string): string {
  return query.trim();
}

// LIKE pattern for SQL search
function buildLikePattern(query: string): string {
  return `%${query}%`;
}

// Sort order verification
function isSortedByDate(notes: Array<{ updated_at: string }>): boolean {
  for (let i = 1; i < notes.length; i++) {
    if (notes[i].updated_at > notes[i - 1].updated_at) return false;
  }
  return true;
}

// Preview generation
function generatePreview(note: { ai_summary?: string | null; content?: string | null }): { type: 'summary' | 'preview' | 'none'; text: string } {
  if (note.ai_summary) return { type: 'summary', text: note.ai_summary };
  if (note.content) return { type: 'preview', text: note.content.slice(0, 120) + '...' };
  return { type: 'none', text: '' };
}

// Note card class builder with all combinations
function buildCardClasses(noteId: string, selectedId: string | undefined, isProcessed: boolean | number): string[] {
  const classes = ['note-card'];
  if (noteId === selectedId) classes.push('selected');
  classes.push(isProcessed ? 'processed' : 'pending');
  return classes;
}

// ─── Date Formatting ───

describe('NoteList - Date Formatting', () => {
  it('formats ISO date string', () => {
    const result = formatNoteDate('2026-03-12T10:30:00Z');
    expect(result).toBeTruthy();
  });

  it('returns empty for null', () => {
    expect(formatNoteDate(null)).toBe('');
  });

  it('returns empty for undefined', () => {
    expect(formatNoteDate(undefined)).toBe('');
  });

  it('returns empty for empty string', () => {
    expect(formatNoteDate('')).toBe('');
  });

  it('handles date-only strings', () => {
    const result = formatNoteDate('2026-03-12');
    expect(result).toBeTruthy();
  });
});

// ─── Processing Badge ───

describe('NoteList - Processing Badge', () => {
  it('shows badge when not processed (false)', () => {
    expect(shouldShowProcessingBadge(false)).toBe(true);
  });

  it('shows badge when not processed (0)', () => {
    expect(shouldShowProcessingBadge(0)).toBe(true);
  });

  it('hides badge when processed (true)', () => {
    expect(shouldShowProcessingBadge(true)).toBe(false);
  });

  it('hides badge when processed (1)', () => {
    expect(shouldShowProcessingBadge(1)).toBe(false);
  });
});

// ─── Search Query Normalization ───

describe('NoteList - Search Query Normalization', () => {
  it('trims leading whitespace', () => {
    expect(normalizeSearchQuery('  hello')).toBe('hello');
  });

  it('trims trailing whitespace', () => {
    expect(normalizeSearchQuery('hello  ')).toBe('hello');
  });

  it('trims both sides', () => {
    expect(normalizeSearchQuery('  hello  ')).toBe('hello');
  });

  it('handles empty string', () => {
    expect(normalizeSearchQuery('')).toBe('');
  });

  it('handles whitespace only', () => {
    expect(normalizeSearchQuery('   ')).toBe('');
  });

  it('preserves internal whitespace', () => {
    expect(normalizeSearchQuery('machine learning')).toBe('machine learning');
  });
});

// ─── LIKE Pattern ───

describe('NoteList - LIKE Pattern', () => {
  it('wraps query with wildcards', () => {
    expect(buildLikePattern('machine')).toBe('%machine%');
  });

  it('handles multi-word queries', () => {
    expect(buildLikePattern('machine learning')).toBe('%machine learning%');
  });

  it('handles empty query', () => {
    expect(buildLikePattern('')).toBe('%%');
  });

  it('handles special SQL chars', () => {
    expect(buildLikePattern('test%')).toBe('%test%%');
  });
});

// ─── Sort Order ───

describe('NoteList - Sort Order', () => {
  it('identifies correctly sorted notes (descending)', () => {
    const notes = [
      { updated_at: '2026-03-12' },
      { updated_at: '2026-03-11' },
      { updated_at: '2026-03-10' },
    ];
    expect(isSortedByDate(notes)).toBe(true);
  });

  it('identifies incorrectly sorted notes', () => {
    const notes = [
      { updated_at: '2026-03-10' },
      { updated_at: '2026-03-12' },
      { updated_at: '2026-03-11' },
    ];
    expect(isSortedByDate(notes)).toBe(false);
  });

  it('handles single note', () => {
    expect(isSortedByDate([{ updated_at: '2026-03-12' }])).toBe(true);
  });

  it('handles empty array', () => {
    expect(isSortedByDate([])).toBe(true);
  });

  it('handles notes with same date', () => {
    const notes = [
      { updated_at: '2026-03-12' },
      { updated_at: '2026-03-12' },
    ];
    expect(isSortedByDate(notes)).toBe(true);
  });
});

// ─── Preview Generation ───

describe('NoteList - Preview Generation', () => {
  it('prefers AI summary', () => {
    const result = generatePreview({ ai_summary: 'Summary text', content: 'Content text' });
    expect(result.type).toBe('summary');
    expect(result.text).toBe('Summary text');
  });

  it('falls back to content preview', () => {
    const result = generatePreview({ content: 'Some content' });
    expect(result.type).toBe('preview');
    expect(result.text).toContain('Some content');
  });

  it('truncates content at 120 chars', () => {
    const longContent = 'A'.repeat(200);
    const result = generatePreview({ content: longContent });
    expect(result.text.length).toBe(123); // 120 + '...'
  });

  it('returns none for empty note', () => {
    const result = generatePreview({});
    expect(result.type).toBe('none');
    expect(result.text).toBe('');
  });

  it('returns none for null fields', () => {
    const result = generatePreview({ ai_summary: null, content: null });
    expect(result.type).toBe('none');
  });

  it('handles empty string summary', () => {
    const result = generatePreview({ ai_summary: '', content: 'Content' });
    // Empty string is falsy, so falls back to content
    expect(result.type).toBe('preview');
  });
});

// ─── Card Classes ───

describe('NoteList - Card Classes', () => {
  it('includes base class always', () => {
    const classes = buildCardClasses('n1', undefined, false);
    expect(classes).toContain('note-card');
  });

  it('adds selected when matching', () => {
    const classes = buildCardClasses('n1', 'n1', true);
    expect(classes).toContain('selected');
  });

  it('does not add selected when not matching', () => {
    const classes = buildCardClasses('n1', 'n2', true);
    expect(classes).not.toContain('selected');
  });

  it('adds processed for processed notes', () => {
    const classes = buildCardClasses('n1', undefined, true);
    expect(classes).toContain('processed');
    expect(classes).not.toContain('pending');
  });

  it('adds pending for unprocessed notes', () => {
    const classes = buildCardClasses('n1', undefined, false);
    expect(classes).toContain('pending');
    expect(classes).not.toContain('processed');
  });

  it('handles all states combined: selected + processed', () => {
    const classes = buildCardClasses('n1', 'n1', true);
    expect(classes).toContain('note-card');
    expect(classes).toContain('selected');
    expect(classes).toContain('processed');
  });

  it('handles all states combined: not selected + pending', () => {
    const classes = buildCardClasses('n1', 'n2', false);
    expect(classes).toContain('note-card');
    expect(classes).not.toContain('selected');
    expect(classes).toContain('pending');
  });

  it('treats truthy number as processed', () => {
    const classes = buildCardClasses('n1', undefined, 1);
    expect(classes).toContain('processed');
  });

  it('treats 0 as unprocessed', () => {
    const classes = buildCardClasses('n1', undefined, 0);
    expect(classes).toContain('pending');
  });
});
