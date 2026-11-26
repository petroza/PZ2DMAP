// Liniové úseky (Scéna › Úseky): zadání „celou trasu dálnice s hotovými úseky, ty, o kterých
// mluvíme, zvýraznit + datum", „železniční mapa… vyznačit tratě". Stav z textu reportéra,
// navazující úseky sdílí bod (Ostrov mezi Opatovicemi a Litomyšlí, ne vesnice u Opatovic),
// popisky termínů, legenda stavů v rámečku i v PNG, úprava stavu a popisku v seznamu,
// přidání z panelu s navázáním Od, výběr kliknutím do mapy + Delete, krok zpět, projekt,
// clearScene, trať po železnici a export PNG. Geokodér i OSRM podvržené (bez sítě).
const {check, done, open, tab, openSection, OUT, shot} = require('./lib');
const fs = require('fs'), path = require('path');
const PLACES = {
  'opatovice nad labem': [[15.7901, 50.1466]],
  // dvě obce Ostrov: vesnice 5 km od Opatovic (první u Opatovic) a Ostrov (okres Chrudim) na D35
  'ostrov': [[15.8000, 50.1900], [16.0305, 49.9725]],
  'litomysl': [[16.3125, 49.8709]], 'januvky': [[16.5410, 49.7420]], 'mohelnice': [[16.9195, 49.7770]],
  'praha': [[14.4355, 50.0830]], 'kolin': [[15.2010, 50.0270]]
};
const fold = v => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(',')[0].trim();
(async () => {
  const {page, ctx, errors, close} = await open();
  await ctx.route(/tnmap-chat/, r => r.fulfill({status:200, contentType:'application/json', body:'{}'}));
  await ctx.route(/nominatim\.openstreetmap\.org|photon\.komoot\.io/, r => {
    const u = new URL(r.request().url()), q = fold(u.searchParams.get('q'));
    if(/photon/.test(u.host)) return r.fulfill({status:200, contentType:'application/json', body:'{"features":[]}'});
    const hit = (PLACES[q] || []).map((c, i) => ({lat: String(c[1]), lon: String(c[0]), name: u.searchParams.get('q'), display_name: u.searchParams.get('q') + ', Česko', class:'boundary', type:'administrative',
      place_id: i + 1, address:{country:'Česko', country_code:'cz'}, namedetails:{name: u.searchParams.get('q')}}));
    r.fulfill({status:200, contentType:'application/json', body: JSON.stringify(hit)});
  });
  // OSRM: přímka po 20 bodech přes všechny body úseku
  await ctx.route(/router\.project-osrm\.org|routing\.openstreetmap\.de/, r => {
    const pts = decodeURIComponent(new URL(r.request().url()).pathname.split('/').pop()).split(';').map(p => p.split(',').map(Number));
    const coords = [];
    for(let i = 1; i < pts.length; i++) for(let k = (i === 1 ? 0 : 1); k <= 20; k++){ const t = k / 20; coords.push([pts[i-1][0] + (pts[i][0] - pts[i-1][0]) * t, pts[i-1][1] + (pts[i][1] - pts[i-1][1]) * t + Math.sin(t * Math.PI) * 0.01]); }
    r.fulfill({status:200, contentType:'application/json', body: JSON.stringify({code:'Ok', routes:[{geometry:{type:'LineString', coordinates:coords}, distance:1, duration:1}]})});
  });
  const st = () => page.evaluate(() => window.pzUseky.state());
  const feats = () => page.evaluate(() => window.pzUseky.features().features.map(f => ({kind: f.properties.kind, st: f.properties.st, text: f.properties.text})));
  const legendPx = () => page.evaluate(() => { const c = document.getElementById('exportFrameLegend'); if(!c) return 0; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for(let i = 3; i < d.length; i += 4) if(d[i] > 200) n++; return n; });

  // --- stav z textu reportéra
  const sts = await page.evaluate(() => ['hotový', 'otevřeno 2025', 've výstavbě', 'staví se', 'v plánu', 'plánovaný', 'zvýraznit', 'o kterém budeme mluvit', 'xyz'].map(v => window.pzUseky.status(v)));
  check(JSON.stringify(sts) === JSON.stringify(['hotovy', 'hotovy', 'stavba', 'stavba', 'planovany', 'planovany', 'zvyrazneny', 'zvyrazneny', null]), 'stav úseku z textu zadání ' + JSON.stringify(sts));

  // --- nástroj: D35 Opatovice–Ostrov (hotový), Ostrov–Litomyšl (ve výstavbě 2026), Litomyšl–Janůvky (plánovaný 2029)
  let r = await page.evaluate(() => window.TNMAP.roadSections({sections:[
    {from:'Opatovice nad Labem', to:'Ostrov', status:'hotový'},
    {from:'Ostrov', to:'Litomyšl', status:'ve výstavbě', label:'2026'},
    {from:'Litomyšl', to:'Janůvky', status:'plánovaný', label:'2029'}], legendTitle:'Dálnice D35'}));
  check(r.ok && r.sections.length === 3 && r.sections[1].label === '2026' && r.sections[2].status === 'Plánovaný', 'roadSections nakreslí 3 úseky D35 ' + JSON.stringify(r).slice(0, 300));
  let s = await st();
  const km = (a, b) => Math.hypot((a[0] - b[0]) * 71.6, (a[1] - b[1]) * 111.2);
  check(s.items[0].b && km(s.items[0].b, [16.0305, 49.9725]) < 1, 'Ostrov = obec na D35 mezi Opatovicemi a Litomyšlí, ne vesnice u Opatovic ' + JSON.stringify(s.items[0].b));
  check(s.items[1].a && km(s.items[0].b, s.items[1].a) < 0.01, 'navazující úseky sdílí bod Ostrov');
  await page.waitForTimeout(2500);
  let f = await feats();
  check(f.filter(x => x.kind === 'tah').map(x => x.st).join() === 'hotovy,stavba,planovany' && f.filter(x => x.kind === 'bod').length === 4, 'na mapě 3 čáry podle stavu a 4 body na rozhraních (ne 6)');
  check(JSON.stringify(f.filter(x => x.kind === 'popis').map(x => x.text)) === '["2026","2029"]', 'popisky termínů u úseků');
  const rendered = await page.evaluate(() => ['pzuz-tah-hotovy', 'pzuz-tah-stavba', 'pzuz-tah-planovany', 'pzuz-tah-popis'].map(id => (window.__tnMap.queryRenderedFeatures({layers:[id]}) || []).length));
  check(rendered.every(n => n > 0), 'úseky a popisky se vykreslí ' + JSON.stringify(rendered));
  const ll = await page.evaluate(() => window.pzUseky.legendLayout(1920, 1080));
  check(ll && ll.rows.map(x => x.text).join('|') === 'Hotové úseky|Ve výstavbě|Plánované' && ll.x >= 96 && ll.y + ll.h <= 1080 - 54, 'legenda stavů vlevo dole v bezpečné zóně ' + JSON.stringify(ll && {x:ll.x, y:ll.y, w:ll.w, h:ll.h}));
  check(await legendPx() > 2000, 'legenda je v rámečku náhledu');
  const stState = await page.evaluate(() => window.TNMAP.getState());
  check(/Ostrov – Litomyšl.*Ve výstavbě.*2026/.test(JSON.stringify(stState?.scene?.sections || stState?.sections || '')), 'stav mapy pro asistenta obsahuje úseky');

  // --- panel: seznam, změna stavu a popisku přímo v seznamu, krok zpět
  await tab(page, 'scena'); await openSection(page, 'pzSectionsSection'); await page.waitForTimeout(300);
  check(await page.$$eval('#pzSecList .pz-sec-row', e => e.length) === 3, 'seznam ukazuje 3 úseky');
  await page.selectOption('#pzSecList .pz-sec-row:nth-child(3) select.pz-sec-st', 'zvyrazneny'); await page.waitForTimeout(400);
  s = await st();
  check(s.items[2].status === 'zvyrazneny' && (await page.evaluate(() => window.pzUseky.legendLayout(1920, 1080).rows.map(x => x.text))).includes('Zvýrazněný úsek'), 'stav změněný v seznamu (plánovaný → zvýrazněný), legenda se přizpůsobí');
  await page.click('#undoActionBtn'); await page.waitForTimeout(1500);
  check((await st()).items[2].status === 'planovany', 'krok zpět vrátí stav úseku');
  await page.fill('#pzSecList .pz-sec-row:nth-child(2) input.pz-sec-label', 'otevřeno 2026'); await page.press('#pzSecList .pz-sec-row:nth-child(2) input.pz-sec-label', 'Enter'); await page.waitForTimeout(300);
  check((await feats()).some(x => x.kind === 'popis' && x.text === 'otevřeno 2026'), 'popisek přepsaný v seznamu je na mapě');

  // --- přidání z panelu: Od se doplní koncem předchozího úseku
  await page.fill('#pzSecFrom', 'Janůvky'); await page.fill('#pzSecTo', 'Mohelnice');
  await page.selectOption('#pzSecStatus', 'stavba'); await page.fill('#pzSecLabel', '2030');
  await page.click('#pzSecAddBtn'); await page.waitForTimeout(4000);
  s = await st();
  check(s.items.length === 4 && s.items[3].status === 'stavba' && s.items[3].label === '2030' && km(s.items[3].a, s.items[2].b) < 0.01, 'úsek přidaný z panelu navazuje na Janůvky');
  check(await page.inputValue('#pzSecFrom') === 'Mohelnice' && await page.inputValue('#pzSecTo') === '', 'další úsek: Od = Mohelnice, Do prázdné');
  await shot(page, 'useky_panel.png');

  // --- klik do mapy vybere úsek, Delete ho smaže, krok zpět vrátí
  await page.evaluate(() => window.TNMAP.fitScene?.()); await page.waitForTimeout(1500);
  const pt = await page.evaluate(() => { const s = window.pzUseky.state(), c = s.items[0].coords, p = c[Math.floor(c.length / 2)], q = window.__tnMap.project(p), m = document.getElementById('map').getBoundingClientRect(); return {x: m.left + q.x, y: m.top + q.y}; });
  await page.mouse.click(pt.x, pt.y); await page.waitForTimeout(400);
  const sel = await page.evaluate(() => window.__pzFns.state.pzSecSel);
  check(sel && sel === (await st()).items[0].id && await page.$eval('#pzSecList .pz-sec-row.active', e => e.dataset.id).catch(() => null) === sel, 'klik na čáru vybere úsek (i v seznamu)');
  await page.keyboard.press('Delete'); await page.waitForTimeout(400);
  check((await st()).items.length === 3, 'Delete smaže vybraný úsek');
  await page.click('#undoActionBtn'); await page.waitForTimeout(1500);
  check((await st()).items.length === 4, 'krok zpět vrátí smazaný úsek');

  // --- projekt a clearScene
  const snap = await page.evaluate(() => window.__pzFns.serializeProjectSnapshot());
  check(snap.sections?.items?.length === 4 && snap.sections.legend.title === 'Dálnice D35', 'úseky a legenda jsou v projektu');
  r = await page.evaluate(() => window.TNMAP.clearScene({what:'úseky'})); await page.waitForTimeout(400);
  check(r.ok && (await st()).items.length === 0 && (await feats()).length === 0 && await legendPx() === 0, 'clearScene úseky smaže čáry i legendu');
  await page.evaluate(snap => window.__pzFns.applyProjectSnapshot(snap), snap); await page.waitForTimeout(2500);
  s = await st();
  check(s.items.length === 4 && s.legend.title === 'Dálnice D35' && await legendPx() > 2000 && await page.$$eval('#pzSecList .pz-sec-row', e => e.length) === 4, 'načtený projekt vrátí úseky, legendu i seznam');

  // --- chyby a trať po železnici
  r = await page.evaluate(() => window.TNMAP.roadSections({sections:[{from:'D35', to:'Litomyšl'}]}));
  check(!r.ok && /číslo silnice/.test(r.error), 'číslo dálnice místo obce = srozumitelná chyba');
  r = await page.evaluate(() => window.TNMAP.roadSections({sections:[{from:'Ostrov', to:'Litomyšl', status:'nevím'}], append:true}));
  check(!r.ok && /Stav „nevím"/.test(r.error) && (await st()).items.length === 4, 'neznámý stav = chyba, úseky zůstanou');
  r = await page.evaluate(() => window.TNMAP.roadSections({sections:[{from:'Praha', to:'Kolín', mode:'rail', status:'zvýrazněný', label:'výluka'}], legend:false}));
  s = await st();
  check(r.ok && s.items.length === 1 && s.items[0].mode === 'rail' && s.items[0].km > 55 && s.items[0].km < 90 && s.items[0].coords.length > 20 && !s.legend.on, 'trať Praha – Kolín po železnici (' + s.items[0]?.km + ' km), legenda vypnutá');

  // --- export PNG: čára a legenda v barvách stavů jako v náhledu
  r = await page.evaluate(() => window.TNMAP.roadSections({sections:[
    {from:'Opatovice nad Labem', to:'Ostrov', status:'hotový'}, {from:'Ostrov', to:'Litomyšl', status:'ve výstavbě', label:'2026'}], legend:'bl', legendTitle:'D35'}));
  await page.waitForTimeout(3000);
  const L = await page.evaluate(() => window.pzUseky.legendLayout(1920, 1080));
  const frac = await page.evaluate(() => { const f = document.getElementById('exportFrame').getBoundingClientRect(), m = document.getElementById('map').getBoundingClientRect();
    const c = window.pzUseky.state().items[0].coords, q = window.__tnMap.project(c[Math.floor(c.length / 2)]);
    return [(q.x + m.left - f.left) / f.width, (q.y + m.top - f.top) / f.height]; });
  await tab(page, 'export');
  const dl = page.waitForEvent('download', {timeout: 120000}).catch(() => null);
  await page.evaluate(() => document.getElementById('exportPngBtn').click());
  const d = await dl; check(!!d, 'export PNG proběhl');
  if(d){
    const file = path.join(OUT, 'useky_export.png'); await d.saveAs(file);
    const b64 = fs.readFileSync(file).toString('base64');
    const swY = L.y + L.pad + L.titleH + L.rowF / 2, swX = L.x + L.accent + L.pad + L.sw / 2;
    const px = await page.evaluate(async ([b64, pts]) => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
      const k = img.width / 1920;
      return {w: img.width, pts: pts.map(p => { let best = null; for(let dy = -3; dy <= 3; dy++) for(let dx = -3; dx <= 3; dx++){ const v = [...g.getImageData(Math.round(p[0] * k) + dx, Math.round(p[1] * k) + dy, 1, 1).data.slice(0, 3)]; const e = Math.max(...v.map((x, i) => Math.abs(x - p[2][i]))); if(!best || e < best.e) best = {v, e}; } return best; })}; },
      [b64, [[frac[0] * 1920, frac[1] * 1080, [0x4f, 0x6d, 0x8f]], [swX, swY, [0x4f, 0x6d, 0x8f]], [swX, swY + L.rowH, [0xf7, 0x67, 0x07]]]]);
    check(px.w === 1920 && px.pts[0].e < 14, 'v exportu je hotový úsek v šedomodré ' + JSON.stringify(px.pts[0]));
    check(px.pts[1].e < 14 && px.pts[2].e < 14, 'v exportu je legenda stavů se stejnými barvami ' + JSON.stringify(px.pts.slice(1)));
  }

  check(errors.length === 0, 'žádná chyba stránky' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await close(); done();
})();
