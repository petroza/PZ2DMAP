// Živá lodní doprava — proxy s edge cache nad vlastním Workerem pz-ships-tracker
// (samostatný Cloudflare Worker s Durable Object, drží trvalé websocket spojení
// na aisstream.io — viz Downloads/TNMAP_SHIPS). AIS nemá žádné volné REST API,
// jen websocket, a Pages Functions jsou bezstavové (jeden požadavek = jedno
// běhnutí), takže spojení musí držet něco jiného — proto ten samostatný Worker.
//
// Tahle funkce dělá to samé co u letadel/družic: edge cache, ať appka s víc lidmi
// netahá nový dotaz na pz-ships-tracker při každém překreslení mapy.

const UPSTREAM = 'https://pz-ships-tracker.petrzavorka.workers.dev/';
const FRESH_SECONDS = 8; // pz-ships-tracker sám drží data v paměti, tohle jen šetří síťovou cestu navíc

const json = (body, status, seconds, note) =>
  new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${seconds}`,
      'Access-Control-Allow-Origin': '*',
      'X-Ships-Source': note,
    },
  });

export async function onRequest({ waitUntil }) {
  const cache = caches.default;
  const key = new Request('https://ships.tnmap.internal/global');
  const hit = await cache.match(key);
  if (hit) {
    const age = Number(hit.headers.get('X-Fetched-At') || 0);
    if (age && (Date.now() - age) / 1000 < FRESH_SECONDS) return json(await hit.text(), 200, FRESH_SECONDS, 'cache');
  }

  try {
    const r = await fetch(UPSTREAM, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PZMAP/1.0)' } });
    if (!r.ok) throw new Error('pz-ships-tracker HTTP ' + r.status);
    const data = await r.json();
    // Bez klíče na druhé straně appka nemá co ukazovat, ale nejde o chybu naší
    // proxy — pošli to dál jako notConfigured, appka to zobrazí jako klidnou hlášku.
    const body = data.connected === false && /AISSTREAM_KEY/.test(data.error || '')
      ? JSON.stringify({ t: Date.now(), items: [], notConfigured: true })
      : JSON.stringify({ t: data.t || Date.now(), items: data.items || [] });
    const store = new Response(body, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Fetched-At': String(Date.now()) } });
    waitUntil(cache.put(key, store.clone()));
    return json(body, 200, FRESH_SECONDS, 'fresh');
  } catch (e) {
    if (hit) return json(await hit.text(), 200, 20, 'stale-error');
    return json(JSON.stringify({ t: Date.now(), items: [], error: String((e && e.message) || e) }), 503, 15, 'error');
  }
}
