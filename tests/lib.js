// Společné pomůcky pro testy TN mapy (Playwright).
//   BASE_URL   adresa appky (výchozí http://localhost:8788/ ze serve.mjs)
//   OUT_DIR    kam ukládat snímky a exporty (výchozí tests/out)
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:8788/';
const OUT = process.env.OUT_DIR || path.join(__dirname, 'out');
fs.mkdirSync(OUT, {recursive: true});

const failures = [];
function check(cond, msg){ console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if(!cond) failures.push(msg); return !!cond; }
function done(){ if(failures.length){ console.log(`SELHALO ${failures.length}:\n  - ` + failures.join('\n  - ')); process.exit(1); } console.log('OK'); process.exit(0); }

// Otevře appku. Zápisy do databáze (/api/map, /api/share, /api/usage) se vždy
// zachytí — náhled i produkce sdílejí jednu D1, testy nesmí nic přepsat.
async function open({viewport = {width:1600, height:950}, device, store, theme, wait = 5000, dsf = 1} = {}){
  const browser = await chromium.launch({args:['--enable-unsafe-webgpu','--ignore-gpu-blocklist']});
  const ctx = await browser.newContext(device ? {...devices[device], acceptDownloads:true} : {viewport, deviceScaleFactor: dsf, acceptDownloads:true});
  await routeWrites(ctx, store);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).split('\n')[0].slice(0, 160)));
  page.on('dialog', d => d.accept().catch(()=>{}));
  if(theme === 'light') await page.addInitScript(() => { try{ localStorage.setItem('pzUiTheme', 'light'); }catch(e){} });
  await page.goto(BASE, {waitUntil:'load', timeout: 120000});
  await page.waitForTimeout(wait);
  return {browser, ctx, page, errors, close: () => browser.close()};
}

// store = {} → zápisy se uloží do paměti a GET je vrátí (test uložení/načtení projektu)
async function routeWrites(ctx, store){
  await ctx.route(/\/api\/(map|share|usage)/, async r => {
    const req = r.request();
    if(req.method() === 'GET'){
      const e = new URL(req.url()).searchParams.get('entity');
      if(store && e && store[e]) return r.fulfill({status:200, contentType:'application/json', body: JSON.stringify({ok:true, items:store[e]})});
      return r.continue();
    }
    if(store && /\/api\/map/.test(req.url())){ try{ const b = JSON.parse(req.postData() || '{}'); if(b.entity) store[b.entity] = b.items; }catch(e){} }
    return r.fulfill({status:200, contentType:'application/json', body:'{"ok":true}'});
  });
}

const status = page => page.$eval('#statusBar', e => e.textContent.trim());
const tab = (page, name) => page.click(`.tab-btn[data-tab="${name}"]`).then(() => page.waitForTimeout(250));
const openSection = (page, id) => page.evaluate(id => { const s = document.getElementById(id); if(s?.classList.contains('collapsed')) s.querySelector('h3').click(); s?.scrollIntoView(); }, id);
const shot = (page, name, opts = {}) => page.screenshot({path: path.join(OUT, name), ...opts});

module.exports = {BASE, OUT, check, done, open, routeWrites, status, tab, openSection, shot, devices};
