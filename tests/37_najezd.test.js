// Nájezd na místa (typ zadání G): „mapu ČR a nájezd na Valašské Meziříčí", „ke každému městu
// zvlášť mapu, kde bude nájezd… jako jingle" (6 měst = 6 videí). Místa jako souřadnice (bez geokódování).
const fs = require('fs');
const path = require('path');
const {check, done, open, tab, openSection, OUT} = require('./lib');
(async () => {
  const {page, errors, close} = await open();
  await page.waitForFunction(() => window.__tnMap?.loaded?.() && !window.__tnMap.isMoving(), null, {timeout: 30000}).catch(() => {});
  await page.waitForTimeout(1500);
  const T = (name, args) => page.evaluate(([n, a]) => window.TNMAP[n](a), [name, args]);
  const S = () => page.evaluate(() => { const s = window.__pzFns.state; return {kfs: s.cameraAnim.keyframes.map(k => k.view), space: s.cameraAnim.space, fly: s.pzFlyIn, enabled: s.cameraAnim.enabled}; });
  const VM = '49.4718,17.9711', VM_LL = [17.9711, 49.4718];

  // --- jedno místo nástrojem flyInTo
  let r = await T('flyInTo', {place: VM, label: 'Valašské Meziříčí', duration: 5, hold: 2});
  check(r.ok && r.from === 'cz' && r.zoom === 'city' && r.seconds === 7, 'flyInTo: nájezd z ČR na město, 5 s + 2 s pauza ' + JSON.stringify(r));
  let st = await S();
  check(st.enabled && st.space === 'frame' && st.kfs.length === 2, 'kamera: přelet o dvou záběrech ve výřezu exportu');
  check(st.kfs[0].zoom < 7.5 && st.kfs[0].zoom > 5.5 && Math.abs(st.kfs[0].center[0] - 15.5) < 1, 'začátek = celá ČR (zoom ' + st.kfs[0].zoom.toFixed(2) + ')');
  check(Math.abs(st.kfs[1].center[0] - VM_LL[0]) < 1e-6 && Math.abs(st.kfs[1].center[1] - VM_LL[1]) < 1e-6 && st.kfs[1].zoom > 11, 'konec = Valašské Meziříčí, zoom města');
  check(st.fly && st.fly.text === 'Valašské Meziříčí' && st.fly.pin && st.fly.label, 'cíl: špendlík a název');
  const tm = await page.evaluate(() => ({dur: document.getElementById('animDuration').value, hold: document.getElementById('animEndHold').value}));
  check(tm.dur === '5' && tm.hold === '2', 'časování v Animaci: délka 5 s, pauza 2 s');
  // časování cíle: v klidu vidět (jako trasa), při přehrávání skrytý až do konce nájezdu
  const ages = await page.evaluate(() => { const s = window.__pzFns.state, out = {}; out.rest = window.__pzFns.pzFlyInAge();
    s.animPlaying = true; for(const e of [0.01, 2.5, 4.6, 5.2, 7]){ s.animElapsed = e; out[e] = window.__pzFns.pzFlyInAge(); } s.animPlaying = false; s.animElapsed = 0; return out; });
  check(ages.rest === null || ages.rest > 1e6, 'v klidu na začátku je cíl vidět celý (náhled, PNG)');
  check(ages['0.01'] < 0 && ages['2.5'] < 0 && ages['4.6'] < 0 && ages['5.2'] > 0 && ages['7'] > 1, 'při přehrávání naskočí až na konci nájezdu ' + JSON.stringify(ages));
  // náhled: konec animace, špendlík v plátně nad rámečkem tam, kde je místo
  await T('playAnimation', {action: 'seek', time: 7});
  await page.waitForTimeout(1500);
  const pv = await page.evaluate(ll => { const c = document.getElementById('pzFlyInOverlay'), m = window.__tnMap, fr = document.getElementById('exportFrame').getBoundingClientRect(), mr = m.getCanvas().getBoundingClientRect();
    const p = m.project(ll), cr = c.getBoundingClientRect(), x = c.getContext('2d'), sx = c.width / cr.width;
    const fx = (p.x + mr.left - cr.left) * sx, fy = (p.y + mr.top - cr.top) * sx, R = Math.round(30 * sx);
    const d = x.getImageData(Math.round(fx - R), Math.round(fy - 2.2 * R), 2 * R, 2 * R).data; let red = 0; for(let i = 0; i < d.length; i += 4) if(d[i + 3] > 200 && d[i] > 200 && d[i + 1] < 90) red++;
    return {hidden: c.hidden, aligned: Math.abs(cr.left - fr.left) < 2 && Math.abs(cr.width - fr.width) < 2, red}; }, VM_LL);
  check(!pv.hidden && pv.aligned && pv.red > 20, 'náhled: špendlík nad místem v plátně přes výřez ' + JSON.stringify(pv));
  await page.screenshot({path: path.join(OUT, '37_najezd_nahled.png')});

  // --- PNG na konci nájezdu: špendlík a popisek tam, kde v náhledu
  const spot = await page.evaluate(ll => { const m = window.__tnMap, f = document.getElementById('exportFrame').getBoundingClientRect(), c = m.getCanvas().getBoundingClientRect(); const p = m.project(ll); return [(p.x + c.left - f.left) / f.width, (p.y + c.top - f.top) / f.height]; }, VM_LL);
  await tab(page, 'export');
  let dl = page.waitForEvent('download', {timeout: 120000}).catch(() => null);
  await page.evaluate(() => document.getElementById('exportPngBtn').click());
  let d = await dl; check(!!d, 'export PNG proběhl');
  if(d){
    const file = path.join(OUT, '37_najezd_export.png'); await d.saveAs(file);
    const px = await page.evaluate(async ([b64, s]) => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const k = img.height / 1080, X = s[0] * img.width, Y = s[1] * img.height;
      const cnt = (x0, y0, w, h, f) => { const d = x.getImageData(Math.round(x0), Math.round(y0), Math.round(w), Math.round(h)).data; let n = 0; for(let i = 0; i < d.length; i += 4) if(f(d[i], d[i+1], d[i+2])) n++; return n / (d.length / 4); };
      return {pin: cnt(X - 20 * k, Y - 70 * k, 40 * k, 50 * k, (r, g, b) => r > 200 && g < 90 && b < 90),
        label: cnt(X + 40 * k, Y - 100 * k, 300 * k, 70 * k, (r, g, b) => r < 40 && g < 50 && b > 70)}; }, [fs.readFileSync(file).toString('base64'), spot]);
    check(px.pin > 0.2 && px.label > 0.25, 'v PNG je červený špendlík nad místem a modrý popisek vpravo ' + JSON.stringify(px));
  }

  // --- krok zpět, projekt, clearScene
  const snap = await page.evaluate(() => JSON.stringify(window.__pzFns.serializeProjectSnapshot().flyIn));
  check(/Valašské Meziříčí/.test(snap) && /"pin":true/.test(snap), 'projekt ukládá cíl nájezdu ' + snap);
  r = await T('flyInTo', {place: '49.2265,17.6707', label: 'Zlín', zoom: 'budova', from: 'evropa'});
  st = await S();
  check(r.ok && r.from === 'eu' && st.kfs[0].zoom < 5 && st.kfs[1].zoom > 16 && st.kfs[1].pitch > 40, 'z Evropy na budovu (náklon 3D) ' + JSON.stringify(st.kfs.map(v => [v.zoom.toFixed(1), v.pitch])));
  await T('undo'); await page.waitForTimeout(800);
  st = await S();
  check(st.fly?.text === 'Valašské Meziříčí' && Math.abs(st.kfs[1].center[0] - VM_LL[0]) < 1e-6, 'krok zpět vrátí předchozí nájezd i s cílem');
  await page.evaluate(s => window.__pzFns.applyProjectSnapshot({...window.__pzFns.serializeProjectSnapshot(), flyIn: null}), null);
  await page.waitForTimeout(600);
  check(!(await S()).fly, 'projekt bez cíle cíl smaže');
  await page.evaluate(s => window.__pzFns.applyProjectSnapshot({...window.__pzFns.serializeProjectSnapshot(), flyIn: JSON.parse(s)}), snap);
  await page.waitForTimeout(600);
  check((await S()).fly?.text === 'Valašské Meziříčí', 'načtení projektu vrátí cíl');
  r = await T('clearScene', {what: 'nájezd'});
  check(r.ok && !(await S()).fly && (await S()).kfs.length === 2, 'clearScene najezd smaže cíl, přelet kamery nechá ' + JSON.stringify(r));
  r = await T('flyInTo', {place: VM, zoom: 'kosmos'});
  check(!r.ok && /zoom/.test(r.error), 'neznámý zoom = srozumitelná chyba');
  r = await T('flyInTo', {});
  check(!r.ok, 'bez místa chyba');

  // --- stejné záběry za sebou dál drží kameru (pauza)
  await T('setCameraFlight', {keyframes: [{center: '50.08,14.42', zoom: 6}, {center: '50.08,14.42', zoom: 6}, {center: VM, zoom: 12}]});
  const hold = await page.evaluate(() => { const v = window.__pzFns.getCameraStateAtProgress(0.2); return [v.center[0], v.zoom]; });
  check(Math.abs(hold[0] - 14.42) < 1e-6 && Math.abs(hold[1] - 6) < 1e-6, 'dva stejné záběry = kamera stojí ' + hold);

  // --- panel Animace › Nájezd na místa: jedno místo
  await tab(page, 'animace');
  await openSection(page, 'pzJingleSection');
  await page.fill('#pzJingPlaces', '50.0875,14.4213 | Staroměstské náměstí\n' + VM + ' | Valašské Meziříčí');
  await page.selectOption('#pzJingZoom', 'district');
  await page.fill('#pzJingDur', '3'); await page.fill('#pzJingHold', '1');
  await page.evaluate(() => { const t = document.getElementById('pzJingPlaces'); t.focus(); t.setSelectionRange(t.value.length, t.value.length); });
  await page.click('#pzJingOneBtn'); await page.waitForTimeout(1500);
  st = await S();
  check(st.fly?.text === 'Valašské Meziříčí' && Math.abs(st.kfs[1].zoom - 14.6) < 0.01, 'Nájezd na místo: řádek s kurzorem, čtvrť ' + JSON.stringify(st.fly));
  const ui = await page.evaluate(() => ({btn: document.getElementById('pzJingBatchBtn').textContent, info: document.getElementById('pzJingInfo').textContent, time: window.__pzFns.state.animElapsed}));
  check(/\(2\)/.test(ui.btn) && /Každé video 4 s/.test(ui.info) && /mapa-staromestske-namesti-/.test(ui.info), 'tlačítko dávky a název souboru ' + JSON.stringify(ui));
  check(ui.time >= 3.99, 'po nastavení je vidět konečný záběr');
  await page.screenshot({path: path.join(OUT, '37_najezd_panel.png')});

  // --- dávka nástrojem flyInBatch: 2 videa s místem v názvu, potom se vrátí původní nastavení
  await T('setExportName', {nick: 'maj', porad: 'tn'});
  await page.evaluate(() => { const s = document.getElementById('exportResolution'); s.value = '1280x720'; s.dispatchEvent(new Event('change', {bubbles: true})); });
  const before = await S();
  const files = [];
  page.on('download', dd => files.push(dd.suggestedFilename()));
  r = await T('flyInBatch', {places: ['49.2265,17.6707 | Zlín', '49.2977,17.3931 | Kroměříž'], duration: 1, hold: 0.5});
  check(r.ok && r.started && r.count === 2 && /^mapa-zlin-maj-gfx-tn-\d{6}\.mp4$/.test(r.files[0]), 'flyInBatch vrátí hned počet a názvy ' + JSON.stringify(r));
  check((await T('flyInBatch', {places: ['Brno']})).ok === false, 'druhá dávka během běžící se nespustí');
  await page.waitForFunction(() => !window.__pzFns.state._batchRunning, null, {timeout: 300000});
  await page.waitForTimeout(1500);
  check(files.length === 2 && /^mapa-zlin-maj-gfx-tn-\d{6}\.mp4$/.test(files[0]) && /^mapa-kromeriz-maj-gfx-tn-\d{6}\.mp4$/.test(files[1]), 'dávka: 2 videa, název s místem, nickem a pořadem ' + files.join(', '));
  const after = await S();
  check(JSON.stringify(after.kfs) === JSON.stringify(before.kfs) && after.fly?.text === before.fly?.text, 'po dávce zůstane nájezd, jak ho grafik měl');
  check(/Hotovo — staženo 2 z 2 videí/.test(await page.$eval('#statusBar', e => e.textContent)), 'stavový řádek: hotovo 2 z 2');

  // --- Zrušit zastaví celou dávku
  files.length = 0;
  r = await T('flyInBatch', {places: '49.2265,17.6707\n49.2977,17.3931\n49.0,17.5', duration: 2, hold: 0});
  await page.waitForFunction(() => !document.getElementById('exportProgress').hidden, null, {timeout: 60000}).catch(() => {});
  await page.waitForTimeout(800);
  await page.click('#exportCancelBtn').catch(() => {});
  await page.waitForFunction(() => !window.__pzFns.state._batchRunning, null, {timeout: 120000});
  await page.waitForTimeout(800);
  check(files.length === 0 && /zrušen/i.test(await page.$eval('#statusBar', e => e.textContent)), 'Zrušit zastaví dávku (' + files.length + ' videí)');

  // --- Liberec v úvodním záběru ČR leží těsně pod titulkem: název cíle nesmí vjet pod titulek
  await T('flyInTo', {place: '50.7534,15.0483', label: 'Svijanská aréna', zoom: 'budova', duration: 3, hold: 1});
  await T('setTitle', {title: 'Svijanská aréna zavírá kvůli střeše'});
  await page.waitForTimeout(800);
  const ov = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 1920; c.height = 1080; const o = window.__pzFns.pzDrawFlyIn(c.getContext('2d'), 1920, 1080), tb = window.__pzFns.pzTitleBoxesFor(1920, 1080)?.title;
    const L = o?.label; return {L, tb, hit: !!(L && tb && L.x < tb.x + tb.w && L.x + L.w > tb.x && L.y < tb.y + tb.h && L.y + L.h > tb.y)}; });
  check(ov.L && ov.tb && !ov.hit, 'název cíle nejede pod titulek grafiky ' + JSON.stringify(ov));
  await T('setTitle', {off: true});
  check(errors.length === 0, 'žádná chyba stránky' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  await close(); done();
})();
