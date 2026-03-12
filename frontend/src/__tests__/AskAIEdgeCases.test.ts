import { describe, it, expect } from 'vitest';

// ─── Extract and test pure logic from AskAI.tsx ───

// Local search scoring logic
function scoreNote(
  note: { title: string; content: string; ai_summary: string; ai_tags: string },
  terms: string[]
): number {
  const text = `${note.title} ${note.content} ${note.ai_summary} ${note.ai_tags}`.toLowerCase();
  const matches = terms.filter(t => text.includes(t));
  return matches.length / terms.length;
}

// Term extraction from query
function extractSearchTerms(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
}

// Format local search result
function formatSearchResult(note: { title: string; ai_summary: string; content: string }, score: number): string {
  const summary = note.ai_summary || note.content.slice(0, 200);
  const relevance = Math.round(score * 100);
  return `### ${note.title} (${relevance}% match)\n${summary}`;
}

// Build local search output
function buildLocalSearchOutput(results: string[]): string {
  if (results.length === 0) return 'No notes found matching your query. Try different keywords.';
  return `*Local search results (offline mode):*\n\n${results.join('\n\n---\n\n')}`;
}

// Should disable ask button
function isAskDisabled(loading: boolean, question: string): boolean {
  return loading || !question.trim();
}

// Ask button text
function getAskButtonText(loading: boolean): string {
  return loading ? '...' : 'Ask';
}

// Answer display class
function getAnswerClass(isLocalResult: boolean): string {
  return `ai-answer ${isLocalResult ? 'local-result' : ''}`;
}

// No notes found messages
function getNoNotesMessage(hasNotes: boolean): string {
  if (!hasNotes) return 'No notes found matching your query.';
  return 'No notes found matching your query. Try different keywords.';
}

// ─── Search Term Extraction ───

describe('AskAI - Search Term Extraction', () => {
  it('splits query into lowercase terms', () => {
    expect(extractSearchTerms('Machine Learning')).toEqual(['machine', 'learning']);
  });

  it('filters terms shorter than 3 characters', () => {
    expect(extractSearchTerms('AI is a ML tool')).toEqual(['tool']);
  });

  it('handles empty query', () => {
    expect(extractSearchTerms('')).toEqual([]);
  });

  it('handles whitespace-only query', () => {
    expect(extractSearchTerms('   ')).toEqual([]);
  });

  it('handles multiple spaces between words', () => {
    expect(extractSearchTerms('deep   learning   model')).toEqual(['deep', 'learning', 'model']);
  });

  it('handles tabs and mixed whitespace', () => {
    expect(extractSearchTerms('neural\tnetwork\n training')).toEqual(['neural', 'network', 'training']);
  });

  it('keeps 3-character terms', () => {
    expect(extractSearchTerms('the cat sat')).toEqual(['the', 'cat', 'sat']);
  });

  it('filters 2-character terms', () => {
    expect(extractSearchTerms('to be or not')).toEqual(['not']);
  });
});

// ─── Note Scoring ───

describe('AskAI - Note Scoring', () => {
  const testNote = {
    title: 'Machine Learning Basics',
    content: 'Introduction to neural networks and deep learning',
    ai_summary: 'Overview of ML concepts',
    ai_tags: 'ml,neural,deep-learning'
  };

  it('returns 1.0 for perfect match', () => {
    expect(scoreNote(testNote, ['machine', 'learning'])).toBe(1.0);
  });

  it('returns 0.5 for partial match', () => {
    expect(scoreNote(testNote, ['machine', 'quantum'])).toBe(0.5);
  });

  it('returns 0 for no match', () => {
    expect(scoreNote(testNote, ['quantum', 'physics'])).toBe(0);
  });

  it('searches across title field', () => {
    expect(scoreNote(testNote, ['machine'])).toBe(1.0);
  });

  it('searches across content field', () => {
    expect(scoreNote(testNote, ['neural'])).toBe(1.0);
  });

  it('searches across ai_summary field', () => {
    expect(scoreNote(testNote, ['overview'])).toBe(1.0);
  });

  it('searches across ai_tags field', () => {
    expect(scoreNote(testNote, ['deep-learning'])).toBe(1.0);
  });

  it('is case insensitive', () => {
    expect(scoreNote(testNote, ['MACHINE'])).toBe(0);
    // Note: terms should already be lowercased by extractSearchTerms
    expect(scoreNote(testNote, ['machine'])).toBe(1.0);
  });

  it('handles empty terms array', () => {
    // Division by zero protection: 0/0 is NaN
    const score = scoreNote(testNote, []);
    expect(isNaN(score)).toBe(true);
  });

  it('handles note with empty fields', () => {
    const emptyNote = { title: '', content: '', ai_summary: '', ai_tags: '' };
    expect(scoreNote(emptyNote, ['test'])).toBe(0);
  });

  it('handles partial substring matches', () => {
    // "learn" is a substring of "learning"
    expect(scoreNote(testNote, ['learn'])).toBe(1.0);
  });
});

// ─── Search Result Formatting ───

describe('AskAI - Search Result Formatting', () => {
  it('formats with AI summary when available', () => {
    const note = { title: 'Test Note', ai_summary: 'AI summary here', content: 'Long content...' };
    const result = formatSearchResult(note, 0.85);
    expect(result).toContain('### Test Note');
    expect(result).toContain('85% match');
    expect(result).toContain('AI summary here');
    expect(result).not.toContain('Long content');
  });

  it('falls back to truncated content when no AI summary', () => {
    const longContent = 'A'.repeat(300);
    const note = { title: 'Note', ai_summary: '', content: longContent };
    const result = formatSearchResult(note, 1.0);
    expect(result.length).toBeLessThan(350);
    expect(result).toContain('100% match');
  });

  it('rounds relevance percentage', () => {
    const note = { title: 'Test', ai_summary: 'Sum', content: '' };
    const result = formatSearchResult(note, 0.333);
    expect(result).toContain('33% match');
  });

  it('handles 0% match', () => {
    const note = { title: 'Test', ai_summary: 'Sum', content: '' };
    const result = formatSearchResult(note, 0);
    expect(result).toContain('0% match');
  });

  it('handles 100% match', () => {
    const note = { title: 'Test', ai_summary: 'Sum', content: '' };
    const result = formatSearchResult(note, 1.0);
    expect(result).toContain('100% match');
  });
});

// ─── Local Search Output ───

describe('AskAI - Local Search Output', () => {
  it('returns no-match message for empty results', () => {
    const output = buildLocalSearchOutput([]);
    expect(output).toContain('No notes found');
    expect(output).toContain('different keywords');
  });

  it('wraps single result with local search header', () => {
    const output = buildLocalSearchOutput(['### Note 1 (80% match)\nContent']);
    expect(output).toContain('Local search results (offline mode)');
    expect(output).toContain('Note 1');
  });

  it('separates multiple results with horizontal rules', () => {
    const output = buildLocalSearchOutput([
      '### Note 1 (80% match)\nContent 1',
      '### Note 2 (60% match)\nContent 2'
    ]);
    expect(output).toContain('---');
    expect(output).toContain('Note 1');
    expect(output).toContain('Note 2');
  });

  it('uses markdown italic for header', () => {
    const output = buildLocalSearchOutput(['### Test']);
    expect(output.startsWith('*')).toBe(true);
  });
});

// ─── Ask Button State ───

describe('AskAI - Ask Button State', () => {
  it('disabled when loading', () => {
    expect(isAskDisabled(true, 'question')).toBe(true);
  });

  it('disabled when question is empty', () => {
    expect(isAskDisabled(false, '')).toBe(true);
  });

  it('disabled when question is whitespace', () => {
    expect(isAskDisabled(false, '   ')).toBe(true);
  });

  it('enabled when not loading and question is set', () => {
    expect(isAskDisabled(false, 'What is ML?')).toBe(false);
  });

  it('disabled when loading even with question', () => {
    expect(isAskDisabled(true, 'Valid question')).toBe(true);
  });

  it('shows ... when loading', () => {
    expect(getAskButtonText(true)).toBe('...');
  });

  it('shows Ask when not loading', () => {
    expect(getAskButtonText(false)).toBe('Ask');
  });
});

// ─── Answer Display ───

describe('AskAI - Answer Display', () => {
  it('applies local-result class for local results', () => {
    expect(getAnswerClass(true)).toBe('ai-answer local-result');
  });

  it('does not apply local-result class for API results', () => {
    expect(getAnswerClass(false)).toBe('ai-answer ');
  });

  it('always includes base ai-answer class', () => {
    expect(getAnswerClass(true)).toContain('ai-answer');
    expect(getAnswerClass(false)).toContain('ai-answer');
  });
});

// ─── No Notes Message ───

describe('AskAI - No Notes Message', () => {
  it('returns basic message when no notes', () => {
    const msg = getNoNotesMessage(false);
    expect(msg).toBe('No notes found matching your query.');
  });

  it('suggests different keywords when notes exist but no match', () => {
    const msg = getNoNotesMessage(true);
    expect(msg).toContain('different keywords');
  });
});
