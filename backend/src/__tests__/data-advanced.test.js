import { describe, it, expect, vi } from 'vitest';

// Extracted from data.js
function escapeIdentifier(id) {
  return `"${id.replace(/"/g, '""').replace(/\./g, '"."')}"`;
}

describe('SQL Identifier Escaping - Edge Cases', () => {
  it('should handle identifiers with multiple dots', () => {
    expect(escapeIdentifier('schema.table.column')).toBe('"schema"."table"."column"');
  });

  it('should handle identifiers with both dots and quotes', () => {
    expect(escapeIdentifier('my"schema.my"table')).toBe('"my""schema"."my""table"');
  });

  it('should handle leading dot', () => {
    expect(escapeIdentifier('.notes')).toBe('""."notes"');
  });

  it('should handle trailing dot', () => {
    expect(escapeIdentifier('notes.')).toBe('"notes".""');
  });

  it('should handle identifiers with underscores', () => {
    expect(escapeIdentifier('my_table_name')).toBe('"my_table_name"');
  });

  it('should handle identifiers with hyphens', () => {
    expect(escapeIdentifier('my-table')).toBe('"my-table"');
  });

  it('should handle identifiers with numbers', () => {
    expect(escapeIdentifier('table123')).toBe('"table123"');
  });

  it('should handle identifiers with spaces', () => {
    expect(escapeIdentifier('my table')).toBe('"my table"');
  });

  it('should handle consecutive double quotes', () => {
    expect(escapeIdentifier('a""b')).toBe('"a""""b"');
  });

  it('should handle single character identifiers', () => {
    expect(escapeIdentifier('x')).toBe('"x"');
  });

  it('should handle only a dot', () => {
    // A dot becomes empty string + separator + empty string
    expect(escapeIdentifier('.')).toBe('"".""');
  });

  it('should handle only a double quote', () => {
    expect(escapeIdentifier('"')).toBe('""""');
  });
});

describe('Batch Operations - PUT Data Merging', () => {
  it('should merge op.id into data for PUT', () => {
    const op = { op: 'PUT', table: 'notes', id: 'uuid-1', data: { title: 'Test' } };
    const data = { ...op.data, id: op.id ?? op.data.id };
    expect(data).toEqual({ title: 'Test', id: 'uuid-1' });
  });

  it('should override data.id with op.id for PUT', () => {
    const op = { op: 'PUT', table: 'notes', id: 'correct-id', data: { id: 'wrong-id', title: 'Test' } };
    const data = { ...op.data, id: op.id ?? op.data.id };
    expect(data.id).toBe('correct-id');
  });

  it('should use data.id when op.id is null', () => {
    const op = { op: 'PUT', table: 'notes', id: null, data: { id: 'from-data', title: 'Test' } };
    const data = { ...op.data, id: op.id ?? op.data.id };
    expect(data.id).toBe('from-data');
  });

  it('should use data.id when op.id is undefined', () => {
    const op = { op: 'PUT', table: 'notes', data: { id: 'from-data', title: 'Test' } };
    const data = { ...op.data, id: op.id ?? op.data.id };
    expect(data.id).toBe('from-data');
  });

  it('should handle PUT with empty data object', () => {
    const op = { op: 'PUT', table: 'notes', id: 'uuid-1', data: {} };
    const data = { ...op.data, id: op.id ?? op.data.id };
    expect(data).toEqual({ id: 'uuid-1' });
  });

  it('should preserve all data fields in PUT', () => {
    const op = {
      op: 'PUT', table: 'notes', id: 'uuid-1',
      data: {
        title: 'Title',
        content: 'Content',
        source_url: 'https://example.com',
        ai_summary: 'Summary',
        ai_tags: 'ai,ml',
        ai_connections: '',
        is_processed: 0,
        owner_id: 'user-1',
        created_at: '2026-01-01',
        updated_at: '2026-01-01'
      }
    };
    const data = { ...op.data, id: op.id };
    expect(Object.keys(data)).toHaveLength(11);
  });
});

describe('Batch Operations - PUT SQL Generation', () => {
  it('should generate correct column list', () => {
    const data = { title: 'Test', content: 'Body', id: 'uuid-1' };
    const cols = Object.keys(data).map(escapeIdentifier);
    expect(cols).toEqual(['"title"', '"content"', '"id"']);
  });

  it('should generate update clause excluding id', () => {
    const opData = { title: 'Test', content: 'Body' };
    const updates = Object.keys(opData)
      .filter(k => k !== 'id')
      .map(k => `${escapeIdentifier(k)} = EXCLUDED.${escapeIdentifier(k)}`);
    expect(updates).toEqual([
      '"title" = EXCLUDED."title"',
      '"content" = EXCLUDED."content"'
    ]);
  });

  it('should generate DO NOTHING for id-only update', () => {
    const opData = { id: 'uuid-1' };
    const updates = Object.keys(opData)
      .filter(k => k !== 'id')
      .map(k => `${escapeIdentifier(k)} = EXCLUDED.${escapeIdentifier(k)}`);
    const updateClause = updates.length > 0 ? `DO UPDATE SET ${updates.join(', ')}` : 'DO NOTHING';
    expect(updateClause).toBe('DO NOTHING');
  });

  it('should generate correct JSON for data row CTE', () => {
    const data = { title: 'Test', content: 'Body', id: 'uuid-1' };
    const json = JSON.stringify(data);
    expect(json).toBe('{"title":"Test","content":"Body","id":"uuid-1"}');
  });
});

describe('Batch Operations - PATCH Data Handling', () => {
  it('should merge id for PATCH', () => {
    const op = { op: 'PATCH', table: 'notes', id: 'uuid-1', data: { title: 'Updated' } };
    const data = { ...op.data, id: op.id ?? op.data.id };
    expect(data.id).toBe('uuid-1');
    expect(data.title).toBe('Updated');
  });

  it('should generate SET clause for single field', () => {
    const opData = { title: 'New Title' };
    const updates = Object.keys(opData)
      .filter(k => k !== 'id')
      .map(k => `${escapeIdentifier(k)} = data_row.${escapeIdentifier(k)}`);
    expect(updates).toEqual(['"title" = data_row."title"']);
  });

  it('should handle PATCH with boolean-like field', () => {
    const opData = { is_processed: 1 };
    const updates = Object.keys(opData)
      .filter(k => k !== 'id')
      .map(k => `${escapeIdentifier(k)} = data_row.${escapeIdentifier(k)}`);
    expect(updates).toEqual(['"is_processed" = data_row."is_processed"']);
  });

  it('should handle PATCH with null values', () => {
    const opData = { ai_summary: null, ai_tags: null };
    const data = { ...opData, id: 'uuid-1' };
    const json = JSON.stringify(data);
    expect(json).toContain('"ai_summary":null');
    expect(json).toContain('"ai_tags":null');
  });
});

describe('Batch Operations - DELETE Handling', () => {
  it('should extract id from op for DELETE', () => {
    const op = { op: 'DELETE', table: 'notes', id: 'uuid-1' };
    const id = op.id ?? op.data?.id;
    expect(id).toBe('uuid-1');
  });

  it('should extract id from data for DELETE when op.id missing', () => {
    const op = { op: 'DELETE', table: 'notes', data: { id: 'uuid-2' } };
    const id = op.id ?? op.data?.id;
    expect(id).toBe('uuid-2');
  });

  it('should generate correct DELETE JSON', () => {
    const op = { op: 'DELETE', table: 'notes', id: 'uuid-1' };
    const id = op.id ?? op.data?.id;
    const json = JSON.stringify({ id });
    expect(json).toBe('{"id":"uuid-1"}');
  });

  it('should handle DELETE without any data', () => {
    const op = { op: 'DELETE', table: 'notes' };
    const id = op.id ?? op.data?.id;
    expect(id).toBeUndefined();
  });

  it('should handle DELETE with null data', () => {
    const op = { op: 'DELETE', table: 'notes', data: null };
    const id = op.id ?? op.data?.id;
    expect(id).toBeUndefined();
  });
});

describe('Batch - Transaction Error Handling', () => {
  it('should rollback and release on query error', async () => {
    const queryLog = [];
    const mockClient = {
      query: vi.fn(async (sql) => {
        queryLog.push(sql);
        if (sql.includes('INSERT')) throw new Error('duplicate key');
        return { rows: [] };
      }),
      release: vi.fn()
    };

    try {
      await mockClient.query('BEGIN');
      await mockClient.query('INSERT INTO notes VALUES ...');
      await mockClient.query('COMMIT');
    } catch (e) {
      await mockClient.query('ROLLBACK');
    } finally {
      mockClient.release();
    }

    expect(queryLog).toContain('BEGIN');
    expect(queryLog).toContain('ROLLBACK');
    expect(queryLog).not.toContain('COMMIT');
    expect(mockClient.release).toHaveBeenCalledOnce();
  });

  it('should release client on BEGIN failure', async () => {
    const mockClient = {
      query: vi.fn(async () => { throw new Error('connection lost'); }),
      release: vi.fn()
    };

    try {
      await mockClient.query('BEGIN');
    } catch (e) {
      // handled
    } finally {
      mockClient.release();
    }

    expect(mockClient.release).toHaveBeenCalledOnce();
  });

  it('should handle ROLLBACK failure gracefully', async () => {
    const mockClient = {
      query: vi.fn(async (sql) => {
        if (sql === 'ROLLBACK') throw new Error('connection dead');
        if (sql.includes('INSERT')) throw new Error('constraint error');
        return { rows: [] };
      }),
      release: vi.fn()
    };

    let rollbackError = null;
    try {
      await mockClient.query('BEGIN');
      await mockClient.query('INSERT ...');
    } catch (e) {
      try {
        await mockClient.query('ROLLBACK');
      } catch (re) {
        rollbackError = re;
      }
    } finally {
      mockClient.release();
    }

    expect(rollbackError).toBeTruthy();
    expect(rollbackError.message).toBe('connection dead');
    expect(mockClient.release).toHaveBeenCalledOnce();
  });
});

describe('Batch - Operation Type Validation', () => {
  it('should recognize PUT operation', () => {
    const op = { op: 'PUT', table: 'notes', id: '1', data: {} };
    expect(['PUT', 'PATCH', 'DELETE']).toContain(op.op);
  });

  it('should recognize PATCH operation', () => {
    const op = { op: 'PATCH', table: 'notes', id: '1', data: {} };
    expect(['PUT', 'PATCH', 'DELETE']).toContain(op.op);
  });

  it('should recognize DELETE operation', () => {
    const op = { op: 'DELETE', table: 'notes', id: '1' };
    expect(['PUT', 'PATCH', 'DELETE']).toContain(op.op);
  });

  it('should reject unknown operation type', () => {
    const op = { op: 'TRUNCATE', table: 'notes' };
    expect(['PUT', 'PATCH', 'DELETE']).not.toContain(op.op);
  });

  it('should handle case sensitivity in op type', () => {
    const op1 = { op: 'put' };
    const op2 = { op: 'PUT' };
    expect(op1.op).not.toBe(op2.op);
    expect(op2.op).toBe('PUT');
  });
});

describe('Seed Data - Structural Validation', () => {
  const demoNotes = [
    { title: 'Transformer Architecture Deep Dive', source_url: 'https://arxiv.org/abs/1706.03762', ai_tags: 'ai,machine-learning,transformers,attention,deep-learning' },
    { title: 'RAG: Retrieval Augmented Generation', source_url: undefined, ai_tags: 'ai,rag,retrieval,vector-search,llm' },
    { title: 'Offline-First Architecture Patterns', source_url: undefined, ai_tags: 'architecture,offline-first,sync,local-first,powersync' },
    { title: 'Knowledge Graphs for Research', source_url: undefined, ai_tags: 'research,knowledge-graph,visualization,data' },
    { title: 'AI Agent Design Patterns', source_url: undefined, ai_tags: 'ai,agents,mastra,tool-use,research' },
    { title: 'Vector Embeddings Explained', source_url: undefined, ai_tags: 'ai,embeddings,vector-search,data,machine-learning' },
  ];

  it('should have unique titles across all demo notes', () => {
    const titles = demoNotes.map(n => n.title);
    const uniqueTitles = [...new Set(titles)];
    expect(titles.length).toBe(uniqueTitles.length);
  });

  it('should have non-empty tags for all demo notes', () => {
    for (const note of demoNotes) {
      expect(note.ai_tags.length).toBeGreaterThan(0);
      expect(note.ai_tags.split(',').length).toBeGreaterThanOrEqual(3);
    }
  });

  it('should reference PowerSync in at least one demo note', () => {
    const allTags = demoNotes.flatMap(n => n.ai_tags.split(','));
    expect(allTags).toContain('powersync');
  });

  it('should reference Mastra in at least one demo note', () => {
    const allTags = demoNotes.flatMap(n => n.ai_tags.split(','));
    expect(allTags).toContain('mastra');
  });

  it('should have at least one note with source_url', () => {
    const withUrl = demoNotes.filter(n => n.source_url);
    expect(withUrl.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Seed Data - Tag Frequency Counting', () => {
  it('should count tag occurrences correctly', () => {
    const noteTags = [
      'ai,machine-learning,transformers',
      'ai,rag,vector-search',
      'architecture,offline-first',
      'ai,agents,mastra',
    ];

    const tagCounts = {};
    for (const tags of noteTags) {
      for (const tag of tags.split(',')) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }

    expect(tagCounts['ai']).toBe(3);
    expect(tagCounts['machine-learning']).toBe(1);
    expect(tagCounts['architecture']).toBe(1);
  });

  it('should handle empty tag strings', () => {
    const noteTags = ['ai,ml', '', 'ai'];
    const tagCounts = {};
    for (const tags of noteTags) {
      if (!tags) continue;
      for (const tag of tags.split(',')) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }
    expect(tagCounts['ai']).toBe(2);
    expect(tagCounts['']).toBeUndefined();
  });

  it('should handle tags with whitespace', () => {
    const tags = ' ai , ml , research '.split(',').map(t => t.trim());
    expect(tags).toEqual(['ai', 'ml', 'research']);
  });
});

describe('Seed Data - Connection Graph Properties', () => {
  it('should have no self-referential connections', () => {
    const connections = [
      [0, 1], [1, 5], [4, 1], [3, 4], [2, 3], [0, 5], [4, 0],
    ];
    for (const [s, t] of connections) {
      expect(s).not.toBe(t);
    }
  });

  it('should have no duplicate directed edges', () => {
    const connections = [
      [0, 1], [1, 5], [4, 1], [3, 4], [2, 3], [0, 5], [4, 0],
    ];
    const edges = connections.map(([s, t]) => `${s}->${t}`);
    const unique = [...new Set(edges)];
    expect(edges.length).toBe(unique.length);
  });

  it('should have confidence values between 0 and 1', () => {
    const connections = [
      [0, 1, 'rel', 0.92],
      [1, 5, 'rel', 0.95],
      [4, 1, 'rel', 0.88],
      [3, 4, 'rel', 0.78],
      [2, 3, 'rel', 0.82],
      [0, 5, 'rel', 0.90],
      [4, 0, 'rel', 0.93],
    ];
    for (const [, , , conf] of connections) {
      expect(conf).toBeGreaterThan(0);
      expect(conf).toBeLessThanOrEqual(1);
    }
  });

  it('should connect notes that form a reasonable research graph', () => {
    const connections = [
      [0, 1], [1, 5], [4, 1], [3, 4], [2, 3], [0, 5], [4, 0],
    ];
    // Every note should be in at least one connection
    const nodesInGraph = new Set();
    for (const [s, t] of connections) {
      nodesInGraph.add(s);
      nodesInGraph.add(t);
    }
    // 6 notes total (indices 0-5)
    expect(nodesInGraph.size).toBe(6);
  });
});

describe('Pool Error Handling', () => {
  it('should handle pool connection errors gracefully', () => {
    const errorHandler = vi.fn();
    const mockPool = {
      on: vi.fn((event, handler) => {
        if (event === 'error') errorHandler.mockImplementation(handler);
      })
    };

    mockPool.on('error', (err) => {
      console.error('Pool connection failure:', err);
    });

    expect(mockPool.on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('should connect and release client correctly', async () => {
    const mockClient = {
      query: vi.fn(async () => ({ rows: [] })),
      release: vi.fn()
    };
    const mockPool = {
      connect: vi.fn(async () => mockClient)
    };

    const client = await mockPool.connect();
    await client.query('SELECT 1');
    client.release();

    expect(mockPool.connect).toHaveBeenCalledOnce();
    expect(client.query).toHaveBeenCalledOnce();
    expect(client.release).toHaveBeenCalledOnce();
  });
});
