import { describe, it, expect } from 'vitest';

// ─── Advanced ErrorBoundary logic tests ───

// Error type classification
function classifyError(error: Error): 'type' | 'range' | 'reference' | 'syntax' | 'network' | 'generic' {
  if (error instanceof TypeError) return 'type';
  if (error instanceof RangeError) return 'range';
  if (error instanceof ReferenceError) return 'reference';
  if (error instanceof SyntaxError) return 'syntax';
  if (error.message.toLowerCase().includes('network') || error.message.toLowerCase().includes('fetch')) return 'network';
  return 'generic';
}

// Error display message
function getDisplayMessage(error: Error | null): string {
  if (!error) return 'An unknown error occurred';
  return error.message || 'An unknown error occurred';
}

// Error recovery strategy
function getRecoveryStrategy(error: Error): 'reload' | 'retry' | 'navigate' {
  if (error.message.includes('chunk') || error.message.includes('module')) return 'reload';
  if (error.message.includes('network') || error.message.includes('timeout')) return 'retry';
  return 'navigate';
}

// Stack trace extraction
function getStackSummary(error: Error): string {
  if (!error.stack) return 'No stack trace available';
  const lines = error.stack.split('\n').slice(0, 3);
  return lines.join('\n');
}

// Error boundary state transitions
interface ErrorState {
  hasError: boolean;
  error: Error | null;
  recoveryAttempts: number;
}

function initialState(): ErrorState {
  return { hasError: false, error: null, recoveryAttempts: 0 };
}

function errorOccurred(state: ErrorState, error: Error): ErrorState {
  return { hasError: true, error, recoveryAttempts: state.recoveryAttempts };
}

function attemptRecovery(state: ErrorState): ErrorState {
  return { hasError: false, error: null, recoveryAttempts: state.recoveryAttempts + 1 };
}

function canRetry(state: ErrorState, maxRetries: number): boolean {
  return state.recoveryAttempts < maxRetries;
}

// ─── Error Classification ───

describe('ErrorBoundary - Error Classification', () => {
  it('classifies TypeError', () => {
    expect(classifyError(new TypeError('Cannot read property'))).toBe('type');
  });

  it('classifies RangeError', () => {
    expect(classifyError(new RangeError('Maximum call stack'))).toBe('range');
  });

  it('classifies ReferenceError', () => {
    expect(classifyError(new ReferenceError('x is not defined'))).toBe('reference');
  });

  it('classifies SyntaxError', () => {
    expect(classifyError(new SyntaxError('Unexpected token'))).toBe('syntax');
  });

  it('classifies network errors', () => {
    expect(classifyError(new Error('Network request failed'))).toBe('network');
    expect(classifyError(new Error('Failed to fetch'))).toBe('network');
  });

  it('classifies generic errors', () => {
    expect(classifyError(new Error('Something went wrong'))).toBe('generic');
  });
});

// ─── Display Message ───

describe('ErrorBoundary - Display Message', () => {
  it('shows error message when available', () => {
    expect(getDisplayMessage(new Error('Custom error'))).toBe('Custom error');
  });

  it('shows fallback for null error', () => {
    expect(getDisplayMessage(null)).toBe('An unknown error occurred');
  });

  it('shows fallback for empty message', () => {
    expect(getDisplayMessage(new Error())).toBe('An unknown error occurred');
  });

  it('shows fallback for empty string message', () => {
    expect(getDisplayMessage(new Error(''))).toBe('An unknown error occurred');
  });
});

// ─── Recovery Strategy ───

describe('ErrorBoundary - Recovery Strategy', () => {
  it('suggests reload for chunk errors', () => {
    expect(getRecoveryStrategy(new Error('Loading chunk failed'))).toBe('reload');
  });

  it('suggests reload for module errors', () => {
    expect(getRecoveryStrategy(new Error('Cannot find module'))).toBe('reload');
  });

  it('suggests retry for network errors', () => {
    expect(getRecoveryStrategy(new Error('network error'))).toBe('retry');
  });

  it('suggests retry for timeout errors', () => {
    expect(getRecoveryStrategy(new Error('request timeout'))).toBe('retry');
  });

  it('suggests navigate for generic errors', () => {
    expect(getRecoveryStrategy(new Error('Something went wrong'))).toBe('navigate');
  });
});

// ─── Stack Trace ───

describe('ErrorBoundary - Stack Trace', () => {
  it('extracts first 3 lines of stack', () => {
    const error = new Error('Test error');
    const summary = getStackSummary(error);
    const lines = summary.split('\n');
    expect(lines.length).toBeLessThanOrEqual(3);
  });

  it('handles error without stack', () => {
    const error = new Error('No stack');
    error.stack = undefined;
    expect(getStackSummary(error)).toBe('No stack trace available');
  });

  it('handles empty stack', () => {
    const error = new Error('Empty stack');
    error.stack = '';
    expect(getStackSummary(error)).toBe('No stack trace available');
  });
});

// ─── State Transitions ───

describe('ErrorBoundary - State Transitions', () => {
  it('starts with clean state', () => {
    const state = initialState();
    expect(state.hasError).toBe(false);
    expect(state.error).toBeNull();
    expect(state.recoveryAttempts).toBe(0);
  });

  it('transitions to error state', () => {
    const state = errorOccurred(initialState(), new Error('Crash'));
    expect(state.hasError).toBe(true);
    expect(state.error?.message).toBe('Crash');
  });

  it('preserves recovery attempts on new error', () => {
    let state = initialState();
    state = errorOccurred(state, new Error('First'));
    state = attemptRecovery(state);
    state = errorOccurred(state, new Error('Second'));
    expect(state.recoveryAttempts).toBe(1); // From first recovery
  });

  it('increments recovery count', () => {
    let state = initialState();
    state = errorOccurred(state, new Error('Error'));
    state = attemptRecovery(state);
    expect(state.recoveryAttempts).toBe(1);
    state = errorOccurred(state, new Error('Error again'));
    state = attemptRecovery(state);
    expect(state.recoveryAttempts).toBe(2);
  });

  it('resets error on recovery', () => {
    let state = errorOccurred(initialState(), new Error('Crash'));
    state = attemptRecovery(state);
    expect(state.hasError).toBe(false);
    expect(state.error).toBeNull();
  });
});

// ─── Retry Limits ───

describe('ErrorBoundary - Retry Limits', () => {
  it('allows retry when under limit', () => {
    const state: ErrorState = { hasError: true, error: new Error(''), recoveryAttempts: 0 };
    expect(canRetry(state, 3)).toBe(true);
  });

  it('allows retry at limit - 1', () => {
    const state: ErrorState = { hasError: true, error: new Error(''), recoveryAttempts: 2 };
    expect(canRetry(state, 3)).toBe(true);
  });

  it('denies retry at limit', () => {
    const state: ErrorState = { hasError: true, error: new Error(''), recoveryAttempts: 3 };
    expect(canRetry(state, 3)).toBe(false);
  });

  it('denies retry over limit', () => {
    const state: ErrorState = { hasError: true, error: new Error(''), recoveryAttempts: 5 };
    expect(canRetry(state, 3)).toBe(false);
  });

  it('handles zero max retries', () => {
    const state: ErrorState = { hasError: true, error: new Error(''), recoveryAttempts: 0 };
    expect(canRetry(state, 0)).toBe(false);
  });
});
