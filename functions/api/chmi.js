// /api/chmi — výstrahy ČHMÚ ve tvaru, který appka čeká:
//   {updated, source, maxColor, count, events:[…]}
//
// POZOR: tohle je most na starší nasazení, ne vlastní implementace. Původní
// Function, která feed ČHMÚ čte a překládá na ORP, nebyla ve verzovacím
// systému a z Cloudflare ji stáhnout nejde. Odvodit převod naslepo by
// znamenalo riskovat tiše špatné výstrahy ve vysílací grafice, což nestojí za
// to — dokud se zdroják nenajde, bere se hotový výstup odtud. Cache drží
// dotaz na jeden za hodinu na kolokaci.
import { json, preflight, CORS } from './_shared.js';

const UPSTREAM = 'https://c1aeeb91.tnmap.pages.dev/api/chmi';

export async function onRequest({ request, waitUntil }) {
  if (request.method === 'OPTIONS') return preflight();

  const key = new Request('https://tnmap.internal/chmi.json');
  const cache = caches.default;
  const hit = await cache.match(key);
  if (hit) return hit;

  try {
    const r = await fetch(UPSTREAM, { cf: { cacheTtl: 3600, cacheEverything: true } });
    if (!r.ok) throw new Error('upstream ' + r.status);
    const out = new Response(await r.text(), {
      headers: { 'Content-Type': 'application/json; charset=utf-8',
                 'Cache-Control': 'public, max-age=3600', ...CORS }
    });
    waitUntil(cache.put(key, out.clone()));
    return out;
  } catch (e) {
    // Prázdný, ale platný tvar — kvůli výstrahám se mapa rozbít nesmí.
    return json({ updated: null, source: 'ČHMÚ SIVS (CC BY 4.0)', maxColor: null,
                  count: 0, events: [], error: String(e.message || e) },
                200, { 'Cache-Control': 'public, max-age=60' });
  }
}
