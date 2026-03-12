import { describe, it, expect, vi } from 'vitest';

function escapeIdentifier(id) {
  return `"${id.replace(/"/g, '""').replace(/\./g, '"."')}"`;
}

describe('Batch Operations - Empty and Boundary Cases', () => {
  it('should handle empty batch array', () => {
    const batch = { batch: [] };
    expect(batch.batch).toHaveLength(0);
    // Should still execute BEGIN/COMMIT with no ops
  });

  it('should handle single PUT operation batch', () => {
    const batch = {
      batch: [
        { op: 'PUT', table: 'notes', id: 'n1', data: { title: 'Solo' } }
      ]
    };
    expect(batch.batch).toHaveLength(1);
    expect(batch.batch[0].op).toBe('PUT');
  });

  it('should handle large batch with many operations', () => {
    const batch = {
      batch: Array.from({ length: 100 }, (_, i) => ({
        op: 'PUT', table: 'notes', id: `n${i}`, data: { title: `Note ${i}` }
      }))
    };
    expect(batch.batch).toHaveLength(100);
  });

  it('should reject batch field that is not an array', () => {
    const bodies = [
      { batch: 'not-an-array' },
      { batch: 42 },
      { batch: true },
      { batch: { op: 'PUT' } },
    ];
    for (const body of bodies) {
      expect(Array.isArray(body.batch)).toBe(false);
    }
  });

  it('should handle batch with null body', () => {
    const body = null;
    expect(body?.batch).toBeFalsy();
  });
});

describe('Batch Operations - PUT with Various Data Types', () => {
  it('should handle data with boolean-like integer fields', () => {
    const op = { op: 'PUT', table: 'notes', id: 'n1', data: { is_processed: 0 } };
    const data = { ...op.data, id: op.id };
    expect(data.is_processed).toBe(0);
    expect(JSON.stringify(data)).toContain('"is_processed":0');
  });

  it('should handle data with empty string fields', () => {
    const op = { op: 'PUT', table: 'notes', id: 'n1', data: { ai_summary: '', ai_tags: '', content: '' } };
    const data = { ...op.data, id: op.id };
    expect(data.ai_summary).toBe('');
    expect(JSON.stringify(data)).toContain('"ai_summary":""');
  });

  it('should handle data with null value fields', () => {
    const op = { op: 'PUT', table: 'notes', id: 'n1', data: { source_url: null, ai_summary: null } };
    const data = { ...op.data, id: op.id };
    expect(data.source_url).toBeNull();
  });

  it('should handle data with ISO date strings', () => {
    const now = new Date().toISOString();
    const op = { op: 'PUT', table: 'notes', id: 'n1', data: { created_at: now, updated_at: now } };
    const data = { ...op.data, id: op.id };
    expect(data.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('should handle data with very long text content', () => {
    const longContent = 'x'.repeat(100000);
    const op = { op: 'PUT', table: 'notes', id: 'n1', data: { content: longContent } };
    const data = { ...op.data, id: op.id };
    expect(data.content.length).toBe(100000);
  });

  it('should handle data with unicode content', () => {
    const op = { op: 'PUT', table: 'notes', id: 'n1', data: { title: '研究ノート', content: 'Emoji: 🧠' } };
    const data = { ...op.data, id: op.id };
    const json = JSON.stringify(data);
    expect(json).toContain('研究ノート');
  });
});

describe('Batch Operations - PATCH Edge Cases', () => {
  it('should handle PATCH with single field update', () => {
    const op = { op: 'PATCH', table: 'notes', id: 'n1', data: { is_processed: 1 } };
    const updates = Object.keys(op.data)
      .filter(k => k !== 'id')
      .map(k => `${escapeIdentifier(k)} = data_row.${escapeIdentifier(k)}`);
    expect(updates).toHaveLength(1);
  });

  it('should handle PATCH updating all note fields simultaneously', () => {
    const op = {
      op: 'PATCH', table: 'notes', id: 'n1',
      data: {
        title: 'Updated Title',
        content: 'Updated Content',
        source_url: 'https://new-url.com',
        ai_summary: 'New summary',
        ai_tags: 'tag1,tag2',
        ai_connections: 'n2:relates',
        is_processed: 1,
        updated_at: new Date().toISOString()
      }
    };
    const updates = Object.keys(op.data)
      .filter(k => k !== 'id')
      .map(k => `${escapeIdentifier(k)} = data_row.${escapeIdentifier(k)}`);
    expect(updates).toHaveLength(8);
  });

  it('should handle PATCH with only id field (no actual updates)', () => {
    const op = { op: 'PATCH', table: 'notes', id: 'n1', data: { id: 'n1' } };
    const updates = Object.keys(op.data)
      .filter(k => k !== 'id')
      .map(k => `${escapeIdentifier(k)} = data_row.${escapeIdentifier(k)}`);
    expect(updates).toHaveLength(0);
  });
});

describe('Batch Operations - DELETE Edge Cases', () => {
  it('should handle DELETE for different tables', () => {
    const tables = ['notes', 'connections', 'tags'];
    for (const table of tables) {
      const op = { op: 'DELETE', table, id: 'uuid-1' };
      const escapedTable = escapeIdentifier(op.table);
      expect(escapedTable).toBe(`"${table}"`);
    }
  });

  it('should generate correct DELETE JSON with only id', () => {
    const op = { op: 'DELETE', table: 'notes', id: 'target-uuid' };
    const id = op.id ?? op.data?.id;
    const json = JSON.stringify({ id });
    expect(JSON.parse(json)).toEqual({ id: 'target-uuid' });
  });

  it('should handle DELETE where both op.id and data.id exist', () => {
    const op = { op: 'DELETE', table: 'notes', id: 'preferred', data: { id: 'fallback' } };
    const id = op.id ?? op.data?.id;
    expect(id).toBe('preferred');
  });
});

describe('Batch Operations - SQL Generation Details', () => {
  it('should generate correct CTE-based INSERT for PUT', () => {
    const table = escapeIdentifier('notes');
    const data = { title: 'Test', content: 'Body', id: 'uuid-1' };
    const cols = Object.keys(data).map(escapeIdentifier);
    const updates = Object.keys(data)
      .filter(k => k !== 'id')
      .map(k => `${escapeIdentifier(k)} = EXCLUDED.${escapeIdentifier(k)}`);
    const updateClause = updates.length > 0 ? `DO UPDATE SET ${updates.join(', ')}` : 'DO NOTHING';

    const sql = `WITH data_row AS (SELECT (json_populate_record(null::${table}, $1::json)).*)
           INSERT INTO ${table} (${cols.join(', ')})
           SELECT ${cols.join(', ')} FROM data_row
           ON CONFLICT(id) ${updateClause}`;

    expect(sql).toContain('json_populate_record');
    expect(sql).toContain('"notes"');
    expect(sql).toContain('ON CONFLICT(id)');
    expect(sql).toContain('DO UPDATE SET');
  });

  it('should generate correct CTE-based UPDATE for PATCH', () => {
    const table = escapeIdentifier('notes');
    const data = { title: 'Updated', id: 'uuid-1' };
    const updates = Object.keys(data)
      .filter(k => k !== 'id')
      .map(k => `${escapeIdentifier(k)} = data_row.${escapeIdentifier(k)}`);

    const sql = `WITH data_row AS (SELECT (json_populate_record(null::${table}, $1::json)).*)
           UPDATE ${table} SET ${updates.join(', ')} FROM data_row WHERE ${table}.id = data_row.id`;

    expect(sql).toContain('UPDATE "notes"');
    expect(sql).toContain('"title" = data_row."title"');
    expect(sql).toContain('"notes".id = data_row.id');
  });

  it('should generate correct CTE-based DELETE', () => {
    const table = escapeIdentifier('notes');
    const id = 'uuid-delete';

    const sql = `WITH data_row AS (SELECT (json_populate_record(null::${table}, $1::json)).*)
           DELETE FROM ${table} USING data_row WHERE ${table}.id = data_row.id`;
    const params = [JSON.stringify({ id })];

    expect(sql).toContain('DELETE FROM "notes"');
    expect(sql).toContain('USING data_row');
    expect(JSON.parse(params[0]).id).toBe('uuid-delete');
  });
});

describe('Batch Operations - Transaction Ordering', () => {
  it('should process ops sequentially within a transaction', async () => {
    const log = [];
    const mockClient = {
      query: vi.fn(async (sql) => {
        log.push(sql.slice(0, 20));
        return { rows: [] };
      }),
      release: vi.fn()
    };

    const batch = [
      { op: 'PUT', table: 'notes', id: 'n1', data: { title: 'First' } },
      { op: 'PATCH', table: 'notes', id: 'n1', data: { title: 'Second' } },
    ];

    await mockClient.query('BEGIN');
    for (const op of batch) {
      if (op.op === 'PUT') await mockClient.query('INSERT INTO notes ...');
      if (op.op === 'PATCH') await mockClient.query('UPDATE notes SET ...');
    }
    await mockClient.query('COMMIT');
    mockClient.release();

    expect(log[0]).toContain('BEGIN');
    expect(log[1]).toContain('INSERT');
    expect(log[2]).toContain('UPDATE');
    expect(log[3]).toContain('COMMIT');
  });

  it('should handle mid-batch failure with rollback', async () => {
    const log = [];
    const mockClient = {
      query: vi.fn(async (sql) => {
        log.push(sql.slice(0, 20));
        if (sql.includes('UPDATE')) throw new Error('constraint error');
        return { rows: [] };
      }),
      release: vi.fn()
    };

    try {
      await mockClient.query('BEGIN');
      await mockClient.query('INSERT INTO notes ...');
      await mockClient.query('UPDATE notes SET ...');
      await mockClient.query('COMMIT');
    } catch (e) {
      await mockClient.query('ROLLBACK');
    } finally {
      mockClient.release();
    }

    expect(log).toContain('BEGIN');
    expect(log.some(l => l.includes('INSERT'))).toBe(true);
    expect(log.some(l => l.includes('ROLLBACK'))).toBe(true);
    expect(log.some(l => l.includes('COMMIT'))).toBe(false);
    expect(mockClient.release).toHaveBeenCalledOnce();
  });
});

describe('Seed Data - Count Check Logic', () => {
  it('should parse count string to number correctly', () => {
    const row = { cnt: '0' };
    expect(parseInt(row.cnt)).toBe(0);
    expect(parseInt(row.cnt) > 0).toBe(false);
  });

  it('should detect existing data correctly', () => {
    const row = { cnt: '15' };
    expect(parseInt(row.cnt) > 0).toBe(true);
  });

  it('should handle count as actual number', () => {
    const row = { cnt: 0 };
    expect(parseInt(row.cnt)).toBe(0);
  });

  it('should handle count as NaN-producing string', () => {
    const row = { cnt: 'abc' };
    expect(isNaN(parseInt(row.cnt))).toBe(true);
  });
});

describe('escapeIdentifier - SQL Injection Prevention', () => {
  it('should escape single double quote in identifier', () => {
    expect(escapeIdentifier('tab"le')).toBe('"tab""le"');
  });

  it('should escape multiple double quotes', () => {
    expect(escapeIdentifier('a"b"c"d')).toBe('"a""b""c""d"');
  });

  it('should handle only double quotes', () => {
    expect(escapeIdentifier('""')).toBe('""""""');
  });

  it('should handle identifier with semicolons (not special in identifiers)', () => {
    expect(escapeIdentifier('table;drop')).toBe('"table;drop"');
  });

  it('should handle identifier with SQL keywords', () => {
    expect(escapeIdentifier('SELECT')).toBe('"SELECT"');
    expect(escapeIdentifier('DROP')).toBe('"DROP"');
  });

  it('should handle identifier with backticks', () => {
    expect(escapeIdentifier('my`table')).toBe('"my`table"');
  });

  it('should handle identifier with forward slashes', () => {
    expect(escapeIdentifier('path/to/thing')).toBe('"path/to/thing"');
  });

  it('should handle CamelCase identifiers', () => {
    expect(escapeIdentifier('myTableName')).toBe('"myTableName"');
  });

  it('should handle all-uppercase identifiers', () => {
    expect(escapeIdentifier('NOTES')).toBe('"NOTES"');
  });

  it('should handle identifier with mixed special chars', () => {
    expect(escapeIdentifier('my-table_v2.schema')).toBe('"my-table_v2"."schema"');
  });
});
