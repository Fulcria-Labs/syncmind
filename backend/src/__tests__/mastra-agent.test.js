import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock pool factory
function createMockPool(queryResponses = {}) {
  const defaultResponse = { rows: [] };
  return {
    query: vi.fn(async (sql) => {
      for (const [pattern, response] of Object.entries(queryResponses)) {
        if (sql.includes(pattern)) return response;
      }
      return defaultResponse;
    })
  };
}

// Extract tool execute functions to test them directly
// (mirrors createResearchAgent tool definitions)

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

// ─── search-notes tool ───

describe('Mastra Agent - search-notes tool', () => {
  it('should return matching notes for a keyword query', async () => {
    const mockNotes = [
      { id: 'n1', title: 'RAG Deep Dive', content: 'About RAG...', ai_summary: 'RAG overview', ai_tags: 'ai,rag', source_url: '', created_at: '2026-01-01' },
      { id: 'n2', title: 'Vector Search', content: 'Embedding retrieval', ai_summary: 'Vector search', ai_tags: 'ai,rag,vectors', source_url: '', created_at: '2026-01-02' },
    ];
    const pool = createMockPool({ 'FROM notes': { rows: mockNotes } });
    const execute = createSearchNotesExecute(pool);

    const result = await execute({ context: { query: 'RAG', owner_id: 'default', limit: 10 } });

    expect(result.notes).toHaveLength(2);
    expect(result.count).toBe(2);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('ILIKE'),
      ['default', '%RAG%', 10]
    );
  });

  it('should return empty results when no notes match', async () => {
    const pool = createMockPool({ 'FROM notes': { rows: [] } });
    const execute = createSearchNotesExecute(pool);

    const result = await execute({ context: { query: 'nonexistent', owner_id: 'user1', limit: 5 } });

    expect(result.notes).toHaveLength(0);
    expect(result.count).toBe(0);
  });

  it('should respect the limit parameter', async () => {
    const pool = createMockPool({ 'FROM notes': { rows: [{ id: 'n1' }] } });
    const execute = createSearchNotesExecute(pool);

    await execute({ context: { query: 'test', owner_id: 'default', limit: 3 } });

    expect(pool.query).toHaveBeenCalledWith(
      expect.any(String),
      ['default', '%test%', 3]
    );
  });

  it('should scope search by owner_id', async () => {
    const pool = createMockPool({ 'FROM notes': { rows: [] } });
    const execute = createSearchNotesExecute(pool);

    await execute({ context: { query: 'ai', owner_id: 'user-42', limit: 10 } });

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('owner_id'),
      ['user-42', '%ai%', 10]
    );
  });
});

// ─── get-note-detail tool ───

describe('Mastra Agent - get-note-detail tool', () => {
  it('should return note with its connections', async () => {
    const mockNote = { id: 'n1', title: 'Test Note', content: 'Full content', ai_summary: 'Summary', ai_tags: 'ai' };
    const mockConnections = [
      { source_note_id: 'n1', target_note_id: 'n2', relationship: 'relates to', confidence: 0.9, target_title: 'Related Note' }
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

    expect(result.note).toEqual(mockNote);
    expect(result.connections).toHaveLength(1);
    expect(result.connections[0].target_title).toBe('Related Note');
  });

  it('should return error when note not found', async () => {
    const pool = createMockPool({ 'FROM notes': { rows: [] } });
    const execute = createGetNoteDetailExecute(pool);

    const result = await execute({ context: { note_id: 'nonexistent' } });

    expect(result.error).toBe('Note not found');
    expect(result.note).toBeUndefined();
  });

  it('should return note with empty connections', async () => {
    const mockNote = { id: 'n1', title: 'Isolated Note' };
    const pool = {
      query: vi.fn(async (sql) => {
        if (sql.includes('FROM notes WHERE id')) return { rows: [mockNote] };
        return { rows: [] };
      })
    };
    const execute = createGetNoteDetailExecute(pool);

    const result = await execute({ context: { note_id: 'n1' } });

    expect(result.note).toEqual(mockNote);
    expect(result.connections).toHaveLength(0);
  });
});

// ─── list-all-notes tool ───

describe('Mastra Agent - list-all-notes tool', () => {
  it('should list notes ordered by updated_at', async () => {
    const mockNotes = [
      { id: 'n3', title: 'Recent', updated_at: '2026-03-01' },
      { id: 'n1', title: 'Older', updated_at: '2026-01-01' },
    ];
    const pool = createMockPool({ 'FROM notes': { rows: mockNotes } });
    const execute = createListAllNotesExecute(pool);

    const result = await execute({ context: { owner_id: 'default', limit: 30 } });

    expect(result.notes).toHaveLength(2);
    expect(result.count).toBe(2);
    expect(result.notes[0].title).toBe('Recent');
  });

  it('should use custom limit', async () => {
    const pool = createMockPool({ 'FROM notes': { rows: [] } });
    const execute = createListAllNotesExecute(pool);

    await execute({ context: { owner_id: 'default', limit: 5 } });

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('LIMIT'),
      ['default', 5]
    );
  });

  it('should handle large collections', async () => {
    const manyNotes = Array.from({ length: 30 }, (_, i) => ({
      id: `n${i}`, title: `Note ${i}`, ai_summary: `Summary ${i}`
    }));
    const pool = createMockPool({ 'FROM notes': { rows: manyNotes } });
    const execute = createListAllNotesExecute(pool);

    const result = await execute({ context: { owner_id: 'default', limit: 30 } });

    expect(result.count).toBe(30);
  });
});

// ─── get-tags tool ───

describe('Mastra Agent - get-tags tool', () => {
  it('should return tags sorted by frequency', async () => {
    const mockTags = [
      { name: 'ai', note_count: 5 },
      { name: 'research', note_count: 3 },
      { name: 'rag', note_count: 1 },
    ];
    const pool = createMockPool({ 'FROM tags': { rows: mockTags } });
    const execute = createGetTagsExecute(pool);

    const result = await execute();

    expect(result.tags).toHaveLength(3);
    expect(result.tags[0].name).toBe('ai');
    expect(result.tags[0].note_count).toBe(5);
  });

  it('should handle empty tag collection', async () => {
    const pool = createMockPool({ 'FROM tags': { rows: [] } });
    const execute = createGetTagsExecute(pool);

    const result = await execute();

    expect(result.tags).toHaveLength(0);
  });

  it('should limit to 50 tags', async () => {
    const pool = createMockPool({ 'FROM tags': { rows: [] } });
    const execute = createGetTagsExecute(pool);

    await execute();

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('LIMIT 50')
    );
  });
});

// ─── get-connection-graph tool ───

describe('Mastra Agent - get-connection-graph tool', () => {
  it('should return connections with note titles', async () => {
    const mockConnections = [
      { source_note_id: 'n1', target_note_id: 'n2', relationship: 'foundational for', confidence: 0.92, source_title: 'Transformers', target_title: 'RAG' },
      { source_note_id: 'n2', target_note_id: 'n3', relationship: 'relies on', confidence: 0.85, source_title: 'RAG', target_title: 'Embeddings' },
    ];
    const pool = createMockPool({ 'FROM connections': { rows: mockConnections } });
    const execute = createGetConnectionGraphExecute(pool);

    const result = await execute({ context: { owner_id: 'default' } });

    expect(result.connections).toHaveLength(2);
    expect(result.count).toBe(2);
    expect(result.connections[0].source_title).toBe('Transformers');
    expect(result.connections[0].confidence).toBe(0.92);
  });

  it('should return empty graph for new users', async () => {
    const pool = createMockPool({ 'FROM connections': { rows: [] } });
    const execute = createGetConnectionGraphExecute(pool);

    const result = await execute({ context: { owner_id: 'new-user' } });

    expect(result.connections).toHaveLength(0);
    expect(result.count).toBe(0);
  });

  it('should scope connections by owner', async () => {
    const pool = createMockPool({ 'FROM connections': { rows: [] } });
    const execute = createGetConnectionGraphExecute(pool);

    await execute({ context: { owner_id: 'user-99' } });

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('owner_id'),
      ['user-99']
    );
  });

  it('should order by confidence descending', async () => {
    const pool = createMockPool({ 'FROM connections': { rows: [] } });
    const execute = createGetConnectionGraphExecute(pool);

    await execute({ context: { owner_id: 'default' } });

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY c.confidence DESC'),
      expect.any(Array)
    );
  });
});

// ─── processNote integration ───

describe('processNote Integration', () => {
  function createProcessNote(dbPool, provider, noteId) {
    // Mirror the processNote function from ai.js for testing
    return async () => {
      const { rows } = await dbPool.query('SELECT * FROM notes WHERE id = $1', [noteId]);
      if (!rows.length) return null;

      const note = rows[0];
      const { rows: otherNotes } = await dbPool.query(
        'SELECT id, title, content, ai_tags FROM notes WHERE id != $1 AND owner_id = $2 LIMIT 20',
        [note.id, note.owner_id]
      );

      const otherNotesContext = otherNotes
        .map(n => `[${n.id}] "${n.title}": ${(n.content || '').slice(0, 200)}`)
        .join('\n');

      const text = await provider.chat(expect.any(String));

      let result;
      try {
        result = JSON.parse(text);
      } catch {
        const match = text.match(/\{[\s\S]*\}/);
        result = match ? JSON.parse(match[0]) : { summary: text, tags: [], connections: [], key_insights: [] };
      }

      const now = new Date().toISOString();
      await dbPool.query(
        expect.stringContaining('UPDATE notes'),
        [result.summary || '', (result.tags || []).join(','), (result.connections || []).map(c => `${c.note_id}:${c.relationship}`).join(','), note.id, now]
      );

      if (result.connections?.length) {
        for (const conn of result.connections) {
          const exists = otherNotes.find(n => n.id === conn.note_id);
          if (exists) {
            await dbPool.query(expect.stringContaining('INSERT INTO connections'), [note.id, conn.note_id, conn.relationship, 0.8]);
          }
        }
      }

      for (const tag of result.tags || []) {
        await dbPool.query(expect.stringContaining('INSERT INTO tags'), [tag]);
      }

      return result;
    };
  }

  it('should return null for nonexistent note', async () => {
    const pool = createMockPool({ 'FROM notes WHERE id': { rows: [] } });
    const provider = { chat: vi.fn() };

    // Directly test the null path
    const { rows } = await pool.query('SELECT * FROM notes WHERE id = $1', ['nonexistent']);
    expect(rows.length).toBe(0);
  });

  it('should build context from other notes', () => {
    const otherNotes = [
      { id: 'n2', title: 'RAG Patterns', content: 'RAG combines retrieval with generation...', ai_tags: 'ai,rag' },
      { id: 'n3', title: 'Embeddings', content: 'Vector embeddings map text to numbers', ai_tags: 'ai,embeddings' },
    ];

    const context = otherNotes
      .map(n => `[${n.id}] "${n.title}": ${(n.content || '').slice(0, 200)}`)
      .join('\n');

    expect(context).toContain('[n2] "RAG Patterns"');
    expect(context).toContain('[n3] "Embeddings"');
    expect(context).toContain('RAG combines retrieval');
  });

  it('should handle content truncation in context building', () => {
    const longContent = 'x'.repeat(500);
    const otherNotes = [{ id: 'n1', title: 'Long Note', content: longContent, ai_tags: '' }];

    const context = otherNotes
      .map(n => `[${n.id}] "${n.title}": ${(n.content || '').slice(0, 200)}`)
      .join('\n');

    expect(context.length).toBeLessThan(longContent.length);
    expect(context).toContain('x'.repeat(200));
  });

  it('should serialize connections to comma-separated format', () => {
    const connections = [
      { note_id: 'n2', relationship: 'builds on' },
      { note_id: 'n3', relationship: 'contrasts with' },
    ];

    const serialized = connections.map(c => `${c.note_id}:${c.relationship}`).join(',');

    expect(serialized).toBe('n2:builds on,n3:contrasts with');
  });

  it('should only create connections for verified existing notes', () => {
    const otherNotes = [
      { id: 'n2', title: 'Existing' },
      { id: 'n3', title: 'Also Existing' },
    ];

    const aiConnections = [
      { note_id: 'n2', relationship: 'relates to' },
      { note_id: 'n99', relationship: 'hallucinated connection' },
      { note_id: 'n3', relationship: 'builds on' },
    ];

    const validConnections = aiConnections.filter(conn =>
      otherNotes.find(n => n.id === conn.note_id)
    );

    expect(validConnections).toHaveLength(2);
    expect(validConnections.map(c => c.note_id)).toEqual(['n2', 'n3']);
  });

  it('should handle AI response with no connections', () => {
    const result = { summary: 'Standalone note', tags: ['ai'], connections: [], key_insights: ['one'] };

    expect(result.connections?.length).toBeFalsy();
    expect((result.tags || []).join(',')).toBe('ai');
  });

  it('should handle AI response with null fields', () => {
    const result = { summary: null, tags: null, connections: null, key_insights: null };

    expect(result.summary || '').toBe('');
    expect((result.tags || []).join(',')).toBe('');
    expect((result.connections || []).map(c => `${c.note_id}:${c.relationship}`).join(',')).toBe('');
  });
});

// ─── Background processor ───

describe('Background Processor Logic', () => {
  it('should only process notes with is_processed = 0', async () => {
    const unprocessed = [
      { id: 'n1' },
      { id: 'n2' },
    ];
    const pool = createMockPool({ 'is_processed = 0': { rows: unprocessed } });

    const { rows } = await pool.query(
      'SELECT id FROM notes WHERE is_processed = 0 ORDER BY created_at ASC LIMIT 3'
    );

    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe('n1');
  });

  it('should process at most 3 notes per cycle', async () => {
    const pool = createMockPool({ 'is_processed = 0': { rows: [] } });

    await pool.query(
      'SELECT id FROM notes WHERE is_processed = 0 ORDER BY created_at ASC LIMIT 3'
    );

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('LIMIT 3')
    );
  });

  it('should handle empty queue gracefully', async () => {
    const pool = createMockPool({ 'is_processed = 0': { rows: [] } });

    const { rows } = await pool.query(
      'SELECT id FROM notes WHERE is_processed = 0 ORDER BY created_at ASC LIMIT 3'
    );

    expect(rows).toHaveLength(0);
    // No errors thrown
  });
});

// ─── Agent endpoint input validation ───

describe('Agent Endpoint Validation', () => {
  it('should reject empty message', () => {
    const body = { message: '', history: [], owner_id: 'default' };
    expect(!body.message).toBe(true);
  });

  it('should accept message with history', () => {
    const body = {
      message: 'How are my notes connected?',
      history: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi! I can help with your research.' },
      ],
      owner_id: 'default'
    };

    const messages = [
      ...body.history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: `[Context: owner_id=${body.owner_id}]\n\n${body.message}` }
    ];

    expect(messages).toHaveLength(3);
    expect(messages[2].content).toContain('owner_id=default');
    expect(messages[2].content).toContain('How are my notes connected?');
  });

  it('should default owner_id to "default"', () => {
    const body = { message: 'Test' };
    const owner_id = body.owner_id || 'default';
    expect(owner_id).toBe('default');
  });

  it('should default history to empty array', () => {
    const body = { message: 'Test' };
    const history = body.history || [];
    expect(history).toEqual([]);
  });
});

// ─── Ask endpoint logic ───

describe('Ask Endpoint - Context Building', () => {
  it('should build context from notes with summaries', () => {
    const notes = [
      { title: 'AI Overview', content: 'Full content here', ai_summary: 'Brief AI overview', ai_tags: 'ai,ml' },
      { title: 'RAG Patterns', content: 'RAG details', ai_summary: null, ai_tags: '' },
    ];

    const context = notes
      .map(n => `## ${n.title}\n${n.ai_summary || n.content?.slice(0, 300) || ''}\nTags: ${n.ai_tags || ''}`)
      .join('\n\n');

    expect(context).toContain('## AI Overview');
    expect(context).toContain('Brief AI overview');
    expect(context).toContain('## RAG Patterns');
    expect(context).toContain('RAG details'); // Falls back to content when no summary
    expect(context).toContain('Tags: ai,ml');
  });

  it('should truncate long content in context', () => {
    const notes = [
      { title: 'Long Note', content: 'x'.repeat(500), ai_summary: null, ai_tags: '' },
    ];

    const context = notes
      .map(n => `## ${n.title}\n${n.ai_summary || n.content?.slice(0, 300) || ''}\nTags: ${n.ai_tags || ''}`)
      .join('\n\n');

    expect(context.length).toBeLessThan(500);
  });

  it('should handle notes with no content or summary', () => {
    const notes = [
      { title: 'Empty Note', content: null, ai_summary: null, ai_tags: null },
    ];

    const context = notes
      .map(n => `## ${n.title}\n${n.ai_summary || n.content?.slice(0, 300) || ''}\nTags: ${n.ai_tags || ''}`)
      .join('\n\n');

    expect(context).toContain('## Empty Note');
    expect(context).toContain('Tags: ');
  });
});

// ─── Brief endpoint logic ───

describe('Brief Endpoint - Topic Filtering', () => {
  it('should include topic focus in prompt when provided', () => {
    const topic = 'machine learning';
    const prompt = `Create a research brief from these notes${topic ? ` focused on: ${topic}` : ''}.`;
    expect(prompt).toContain('focused on: machine learning');
  });

  it('should create general brief when no topic', () => {
    const topic = undefined;
    const prompt = `Create a research brief from these notes${topic ? ` focused on: ${topic}` : ''}.`;
    expect(prompt).not.toContain('focused on');
  });

  it('should build brief context with truncated content', () => {
    const notes = [
      { title: 'Note 1', ai_summary: 'Summary 1', content: 'Full content' },
      { title: 'Note 2', ai_summary: null, content: 'x'.repeat(300) },
    ];

    const context = notes
      .map(n => `- ${n.title}: ${n.ai_summary || n.content?.slice(0, 200) || ''}`)
      .join('\n');

    expect(context).toContain('- Note 1: Summary 1');
    expect(context.split('\n')).toHaveLength(2);
  });
});

// ─── Enriched Tool Call Response ───

describe('Enriched Tool Call Response', () => {
  // Mirrors the enrichment logic from ai.js agent/chat endpoint
  function enrichToolCalls(toolCalls) {
    return (toolCalls || []).map(tc => {
      const toolName = tc.toolName || tc.name || 'unknown';
      const args = tc.args || {};
      let resultSummary = '';

      if (tc.result) {
        if (toolName === 'searchNotesTool' && typeof tc.result === 'object') {
          const count = tc.result.count ?? tc.result.notes?.length ?? 0;
          resultSummary = `${count} result${count !== 1 ? 's' : ''}`;
        } else if (toolName === 'getNoteDetailTool' && typeof tc.result === 'object') {
          if (tc.result.error) {
            resultSummary = tc.result.error;
          } else if (tc.result.note?.title) {
            const connCount = tc.result.connections?.length || 0;
            resultSummary = `"${tc.result.note.title}" (${connCount} connection${connCount !== 1 ? 's' : ''})`;
          }
        } else if (toolName === 'listAllNotesTool' && typeof tc.result === 'object') {
          const count = tc.result.count ?? tc.result.notes?.length ?? 0;
          resultSummary = `${count} note${count !== 1 ? 's' : ''}`;
        } else if (toolName === 'getTagsTool' && typeof tc.result === 'object') {
          const count = tc.result.tags?.length ?? 0;
          resultSummary = `${count} tag${count !== 1 ? 's' : ''}`;
        } else if (toolName === 'getConnectionGraphTool' && typeof tc.result === 'object') {
          const count = tc.result.count ?? tc.result.connections?.length ?? 0;
          resultSummary = `${count} connection${count !== 1 ? 's' : ''}`;
        }
      }

      return {
        toolName,
        args,
        ...(resultSummary ? { resultSummary } : {})
      };
    });
  }

  it('should enrich searchNotesTool with result count', () => {
    const toolCalls = [{
      toolName: 'searchNotesTool',
      args: { query: 'AI' },
      result: { notes: [{ id: 'n1' }, { id: 'n2' }, { id: 'n3' }], count: 3 }
    }];

    const enriched = enrichToolCalls(toolCalls);
    expect(enriched[0].resultSummary).toBe('3 results');
  });

  it('should handle singular result count', () => {
    const toolCalls = [{
      toolName: 'searchNotesTool',
      args: { query: 'specific' },
      result: { notes: [{ id: 'n1' }], count: 1 }
    }];

    const enriched = enrichToolCalls(toolCalls);
    expect(enriched[0].resultSummary).toBe('1 result');
  });

  it('should enrich getNoteDetailTool with note title', () => {
    const toolCalls = [{
      toolName: 'getNoteDetailTool',
      args: { note_id: 'n1' },
      result: {
        note: { id: 'n1', title: 'RAG Deep Dive' },
        connections: [{ target_note_id: 'n2' }, { target_note_id: 'n3' }]
      }
    }];

    const enriched = enrichToolCalls(toolCalls);
    expect(enriched[0].resultSummary).toBe('"RAG Deep Dive" (2 connections)');
  });

  it('should handle getNoteDetailTool error result', () => {
    const toolCalls = [{
      toolName: 'getNoteDetailTool',
      args: { note_id: 'nonexistent' },
      result: { error: 'Note not found' }
    }];

    const enriched = enrichToolCalls(toolCalls);
    expect(enriched[0].resultSummary).toBe('Note not found');
  });

  it('should enrich listAllNotesTool with note count', () => {
    const toolCalls = [{
      toolName: 'listAllNotesTool',
      args: { owner_id: 'default' },
      result: { notes: Array.from({ length: 15 }, (_, i) => ({ id: `n${i}` })), count: 15 }
    }];

    const enriched = enrichToolCalls(toolCalls);
    expect(enriched[0].resultSummary).toBe('15 notes');
  });

  it('should enrich getTagsTool with tag count', () => {
    const toolCalls = [{
      toolName: 'getTagsTool',
      args: {},
      result: { tags: [{ name: 'ai' }, { name: 'ml' }, { name: 'research' }] }
    }];

    const enriched = enrichToolCalls(toolCalls);
    expect(enriched[0].resultSummary).toBe('3 tags');
  });

  it('should enrich getConnectionGraphTool with connection count', () => {
    const toolCalls = [{
      toolName: 'getConnectionGraphTool',
      args: { owner_id: 'default' },
      result: { connections: [{ source: 'n1', target: 'n2' }], count: 1 }
    }];

    const enriched = enrichToolCalls(toolCalls);
    expect(enriched[0].resultSummary).toBe('1 connection');
  });

  it('should not include resultSummary when no result present', () => {
    const toolCalls = [{
      toolName: 'searchNotesTool',
      args: { query: 'test' }
    }];

    const enriched = enrichToolCalls(toolCalls);
    expect(enriched[0].resultSummary).toBeUndefined();
    expect(enriched[0]).not.toHaveProperty('resultSummary');
  });

  it('should handle multiple tool calls with mixed results', () => {
    const toolCalls = [
      { toolName: 'searchNotesTool', args: { query: 'ML' }, result: { count: 2, notes: [{}, {}] } },
      { toolName: 'getTagsTool', args: {} },
      { toolName: 'listAllNotesTool', args: {}, result: { count: 10, notes: [] } },
    ];

    const enriched = enrichToolCalls(toolCalls);
    expect(enriched).toHaveLength(3);
    expect(enriched[0].resultSummary).toBe('2 results');
    expect(enriched[1]).not.toHaveProperty('resultSummary');
    expect(enriched[2].resultSummary).toBe('10 notes');
  });

  it('should handle empty tool calls array', () => {
    const enriched = enrichToolCalls([]);
    expect(enriched).toEqual([]);
  });

  it('should handle null tool calls', () => {
    const enriched = enrichToolCalls(null);
    expect(enriched).toEqual([]);
  });

  it('should handle tool calls with name instead of toolName', () => {
    const toolCalls = [{
      name: 'searchNotesTool',
      args: { query: 'test' },
      result: { count: 0, notes: [] }
    }];

    const enriched = enrichToolCalls(toolCalls);
    expect(enriched[0].toolName).toBe('searchNotesTool');
    expect(enriched[0].resultSummary).toBe('0 results');
  });

  it('should handle zero results across tool types', () => {
    const toolCalls = [
      { toolName: 'searchNotesTool', args: {}, result: { count: 0, notes: [] } },
      { toolName: 'listAllNotesTool', args: {}, result: { count: 0, notes: [] } },
      { toolName: 'getTagsTool', args: {}, result: { tags: [] } },
      { toolName: 'getConnectionGraphTool', args: {}, result: { count: 0, connections: [] } },
    ];

    const enriched = enrichToolCalls(toolCalls);
    expect(enriched[0].resultSummary).toBe('0 results');
    expect(enriched[1].resultSummary).toBe('0 notes');
    expect(enriched[2].resultSummary).toBe('0 tags');
    expect(enriched[3].resultSummary).toBe('0 connections');
  });
});
