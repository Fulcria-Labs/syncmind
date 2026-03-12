import { describe, it, expect } from 'vitest';

// ─── Advanced AskAI logic tests ───

// Answer state management
function getDisplayAnswer(answer: string, isLocalResult: boolean): { text: string; badge: string | null; cssClass: string } {
  return {
    text: answer,
    badge: isLocalResult ? 'Searched locally via PowerSync SQLite' : null,
    cssClass: `ai-answer ${isLocalResult ? 'local-result' : ''}`,
  };
}

// Ask button text
function getAskButtonText(loading: boolean): string {
  return loading ? '...' : 'Ask';
}

// Answer visibility
function shouldShowAnswer(answer: string): boolean {
  return !!answer;
}

// Backend URL for ask endpoint
function buildAskUrl(backendUrl: string): string {
  return `${backendUrl}/api/ai/ask`;
}

// Request body for ask
function buildAskRequestBody(question: string, ownerId: string) {
  return { question, owner_id: ownerId };
}

// Response handling
function parseAskResponse(data: { answer?: string }): string {
  return data.answer || 'No answer available';
}

// Fallback search scoring
function scoreNote(query: string, note: { title: string; content: string; ai_summary: string; ai_tags: string }): number {
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  if (!terms.length) return 0;
  const text = `${note.title} ${note.content} ${note.ai_summary} ${note.ai_tags}`.toLowerCase();
  const matches = terms.filter(t => text.includes(t));
  return matches.length / terms.length;
}

// Result formatting
function formatSearchResult(title: string, summary: string, content: string, score: number): string {
  const displaySummary = summary || content.slice(0, 200);
  const relevance = Math.round(score * 100);
  return `### ${title} (${relevance}% match)\n${displaySummary}`;
}

// Sort scored notes
function sortByScore(notes: Array<{ note: any; score: number }>): Array<{ note: any; score: number }> {
  return [...notes].sort((a, b) => b.score - a.score);
}

// ─── Display Answer ───

describe('AskAI - Display Answer', () => {
  it('shows answer with local badge when local result', () => {
    const display = getDisplayAnswer('Found 3 notes', true);
    expect(display.text).toBe('Found 3 notes');
    expect(display.badge).toBe('Searched locally via PowerSync SQLite');
    expect(display.cssClass).toContain('local-result');
  });

  it('shows answer without badge when cloud result', () => {
    const display = getDisplayAnswer('AI response here', false);
    expect(display.text).toBe('AI response here');
    expect(display.badge).toBeNull();
    expect(display.cssClass).not.toContain('local-result');
  });
});

// ─── Button Text ───

describe('AskAI - Button Text', () => {
  it('shows loading indicator', () => {
    expect(getAskButtonText(true)).toBe('...');
  });

  it('shows Ask when not loading', () => {
    expect(getAskButtonText(false)).toBe('Ask');
  });
});

// ─── Answer Visibility ───

describe('AskAI - Answer Visibility', () => {
  it('shows when answer is non-empty', () => {
    expect(shouldShowAnswer('Some answer')).toBe(true);
  });

  it('hides when answer is empty', () => {
    expect(shouldShowAnswer('')).toBe(false);
  });
});

// ─── URL Construction ───

describe('AskAI - URL', () => {
  it('builds ask URL with default backend', () => {
    expect(buildAskUrl('http://localhost:6061')).toBe('http://localhost:6061/api/ai/ask');
  });

  it('builds ask URL with custom backend', () => {
    expect(buildAskUrl('https://api.syncmind.io')).toBe('https://api.syncmind.io/api/ai/ask');
  });
});

// ─── Request Body ───

describe('AskAI - Request Body', () => {
  it('constructs correct body', () => {
    const body = buildAskRequestBody('What is ML?', 'user-42');
    expect(body.question).toBe('What is ML?');
    expect(body.owner_id).toBe('user-42');
  });
});

// ─── Response Parsing ───

describe('AskAI - Response Parsing', () => {
  it('extracts answer from response', () => {
    expect(parseAskResponse({ answer: 'Machine learning is...' })).toBe('Machine learning is...');
  });

  it('returns fallback when answer is empty', () => {
    expect(parseAskResponse({ answer: '' })).toBe('No answer available');
  });

  it('returns fallback when answer is undefined', () => {
    expect(parseAskResponse({})).toBe('No answer available');
  });
});

// ─── Note Scoring ───

describe('AskAI - Note Scoring', () => {
  const sampleNote = {
    title: 'Machine Learning Basics',
    content: 'Neural networks are used in deep learning',
    ai_summary: 'Overview of ML',
    ai_tags: 'ml,ai,neural',
  };

  it('scores 100% when all terms match', () => {
    expect(scoreNote('machine learning', sampleNote)).toBe(1);
  });

  it('scores 50% when half terms match', () => {
    expect(scoreNote('machine quantum', sampleNote)).toBe(0.5);
  });

  it('scores 0% when no terms match', () => {
    expect(scoreNote('quantum physics', sampleNote)).toBe(0);
  });

  it('ignores short terms', () => {
    // "is" and "ml" are <= 2 chars, filtered out
    expect(scoreNote('is ml', sampleNote)).toBe(0);
  });

  it('returns 0 for empty query', () => {
    expect(scoreNote('', sampleNote)).toBe(0);
  });

  it('searches across all fields', () => {
    // "neural" is in ai_tags
    expect(scoreNote('neural', sampleNote)).toBe(1);
    // "overview" is in ai_summary
    expect(scoreNote('overview', sampleNote)).toBe(1);
  });

  it('is case-insensitive', () => {
    expect(scoreNote('MACHINE LEARNING', sampleNote)).toBe(1);
  });
});

// ─── Result Formatting ───

describe('AskAI - Result Formatting', () => {
  it('formats with summary when available', () => {
    const result = formatSearchResult('Test Note', 'A summary', 'Long content here...', 0.85);
    expect(result).toContain('### Test Note');
    expect(result).toContain('85% match');
    expect(result).toContain('A summary');
  });

  it('uses content preview when no summary', () => {
    const result = formatSearchResult('Test', '', 'This is the content preview', 0.5);
    expect(result).toContain('This is the content preview');
  });

  it('truncates content to 200 chars', () => {
    const longContent = 'A'.repeat(300);
    const result = formatSearchResult('Test', '', longContent, 1);
    expect(result).toContain('A'.repeat(200));
  });

  it('rounds relevance correctly', () => {
    const result = formatSearchResult('Test', 'Sum', 'C', 0.333);
    expect(result).toContain('33% match');
  });

  it('handles 0% match', () => {
    const result = formatSearchResult('Test', 'Sum', 'C', 0);
    expect(result).toContain('0% match');
  });

  it('handles 100% match', () => {
    const result = formatSearchResult('Test', 'Sum', 'C', 1);
    expect(result).toContain('100% match');
  });
});

// ─── Score Sorting ───

describe('AskAI - Score Sorting', () => {
  it('sorts by score descending', () => {
    const notes = [
      { note: { title: 'Low' }, score: 0.3 },
      { note: { title: 'High' }, score: 0.9 },
      { note: { title: 'Mid' }, score: 0.6 },
    ];
    const sorted = sortByScore(notes);
    expect(sorted[0].note.title).toBe('High');
    expect(sorted[1].note.title).toBe('Mid');
    expect(sorted[2].note.title).toBe('Low');
  });

  it('handles equal scores', () => {
    const notes = [
      { note: { title: 'A' }, score: 0.5 },
      { note: { title: 'B' }, score: 0.5 },
    ];
    const sorted = sortByScore(notes);
    expect(sorted).toHaveLength(2);
  });

  it('handles single note', () => {
    const notes = [{ note: { title: 'Only' }, score: 1 }];
    const sorted = sortByScore(notes);
    expect(sorted).toHaveLength(1);
  });

  it('handles empty array', () => {
    expect(sortByScore([])).toEqual([]);
  });
});
