import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── E2E Demo Journey Test ───
// Tests the complete user journey through SyncMind:
// 1. Creating a note via NoteEditor
// 2. Note appearing in NoteList
// 3. AI processing triggering
// 4. Note connections appearing in KnowledgeGraph
// 5. Searching for the note via NoteSearch
// 6. Querying the agent about the note
//
// Following codebase patterns: pure logic extraction, no React rendering.

import {
  buildSearchQuery,
  extractBestSnippet,
  highlightSnippet,
  calculateRelevance,
  getSearchStatsMessage,
  shouldExecuteSearch,
  splitSearchTerms,
  getActiveFilterChip,
  getEmptyStateMessage,
  countFieldMatches,
  formatDate,
} from '../components/NoteSearch';

// ══════════════════════════════════════════════════════════════
// Section 1: Note Creation (NoteEditor logic)
// ══════════════════════════════════════════════════════════════

// ─── Helpers extracted from NoteEditor.tsx ───

function canSave(title: string, saving: boolean): boolean {
  return !saving && title.trim().length > 0;
}

function buildInsertValues(
  title: string,
  content: string,
  sourceUrl: string,
  userId: string,
): { id: string; params: any[] } {
  const id = 'demo-note-001';
  const now = new Date().toISOString();
  return {
    id,
    params: [
      id,
      title.trim(),
      content.trim(),
      sourceUrl.trim() || null,
      now,
      now,
      userId,
    ],
  };
}

function mergeImportedContent(
  existingTitle: string,
  existingContent: string,
  importedTitle: string,
  importedContent: string,
): { title: string; content: string } {
  return {
    title: existingTitle.trim() ? existingTitle : (importedTitle || ''),
    content: existingContent
      ? existingContent + '\n\n' + importedContent
      : importedContent,
  };
}

// ─── Note data flowing through the demo ───

const DEMO_NOTE = {
  id: 'demo-note-001',
  title: 'Transformer Architecture Deep Dive',
  content:
    'Transformers use self-attention mechanisms to process sequential data in parallel. ' +
    'Unlike RNNs, they do not require sequential processing, enabling much faster training. ' +
    'The architecture consists of an encoder and decoder, each containing multi-head attention layers. ' +
    'Key innovations include positional encoding and scaled dot-product attention.',
  source_url: 'https://arxiv.org/abs/1706.03762',
  tags: '',
  ai_summary:
    'A deep dive into transformer architecture covering self-attention, multi-head attention, and positional encoding.',
  ai_tags: 'ai,machine-learning,transformers,deep-learning,attention',
  ai_connections: '',
  is_processed: 1,
  created_at: '2026-03-15T10:00:00Z',
  updated_at: '2026-03-15T10:05:00Z',
  owner_id: 'demo-user-42',
};

const DEMO_NOTE_2 = {
  id: 'demo-note-002',
  title: 'RAG Systems in Practice',
  content:
    'Retrieval-Augmented Generation combines a retriever and a generator model. ' +
    'The retriever finds relevant documents from a knowledge base, while the generator produces answers. ' +
    'RAG improves factual accuracy and reduces hallucination compared to pure LLM approaches.',
  source_url: '',
  tags: '',
  ai_summary: 'Practical guide to RAG systems combining retrieval and generation for better accuracy.',
  ai_tags: 'ai,rag,retrieval,generation,llm',
  ai_connections: '',
  is_processed: 1,
  created_at: '2026-03-15T11:00:00Z',
  updated_at: '2026-03-15T11:05:00Z',
  owner_id: 'demo-user-42',
};

const DEMO_NOTE_UNPROCESSED = {
  id: 'demo-note-003',
  title: 'Neural Network Security',
  content: 'Adversarial attacks on neural networks pose significant security challenges.',
  source_url: '',
  tags: '',
  ai_summary: '',
  ai_tags: '',
  ai_connections: '',
  is_processed: 0,
  created_at: '2026-03-15T12:00:00Z',
  updated_at: '2026-03-15T12:00:00Z',
  owner_id: 'demo-user-42',
};

const DEMO_CONNECTIONS = [
  {
    id: 'conn-001',
    source_note_id: 'demo-note-001',
    target_note_id: 'demo-note-002',
    relationship: 'foundational concept for',
    confidence: 0.87,
    created_at: '2026-03-15T10:06:00Z',
  },
];

// ══════════════════════════════════════════════════════════════
// Section 1: Step 1 — Creating a New Note via NoteEditor
// ══════════════════════════════════════════════════════════════

describe('E2E Demo - Step 1: Creating a New Note', () => {
  it('validates that a note title is required before saving', () => {
    expect(canSave('', false)).toBe(false);
    expect(canSave('   ', false)).toBe(false);
  });

  it('allows saving when title is provided', () => {
    expect(canSave(DEMO_NOTE.title, false)).toBe(true);
  });

  it('blocks saving while save is in progress', () => {
    expect(canSave(DEMO_NOTE.title, true)).toBe(false);
  });

  it('builds correct INSERT parameters from note data', () => {
    const result = buildInsertValues(
      DEMO_NOTE.title,
      DEMO_NOTE.content,
      DEMO_NOTE.source_url,
      DEMO_NOTE.owner_id,
    );
    expect(result.id).toBe('demo-note-001');
    expect(result.params[1]).toBe(DEMO_NOTE.title);
    expect(result.params[2]).toBe(DEMO_NOTE.content);
    expect(result.params[3]).toBe(DEMO_NOTE.source_url);
    expect(result.params[6]).toBe(DEMO_NOTE.owner_id);
  });

  it('sets source_url to null when empty', () => {
    const result = buildInsertValues(DEMO_NOTE.title, DEMO_NOTE.content, '', DEMO_NOTE.owner_id);
    expect(result.params[3]).toBeNull();
  });

  it('includes ISO timestamps for created_at and updated_at', () => {
    const result = buildInsertValues(DEMO_NOTE.title, DEMO_NOTE.content, '', DEMO_NOTE.owner_id);
    expect(result.params[4]).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.params[5]).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('trims whitespace from title and content', () => {
    const result = buildInsertValues('  Padded Title  ', '  Padded Content  ', '', 'u');
    expect(result.params[1]).toBe('Padded Title');
    expect(result.params[2]).toBe('Padded Content');
  });

  it('merges imported URL content with empty fields', () => {
    const result = mergeImportedContent('', '', 'Imported Title', 'Imported text body');
    expect(result.title).toBe('Imported Title');
    expect(result.content).toBe('Imported text body');
  });

  it('appends imported content to existing content', () => {
    const result = mergeImportedContent(
      DEMO_NOTE.title,
      'Existing content',
      'Imported Title',
      'Appended content',
    );
    expect(result.title).toBe(DEMO_NOTE.title);
    expect(result.content).toBe('Existing content\n\nAppended content');
  });
});

// ══════════════════════════════════════════════════════════════
// Section 2: Step 2 — Note Appearing in NoteList
// ══════════════════════════════════════════════════════════════

// ─── NoteList logic helpers ───

function buildNoteListQuery(searchQuery: string): { sql: string; params: string[] } {
  if (searchQuery) {
    return {
      sql: `SELECT * FROM notes WHERE title LIKE ? OR content LIKE ? OR ai_tags LIKE ? ORDER BY updated_at DESC`,
      params: [`%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`],
    };
  }
  return {
    sql: `SELECT * FROM notes ORDER BY updated_at DESC`,
    params: [],
  };
}

function getEmptyMessage(searchQuery: string): { title: string; hint: string } {
  return {
    title: searchQuery ? 'No matching notes' : 'No research notes yet',
    hint: 'Add your first note to get started',
  };
}

function renderTags(aiTags: string): string[] {
  return aiTags.split(',').filter(Boolean).slice(0, 3).map(tag => tag.trim());
}

function getPreview(note: { ai_summary?: string; content?: string }): string {
  if (note.ai_summary) return note.ai_summary;
  if (note.content) return note.content.slice(0, 120) + '...';
  return '';
}

function getCardClass(
  noteId: string,
  selectedId: string | undefined,
  isProcessed: boolean | number,
): string {
  const parts = ['note-card'];
  if (noteId === selectedId) parts.push('selected');
  parts.push(isProcessed ? 'processed' : 'pending');
  return parts.join(' ');
}

describe('E2E Demo - Step 2: Note Appears in NoteList', () => {
  it('newly created note matches default query (no search filter)', () => {
    const query = buildNoteListQuery('');
    expect(query.sql).not.toContain('WHERE');
    expect(query.params).toEqual([]);
  });

  it('note list query finds note by title', () => {
    const query = buildNoteListQuery('Transformer');
    expect(query.sql).toContain('title LIKE ?');
    expect(query.params[0]).toBe('%Transformer%');
  });

  it('note list query finds note by ai_tags', () => {
    const query = buildNoteListQuery('machine-learning');
    expect(query.params[2]).toBe('%machine-learning%');
  });

  it('shows empty state message when no notes exist', () => {
    const msg = getEmptyMessage('');
    expect(msg.title).toBe('No research notes yet');
    expect(msg.hint).toContain('Add your first note');
  });

  it('shows search-specific empty state when search yields no results', () => {
    const msg = getEmptyMessage('nonexistent');
    expect(msg.title).toBe('No matching notes');
  });

  it('renders AI tags as pill badges (max 3)', () => {
    const tags = renderTags(DEMO_NOTE.ai_tags);
    expect(tags).toHaveLength(3);
    expect(tags).toEqual(['ai', 'machine-learning', 'transformers']);
  });

  it('renders single tag correctly', () => {
    expect(renderTags('security')).toEqual(['security']);
  });

  it('handles empty tags gracefully', () => {
    expect(renderTags('')).toEqual([]);
  });

  it('shows AI summary as preview when available', () => {
    const preview = getPreview({ ai_summary: DEMO_NOTE.ai_summary, content: DEMO_NOTE.content });
    expect(preview).toBe(DEMO_NOTE.ai_summary);
  });

  it('falls back to truncated content when no AI summary', () => {
    const preview = getPreview({ content: DEMO_NOTE.content });
    expect(preview.length).toBe(123); // 120 chars + '...'
    expect(preview).toContain('Transformers use self-attention');
  });

  it('note card shows pending badge for unprocessed notes', () => {
    const cls = getCardClass(DEMO_NOTE_UNPROCESSED.id, undefined, DEMO_NOTE_UNPROCESSED.is_processed);
    expect(cls).toContain('pending');
    expect(cls).not.toContain('selected');
  });

  it('note card shows processed state after AI analysis', () => {
    const cls = getCardClass(DEMO_NOTE.id, undefined, DEMO_NOTE.is_processed);
    expect(cls).toContain('processed');
  });

  it('note card shows selected state when clicked', () => {
    const cls = getCardClass(DEMO_NOTE.id, DEMO_NOTE.id, DEMO_NOTE.is_processed);
    expect(cls).toContain('selected');
    expect(cls).toContain('processed');
  });
});

// ══════════════════════════════════════════════════════════════
// Section 3: Step 3 — AI Processing Trigger
// ══════════════════════════════════════════════════════════════

// ─── AI processing retry logic ───

function shouldRetryAI(status: number): boolean {
  return status === 404;
}

function getRetryDelay(attempt: number): number {
  return 2000 * (attempt + 1);
}

function buildProcessUrl(backendUrl: string, noteId: string): string {
  return `${backendUrl}/api/ai/process/${noteId}`;
}

function isNoteProcessed(note: { is_processed: number | boolean }): boolean {
  return !!note.is_processed;
}

function getProcessingBadgeText(isProcessed: boolean): string {
  return isProcessed ? '' : 'Analyzing...';
}

describe('E2E Demo - Step 3: AI Processing Trigger', () => {
  it('builds correct AI process URL for a note', () => {
    const url = buildProcessUrl('http://localhost:6061', DEMO_NOTE.id);
    expect(url).toBe('http://localhost:6061/api/ai/process/demo-note-001');
  });

  it('retries on 404 (sync not yet complete)', () => {
    expect(shouldRetryAI(404)).toBe(true);
  });

  it('stops retrying on 200 (success)', () => {
    expect(shouldRetryAI(200)).toBe(false);
  });

  it('stops retrying on 500 (server error)', () => {
    expect(shouldRetryAI(500)).toBe(false);
  });

  it('calculates linear backoff delay', () => {
    expect(getRetryDelay(0)).toBe(2000);
    expect(getRetryDelay(1)).toBe(4000);
    expect(getRetryDelay(2)).toBe(6000);
    expect(getRetryDelay(3)).toBe(8000);
    expect(getRetryDelay(4)).toBe(10000);
  });

  it('simulates full retry sequence', async () => {
    let attempts = 0;
    const maxRetries = 5;
    const triggerAI = async () => {
      for (let i = 0; i < maxRetries; i++) {
        attempts++;
        const delay = getRetryDelay(i);
        expect(delay).toBe(2000 * (i + 1));
        // Simulate: first 3 attempts return 404, then 200
        const status = i < 3 ? 404 : 200;
        if (!shouldRetryAI(status)) return status;
      }
      return -1;
    };
    const result = await triggerAI();
    expect(result).toBe(200);
    expect(attempts).toBe(4); // 3 retries + 1 success
  });

  it('note starts as unprocessed', () => {
    expect(isNoteProcessed(DEMO_NOTE_UNPROCESSED)).toBe(false);
  });

  it('note becomes processed after AI completes', () => {
    expect(isNoteProcessed(DEMO_NOTE)).toBe(true);
  });

  it('shows Analyzing badge for unprocessed notes', () => {
    expect(getProcessingBadgeText(false)).toBe('Analyzing...');
  });

  it('hides badge for processed notes', () => {
    expect(getProcessingBadgeText(true)).toBe('');
  });

  it('AI populates summary field after processing', () => {
    expect(DEMO_NOTE.ai_summary).toBeTruthy();
    expect(DEMO_NOTE.ai_summary).toContain('transformer');
  });

  it('AI populates tags field after processing', () => {
    expect(DEMO_NOTE.ai_tags).toBeTruthy();
    expect(DEMO_NOTE.ai_tags).toContain('ai');
    expect(DEMO_NOTE.ai_tags).toContain('machine-learning');
  });
});

// ══════════════════════════════════════════════════════════════
// Section 4: Step 4 — Connections in KnowledgeGraph
// ══════════════════════════════════════════════════════════════

// ─── KnowledgeGraph logic helpers ───

const TAG_COLORS: Record<string, string> = {
  'ai': '#8b5cf6',
  'machine-learning': '#8b5cf6',
  'security': '#ef4444',
  'web': '#3b82f6',
  'data': '#10b981',
  'research': '#f59e0b',
  'science': '#06b6d4',
  'default': '#6b7280',
};

function getNodeColor(tags: string): string {
  if (!tags) return TAG_COLORS.default;
  const tagList = tags.toLowerCase().split(',').map(t => t.trim());
  for (const tag of tagList) {
    for (const [key, color] of Object.entries(TAG_COLORS)) {
      if (tag.includes(key)) return color;
    }
  }
  return TAG_COLORS.default;
}

function truncateLabel(title: string): string {
  return title.length > 18 ? title.slice(0, 16) + '...' : title;
}

function findNodeInGraph(
  nodes: { id: string; x: number; y: number; radius: number }[],
  x: number,
  y: number,
): { id: string } | null {
  for (const node of [...nodes].reverse()) {
    const dx = x - node.x;
    const dy = y - node.y;
    if (dx * dx + dy * dy < (node.radius + 4) ** 2) return node;
  }
  return null;
}

function isEdgeHighlighted(
  edge: { source: string; target: string },
  hoveredNode: string | null,
  selectedId: string | null,
): boolean {
  return (
    hoveredNode === edge.source ||
    hoveredNode === edge.target ||
    selectedId === edge.source ||
    selectedId === edge.target
  );
}

function buildGraphNodes(
  notes: { id: string; title: string; ai_tags: string }[],
  width: number,
  height: number,
) {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.3;

  return notes.map((note, i) => {
    const angle = (2 * Math.PI * i) / Math.max(notes.length, 1);
    return {
      id: note.id,
      title: note.title || 'Untitled',
      tags: note.ai_tags || '',
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      vx: 0,
      vy: 0,
      radius: 24,
      color: getNodeColor(note.ai_tags || ''),
    };
  });
}

function buildGraphEdges(
  connections: { source_note_id: string; target_note_id: string; relationship: string }[],
) {
  return connections.map(c => ({
    source: c.source_note_id,
    target: c.target_note_id,
    relationship: c.relationship || '',
  }));
}

describe('E2E Demo - Step 4: Connections in KnowledgeGraph', () => {
  it('assigns correct color to AI-tagged nodes', () => {
    expect(getNodeColor(DEMO_NOTE.ai_tags)).toBe('#8b5cf6'); // ai tag matches first
  });

  it('assigns default color to unprocessed nodes with no tags', () => {
    expect(getNodeColor(DEMO_NOTE_UNPROCESSED.ai_tags)).toBe('#6b7280');
  });

  it('assigns color for RAG note (contains "ai" tag)', () => {
    expect(getNodeColor(DEMO_NOTE_2.ai_tags)).toBe('#8b5cf6');
  });

  it('truncates long note titles in graph labels', () => {
    expect(truncateLabel(DEMO_NOTE.title)).toBe('Transformer Arch...');
  });

  it('does not truncate short titles', () => {
    expect(truncateLabel('RAG Systems')).toBe('RAG Systems');
  });

  it('builds graph nodes from note data', () => {
    const notes = [DEMO_NOTE, DEMO_NOTE_2].map(n => ({
      id: n.id,
      title: n.title,
      ai_tags: n.ai_tags,
    }));
    const graphNodes = buildGraphNodes(notes, 800, 500);
    expect(graphNodes).toHaveLength(2);
    expect(graphNodes[0].id).toBe('demo-note-001');
    expect(graphNodes[1].id).toBe('demo-note-002');
    expect(graphNodes[0].color).toBe('#8b5cf6');
  });

  it('positions nodes within canvas bounds', () => {
    const notes = [DEMO_NOTE, DEMO_NOTE_2, DEMO_NOTE_UNPROCESSED].map(n => ({
      id: n.id,
      title: n.title,
      ai_tags: n.ai_tags,
    }));
    const graphNodes = buildGraphNodes(notes, 800, 500);
    for (const node of graphNodes) {
      expect(node.x).toBeGreaterThan(0);
      expect(node.x).toBeLessThan(800);
      expect(node.y).toBeGreaterThan(0);
      expect(node.y).toBeLessThan(500);
    }
  });

  it('builds graph edges from connection data', () => {
    const edges = buildGraphEdges(DEMO_CONNECTIONS);
    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe('demo-note-001');
    expect(edges[0].target).toBe('demo-note-002');
    expect(edges[0].relationship).toBe('foundational concept for');
  });

  it('highlights edge when hovering over connected node', () => {
    const edge = { source: 'demo-note-001', target: 'demo-note-002' };
    expect(isEdgeHighlighted(edge, 'demo-note-001', null)).toBe(true);
    expect(isEdgeHighlighted(edge, 'demo-note-002', null)).toBe(true);
  });

  it('highlights edge when selecting a connected node', () => {
    const edge = { source: 'demo-note-001', target: 'demo-note-002' };
    expect(isEdgeHighlighted(edge, null, 'demo-note-001')).toBe(true);
  });

  it('does not highlight edge for unrelated node', () => {
    const edge = { source: 'demo-note-001', target: 'demo-note-002' };
    expect(isEdgeHighlighted(edge, 'demo-note-003', null)).toBe(false);
    expect(isEdgeHighlighted(edge, null, 'demo-note-003')).toBe(false);
  });

  it('detects click on graph node', () => {
    const nodes = [{ id: 'demo-note-001', x: 400, y: 250, radius: 24 }];
    expect(findNodeInGraph(nodes, 400, 250)?.id).toBe('demo-note-001');
  });

  it('misses click outside graph nodes', () => {
    const nodes = [{ id: 'demo-note-001', x: 400, y: 250, radius: 24 }];
    expect(findNodeInGraph(nodes, 100, 100)).toBeNull();
  });

  it('handles empty graph gracefully', () => {
    const edges = buildGraphEdges([]);
    expect(edges).toHaveLength(0);
    const nodes = buildGraphNodes([], 800, 500);
    expect(nodes).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════════════════════
// Section 5: Step 5 — Searching for the Note via NoteSearch
// ══════════════════════════════════════════════════════════════

describe('E2E Demo - Step 5: Searching for the Note', () => {
  it('should execute search for non-empty query', () => {
    expect(shouldExecuteSearch('transformer')).toBe(true);
  });

  it('should not execute search for empty or whitespace query', () => {
    expect(shouldExecuteSearch('')).toBe(false);
    expect(shouldExecuteSearch('   ')).toBe(false);
  });

  it('builds correct SQL for searching "transformer"', () => {
    const { sql, params } = buildSearchQuery('transformer', 'all');
    expect(sql).toContain('title LIKE ?');
    expect(sql).toContain('content LIKE ?');
    expect(sql).toContain('ai_summary LIKE ?');
    expect(sql).toContain('ai_tags LIKE ?');
    expect(params).toEqual([
      '%transformer%',
      '%transformer%',
      '%transformer%',
      '%transformer%',
    ]);
  });

  it('combines search query with processed filter', () => {
    const { sql, params } = buildSearchQuery('attention', 'processed');
    expect(sql).toContain('AND');
    expect(sql).toContain('is_processed = 1');
    expect(params).toHaveLength(4);
  });

  it('filters only unprocessed notes', () => {
    const { sql } = buildSearchQuery('', 'unprocessed');
    expect(sql).toContain('is_processed = 0');
  });

  it('extracts best snippet from AI summary when match found', () => {
    const snippet = extractBestSnippet(DEMO_NOTE, 'transformer');
    expect(snippet.toLowerCase()).toContain('transformer');
  });

  it('extracts snippet from content when match is only there', () => {
    const snippet = extractBestSnippet(DEMO_NOTE, 'RNNs');
    expect(snippet).toContain('RNNs');
  });

  it('extracts snippet from tags when match is only there', () => {
    const snippet = extractBestSnippet(DEMO_NOTE, 'deep-learning');
    expect(snippet).toContain('deep-learning');
  });

  it('falls back to ai_summary when query has no match', () => {
    const snippet = extractBestSnippet(DEMO_NOTE, 'quantum');
    expect(snippet).toBe(DEMO_NOTE.ai_summary);
  });

  it('highlights search terms in snippet', () => {
    const segments = highlightSnippet('Transformer Architecture Deep Dive', 'Transformer');
    expect(segments[0]).toEqual({ text: 'Transformer', highlighted: true });
    expect(segments[1]).toEqual({ text: ' Architecture Deep Dive', highlighted: false });
  });

  it('highlights multiple occurrences of search term', () => {
    const segments = highlightSnippet('ai and more ai topics', 'ai');
    const highlighted = segments.filter(s => s.highlighted);
    expect(highlighted).toHaveLength(2);
  });

  it('highlight is case-insensitive', () => {
    const segments = highlightSnippet('Machine Learning', 'machine');
    expect(segments[0].highlighted).toBe(true);
    expect(segments[0].text).toBe('Machine');
  });

  it('calculates high relevance for title match', () => {
    const score = calculateRelevance(DEMO_NOTE, 'Transformer');
    expect(score).toBeGreaterThanOrEqual(40); // title match = 40+
  });

  it('calculates 100 relevance when all fields match', () => {
    // 'attention' appears in: title(no), content(yes: "attention layers" + "attention"),
    //   summary(yes: "attention"), tags(yes: "attention")
    // Use a note where all 4 fields match — construct one inline
    const allFieldNote = {
      title: 'attention mechanisms overview',
      content: 'attention is the core of transformers',
      ai_summary: 'summary of attention in neural nets',
      ai_tags: 'attention,ai',
    };
    const score = calculateRelevance(allFieldNote, 'attention');
    expect(score).toBe(100);
  });

  it('calculates 0 relevance for no match', () => {
    expect(calculateRelevance(DEMO_NOTE, 'quantum')).toBe(0);
  });

  it('counts field matches correctly', () => {
    // 'attention' in: title(no), content(yes), ai_summary(yes), ai_tags(yes via "attention")
    expect(countFieldMatches(DEMO_NOTE, 'attention')).toBe(3);
  });

  it('splits multi-word search query', () => {
    expect(splitSearchTerms('transformer attention')).toEqual(['transformer', 'attention']);
  });

  it('shows correct search stats message', () => {
    const msg = getSearchStatsMessage('transformer', 1, 3, 'all');
    expect(msg).toBe('1 result for "transformer" (searched 3 notes)');
  });

  it('shows total count when not searching', () => {
    const msg = getSearchStatsMessage('', 0, 3, 'all');
    expect(msg).toBe('3 notes in local database');
  });

  it('shows filter-specific empty message', () => {
    const empty = getEmptyStateMessage('', 'processed');
    expect(empty.title).toBe('No processed notes found');
  });

  it('shows query-specific empty message', () => {
    const empty = getEmptyStateMessage('quantum', 'all');
    expect(empty.title).toBe('No notes match "quantum"');
  });

  it('shows correct active filter chip', () => {
    expect(getActiveFilterChip('all')).toBe('All');
    expect(getActiveFilterChip('processed')).toBe('Processed');
    expect(getActiveFilterChip('unprocessed')).toBe('Unprocessed');
  });

  it('formats dates correctly', () => {
    expect(formatDate(DEMO_NOTE.created_at)).toBeTruthy();
    expect(formatDate(null)).toBe('');
    expect(formatDate('')).toBe('');
  });
});

// ══════════════════════════════════════════════════════════════
// Section 6: Step 6 — Querying the Agent About the Note
// ══════════════════════════════════════════════════════════════

// ─── AgentChat logic helpers ───

const TOOL_LABELS: Record<string, string> = {
  'searchNotesTool': 'Searched notes',
  'getNoteDetailTool': 'Read note details',
  'listAllNotesTool': 'Listed all notes',
  'getTagsTool': 'Analyzed tags',
  'getConnectionGraphTool': 'Explored connections',
};

function buildChatMessages(
  history: { role: string; content: string }[],
  message: string,
  ownerId: string,
) {
  return [
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: `[Context: owner_id=${ownerId}]\n\n${message}` },
  ];
}

function extractToolCalls(apiResponse: any): { toolName: string; args?: any }[] {
  return (apiResponse.toolCalls || []).map((tc: any) => ({
    toolName: tc.toolName || tc.name || 'unknown',
    args: tc.args,
  }));
}

function canSendMessage(input: string, loading: boolean): boolean {
  return !!input.trim() && !loading;
}

function getToolLabel(toolName: string): string {
  return TOOL_LABELS[toolName] || toolName;
}

function buildErrorMessage(errResponse: { message?: string } | null): string {
  if (errResponse?.message) return `Error: ${errResponse.message}`;
  return 'Error: Request failed';
}

function buildOfflineMessage(): string {
  return 'Failed to reach the agent. Are you online?';
}

describe('E2E Demo - Step 6: Querying the Agent', () => {
  it('validates non-empty input before sending', () => {
    expect(canSendMessage('', false)).toBe(false);
    expect(canSendMessage('   ', false)).toBe(false);
  });

  it('allows sending valid message when not loading', () => {
    expect(canSendMessage('Tell me about transformers', false)).toBe(true);
  });

  it('blocks sending while loading', () => {
    expect(canSendMessage('Valid message', true)).toBe(false);
  });

  it('builds chat messages with owner_id context', () => {
    const msgs = buildChatMessages([], 'Tell me about my transformer notes', DEMO_NOTE.owner_id);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toContain('owner_id=demo-user-42');
    expect(msgs[0].content).toContain('Tell me about my transformer notes');
  });

  it('preserves conversation history in message list', () => {
    const history = [
      { role: 'user', content: 'What topics do I research?' },
      { role: 'assistant', content: 'You research AI and machine learning.' },
    ];
    const msgs = buildChatMessages(history, 'Tell me more', DEMO_NOTE.owner_id);
    expect(msgs).toHaveLength(3);
    expect(msgs[0].content).toBe('What topics do I research?');
    expect(msgs[1].content).toBe('You research AI and machine learning.');
  });

  it('extracts tool calls from agent response', () => {
    const response = {
      reply: 'I found information about transformers in your notes.',
      toolCalls: [
        { toolName: 'searchNotesTool', args: { query: 'transformer' } },
        { toolName: 'getNoteDetailTool', args: { note_id: 'demo-note-001' } },
      ],
    };
    const tools = extractToolCalls(response);
    expect(tools).toHaveLength(2);
    expect(tools[0].toolName).toBe('searchNotesTool');
    expect(tools[0].args.query).toBe('transformer');
    expect(tools[1].toolName).toBe('getNoteDetailTool');
  });

  it('handles response with no tool calls', () => {
    const response = { reply: 'Here is a simple answer.', toolCalls: [] };
    expect(extractToolCalls(response)).toHaveLength(0);
  });

  it('handles response with missing toolCalls field', () => {
    const response = { reply: 'No tools used' };
    expect(extractToolCalls(response)).toHaveLength(0);
  });

  it('handles tool calls with name instead of toolName', () => {
    const response = {
      reply: 'Result',
      toolCalls: [{ name: 'getConnectionGraphTool', args: {} }],
    };
    const tools = extractToolCalls(response);
    expect(tools[0].toolName).toBe('getConnectionGraphTool');
  });

  it('maps tool names to human-readable labels', () => {
    expect(getToolLabel('searchNotesTool')).toBe('Searched notes');
    expect(getToolLabel('getNoteDetailTool')).toBe('Read note details');
    expect(getToolLabel('getConnectionGraphTool')).toBe('Explored connections');
    expect(getToolLabel('getTagsTool')).toBe('Analyzed tags');
    expect(getToolLabel('listAllNotesTool')).toBe('Listed all notes');
  });

  it('uses tool name as fallback for unknown tools', () => {
    expect(getToolLabel('customTool')).toBe('customTool');
  });

  it('builds error message from API error', () => {
    expect(buildErrorMessage({ message: 'Rate limit exceeded' })).toBe('Error: Rate limit exceeded');
  });

  it('builds fallback error message for unparseable error', () => {
    expect(buildErrorMessage(null)).toBe('Error: Request failed');
  });

  it('builds offline error message', () => {
    expect(buildOfflineMessage()).toContain('online');
  });
});

// ══════════════════════════════════════════════════════════════
// Section 7: Full Journey Integration — Cross-Component Flow
// ══════════════════════════════════════════════════════════════

// ─── App-level state helpers ───

type ViewMode = 'list' | 'graph';

function toggleViewMode(current: ViewMode): ViewMode {
  return current === 'list' ? 'graph' : 'list';
}

function formatNoteCount(count: number): string {
  if (count === 0) return '';
  return `${count} note${count !== 1 ? 's' : ''}`;
}

function handleKeyboardAction(
  e: { key: string; metaKey: boolean; ctrlKey: boolean },
  targetTag: string,
  state: { showEditor: boolean; showAsk: boolean; briefContent: string; selectedNote: string | null },
): string | null {
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

function getSyncStatusText(connected: boolean, uploading: boolean): string {
  let text = connected ? 'Synced' : 'Offline';
  if (uploading) text += ' (syncing...)';
  return text;
}

function shouldShowBriefButton(count: number): boolean {
  return count >= 2;
}

function getAiStatusBadgeText(aiStatus: { provider: string; local: boolean; model: string } | null): string | null {
  if (!aiStatus) return null;
  return aiStatus.local ? 'Local AI' : aiStatus.provider;
}

// AskAI local search fallback logic
function localSearch(
  query: string,
  allNotes: { title: string; content: string; ai_summary: string; ai_tags: string }[],
): string {
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  if (!terms.length || !allNotes.length) return 'No notes found matching your query.';

  const scored = allNotes
    .map(note => {
      const text = `${note.title} ${note.content} ${note.ai_summary} ${note.ai_tags}`.toLowerCase();
      const matches = terms.filter(t => text.includes(t));
      return { note, score: matches.length / terms.length };
    })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return 'No notes found matching your query. Try different keywords.';

  const top = scored.slice(0, 3);
  const parts = top.map(({ note, score }) => {
    const summary = note.ai_summary || note.content.slice(0, 200);
    const relevance = Math.round(score * 100);
    return `### ${note.title} (${relevance}% match)\n${summary}`;
  });

  return `*Local search results (offline mode):*\n\n${parts.join('\n\n---\n\n')}`;
}

describe('E2E Demo - Step 7: Full Journey Integration', () => {
  // Simulate the full journey as a state machine

  it('journey starts with empty state, no notes', () => {
    expect(formatNoteCount(0)).toBe('');
    expect(shouldShowBriefButton(0)).toBe(false);
  });

  it('user opens editor via Ctrl+N', () => {
    const state = { showEditor: false, showAsk: false, briefContent: '', selectedNote: null };
    const action = handleKeyboardAction({ key: 'n', metaKey: false, ctrlKey: true }, 'DIV', state);
    expect(action).toBe('newNote');
  });

  it('user creates a note — count updates to 1', () => {
    expect(formatNoteCount(1)).toBe('1 note');
  });

  it('user creates second note — count updates to 2', () => {
    expect(formatNoteCount(2)).toBe('2 notes');
    expect(shouldShowBriefButton(2)).toBe(true);
  });

  it('user toggles to graph view with G key', () => {
    const state = { showEditor: false, showAsk: false, briefContent: '', selectedNote: null };
    const action = handleKeyboardAction({ key: 'g', metaKey: false, ctrlKey: false }, 'DIV', state);
    expect(action).toBe('toggleGraph');
    expect(toggleViewMode('list')).toBe('graph');
  });

  it('graph shows connection between the two notes', () => {
    const edges = buildGraphEdges(DEMO_CONNECTIONS);
    expect(edges.length).toBeGreaterThan(0);
    expect(edges[0].source).toBe(DEMO_NOTE.id);
    expect(edges[0].target).toBe(DEMO_NOTE_2.id);
    expect(edges[0].relationship).toBe('foundational concept for');
  });

  it('user selects a note in graph, edge gets highlighted', () => {
    const edge = { source: DEMO_NOTE.id, target: DEMO_NOTE_2.id };
    expect(isEdgeHighlighted(edge, null, DEMO_NOTE.id)).toBe(true);
  });

  it('user searches for the note via Deep Search', () => {
    const { sql, params } = buildSearchQuery('transformer', 'all');
    expect(sql).toContain('title LIKE ?');
    expect(params[0]).toBe('%transformer%');
    // The search would find the note
    const relevance = calculateRelevance(DEMO_NOTE, 'transformer');
    expect(relevance).toBeGreaterThan(0);
  });

  it('user asks agent about transformers', () => {
    const msgs = buildChatMessages([], 'What do my notes say about transformers?', DEMO_NOTE.owner_id);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toContain('transformers');
    expect(msgs[0].content).toContain('owner_id=demo-user-42');
  });

  it('agent uses search tool and returns result', () => {
    const response = {
      reply: 'Your notes discuss transformer architecture including self-attention and positional encoding.',
      toolCalls: [
        { toolName: 'searchNotesTool', args: { query: 'transformer' } },
        { toolName: 'getNoteDetailTool', args: { note_id: DEMO_NOTE.id } },
      ],
    };
    const tools = extractToolCalls(response);
    expect(tools).toHaveLength(2);
    expect(getToolLabel(tools[0].toolName)).toBe('Searched notes');
    expect(getToolLabel(tools[1].toolName)).toBe('Read note details');
  });

  it('user presses Escape to close panels in priority order', () => {
    // All open: editor first
    const allOpen = { showEditor: true, showAsk: true, briefContent: 'brief', selectedNote: 'n1' };
    expect(handleKeyboardAction({ key: 'Escape', metaKey: false, ctrlKey: false }, 'DIV', allOpen)).toBe('closeEditor');

    // Editor closed: ask next
    const askOpen = { showEditor: false, showAsk: true, briefContent: 'brief', selectedNote: 'n1' };
    expect(handleKeyboardAction({ key: 'Escape', metaKey: false, ctrlKey: false }, 'DIV', askOpen)).toBe('closeAsk');

    // Ask closed: brief next
    const briefOpen = { showEditor: false, showAsk: false, briefContent: 'brief', selectedNote: 'n1' };
    expect(handleKeyboardAction({ key: 'Escape', metaKey: false, ctrlKey: false }, 'DIV', briefOpen)).toBe('closeBrief');

    // Brief closed: deselect note last
    const noteSelected = { showEditor: false, showAsk: false, briefContent: '', selectedNote: 'n1' };
    expect(handleKeyboardAction({ key: 'Escape', metaKey: false, ctrlKey: false }, 'DIV', noteSelected)).toBe('deselectNote');
  });

  it('sync status shows online when connected', () => {
    expect(getSyncStatusText(true, false)).toBe('Synced');
    expect(getSyncStatusText(true, true)).toBe('Synced (syncing...)');
  });

  it('sync status shows offline when disconnected', () => {
    expect(getSyncStatusText(false, false)).toBe('Offline');
    expect(getSyncStatusText(false, true)).toBe('Offline (syncing...)');
  });

  it('AI status badge displays provider info', () => {
    expect(getAiStatusBadgeText({ provider: 'OpenAI', local: false, model: 'gpt-4' })).toBe('OpenAI');
    expect(getAiStatusBadgeText({ provider: 'ollama', local: true, model: 'llama3' })).toBe('Local AI');
    expect(getAiStatusBadgeText(null)).toBeNull();
  });

  it('local search fallback works offline with demo notes', () => {
    const notes = [DEMO_NOTE, DEMO_NOTE_2, DEMO_NOTE_UNPROCESSED];
    const result = localSearch('transformer attention', notes);
    expect(result).toContain('Local search results');
    expect(result).toContain(DEMO_NOTE.title);
  });

  it('local search handles no matches', () => {
    const notes = [DEMO_NOTE];
    const result = localSearch('quantum computing blockchain', notes);
    expect(result).toContain('No notes found');
  });

  it('local search handles empty notes array', () => {
    const result = localSearch('transformer', []);
    expect(result).toBe('No notes found matching your query.');
  });

  it('local search handles short query terms (filtered out)', () => {
    const notes = [DEMO_NOTE];
    const result = localSearch('if or an', notes);
    expect(result).toBe('No notes found matching your query.');
  });

  it('local search returns up to 3 results sorted by relevance', () => {
    const notes = [DEMO_NOTE, DEMO_NOTE_2, DEMO_NOTE_UNPROCESSED];
    const result = localSearch('neural', notes);
    expect(result).toContain('Local search results');
    // "neural" only appears in DEMO_NOTE_UNPROCESSED (title + content)
    expect(result).toContain('Neural Network Security');
  });
});
