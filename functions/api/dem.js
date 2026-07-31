// Proxy + edge cache pro DEM dlaždice terénu (Terrarium, elevation-tiles-prod).
//
// Zdrojový bucket je HOLÝ S3 bez CDN — naměřeno ~550-670 ms na dlaždici (proti
// ~30-75 ms u satelitních dlaždic Esri). Při táhnutí mapy nad novým územím na
// to appka čeká, dokud terén nedostane výšková data — přesně to čekání, které
// se hlásí jako "seká se to". Elevační data se NIKDY nemění, takže je to ideální
// kandidát na dlouhou cache na Cloudflare edge: první požadavek na danou dlaždici
// (kýmkoliv, odkudkoliv) je pomalý, každý další (tímtéž uživatelem při dalším
// posunu, i kterýmkoliv jiným uživatelem poblíž) už jede z edge cache.
//
// GET /api/dem?z=Z&x=X&y=Y

const UPSTREAM = [
  'https://elevation-tiles-prod.s3.amazonaws.com/terrarium',
  'https://s3.amazonaws.com/elevation-tiles-prod/terrarium',
];

// 1×1 průhledný PNG — ať terén na chybějící dlaždici jen tiše nedosáhne dál,
// místo aby se cyklil na chybě.
const BLANK = Uint8Array.from(atob(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC'
), c => c.charCodeAt(0));

const png = (body, maxAge) =>
  new Response(body, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': `public, max-age=${maxAge}, immutable`,
      'Access-Control-Allow-Origin': '*',
    },
  });

export async function onRequest({ request }) {
  const q = new URL(request.url).searchParams;
  const z = parseInt(q.get('z') ?? '-1', 10);
  const x = parseInt(q.get('x') ?? '-1', 10);
  const y = parseInt(q.get('y') ?? '-1', 10);
  if (!(z >= 0 && z <= 15) || !(x >= 0) || !(y >= 0)) return png(BLANK, 300);

  // Terén na tento zdroj sahá až po zoom 11 (TERRAIN_DEM_MAXZOOM v appce), takže
  // reálný provoz je jen pár desítek unikátních dlaždic — 30 dní edge cache je
  // bezpečné i levné.
  const CACHE_SECONDS = 30 * 24 * 3600;

  for (const base of UPSTREAM) {
    try {
      const r = await fetch(`${base}/${z}/${x}/${y}.png`, {
        headers: { 'User-Agent': 'PZMAP-dem-proxy' },
        cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true },
      });
      if (!r.ok) continue;
      const buf = await r.arrayBuffer();
      if (buf.byteLength < 8) continue;
      return png(buf, CACHE_SECONDS);
    } catch (_) { /* zkus další zrcadlo */ }
  }
  return png(BLANK, 60);
}
