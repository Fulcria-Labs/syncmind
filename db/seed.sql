-- SyncMind Demo Seed Data
-- Run: docker compose exec postgres psql -U postgres -d syncmind -f /docker-entrypoint-initdb.d/seed.sql

INSERT INTO notes (id, title, content, source_url, ai_summary, ai_tags, is_processed, created_at, updated_at, owner_id) VALUES
(uuid_generate_v4(), 'Transformer Architecture Deep Dive',
 'The Transformer model, introduced in "Attention Is All You Need" (2017), replaced recurrence with self-attention. Key innovations:\n\n1. **Multi-Head Attention**: Allows the model to jointly attend to information from different representation subspaces.\n2. **Positional Encoding**: Sine/cosine functions inject sequence order without recurrence.\n3. **Layer Normalization**: Applied before each sub-layer for training stability.\n\nModern variants include GPT (decoder-only), BERT (encoder-only), and T5 (encoder-decoder).',
 'https://arxiv.org/abs/1706.03762',
 'Overview of the Transformer architecture covering multi-head attention, positional encoding, and modern variants like GPT and BERT.',
 'ai,machine-learning,transformers,attention,deep-learning',
 1, NOW()::text, NOW()::text, 'default'),

(uuid_generate_v4(), 'RAG: Retrieval Augmented Generation',
 'RAG combines retrieval systems with generative models to ground LLM responses in factual data.\n\n## How It Works\n1. **Indexing**: Documents are chunked and embedded into a vector store\n2. **Retrieval**: User query is embedded and matched against stored vectors\n3. **Generation**: Retrieved context is prepended to the prompt\n\n## Benefits\n- Reduces hallucination by grounding in source documents\n- No need to fine-tune the model on proprietary data\n- Can be updated in real-time by adding new documents\n\n## Challenges\n- Chunk size affects retrieval quality\n- Embedding model choice matters significantly\n- Context window limits how much retrieved text can be used',
 '',
 'Explains Retrieval Augmented Generation (RAG) - combining vector search with LLMs to reduce hallucination and ground responses in real data.',
 'ai,rag,retrieval,vector-search,llm',
 1, NOW()::text, NOW()::text, 'default'),

(uuid_generate_v4(), 'Offline-First Architecture Patterns',
 'Offline-first means the app works fully without a network, syncing when connectivity returns.\n\n## Key Patterns\n- **Local Database**: SQLite or IndexedDB stores data on-device\n- **Conflict Resolution**: Last-write-wins, CRDTs, or operational transforms\n- **Sync Engine**: PowerSync, CouchDB, or custom solutions\n- **Optimistic Updates**: UI reflects changes immediately before server confirmation\n\n## Why It Matters\n- Better UX: instant responses, no loading spinners\n- Works in low-connectivity environments\n- Reduces server load through batched syncs\n- Privacy: data stays local until explicitly synced',
 '',
 'Covers offline-first architecture including local databases, conflict resolution strategies, and sync engines like PowerSync.',
 'architecture,offline-first,sync,local-first,powersync',
 1, NOW()::text, NOW()::text, 'default'),

(uuid_generate_v4(), 'Knowledge Graphs for Research',
 'Knowledge graphs represent information as nodes (entities) and edges (relationships).\n\n## Applications in Research\n- **Literature mapping**: Connect papers by citations, topics, and authors\n- **Concept discovery**: Find unexpected connections between research areas\n- **Gap analysis**: Identify under-explored intersections\n\n## Tools\n- Neo4j: Full graph database\n- NetworkX: Python library for graph analysis\n- D3.js / Canvas: Browser-based visualization\n\n## In SyncMind\nWe use a force-directed graph layout where:\n- Nodes = research notes\n- Edges = AI-detected relationships\n- Colors = topic categories\n- Size = connection count',
 '',
 'Explores knowledge graph applications in research, including literature mapping, concept discovery, and visualization techniques.',
 'research,knowledge-graph,visualization,data',
 1, NOW()::text, NOW()::text, 'default'),

(uuid_generate_v4(), 'AI Agent Design Patterns',
 'Modern AI agents go beyond simple chat - they use tools, maintain state, and pursue goals autonomously.\n\n## Core Patterns\n1. **ReAct**: Reason then Act - interleave thinking with tool use\n2. **Tool Use**: Give the LLM access to APIs, databases, file systems\n3. **Memory**: Short-term (conversation) and long-term (vector store) memory\n4. **Planning**: Break complex tasks into sub-tasks with dependency tracking\n\n## Frameworks\n- **Mastra**: TypeScript-first with built-in tool routing and model switching\n- **LangGraph**: Stateful multi-actor graphs\n- **CrewAI**: Role-based multi-agent collaboration\n\n## Challenges\n- Reliability: agents can loop or hallucinate actions\n- Cost: complex chains use many tokens\n- Evaluation: hard to measure agent quality systematically',
 '',
 'Overview of AI agent design patterns including ReAct, tool use, memory systems, and frameworks like Mastra and LangGraph.',
 'ai,agents,mastra,tool-use,research',
 1, NOW()::text, NOW()::text, 'default'),

(uuid_generate_v4(), 'Vector Embeddings Explained',
 'Embeddings map discrete data (text, images) into continuous vector spaces where semantic similarity corresponds to geometric proximity.\n\n## Key Concepts\n- **Dimensionality**: Most models produce 384-1536 dimensional vectors\n- **Cosine Similarity**: Standard metric for comparing embeddings\n- **Chunking Strategy**: How you split documents affects retrieval quality\n\n## Popular Models\n| Model | Dims | Speed | Quality |\n|-------|------|-------|---------|\n| text-embedding-3-small | 1536 | Fast | Good |\n| BGE-M3 | 1024 | Medium | Excellent |\n| all-MiniLM-L6 | 384 | Very Fast | Decent |\n\n## Vector Databases\nPgvector, Pinecone, Weaviate, Qdrant, ChromaDB',
 '',
 'Explains vector embeddings, similarity metrics, popular embedding models, and vector database options for semantic search.',
 'ai,embeddings,vector-search,data,machine-learning',
 1, NOW()::text, NOW()::text, 'default');

-- Add connections between related notes
DO $$
DECLARE
  transformer_id UUID;
  rag_id UUID;
  offline_id UUID;
  graph_id UUID;
  agent_id UUID;
  embedding_id UUID;
BEGIN
  SELECT id INTO transformer_id FROM notes WHERE title = 'Transformer Architecture Deep Dive' LIMIT 1;
  SELECT id INTO rag_id FROM notes WHERE title = 'RAG: Retrieval Augmented Generation' LIMIT 1;
  SELECT id INTO offline_id FROM notes WHERE title = 'Offline-First Architecture Patterns' LIMIT 1;
  SELECT id INTO graph_id FROM notes WHERE title = 'Knowledge Graphs for Research' LIMIT 1;
  SELECT id INTO agent_id FROM notes WHERE title = 'AI Agent Design Patterns' LIMIT 1;
  SELECT id INTO embedding_id FROM notes WHERE title = 'Vector Embeddings Explained' LIMIT 1;

  INSERT INTO connections (id, source_note_id, target_note_id, relationship, confidence, created_at) VALUES
  (uuid_generate_v4(), transformer_id::text, rag_id::text, 'foundational architecture for', 0.92, NOW()::text),
  (uuid_generate_v4(), rag_id::text, embedding_id::text, 'relies on', 0.95, NOW()::text),
  (uuid_generate_v4(), agent_id::text, rag_id::text, 'uses for knowledge retrieval', 0.88, NOW()::text),
  (uuid_generate_v4(), graph_id::text, agent_id::text, 'informs memory design of', 0.78, NOW()::text),
  (uuid_generate_v4(), offline_id::text, graph_id::text, 'enables local-first', 0.82, NOW()::text),
  (uuid_generate_v4(), transformer_id::text, embedding_id::text, 'produces', 0.90, NOW()::text),
  (uuid_generate_v4(), agent_id::text, transformer_id::text, 'powered by', 0.93, NOW()::text);

  -- Update tag counts
  INSERT INTO tags (id, name, note_count, created_at) VALUES
  (uuid_generate_v4(), 'ai', 5, NOW()::text),
  (uuid_generate_v4(), 'machine-learning', 2, NOW()::text),
  (uuid_generate_v4(), 'research', 2, NOW()::text),
  (uuid_generate_v4(), 'data', 2, NOW()::text),
  (uuid_generate_v4(), 'vector-search', 2, NOW()::text),
  (uuid_generate_v4(), 'architecture', 1, NOW()::text),
  (uuid_generate_v4(), 'offline-first', 1, NOW()::text),
  (uuid_generate_v4(), 'powersync', 1, NOW()::text),
  (uuid_generate_v4(), 'knowledge-graph', 1, NOW()::text),
  (uuid_generate_v4(), 'agents', 1, NOW()::text),
  (uuid_generate_v4(), 'mastra', 1, NOW()::text),
  (uuid_generate_v4(), 'embeddings', 1, NOW()::text),
  (uuid_generate_v4(), 'rag', 1, NOW()::text),
  (uuid_generate_v4(), 'transformers', 1, NOW()::text)
  ON CONFLICT (name) DO UPDATE SET note_count = EXCLUDED.note_count;
END $$;
