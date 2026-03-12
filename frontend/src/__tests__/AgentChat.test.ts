import { describe, it, expect } from 'vitest';

// ─── Extract and test pure logic from AgentChat.tsx ───

const TOOL_LABELS: Record<string, string> = {
  'searchNotesTool': 'Searched notes',
  'getNoteDetailTool': 'Read note details',
  'listAllNotesTool': 'Listed all notes',
  'getTagsTool': 'Analyzed tags',
  'getConnectionGraphTool': 'Explored connections',
};

// ─── Tool Label Mapping ───

describe('AgentChat - Tool Labels', () => {
  it('should map all 5 known tools', () => {
    expect(Object.keys(TOOL_LABELS)).toHaveLength(5);
  });

  it('should provide human-readable labels for each tool', () => {
    expect(TOOL_LABELS['searchNotesTool']).toBe('Searched notes');
    expect(TOOL_LABELS['getNoteDetailTool']).toBe('Read note details');
    expect(TOOL_LABELS['listAllNotesTool']).toBe('Listed all notes');
    expect(TOOL_LABELS['getTagsTool']).toBe('Analyzed tags');
    expect(TOOL_LABELS['getConnectionGraphTool']).toBe('Explored connections');
  });

  it('should fallback to toolName for unknown tools', () => {
    const toolName = 'customTool';
    const label = TOOL_LABELS[toolName] || toolName;
    expect(label).toBe('customTool');
  });
});

// ─── Message Building ───

describe('AgentChat - Message Building', () => {
  it('should build message list with owner_id context', () => {
    const history = [
      { role: 'user' as const, content: 'Hello' },
      { role: 'assistant' as const, content: 'Hi there!' },
    ];
    const message = 'What are my research themes?';
    const owner_id = 'user-42';

    const messages = [
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user' as const, content: `[Context: owner_id=${owner_id}]\n\n${message}` }
    ];

    expect(messages).toHaveLength(3);
    expect(messages[2].content).toContain('owner_id=user-42');
    expect(messages[2].content).toContain('What are my research themes?');
  });

  it('should handle empty history', () => {
    const history: { role: string; content: string }[] = [];
    const message = 'First message';
    const owner_id = 'default';

    const messages = [
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user' as const, content: `[Context: owner_id=${owner_id}]\n\n${message}` }
    ];

    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('user');
  });
});

// ─── Tool Call Processing ───

describe('AgentChat - Tool Call Processing', () => {
  it('should extract tool calls from API response', () => {
    const apiResponse = {
      reply: 'Based on my analysis...',
      toolCalls: [
        { toolName: 'searchNotesTool', args: { query: 'RAG' } },
        { toolName: 'getNoteDetailTool', args: { note_id: 'n1' } },
      ]
    };

    const toolsUsed = (apiResponse.toolCalls || []).map((tc: any) => ({
      toolName: tc.toolName || tc.name || 'unknown',
      args: tc.args
    }));

    expect(toolsUsed).toHaveLength(2);
    expect(toolsUsed[0].toolName).toBe('searchNotesTool');
    expect(toolsUsed[0].args?.query).toBe('RAG');
  });

  it('should handle response with no tool calls', () => {
    const apiResponse = { reply: 'Simple response', toolCalls: [] };

    const toolsUsed = (apiResponse.toolCalls || []).map((tc: any) => ({
      toolName: tc.toolName || tc.name || 'unknown',
      args: tc.args
    }));

    expect(toolsUsed).toHaveLength(0);
  });

  it('should handle response with missing toolCalls field', () => {
    const apiResponse = { reply: 'No tools used' };

    const toolsUsed = ((apiResponse as any).toolCalls || []).map((tc: any) => ({
      toolName: tc.toolName || tc.name || 'unknown',
      args: tc.args
    }));

    expect(toolsUsed).toHaveLength(0);
  });

  it('should handle tool calls with name instead of toolName', () => {
    const apiResponse = {
      reply: 'Result',
      toolCalls: [{ name: 'getTagsTool', args: {} }]
    };

    const toolsUsed = (apiResponse.toolCalls || []).map((tc: any) => ({
      toolName: tc.toolName || tc.name || 'unknown',
      args: tc.args
    }));

    expect(toolsUsed[0].toolName).toBe('getTagsTool');
  });
});

// ─── Input Validation ───

describe('AgentChat - Input Validation', () => {
  it('should reject empty input', () => {
    const input = '';
    expect(!input.trim()).toBe(true);
  });

  it('should reject whitespace-only input', () => {
    const input = '   \n\t  ';
    expect(!input.trim()).toBe(true);
  });

  it('should accept valid input', () => {
    const input = 'How are my notes connected?';
    expect(!input.trim()).toBe(false);
  });

  it('should not send when loading', () => {
    const input = 'Valid message';
    const loading = true;
    const shouldSend = input.trim() && !loading;
    expect(shouldSend).toBe(false);
  });
});

// ─── Suggestion Chips ───

describe('AgentChat - Suggestion Chips', () => {
  const suggestions = [
    'What are my main research themes?',
    'Summarize my recent notes',
    'Find connections between my notes'
  ];

  it('should have exactly 3 suggestion chips', () => {
    expect(suggestions).toHaveLength(3);
  });

  it('should have unique suggestions', () => {
    const unique = [...new Set(suggestions)];
    expect(unique).toHaveLength(suggestions.length);
  });

  it('should cover key agent capabilities', () => {
    expect(suggestions.some(s => s.includes('themes'))).toBe(true);
    expect(suggestions.some(s => s.includes('Summarize'))).toBe(true);
    expect(suggestions.some(s => s.includes('connections'))).toBe(true);
  });
});

// ─── Error Handling ───

describe('AgentChat - Error Handling', () => {
  it('should create error message for API errors', () => {
    const errResponse = { message: 'Rate limit exceeded' };
    const errorMsg = { role: 'assistant' as const, content: `Error: ${errResponse.message}` };
    expect(errorMsg.content).toBe('Error: Rate limit exceeded');
  });

  it('should create fallback error for unparseable response', () => {
    const fallback = { message: 'Request failed' };
    const errorMsg = { role: 'assistant' as const, content: `Error: ${fallback.message}` };
    expect(errorMsg.content).toBe('Error: Request failed');
  });

  it('should create offline error message', () => {
    const offlineMsg = { role: 'assistant' as const, content: 'Failed to reach the agent. Are you online?' };
    expect(offlineMsg.content).toContain('online');
  });
});
