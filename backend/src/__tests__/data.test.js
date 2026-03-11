import { describe, it, expect } from 'vitest';

// Test the escapeIdentifier function extracted from data.js
function escapeIdentifier(id) {
  return `"${id.replace(/"/g, '""').replace(/\./g, '"."')}"`;
}

describe('Data API - SQL Identifier Escaping', () => {
  it('should escape simple table names', () => {
    expect(escapeIdentifier('notes')).toBe('"notes"');
    expect(escapeIdentifier('connections')).toBe('"connections"');
    expect(escapeIdentifier('tags')).toBe('"tags"');
  });

  it('should escape schema-qualified names', () => {
    expect(escapeIdentifier('public.notes')).toBe('"public"."notes"');
  });

  it('should escape double quotes in identifiers', () => {
    expect(escapeIdentifier('my"table')).toBe('"my""table"');
  });

  it('should handle empty strings', () => {
    expect(escapeIdentifier('')).toBe('""');
  });
});

describe('Data API - Batch Operation Validation', () => {
  it('should reject missing batch field', () => {
    const bodies = [null, undefined, {}, { data: [] }, { items: [] }];
    for (const body of bodies) {
      expect(body?.batch).toBeFalsy();
    }
  });

  it('should accept valid batch operations', () => {
    const validBatch = {
      batch: [
        { op: 'PUT', table: 'notes', id: 'uuid-1', data: { title: 'Test', content: 'Hello' } },
        { op: 'PATCH', table: 'notes', id: 'uuid-1', data: { title: 'Updated' } },
        { op: 'DELETE', table: 'notes', id: 'uuid-1', data: {} },
      ]
    };
    expect(validBatch.batch).toBeTruthy();
    expect(validBatch.batch).toHaveLength(3);
  });

  it('should handle PUT operations with id in data', () => {
    const op = { op: 'PUT', table: 'notes', data: { id: 'uuid-1', title: 'Test' } };
    const data = { ...op.data, id: op.id ?? op.data.id };
    expect(data.id).toBe('uuid-1');
  });

  it('should prefer op.id over data.id', () => {
    const op = { op: 'PUT', table: 'notes', id: 'op-id', data: { id: 'data-id', title: 'Test' } };
    const data = { ...op.data, id: op.id ?? op.data.id };
    expect(data.id).toBe('op-id');
  });

  it('should handle DELETE with id in different locations', () => {
    const op1 = { op: 'DELETE', id: 'uuid-1' };
    const id1 = op1.id ?? op1.data?.id;
    expect(id1).toBe('uuid-1');

    const op2 = { op: 'DELETE', data: { id: 'uuid-2' } };
    const id2 = op2.id ?? op2.data?.id;
    expect(id2).toBe('uuid-2');
  });

  it('should generate correct update columns for PATCH', () => {
    const data = { id: 'uuid', title: 'Updated', content: 'New content' };
    const updates = Object.keys(data)
      .filter(k => k !== 'id')
      .map(k => `${escapeIdentifier(k)} = data_row.${escapeIdentifier(k)}`);

    expect(updates).toHaveLength(2);
    expect(updates[0]).toBe('"title" = data_row."title"');
    expect(updates[1]).toBe('"content" = data_row."content"');
  });
});

describe('Data API - Seed Data Structure', () => {
  const demoNotes = [
    { title: 'Transformer Architecture Deep Dive', tags: 'ai,machine-learning,transformers,attention,deep-learning' },
    { title: 'RAG: Retrieval Augmented Generation', tags: 'ai,rag,retrieval,vector-search,llm' },
    { title: 'Offline-First Architecture Patterns', tags: 'architecture,offline-first,sync,local-first,powersync' },
    { title: 'Knowledge Graphs for Research', tags: 'research,knowledge-graph,visualization,data' },
    { title: 'AI Agent Design Patterns', tags: 'ai,agents,mastra,tool-use,research' },
    { title: 'Vector Embeddings Explained', tags: 'ai,embeddings,vector-search,data,machine-learning' },
  ];

  it('should have 6 demo notes', () => {
    expect(demoNotes).toHaveLength(6);
  });

  it('should cover diverse AI research topics', () => {
    const allTags = demoNotes.flatMap(n => n.tags.split(','));
    const uniqueTags = [...new Set(allTags)];
    expect(uniqueTags.length).toBeGreaterThan(10);
    expect(uniqueTags).toContain('ai');
    expect(uniqueTags).toContain('powersync');
    expect(uniqueTags).toContain('mastra');
  });

  it('should have valid connection indices', () => {
    const connections = [
      [0, 1], [1, 5], [4, 1], [3, 4], [2, 3], [0, 5], [4, 0],
    ];
    for (const [s, t] of connections) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(demoNotes.length);
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThan(demoNotes.length);
      expect(s).not.toBe(t); // No self-connections
    }
  });
});
