import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * SyncMind Research Agent - powered by Mastra framework.
 * Provides AI-driven note analysis, connection discovery, and research synthesis.
 */

export function createResearchAgent(pool, modelId) {
  const searchNotesTool = createTool({
    id: 'search-notes',
    description: 'Search through research notes by keyword or topic. Returns matching notes with their content and AI summaries.',
    inputSchema: z.object({
      query: z.string().describe('Search query - keywords or topic to find'),
      owner_id: z.string().default('default').describe('Owner ID to scope search'),
      limit: z.number().default(10).describe('Max results to return')
    }),
    execute: async ({ context }) => {
      const { rows } = await pool.query(
        `SELECT id, title, content, ai_summary, ai_tags, source_url, created_at
         FROM notes WHERE owner_id = $1
         AND (title ILIKE $2 OR content ILIKE $2 OR ai_tags ILIKE $2 OR ai_summary ILIKE $2)
         ORDER BY updated_at DESC LIMIT $3`,
        [context.owner_id, `%${context.query}%`, context.limit]
      );
      return { notes: rows, count: rows.length };
    }
  });

  const getNoteDetailTool = createTool({
    id: 'get-note-detail',
    description: 'Get full details of a specific note by ID, including AI analysis and connections.',
    inputSchema: z.object({
      note_id: z.string().describe('UUID of the note to retrieve')
    }),
    execute: async ({ context }) => {
      const { rows } = await pool.query('SELECT * FROM notes WHERE id = $1', [context.note_id]);
      if (!rows.length) return { error: 'Note not found' };

      const { rows: connections } = await pool.query(
        `SELECT c.*, n.title as target_title
         FROM connections c JOIN notes n ON c.target_note_id = n.id
         WHERE c.source_note_id = $1`,
        [context.note_id]
      );

      return { note: rows[0], connections };
    }
  });

  const listAllNotesTool = createTool({
    id: 'list-all-notes',
    description: 'List all notes for an owner with titles and summaries. Use this to get an overview of the research collection.',
    inputSchema: z.object({
      owner_id: z.string().default('default').describe('Owner ID'),
      limit: z.number().default(30).describe('Max notes to return')
    }),
    execute: async ({ context }) => {
      const { rows } = await pool.query(
        `SELECT id, title, ai_summary, ai_tags, source_url, is_processed, created_at, updated_at
         FROM notes WHERE owner_id = $1 ORDER BY updated_at DESC LIMIT $2`,
        [context.owner_id, context.limit]
      );
      return { notes: rows, count: rows.length };
    }
  });

  const getTagsTool = createTool({
    id: 'get-tags',
    description: 'Get all tags and their frequency across the note collection. Useful for understanding research themes.',
    inputSchema: z.object({}),
    execute: async () => {
      const { rows } = await pool.query('SELECT name, note_count FROM tags ORDER BY note_count DESC LIMIT 50');
      return { tags: rows };
    }
  });

  const getConnectionGraphTool = createTool({
    id: 'get-connection-graph',
    description: 'Get the knowledge graph of connections between notes. Shows how research topics relate to each other.',
    inputSchema: z.object({
      owner_id: z.string().default('default').describe('Owner ID')
    }),
    execute: async ({ context }) => {
      const { rows: connections } = await pool.query(
        `SELECT c.source_note_id, c.target_note_id, c.relationship, c.confidence,
                s.title as source_title, t.title as target_title
         FROM connections c
         JOIN notes s ON c.source_note_id = s.id
         JOIN notes t ON c.target_note_id = t.id
         WHERE s.owner_id = $1
         ORDER BY c.confidence DESC LIMIT 100`,
        [context.owner_id]
      );
      return { connections, count: connections.length };
    }
  });

  const agent = new Agent({
    id: 'syncmind-research-agent',
    name: 'SyncMind Research Agent',
    instructions: `You are SyncMind's Research Agent, an AI assistant that helps users analyze, connect, and synthesize their research notes.

Your capabilities:
- Search and retrieve notes from the user's collection
- Analyze connections and themes across notes
- Generate research briefs and summaries
- Answer questions based on the user's research
- Identify knowledge gaps and suggest next steps

When answering questions:
1. First search for relevant notes using the search tool
2. If needed, get detailed content of specific notes
3. Use the tag and connection tools to understand the broader context
4. Synthesize information across multiple notes
5. Cite specific notes by title when referencing information

Be concise but thorough. Always ground your answers in the user's actual notes.`,
    model: modelId,
    tools: {
      searchNotesTool,
      getNoteDetailTool,
      listAllNotesTool,
      getTagsTool,
      getConnectionGraphTool
    }
  });

  return agent;
}
