// Šipky s piktogramem a svazek šipek do jednoho cíle (typ zadání E: „z Německa,
// Rakouska… čáry s obrázkem lidí do Rwandy", „z Fidži a Madagaskaru šipky do Chotovic").
// Místa jako souřadnice (bez geokódování), popisky z pole labels.
const fs = require('fs');
const path = require('path');
const {check, done, open, tab, openSection, OUT} = require('./lib');
(async () => {
  const {page, errors, close} = await open();
  const warns = [];
  page.on('console', m => { if(m.type() === 'warning' || m.type() === 'error') warns.push(m.text().slice(0, 160)); });
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
  await page.waitForFunction(() => window.__pzFns.state.sceneArrows.length === 0, null, {timeout: 8000}).catch(() => {});
  await page.waitForTimeout(300);
  check((await S()).length === 0 && (await labels()).length === 0, 'jeden krok zpět smaže všechny šipky i popisky svazku');
  await T('redo');
  // krok vpřed se uplatní asynchronně (načtení projektu) — počkat na šipky, ne na pevný čas
  await page.waitForFunction(() => window.__pzFns.state.sceneArrows.length === 5, null, {timeout: 8000}).catch(() => {});
  await page.waitForTimeout(300);
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
  // z jednoho místa do víc cílů (útoky na rafinerie): šipky ze zdroje, hroty u cílů; víc→víc je chyba
  await T('clearScene', {what: 'all'});
  r = await T('flowArrows', {from: '49.0,31.4', to: ['54.6,39.7', '51.5,46.0', '48.7,44.5', '44.1,39.1'], icon: 'dron', labels: ['Rjazaň', 'Saratov', 'Volgograd', 'Tuapse'], toLabel: 'Ukrajina'});
  const fo = await page.evaluate(() => (window.TNMAP.getState().scene || {}));
  check(r.ok && r.arrows === 4 && r.icon === 'dron' && (fo.labels || []).length === 5, 'flowArrows z jednoho místa do 4 cílů s piktogramem dronu ' + JSON.stringify(r) + ' ' + JSON.stringify(fo.labels));
  check((await T('flowArrows', {from: ['50,14', '51,15'], to: ['52,16', '53,17']})).ok === false, 'flowArrows víc míst do víc cílů vrátí srozumitelnou chybu');
  check((await feats()).some(f => f.kind === 'icon' && f.img.startsWith('pzarr|dron|')), 'piktogram dronu je na šipce');

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
  await page.keyboard.press('Control+z');
  await page.waitForFunction(() => window.__pzFns.state.sceneArrows[0]?.icon === 'letadlo', null, {timeout: 8000}).catch(() => {});
  check((await S())[0]?.icon === 'letadlo', 'Ctrl+Z vrátí původní piktogram');
  await page.screenshot({path: path.join(OUT, '36_panel.png')});
  check((await T('clearScene', {what: 'all'})).ok !== false && (await S()).length === 0 && (await feats()).length === 0, 'clearScene smaže šipky i piktogramy');

  // --- titulek a zdroj: svazek se zarámuje pod titulek, popisky do něj nevlezou
  // (Fidži a Madagaskar → Chotovice: popisek „Chotovice" ležel pod titulkem)
  const underTitle = () => page.evaluate(() => { const c = document.getElementById('pzTitleOverlay'); if(!c || c.hidden) return -1;
    const cr = c.getBoundingClientRect(), x = c.getContext('2d'), sx = c.width / cr.width; let hit = 0;
    document.querySelectorAll('#map .map-label-marker .map-label-bubble').forEach(b => { const r = b.getBoundingClientRect();
      for(let px = r.left + 2; px < r.right - 2; px += 6) for(let py = r.top + 2; py < r.bottom - 2; py += 6){
        const X = Math.round((px - cr.left) * sx), Y = Math.round((py - cr.top) * sx); if(X < 0 || Y < 0 || X >= c.width || Y >= c.height) continue;
        if(x.getImageData(X, Y, 1, 1).data[3] > 100) hit++; } });
    return hit; });
  await T('setTitle', {title: 'Odkud přiletěli', source: 'Zdroj: policie ČR'});
  r = await T('flowArrows', {from: ['-17.8,178.0', '-19.0,46.7'], to: '49.95,14.77', icon: 'letadlo', labels: ['Fidži', 'Madagaskar'], toLabel: 'Chotovice'});
  await page.waitForTimeout(1200);
  let ut = await underTitle();
  check(r.ok && ut === 0, 'popisky svazku nejsou pod titulkem ani zdrojem (' + ut + ')');
  // titulek až po šipkách: popisky, které by zakryl, se přesunou
  await T('setTitle', {off: true});
  await T('clearScene', {what: 'all'});
  await T('flowArrows', {from: ['-17.8,178.0', '-19.0,46.7'], to: '49.95,14.77', icon: 'letadlo', labels: ['Fidži', 'Madagaskar'], toLabel: 'Chotovice'});
  await page.waitForTimeout(1000);
  r = await T('setTitle', {title: 'Odkud přiletěli', source: 'Zdroj: policie ČR'});
  await page.waitForTimeout(1200);
  ut = await underTitle();
  check(r.ok && ut === 0 && !r.warning, 'titulek přidaný až po svazku: popisky se mu uhnou (' + ut + ') ' + (r.warning || ''));

  // --- svazek + datová mapa: záběr dat nevyhodí cíl šipek z rámečku, čísla nezakryjí názvy míst
  await T('clearScene', {what: 'all'});
  await T('flowArrows', {from, to: '-1.95,29.9', icon: 'lidé', labels: names, toLabel: 'Rwanda'});
  r = await T('dataMap', {rows: 'Německo: 120\nRakousko: 40\nŘecko: 25\nDánsko: 15\nNizozemsko: 30', unit: 'osob'});
  await page.waitForTimeout(2500);
  const dm = await page.evaluate(dest => { const m = window.__tnMap, fr = document.getElementById('exportFrame').getBoundingClientRect(), mr = m.getCanvas().getBoundingClientRect();
    const p = m.project(dest), inside = p.x + mr.left > fr.left && p.x + mr.left < fr.right && p.y + mr.top > fr.top && p.y + mr.top < fr.bottom;
    const box = l => { const r = l.marker.getElement().querySelector('.map-label-bubble').getBoundingClientRect(); return r; };
    const L = window.__pzFns.state.mapLabels, dmL = L.filter(l => l.dm).map(box), other = L.filter(l => !l.dm).map(box);
    let over = 0; dmL.forEach(a => other.forEach(b => { if(a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) over++; }));
    return {inside, over, n: dmL.length}; }, DEST);
  check(r.ok && dm.inside, 'datová mapa po svazku: cíl šipek (Rwanda) zůstane v rámečku');
  check(dm.n === 5 && dm.over === 0, 'čísla datové mapy nezakryjí popisky míst u šipek ' + JSON.stringify(dm));
  await T('dataMap', {clear: true});

  // --- glóbus: Fidži je na odvrácené straně — žádná šipka z Himálaje ani popisek jinde, varování
  await T('clearScene', {what: 'all'});
  await T('setGlobe', {on: true}); await page.waitForTimeout(2500);
  r = await T('flowArrows', {from: ['-17.8,178.0', '-19.0,46.7'], to: '49.95,14.77', icon: 'letadlo', labels: ['Fidži', 'Madagaskar'], toLabel: 'Chotovice'});
  await page.waitForTimeout(1500);
  F = await feats();
  const madId = (await S()).find(a => a.tail[0] > 40 && a.tail[0] < 50)?.id, fijiId = (await S()).find(a => a.tail[0] > 170)?.id;
  L = await labels();
  check(r.ok && r.farSide?.length === 1 && /Fidži|178/.test(r.farSide[0]) && /odvrácené/.test(r.warning || ''), 'glóbus: místo za obzorem ohlásí ' + JSON.stringify({farSide: r.farSide}));
  check(F.some(f => f.id === madId && f.kind === 'icon') && !F.some(f => f.id === fijiId), 'glóbus: šipka z Madagaskaru je vidět, z Fidži se nekreslí (nezačíná na přivrácené straně)');
  check(!L.some(l => l.t === 'Fidži') && L.some(l => l.t === 'Madagaskar') && L.some(l => l.t === 'Chotovice'), 'glóbus: popisek Fidži nevznikne, ostatní ano ' + L.map(l => l.t).join(','));
  const inFr = await page.evaluate(() => { const m = window.__tnMap, fr = document.getElementById('exportFrame').getBoundingClientRect(), mr = m.getCanvas().getBoundingClientRect();
    return [[46.7, -19.0], [14.77, 49.95]].every(ll => { const p = m.project(ll), x = p.x + mr.left, y = p.y + mr.top; return x > fr.left && x < fr.right && y > fr.top && y < fr.bottom; }); });
  check(inFr, 'glóbus: Madagaskar i Chotovice jsou v rámečku');
  check(/odvrácené straně/.test(await page.$eval('#statusBar', e => e.textContent)), 'glóbus: varování i ve stavovém řádku');
  await T('setGlobe', {on: false}); await page.waitForTimeout(1500);
  await T('setTitle', {off: true});
  await T('clearScene', {what: 'all'});
  check(!warns.some(w => /pzarr/.test(w)), 'piktogramy: žádné „Image could not be loaded" v konzoli ' + warns.filter(w => /pzarr/.test(w)).slice(0, 1).join(''));

  // --- z jednoho místa do víc cílů („údery z Ukrajiny na rafinerie v Rusku"), s titulkem, piktogram dronu
  await T('setTitle', {title: 'Ukrajinské údery na ruské rafinerie a další cíle'});
  r = await T('flowArrows', {from: '49.0,31.4', to: '54.63,39.74; 48.71,44.51; 51.53,46.03; 44.10,39.08', icon: 'drony', labels: ['Rjazaň', 'Volgograd', 'Saratov', 'Tuapse'], fromLabel: 'Ukrajina'});
  check(r.ok && r.arrows === 4 && r.icon === 'dron', 'flowArrows z jednoho místa do 4 cílů jedním voláním, piktogram dronu ' + JSON.stringify(r));
  await page.waitForTimeout(800);
  A = await S();
  check(A.length === 4 && A.every(a => a.tail[0] === A[0].tail[0] && a.tail[1] === A[0].tail[1] && a.icon === 'dron' && a.hdot && a.dot) && new Set(A.map(a => a.head.join())).size === 4,
    'šipky vychází z jednoho bodu a míří do čtyř různých cílů, bod na začátku i u cíle');
  check(await page.evaluate(() => window.__tnMap.hasImage('pzarr|dron|#e22d2d|0')), 'obrázek piktogramu dronu je v mapě (stojí rovně)');
  L = await labels();
  check(L.length === 5 && ['Rjazaň', 'Volgograd', 'Saratov', 'Tuapse', 'Ukrajina'].every(n => L.some(l => l.t === n)), 'popisky u cílů i u zdroje ' + L.map(l => l.t).join(','));
  over = 0; for(let i = 0; i < L.length; i++) for(let j = i + 1; j < L.length; j++){ const a = L[i], b = L[j]; if(a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0) over++; }
  check(over === 0, 'popisky svazku z jednoho místa se nepřekrývají (' + over + ')');
  const tbox = await page.evaluate(() => { if(typeof pzTitleBoxesFor !== 'function') return null; const r = pzExportFrameRect(); const tb = pzTitleBoxesFor(Math.round(r.width), Math.round(r.height));
    return tb?.title ? {x0: r.left + tb.title.x, y0: r.top + tb.title.y, x1: r.left + tb.title.x + tb.title.w, y1: r.top + tb.title.y + tb.title.h} : null; });
  check(!!tbox && L.every(l => !(l.x0 < tbox.x1 && l.x1 > tbox.x0 && l.y0 < tbox.y1 && l.y1 > tbox.y0)), 'žádný popisek pod titulkem grafiky ' + JSON.stringify(tbox));
  const heads = await Promise.all(A.map(a => px(a.head)));
  check(!!tbox && heads.every(h => !(h[0] > tbox.x0 && h[0] < tbox.x1 && h[1] > tbox.y0 && h[1] < tbox.y1)), 'záběr nenechá cíl šipky pod titulkem');
  // „Kyjev, Ukrajina" je jedno místo (čárka před státem nedělí cíle); z víc míst do víc cílů = chyba
  check((await T('flowArrows', {from: '49.0,31.4; 50.45,30.52', to: '54.63,39.74; 48.71,44.51'})).ok === false, 'z víc míst do víc cílů vrátí srozumitelnou chybu');
  await T('undo'); await page.waitForTimeout(400);
  check((await S()).length === 0 && (await labels()).length === 0, 'jeden krok zpět smaže celý svazek z jednoho místa');
  await T('setTitle', {off: true});

  // --- druh dopravy „letadlo" a ikonka lodi (tanker) z běžných slov
  check((await T('setTransportMode', {mode: 'letadlo'})).mode === 'planeArc' && (await T('setTransportMode', {mode: 'auto'})).mode === 'driving', 'setTransportMode rozumí „letadlo" i „auto"');
  r = await T('drawArrow', {from: '50,14', to: '50,16', icon: 'drony', fit: false});
  check(r.ok && r.icon === 'dron', 'dron na šipce má vlastní piktogram (ne výbuch) ' + JSON.stringify(r));
  check(await page.$$eval('#pzIconPalette .pz-icon-pick[data-kind="lod"]', e => e.length) === 1 && await page.$$eval('#sceneArrowIcon option[value="dron"]', e => e.length) === 1, 'loď je v paletě ikonek, dron v nabídce piktogramů');

  check(errors.length === 0, 'bez chyb v konzoli ' + errors.join(' | '));
  await close();
  done();
})();
