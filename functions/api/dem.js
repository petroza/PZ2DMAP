// /api/dem?z=&x=&y= — výškové dlaždice (Terrarium PNG) pro stínovaný reliéf.
// Přímý S3 bucket je bez CDN pomalý (~0,6 s na dlaždici); tady jde přes edge
// cache Cloudflare (výška se nemění → 30 dní). Když první zdroj selže, zkusí se
// záložní adresa téhož bucketu. Nic se neukládá, jen se čte.
import { preflight, CORS } from './_shared.js';

const SOURCES = [
  (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`,
  (z, x, y) => `https://elevation-tiles-prod.s3.amazonaws.com/terrarium/${z}/${x}/${y}.png`,
];

export async function onRequest({ request, waitUntil }) {
  if (request.method === 'OPTIONS') return preflight();
  const url = new URL(request.url);
  const z = Number(url.searchParams.get('z')), x = Number(url.searchParams.get('x')), y = Number(url.searchParams.get('y'));
  const n = 2 ** z;
  if (!Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y) || z < 0 || z > 15 || x < 0 || y < 0 || x >= n || y >= n) {
    return new Response('bad tile', { status: 400, headers: CORS });
  }

  const key = new Request(`https://tnmap.internal/dem/${z}/${x}/${y}.png`);
  const cache = caches.default;
  const hit = await cache.match(key);
  if (hit) return hit;

  for (const src of SOURCES) {
    try {
      const r = await fetch(src(z, x, y), { cf: { cacheTtl: 2592000, cacheEverything: true } });
      if (!r.ok) continue;
      const out = new Response(r.body, {
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=2592000, immutable', ...CORS },
      });
      waitUntil(cache.put(key, out.clone()));
      return out;
    } catch (e) { /* další zdroj */ }
  }
  return new Response('dem unavailable', { status: 502, headers: CORS });
}
