// Šipky s piktogramem a svazek šipek do jednoho cíle (typ zadání E: „z Německa,
// Rakouska… čáry s obrázkem lidí do Rwandy", „z Fidži a Madagaskaru šipky do Chotovic").
// Místa jako souřadnice (bez geokódování), popisky z pole labels.
const fs = require('fs');
const path = require('path');
const {check, done, open, tab, openSection, OUT} = require('./lib');
(async () => {
  const {page, errors, close} = await open();
  // appka po startu ještě dojíždí (úvodní záběr, načtení dat) — počkat na klid mapy
  await page.waitForFunction(() => window.__tnMap?.loaded?.() && !window.__tnMap.isMoving(), null, {timeout: 30000}).catch(() => {});
  await page.waitForTimeout(2000);
  const T = (name, args) => page.evaluate(([n, a]) => window.TNMAP[n](a), [name, args]);
  const S = () => page.evaluate(() => window.__pzFns.state.sceneArrows.map(a => ({...a})));
  const feats = () => page.evaluate(() => { const s = window.__tnMap.getSource('scene-arrows'); return (s.serialize().data.features || []).map(f => ({kind: f.properties.kind, id: f.properties.id, img: f.properties.img, isz: f.properties.isz, rot: f.properties.rot, g: f.geometry})); });
  const px = ll => page.evaluate(ll => { const q = window.__tnMap.project(ll); return [q.x, q.y]; }, ll);
  const labels = () => page.evaluate(() => [...document.querySelectorAll('#map .map-label-marker .map-label-bubble')].map(b => { const r = b.getBoundingClientRect(); return {t: b.textContent, x0: r.left, y0: r.top, x1: r.right, y1: r.bottom}; }));

  // --- svazek: 5 míst (Německo, Rakousko, Řecko, Dánsko, Nizozemsko) → Rwanda, piktogram lidí
  const from = ['51.1,10.4', '47.6,14.1', '39.3,22.0', '56.0,9.3', '52.3,5.6'], names = ['Německo', 'Rakousko', 'Řecko', 'Dánsko', 'Nizozemsko'];
  const DEST = [29.9, -1.95];
  let r = await T('flowArrows', {from, to: '-1.95,29.9', icon: 'lidé', labels: names, toLabel: 'Rwanda'});
  check(r.ok && r.arrows === 5 && r.icon === 'lide', 'flowArrows: 5 šipek s piktogramem lidí jedním voláním ' + JSON.stringify(r));
  await page.waitForTimeout(800);
  let A = await S();
  check(A.length === 5 && A.every(a => a.icon === 'lide' && a.dot && a.hdot && a.gap > 0), 'každá šipka: piktogram, bod na začátku i v cíli, hrot před cílem');
  check(new Set(A.map(a => a.bend)).size >= 4, 'šipky jsou rozvějířené (různé zakřivení) ' + A.map(a => a.bend).join(' '));
  let F = await feats();
  const icons = F.filter(f => f.kind === 'icon');
  check(icons.length === 5 && icons.every(f => f.img === 'pzarr|lide|#e22d2d|0' && f.rot === 0), 'piktogramy jsou v mapě, lidé stojí rovně (nenatáčí se)');
  check(await page.evaluate(() => window.__tnMap.hasImage('pzarr|lide|#e22d2d|0')), 'obrázek piktogramu je v mapě');
  // hroty se v cíli nepřekrývají: vrchol každé šipky nejblíž cíli
  const D = await px(DEST);
  const tips = [];
  for(const f of F.filter(f => f.kind === 'fill' && f.g.coordinates[0].length > 30)){
    const ring = await page.evaluate(ring => ring.map(ll => { const q = window.__tnMap.project(ll); return [q.x, q.y]; }), f.g.coordinates[0]);
    tips.push(ring.reduce((b, p) => Math.hypot(p[0] - D[0], p[1] - D[1]) < Math.hypot(b[0] - D[0], b[1] - D[1]) ? p : b));
  }
  let minTip = Infinity; for(let i = 0; i < tips.length; i++) for(let j = i + 1; j < tips.length; j++) minTip = Math.min(minTip, Math.hypot(tips[i][0] - tips[j][0], tips[i][1] - tips[j][1]));
  check(tips.length === 5 && minTip >= 6, 'hroty v cíli nejsou na sobě (nejmenší rozestup ' + Math.round(minTip) + ' px)');
  // piktogramy se nepřekrývají
  const ic = await Promise.all(icons.map(f => px(f.g.coordinates)));
  let minIc = Infinity; for(let i = 0; i < ic.length; i++) for(let j = i + 1; j < ic.length; j++) minIc = Math.min(minIc, Math.hypot(ic[i][0] - ic[j][0], ic[i][1] - ic[j][1]));
  check(minIc > 40, 'piktogramy se nepřekrývají (nejmenší rozestup ' + Math.round(minIc) + ' px)');
  // popisky: 6, nepřekrývají se navzájem
  let L = await labels();
  let over = 0; for(let i = 0; i < L.length; i++) for(let j = i + 1; j < L.length; j++){ const a = L[i], b = L[j]; if(a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0) over++; }
  check(L.length === 6 && names.every(n => L.some(l => l.t === n)) && L.some(l => l.t === 'Rwanda'), 'popisky u všech míst i u cíle ' + L.map(l => l.t).join(','));
  check(over === 0, 'popisky se nepřekrývají (' + over + ')');
  await page.screenshot({path: path.join(OUT, '36_rwanda_nahled.png')});

  // --- krok zpět vrátí celý svazek naráz, vpřed ho vrátí i s piktogramy a tvarem
  await T('undo');
  await page.waitForTimeout(600);
  check((await S()).length === 0 && (await labels()).length === 0, 'jeden krok zpět smaže všechny šipky i popisky svazku');
  await T('redo');
  await page.waitForTimeout(800);
  const A2 = await S();
  check(A2.length === 5 && A2.every((a, i) => a.icon === 'lide' && a.bend === A[i].bend && a.gap === A[i].gap && a.dot && a.hdot), 'krok vpřed vrátí šipky i s piktogramem a zakřivením ' + JSON.stringify(A2.map(a => [a.icon, a.bend, a.gap])) + JSON.stringify(A.map(a => [a.bend, a.gap])));
  // projekt: uložit → vyčistit → načíst
  const snap = await page.evaluate(() => JSON.stringify(window.__pzFns.serializeProjectSnapshot()));
  check(/"icon":"lide"/.test(snap) && /"bend":/.test(snap) && /"hdot":true/.test(snap), 'projekt ukládá piktogram, zakřivení a body');

  // --- export PNG: piktogram na stejném místě jako v náhledu
  const spots = await page.evaluate(() => { const m = window.__tnMap, f = document.getElementById('exportFrame').getBoundingClientRect(), c = m.getCanvas().getBoundingClientRect();
    const fs = m.getSource('scene-arrows').serialize().data.features.filter(x => x.properties.kind === 'icon');
    return fs.map(x => { const p = m.project(x.geometry.coordinates); return [(p.x + c.left - f.left) / f.width, (p.y + c.top - f.top) / f.height]; }); });
  await tab(page, 'export');
  const dl = page.waitForEvent('download', {timeout: 120000}).catch(() => null);
  await page.evaluate(() => document.getElementById('exportPngBtn').click());
  const d = await dl; check(!!d, 'export PNG proběhl');
  if(d){
    const file = path.join(OUT, '36_rwanda_export.png'); await d.saveAs(file);
    const px2 = await page.evaluate(async ([b64, spots]) => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const R = Math.round(img.width / 1920 * 24);
      return spots.map(([fx, fy]) => { const d = x.getImageData(Math.round(fx * img.width) - R, Math.round(fy * img.height) - R, 2 * R, 2 * R).data; let red = 0, white = 0, n = 0;
        for(let i = 0; i < d.length; i += 4){ n++; if(d[i] > 190 && d[i+1] < 90 && d[i+2] < 90) red++; if(d[i] > 235 && d[i+1] > 235 && d[i+2] > 235) white++; }
        return {red: red / n, white: white / n}; }); }, [fs.readFileSync(file).toString('base64'), spots]);
    check(px2.length === 5 && px2.every(p => p.red > 0.15 && p.white > 0.15), 'v PNG jsou piktogramy (červený kruh + bílý symbol) tam, kde v náhledu ' + JSON.stringify(px2.map(p => [+p.red.toFixed(2), +p.white.toFixed(2)])));
  }
  await tab(page, 'scena');

  // --- jedna šipka: oblouk + natáčený piktogram, neznámý piktogram = chyba
  await T('clearScene', {what: 'all'});
  r = await T('drawArrow', {from: '50.08,14.42', to: '40.71,-74.0', icon: 'letadlo', curve: true, fit: false});
  check(r.ok && r.icon === 'letadlo' && Math.abs(r.curve) > 0.05, 'drawArrow s letadlem a obloukem ' + JSON.stringify({icon: r.icon, curve: r.curve}));
  const pl = (await feats()).find(f => f.kind === 'icon');
  check(pl && pl.img.startsWith('pzarr|letadlo|') && Math.abs(pl.rot) > 1, 'letadlo se natočí po směru šipky (rot ' + (pl && Math.round(pl.rot)) + '°)');
  // oblouk k severu: střed šipky leží nad tětivou
  const arrow = (await S())[0];
  check(arrow.bend && (await page.evaluate(a => { const m = window.__tnMap, T = m.project(a.tail), H = m.project(a.head); return (H.x - T.x) * a.bend < 0; }, arrow)), 'oblouk se vyboulí k pólu (great-circle vzhled)');
  r = await T('drawArrow', {from: '56.0,10.0', to: '60.0,24.0', icon: 'lod', fit: false});
  const lod = (await feats()).filter(f => f.kind === 'icon').find(f => f.img.startsWith('pzarr|lod|'));
  check(r.ok && lod && lod.rot === 0 && /\|0$/.test(lod.img), 'loď jede doprava bez natočení a zrcadlení');
  r = await T('drawArrow', {from: '60.0,24.0', to: '56.0,10.0', icon: 'kamion', fit: false});
  const kam = (await feats()).filter(f => f.kind === 'icon').find(f => f.img.startsWith('pzarr|kamion|'));
  check(r.ok && kam && kam.rot === 0 && /\|1$/.test(kam.img), 'kamion jedoucí doleva je zrcadlený, ne vzhůru nohama');
  check((await T('drawArrow', {from: '50,14', to: '51,15', icon: 'jednorožec'})).ok === false, 'neznámý piktogram vrátí chybu');
  check((await T('flowArrows', {from: [], to: '50,14'})).ok === false, 'flowArrows bez míst vrátí chybu');

  // --- panel Šipky: piktogram a oblouk u vybrané šipky, Víc míst do jednoho cíle
  await T('clearScene', {what: 'all'});
  await openSection(page, 'sceneArrowSection'); await page.waitForTimeout(300);
  check(await page.isVisible('#sceneArrowIcon') && await page.isVisible('#sceneArrowCurve'), 'v panelu Šipky je volba piktogramu a oblouku');
  await page.evaluate(() => { document.getElementById('sceneFlowBox').open = true; });
  await page.fill('#sceneFlowFrom', '-17.8,178.0; -19.0,46.7');
  await page.fill('#sceneFlowTo', '49.97,15.07');
  await page.selectOption('#sceneArrowIcon', 'letadlo');
  await page.uncheck('#sceneFlowLabels');
  await page.click('#sceneFlowBtn'); await page.waitForTimeout(2500);
  A = await S();
  check(A.length === 2 && A.every(a => a.icon === 'letadlo'), 'formulář Víc míst do jednoho cíle nakreslí šipky s vybraným piktogramem ' + JSON.stringify(A.map(a => a.icon)) + await page.$eval('#statusBar', e => e.textContent));
  check((await labels()).length === 0, 'bez „Popisky míst" žádné popisky');
  // změna piktogramu u vybrané šipky z panelu
  await page.click('#sceneArrowList .wp-item >> nth=0'); await page.waitForTimeout(300);
  check(await page.$eval('#sceneArrowIcon', e => e.value) === 'letadlo' && await page.$eval('#sceneArrowCurve', e => e.checked) === !!A[0].bend, 'výběr šipky ukáže v panelu její piktogram a oblouk');
  await page.evaluate(() => { const s = document.getElementById('sceneArrowIcon'); s.value = 'balik'; s.dispatchEvent(new Event('change', {bubbles: true})); });
  await page.waitForTimeout(400);
  check((await S())[0].icon === 'balik' && (await S())[0].bend === A[0].bend, 'změna piktogramu v panelu změní vybranou šipku (tvar zůstane)');
  await page.keyboard.press('Control+z'); await page.waitForTimeout(500);
  check((await S())[0]?.icon === 'letadlo', 'Ctrl+Z vrátí původní piktogram');
  await page.screenshot({path: path.join(OUT, '36_panel.png')});
  check((await T('clearScene', {what: 'all'})).ok !== false && (await S()).length === 0 && (await feats()).length === 0, 'clearScene smaže šipky i piktogramy');

  check(errors.length === 0, 'bez chyb v konzoli ' + errors.join(' | '));
  await close();
  done();
})();
