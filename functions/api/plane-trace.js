// Dráha letu vybraného letadla — proxy s edge cache nad readsb "recent trace"
// endpointem, který adsb.lol servíruje přímo (ne přes GitHub archivy, které
// jsou v řádu GB na den a nedají se stáhnout na klik). Objeveno 2026-08-02
// rozborem zdrojáku tar1090 (frontendu, který adsb.lol/airplanes.live/OpenSky
// všichni používají) — přesně tohle volá jejich vlastní web při kliknutí na
// letadlo. Je to KRÁTKODOBÁ stopa držená v paměti readsb (ne celý dnešní den
// od startu), ale ověřeno živě: 92 bodů i s výškou/rychlostí/kurzem.
//
// POZOR: tahle cesta (/data/traces/...) je jiná infrastruktura než hlavní
// adsb.lol API (to Cloudflare blokuje 429) — ověřeno samostatně, funguje.
//
// GET /api/plane-trace?hex=XXXXXX -> {points:[[lon,lat,altFt], ...]}

const FRESH_SECONDS = 20;
const HEX_RE = /^[0-9a-f]{6}$/i;

const json = (body, status, seconds, note) =>
  new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${seconds}`,
      'Access-Control-Allow-Origin': '*',
      'X-Trace-Source': note,
    },
  });

export async function onRequest({ request, waitUntil }) {
  const hex = (new URL(request.url).searchParams.get('hex') || '').toLowerCase();
  if (!HEX_RE.test(hex)) return json(JSON.stringify({ points: [] }), 400, 60, 'bad-hex');

  const cache = caches.default;
  const key = new Request('https://plane-trace.tnmap.internal/' + hex);
  const hit = await cache.match(key);
  if (hit) {
    const age = Number(hit.headers.get('X-Fetched-At') || 0);
    if (age && (Date.now() - age) / 1000 < FRESH_SECONDS) return json(await hit.text(), 200, FRESH_SECONDS, 'cache');
  }

  try {
    const last2 = hex.slice(-2);
    const r = await fetch(`https://adsb.lol/data/traces/${last2}/trace_recent_${hex}.json`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PZMAP/1.0; +https://tnmap.pages.dev)' },
    });
    // Letadlo bez nedávné stopy (jen se objevilo, nebo ho readsb ještě nesledoval)
    // dostane 404 — to NENÍ chyba, jen zatím nemá co ukázat.
    if (r.status === 404) {
      const body = JSON.stringify({ points: [] });
      return json(body, 200, FRESH_SECONDS, 'empty');
    }
    if (!r.ok) throw new Error('adsb.lol trace HTTP ' + r.status);
    const data = await r.json();
    // Formát bodu: [sekundy_od_timestamp, lat, lon, výška(ft nebo "ground"/null), ...].
    const points = (Array.isArray(data.trace) ? data.trace : [])
      .filter(p => Array.isArray(p) && typeof p[1] === 'number' && typeof p[2] === 'number')
      .map(p => [p[2], p[1], typeof p[3] === 'number' ? p[3] : null]); // [lon, lat, altFt]
    const body = JSON.stringify({ points });
    const store = new Response(body, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Fetched-At': String(Date.now()) } });
    waitUntil(cache.put(key, store.clone()));
    return json(body, 200, FRESH_SECONDS, 'fresh');
  } catch (e) {
    if (hit) return json(await hit.text(), 200, 20, 'stale-error');
    return json(JSON.stringify({ points: [], error: String((e && e.message) || e) }), 503, 15, 'error');
  }
}
