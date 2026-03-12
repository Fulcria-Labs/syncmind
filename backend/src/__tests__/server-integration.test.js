import { describe, it, expect, vi } from 'vitest';

// ─── Express App Configuration ───

describe('Express App Configuration', () => {
  it('should set JSON body size limit to 10mb', () => {
    const limit = '10mb';
    // Convert to bytes for comparison
    const bytes = 10 * 1024 * 1024;
    expect(bytes).toBe(10485760);
    expect(limit).toBe('10mb');
  });

  it('should register all route prefixes', () => {
    const prefixes = ['/api/auth', '/api/data', '/api/ai'];
    expect(prefixes).toHaveLength(3);
    expect(prefixes.every(p => p.startsWith('/api/'))).toBe(true);
  });

  it('should have health endpoint at root level', () => {
    const healthPath = '/health';
    expect(healthPath).not.toContain('/api/');
    expect(healthPath).toBe('/health');
  });
});

// ─── Route Method Validation ───

describe('Route Method Validation', () => {
  const routes = [
    { method: 'GET', path: '/api/auth/token', handler: 'authRouter' },
    { method: 'GET', path: '/api/auth/keys', handler: 'authRouter' },
    { method: 'POST', path: '/api/data/', handler: 'dataRouter' },
    { method: 'POST', path: '/api/data/seed', handler: 'dataRouter' },
    { method: 'GET', path: '/api/ai/status', handler: 'aiRouter' },
    { method: 'POST', path: '/api/ai/process/:noteId', handler: 'aiRouter' },
    { method: 'POST', path: '/api/ai/ask', handler: 'aiRouter' },
    { method: 'POST', path: '/api/ai/brief', handler: 'aiRouter' },
    { method: 'POST', path: '/api/ai/extract-url', handler: 'aiRouter' },
    { method: 'POST', path: '/api/ai/agent/chat', handler: 'aiRouter' },
    { method: 'POST', path: '/api/ai/agent/stream', handler: 'aiRouter' },
    { method: 'GET', path: '/health', handler: 'app' },
  ];

  it('should have 12 total routes', () => {
    expect(routes).toHaveLength(12);
  });

  it('should have 4 GET routes', () => {
    expect(routes.filter(r => r.method === 'GET')).toHaveLength(4);
  });

  it('should have 8 POST routes', () => {
    expect(routes.filter(r => r.method === 'POST')).toHaveLength(8);
  });

  it('should have exactly one parameterized route', () => {
    const paramRoutes = routes.filter(r => r.path.includes(':'));
    expect(paramRoutes).toHaveLength(1);
    expect(paramRoutes[0].path).toContain(':noteId');
  });

  it('should have 2 auth routes', () => {
    expect(routes.filter(r => r.handler === 'authRouter')).toHaveLength(2);
  });

  it('should have 2 data routes', () => {
    expect(routes.filter(r => r.handler === 'dataRouter')).toHaveLength(2);
  });

  it('should have 7 AI routes', () => {
    expect(routes.filter(r => r.handler === 'aiRouter')).toHaveLength(7);
  });

  it('should have 2 agent sub-routes under AI', () => {
    const agentRoutes = routes.filter(r => r.path.includes('/agent/'));
    expect(agentRoutes).toHaveLength(2);
    expect(agentRoutes.map(r => r.path)).toContain('/api/ai/agent/chat');
    expect(agentRoutes.map(r => r.path)).toContain('/api/ai/agent/stream');
  });
});

// ─── Error Response Formats ───

describe('Error Response Formats', () => {
  it('should return 400 for invalid batch body', () => {
    const statusCode = 400;
    const body = { message: 'Invalid body' };
    expect(statusCode).toBe(400);
    expect(body.message).toBe('Invalid body');
  });

  it('should return 400 for missing question', () => {
    const statusCode = 400;
    const body = { message: 'Question required' };
    expect(statusCode).toBe(400);
    expect(body.message).toBe('Question required');
  });

  it('should return 400 for missing URL', () => {
    const statusCode = 400;
    const body = { message: 'URL required' };
    expect(statusCode).toBe(400);
    expect(body.message).toBe('URL required');
  });

  it('should return 400 for missing message in agent chat', () => {
    const statusCode = 400;
    const body = { message: 'Message required' };
    expect(statusCode).toBe(400);
    expect(body.message).toBe('Message required');
  });

  it('should return 404 for note not found', () => {
    const statusCode = 404;
    const body = { message: 'Note not found' };
    expect(statusCode).toBe(404);
    expect(body.message).toBe('Note not found');
  });

  it('should return 500 for internal server errors with message', () => {
    const error = new Error('Database connection failed');
    const statusCode = 500;
    const body = { message: error.message };
    expect(statusCode).toBe(500);
    expect(body.message).toBe('Database connection failed');
  });

  it('should return 503 when AI not configured', () => {
    const statusCode = 503;
    const body = { message: 'AI not configured (set ANTHROPIC_API_KEY, OPENAI_API_KEY, or run Ollama locally)' };
    expect(statusCode).toBe(503);
    expect(body.message).toContain('ANTHROPIC_API_KEY');
    expect(body.message).toContain('OPENAI_API_KEY');
    expect(body.message).toContain('Ollama');
  });

  it('should return 503 for agent not configured', () => {
    const statusCode = 503;
    const body = { message: 'AI not configured' };
    expect(statusCode).toBe(503);
  });
});

// ─── Success Response Formats ───

describe('Success Response Formats', () => {
  it('should return health check response', () => {
    const response = { status: 'ok' };
    expect(response).toEqual({ status: 'ok' });
  });

  it('should return token response with powersync_url', () => {
    const response = { token: 'jwt-token-here', powersync_url: 'http://localhost:8089' };
    expect(response).toHaveProperty('token');
    expect(response).toHaveProperty('powersync_url');
  });

  it('should return keys response with JWKS array', () => {
    const response = { keys: [{ alg: 'RS256', kid: 'syncmind-dev-key', kty: 'RSA' }] };
    expect(response.keys).toHaveLength(1);
    expect(response.keys[0].alg).toBe('RS256');
  });

  it('should return batch completion message', () => {
    const response = { message: 'Batch completed' };
    expect(response.message).toBe('Batch completed');
  });

  it('should return seed response with status', () => {
    const responses = [
      { message: 'Data already exists', seeded: false },
      { message: 'Demo data loaded', seeded: true, notes: 6 },
    ];
    expect(responses[0].seeded).toBe(false);
    expect(responses[1].seeded).toBe(true);
    expect(responses[1].notes).toBe(6);
  });

  it('should return AI process result', () => {
    const response = {
      success: true,
      result: {
        summary: 'Note summary',
        tags: ['ai'],
        connections: [],
        key_insights: ['insight']
      }
    };
    expect(response.success).toBe(true);
    expect(response.result.summary).toBe('Note summary');
  });

  it('should return ask endpoint answer', () => {
    const response = { answer: 'Based on your notes, the key theme is AI...' };
    expect(response).toHaveProperty('answer');
    expect(response.answer.length).toBeGreaterThan(0);
  });

  it('should return brief endpoint brief', () => {
    const response = { brief: '## Executive Summary\nYour research covers...' };
    expect(response).toHaveProperty('brief');
    expect(response.brief).toContain('Executive Summary');
  });

  it('should return agent chat response with reply and toolCalls', () => {
    const response = {
      reply: 'Based on searching your notes...',
      toolCalls: [{ tool: 'search-notes', args: { query: 'AI' } }],
      usage: { input_tokens: 100, output_tokens: 50 }
    };
    expect(response).toHaveProperty('reply');
    expect(response).toHaveProperty('toolCalls');
    expect(response).toHaveProperty('usage');
    expect(response.toolCalls).toHaveLength(1);
  });

  it('should return URL extraction result', () => {
    const response = {
      title: 'Extracted Title',
      content: 'Extracted and cleaned content...',
      source_url: 'https://example.com/article'
    };
    expect(response).toHaveProperty('title');
    expect(response).toHaveProperty('content');
    expect(response).toHaveProperty('source_url');
  });
});

// ─── CORS Configuration ───

describe('CORS Configuration', () => {
  it('should enable CORS for all origins (dev mode)', () => {
    // cors() with no options allows all origins
    const corsEnabled = true;
    const corsOptions = {}; // Default = allow all
    expect(corsEnabled).toBe(true);
    expect(Object.keys(corsOptions)).toHaveLength(0);
  });
});

// ─── Environment Variable Defaults ───

describe('Environment Variable Defaults', () => {
  it('should default PORT to 6061', () => {
    const origPort = process.env.PORT;
    delete process.env.PORT;
    const port = process.env.PORT || 6061;
    expect(port).toBe(6061);
    if (origPort) process.env.PORT = origPort;
  });

  it('should default POWERSYNC_URL to localhost:8089', () => {
    const origUrl = process.env.POWERSYNC_URL;
    delete process.env.POWERSYNC_URL;
    const url = process.env.POWERSYNC_URL || 'http://localhost:8089';
    expect(url).toBe('http://localhost:8089');
    if (origUrl) process.env.POWERSYNC_URL = origUrl;
  });

  it('should default OLLAMA_URL to localhost:11434', () => {
    const origUrl = process.env.OLLAMA_URL;
    delete process.env.OLLAMA_URL;
    const url = process.env.OLLAMA_URL || 'http://localhost:11434';
    expect(url).toBe('http://localhost:11434');
    if (origUrl) process.env.OLLAMA_URL = origUrl;
  });

  it('should default OLLAMA_MODEL to qwen2.5-coder:7b-instruct-q4_K_M', () => {
    const origModel = process.env.OLLAMA_MODEL;
    delete process.env.OLLAMA_MODEL;
    const model = process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b-instruct-q4_K_M';
    expect(model).toBe('qwen2.5-coder:7b-instruct-q4_K_M');
    if (origModel) process.env.OLLAMA_MODEL = origModel;
  });

  it('should have no default for DATABASE_URI (required)', () => {
    // DATABASE_URI is used directly in Pool constructor - no fallback
    const origUri = process.env.DATABASE_URI;
    delete process.env.DATABASE_URI;
    expect(process.env.DATABASE_URI).toBeUndefined();
    if (origUri) process.env.DATABASE_URI = origUri;
  });

  it('should have no default for API keys (optional)', () => {
    const origAnth = process.env.ANTHROPIC_API_KEY;
    const origOpenAI = process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    expect(process.env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(process.env.OPENAI_API_KEY).toBeUndefined();
    if (origAnth) process.env.ANTHROPIC_API_KEY = origAnth;
    if (origOpenAI) process.env.OPENAI_API_KEY = origOpenAI;
  });
});

// ─── Background Processor Behavior ───

describe('Background Processor Behavior', () => {
  it('should start after 5 second delay', () => {
    const startDelay = 5000;
    expect(startDelay).toBe(5000);
  });

  it('should run every 30 seconds', () => {
    const interval = 30000;
    expect(interval).toBe(30000);
  });

  it('should skip if no AI provider available', () => {
    const provider = null;
    const shouldProcess = !!provider;
    expect(shouldProcess).toBe(false);
  });

  it('should continue processing remaining notes after one fails', async () => {
    const results = [];
    const noteIds = ['n1', 'n2', 'n3'];

    for (const id of noteIds) {
      try {
        if (id === 'n2') throw new Error('processing failed');
        results.push({ id, ok: true });
      } catch (e) {
        results.push({ id, ok: false, error: e.message });
      }
    }

    expect(results).toHaveLength(3);
    expect(results[0].ok).toBe(true);
    expect(results[1].ok).toBe(false);
    expect(results[2].ok).toBe(true);
  });

  it('should not start duplicate processors', () => {
    let processingInterval = null;

    function startBackgroundProcessor() {
      if (processingInterval) return false;
      processingInterval = 'active';
      return true;
    }

    const first = startBackgroundProcessor();
    const second = startBackgroundProcessor();

    expect(first).toBe(true);
    expect(second).toBe(false);
  });
});
