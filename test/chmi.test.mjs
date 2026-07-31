// Ověření ČHMÚ Function proti výstupu původního PHP.
// Netestuje kopii logiky, ale PŘÍMO nasazovaný chmi.js — fetch je podstrčený,
// aby vracel lokálně stažené CAP XML, takže výsledek jde porovnat 1:1.
//
// Spuštění:  node test/chmi.test.mjs <cap.xml> <php_reference.json>
import fs from 'node:fs';
import { onRequest } from '../functions/api/chmi.js';

const [capPath, phpPath] = process.argv.slice(2);
if (!capPath || !phpPath) {
  console.error('Použití: node test/chmi.test.mjs <cap.xml> <php_reference.json>');
  process.exit(2);
}

const xml = fs.readFileSync(capPath, 'utf8');
globalThis.fetch = async () => new Response(xml, { status: 200 });

const res = await onRequest();
const mine = await res.json();
const php = JSON.parse(fs.readFileSync(phpPath, 'utf8'));

const orpMine = mine.orpColors || {};
const orpPhp = php.orpColors || {};

let orpDiff = 0;
const examples = [];
for (const [k, v] of Object.entries(orpPhp)) {
  if (orpMine[k] !== v) {
    orpDiff++;
    if (examples.length < 5) examples.push(`${k}: PHP=${v} JS=${orpMine[k]}`);
  }
}
const onlyInMine = Object.keys(orpMine).filter(k => !(k in orpPhp));

const evMine = mine.events || [], evPhp = php.events || [];
let evDiff = 0;
const evExamples = [];
for (let i = 0; i < Math.min(evMine.length, evPhp.length); i++) {
  const a = evMine[i], b = evPhp[i];
  const same = a.event === b.event && a.color === b.color && a.type === b.type &&
               (a.areas || []).length === (b.areas || []).length &&
               a.in_progress === b.in_progress;
  if (!same) {
    evDiff++;
    if (evExamples.length < 3) {
      evExamples.push(`#${i} JS[${a.event}|${a.color}|${a.type}|${(a.areas||[]).length}|${a.in_progress}] ` +
                      `PHP[${b.event}|${b.color}|${b.type}|${(b.areas||[]).length}|${b.in_progress}]`);
    }
  }
}

console.log('Content-Type :', res.headers.get('Content-Type'));
console.log('Cache-Control:', res.headers.get('Cache-Control'));
console.log('CORS         :', res.headers.get('Access-Control-Allow-Origin'));
console.log('maxColor     : JS=%s  PHP=%s', mine.maxColor, php.maxColor);
console.log('count        : JS=%d  PHP=%d', mine.count, php.count);
console.log('ORP celkem   : JS=%d  PHP=%d', Object.keys(orpMine).length, Object.keys(orpPhp).length);
console.log('ORP rozdílů  : %d %s', orpDiff, examples.length ? '| ' + examples.join(', ') : '');
console.log('ORP jen v JS : %d', onlyInMine.length);
console.log('events rozdíl: %d %s', evDiff, evExamples.length ? '\n  ' + evExamples.join('\n  ') : '');
if (evMine[0]) console.log('1. event JS  :', evMine[0].event, '|', evMine[0].color, '| areas:', (evMine[0].areas || []).length);
if (evMine[0]) console.log('  detail    :', String(evMine[0].detail || '').slice(0, 70));

const ok = mine.maxColor === php.maxColor && mine.count === php.count &&
           Object.keys(orpMine).length === Object.keys(orpPhp).length &&
           orpDiff === 0 && onlyInMine.length === 0 && evDiff === 0;
console.log(ok ? '\n>>> SHODA S PHP — Function je věrná náhrada <<<' : '\n>>> ROZDÍL — nutná oprava <<<');
process.exit(ok ? 0 : 1);
