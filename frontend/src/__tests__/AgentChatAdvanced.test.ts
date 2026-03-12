import { describe, it, expect } from 'vitest';

// ─── Advanced AgentChat logic tests ───

// Chat history management
function buildChatHistory(messages: Array<{ role: string; content: string }>) {
  return messages.map(m => ({ role: m.role, content: m.content }));
}

// API request body construction
function buildChatRequestBody(
  message: string,
  history: Array<{ role: string; content: string }>,
  ownerId: string
) {
  return {
    message,
    history: history.map(m => ({ role: m.role, content: m.content })),
    owner_id: ownerId,
  };
}

// Response parsing - extract reply and tool calls
function parseAgentResponse(data: any): { reply: string; toolsUsed: Array<{ toolName: string; args?: any }> } {
  const toolsUsed = (data.toolCalls || []).map((tc: any) => ({
    toolName: tc.toolName || tc.name || 'unknown',
    args: tc.args,
  }));
  return { reply: data.reply, toolsUsed };
}

// Should show tool badges
function shouldShowToolBadges(toolsUsed: Array<{ toolName: string }> | undefined): boolean {
  return !!toolsUsed && toolsUsed.length > 0;
}

// Tool label with fallback
function getToolLabel(toolName: string, labels: Record<string, string>): string {
  return labels[toolName] || toolName;
}

// Chat panel state
function getChatPanelState(isOpen: boolean): 'fab' | 'panel' {
  return isOpen ? 'panel' : 'fab';
}

// Send button disabled state
function isSendDisabled(loading: boolean, input: string): boolean {
  return loading || !input.trim();
}

// Message class name
function getMessageClass(role: 'user' | 'assistant'): string {
  return `agent-msg agent-msg-${role}`;
}

// Welcome screen visibility
function shouldShowWelcome(messageCount: number): boolean {
  return messageCount === 0;
}

// Loading indicator visibility
function shouldShowLoading(loading: boolean): boolean {
  return loading;
}

// Backend URL construction
function buildChatUrl(backendUrl: string): string {
  return `${backendUrl}/api/ai/agent/chat`;
}

// Error response message extraction
function extractErrorMessage(err: any): string {
  return err?.message || 'Request failed';
}

// ─── Chat History Management ───

describe('AgentChat - Chat History', () => {
  it('builds history from messages', () => {
    const messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi!' },
    ];
    const history = buildChatHistory(messages);
    expect(history).toHaveLength(2);
    expect(history[0].role).toBe('user');
    expect(history[1].role).toBe('assistant');
  });

  it('handles empty message list', () => {
    expect(buildChatHistory([])).toEqual([]);
  });

  it('strips extra properties from messages', () => {
    const messages = [
      { role: 'user', content: 'Hello', toolsUsed: [{ toolName: 'test' }] } as any,
    ];
    const history = buildChatHistory(messages);
    expect(history[0]).toEqual({ role: 'user', content: 'Hello' });
    expect((history[0] as any).toolsUsed).toBeUndefined();
  });

  it('preserves message order', () => {
    const messages = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i}`,
    }));
    const history = buildChatHistory(messages);
    history.forEach((h, i) => expect(h.content).toBe(`Message ${i}`));
  });
});

// ─── Request Body Construction ───

describe('AgentChat - Request Body', () => {
  it('constructs request body with all fields', () => {
    const body = buildChatRequestBody('What are my themes?', [{ role: 'user', content: 'Hi' }], 'user-42');
    expect(body.message).toBe('What are my themes?');
    expect(body.history).toHaveLength(1);
    expect(body.owner_id).toBe('user-42');
  });

  it('handles empty history', () => {
    const body = buildChatRequestBody('First message', [], 'user-1');
    expect(body.history).toEqual([]);
  });

  it('preserves owner_id format', () => {
    const body = buildChatRequestBody('Test', [], 'test-uuid-1234-5678');
    expect(body.owner_id).toBe('test-uuid-1234-5678');
  });
});

// ─── Response Parsing ───

describe('AgentChat - Response Parsing', () => {
  it('parses response with tool calls', () => {
    const data = {
      reply: 'Found 3 notes',
      toolCalls: [
        { toolName: 'searchNotesTool', args: { query: 'RAG' } },
        { toolName: 'getTagsTool', args: {} },
      ],
    };
    const result = parseAgentResponse(data);
    expect(result.reply).toBe('Found 3 notes');
    expect(result.toolsUsed).toHaveLength(2);
  });

  it('parses response without tool calls', () => {
    const data = { reply: 'Simple answer' };
    const result = parseAgentResponse(data);
    expect(result.toolsUsed).toEqual([]);
  });

  it('handles name field instead of toolName', () => {
    const data = { reply: 'Result', toolCalls: [{ name: 'listAllNotesTool' }] };
    const result = parseAgentResponse(data);
    expect(result.toolsUsed[0].toolName).toBe('listAllNotesTool');
  });

  it('defaults to "unknown" for missing tool name', () => {
    const data = { reply: 'Result', toolCalls: [{ args: { test: true } }] };
    const result = parseAgentResponse(data);
    expect(result.toolsUsed[0].toolName).toBe('unknown');
  });

  it('preserves tool args', () => {
    const data = { reply: 'R', toolCalls: [{ toolName: 'searchNotesTool', args: { query: 'ML', limit: 5 } }] };
    const result = parseAgentResponse(data);
    expect(result.toolsUsed[0].args).toEqual({ query: 'ML', limit: 5 });
  });

  it('handles null toolCalls', () => {
    const data = { reply: 'R', toolCalls: null };
    const result = parseAgentResponse(data);
    expect(result.toolsUsed).toEqual([]);
  });
});

// ─── Tool Badge Visibility ───

describe('AgentChat - Tool Badge Visibility', () => {
  it('shows badges when tools were used', () => {
    expect(shouldShowToolBadges([{ toolName: 'searchNotesTool' }])).toBe(true);
  });

  it('hides badges when no tools used', () => {
    expect(shouldShowToolBadges([])).toBe(false);
  });

  it('hides badges when undefined', () => {
    expect(shouldShowToolBadges(undefined)).toBe(false);
  });
});

// ─── Tool Label Mapping ───

describe('AgentChat - Tool Label Mapping', () => {
  const TOOL_LABELS: Record<string, string> = {
    'searchNotesTool': 'Searched notes',
    'getNoteDetailTool': 'Read note details',
    'listAllNotesTool': 'Listed all notes',
    'getTagsTool': 'Analyzed tags',
    'getConnectionGraphTool': 'Explored connections',
  };

  it('maps known tools to labels', () => {
    expect(getToolLabel('searchNotesTool', TOOL_LABELS)).toBe('Searched notes');
    expect(getToolLabel('getNoteDetailTool', TOOL_LABELS)).toBe('Read note details');
    expect(getToolLabel('listAllNotesTool', TOOL_LABELS)).toBe('Listed all notes');
    expect(getToolLabel('getTagsTool', TOOL_LABELS)).toBe('Analyzed tags');
    expect(getToolLabel('getConnectionGraphTool', TOOL_LABELS)).toBe('Explored connections');
  });

  it('falls back to toolName for unknown tools', () => {
    expect(getToolLabel('myCustomTool', TOOL_LABELS)).toBe('myCustomTool');
  });

  it('falls back for empty string tool', () => {
    expect(getToolLabel('', TOOL_LABELS)).toBe('');
  });
});

// ─── Chat Panel State ───

describe('AgentChat - Panel State', () => {
  it('shows FAB when closed', () => {
    expect(getChatPanelState(false)).toBe('fab');
  });

  it('shows panel when open', () => {
    expect(getChatPanelState(true)).toBe('panel');
  });
});

// ─── Send Button State ───

describe('AgentChat - Send Button', () => {
  it('disabled when loading', () => {
    expect(isSendDisabled(true, 'Hello')).toBe(true);
  });

  it('disabled when input is empty', () => {
    expect(isSendDisabled(false, '')).toBe(true);
  });

  it('disabled when input is whitespace', () => {
    expect(isSendDisabled(false, '   ')).toBe(true);
  });

  it('enabled when not loading and input is valid', () => {
    expect(isSendDisabled(false, 'Hello')).toBe(false);
  });

  it('disabled when loading and input is empty', () => {
    expect(isSendDisabled(true, '')).toBe(true);
  });
});

// ─── Message CSS Classes ───

describe('AgentChat - Message Classes', () => {
  it('applies user class for user messages', () => {
    expect(getMessageClass('user')).toBe('agent-msg agent-msg-user');
  });

  it('applies assistant class for assistant messages', () => {
    expect(getMessageClass('assistant')).toBe('agent-msg agent-msg-assistant');
  });
});

// ─── Welcome Screen ───

describe('AgentChat - Welcome Screen', () => {
  it('shows welcome when no messages', () => {
    expect(shouldShowWelcome(0)).toBe(true);
  });

  it('hides welcome when messages exist', () => {
    expect(shouldShowWelcome(1)).toBe(false);
    expect(shouldShowWelcome(10)).toBe(false);
  });
});

// ─── Loading Indicator ───

describe('AgentChat - Loading Indicator', () => {
  it('shows when loading', () => {
    expect(shouldShowLoading(true)).toBe(true);
  });

  it('hides when not loading', () => {
    expect(shouldShowLoading(false)).toBe(false);
  });
});

// ─── URL Construction ───

describe('AgentChat - URL', () => {
  it('builds chat URL', () => {
    expect(buildChatUrl('http://localhost:6061')).toBe('http://localhost:6061/api/ai/agent/chat');
  });

  it('builds chat URL with custom host', () => {
    expect(buildChatUrl('https://api.syncmind.io')).toBe('https://api.syncmind.io/api/ai/agent/chat');
  });
});

// ─── Error Message Extraction ───

describe('AgentChat - Error Extraction', () => {
  it('extracts message from error object', () => {
    expect(extractErrorMessage({ message: 'Rate limit exceeded' })).toBe('Rate limit exceeded');
  });

  it('returns default message for empty object', () => {
    expect(extractErrorMessage({})).toBe('Request failed');
  });

  it('returns default message for null', () => {
    expect(extractErrorMessage(null)).toBe('Request failed');
  });

  it('returns default message for undefined', () => {
    expect(extractErrorMessage(undefined)).toBe('Request failed');
  });
});
