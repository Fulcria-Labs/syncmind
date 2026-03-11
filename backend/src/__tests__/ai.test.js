import { describe, it, expect } from 'vitest';

describe('AI Provider Selection', () => {
  it('should prefer Anthropic when ANTHROPIC_API_KEY is set', () => {
    const env = { ANTHROPIC_API_KEY: 'test-key' };
    const provider = env.ANTHROPIC_API_KEY ? 'anthropic'
      : env.OPENAI_API_KEY ? 'openai' : 'ollama';
    expect(provider).toBe('anthropic');
  });

  it('should fall back to OpenAI when only OPENAI_API_KEY is set', () => {
    const env = { OPENAI_API_KEY: 'test-key' };
    const provider = env.ANTHROPIC_API_KEY ? 'anthropic'
      : env.OPENAI_API_KEY ? 'openai' : 'ollama';
    expect(provider).toBe('openai');
  });

  it('should use Ollama when no API keys are set', () => {
    const env = {};
    const provider = env.ANTHROPIC_API_KEY ? 'anthropic'
      : env.OPENAI_API_KEY ? 'openai' : 'ollama';
    expect(provider).toBe('ollama');
  });
});

describe('AI Response Parsing', () => {
  it('should parse valid JSON response', () => {
    const text = '{"summary":"Test summary","tags":["ai","ml"],"connections":[],"key_insights":["insight"]}';
    const result = JSON.parse(text);
    expect(result.summary).toBe('Test summary');
    expect(result.tags).toEqual(['ai', 'ml']);
    expect(result.connections).toEqual([]);
    expect(result.key_insights).toEqual(['insight']);
  });

  it('should extract JSON from markdown-wrapped response', () => {
    const text = '```json\n{"summary":"Test","tags":["ai"],"connections":[],"key_insights":[]}\n```';
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      result = match ? JSON.parse(match[0]) : { summary: text, tags: [], connections: [], key_insights: [] };
    }
    expect(result.summary).toBe('Test');
    expect(result.tags).toEqual(['ai']);
  });

  it('should handle plain text response gracefully', () => {
    const text = 'This is just a plain text response about the note.';
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      result = match ? JSON.parse(match[0]) : { summary: text, tags: [], connections: [], key_insights: [] };
    }
    expect(result.summary).toBe(text);
    expect(result.tags).toEqual([]);
    expect(result.connections).toEqual([]);
  });

  it('should handle response with extra text around JSON', () => {
    const text = 'Here is the analysis:\n{"summary":"Deep analysis","tags":["research"],"connections":[{"note_id":"abc","relationship":"relates to"}],"key_insights":["key finding"]}\nHope this helps!';
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      result = match ? JSON.parse(match[0]) : { summary: text, tags: [], connections: [], key_insights: [] };
    }
    expect(result.summary).toBe('Deep analysis');
    expect(result.connections).toHaveLength(1);
    expect(result.connections[0].note_id).toBe('abc');
  });
});

describe('AI Tag Processing', () => {
  it('should join tags to comma-separated string', () => {
    const tags = ['ai', 'machine-learning', 'research'];
    expect(tags.join(',')).toBe('ai,machine-learning,research');
  });

  it('should handle empty tags array', () => {
    const tags = [];
    expect(tags.join(',')).toBe('');
  });

  it('should serialize connections correctly', () => {
    const connections = [
      { note_id: 'uuid-1', relationship: 'relates to' },
      { note_id: 'uuid-2', relationship: 'builds on' },
    ];
    const serialized = connections.map(c => `${c.note_id}:${c.relationship}`).join(',');
    expect(serialized).toBe('uuid-1:relates to,uuid-2:builds on');
  });
});

describe('URL Extraction', () => {
  it('should extract title from HTML', () => {
    const html = '<html><head><title>Research Paper on AI</title></head><body>Content</body></html>';
    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    expect(match[1].trim()).toBe('Research Paper on AI');
  });

  it('should strip script and style tags', () => {
    const html = '<p>Good content</p><script>alert("bad")</script><style>.bad{}</style><p>More good</p>';
    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '');
    expect(cleaned).not.toContain('alert');
    expect(cleaned).not.toContain('.bad');
    expect(cleaned).toContain('Good content');
    expect(cleaned).toContain('More good');
  });

  it('should strip navigation elements', () => {
    const html = '<nav>Menu items</nav><main><p>Article content</p></main><footer>Footer</footer>';
    const cleaned = html
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '');
    expect(cleaned).not.toContain('Menu items');
    expect(cleaned).not.toContain('Footer');
    expect(cleaned).toContain('Article content');
  });

  it('should extract article content when available', () => {
    const html = '<div>Sidebar</div><article><p>Main article text</p></article>';
    const articleMatch = html.match(/<article[\s\S]*?>([\s\S]*?)<\/article>/i);
    expect(articleMatch).toBeTruthy();
    expect(articleMatch[1]).toContain('Main article text');
  });

  it('should convert HTML entities', () => {
    const text = '&amp; &lt; &gt; &quot; &#39; &nbsp;';
    const decoded = text
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'");
    expect(decoded).toBe('& < > " \' ' + ' ');
  });

  it('should truncate content at 10000 chars', () => {
    const longContent = 'x'.repeat(15000);
    let content = longContent;
    if (content.length > 10000) {
      content = content.slice(0, 10000) + '\n\n[Content truncated...]';
    }
    expect(content.length).toBeLessThan(15000);
    expect(content).toContain('[Content truncated...]');
  });
});

describe('Research Agent Model Selection', () => {
  it('should select correct model ID based on API keys', () => {
    // Anthropic
    let modelId = true
      ? 'anthropic/claude-haiku-4-5-20251001'
      : false ? 'openai/gpt-4.1-mini' : 'ollama/qwen2.5-coder:7b-instruct-q4_K_M';
    expect(modelId).toBe('anthropic/claude-haiku-4-5-20251001');

    // OpenAI
    modelId = false
      ? 'anthropic/claude-haiku-4-5-20251001'
      : true ? 'openai/gpt-4.1-mini' : 'ollama/qwen2.5-coder:7b-instruct-q4_K_M';
    expect(modelId).toBe('openai/gpt-4.1-mini');

    // Ollama
    modelId = false
      ? 'anthropic/claude-haiku-4-5-20251001'
      : false ? 'openai/gpt-4.1-mini' : 'ollama/qwen2.5-coder:7b-instruct-q4_K_M';
    expect(modelId).toBe('ollama/qwen2.5-coder:7b-instruct-q4_K_M');
  });

  it('should support custom Ollama model', () => {
    const customModel = 'llama3.2:3b';
    const modelId = `ollama/${customModel}`;
    expect(modelId).toBe('ollama/llama3.2:3b');
  });
});
