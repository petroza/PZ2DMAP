// Sloupcový graf v mapě (Scéna › Sloupcový graf): zadání „mapu Česka s vyznačením
// Moravskoslezského kraje a dva vyskakující sloupce z něj" (2024: 1 250 Kč, 2025: 1 480 Kč),
// tři státy po jednom sloupci se společným měřítkem, panel v bezpečné zóně, náhled = PNG,
// sloupce ve videu vyrostou z nuly během první sekundy (PNG = konečná výška), přetažení
// a dvojklik, krok zpět, projekt, clearScene, panel v Scéně, z datové mapy a nástroj barChart.
const {check, done, open, tab, openSection, OUT, shot} = require('./lib');
const fs = require('fs'), path = require('path'), {execSync} = require('child_process');
(async () => {
  const {page, ctx, errors, close} = await open();
  await ctx.route(/nominatim\.openstreetmap\.org|photon\.komoot\.io/, r => r.fulfill({status:200, contentType:'application/json', body: /photon/.test(r.request().url()) ? '{"features":[]}' : '[]'}));
  await ctx.route(/tnmap-chat/, r => r.fulfill({status:200, contentType:'application/json', body:'{}'}));
  const downloads = []; page.on('download', d => downloads.push(d));
  const waitDl = async n => { for(let i = 0; i < 600 && downloads.length < n; i++) await page.waitForTimeout(200); return downloads.length >= n; };
  const st = () => page.evaluate(() => window.pzBars.state());
  const T = (name, args) => page.evaluate(([n, a]) => window.TNMAP[n](a), [name, args]);

  // --- převod řádků
  const p = await page.evaluate(() => [window.pzBars.parse('2024: 1 250 Kč\n2025: 1 480 Kč'), window.pzBars.parse([{label:'2024', value:'1 250 Kč'}, {label:'2025', value:1480}]), window.pzBars.parse('a: 1; b: 2; c: 3; d: 4; e: 5')]);
  check(p[0].unit === 'Kč' && p[0].bars.map(b => b.label + '=' + b.value).join() === '2024=1250,2025=1480', 'řádky „2024: 1 250 Kč" → 2 sloupce v Kč ' + JSON.stringify(p[0]));
  check(p[1].unit === 'Kč' && p[1].bars[0].value === 1250 && p[2].bars.length === 4, 'pole s textovou hodnotou, nejvýš 4 sloupce');

  // --- zadání: MSK zvýrazněný + dva sloupce
  let r = await T('colorRegion', {region:'Moravskoslezský', color:'červená'});
  check(r.ok, 'Moravskoslezský kraj zvýrazněný (colorRegion)');
  r = await T('barChart', {place:'Moravskoslezský kraj', bars:[{label:'2024', value:1250}, {label:'2025', value:1480}], unit:'Kč'});
  check(r.ok && r.kind === 'kraj' && r.bars.join('|').replace(/\s/g, ' ') === '2024: 1 250 Kč|2025: 1 480 Kč', 'barChart u kraje: ' + JSON.stringify(r));
  await T('fitScene', {}); await page.waitForTimeout(2500);
  let L = (await page.evaluate(() => window.pzBars.layouts(1920, 1080)))[0];
  const safe = l => l.x >= 96 && l.y >= 54 && l.x + l.w <= 1824 && l.y + l.h <= 1026;
  check(L && L.cols.length === 2 && safe(L) && L.cols[1].hFin > L.cols[0].hFin && Math.abs(L.cols[0].hFin / L.cols[1].hFin - 1250 / 1480) < 0.01, 'dva sloupce, výška úměrná hodnotě, panel v bezpečné zóně ' + JSON.stringify(L && {x:L.x, y:L.y, w:L.w, h:L.h}));
  check(L.cols[0].color !== L.cols[1].color && L.anchor && Math.abs(L.anchor[0] - (L.x + L.w / 2)) < L.w && L.anchor[1] >= L.y + L.h, 'sloupce v barvách TN, zobáček míří na kraj pod panelem');
  check(await page.evaluate(() => window.pzBars.clock(false)) === null && await page.evaluate(() => window.pzBars.clock(true)) === null, 'klidový náhled a PNG: konečná výška');
  // náhled v rámečku: plátno + táhlo přes panel
  const prev = await page.evaluate(() => { const c = document.getElementById('pzBarsOverlay'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for(let i = 3; i < d.length; i += 16) if(d[i] > 200) n++;
    const g = document.querySelector('.pz-bar-grip'), f = window.__pzFns.pzExportFrameRect(), b = g.getBoundingClientRect(); return {n, g: {x:(b.left - f.left) / f.width, y:(b.top - f.top) / f.height}}; });
  check(prev.n > 500 && Math.abs(prev.g.x - L.x / 1920) < 0.01 && Math.abs(prev.g.y - L.y / 1080) < 0.01, 'náhled kreslí graf a táhlo sedí na panel ' + JSON.stringify(prev));
  await shot(page, '38_graf_nahled.png');

  // --- PNG: graf na stejném místě jako v náhledu
  await tab(page, 'export');
  let d0 = downloads.length;
  await page.evaluate(() => document.getElementById('exportPngBtn').click());
  check(await waitDl(d0 + 1), 'export PNG proběhl');
  const png = path.join(OUT, '38_graf_export.png'); await downloads[d0].saveAs(png);
  const px = await page.evaluate(async ([b64, L]) => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    const at = (a, b) => [...x.getImageData(Math.round(a), Math.round(b), 1, 1).data].slice(0, 3);
    return {w: im.width, panel: at(L.x + 8, L.y + L.h / 2), bar0: at(L.cols[0].cx, L.baseY - 10), bar1: at(L.cols[1].cx, L.baseY - L.cols[1].hFin + 12), gap: at((L.cols[0].cx + L.cols[1].cx) / 2, L.baseY - 40)}; },
    [fs.readFileSync(png).toString('base64'), L]);
  const near = (a, hex, tol = 30) => { const h = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); return a.every((v, i) => Math.abs(v - h[i]) < tol); };
  check(px.w === 1920 && near(px.panel, '#ffffff', 12) && near(px.bar0, L.cols[0].color) && near(px.bar1, L.cols[1].color) && near(px.gap, '#ffffff', 12), 'PNG: panel a sloupce v plné výšce tam, kde v náhledu ' + JSON.stringify(px));

  // --- video: sloupce vyrostou během první sekundy (bez trasy a bez kamery)
  check(await page.evaluate(() => !document.getElementById('exportVideoInfo').classList.contains('warn')), 'video bez trasy i kamery jde — sloupce jsou pohyb');
  await page.evaluate(() => { window.TNMAP.setValues({animDuration:1.6}); const s = document.getElementById('exportFps'); const o = document.createElement('option'); o.value = '10'; o.textContent = '10'; s.appendChild(o); s.value = '10'; s.dispatchEvent(new Event('change', {bubbles:true}));
    const r = document.getElementById('exportResolution'); r.value = 'custom'; r.dispatchEvent(new Event('change', {bubbles:true}));
    const a = document.getElementById('exportCustomWidth'), b = document.getElementById('exportCustomHeight'); a.value = 640; b.value = 360; a.dispatchEvent(new Event('input', {bubbles:true})); });
  await page.waitForTimeout(500);
  // časy: na začátku nic, v půlce menší, od ~1,1 s konečná výška (stejná funkce kreslí video)
  const grow = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 1920; c.height = 1080; const x = c.getContext('2d'); const L = window.pzBars.layouts(1920, 1080)[0];
    return [0, 0.45, 1.2].map(t => { x.clearRect(0, 0, 1920, 1080); window.pzBars.draw(x, 1920, 1080, t); const col = L.cols[1];
      let h = 0; for(let y = Math.round(L.baseY) - 3; y > L.y; y--){ const d = x.getImageData(Math.round(col.cx), y, 1, 1).data; if(d[3] > 200 && d[0] > 200 && d[1] < 120) h++; else if(h) break; } return Math.round(h); }); });
  check(grow[0] === 0 && grow[1] > 10 && grow[1] < grow[2] * 1.2 && Math.abs(grow[2] - L.cols[1].hFin) < 6, 'sloupec roste z nuly: ' + JSON.stringify(grow) + ' / ' + Math.round(L.cols[1].hFin));
  d0 = downloads.length;
  await page.click('#exportVideoBtn');
  check(await waitDl(d0 + 1), 'video vyexportované');
  const mp4 = path.join(OUT, '38_graf.mp4'); await downloads[d0].saveAs(mp4);
  try{
    const fr = path.join(OUT, '38_graf_f%02d.png');
    execSync(`ffmpeg -loglevel error -y -i "${mp4}" "${fr}"`);
    const files = fs.readdirSync(OUT).filter(f => /^38_graf_f\d+\.png$/.test(f)).sort();
    const red = await page.evaluate(async b64s => { const out = []; for(const b of b64s){ const im = new Image(); im.src = 'data:image/png;base64,' + b; await im.decode();
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data; let n = 0, nv = 0; for(let i = 0; i < d.length; i += 4){ if(d[i] > 215 && d[i + 1] < 90 && d[i + 2] < 90) n++; if(d[i] < 40 && d[i + 1] < 50 && d[i + 2] > 80) nv++; } out.push(nv); } return out; },
      files.map(f => fs.readFileSync(path.join(OUT, f)).toString('base64')));
    // tmavě modrý sloupec 2024 (navy) — počet px: první snímek nic, pak roste, na konci ustálený
    const z = red.length - 1;
    check(files.length >= 14 && red[0] < 20 && red[4] > red[2] && Math.abs(red[z] - red[z - 3]) < red[z] * 0.02 && red[z] > 200, 'video: v prvním snímku sloupce nejsou, pak vyrostou a stojí ' + JSON.stringify(red));
  }catch(e){ console.log('   (ffmpeg nedostupný — snímky videa neověřeny) ' + String(e).slice(0, 80)); }
  // dvojice stejných záběrů kamery dál drží kameru (pauza)
  const pause = await page.evaluate(() => { const F = window.__pzFns, S = F.state, m = window.__tnMap, c = m.getCenter(), keep = S.cameraAnim;
    const v = {center:[c.lng, c.lat], zoom:m.getZoom(), pitch:0, bearing:0};
    try{ S.cameraAnim = {...(keep || {}), enabled:true, keyframes:[{view:{...v}}, {view:{...v}}, {view:{...v, zoom:v.zoom + 1}}]};
      const a = F.getCameraStateAtProgress(0.2); return !!a && Math.abs(a.zoom - v.zoom) < 1e-6; } finally { S.cameraAnim = keep; } }).catch(e => String(e));
  check(pause === true, 'dva stejné záběry kamery dál drží kameru (pauza) — ' + pause);

  // --- tři státy, každý jeden sloupec, společné měřítko
  await page.evaluate(() => window.TNMAP.setValues({animDuration:8}));
  await page.evaluate(() => { const r = document.getElementById('exportResolution'); r.value = '1920x1080'; r.dispatchEvent(new Event('change', {bubbles:true})); });
  await T('barChart', {clear:true});
  for(const [k, v] of [['Česko', 26.6], ['Slovensko', 43.5], ['Rakousko', 52]]) r = await T('barChart', {place:k, bars:[{label:'', value:v}], unit:'%'});
  check(r.ok && r.kind === 'country' && r.charts === 3, '3 státy po jednom sloupci ' + JSON.stringify(r));
  await T('fitScene', {}); await page.waitForTimeout(2500);
  let Ls = await page.evaluate(() => window.pzBars.layouts(1920, 1080));
  const h = Ls.map(l => l.cols[0].hFin);
  check(Ls.length === 3 && Math.abs(h[0] / h[2] - 26.6 / 52) < 0.01 && Math.abs(h[1] / h[2] - 43.5 / 52) < 0.01 && Ls.every(safe), 'společné měřítko států ' + JSON.stringify(h.map(Math.round)));
  await shot(page, '38_graf_staty.png');
  // stav pro asistenta
  const sc = await page.evaluate(() => window.TNMAP.getState());
  check((sc.scene.barCharts || []).length === 3, 'stav mapy hlásí grafy ' + JSON.stringify(sc.scene.barCharts));

  // --- přetažení, dvojklik, krok zpět
  await tab(page, 'scena');
  const g = await page.$eval('.pz-bar-grip[data-id]', e => { const b = e.getBoundingClientRect(); return {x: b.left + b.width / 2, y: b.top + b.height / 2, id: e.dataset.id}; });
  await page.mouse.move(g.x, g.y); await page.mouse.down(); await page.mouse.move(g.x - 60, g.y + 40, {steps:5}); await page.mouse.up(); await page.waitForTimeout(300);
  let c = (await st()).items.find(x => String(x.id) === g.id);
  check(c.off[0] < -0.02 && c.off[1] > 0.02, 'graf přetažený jinam ' + JSON.stringify(c.off));
  await page.click('#undoActionBtn'); await page.waitForTimeout(1500);
  c = (await st()).items.find(x => String(x.id) === g.id);
  check(c && c.off[0] === 0 && c.off[1] === 0 && (await st()).items.length === 3, 'krok zpět vrátí polohu');
  await page.mouse.move(g.x, g.y); await page.mouse.down(); await page.mouse.move(g.x + 50, g.y, {steps:4}); await page.mouse.up(); await page.waitForTimeout(200);
  await page.dblclick('.pz-bar-grip[data-id="' + g.id + '"]'); await page.waitForTimeout(200);
  c = (await st()).items.find(x => String(x.id) === g.id);
  check(c.off[0] === 0 && c.off[1] === 0, 'dvojklik vrátí graf k místu');

  // --- projekt: uložit, smazat, načíst
  const snap = await page.evaluate(() => window.__pzFns.serializeProjectSnapshot());
  check(snap.overlays?.barCharts?.items?.length === 3, 'grafy jsou v projektu');
  r = await T('clearScene', {what:'grafy'});
  check(r.ok && !(await st()).items.length && await page.evaluate(() => document.getElementById('pzBarsOverlay').hidden || !document.querySelector('.pz-bar-grip')), 'clearScene grafy smaže grafy i z náhledu');
  await page.evaluate(snap => window.__pzFns.applyProjectSnapshot(snap), snap); await page.waitForTimeout(2500);
  check((await st()).items.map(x => x.place).join() === 'Česko,Slovensko,Rakousko', 'načtený projekt vrátí grafy');

  // --- panel ve Scéně
  await openSection(page, 'barChartSection'); await page.waitForTimeout(300);
  check(await page.$$eval('#bcList .wp-item', e => e.length) === 3, 'seznam grafů v panelu');
  await page.fill('#bcPlace', 'Brno'); await page.fill('#bcRows', 'Nájem: 18 500\nHypotéka: 24 300'); await page.fill('#bcUnit', 'Kč'); await page.fill('#bcTitle', 'Bydlení měsíčně');
  await page.click('#bcAddBtn'); await page.waitForTimeout(1500);
  let s = await st(); c = s.items.find(x => x.place === 'Brno');
  check(c && c.kind === 'city' && c.bars.length === 2 && c.unit === 'Kč' && c.title === 'Bydlení měsíčně' && await page.$$eval('#bcList .wp-item', e => e.length) === 4, 'panel přidá graf u města ' + JSON.stringify(c && {kind:c.kind, bars:c.bars, unit:c.unit}));
  await page.uncheck('#bcPanel'); await page.waitForTimeout(200);
  check((await st()).items.find(x => x.place === 'Brno').panel === false, 'přepínač panelu mění vybraný graf');
  await shot(page, '38_graf_panel.png');
  await page.click('#bcClearBtn'); await page.waitForTimeout(300);
  check(!(await st()).items.length, 'Smazat grafy');

  // --- z datové mapy
  await page.evaluate(() => window.TNMAP.dataMap({rows:'Česko: 26,6 / Slovensko: 43,5 / Rakousko: 52', unit:'%'})); await page.waitForTimeout(4000);
  r = await T('barChart', {fromDataMap:true});
  s = await st();
  check(r.ok && r.charts === 3 && s.items.every(x => x.unit === '%' && x.bars.length === 1) && (await page.evaluate(() => window.pzDataMap.state().labels)) === 'none', 'sloupce z datové mapy (čísla datové mapy schovaná) ' + JSON.stringify(r));
  r = await T('barChart', {place:'Rakousko'});
  check(r.ok && r.bars[0].replace(/\s/g, ' ') === '52 %', 'bez bars vezme hodnotu místa z datové mapy');
  r = await T('barChart', {place:'Rakousko', clear:true});
  check(r.ok && (await st()).items.length === 2, 'clear s místem smaže jen ten graf');
  const bad = await T('barChart', {place:'Xqzzyw', bars:[1]});
  check(!bad.ok && /nenašel/.test(bad.error), 'neznámé místo vrátí chybu ' + JSON.stringify(bad));
  check(errors.length === 0, 'žádná chyba stránky ' + errors.join(' | '));
  await close(); done();
})();
