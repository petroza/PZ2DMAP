// Styl a mapové vrstvy: preset se použije a označí, přepnutí podkladu zachová scénu,
// na rastru zmizí volby bez účinku, obarvený stát je v seznamu i v exportu PNG,
// uzavírka přežije přepnutí podkladu a krok zpět. OSRM je podvržený, místa souřadnicemi.
const {check, done, open, tab, openSection, status, OUT} = require('./lib');
const path = require('path');
const fs = require('fs');
const ROAD = [[15.36,49.54],[15.42,49.50],[15.5,49.46],[15.59,49.40]];
(async () => {
  const {page, ctx, errors, close} = await open();
  await ctx.route(/routing\.openstreetmap\.de|router\.project-osrm\.org/, r => r.fulfill({status:200, contentType:'application/json',
    body: JSON.stringify({code:'Ok', routes:[{geometry:{type:'LineString', coordinates:ROAD}, distance:25000, duration:1500, legs:[]}], waypoints:[]})}));
  const waitStyle = async () => { for(let i = 0; i < 90; i++){ await page.waitForTimeout(400);
    if(await page.evaluate(() => window.__tnMap.isStyleLoaded()) && !/Načítám/.test(await status(page))) return true; } return false; };
  const scene = () => page.evaluate(() => { const m = window.__tnMap, s = window.__pzFns.state;
    return {c: m.getCenter().toArray().map(x => +x.toFixed(3)).join(','), z: +m.getZoom().toFixed(1), route: (s.routeCoords || []).length,
      labels: s.mapLabels.length, closures: (s.pzClosures || []).length, clLayer: !!m.getLayer('pzuz-usek'),
      clData: (m.getSource('pz-closures')?.serialize?.().data?.features || []).length,
      de: s.countryColorMap.DE || '', fill: !!m.getLayer('pz-political-fill') && m.getLayoutProperty('pz-political-fill', 'visibility') !== 'none'}; });
  const vis = sel => page.evaluate(sel => { const e = document.querySelector(sel); return !!e && e.getClientRects().length > 0; }, sel);

  // --- presety: použití, označení, značka „upraveno", výchozí vzhled, krok zpět
  await tab(page, 'styly');
  check(await vis('#presetTileGrid .preset-card'), 'dlaždice presetů jsou vidět hned po otevření Stylu');
  check(!(await page.$('#reloadStyleBtn')), 'zbytečné tlačítko „Načíst styl" je pryč');
  const tiles = await page.$$eval('#presetTileGrid .preset-card', e => e.map(x => ({n: x.querySelector('.preset-card-number')?.textContent, name: x.querySelector('.preset-card-name')?.textContent.trim(),
    sw: x.querySelectorAll('.pz-preset-swatch i').length, fs: parseFloat(getComputedStyle(x.querySelector('.preset-card-name')).fontSize)})));
  check(tiles.length >= 3 && tiles.every(x => x.n && x.name && x.sw === 5 && x.fs >= 10), `dlaždice mají číslo, název (≥10 px) a náhled barev (${tiles.length})`);
  const waterBefore = await page.$eval('#waterColor', e => e.value);
  await page.click('#presetTileGrid .preset-card:nth-child(2)');
  await page.waitForFunction(() => /Preset/.test(document.getElementById('statusBar').textContent), null, {timeout: 8000}).catch(() => {});
  check(await page.$eval('#presetTileGrid .preset-card:nth-child(2)', e => e.classList.contains('active') && e.getAttribute('aria-pressed') === 'true')
    && await page.$$eval('#presetTileGrid .preset-card.active', e => e.length) === 1, 'klik na dlaždici preset použije a označí jen ji');
  const waterPreset = await page.$eval('#waterColor', e => e.value);
  check(waterPreset !== waterBefore && /Preset/.test(await status(page)), 'preset změnil barvy mapy a stavový řádek to hlásí');
  check(!(await page.$eval('#presetTileGrid .preset-card.active', e => e.classList.contains('is-modified'))), 'čerstvě použitý preset není „upraveno"');
  await openSection(page, 'styleLayersSection');
  // změna barvy vody přes viditelný vzorek v řádku vrstvy
  await page.$eval('.layer-color-input[data-sync-color="waterColor"]', e => { e.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true})); e.value = '#ff00aa'; e.dispatchEvent(new Event('input', {bubbles:true})); });
  await page.waitForTimeout(500);
  check(await page.$eval('#presetTileGrid .preset-card.active', e => e.classList.contains('is-modified') && getComputedStyle(e.querySelector('.pz-preset-mod')).display !== 'none'),
    'po ruční změně barvy je aktivní dlaždice označená „upraveno"');
  check(await page.evaluate(() => { const m = window.__tnMap; const l = m.getStyle().layers.find(l => l.type === 'fill' && /water/.test(l.id)); return l && m.getPaintProperty(l.id, 'fill-color') === '#ff00aa'; }),
    'barva vody se projevila v mapě');
  await page.click('#undoActionBtn'); await page.waitForTimeout(900);
  check(await page.$eval('#waterColor', e => e.value) === waterPreset, 'krok zpět vrátí změnu barvy');
  // tloušťka dálnic: posuvník → krok zpět (dřív se nevracela)
  await page.$eval('#motorwayWidth', e => { e.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true})); e.value = '3'; e.dispatchEvent(new Event('input', {bubbles:true})); });
  await page.waitForTimeout(300);
  await page.click('#undoActionBtn'); await page.waitForTimeout(900);
  check(await page.$eval('#motorwayWidth', e => e.value) === '1', 'krok zpět vrátí i tloušťku dálnic');
  await page.click('#resetStyleBtn'); await page.waitForTimeout(500);
  await page.waitForTimeout(1500);
  // výchozí vzhled = Positron + Modrá přírodní (dlaždice s hvězdičkou)
  check(await page.evaluate(() => window.__pzFns.state.activePresetToken === 'builtin:modraPrirodni' && document.getElementById('baseStyle').value === 'positron'
    && !!document.querySelector('#presetTileGrid .preset-card.active:not(.is-modified)')), '„Výchozí vzhled" vrátí výchozí preset');

  // --- scéna: popisek, trasa, uzavírky přes formulář, stát přes hledání
  const built = await page.evaluate(async () => { const T = window.TNMAP;
    return {route: (await T.routeBetween({from:'49.54, 15.36', to:'49.40, 15.59', mode:'driving'})).ok, label: (await T.addLabel({place:'49.50, 15.42', text:'NEHODA'})).ok}; });
  check(built.route && built.label, 'trasa a popisek připraveny');
  await tab(page, 'scena'); await openSection(page, 'pzClosureSection');
  await page.click('#pzClRoadBtn'); await page.waitForTimeout(300);
  check(/Od a Do/.test(await status(page)), 'prázdný formulář uzavírky řekne, co vyplnit');
  await page.fill('#pzClFrom', '49.54, 15.36'); await page.fill('#pzClTo', '49.40, 15.59');
  await page.click('#pzClRoadBtn');
  await page.waitForFunction(() => (window.__pzFns.state.pzClosures || []).length === 1, null, {timeout: 20000}).catch(() => {});
  await page.click('#pzClosureSection [data-cl-tab="metro"]');
  check(await vis('#pzClMetroBtn') && !(await vis('#pzClRoadBtn')), 'přepínač Silnice/Metro ukazuje jen jeden formulář');
  await page.selectOption('#pzClMetroLine', 'C'); await page.selectOption('#pzClMetroFrom', 'Florenc'); await page.selectOption('#pzClMetroTo', 'Vyšehrad');
  await page.click('#pzClMetroBtn');
  await page.waitForFunction(() => (window.__pzFns.state.pzClosures || []).length === 2, null, {timeout: 20000}).catch(() => {});
  check(await page.$$eval('#pzClosureList .wp-item', e => e.length) === 2 && await vis('#pzClClearBtn'), 'v seznamu 2 uzavírky a tlačítko Smazat vše');
  await page.evaluate(() => window.__tnMap.jumpTo({center:[15.47, 49.47], zoom: 9.5})); await page.waitForTimeout(800);

  await openSection(page, 'countryBordersOverlaySection');
  await page.waitForFunction(() => (document.getElementById('politicalCountrySelect')?.options.length || 0) > 50, null, {timeout: 90000}).catch(() => {});
  await page.fill('#politicalCountryColor', '#3366ff');
  await page.fill('#politicalCountrySearch', 'Germany');
  await page.waitForSelector('#politicalCountrySearchSuggest .nav-suggest-item', {timeout: 8000}).catch(() => {});
  check(await page.$$eval('#politicalCountrySearchSuggest .nav-suggest-item', e => e.length && e[0].textContent.includes('Německo')), 'hledání státu anglicky nabídne Německo');
  await page.keyboard.press('Enter'); await page.waitForTimeout(1500);
  let s = await scene();
  check(s.de === '#3366ff' && s.fill, 'Enter v hledání stát rovnou obarví');
  check(await page.$$eval('#pzCountryColorList .wp-item', e => e.length === 1 && e[0].textContent.includes('Německo') && e[0].querySelector('input[type=color]').value === '#3366ff'),
    'obarvený stát je v seznamu s barvou a křížkem');
  await page.fill('#politicalCountrySearch', 'Rakousko'); await page.click('#applyPoliticalCountryColorBtn'); await page.waitForTimeout(800);
  check(await page.$$eval('#pzCountryColorList .wp-item', e => e.length) === 2, 'tlačítko Obarvit přidá druhý stát (česky)');
  await page.check('#showCountryBordersOverlay'); await page.waitForTimeout(600);
  check(await page.$eval('#countryBorderColor', e => e.value) === '#1a2a44', 'hranice států na světlé mapě dostanou tmavou barvu (bílá nebyla vidět)');
  await page.click('#pzCountryColorList .wp-item[data-country="AT"] .btn-remove'); await page.waitForTimeout(500);
  check(await page.evaluate(() => !window.__pzFns.state.countryColorMap.AT && !!window.__pzFns.state.countryColorMap.DE), 'křížek zruší jen ten jeden stát');
  await page.click('#undoActionBtn'); await page.waitForTimeout(1500);
  check(await page.evaluate(() => !!window.__pzFns.state.countryColorMap.AT), 'krok zpět barvu státu vrátí');
  await page.click('#pzCountryColorList .wp-item[data-country="AT"] .btn-remove'); await page.waitForTimeout(400);
  await page.evaluate(() => window.__tnMap.jumpTo({center:[15.47, 49.47], zoom: 9.5})); await page.waitForTimeout(800);

  // --- přepínání podkladů zachová scénu; na rastru zmizí volby bez účinku
  const before = await scene();
  check(before.route > 1 && before.labels === 1 && before.closures === 2 && before.de, 'scéna před přepnutím: ' + JSON.stringify(before));
  await tab(page, 'styly');
  await page.selectOption('#baseStyle', 'satellite');
  check(await waitStyle(), 'satelit se načetl (stav se vrátil z „Načítám…")');
  await page.waitForTimeout(1200);
  s = await scene();
  check(JSON.stringify(s) === JSON.stringify(Object.assign({}, before, {clData: s.clData})) && s.clLayer && s.clData > 0, 'satelit: pohled, trasa, popisek, uzavírky i obarvený stát zůstaly');
  check(!(await vis('#stylePresetSection')), 'satelit: presety barev schované');
  check(await page.$eval('#countryBorderColor', e => e.value) === '#ffffff', 'satelit: hranice států bíle');
  const rows = await page.$$eval('#styleLayersSection .layer-visibility-row', e => e.filter(x => x.getClientRects().length > 0 || !x.hidden).filter(x => !x.hidden).map(x => x.querySelector('input[id]')?.id || 'land'));
  check(rows.join(',') === 'showMetro,showTransit', 'satelit: ve Vrstvách zbyly jen volby s účinkem (' + rows.join(',') + ')');
  for(let i = 0; i < 5; i++){ await page.selectOption('#baseStyle', i % 2 ? 'satellite' : 'positron'); await page.waitForTimeout(150); }
  check(await waitStyle(), 'rychlé přepínání 5× skončí načteným podkladem');
  await page.waitForTimeout(1500);
  s = await scene();
  check(await page.$eval('#baseStyle', e => e.value) === 'positron' && s.closures === 2 && s.clLayer && s.clData > 0 && s.de && s.fill && s.labels === 1 && s.c === before.c,
    'po rychlém přepínání je scéna celá: ' + JSON.stringify(s));
  check(await vis('#stylePresetSection') && await page.$$eval('#styleLayersSection .layer-visibility-row', e => e.filter(x => !x.hidden).length) >= 12, 'Positron: presety i vrstvy jsou zpět');

  // --- uzavírka a krok zpět
  await tab(page, 'scena'); await openSection(page, 'pzClosureSection');
  await page.click('#pzClosureList .wp-item:first-child .btn-remove'); await page.waitForTimeout(500);
  check((await scene()).closures === 1, 'křížek smaže jednu uzavírku');
  await page.click('#undoActionBtn'); await page.waitForTimeout(1500);
  s = await scene();
  check(s.closures === 2 && s.clData > 0 && await page.$$eval('#pzClosureList .wp-item', e => e.length) === 2, 'krok zpět uzavírku vrátí (mapa i seznam)');
  await page.click('#pzClClearBtn'); await page.waitForTimeout(400);
  check((await scene()).closures === 0 && !(await vis('#pzClClearBtn')), 'Smazat vše smaže všechny uzavírky');
  await page.click('#undoActionBtn'); await page.waitForTimeout(1500);
  check((await scene()).closures === 2, 'krok zpět vrátí i smazání všech');

  // --- obarvený stát je v exportu PNG
  await page.evaluate(() => window.__tnMap.jumpTo({center:[10.3, 51.2], zoom: 5.2})); await page.waitForTimeout(2500);
  await tab(page, 'export');
  const dl = page.waitForEvent('download', {timeout: 120000}).catch(() => null);
  await page.evaluate(() => document.getElementById('exportPngBtn').click());
  const d = await dl; check(!!d, 'export PNG proběhl');
  if(d){
    const file = path.join(OUT, 'style_layers_export.png'); await d.saveAs(file);
    const b64 = fs.readFileSync(file).toString('base64');
    const px = await page.evaluate(async b64 => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const at = (fx, fy) => [...g.getImageData(Math.round(img.width * fx), Math.round(img.height * fy), 1, 1).data];
      return {mid: at(0.5, 0.5), mid2: at(0.47, 0.42), w: img.width}; }, b64);
    check(px.mid[2] - px.mid[0] > 40 && px.mid2[2] - px.mid2[0] > 40, 've vyexportovaném PNG je Německo modré ' + JSON.stringify(px));
  }

  check(errors.length === 0, 'žádná chyba stránky' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await close(); done();
})();
