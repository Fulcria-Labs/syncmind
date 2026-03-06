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

export { router as dataRouter };
