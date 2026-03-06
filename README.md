# SyncMind - AI Research Assistant

An offline-first AI research assistant that syncs across devices. Built with PowerSync, React, and Claude AI.

## Features

- **Offline-First**: Create and browse research notes without internet. Changes sync automatically when connectivity returns.
- **AI-Powered Analysis**: Notes are automatically summarized, tagged, and connected by AI.
- **Knowledge Graph**: AI discovers relationships between your notes, building a connected knowledge base.
- **Ask Your Research**: Query across all your notes using natural language.
- **Cross-Device Sync**: PowerSync keeps data in sync across all your devices via Sync Streams.

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Sync Engine**: PowerSync (self-hosted) with Sync Streams
- **Backend**: Node.js + Express
- **AI**: Claude (Anthropic API) via Haiku for fast processing
- **Database**: PostgreSQL + MongoDB (PowerSync storage)
- **Local Storage**: SQLite (via PowerSync WASM)

## Quick Start

```bash
# 1. Clone and set up
git clone https://github.com/Fulcria-Labs/syncmind.git
cd syncmind

# 2. Set your Anthropic API key
export ANTHROPIC_API_KEY=your_key_here

# 3. Start all services
docker compose up -d

# 4. Install and run frontend
cd frontend && npm install && npm run dev
```

Open http://localhost:5173

## Architecture

```
Browser (SQLite) <--> PowerSync Service <--> PostgreSQL
                                                 ^
                                                 |
                                          Backend (Express)
                                                 |
                                           Claude AI API
```

PowerSync maintains a local SQLite database in the browser that syncs bidirectionally with PostgreSQL via Sync Streams. This enables:

1. **Instant reads**: All queries run against local SQLite
2. **Offline writes**: Changes queue locally and sync when online
3. **Real-time sync**: Changes from other devices appear automatically

## PowerSync Integration

- **Sync Streams** define what data syncs to each client (notes, connections, tags)
- **Backend Connector** handles JWT auth and CRUD upload to PostgreSQL
- **Local SQLite** provides instant, offline-capable queries
- The app works fully offline - AI features gracefully degrade when disconnected

## License

MIT
