// Historie verzí presetů a projektů. Před každým zápisem se uloží celý
// předchozí stav entity, takže se dá vrátit kterýkoli z posledních zápisů
// (přehled /admin → Historie). Bez placených služeb, jen D1.
export const HISTORY_DDL = `CREATE TABLE IF NOT EXISTS items_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity TEXT NOT NULL, saved_at INTEGER NOT NULL, count INTEGER NOT NULL,
  hash TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '', json TEXT NOT NULL)`;

const KEEP_LAST = 300;        // nejvýš tolik verzí na entitu
const KEEP_DAYS = 30;         // starší než 30 dní se mažou…
const KEEP_MIN = 50;          // …ale posledních 50 zůstane vždy

async function sha256(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// jsonRows = pole JSON řetězců jednotlivých položek (tak, jak leží v items.json)
export async function saveHistory(env, entity, jsonRows, reason = '') {
  if (!env.DB || !jsonRows || !jsonRows.length) return;
  const payload = '[' + jsonRows.join(',') + ']';
  const hash = await sha256(payload);
  const run = async () => {
    const last = await env.DB.prepare('SELECT hash FROM items_history WHERE entity = ? ORDER BY id DESC LIMIT 1').bind(entity).first();
    if (last && last.hash === hash) return;            // stejný stav už uložený je
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare('INSERT INTO items_history (entity, saved_at, count, hash, reason, json) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(entity, now, jsonRows.length, hash, String(reason).slice(0, 60), payload),
      env.DB.prepare(`DELETE FROM items_history WHERE entity = ?1 AND (
          id NOT IN (SELECT id FROM items_history WHERE entity = ?1 ORDER BY id DESC LIMIT ${KEEP_LAST})
          OR (saved_at < ?2 AND id NOT IN (SELECT id FROM items_history WHERE entity = ?1 ORDER BY id DESC LIMIT ${KEEP_MIN})))`)
        .bind(entity, now - KEEP_DAYS * 86400000)
    ]);
  };
  // Historie nikdy nesmí shodit samotné uložení (chybějící tabulka, příliš velký řádek…).
  try { await run(); }
  catch (_) { try { await env.DB.prepare(HISTORY_DDL).run(); await run(); } catch (e) { console.warn('history', String(e)); } }
}

export async function listHistory(env, limit = 60) {
  try {
    const { results } = await env.DB.prepare(
      'SELECT id, entity, saved_at, count, reason FROM items_history ORDER BY id DESC LIMIT ?').bind(limit).all();
    return results || [];
  } catch (_) { return []; }
}

// Vrátí entitu do stavu z verze `id`. Současný stav se předtím sám uloží do historie.
export async function restoreHistory(env, id) {
  const row = await env.DB.prepare('SELECT entity, json FROM items_history WHERE id = ?').bind(id).first();
  if (!row) return { ok: false, error: 'Verze nenalezena.' };
  let items; try { items = JSON.parse(row.json); } catch { return { ok: false, error: 'Verze je poškozená.' }; }
  const { results: cur } = await env.DB.prepare('SELECT json FROM items WHERE entity = ?').bind(row.entity).all();
  await saveHistory(env, row.entity, (cur || []).map(r => r.json), 'před obnovou verze #' + id);
  const now = Date.now();
  const stmts = [env.DB.prepare('DELETE FROM items WHERE entity = ?').bind(row.entity)];
  for (const it of items) {
    if (!it || !it.id) continue;
    stmts.push(env.DB.prepare('INSERT INTO items (entity, id, json, updated_at) VALUES (?, ?, ?, ?)')
      .bind(row.entity, String(it.id), JSON.stringify({ ...it, updatedAt: now }), now));
    // obnovená položka už není smazaná — jinak by ji appka podle tombstonu zase zahodila
    stmts.push(env.DB.prepare('DELETE FROM deletions WHERE entity = ? AND id = ?').bind(row.entity, String(it.id)));
  }
  await env.DB.batch(stmts);
  return { ok: true, entity: row.entity, count: items.length };
}
