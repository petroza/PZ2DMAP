// Sběr statistik z appky (pro /admin).
// Appka posílá PŘÍRŮSTKY (co se stalo od posledního odeslání), ne absolutní čísla —
// jinak by dva otevřené panely nebo reload čísla rozhodily. Server přírůstky
// přičítá k dnešnímu řádku daného klienta.
//
// POST /api/usage  {clientId, name?, seconds?, exports?, routes?, chat?}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

// Strop na jedno odeslání: bez něj by stačil jeden podvržený request a statistiky
// jsou k ničemu. 15 min aktivního času / 50 akcí je nad rámec reálného intervalu.
const cap = (v, max) => {
  const n = Math.floor(Number(v) || 0);
  return n > 0 ? Math.min(n, max) : 0;
};

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (request.method !== 'POST') return json({ ok: false, error: 'Použij POST.' }, 405);
  if (!env.DB) return json({ ok: false, error: 'D1 binding DB chybí' }, 500);

  let b = {};
  try { b = await request.json(); } catch (_) { return json({ ok: false, error: 'Neplatný JSON.' }, 400); }

  const clientId = String(b.clientId || '').slice(0, 64).replace(/[^\w-]/g, '');
  if (!clientId) return json({ ok: false, error: 'Chybí clientId.' }, 400);
  const name = String(b.name || '').slice(0, 40);

  const seconds = cap(b.seconds, 900);
  const exports = cap(b.exports, 50);
  const routes = cap(b.routes, 200);
  const chat = cap(b.chat, 200);
  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);

  try {
    await env.DB.exec(
      'CREATE TABLE IF NOT EXISTS usage_daily (day TEXT NOT NULL, client_id TEXT NOT NULL, ' +
      "name TEXT NOT NULL DEFAULT '', seconds INTEGER NOT NULL DEFAULT 0, exports INTEGER NOT NULL DEFAULT 0, " +
      'routes INTEGER NOT NULL DEFAULT 0, chat INTEGER NOT NULL DEFAULT 0, last_seen INTEGER NOT NULL DEFAULT 0, ' +
      'PRIMARY KEY (day, client_id))'
    );
    await env.DB.prepare(
      'INSERT INTO usage_daily (day, client_id, name, seconds, exports, routes, chat, last_seen) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?) ' +
      'ON CONFLICT(day, client_id) DO UPDATE SET ' +
      'seconds = seconds + excluded.seconds, exports = exports + excluded.exports, ' +
      'routes = routes + excluded.routes, chat = chat + excluded.chat, ' +
      'last_seen = excluded.last_seen, ' +
      // Jméno přepisuj jen když něco přišlo, ať prázdné odeslání nesmaže dřív zadané.
      "name = CASE WHEN excluded.name <> '' THEN excluded.name ELSE usage_daily.name END"
    ).bind(day, clientId, name, seconds, exports, routes, chat, now).run();
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: String((e && e.message) || e) }, 500);
  }
}
