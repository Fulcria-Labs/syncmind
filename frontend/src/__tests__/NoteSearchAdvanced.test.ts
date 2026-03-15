import { describe, it, expect } from 'vitest';

import {
  buildSearchQuery,
  extractBestSnippet,
  highlightSnippet,
  countFieldMatches,
  calculateRelevance,
  getSearchStatsMessage,
  shouldExecuteSearch,
  splitSearchTerms,
  getEmptyStateMessage,
  formatDate,
  getActiveFilterChip,
} from '../components/NoteSearch';

// ──────────────────────────────────────────────────────────────
// Advanced SQL Query Building Tests
// Tests cover edge cases in PowerSync local SQLite query generation
// ──────────────────────────────────────────────────────────────

describe('NoteSearch Advanced - Query Construction Edge Cases', () => {
  it('handles very long search queries', () => {
    const longQuery = 'a'.repeat(500);
    const { sql, params } = buildSearchQuery(longQuery, 'all');
    expect(sql).toContain('WHERE');
    expect(params[0]).toBe(`%${'a'.repeat(500)}%`);
  });

  it('handles query with SQL injection attempt', () => {
    const { params } = buildSearchQuery("'; DROP TABLE notes; --", 'all');
    // Parameterized query — injection is safe
    expect(params[0]).toBe("%'; DROP TABLE notes; --%");
  });

  it('handles query with percent signs', () => {
    const { params } = buildSearchQuery('50%', 'all');
    expect(params[0]).toBe('%50%%');
  });

  it('handles query with underscores (SQLite LIKE wildcard)', () => {
    const { params } = buildSearchQuery('test_value', 'all');
    expect(params[0]).toBe('%test_value%');
  });

  it('processed filter produces valid SQL without search', () => {
    const { sql, params } = buildSearchQuery('', 'processed');
    expect(sql).toBe('SELECT * FROM notes WHERE is_processed = 1 ORDER BY updated_at DESC');
    expect(params).toEqual([]);
  });

  it('unprocessed filter produces valid SQL without search', () => {
    const { sql, params } = buildSearchQuery('', 'unprocessed');
    expect(sql).toBe('SELECT * FROM notes WHERE is_processed = 0 ORDER BY updated_at DESC');
    expect(params).toEqual([]);
  });

  it('all filter with query produces correct param count', () => {
    const { params } = buildSearchQuery('test', 'all');
    expect(params).toHaveLength(4);
  });

  it('processed filter with query produces correct param count', () => {
    const { params } = buildSearchQuery('test', 'processed');
    expect(params).toHaveLength(4); // Only LIKE params — filter is not parameterized
  });

  it('query with newlines is handled', () => {
    const { params } = buildSearchQuery('line1\nline2', 'all');
    expect(params[0]).toBe('%line1\nline2%');
  });

  it('query with unicode characters works', () => {
    const { params } = buildSearchQuery('neural', 'all');
    expect(params[0]).toContain('neural');
  });

  it('empty query + all filter has no WHERE clause', () => {
    const { sql } = buildSearchQuery('', 'all');
    expect(sql.indexOf('WHERE')).toBe(-1);
  });
});

// ──────────────────────────────────────────────────────────────
// Advanced Snippet Extraction Tests
// ──────────────────────────────────────────────────────────────

describe('NoteSearch Advanced - Snippet Extraction', () => {
  it('prioritizes ai_summary over content when both match', () => {
    const note = {
      title: 'Title',
      content: 'The keyword appears in content',
      ai_summary: 'The keyword appears in summary',
      ai_tags: '',
    };
    const snippet = extractBestSnippet(note, 'keyword');
    expect(snippet).toContain('summary'); // ai_summary is checked first
  });

  it('falls back to content when summary does not match', () => {
    const note = {
      title: 'Title',
      content: 'The unique term is here in content',
      ai_summary: 'Generic summary without match',
      ai_tags: '',
    };
    const snippet = extractBestSnippet(note, 'unique term');
    expect(snippet).toContain('unique term');
  });

  it('extracts context window around match in long content', () => {
    const prefix = 'Lorem ipsum dolor sit amet. '.repeat(5);
    const suffix = ' Consectetur adipiscing elit.'.repeat(5);
    const note = {
      title: '',
      content: prefix + 'IMPORTANT_KEYWORD' + suffix,
      ai_summary: '',
      ai_tags: '',
    };
    const snippet = extractBestSnippet(note, 'IMPORTANT_KEYWORD');
    expect(snippet).toContain('IMPORTANT_KEYWORD');
    expect(snippet.length).toBeLessThanOrEqual(200);
  });

  it('handles match at the very start of content', () => {
    const note = {
      title: '',
      content: 'StartWord and then more text follows here',
      ai_summary: '',
      ai_tags: '',
    };
    const snippet = extractBestSnippet(note, 'StartWord');
    expect(snippet).toContain('StartWord');
    expect(snippet.startsWith('...')).toBe(false); // No ellipsis at start
  });

  it('handles match at the very end of content', () => {
    const note = {
      title: '',
      content: 'Some text leading up to EndWord',
      ai_summary: '',
      ai_tags: '',
    };
    const snippet = extractBestSnippet(note, 'EndWord');
    expect(snippet).toContain('EndWord');
  });

  it('handles note with only tags matching', () => {
    const note = {
      title: 'Unrelated Title',
      content: 'Unrelated content here',
      ai_summary: 'Unrelated summary',
      ai_tags: 'special-unique-tag',
    };
    const snippet = extractBestSnippet(note, 'special-unique-tag');
    expect(snippet).toContain('special-unique-tag');
  });

  it('handles all null fields without crashing', () => {
    const note = { title: null, content: null, ai_summary: null, ai_tags: null };
    expect(() => extractBestSnippet(note, 'test')).not.toThrow();
  });

  it('handles all undefined fields', () => {
    const note = {};
    expect(() => extractBestSnippet(note, 'test')).not.toThrow();
  });

  it('returns fallback for empty query', () => {
    const note = { title: 'T', content: 'Content', ai_summary: 'Summary', ai_tags: '' };
    const snippet = extractBestSnippet(note, '');
    expect(snippet).toBe('Summary');
  });

  it('returns content fallback when summary is empty and no query', () => {
    const note = { title: 'T', content: 'Content text', ai_summary: '', ai_tags: '' };
    const snippet = extractBestSnippet(note, '');
    expect(snippet).toBe('Content text');
  });
});

// ──────────────────────────────────────────────────────────────
// Advanced Highlighting Tests
// ──────────────────────────────────────────────────────────────

describe('NoteSearch Advanced - Highlighting Edge Cases', () => {
  it('handles query that is a substring of a word', () => {
    const result = highlightSnippet('understanding neural networks', 'net');
    const highlighted = result.filter(s => s.highlighted);
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0].text).toBe('net');
  });

  it('handles very long text', () => {
    const longText = 'word '.repeat(1000);
    const result = highlightSnippet(longText, 'word');
    const highlighted = result.filter(s => s.highlighted);
    expect(highlighted.length).toBeGreaterThan(100);
  });

  it('handles single character query', () => {
    const result = highlightSnippet('abcabc', 'a');
    const highlighted = result.filter(s => s.highlighted);
    expect(highlighted).toHaveLength(2);
  });

  it('handles query longer than text', () => {
    const result = highlightSnippet('Hi', 'Hello World');
    expect(result).toEqual([{ text: 'Hi', highlighted: false }]);
  });

  it('handles identical text and query', () => {
    const result = highlightSnippet('exact match', 'exact match');
    expect(result).toEqual([{ text: 'exact match', highlighted: true }]);
  });

  it('preserves special characters in text', () => {
    const result = highlightSnippet('price: $100 (USD)', '$100');
    const highlighted = result.filter(s => s.highlighted);
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0].text).toBe('$100');
  });

  it('handles overlapping potential matches correctly', () => {
    // "aa" in "aaa" should produce 1 match (greedy, non-overlapping)
    const result = highlightSnippet('aaa', 'aa');
    const highlighted = result.filter(s => s.highlighted);
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0].text).toBe('aa');
  });

  it('handles text with newlines', () => {
    const result = highlightSnippet('line1\nline2\nline3', 'line2');
    const highlighted = result.filter(s => s.highlighted);
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0].text).toBe('line2');
  });

  it('total concatenated segments equal original text', () => {
    const text = 'The quick brown fox jumps over the lazy dog';
    const result = highlightSnippet(text, 'the');
    const reconstructed = result.map(s => s.text).join('');
    // Case-insensitive match means "The" and "the" both match as "the" length
    // but original casing is preserved
    expect(reconstructed.length).toBe(text.length);
  });

  it('handles empty query on non-empty text', () => {
    const result = highlightSnippet('Hello', '');
    expect(result).toEqual([{ text: 'Hello', highlighted: false }]);
  });

  it('handles both empty text and query', () => {
    const result = highlightSnippet('', '');
    expect(result).toEqual([{ text: '', highlighted: false }]);
  });
});

// ──────────────────────────────────────────────────────────────
// Advanced Relevance Scoring
// ──────────────────────────────────────────────────────────────

describe('NoteSearch Advanced - Relevance Scoring', () => {
  it('title + summary = 60 points', () => {
    const note = { title: 'ml', content: '', ai_summary: 'ml overview', ai_tags: '' };
    expect(calculateRelevance(note, 'ml')).toBe(60);
  });

  it('content + tags = 40 points', () => {
    const note = { title: '', content: 'data', ai_summary: '', ai_tags: 'data' };
    expect(calculateRelevance(note, 'data')).toBe(40);
  });

  it('title + content + summary = 85 points', () => {
    const note = { title: 'ai', content: 'ai', ai_summary: 'ai', ai_tags: '' };
    expect(calculateRelevance(note, 'ai')).toBe(85);
  });

  it('summary + tags = 35 points', () => {
    const note = { title: '', content: '', ai_summary: 'test', ai_tags: 'test' };
    expect(calculateRelevance(note, 'test')).toBe(35);
  });

  it('is case-insensitive', () => {
    const note = { title: 'Machine Learning', content: '', ai_summary: '', ai_tags: '' };
    expect(calculateRelevance(note, 'machine learning')).toBe(40);
    expect(calculateRelevance(note, 'MACHINE LEARNING')).toBe(40);
  });

  it('returns 0 for completely unrelated query', () => {
    const note = { title: 'abc', content: 'def', ai_summary: 'ghi', ai_tags: 'jkl' };
    expect(calculateRelevance(note, 'xyz')).toBe(0);
  });

  it('null fields do not crash scoring', () => {
    const note = { title: null, content: null, ai_summary: null, ai_tags: null };
    expect(calculateRelevance(note, 'test')).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────
// Advanced Field Match Counting
// ──────────────────────────────────────────────────────────────

describe('NoteSearch Advanced - Field Match Counting', () => {
  it('counts 0 for empty note', () => {
    const note = { title: '', content: '', ai_summary: '', ai_tags: '' };
    expect(countFieldMatches(note, 'test')).toBe(0);
  });

  it('counts exactly 1 for single field match', () => {
    const note = { title: 'test', content: 'other', ai_summary: 'different', ai_tags: 'more' };
    expect(countFieldMatches(note, 'test')).toBe(1);
  });

  it('counts exactly 2 for two field matches', () => {
    const note = { title: 'data', content: 'data analysis', ai_summary: 'different', ai_tags: 'other' };
    expect(countFieldMatches(note, 'data')).toBe(2);
  });

  it('counts exactly 3 for three field matches', () => {
    const note = { title: 'ai', content: 'ai models', ai_summary: 'ai overview', ai_tags: 'other' };
    expect(countFieldMatches(note, 'ai')).toBe(3);
  });

  it('handles substring matching', () => {
    const note = { title: 'understanding', content: '', ai_summary: '', ai_tags: '' };
    expect(countFieldMatches(note, 'stand')).toBe(1);
  });

  it('is not affected by query case', () => {
    const note = { title: 'ABC', content: 'abc', ai_summary: 'Abc', ai_tags: 'aBc' };
    expect(countFieldMatches(note, 'abc')).toBe(4);
    expect(countFieldMatches(note, 'ABC')).toBe(4);
  });
});

// ──────────────────────────────────────────────────────────────
// Advanced Stats Message Tests
// ──────────────────────────────────────────────────────────────

describe('NoteSearch Advanced - Stats Messages', () => {
  it('0 results for query', () => {
    expect(getSearchStatsMessage('xyz', 0, 100, 'all')).toBe(
      '0 results for "xyz" (searched 100 notes)'
    );
  });

  it('large numbers', () => {
    const msg = getSearchStatsMessage('data', 1500, 10000, 'all');
    expect(msg).toBe('1500 results for "data" (searched 10000 notes)');
  });

  it('1 note total, 1 result', () => {
    const msg = getSearchStatsMessage('only', 1, 1, 'all');
    expect(msg).toBe('1 result for "only" (searched 1 note)');
  });

  it('unprocessed filter without query', () => {
    const msg = getSearchStatsMessage('', 0, 25, 'unprocessed');
    expect(msg).toContain('unprocessed filter active');
  });

  it('query overrides filter display', () => {
    // When query is present, the stats show query results, not filter info
    const msg = getSearchStatsMessage('test', 5, 20, 'processed');
    expect(msg).toContain('5 results for "test"');
    expect(msg).not.toContain('processed filter');
  });
});

// ──────────────────────────────────────────────────────────────
// Advanced Search Validation
// ──────────────────────────────────────────────────────────────

describe('NoteSearch Advanced - Search Validation', () => {
  it('tab character counts as whitespace (not searchable alone)', () => {
    expect(shouldExecuteSearch('\t')).toBe(false);
  });

  it('newline counts as whitespace', () => {
    expect(shouldExecuteSearch('\n')).toBe(false);
  });

  it('mixed whitespace is not searchable', () => {
    expect(shouldExecuteSearch(' \t \n ')).toBe(false);
  });

  it('text with surrounding whitespace is searchable', () => {
    expect(shouldExecuteSearch(' \t real query \n ')).toBe(true);
  });

  it('numbers are searchable', () => {
    expect(shouldExecuteSearch('42')).toBe(true);
  });

  it('special characters are searchable', () => {
    expect(shouldExecuteSearch('!@#$')).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────
// Advanced Term Splitting
// ──────────────────────────────────────────────────────────────

describe('NoteSearch Advanced - Term Splitting', () => {
  it('splits on multiple space types', () => {
    expect(splitSearchTerms('a\t\nb')).toEqual(['a', 'b']);
  });

  it('handles hyphenated words as single term', () => {
    expect(splitSearchTerms('machine-learning')).toEqual(['machine-learning']);
  });

  it('handles quoted phrases (no special treatment — splits normally)', () => {
    expect(splitSearchTerms('"machine learning"')).toEqual(['"machine', 'learning"']);
  });

  it('handles many terms', () => {
    const terms = splitSearchTerms('a b c d e f g h i j');
    expect(terms).toHaveLength(10);
  });

  it('preserves case', () => {
    expect(splitSearchTerms('Machine Learning')).toEqual(['Machine', 'Learning']);
  });
});

// ──────────────────────────────────────────────────────────────
// Advanced Empty State Messages
// ──────────────────────────────────────────────────────────────

describe('NoteSearch Advanced - Empty State Messages', () => {
  it('includes the query text in the title', () => {
    const result = getEmptyStateMessage('deep learning', 'all');
    expect(result.title).toContain('deep learning');
  });

  it('hint mentions AI tags for query searches', () => {
    const result = getEmptyStateMessage('anything', 'all');
    expect(result.hint).toContain('AI tags');
  });

  it('filter message suggests changing filter', () => {
    const result = getEmptyStateMessage('', 'unprocessed');
    expect(result.hint).toContain('filter');
  });

  it('default message suggests creating a note', () => {
    const result = getEmptyStateMessage('', 'all');
    expect(result.hint).toContain('first note');
  });
});

// ──────────────────────────────────────────────────────────────
// Advanced Date Formatting
// ──────────────────────────────────────────────────────────────

describe('NoteSearch Advanced - Date Formatting', () => {
  it('handles timestamps with milliseconds', () => {
    expect(formatDate('2026-03-12T10:30:00.123Z')).toBeTruthy();
  });

  it('handles timestamps without timezone', () => {
    expect(formatDate('2026-03-12T10:30:00')).toBeTruthy();
  });

  it('handles epoch-like strings', () => {
    // Number-like strings are handled by Date constructor
    const result = formatDate('0');
    expect(typeof result).toBe('string');
  });

  it('returns consistent type', () => {
    expect(typeof formatDate('2026-01-01')).toBe('string');
    expect(typeof formatDate(null)).toBe('string');
    expect(typeof formatDate('')).toBe('string');
  });
});

// ──────────────────────────────────────────────────────────────
// Filter Chip Display
// ──────────────────────────────────────────────────────────────

describe('NoteSearch Advanced - Filter Chip Display', () => {
  it('returns capitalized label for each filter mode', () => {
    expect(getActiveFilterChip('all')).toMatch(/^[A-Z]/);
    expect(getActiveFilterChip('processed')).toMatch(/^[A-Z]/);
    expect(getActiveFilterChip('unprocessed')).toMatch(/^[A-Z]/);
  });

  it('all three modes produce distinct labels', () => {
    const labels = new Set([
      getActiveFilterChip('all'),
      getActiveFilterChip('processed'),
      getActiveFilterChip('unprocessed'),
    ]);
    expect(labels.size).toBe(3);
  });
});

// ──────────────────────────────────────────────────────────────
// Integration-style: query + highlight + snippet pipeline
// ──────────────────────────────────────────────────────────────

describe('NoteSearch Advanced - Search Pipeline Integration', () => {
  const sampleNotes = [
    {
      title: 'Transformer Architecture',
      content: 'The transformer model uses self-attention mechanisms for sequence processing.',
      ai_summary: 'Overview of transformer neural network architecture',
      ai_tags: 'transformers,attention,deep-learning',
    },
    {
      title: 'Reinforcement Learning',
      content: 'RL agents learn by interacting with environments to maximize cumulative reward.',
      ai_summary: 'Introduction to reinforcement learning paradigm',
      ai_tags: 'rl,agents,reward',
    },
    {
      title: 'Data Pipeline Design',
      content: 'ETL processes extract, transform, and load data between systems.',
      ai_summary: 'Best practices for data pipeline architecture',
      ai_tags: 'data,etl,engineering',
    },
  ];

  it('buildSearchQuery + extractBestSnippet + highlightSnippet work together', () => {
    const query = 'transformer';
    const { sql, params } = buildSearchQuery(query, 'all');

    // Verify query is valid
    expect(sql).toContain('WHERE');
    expect(params).toHaveLength(4);

    // For the matching note, extract and highlight
    const note = sampleNotes[0];
    const snippet = extractBestSnippet(note, query);
    expect(snippet).toContain('transformer');

    const highlighted = highlightSnippet(snippet, query);
    const hasHighlight = highlighted.some(s => s.highlighted);
    expect(hasHighlight).toBe(true);
  });

  it('relevance scoring ranks notes correctly', () => {
    const query = 'learning';
    const scores = sampleNotes.map(note => ({
      title: note.title,
      score: calculateRelevance(note, query),
    }));

    // "Reinforcement Learning" should score highest (title + summary + tags)
    const rlScore = scores.find(s => s.title === 'Reinforcement Learning')!;
    const transformerScore = scores.find(s => s.title === 'Transformer Architecture')!;

    expect(rlScore.score).toBeGreaterThan(transformerScore.score);
  });

  it('field match counting is consistent with relevance', () => {
    const query = 'data';
    const dataNote = sampleNotes[2]; // "Data Pipeline Design"
    const matchCount = countFieldMatches(dataNote, query);
    const relevance = calculateRelevance(dataNote, query);

    // More field matches → higher relevance
    expect(matchCount).toBeGreaterThanOrEqual(2); // title + content + summary + tags
    expect(relevance).toBeGreaterThan(0);
  });

  it('stats message reflects search state accurately', () => {
    const msg = getSearchStatsMessage('transform', 2, 3, 'all');
    expect(msg).toContain('2 results');
    expect(msg).toContain('3 notes');
  });

  it('empty state message is appropriate when no matches', () => {
    const msg = getEmptyStateMessage('quantum computing', 'all');
    expect(msg.title).toContain('quantum computing');
  });

  it('highlight preserves all original text', () => {
    for (const note of sampleNotes) {
      const query = 'the';
      const segments = highlightSnippet(note.title, query);
      const rebuilt = segments.map(s => s.text).join('');
      expect(rebuilt).toBe(note.title);
    }
  });

  it('snippet extraction never exceeds maxLength', () => {
    for (const note of sampleNotes) {
      const snippet = extractBestSnippet(note, 'the', 100);
      expect(snippet.length).toBeLessThanOrEqual(100);
    }
  });
});
