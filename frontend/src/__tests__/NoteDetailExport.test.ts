import { describe, it, expect } from 'vitest';

// ─── Extract and test pure export/markdown logic from NoteDetail.tsx ───

// Markdown export construction
function buildExportMarkdown(
  note: {
    title: string;
    source_url?: string | null;
    created_at?: string | null;
    ai_tags?: string | null;
    content?: string | null;
    ai_summary?: string | null;
  },
  connections: Array<{ title: string; relationship: string }>
): string {
  const tags = (note.ai_tags || '').split(',').filter(Boolean).map((t: string) => t.trim());
  const md = [
    `# ${note.title}`,
    note.source_url ? `\nSource: ${note.source_url}` : '',
    `\nCreated: ${note.created_at}`,
    tags.length ? `\nTags: ${tags.join(', ')}` : '',
    `\n## Content\n\n${note.content || ''}`,
    note.ai_summary ? `\n## AI Summary\n\n${note.ai_summary}` : '',
    connections.length ? `\n## Connected Notes\n\n${connections.map(c =>
      `- ${c.title}: ${c.relationship}`
    ).join('\n')}` : ''
  ].filter(Boolean).join('\n');
  return md;
}

// Filename sanitization for export
function sanitizeFilename(title: string): string {
  return (title || 'note').replace(/[^a-z0-9]/gi, '-').toLowerCase();
}

// Connection merging (out + in connections)
function mergeConnections(
  outConns: Array<{ target_title: string; relationship: string; direction?: string }>,
  inConns: Array<{ source_title: string; relationship: string; direction?: string }>
): Array<{ title: string; relationship: string; direction: string }> {
  return [
    ...outConns.map(c => ({ title: c.target_title, relationship: c.relationship, direction: 'out' })),
    ...inConns.map(c => ({ title: c.source_title, relationship: c.relationship, direction: 'in' }))
  ];
}

// Confidence formatting
function formatConfidence(confidence: number | null | undefined): string | null {
  if (!confidence) return null;
  return `${Math.round(Number(confidence) * 100)}%`;
}

// Connection hint message
function getConnectionHint(isProcessed: boolean | number): string {
  return isProcessed ? 'No connections discovered yet' : 'Connections will appear after AI analysis';
}

// Save validation
function isSaveValid(editTitle: string): boolean {
  return !!editTitle.trim();
}

// Update timestamp
function buildUpdateParams(title: string, content: string, url: string, noteId: string) {
  const now = new Date().toISOString();
  return {
    params: [title.trim(), content.trim(), url.trim() || null, now, noteId],
    timestamp: now
  };
}

// ─── Markdown Export ───

describe('NoteDetail - Markdown Export', () => {
  it('includes title as H1', () => {
    const md = buildExportMarkdown({ title: 'Test Note' }, []);
    expect(md).toContain('# Test Note');
  });

  it('includes source URL when provided', () => {
    const md = buildExportMarkdown({ title: 'Note', source_url: 'https://example.com' }, []);
    expect(md).toContain('Source: https://example.com');
  });

  it('excludes source URL when null', () => {
    const md = buildExportMarkdown({ title: 'Note', source_url: null }, []);
    expect(md).not.toContain('Source:');
  });

  it('includes created date', () => {
    const md = buildExportMarkdown({ title: 'Note', created_at: '2026-03-12' }, []);
    expect(md).toContain('Created: 2026-03-12');
  });

  it('includes tags when present', () => {
    const md = buildExportMarkdown({ title: 'Note', ai_tags: 'ml,ai,python' }, []);
    expect(md).toContain('Tags: ml, ai, python');
  });

  it('excludes tags section when no tags', () => {
    const md = buildExportMarkdown({ title: 'Note', ai_tags: '' }, []);
    expect(md).not.toContain('Tags:');
  });

  it('includes content section', () => {
    const md = buildExportMarkdown({ title: 'Note', content: 'Research findings here' }, []);
    expect(md).toContain('## Content');
    expect(md).toContain('Research findings here');
  });

  it('includes AI summary when present', () => {
    const md = buildExportMarkdown({ title: 'Note', ai_summary: 'Summary text' }, []);
    expect(md).toContain('## AI Summary');
    expect(md).toContain('Summary text');
  });

  it('excludes AI summary when empty', () => {
    const md = buildExportMarkdown({ title: 'Note', ai_summary: '' }, []);
    expect(md).not.toContain('## AI Summary');
  });

  it('includes connected notes', () => {
    const connections = [
      { title: 'Related Note', relationship: 'extends' }
    ];
    const md = buildExportMarkdown({ title: 'Note' }, connections);
    expect(md).toContain('## Connected Notes');
    expect(md).toContain('- Related Note: extends');
  });

  it('excludes connected notes section when empty', () => {
    const md = buildExportMarkdown({ title: 'Note' }, []);
    expect(md).not.toContain('## Connected Notes');
  });

  it('includes multiple connections', () => {
    const connections = [
      { title: 'Note A', relationship: 'extends' },
      { title: 'Note B', relationship: 'contrasts' }
    ];
    const md = buildExportMarkdown({ title: 'Note' }, connections);
    expect(md).toContain('- Note A: extends');
    expect(md).toContain('- Note B: contrasts');
  });

  it('handles all fields empty gracefully', () => {
    const md = buildExportMarkdown({ title: '' }, []);
    expect(md).toContain('#');
    expect(md).toContain('## Content');
  });
});

// ─── Filename Sanitization ───

describe('NoteDetail - Filename Sanitization', () => {
  it('converts to lowercase', () => {
    expect(sanitizeFilename('My Note')).toBe('my-note');
  });

  it('replaces spaces with hyphens', () => {
    expect(sanitizeFilename('Machine Learning Notes')).toBe('machine-learning-notes');
  });

  it('removes special characters', () => {
    expect(sanitizeFilename('Note: AI & ML!')).toBe('note--ai---ml-');
  });

  it('uses "note" for empty title', () => {
    expect(sanitizeFilename('')).toBe('note');
  });

  it('uses "note" for null-like title', () => {
    expect(sanitizeFilename(undefined as any)).toBe('note');
  });

  it('handles numbers in title', () => {
    expect(sanitizeFilename('Chapter 1')).toBe('chapter-1');
  });

  it('handles already clean title', () => {
    expect(sanitizeFilename('simple')).toBe('simple');
  });

  it('handles unicode characters', () => {
    const result = sanitizeFilename('Résumé Notes');
    expect(result).toMatch(/^[a-z0-9-]+$/);
  });
});

// ─── Connection Merging ───

describe('NoteDetail - Connection Merging', () => {
  it('merges outbound and inbound connections', () => {
    const merged = mergeConnections(
      [{ target_title: 'Target 1', relationship: 'extends' }],
      [{ source_title: 'Source 1', relationship: 'references' }]
    );
    expect(merged.length).toBe(2);
    expect(merged[0].title).toBe('Target 1');
    expect(merged[0].direction).toBe('out');
    expect(merged[1].title).toBe('Source 1');
    expect(merged[1].direction).toBe('in');
  });

  it('handles empty outbound', () => {
    const merged = mergeConnections(
      [],
      [{ source_title: 'Source', relationship: 'refs' }]
    );
    expect(merged.length).toBe(1);
  });

  it('handles empty inbound', () => {
    const merged = mergeConnections(
      [{ target_title: 'Target', relationship: 'ext' }],
      []
    );
    expect(merged.length).toBe(1);
  });

  it('handles both empty', () => {
    const merged = mergeConnections([], []);
    expect(merged.length).toBe(0);
  });

  it('preserves order: outbound first, then inbound', () => {
    const merged = mergeConnections(
      [{ target_title: 'Out1', relationship: 'a' }, { target_title: 'Out2', relationship: 'b' }],
      [{ source_title: 'In1', relationship: 'c' }]
    );
    expect(merged[0].title).toBe('Out1');
    expect(merged[1].title).toBe('Out2');
    expect(merged[2].title).toBe('In1');
  });
});

// ─── Confidence Formatting ───

describe('NoteDetail - Confidence Formatting', () => {
  it('formats 0.95 as 95%', () => {
    expect(formatConfidence(0.95)).toBe('95%');
  });

  it('formats 1.0 as 100%', () => {
    expect(formatConfidence(1.0)).toBe('100%');
  });

  it('formats 0.333 as 33%', () => {
    expect(formatConfidence(0.333)).toBe('33%');
  });

  it('returns null for 0', () => {
    expect(formatConfidence(0)).toBeNull();
  });

  it('returns null for null', () => {
    expect(formatConfidence(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(formatConfidence(undefined)).toBeNull();
  });

  it('formats 0.5 as 50%', () => {
    expect(formatConfidence(0.5)).toBe('50%');
  });

  it('rounds down for 0.664', () => {
    expect(formatConfidence(0.664)).toBe('66%');
  });

  it('rounds up for 0.665', () => {
    expect(formatConfidence(0.665)).toBe('67%');
  });
});

// ─── Connection Hint Messages ───

describe('NoteDetail - Connection Hints', () => {
  it('shows discovered message when processed', () => {
    expect(getConnectionHint(true)).toBe('No connections discovered yet');
    expect(getConnectionHint(1)).toBe('No connections discovered yet');
  });

  it('shows pending message when not processed', () => {
    expect(getConnectionHint(false)).toBe('Connections will appear after AI analysis');
    expect(getConnectionHint(0)).toBe('Connections will appear after AI analysis');
  });
});

// ─── Save Validation ───

describe('NoteDetail - Save Validation', () => {
  it('valid with non-empty title', () => {
    expect(isSaveValid('My Title')).toBe(true);
  });

  it('invalid with empty title', () => {
    expect(isSaveValid('')).toBe(false);
  });

  it('invalid with whitespace-only title', () => {
    expect(isSaveValid('   ')).toBe(false);
  });

  it('valid with single character', () => {
    expect(isSaveValid('A')).toBe(true);
  });
});

// ─── Update Params ───

describe('NoteDetail - Update Params', () => {
  it('trims title and content', () => {
    const { params } = buildUpdateParams('  Title  ', '  Content  ', '', 'note-1');
    expect(params[0]).toBe('Title');
    expect(params[1]).toBe('Content');
  });

  it('sets url to null when empty', () => {
    const { params } = buildUpdateParams('T', 'C', '', 'note-1');
    expect(params[2]).toBeNull();
  });

  it('trims url when provided', () => {
    const { params } = buildUpdateParams('T', 'C', '  https://example.com  ', 'note-1');
    expect(params[2]).toBe('https://example.com');
  });

  it('includes note ID as last param', () => {
    const { params } = buildUpdateParams('T', 'C', '', 'note-42');
    expect(params[4]).toBe('note-42');
  });

  it('includes ISO timestamp', () => {
    const { params } = buildUpdateParams('T', 'C', '', 'n1');
    expect(params[3]).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
