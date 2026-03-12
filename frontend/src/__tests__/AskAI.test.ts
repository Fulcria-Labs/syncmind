import { describe, it, expect } from 'vitest';

// ─── Extract and test pure logic from AskAI.tsx ───

// Simulates the local search scoring logic
function localSearch(
  query: string,
  notes: { title: string; content: string; ai_summary: string; ai_tags: string }[],
): string {
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  if (!terms.length || !notes.length) return 'No notes found matching your query.';

  const scored = notes.map(note => {
    const text = `${note.title} ${note.content} ${note.ai_summary} ${note.ai_tags}`.toLowerCase();
    const matches = terms.filter(t => text.includes(t));
    return { note, score: matches.length / terms.length };
  }).filter(s => s.score > 0).sort((a, b) => b.score - a.score);

  if (!scored.length) return 'No notes found matching your query. Try different keywords.';

  const top = scored.slice(0, 3);
  const parts = top.map(({ note, score }) => {
    const summary = note.ai_summary || note.content.slice(0, 200);
    const relevance = Math.round(score * 100);
    return `### ${note.title} (${relevance}% match)\n${summary}`;
  });

  return `*Local search results (offline mode):*\n\n${parts.join('\n\n---\n\n')}`;
}

// Simulates question validation
function canAsk(question: string, loading: boolean): boolean {
  return !loading && question.trim().length > 0;
}

const sampleNotes = [
  { title: 'Machine Learning Basics', content: 'Neural networks are used in deep learning', ai_summary: 'Overview of ML', ai_tags: 'ml,ai,neural' },
  { title: 'Cooking Recipes', content: 'How to bake a chocolate cake', ai_summary: 'Recipe collection', ai_tags: 'cooking,food' },
  { title: 'Python Programming', content: 'Python is great for machine learning', ai_summary: 'Python guide', ai_tags: 'python,code,ml' },
];

// ─── Local Search ───

describe('AskAI - Local Search', () => {
  it('returns matching notes sorted by relevance', () => {
    const result = localSearch('machine learning', sampleNotes);
    expect(result).toContain('Machine Learning Basics');
    expect(result).toContain('100% match');
  });

  it('returns multiple results for broad queries', () => {
    const result = localSearch('machine learning python', sampleNotes);
    expect(result).toContain('Machine Learning Basics');
    expect(result).toContain('Python Programming');
  });

  it('returns no-match message for unrelated query', () => {
    const result = localSearch('quantum physics', sampleNotes);
    expect(result).toContain('No notes found matching your query');
  });

  it('returns no-match for empty notes array', () => {
    const result = localSearch('anything', []);
    expect(result).toBe('No notes found matching your query.');
  });

  it('filters out short terms (<=2 chars)', () => {
    // "is" and "a" and "ml" are all <=2 chars, so filtered out
    const result = localSearch('is a ml', sampleNotes);
    expect(result).toBe('No notes found matching your query.');
    // But "neural" (>2) works
    const result2 = localSearch('is a neural', sampleNotes);
    expect(result2).toContain('Machine Learning Basics');
  });

  it('returns no-match when all terms are too short', () => {
    const result = localSearch('is a to', sampleNotes);
    expect(result).toBe('No notes found matching your query.');
  });

  it('limits results to top 3', () => {
    const manyNotes = Array.from({ length: 10 }, (_, i) => ({
      title: `Note ${i}`,
      content: `common keyword content ${i}`,
      ai_summary: 'summary',
      ai_tags: 'tag',
    }));
    const result = localSearch('common keyword', manyNotes);
    const headingMatches = result.match(/### Note/g);
    expect(headingMatches?.length).toBeLessThanOrEqual(3);
  });

  it('uses content preview when ai_summary is empty', () => {
    const notes = [
      { title: 'Test Note', content: 'This is a long content string for preview', ai_summary: '', ai_tags: 'test' },
    ];
    const result = localSearch('test content', notes);
    expect(result).toContain('This is a long content string');
  });

  it('searches across all note fields', () => {
    const notes = [
      { title: 'Unrelated Title', content: 'unrelated content', ai_summary: 'unrelated summary', ai_tags: 'searchable-tag' },
    ];
    const result = localSearch('searchable-tag', notes);
    expect(result).toContain('Unrelated Title');
  });

  it('calculates correct relevance percentage', () => {
    // Query has 2 valid terms, note matches 1 → 50%
    const notes = [
      { title: 'Alpha Only', content: 'alpha content here', ai_summary: '', ai_tags: '' },
    ];
    const result = localSearch('alpha beta', notes);
    expect(result).toContain('50% match');
  });
});

// ─── Question Validation ───

describe('AskAI - Question Validation', () => {
  it('allows asking when question is non-empty', () => {
    expect(canAsk('What is ML?', false)).toBe(true);
  });

  it('blocks asking when question is empty', () => {
    expect(canAsk('', false)).toBe(false);
  });

  it('blocks asking when question is whitespace only', () => {
    expect(canAsk('   ', false)).toBe(false);
  });

  it('blocks asking when loading', () => {
    expect(canAsk('What is ML?', true)).toBe(false);
  });

  it('blocks asking when empty and loading', () => {
    expect(canAsk('', true)).toBe(false);
  });
});
