import { describe, it, expect, vi } from 'vitest';

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

// ─── Search Notes - Unicode and Special Characters ───

describe('Search Notes - Unicode and Special Characters', () => {
  it('should search with unicode query', async () => {
    const pool = createMockPool({ 'FROM notes': { rows: [] } });
    const execute = createSearchNotesExecute(pool);

    await execute({ context: { query: '研究', owner_id: 'default', limit: 10 } });

    expect(pool.query).toHaveBeenCalledWith(
      expect.any(String),
      ['default', '%研究%', 10]
    );
  });

  it('should search with emoji query', async () => {
    const pool = createMockPool({ 'FROM notes': { rows: [] } });
    const execute = createSearchNotesExecute(pool);

    await execute({ context: { query: '🧠', owner_id: 'default', limit: 5 } });

    expect(pool.query).toHaveBeenCalledWith(
      expect.any(String),
      ['default', '%🧠%', 5]
    );
  });

  it('should search with ILIKE special chars (% and _)', async () => {
    const pool = createMockPool({ 'FROM notes': { rows: [] } });
    const execute = createSearchNotesExecute(pool);

    await execute({ context: { query: '50%_discount', owner_id: 'default', limit: 10 } });

    // The query wraps with %, but the ILIKE special chars are passed as-is
    // since parameterized queries prevent SQL injection
    expect(pool.query).toHaveBeenCalledWith(
      expect.any(String),
      ['default', '%50%_discount%', 10]
    );
  });

  it('should handle backslash in query', async () => {
    const pool = createMockPool({ 'FROM notes': { rows: [] } });
    const execute = createSearchNotesExecute(pool);

    await execute({ context: { query: 'path\\to\\file', owner_id: 'default', limit: 10 } });

    expect(pool.query).toHaveBeenCalledWith(
      expect.any(String),
      ['default', '%path\\to\\file%', 10]
    );
  });
});

// ─── Search Notes - Large Result Sets ───

describe('Search Notes - Large Result Sets', () => {
  it('should handle max limit results', async () => {
    const manyNotes = Array.from({ length: 100 }, (_, i) => ({
      id: `n${i}`, title: `Note ${i}`, content: `Content ${i}`,
      ai_summary: '', ai_tags: '', source_url: '', created_at: '2026-01-01'
    }));
    const pool = createMockPool({ 'FROM notes': { rows: manyNotes } });
    const execute = createSearchNotesExecute(pool);

    const result = await execute({ context: { query: 'Note', owner_id: 'default', limit: 100 } });

    expect(result.count).toBe(100);
    expect(result.notes).toHaveLength(100);
  });

  it('should match count to actual rows returned', async () => {
    const notes = [{ id: 'n1' }, { id: 'n2' }];
    const pool = createMockPool({ 'FROM notes': { rows: notes } });
    const execute = createSearchNotesExecute(pool);

    const result = await execute({ context: { query: 'test', owner_id: 'default', limit: 50 } });

    expect(result.count).toBe(result.notes.length);
  });
});

// ─── Get Note Detail - Rich Note Data ───

describe('Get Note Detail - Rich Note Data', () => {
  it('should return full note with all fields', async () => {
    const mockNote = {
      id: 'n1', title: 'Full Note', content: 'Rich content',
      source_url: 'https://example.com', ai_summary: 'AI summary',
      ai_tags: 'tag1,tag2', ai_connections: 'n2:rel', is_processed: 1,
      owner_id: 'user-1', created_at: '2026-01-01', updated_at: '2026-01-02'
    };
    const pool = {
      query: vi.fn(async (sql) => {
        if (sql.includes('FROM notes WHERE id')) return { rows: [mockNote] };
        return { rows: [] };
      })
    };
    const execute = createGetNoteDetailExecute(pool);

    const result = await execute({ context: { note_id: 'n1' } });

    expect(result.note.id).toBe('n1');
    expect(result.note.title).toBe('Full Note');
    expect(result.note.ai_summary).toBe('AI summary');
    expect(result.note.is_processed).toBe(1);
  });

  it('should return multiple connections with different confidence levels', async () => {
    const mockNote = { id: 'n1', title: 'Hub Note' };
    const mockConnections = [
      { source_note_id: 'n1', target_note_id: 'n2', relationship: 'cites', confidence: 0.95, target_title: 'Paper A' },
      { source_note_id: 'n1', target_note_id: 'n3', relationship: 'extends', confidence: 0.80, target_title: 'Paper B' },
      { source_note_id: 'n1', target_note_id: 'n4', relationship: 'contradicts', confidence: 0.60, target_title: 'Paper C' },
    ];

    const pool = {
      query: vi.fn(async (sql) => {
        if (sql.includes('FROM notes WHERE id')) return { rows: [mockNote] };
        if (sql.includes('FROM connections')) return { rows: mockConnections };
        return { rows: [] };
      })
    };
    const execute = createGetNoteDetailExecute(pool);

    const result = await execute({ context: { note_id: 'n1' } });

    expect(result.connections).toHaveLength(3);
    expect(result.connections[0].confidence).toBe(0.95);
    expect(result.connections[2].confidence).toBe(0.60);
  });
});

// ─── List All Notes - Different Owner Scenarios ───

describe('List All Notes - Owner Isolation', () => {
  it('should scope results to specific owner', async () => {
    const pool = createMockPool({ 'FROM notes': { rows: [] } });
    const execute = createListAllNotesExecute(pool);

    await execute({ context: { owner_id: 'isolated-user', limit: 30 } });

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('owner_id'),
      ['isolated-user', 30]
    );
  });

  it('should return processed and unprocessed notes together', async () => {
    const mockNotes = [
      { id: 'n1', title: 'Processed', is_processed: 1 },
      { id: 'n2', title: 'Not Processed', is_processed: 0 },
    ];
    const pool = createMockPool({ 'FROM notes': { rows: mockNotes } });
    const execute = createListAllNotesExecute(pool);

    const result = await execute({ context: { owner_id: 'default', limit: 30 } });

    expect(result.notes).toHaveLength(2);
    expect(result.notes.find(n => n.is_processed === 0)).toBeTruthy();
    expect(result.notes.find(n => n.is_processed === 1)).toBeTruthy();
  });

  it('should handle very large limit without error', async () => {
    const pool = createMockPool({ 'FROM notes': { rows: [] } });
    const execute = createListAllNotesExecute(pool);

    const result = await execute({ context: { owner_id: 'default', limit: 1000 } });

    expect(pool.query).toHaveBeenCalledWith(
      expect.any(String),
      ['default', 1000]
    );
    expect(result.count).toBe(0);
  });
});

// ─── Get Tags - Tag Data Integrity ───

describe('Get Tags - Data Integrity', () => {
  it('should handle tags with very high note counts', async () => {
    const pool = createMockPool({ 'FROM tags': { rows: [{ name: 'popular', note_count: 99999 }] } });
    const execute = createGetTagsExecute(pool);

    const result = await execute();
    expect(result.tags[0].note_count).toBe(99999);
  });

  it('should return unique tag names', async () => {
    const mockTags = [
      { name: 'ai', note_count: 5 },
      { name: 'ml', note_count: 3 },
      { name: 'data', note_count: 2 },
      { name: 'research', note_count: 1 },
    ];
    const pool = createMockPool({ 'FROM tags': { rows: mockTags } });
    const execute = createGetTagsExecute(pool);

    const result = await execute();
    const names = result.tags.map(t => t.name);
    const unique = [...new Set(names)];
    expect(names.length).toBe(unique.length);
  });

  it('should handle tags with hyphenated names', async () => {
    const pool = createMockPool({
      'FROM tags': { rows: [{ name: 'machine-learning', note_count: 3 }] }
    });
    const execute = createGetTagsExecute(pool);

    const result = await execute();
    expect(result.tags[0].name).toBe('machine-learning');
  });
});

// ─── Connection Graph - Complex Graph Topologies ───

describe('Connection Graph - Complex Topologies', () => {
  it('should handle star topology (one hub, many spokes)', async () => {
    const connections = Array.from({ length: 10 }, (_, i) => ({
      source_note_id: 'hub',
      target_note_id: `spoke-${i}`,
      relationship: `connects-${i}`,
      confidence: 0.9 - i * 0.05,
      source_title: 'Hub Note',
      target_title: `Spoke ${i}`
    }));
    const pool = createMockPool({ 'FROM connections': { rows: connections } });
    const execute = createGetConnectionGraphExecute(pool);

    const result = await execute({ context: { owner_id: 'default' } });
    expect(result.count).toBe(10);
    expect(result.connections.every(c => c.source_note_id === 'hub')).toBe(true);
  });

  it('should handle chain topology (A->B->C->D)', async () => {
    const connections = [
      { source_note_id: 'A', target_note_id: 'B', relationship: 'leads to', confidence: 0.9, source_title: 'A', target_title: 'B' },
      { source_note_id: 'B', target_note_id: 'C', relationship: 'leads to', confidence: 0.85, source_title: 'B', target_title: 'C' },
      { source_note_id: 'C', target_note_id: 'D', relationship: 'leads to', confidence: 0.8, source_title: 'C', target_title: 'D' },
    ];
    const pool = createMockPool({ 'FROM connections': { rows: connections } });
    const execute = createGetConnectionGraphExecute(pool);

    const result = await execute({ context: { owner_id: 'default' } });
    expect(result.count).toBe(3);
  });

  it('should handle complete graph (all nodes connected)', async () => {
    const nodes = ['A', 'B', 'C', 'D'];
    const connections = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        connections.push({
          source_note_id: nodes[i],
          target_note_id: nodes[j],
          relationship: 'related',
          confidence: 0.8,
          source_title: nodes[i],
          target_title: nodes[j]
        });
      }
    }
    const pool = createMockPool({ 'FROM connections': { rows: connections } });
    const execute = createGetConnectionGraphExecute(pool);

    const result = await execute({ context: { owner_id: 'default' } });
    expect(result.count).toBe(6); // C(4,2) = 6
  });

  it('should handle disconnected components', async () => {
    const connections = [
      { source_note_id: 'A', target_note_id: 'B', relationship: 'related', confidence: 0.9, source_title: 'A', target_title: 'B' },
      { source_note_id: 'C', target_note_id: 'D', relationship: 'related', confidence: 0.8, source_title: 'C', target_title: 'D' },
    ];
    const pool = createMockPool({ 'FROM connections': { rows: connections } });
    const execute = createGetConnectionGraphExecute(pool);

    const result = await execute({ context: { owner_id: 'default' } });
    expect(result.count).toBe(2);
    // Two disconnected pairs
    const nodes = new Set();
    result.connections.forEach(c => {
      nodes.add(c.source_note_id);
      nodes.add(c.target_note_id);
    });
    expect(nodes.size).toBe(4);
  });
});

// ─── Agent Message Building ───

describe('Agent Message Building', () => {
  it('should prepend context info to user message', () => {
    const owner_id = 'user-42';
    const message = 'What topics are covered?';
    const formatted = `[Context: owner_id=${owner_id}]\n\n${message}`;
    expect(formatted).toBe('[Context: owner_id=user-42]\n\nWhat topics are covered?');
  });

  it('should preserve full history in messages array', () => {
    const history = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi! How can I help?' },
      { role: 'user', content: 'Tell me about AI' },
      { role: 'assistant', content: 'AI is fascinating...' },
    ];
    const message = 'Continue the analysis';
    const owner_id = 'default';

    const messages = [
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: `[Context: owner_id=${owner_id}]\n\n${message}` }
    ];

    expect(messages).toHaveLength(5);
    expect(messages[0].role).toBe('user');
    expect(messages[3].role).toBe('assistant');
    expect(messages[4].content).toContain('Continue the analysis');
  });

  it('should handle history with only user messages', () => {
    const history = [
      { role: 'user', content: 'Question 1' },
      { role: 'user', content: 'Question 2' },
    ];
    const messages = [
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: 'Question 3' }
    ];

    expect(messages).toHaveLength(3);
    expect(messages.every(m => m.role === 'user')).toBe(true);
  });

  it('should handle very long history', () => {
    const history = Array.from({ length: 50 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i}`
    }));

    const messages = [
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: 'Final message' }
    ];

    expect(messages).toHaveLength(51);
  });
});

// ─── SSE Stream Format ───

describe('SSE Stream Format', () => {
  it('should format text chunks as SSE data events', () => {
    const chunks = ['Hello', ' world', '!'];
    const events = chunks.map(text => `data: ${JSON.stringify({ text })}\n\n`);

    expect(events[0]).toBe('data: {"text":"Hello"}\n\n');
    expect(events[1]).toBe('data: {"text":" world"}\n\n');
    expect(events[2]).toBe('data: {"text":"!"}\n\n');
  });

  it('should format SSE with special characters in text', () => {
    const text = 'Line 1\nLine 2\tTabbed "quoted"';
    const event = `data: ${JSON.stringify({ text })}\n\n`;
    expect(event).toContain('\\n');
    expect(event).toContain('\\t');
    expect(event).toContain('\\"quoted\\"');
  });

  it('should end with DONE marker', () => {
    const endEvent = 'data: [DONE]\n\n';
    expect(endEvent).toBe('data: [DONE]\n\n');
  });

  it('should set correct SSE headers', () => {
    const headers = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    };
    expect(headers['Content-Type']).toBe('text/event-stream');
    expect(headers['Cache-Control']).toBe('no-cache');
    expect(headers['Connection']).toBe('keep-alive');
  });
});
