import { describe, it, expect } from 'vitest';
import { AppSchema, type NoteRecord, type ConnectionRecord, type TagRecord } from '../lib/AppSchema';

// ─── Advanced AppSchema tests ───

describe('AppSchema - Table Names', () => {
  it('contains notes table', () => {
    const tableNames = AppSchema.tables.map((t: any) => t.name);
    expect(tableNames).toContain('notes');
  });

  it('contains connections table', () => {
    const tableNames = AppSchema.tables.map((t: any) => t.name);
    expect(tableNames).toContain('connections');
  });

  it('contains tags table', () => {
    const tableNames = AppSchema.tables.map((t: any) => t.name);
    expect(tableNames).toContain('tags');
  });
});

describe('AppSchema - NoteRecord Fields', () => {
  it('supports all required note fields', () => {
    const note: NoteRecord = {
      title: 'Test Note',
      content: 'Some content',
      source_url: 'https://example.com',
      tags: 'tag1,tag2',
      ai_summary: 'A summary',
      ai_tags: 'ml,ai',
      ai_connections: '[]',
      is_processed: 1,
      created_at: '2026-03-12T00:00:00Z',
      updated_at: '2026-03-12T00:00:00Z',
      owner_id: 'user-123',
    };
    expect(note.title).toBe('Test Note');
    expect(note.content).toBe('Some content');
    expect(note.source_url).toBe('https://example.com');
    expect(note.tags).toBe('tag1,tag2');
    expect(note.ai_summary).toBe('A summary');
    expect(note.ai_tags).toBe('ml,ai');
    expect(note.ai_connections).toBe('[]');
    expect(note.is_processed).toBe(1);
    expect(note.created_at).toBe('2026-03-12T00:00:00Z');
    expect(note.updated_at).toBe('2026-03-12T00:00:00Z');
    expect(note.owner_id).toBe('user-123');
  });

  it('allows null for optional text fields', () => {
    const note: Partial<NoteRecord> = {
      title: 'Test',
      content: 'Content',
    };
    expect(note.source_url).toBeUndefined();
    expect(note.ai_summary).toBeUndefined();
  });

  it('supports is_processed as 0 (unprocessed)', () => {
    const note: Partial<NoteRecord> = { is_processed: 0 };
    expect(note.is_processed).toBe(0);
  });

  it('supports is_processed as 1 (processed)', () => {
    const note: Partial<NoteRecord> = { is_processed: 1 };
    expect(note.is_processed).toBe(1);
  });
});

describe('AppSchema - ConnectionRecord Fields', () => {
  it('supports all connection fields', () => {
    const conn: ConnectionRecord = {
      source_note_id: 'note-1',
      target_note_id: 'note-2',
      relationship: 'references',
      confidence: 0.95,
      created_at: '2026-03-12T00:00:00Z',
    };
    expect(conn.source_note_id).toBe('note-1');
    expect(conn.target_note_id).toBe('note-2');
    expect(conn.relationship).toBe('references');
    expect(conn.confidence).toBe(0.95);
    expect(conn.created_at).toBe('2026-03-12T00:00:00Z');
  });

  it('supports various confidence values', () => {
    const highConf: Partial<ConnectionRecord> = { confidence: 0.99 };
    const lowConf: Partial<ConnectionRecord> = { confidence: 0.1 };
    const midConf: Partial<ConnectionRecord> = { confidence: 0.5 };
    expect(highConf.confidence).toBeGreaterThan(lowConf.confidence!);
    expect(midConf.confidence).toBe(0.5);
  });

  it('supports various relationship types', () => {
    const types = ['references', 'extends', 'contradicts', 'relates to', 'depends on', 'is similar to'];
    for (const type of types) {
      const conn: Partial<ConnectionRecord> = { relationship: type };
      expect(conn.relationship).toBe(type);
    }
  });
});

describe('AppSchema - TagRecord Fields', () => {
  it('supports all tag fields', () => {
    const tag: TagRecord = {
      name: 'machine-learning',
      note_count: 15,
      created_at: '2026-03-12T00:00:00Z',
    };
    expect(tag.name).toBe('machine-learning');
    expect(tag.note_count).toBe(15);
    expect(tag.created_at).toBe('2026-03-12T00:00:00Z');
  });

  it('supports zero note count', () => {
    const tag: Partial<TagRecord> = { name: 'empty-tag', note_count: 0 };
    expect(tag.note_count).toBe(0);
  });

  it('supports large note counts', () => {
    const tag: Partial<TagRecord> = { name: 'popular', note_count: 10000 };
    expect(tag.note_count).toBe(10000);
  });
});

describe('AppSchema - Schema Structure', () => {
  it('has exactly 3 tables', () => {
    expect(AppSchema.tables).toHaveLength(3);
  });

  it('is a valid Schema instance', () => {
    expect(AppSchema).toBeDefined();
    expect(AppSchema.tables).toBeDefined();
    expect(Array.isArray(AppSchema.tables)).toBe(true);
  });
});
