// /api/usage — kolik se appka používá. Přičítá se po dávkách, appka posílá
// rozdíl od posledního odeslání (i přes sendBeacon při zavírání karty).
import { json, preflight, readJson } from './_shared.js';

const clamp = (v, max) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), max) : 0;
};

// Počty použití jednotlivých funkcí (kliknutí na tlačítka, režimy dopravy,
// šablony, nástroje asistenta). Jen „funkce → počet za den" — bez uživatele,
// aby šlo rozhodnout, co se v appce opravdu používá a co je zbytečné.
const FEATURE_KEY = /^[a-z0-9_:.-]{1,48}$/i;
const FEATURES_DDL = `CREATE TABLE IF NOT EXISTS usage_features (
  day TEXT NOT NULL, feature TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, feature))`;

async function saveFeatures(env, day, features) {
  if (!features || typeof features !== 'object') return;
  const rows = Object.entries(features)
    .filter(([k]) => FEATURE_KEY.test(k))
    .map(([k, v]) => [k, clamp(v, 1000)])
    .filter(([, n]) => n > 0)
    .slice(0, 80);
  if (!rows.length) return;
  const stmt = env.DB.prepare(
    `INSERT INTO usage_features (day, feature, count) VALUES (?, ?, ?)
     ON CONFLICT(day, feature) DO UPDATE SET count = usage_features.count + excluded.count`);
  const run = () => env.DB.batch(rows.map(([k, n]) => stmt.bind(day, k, n)));
  try { await run(); }
  catch (_) { try { await env.DB.prepare(FEATURES_DDL).run(); await run(); } catch (_) {} }
}

// GET /api/usage?days=30 — souhrn použití funkcí (bez osobních údajů).
async function featureSummary(env, url) {
  const days = Math.max(1, Math.min(365, parseInt(url.searchParams.get('days') || '30', 10) || 30));
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  try {
    const r = await env.DB.prepare(
      `SELECT feature, SUM(count) AS count, COUNT(DISTINCT day) AS days FROM usage_features
       WHERE day >= ? GROUP BY feature ORDER BY count DESC LIMIT 400`).bind(since).all();
    return json({ ok: true, since, features: r.results || [] });
  } catch (_) { return json({ ok: true, since, features: [] }); }
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return preflight();
  if (request.method === 'GET') return env.DB ? featureSummary(env, new URL(request.url)) : json({ ok: true, features: [] });
  if (request.method !== 'POST') return json({ ok: false, error: 'Použij POST.' }, 405);
  if (!env.DB) return json({ ok: true }); // statistiky nikdy nesmí shodit appku

  const b = await readJson(request);
  const clientId = String(b.clientId || '').slice(0, 64);
  if (!clientId) return json({ ok: true });

  // Stropy jsou proti nesmyslným dávkám (zaseknutá karta, opakované odeslání);
  // 86400 s je celý den, víc se za jedno hlášení nasbírat nedá.
  const seconds = clamp(b.seconds, 86400);
  const exports_ = clamp(b.exports, 10000);
  const routes = clamp(b.routes, 10000);
  const chat = clamp(b.chat, 10000);
  const day = new Date().toISOString().slice(0, 10);
  await saveFeatures(env, day, b.features);
  if (!(seconds || exports_ || routes || chat)) return json({ ok: true });

  const name = String(b.name || '').slice(0, 40);

  try {
    await env.DB.prepare(
      `INSERT INTO usage_daily (day, client_id, name, seconds, exports, routes, chat, last_seen)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(day, client_id) DO UPDATE SET
         name      = CASE WHEN excluded.name <> '' THEN excluded.name ELSE usage_daily.name END,
         seconds   = usage_daily.seconds + excluded.seconds,
         exports   = usage_daily.exports + excluded.exports,
         routes    = usage_daily.routes  + excluded.routes,
         chat      = usage_daily.chat    + excluded.chat,
         last_seen = excluded.last_seen`
    ).bind(day, clientId, name, seconds, exports_, routes, chat, Date.now()).run();
  } catch (_) { /* statistika za to nestojí, aby kvůli ní spadl požadavek */ }

  return json({ ok: true });
}
