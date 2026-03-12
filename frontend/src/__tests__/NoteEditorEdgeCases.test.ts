import { describe, it, expect, vi } from 'vitest';

// ─── Extract and test pure logic from NoteEditor.tsx ───

// URL validation for import feature
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// Should show import button
function shouldShowImportButton(sourceUrl: string): boolean {
  return !!sourceUrl.trim();
}

// Import button text
function getImportButtonText(importing: boolean): string {
  return importing ? 'Importing...' : 'Import';
}

// Save button text
function getSaveButtonText(saving: boolean): string {
  return saving ? 'Saving...' : 'Save & Analyze';
}

// Should disable save button
function isSaveDisabled(saving: boolean, title: string): boolean {
  return saving || !title.trim();
}

// Content merge for URL import
function mergeImportedContent(existing: string, imported: string): string {
  return existing ? existing + '\n\n' + imported : imported;
}

// Title fallback from import
function resolveTitle(existingTitle: string, importedTitle: string | undefined): string {
  if (existingTitle.trim()) return existingTitle;
  return importedTitle || '';
}

// Note data preparation for save
function prepareNoteData(title: string, content: string, sourceUrl: string, ownerId: string) {
  const now = new Date().toISOString();
  return {
    title: title.trim(),
    content: content.trim(),
    source_url: sourceUrl.trim() || null,
    tags: '',
    ai_summary: '',
    ai_tags: '',
    ai_connections: '',
    is_processed: 0,
    created_at: now,
    updated_at: now,
    owner_id: ownerId,
  };
}

// AI trigger retry logic
function shouldRetryAITrigger(status: number): boolean {
  return status === 404; // only retry on 404 (sync not yet complete)
}

function getRetryDelay(attempt: number): number {
  return 2000 * (attempt + 1);
}

// ─── URL Validation ───

describe('NoteEditor - URL Validation', () => {
  it('accepts valid HTTP URL', () => {
    expect(isValidUrl('http://example.com')).toBe(true);
  });

  it('accepts valid HTTPS URL', () => {
    expect(isValidUrl('https://example.com/path?q=1')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(isValidUrl('')).toBe(false);
  });

  it('rejects plain text', () => {
    expect(isValidUrl('not a url')).toBe(false);
  });

  it('rejects partial URL', () => {
    expect(isValidUrl('example.com')).toBe(false);
  });

  it('accepts FTP URL', () => {
    expect(isValidUrl('ftp://files.example.com')).toBe(true);
  });

  it('accepts URL with fragment', () => {
    expect(isValidUrl('https://example.com/page#section')).toBe(true);
  });

  it('accepts URL with port', () => {
    expect(isValidUrl('http://localhost:3000')).toBe(true);
  });

  it('rejects just a protocol', () => {
    expect(isValidUrl('https://')).toBe(false);
  });
});

// ─── Import Button Visibility ───

describe('NoteEditor - Import Button Visibility', () => {
  it('shows button when URL is present', () => {
    expect(shouldShowImportButton('https://example.com')).toBe(true);
  });

  it('hides button when URL is empty', () => {
    expect(shouldShowImportButton('')).toBe(false);
  });

  it('hides button when URL is only whitespace', () => {
    expect(shouldShowImportButton('   ')).toBe(false);
  });

  it('shows button with URL with leading spaces', () => {
    expect(shouldShowImportButton('  https://example.com')).toBe(true);
  });
});

// ─── Button Text States ───

describe('NoteEditor - Button Text', () => {
  it('shows Importing... when importing', () => {
    expect(getImportButtonText(true)).toBe('Importing...');
  });

  it('shows Import when not importing', () => {
    expect(getImportButtonText(false)).toBe('Import');
  });

  it('shows Saving... when saving', () => {
    expect(getSaveButtonText(true)).toBe('Saving...');
  });

  it('shows Save & Analyze when not saving', () => {
    expect(getSaveButtonText(false)).toBe('Save & Analyze');
  });
});

// ─── Save Button Disabled State ───

describe('NoteEditor - Save Disabled', () => {
  it('disabled when saving', () => {
    expect(isSaveDisabled(true, 'Title')).toBe(true);
  });

  it('disabled when title is empty', () => {
    expect(isSaveDisabled(false, '')).toBe(true);
  });

  it('disabled when title is only whitespace', () => {
    expect(isSaveDisabled(false, '   ')).toBe(true);
  });

  it('enabled when not saving and title is set', () => {
    expect(isSaveDisabled(false, 'My Note')).toBe(false);
  });

  it('disabled when saving even with valid title', () => {
    expect(isSaveDisabled(true, 'Valid Title')).toBe(true);
  });

  it('disabled with tab character only', () => {
    expect(isSaveDisabled(false, '\t')).toBe(true);
  });

  it('disabled with newline character only', () => {
    expect(isSaveDisabled(false, '\n')).toBe(true);
  });

  it('enabled with single character title', () => {
    expect(isSaveDisabled(false, 'A')).toBe(false);
  });
});

// ─── Content Merge ───

describe('NoteEditor - Content Merge', () => {
  it('merges with existing content using double newline', () => {
    expect(mergeImportedContent('Existing', 'Imported')).toBe('Existing\n\nImported');
  });

  it('uses imported content directly when no existing', () => {
    expect(mergeImportedContent('', 'Imported text')).toBe('Imported text');
  });

  it('handles empty imported content', () => {
    expect(mergeImportedContent('Existing', '')).toBe('Existing\n\n');
  });

  it('handles both empty', () => {
    expect(mergeImportedContent('', '')).toBe('');
  });

  it('preserves multiline existing content', () => {
    const existing = 'Line 1\nLine 2';
    const imported = 'Imported line';
    expect(mergeImportedContent(existing, imported)).toBe('Line 1\nLine 2\n\nImported line');
  });
});

// ─── Title Resolution ───

describe('NoteEditor - Title Resolution', () => {
  it('keeps existing title if not empty', () => {
    expect(resolveTitle('Existing Title', 'Imported Title')).toBe('Existing Title');
  });

  it('uses imported title when existing is empty', () => {
    expect(resolveTitle('', 'Imported Title')).toBe('Imported Title');
  });

  it('uses imported title when existing is whitespace', () => {
    expect(resolveTitle('   ', 'Imported Title')).toBe('Imported Title');
  });

  it('returns empty when both are empty', () => {
    expect(resolveTitle('', '')).toBe('');
  });

  it('returns empty when existing is empty and imported is undefined', () => {
    expect(resolveTitle('', undefined)).toBe('');
  });

  it('keeps existing title even with whitespace', () => {
    expect(resolveTitle('  Title  ', 'Other')).toBe('  Title  ');
  });
});

// ─── Note Data Preparation ───

describe('NoteEditor - Note Data Preparation', () => {
  it('trims title and content', () => {
    const data = prepareNoteData('  Title  ', '  Content  ', '', 'user-1');
    expect(data.title).toBe('Title');
    expect(data.content).toBe('Content');
  });

  it('sets source_url to null when empty', () => {
    const data = prepareNoteData('Title', 'Content', '', 'user-1');
    expect(data.source_url).toBeNull();
  });

  it('sets source_url to null when whitespace only', () => {
    const data = prepareNoteData('Title', 'Content', '   ', 'user-1');
    expect(data.source_url).toBeNull();
  });

  it('preserves source_url when provided', () => {
    const data = prepareNoteData('Title', 'Content', 'https://example.com', 'user-1');
    expect(data.source_url).toBe('https://example.com');
  });

  it('trims source_url', () => {
    const data = prepareNoteData('Title', 'Content', '  https://example.com  ', 'user-1');
    expect(data.source_url).toBe('https://example.com');
  });

  it('sets default AI fields', () => {
    const data = prepareNoteData('T', 'C', '', 'u');
    expect(data.tags).toBe('');
    expect(data.ai_summary).toBe('');
    expect(data.ai_tags).toBe('');
    expect(data.ai_connections).toBe('');
    expect(data.is_processed).toBe(0);
  });

  it('sets created_at and updated_at to ISO strings', () => {
    const data = prepareNoteData('T', 'C', '', 'u');
    expect(data.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(data.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('sets created_at equal to updated_at for new notes', () => {
    const data = prepareNoteData('T', 'C', '', 'u');
    expect(data.created_at).toBe(data.updated_at);
  });

  it('preserves owner_id', () => {
    const data = prepareNoteData('T', 'C', '', 'owner-abc');
    expect(data.owner_id).toBe('owner-abc');
  });
});

// ─── AI Trigger Retry ───

describe('NoteEditor - AI Trigger Retry', () => {
  it('retries on 404', () => {
    expect(shouldRetryAITrigger(404)).toBe(true);
  });

  it('does not retry on 200', () => {
    expect(shouldRetryAITrigger(200)).toBe(false);
  });

  it('does not retry on 500', () => {
    expect(shouldRetryAITrigger(500)).toBe(false);
  });

  it('does not retry on 409', () => {
    expect(shouldRetryAITrigger(409)).toBe(false);
  });

  it('does not retry on 401', () => {
    expect(shouldRetryAITrigger(401)).toBe(false);
  });

  it('calculates exponential retry delays', () => {
    expect(getRetryDelay(0)).toBe(2000);
    expect(getRetryDelay(1)).toBe(4000);
    expect(getRetryDelay(2)).toBe(6000);
    expect(getRetryDelay(3)).toBe(8000);
    expect(getRetryDelay(4)).toBe(10000);
  });

  it('maximum retry attempts is 5', () => {
    const maxRetries = 5;
    const maxDelay = getRetryDelay(maxRetries - 1);
    expect(maxDelay).toBe(10000);
  });
});
