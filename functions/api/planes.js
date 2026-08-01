// Živé letadlo — proxy s edge cache nad OpenSky Network.
//
// PROČ OpenSky, a ne některý z volných zdrojů bez klíče (adsb.lol, adsb.fi,
// airplanes.live): appka běží na Cloudflare, a Cloudflare Workers sdílí
// odchozí IP adresy se spoustou dalších skriptů po celém světě. Ověřeno
// 2026-08-01 přímo z tohoto proxy: adsb.lol vracel 429 (rate limit), adsb.fi
// 403 — obě zjevně škrtí právě adresy Cloudflare. airplanes.live jako jediný
// reálně fungoval, ale jeho podmínky výslovně zakazují komerční užití — appka
// je podklad pro grafiku TV Nova, takže to nepřipadá v úvahu. OpenSky je jediný
// zdroj s oficiální registrací (žádný zákaz komerce) a klíčováním podle
// OAuth2 účtu, ne podle IP adresy — na sdílenou Cloudflare síť tedy nenaráží.
//
// Nastavení (Cloudflare secrets, ne do gitu):
//   npx wrangler pages secret put OPENSKY_CLIENT_ID     --project-name tnmap
//   npx wrangler pages secret put OPENSKY_CLIENT_SECRET --project-name tnmap
// Založení klienta: https://opensky-network.org/ → účet → API Client.
//
// Kredity: registrovaný účet má 4000/den (obnova po hodinách). Dotaz BEZ
// bbox (celý svět) stojí 1 kredit — levnější než malý výřez, protože se počítá
// podle plochy dotazu, ne podle množství dat. Aktualizace v proxy je nastavená
// na 25 s (3456 dotazů/den), ať je bezpečná rezerva. Appka na klientovi si může
// tahat data z tétohle edge cache klidně častěji — to už OpenSky kredity nestojí.
//
// GET /api/planes -> {t, items:[...]} — global snapshot

const FRESH_SECONDS = 25;
const STALE_SECONDS = 300;
const TOKEN_URL = 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';
const STATES_URL = 'https://opensky-network.org/api/states/all';

async function getToken(env, waitUntil) {
  const cache = caches.default;
  const key = new Request('https://planes-token.tnmap.internal/opensky');
  const hit = await cache.match(key);
  if (hit) {
    const expires = Number(hit.headers.get('X-Expires-At') || 0);
    if (expires && Date.now() < expires) return await hit.text();
  }
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: env.OPENSKY_CLIENT_ID,
      client_secret: env.OPENSKY_CLIENT_SECRET,
    }),
  });
  if (!r.ok) throw new Error('OpenSky token HTTP ' + r.status);
  const data = await r.json();
  const token = data.access_token;
  // O trochu kratší, než reálně platí (obvykle 30 min) — ať appka nikdy nepošle
  // dotaz s tokenem, který mezitím vypršel.
  const ttlMs = Math.max(60, (Number(data.expires_in) || 1800) - 90) * 1000;
  const store = new Response(token, { headers: { 'X-Expires-At': String(Date.now() + ttlMs) } });
  waitUntil(cache.put(key, store.clone()));
  return token;
}

async function fetchOpenSky(env, waitUntil) {
  const token = await getToken(env, waitUntil);
  const r = await fetch(STATES_URL, { headers: { Authorization: 'Bearer ' + token } });
  if (r.status === 429) throw new Error('OpenSky rate limit (kredity došly)');
  if (!r.ok) throw new Error('OpenSky states HTTP ' + r.status);
  const data = await r.json();
  const rows = Array.isArray(data.states) ? data.states : [];
  // Pořadí sloupců podle https://openskynetwork.github.io/opensky-api/rest.html#response
  return rows
    .filter(s => typeof s[6] === 'number' && typeof s[5] === 'number')
    .map(s => ({
      id: s[0],
      call: (s[1] || '').trim() || null,
      reg: null, type: null, // OpenSky states neposílá registraci ani typ letadla
      lat: s[6], lon: s[5],
      alt: typeof s[13] === 'number' ? Math.round(s[13] * 3.28084) : (typeof s[7] === 'number' ? Math.round(s[7] * 3.28084) : null), // m -> ft
      ground: !!s[8],
      track: typeof s[10] === 'number' ? s[10] : null,
      gs: typeof s[9] === 'number' ? Math.round(s[9] * 1.94384) : null, // m/s -> uzly
      vrate: typeof s[11] === 'number' ? s[11] : null,
      squawk: s[14] || null,
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

export async function onRequest({ env, waitUntil }) {
  if (!env.OPENSKY_CLIENT_ID || !env.OPENSKY_CLIENT_SECRET) {
    // Appka to zobrazí jako "zatím nenastaveno", ne jako chybu — viz planeTick() v index.html.
    return json(JSON.stringify({ t: Date.now(), items: [], notConfigured: true }), 200, 60, 'not-configured');
  }

  const cache = caches.default;
  const key = new Request('https://planes.tnmap.internal/global');
  const hit = await cache.match(key);
  if (hit) {
    const age = Number(hit.headers.get('X-Fetched-At') || 0);
    if (age && (Date.now() - age) / 1000 < FRESH_SECONDS) return json(await hit.text(), 200, FRESH_SECONDS, 'cache');
  }

  try {
    const items = await fetchOpenSky(env, waitUntil);
    const body = JSON.stringify({ t: Date.now(), items });
    const store = new Response(body, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Fetched-At': String(Date.now()) } });
    waitUntil(cache.put(key, store.clone()));
    return json(body, 200, FRESH_SECONDS, 'fresh');
  } catch (e) {
    if (hit) return json(await hit.text(), 200, 30, 'stale-error');
    return json(JSON.stringify({ t: Date.now(), items: [], error: String((e && e.message) || e) }), 503, 15, 'error');
  }
}
