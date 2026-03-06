import express from 'express';
import PG from 'pg';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

const { Pool } = PG;
const router = express.Router();

const pool = new Pool({ connectionString: process.env.DATABASE_URI });

let aiProvider = null;
function getProvider() {
  if (aiProvider) return aiProvider;
  if (process.env.ANTHROPIC_API_KEY) {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    aiProvider = {
      name: 'anthropic',
      chat: async (prompt, maxTokens = 1024) => {
        const msg = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: prompt }]
        });
        return msg.content[0].text;
      }
    };
  } else if (process.env.OPENAI_API_KEY) {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    aiProvider = {
      name: 'openai',
      chat: async (prompt, maxTokens = 1024) => {
        const resp = await client.chat.completions.create({
          model: 'gpt-4.1-mini',
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: prompt }]
        });
        return resp.choices[0].message.content;
      }
    };
  }
  return aiProvider;
}

// Process a note with AI: summarize, tag, find connections
router.post('/process/:noteId', async (req, res) => {
  const provider = getProvider();
  if (!provider) {
    return res.status(503).json({ message: 'AI not configured (set ANTHROPIC_API_KEY or OPENAI_API_KEY)' });
  }

  try {
    const { rows } = await pool.query('SELECT * FROM notes WHERE id = $1', [req.params.noteId]);
    if (!rows.length) return res.status(404).json({ message: 'Note not found' });

    const note = rows[0];

    // Get other notes for connection finding
    const { rows: otherNotes } = await pool.query(
      'SELECT id, title, content, ai_tags FROM notes WHERE id != $1 AND owner_id = $2 LIMIT 20',
      [note.id, note.owner_id]
    );

    const otherNotesContext = otherNotes
      .map(n => `[${n.id}] "${n.title}": ${(n.content || '').slice(0, 200)}`)
      .join('\n');

    const text = await provider.chat(`Analyze this research note and respond with ONLY valid JSON (no markdown, no code blocks):

TITLE: ${note.title}
CONTENT: ${note.content || ''}
SOURCE: ${note.source_url || 'none'}

OTHER NOTES IN COLLECTION:
${otherNotesContext || 'none'}

Respond with this JSON structure:
{
  "summary": "2-3 sentence summary of key insights",
  "tags": ["tag1", "tag2", "tag3"],
  "connections": [{"note_id": "uuid", "relationship": "brief description"}],
  "key_insights": ["insight1", "insight2"]
}`);
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      // Try extracting JSON from response
      const match = text.match(/\{[\s\S]*\}/);
      result = match ? JSON.parse(match[0]) : { summary: text, tags: [], connections: [], key_insights: [] };
    }

    // Update note with AI results (TEXT columns, comma-separated)
    const now = new Date().toISOString();
    await pool.query(
      `UPDATE notes SET
        ai_summary = $1,
        ai_tags = $2,
        ai_connections = $3,
        is_processed = 1,
        updated_at = $5
      WHERE id = $4`,
      [
        result.summary || '',
        (result.tags || []).join(','),
        (result.connections || []).map(c => `${c.note_id}:${c.relationship}`).join(','),
        note.id,
        now
      ]
    );

    // Create connection records
    if (result.connections?.length) {
      for (const conn of result.connections) {
        // Verify the target note exists
        const exists = otherNotes.find(n => n.id === conn.note_id);
        if (exists) {
          await pool.query(
            `INSERT INTO connections (source_note_id, target_note_id, relationship, confidence)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT DO NOTHING`,
            [note.id, conn.note_id, conn.relationship, 0.8]
          );
        }
      }
    }

    // Update tag counts
    for (const tag of result.tags || []) {
      await pool.query(
        `INSERT INTO tags (name, note_count) VALUES ($1, 1)
         ON CONFLICT (name) DO UPDATE SET note_count = tags.note_count + 1`,
        [tag]
      );
    }

    res.json({ success: true, result });
  } catch (e) {
    console.error('AI processing failed:', e.message);
    res.status(500).json({ message: e.message });
  }
});

// Ask a question across all notes
router.post('/ask', async (req, res) => {
  const provider = getProvider();
  if (!provider) return res.status(503).json({ message: 'AI not configured' });

  const { question, owner_id = 'default' } = req.body;
  if (!question) return res.status(400).json({ message: 'Question required' });

  try {
    const { rows: notes } = await pool.query(
      'SELECT title, content, ai_summary, ai_tags FROM notes WHERE owner_id = $1 ORDER BY updated_at DESC LIMIT 30',
      [owner_id]
    );

    const context = notes
      .map(n => `## ${n.title}\n${n.ai_summary || n.content?.slice(0, 300) || ''}\nTags: ${n.ai_tags || ''}`)
      .join('\n\n');

    const answer = await provider.chat(`Based on these research notes, answer the question.

RESEARCH NOTES:
${context}

QUESTION: ${question}

Answer concisely, citing specific notes when relevant.`);

    res.json({ answer });
  } catch (e) {
    console.error('AI ask failed:', e.message);
    res.status(500).json({ message: e.message });
  }
});

// Generate a research brief from all notes
router.post('/brief', async (req, res) => {
  const provider = getProvider();
  if (!provider) return res.status(503).json({ message: 'AI not configured' });

  const { owner_id = 'default', topic } = req.body;

  try {
    const { rows: notes } = await pool.query(
      'SELECT title, content, ai_summary, ai_tags FROM notes WHERE owner_id = $1 ORDER BY updated_at DESC LIMIT 50',
      [owner_id]
    );

    const context = notes
      .map(n => `- ${n.title}: ${n.ai_summary || n.content?.slice(0, 200) || ''}`)
      .join('\n');

    const brief = await provider.chat(`Create a research brief from these notes${topic ? ` focused on: ${topic}` : ''}.

NOTES:
${context}

Write a structured brief with: Executive Summary, Key Themes, Notable Findings, Knowledge Gaps, and Suggested Next Steps.`, 2048);

    res.json({ brief });
  } catch (e) {
    console.error('AI brief failed:', e.message);
    res.status(500).json({ message: e.message });
  }
});

// Extract content from a URL for import
router.post('/extract-url', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ message: 'URL required' });

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SyncMind/1.0; +https://github.com/Fulcria-Labs/syncmind)',
        'Accept': 'text/html,application/xhtml+xml,text/plain'
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      return res.status(400).json({ message: `Failed to fetch URL: ${response.status}` });
    }

    const html = await response.text();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    let title = titleMatch ? titleMatch[1].trim().replace(/\s+/g, ' ') : new URL(url).hostname;

    // Strip non-content elements, then extract article/main if available
    let content = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<aside[\s\S]*?<\/aside>/gi, '');

    const articleMatch = content.match(/<article[\s\S]*?>([\s\S]*?)<\/article>/i)
      || content.match(/<main[\s\S]*?>([\s\S]*?)<\/main>/i);
    if (articleMatch) content = articleMatch[1];

    // Convert to plain text
    content = content
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(?:p|div|h[1-6]|li|tr|blockquote)>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (content.length > 10000) {
      content = content.slice(0, 10000) + '\n\n[Content truncated...]';
    }

    title = title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

    res.json({ title, content, source_url: url });
  } catch (e) {
    console.error('URL extraction failed:', e.message);
    res.status(500).json({ message: e.message });
  }
});

// Background processor: auto-detect and process unprocessed notes
let processingInterval = null;

function startBackgroundProcessor() {
  if (processingInterval) return;

  processingInterval = setInterval(async () => {
    const provider = getProvider();
    if (!provider) return;

    try {
      const { rows } = await pool.query(
        'SELECT id FROM notes WHERE is_processed = 0 ORDER BY created_at ASC LIMIT 3'
      );

      for (const row of rows) {
        try {
          const { rows: notes } = await pool.query('SELECT * FROM notes WHERE id = $1', [row.id]);
          if (!notes.length) continue;
          const note = notes[0];

          const { rows: otherNotes } = await pool.query(
            'SELECT id, title, content, ai_tags FROM notes WHERE id != $1 AND owner_id = $2 LIMIT 20',
            [note.id, note.owner_id]
          );

          const otherNotesContext = otherNotes
            .map(n => `[${n.id}] "${n.title}": ${(n.content || '').slice(0, 200)}`)
            .join('\n');

          const text = await provider.chat(`Analyze this research note and respond with ONLY valid JSON (no markdown, no code blocks):

TITLE: ${note.title}
CONTENT: ${note.content || ''}
SOURCE: ${note.source_url || 'none'}

OTHER NOTES IN COLLECTION:
${otherNotesContext || 'none'}

Respond with this JSON structure:
{
  "summary": "2-3 sentence summary of key insights",
  "tags": ["tag1", "tag2", "tag3"],
  "connections": [{"note_id": "uuid", "relationship": "brief description"}],
  "key_insights": ["insight1", "insight2"]
}`);

          let result;
          try {
            result = JSON.parse(text);
          } catch {
            const match = text.match(/\{[\s\S]*\}/);
            result = match ? JSON.parse(match[0]) : { summary: text, tags: [], connections: [], key_insights: [] };
          }

          const now = new Date().toISOString();
          await pool.query(
            `UPDATE notes SET ai_summary = $1, ai_tags = $2, ai_connections = $3, is_processed = 1, updated_at = $5 WHERE id = $4`,
            [result.summary || '', (result.tags || []).join(','),
             (result.connections || []).map(c => `${c.note_id}:${c.relationship}`).join(','),
             note.id, now]
          );

          if (result.connections?.length) {
            for (const conn of result.connections) {
              if (otherNotes.find(n => n.id === conn.note_id)) {
                await pool.query(
                  `INSERT INTO connections (source_note_id, target_note_id, relationship, confidence)
                   VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
                  [note.id, conn.note_id, conn.relationship, 0.8]
                );
              }
            }
          }

          for (const tag of result.tags || []) {
            await pool.query(
              `INSERT INTO tags (name, note_count) VALUES ($1, 1)
               ON CONFLICT (name) DO UPDATE SET note_count = tags.note_count + 1`,
              [tag]
            );
          }

          console.log(`[bg-processor] Processed note: ${note.title}`);
        } catch (e) {
          console.error(`[bg-processor] Failed to process note ${row.id}:`, e.message);
        }
      }
    } catch (e) {
      console.error('[bg-processor] Query failed:', e.message);
    }
  }, 30000);

  console.log('[bg-processor] Background AI processor started (30s interval)');
}

setTimeout(startBackgroundProcessor, 5000);

export { router as aiRouter };
