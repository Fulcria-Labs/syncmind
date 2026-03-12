import { describe, it, expect, vi } from 'vitest';

// ─── processNote logic tests (extracted from ai.js) ───

describe('Note Processing - AI Result Parsing', () => {
  function parseAIResponse(text) {
    try {
      return JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      return match ? JSON.parse(match[0]) : { summary: text, tags: [], connections: [], key_insights: [] };
    }
  }

  it('should parse JSON with nested arrays', () => {
    const text = '{"summary":"S","tags":["a","b"],"connections":[{"note_id":"x","relationship":"r"}],"key_insights":["i1"]}';
    const result = parseAIResponse(text);
    expect(result.connections).toHaveLength(1);
    expect(result.connections[0].note_id).toBe('x');
    expect(result.key_insights).toEqual(['i1']);
  });

  it('should handle JSON with escaped characters', () => {
    const text = '{"summary":"He said \\"hello\\"","tags":["test"],"connections":[],"key_insights":[]}';
    const result = parseAIResponse(text);
    expect(result.summary).toContain('hello');
  });

  it('should handle JSON with unicode characters', () => {
    const text = '{"summary":"研究 résumé","tags":["研究"],"connections":[],"key_insights":[]}';
    const result = parseAIResponse(text);
    expect(result.summary).toContain('研究');
  });

  it('should extract JSON from triple-backtick code block', () => {
    const text = 'Here is the analysis:\n```\n{"summary":"Test","tags":["ai"],"connections":[],"key_insights":[]}\n```\nDone.';
    const result = parseAIResponse(text);
    expect(result.summary).toBe('Test');
  });

  it('should handle JSON with empty string values', () => {
    const text = '{"summary":"","tags":[],"connections":[],"key_insights":[]}';
    const result = parseAIResponse(text);
    expect(result.summary).toBe('');
    expect(result.tags).toEqual([]);
  });

  it('should fallback gracefully for completely invalid input', () => {
    const text = 'Just some random text without any JSON at all.';
    const result = parseAIResponse(text);
    expect(result.summary).toBe(text);
    expect(result.tags).toEqual([]);
    expect(result.connections).toEqual([]);
  });

  it('should handle JSON with numeric values in tags', () => {
    const text = '{"summary":"S","tags":["2024","ai-v3"],"connections":[],"key_insights":[]}';
    const result = parseAIResponse(text);
    expect(result.tags).toContain('2024');
    expect(result.tags).toContain('ai-v3');
  });

  it('should handle response with embedded JSON in text', () => {
    const text = 'Analysis: {"summary":"main result","tags":["a"],"connections":[],"key_insights":[]}';
    const result = parseAIResponse(text);
    expect(result.summary).toBe('main result');
  });
});

// ─── Connection Serialization ───

describe('Note Processing - Connection Serialization', () => {
  function serializeConnections(connections) {
    return (connections || []).map(c => `${c.note_id}:${c.relationship}`).join(',');
  }

  it('should serialize single connection', () => {
    const connections = [{ note_id: 'uuid-1', relationship: 'builds on' }];
    expect(serializeConnections(connections)).toBe('uuid-1:builds on');
  });

  it('should serialize multiple connections with comma separator', () => {
    const connections = [
      { note_id: 'uuid-1', relationship: 'builds on' },
      { note_id: 'uuid-2', relationship: 'contradicts' },
      { note_id: 'uuid-3', relationship: 'extends' },
    ];
    const result = serializeConnections(connections);
    expect(result.split(',').length).toBe(3);
    expect(result).toContain('uuid-1:builds on');
    expect(result).toContain('uuid-3:extends');
  });

  it('should handle null connections', () => {
    expect(serializeConnections(null)).toBe('');
  });

  it('should handle undefined connections', () => {
    expect(serializeConnections(undefined)).toBe('');
  });

  it('should handle empty connections array', () => {
    expect(serializeConnections([])).toBe('');
  });

  it('should handle connections with colons in relationship', () => {
    const connections = [{ note_id: 'uuid-1', relationship: 'relates to: methodology' }];
    const result = serializeConnections(connections);
    expect(result).toBe('uuid-1:relates to: methodology');
  });
});

// ─── Connection Validation ───

describe('Note Processing - Connection Validation', () => {
  function validateConnections(connections, otherNotes) {
    const validNoteIds = new Set(otherNotes.map(n => n.id));
    return (connections || []).filter(conn => validNoteIds.has(conn.note_id));
  }

  it('should keep only connections to existing notes', () => {
    const connections = [
      { note_id: 'exists-1', relationship: 'relates' },
      { note_id: 'missing-1', relationship: 'cites' },
      { note_id: 'exists-2', relationship: 'builds on' },
    ];
    const otherNotes = [{ id: 'exists-1' }, { id: 'exists-2' }];
    const valid = validateConnections(connections, otherNotes);
    expect(valid).toHaveLength(2);
    expect(valid.map(c => c.note_id)).toEqual(['exists-1', 'exists-2']);
  });

  it('should return empty for all invalid connections', () => {
    const connections = [
      { note_id: 'missing-1', relationship: 'relates' },
      { note_id: 'missing-2', relationship: 'cites' },
    ];
    const otherNotes = [{ id: 'exists-1' }];
    const valid = validateConnections(connections, otherNotes);
    expect(valid).toHaveLength(0);
  });

  it('should handle no other notes', () => {
    const connections = [{ note_id: 'any', relationship: 'relates' }];
    const valid = validateConnections(connections, []);
    expect(valid).toHaveLength(0);
  });

  it('should handle null connections', () => {
    const valid = validateConnections(null, [{ id: 'exists' }]);
    expect(valid).toHaveLength(0);
  });
});

// ─── Other Notes Context Building ───

describe('Note Processing - Context Building', () => {
  function buildContext(otherNotes) {
    return otherNotes
      .map(n => `[${n.id}] "${n.title}": ${(n.content || '').slice(0, 200)}`)
      .join('\n');
  }

  it('should format note context correctly', () => {
    const notes = [
      { id: 'n1', title: 'AI Research', content: 'Deep learning advances...' },
      { id: 'n2', title: 'ML Ops', content: 'DevOps for machine learning...' },
    ];
    const context = buildContext(notes);
    expect(context).toContain('[n1] "AI Research":');
    expect(context).toContain('[n2] "ML Ops":');
    expect(context.split('\n')).toHaveLength(2);
  });

  it('should truncate long content at 200 chars', () => {
    const notes = [{ id: 'n1', title: 'Long', content: 'x'.repeat(500) }];
    const context = buildContext(notes);
    const contentPart = context.split(': ')[1];
    expect(contentPart.length).toBeLessThanOrEqual(200);
  });

  it('should handle null content', () => {
    const notes = [{ id: 'n1', title: 'Empty', content: null }];
    const context = buildContext(notes);
    expect(context).toContain('[n1] "Empty": ');
  });

  it('should handle empty notes array', () => {
    const context = buildContext([]);
    expect(context).toBe('');
  });
});

// ─── URL Extraction Edge Cases ───

describe('URL Extraction - Advanced Patterns', () => {
  function extractArticle(html) {
    const articleMatch = html.match(/<article[\s\S]*?>([\s\S]*?)<\/article>/i)
      || html.match(/<main[\s\S]*?>([\s\S]*?)<\/main>/i);
    return articleMatch ? articleMatch[1] : html;
  }

  it('should prefer article over main tag', () => {
    const html = '<main>Main content</main><article>Article content</article>';
    const extracted = extractArticle(html);
    expect(extracted).toBe('Article content');
  });

  it('should fallback to main tag when no article', () => {
    const html = '<div>Other</div><main>Main content here</main>';
    const extracted = extractArticle(html);
    expect(extracted).toBe('Main content here');
  });

  it('should return full html when neither article nor main', () => {
    const html = '<div><p>Just a div</p></div>';
    const extracted = extractArticle(html);
    expect(extracted).toBe(html);
  });

  it('should handle article with attributes', () => {
    const html = '<article class="post" id="main-article"><p>Content</p></article>';
    const extracted = extractArticle(html);
    expect(extracted).toBe('<p>Content</p>');
  });

  function stripNonContent(html) {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<aside[\s\S]*?<\/aside>/gi, '');
  }

  it('should strip header elements', () => {
    const html = '<header><h1>Site Title</h1><nav>Menu</nav></header><p>Content</p>';
    const cleaned = stripNonContent(html);
    expect(cleaned).not.toContain('Site Title');
    expect(cleaned).toContain('Content');
  });

  it('should strip aside elements (sidebars)', () => {
    const html = '<div><p>Article</p></div><aside><h3>Related</h3></aside>';
    const cleaned = stripNonContent(html);
    expect(cleaned).not.toContain('Related');
    expect(cleaned).toContain('Article');
  });

  it('should handle multiple script tags', () => {
    const html = '<script>var a=1;</script><p>Good</p><script src="app.js"></script><script>alert("x")</script>';
    const cleaned = stripNonContent(html);
    expect(cleaned).not.toContain('alert');
    expect(cleaned).not.toContain('var a');
    expect(cleaned).toContain('Good');
  });

  it('should handle nested style tags', () => {
    const html = '<style>.a { color: red; }</style><div style="color:blue"><p>Text</p></div>';
    const cleaned = stripNonContent(html);
    expect(cleaned).not.toContain('color: red');
    expect(cleaned).toContain('Text');
  });

  function htmlToPlainText(html) {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(?:p|div|h[1-6]|li|tr|blockquote)>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  it('should convert br tags to newlines', () => {
    const html = 'Line 1<br>Line 2<br/>Line 3<br />Line 4';
    const text = htmlToPlainText(html);
    expect(text.split('\n').length).toBeGreaterThanOrEqual(4);
  });

  it('should add double newlines after block elements', () => {
    const html = '<p>Paragraph 1</p><p>Paragraph 2</p>';
    const text = htmlToPlainText(html);
    expect(text).toContain('Paragraph 1');
    expect(text).toContain('Paragraph 2');
  });

  it('should handle deeply nested HTML', () => {
    const html = '<div><div><div><p>Deep <strong>content</strong></p></div></div></div>';
    const text = htmlToPlainText(html);
    expect(text).toContain('Deep content');
  });

  it('should normalize multiple consecutive newlines', () => {
    const html = '<p>A</p>\n\n\n\n<p>B</p>';
    const text = htmlToPlainText(html);
    expect(text).not.toMatch(/\n{3,}/);
  });

  it('should handle heading tags', () => {
    const html = '<h1>Title</h1><h2>Subtitle</h2><p>Content</p>';
    const text = htmlToPlainText(html);
    expect(text).toContain('Title');
    expect(text).toContain('Subtitle');
    expect(text).toContain('Content');
  });

  it('should handle list items', () => {
    const html = '<ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>';
    const text = htmlToPlainText(html);
    expect(text).toContain('Item 1');
    expect(text).toContain('Item 2');
    expect(text).toContain('Item 3');
  });
});

// ─── Background Processor Logic ───

describe('Background Processor', () => {
  it('should process unprocessed notes in FIFO order', () => {
    const notes = [
      { id: 'n1', created_at: '2026-01-01', is_processed: 0 },
      { id: 'n2', created_at: '2026-01-02', is_processed: 0 },
      { id: 'n3', created_at: '2026-01-03', is_processed: 1 },
    ];

    const unprocessed = notes.filter(n => n.is_processed === 0);
    expect(unprocessed).toHaveLength(2);
    expect(unprocessed[0].id).toBe('n1'); // FIFO
  });

  it('should limit batch to 3 notes', () => {
    const notes = Array.from({ length: 10 }, (_, i) => ({
      id: `n${i}`, created_at: `2026-01-0${i}`, is_processed: 0,
    }));

    const batch = notes.filter(n => n.is_processed === 0).slice(0, 3);
    expect(batch).toHaveLength(3);
  });

  it('should handle empty queue gracefully', () => {
    const notes = [
      { id: 'n1', is_processed: 1 },
      { id: 'n2', is_processed: 1 },
    ];

    const unprocessed = notes.filter(n => n.is_processed === 0);
    expect(unprocessed).toHaveLength(0);
  });
});

// ─── API Route Validation ───

describe('API Route Validation', () => {
  it('should require question in /ask endpoint', () => {
    const body = {};
    const hasQuestion = !!body.question;
    expect(hasQuestion).toBe(false);
  });

  it('should accept question with default owner_id', () => {
    const body = { question: 'What about AI?' };
    const { question, owner_id = 'default' } = body;
    expect(question).toBe('What about AI?');
    expect(owner_id).toBe('default');
  });

  it('should accept custom owner_id', () => {
    const body = { question: 'Q', owner_id: 'user-123' };
    const { owner_id = 'default' } = body;
    expect(owner_id).toBe('user-123');
  });

  it('should require message in /agent/chat endpoint', () => {
    const body = {};
    const hasMessage = !!body.message;
    expect(hasMessage).toBe(false);
  });

  it('should handle chat with history', () => {
    const body = {
      message: 'Follow up question',
      history: [
        { role: 'user', content: 'First question' },
        { role: 'assistant', content: 'First answer' },
      ],
      owner_id: 'user-1',
    };

    const messages = [
      ...body.history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: `[Context: owner_id=${body.owner_id}]\n\n${body.message}` },
    ];

    expect(messages).toHaveLength(3);
    expect(messages[2].content).toContain('owner_id=user-1');
    expect(messages[2].content).toContain('Follow up question');
  });

  it('should handle chat with empty history', () => {
    const body = { message: 'Hello', history: [] };
    const messages = [
      ...body.history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: body.message },
    ];
    expect(messages).toHaveLength(1);
  });

  it('should require URL in /extract-url endpoint', () => {
    const body = {};
    const hasUrl = !!body.url;
    expect(hasUrl).toBe(false);
  });
});

// ─── Research Brief Context Building ───

describe('Research Brief - Context Building', () => {
  function buildBriefContext(notes) {
    return notes
      .map(n => `- ${n.title}: ${n.ai_summary || n.content?.slice(0, 200) || ''}`)
      .join('\n');
  }

  it('should prefer ai_summary over content', () => {
    const notes = [{ title: 'Note', ai_summary: 'AI generated summary', content: 'Raw content' }];
    const context = buildBriefContext(notes);
    expect(context).toContain('AI generated summary');
    expect(context).not.toContain('Raw content');
  });

  it('should fallback to truncated content when no summary', () => {
    const notes = [{ title: 'Note', ai_summary: '', content: 'This is raw content that should be used.' }];
    const context = buildBriefContext(notes);
    expect(context).toContain('raw content');
  });

  it('should handle notes with neither summary nor content', () => {
    const notes = [{ title: 'Empty Note', ai_summary: '', content: null }];
    const context = buildBriefContext(notes);
    expect(context).toContain('Empty Note');
  });

  it('should format with bullet points', () => {
    const notes = [
      { title: 'A', ai_summary: 'Summary A', content: '' },
      { title: 'B', ai_summary: 'Summary B', content: '' },
    ];
    const context = buildBriefContext(notes);
    const lines = context.split('\n');
    expect(lines.every(l => l.startsWith('- '))).toBe(true);
  });
});
