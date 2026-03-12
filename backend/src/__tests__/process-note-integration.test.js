import { describe, it, expect, vi } from 'vitest';

// Full processNote function extracted from ai.js for integration-style testing
async function processNote(dbPool, provider, noteId) {
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

  const text = await provider.chat(`Analyze this research note and respond with ONLY valid JSON (no markdown, no code blocks):

TITLE: ${note.title}
CONTENT: ${note.content || ''}
SOURCE: ${note.source_url || 'none'}

OTHER NOTES IN COLLECTION:
${otherNotesContext || 'none'}

Respond with this JSON structure:
{
  "summary": "2-3 sentence summary of key insights",
  "tags": ["tag1", "tag2", "tag3"],
  "connections": [{"note_id": "uuid", "relationship": "brief description"}],
  "key_insights": ["insight1", "insight2"]
}`);

  let result;
  try {
    result = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    result = match ? JSON.parse(match[0]) : { summary: text, tags: [], connections: [], key_insights: [] };
  }

  const now = new Date().toISOString();
  await dbPool.query(
    `UPDATE notes SET
      ai_summary = $1,
      ai_tags = $2,
      ai_connections = $3,
      is_processed = 1,
      updated_at = $5
    WHERE id = $4`,
    [
      result.summary || '',
      (result.tags || []).join(','),
      (result.connections || []).map(c => `${c.note_id}:${c.relationship}`).join(','),
      note.id,
      now
    ]
  );

  if (result.connections?.length) {
    for (const conn of result.connections) {
      const exists = otherNotes.find(n => n.id === conn.note_id);
      if (exists) {
        await dbPool.query(
          `INSERT INTO connections (id, source_note_id, target_note_id, relationship, confidence, created_at)
           VALUES (uuid_generate_v4(), $1, $2, $3, $4, NOW()::text)
           ON CONFLICT DO NOTHING`,
          [note.id, conn.note_id, conn.relationship, 0.8]
        );
      }
    }
  }

  for (const tag of result.tags || []) {
    await dbPool.query(
      `INSERT INTO tags (name, note_count) VALUES ($1, 1)
       ON CONFLICT (name) DO UPDATE SET note_count = tags.note_count + 1`,
      [tag]
    );
  }

  return result;
}

// ─── processNote full integration tests ───

describe('processNote - Note Not Found', () => {
  it('should return null when note ID does not exist', async () => {
    const pool = { query: vi.fn(async () => ({ rows: [] })) };
    const provider = { chat: vi.fn() };
    const result = await processNote(pool, provider, 'nonexistent-id');
    expect(result).toBeNull();
    expect(provider.chat).not.toHaveBeenCalled();
  });

  it('should only query once for nonexistent note', async () => {
    const pool = { query: vi.fn(async () => ({ rows: [] })) };
    const provider = { chat: vi.fn() };
    await processNote(pool, provider, 'missing');
    expect(pool.query).toHaveBeenCalledTimes(1);
  });
});

describe('processNote - Successful Processing with JSON Response', () => {
  function createPool(note, otherNotes = []) {
    return {
      query: vi.fn(async (sql, params) => {
        if (sql.includes('SELECT * FROM notes WHERE id')) return { rows: [note] };
        if (sql.includes('SELECT id, title, content, ai_tags FROM notes WHERE id !=')) return { rows: otherNotes };
        return { rows: [] };
      })
    };
  }

  it('should parse valid JSON AI response and update note', async () => {
    const note = { id: 'n1', title: 'AI Research', content: 'About AI', owner_id: 'default', source_url: '' };
    const aiResponse = JSON.stringify({
      summary: 'AI research overview',
      tags: ['ai', 'research'],
      connections: [],
      key_insights: ['key finding']
    });
    const pool = createPool(note);
    const provider = { chat: vi.fn(async () => aiResponse) };

    const result = await processNote(pool, provider, 'n1');

    expect(result.summary).toBe('AI research overview');
    expect(result.tags).toEqual(['ai', 'research']);
    expect(result.key_insights).toEqual(['key finding']);
  });

  it('should call provider.chat with prompt containing note title', async () => {
    const note = { id: 'n1', title: 'Special Title', content: 'Body text', owner_id: 'user1', source_url: 'http://ex.com' };
    const pool = createPool(note);
    const provider = { chat: vi.fn(async () => '{"summary":"S","tags":[],"connections":[],"key_insights":[]}') };

    await processNote(pool, provider, 'n1');

    const promptArg = provider.chat.mock.calls[0][0];
    expect(promptArg).toContain('Special Title');
    expect(promptArg).toContain('Body text');
    expect(promptArg).toContain('http://ex.com');
  });

  it('should include other notes context in prompt', async () => {
    const note = { id: 'n1', title: 'Main Note', content: 'Main content', owner_id: 'default', source_url: '' };
    const otherNotes = [
      { id: 'n2', title: 'Other Note', content: 'Other content', ai_tags: 'tag1' }
    ];
    const pool = createPool(note, otherNotes);
    const provider = { chat: vi.fn(async () => '{"summary":"S","tags":[],"connections":[],"key_insights":[]}') };

    await processNote(pool, provider, 'n1');

    const promptArg = provider.chat.mock.calls[0][0];
    expect(promptArg).toContain('[n2] "Other Note"');
    expect(promptArg).toContain('Other content');
  });

  it('should show "none" in prompt when no other notes exist', async () => {
    const note = { id: 'n1', title: 'Only Note', content: 'Solo', owner_id: 'default', source_url: '' };
    const pool = createPool(note, []);
    const provider = { chat: vi.fn(async () => '{"summary":"S","tags":[],"connections":[],"key_insights":[]}') };

    await processNote(pool, provider, 'n1');

    const promptArg = provider.chat.mock.calls[0][0];
    expect(promptArg).toContain('none');
  });

  it('should update the note with AI results via UPDATE query', async () => {
    const note = { id: 'n1', title: 'Test', content: 'Body', owner_id: 'default', source_url: '' };
    const pool = createPool(note);
    const provider = { chat: vi.fn(async () => '{"summary":"Generated summary","tags":["ai","ml"],"connections":[],"key_insights":[]}') };

    await processNote(pool, provider, 'n1');

    // Find the UPDATE call
    const updateCall = pool.query.mock.calls.find(c => c[0].includes('UPDATE notes'));
    expect(updateCall).toBeTruthy();
    expect(updateCall[1][0]).toBe('Generated summary'); // ai_summary
    expect(updateCall[1][1]).toBe('ai,ml'); // ai_tags
    expect(updateCall[1][2]).toBe(''); // ai_connections (empty)
    expect(updateCall[1][3]).toBe('n1'); // note id
  });

  it('should insert tags via upsert queries', async () => {
    const note = { id: 'n1', title: 'Test', content: 'Body', owner_id: 'default', source_url: '' };
    const pool = createPool(note);
    const provider = { chat: vi.fn(async () => '{"summary":"S","tags":["alpha","beta","gamma"],"connections":[],"key_insights":[]}') };

    await processNote(pool, provider, 'n1');

    const tagCalls = pool.query.mock.calls.filter(c => c[0].includes('INSERT INTO tags'));
    expect(tagCalls).toHaveLength(3);
    expect(tagCalls[0][1]).toEqual(['alpha']);
    expect(tagCalls[1][1]).toEqual(['beta']);
    expect(tagCalls[2][1]).toEqual(['gamma']);
  });
});

describe('processNote - Connections Handling', () => {
  it('should create connection records for valid connections only', async () => {
    const note = { id: 'n1', title: 'Main', content: 'Content', owner_id: 'default', source_url: '' };
    const otherNotes = [
      { id: 'n2', title: 'Exists', content: 'Content 2', ai_tags: '' },
      { id: 'n3', title: 'Also Exists', content: 'Content 3', ai_tags: '' },
    ];
    const aiResponse = JSON.stringify({
      summary: 'S',
      tags: [],
      connections: [
        { note_id: 'n2', relationship: 'cites' },
        { note_id: 'n99', relationship: 'hallucinated' },
        { note_id: 'n3', relationship: 'builds on' },
      ],
      key_insights: []
    });

    const pool = {
      query: vi.fn(async (sql, params) => {
        if (sql.includes('SELECT * FROM notes WHERE id')) return { rows: [note] };
        if (sql.includes('SELECT id, title, content, ai_tags')) return { rows: otherNotes };
        return { rows: [] };
      })
    };
    const provider = { chat: vi.fn(async () => aiResponse) };

    await processNote(pool, provider, 'n1');

    const connCalls = pool.query.mock.calls.filter(c => c[0].includes('INSERT INTO connections'));
    expect(connCalls).toHaveLength(2); // n99 is filtered out
    expect(connCalls[0][1][1]).toBe('n2');
    expect(connCalls[1][1][1]).toBe('n3');
  });

  it('should use confidence 0.8 for all AI-detected connections', async () => {
    const note = { id: 'n1', title: 'Main', content: 'Content', owner_id: 'default', source_url: '' };
    const otherNotes = [{ id: 'n2', title: 'Target', content: 'C', ai_tags: '' }];
    const aiResponse = JSON.stringify({
      summary: 'S', tags: [], connections: [{ note_id: 'n2', relationship: 'rel' }], key_insights: []
    });

    const pool = {
      query: vi.fn(async (sql) => {
        if (sql.includes('SELECT * FROM notes WHERE id')) return { rows: [note] };
        if (sql.includes('SELECT id, title, content, ai_tags')) return { rows: otherNotes };
        return { rows: [] };
      })
    };
    const provider = { chat: vi.fn(async () => aiResponse) };

    await processNote(pool, provider, 'n1');

    const connCall = pool.query.mock.calls.find(c => c[0].includes('INSERT INTO connections'));
    expect(connCall[1][3]).toBe(0.8);
  });

  it('should not create connections when AI returns empty array', async () => {
    const note = { id: 'n1', title: 'Test', content: 'Body', owner_id: 'default', source_url: '' };
    const pool = {
      query: vi.fn(async (sql) => {
        if (sql.includes('SELECT * FROM notes WHERE id')) return { rows: [note] };
        if (sql.includes('SELECT id, title, content, ai_tags')) return { rows: [] };
        return { rows: [] };
      })
    };
    const provider = { chat: vi.fn(async () => '{"summary":"S","tags":[],"connections":[],"key_insights":[]}') };

    await processNote(pool, provider, 'n1');

    const connCalls = pool.query.mock.calls.filter(c => c[0].includes('INSERT INTO connections'));
    expect(connCalls).toHaveLength(0);
  });
});

describe('processNote - Malformed AI Response Handling', () => {
  function createMinimalPool(note) {
    return {
      query: vi.fn(async (sql) => {
        if (sql.includes('SELECT * FROM notes WHERE id')) return { rows: [note] };
        if (sql.includes('SELECT id, title, content, ai_tags')) return { rows: [] };
        return { rows: [] };
      })
    };
  }

  const note = { id: 'n1', title: 'Test', content: 'Body', owner_id: 'default', source_url: '' };

  it('should handle markdown-wrapped JSON response', async () => {
    const pool = createMinimalPool(note);
    const provider = { chat: vi.fn(async () => '```json\n{"summary":"Wrapped","tags":["a"],"connections":[],"key_insights":[]}\n```') };

    const result = await processNote(pool, provider, 'n1');
    expect(result.summary).toBe('Wrapped');
    expect(result.tags).toEqual(['a']);
  });

  it('should handle plain text fallback response', async () => {
    const pool = createMinimalPool(note);
    const provider = { chat: vi.fn(async () => 'This is just plain text without any JSON.') };

    const result = await processNote(pool, provider, 'n1');
    expect(result.summary).toBe('This is just plain text without any JSON.');
    expect(result.tags).toEqual([]);
    expect(result.connections).toEqual([]);
  });

  it('should handle JSON with prefix and suffix text', async () => {
    const pool = createMinimalPool(note);
    const provider = { chat: vi.fn(async () => 'Here is the analysis:\n{"summary":"Found","tags":["x"],"connections":[],"key_insights":["i"]}\nDone!') };

    const result = await processNote(pool, provider, 'n1');
    expect(result.summary).toBe('Found');
  });

  it('should handle response with null fields', async () => {
    const pool = createMinimalPool(note);
    const provider = { chat: vi.fn(async () => '{"summary":null,"tags":null,"connections":null,"key_insights":null}') };

    const result = await processNote(pool, provider, 'n1');
    // Should not throw, null fields handled with || defaults
    expect(result).toBeTruthy();

    const updateCall = pool.query.mock.calls.find(c => c[0].includes('UPDATE notes'));
    expect(updateCall[1][0]).toBe(''); // summary || ''
    expect(updateCall[1][1]).toBe(''); // (null || []).join(',')
  });

  it('should handle empty JSON object response', async () => {
    const pool = createMinimalPool(note);
    const provider = { chat: vi.fn(async () => '{}') };

    const result = await processNote(pool, provider, 'n1');
    expect(result).toEqual({});
    const updateCall = pool.query.mock.calls.find(c => c[0].includes('UPDATE notes'));
    expect(updateCall[1][0]).toBe(''); // undefined summary || ''
  });
});

describe('processNote - Error Propagation', () => {
  it('should propagate provider.chat errors', async () => {
    const note = { id: 'n1', title: 'Test', content: 'Body', owner_id: 'default', source_url: '' };
    const pool = {
      query: vi.fn(async (sql) => {
        if (sql.includes('SELECT * FROM notes WHERE id')) return { rows: [note] };
        if (sql.includes('SELECT id, title, content, ai_tags')) return { rows: [] };
        return { rows: [] };
      })
    };
    const provider = { chat: vi.fn(async () => { throw new Error('Rate limit exceeded'); }) };

    await expect(processNote(pool, provider, 'n1')).rejects.toThrow('Rate limit exceeded');
  });

  it('should propagate database UPDATE errors', async () => {
    const note = { id: 'n1', title: 'Test', content: 'Body', owner_id: 'default', source_url: '' };
    const pool = {
      query: vi.fn(async (sql) => {
        if (sql.includes('SELECT * FROM notes WHERE id')) return { rows: [note] };
        if (sql.includes('SELECT id, title, content, ai_tags')) return { rows: [] };
        if (sql.includes('UPDATE notes')) throw new Error('DB write failed');
        return { rows: [] };
      })
    };
    const provider = { chat: vi.fn(async () => '{"summary":"S","tags":[],"connections":[],"key_insights":[]}') };

    await expect(processNote(pool, provider, 'n1')).rejects.toThrow('DB write failed');
  });

  it('should propagate database query errors on initial fetch', async () => {
    const pool = { query: vi.fn(async () => { throw new Error('Connection refused'); }) };
    const provider = { chat: vi.fn() };

    await expect(processNote(pool, provider, 'n1')).rejects.toThrow('Connection refused');
    expect(provider.chat).not.toHaveBeenCalled();
  });
});

describe('processNote - Content Truncation in Context', () => {
  it('should truncate other note content at 200 chars in context', async () => {
    const note = { id: 'n1', title: 'Main', content: 'Content', owner_id: 'default', source_url: '' };
    const longContent = 'x'.repeat(500);
    const otherNotes = [{ id: 'n2', title: 'Long', content: longContent, ai_tags: '' }];

    const pool = {
      query: vi.fn(async (sql) => {
        if (sql.includes('SELECT * FROM notes WHERE id')) return { rows: [note] };
        if (sql.includes('SELECT id, title, content, ai_tags')) return { rows: otherNotes };
        return { rows: [] };
      })
    };
    const provider = { chat: vi.fn(async () => '{"summary":"S","tags":[],"connections":[],"key_insights":[]}') };

    await processNote(pool, provider, 'n1');

    const prompt = provider.chat.mock.calls[0][0];
    // The context should contain at most 200 chars of the other note's content
    expect(prompt).not.toContain('x'.repeat(300));
  });

  it('should handle other note with null content', async () => {
    const note = { id: 'n1', title: 'Main', content: 'Content', owner_id: 'default', source_url: '' };
    const otherNotes = [{ id: 'n2', title: 'Empty Note', content: null, ai_tags: '' }];

    const pool = {
      query: vi.fn(async (sql) => {
        if (sql.includes('SELECT * FROM notes WHERE id')) return { rows: [note] };
        if (sql.includes('SELECT id, title, content, ai_tags')) return { rows: otherNotes };
        return { rows: [] };
      })
    };
    const provider = { chat: vi.fn(async () => '{"summary":"S","tags":[],"connections":[],"key_insights":[]}') };

    await processNote(pool, provider, 'n1');
    // Should not throw
    expect(provider.chat).toHaveBeenCalledOnce();
  });
});

describe('processNote - Query Parameters', () => {
  it('should query for other notes with correct owner_id and exclude current note', async () => {
    const note = { id: 'note-abc', title: 'Test', content: 'C', owner_id: 'user-42', source_url: '' };
    const pool = {
      query: vi.fn(async (sql, params) => {
        if (sql.includes('SELECT * FROM notes WHERE id')) return { rows: [note] };
        if (sql.includes('SELECT id, title, content, ai_tags')) return { rows: [] };
        return { rows: [] };
      })
    };
    const provider = { chat: vi.fn(async () => '{"summary":"S","tags":[],"connections":[],"key_insights":[]}') };

    await processNote(pool, provider, 'note-abc');

    const otherNotesCall = pool.query.mock.calls.find(c => c[0].includes('SELECT id, title, content, ai_tags'));
    expect(otherNotesCall[1][0]).toBe('note-abc'); // excluded note id
    expect(otherNotesCall[1][1]).toBe('user-42'); // owner_id
  });

  it('should limit other notes query to 20 results', async () => {
    const note = { id: 'n1', title: 'Test', content: 'C', owner_id: 'default', source_url: '' };
    const pool = {
      query: vi.fn(async (sql) => {
        if (sql.includes('SELECT * FROM notes WHERE id')) return { rows: [note] };
        if (sql.includes('SELECT id, title, content, ai_tags')) return { rows: [] };
        return { rows: [] };
      })
    };
    const provider = { chat: vi.fn(async () => '{"summary":"S","tags":[],"connections":[],"key_insights":[]}') };

    await processNote(pool, provider, 'n1');

    const otherNotesCall = pool.query.mock.calls.find(c => c[0].includes('SELECT id, title, content, ai_tags'));
    expect(otherNotesCall[0]).toContain('LIMIT 20');
  });
});
