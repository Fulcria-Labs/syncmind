import { describe, it, expect } from 'vitest';

// ─── Extract and test pure logic from App.tsx ───

// SyncStatus display logic
function getSyncStatusText(connected: boolean, uploading: boolean): string {
  let text = connected ? 'Synced' : 'Offline';
  if (uploading) text += ' (syncing...)';
  return text;
}

function getSyncStatusClass(connected: boolean): string {
  return `sync-status ${connected ? 'online' : 'offline'}`;
}

function shouldShowQueueBadge(connected: boolean, uploading: boolean): boolean {
  return !connected && uploading;
}

// OfflineBanner display logic
function shouldShowOfflineBanner(connected: boolean): boolean {
  return !connected;
}

// Note count display
function formatNoteCount(count: number): string {
  if (count === 0) return '';
  return `${count} note${count !== 1 ? 's' : ''}`;
}

// AI status badge
function getAiStatusBadgeText(aiStatus: { provider: string; local: boolean; model: string } | null): string | null {
  if (!aiStatus) return null;
  return aiStatus.local ? 'Local AI' : aiStatus.provider;
}

function getAiStatusBadgeClass(aiStatus: { local: boolean }): string {
  return `ai-provider-badge ${aiStatus.local ? 'local' : 'cloud'}`;
}

// View mode toggle
function toggleViewMode(current: 'list' | 'graph'): 'list' | 'graph' {
  return current === 'list' ? 'graph' : 'list';
}

// Keyboard shortcut handling
function handleKeyboardAction(
  e: { key: string; metaKey: boolean; ctrlKey: boolean },
  targetTag: string,
  state: { showEditor: boolean; showAsk: boolean; briefContent: string; selectedNote: string | null }
): string | null {
  // Don't capture when typing in inputs (except Escape)
  if (targetTag === 'INPUT' || targetTag === 'TEXTAREA') {
    if (e.key === 'Escape') return 'blur';
    return null;
  }

  if ((e.metaKey || e.ctrlKey) && e.key === 'n') return 'newNote';
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') return 'focusSearch';
  if (e.key === 'Escape') {
    if (state.showEditor) return 'closeEditor';
    if (state.showAsk) return 'closeAsk';
    if (state.briefContent) return 'closeBrief';
    if (state.selectedNote) return 'deselectNote';
    return null;
  }
  if (e.key === 'g' && !e.metaKey && !e.ctrlKey) return 'toggleGraph';
  return null;
}

// Research brief button visibility
function shouldShowBriefButton(count: number): boolean {
  return count >= 2;
}

// Empty state display logic
function getEmptyStateTitle(count: number): string {
  return count === 0 ? 'Start Your Research' : 'Select a Note';
}

function getEmptyStateDescription(count: number): string {
  return count === 0
    ? 'Create your first note or load demo data to explore'
    : 'Choose a note from the sidebar to view details';
}

function shouldShowSeedButton(count: number, seedDone: boolean): boolean {
  return count === 0 && !seedDone;
}

// Brief error handling
function getBriefContent(data: { brief?: string } | null, error: boolean): string {
  if (error) return 'Failed to generate brief. Are you online?';
  if (!data) return '';
  return data.brief || 'Could not generate brief.';
}

// ─── SyncStatus Display ───

describe('App - SyncStatus Display', () => {
  it('shows "Synced" when connected', () => {
    expect(getSyncStatusText(true, false)).toBe('Synced');
  });

  it('shows "Offline" when disconnected', () => {
    expect(getSyncStatusText(false, false)).toBe('Offline');
  });

  it('shows syncing indicator when uploading', () => {
    expect(getSyncStatusText(true, true)).toBe('Synced (syncing...)');
  });

  it('shows offline with syncing when disconnected but uploading', () => {
    expect(getSyncStatusText(false, true)).toBe('Offline (syncing...)');
  });

  it('applies online class when connected', () => {
    expect(getSyncStatusClass(true)).toBe('sync-status online');
  });

  it('applies offline class when disconnected', () => {
    expect(getSyncStatusClass(false)).toBe('sync-status offline');
  });

  it('shows queue badge when offline and uploading', () => {
    expect(shouldShowQueueBadge(false, true)).toBe(true);
  });

  it('hides queue badge when online', () => {
    expect(shouldShowQueueBadge(true, true)).toBe(false);
  });

  it('hides queue badge when not uploading', () => {
    expect(shouldShowQueueBadge(false, false)).toBe(false);
  });
});

// ─── OfflineBanner ───

describe('App - OfflineBanner', () => {
  it('shows banner when offline', () => {
    expect(shouldShowOfflineBanner(false)).toBe(true);
  });

  it('hides banner when online', () => {
    expect(shouldShowOfflineBanner(true)).toBe(false);
  });
});

// ─── Note Count Display ───

describe('App - Note Count Display', () => {
  it('returns empty string for zero notes', () => {
    expect(formatNoteCount(0)).toBe('');
  });

  it('returns singular for one note', () => {
    expect(formatNoteCount(1)).toBe('1 note');
  });

  it('returns plural for multiple notes', () => {
    expect(formatNoteCount(5)).toBe('5 notes');
  });

  it('returns plural for two notes', () => {
    expect(formatNoteCount(2)).toBe('2 notes');
  });

  it('handles large counts', () => {
    expect(formatNoteCount(1000)).toBe('1000 notes');
  });
});

// ─── AI Status Badge ───

describe('App - AI Status Badge', () => {
  it('returns null when no AI status', () => {
    expect(getAiStatusBadgeText(null)).toBeNull();
  });

  it('shows "Local AI" when local provider', () => {
    expect(getAiStatusBadgeText({ provider: 'ollama', local: true, model: 'llama3' })).toBe('Local AI');
  });

  it('shows provider name when cloud provider', () => {
    expect(getAiStatusBadgeText({ provider: 'OpenAI', local: false, model: 'gpt-4' })).toBe('OpenAI');
  });

  it('applies local class for local AI', () => {
    expect(getAiStatusBadgeClass({ local: true })).toBe('ai-provider-badge local');
  });

  it('applies cloud class for cloud AI', () => {
    expect(getAiStatusBadgeClass({ local: false })).toBe('ai-provider-badge cloud');
  });
});

// ─── View Mode Toggle ───

describe('App - View Mode Toggle', () => {
  it('toggles from list to graph', () => {
    expect(toggleViewMode('list')).toBe('graph');
  });

  it('toggles from graph to list', () => {
    expect(toggleViewMode('graph')).toBe('list');
  });

  it('round-trips correctly', () => {
    const first = toggleViewMode('list');
    const second = toggleViewMode(first);
    expect(second).toBe('list');
  });
});

// ─── Keyboard Shortcuts ───

describe('App - Keyboard Shortcuts', () => {
  const defaultState = { showEditor: false, showAsk: false, briefContent: '', selectedNote: null };

  it('Ctrl+N opens new note', () => {
    expect(handleKeyboardAction({ key: 'n', metaKey: false, ctrlKey: true }, 'DIV', defaultState)).toBe('newNote');
  });

  it('Meta+N opens new note', () => {
    expect(handleKeyboardAction({ key: 'n', metaKey: true, ctrlKey: false }, 'DIV', defaultState)).toBe('newNote');
  });

  it('Ctrl+K focuses search', () => {
    expect(handleKeyboardAction({ key: 'k', metaKey: false, ctrlKey: true }, 'DIV', defaultState)).toBe('focusSearch');
  });

  it('Meta+K focuses search', () => {
    expect(handleKeyboardAction({ key: 'k', metaKey: true, ctrlKey: false }, 'DIV', defaultState)).toBe('focusSearch');
  });

  it('G toggles graph view', () => {
    expect(handleKeyboardAction({ key: 'g', metaKey: false, ctrlKey: false }, 'DIV', defaultState)).toBe('toggleGraph');
  });

  it('does not toggle graph with Ctrl+G', () => {
    expect(handleKeyboardAction({ key: 'g', metaKey: false, ctrlKey: true }, 'DIV', defaultState)).toBeNull();
  });

  it('does not toggle graph with Meta+G', () => {
    expect(handleKeyboardAction({ key: 'g', metaKey: true, ctrlKey: false }, 'DIV', defaultState)).toBeNull();
  });

  it('Escape closes editor first', () => {
    const state = { ...defaultState, showEditor: true, showAsk: true, briefContent: 'content', selectedNote: 'n1' };
    expect(handleKeyboardAction({ key: 'Escape', metaKey: false, ctrlKey: false }, 'DIV', state)).toBe('closeEditor');
  });

  it('Escape closes AskAI when editor is closed', () => {
    const state = { ...defaultState, showAsk: true, briefContent: 'content', selectedNote: 'n1' };
    expect(handleKeyboardAction({ key: 'Escape', metaKey: false, ctrlKey: false }, 'DIV', state)).toBe('closeAsk');
  });

  it('Escape closes brief when ask and editor are closed', () => {
    const state = { ...defaultState, briefContent: 'some brief', selectedNote: 'n1' };
    expect(handleKeyboardAction({ key: 'Escape', metaKey: false, ctrlKey: false }, 'DIV', state)).toBe('closeBrief');
  });

  it('Escape deselects note when nothing else is open', () => {
    const state = { ...defaultState, selectedNote: 'n1' };
    expect(handleKeyboardAction({ key: 'Escape', metaKey: false, ctrlKey: false }, 'DIV', state)).toBe('deselectNote');
  });

  it('Escape does nothing when nothing is open', () => {
    expect(handleKeyboardAction({ key: 'Escape', metaKey: false, ctrlKey: false }, 'DIV', defaultState)).toBeNull();
  });

  it('ignores keyboard shortcuts when typing in INPUT', () => {
    expect(handleKeyboardAction({ key: 'n', metaKey: false, ctrlKey: true }, 'INPUT', defaultState)).toBeNull();
  });

  it('ignores keyboard shortcuts when typing in TEXTAREA', () => {
    expect(handleKeyboardAction({ key: 'g', metaKey: false, ctrlKey: false }, 'TEXTAREA', defaultState)).toBeNull();
  });

  it('allows Escape from INPUT to blur', () => {
    expect(handleKeyboardAction({ key: 'Escape', metaKey: false, ctrlKey: false }, 'INPUT', defaultState)).toBe('blur');
  });

  it('allows Escape from TEXTAREA to blur', () => {
    expect(handleKeyboardAction({ key: 'Escape', metaKey: false, ctrlKey: false }, 'TEXTAREA', defaultState)).toBe('blur');
  });

  it('ignores unrecognized keys', () => {
    expect(handleKeyboardAction({ key: 'a', metaKey: false, ctrlKey: false }, 'DIV', defaultState)).toBeNull();
  });

  it('ignores Ctrl+unrecognized keys', () => {
    expect(handleKeyboardAction({ key: 'z', metaKey: false, ctrlKey: true }, 'DIV', defaultState)).toBeNull();
  });
});

// ─── Research Brief ───

describe('App - Research Brief', () => {
  it('shows brief button only with 2+ notes', () => {
    expect(shouldShowBriefButton(0)).toBe(false);
    expect(shouldShowBriefButton(1)).toBe(false);
    expect(shouldShowBriefButton(2)).toBe(true);
    expect(shouldShowBriefButton(100)).toBe(true);
  });

  it('shows error message on failure', () => {
    expect(getBriefContent(null, true)).toBe('Failed to generate brief. Are you online?');
  });

  it('shows brief content when available', () => {
    expect(getBriefContent({ brief: 'Your research covers AI.' }, false)).toBe('Your research covers AI.');
  });

  it('shows fallback when brief field is empty', () => {
    expect(getBriefContent({ brief: '' }, false)).toBe('Could not generate brief.');
  });

  it('shows fallback when brief field is undefined', () => {
    expect(getBriefContent({}, false)).toBe('Could not generate brief.');
  });

  it('returns empty when no data and no error', () => {
    expect(getBriefContent(null, false)).toBe('');
  });
});

// ─── Empty State ───

describe('App - Empty State', () => {
  it('shows "Start Your Research" when no notes', () => {
    expect(getEmptyStateTitle(0)).toBe('Start Your Research');
  });

  it('shows "Select a Note" when notes exist', () => {
    expect(getEmptyStateTitle(5)).toBe('Select a Note');
  });

  it('shows correct description for no notes', () => {
    expect(getEmptyStateDescription(0)).toContain('Create your first note');
  });

  it('shows correct description when notes exist', () => {
    expect(getEmptyStateDescription(5)).toContain('Choose a note');
  });

  it('shows seed button when no notes and not seeded', () => {
    expect(shouldShowSeedButton(0, false)).toBe(true);
  });

  it('hides seed button when notes exist', () => {
    expect(shouldShowSeedButton(5, false)).toBe(false);
  });

  it('hides seed button when already seeded', () => {
    expect(shouldShowSeedButton(0, true)).toBe(false);
  });
});
