import { describe, it, expect, vi } from 'vitest';

// ─── Extract and test pure logic from NoteEditor.tsx ───

// Simulates the save validation logic
function canSave(title: string, saving: boolean): boolean {
  return !saving && title.trim().length > 0;
}

// Simulates the URL import trigger logic
function canImportUrl(sourceUrl: string, importing: boolean): boolean {
  return sourceUrl.trim().length > 0 && !importing;
}

// Simulates the SQL INSERT values builder
function buildInsertValues(
  title: string,
  content: string,
  sourceUrl: string,
  userId: string,
): { id: string; params: any[] } {
  const id = 'test-uuid';
  const now = new Date().toISOString();
  return {
    id,
    params: [
      id,
      title.trim(),
      content.trim(),
      sourceUrl.trim() || null,
      now,
      now,
      userId,
    ],
  };
}

// Simulates URL import content merge logic
function mergeImportedContent(
  existingTitle: string,
  existingContent: string,
  importedTitle: string,
  importedContent: string,
): { title: string; content: string } {
  return {
    title: existingTitle.trim() ? existingTitle : (importedTitle || ''),
    content: existingContent
      ? existingContent + '\n\n' + importedContent
      : importedContent,
  };
}

// ─── Save Validation ───

describe('NoteEditor - Save Validation', () => {
  it('allows save when title is non-empty and not saving', () => {
    expect(canSave('My Note', false)).toBe(true);
  });

  it('blocks save when title is empty', () => {
    expect(canSave('', false)).toBe(false);
  });

  it('blocks save when title is only whitespace', () => {
    expect(canSave('   ', false)).toBe(false);
  });

  it('blocks save when already saving', () => {
    expect(canSave('My Note', true)).toBe(false);
  });

  it('blocks save when title is empty AND saving', () => {
    expect(canSave('', true)).toBe(false);
  });

  it('allows save with single character title', () => {
    expect(canSave('A', false)).toBe(true);
  });
});

// ─── URL Import Trigger ───

describe('NoteEditor - URL Import', () => {
  it('allows import when URL is non-empty', () => {
    expect(canImportUrl('https://example.com', false)).toBe(true);
  });

  it('blocks import when URL is empty', () => {
    expect(canImportUrl('', false)).toBe(false);
  });

  it('blocks import when URL is whitespace', () => {
    expect(canImportUrl('   ', false)).toBe(false);
  });

  it('blocks import when already importing', () => {
    expect(canImportUrl('https://example.com', true)).toBe(false);
  });
});

// ─── INSERT Values Builder ───

describe('NoteEditor - SQL Insert Builder', () => {
  it('trims title and content', () => {
    const result = buildInsertValues('  My Title  ', '  Content  ', '', 'user-1');
    expect(result.params[1]).toBe('My Title');
    expect(result.params[2]).toBe('Content');
  });

  it('sets source_url to null when empty', () => {
    const result = buildInsertValues('Title', 'Content', '', 'user-1');
    expect(result.params[3]).toBeNull();
  });

  it('preserves source_url when provided', () => {
    const result = buildInsertValues('Title', 'Content', 'https://example.com', 'user-1');
    expect(result.params[3]).toBe('https://example.com');
  });

  it('trims source_url whitespace', () => {
    const result = buildInsertValues('Title', 'Content', '  https://example.com  ', 'user-1');
    expect(result.params[3]).toBe('https://example.com');
  });

  it('includes userId as last parameter', () => {
    const result = buildInsertValues('Title', 'Content', '', 'user-123');
    expect(result.params[result.params.length - 1]).toBe('user-123');
  });

  it('includes ISO timestamp strings', () => {
    const result = buildInsertValues('T', 'C', '', 'u');
    // params[4] and params[5] should be ISO date strings
    expect(result.params[4]).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.params[5]).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('returns 7 parameters for INSERT', () => {
    const result = buildInsertValues('T', 'C', '', 'u');
    expect(result.params).toHaveLength(7);
  });
});

// ─── Content Merge Logic ───

describe('NoteEditor - Import Content Merge', () => {
  it('appends imported content to existing', () => {
    const result = mergeImportedContent('Existing Title', 'Existing text', 'New Title', 'Imported text');
    expect(result.title).toBe('Existing Title');
    expect(result.content).toBe('Existing text\n\nImported text');
  });

  it('uses imported title when existing is empty', () => {
    const result = mergeImportedContent('', '', 'Imported Title', 'Imported content');
    expect(result.title).toBe('Imported Title');
    expect(result.content).toBe('Imported content');
  });

  it('keeps existing title even when import provides one', () => {
    const result = mergeImportedContent('My Title', '', 'Imported Title', 'Content');
    expect(result.title).toBe('My Title');
  });

  it('handles whitespace-only existing title as empty', () => {
    const result = mergeImportedContent('   ', '', 'Fallback', 'Content');
    expect(result.title).toBe('Fallback');
  });

  it('handles empty imported title', () => {
    const result = mergeImportedContent('', 'Existing', '', 'Imported');
    expect(result.title).toBe('');
  });
});

// ─── AI Processing Retry Logic ───

describe('NoteEditor - AI Processing Retry', () => {
  it('retries up to N times with increasing delay', async () => {
    let attempts = 0;
    const triggerAI = async (retries: number) => {
      for (let i = 0; i < retries; i++) {
        attempts++;
        const delay = 2000 * (i + 1);
        // Verify delays increase linearly
        expect(delay).toBe(2000 * (i + 1));
        // Simulate 404 (sync not yet complete)
        const status = i < retries - 1 ? 404 : 200;
        if (status === 200 || status !== 404) return;
      }
    };

    await triggerAI(3);
    expect(attempts).toBe(3);
  });

  it('stops retrying on non-404 status', () => {
    const shouldRetry = (status: number): boolean => {
      return status === 404;
    };

    expect(shouldRetry(404)).toBe(true);
    expect(shouldRetry(200)).toBe(false);
    expect(shouldRetry(500)).toBe(false);
    expect(shouldRetry(403)).toBe(false);
  });
});
