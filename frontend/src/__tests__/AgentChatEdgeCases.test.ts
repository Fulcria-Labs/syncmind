import { describe, it, expect } from 'vitest';

// ─── Advanced edge cases for AgentChat logic ───

// Message role types
type MessageRole = 'user' | 'assistant';

interface ToolCall {
  toolName: string;
  args?: Record<string, unknown>;
}

interface ChatMessage {
  role: MessageRole;
  content: string;
  toolsUsed?: ToolCall[];
}

// Build request body for chat endpoint
function buildChatRequestBody(
  message: string,
  history: ChatMessage[],
  ownerId: string
) {
  return {
    message,
    history: history.map(m => ({ role: m.role, content: m.content })),
    owner_id: ownerId
  };
}

// Parse API response into assistant message
function parseAssistantResponse(data: any): ChatMessage {
  const toolsUsed: ToolCall[] = (data.toolCalls || []).map((tc: any) => ({
    toolName: tc.toolName || tc.name || 'unknown',
    args: tc.args
  }));
  return {
    role: 'assistant',
    content: data.reply,
    toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined
  };
}

// Parse error response
function parseErrorResponse(errData: any): string {
  return `Error: ${errData?.message || 'Request failed'}`;
}

// Offline error message
function getOfflineErrorMessage(): string {
  return 'Failed to reach the agent. Are you online?';
}

// Scroll behavior should be smooth
function getScrollBehavior(): ScrollBehavior {
  return 'smooth';
}

// Chat panel is open/closed
function isButtonDisabled(loading: boolean, input: string): boolean {
  return loading || !input.trim();
}

// Should show welcome message
function shouldShowWelcome(messageCount: number): boolean {
  return messageCount === 0;
}

// Should show typing indicator
function shouldShowTyping(loading: boolean): boolean {
  return loading;
}

// Message class based on role
function getMessageClass(role: MessageRole): string {
  return `agent-msg agent-msg-${role}`;
}

// Has tools used
function hasToolsUsed(msg: ChatMessage): boolean {
  return msg.role === 'assistant' && !!msg.toolsUsed && msg.toolsUsed.length > 0;
}

// ─── Request Body Building ───

describe('AgentChat - Request Body', () => {
  it('includes message and owner_id', () => {
    const body = buildChatRequestBody('Hello', [], 'user-1');
    expect(body.message).toBe('Hello');
    expect(body.owner_id).toBe('user-1');
  });

  it('strips toolsUsed from history', () => {
    const history: ChatMessage[] = [
      { role: 'user', content: 'Q1' },
      { role: 'assistant', content: 'A1', toolsUsed: [{ toolName: 'search' }] }
    ];
    const body = buildChatRequestBody('Q2', history, 'u1');
    expect(body.history[1]).not.toHaveProperty('toolsUsed');
    expect(body.history[1]).toEqual({ role: 'assistant', content: 'A1' });
  });

  it('handles empty history', () => {
    const body = buildChatRequestBody('First', [], 'u1');
    expect(body.history).toEqual([]);
  });

  it('preserves message with special characters', () => {
    const body = buildChatRequestBody('What about "AI"?', [], 'u1');
    expect(body.message).toBe('What about "AI"?');
  });

  it('preserves message with newlines', () => {
    const body = buildChatRequestBody('Line 1\nLine 2', [], 'u1');
    expect(body.message).toContain('\n');
  });
});

// ─── Response Parsing ───

describe('AgentChat - Response Parsing', () => {
  it('parses simple response without tools', () => {
    const msg = parseAssistantResponse({ reply: 'Hello there!' });
    expect(msg.role).toBe('assistant');
    expect(msg.content).toBe('Hello there!');
    expect(msg.toolsUsed).toBeUndefined();
  });

  it('parses response with tool calls', () => {
    const msg = parseAssistantResponse({
      reply: 'Found results',
      toolCalls: [
        { toolName: 'searchNotesTool', args: { query: 'AI' } }
      ]
    });
    expect(msg.toolsUsed).toBeDefined();
    expect(msg.toolsUsed!.length).toBe(1);
    expect(msg.toolsUsed![0].toolName).toBe('searchNotesTool');
  });

  it('parses response with name instead of toolName', () => {
    const msg = parseAssistantResponse({
      reply: 'OK',
      toolCalls: [{ name: 'getTagsTool', args: {} }]
    });
    expect(msg.toolsUsed![0].toolName).toBe('getTagsTool');
  });

  it('falls back to "unknown" for missing tool name', () => {
    const msg = parseAssistantResponse({
      reply: 'OK',
      toolCalls: [{ args: { test: true } }]
    });
    expect(msg.toolsUsed![0].toolName).toBe('unknown');
  });

  it('sets toolsUsed to undefined for empty tool calls', () => {
    const msg = parseAssistantResponse({ reply: 'No tools', toolCalls: [] });
    expect(msg.toolsUsed).toBeUndefined();
  });

  it('handles missing toolCalls field', () => {
    const msg = parseAssistantResponse({ reply: 'Simple' });
    expect(msg.toolsUsed).toBeUndefined();
  });

  it('preserves tool args', () => {
    const msg = parseAssistantResponse({
      reply: 'R',
      toolCalls: [{ toolName: 'search', args: { query: 'test', limit: 5 } }]
    });
    expect(msg.toolsUsed![0].args).toEqual({ query: 'test', limit: 5 });
  });

  it('handles multiple tool calls', () => {
    const msg = parseAssistantResponse({
      reply: 'R',
      toolCalls: [
        { toolName: 'search', args: {} },
        { toolName: 'detail', args: {} },
        { toolName: 'tags', args: {} }
      ]
    });
    expect(msg.toolsUsed!.length).toBe(3);
  });
});

// ─── Error Handling ───

describe('AgentChat - Error Response Parsing', () => {
  it('extracts error message', () => {
    expect(parseErrorResponse({ message: 'Rate limited' })).toBe('Error: Rate limited');
  });

  it('uses fallback for null errData', () => {
    expect(parseErrorResponse(null)).toBe('Error: Request failed');
  });

  it('uses fallback for undefined message', () => {
    expect(parseErrorResponse({})).toBe('Error: Request failed');
  });

  it('uses fallback for undefined errData', () => {
    expect(parseErrorResponse(undefined)).toBe('Error: Request failed');
  });

  it('preserves complex error messages', () => {
    expect(parseErrorResponse({ message: 'Server error: database connection failed' }))
      .toBe('Error: Server error: database connection failed');
  });
});

// ─── Offline Error ───

describe('AgentChat - Offline Error', () => {
  it('returns standard offline message', () => {
    expect(getOfflineErrorMessage()).toBe('Failed to reach the agent. Are you online?');
  });

  it('mentions online status', () => {
    expect(getOfflineErrorMessage()).toContain('online');
  });
});

// ─── Button State ───

describe('AgentChat - Send Button State', () => {
  it('disabled when loading', () => {
    expect(isButtonDisabled(true, 'message')).toBe(true);
  });

  it('disabled when input empty', () => {
    expect(isButtonDisabled(false, '')).toBe(true);
  });

  it('disabled when input is whitespace', () => {
    expect(isButtonDisabled(false, '  \n\t  ')).toBe(true);
  });

  it('enabled with valid input and not loading', () => {
    expect(isButtonDisabled(false, 'Question')).toBe(false);
  });
});

// ─── Welcome Message ───

describe('AgentChat - Welcome Message', () => {
  it('shows when no messages', () => {
    expect(shouldShowWelcome(0)).toBe(true);
  });

  it('hides when messages exist', () => {
    expect(shouldShowWelcome(1)).toBe(false);
    expect(shouldShowWelcome(10)).toBe(false);
  });
});

// ─── Typing Indicator ───

describe('AgentChat - Typing Indicator', () => {
  it('shows when loading', () => {
    expect(shouldShowTyping(true)).toBe(true);
  });

  it('hides when not loading', () => {
    expect(shouldShowTyping(false)).toBe(false);
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

// ─── Tools Used Detection ───

describe('AgentChat - Tools Used Detection', () => {
  it('detects tools in assistant message', () => {
    const msg: ChatMessage = {
      role: 'assistant',
      content: 'Result',
      toolsUsed: [{ toolName: 'search' }]
    };
    expect(hasToolsUsed(msg)).toBe(true);
  });

  it('returns false for user messages', () => {
    const msg: ChatMessage = {
      role: 'user',
      content: 'Question',
      toolsUsed: [{ toolName: 'search' }] // should never happen but test defensively
    };
    expect(hasToolsUsed(msg)).toBe(false);
  });

  it('returns false for assistant without tools', () => {
    const msg: ChatMessage = { role: 'assistant', content: 'Simple reply' };
    expect(hasToolsUsed(msg)).toBe(false);
  });

  it('returns false for empty tools array', () => {
    const msg: ChatMessage = { role: 'assistant', content: 'R', toolsUsed: [] };
    expect(hasToolsUsed(msg)).toBe(false);
  });
});

// ─── Scroll Behavior ───

describe('AgentChat - Scroll Behavior', () => {
  it('uses smooth scrolling', () => {
    expect(getScrollBehavior()).toBe('smooth');
  });
});
