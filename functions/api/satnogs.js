// Frekvence radioamatérských družic (SatNOGS DB) — proxy s edge cache.
//
// Stejný důvod jako u /api/tle: SatNOGS nemá CORS hlavičky pro fetch z prohlížeče
// a odpověď (transmitery všech družic v databázi) je pár MB — nemá smysl, aby si
// ji stahoval každý návštěvník zvlášť. Na zdroj chodí server, výsledek se drží
// v edge cache přes den (frekvence se mění zřídka).
//
// GET /api/satnogs → JSON pole transmiterů (jen "alive" stavy, jen potřebná pole)

const UPSTREAM = 'https://db.satnogs.org/api/transmitters/?format=json&alive=true';
const FRESH_SECONDS = 24 * 3600;
const STALE_SECONDS = 14 * 24 * 3600;

const json = (body, status, seconds, note) =>
  new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${seconds}`,
      'Access-Control-Allow-Origin': '*',
      'X-Satnogs-Source': note,
    },
  });

export async function onRequest({ waitUntil }) {
  const cache = caches.default;
  const key = new Request('https://satnogs.tnmap.internal/transmitters');
  const hit = await cache.match(key);

  if (hit) {
    const age = Number(hit.headers.get('X-Fetched-At') || 0);
    const fresh = age && (Date.now() - age) / 1000 < FRESH_SECONDS;
    if (fresh) return json(await hit.text(), 200, 3600, 'cache');
  }

  try {
    const r = await fetch(UPSTREAM, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PZMAP/1.0; +https://tnmap.pages.dev)' },
      cf: { cacheTtl: 300, cacheEverything: false },
    });
    if (!r.ok) {
      if (hit) return json(await hit.text(), 200, 3600, 'stale-upstream-' + r.status);
      return json('[]', 503, 60, 'upstream-' + r.status);
    }
    const raw = await r.json();
    // Jen pole, co appka reálně použije — z pár MB je pak pár set kB.
    const slim = raw
      .filter(t => t && t.norad_cat_id)
      .map(t => ({
        id: t.norad_cat_id,
        desc: t.description || '',
        mode: t.mode || '',
        down: t.downlink_low || null,
        up: t.uplink_low || null,
        invert: !!t.invert,
      }));
    const body = JSON.stringify(slim);
    const store = new Response(body, {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Fetched-At': String(Date.now()) },
    });
    waitUntil(cache.put(key, store.clone()));
    return json(body, 200, 3600, 'fresh');
  } catch (_) {
    if (hit) return json(await hit.text(), 200, 3600, 'stale-error');
    return json('[]', 503, 60, 'error');
  }
}
