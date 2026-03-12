import { describe, it, expect } from 'vitest';

// ─── Extract and test pure logic from NoteList.tsx ───

// Simulates SQL query building logic
function buildQuery(searchQuery: string): { sql: string; params: string[] } {
  if (searchQuery) {
    return {
      sql: `SELECT * FROM notes WHERE title LIKE ? OR content LIKE ? OR ai_tags LIKE ? ORDER BY updated_at DESC`,
      params: [`%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`],
    };
  }
  return {
    sql: `SELECT * FROM notes ORDER BY updated_at DESC`,
    params: [],
  };
}

// Simulates empty state message logic
function getEmptyMessage(searchQuery: string): { title: string; hint: string } {
  return {
    title: searchQuery ? 'No matching notes' : 'No research notes yet',
    hint: 'Add your first note to get started',
  };
}

// Simulates tag rendering logic
function renderTags(aiTags: string): string[] {
  return aiTags.split(',').filter(Boolean).slice(0, 3).map(tag => tag.trim());
}

// Simulates content preview logic
function getPreview(note: { ai_summary?: string; content?: string }): string {
  if (note.ai_summary) return note.ai_summary;
  if (note.content) return note.content.slice(0, 120) + '...';
  return '';
}

// Simulates card class computation
function getCardClass(noteId: string, selectedId: string | undefined, isProcessed: boolean | number): string {
  const parts = ['note-card'];
  if (noteId === selectedId) parts.push('selected');
  parts.push(isProcessed ? 'processed' : 'pending');
  return parts.join(' ');
}

// ─── SQL Query Building ───

describe('NoteList - Query Building', () => {
  it('builds search query with LIKE parameters', () => {
    const result = buildQuery('machine learning');
    expect(result.sql).toContain('WHERE');
    expect(result.params).toEqual([
      '%machine learning%',
      '%machine learning%',
      '%machine learning%',
    ]);
  });

  it('builds default query without search', () => {
    const result = buildQuery('');
    expect(result.sql).not.toContain('WHERE');
    expect(result.params).toEqual([]);
  });

  it('always orders by updated_at DESC', () => {
    expect(buildQuery('').sql).toContain('ORDER BY updated_at DESC');
    expect(buildQuery('test').sql).toContain('ORDER BY updated_at DESC');
  });

  it('searches across title, content, and ai_tags', () => {
    const result = buildQuery('test');
    expect(result.sql).toContain('title LIKE');
    expect(result.sql).toContain('content LIKE');
    expect(result.sql).toContain('ai_tags LIKE');
  });
});

// ─── Empty State ───

describe('NoteList - Empty State', () => {
  it('shows search-specific message when searching', () => {
    const msg = getEmptyMessage('test query');
    expect(msg.title).toBe('No matching notes');
  });

  it('shows default message when not searching', () => {
    const msg = getEmptyMessage('');
    expect(msg.title).toBe('No research notes yet');
  });

  it('always shows hint text', () => {
    expect(getEmptyMessage('').hint).toBe('Add your first note to get started');
    expect(getEmptyMessage('search').hint).toBe('Add your first note to get started');
  });
});

// ─── Tag Rendering ───

describe('NoteList - Tag Rendering', () => {
  it('splits comma-separated tags', () => {
    expect(renderTags('ml,ai,python')).toEqual(['ml', 'ai', 'python']);
  });

  it('limits to 3 tags', () => {
    expect(renderTags('a,b,c,d,e').length).toBe(3);
  });

  it('trims whitespace from tags', () => {
    expect(renderTags(' ml , ai , python ')).toEqual(['ml', 'ai', 'python']);
  });

  it('filters empty tags', () => {
    expect(renderTags('ml,,ai,,')).toEqual(['ml', 'ai']);
  });

  it('handles empty string', () => {
    expect(renderTags('')).toEqual([]);
  });

  it('handles single tag', () => {
    expect(renderTags('python')).toEqual(['python']);
  });
});

// ─── Content Preview ───

describe('NoteList - Content Preview', () => {
  it('prefers ai_summary over content', () => {
    expect(getPreview({ ai_summary: 'Summary', content: 'Content' })).toBe('Summary');
  });

  it('falls back to truncated content', () => {
    const content = 'A'.repeat(200);
    const preview = getPreview({ content });
    expect(preview.length).toBe(123); // 120 + '...'
    expect(preview.endsWith('...')).toBe(true);
  });

  it('returns empty string when no content', () => {
    expect(getPreview({})).toBe('');
  });
});

// ─── Card Classes ───

describe('NoteList - Card Classes', () => {
  it('adds selected class when matching', () => {
    expect(getCardClass('1', '1', true)).toContain('selected');
  });

  it('does not add selected when not matching', () => {
    expect(getCardClass('1', '2', true)).not.toContain('selected');
  });

  it('adds processed class for processed notes', () => {
    expect(getCardClass('1', undefined, true)).toContain('processed');
  });

  it('adds pending class for unprocessed notes', () => {
    expect(getCardClass('1', undefined, false)).toContain('pending');
  });

  it('handles undefined selectedId', () => {
    expect(getCardClass('1', undefined, true)).not.toContain('selected');
  });
});
