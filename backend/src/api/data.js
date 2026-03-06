import express from 'express';
import PG from 'pg';

const { Pool } = PG;
const router = express.Router();

const pool = new Pool({ connectionString: process.env.DATABASE_URI });

pool.on('error', (err) => {
  console.error('Pool connection failure:', err);
});

function escapeIdentifier(id) {
  return `"${id.replace(/"/g, '""').replace(/\./g, '"."')}"`;
}

router.post('/', async (req, res) => {
  if (!req.body?.batch) {
    return res.status(400).json({ message: 'Invalid body' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const op of req.body.batch) {
      const table = escapeIdentifier(op.table);

      if (op.op === 'PUT') {
        const data = { ...op.data, id: op.id ?? op.data.id };
        const cols = Object.keys(data).map(escapeIdentifier);
        const updates = Object.keys(op.data)
          .filter(k => k !== 'id')
          .map(k => `${escapeIdentifier(k)} = EXCLUDED.${escapeIdentifier(k)}`);

        const updateClause = updates.length > 0 ? `DO UPDATE SET ${updates.join(', ')}` : 'DO NOTHING';

        await client.query(
          `WITH data_row AS (SELECT (json_populate_record(null::${table}, $1::json)).*)
           INSERT INTO ${table} (${cols.join(', ')})
           SELECT ${cols.join(', ')} FROM data_row
           ON CONFLICT(id) ${updateClause}`,
          [JSON.stringify(data)]
        );
      } else if (op.op === 'PATCH') {
        const data = { ...op.data, id: op.id ?? op.data.id };
        const updates = Object.keys(op.data)
          .filter(k => k !== 'id')
          .map(k => `${escapeIdentifier(k)} = data_row.${escapeIdentifier(k)}`);

        await client.query(
          `WITH data_row AS (SELECT (json_populate_record(null::${table}, $1::json)).*)
           UPDATE ${table} SET ${updates.join(', ')} FROM data_row WHERE ${table}.id = data_row.id`,
          [JSON.stringify(data)]
        );
      } else if (op.op === 'DELETE') {
        const id = op.id ?? op.data?.id;
        await client.query(
          `WITH data_row AS (SELECT (json_populate_record(null::${table}, $1::json)).*)
           DELETE FROM ${table} USING data_row WHERE ${table}.id = data_row.id`,
          [JSON.stringify({ id })]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Batch completed' });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Batch failed:', e.message);
    res.status(400).json({ message: e.message });
  } finally {
    client.release();
  }
});

// Seed demo data - one-click population for judges
router.post('/seed', async (req, res) => {
  const client = await pool.connect();
  try {
    const existing = await client.query('SELECT COUNT(*) as cnt FROM notes');
    if (parseInt(existing.rows[0].cnt) > 0) {
      return res.json({ message: 'Data already exists', seeded: false });
    }

    await client.query('BEGIN');

    const notes = [
      { title: 'Transformer Architecture Deep Dive', content: 'The Transformer model, introduced in "Attention Is All You Need" (2017), replaced recurrence with self-attention. Key innovations:\n\n1. **Multi-Head Attention**: Allows the model to jointly attend to information from different representation subspaces.\n2. **Positional Encoding**: Sine/cosine functions inject sequence order without recurrence.\n3. **Layer Normalization**: Applied before each sub-layer for training stability.\n\nModern variants include GPT (decoder-only), BERT (encoder-only), and T5 (encoder-decoder).', source_url: 'https://arxiv.org/abs/1706.03762', ai_summary: 'Overview of the Transformer architecture covering multi-head attention, positional encoding, and modern variants like GPT and BERT.', ai_tags: 'ai,machine-learning,transformers,attention,deep-learning' },
      { title: 'RAG: Retrieval Augmented Generation', content: 'RAG combines retrieval systems with generative models to ground LLM responses in factual data.\n\n## How It Works\n1. **Indexing**: Documents are chunked and embedded into a vector store\n2. **Retrieval**: User query is embedded and matched against stored vectors\n3. **Generation**: Retrieved context is prepended to the prompt\n\n## Benefits\n- Reduces hallucination by grounding in source documents\n- No need to fine-tune the model on proprietary data\n- Can be updated in real-time by adding new documents', ai_summary: 'Explains RAG - combining vector search with LLMs to reduce hallucination and ground responses in real data.', ai_tags: 'ai,rag,retrieval,vector-search,llm' },
      { title: 'Offline-First Architecture Patterns', content: 'Offline-first means the app works fully without a network, syncing when connectivity returns.\n\n## Key Patterns\n- **Local Database**: SQLite or IndexedDB stores data on-device\n- **Conflict Resolution**: Last-write-wins, CRDTs, or operational transforms\n- **Sync Engine**: PowerSync, CouchDB, or custom solutions\n- **Optimistic Updates**: UI reflects changes immediately before server confirmation', ai_summary: 'Covers offline-first architecture including local databases, conflict resolution strategies, and sync engines like PowerSync.', ai_tags: 'architecture,offline-first,sync,local-first,powersync' },
      { title: 'Knowledge Graphs for Research', content: 'Knowledge graphs represent information as nodes (entities) and edges (relationships).\n\n## Applications in Research\n- **Literature mapping**: Connect papers by citations, topics, and authors\n- **Concept discovery**: Find unexpected connections between research areas\n- **Gap analysis**: Identify under-explored intersections\n\n## In SyncMind\nWe use a force-directed graph layout where nodes = research notes, edges = AI-detected relationships, colors = topic categories.', ai_summary: 'Explores knowledge graph applications in research, including literature mapping and visualization techniques.', ai_tags: 'research,knowledge-graph,visualization,data' },
      { title: 'AI Agent Design Patterns', content: 'Modern AI agents go beyond simple chat - they use tools, maintain state, and pursue goals autonomously.\n\n## Core Patterns\n1. **ReAct**: Reason then Act - interleave thinking with tool use\n2. **Tool Use**: Give the LLM access to APIs, databases, file systems\n3. **Memory**: Short-term (conversation) and long-term (vector store) memory\n4. **Planning**: Break complex tasks into sub-tasks with dependency tracking\n\n## Frameworks\n- **Mastra**: TypeScript-first with built-in tool routing and model switching\n- **LangGraph**: Stateful multi-actor graphs', ai_summary: 'Overview of AI agent design patterns including ReAct, tool use, memory systems, and frameworks like Mastra.', ai_tags: 'ai,agents,mastra,tool-use,research' },
      { title: 'Vector Embeddings Explained', content: 'Embeddings map discrete data (text, images) into continuous vector spaces where semantic similarity corresponds to geometric proximity.\n\n## Key Concepts\n- **Dimensionality**: Most models produce 384-1536 dimensional vectors\n- **Cosine Similarity**: Standard metric for comparing embeddings\n- **Chunking Strategy**: How you split documents affects retrieval quality\n\n## Popular Models\n- text-embedding-3-small (1536 dims, fast)\n- BGE-M3 (1024 dims, excellent quality)\n- all-MiniLM-L6 (384 dims, very fast)', ai_summary: 'Explains vector embeddings, similarity metrics, popular embedding models, and vector database options.', ai_tags: 'ai,embeddings,vector-search,data,machine-learning' },
    ];

    const noteIds = [];
    for (const n of notes) {
      const r = await client.query(
        `INSERT INTO notes (id, title, content, source_url, ai_summary, ai_tags, is_processed, created_at, updated_at, owner_id)
         VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, 1, NOW()::text, NOW()::text, 'default') RETURNING id`,
        [n.title, n.content, n.source_url || '', n.ai_summary, n.ai_tags]
      );
      noteIds.push(r.rows[0].id);
    }

    const conns = [
      [0, 1, 'foundational architecture for', 0.92],
      [1, 5, 'relies on', 0.95],
      [4, 1, 'uses for knowledge retrieval', 0.88],
      [3, 4, 'informs memory design of', 0.78],
      [2, 3, 'enables local-first', 0.82],
      [0, 5, 'produces', 0.90],
      [4, 0, 'powered by', 0.93],
    ];
    for (const [s, t, rel, conf] of conns) {
      await client.query(
        `INSERT INTO connections (id, source_note_id, target_note_id, relationship, confidence, created_at)
         VALUES (uuid_generate_v4(), $1, $2, $3, $4, NOW()::text)`,
        [noteIds[s].toString(), noteIds[t].toString(), rel, conf]
      );
    }

    const tags = [
      ['ai', 5], ['machine-learning', 2], ['research', 2], ['data', 2],
      ['vector-search', 2], ['architecture', 1], ['offline-first', 1],
      ['powersync', 1], ['knowledge-graph', 1], ['agents', 1],
      ['mastra', 1], ['embeddings', 1], ['rag', 1], ['transformers', 1],
    ];
    for (const [name, count] of tags) {
      await client.query(
        `INSERT INTO tags (id, name, note_count, created_at) VALUES (uuid_generate_v4(), $1, $2, NOW()::text)
         ON CONFLICT (name) DO UPDATE SET note_count = EXCLUDED.note_count`,
        [name, count]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Demo data loaded', seeded: true, notes: noteIds.length });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', e.message);
    res.status(500).json({ message: e.message });
  } finally {
    client.release();
  }
});

export { router as dataRouter };
