-- SyncMind: AI Research Assistant Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE PUBLICATION powersync FOR ALL TABLES;

-- Research notes table (TEXT columns for PowerSync compatibility)
CREATE TABLE notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    source_url TEXT DEFAULT '',
    tags TEXT DEFAULT '',
    ai_summary TEXT DEFAULT '',
    ai_tags TEXT DEFAULT '',
    ai_connections TEXT DEFAULT '',
    is_processed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT '',
    updated_at TEXT DEFAULT '',
    owner_id TEXT NOT NULL DEFAULT 'default'
);

-- AI-generated insights linking notes
CREATE TABLE connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_note_id TEXT NOT NULL,
    target_note_id TEXT NOT NULL,
    relationship TEXT NOT NULL DEFAULT '',
    confidence REAL DEFAULT 0.0,
    created_at TEXT DEFAULT ''
);

-- Search/tag index for quick offline queries
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    note_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT ''
);
