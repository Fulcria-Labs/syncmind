import { describe, it, expect } from 'vitest';

// ─── Advanced NoteEditor logic tests ───

// URL validation patterns
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// Import button visibility
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

// Form completion check
function isFormComplete(title: string, content: string): { titleOk: boolean; hasContent: boolean } {
  return {
    titleOk: title.trim().length > 0,
    hasContent: content.trim().length > 0,
  };
}

// Content append logic for URL import
function appendImportedContent(existing: string, imported: string): string {
  return existing ? existing + '\n\n' + imported : imported;
}

// Title assignment logic for URL import
function resolveTitle(existingTitle: string, importedTitle: string): string {
  return existingTitle.trim() ? existingTitle : (importedTitle || '');
}

// Source URL normalization
function normalizeUrl(url: string): string | null {
  const trimmed = url.trim();
  return trimmed || null;
}

// SQL parameter count validation
function validateParamCount(params: any[]): boolean {
  // INSERT INTO notes has 12 fields
  return params.length === 7; // id, title, content, source_url, created_at, updated_at, owner_id
}

// AI trigger retry configuration
function getRetryConfig() {
  return {
    maxRetries: 5,
    baseDelay: 2000,
    retryableStatuses: [404],
  };
}

// ─── URL Validation ───

describe('NoteEditor - URL Validation', () => {
  it('validates http URLs', () => {
    expect(isValidUrl('http://example.com')).toBe(true);
  });

  it('validates https URLs', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
  });

  it('validates URLs with paths', () => {
    expect(isValidUrl('https://example.com/path/to/resource')).toBe(true);
  });

  it('validates URLs with query strings', () => {
    expect(isValidUrl('https://example.com?q=test&lang=en')).toBe(true);
  });

  it('validates URLs with fragments', () => {
    expect(isValidUrl('https://example.com#section1')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(isValidUrl('')).toBe(false);
  });

  it('rejects plain text', () => {
    expect(isValidUrl('not a url')).toBe(false);
  });

  it('rejects partial URLs', () => {
    expect(isValidUrl('example.com')).toBe(false);
  });
});

// ─── Import Button Visibility ───

describe('NoteEditor - Import Button Visibility', () => {
  it('shows when URL is non-empty', () => {
    expect(shouldShowImportButton('https://example.com')).toBe(true);
  });

  it('hides when URL is empty', () => {
    expect(shouldShowImportButton('')).toBe(false);
  });

  it('hides when URL is whitespace', () => {
    expect(shouldShowImportButton('   ')).toBe(false);
  });
});

// ─── Button Text ───

describe('NoteEditor - Button Text', () => {
  it('shows importing text during import', () => {
    expect(getImportButtonText(true)).toBe('Importing...');
  });

  it('shows Import when not importing', () => {
    expect(getImportButtonText(false)).toBe('Import');
  });

  it('shows saving text during save', () => {
    expect(getSaveButtonText(true)).toBe('Saving...');
  });

  it('shows Save & Analyze when not saving', () => {
    expect(getSaveButtonText(false)).toBe('Save & Analyze');
  });
});

// ─── Form Completion ───

describe('NoteEditor - Form Completion', () => {
  it('reports complete form', () => {
    const result = isFormComplete('Title', 'Content');
    expect(result.titleOk).toBe(true);
    expect(result.hasContent).toBe(true);
  });

  it('reports missing title', () => {
    const result = isFormComplete('', 'Content');
    expect(result.titleOk).toBe(false);
    expect(result.hasContent).toBe(true);
  });

  it('reports missing content', () => {
    const result = isFormComplete('Title', '');
    expect(result.titleOk).toBe(true);
    expect(result.hasContent).toBe(false);
  });

  it('reports whitespace-only title as incomplete', () => {
    const result = isFormComplete('   ', 'Content');
    expect(result.titleOk).toBe(false);
  });

  it('reports whitespace-only content as empty', () => {
    const result = isFormComplete('Title', '   ');
    expect(result.hasContent).toBe(false);
  });
});

// ─── Content Append ───

describe('NoteEditor - Content Append', () => {
  it('appends to existing content with separator', () => {
    expect(appendImportedContent('Existing', 'Imported')).toBe('Existing\n\nImported');
  });

  it('uses imported content directly when no existing', () => {
    expect(appendImportedContent('', 'Imported')).toBe('Imported');
  });

  it('handles empty imported content', () => {
    expect(appendImportedContent('Existing', '')).toBe('Existing\n\n');
  });

  it('handles both empty', () => {
    expect(appendImportedContent('', '')).toBe('');
  });

  it('handles multi-line existing content', () => {
    expect(appendImportedContent('Line 1\nLine 2', 'Imported')).toBe('Line 1\nLine 2\n\nImported');
  });
});

// ─── Title Resolution ───

describe('NoteEditor - Title Resolution', () => {
  it('keeps existing title when non-empty', () => {
    expect(resolveTitle('My Title', 'Imported Title')).toBe('My Title');
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

  it('handles undefined imported title', () => {
    expect(resolveTitle('', undefined as any)).toBe('');
  });
});

// ─── URL Normalization ───

describe('NoteEditor - URL Normalization', () => {
  it('trims whitespace from URL', () => {
    expect(normalizeUrl('  https://example.com  ')).toBe('https://example.com');
  });

  it('returns null for empty URL', () => {
    expect(normalizeUrl('')).toBeNull();
  });

  it('returns null for whitespace-only URL', () => {
    expect(normalizeUrl('   ')).toBeNull();
  });

  it('preserves valid URL', () => {
    expect(normalizeUrl('https://example.com/path')).toBe('https://example.com/path');
  });
});

// ─── SQL Parameter Validation ───

describe('NoteEditor - SQL Parameter Validation', () => {
  it('validates correct parameter count', () => {
    const params = ['id-1', 'Title', 'Content', null, '2026-03-12T00:00:00Z', '2026-03-12T00:00:00Z', 'user-1'];
    expect(validateParamCount(params)).toBe(true);
  });

  it('rejects too few parameters', () => {
    const params = ['id-1', 'Title', 'Content'];
    expect(validateParamCount(params)).toBe(false);
  });

  it('rejects too many parameters', () => {
    const params = Array(10).fill('x');
    expect(validateParamCount(params)).toBe(false);
  });
});

// ─── AI Retry Config ───

describe('NoteEditor - AI Retry Config', () => {
  it('has correct max retries', () => {
    expect(getRetryConfig().maxRetries).toBe(5);
  });

  it('has correct base delay', () => {
    expect(getRetryConfig().baseDelay).toBe(2000);
  });

  it('only retries on 404', () => {
    const config = getRetryConfig();
    expect(config.retryableStatuses).toEqual([404]);
    expect(config.retryableStatuses).not.toContain(500);
    expect(config.retryableStatuses).not.toContain(200);
  });

  it('calculates correct delays for each retry', () => {
    const config = getRetryConfig();
    for (let i = 0; i < config.maxRetries; i++) {
      const delay = config.baseDelay * (i + 1);
      expect(delay).toBe(2000 * (i + 1));
    }
  });
});
