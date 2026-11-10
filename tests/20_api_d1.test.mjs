// Serverové API (Pages Functions) nad náhradní D1: ukládání, ochrana proti
// hromadnému smazání, historie verzí a obnova, statistika funkcí.
import { makeD1 } from './d1mock.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { onRequest: map } = await import(path.join(R, 'functions/api/map.js'));
const { onRequest: usage } = await import(path.join(R, 'functions/api/usage.js'));
const { listHistory, restoreHistory } = await import(path.join(R, 'functions/api/_history.js'));

const fails = [];
const check = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails.push(m); };
const env = { DB: makeD1([path.join(R, 'schema.sql'), path.join(R, 'schema_usage.sql')]) };
const TOKEN = 'cb33ba7ccfac453f960cccf692654bbd3f7cf79a7264460a';
const post = (body, token = TOKEN) => map({ env, request: new Request('https://x/api/map', { method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Api-Token': token } : {}) }, body: JSON.stringify(body) }) });
const get = async entity => (await (await map({ env, request: new Request('https://x/api/map?entity=' + entity) })).json()).items;
const P = n => Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'Projekt ' + i }));

let r = await post({ entity: 'projects', action: 'replace', items: P(6) });
check(r.status === 200 && (await get('projects')).length === 6, 'uložení 6 projektů');
r = await post({ entity: 'projects', action: 'replace', items: P(6) }, '');
check(r.status === 401, 'zápis bez tokenu odmítnut');
r = await post({ entity: 'projects', action: 'replace', items: P(5) });
check(r.status === 200 && (await get('projects')).length === 5, 'smazání jednoho projektu projde');
r = await post({ entity: 'projects', action: 'replace', items: P(1) });
const body = await r.json();
check(r.status === 409 && body.guard === 'bulk-delete', 'zápis, který by smazal 4 z 5, odmítnut (409)');
check((await get('projects')).length === 5, 'po odmítnutí zůstalo 5 projektů');
r = await post({ entity: 'projects', action: 'replace', items: P(1), allowBulkDelete: true });
check(r.status === 200 && (await get('projects')).length === 1, 'vědomé hromadné smazání (allowBulkDelete) projde');
const hist = await listHistory(env);
check(hist.length >= 2 && hist[0].count === 5, `historie verzí (${hist.length}, poslední před smazáním: ${hist[0]?.count} položek)`);
r = await restoreHistory(env, hist[0].id);
check(r.ok && (await get('projects')).length === 5, 'obnova verze vrátí 5 projektů');
check((await listHistory(env))[0].reason.startsWith('před obnovou'), 'stav před obnovou se uložil do historie');
const del = env.DB.raw.prepare("SELECT COUNT(*) n FROM deletions WHERE entity='projects' AND id IN ('p1','p2','p3','p4')").get();
check(del.n === 0, 'obnovené projekty nejsou vedené jako smazané');
await post({ entity: 'projects', action: 'replace', items: P(5) });
await post({ entity: 'projects', action: 'replace', items: P(5) });
const h2 = await listHistory(env);
check(h2[0].id === (await listHistory(env))[0].id && h2.filter(h => h.count === 5).length <= 3, 'stejný stav se do historie neukládá dvakrát');
// statistika funkcí
const u = await usage({ env, request: new Request('https://x/api/usage', { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ clientId: 'c1', features: { 'tpl:nehoda': 2, 'bad key!': 9 } }) }) });
const s = await (await usage({ env, request: new Request('https://x/api/usage?days=7') })).json();
check(u.status === 200 && s.features.length === 1 && s.features[0].feature === 'tpl:nehoda' && s.features[0].count === 2, 'statistika funkcí: platný klíč uložen, neplatný odmítnut');

if (fails.length) { console.log('SELHALO ' + fails.length); process.exit(1); }
console.log('OK');
