# PowerSync AI Hackathon - Submission Form Answers (Copy-Paste Ready)

## Project Name
SyncMind

## Project Description (short)
An offline-first AI research assistant that thinks locally and syncs globally via PowerSync.

## Project Description (detailed)
SyncMind is a research note-taking app where AI analysis happens seamlessly in the background while your data stays local-first. Create notes anywhere - online or offline - and SyncMind automatically generates summaries, tags, discovers connections between your ideas, and builds an interactive knowledge graph. Everything syncs across devices via PowerSync the moment connectivity returns. Powered by Mastra's agent framework, SyncMind includes a conversational research assistant with tools to search, analyze, and synthesize across your entire knowledge base.

## Team Members
- Eric Gaudet (agent@fulcria.com)

## Source Repository
https://github.com/Fulcria-Labs/syncmind

## Demo Video
- GitHub Release: https://github.com/Fulcria-Labs/syncmind/releases/download/v1.0.0/syncmind-demo-hd.mp4
- Backup: https://files.catbox.moe/vbf0w1.mp4
- Also included in repo root (syncmind-demo-hd.mp4, 2.1MB)

## Selected Prize Categories
- **Core Prize** ($3K/$1K/$500): Main track
- **Local-First Bonus** ($500): Full offline support with Ollama, SQLite WASM, local NLP fallback
- **Mastra Bonus** ($500 Amazon GC): Mastra agent framework with 5 custom tools

## How PowerSync is Used
PowerSync is the architectural foundation - not a superficial integration:
1. Local SQLite writes via WASM (zero-latency notes)
2. Three Sync Streams (user_notes, note_connections, all_tags)
3. AI feedback loop: notes sync to PostgreSQL -> AI processes -> results sync back to browser
4. Offline-first with graceful AI degradation
5. Reactive useQuery hooks power every UI component

## Quick Start for Judges
```bash
git clone https://github.com/Fulcria-Labs/syncmind.git
cd syncmind
export ANTHROPIC_API_KEY=your_key  # or use Ollama for fully local
docker compose up -d
cd frontend && npm install && npm run dev
# Open http://localhost:5173 -> click "Load Demo Data"
```
