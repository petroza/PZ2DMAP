// Sdílení rozdělané práce odkazem.
//
// Grafik klikne „Odeslat link", tím se aktuální stav mapy (trasa, vzhled, ikonky,
// popisky, animace, politické barvení…) uloží pod krátký token a kolega si ho
// otevřením odkazu načte. Záměrně to NEJDE přes uložené projekty: sdílet se má
// i práce, která ještě není uložená, a sdílení nemá zaplevelovat seznam projektů.
//
//   POST /api/share   {name?, snapshot}  + X-Api-Token   -> {ok, token}
//   GET  /api/share?token=abc123                          -> {ok, name, snapshot}

const MAX_BODY = 4 * 1024 * 1024;   // snapshot s mnoha popisky/ikonkami může být velký
const TTL_DAYS = 180;               // odkazy nedržíme věčně

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

async function ensureTable(db) {
  await db.exec(
    'CREATE TABLE IF NOT EXISTS shares (token TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT \'\', ' +
    'json TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT 0)'
  );
}

// Krátký, ale dost nepředvídatelný token: 12 znaků z 32 hodnot ≈ 60 bitů, takže
// odkaz nejde uhádnout, a přesto se dá přečíst do telefonu.
function makeToken() {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
  const buf = new Uint8Array(12);
  crypto.getRandomValues(buf);
  return [...buf].map(b => abc[b % abc.length]).join('');
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (!env.DB) return json({ ok: false, error: 'D1 binding DB chybí' }, 500);

  const url = new URL(request.url);

  try {
    await ensureTable(env.DB);

    if (request.method === 'GET') {
      const token = String(url.searchParams.get('token') || '').replace(/[^a-z0-9]/gi, '').slice(0, 32);
      if (!token) return json({ ok: false, error: 'Chybí token.' }, 400);
      const row = await env.DB.prepare('SELECT name, json, created_at FROM shares WHERE token = ?').bind(token).first();
      if (!row) return json({ ok: false, error: 'Odkaz neexistuje nebo už vypršel.' }, 404);
      if (row.created_at && Date.now() - Number(row.created_at) > TTL_DAYS * 86400000) {
        return json({ ok: false, error: 'Odkaz je starší než ' + TTL_DAYS + ' dní a už neplatí.' }, 410);
      }
      let snapshot = null;
      try { snapshot = JSON.parse(row.json); } catch (_) { return json({ ok: false, error: 'Sdílená data jsou poškozená.' }, 500); }
      return json({ ok: true, name: row.name || '', snapshot });
    }

    if (request.method !== 'POST') return json({ ok: false, error: 'Použij GET nebo POST.' }, 405);

    const expected = env.API_TOKEN || '';
    if (expected && (request.headers.get('X-Api-Token') || '') !== expected) {
      return json({ ok: false, error: 'Unauthorized' }, 401);
    }

    const raw = await request.text();
    if (raw.length > MAX_BODY) return json({ ok: false, error: 'Projekt je moc velký na sdílení (limit 4 MB).' }, 413);
    let body;
    try { body = JSON.parse(raw); } catch (_) { return json({ ok: false, error: 'Neplatný JSON.' }, 400); }
    if (!body || typeof body.snapshot !== 'object' || body.snapshot === null) {
      return json({ ok: false, error: 'Chybí snapshot.' }, 400);
    }

    const token = makeToken();
    await env.DB.prepare('INSERT INTO shares (token, name, json, created_at) VALUES (?, ?, ?, ?)')
      .bind(token, String(body.name || '').slice(0, 120), JSON.stringify(body.snapshot), Date.now()).run();

    return json({ ok: true, token, expiresInDays: TTL_DAYS });
  } catch (e) {
    return json({ ok: false, error: String((e && e.message) || e) }, 500);
  }
}
