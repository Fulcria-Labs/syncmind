import { describe, it, expect } from 'vitest';
import { AppSchema, type NoteRecord, type ConnectionRecord, type TagRecord } from '../lib/AppSchema';

describe('AppSchema', () => {
  it('exports a valid schema', () => {
    expect(AppSchema).toBeDefined();
    expect(AppSchema.tables).toBeDefined();
  });

  it('defines exactly three tables', () => {
    expect(AppSchema.tables.length).toBe(3);
  });

  it('exports NoteRecord type (compile-time check)', () => {
    const note: Partial<NoteRecord> = {
      title: 'Test',
      content: 'Content',
      is_processed: 0,
    };
    expect(note.title).toBe('Test');
  });

  it('exports ConnectionRecord type (compile-time check)', () => {
    const conn: Partial<ConnectionRecord> = {
      source_note_id: 'a',
      target_note_id: 'b',
      relationship: 'related',
      confidence: 0.9,
    };
    expect(conn.relationship).toBe('related');
  });

  it('exports TagRecord type (compile-time check)', () => {
    const tag: Partial<TagRecord> = {
      name: 'AI',
      note_count: 5,
    };
    expect(tag.name).toBe('AI');
  });
});
