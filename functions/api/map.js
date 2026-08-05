// Sdílené presety a projekty (náhrada map_api.php) — Cloudflare Pages Function + D1.
//
// Kontrakt drží PŘESNĚ původní PHP, aby appka fungovala bez úprav:
//   GET  /api/map?entity=presets            -> {ok:true, items:[…]}
//   POST /api/map?entity=presets            body {action:'replace', items:[…], deletedIds:[…]}
//        hlavička X-Api-Token (nebo body.token) -> {ok:true, count:N}
//
// Nejdůležitější je SLUČOVÁNÍ, ne přepis: druhé otevřené okno nesmí smazat
// presety, o kterých nic neví. Vyhrává novější updatedAt, mazání jde jen
// explicitně přes deletedIds (tombstones). D1 to modeluje po položkách, takže
// se to chová stejně jako původní merge nad JSON polem, jen bez souborového locku.
const ENTITIES = ['presets', 'projects'];
const MAX_BODY = 8 * 1024 * 1024;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

async function ensureTable(db) {
  await db.exec(
    'CREATE TABLE IF NOT EXISTS items (entity TEXT NOT NULL, id TEXT NOT NULL, ' +
    'json TEXT NOT NULL, updated_at INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (entity, id))'
  );
  // Náhrobky mazání. Bez nich se smazaná položka vracela: klient po odeslání zahodí
  // svůj záznam o smazání, a jakákoli JINÁ otevřená záložka nebo počítač, který má
  // v paměti ještě starý seznam, ji při svém dalším uložení pošle zpátky — a server
  // ji poslušně založí znovu. Teď si pamatuje, KDY co bylo smazáno, a zápis staršího
  // původu odmítne.
  await db.exec(
    'CREATE TABLE IF NOT EXISTS deletions (entity TEXT NOT NULL, id TEXT NOT NULL, ' +
    'deleted_at INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (entity, id))'
  );
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (!env.DB) return json({ ok: false, error: 'D1 binding DB chybí' }, 500);

  let body = {};
  if (request.method === 'POST') {
    const raw = await request.text();
    if (raw.length > MAX_BODY) return json({ ok: false, error: 'Payload too large' }, 413);
    if (raw.trim()) { try { const d = JSON.parse(raw); if (d && typeof d === 'object') body = d; } catch (_) {} }
  }

  const entity = String(url.searchParams.get('entity') || body.entity || '');
  const action = String(url.searchParams.get('action') || body.action || 'list');
  if (!ENTITIES.includes(entity)) return json({ ok: false, error: 'Invalid entity' }, 400);

  try {
    await ensureTable(env.DB);

    if (request.method === 'GET' || action === 'list') {
      const { results } = await env.DB.prepare('SELECT json FROM items WHERE entity = ?').bind(entity).all();
      const items = (results || []).map(r => { try { return JSON.parse(r.json); } catch (_) { return null; } }).filter(Boolean);
      return json({ ok: true, items });
    }

    if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);
    if (action !== 'replace') return json({ ok: false, error: 'Unsupported action' }, 400);

    // Token je Cloudflare secret, ne konstanta ve zdrojáku (na Forpsi byl v souboru).
    const expected = env.API_TOKEN || '';
    if (expected) {
      const provided = request.headers.get('X-Api-Token') || body.token || '';
      if (typeof provided !== 'string' || provided !== expected) {
        return json({ ok: false, error: 'Unauthorized' }, 401);
      }
    }

    if (!Array.isArray(body.items)) return json({ ok: false, error: 'Items must be an array' }, 400);

    const now = Date.now();
    const deleted = new Set(
      (Array.isArray(body.deletedIds) ? body.deletedIds : [])
        .filter(v => typeof v === 'string' || typeof v === 'number')
        .map(String)
    );

    const stmts = [];
    for (const raw of body.items) {
      if (!raw || typeof raw !== 'object') continue;
      const item = { ...raw };
      if (item.id == null || String(item.id).trim() === '') {
        item.id = `${entity}_${now.toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
      }
      const id = String(item.id);
      if (deleted.has(id)) continue;
      if (item.createdAt == null) item.createdAt = now;
      if (item.updatedAt == null) item.updatedAt = now;   // klientův updatedAt ctíme
      const ts = Number(item.updatedAt) || 0;
      // Novější (nebo stejně starý) zápis vyhrává — jinak zůstane uložená verze.
      // Poslední podmínka drží smazané položky smazané: když někdo pošle položku,
      // která je mezitím starší než její záznam o smazání, zápis se zahodí.
      stmts.push(
        env.DB.prepare(
          // INSERT ... SELECT (ne VALUES) — jen tahle podoba umí WHERE, kterým se
          // zápis zahodí, pokud pro tohle id existuje novější záznam o smazání.
          'INSERT INTO items (entity, id, json, updated_at) ' +
          'SELECT ?, ?, ?, ? WHERE NOT EXISTS (' +
          '  SELECT 1 FROM deletions d WHERE d.entity = ? AND d.id = ? AND d.deleted_at > ?) ' +
          'ON CONFLICT(entity, id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at ' +
          'WHERE excluded.updated_at >= items.updated_at'
        ).bind(entity, id, JSON.stringify(item), ts, entity, id, ts)
      );
    }
    for (const id of deleted) {
      stmts.push(env.DB.prepare('DELETE FROM items WHERE entity = ? AND id = ?').bind(entity, id));
      // Náhrobek si drží čas smazání, aby pozdější zápis staršího původu neprošel.
      stmts.push(
        env.DB.prepare(
          'INSERT INTO deletions (entity, id, deleted_at) VALUES (?, ?, ?) ' +
          'ON CONFLICT(entity, id) DO UPDATE SET deleted_at = excluded.deleted_at'
        ).bind(entity, id, now)
      );
    }
    if (stmts.length) await env.DB.batch(stmts);

    const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM items WHERE entity = ?').bind(entity).first();
    return json({ ok: true, count: Number(row?.n || 0) });
  } catch (e) {
    return json({ ok: false, error: String((e && e.message) || e) }, 500);
  }
}
