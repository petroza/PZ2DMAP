// /api/share — sdílení rozdělané práce odkazem.
//   POST {name, snapshot} -> {ok:true, token}
//   GET  ?token=…         -> {ok:true, name, snapshot}
import { json, preflight, writeAllowed, readJson } from './_shared.js';

// Bez znaků, které si lze splést (0/O, 1/l) — token se občas čte nahlas.
const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
const newToken = () => Array.from(crypto.getRandomValues(new Uint8Array(12)))
  .map(b => ALPHABET[b % ALPHABET.length]).join('');

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return preflight();
  if (!env.DB) return json({ ok: false, error: 'Databáze není připojená.' }, 500);

  if (request.method === 'GET') {
    const token = new URL(request.url).searchParams.get('token') || '';
    if (!token) return json({ ok: false, error: 'Chybí token.' }, 400);
    const row = await env.DB.prepare('SELECT name, json FROM shares WHERE token = ?')
      .bind(token).first();
    if (!row) return json({ ok: false, error: 'Odkaz neexistuje nebo vypršel.' }, 404);
    let snapshot;
    try { snapshot = JSON.parse(row.json); }
    catch { return json({ ok: false, error: 'Uložený stav je poškozený.' }, 500); }
    return json({ ok: true, name: row.name || '', snapshot });
  }

  if (request.method !== 'POST') return json({ ok: false, error: 'Použij GET nebo POST.' }, 405);

  const body = await readJson(request);
  if (!writeAllowed(request, env, body)) return json({ ok: false, error: 'Unauthorized' }, 401);
  if (!body.snapshot || typeof body.snapshot !== 'object') {
    return json({ ok: false, error: 'Chybí snapshot.' }, 400);
  }

  const token = newToken();
  await env.DB.prepare(
    'INSERT INTO shares (token, name, json, created_at) VALUES (?, ?, ?, ?)'
  ).bind(token, String(body.name || '').slice(0, 120), JSON.stringify(body.snapshot), Date.now()).run();

  return json({ ok: true, token });
}
