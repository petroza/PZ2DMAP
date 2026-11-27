// Datová mapa (Scéna › Datová mapa): zadání reportérů „Česko: 26,6 / Slovensko: 43,5…",
// kraje s čísly, „u každého města číslo", „čísla jen u ČR a Německa", „legenda od méně
// než 2 %…", české formáty čísel, škála, vlastní hranice pásem, legenda v rohu bezpečné
// zóny (přetažení), krok zpět, projekt, nástroj asistenta dataMap a export PNG.
const {check, done, open, tab, openSection, OUT, shot} = require('./lib');
const fs = require('fs'), path = require('path');
(async () => {
  const {page, ctx, errors, close} = await open();
  // geokodér: neznámé město nenajde (test nesmí záviset na Nominatimu)
  await ctx.route(/nominatim\.openstreetmap\.org|photon\.komoot\.io/, r => r.fulfill({status:200, contentType:'application/json', body: /photon/.test(r.request().url()) ? '{"features":[]}' : '[]'}));
  await ctx.route(/tnmap-chat/, r => r.fulfill({status:200, contentType:'application/json', body:'{}'}));
  const dm = () => page.evaluate(() => window.pzDataMap.state());
  const dmLabels = () => page.evaluate(() => window.__pzFns.state.mapLabels.filter(l => l.dm).map(l => l.text.replace(/\s+/g, ' ')).sort());

  // --- čísla po česku a vložený text z mailu
  const p = await page.evaluate(() => {
    const D = window.pzDataMap;
    return {nums: ['26,6', '1 234,5', '1.234,5', '12.5', '−3', '52', 'x'].map(x => D.num(x)?.v ?? null),
      fmt: [D.fmt(26.6, 1), D.fmt(1234.5, 1), D.fmt(52), D.fmt(2.5)],
      a: D.parse('Česko: 26,6 / Slovensko: 43,5 / Rakousko: 52'),
      b: D.parse('Praha 12,4 %\nJihomoravský kraj – 9,9 %\nMSK\t1,8\nbez čísla'),
      c: D.parse('Brno: 1 200 Kč; Ostrava: 980 Kč')};
  });
  check(JSON.stringify(p.nums) === JSON.stringify([26.6, 1234.5, 1234.5, 12.5, -3, 52, null]), 'čísla: desetinná čárka, mezery a tečky v tisících ' + JSON.stringify(p.nums));
  check(p.fmt.join('|') === '26,6|1\u00a0234,5|52|2,5', 'česky formátovaná čísla ' + JSON.stringify(p.fmt));
  check(p.a.rows.map(r => r.name + '=' + r.value).join(',') === 'Česko=26.6,Slovensko=43.5,Rakousko=52', 'řádek „Česko: 26,6 / Slovensko: 43,5 / Rakousko: 52" = 3 hodnoty');
  check(p.b.rows.length === 3 && p.b.unit === '%' && p.b.bad.join() === 'bez čísla' && p.b.rows[1].name === 'Jihomoravský kraj', 'řádky s pomlčkou, tabulátorem a % (jednotka se převezme) ' + JSON.stringify(p.b));
  check(p.c.unit === 'Kč' && p.c.rows[0].value === 1200, 'Kč a středníky ' + JSON.stringify(p.c.rows));
  const br = await page.evaluate(() => [window.pzDataMap.breaks([1.8, 2.4, 3.1, 4.4, 5.5, 6, 8.1, 12.4], 4), window.pzDataMap.breaks([48, 52, 74, 92, 93, 97, 102, 105, 185, 283, 402, 1320], 4)]);
  check(JSON.stringify(br[0]) === '[2.5,5,7.5]', 'hranice pásem jsou kulatá čísla ' + JSON.stringify(br[0]));
  check(br[1].length === 3 && br[1].every(x => x === Math.round(x)) && br[1][0] < 100, 'nerovnoměrná data (Praha 1 320) → pásma po kvantilech ' + JSON.stringify(br[1]));

  // --- panel: vložit státy, jednotka, Vykreslit
  await tab(page, 'scena'); await openSection(page, 'dataMapSection'); await page.waitForTimeout(300);
  check(await page.$$eval('#dmScales .pz-dm-scale', e => e.length) >= 6, 'nabídka barevných škál (TN červená, TN modrá…)');
  await page.fill('#dmRows', 'Česko: 26,6 / Slovensko: 43,5 / Rakousko: 52 / Německo: 38,2 / Polsko: 61 / Ukrajina: 70,3');
  await page.fill('#dmUnit', '%'); await page.dispatchEvent('#dmUnit', 'change');
  await page.click('#dmApplyBtn'); await page.waitForTimeout(6000);
  let s = await dm();
  check(s.main === 'country' && s.items.filter(i => i.kind === 'country').length === 6, 'názvy poznal jako státy ' + JSON.stringify(s.items.map(i => i.kind)));
  const ccm = await page.evaluate(() => ({...window.__pzFns.state.countryColorMap}));
  check(['CZ', 'SK', 'AT', 'DE', 'PL', 'UA'].every(id => /^#[0-9a-f]{6}$/i.test(ccm[id] || '')) && ccm.UA !== ccm.CZ, 'státy obarvené podle škály ' + JSON.stringify(ccm));
  let labs = await dmLabels();
  check(labs.length === 6 && labs.includes('26,6 %') && labs.includes('70,3 %'), 'u všech států číslo s jednotkou ' + JSON.stringify(labs));
  check(await page.$$eval('#dmList .wp-item', e => e.length) === 6 && await page.$$eval('#dmBandList .wp-item', e => e.length) === s.colorsUsed.length, 'panel ukazuje řádky i pásma legendy');
  const legendPx = () => page.evaluate(() => { const c = document.getElementById('exportFrameLegend'); if(!c || c.hidden) return 0; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for(let i = 3; i < d.length; i += 4) if(d[i] > 200) n++; return n; });
  check(await legendPx() > 2000 && await page.evaluate(() => !document.getElementById('dmLegendGrip').hidden), 'legenda je v rámečku náhledu');
  const ll = await page.evaluate(() => { const {w, h} = {w:1920, h:1080}; return window.pzDataMap.legendLayout(w, h); });
  check(ll && ll.x >= 96 && ll.y + ll.h <= 1080 - 54 && ll.rows[ll.rows.length - 1].text === 'méně než 30\u00a0%', 'legenda vlevo dole uvnitř bezpečné zóny, pásma „méně než…" ' + JSON.stringify(ll && {x:ll.x, y:ll.y, w:ll.w, h:ll.h, rows:ll.rows.map(r => r.text)}));

  // --- jen u vybraných, škála, vlastní hranice
  await page.selectOption('#dmLabels', 'chosen'); await page.waitForTimeout(300);
  check((await dmLabels()).length === 0 && await page.$$eval('#dmList input[type=checkbox]', e => e.length) === 6, '„jen u vybraných": čísla zmizí, u řádků jsou zaškrtávátka');
  await page.check('#dmList .wp-item[data-key="cesko"] input[type=checkbox]'); await page.waitForTimeout(300);
  check(JSON.stringify(await dmLabels()) === '["26,6 %"]', 'číslo jen u Česka');
  await page.click('#dmScales .pz-dm-scale[data-scale="blue"]'); await page.waitForTimeout(500);
  s = await dm();
  check(s.scale === 'blue' && s.colorsUsed[s.colorsUsed.length - 1].toLowerCase() === '#0d1767', 'škála TN modrá (nejvyšší pásmo = TN modrá)');
  await page.fill('#dmBreaks', '30; 50'); await page.dispatchEvent('#dmBreaks', 'change'); await page.waitForTimeout(500);
  s = await dm();
  const texts = await page.$$eval('#dmBandList .pz-dm-range', e => e.map(x => x.textContent));
  check(JSON.stringify(s.breaksUsed) === '[30,50]' && texts.join('|') === 'více než 50\u00a0%|30–50\u00a0%|méně než 30\u00a0%', 'vlastní hranice pásem → 3 pásma ' + JSON.stringify(texts));
  await page.fill('#dmLegendTitle', 'Inflace za 5 let'); await page.waitForTimeout(200);
  await shot(page, 'datova_mapa_panel.png');

  // --- legenda: přetažení do pravého horního rohu, krok zpět
  const g = await page.$eval('#dmLegendGrip', e => { const b = e.getBoundingClientRect(); return {x: b.left + b.width / 2, y: b.top + b.height / 2}; });
  const fr = await page.$eval('#exportFrame', e => { const b = e.getBoundingClientRect(); return {r: b.right, t: b.top}; });
  await page.mouse.move(g.x, g.y); await page.mouse.down(); await page.mouse.move((g.x + fr.r) / 2, (g.y + fr.t) / 2, {steps:4}); await page.mouse.move(fr.r - 60, fr.t + 60, {steps:4}); await page.mouse.up();
  await page.waitForTimeout(300);
  check((await dm()).legend.corner === 'tr' && await page.inputValue('#dmLegendCorner') === 'tr', 'legenda přetažená do pravého horního rohu');
  await page.click('#undoActionBtn'); await page.waitForTimeout(2000);
  check((await dm()).legend.corner === 'bl', 'krok zpět vrátí legendu do levého dolního rohu');

  // --- projekt: uložit, smazat, načíst
  const snap = await page.evaluate(() => window.__pzFns.serializeProjectSnapshot());
  check(snap.overlays?.dataMap?.rows?.length === 6 && snap.mapLabels.some(l => l.dm === 'cesko'), 'datová mapa je v projektu (i čísla jako popisky)');
  await page.evaluate(() => window.TNMAP.clearScene({what:'data'})); await page.waitForTimeout(400);
  check(!(await dm()).items.length && (await dmLabels()).length === 0 && !Object.keys(await page.evaluate(() => window.__pzFns.state.countryColorMap)).length && await legendPx() === 0, 'clearScene data smaže barvy, čísla i legendu');
  await page.evaluate(snap => window.__pzFns.applyProjectSnapshot(snap), snap); await page.waitForTimeout(3000);
  s = await dm();
  check(s.items.length === 6 && s.legend.title === 'Inflace za 5 let' && JSON.stringify(await dmLabels()) === '["26,6 %"]' && await legendPx() > 2000, 'načtení projektu vrátí data, číslo i legendu');
  check(await page.inputValue('#dmRows') !== '' && await page.$$eval('#dmList .wp-item', e => e.length) === 6, 'i panel ukazuje načtená data');

  // --- asistent: kraje s hranicemi pásem od reportéra
  const k = await page.evaluate(() => window.TNMAP.dataMap({rows:[{name:'Praha', value:12.4}, {name:'Středočeský', value:8.1}, {name:'JMK', value:9.9}, {name:'Moravskoslezský kraj', value:1.8}, {name:'Vysočina', value:'5,5 %'}, {name:'Zlínský', value:3}],
    unit:'%', scale:'v červených odstínech', bands:[2, 5, 10], legendTitle:'Nezaměstnanost'}));
  check(k.ok && k.kind === 'kraj' && k.items === 6, 'dataMap: kraje ČR poznané ' + JSON.stringify(k));
  check(k.legend.map(l => l.text).join('|') === 'méně než 2\u00a0%|2–5\u00a0%|5–10\u00a0%|více než 10\u00a0%', 'legenda po pásmech jak ji píše reportér ' + JSON.stringify(k.legend.map(l => l.text)));
  const kf = await page.evaluate(() => ({...window.__pzFns.state.czKraje.fill}));
  check(kf.CZ010 === k.legend[3].color && kf.CZ080 === k.legend[0].color && kf.CZ063 === k.legend[2].color, 'kraje mají barvu svého pásma ' + JSON.stringify(kf));
  check(Object.keys(await page.evaluate(() => window.__pzFns.state.countryColorMap)).length === 0, 'nová data nahradí barvy států z minulé datové mapy');
  check(await page.evaluate(() => { const L = window.__tnMap.getStyle().layers.map(l => l.id); const f = L.indexOf('pz-kraje-fill'), sym = window.__tnMap.getStyle().layers.findIndex(l => l.type === 'symbol' && !/^pz-/.test(l.id)); return f > 0 && (sym < 0 || f < sym); }), 'výplň krajů je pod popisky podkladu');

  // --- města: tečka + číslo, neznámé město ohlásí
  const c = await page.evaluate(() => window.TNMAP.dataMap({rows:'Praha: 1320\nBrno: 402\nOstrava: 283\nPlzeň: 185\nLiberec: 105\nOlomouc: 102\nZlín: 74\nXyzzyvár: 5', unit:'tis.', legend:'br', labels:'all'}));
  check(c.ok && c.kind === 'city' && c.items === 7 && c.unknown.join() === 'Xyzzyvár' && /Xyzzyvár/.test(c.note || ''), 'města z místního seznamu, neznámé ohlášené ' + JSON.stringify({kind:c.kind, items:c.items, unknown:c.unknown}));
  await page.waitForTimeout(1500);
  const dots = await page.evaluate(() => window.__tnMap.getSource('pz-data-pts')?.serialize?.().data?.features?.length);
  check(dots === 7, 'u každého města tečka (' + dots + ')');
  labs = await dmLabels();
  check(labs.length === 7 && labs.includes('Praha 1 320 tis.') && labs.some(l => /^Olomouc/.test(l)), 'u každého města název a číslo ' + JSON.stringify(labs));
  const overlap = await page.evaluate(() => { const r = window.__pzFns.state.mapLabels.filter(l => l.dm).map(l => l.marker.getElement().querySelector('.map-label-bubble').getBoundingClientRect());
    let n = 0; for(let i = 0; i < r.length; i++) for(let j = i + 1; j < r.length; j++){ const a = r[i], b = r[j]; if(Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2) n++; } return n; });
  check(overlap === 0, 'čísla u měst se nepřekrývají (' + overlap + ' překryvů)');
  check((await dm()).legend.corner === 'br', 'legenda vpravo dole (nad pilulkou Zdroj mapy)');

  // --- státy: čísla jen u vybraných (pády, zkratky)
  const st = await page.evaluate(() => window.TNMAP.dataMap({rows:'Česko: 26,6 / Slovensko: 43,5 / Rakousko: 52 / Německo: 38,2 / Ukrajina: 70,3', unit:'%', labels:['ČR', 'Německa', 'Slovenska', 'Ukrajiny'], legend:'vlevo dole'}));
  labs = await dmLabels();
  check(st.ok && !st.labelsNotFound && labs.length === 4 && !labs.includes('52\u00a0%'), 'čísla jen u ČR, Německa, Slovenska a Ukrajiny ' + JSON.stringify(labs));
  check(await page.evaluate(() => { const ms = window.__tnMap.getPaintProperty('pz-political-fill', 'fill-opacity'); return JSON.stringify(ms).includes('"CZ"') && JSON.stringify(ms).includes(',1,'); }), 'státy datové mapy plnou barvou (sedí s legendou)');
  const stState = await page.evaluate(() => window.TNMAP.getState());
  check(stState?.scene?.dataMap?.rows?.length === 5 || JSON.stringify(stState).includes('Česko: 26,6'), 'stav mapy pro asistenta obsahuje datovou mapu');

  // --- export PNG: legenda a barvy jako v náhledu
  await page.waitForTimeout(1500);
  const L = await page.evaluate(() => window.pzDataMap.legendLayout(1920, 1080));
  const sw = L.rows.map((r, i) => ({color: r.color, x: L.x + L.accent + L.pad + L.sw / 2, y: L.y + L.pad + L.titleH + i * L.rowH + L.sw / 2}));
  const czFrac = await page.evaluate(() => { const f = document.getElementById('exportFrame').getBoundingClientRect(), m = document.getElementById('map').getBoundingClientRect(), q = window.__tnMap.project([25.0, 50.6]);
    return [(q.x + m.left - f.left) / f.width, (q.y + m.top - f.top) / f.height]; });
  const czColor = (await dm()).items.find(i => i.key === 'ukrajina').color;
  await tab(page, 'export');
  const dl = page.waitForEvent('download', {timeout: 120000}).catch(() => null);
  await page.evaluate(() => document.getElementById('exportPngBtn').click());
  const d = await dl; check(!!d, 'export PNG proběhl');
  if(d){
    const file = path.join(OUT, 'datova_mapa_export.png'); await d.saveAs(file);
    const b64 = fs.readFileSync(file).toString('base64');
    const px = await page.evaluate(async ([b64, pts]) => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
      const k = img.width / 1920;
      return {w: img.width, pts: pts.map(p => [...g.getImageData(Math.round(p.x * k), Math.round(p.y * k), 1, 1).data.slice(0, 3)])}; },
      [b64, [...sw, {x: czFrac[0] * 1920, y: czFrac[1] * 1080}]]);
    const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), dist = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
    const okSw = sw.every((s, i) => dist(px.pts[i], hex(s.color)) < 10);
    check(px.w === 1920 && okSw, 'v exportu je legenda se stejnými barvami pásem ' + JSON.stringify(px.pts.slice(0, sw.length)) + ' vs ' + JSON.stringify(sw.map(s => s.color)));
    check(dist(px.pts[sw.length], hex(czColor)) < 12, 'Ukrajina má v exportu barvu svého pásma ' + JSON.stringify(px.pts[sw.length]) + ' ~ ' + czColor);
  }

  // --- QA: Francie / Španělsko v datech nesmí „Zarámovat scénu" oddálit na celý svět (zámoří)
  await page.evaluate(() => window.TNMAP.dataMap({rows:'Česko: 2,6 / Francie: 1,8 / Španělsko: 2,9 / Portugalsko: 2,4 / Polsko: 4,9', unit:'%'})); await page.waitForTimeout(2500);
  const mb = await page.evaluate(() => { const F = window.__pzFns, fr = F.state.countriesGeojson.features.find(f => f.properties.__appId === 'FR');
    const b = F.pzFeaturesBBox([F.pzMainlandFeature(fr)]), es = F.pzFeaturesBBox([F.pzMainlandFeature(F.state.countriesGeojson.features.find(f => f.properties.__appId === 'ES'))]);
    const s = F.pzFeaturesBBox([{geometry:{coordinates: F.pzSceneLngLats({countries:true})}}]); return {fr:b, es, scene:s}; });
  check(mb.fr[0][0] > -6 && mb.fr[0][1] > 40 && mb.es[0][1] > 35 && mb.scene[1][0] - mb.scene[0][0] < 40, 'pevninská Francie a Španělsko (bez Guyany a Kanár) → záběr na Evropu ' + JSON.stringify(mb.scene));
  // --- QA: smazání datové mapy jde vrátit krokem zpět
  await page.evaluate(() => window.TNMAP.dataMap({clear:true})); await page.waitForTimeout(300);
  await page.evaluate(() => window.__pzUndo()); await page.waitForTimeout(1500);
  check((await dm()).items.filter(i => i.kind).length === 5, 'Ctrl+Z po dataMap clear vrátí datovou mapu');
  // --- QA: kartogram krajů s titulkem a legendou — záběr se legendě a titulku vyhne (16:9),
  // čísla v 9:16 nejsou v exportu 2–3× větší než v 16:9
  await page.evaluate(() => { const r = document.getElementById('exportResolution'); r.value = '1920x1080'; r.dispatchEvent(new Event('change', {bubbles:true})); });
  await page.evaluate(() => window.TNMAP.setTitle({title:'Chudoba seniorů podle krajů', source:'ČSÚ'}));
  await page.evaluate(() => window.TNMAP.dataMap({rows:'Praha: 12,4\nStředočeský: 15,1\nJihočeský: 17,8\nPlzeňský: 16,2\nKarlovarský: 22,5\nÚstecký: 24,9\nLiberecký: 18,3\nKrálovéhradecký: 16,9\nPardubický: 15,7\nVysočina: 14,2\nJihomoravský: 16,5\nOlomoucký: 19,4\nZlínský: 15,9\nMoravskoslezský: 23,1', unit:'%', legend:'bl'}));
  await page.waitForTimeout(2500);
  const geo = () => page.evaluate(() => { const F = window.__pzFns, m = window.__tnMap, f = document.getElementById('exportFrame').getBoundingClientRect(), mr = document.getElementById('map').getBoundingClientRect();
    const c = document.createElement('canvas'), W = +document.getElementById('exportResolution').value.split('x')[0] || 1920, H = +document.getElementById('exportResolution').value.split('x')[1] || 1080;
    const feats = F.state.czKrajeGeo.features; const pts = []; feats.forEach(ft => { const walk = a => typeof a[0] === 'number' ? pts.push(a) : a.forEach(walk); walk(ft.geometry.coordinates); });
    const px = pts.filter((_, i) => i % 7 === 0).map(p => { const q = m.project(p); return [(q.x + mr.left - f.left) / f.width * W, (q.y + mr.top - f.top) / f.height * H]; });
    const tb = F.pzDrawTitleOverlay(c.getContext('2d'), (c.width = W, W), (c.height = H, H));
    return {W, H, px, tb, sizes: [...new Set(F.state.mapLabels.filter(l => l.dm).map(l => l.size))], fw: f.width}; });
  let G = await geo();
  const legendBox = await page.evaluate(() => { const c = document.getElementById('dmLegendGrip').getBoundingClientRect(), f = document.getElementById('exportFrame').getBoundingClientRect(); return {x:(c.left - f.left) / f.width * 1920, y:(c.top - f.top) / f.height * 1080, w:c.width / f.width * 1920, h:c.height / f.height * 1080}; });
  const inBox = (p, b, m = 0) => p[0] > b.x + m && p[0] < b.x + b.w - m && p[1] > b.y + m && p[1] < b.y + b.h - m;
  const underLeg = G.px.filter(p => inBox(p, legendBox, 4)).length, underTitle = G.px.filter(p => inBox(p, G.tb.title, 2)).length, outside = G.px.filter(p => p[0] < 0 || p[1] < 0 || p[0] > 1920 || p[1] > 1080).length;
  check(underLeg === 0 && underTitle === 0 && outside === 0, `16:9: hranice krajů nejsou pod legendou (${underLeg}) ani titulkem (${underTitle}), celá ČR v záběru (${outside})`);
  const size169 = G.sizes[0];
  await page.evaluate(() => { const r = document.getElementById('exportResolution'); r.value = '1080x1920'; r.dispatchEvent(new Event('change', {bubbles:true})); });
  await page.waitForTimeout(800); await page.evaluate(() => window.TNMAP.fitScene()); await page.waitForTimeout(2500);
  // Zarámovat scénu se dolaďuje (přesahující čísla) — počkat na klidný záběr
  for(let i = 0, prev = ''; i < 20; i++){ const z = await page.evaluate(() => { const m = window.__tnMap, c = m.getCenter(); return [m.getZoom(), c.lng, c.lat].map(v => v.toFixed(4)).join(); }); if(z === prev) break; prev = z; await page.waitForTimeout(500); }
  G = await geo();
  const rel916 = G.sizes[0] / G.fw * 1080;   // velikost čísla v px exportu 9:16
  check(G.sizes.length === 1 && G.sizes[0] < size169 && G.px.every(p => p[0] >= 0 && p[0] <= 1080 && p[1] >= 0 && p[1] <= 1920), `9:16: celá ČR v záběru po Zarámovat scénu (mimo: ${G.px.filter(p => p[0] < 0 || p[0] > 1080 || p[1] < 0 || p[1] > 1920).length}), čísla menší v náhledu (${size169} → ${G.sizes[0]} px, ve výstupu ~${Math.round(rel916)} px)`);
  await page.evaluate(() => { const r = document.getElementById('exportResolution'); r.value = '1920x1080'; r.dispatchEvent(new Event('change', {bubbles:true})); });
  let back = '';
  for(let i = 0; i < 30 && back !== String(size169); i++){ await page.waitForTimeout(250); back = (await page.evaluate(() => [...new Set(window.__pzFns.state.mapLabels.filter(l => l.dm).map(l => l.size))])).join(); }
  check(back === String(size169), 'zpět na 16:9: čísla mají zase původní velikost ' + back);

  check(errors.length === 0, 'žádná chyba stránky' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await close(); done();
})();
