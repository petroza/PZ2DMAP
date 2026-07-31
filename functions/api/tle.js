// Dráhové elementy (TLE) družic z CelesTraku — proxy s edge cache.
//
// Proč to nejde stahovat rovnou z prohlížeče:
//  1. CelesTrak neposílá CORS hlavičky, takže fetch z appky by prohlížeč zablokoval.
//  2. Celý katalog aktivních družic má ~2,7 MB a ze zdroje trvá jednotky sekund.
//  3. CelesTrak se BRÁNÍ opakovanému stahování — když si už tentýž klient data
//     stáhl a od té doby se nezměnila, vrátí 403 s textem "GP data has not
//     updated since your last successful download". Kdyby na něj chodil každý
//     návštěvník zvlášť, dostávali by 403 a vrstva by byla prázdná.
//
// Řešení je stejné jako u /api/dem: na zdroj chodí server, ne uživatel, a odpověď
// se drží v edge cache. Elementy se aktualizují párkrát denně, takže 6 h je
// bezpečný kompromis mezi čerstvostí a zátěží zdroje.
//
// GET /api/tle            → aktivní družice (výchozí)
// GET /api/tle?group=X    → jiná skupina CelesTraku (stations, starlink, gps-ops…)

const UPSTREAM = 'https://celestrak.org/NORAD/elements/gp.php';
const FRESH_SECONDS = 6 * 3600;      // jak dlouho považujeme kopii za čerstvou
const STALE_SECONDS = 7 * 24 * 3600; // jak dlouho ji držíme jako záchranu při výpadku

// Povolené skupiny — ať se z proxy nedá udělat otevřený tunel na cizí server.
const GROUPS = new Set([
  'active', 'stations', 'visual', 'starlink', 'oneweb', 'gps-ops', 'galileo',
  'glo-ops', 'beidou', 'weather', 'noaa', 'goes', 'resource', 'science',
  'geo', 'intelsat', 'iridium-NEXT', 'last-30-days',
]);

const text = (body, status, seconds, note) =>
  new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': `public, max-age=${seconds}`,
      'Access-Control-Allow-Origin': '*',
      'X-Tle-Source': note,
    },
  });

export async function onRequest({ request, waitUntil }) {
  const group = new URL(request.url).searchParams.get('group') || 'active';
  if (!GROUPS.has(group)) return text('', 400, 60, 'bad-group');

  const cache = caches.default;
  // Vlastní klíč cache (ne URL requestu) — ať se kopie sdílí bez ohledu na to,
  // s jakými parametrami navíc appka zrovna přijde.
  const key = new Request(`https://tle.tnmap.internal/${group}`);
  const hit = await cache.match(key);

  if (hit) {
    const age = Number(hit.headers.get('X-Fetched-At') || 0);
    const fresh = age && (Date.now() - age) / 1000 < FRESH_SECONDS;
    if (fresh) return text(await hit.text(), 200, 900, 'cache');
  }

  try {
    const r = await fetch(`${UPSTREAM}?GROUP=${encodeURIComponent(group)}&FORMAT=tle`, {
      headers: {
        // CelesTrak odmítá požadavky bez rozumné identifikace klienta.
        'User-Agent': 'Mozilla/5.0 (compatible; PZMAP/1.0; +https://tnmap.pages.dev)',
        'Accept': 'text/plain',
      },
      cf: { cacheTtl: 300, cacheEverything: false },
    });
    const body = await r.text();

    // 403 "GP data has not updated" NENÍ chyba — znamená, že naše kopie je pořád
    // aktuální. Stejně tak jakákoli jiná chyba: radši vydáme starší data než nic.
    const looksLikeTle = r.ok && body.length > 1000 && /^\d /m.test(body);
    if (!looksLikeTle) {
      if (hit) return text(await hit.text(), 200, 900, 'stale-upstream-' + r.status);
      return text('', 503, 60, 'upstream-' + r.status);
    }

    const store = new Response(body, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': `public, max-age=${STALE_SECONDS}`,
        'X-Fetched-At': String(Date.now()),
      },
    });
    waitUntil(cache.put(key, store.clone()));
    return text(body, 200, 900, 'fresh');
  } catch (_) {
    if (hit) return text(await hit.text(), 200, 900, 'stale-error');
    return text('', 503, 60, 'error');
  }
}
