// Pohodlí ve scéně: velikost popisku tažením za levý horní roh, ukončení
// vkládání klikem jinam v menu (posun mapy pak nepřidává další popisky) a
// výchozí vzhled po „Výchozí vzhled" = Positron + Modrá přírodní.
const {check, done, open, tab} = require('./lib');
(async () => {
  const {page, errors, close} = await open();
  await tab(page, 'scena');
  await page.evaluate(() => { const s = document.getElementById('mapLabelSection'); if(s?.classList.contains('collapsed')) s.querySelector('h3').click(); });
  // vkládání popisků zapnout, dva popisky klikem do mapy
  await page.click('#addMapLabelBtn');
  const map = await (await page.$('#map')).boundingBox();
  await page.mouse.click(map.x + map.width * 0.55, map.y + map.height * 0.45); await page.waitForTimeout(300);
  await page.keyboard.press('Escape').catch(() => {});
  await page.click('#addMapLabelBtn').catch(() => {});
  const armed = await page.evaluate(() => window.__pzFns.state.addingMapLabel);
  // klik jinam v menu (sekce Ikonky) → vkládání se vypne
  await page.click('.tab-btn[data-tab="trasa"]'); await page.waitForTimeout(200);
  const after = await page.evaluate(() => window.__pzFns.state.addingMapLabel);
  const n0 = await page.evaluate(() => window.__pzFns.state.mapLabels.length);
  await page.mouse.click(map.x + map.width * 0.7, map.y + map.height * 0.6); await page.waitForTimeout(300);
  const n1 = await page.evaluate(() => window.__pzFns.state.mapLabels.length);
  check(armed && !after && n1 === n0, `klik jinam v menu ukončí vkládání (zapnuto ${armed}, po kliku ${after}, popisků ${n0} → ${n1})`);
  // velikost za levý horní roh
  await tab(page, 'scena');
  const lab = await page.evaluate(() => { const it = window.__pzFns.state.mapLabels[0]; return {id: it.id, size: it.size}; });
  await page.evaluate(id => { const it = window.__pzFns.state.mapLabels.find(l => l.id === id); it.marker.getElement().classList.add('selected'); }, lab.id);
  const h = await page.evaluate(id => { const el = window.__pzFns.state.mapLabels.find(l => l.id === id).marker.getElement().querySelector('.map-label-resize'); const r = el.getBoundingClientRect(); return {x: r.x + r.width / 2, y: r.y + r.height / 2, vis: getComputedStyle(el).display !== 'none'}; }, lab.id);
  await page.mouse.move(h.x, h.y); await page.mouse.down(); await page.mouse.move(h.x - 40, h.y - 25, {steps: 6}); await page.mouse.up(); await page.waitForTimeout(200);
  const big = await page.evaluate(id => window.__pzFns.state.mapLabels.find(l => l.id === id).size, lab.id);
  check(h.vis && big > lab.size + 4, `tažení za levý horní roh zvětší popisek (${lab.size} → ${big} px)`);
  // Enter v poli Text popisku vytváří nový popisek (vybraný nepřepíše); vkládání trvá do Esc (jako u ikonek)
  const before = await page.evaluate(() => window.__pzFns.state.mapLabels.map(l => l.text));
  await page.fill('#mapLabelText', 'Brno'); await page.press('#mapLabelText', 'Enter');
  await page.mouse.click(map.x + map.width * 0.4, map.y + map.height * 0.3); await page.waitForTimeout(300);
  const lab2 = await page.evaluate(() => ({texts: window.__pzFns.state.mapLabels.map(l => l.text), adding: window.__pzFns.state.addingMapLabel}));
  check(lab2.texts.length === before.length + 1 && lab2.texts.slice(0, before.length).join() === before.join() && lab2.adding, 'Enter v poli Text přidá nový popisek, starý nepřepíše, vkládání trvá ' + JSON.stringify(lab2));
  await page.keyboard.press('Escape');
  // perimetr: desetinná čárka v Rádiusu a čistý štítek bez „R “
  await page.evaluate(() => { const s = document.getElementById('scenePerimeterSection'); if(s?.classList.contains('collapsed')) s.querySelector('h3').click(); });
  await page.fill('#scenePerimeterRadius', '2,5');
  const per = await page.evaluate(() => { const c = __tnMap.getCenter(); const it = window.__pzFns.createScenePerimeterAt([c.lng, c.lat], {silent: true}); return {r: it.radiusMeters, tag: [...document.querySelectorAll('.scene-perimeter-label')].pop()?.textContent}; });
  check(per.r === 2500 && per.tag === '2,5 km', 'Rádius „2,5“ = 2,5 km, štítek „2,5 km“ ' + JSON.stringify(per));
  // text štítku napsaný před vložením dostane nový kruh; Enter v Rádiusu bez výběru zahájí vkládání
  await page.evaluate(() => { window.__pzFns.state.selectedScenePerimeterId = null; });
  await page.fill('#scenePerimeterLabel', 'EVAKUACE');
  await page.press('#scenePerimeterRadius', 'Enter');
  const armedP = await page.evaluate(() => window.__pzFns.state.addingScenePerimeter);
  await page.mouse.click(map.x + map.width * 0.35, map.y + map.height * 0.55); await page.waitForTimeout(300);
  const perL = await page.evaluate(() => window.__pzFns.state.scenePerimeters.slice(-1)[0]?.labelText);
  check(armedP && perL === 'EVAKUACE', `Enter v Rádiusu zahájí vkládání a kruh dostane štítek napsaný předem (${armedP}, ${perL})`);
  await page.fill('#scenePerimeterLabel', ''); await page.keyboard.press('Escape');
  // styl pro další popisek nepřebarví právě vložený (jen při úpravě, čip „Upravuješ“)
  await page.evaluate(() => { const s = document.getElementById('mapLabelSection'); if(s?.classList.contains('collapsed')) s.querySelector('h3').click(); });
  await page.selectOption('#mapLabelStyle', 'red');
  await page.fill('#mapLabelText', 'NEHODA'); await page.press('#mapLabelText', 'Enter');
  await page.mouse.click(map.x + map.width * 0.5, map.y + map.height * 0.7); await page.waitForTimeout(300);
  await page.selectOption('#mapLabelStyle', 'navy');
  const stl = await page.evaluate(() => window.__pzFns.state.mapLabels.slice(-1)[0]?.style);
  check(stl === 'red', 'změna stylu pro další popisek nepřebarví právě vložený (' + stl + ')');
  // výchozí vzhled
  await tab(page, 'styly');
  await page.click('#resetStyleBtn'); await page.waitForTimeout(2500);
  const look = await page.evaluate(() => ({base: document.getElementById('baseStyle').value, preset: window.__pzFns.state.activePresetToken}));
  // výchozí preset si redakce může přenastavit (sdílená data) — bez toho je to Modrá přírodní
  check(look.base === 'positron' && /^builtin:/.test(look.preset || ''), 'Výchozí vzhled = Positron + výchozí preset ' + JSON.stringify(look));
  // logo TN = čistý projekt: smaže scénu i vlajky, vrátí se krokem zpět
  await page.evaluate(() => { const F = window.__pzFns; F.addMapLabelAt({lng: 15, lat: 50}, {text: 'X', silent: true}); F.state.pzFlags = [{id: 'f1', iso: 'cz', lngLat: [15, 50]}];
    document.getElementById('projectName').value = 'Starý projekt'; document.activeElement?.blur?.(); });
  const nBefore = await page.evaluate(() => window.__pzFns.state.mapLabels.length);
  await page.click('.brand-icon');
  await page.waitForTimeout(1500);
  const cleaned = await page.evaluate(() => ({labels: window.__pzFns.state.mapLabels.length, flags: (window.__pzFns.state.pzFlags || []).length, name: document.getElementById('projectName').value}));
  check(cleaned.labels === 0 && cleaned.flags === 0 && cleaned.name === '', 'klik na logo TN smaže scénu i projekt ' + JSON.stringify(cleaned));
  check(await page.evaluate(() => [...document.querySelectorAll('.sidebar .tab-pane .section.section-collapsible')].every(s => s.classList.contains('collapsed'))), 'po kliknutí na logo jsou všechny sekce zavřené');
  await page.keyboard.press('Control+z'); await page.waitForTimeout(1500);
  const nUndo = await page.evaluate(() => window.__pzFns.state.mapLabels.length);
  check(nUndo === nBefore, `krok zpět vrátí smazané popisky (${nBefore} → ${nUndo})`);
  // Zapnuté vkládání má přednost: popisek do kruhu perimetru i přes bublinu jiného popisku,
  // režim zůstane zapnutý (každý klik vezme aktuální text), na mapě svítí odznak.
  await tab(page, 'scena');
  await page.evaluate(() => { const s = document.getElementById('mapLabelSection'); if(s?.classList.contains('collapsed')) s.querySelector('h3').click(); });
  const pc = {x: map.x + map.width * 0.35, y: map.y + map.height * 0.4};
  await page.evaluate(p => { const m = window.__tnMap, r = m.getCanvas().getBoundingClientRect(); window.__pzFns.createScenePerimeterAt(m.unproject([p.x - r.x, p.y - r.y]), {radiusMeters: 200000}); }, pc);
  const nl0 = await page.evaluate(() => window.__pzFns.state.mapLabels.length);
  await page.fill('#mapLabelText', 'V KRUHU'); await page.click('#addMapLabelBtn');
  const badge = await page.evaluate(() => document.querySelector('#map .pz-add-badge')?.textContent || '');
  await page.mouse.click(pc.x + 10, pc.y + 10); await page.waitForTimeout(300);
  const bub = await page.evaluate(() => { const r = window.__pzFns.state.mapLabels.at(-1).marker.getElement().querySelector('.map-label-bubble').getBoundingClientRect(); return {x: r.x + r.width / 2, y: r.y + r.height / 2}; });
  await page.fill('#mapLabelText', 'DRUHÝ'); await page.mouse.click(bub.x, bub.y); await page.waitForTimeout(300);
  const ins = await page.evaluate(() => ({n: window.__pzFns.state.mapLabels.length, last: window.__pzFns.state.mapLabels.at(-1)?.text, on: window.__pzFns.state.addingMapLabel, btn: document.getElementById('addMapLabelBtn').textContent}));
  check(ins.n === nl0 + 2 && ins.last === 'DRUHÝ' && ins.on && /Vkládám/.test(badge) && /ukončit/.test(ins.btn), 'vkládání popisků: klik do kruhu i na jiný popisek vloží, režim trvá, odznak ' + JSON.stringify({...ins, badge}));
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  check(await page.evaluate(() => !document.querySelector('#map .pz-add-badge') && !document.getElementById('map').classList.contains('pz-adding')), 'Esc odznak vkládání schová');
  // kroužek hledání nesmí posunout popisek z kotvy (position:relative skládalo značky pod sebe)
  const off = await page.evaluate(() => { const F = window.__pzFns, m = window.__tnMap, c = m.getCenter();
    const pin = document.createElement('div'); pin.className = 'place-search-pin'; new maplibregl.Marker({element: pin, anchor: 'bottom'}).setLngLat([c.lng + 0.2, c.lat]).addTo(m);
    F.addMapLabelAt(c, {text: 'KOTVA', silent: true}); const sq = F.state.mapLabels.at(-1).marker.getElement().querySelector('.map-label-square').getBoundingClientRect();
    const p = m.project(c), r = m.getCanvas().getBoundingClientRect(); return Math.hypot(sq.x + sq.width / 2 - p.x - r.x, sq.y + sq.height / 2 - p.y - r.y); });
  check(off < 2, `popisek leží na kotvě i s kroužkem hledání (odchylka ${off.toFixed(1)} px)`);
  check(!errors.length, 'bez chyb v konzoli ' + errors.join(' | '));
  await close(); done();
})();
