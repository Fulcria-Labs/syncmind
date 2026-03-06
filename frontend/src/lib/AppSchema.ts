import { column, Schema, Table } from '@powersync/web';

const notes = new Table(
  {
    title: column.text,
    content: column.text,
    source_url: column.text,
    tags: column.text,
    ai_summary: column.text,
    ai_tags: column.text,
    ai_connections: column.text,
    is_processed: column.integer,
    created_at: column.text,
    updated_at: column.text,
    owner_id: column.text
  },
  { indexes: { owner: ['owner_id'] } }
);

const connections = new Table({
  source_note_id: column.text,
  target_note_id: column.text,
  relationship: column.text,
  confidence: column.real,
  created_at: column.text
});

const tags = new Table({
  name: column.text,
  note_count: column.integer,
  created_at: column.text
});

export const AppSchema = new Schema({ notes, connections, tags });

export type Database = (typeof AppSchema)['types'];
export type NoteRecord = Database['notes'];
export type ConnectionRecord = Database['connections'];
export type TagRecord = Database['tags'];
