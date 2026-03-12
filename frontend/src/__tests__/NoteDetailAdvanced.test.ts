import { describe, it, expect } from 'vitest';

// ─── Advanced NoteDetail logic tests ───

// Date formatting for display
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return '';
  }
}

// Tag splitting from comma-separated string
function splitTags(aiTags: string | null | undefined): string[] {
  if (!aiTags) return [];
  return aiTags.split(',').filter(Boolean).map(t => t.trim());
}

// Connection direction arrow
function getDirectionArrow(direction: 'out' | 'in'): string {
  return direction === 'out' ? '->' : '<-';
}

// Should show reprocess button
function shouldShowReprocess(isProcessed: boolean | number): boolean {
  return true; // Always available
}

// Note not found check
function isNoteFound(notes: any[]): boolean {
  return notes.length > 0;
}

// Local keyword display condition
function shouldShowLocalKeywords(aiTags: string | null, localKeywords: string[]): boolean {
  return !aiTags && localKeywords.length > 0;
}

// Local summary display condition
function shouldShowLocalSummary(aiSummary: string | null, localSummaryText: string): boolean {
  return !aiSummary && !!localSummaryText;
}

// AI summary display condition
function shouldShowAiSummary(aiSummary: string | null | undefined): boolean {
  return !!aiSummary;
}

// Connection navigation target
function getNavigationTarget(conn: { direction: 'out' | 'in'; target_note_id?: string; source_note_id?: string }): string {
  return (conn.direction === 'out' ? conn.target_note_id : conn.source_note_id) ?? '';
}

// Delete confirmation message
function getDeleteConfirmMessage(title: string | null | undefined): string {
  return `Delete "${title || 'this note'}"? This cannot be undone.`;
}

// Edit state initialization
function initEditState(note: { title?: string; content?: string; source_url?: string }) {
  return {
    editTitle: note.title || '',
    editContent: note.content || '',
    editUrl: note.source_url || '',
  };
}

// AI retry logic - should retry based on HTTP status
function shouldRetryAI(status: number): boolean {
  return status === 404;
}

// AI retry delay calculation
function getRetryDelay(attempt: number): number {
  return 2000 * (attempt + 1);
}

// ─── Date Formatting ───

describe('NoteDetail - Date Formatting', () => {
  it('formats ISO date string', () => {
    const result = formatDate('2026-03-12T10:30:00Z');
    expect(result).toBeTruthy();
    expect(result).toMatch(/\d/);
  });

  it('returns empty for null date', () => {
    expect(formatDate(null)).toBe('');
  });

  it('returns empty for undefined date', () => {
    expect(formatDate(undefined)).toBe('');
  });

  it('returns empty for empty string', () => {
    expect(formatDate('')).toBe('');
  });
});

// ─── Tag Splitting ───

describe('NoteDetail - Tag Splitting', () => {
  it('splits comma-separated tags', () => {
    expect(splitTags('ml,ai,python')).toEqual(['ml', 'ai', 'python']);
  });

  it('trims whitespace', () => {
    expect(splitTags(' ml , ai , python ')).toEqual(['ml', 'ai', 'python']);
  });

  it('filters empty segments', () => {
    expect(splitTags('ml,,ai,,')).toEqual(['ml', 'ai']);
  });

  it('handles null tags', () => {
    expect(splitTags(null)).toEqual([]);
  });

  it('handles undefined tags', () => {
    expect(splitTags(undefined)).toEqual([]);
  });

  it('handles empty string', () => {
    expect(splitTags('')).toEqual([]);
  });

  it('handles single tag', () => {
    expect(splitTags('python')).toEqual(['python']);
  });

  it('handles tags with special characters', () => {
    expect(splitTags('machine-learning,deep_learning,ai-2.0')).toEqual(['machine-learning', 'deep_learning', 'ai-2.0']);
  });
});

// ─── Connection Direction ───

describe('NoteDetail - Connection Direction', () => {
  it('returns arrow for outbound connection', () => {
    expect(getDirectionArrow('out')).toBe('->');
  });

  it('returns arrow for inbound connection', () => {
    expect(getDirectionArrow('in')).toBe('<-');
  });
});

// ─── Note Found Check ───

describe('NoteDetail - Note Found', () => {
  it('returns true when notes exist', () => {
    expect(isNoteFound([{ id: 'n1', title: 'Test' }])).toBe(true);
  });

  it('returns false when notes array is empty', () => {
    expect(isNoteFound([])).toBe(false);
  });
});

// ─── Local Keyword Display ───

describe('NoteDetail - Local Keyword Display', () => {
  it('shows local keywords when no AI tags', () => {
    expect(shouldShowLocalKeywords(null, ['machine', 'learning'])).toBe(true);
  });

  it('hides local keywords when AI tags exist', () => {
    expect(shouldShowLocalKeywords('ml,ai', ['machine', 'learning'])).toBe(false);
  });

  it('hides local keywords when empty array', () => {
    expect(shouldShowLocalKeywords(null, [])).toBe(false);
  });

  it('hides when AI tags exist even with empty string', () => {
    // Note: empty string is falsy, so local keywords would show
    expect(shouldShowLocalKeywords('', ['machine'])).toBe(true);
  });
});

// ─── Local Summary Display ───

describe('NoteDetail - Local Summary Display', () => {
  it('shows local summary when no AI summary', () => {
    expect(shouldShowLocalSummary(null, 'Generated summary text')).toBe(true);
  });

  it('hides local summary when AI summary exists', () => {
    expect(shouldShowLocalSummary('AI generated summary', 'Local summary')).toBe(false);
  });

  it('hides when local summary is empty', () => {
    expect(shouldShowLocalSummary(null, '')).toBe(false);
  });
});

// ─── AI Summary Display ───

describe('NoteDetail - AI Summary Display', () => {
  it('shows when AI summary exists', () => {
    expect(shouldShowAiSummary('This is an AI summary')).toBe(true);
  });

  it('hides when null', () => {
    expect(shouldShowAiSummary(null)).toBe(false);
  });

  it('hides when undefined', () => {
    expect(shouldShowAiSummary(undefined)).toBe(false);
  });

  it('hides when empty string', () => {
    expect(shouldShowAiSummary('')).toBe(false);
  });
});

// ─── Connection Navigation ───

describe('NoteDetail - Connection Navigation', () => {
  it('navigates to target for outbound connections', () => {
    expect(getNavigationTarget({ direction: 'out', target_note_id: 'n2', source_note_id: 'n1' })).toBe('n2');
  });

  it('navigates to source for inbound connections', () => {
    expect(getNavigationTarget({ direction: 'in', target_note_id: 'n2', source_note_id: 'n1' })).toBe('n1');
  });

  it('returns empty string when target_note_id is undefined', () => {
    expect(getNavigationTarget({ direction: 'out' })).toBe('');
  });

  it('returns empty string when source_note_id is undefined', () => {
    expect(getNavigationTarget({ direction: 'in' })).toBe('');
  });
});

// ─── Delete Confirmation ───

describe('NoteDetail - Delete Confirmation', () => {
  it('includes note title in message', () => {
    expect(getDeleteConfirmMessage('ML Research')).toBe('Delete "ML Research"? This cannot be undone.');
  });

  it('uses fallback for null title', () => {
    expect(getDeleteConfirmMessage(null)).toBe('Delete "this note"? This cannot be undone.');
  });

  it('uses fallback for undefined title', () => {
    expect(getDeleteConfirmMessage(undefined)).toBe('Delete "this note"? This cannot be undone.');
  });

  it('uses fallback for empty title', () => {
    expect(getDeleteConfirmMessage('')).toBe('Delete "this note"? This cannot be undone.');
  });

  it('includes special characters in title', () => {
    expect(getDeleteConfirmMessage('My "Special" Note')).toContain('My "Special" Note');
  });
});

// ─── Edit State Initialization ───

describe('NoteDetail - Edit State Init', () => {
  it('initializes from note data', () => {
    const state = initEditState({ title: 'Test', content: 'Content', source_url: 'https://example.com' });
    expect(state.editTitle).toBe('Test');
    expect(state.editContent).toBe('Content');
    expect(state.editUrl).toBe('https://example.com');
  });

  it('uses empty defaults for missing fields', () => {
    const state = initEditState({});
    expect(state.editTitle).toBe('');
    expect(state.editContent).toBe('');
    expect(state.editUrl).toBe('');
  });

  it('handles undefined source_url', () => {
    const state = initEditState({ title: 'Test', content: 'Content' });
    expect(state.editUrl).toBe('');
  });
});

// ─── AI Retry Logic ───

describe('NoteDetail - AI Retry Logic', () => {
  it('retries on 404 (sync not yet complete)', () => {
    expect(shouldRetryAI(404)).toBe(true);
  });

  it('does not retry on 200 (success)', () => {
    expect(shouldRetryAI(200)).toBe(false);
  });

  it('does not retry on 500 (server error)', () => {
    expect(shouldRetryAI(500)).toBe(false);
  });

  it('does not retry on 403 (forbidden)', () => {
    expect(shouldRetryAI(403)).toBe(false);
  });

  it('does not retry on 400 (bad request)', () => {
    expect(shouldRetryAI(400)).toBe(false);
  });
});

// ─── Retry Delay Calculation ───

describe('NoteDetail - Retry Delay', () => {
  it('first attempt: 2 seconds', () => {
    expect(getRetryDelay(0)).toBe(2000);
  });

  it('second attempt: 4 seconds', () => {
    expect(getRetryDelay(1)).toBe(4000);
  });

  it('third attempt: 6 seconds', () => {
    expect(getRetryDelay(2)).toBe(6000);
  });

  it('fourth attempt: 8 seconds', () => {
    expect(getRetryDelay(3)).toBe(8000);
  });

  it('fifth attempt: 10 seconds', () => {
    expect(getRetryDelay(4)).toBe(10000);
  });

  it('increases linearly', () => {
    const delays = Array.from({ length: 5 }, (_, i) => getRetryDelay(i));
    for (let i = 1; i < delays.length; i++) {
      expect(delays[i] - delays[i - 1]).toBe(2000);
    }
  });
});
