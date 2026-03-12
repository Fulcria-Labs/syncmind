import { describe, it, expect } from 'vitest';

// ─── Extract and test pure logic from NoteDetail.tsx ───

// Simulates export markdown generation
function buildExportMarkdown(
  note: {
    title: string;
    content: string;
    source_url?: string | null;
    created_at?: string | null;
    ai_summary?: string | null;
    ai_tags?: string | null;
  },
  connections: { title: string; relationship: string }[],
): string {
  const tags = (note.ai_tags || '').split(',').filter(Boolean).map(t => t.trim());
  const parts = [
    `# ${note.title}`,
    note.source_url ? `\nSource: ${note.source_url}` : '',
    `\nCreated: ${note.created_at}`,
    tags.length ? `\nTags: ${tags.join(', ')}` : '',
    `\n## Content\n\n${note.content || ''}`,
    note.ai_summary ? `\n## AI Summary\n\n${note.ai_summary}` : '',
    connections.length ? `\n## Connected Notes\n\n${connections.map(c =>
      `- ${c.title}: ${c.relationship}`
    ).join('\n')}` : '',
  ].filter(Boolean).join('\n');
  return parts;
}

// Simulates filename sanitization
function sanitizeFilename(title: string): string {
  return (title || 'note').replace(/[^a-z0-9]/gi, '-').toLowerCase() + '.md';
}

// Simulates edit save validation
function canSaveEdit(title: string, saving: boolean): boolean {
  return !saving && title.trim().length > 0;
}

// Simulates connection merging logic
function mergeConnections(
  outConnections: { id: string; target_note_id: string; target_title: string; relationship: string }[],
  inConnections: { id: string; source_note_id: string; source_title: string; relationship: string }[],
): { id: string; direction: 'out' | 'in'; noteId: string; title: string; relationship: string }[] {
  return [
    ...outConnections.map(c => ({
      id: c.id,
      direction: 'out' as const,
      noteId: c.target_note_id,
      title: c.target_title || 'Linked note',
      relationship: c.relationship,
    })),
    ...inConnections.map(c => ({
      id: c.id,
      direction: 'in' as const,
      noteId: c.source_note_id,
      title: c.source_title || 'Linked note',
      relationship: c.relationship,
    })),
  ];
}

// Simulates confidence display
function formatConfidence(confidence: number | string | null | undefined): string | null {
  if (!confidence) return null;
  return `${Math.round(Number(confidence) * 100)}%`;
}

// Simulates connection hint text
function getConnectionHint(isProcessed: boolean): string {
  return isProcessed
    ? 'No connections discovered yet'
    : 'Connections will appear after AI analysis';
}

// ─── Export Markdown ───

describe('NoteDetail - Export Markdown', () => {
  it('includes title as heading', () => {
    const md = buildExportMarkdown(
      { title: 'Test Note', content: 'Content here' },
      [],
    );
    expect(md).toContain('# Test Note');
  });

  it('includes source URL when present', () => {
    const md = buildExportMarkdown(
      { title: 'Test', content: '', source_url: 'https://example.com' },
      [],
    );
    expect(md).toContain('Source: https://example.com');
  });

  it('excludes source URL when null', () => {
    const md = buildExportMarkdown(
      { title: 'Test', content: '', source_url: null },
      [],
    );
    expect(md).not.toContain('Source:');
  });

  it('includes AI summary section', () => {
    const md = buildExportMarkdown(
      { title: 'Test', content: '', ai_summary: 'This is a summary' },
      [],
    );
    expect(md).toContain('## AI Summary');
    expect(md).toContain('This is a summary');
  });

  it('excludes AI summary section when empty', () => {
    const md = buildExportMarkdown(
      { title: 'Test', content: '' },
      [],
    );
    expect(md).not.toContain('## AI Summary');
  });

  it('includes tags', () => {
    const md = buildExportMarkdown(
      { title: 'Test', content: '', ai_tags: 'ml,ai,python' },
      [],
    );
    expect(md).toContain('Tags: ml, ai, python');
  });

  it('includes connected notes section', () => {
    const md = buildExportMarkdown(
      { title: 'Test', content: '' },
      [{ title: 'Related Note', relationship: 'references' }],
    );
    expect(md).toContain('## Connected Notes');
    expect(md).toContain('- Related Note: references');
  });

  it('excludes connected notes when empty', () => {
    const md = buildExportMarkdown(
      { title: 'Test', content: '' },
      [],
    );
    expect(md).not.toContain('## Connected Notes');
  });
});

// ─── Filename Sanitization ───

describe('NoteDetail - Filename Sanitization', () => {
  it('converts to lowercase with hyphens', () => {
    expect(sanitizeFilename('My Research Note')).toBe('my-research-note.md');
  });

  it('removes special characters', () => {
    expect(sanitizeFilename('Note: Important (v2)!')).toBe('note--important--v2--.md');
  });

  it('handles empty title', () => {
    expect(sanitizeFilename('')).toBe('note.md');
  });

  it('preserves numbers', () => {
    expect(sanitizeFilename('Chapter 42')).toBe('chapter-42.md');
  });
});

// ─── Edit Save Validation ───

describe('NoteDetail - Edit Save Validation', () => {
  it('allows save when title is non-empty and not saving', () => {
    expect(canSaveEdit('My Title', false)).toBe(true);
  });

  it('blocks save when title is empty', () => {
    expect(canSaveEdit('', false)).toBe(false);
  });

  it('blocks save when title is whitespace', () => {
    expect(canSaveEdit('   ', false)).toBe(false);
  });

  it('blocks save when saving', () => {
    expect(canSaveEdit('Title', true)).toBe(false);
  });
});

// ─── Connection Merging ───

describe('NoteDetail - Connection Merging', () => {
  it('merges outbound and inbound connections', () => {
    const out = [{ id: '1', target_note_id: 'a', target_title: 'Note A', relationship: 'cites' }];
    const inc = [{ id: '2', source_note_id: 'b', source_title: 'Note B', relationship: 'extends' }];
    const result = mergeConnections(out, inc);
    expect(result).toHaveLength(2);
    expect(result[0].direction).toBe('out');
    expect(result[1].direction).toBe('in');
  });

  it('uses fallback title when missing', () => {
    const out = [{ id: '1', target_note_id: 'a', target_title: '', relationship: 'cites' }];
    const result = mergeConnections(out, []);
    expect(result[0].title).toBe('Linked note');
  });

  it('handles empty connection arrays', () => {
    const result = mergeConnections([], []);
    expect(result).toHaveLength(0);
  });

  it('preserves relationship text', () => {
    const out = [{ id: '1', target_note_id: 'a', target_title: 'Note A', relationship: 'contradicts' }];
    const result = mergeConnections(out, []);
    expect(result[0].relationship).toBe('contradicts');
  });
});

// ─── Confidence Display ───

describe('NoteDetail - Confidence Display', () => {
  it('formats decimal as percentage', () => {
    expect(formatConfidence(0.85)).toBe('85%');
  });

  it('rounds to nearest integer', () => {
    expect(formatConfidence(0.333)).toBe('33%');
  });

  it('handles string input', () => {
    expect(formatConfidence('0.95')).toBe('95%');
  });

  it('returns null for null/undefined/0', () => {
    expect(formatConfidence(null)).toBeNull();
    expect(formatConfidence(undefined)).toBeNull();
    expect(formatConfidence(0)).toBeNull();
  });
});

// ─── Connection Hint ───

describe('NoteDetail - Connection Hint', () => {
  it('shows discovery message for processed notes', () => {
    expect(getConnectionHint(true)).toBe('No connections discovered yet');
  });

  it('shows pending message for unprocessed notes', () => {
    expect(getConnectionHint(false)).toBe('Connections will appear after AI analysis');
  });
});
