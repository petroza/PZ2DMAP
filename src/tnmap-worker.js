/**
 * TNmap na Cloudflare Workers.
 *
 * Nahrazuje tři PHP skripty, které dosud běžely na Forpsi:
 *
 *   map_api.php        -> /map_api.php        (data v R2, bucket tn-map)
 *   wx_owm.php         -> /wx_owm.php         (proxy na OpenWeather dlaždice)
 *   chmi_vystrahy.php  -> /chmi_vystrahy.php  (výstrahy ČHMÚ)
 *
 * Cesty jsou schválně ponechané včetně „.php", protože je front-end volá
 * relativně (SERVER_API_URL, WX_OWM_PROXY, WX_CHMI_PROXY v index.html).
 * Migrace tak nevyžaduje žádnou změnu front-endu. Čisté aliasy /api/* jsou
 * k dispozici taky, aby se na ně dalo přejít později bez další migrace.
 *
 * Statické soubory obsluhuje binding ASSETS (Workers Assets) — je zdarma,
 * cachuje se na edge a nestojí to R2 operace. R2 drží jen data, která se mění.
 */

const DATA_ENTITIES = ["presets", "projects"];

// OpenWeather vrstvy, které smí projít proxy. Whitelist, ne volný průchod.
const OWM_LAYERS = new Set([
  "temp_new",
  "precipitation_new",
  "clouds_new",
  "pressure_new",
  "wind_new"
]);

// 1×1 průhledný PNG. Když dlaždice není k dispozici, vrací se tohle, aby
// v mapě nezůstala rozbitá dlaždice — stejně jako to dělalo wx_owm.php.
const BLANK_PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC"),
  (c) => c.charCodeAt(0)
);

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      ...extraHeaders
    }
  });
}

function corsPreflight() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Api-Token",
      "Access-Control-Max-Age": "86400"
    }
  });
}

function pngResponse(bytes, maxAge) {
  return new Response(bytes, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": `public, max-age=${maxAge}`,
      "Access-Control-Allow-Origin": "*"
    }
  });
}

/* ------------------------------------------------------------------ data --
 * Kontrakt je záměrně shodný s map_api.php:
 *   GET  ?entity=presets            -> {ok:true, items:[…]}
 *   POST ?entity=presets            -> {ok:true, count:N}
 *        body {action:"replace", items:[…]}
 * Front-end posílá celé pole naráz, takže se jen přepíše jeden objekt v R2.
 */
async function handleData(request, env, url) {
  const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
  const entity = String(url.searchParams.get("entity") || body.entity || "");
  const action = String(url.searchParams.get("action") || body.action || "list");

  if (!DATA_ENTITIES.includes(entity)) {
    return jsonResponse({ ok: false, error: "Invalid entity" }, 400);
  }

  const key = `data/${entity}.json`;

  if (request.method === "GET" || action === "list") {
    const obj = await env.TNMAP_DATA.get(key);
    const items = obj ? await obj.json().catch(() => []) : [];
    return jsonResponse(
      { ok: true, items: Array.isArray(items) ? items : [] },
      200,
      { "Cache-Control": "no-store" }
    );
  }

  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }
  if (action !== "replace") {
    return jsonResponse({ ok: false, error: "Unsupported action" }, 400);
  }

  // Zápis smí projít jen se správným tokenem, pokud je nastavený. Front-end
  // ho posílá v X-Api-Token. (Token v prohlížeči nikoho nezastaví — brání to
  // jen náhodnému přepsání dat cizím requestem, ne cílenému útoku.)
  if (env.API_TOKEN) {
    const provided = request.headers.get("X-Api-Token") || body.token || "";
    if (provided !== env.API_TOKEN) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }
  }

  if (!Array.isArray(body.items)) {
    return jsonResponse({ ok: false, error: "Items must be an array" }, 400);
  }

  const now = Date.now();
  const clean = body.items
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({
      ...item,
      id: String(item.id || "").trim() || `${entity}_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: item.createdAt ?? now,
      updatedAt: now
    }));

  await env.TNMAP_DATA.put(key, JSON.stringify(clean, null, 2) + "\n", {
    httpMetadata: { contentType: "application/json; charset=utf-8" }
  });

  return jsonResponse({ ok: true, count: clean.length });
}

/* --------------------------------------------------------------- pocasi --
 * OpenWeather dlaždice. Klíč zůstává na serveru (secret OWM_KEY) a do
 * prohlížeče se nikdy nedostane — stejně jako ve wx_owm.php.
 *
 * Proti PHP verzi je tu navíc edge cache: stejná dlaždice se z OpenWeather
 * stahuje jednou za hodinu na kolokaci, ne při každém zobrazení.
 */
async function handleOwm(env, url, ctx) {
  const layer = url.searchParams.get("layer") || "";
  const z = Number(url.searchParams.get("z"));
  const x = Number(url.searchParams.get("x"));
  const y = Number(url.searchParams.get("y"));

  const bad =
    !env.OWM_KEY ||
    !OWM_LAYERS.has(layer) ||
    !Number.isInteger(z) || z < 0 || z > 22 ||
    !Number.isInteger(x) || x < 0 ||
    !Number.isInteger(y) || y < 0;
  if (bad) return pngResponse(BLANK_PNG, 300);

  const upstream = `https://tile.openweathermap.org/map/${layer}/${z}/${x}/${y}.png?appid=${encodeURIComponent(env.OWM_KEY)}`;
  // Cache klíč bez API klíče, ať se v cache neukládá tajemství.
  const cacheKey = new Request(`https://tnmap.internal/owm/${layer}/${z}/${x}/${y}.png`);
  const cache = caches.default;

  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const res = await fetch(upstream, { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!res.ok) return pngResponse(BLANK_PNG, 300);

  const out = new Response(res.body, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*"
    }
  });
  ctx.waitUntil(cache.put(cacheKey, out.clone()));
  return out;
}

/* ----------------------------------------------------------------- CHMU --
 * Výstrahy ČHMÚ, cache 1 hodina.
 *
 * POZOR — zatím je to most na původní PHP na Forpsi. Zdrojový kód
 * chmi_vystrahy.php nebyl v repozitáři a PHP se přes web nedá přečíst, takže
 * není známé, který feed ČHMÚ čte ani jak ho převádí na tvar
 * {updated, source, maxColor, count, events[]}, který front-end očekává.
 * Přepsat to naslepo by znamenalo riskovat tiše špatné výstrahy.
 *
 * Dokud sem ten skript nedoplníme, je Forpsi poslední zbývající závislost
 * TNmapy. Cache tlumí provoz na jeden dotaz za hodinu na kolokaci.
 */
const CHMI_BRIDGE = "https://www.appcreate.cloud/apps/TNmap/chmi_vystrahy.php";

async function handleChmi(ctx) {
  const cacheKey = new Request("https://tnmap.internal/chmi/vystrahy.json");
  const cache = caches.default;

  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  try {
    const res = await fetch(CHMI_BRIDGE, { cf: { cacheTtl: 3600, cacheEverything: true } });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const out = new Response(await res.text(), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*"
      }
    });
    ctx.waitUntil(cache.put(cacheKey, out.clone()));
    return out;
  } catch (e) {
    // Prázdný, ale platný tvar — mapa se kvůli výstrahám nesmí rozbít.
    return jsonResponse(
      { updated: null, source: "ČHMÚ SIVS (CC BY 4.0)", maxColor: null, count: 0, events: [], error: String(e.message || e) },
      200,
      { "Cache-Control": "public, max-age=60" }
    );
  }
}

/* ---------------------------------------------------------------- router -- */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (request.method === "OPTIONS") return corsPreflight();

    if (path === "/map_api.php" || path === "/api/data") {
      return handleData(request, env, url);
    }
    if (path === "/wx_owm.php" || path === "/api/owm") {
      return handleOwm(env, url, ctx);
    }
    if (path === "/chmi_vystrahy.php" || path === "/api/chmi") {
      return handleChmi(ctx);
    }
    if (path === "/api/health") {
      return jsonResponse({
        ok: true,
        service: "tnmap",
        owm: Boolean(env.OWM_KEY),
        chmi: "bridge",
        data: "r2:tn-map"
      });
    }

    // Všechno ostatní je statický soubor (index.html, assets/…).
    return env.ASSETS.fetch(request);
  }
};
