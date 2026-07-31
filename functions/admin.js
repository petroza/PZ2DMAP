// /admin — přehled používání TN mapy (kolik se toho vyrobilo, kdo kolik odpracoval).
//
// Bezpečnost: e-mail ani heslo NEJSOU v kódu ani v prohlížeči. Leží v Cloudflare
// secrets (ADMIN_EMAIL, ADMIN_PASSWORD) a ověřují se tady na serveru. Po přihlášení
// se vydá PODEPSANÁ cookie (HMAC-SHA256 nad časem vypršení), takže ji nejde
// zfalšovat ani si v ní nic přepsat.

const SESSION_HOURS = 12;
const COOKIE = 'tnmap_admin';

const enc = new TextEncoder();

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Srovnání bez early-exitu, ať se z délky odpovědi nedá nic vyčíst.
function safeEqual(a, b) {
  const x = String(a), y = String(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

async function makeSession(secret) {
  const exp = Date.now() + SESSION_HOURS * 3600 * 1000;
  return `${exp}.${await hmac(secret, String(exp))}`;
}

async function validSession(secret, value) {
  const [exp, sig] = String(value || '').split('.');
  if (!exp || !sig) return false;
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  return safeEqual(sig, await hmac(secret, exp));
}

const getCookie = (request, name) => {
  const raw = request.headers.get('Cookie') || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return '';
};

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const html = (body, status = 200, extraHeaders = {}) =>
  new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders },
  });

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0f131a;color:#e9edf5;font:14px 'Segoe UI',system-ui,sans-serif;padding:28px}
h1{font-size:19px;letter-spacing:.3px;margin-bottom:4px}
h2{font-size:13px;text-transform:uppercase;letter-spacing:.8px;color:#8b94a6;margin:26px 0 10px}
.sub{color:#8b94a6;font-size:12px;margin-bottom:18px}
.cards{display:flex;gap:12px;flex-wrap:wrap}
.card{background:#151922;border:1px solid #2c333f;padding:14px 18px;min-width:150px}
.card .n{font-size:26px;font-weight:700;color:#fff}
.card .l{font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:#8b94a6;margin-top:2px}
table{border-collapse:collapse;width:100%;max-width:900px;background:#151922;border:1px solid #2c333f}
th,td{padding:8px 12px;text-align:left;border-bottom:1px solid #232936;font-variant-numeric:tabular-nums}
th{font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:#8b94a6;background:#12161e}
tr:last-child td{border-bottom:none}
td.num,th.num{text-align:right}
.empty{color:#616b7d;padding:14px 0}
form{background:#151922;border:1px solid #2c333f;padding:22px;max-width:340px;margin:8vh auto}
label{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:#8b94a6;margin:12px 0 5px}
input{width:100%;padding:9px 10px;background:#0f131a;border:1px solid #2c333f;color:#e9edf5;font:14px inherit}
button{margin-top:16px;width:100%;padding:10px;background:#e63946;border:1px solid #e63946;color:#fff;font:600 14px inherit;cursor:pointer}
.err{background:rgba(230,57,70,.12);border:1px solid #e63946;color:#ff9aa2;padding:8px 10px;font-size:12px;margin-bottom:6px}
a{color:#4da6ff}
`;

const loginPage = (err = '') => html(`<!doctype html><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>TN mapa — admin</title><style>${CSS}</style>
<form method="POST" action="/admin">
  <h1>TN mapa — admin</h1>
  <div class="sub">Přehled používání mapy</div>
  ${err ? `<div class="err">${esc(err)}</div>` : ''}
  <label for="email">E-mail</label>
  <input id="email" name="email" type="email" autocomplete="username" required>
  <label for="password">Heslo</label>
  <input id="password" name="password" type="password" autocomplete="current-password" required>
  <button type="submit">Přihlásit</button>
</form>`, err ? 401 : 200);

const fmtMin = sec => {
  const m = Math.round((Number(sec) || 0) / 60);
  if (m < 60) return m + ' min';
  return Math.floor(m / 60) + ' h ' + (m % 60) + ' min';
};
const fmtWhen = ms => {
  if (!ms) return '—';
  const d = new Date(Number(ms));
  return d.toLocaleString('cs-CZ', { timeZone: 'Europe/Prague' });
};

async function statsPage(env) {
  const q = async (sql, ...bind) => {
    try { const { results } = await env.DB.prepare(sql).bind(...bind).all(); return results || []; }
    catch (_) { return []; }
  };

  const totals = (await q(
    'SELECT COALESCE(SUM(seconds),0) s, COALESCE(SUM(exports),0) e, COALESCE(SUM(routes),0) r, ' +
    'COALESCE(SUM(chat),0) c, COUNT(DISTINCT client_id) u FROM usage_daily'
  ))[0] || { s: 0, e: 0, r: 0, c: 0, u: 0 };

  const people = await q(
    "SELECT client_id, MAX(CASE WHEN name <> '' THEN name END) nm, SUM(seconds) s, SUM(exports) e, " +
    'SUM(routes) r, SUM(chat) c, MAX(last_seen) ls FROM usage_daily GROUP BY client_id ORDER BY s DESC LIMIT 100'
  );
  const days = await q(
    'SELECT day, SUM(seconds) s, SUM(exports) e, SUM(routes) r, SUM(chat) c, ' +
    'COUNT(DISTINCT client_id) u FROM usage_daily GROUP BY day ORDER BY day DESC LIMIT 30'
  );

  const peopleRows = people.length ? people.map(p => `<tr>
      <td>${esc(p.nm || '—')}</td>
      <td style="color:#616b7d;font-size:12px">${esc(p.client_id).slice(0, 12)}</td>
      <td class="num">${fmtMin(p.s)}</td>
      <td class="num">${p.e || 0}</td>
      <td class="num">${p.r || 0}</td>
      <td class="num">${p.c || 0}</td>
      <td style="color:#8b94a6;font-size:12px">${esc(fmtWhen(p.ls))}</td>
    </tr>`).join('') : '';

  const dayRows = days.length ? days.map(d => `<tr>
      <td>${esc(d.day)}</td>
      <td class="num">${d.u || 0}</td>
      <td class="num">${fmtMin(d.s)}</td>
      <td class="num">${d.e || 0}</td>
      <td class="num">${d.r || 0}</td>
      <td class="num">${d.c || 0}</td>
    </tr>`).join('') : '';

  return html(`<!doctype html><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>TN mapa — admin</title><style>${CSS}</style>
<h1>TN mapa — statistiky používání</h1>
<div class="sub">Data se sbírají z appky na <a href="/">tnmap.pages.dev</a>. Jméno se ukáže, jen když si ho člověk v Nastavení zadá.</div>
<div class="cards">
  <div class="card"><div class="n">${fmtMin(totals.s)}</div><div class="l">Čas nad mapou</div></div>
  <div class="card"><div class="n">${totals.e || 0}</div><div class="l">Exportů</div></div>
  <div class="card"><div class="n">${totals.r || 0}</div><div class="l">Tras</div></div>
  <div class="card"><div class="n">${totals.c || 0}</div><div class="l">Dotazů na AI</div></div>
  <div class="card"><div class="n">${totals.u || 0}</div><div class="l">Lidí / prohlížečů</div></div>
</div>

<h2>Kdo kolik odpracoval</h2>
${peopleRows ? `<table><tr><th>Jméno</th><th>ID</th><th class="num">Čas</th><th class="num">Exporty</th><th class="num">Trasy</th><th class="num">AI</th><th>Naposledy</th></tr>${peopleRows}</table>`
             : '<div class="empty">Zatím nic — data začnou přitékat, jak lidé appku použijí.</div>'}

<h2>Po dnech (30 dní)</h2>
${dayRows ? `<table><tr><th>Den</th><th class="num">Lidí</th><th class="num">Čas</th><th class="num">Exporty</th><th class="num">Trasy</th><th class="num">AI</th></tr>${dayRows}</table>`
          : '<div class="empty">Zatím žádné dny.</div>'}
`);
}

export async function onRequest({ request, env }) {
  const secret = env.ADMIN_SECRET || env.ADMIN_PASSWORD || '';
  const email = env.ADMIN_EMAIL || '';
  const password = env.ADMIN_PASSWORD || '';

  if (!password || !email) {
    return html('<meta charset="utf-8"><p style="font:14px sans-serif;padding:24px">' +
      'Admin není nastavený — chybí secrets ADMIN_EMAIL / ADMIN_PASSWORD.</p>', 503);
  }
  if (!env.DB) return html('<meta charset="utf-8"><p style="font:14px sans-serif;padding:24px">Chybí D1 binding DB.</p>', 500);

  if (request.method === 'POST') {
    const form = await request.formData().catch(() => null);
    const e = String(form?.get('email') || '').trim().toLowerCase();
    const p = String(form?.get('password') || '');
    // Obě podmínky vyhodnotíme vždy, ať odpověď neprozradí, co bylo špatně.
    const okMail = safeEqual(e, email.trim().toLowerCase());
    const okPass = safeEqual(p, password);
    if (!(okMail && okPass)) return loginPage('Neplatný e-mail nebo heslo.');
    const session = await makeSession(secret);
    return html('<meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/admin">', 302, {
      'Set-Cookie': `${COOKIE}=${session}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_HOURS * 3600}`,
      Location: '/admin',
    });
  }

  if (await validSession(secret, getCookie(request, COOKIE))) return statsPage(env);
  return loginPage();
}
