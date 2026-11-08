// /api/usage — kolik se appka používá. Přičítá se po dávkách, appka posílá
// rozdíl od posledního odeslání (i přes sendBeacon při zavírání karty).
import { json, preflight, readJson } from './_shared.js';

const clamp = (v, max) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), max) : 0;
};

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return preflight();
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
  if (!(seconds || exports_ || routes || chat)) return json({ ok: true });

  const day = new Date().toISOString().slice(0, 10);
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
