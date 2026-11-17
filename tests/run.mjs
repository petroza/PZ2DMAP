// Spustí testy TN mapy a vypíše souhrn.
//   node tests/run.mjs                 rychlé testy proti místnímu serveru
//   node tests/run.mjs 05 11           jen vybrané (podle čísla nebo části názvu)
//   SLOW=1 node tests/run.mjs          i pomalé (hromadný export videa)
//   BASE_URL=https://tnmap.pages.dev/ node tests/run.mjs   proti nasazené verzi
// Zápisy do databáze testy vždy zachytí (lib.js), nic se nepřepíše.
import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const filters = process.argv.slice(2);
const slow = process.env.SLOW === '1';
const files = readdirSync(DIR).filter(f => f.endsWith('.test.js') || f.endsWith('.test.mjs'))
  .filter(f => slow || !f.includes('.slow.') || filters.some(x => f.includes(x)))
  .filter(f => !filters.length || filters.some(x => f.includes(x))).sort();

let server = null;
const env = {...process.env};
if(!env.BASE_URL){
  const port = env.PORT || '8788';
  env.BASE_URL = `http://localhost:${port}/`;
  server = spawn(process.execPath, [path.join(DIR, 'serve.mjs'), port], {stdio:['ignore', 'pipe', 'inherit']});
  await new Promise(res => { server.stdout.once('data', res); setTimeout(res, 3000); });
}
console.log(`TN mapa — testy proti ${env.BASE_URL} (${files.length})\n`);

const results = [];
for(const f of files){
  const t0 = Date.now();
  console.log(`▶ ${f}`);
  const runOnce = () => new Promise(res => {
    const p = spawn(process.execPath, [path.join(DIR, f)], {env, stdio:'inherit'});
    const limit = setTimeout(() => { console.log('   ⏱ časový limit'); p.kill('SIGKILL'); }, f.includes('.slow.') ? 900000 : 300000);
    p.on('exit', c => { clearTimeout(limit); res(c ?? 1); });
  });
  let code = await runOnce(), retried = false;
  // Testy s geokódováním přes internet občas zakolísají — jeden opakovaný pokus
  // (RETRY=0 vypne). V souhrnu je pak výslovně vidět „napodruhé".
  if(code !== 0 && process.env.RETRY !== '0' && !f.includes('.slow.')){ console.log('   ↻ opakuji'); retried = true; code = await runOnce(); }
  results.push({f, ok: code === 0, retried, s: Math.round((Date.now() - t0) / 1000)});
  console.log('');
}
server?.kill();
console.log('SOUHRN');
for(const r of results) console.log(`  ${r.ok ? '✓' : '✗'} ${r.f} (${r.s} s)${r.ok && r.retried ? ' — prošel napodruhé' : ''}`);
const bad = results.filter(r => !r.ok).length;
console.log(bad ? `\n${bad} z ${results.length} selhalo.` : `\nVše prošlo (${results.length}).`);
process.exit(bad ? 1 : 0);
