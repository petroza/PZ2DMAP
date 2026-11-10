// /api/map — presety a projekty. Stejný kontrakt jako původní map_api.php:
//   GET  ?entity=presets|projects      -> {ok:true, items:[…]}
//   POST {action:"replace", items:[…]} -> {ok:true, count:N}
// Appka posílá vždy celé pole najednou, žádné dílčí úpravy.
import { json, preflight, writeAllowed, readJson } from './_shared.js';
import { saveHistory } from './_history.js';

const ENTITIES = ['presets', 'projects'];

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return preflight();
  if (!env.DB) return json({ ok: false, error: 'Databáze není připojená.' }, 500);

  const url = new URL(request.url);
  const body = request.method === 'POST' ? await readJson(request) : {};
  const entity = String(url.searchParams.get('entity') || body.entity || '');
  const action = String(url.searchParams.get('action') || body.action || 'list');

  if (!ENTITIES.includes(entity)) return json({ ok: false, error: 'Invalid entity' }, 400);

  if (request.method === 'GET' || action === 'list') {
    const { results } = await env.DB
      .prepare('SELECT json FROM items WHERE entity = ? ORDER BY updated_at ASC')
      .bind(entity).all();
    const items = (results || []).map(r => { try { return JSON.parse(r.json); } catch { return null; } })
                                 .filter(Boolean);
    return json({ ok: true, items }, 200, { 'Cache-Control': 'no-store' });
  }

  if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);
  if (action !== 'replace')      return json({ ok: false, error: 'Unsupported action' }, 400);
  if (!writeAllowed(request, env, body)) return json({ ok: false, error: 'Unauthorized' }, 401);
  if (!Array.isArray(body.items)) return json({ ok: false, error: 'Items must be an array' }, 400);

  const now = Date.now();
  const items = body.items
    .filter(it => it && typeof it === 'object' && !Array.isArray(it))
    .map(it => ({
      ...it,
      id: String(it.id || '').trim() ||
          `${entity}_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: it.createdAt ?? now,
      updatedAt: now
    }));

  // Co veznovuposlaném seznamu chybí, bylo smazané — zapisuje se to do
  // deletions, aby se mazání dalo rozeznat od "ještě se to sem nedoneslo",
  // až se appka otevře na druhém počítači.
  const { results: had } = await env.DB
    .prepare('SELECT id, json FROM items WHERE entity = ?').bind(entity).all();
  const keep = new Set(items.map(i => i.id));
  const gone = (had || []).map(r => r.id).filter(id => !keep.has(id));

  // Ochrana proti hromadnému smazání. Appka maže po jedné položce; zápis, který
  // naráz zahodí většinu (a aspoň 3) položek, je skoro jistě chyba — typicky
  // prohlížeč, který se nenačetl ze serveru a pošle jen svůj krátký seznam —
  // nebo cizí požadavek. Vědomé hromadné mazání musí poslat allowBulkDelete.
  if (gone.length >= 3 && gone.length * 2 > (had || []).length && body.allowBulkDelete !== true) {
    return json({ ok: false, guard: 'bulk-delete', error:
      `Zápis by smazal ${gone.length} z ${(had || []).length} položek najednou — odmítnuto (ochrana dat).` }, 409);
  }

  // Předchozí stav do historie verzí (obnova v /admin).
  await saveHistory(env, entity, (had || []).map(r => r.json), 'zápis z appky');

  const stmts = [];
  for (const id of gone) {
    stmts.push(env.DB.prepare(
      'INSERT INTO deletions (entity, id, deleted_at) VALUES (?, ?, ?) ' +
      'ON CONFLICT(entity, id) DO UPDATE SET deleted_at = excluded.deleted_at'
    ).bind(entity, id, now));
  }
  stmts.push(env.DB.prepare('DELETE FROM items WHERE entity = ?').bind(entity));
  for (const it of items) {
    stmts.push(env.DB.prepare(
      'INSERT INTO items (entity, id, json, updated_at) VALUES (?, ?, ?, ?)'
    ).bind(entity, it.id, JSON.stringify(it), now));
  }
  await env.DB.batch(stmts);

  return json({ ok: true, count: items.length });
}
