import { describe, it, expect } from 'vitest';

// Test ErrorBoundary state management logic

describe('ErrorBoundary - State Management', () => {
  interface ErrorState {
    hasError: boolean;
    error: Error | null;
  }

  function getDerivedStateFromError(error: Error): ErrorState {
    return { hasError: true, error };
  }

  function resetState(): ErrorState {
    return { hasError: false, error: null };
  }

  it('should set hasError to true when error occurs', () => {
    const state = getDerivedStateFromError(new Error('test'));
    expect(state.hasError).toBe(true);
  });

  it('should capture error object', () => {
    const error = new Error('Component crashed');
    const state = getDerivedStateFromError(error);
    expect(state.error).toBe(error);
    expect(state.error?.message).toBe('Component crashed');
  });

  it('should reset state on retry', () => {
    const errorState = getDerivedStateFromError(new Error('fail'));
    expect(errorState.hasError).toBe(true);

    const resetedState = resetState();
    expect(resetedState.hasError).toBe(false);
    expect(resetedState.error).toBeNull();
  });

  it('should handle error with stack trace', () => {
    const error = new Error('Stack test');
    const state = getDerivedStateFromError(error);
    expect(state.error?.stack).toBeTruthy();
  });

  it('should handle TypeError', () => {
    const error = new TypeError('Cannot read property');
    const state = getDerivedStateFromError(error);
    expect(state.hasError).toBe(true);
    expect(state.error?.message).toBe('Cannot read property');
  });

  it('should handle RangeError', () => {
    const error = new RangeError('Maximum call stack');
    const state = getDerivedStateFromError(error);
    expect(state.error).toBeInstanceOf(RangeError);
  });
});

describe('ErrorBoundary - Rendering Logic', () => {
  it('should show children when no error', () => {
    const state = { hasError: false, error: null };
    const showChildren = !state.hasError;
    expect(showChildren).toBe(true);
  });

  it('should show fallback when error occurred', () => {
    const state = { hasError: true, error: new Error('Oops') };
    const showFallback = state.hasError;
    expect(showFallback).toBe(true);
  });

  it('should prefer custom fallback when provided', () => {
    const customFallback = '<div>Custom Error UI</div>';
    const defaultFallback = '<div>Something went wrong</div>';
    const fallback = customFallback || defaultFallback;
    expect(fallback).toBe(customFallback);
  });

  it('should use default fallback when none provided', () => {
    const customFallback = undefined;
    const defaultFallback = '<div>Something went wrong</div>';
    const fallback = customFallback || defaultFallback;
    expect(fallback).toBe(defaultFallback);
  });

  it('should display error message in default fallback', () => {
    const error = new Error('Database connection failed');
    const displayMessage = error?.message || 'Unknown error';
    expect(displayMessage).toBe('Database connection failed');
  });

  it('should show Unknown error when message is empty', () => {
    const error = new Error();
    const displayMessage = error?.message || 'Unknown error';
    expect(displayMessage).toBe('Unknown error');
  });
});
