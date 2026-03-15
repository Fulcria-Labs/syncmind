import { describe, it, expect } from 'vitest';

// ─── Import pure logic functions from NoteSearch component ───
// All search logic runs against PowerSync's local SQLite replica.
// These tests validate the query-building, snippet extraction,
// highlighting, relevance scoring, and UI state logic.

import {
  buildSearchQuery,
  extractBestSnippet,
  highlightSnippet,
  formatDate,
  countFieldMatches,
  calculateRelevance,
  getSearchStatsMessage,
  shouldExecuteSearch,
  splitSearchTerms,
  getActiveFilterChip,
  getEmptyStateMessage,
} from '../components/NoteSearch';

// ──────────────────────────────────────────────────────────────
// SQL Query Building (PowerSync local SQLite queries)
// ──────────────────────────────────────────────────────────────

describe('NoteSearch - buildSearchQuery', () => {
  it('returns a bare SELECT when no query and filter is "all"', () => {
    const { sql, params } = buildSearchQuery('', 'all');
    expect(sql).toBe('SELECT * FROM notes ORDER BY updated_at DESC');
    expect(params).toEqual([]);
  });

  it('adds LIKE conditions for four columns when query is given', () => {
    const { sql, params } = buildSearchQuery('neural', 'all');
    expect(sql).toContain('title LIKE ?');
    expect(sql).toContain('content LIKE ?');
    expect(sql).toContain('ai_summary LIKE ?');
    expect(sql).toContain('ai_tags LIKE ?');
    expect(params).toEqual(['%neural%', '%neural%', '%neural%', '%neural%']);
  });

  it('wraps LIKE conditions in an OR group', () => {
    const { sql } = buildSearchQuery('test', 'all');
    expect(sql).toContain('(title LIKE ? OR content LIKE ? OR ai_summary LIKE ? OR ai_tags LIKE ?)');
  });

  it('adds is_processed = 1 when filter is "processed"', () => {
    const { sql, params } = buildSearchQuery('', 'processed');
    expect(sql).toContain('is_processed = 1');
    expect(params).toEqual([]);
  });

  it('adds is_processed = 0 when filter is "unprocessed"', () => {
    const { sql, params } = buildSearchQuery('', 'unprocessed');
    expect(sql).toContain('is_processed = 0');
    expect(params).toEqual([]);
  });

  it('combines search + filter with AND', () => {
    const { sql, params } = buildSearchQuery('ml', 'processed');
    expect(sql).toContain('AND');
    expect(sql).toContain('title LIKE ?');
    expect(sql).toContain('is_processed = 1');
    expect(params).toHaveLength(4);
  });

  it('combines search + unprocessed filter with AND', () => {
    const { sql, params } = buildSearchQuery('data', 'unprocessed');
    expect(sql).toContain('AND');
    expect(sql).toContain('is_processed = 0');
    expect(params).toEqual(['%data%', '%data%', '%data%', '%data%']);
  });

  it('always includes ORDER BY updated_at DESC', () => {
    expect(buildSearchQuery('', 'all').sql).toContain('ORDER BY updated_at DESC');
    expect(buildSearchQuery('test', 'all').sql).toContain('ORDER BY updated_at DESC');
    expect(buildSearchQuery('', 'processed').sql).toContain('ORDER BY updated_at DESC');
    expect(buildSearchQuery('q', 'unprocessed').sql).toContain('ORDER BY updated_at DESC');
  });

  it('does not include WHERE for no-query, all-filter', () => {
    const { sql } = buildSearchQuery('', 'all');
    expect(sql).not.toContain('WHERE');
  });

  it('handles multi-word search queries', () => {
    const { params } = buildSearchQuery('machine learning', 'all');
    expect(params[0]).toBe('%machine learning%');
  });

  it('handles special characters in search query', () => {
    const { params } = buildSearchQuery("it's a test", 'all');
    expect(params[0]).toBe("%it's a test%");
  });

  it('preserves query as-is (no trimming — caller is responsible)', () => {
    const { params } = buildSearchQuery(' spaces ', 'all');
    expect(params[0]).toBe('% spaces %');
  });
});

// ──────────────────────────────────────────────────────────────
// Snippet Extraction
// ──────────────────────────────────────────────────────────────

describe('NoteSearch - extractBestSnippet', () => {
  const note = {
    title: 'Deep Learning Overview',
    content: 'Neural networks are the foundation of modern deep learning systems. They consist of layers of interconnected nodes.',
    ai_summary: 'A comprehensive overview of deep learning concepts including neural networks.',
    ai_tags: 'deep-learning,neural-networks,ai',
  };

  it('returns ai_summary snippet when match is found there', () => {
    const snippet = extractBestSnippet(note, 'comprehensive');
    expect(snippet).toContain('comprehensive');
  });

  it('returns content snippet when match is only in content', () => {
    const snippet = extractBestSnippet(note, 'foundation');
    expect(snippet).toContain('foundation');
  });

  it('returns ai_tags snippet when match is only in tags', () => {
    const snippet = extractBestSnippet(note, 'neural-networks');
    expect(snippet).toContain('neural-networks');
  });

  it('returns title snippet when match is only in title', () => {
    const noteNoContent = { title: 'UniqueTitle123', content: '', ai_summary: '', ai_tags: '' };
    const snippet = extractBestSnippet(noteNoContent, 'UniqueTitle123');
    expect(snippet).toContain('UniqueTitle123');
  });

  it('falls back to ai_summary when no match is found', () => {
    const snippet = extractBestSnippet(note, 'quantum');
    expect(snippet).toBe(note.ai_summary);
  });

  it('falls back to truncated content when no summary and no match', () => {
    const noSummary = { title: 'T', content: 'Some content here', ai_summary: '', ai_tags: '' };
    const snippet = extractBestSnippet(noSummary, 'xyz');
    expect(snippet).toBe('Some content here');
  });

  it('returns empty string when all fields are empty', () => {
    const empty = { title: '', content: '', ai_summary: '', ai_tags: '' };
    const snippet = extractBestSnippet(empty, 'test');
    expect(snippet).toBe('');
  });

  it('returns summary when no query is given', () => {
    const snippet = extractBestSnippet(note, '');
    expect(snippet).toBe(note.ai_summary);
  });

  it('adds ellipsis for mid-content matches', () => {
    const longContent = {
      title: '',
      content: 'A'.repeat(100) + 'FINDME' + 'B'.repeat(100),
      ai_summary: '',
      ai_tags: '',
    };
    const snippet = extractBestSnippet(longContent, 'FINDME');
    expect(snippet).toContain('FINDME');
    expect(snippet).toContain('...');
  });

  it('respects maxLength parameter', () => {
    const snippet = extractBestSnippet(note, 'deep', 50);
    expect(snippet.length).toBeLessThanOrEqual(50);
  });

  it('handles null fields gracefully', () => {
    const nullNote = { title: null, content: null, ai_summary: null, ai_tags: null };
    const snippet = extractBestSnippet(nullNote, 'test');
    expect(snippet).toBe('');
  });

  it('performs case-insensitive matching', () => {
    const snippet = extractBestSnippet(note, 'DEEP');
    expect(snippet.toLowerCase()).toContain('deep');
  });
});

// ──────────────────────────────────────────────────────────────
// Text Highlighting
// ──────────────────────────────────────────────────────────────

describe('NoteSearch - highlightSnippet', () => {
  it('returns single unhighlighted segment when no query', () => {
    const result = highlightSnippet('Hello world', '');
    expect(result).toEqual([{ text: 'Hello world', highlighted: false }]);
  });

  it('highlights matching substring', () => {
    const result = highlightSnippet('Hello world', 'world');
    expect(result).toEqual([
      { text: 'Hello ', highlighted: false },
      { text: 'world', highlighted: true },
    ]);
  });

  it('highlights match at the beginning', () => {
    const result = highlightSnippet('Hello world', 'Hello');
    expect(result).toEqual([
      { text: 'Hello', highlighted: true },
      { text: ' world', highlighted: false },
    ]);
  });

  it('highlights match at the end', () => {
    const result = highlightSnippet('Hello world', 'world');
    expect(result[result.length - 1]).toEqual({ text: 'world', highlighted: true });
  });

  it('highlights multiple occurrences', () => {
    const result = highlightSnippet('the cat and the dog', 'the');
    const highlighted = result.filter(s => s.highlighted);
    expect(highlighted).toHaveLength(2);
    expect(highlighted[0].text).toBe('the');
    expect(highlighted[1].text).toBe('the');
  });

  it('is case-insensitive', () => {
    const result = highlightSnippet('Machine Learning', 'machine');
    expect(result[0].highlighted).toBe(true);
    expect(result[0].text).toBe('Machine'); // preserves original casing
  });

  it('returns unhighlighted text when no match', () => {
    const result = highlightSnippet('Hello world', 'xyz');
    expect(result).toEqual([{ text: 'Hello world', highlighted: false }]);
  });

  it('handles empty text', () => {
    const result = highlightSnippet('', 'test');
    expect(result).toEqual([{ text: '', highlighted: false }]);
  });

  it('handles full-text match', () => {
    const result = highlightSnippet('exact', 'exact');
    expect(result).toEqual([{ text: 'exact', highlighted: true }]);
  });

  it('handles adjacent matches', () => {
    const result = highlightSnippet('aaa', 'a');
    const highlighted = result.filter(s => s.highlighted);
    expect(highlighted).toHaveLength(3);
  });

  it('preserves text between matches', () => {
    const result = highlightSnippet('abc-def-abc', 'abc');
    expect(result).toEqual([
      { text: 'abc', highlighted: true },
      { text: '-def-', highlighted: false },
      { text: 'abc', highlighted: true },
    ]);
  });
});

// ──────────────────────────────────────────────────────────────
// Date Formatting
// ──────────────────────────────────────────────────────────────

describe('NoteSearch - formatDate', () => {
  it('formats a valid ISO date', () => {
    const result = formatDate('2026-03-12T10:00:00Z');
    expect(result).toBeTruthy();
  });

  it('formats a date-only string', () => {
    const result = formatDate('2026-03-12');
    expect(result).toBeTruthy();
  });

  it('returns empty for null', () => {
    expect(formatDate(null)).toBe('');
  });

  it('returns empty for undefined', () => {
    expect(formatDate(undefined)).toBe('');
  });

  it('returns empty for empty string', () => {
    expect(formatDate('')).toBe('');
  });
});

// ──────────────────────────────────────────────────────────────
// Field Match Counting
// ──────────────────────────────────────────────────────────────

describe('NoteSearch - countFieldMatches', () => {
  const note = {
    title: 'Machine Learning',
    content: 'Deep learning with neural nets',
    ai_summary: 'Summary about learning algorithms',
    ai_tags: 'ml,learning,ai',
  };

  it('counts all four fields when all match', () => {
    expect(countFieldMatches(note, 'learning')).toBe(4);
  });

  it('counts only matching fields', () => {
    expect(countFieldMatches(note, 'neural')).toBe(1);
  });

  it('returns 0 when no fields match', () => {
    expect(countFieldMatches(note, 'quantum')).toBe(0);
  });

  it('returns 0 for empty query', () => {
    expect(countFieldMatches(note, '')).toBe(0);
  });

  it('is case-insensitive', () => {
    expect(countFieldMatches(note, 'MACHINE')).toBe(1);
  });

  it('handles null fields', () => {
    const nullNote = { title: null, content: null, ai_summary: null, ai_tags: null };
    expect(countFieldMatches(nullNote, 'test')).toBe(0);
  });

  it('handles undefined fields', () => {
    const partialNote = { title: 'Test' };
    expect(countFieldMatches(partialNote, 'Test')).toBe(1);
  });
});

// ──────────────────────────────────────────────────────────────
// Relevance Scoring
// ──────────────────────────────────────────────────────────────

describe('NoteSearch - calculateRelevance', () => {
  it('scores 100 when all four fields match', () => {
    const note = {
      title: 'ai topic',
      content: 'ai content',
      ai_summary: 'ai summary',
      ai_tags: 'ai',
    };
    expect(calculateRelevance(note, 'ai')).toBe(100);
  });

  it('scores 40 for title-only match', () => {
    const note = { title: 'unique', content: '', ai_summary: '', ai_tags: '' };
    expect(calculateRelevance(note, 'unique')).toBe(40);
  });

  it('scores 25 for content-only match', () => {
    const note = { title: '', content: 'unique', ai_summary: '', ai_tags: '' };
    expect(calculateRelevance(note, 'unique')).toBe(25);
  });

  it('scores 20 for summary-only match', () => {
    const note = { title: '', content: '', ai_summary: 'unique', ai_tags: '' };
    expect(calculateRelevance(note, 'unique')).toBe(20);
  });

  it('scores 15 for tags-only match', () => {
    const note = { title: '', content: '', ai_summary: '', ai_tags: 'unique' };
    expect(calculateRelevance(note, 'unique')).toBe(15);
  });

  it('returns 0 for no matches', () => {
    const note = { title: 'a', content: 'b', ai_summary: 'c', ai_tags: 'd' };
    expect(calculateRelevance(note, 'xyz')).toBe(0);
  });

  it('returns 0 for empty query', () => {
    const note = { title: 'test', content: 'test', ai_summary: 'test', ai_tags: 'test' };
    expect(calculateRelevance(note, '')).toBe(0);
  });

  it('weights title higher than content', () => {
    const titleOnly = { title: 'match', content: '', ai_summary: '', ai_tags: '' };
    const contentOnly = { title: '', content: 'match', ai_summary: '', ai_tags: '' };
    expect(calculateRelevance(titleOnly, 'match')).toBeGreaterThan(
      calculateRelevance(contentOnly, 'match')
    );
  });

  it('scores 65 for title + content match', () => {
    const note = { title: 'learning', content: 'learning', ai_summary: '', ai_tags: '' };
    expect(calculateRelevance(note, 'learning')).toBe(65);
  });
});

// ──────────────────────────────────────────────────────────────
// Search Stats Message
// ──────────────────────────────────────────────────────────────

describe('NoteSearch - getSearchStatsMessage', () => {
  it('shows result count and query when searching', () => {
    const msg = getSearchStatsMessage('neural', 3, 50, 'all');
    expect(msg).toBe('3 results for "neural" (searched 50 notes)');
  });

  it('uses singular "result" for 1 match', () => {
    const msg = getSearchStatsMessage('test', 1, 10, 'all');
    expect(msg).toBe('1 result for "test" (searched 10 notes)');
  });

  it('uses singular "note" for 1 total', () => {
    const msg = getSearchStatsMessage('x', 0, 1, 'all');
    expect(msg).toBe('0 results for "x" (searched 1 note)');
  });

  it('shows total count when not searching', () => {
    const msg = getSearchStatsMessage('', 0, 42, 'all');
    expect(msg).toBe('42 notes in local database');
  });

  it('shows filter active message', () => {
    const msg = getSearchStatsMessage('', 0, 10, 'processed');
    expect(msg).toBe('10 notes in local database (processed filter active)');
  });

  it('shows unprocessed filter message', () => {
    const msg = getSearchStatsMessage('', 0, 5, 'unprocessed');
    expect(msg).toBe('5 notes in local database (unprocessed filter active)');
  });

  it('does not show filter message for "all"', () => {
    const msg = getSearchStatsMessage('', 0, 5, 'all');
    expect(msg).not.toContain('filter');
  });

  it('handles zero notes', () => {
    const msg = getSearchStatsMessage('', 0, 0, 'all');
    expect(msg).toBe('0 notes in local database');
  });
});

// ──────────────────────────────────────────────────────────────
// shouldExecuteSearch
// ──────────────────────────────────────────────────────────────

describe('NoteSearch - shouldExecuteSearch', () => {
  it('returns true for non-empty query', () => {
    expect(shouldExecuteSearch('test')).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(shouldExecuteSearch('')).toBe(false);
  });

  it('returns false for whitespace-only string', () => {
    expect(shouldExecuteSearch('   ')).toBe(false);
  });

  it('returns true for query with leading/trailing spaces', () => {
    expect(shouldExecuteSearch('  test  ')).toBe(true);
  });

  it('returns true for single character', () => {
    expect(shouldExecuteSearch('a')).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────
// splitSearchTerms
// ──────────────────────────────────────────────────────────────

describe('NoteSearch - splitSearchTerms', () => {
  it('splits multi-word query', () => {
    expect(splitSearchTerms('machine learning')).toEqual(['machine', 'learning']);
  });

  it('handles single word', () => {
    expect(splitSearchTerms('neural')).toEqual(['neural']);
  });

  it('handles extra whitespace', () => {
    expect(splitSearchTerms('  machine   learning  ')).toEqual(['machine', 'learning']);
  });

  it('returns empty array for empty string', () => {
    expect(splitSearchTerms('')).toEqual([]);
  });

  it('returns empty array for whitespace-only', () => {
    expect(splitSearchTerms('   ')).toEqual([]);
  });

  it('handles tab-separated terms', () => {
    expect(splitSearchTerms('a\tb')).toEqual(['a', 'b']);
  });
});

// ──────────────────────────────────────────────────────────────
// getActiveFilterChip
// ──────────────────────────────────────────────────────────────

describe('NoteSearch - getActiveFilterChip', () => {
  it('returns "All" for all filter', () => {
    expect(getActiveFilterChip('all')).toBe('All');
  });

  it('returns "Processed" for processed filter', () => {
    expect(getActiveFilterChip('processed')).toBe('Processed');
  });

  it('returns "Unprocessed" for unprocessed filter', () => {
    expect(getActiveFilterChip('unprocessed')).toBe('Unprocessed');
  });
});

// ──────────────────────────────────────────────────────────────
// getEmptyStateMessage
// ──────────────────────────────────────────────────────────────

describe('NoteSearch - getEmptyStateMessage', () => {
  it('shows query-specific message when searching', () => {
    const result = getEmptyStateMessage('neural', 'all');
    expect(result.title).toBe('No notes match "neural"');
    expect(result.hint).toContain('keywords');
  });

  it('shows filter-specific message when filtering', () => {
    const result = getEmptyStateMessage('', 'processed');
    expect(result.title).toBe('No processed notes found');
    expect(result.hint).toContain('filter');
  });

  it('shows unprocessed filter message', () => {
    const result = getEmptyStateMessage('', 'unprocessed');
    expect(result.title).toBe('No unprocessed notes found');
  });

  it('shows generic message with no query and all filter', () => {
    const result = getEmptyStateMessage('', 'all');
    expect(result.title).toBe('No notes yet');
    expect(result.hint).toContain('first note');
  });

  it('prioritizes query message over filter message', () => {
    const result = getEmptyStateMessage('test', 'processed');
    expect(result.title).toContain('test');
    expect(result.title).not.toContain('processed');
  });
});
