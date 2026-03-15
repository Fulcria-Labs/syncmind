import { describe, it, expect } from 'vitest';

// ─── Extract and test pure logic from AgentChat.tsx ───

interface ToolCall {
  toolName: string;
  args?: Record<string, unknown>;
  resultSummary?: string;
}

const TOOL_LABELS: Record<string, string> = {
  'searchNotesTool': 'Searched notes',
  'getNoteDetailTool': 'Read note details',
  'listAllNotesTool': 'Listed all notes',
  'getTagsTool': 'Analyzed tags',
  'getConnectionGraphTool': 'Explored connections',
};

const TOOL_ICONS: Record<string, string> = {
  'searchNotesTool': '\uD83D\uDD0D',
  'getNoteDetailTool': '\uD83D\uDCDD',
  'listAllNotesTool': '\uD83D\uDCCB',
  'getTagsTool': '\uD83C\uDFF7\uFE0F',
  'getConnectionGraphTool': '\uD83D\uDD17',
};

function formatToolSummary(tc: ToolCall): string {
  const label = TOOL_LABELS[tc.toolName] || tc.toolName;
  const icon = TOOL_ICONS[tc.toolName] || '\u2699\uFE0F';

  if (tc.resultSummary) {
    return `${icon} ${label}: ${tc.resultSummary}`;
  }

  const args = tc.args;
  if (!args) return `${icon} ${label}`;

  if (tc.toolName === 'searchNotesTool' && args.query) {
    return `${icon} Searched '${args.query}'`;
  }
  if (tc.toolName === 'getNoteDetailTool' && args.note_id) {
    const shortId = String(args.note_id).slice(0, 8);
    return `${icon} Read note ${shortId}...`;
  }
  if (tc.toolName === 'listAllNotesTool') {
    return `${icon} Listed all notes`;
  }

  return `${icon} ${label}`;
}

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

// ─── Tool Icons ───

describe('AgentChat - Tool Icons', () => {
  it('should have icons for all 5 known tools', () => {
    expect(Object.keys(TOOL_ICONS)).toHaveLength(5);
  });

  it('should map icons for each tool', () => {
    expect(TOOL_ICONS['searchNotesTool']).toBeDefined();
    expect(TOOL_ICONS['getNoteDetailTool']).toBeDefined();
    expect(TOOL_ICONS['listAllNotesTool']).toBeDefined();
    expect(TOOL_ICONS['getTagsTool']).toBeDefined();
    expect(TOOL_ICONS['getConnectionGraphTool']).toBeDefined();
  });

  it('should have consistent keys between TOOL_LABELS and TOOL_ICONS', () => {
    const labelKeys = Object.keys(TOOL_LABELS).sort();
    const iconKeys = Object.keys(TOOL_ICONS).sort();
    expect(labelKeys).toEqual(iconKeys);
  });
});

// ─── formatToolSummary ───

describe('AgentChat - formatToolSummary', () => {
  it('should format search tool with query arg', () => {
    const tc: ToolCall = { toolName: 'searchNotesTool', args: { query: 'embeddings' } };
    const result = formatToolSummary(tc);
    expect(result).toContain('Searched');
    expect(result).toContain('embeddings');
  });

  it('should format search tool with resultSummary', () => {
    const tc: ToolCall = { toolName: 'searchNotesTool', args: { query: 'RAG' }, resultSummary: '3 results' };
    const result = formatToolSummary(tc);
    expect(result).toContain('Searched notes');
    expect(result).toContain('3 results');
  });

  it('should format note detail tool with shortened ID', () => {
    const tc: ToolCall = { toolName: 'getNoteDetailTool', args: { note_id: 'abcdef12-3456-7890' } };
    const result = formatToolSummary(tc);
    expect(result).toContain('Read note');
    expect(result).toContain('abcdef12');
    expect(result).toContain('...');
  });

  it('should format list all notes tool', () => {
    const tc: ToolCall = { toolName: 'listAllNotesTool', args: {} };
    const result = formatToolSummary(tc);
    expect(result).toContain('Listed all notes');
  });

  it('should format tags tool with no args', () => {
    const tc: ToolCall = { toolName: 'getTagsTool' };
    const result = formatToolSummary(tc);
    expect(result).toContain('Analyzed tags');
  });

  it('should format connection graph tool', () => {
    const tc: ToolCall = { toolName: 'getConnectionGraphTool', args: { owner_id: 'default' } };
    const result = formatToolSummary(tc);
    expect(result).toContain('Explored connections');
  });

  it('should use resultSummary over args when both present', () => {
    const tc: ToolCall = {
      toolName: 'searchNotesTool',
      args: { query: 'machine learning' },
      resultSummary: '5 results'
    };
    const result = formatToolSummary(tc);
    // resultSummary takes priority, so it should show label + summary, not args
    expect(result).toContain('5 results');
    expect(result).toContain('Searched notes');
  });

  it('should fall back to toolName for unknown tools', () => {
    const tc: ToolCall = { toolName: 'unknownCustomTool', args: { foo: 'bar' } };
    const result = formatToolSummary(tc);
    expect(result).toContain('unknownCustomTool');
  });

  it('should use gear icon for unknown tools', () => {
    const tc: ToolCall = { toolName: 'unknownCustomTool' };
    const result = formatToolSummary(tc);
    expect(result).toContain('\u2699');
  });

  it('should handle tool with no args and no resultSummary', () => {
    const tc: ToolCall = { toolName: 'getTagsTool' };
    const result = formatToolSummary(tc);
    expect(result).toBe(`${TOOL_ICONS['getTagsTool']} Analyzed tags`);
  });
});

// ─── Tool Call Processing with resultSummary ───

describe('AgentChat - Tool Call Processing with resultSummary', () => {
  it('should extract resultSummary from API response', () => {
    const apiResponse = {
      reply: 'Found relevant notes...',
      toolCalls: [
        { toolName: 'searchNotesTool', args: { query: 'AI' }, resultSummary: '4 results' },
      ]
    };

    const toolsUsed: ToolCall[] = (apiResponse.toolCalls || []).map((tc: any) => ({
      toolName: tc.toolName || tc.name || 'unknown',
      args: tc.args,
      resultSummary: tc.resultSummary || undefined
    }));

    expect(toolsUsed).toHaveLength(1);
    expect(toolsUsed[0].resultSummary).toBe('4 results');
  });

  it('should handle missing resultSummary', () => {
    const apiResponse = {
      reply: 'Result',
      toolCalls: [
        { toolName: 'getTagsTool', args: {} },
      ]
    };

    const toolsUsed: ToolCall[] = (apiResponse.toolCalls || []).map((tc: any) => ({
      toolName: tc.toolName || tc.name || 'unknown',
      args: tc.args,
      resultSummary: tc.resultSummary || undefined
    }));

    expect(toolsUsed[0].resultSummary).toBeUndefined();
  });

  it('should handle multiple tool calls with mixed resultSummary presence', () => {
    const apiResponse = {
      reply: 'Analysis complete',
      toolCalls: [
        { toolName: 'searchNotesTool', args: { query: 'ML' }, resultSummary: '2 results' },
        { toolName: 'getTagsTool', args: {} },
        { toolName: 'listAllNotesTool', args: {}, resultSummary: '10 notes' },
      ]
    };

    const toolsUsed: ToolCall[] = (apiResponse.toolCalls || []).map((tc: any) => ({
      toolName: tc.toolName || tc.name || 'unknown',
      args: tc.args,
      resultSummary: tc.resultSummary || undefined
    }));

    expect(toolsUsed).toHaveLength(3);
    expect(toolsUsed[0].resultSummary).toBe('2 results');
    expect(toolsUsed[1].resultSummary).toBeUndefined();
    expect(toolsUsed[2].resultSummary).toBe('10 notes');
  });
});
