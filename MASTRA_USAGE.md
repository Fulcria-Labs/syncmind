# Mastra Agent Integration

SyncMind uses the [Mastra AI framework](https://mastra.ai/) to power an intelligent Research Agent with 5 specialized tools.

## Agent Definition

**File**: `backend/src/api/mastra-agent.js`

### Agent: `syncmind-research-agent`

A tool-using conversational agent that searches, analyzes, and synthesizes research notes. Unlike simple Q&A, the agent autonomously decides which tools to call and chains them together for complex queries.

## Tools

| Tool | Purpose | Input | Output |
|------|---------|-------|--------|
| `search-notes` | Search notes by keyword/topic | `query`, `owner_id`, `limit` | Matching notes + AI summaries |
| `get-note-detail` | Retrieve full note + connections | `note_id` | Note content + linked notes |
| `list-all-notes` | Overview of entire collection | `owner_id`, `limit` | All notes with metadata |
| `get-tags` | Analyze research themes | — | Top 50 tags by frequency |
| `get-connection-graph` | Knowledge graph of relationships | `owner_id` | Top 100 connections by confidence |

## Multi-Step Reasoning Example

**User**: "How are my RAG and embeddings notes connected?"

**Agent automatically**:
1. Calls `search-notes(query="RAG")` — finds relevant notes
2. Calls `search-notes(query="embeddings")` — finds related notes
3. Calls `get-connection-graph()` — retrieves relationship data
4. Synthesizes findings across all results, citing specific notes

## Model Selection

The agent automatically selects the best available AI model:

| Condition | Model | Mode |
|-----------|-------|------|
| `ANTHROPIC_API_KEY` set | Claude Haiku 4.5 | Cloud |
| `OPENAI_API_KEY` set | GPT-4.1 Mini | Cloud |
| Neither set | Ollama (local) | Fully offline |

This means SyncMind's agentic capabilities work even without internet — the Mastra agent runs against locally-synced SQLite data with a local Ollama model.

## API Endpoints

### Chat with Agent
```
POST /api/ai/agent/chat
Body: { "message": "What are my main research themes?", "history": [], "owner_id": "default" }
Response: { "reply": "Based on your notes, your main themes are..." }
```

### Frontend Component
`frontend/src/components/AgentChat.tsx` — Floating action button in bottom-right corner with multi-turn conversation UI.

## Why Mastra?

- **Tool-using agents**: 5 research tools vs. simple prompt-response
- **Multi-step reasoning**: Complex queries decomposed into tool chains
- **Model agnostic**: Claude, OpenAI, or Ollama with zero code changes
- **Framework conventions**: Uses `createTool()` with Zod schemas for type-safe tool definitions
- **PowerSync synergy**: Agent queries the same PostgreSQL that PowerSync syncs, so research is always up-to-date across devices

## Testing

18 backend tests cover the Mastra agent integration:
```bash
cd backend && npm test
# Tests: agent chat responses, tool execution, offline fallback
```
