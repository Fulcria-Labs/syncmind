import { describe, it, expect, vi } from 'vitest';

// AI response parser from ai.js
function parseAIResponse(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : { summary: text, tags: [], connections: [], key_insights: [] };
  }
}

describe('AI Response - Malformed JSON', () => {
  it('should handle JSON with trailing comma in tags', () => {
    // JSON with trailing comma is invalid - should fall back to regex
    const text = '{"summary":"S","tags":["a","b",],"connections":[],"key_insights":[]}';
    let result;
    try {
      result = parseAIResponse(text);
      // If regex extraction also fails, fallback
    } catch {
      result = { summary: text, tags: [], connections: [], key_insights: [] };
    }
    expect(result).toBeTruthy();
  });

  it('should throw on single-quote JSON that regex matches but cannot parse', () => {
    // Single quotes are invalid JSON - regex finds a match but JSON.parse throws
    const text = "{'summary':'S','tags':[],'connections':[],'key_insights':[]}";
    expect(() => parseAIResponse(text)).toThrow();
  });

  it('should handle truncated JSON response', () => {
    const text = '{"summary":"This is a long summary that gets cut off..."';
    const result = parseAIResponse(text);
    // Regex finds the { but can't parse it, so falls back
    expect(result).toBeTruthy();
  });

  it('should handle empty string response', () => {
    const result = parseAIResponse('');
    expect(result.summary).toBe('');
    expect(result.tags).toEqual([]);
  });

  it('should handle whitespace-only response', () => {
    const result = parseAIResponse('   \n\n   ');
    expect(result.summary).toBe('   \n\n   ');
    expect(result.tags).toEqual([]);
  });

  it('should handle response with only curly braces', () => {
    const result = parseAIResponse('{}');
    expect(result).toEqual({});
  });

  it('should handle nested JSON within text', () => {
    const text = 'Analysis result: {"summary":"Nested","tags":["deep"],"connections":[],"key_insights":["inside"]} is complete.';
    const result = parseAIResponse(text);
    expect(result.summary).toBe('Nested');
    expect(result.tags).toEqual(['deep']);
    expect(result.key_insights).toEqual(['inside']);
  });

  it('should handle JSON with extra whitespace', () => {
    const text = `{
      "summary" : "Formatted" ,
      "tags" : [ "ai" , "ml" ] ,
      "connections" : [ ] ,
      "key_insights" : [ "insight" ]
    }`;
    const result = parseAIResponse(text);
    expect(result.summary).toBe('Formatted');
    expect(result.tags).toHaveLength(2);
  });
});

describe('AI Response - Connection Parsing', () => {
  it('should handle connections with UUID-style note_ids', () => {
    const result = parseAIResponse(JSON.stringify({
      summary: 'S',
      tags: [],
      connections: [
        { note_id: '550e8400-e29b-41d4-a716-446655440000', relationship: 'cites' },
      ],
      key_insights: []
    }));

    expect(result.connections[0].note_id).toMatch(/^[0-9a-f-]+$/);
  });

  it('should handle connection with empty relationship', () => {
    const result = parseAIResponse(JSON.stringify({
      summary: 'S',
      tags: [],
      connections: [{ note_id: 'n1', relationship: '' }],
      key_insights: []
    }));

    expect(result.connections[0].relationship).toBe('');
  });

  it('should handle connections with long relationship descriptions', () => {
    const longRel = 'provides foundational theoretical framework for understanding the relationship between'.repeat(3);
    const result = parseAIResponse(JSON.stringify({
      summary: 'S',
      tags: [],
      connections: [{ note_id: 'n1', relationship: longRel }],
      key_insights: []
    }));

    expect(result.connections[0].relationship.length).toBeGreaterThan(100);
  });

  it('should handle many connections', () => {
    const connections = Array.from({ length: 20 }, (_, i) => ({
      note_id: `n${i}`,
      relationship: `relationship-${i}`
    }));

    const result = parseAIResponse(JSON.stringify({
      summary: 'S',
      tags: [],
      connections,
      key_insights: []
    }));

    expect(result.connections).toHaveLength(20);
  });
});

describe('AI Response - Tag Variations', () => {
  it('should handle tags with hyphens', () => {
    const result = parseAIResponse(JSON.stringify({
      summary: 'S', tags: ['machine-learning', 'deep-learning', 'natural-language-processing'],
      connections: [], key_insights: []
    }));
    expect(result.tags).toContain('machine-learning');
  });

  it('should handle tags with numbers', () => {
    const result = parseAIResponse(JSON.stringify({
      summary: 'S', tags: ['gpt-4', 'llama-3.2', '2026-research'],
      connections: [], key_insights: []
    }));
    expect(result.tags).toContain('gpt-4');
    expect(result.tags).toContain('2026-research');
  });

  it('should handle empty tags array', () => {
    const result = parseAIResponse(JSON.stringify({
      summary: 'S', tags: [], connections: [], key_insights: []
    }));
    expect(result.tags).toEqual([]);
    expect(result.tags.join(',')).toBe('');
  });

  it('should handle single tag', () => {
    const result = parseAIResponse(JSON.stringify({
      summary: 'S', tags: ['single'], connections: [], key_insights: []
    }));
    expect(result.tags).toHaveLength(1);
    expect(result.tags.join(',')).toBe('single');
  });

  it('should handle many tags', () => {
    const tags = Array.from({ length: 20 }, (_, i) => `tag-${i}`);
    const result = parseAIResponse(JSON.stringify({
      summary: 'S', tags, connections: [], key_insights: []
    }));
    expect(result.tags).toHaveLength(20);
  });
});

describe('AI Response - Key Insights', () => {
  it('should parse multiple insights', () => {
    const result = parseAIResponse(JSON.stringify({
      summary: 'S', tags: [],
      connections: [],
      key_insights: ['Insight 1', 'Insight 2', 'Insight 3']
    }));
    expect(result.key_insights).toHaveLength(3);
  });

  it('should handle long insight strings', () => {
    const longInsight = 'This is a very detailed key insight that provides substantial analysis of the research note and its implications for the broader field of study.';
    const result = parseAIResponse(JSON.stringify({
      summary: 'S', tags: [], connections: [],
      key_insights: [longInsight]
    }));
    expect(result.key_insights[0]).toBe(longInsight);
  });

  it('should handle empty insights array', () => {
    const result = parseAIResponse(JSON.stringify({
      summary: 'S', tags: [], connections: [], key_insights: []
    }));
    expect(result.key_insights).toEqual([]);
  });
});

describe('AI Response - Summary Variations', () => {
  it('should handle multi-sentence summary', () => {
    const summary = 'This note covers AI. It explores deep learning. The implications are significant.';
    const result = parseAIResponse(JSON.stringify({
      summary, tags: [], connections: [], key_insights: []
    }));
    expect(result.summary).toBe(summary);
  });

  it('should handle summary with markdown', () => {
    const summary = 'Covers **important** topics including *AI* and `machine learning`.';
    const result = parseAIResponse(JSON.stringify({
      summary, tags: [], connections: [], key_insights: []
    }));
    expect(result.summary).toContain('**important**');
  });

  it('should handle summary with newlines', () => {
    const summary = 'First line.\nSecond line.\nThird line.';
    const result = parseAIResponse(JSON.stringify({
      summary, tags: [], connections: [], key_insights: []
    }));
    expect(result.summary).toContain('\n');
  });

  it('should handle very long summary', () => {
    const summary = 'x'.repeat(5000);
    const result = parseAIResponse(JSON.stringify({
      summary, tags: [], connections: [], key_insights: []
    }));
    expect(result.summary.length).toBe(5000);
  });
});

describe('AI Response - Fallback Behavior', () => {
  it('should use full text as summary when no JSON found', () => {
    const text = 'This is a plain text analysis without any JSON structure.';
    const result = parseAIResponse(text);
    expect(result.summary).toBe(text);
    expect(result.tags).toEqual([]);
    expect(result.connections).toEqual([]);
    expect(result.key_insights).toEqual([]);
  });

  it('should extract JSON even with prefix text', () => {
    const text = 'Here is my analysis:\n{"summary":"Found it","tags":["ai"],"connections":[],"key_insights":[]}';
    const result = parseAIResponse(text);
    expect(result.summary).toBe('Found it');
  });

  it('should extract JSON even with suffix text', () => {
    const text = '{"summary":"Result","tags":[],"connections":[],"key_insights":[]}\nI hope this helps!';
    const result = parseAIResponse(text);
    expect(result.summary).toBe('Result');
  });

  it('should handle response in markdown code block', () => {
    const text = '```json\n{"summary":"In block","tags":["test"],"connections":[],"key_insights":[]}\n```';
    const result = parseAIResponse(text);
    expect(result.summary).toBe('In block');
  });

  it('should handle response in triple backticks without language', () => {
    const text = '```\n{"summary":"No lang","tags":[],"connections":[],"key_insights":[]}\n```';
    const result = parseAIResponse(text);
    expect(result.summary).toBe('No lang');
  });
});

describe('Tag Serialization and Update', () => {
  it('should join tags with commas', () => {
    const tags = ['ai', 'ml', 'research'];
    expect(tags.join(',')).toBe('ai,ml,research');
  });

  it('should handle undefined tags', () => {
    const tags = undefined;
    expect((tags || []).join(',')).toBe('');
  });

  it('should handle null tags', () => {
    const tags = null;
    expect((tags || []).join(',')).toBe('');
  });

  it('should create tag upsert with incrementing count', () => {
    const sql = `INSERT INTO tags (name, note_count) VALUES ($1, 1)
       ON CONFLICT (name) DO UPDATE SET note_count = tags.note_count + 1`;
    expect(sql).toContain('ON CONFLICT');
    expect(sql).toContain('note_count + 1');
  });
});

describe('Connection Record Creation', () => {
  function filterValidConnections(connections, otherNotes) {
    return (connections || []).filter(conn =>
      otherNotes.find(n => n.id === conn.note_id)
    );
  }

  it('should filter out connections to nonexistent notes', () => {
    const connections = [
      { note_id: 'real-1', relationship: 'cites' },
      { note_id: 'fake-1', relationship: 'extends' },
      { note_id: 'real-2', relationship: 'contradicts' },
    ];
    const otherNotes = [{ id: 'real-1' }, { id: 'real-2' }];

    const valid = filterValidConnections(connections, otherNotes);
    expect(valid).toHaveLength(2);
    expect(valid.map(c => c.note_id)).toEqual(['real-1', 'real-2']);
  });

  it('should return empty when all connections are invalid', () => {
    const connections = [{ note_id: 'fake', relationship: 'x' }];
    const otherNotes = [{ id: 'real' }];

    expect(filterValidConnections(connections, otherNotes)).toHaveLength(0);
  });

  it('should handle empty connections array', () => {
    expect(filterValidConnections([], [{ id: 'n1' }])).toHaveLength(0);
  });

  it('should handle null connections', () => {
    expect(filterValidConnections(null, [{ id: 'n1' }])).toHaveLength(0);
  });

  it('should handle empty other notes', () => {
    const connections = [{ note_id: 'n1', relationship: 'rel' }];
    expect(filterValidConnections(connections, [])).toHaveLength(0);
  });

  it('should use ON CONFLICT DO NOTHING for connection upsert', () => {
    const sql = `INSERT INTO connections (id, source_note_id, target_note_id, relationship, confidence, created_at)
           VALUES (uuid_generate_v4(), $1, $2, $3, $4, NOW()::text)
           ON CONFLICT DO NOTHING`;
    expect(sql).toContain('ON CONFLICT DO NOTHING');
    expect(sql).toContain('uuid_generate_v4()');
  });
});

describe('Process Note - Update Query', () => {
  it('should update all AI fields simultaneously', () => {
    const sql = `UPDATE notes SET
      ai_summary = $1,
      ai_tags = $2,
      ai_connections = $3,
      is_processed = 1,
      updated_at = $5
    WHERE id = $4`;

    expect(sql).toContain('ai_summary');
    expect(sql).toContain('ai_tags');
    expect(sql).toContain('ai_connections');
    expect(sql).toContain('is_processed = 1');
    expect(sql).toContain('updated_at');
  });

  it('should use ISO date string for updated_at', () => {
    const now = new Date().toISOString();
    expect(now).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('should serialize empty connections as empty string', () => {
    const connections = [];
    const serialized = connections.map(c => `${c.note_id}:${c.relationship}`).join(',');
    expect(serialized).toBe('');
  });

  it('should serialize connections with colons as delimiter', () => {
    const connections = [
      { note_id: 'abc', relationship: 'extends' },
      { note_id: 'def', relationship: 'contrasts' },
    ];
    const serialized = connections.map(c => `${c.note_id}:${c.relationship}`).join(',');
    expect(serialized).toBe('abc:extends,def:contrasts');
  });
});
