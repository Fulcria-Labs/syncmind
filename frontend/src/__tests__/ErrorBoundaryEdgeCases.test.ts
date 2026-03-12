import { describe, it, expect } from 'vitest';

// ─── Advanced ErrorBoundary logic tests ───

// Error state management
interface ErrorState {
  hasError: boolean;
  error: Error | null;
}

function getDerivedStateFromError(error: Error): ErrorState {
  return { hasError: true, error };
}

function resetErrorState(): ErrorState {
  return { hasError: false, error: null };
}

// Should show fallback
function shouldShowFallback(state: ErrorState, hasFallbackProp: boolean): 'fallback' | 'default' | 'children' {
  if (!state.hasError) return 'children';
  if (hasFallbackProp) return 'fallback';
  return 'default';
}

// Error message extraction
function extractErrorMessage(error: Error | null): string {
  return error?.message || '';
}

// Default error UI content
function getDefaultErrorTitle(): string {
  return 'Something went wrong';
}

function getRetryButtonText(): string {
  return 'Try Again';
}

// ─── Error State Derivation ───

describe('ErrorBoundary - State from Error', () => {
  it('sets hasError to true', () => {
    const state = getDerivedStateFromError(new Error('Test error'));
    expect(state.hasError).toBe(true);
  });

  it('captures the error object', () => {
    const error = new Error('Network failure');
    const state = getDerivedStateFromError(error);
    expect(state.error).toBe(error);
    expect(state.error?.message).toBe('Network failure');
  });

  it('handles error with empty message', () => {
    const state = getDerivedStateFromError(new Error(''));
    expect(state.hasError).toBe(true);
    expect(state.error?.message).toBe('');
  });

  it('handles TypeError', () => {
    const state = getDerivedStateFromError(new TypeError('Cannot read undefined'));
    expect(state.hasError).toBe(true);
    expect(state.error).toBeInstanceOf(TypeError);
  });

  it('handles RangeError', () => {
    const state = getDerivedStateFromError(new RangeError('Maximum call stack'));
    expect(state.hasError).toBe(true);
    expect(state.error).toBeInstanceOf(RangeError);
  });

  it('handles SyntaxError', () => {
    const state = getDerivedStateFromError(new SyntaxError('Unexpected token'));
    expect(state.error).toBeInstanceOf(SyntaxError);
  });
});

// ─── State Reset ───

describe('ErrorBoundary - State Reset', () => {
  it('clears error', () => {
    const state = resetErrorState();
    expect(state.hasError).toBe(false);
    expect(state.error).toBeNull();
  });

  it('can be called multiple times', () => {
    const state1 = resetErrorState();
    const state2 = resetErrorState();
    expect(state1).toEqual(state2);
  });
});

// ─── Render Decision ───

describe('ErrorBoundary - Render Decision', () => {
  it('shows children when no error', () => {
    expect(shouldShowFallback({ hasError: false, error: null }, false)).toBe('children');
  });

  it('shows custom fallback when error and fallback prop exists', () => {
    expect(shouldShowFallback({ hasError: true, error: new Error('err') }, true)).toBe('fallback');
  });

  it('shows default error UI when error and no fallback prop', () => {
    expect(shouldShowFallback({ hasError: true, error: new Error('err') }, false)).toBe('default');
  });

  it('shows children even when fallback is provided but no error', () => {
    expect(shouldShowFallback({ hasError: false, error: null }, true)).toBe('children');
  });
});

// ─── Error Message Extraction ───

describe('ErrorBoundary - Error Message', () => {
  it('extracts message from error', () => {
    expect(extractErrorMessage(new Error('Component crashed'))).toBe('Component crashed');
  });

  it('returns empty string for null error', () => {
    expect(extractErrorMessage(null)).toBe('');
  });

  it('returns empty string for error without message', () => {
    expect(extractErrorMessage(new Error())).toBe('');
  });

  it('handles long error messages', () => {
    const longMsg = 'Error '.repeat(100);
    expect(extractErrorMessage(new Error(longMsg))).toBe(longMsg);
  });

  it('handles error messages with special characters', () => {
    expect(extractErrorMessage(new Error('<script>alert("xss")</script>'))).toContain('<script>');
  });
});

// ─── Default UI Content ───

describe('ErrorBoundary - Default UI', () => {
  it('has correct title', () => {
    expect(getDefaultErrorTitle()).toBe('Something went wrong');
  });

  it('has retry button text', () => {
    expect(getRetryButtonText()).toBe('Try Again');
  });
});
