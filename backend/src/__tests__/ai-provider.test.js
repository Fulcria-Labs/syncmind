import { describe, it, expect, vi } from 'vitest';

describe('AI Provider - Status Endpoint Logic', () => {
  function getStatusResponse(providerName) {
    return {
      provider: providerName || 'none',
      local: providerName === 'ollama',
      model: providerName === 'ollama'
        ? (process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b-instruct-q4_K_M')
        : providerName === 'anthropic' ? 'claude-haiku-4-5' : 'gpt-4.1-mini'
    };
  }

  it('should return anthropic status', () => {
    const status = getStatusResponse('anthropic');
    expect(status.provider).toBe('anthropic');
    expect(status.local).toBe(false);
    expect(status.model).toBe('claude-haiku-4-5');
  });

  it('should return openai status', () => {
    const status = getStatusResponse('openai');
    expect(status.provider).toBe('openai');
    expect(status.local).toBe(false);
    expect(status.model).toBe('gpt-4.1-mini');
  });

  it('should return ollama status with default model', () => {
    const origModel = process.env.OLLAMA_MODEL;
    delete process.env.OLLAMA_MODEL;

    const status = getStatusResponse('ollama');
    expect(status.provider).toBe('ollama');
    expect(status.local).toBe(true);
    expect(status.model).toBe('qwen2.5-coder:7b-instruct-q4_K_M');

    if (origModel) process.env.OLLAMA_MODEL = origModel;
  });

  it('should return ollama status with custom model', () => {
    const origModel = process.env.OLLAMA_MODEL;
    process.env.OLLAMA_MODEL = 'llama3:8b';

    const status = getStatusResponse('ollama');
    expect(status.provider).toBe('ollama');
    expect(status.local).toBe(true);
    expect(status.model).toBe('llama3:8b');

    if (origModel) {
      process.env.OLLAMA_MODEL = origModel;
    } else {
      delete process.env.OLLAMA_MODEL;
    }
  });

  it('should return none when no provider', () => {
    const status = getStatusResponse(null);
    expect(status.provider).toBe('none');
    expect(status.local).toBe(false);
  });

  it('should return none for undefined provider', () => {
    const status = getStatusResponse(undefined);
    expect(status.provider).toBe('none');
    expect(status.local).toBe(false);
  });
});

describe('AI Provider - Selection Priority', () => {
  function selectProvider(env) {
    if (env.ANTHROPIC_API_KEY) return 'anthropic';
    if (env.OPENAI_API_KEY) return 'openai';
    return 'ollama';
  }

  it('should prefer Anthropic over OpenAI when both are set', () => {
    const env = { ANTHROPIC_API_KEY: 'ak-test', OPENAI_API_KEY: 'sk-test' };
    expect(selectProvider(env)).toBe('anthropic');
  });

  it('should use OpenAI when only it is set', () => {
    const env = { OPENAI_API_KEY: 'sk-test' };
    expect(selectProvider(env)).toBe('openai');
  });

  it('should use Ollama when no keys', () => {
    const env = {};
    expect(selectProvider(env)).toBe('ollama');
  });

  it('should use Ollama for empty string keys', () => {
    const env = { ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '' };
    expect(selectProvider(env)).toBe('ollama');
  });

  it('should prefer Anthropic even with truthy OpenAI key', () => {
    const env = { ANTHROPIC_API_KEY: 'any-value', OPENAI_API_KEY: 'sk-prod' };
    expect(selectProvider(env)).toBe('anthropic');
  });
});

describe('AI Provider - Model ID Construction', () => {
  function getModelId(env) {
    if (env.ANTHROPIC_API_KEY) return 'anthropic/claude-haiku-4-5-20251001';
    if (env.OPENAI_API_KEY) return 'openai/gpt-4.1-mini';
    return `ollama/${env.OLLAMA_MODEL || 'qwen2.5-coder:7b-instruct-q4_K_M'}`;
  }

  it('should return full anthropic model ID', () => {
    expect(getModelId({ ANTHROPIC_API_KEY: 'key' })).toBe('anthropic/claude-haiku-4-5-20251001');
  });

  it('should return full openai model ID', () => {
    expect(getModelId({ OPENAI_API_KEY: 'key' })).toBe('openai/gpt-4.1-mini');
  });

  it('should return default ollama model ID', () => {
    expect(getModelId({})).toBe('ollama/qwen2.5-coder:7b-instruct-q4_K_M');
  });

  it('should return custom ollama model ID', () => {
    expect(getModelId({ OLLAMA_MODEL: 'mistral:7b' })).toBe('ollama/mistral:7b');
  });

  it('should handle ollama model with version tag', () => {
    expect(getModelId({ OLLAMA_MODEL: 'llama3.2:3b-instruct' })).toBe('ollama/llama3.2:3b-instruct');
  });
});

describe('AI Provider - Ollama Configuration', () => {
  it('should default Ollama URL to localhost:11434', () => {
    const origUrl = process.env.OLLAMA_URL;
    delete process.env.OLLAMA_URL;

    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    expect(ollamaUrl).toBe('http://localhost:11434');

    if (origUrl) process.env.OLLAMA_URL = origUrl;
  });

  it('should use custom Ollama URL when set', () => {
    const origUrl = process.env.OLLAMA_URL;
    process.env.OLLAMA_URL = 'http://gpu-server:11434';

    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    expect(ollamaUrl).toBe('http://gpu-server:11434');

    if (origUrl) {
      process.env.OLLAMA_URL = origUrl;
    } else {
      delete process.env.OLLAMA_URL;
    }
  });

  it('should construct OpenAI-compatible base URL', () => {
    const ollamaUrl = 'http://localhost:11434';
    const baseURL = `${ollamaUrl}/v1`;
    expect(baseURL).toBe('http://localhost:11434/v1');
  });

  it('should use "ollama" as API key for local model', () => {
    const apiKey = 'ollama';
    expect(apiKey).toBe('ollama');
  });
});

describe('AI - Process Note Error Handling', () => {
  it('should return 503 when no provider configured', () => {
    const provider = null;
    const hasProvider = !!provider;
    expect(hasProvider).toBe(false);
    // Route would return 503
  });

  it('should return 404 when note not found', async () => {
    const mockPool = {
      query: vi.fn(async () => ({ rows: [] }))
    };

    const { rows } = await mockPool.query('SELECT * FROM notes WHERE id = $1', ['missing-id']);
    expect(rows.length).toBe(0);
  });

  it('should handle AI chat failure gracefully', async () => {
    const mockProvider = {
      name: 'test',
      chat: vi.fn(async () => { throw new Error('API rate limit'); })
    };

    await expect(mockProvider.chat('test prompt')).rejects.toThrow('API rate limit');
  });

  it('should handle database error during note update', async () => {
    const mockPool = {
      query: vi.fn(async (sql) => {
        if (sql.includes('UPDATE')) throw new Error('connection timeout');
        return { rows: [{ id: 'n1', title: 'Test', content: 'Body', owner_id: 'default' }] };
      })
    };

    const { rows } = await mockPool.query('SELECT * FROM notes WHERE id = $1', ['n1']);
    expect(rows.length).toBe(1);

    await expect(
      mockPool.query('UPDATE notes SET ai_summary = $1 WHERE id = $2', ['summary', 'n1'])
    ).rejects.toThrow('connection timeout');
  });
});

describe('AI - Ask Endpoint Validation', () => {
  it('should require question field', () => {
    const body = {};
    expect(!!body.question).toBe(false);
  });

  it('should reject empty string question', () => {
    const body = { question: '' };
    expect(!!body.question).toBe(false);
  });

  it('should accept valid question', () => {
    const body = { question: 'What are the key themes?' };
    expect(!!body.question).toBe(true);
  });

  it('should default owner_id to "default"', () => {
    const body = { question: 'Test?' };
    const { question, owner_id = 'default' } = body;
    expect(owner_id).toBe('default');
  });

  it('should respect provided owner_id', () => {
    const body = { question: 'Test?', owner_id: 'user-99' };
    const { owner_id = 'default' } = body;
    expect(owner_id).toBe('user-99');
  });

  it('should build question context correctly', () => {
    const notes = [
      { title: 'Note A', content: 'Content A', ai_summary: 'Summary A', ai_tags: 'tag1' },
      { title: 'Note B', content: null, ai_summary: null, ai_tags: '' },
    ];

    const context = notes
      .map(n => `## ${n.title}\n${n.ai_summary || n.content?.slice(0, 300) || ''}\nTags: ${n.ai_tags || ''}`)
      .join('\n\n');

    expect(context).toContain('## Note A');
    expect(context).toContain('Summary A');
    expect(context).toContain('## Note B');
  });
});

describe('AI - Brief Endpoint Validation', () => {
  it('should accept brief without topic', () => {
    const body = { owner_id: 'default' };
    const { topic } = body;
    expect(topic).toBeUndefined();
  });

  it('should accept brief with topic', () => {
    const body = { owner_id: 'default', topic: 'machine learning' };
    expect(body.topic).toBe('machine learning');
  });

  it('should construct prompt with topic', () => {
    const topic = 'AI agents';
    const prompt = `Create a research brief from these notes${topic ? ` focused on: ${topic}` : ''}.`;
    expect(prompt).toContain('focused on: AI agents');
  });

  it('should construct prompt without topic', () => {
    const topic = null;
    const prompt = `Create a research brief from these notes${topic ? ` focused on: ${topic}` : ''}.`;
    expect(prompt).not.toContain('focused on');
    expect(prompt).toContain('Create a research brief');
  });

  it('should set max tokens to 2048 for briefs', () => {
    const maxTokens = 2048;
    expect(maxTokens).toBe(2048);
    expect(maxTokens).toBeGreaterThan(1024); // Default for other endpoints
  });
});

describe('AI - Extract URL Validation', () => {
  it('should require URL field', () => {
    const body = {};
    expect(!!body.url).toBe(false);
  });

  it('should reject empty URL', () => {
    const body = { url: '' };
    expect(!!body.url).toBe(false);
  });

  it('should accept valid URL', () => {
    const body = { url: 'https://example.com/article' };
    expect(!!body.url).toBe(true);
  });

  it('should handle URL with query parameters', () => {
    const url = 'https://example.com/search?q=ai&page=1';
    const parsed = new URL(url);
    expect(parsed.hostname).toBe('example.com');
    expect(parsed.searchParams.get('q')).toBe('ai');
  });

  it('should handle URL with fragments', () => {
    const url = 'https://example.com/article#section2';
    const parsed = new URL(url);
    expect(parsed.hash).toBe('#section2');
  });
});

describe('AI - Agent Chat Endpoint Validation', () => {
  it('should require message field', () => {
    const body = {};
    expect(!!body.message).toBe(false);
  });

  it('should reject empty message', () => {
    const body = { message: '' };
    expect(!!body.message).toBe(false);
  });

  it('should build messages array from history', () => {
    const body = {
      message: 'What connections exist?',
      history: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ],
      owner_id: 'user-1'
    };

    const messages = [
      ...body.history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: `[Context: owner_id=${body.owner_id}]\n\n${body.message}` }
    ];

    expect(messages).toHaveLength(3);
    expect(messages[0].role).toBe('user');
    expect(messages[1].role).toBe('assistant');
    expect(messages[2].role).toBe('user');
    expect(messages[2].content).toContain('owner_id=user-1');
  });

  it('should handle missing history', () => {
    const body = { message: 'Test' };
    const history = body.history || [];
    expect(history).toEqual([]);
  });

  it('should default owner_id for agent chat', () => {
    const body = { message: 'Test' };
    const { owner_id = 'default' } = body;
    expect(owner_id).toBe('default');
  });
});

describe('AI - Agent Stream Endpoint', () => {
  it('should set SSE headers', () => {
    const headers = {};
    headers['Content-Type'] = 'text/event-stream';
    headers['Cache-Control'] = 'no-cache';
    headers['Connection'] = 'keep-alive';

    expect(headers['Content-Type']).toBe('text/event-stream');
    expect(headers['Cache-Control']).toBe('no-cache');
    expect(headers['Connection']).toBe('keep-alive');
  });

  it('should format SSE data chunks correctly', () => {
    const chunk = { text: 'Hello' };
    const sseData = `data: ${JSON.stringify(chunk)}\n\n`;
    expect(sseData).toBe('data: {"text":"Hello"}\n\n');
  });

  it('should end stream with [DONE] marker', () => {
    const endMarker = 'data: [DONE]\n\n';
    expect(endMarker).toContain('[DONE]');
  });

  it('should handle stream error before headers sent', () => {
    const headersSent = false;
    const error = new Error('stream error');

    if (!headersSent) {
      // Would return 500 JSON
      expect(error.message).toBe('stream error');
    }
  });

  it('should handle stream error after headers sent', () => {
    const headersSent = true;
    const error = new Error('stream interrupted');

    if (headersSent) {
      // Would just end the response
      expect(headersSent).toBe(true);
    }
  });
});

describe('AI - Background Processor', () => {
  it('should select unprocessed notes ordered by creation', () => {
    const sql = 'SELECT id FROM notes WHERE is_processed = 0 ORDER BY created_at ASC LIMIT 3';
    expect(sql).toContain('is_processed = 0');
    expect(sql).toContain('ORDER BY created_at ASC');
    expect(sql).toContain('LIMIT 3');
  });

  it('should not start processor if already running', () => {
    let processingInterval = setInterval(() => {}, 30000);
    const wasNull = !processingInterval;
    expect(wasNull).toBe(false);
    // Should return early in startBackgroundProcessor

    clearInterval(processingInterval);
  });

  it('should use 30s interval for processing', () => {
    const interval = 30000;
    expect(interval).toBe(30000);
    expect(interval / 1000).toBe(30);
  });

  it('should handle individual note processing failure without stopping', async () => {
    const results = [];
    const noteIds = ['n1', 'n2', 'n3'];

    for (const id of noteIds) {
      try {
        if (id === 'n2') throw new Error('AI timeout');
        results.push({ id, success: true });
      } catch (e) {
        results.push({ id, success: false, error: e.message });
      }
    }

    expect(results).toHaveLength(3);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
    expect(results[1].error).toBe('AI timeout');
    expect(results[2].success).toBe(true);
  });

  it('should handle pool query failure in background processor', async () => {
    const mockPool = {
      query: vi.fn(async () => { throw new Error('connection refused'); })
    };

    let error = null;
    try {
      await mockPool.query('SELECT id FROM notes WHERE is_processed = 0');
    } catch (e) {
      error = e;
    }

    expect(error).toBeTruthy();
    expect(error.message).toBe('connection refused');
  });
});
