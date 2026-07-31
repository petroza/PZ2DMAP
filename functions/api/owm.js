// OpenWeatherMap raster-tile proxy (náhrada wx_owm.php).
// Klíč zůstává na SERVERU (Cloudflare secret OWM_KEY) a do prohlížeče se nikdy
// neposílá. Na Forpsi byl klíč přímo v .php souboru — tady ne, a hlavně se
// nesmí dostat do gitu.
//
// Použití: /api/owm?layer=temp_new&z=5&x=16&y=10

const ALLOWED = ['temp_new', 'precipitation_new', 'clouds_new', 'pressure_new', 'wind_new'];

// 1×1 průhledný PNG — vrací se, když není klíč nebo cokoli selže, aby mapa
// zůstala čistá místo rozbitých dlaždic.
const BLANK = Uint8Array.from(atob(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC'
), c => c.charCodeAt(0));

const png = (body, maxAge) =>
  new Response(body, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': `public, max-age=${maxAge}`,
      'Access-Control-Allow-Origin': '*',
    },
  });

export async function onRequest({ request, env }) {
  const q = new URL(request.url).searchParams;
  const layer = String(q.get('layer') || '');
  const z = parseInt(q.get('z') ?? '-1', 10);
  const x = parseInt(q.get('x') ?? '-1', 10);
  const y = parseInt(q.get('y') ?? '-1', 10);
  const key = env.OWM_KEY || '';

  if (!key || !ALLOWED.includes(layer) || !(z >= 0 && z <= 22) || !(x >= 0) || !(y >= 0)) {
    return png(BLANK, 300);
  }

  const url = `https://tile.openweathermap.org/map/${layer}/${z}/${x}/${y}.png?appid=${key}`;
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'PZMAP-wx-proxy' },
      // Dlaždice se nemění po sekundách — ať je nese Cloudflare cache.
      cf: { cacheTtl: 600, cacheEverything: true },
    });
    if (!r.ok) return png(BLANK, 60);
    const buf = await r.arrayBuffer();
    // OWM při chybě vrací JSON, ne obrázek — krátká data zahoď.
    if (buf.byteLength < 8) return png(BLANK, 60);
    return png(buf, 600);
  } catch (_) {
    return png(BLANK, 60);
  }
}
