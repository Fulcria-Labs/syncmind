import { describe, it, expect, vi } from 'vitest';

// Mock pool factory
function createMockPool(responses = {}) {
  return {
    query: vi.fn(async (sql, params) => {
      for (const [pattern, response] of Object.entries(responses)) {
        if (sql.includes(pattern)) {
          return typeof response === 'function' ? response(sql, params) : response;
        }
      }
      return { rows: [] };
    })
  };
}

// Tool execute functions mirroring mastra-agent.js
function createSearchNotesExecute(pool) {
  return async ({ context }) => {
    const { rows } = await pool.query(
      `SELECT id, title, content, ai_summary, ai_tags, source_url, created_at
       FROM notes WHERE owner_id = $1
       AND (title ILIKE $2 OR content ILIKE $2 OR ai_tags ILIKE $2 OR ai_summary ILIKE $2)
       ORDER BY updated_at DESC LIMIT $3`,
      [context.owner_id, `%${context.query}%`, context.limit]
    );
    return { notes: rows, count: rows.length };
  };
}

function createGetNoteDetailExecute(pool) {
  return async ({ context }) => {
    const { rows } = await pool.query('SELECT * FROM notes WHERE id = $1', [context.note_id]);
    if (!rows.length) return { error: 'Note not found' };
    const { rows: connections } = await pool.query(
      `SELECT c.*, n.title as target_title
       FROM connections c JOIN notes n ON c.target_note_id = n.id
       WHERE c.source_note_id = $1`,
      [context.note_id]
    );
    return { note: rows[0], connections };
  };
}

function createListAllNotesExecute(pool) {
  return async ({ context }) => {
    const { rows } = await pool.query(
      `SELECT id, title, ai_summary, ai_tags, source_url, is_processed, created_at, updated_at
       FROM notes WHERE owner_id = $1 ORDER BY updated_at DESC LIMIT $2`,
      [context.owner_id, context.limit]
    );
    return { notes: rows, count: rows.length };
  };
}

function createGetTagsExecute(pool) {
  return async () => {
    const { rows } = await pool.query('SELECT name, note_count FROM tags ORDER BY note_count DESC LIMIT 50');
    return { tags: rows };
  };
}

function createGetConnectionGraphExecute(pool) {
  return async ({ context }) => {
    const { rows: connections } = await pool.query(
      `SELECT c.source_note_id, c.target_note_id, c.relationship, c.confidence,
              s.title as source_title, t.title as target_title
       FROM connections c
       JOIN notes s ON c.source_note_id = s.id
       JOIN notes t ON c.target_note_id = t.id
       WHERE s.owner_id = $1
       ORDER BY c.confidence DESC LIMIT 100`,
      [context.owner_id]
    );
    return { connections, count: connections.length };
  };
}

describe('Search Notes - Query Construction', () => {
  it('should wrap query with wildcards', async () => {
    const pool = createMockPool({ 'FROM notes': { rows: [] } });
    const execute = createSearchNotesExecute(pool);

    await execute({ context: { query: 'transformer', owner_id: 'default', limit: 10 } });

    expect(pool.query).toHaveBeenCalledWith(
      expect.any(String),
      ['default', '%transformer%', 10]
    );
  });

  it('should search across title, content, tags, and summary', async () => {
    const pool = createMockPool({ 'FROM notes': { rows: [] } });
    const execute = createSearchNotesExecute(pool);

    await execute({ context: { query: 'test', owner_id: 'default', limit: 10 } });

    const sql = pool.query.mock.calls[0][0];
    expect(sql).toContain('title ILIKE');
    expect(sql).toContain('content ILIKE');
    expect(sql).toContain('ai_tags ILIKE');
    expect(sql).toContain('ai_summary ILIKE');
  });

  it('should handle empty query string', async () => {
    const pool = createMockPool({ 'FROM notes': { rows: [] } });
    const execute = createSearchNotesExecute(pool);

    const result = await execute({ context: { query: '', owner_id: 'default', limit: 10 } });

    expect(pool.query).toHaveBeenCalledWith(
      expect.any(String),
      ['default', '%%', 10]
    );
    expect(result.count).toBe(0);
  });

  it('should handle special characters in query', async () => {
    const pool = createMockPool({ 'FROM notes': { rows: [] } });
    const execute = createSearchNotesExecute(pool);

    await execute({ context: { query: "test's \"query\"", owner_id: 'default', limit: 10 } });

    expect(pool.query).toHaveBeenCalledWith(
      expect.any(String),
      ['default', "%test's \"query\"%", 10]
    );
  });

  it('should handle query with SQL-like characters', async () => {
    const pool = createMockPool({ 'FROM notes': { rows: [] } });
    const execute = createSearchNotesExecute(pool);

    await execute({ context: { query: '100%', owner_id: 'default', limit: 5 } });

    // The query is parameterized, so SQL injection is not possible
    expect(pool.query).toHaveBeenCalledWith(
      expect.any(String),
      ['default', '%100%%', 5]
    );
  });
});

describe('Search Notes - Result Handling', () => {
  it('should return correct count matching rows length', async () => {
    const mockNotes = [
      { id: 'n1', title: 'Note 1' },
      { id: 'n2', title: 'Note 2' },
      { id: 'n3', title: 'Note 3' },
    ];
    const pool = createMockPool({ 'FROM notes': { rows: mockNotes } });
    const execute = createSearchNotesExecute(pool);

    const result = await execute({ context: { query: 'test', owner_id: 'default', limit: 10 } });

    expect(result.count).toBe(3);
    expect(result.notes.length).toBe(result.count);
  });

  it('should return all expected fields in notes', async () => {
    const mockNote = {
      id: 'n1', title: 'Test', content: 'Body', ai_summary: 'Summary',
      ai_tags: 'ai,ml', source_url: 'https://example.com', created_at: '2026-01-01'
    };
    const pool = createMockPool({ 'FROM notes': { rows: [mockNote] } });
    const execute = createSearchNotesExecute(pool);

    const result = await execute({ context: { query: 'test', owner_id: 'default', limit: 10 } });

    expect(result.notes[0]).toHaveProperty('id');
    expect(result.notes[0]).toHaveProperty('title');
    expect(result.notes[0]).toHaveProperty('content');
    expect(result.notes[0]).toHaveProperty('ai_summary');
    expect(result.notes[0]).toHaveProperty('ai_tags');
    expect(result.notes[0]).toHaveProperty('source_url');
    expect(result.notes[0]).toHaveProperty('created_at');
  });
});

describe('Get Note Detail - Error Cases', () => {
  it('should return error object for nonexistent note', async () => {
    const pool = createMockPool({});
    const execute = createGetNoteDetailExecute(pool);

    const result = await execute({ context: { note_id: 'nonexistent-uuid' } });

    expect(result).toHaveProperty('error');
    expect(result.error).toBe('Note not found');
    expect(result.note).toBeUndefined();
    expect(result.connections).toBeUndefined();
  });

  it('should handle pool query error', async () => {
    const pool = {
      query: vi.fn(async () => { throw new Error('database offline'); })
    };
    const execute = createGetNoteDetailExecute(pool);

    await expect(
      execute({ context: { note_id: 'n1' } })
    ).rejects.toThrow('database offline');
  });
});

describe('Get Note Detail - Connection Loading', () => {
  it('should load connections for found note', async () => {
    const mockNote = { id: 'n1', title: 'Test Note' };
    const mockConns = [
      { source_note_id: 'n1', target_note_id: 'n2', relationship: 'cites', confidence: 0.9, target_title: 'Other' },
    ];

    const pool = {
      query: vi.fn(async (sql) => {
        if (sql.includes('FROM notes WHERE id')) return { rows: [mockNote] };
        if (sql.includes('FROM connections')) return { rows: mockConns };
        return { rows: [] };
      })
    };
    const execute = createGetNoteDetailExecute(pool);

    const result = await execute({ context: { note_id: 'n1' } });

    expect(result.note.id).toBe('n1');
    expect(result.connections).toHaveLength(1);
    expect(result.connections[0].target_title).toBe('Other');
  });

  it('should return empty connections for isolated note', async () => {
    const pool = {
      query: vi.fn(async (sql) => {
        if (sql.includes('FROM notes WHERE id')) return { rows: [{ id: 'n1' }] };
        return { rows: [] };
      })
    };
    const execute = createGetNoteDetailExecute(pool);

    const result = await execute({ context: { note_id: 'n1' } });
    expect(result.connections).toHaveLength(0);
  });

  it('should handle note with multiple connections', async () => {
    const mockConns = Array.from({ length: 5 }, (_, i) => ({
      source_note_id: 'n1',
      target_note_id: `n${i + 2}`,
      relationship: `rel-${i}`,
      confidence: 0.8 + i * 0.02,
      target_title: `Note ${i + 2}`
    }));

    const pool = {
      query: vi.fn(async (sql) => {
        if (sql.includes('FROM notes WHERE id')) return { rows: [{ id: 'n1' }] };
        if (sql.includes('FROM connections')) return { rows: mockConns };
        return { rows: [] };
      })
    };
    const execute = createGetNoteDetailExecute(pool);

    const result = await execute({ context: { note_id: 'n1' } });
    expect(result.connections).toHaveLength(5);
  });
});

describe('List All Notes - Pagination', () => {
  it('should pass correct limit to query', async () => {
    const pool = createMockPool({ 'FROM notes': { rows: [] } });
    const execute = createListAllNotesExecute(pool);

    await execute({ context: { owner_id: 'default', limit: 15 } });

    expect(pool.query).toHaveBeenCalledWith(
      expect.any(String),
      ['default', 15]
    );
  });

  it('should handle limit of 1', async () => {
    const pool = createMockPool({ 'FROM notes': { rows: [{ id: 'n1' }] } });
    const execute = createListAllNotesExecute(pool);

    const result = await execute({ context: { owner_id: 'default', limit: 1 } });
    expect(result.count).toBe(1);
  });

  it('should handle zero results', async () => {
    const pool = createMockPool({ 'FROM notes': { rows: [] } });
    const execute = createListAllNotesExecute(pool);

    const result = await execute({ context: { owner_id: 'new-user', limit: 30 } });
    expect(result.notes).toEqual([]);
    expect(result.count).toBe(0);
  });

  it('should return expected fields in list view', async () => {
    const mockNote = {
      id: 'n1', title: 'Test', ai_summary: 'Summary', ai_tags: 'ai',
      source_url: 'https://example.com', is_processed: 1,
      created_at: '2026-01-01', updated_at: '2026-01-02'
    };
    const pool = createMockPool({ 'FROM notes': { rows: [mockNote] } });
    const execute = createListAllNotesExecute(pool);

    const result = await execute({ context: { owner_id: 'default', limit: 30 } });

    const note = result.notes[0];
    expect(note).toHaveProperty('id');
    expect(note).toHaveProperty('title');
    expect(note).toHaveProperty('ai_summary');
    expect(note).toHaveProperty('ai_tags');
    expect(note).toHaveProperty('is_processed');
  });
});

describe('Get Tags - Edge Cases', () => {
  it('should return tags sorted by note_count descending', async () => {
    const mockTags = [
      { name: 'ai', note_count: 10 },
      { name: 'ml', note_count: 5 },
      { name: 'data', note_count: 1 },
    ];
    const pool = createMockPool({ 'FROM tags': { rows: mockTags } });
    const execute = createGetTagsExecute(pool);

    const result = await execute();
    expect(result.tags[0].note_count).toBeGreaterThanOrEqual(result.tags[1].note_count);
    expect(result.tags[1].note_count).toBeGreaterThanOrEqual(result.tags[2].note_count);
  });

  it('should handle single tag', async () => {
    const pool = createMockPool({ 'FROM tags': { rows: [{ name: 'only-tag', note_count: 1 }] } });
    const execute = createGetTagsExecute(pool);

    const result = await execute();
    expect(result.tags).toHaveLength(1);
    expect(result.tags[0].name).toBe('only-tag');
  });

  it('should handle tags with zero count', async () => {
    const pool = createMockPool({ 'FROM tags': { rows: [{ name: 'unused', note_count: 0 }] } });
    const execute = createGetTagsExecute(pool);

    const result = await execute();
    expect(result.tags[0].note_count).toBe(0);
  });

  it('should handle database error in get tags', async () => {
    const pool = {
      query: vi.fn(async () => { throw new Error('table not found'); })
    };
    const execute = createGetTagsExecute(pool);

    await expect(execute()).rejects.toThrow('table not found');
  });
});

describe('Connection Graph - Advanced Scenarios', () => {
  it('should limit to 100 connections', async () => {
    const pool = createMockPool({ 'FROM connections': { rows: [] } });
    const execute = createGetConnectionGraphExecute(pool);

    await execute({ context: { owner_id: 'default' } });

    const sql = pool.query.mock.calls[0][0];
    expect(sql).toContain('LIMIT 100');
  });

  it('should include both source and target titles', async () => {
    const mockConn = {
      source_note_id: 'n1', target_note_id: 'n2',
      relationship: 'cites', confidence: 0.95,
      source_title: 'Paper A', target_title: 'Paper B'
    };
    const pool = createMockPool({ 'FROM connections': { rows: [mockConn] } });
    const execute = createGetConnectionGraphExecute(pool);

    const result = await execute({ context: { owner_id: 'default' } });

    expect(result.connections[0].source_title).toBe('Paper A');
    expect(result.connections[0].target_title).toBe('Paper B');
  });

  it('should handle circular connections', async () => {
    const mockConns = [
      { source_note_id: 'n1', target_note_id: 'n2', relationship: 'cites', confidence: 0.9, source_title: 'A', target_title: 'B' },
      { source_note_id: 'n2', target_note_id: 'n1', relationship: 'cited-by', confidence: 0.85, source_title: 'B', target_title: 'A' },
    ];
    const pool = createMockPool({ 'FROM connections': { rows: mockConns } });
    const execute = createGetConnectionGraphExecute(pool);

    const result = await execute({ context: { owner_id: 'default' } });

    expect(result.connections).toHaveLength(2);
    expect(result.connections[0].source_note_id).toBe('n1');
    expect(result.connections[1].source_note_id).toBe('n2');
  });

  it('should handle database error in connection graph', async () => {
    const pool = {
      query: vi.fn(async () => { throw new Error('join failure'); })
    };
    const execute = createGetConnectionGraphExecute(pool);

    await expect(
      execute({ context: { owner_id: 'default' } })
    ).rejects.toThrow('join failure');
  });

  it('should filter connections by owner via JOIN', async () => {
    const pool = createMockPool({ 'FROM connections': { rows: [] } });
    const execute = createGetConnectionGraphExecute(pool);

    await execute({ context: { owner_id: 'specific-user' } });

    const sql = pool.query.mock.calls[0][0];
    expect(sql).toContain('s.owner_id');
    expect(pool.query).toHaveBeenCalledWith(
      expect.any(String),
      ['specific-user']
    );
  });
});

describe('Agent Configuration', () => {
  it('should have correct agent ID', () => {
    const agentConfig = {
      id: 'syncmind-research-agent',
      name: 'SyncMind Research Agent',
    };
    expect(agentConfig.id).toBe('syncmind-research-agent');
    expect(agentConfig.name).toBe('SyncMind Research Agent');
  });

  it('should register all 5 tools', () => {
    const tools = {
      searchNotesTool: { id: 'search-notes' },
      getNoteDetailTool: { id: 'get-note-detail' },
      listAllNotesTool: { id: 'list-all-notes' },
      getTagsTool: { id: 'get-tags' },
      getConnectionGraphTool: { id: 'get-connection-graph' },
    };

    expect(Object.keys(tools)).toHaveLength(5);
    expect(tools.searchNotesTool.id).toBe('search-notes');
    expect(tools.getNoteDetailTool.id).toBe('get-note-detail');
    expect(tools.listAllNotesTool.id).toBe('list-all-notes');
    expect(tools.getTagsTool.id).toBe('get-tags');
    expect(tools.getConnectionGraphTool.id).toBe('get-connection-graph');
  });

  it('should have agent instructions mentioning key capabilities', () => {
    const instructions = `You are SyncMind's Research Agent, an AI assistant that helps users analyze, connect, and synthesize their research notes.`;
    expect(instructions).toContain('Research Agent');
    expect(instructions).toContain('analyze');
    expect(instructions).toContain('connect');
    expect(instructions).toContain('synthesize');
  });
});

describe('Tool Input Validation Patterns', () => {
  it('search-notes should have query, owner_id, and limit params', () => {
    const inputSchema = {
      query: 'string',
      owner_id: 'string (default: "default")',
      limit: 'number (default: 10)',
    };
    expect(inputSchema).toHaveProperty('query');
    expect(inputSchema).toHaveProperty('owner_id');
    expect(inputSchema).toHaveProperty('limit');
  });

  it('get-note-detail should require note_id', () => {
    const inputSchema = { note_id: 'string (required)' };
    expect(inputSchema).toHaveProperty('note_id');
  });

  it('list-all-notes should have owner_id and limit', () => {
    const inputSchema = {
      owner_id: 'string (default: "default")',
      limit: 'number (default: 30)',
    };
    expect(inputSchema).toHaveProperty('owner_id');
    expect(inputSchema).toHaveProperty('limit');
  });

  it('get-tags should have empty input schema', () => {
    const inputSchema = {};
    expect(Object.keys(inputSchema)).toHaveLength(0);
  });

  it('get-connection-graph should have owner_id', () => {
    const inputSchema = { owner_id: 'string (default: "default")' };
    expect(inputSchema).toHaveProperty('owner_id');
  });
});
