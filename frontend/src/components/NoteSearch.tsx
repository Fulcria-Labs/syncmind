import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQuery } from '@powersync/react';
import type { NoteRecord } from '../lib/AppSchema';

type FilterMode = 'all' | 'processed' | 'unprocessed';

interface NoteSearchResult extends NoteRecord {
  id: string;
}

interface SnippetSegment {
  text: string;
  highlighted: boolean;
}

interface NoteSearchProps {
  onSelectNote?: (noteId: string) => void;
  onClose?: () => void;
}

/**
 * NoteSearch — offline-first full-text search powered entirely by PowerSync's
 * local SQLite replica. Every query runs against the device-local database,
 * so the component works without any network connection. When connectivity
 * returns, PowerSync syncs the underlying data transparently.
 *
 * Key PowerSync integration points:
 * - useQuery() for reactive SQL against local SQLite
 * - LIKE-based multi-column search (title, content, ai_summary, ai_tags)
 * - Separate count query for "search stats" display
 * - Filter by is_processed status (integer column, 0/1)
 */
export function NoteSearch({ onSelectNote, onClose }: NoteSearchProps) {
  const [rawInput, setRawInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounce: 250ms after the user stops typing
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(rawInput.trim());
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [rawInput]);

  // Build the SQL query and params from the current search + filter state.
  // All queries run against PowerSync's local SQLite — fully offline-capable.
  const { sql, params } = useMemo(
    () => buildSearchQuery(debouncedQuery, filterMode),
    [debouncedQuery, filterMode]
  );

  // Reactive query: re-runs whenever sql/params change or local data changes via sync
  const { data: results } = useQuery<NoteSearchResult>(sql, params);

  // Total notes count — always queries the full table so the stats bar can
  // show "searched N notes" even when the filter returns fewer results.
  const { data: totalData } = useQuery<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM notes'
  );
  const totalNotes = totalData?.[0]?.cnt ?? 0;

  // Counts by processing status for the filter badges
  const { data: processedData } = useQuery<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM notes WHERE is_processed = 1'
  );
  const processedCount = processedData?.[0]?.cnt ?? 0;
  const unprocessedCount = totalNotes - processedCount;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (rawInput) {
          setRawInput('');
          setDebouncedQuery('');
        } else {
          onClose?.();
        }
      }
    },
    [rawInput, onClose]
  );

  return (
    <div className="note-search">
      <div className="note-search-header">
        <h3>Search Notes</h3>
        <span className="note-search-offline-badge">
          Powered by local SQLite via PowerSync
        </span>
        {onClose && (
          <button className="btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        )}
      </div>

      <div className="note-search-input-row">
        <input
          ref={inputRef}
          type="search"
          className="note-search-input"
          placeholder="Search titles, content, AI summaries, tags..."
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>

      <div className="note-search-filters">
        <button
          className={`filter-chip ${filterMode === 'all' ? 'active' : ''}`}
          onClick={() => setFilterMode('all')}
        >
          All ({totalNotes})
        </button>
        <button
          className={`filter-chip ${filterMode === 'processed' ? 'active' : ''}`}
          onClick={() => setFilterMode('processed')}
        >
          Processed ({processedCount})
        </button>
        <button
          className={`filter-chip ${filterMode === 'unprocessed' ? 'active' : ''}`}
          onClick={() => setFilterMode('unprocessed')}
        >
          Unprocessed ({unprocessedCount})
        </button>
      </div>

      <div className="note-search-stats">
        {debouncedQuery ? (
          <span>
            {results.length} result{results.length !== 1 ? 's' : ''} for "<strong>{debouncedQuery}</strong>"
            {' '}(searched {totalNotes} note{totalNotes !== 1 ? 's' : ''})
          </span>
        ) : (
          <span>
            {totalNotes} note{totalNotes !== 1 ? 's' : ''} in local database
            {filterMode !== 'all' && ` (${filterMode} filter active)`}
          </span>
        )}
      </div>

      <div className="note-search-results">
        {results.length === 0 && debouncedQuery && (
          <div className="note-search-empty">
            <p>No notes match "<strong>{debouncedQuery}</strong>"</p>
            <p className="hint">
              Try different keywords. Search checks title, content, AI summary, and AI tags.
            </p>
          </div>
        )}

        {results.length === 0 && !debouncedQuery && filterMode !== 'all' && (
          <div className="note-search-empty">
            <p>No {filterMode} notes found</p>
          </div>
        )}

        {results.map((note) => (
          <div
            key={note.id}
            className={`note-search-result-card ${note.is_processed ? 'processed' : 'pending'}`}
            onClick={() => onSelectNote?.(note.id)}
          >
            <div className="result-title">
              {debouncedQuery
                ? renderHighlightedSegments(highlightSnippet(note.title || '', debouncedQuery))
                : note.title}
            </div>

            <div className="result-snippet">
              {debouncedQuery
                ? renderHighlightedSegments(
                    highlightSnippet(
                      extractBestSnippet(note, debouncedQuery),
                      debouncedQuery
                    )
                  )
                : (note.ai_summary || (note.content || '').slice(0, 150))}
            </div>

            <div className="result-meta">
              {note.ai_tags && (
                <div className="result-tags">
                  {(note.ai_tags || '').split(',').filter(Boolean).slice(0, 4).map((tag) => (
                    <span key={tag.trim()} className="tag">{tag.trim()}</span>
                  ))}
                </div>
              )}
              <span className="result-date">
                {formatDate(note.created_at)}
              </span>
              {!note.is_processed && (
                <span className="badge pending">Analyzing...</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Pure functions — extracted so they can be unit-tested independently
// without needing React or a PowerSync database instance.
// ──────────────────────────────────────────────────────────────────────────

/**
 * Builds a parameterized SQL query that searches across four columns using
 * SQLite LIKE. The query runs entirely inside PowerSync's local replica.
 */
export function buildSearchQuery(
  query: string,
  filterMode: FilterMode
): { sql: string; params: string[] } {
  const conditions: string[] = [];
  const params: string[] = [];

  if (query) {
    const pattern = `%${query}%`;
    conditions.push(
      '(title LIKE ? OR content LIKE ? OR ai_summary LIKE ? OR ai_tags LIKE ?)'
    );
    params.push(pattern, pattern, pattern, pattern);
  }

  if (filterMode === 'processed') {
    conditions.push('is_processed = 1');
  } else if (filterMode === 'unprocessed') {
    conditions.push('is_processed = 0');
  }

  const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT * FROM notes${where} ORDER BY updated_at DESC`;

  return { sql, params };
}

/**
 * Finds the best text snippet from a note to display in search results.
 * Prefers the field that actually contains the search term, with a window
 * of surrounding context.
 */
export function extractBestSnippet(
  note: { title?: string | null; content?: string | null; ai_summary?: string | null; ai_tags?: string | null },
  query: string,
  maxLength: number = 200
): string {
  if (!query) {
    return (note.ai_summary || (note.content || '').slice(0, maxLength));
  }

  const lowerQuery = query.toLowerCase();

  // Priority order for snippet extraction
  const fields: Array<{ text: string; label: string }> = [
    { text: note.ai_summary || '', label: 'ai_summary' },
    { text: note.content || '', label: 'content' },
    { text: note.ai_tags || '', label: 'ai_tags' },
    { text: note.title || '', label: 'title' },
  ];

  for (const field of fields) {
    const idx = field.text.toLowerCase().indexOf(lowerQuery);
    if (idx !== -1) {
      // Extract a window around the match
      const start = Math.max(0, idx - 60);
      const end = Math.min(field.text.length, idx + query.length + 60);
      let snippet = field.text.slice(start, end);
      if (start > 0) snippet = '...' + snippet;
      if (end < field.text.length) snippet = snippet + '...';
      return snippet.slice(0, maxLength);
    }
  }

  // Fallback: return summary or content preview
  return (note.ai_summary || (note.content || '').slice(0, maxLength));
}

/**
 * Creates an array of segments where matching text is marked for highlighting.
 * Case-insensitive matching.
 */
export function highlightSnippet(text: string, query: string): SnippetSegment[] {
  if (!query || !text) return [{ text: text || '', highlighted: false }];

  const segments: SnippetSegment[] = [];
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let lastIndex = 0;

  let searchFrom = 0;
  while (searchFrom < lowerText.length) {
    const idx = lowerText.indexOf(lowerQuery, searchFrom);
    if (idx === -1) break;

    // Non-matching prefix
    if (idx > lastIndex) {
      segments.push({ text: text.slice(lastIndex, idx), highlighted: false });
    }

    // Matching segment (preserve original casing)
    segments.push({ text: text.slice(idx, idx + query.length), highlighted: true });

    lastIndex = idx + query.length;
    searchFrom = lastIndex;
  }

  // Trailing text
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), highlighted: false });
  }

  // Edge case: no matches found (shouldn't happen if used correctly)
  if (segments.length === 0) {
    return [{ text, highlighted: false }];
  }

  return segments;
}

/**
 * Renders SnippetSegments as React elements with <mark> for highlighted parts.
 */
function renderHighlightedSegments(segments: SnippetSegment[]): React.ReactNode[] {
  return segments.map((seg, i) =>
    seg.highlighted
      ? <mark key={i} className="search-highlight">{seg.text}</mark>
      : <span key={i}>{seg.text}</span>
  );
}

/**
 * Formats a date string for display; returns empty string for invalid inputs.
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return '';
  }
}

/**
 * Counts how many of the four searchable columns contain the query term.
 * Useful for relevance ranking in future iterations.
 */
export function countFieldMatches(
  note: { title?: string | null; content?: string | null; ai_summary?: string | null; ai_tags?: string | null },
  query: string
): number {
  if (!query) return 0;
  const lowerQuery = query.toLowerCase();
  let count = 0;
  if ((note.title || '').toLowerCase().includes(lowerQuery)) count++;
  if ((note.content || '').toLowerCase().includes(lowerQuery)) count++;
  if ((note.ai_summary || '').toLowerCase().includes(lowerQuery)) count++;
  if ((note.ai_tags || '').toLowerCase().includes(lowerQuery)) count++;
  return count;
}

/**
 * Generates a relevance score (0-100) based on how many fields match and
 * whether the title matches (title matches are weighted higher).
 */
export function calculateRelevance(
  note: { title?: string | null; content?: string | null; ai_summary?: string | null; ai_tags?: string | null },
  query: string
): number {
  if (!query) return 0;
  const lowerQuery = query.toLowerCase();

  let score = 0;
  const titleMatch = (note.title || '').toLowerCase().includes(lowerQuery);
  const contentMatch = (note.content || '').toLowerCase().includes(lowerQuery);
  const summaryMatch = (note.ai_summary || '').toLowerCase().includes(lowerQuery);
  const tagsMatch = (note.ai_tags || '').toLowerCase().includes(lowerQuery);

  // Title matches are most valuable
  if (titleMatch) score += 40;
  if (contentMatch) score += 25;
  if (summaryMatch) score += 20;
  if (tagsMatch) score += 15;

  return score;
}

/**
 * Determines the search stats message to show.
 */
export function getSearchStatsMessage(
  query: string,
  resultCount: number,
  totalNotes: number,
  filterMode: FilterMode
): string {
  if (query) {
    const plural = resultCount !== 1 ? 's' : '';
    const notesPlural = totalNotes !== 1 ? 's' : '';
    return `${resultCount} result${plural} for "${query}" (searched ${totalNotes} note${notesPlural})`;
  }
  const notesPlural = totalNotes !== 1 ? 's' : '';
  let msg = `${totalNotes} note${notesPlural} in local database`;
  if (filterMode !== 'all') {
    msg += ` (${filterMode} filter active)`;
  }
  return msg;
}

/**
 * Validates whether the search should execute (non-empty after trim).
 */
export function shouldExecuteSearch(query: string): boolean {
  return query.trim().length > 0;
}

/**
 * Splits a multi-word query into individual terms for potential
 * term-level highlighting in advanced mode.
 */
export function splitSearchTerms(query: string): string[] {
  return query.trim().split(/\s+/).filter(t => t.length > 0);
}

/**
 * Determines which filter chip should be active based on filter mode.
 */
export function getActiveFilterChip(filterMode: FilterMode): string {
  switch (filterMode) {
    case 'all': return 'All';
    case 'processed': return 'Processed';
    case 'unprocessed': return 'Unprocessed';
    default: return 'All';
  }
}

/**
 * Computes the empty state message when no results are found.
 */
export function getEmptyStateMessage(
  query: string,
  filterMode: FilterMode
): { title: string; hint: string } {
  if (query) {
    return {
      title: `No notes match "${query}"`,
      hint: 'Try different keywords. Search checks title, content, AI summary, and AI tags.',
    };
  }
  if (filterMode !== 'all') {
    return {
      title: `No ${filterMode} notes found`,
      hint: 'Change the filter to see all notes.',
    };
  }
  return {
    title: 'No notes yet',
    hint: 'Create your first note to get started.',
  };
}
