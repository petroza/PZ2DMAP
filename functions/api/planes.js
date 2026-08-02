// Živé letadlo — proxy s edge cache nad airplanes.live.
//
// Historie výběru zdroje (2026-08-01/02), ověřeno živě z tohoto proxy, ne z
// dokumentace: adsb.lol vracel 429, adsb.fi 403 — oba zjevně škrtí sdílené
// odchozí IP Cloudflare Workers. OpenSky Network (oficiální, s registrací) byl
// první volba právě KVŮLI žádnému zákazu komerčního užití, ale ukázalo se, že
// CELÝ opensky-network.org (API i auth server) na požadavky z Cloudflare vůbec
// neodpovídá — 522 na všech třech vyzkoušených adresách, ověřeno i samostatným
// Workerem mimo tuhle appku, takže to není otázka konkrétního kódu, ale
// blokády na jejich straně. airplanes.live je jediný ze čtyř, který přes
// Cloudflare reálně funguje. POZOR: jeho podmínky výslovně zakazují komerční
// užití — použito na výslovné přání Petra i s tímhle rizikem (appka je
// podklad pro grafiku TV Nova). Max dosah dotazu je 250 NM (ověřeno: 251+ dá
// 403), takže pokrytí je ČR a okolí, ne celý svět jako u OpenSky.
//
// GET /api/planes -> {t, items:[...]}

const FRESH_SECONDS = 8;
const CENTER_LAT = 50.08, CENTER_LON = 14.42; // Praha
const RADIUS_NM = 250; // zjištěné maximum airplanes.live
const UPSTREAM = `https://api.airplanes.live/v2/point/${CENTER_LAT}/${CENTER_LON}/${RADIUS_NM}`;

function slim(list) {
  return (Array.isArray(list) ? list : [])
    .filter(a => typeof a.lat === 'number' && typeof a.lon === 'number')
    .map(a => ({
      id: a.hex,
      call: (a.flight || '').trim() || null,
      reg: a.r || null,
      type: a.t || null,
      lat: a.lat,
      lon: a.lon,
      alt: typeof a.alt_baro === 'number' ? a.alt_baro : (typeof a.alt_geom === 'number' ? a.alt_geom : null),
      ground: a.alt_baro === 'ground',
      track: typeof a.true_heading === 'number' ? a.true_heading : (typeof a.track === 'number' ? a.track : null),
      gs: typeof a.gs === 'number' ? a.gs : null,
      vrate: typeof a.baro_rate === 'number' ? a.baro_rate : (typeof a.geom_rate === 'number' ? a.geom_rate : null),
      squawk: a.squawk || null,
    }));
}

const json = (body, status, seconds, note) =>
  new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${seconds}`,
      'Access-Control-Allow-Origin': '*',
      'X-Planes-Source': note,
    },
  });

export async function onRequest({ waitUntil }) {
  const cache = caches.default;
  const key = new Request(`https://planes.tnmap.internal/${CENTER_LAT}/${CENTER_LON}/${RADIUS_NM}`);
  const hit = await cache.match(key);
  if (hit) {
    const age = Number(hit.headers.get('X-Fetched-At') || 0);
    if (age && (Date.now() - age) / 1000 < FRESH_SECONDS) return json(await hit.text(), 200, FRESH_SECONDS, 'cache');
  }

  try {
    const r = await fetch(UPSTREAM, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PZMAP/1.0; +https://tnmap.pages.dev)' },
    });
    if (!r.ok) throw new Error('airplanes.live HTTP ' + r.status);
    const data = await r.json();
    const items = slim(data.ac);
    const body = JSON.stringify({ t: Date.now(), items });
    const store = new Response(body, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Fetched-At': String(Date.now()) } });
    waitUntil(cache.put(key, store.clone()));
    return json(body, 200, FRESH_SECONDS, 'fresh');
  } catch (e) {
    if (hit) return json(await hit.text(), 200, 20, 'stale-error');
    return json(JSON.stringify({ t: Date.now(), items: [], error: String((e && e.message) || e) }), 503, 15, 'error');
  }
}
