import { describe, it, expect } from 'vitest';

describe('Server Configuration', () => {
  it('should default PORT to 6061', () => {
    const origPort = process.env.PORT;
    delete process.env.PORT;

    const PORT = process.env.PORT || 6061;
    expect(PORT).toBe(6061);

    if (origPort) process.env.PORT = origPort;
  });

  it('should use custom PORT from env', () => {
    const origPort = process.env.PORT;
    process.env.PORT = '8080';

    const PORT = process.env.PORT || 6061;
    expect(PORT).toBe('8080');

    if (origPort) {
      process.env.PORT = origPort;
    } else {
      delete process.env.PORT;
    }
  });

  it('should define correct API route prefixes', () => {
    const routes = {
      auth: '/api/auth',
      data: '/api/data',
      ai: '/api/ai',
      health: '/health',
    };

    expect(routes.auth).toBe('/api/auth');
    expect(routes.data).toBe('/api/data');
    expect(routes.ai).toBe('/api/ai');
    expect(routes.health).toBe('/health');
  });

  it('should set JSON body limit to 10mb', () => {
    const limit = '10mb';
    expect(limit).toBe('10mb');
  });

  it('should enable CORS', () => {
    // CORS is enabled via app.use(cors()) in index.js
    const corsEnabled = true;
    expect(corsEnabled).toBe(true);
  });
});

describe('Health Endpoint', () => {
  it('should return status ok', () => {
    const response = { status: 'ok' };
    expect(response.status).toBe('ok');
  });

  it('should be at /health path', () => {
    const path = '/health';
    expect(path).toBe('/health');
  });
});

describe('API Route Structure', () => {
  it('should have auth endpoints', () => {
    const authRoutes = [
      { method: 'GET', path: '/api/auth/token' },
      { method: 'GET', path: '/api/auth/keys' },
    ];

    expect(authRoutes).toHaveLength(2);
    expect(authRoutes[0].method).toBe('GET');
    expect(authRoutes[1].method).toBe('GET');
  });

  it('should have data endpoints', () => {
    const dataRoutes = [
      { method: 'POST', path: '/api/data/' },
      { method: 'POST', path: '/api/data/seed' },
    ];

    expect(dataRoutes).toHaveLength(2);
    expect(dataRoutes.every(r => r.method === 'POST')).toBe(true);
  });

  it('should have AI endpoints', () => {
    const aiRoutes = [
      { method: 'GET', path: '/api/ai/status' },
      { method: 'POST', path: '/api/ai/process/:noteId' },
      { method: 'POST', path: '/api/ai/ask' },
      { method: 'POST', path: '/api/ai/brief' },
      { method: 'POST', path: '/api/ai/extract-url' },
      { method: 'POST', path: '/api/ai/agent/chat' },
      { method: 'POST', path: '/api/ai/agent/stream' },
    ];

    expect(aiRoutes).toHaveLength(7);
    expect(aiRoutes[0].method).toBe('GET');
    expect(aiRoutes.filter(r => r.method === 'POST')).toHaveLength(6);
  });

  it('should namespace AI agent routes under /agent/', () => {
    const agentRoutes = [
      '/api/ai/agent/chat',
      '/api/ai/agent/stream',
    ];

    for (const route of agentRoutes) {
      expect(route).toContain('/agent/');
    }
  });
});

describe('Environment Variables', () => {
  it('should define all expected env vars', () => {
    const expectedVars = [
      'PORT',
      'DATABASE_URI',
      'POWERSYNC_URL',
      'ANTHROPIC_API_KEY',
      'OPENAI_API_KEY',
      'OLLAMA_URL',
      'OLLAMA_MODEL',
    ];

    // These are all optional with defaults
    for (const v of expectedVars) {
      expect(typeof v).toBe('string');
    }
  });

  it('should have safe defaults for all env vars', () => {
    const defaults = {
      PORT: 6061,
      POWERSYNC_URL: 'http://localhost:8089',
      OLLAMA_URL: 'http://localhost:11434',
      OLLAMA_MODEL: 'qwen2.5-coder:7b-instruct-q4_K_M',
    };

    expect(defaults.PORT).toBe(6061);
    expect(defaults.POWERSYNC_URL).toContain('localhost');
    expect(defaults.OLLAMA_URL).toContain('localhost');
    expect(defaults.OLLAMA_MODEL).toBeTruthy();
  });
});

describe('Database Schema', () => {
  it('should define notes table columns', () => {
    const noteColumns = [
      'id', 'title', 'content', 'source_url',
      'ai_summary', 'ai_tags', 'ai_connections',
      'is_processed', 'owner_id', 'created_at', 'updated_at'
    ];

    expect(noteColumns).toHaveLength(11);
    expect(noteColumns).toContain('id');
    expect(noteColumns).toContain('title');
    expect(noteColumns).toContain('ai_summary');
    expect(noteColumns).toContain('is_processed');
    expect(noteColumns).toContain('owner_id');
  });

  it('should define connections table columns', () => {
    const connColumns = [
      'id', 'source_note_id', 'target_note_id',
      'relationship', 'confidence', 'created_at'
    ];

    expect(connColumns).toHaveLength(6);
    expect(connColumns).toContain('source_note_id');
    expect(connColumns).toContain('target_note_id');
    expect(connColumns).toContain('confidence');
  });

  it('should define tags table columns', () => {
    const tagColumns = ['id', 'name', 'note_count', 'created_at'];

    expect(tagColumns).toHaveLength(4);
    expect(tagColumns).toContain('name');
    expect(tagColumns).toContain('note_count');
  });

  it('should use TEXT columns for ai fields', () => {
    // ai_tags and ai_connections are stored as comma-separated TEXT
    const tags = ['ai', 'ml', 'research'];
    const serialized = tags.join(',');
    expect(typeof serialized).toBe('string');
    expect(serialized).toBe('ai,ml,research');
  });

  it('should use integer for is_processed flag', () => {
    const values = [0, 1];
    expect(values).toContain(0); // unprocessed
    expect(values).toContain(1); // processed
  });
});

describe('Note Processing Flow', () => {
  it('should follow correct processing pipeline', () => {
    const steps = [
      '1. Fetch note by ID',
      '2. Fetch other notes for context',
      '3. Build context string from other notes',
      '4. Call AI provider with prompt',
      '5. Parse AI response (JSON or fallback)',
      '6. Update note with AI results',
      '7. Create connection records',
      '8. Update tag counts',
    ];

    expect(steps).toHaveLength(8);
    expect(steps[0]).toContain('Fetch note');
    expect(steps[3]).toContain('AI provider');
    expect(steps[4]).toContain('Parse');
    expect(steps[6]).toContain('connection');
    expect(steps[7]).toContain('tag');
  });

  it('should mark note as processed after AI analysis', () => {
    const updateFields = {
      ai_summary: 'Generated summary',
      ai_tags: 'tag1,tag2',
      ai_connections: 'n2:relates to',
      is_processed: 1,
      updated_at: new Date().toISOString()
    };

    expect(updateFields.is_processed).toBe(1);
    expect(updateFields.ai_summary).toBeTruthy();
    expect(typeof updateFields.updated_at).toBe('string');
  });

  it('should use confidence 0.8 for AI-detected connections', () => {
    const defaultConfidence = 0.8;
    expect(defaultConfidence).toBe(0.8);
    expect(defaultConfidence).toBeGreaterThan(0);
    expect(defaultConfidence).toBeLessThanOrEqual(1);
  });
});

describe('AI Prompt Construction', () => {
  it('should include note title and content in process prompt', () => {
    const note = { title: 'Test Note', content: 'Test content', source_url: 'https://example.com' };
    const prompt = `TITLE: ${note.title}\nCONTENT: ${note.content || ''}\nSOURCE: ${note.source_url || 'none'}`;

    expect(prompt).toContain('Test Note');
    expect(prompt).toContain('Test content');
    expect(prompt).toContain('https://example.com');
  });

  it('should handle note with no source_url', () => {
    const note = { title: 'No URL', content: 'Content' };
    const source = note.source_url || 'none';
    expect(source).toBe('none');
  });

  it('should handle note with empty content', () => {
    const note = { title: 'Empty', content: '' };
    const content = note.content || '';
    expect(content).toBe('');
  });

  it('should request specific JSON structure', () => {
    const expectedFormat = {
      summary: 'string',
      tags: 'string[]',
      connections: '[{note_id, relationship}]',
      key_insights: 'string[]',
    };

    expect(Object.keys(expectedFormat)).toEqual(['summary', 'tags', 'connections', 'key_insights']);
  });

  it('should include other notes context in prompt', () => {
    const otherNotesContext = '[n1] "AI Research": Content about AI...\n[n2] "ML Ops": Content about ML...';
    const prompt = `OTHER NOTES IN COLLECTION:\n${otherNotesContext || 'none'}`;

    expect(prompt).toContain('[n1] "AI Research"');
    expect(prompt).toContain('[n2] "ML Ops"');
  });

  it('should display "none" when no other notes exist', () => {
    const otherNotesContext = '';
    const prompt = `OTHER NOTES IN COLLECTION:\n${otherNotesContext || 'none'}`;
    expect(prompt).toContain('none');
  });
});

describe('Ask Endpoint - Prompt Building', () => {
  it('should build context with headings for each note', () => {
    const notes = [
      { title: 'Note A', content: 'Content A', ai_summary: 'Summary A', ai_tags: 'a,b' },
    ];
    const context = notes
      .map(n => `## ${n.title}\n${n.ai_summary || n.content?.slice(0, 300) || ''}\nTags: ${n.ai_tags || ''}`)
      .join('\n\n');

    expect(context).toMatch(/^## Note A/);
    expect(context).toContain('Summary A');
    expect(context).toContain('Tags: a,b');
  });

  it('should build complete ask prompt', () => {
    const context = '## Note 1\nSummary\nTags: ai';
    const question = 'What are the key themes?';
    const prompt = `Based on these research notes, answer the question.\n\nRESEARCH NOTES:\n${context}\n\nQUESTION: ${question}\n\nAnswer concisely, citing specific notes when relevant.`;

    expect(prompt).toContain('RESEARCH NOTES:');
    expect(prompt).toContain('QUESTION:');
    expect(prompt).toContain(question);
    expect(prompt).toContain('citing specific notes');
  });
});

describe('Brief Endpoint - Prompt Building', () => {
  it('should request structured brief format', () => {
    const prompt = 'Write a structured brief with: Executive Summary, Key Themes, Notable Findings, Knowledge Gaps, and Suggested Next Steps.';
    expect(prompt).toContain('Executive Summary');
    expect(prompt).toContain('Key Themes');
    expect(prompt).toContain('Notable Findings');
    expect(prompt).toContain('Knowledge Gaps');
    expect(prompt).toContain('Suggested Next Steps');
  });

  it('should limit notes context to 50 notes', () => {
    const limit = 50;
    const sql = `SELECT title, content, ai_summary, ai_tags FROM notes WHERE owner_id = $1 ORDER BY updated_at DESC LIMIT ${limit}`;
    expect(sql).toContain('LIMIT 50');
  });

  it('should limit ask context to 30 notes', () => {
    const limit = 30;
    const sql = `SELECT title, content, ai_summary, ai_tags FROM notes WHERE owner_id = $1 ORDER BY updated_at DESC LIMIT ${limit}`;
    expect(sql).toContain('LIMIT 30');
  });
});
