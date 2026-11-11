// Telefon a tablet (dotyk): na každém zařízení se plovoucí prvky nepřekrývají a
// často používané plochy mají aspoň 44×44 px; na telefonu se panel po „klikni do
// mapy" sám schová a „Hotovo" ho vrátí; klávesnice na obrazovce nezakryje pole;
// na iPadu projde celý postup ikonka → popisek → trasa → přehrání → export PNG.
const {chromium} = require('playwright');
const path = require('path');
const {BASE, OUT, check, done, routeWrites, devices} = require('./lib');

const ROAD = [[14.42,50.08],[14.6,50.0],[14.9,49.8],[15.2,49.65],[15.6,49.43],[16.0,49.3],[16.4,49.2],[16.6,49.19]];
const LONG = 'Ikonka vložena do mapy. Celkem: 3. Klikni znovu pro další, nebo Esc pro ukončení — dlouhá hláška na dva řádky.';

async function openDev(browser, dev){
  // snímky a rozměry v CSS pixelech — hustota displeje na rozvržení nemá vliv
  const ctx = await browser.newContext({...devices[dev], deviceScaleFactor:1, acceptDownloads:true});
  await routeWrites(ctx);
  // veřejný OSRM a zpětné geokódování podvržené (limit, výpadky)
  await ctx.route(/routing\.openstreetmap\.de|router\.project-osrm\.org/, r => r.fulfill({status:200, contentType:'application/json',
    body: JSON.stringify({code:'Ok', routes:[{geometry:{type:'LineString', coordinates:ROAD}, distance:205000, duration:7500, legs:[]}], waypoints:[]})}));
  await ctx.route(/nominatim\.openstreetmap\.org|photon\.komoot\.io/, r => r.fulfill({status:200, contentType:'application/json',
    body: /reverse/.test(r.request().url()) ? JSON.stringify({display_name:'Testov, Česko', name:'Testov', address:{village:'Testov'}}) : '[]'}));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).split('\n')[0].slice(0, 160)));
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.goto(BASE, {waitUntil:'load', timeout:120000});
  await page.waitForFunction(() => window.__pzFns && window.__tnMap && window.TNMAP, null, {timeout:60000});
  await page.waitForTimeout(3500);
  return {ctx, page, errors};
}
const isOpen = page => page.evaluate(() => document.body.classList.contains('mobile-panel-open'));
const status = page => page.$eval('#statusBar', e => e.textContent.trim());
async function tapSel(page, sel){
  const el = await page.$(sel);
  // doprostřed — na kraji panelu by prvek zůstal pod přilepeným tlačítkem Nastavení
  await el.evaluate(e => { const sc = e.closest('.sidebar-content'); if(!sc) return; const r = e.getBoundingClientRect(), b = sc.getBoundingClientRect(); sc.scrollTop += r.top + r.height / 2 - (b.top + b.height / 2); });
  await page.waitForTimeout(120);
  const b = await el.boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(350);
}
async function openPanel(page){
  if(await page.evaluate(() => matchMedia('(max-width:980px)').matches) && !(await isOpen(page))){ await tapSel(page, '#mobileMenuBtn'); await page.waitForTimeout(350); }
}
async function openSec(page, id){
  if(await page.$eval('#' + id, s => s.classList.contains('collapsed'))) await tapSel(page, '#' + id + ' > h3');
}
// volné místo v mapě (mimo panel a plovoucí prvky), fx/fy = podíl šířky/výšky
const mapPt = (page, fx, fy) => page.evaluate(([fx, fy]) => {
  const sb = document.querySelector('.sidebar').getBoundingClientRect();
  const left = Math.max(0, Math.min(sb.right, innerWidth * 0.6)) + 24;
  return [left + (innerWidth - left - 70) * fx, 134 + Math.max(0, innerHeight - 330) * fy];
}, [fx, fy]);
async function tapMap(page, fx, fy){ const p = await mapPt(page, fx, fy); await page.touchscreen.tap(p[0], p[1]); await page.waitForTimeout(600); }
// dotykové události na prvku (dlouhé podržení, tažení posuvníku)
const touch = (page, sel, type, dx = 0) => page.evaluate(([sel, type, dx]) => {
  const el = document.querySelector(sel), r = el.getBoundingClientRect();
  const t = new Touch({identifier:1, target:el, clientX:r.left + r.width / 2 + dx, clientY:r.top + r.height / 2});
  const end = type === 'touchend';
  el.dispatchEvent(new TouchEvent(type, {bubbles:true, cancelable:true, touches:end ? [] : [t], targetTouches:end ? [] : [t], changedTouches:[t]}));
}, [sel, type, dx]);

// Překryvy plovoucích prvků a přesah mimo obrazovku
async function overlaps(page){
  // přepočet stylů spustí přechod polohy (asistent má transition) — počkat, až doběhne
  await page.evaluate(() => document.body.getBoundingClientRect()); await page.waitForTimeout(350);
  return page.evaluate(() => {
    const sel = {player:'.floating-player .player-controls', status:'#statusBar', actions:'.map-actions', fab:'.tnchat-fab', zoom:'.maplibregl-ctrl-top-right .maplibregl-ctrl',
      wm:'.map-source-watermark', menu:'#mobileMenuBtn', touchbar:'#pzTouchBar', project:'#projectPanel'};
    const b = {};
    for(const [k, s] of Object.entries(sel)){ const e = document.querySelector(s); if(e && e.offsetParent !== null && getComputedStyle(e).visibility !== 'hidden'){ const r = e.getBoundingClientRect(); if(r.width) b[k] = [r.left, r.top, r.right, r.bottom]; } }
    const ks = Object.keys(b), ov = [];
    for(let i = 0; i < ks.length; i++) for(let j = i + 1; j < ks.length; j++){ const a = b[ks[i]], c = b[ks[j]];
      // panel Projekt smí ležet přes ovládání mapy (zavírá se), ne přes lištu a spodní prvky
      if((ks[i] === 'project' || ks[j] === 'project') && [ks[i], ks[j]].some(k => k === 'zoom' || k === 'touchbar' || k === 'fab')) continue;
      if(Math.min(a[2], c[2]) - Math.max(a[0], c[0]) > 2 && Math.min(a[3], c[3]) - Math.max(a[1], c[1]) > 2) ov.push(ks[i] + '×' + ks[j]); }
    const off = Object.entries(b).filter(([k, r]) => r[0] < -1 || r[1] < -1 || r[2] > innerWidth + 1 || r[3] > innerHeight + 1).map(([k]) => k + ' mimo');
    return ov.concat(off); });
}
// Často používané plochy menší než 44×44 px (na 320 px širokém telefonu smí být lišta 40 px široká)
function smallTargets(page){
  return page.evaluate(() => {
    const SEL = '.tab-btn,.map-action-btn,#mobileMenuBtn,#mobileCloseBtn,.floating-player .player-btn,.tab-pane.active .section-collapsible > h3,.wp-item .btn-remove,' +
      '.settings-close,.maplibregl-ctrl-group button,.pz-touch-bar .btn,.tab-pane.active .btn,.brand-search-row .btn,.settings-gear';
    const minW = innerWidth < 360 ? 40 : 44, bad = [];
    document.querySelectorAll(SEL).forEach(e => {
      if(e.offsetParent === null) return;
      const r = e.getBoundingClientRect(); if(!r.width) return;
      if(r.width < minW - 0.5 || r.height < 43.5) bad.push((e.id || e.className.toString().split(' ').slice(0, 2).join('.')) + ' ' + Math.round(r.width) + '×' + Math.round(r.height));
    });
    const small = [...document.querySelectorAll('.sidebar select,.sidebar input[type=text],.sidebar input[type=number],#tnchatInput,.tnchat-form input')]
      .filter(e => parseFloat(getComputedStyle(e).fontSize) < 16).map(e => (e.id || e.tagName) + ' písmo ' + getComputedStyle(e).fontSize);
    return [...new Set(bad.concat(small))];
  });
}

(async () => {
  const browser = await chromium.launch({args:['--enable-unsafe-webgpu','--ignore-gpu-blocklist']});
  const ALL = ['iPhone SE', 'iPhone 14', 'Pixel 7', 'iPad Mini', 'iPad Pro 11'];
  const only = process.env.MOBILE_ONLY ? process.env.MOBILE_ONLY.split(',') : null;
  for(const dev of ALL.flatMap(d => [d, d + ' landscape']).filter(d => !only || only.includes(d))){
    const {ctx, page, errors} = await openDev(browser, dev);
    const tag = dev.replace(/ /g, '_');
    const vw = page.viewportSize();
    const drawer = vw.width <= 980, modal = vw.width < 700, phone = /iPhone|Pixel/.test(dev), land = / landscape/.test(dev);

    // ── 1) plovoucí prvky: trasa (přehrávač), dlouhá hláška, zapnuté vkládání (pruh Hotovo), panel Projekt
    await page.evaluate(() => window.TNMAP.routeBetween({from:'50.08,14.42', to:'49.19,16.60', mode:'planeArc'})); await page.waitForTimeout(1500);
    await page.evaluate(msg => { const f = window.__pzFns; f.state.addingSceneIcon = true; f.setStatus(msg); }, LONG); await page.waitForTimeout(400);
    let ov = await overlaps(page);
    check(!ov.length, `${dev}: plovoucí prvky bez překryvů (dlouhá hláška, pruh Hotovo)` + (ov.length ? ' — ' + ov.join(', ') : ''));
    check(await page.evaluate(() => getComputedStyle(document.getElementById('pzTouchBar')).display !== 'none'), `${dev}: při vkládání je vidět „Hotovo"`);
    await page.screenshot({path: path.join(OUT, `mobile_${tag}_map.png`)});
    let bad = await smallTargets(page);
    check(!bad.length, `${dev}: plochy na mapě ≥ 44 px` + (bad.length ? ' — ' + bad.slice(0, 6).join(', ') : ''));
    await tapSel(page, '#pzTouchDoneBtn');
    check(await page.evaluate(() => !window.__pzFns.state.addingSceneIcon && getComputedStyle(document.getElementById('pzTouchBar')).display === 'none'), `${dev}: „Hotovo" ukončí vkládání`);
    await tapSel(page, '#projectPanelBtn');
    ov = await overlaps(page);
    const pp = await page.evaluate(() => { const p = document.getElementById('projectPanel'), r = p.getBoundingClientRect(), c = document.getElementById('projectPanelClose').getBoundingClientRect();
      return {open: !p.hidden, in: r.left >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1, close: Math.min(c.width, c.height)}; });
    check(pp.open && pp.in && pp.close >= 44 && !ov.length, `${dev}: panel Projekt se vejde, zavírání ≥ 44 px, bez překryvů` + (ov.length ? ' — ' + ov.join(', ') : ''));
    await tapSel(page, '#projectPanelClose');

    // ── 2) panel: plochy na všech záložkách, písmo polí ≥ 16 px
    await openPanel(page);
    if(drawer){
      const w = await page.$$eval('.tab-btn', bs => bs.map(b => b.getBoundingClientRect().right));
      const sbR = await page.$eval('.sidebar', s => s.getBoundingClientRect().right);
      check(w.length === 5 && Math.max(...w) <= sbR + 1, `${dev}: 5 záložek v jednom řádku`);
      check(sbR <= vw.width - (modal ? 24 : 300), `${dev}: vedle panelu zbývá ${modal ? 'pruh mapy na zavření' : 'mapa'} (${Math.round(vw.width - sbR)} px)`);
    }
    bad = [];
    for(const t of ['scena', 'trasa', 'animace', 'export', 'styly']){
      await page.evaluate(n => document.querySelector(`.tab-btn[data-tab="${n}"]`).click(), t); await page.waitForTimeout(200);
      bad = bad.concat(await smallTargets(page));
    }
    bad = [...new Set(bad)];
    check(!bad.length, `${dev}: plochy v panelu ≥ 44 px, písmo polí ≥ 16 px` + (bad.length ? ' — ' + bad.slice(0, 8).join(', ') : ''));
    await page.evaluate(() => document.querySelector('.tab-btn[data-tab="scena"]').click()); await page.waitForTimeout(200);
    await page.screenshot({path: path.join(OUT, `mobile_${tag}_panel.png`)});

    // ── 3) klávesnice na obrazovce: pole zůstane nad ní, po zavření se vše vrátí
    await openSec(page, 'mapLabelSection');
    await page.evaluate(() => { const sc = document.querySelector('.sidebar-content'); sc.scrollTop = sc.scrollHeight; document.getElementById('mapLabelText').focus({preventScroll:true}); });
    const kb = Math.round(vw.height * 0.45);
    await page.evaluate(px => window.__pzFns.pzSetKeyboardInset(px), kb); await page.waitForTimeout(400);
    const k1 = await page.evaluate(() => { const r = document.getElementById('mapLabelText').getBoundingClientRect(), s = document.querySelector('.sidebar').getBoundingClientRect(); return {bottom: r.bottom, top: r.top, sb: s.bottom, cls: document.body.classList.contains('pz-kb-open')}; });
    check(k1.cls && k1.bottom <= vw.height - kb && k1.top >= 0 && k1.sb <= vw.height - kb + 3, `${dev}: pole nad klávesnicí (spodek pole ${Math.round(k1.bottom)}, klávesnice od ${vw.height - kb}) ${JSON.stringify(k1)}`);
    await page.evaluate(() => { window.__pzFns.pzSetKeyboardInset(0); document.activeElement.blur(); }); await page.waitForTimeout(300);
    const k2 = await page.evaluate(() => ({cls: document.body.classList.contains('pz-kb-open'), sb: document.querySelector('.sidebar').getBoundingClientRect().bottom, y: scrollY}));
    check(!k2.cls && k2.sb >= vw.height - 20 && k2.y === 0, `${dev}: po zavření klávesnice se rozhraní vrátí`);

    // ── 4) telefon: panel se po „klikni do mapy" schová, klepnutí vloží, Hotovo vrátí panel
    if(modal){
      await openSec(page, 'sceneIconSection');
      await tapSel(page, '.pz-icon-pick');
      check(!(await isOpen(page)) && await page.evaluate(() => window.__pzFns.state.addingSceneIcon), `${dev}: výběr ikony schová panel a zapne vkládání`);
      await tapMap(page, 0.5, 0.3);
      check(await page.$$eval('.scene-icon-marker', e => e.length) === 1 && /vložena/i.test(await status(page)), `${dev}: jedno klepnutí do mapy vloží ikonku a stav to řekne`);
      ov = await overlaps(page);
      check(!ov.length, `${dev}: po vložení bez překryvů` + (ov.length ? ' — ' + ov.join(', ') : ''));
      await tapSel(page, '#pzTouchDoneBtn');
      check(await isOpen(page) && await page.evaluate(() => !window.__pzFns.state.addingSceneIcon), `${dev}: „Hotovo" ukončí vkládání a vrátí panel`);
      // hláška je vidět i nad otevřeným panelem
      await page.evaluate(() => window.__pzFns.setStatus('Zkouška hlášky')); await page.waitForTimeout(200);
      check(await page.evaluate(() => { const s = document.getElementById('statusBar'), r = s.getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === s; }), `${dev}: hláška je vidět i nad otevřeným panelem`);
      // posuvník: panel zprůhlední, po puštění se vrátí
      await page.evaluate(() => document.getElementById('sceneIconSize').scrollIntoView({block:'center'})); await page.waitForTimeout(150);
      await touch(page, '#sceneIconSize', 'touchstart');
      await page.evaluate(() => { const r = document.getElementById('sceneIconSize'); r.value = 60; r.dispatchEvent(new Event('input', {bubbles:true})); });
      const peek = await page.evaluate(() => document.body.classList.contains('pz-peek') && getComputedStyle(document.getElementById('sceneIconSize')).visibility === 'visible' && getComputedStyle(document.querySelector('.sidebar-tabs')).visibility === 'hidden');
      await touch(page, '#sceneIconSize', 'touchend');
      check(peek && await page.evaluate(() => !document.body.classList.contains('pz-peek')), `${dev}: při tažení posuvníku je vidět mapa, po puštění se panel vrátí`);
      // zavření klepnutím na mapu vedle panelu a tlačítkem
      await page.touchscreen.tap(vw.width - 10, vw.height / 2); await page.waitForTimeout(400);
      check(!(await isOpen(page)), `${dev}: klepnutí na mapu vedle panelu ho zavře`);
      await tapSel(page, '#mobileMenuBtn'); await tapSel(page, '#mobileCloseBtn');
      check(!(await isOpen(page)), `${dev}: panel jde otevřít tlačítkem a zavřít křížkem`);
    }

    // ── 5) tablet: celý postup dotykem až po export PNG
    if(!phone){
      if(drawer) check(await page.evaluate(() => getComputedStyle(document.getElementById('mobileBackdrop')).display === 'none'), `${dev}: otevřený panel mapu nezatemňuje`);
      await openPanel(page); await openSec(page, 'sceneIconSection');
      await tapSel(page, '.pz-icon-pick');
      await tapMap(page, 0.25, 0.25);
      check(await page.$$eval('.scene-icon-marker', e => e.length) === 1, `${dev}: ikonka z palety klepnutím do mapy`);
      // přetažení druhé ikonky (pointer události typu touch)
      await openPanel(page);
      const src = await page.$('.pz-icon-pick:nth-child(2)'); await src.scrollIntoViewIfNeeded(); const sb = await src.boundingBox();
      const ev = (type, x, y) => page.evaluate(([type, x, y]) => (type === 'pointerdown' ? document.querySelector('.pz-icon-pick:nth-child(2)') : document)
        .dispatchEvent(new PointerEvent(type, {bubbles:true, cancelable:true, pointerType:'touch', pointerId:7, isPrimary:true, button:0, buttons:type === 'pointerup' ? 0 : 1, clientX:x, clientY:y})), [type, x, y]);
      const cx = sb.x + sb.width / 2, cy = sb.y + sb.height / 2;
      await ev('pointerdown', cx, cy);
      for(let i = 1; i <= 6; i++){ await ev('pointermove', cx + 12 * i, cy); await page.waitForTimeout(40); }
      const hid = drawer ? !(await isOpen(page)) : true;
      await page.waitForTimeout(350);
      const p = await mapPt(page, 0.75, 0.25);
      await ev('pointermove', p[0], p[1]); await ev('pointerup', p[0], p[1]); await page.waitForTimeout(600);
      check(hid && await page.$$eval('.scene-icon-marker', e => e.length) === 2 && (!drawer || await isOpen(page)), `${dev}: ikonka přetažením (panel při tažení uhne a po vložení se vrátí)`);
      await tapSel(page, '#pzTouchDoneBtn');
      // dlouhé podržení = přidat do výběru; Smazat v pruhu smaže oba
      if(drawer && await isOpen(page)){ await tapSel(page, '#mobileCloseBtn'); }
      await page.evaluate(() => document.querySelectorAll('.scene-icon-marker').forEach((m, i) => m.setAttribute('data-t', i)));
      for(const i of [0, 1]){ await touch(page, `.scene-icon-marker[data-t="${i}"]`, 'touchstart'); await page.waitForTimeout(750); await touch(page, `.scene-icon-marker[data-t="${i}"]`, 'touchend'); await page.waitForTimeout(150); }
      check(await page.evaluate(() => window.__pzFns.state.multiSel.size) === 2, `${dev}: dlouhé podržení přidá ikonky do výběru`);
      ov = await overlaps(page);
      check(!ov.length, `${dev}: výběr (Smazat + Hotovo) bez překryvů` + (ov.length ? ' — ' + ov.join(', ') : ''));
      await tapSel(page, '#pzTouchDeleteBtn');
      check(await page.$$eval('.scene-icon-marker', e => e.length) === 0, `${dev}: „Smazat" v pruhu smaže vybrané`);
      await tapSel(page, '#undoActionBtn');
      check(await page.$$eval('.scene-icon-marker', e => e.length) === 2, `${dev}: krok zpět smazané vrátí`);
      // popisek
      await openPanel(page); await openSec(page, 'mapLabelSection');
      await tapSel(page, '#mapLabelText'); await page.keyboard.type('NEHODA');
      await tapSel(page, '#addMapLabelBtn'); await tapMap(page, 0.5, 0.6);
      check(await page.$$eval('.map-label-marker', e => e.length) === 1, `${dev}: popisek klepnutím do mapy`);
      await tapSel(page, '#pzTouchDoneBtn');
      // trasa A → B autem
      await openPanel(page); await tapSel(page, '.tab-btn[data-tab="trasa"]'); await tapSel(page, '.transport-btn[data-mode="driving"]');
      await tapMap(page, 0.1, 0.1); await page.waitForTimeout(400); await tapMap(page, 0.9, 0.9); await page.waitForTimeout(400);
      await openPanel(page); await tapSel(page, '#findRouteBtn'); await page.waitForTimeout(3000);
      check(await page.evaluate(() => window.__pzFns.state.routeCoords.length) >= 2, `${dev}: trasa A→B klepnutím do mapy a „Najít trasu"`);
      if(drawer && await isOpen(page)) await tapSel(page, '#mobileCloseBtn');
      // přehrání
      await tapSel(page, '.floating-player #animPlayBtn'); await page.waitForTimeout(1500);
      check(await page.evaluate(() => window.__pzFns.state.animPlaying), `${dev}: přehrávač spustí animaci`);
      await page.screenshot({path: path.join(OUT, `mobile_${tag}_play.png`)});
      await tapSel(page, '.floating-player #animStopBtn');
      // export PNG
      await openPanel(page); await tapSel(page, '.tab-btn[data-tab="export"]');
      const dl = page.waitForEvent('download', {timeout:180000}).catch(() => null);
      await tapSel(page, '#exportPngBtn');
      const d = await dl; check(!!d, `${dev}: export PNG proběhl` + (d ? '' : ' — stav: ' + await status(page)));
      if(d) await d.saveAs(path.join(OUT, `mobile_${tag}_export.png`));
    }
    const moved = await page.evaluate(() => [scrollX, scrollY, document.querySelector('.app').scrollTop, document.querySelector('.app').scrollLeft, document.querySelector('.map-wrap').scrollTop].some(v => Math.abs(v) > 0));
    check(!moved, `${dev}: stránka nikam neodskočila`);
    check(errors.length === 0, `${dev}: žádná chyba stránky` + (errors.length ? ' — ' + errors[0] : ''));
    await ctx.close();
  }
  await browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
