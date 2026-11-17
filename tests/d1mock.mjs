// Minimální náhrada Cloudflare D1 nad vestavěným node:sqlite — pro testy Functions
// bez sahání na ostrou databázi. Pokrývá prepare/bind/first/all/run a batch.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

export function makeD1(schemaFiles = []) {
  const db = new DatabaseSync(':memory:');
  for (const f of schemaFiles) db.exec(readFileSync(f, 'utf8'));
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => { const r = db.prepare(sql).run(...args); return { meta: { changes: r.changes } }; },
    _exec: () => db.prepare(sql).run(...args)
  });
  return {
    raw: db,
    prepare: sql => stmt(sql),
    batch: async list => { db.exec('BEGIN'); try { const out = list.map(s => s._exec()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; } }
  };
}
