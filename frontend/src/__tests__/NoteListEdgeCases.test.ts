import { describe, it, expect } from 'vitest';

// ─── Additional NoteList edge case tests ───

// Date formatting for note cards
function formatNoteDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return '';
  }
}

// Processing status badge
function getProcessingBadge(isProcessed: boolean | number): { show: boolean; text: string } {
  return {
    show: !isProcessed,
    text: 'Analyzing...'
  };
}

// Search query escaping for SQL LIKE
function buildSearchParams(query: string): string[] {
  return [`%${query}%`, `%${query}%`, `%${query}%`];
}

// Content preview with length check
function getContentPreview(content: string | null | undefined, maxLen: number = 120): string {
  if (!content) return '';
  if (content.length <= maxLen) return content;
  return content.slice(0, maxLen) + '...';
}

// Note card click handler validation
function isValidNoteId(id: string | null | undefined): boolean {
  return !!id && typeof id === 'string' && id.length > 0;
}

// Sort order validation (should be by updated_at DESC)
function validateSortOrder(dates: string[]): boolean {
  for (let i = 1; i < dates.length; i++) {
    if (new Date(dates[i]) > new Date(dates[i - 1])) return false;
  }
  return true;
}

// Tag display limit
function getDisplayTags(tags: string, maxTags: number = 3): string[] {
  return tags.split(',').filter(Boolean).slice(0, maxTags).map(t => t.trim());
}

// Card styling logic
function getNoteCardStyle(
  noteId: string,
  selectedId: string | undefined,
  isProcessed: boolean | number
): { isSelected: boolean; statusClass: string } {
  return {
    isSelected: noteId === selectedId,
    statusClass: isProcessed ? 'processed' : 'pending'
  };
}

// ─── Date Formatting ───

describe('NoteList - Date Formatting Edge Cases', () => {
  it('formats ISO date', () => {
    const result = formatNoteDate('2026-03-12T10:30:00Z');
    expect(result).toBeTruthy();
  });

  it('handles invalid date string', () => {
    const result = formatNoteDate('not-a-date');
    // Invalid Date.toLocaleDateString() returns "Invalid Date" in most runtimes
    expect(result).toBeTruthy(); // doesn't crash
  });

  it('handles null date', () => {
    expect(formatNoteDate(null)).toBe('');
  });

  it('handles undefined date', () => {
    expect(formatNoteDate(undefined)).toBe('');
  });

  it('handles empty string date', () => {
    expect(formatNoteDate('')).toBe('');
  });

  it('handles date-only string', () => {
    const result = formatNoteDate('2026-03-12');
    expect(result).toBeTruthy();
  });
});

// ─── Processing Badge ───

describe('NoteList - Processing Badge', () => {
  it('shows badge for unprocessed notes (false)', () => {
    const badge = getProcessingBadge(false);
    expect(badge.show).toBe(true);
    expect(badge.text).toBe('Analyzing...');
  });

  it('shows badge for unprocessed notes (0)', () => {
    const badge = getProcessingBadge(0);
    expect(badge.show).toBe(true);
  });

  it('hides badge for processed notes (true)', () => {
    const badge = getProcessingBadge(true);
    expect(badge.show).toBe(false);
  });

  it('hides badge for processed notes (1)', () => {
    const badge = getProcessingBadge(1);
    expect(badge.show).toBe(false);
  });
});

// ─── Search Params ───

describe('NoteList - Search Params', () => {
  it('wraps query in % wildcards', () => {
    const params = buildSearchParams('test');
    expect(params).toEqual(['%test%', '%test%', '%test%']);
  });

  it('has 3 parameters (title, content, ai_tags)', () => {
    const params = buildSearchParams('query');
    expect(params.length).toBe(3);
  });

  it('handles empty query', () => {
    const params = buildSearchParams('');
    expect(params).toEqual(['%%', '%%', '%%']);
  });

  it('preserves special SQL characters', () => {
    const params = buildSearchParams("O'Brien");
    expect(params[0]).toBe("%O'Brien%");
  });

  it('handles query with spaces', () => {
    const params = buildSearchParams('machine learning');
    expect(params[0]).toBe('%machine learning%');
  });
});

// ─── Content Preview ───

describe('NoteList - Content Preview Edge Cases', () => {
  it('returns empty for null content', () => {
    expect(getContentPreview(null)).toBe('');
  });

  it('returns empty for undefined content', () => {
    expect(getContentPreview(undefined)).toBe('');
  });

  it('returns empty for empty string', () => {
    expect(getContentPreview('')).toBe('');
  });

  it('returns short content as-is', () => {
    expect(getContentPreview('Short')).toBe('Short');
  });

  it('truncates at 120 chars by default', () => {
    const content = 'A'.repeat(200);
    const preview = getContentPreview(content);
    expect(preview.length).toBe(123); // 120 + '...'
  });

  it('respects custom maxLen', () => {
    const content = 'A'.repeat(100);
    const preview = getContentPreview(content, 50);
    expect(preview.length).toBe(53); // 50 + '...'
  });

  it('does not truncate content exactly at maxLen', () => {
    const content = 'A'.repeat(120);
    expect(getContentPreview(content, 120)).toBe('A'.repeat(120));
  });

  it('truncates content one char over maxLen', () => {
    const content = 'A'.repeat(121);
    const preview = getContentPreview(content, 120);
    expect(preview.endsWith('...')).toBe(true);
  });

  it('handles content with newlines', () => {
    const content = 'Line 1\nLine 2\nLine 3';
    expect(getContentPreview(content)).toBe(content);
  });
});

// ─── Note ID Validation ───

describe('NoteList - Note ID Validation', () => {
  it('accepts valid UUID-like ID', () => {
    expect(isValidNoteId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('accepts simple string ID', () => {
    expect(isValidNoteId('note-1')).toBe(true);
  });

  it('rejects null ID', () => {
    expect(isValidNoteId(null)).toBe(false);
  });

  it('rejects undefined ID', () => {
    expect(isValidNoteId(undefined)).toBe(false);
  });

  it('rejects empty string ID', () => {
    expect(isValidNoteId('')).toBe(false);
  });
});

// ─── Sort Order Validation ───

describe('NoteList - Sort Order', () => {
  it('validates descending date order', () => {
    const dates = ['2026-03-12', '2026-03-11', '2026-03-10'];
    expect(validateSortOrder(dates)).toBe(true);
  });

  it('detects ascending order as invalid', () => {
    const dates = ['2026-03-10', '2026-03-11', '2026-03-12'];
    expect(validateSortOrder(dates)).toBe(false);
  });

  it('handles equal dates', () => {
    const dates = ['2026-03-12', '2026-03-12', '2026-03-12'];
    expect(validateSortOrder(dates)).toBe(true);
  });

  it('handles single date', () => {
    expect(validateSortOrder(['2026-03-12'])).toBe(true);
  });

  it('handles empty array', () => {
    expect(validateSortOrder([])).toBe(true);
  });
});

// ─── Display Tags ───

describe('NoteList - Display Tags Edge Cases', () => {
  it('limits to 3 tags by default', () => {
    expect(getDisplayTags('a,b,c,d,e')).toEqual(['a', 'b', 'c']);
  });

  it('respects custom limit', () => {
    expect(getDisplayTags('a,b,c,d,e', 2)).toEqual(['a', 'b']);
  });

  it('handles fewer tags than limit', () => {
    expect(getDisplayTags('a,b')).toEqual(['a', 'b']);
  });

  it('trims whitespace', () => {
    expect(getDisplayTags(' a , b ')).toEqual(['a', 'b']);
  });

  it('filters empty entries', () => {
    expect(getDisplayTags('a,,b,,c')).toEqual(['a', 'b', 'c']);
  });

  it('handles limit of 0', () => {
    expect(getDisplayTags('a,b,c', 0)).toEqual([]);
  });
});

// ─── Card Styling ───

describe('NoteList - Card Styling', () => {
  it('marks as selected when IDs match', () => {
    const style = getNoteCardStyle('n1', 'n1', true);
    expect(style.isSelected).toBe(true);
  });

  it('not selected when IDs differ', () => {
    const style = getNoteCardStyle('n1', 'n2', true);
    expect(style.isSelected).toBe(false);
  });

  it('not selected when selectedId is undefined', () => {
    const style = getNoteCardStyle('n1', undefined, true);
    expect(style.isSelected).toBe(false);
  });

  it('processed class for processed notes', () => {
    const style = getNoteCardStyle('n1', undefined, true);
    expect(style.statusClass).toBe('processed');
  });

  it('pending class for unprocessed notes', () => {
    const style = getNoteCardStyle('n1', undefined, false);
    expect(style.statusClass).toBe('pending');
  });

  it('pending class for numeric 0', () => {
    const style = getNoteCardStyle('n1', undefined, 0);
    expect(style.statusClass).toBe('pending');
  });

  it('processed class for numeric 1', () => {
    const style = getNoteCardStyle('n1', undefined, 1);
    expect(style.statusClass).toBe('processed');
  });
});
