// Asistent: nástroje window.TNMAP proti popisu ve workeru, panel chatu (prázdný stav,
// „pracuji", výpadek sítě, vyčerpaný limit, historie, klávesy) a panel zkratek.
// Skutečný model se nevolá — worker je podvržený.
const fs = require('fs');
const path = require('path');
const {check, done, open, status} = require('./lib');
(async () => {
  const {page, ctx, errors, close} = await open();
  const T = (name, args) => page.evaluate(([n, a]) => window.TNMAP[n](a), [name, args || {}]);
  const sleep = ms => page.waitForTimeout(ms);
  page.setDefaultTimeout(120000);   // vytížený stroj: překreslení mapy umí zdržet i obyčejné klepnutí

  // --- popis nástrojů ve workeru odpovídá appce --------------------------------
  const worker = fs.readFileSync(path.join(__dirname, '..', 'worker', 'tnmap-chat.built.js'), 'utf8');
  const toolsTxt = worker.slice(worker.indexOf('var TOOLS = `'), worker.indexOf('`.trim();'));
  const names = [...toolsTxt.matchAll(/^([a-zA-Z][a-zA-Z0-9]*) \{/gm)].map(m => m[1]);
  const have = await page.evaluate(() => Object.keys(window.TNMAP).filter(k => typeof window.TNMAP[k] === 'function'));
  const missing = names.filter(n => !have.includes(n));
  check(names.length >= 30 && missing.length === 0, `všech ${names.length} nástrojů z workeru v appce existuje` + (missing.length ? ' — chybí ' + missing.join(', ') : ''));
  const ids = [...new Set([...toolsTxt.slice(toolsTxt.indexOf('POVOLENÁ ID')).matchAll(/\b([a-zA-Z0-9]+Section)\b/g)].map(m => m[1]))];
  const noSec = await page.evaluate(ids => ids.filter(id => !document.getElementById(id)), ids);
  check(ids.length >= 12 && noSec.length === 0, `všech ${ids.length} sekcí pro openSection existuje` + (noSec.length ? ' — chybí ' + noSec.join(', ') : ''));
  check(!/pzTemplateSection|czPoliticalSection|weatherLayersSection|setWeather \{|region\?/.test(worker), 'worker neodkazuje na zrušené věci (Rychlá scéna, kraje, počasí)');
  const tabs = await page.evaluate(() => window.TNMAP.catalog.tabs);
  check(['scena', 'trasa', 'animace', 'export', 'styly', 'projekt', 'nastaveni'].every(t => tabs.includes(t)), 'záložky: 5 + Projekt + Nastavení');

  // --- nové a upravené nástroje ---------------------------------------------------
  await page.evaluate(() => { window.__chg = []; ['pzVehiclePreset', 'pzVehicleBody', 'pzVehicleAccent'].forEach(id => document.getElementById(id)?.addEventListener('change', () => window.__chg.push(id))); });
  let r = await T('setVehicleColors', {preset: 'tmavý podklad', body: 'červená', accent: '#00ff00'});
  const veh = await page.evaluate(() => ({p: document.getElementById('pzVehiclePreset').value, b: document.getElementById('pzVehicleBody').value, a: document.getElementById('pzVehicleAccent').value, chg: window.__chg}));
  check(r.ok && r.preset === 'dark' && veh.b !== '#f8fafc' && veh.a === '#00ff00' && ['pzVehiclePreset', 'pzVehicleBody', 'pzVehicleAccent'].every(id => veh.chg.includes(id)),
    'setVehicleColors nastaví ovládací prvky a vyvolá change — ' + JSON.stringify(veh));
  check((await T('setVehicleColors', {preset: 'fialová sada'})).ok === false, 'setVehicleColors: neznámá sada vrátí chybu');

  r = await T('placeIcon', {place: '49.5415,15.3593', kind: 'nehoda', zoom: 12.5});
  const r2 = await T('addLabel', {place: '49.5415,15.3593', text: 'NEHODA', style: 'TN červená'});
  await sleep(400);
  const geo = await page.evaluate(() => { const ic = document.querySelector('.scene-icon-marker').getBoundingClientRect(), b = document.querySelector('.map-label-marker .map-label-bubble').getBoundingClientRect(),
    s = document.querySelector('.map-label-marker .map-label-square').getBoundingClientRect();
    return {above: b.bottom <= ic.top, dx: Math.round((Math.min(b.left, s.left) + Math.max(b.right, s.right)) / 2 - (ic.left + ic.width / 2)), style: document.querySelector('.map-label-marker').dataset.lstyle, zoom: window.__tnMap.getZoom()}; });
  check(r.ok && r2.ok && geo.above && Math.abs(geo.dx) <= 3 && geo.style === 'red' && Math.abs(geo.zoom - 12.5) < 0.1, 'ikonka + popisek: přelet na místo, popisek vystředěný nad ikonkou, styl TN červená — ' + JSON.stringify(geo));
  r = await T('setLabelStyle', {style: 'modrý', all: true});
  check(r.ok && r.changed === 1 && await page.$eval('.map-label-marker', e => e.dataset.lstyle === 'navy'), 'setLabelStyle přebarví popisky (TN modrá)');
  check((await T('addLabel', {place: '49.5,15.3', style: 'duhový'})).ok === false, 'addLabel: neznámý styl vrátí chybu');

  r = await T('selectObjects', {action: 'all'});
  check(r.ok && r.selected === 2, 'selectObjects all vybere ikonku i popisek');
  r = await T('selectObjects', {action: 'delete'});
  check(r.ok && r.deleted === 2 && await page.$$eval('.scene-icon-marker,.map-label-marker', e => e.length) === 0, 'selectObjects delete smaže vybrané');

  await T('addLabel', {place: '49.2,16.6', text: 'A'}); await T('drawPerimeter', {place: '49.2,16.6', km: 5}); await T('colorPolitical', {country: 'Polsko', color: 'zelená'});
  await sleep(600);
  await page.evaluate(() => window.__pzPushUndo());
  r = await T('clearScene', {what: 'all'});
  let sc = await page.evaluate(() => window.TNMAP.getState().scene);
  check(r.ok && Object.keys(sc).length === 0, 'clearScene all smaže celou scénu — ' + JSON.stringify(sc));
  await T('undo'); await sleep(1500);
  sc = await page.evaluate(() => window.TNMAP.getState().scene);
  check((sc.labels || []).length === 1 && (sc.perimeters || []).length === 1 && Object.keys(sc.colored || {}).length === 1, 'krok zpět smazanou scénu vrátí — ' + JSON.stringify(sc));
  r = await T('colorPolitical', {country: 'Polsko', clear: true});
  check(r.ok && !(await page.evaluate(() => window.TNMAP.getState().scene.colored)), 'colorPolitical clear zruší barvu jednoho státu');
  await T('clearScene', {what: 'all'});

  r = await T('showRegion', {region: 'Evropu'}); await sleep(1300);
  check(r.ok && r.region === 'europe' && await page.evaluate(() => window.__tnMap.getZoom() < 5), 'showRegion: Evropa bez geokódování');
  const z0 = await page.evaluate(() => window.__tnMap.getZoom());
  await T('setCamera', {zoomBy: 1}); await sleep(1200);
  check(await page.evaluate(z => window.__tnMap.getZoom() - z > 0.9, z0), 'setCamera zoomBy přiblíží o stupeň');
  r = await T('setUiTheme', {mode: 'světlý'});
  check(r.mode === 'light' && await page.evaluate(() => document.documentElement.dataset.ui === 'light'), 'setUiTheme: světlý režim aplikace');
  await T('setUiTheme', {mode: 'dark'});
  r = await T('setLanguage', {lang: 'slovenština'}); await sleep(600);
  check(r.lang === 'sk' && await page.evaluate(() => document.documentElement.lang === 'sk'), 'setLanguage přepne jazyk');
  await T('setLanguage', {lang: 'cs'}); await sleep(600);
  r = await T('playAnimation', {action: 'play'});
  check(r.ok === false && /trasa/.test(r.error), 'playAnimation bez trasy řekne proč nejde');
  r = await T('openTab', {tab: 'nastaveni'});
  check(r.ok && await page.$eval('#settingsPanel', e => !e.hidden), 'openTab nastaveni otevře Nastavení');
  await page.keyboard.press('Escape');
  r = await T('openSection', {section: 'sunShadowSection'});
  check(r.ok && await page.$eval('#sunShadowSection', e => e.offsetParent !== null), 'openSection ukáže i pokročilou sekci (zapne Pokročilé funkce)');
  await page.evaluate(() => { try{ localStorage.setItem('pzAdvanced', '0'); }catch(e){} });
  const dl = page.waitForEvent('download', {timeout: 60000}).catch(() => null);
  r = await T('exportPng');
  check(r.ok && !!(await dl), 'exportPng stáhne snímek');

  // --- panel zkratek -----------------------------------------------------------------
  await page.mouse.click(900, 450); await page.keyboard.press('?'); await sleep(250);
  const sc4 = await page.evaluate(() => ({open: !document.getElementById('shortcutsPanel').hidden, groups: [...document.querySelectorAll('#shortcutsPanel .sc-group h5')].map(h => h.textContent),
    loose: document.querySelectorAll('#shortcutsPanel > .sc-row').length, rows: document.querySelectorAll('#shortcutsPanel .sc-group .sc-row').length}));
  check(sc4.open && sc4.groups.join('|') === 'Mapa|Objekty|Trasa a animace|Obecné' && sc4.loose === 0 && sc4.rows >= 14, 'zkratky: ? otevře panel se čtyřmi skupinami — ' + JSON.stringify(sc4));
  await page.keyboard.press('Escape'); await sleep(150);
  check(await page.$eval('#shortcutsPanel', e => e.hidden), 'Esc panel zkratek zavře');
  await page.keyboard.press('r'); await sleep(400);
  check(/Mapa obnovena/.test(await status(page)), 'zkratka R obnoví mapu');
  await sleep(1500);
  await page.keyboard.press(' '); await sleep(300);
  check(/Nejdřív najdi trasu/.test(await status(page)), 'mezerník spouští přehrávání (bez trasy to řekne)');
  await page.evaluate(() => window.TNMAP.routeBetween({from: '50.08,14.43', to: '49.19,16.61', mode: 'planeDirect'})); await sleep(1500);
  await page.keyboard.press(' '); await sleep(300);
  check(await page.evaluate(() => window.__pzFns.state.animPlaying), 'mezerník přehraje animaci trasy');
  await page.keyboard.press(' '); await sleep(200);
  check(await page.evaluate(() => !window.__pzFns.state.animPlaying), 'druhý mezerník ji pozastaví');
  await T('clearScene', {what: 'route'});

  // --- panel chatu -------------------------------------------------------------------
  let n = 0, mode = 'ok';
  await ctx.route(/tnmap-chat/, async r => { n++;
    if(mode === 'fail') return r.abort();
    if(mode === 'quota') return r.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({say: 'limit', calls: [], done: true, quota: true})});
    await new Promise(res => setTimeout(res, 900));
    r.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({say: 'Rozumím.', calls: [], done: true})}); });
  const idle = () => page.waitForFunction(() => !document.getElementById('tnchatSend').disabled, null, {timeout: 60000}).catch(() => {});
  await page.click('.tnchat-fab'); await sleep(300);
  const ex = await page.$$eval('#tnchatChips .tnchat-chip', e => e.map(b => b.textContent));
  check(ex.length >= 4 && ex.length <= 6, 'prázdný stav: ' + ex.length + ' příkladů — ' + ex.join(' | '));
  check(await page.evaluate(() => document.activeElement?.id === 'tnchatInput'), 'po otevření je fokus v poli (počítač)');
  await page.click('#tnchatChips .tnchat-chip:nth-child(5)'); await idle(); await sleep(400);   // „Přepni na satelit" — bez AI
  check(n === 0 && await page.$eval('#baseStyle', e => e.value === 'satellite') && await page.$$eval('#tnchatChips', e => e.length) === 0, 'klepnutí na příklad povel provede a příklady zmizí');
  await page.fill('#tnchatInput', 'první řádek'); await page.press('#tnchatInput', 'Shift+Enter'); await page.keyboard.type('druhý');
  check(await page.$eval('#tnchatInput', e => e.value === 'první řádek\ndruhý') && await page.$$eval('.tnchat-msg.user', e => e.length) === 1, 'Shift+Enter udělá nový řádek, neodešle');
  await page.press('#tnchatInput', 'Enter'); await sleep(300);
  const busy = await page.evaluate(() => ({el: !!document.querySelector('.tnchat-busy'), txt: document.querySelector('.tnchat-busy')?.textContent, dis: document.getElementById('tnchatSend').disabled}));
  check(busy.el && /Pracuji/.test(busy.txt) && busy.dis, 'během dotazu je vidět „Pracuji" a odeslání je zamčené');
  await idle(); await sleep(300);
  check(n === 1 && await page.$$eval('.tnchat-busy', e => e.length) === 0 && /Rozumím/.test(await page.$$eval('.tnchat-msg.bot', e => e[e.length - 1].textContent)), 'Enter odešle, odpověď dorazí a „Pracuji" zmizí');
  const msgs = await page.$$eval('.tnchat-msg', e => e.length);
  await page.keyboard.press('Escape'); await sleep(200);
  check(await page.$eval('#tnchatPanel', e => !e.classList.contains('open')), 'Esc panel chatu zavře');
  await page.click('.tnchat-fab'); await sleep(300);
  check(await page.$$eval('.tnchat-msg', e => e.length) === msgs && msgs >= 4, 'historie po zavření a otevření zůstává (' + msgs + ' zpráv)');
  // výpadek sítě → hláška, Zkusit znovu, povely bez AI
  mode = 'fail'; n = 0;
  await page.fill('#tnchatInput', 'obarvi Polsko zeleně'); await page.press('#tnchatInput', 'Enter'); await idle(); await sleep(300);
  const err = await page.evaluate(() => { const e = [...document.querySelectorAll('.tnchat-msg.err')].pop(); return e ? {txt: e.textContent, retry: !!e.querySelector('.tnchat-retry'), chips: e.querySelectorAll('.tnchat-chip').length} : null; });
  check(n === 1 && err && /neodpovídá/.test(err.txt) && err.retry && err.chips >= 4, 'výpadek sítě: česká hláška, Zkusit znovu a povely bez AI');
  mode = 'ok'; const users = await page.$$eval('.tnchat-msg.user', e => e.length);
  await page.click('.tnchat-retry'); await idle(); await sleep(300);
  check(n === 2 && await page.$$eval('.tnchat-msg.user', e => e.length) === users && await page.$$eval('.tnchat-msg.err', e => e.length) === 0, 'Zkusit znovu pošle dotaz znovu bez zdvojení zprávy');
  // vyčerpaný denní limit
  mode = 'quota'; n = 0;
  await page.fill('#tnchatInput', 'obarvi Německo modře'); await page.press('#tnchatInput', 'Enter'); await idle(); await sleep(300);
  const q = await page.evaluate(() => { const e = [...document.querySelectorAll('.tnchat-msg.err')].pop(); return e ? {txt: e.textContent, chips: [...e.querySelectorAll('.tnchat-chip')].map(b => b.textContent)} : null; });
  check(q && /Denní limit AI je vyčerpaný/.test(q.txt) && /Bez AI funguje dál/.test(q.txt) && q.chips.includes('Zpět'), 'vyčerpaný limit: hláška + co funguje bez AI — ' + (q ? q.chips.join(' | ') : ''));
  n = 0; await page.click('.tnchat-msg.err:last-of-type .tnchat-chip'); await idle(); await sleep(300);
  check(n === 0, 'povel z nabídky „bez AI" se obejde bez workeru');
  // nová konverzace → zpět příklady
  await page.click('#tnchatNew'); await sleep(200);
  check(await page.$$eval('#tnchatChips .tnchat-chip', e => e.length) >= 4 && await page.$$eval('.tnchat-msg', e => e.length) === 0, 'Nová konverzace vrátí prázdný stav s příklady');
  // chat a panel Projekt se nepřekrývají
  await page.click('#projectPanelBtn'); await sleep(400);
  const ov = await page.evaluate(() => { const a = document.getElementById('tnchatPanel').getBoundingClientRect(), b = document.getElementById('projectPanel').getBoundingClientRect();
    return {both: document.getElementById('tnchatPanel').classList.contains('open') && !document.getElementById('projectPanel').hidden, hit: !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top)}; });
  check(ov.both && !ov.hit, 'široká obrazovka: chat a Projekt vedle sebe bez překryvu');
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await page.setViewportSize({width: 1000, height: 800}); await sleep(400);
  await page.click('.tnchat-fab'); await sleep(300);
  await page.click('#projectPanelBtn'); await sleep(400);
  check(await page.evaluate(() => !document.getElementById('projectPanel').hidden && !document.getElementById('tnchatPanel').classList.contains('open')), 'užší obrazovka: otevřený Projekt chat zavře (nepřekrývají se)');
  check(errors.length === 0, 'žádná chyba stránky' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await close();

  // --- telefon: po otevření chatu nevyskočí klávesnice ---------------------------------
  const ph = await open({device: 'iPhone 13'});
  await ph.page.click('.tnchat-fab'); await ph.page.waitForTimeout(400);
  check(await ph.page.evaluate(() => document.getElementById('tnchatPanel').classList.contains('open') && document.activeElement?.id !== 'tnchatInput'), 'telefon: chat se otevře bez fokusu do pole');
  check(ph.errors.length === 0, 'telefon: žádná chyba stránky');
  await ph.close();
  done();
})();
