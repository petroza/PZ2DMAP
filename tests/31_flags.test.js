// Politická mapa: vlajky klikem do státu (Delete smaže), barva státu paletou u
// kurzoru, uložení vlajek do projektu.
const {check, done, open, tab} = require('./lib');
(async () => {
  const {page, errors, close} = await open();
  await tab(page, 'styly');
  await page.evaluate(() => { const s = document.getElementById('baseStyle'); s.value = 'political'; s.dispatchEvent(new Event('change', {bubbles:true})); });
  await page.waitForTimeout(6000);
  await page.evaluate(() => window.__tnMap.jumpTo({center: [17, 50], zoom: 4}));
  await page.waitForTimeout(2500);
  check(await page.isVisible('#pzFlagsOn') && await page.isVisible('#pzClickPaintOn'), 'volby Vlajky a Barvit kliknutím jsou v Podkladu u politické mapy');
  const px = ll => page.evaluate(ll => { const q = window.__tnMap.project(ll), r = document.getElementById('map').getBoundingClientRect(); return {x: q.x + r.left, y: q.y + r.top}; }, ll);
  // barva paletou
  let p = await px([19.4, 52.1]); await page.mouse.click(p.x, p.y); await page.waitForTimeout(500);
  await page.click('.pz-country-pop button[data-c="#3a86ff"]'); await page.waitForTimeout(500);
  check(await page.evaluate(() => window.__pzFns.state.countryColorMap.PL === '#3a86ff'), 'klik na Polsko → paleta → modrá');
  // vlajky
  await page.check('#pzFlagsOn');
  p = await px([15.3, 49.8]); await page.mouse.click(p.x, p.y); await page.waitForTimeout(1500);
  p = await px([10.4, 51.0]); await page.mouse.click(p.x, p.y); await page.waitForTimeout(1500);
  let fl = await page.evaluate(() => window.__pzFns.pzFlagList().map(f => f.iso).join(','));
  check(fl === 'cz,de', 'klik do Česka a Německa přidá jejich vlajky (' + fl + ')');
  p = await px([15.3, 49.8]); await page.mouse.click(p.x, p.y); await page.waitForTimeout(500);
  await page.keyboard.press('Delete'); await page.waitForTimeout(500);
  fl = await page.evaluate(() => window.__pzFns.pzFlagList().map(f => f.iso).join(','));
  check(fl === 'de', 'klik na vlajku + Delete ji smaže (' + fl + ')');
  // přesun tažením
  const before = await page.evaluate(() => window.__pzFns.pzFlagList()[0].lngLat);
  p = await px(before); await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(p.x + 60, p.y + 40, {steps: 8}); await page.mouse.up(); await page.waitForTimeout(500);
  const after = await page.evaluate(() => window.__pzFns.pzFlagList()[0].lngLat);
  const n = await page.evaluate(() => window.__pzFns.pzFlagList().length);
  check(n === 1 && after[0] > before[0] + 0.5 && after[1] < before[1] - 0.3, 'vlajku jde přetáhnout jinam (' + before.map(v => v.toFixed(2)) + ' → ' + after.map(v => v.toFixed(2)) + ', vlajek ' + n + ')');
  const snap = await page.evaluate(() => window.__pzFns.serializeProjectSnapshot().countryFlags);
  check(Array.isArray(snap) && snap.length === 1 && snap[0].iso === 'de', 'vlajky se ukládají do projektu');
  await page.keyboard.press('Control+z'); await page.waitForTimeout(1500);   // vrátí přesun
  await page.keyboard.press('Control+z'); await page.waitForTimeout(1500);   // vrátí smazání
  fl = await page.evaluate(() => window.__pzFns.pzFlagList().map(f => f.iso).sort().join(','));
  check(fl === 'cz,de', 'krok zpět vrátí smazanou vlajku (' + fl + ')');
  // popisky států: klik do Rakouska → popisek „Rakousko" v boxu jako ostatní popisky
  await page.check('#pzCountryLabelsOn');
  check(!(await page.isChecked('#pzFlagsOn')), 'popisky států vypnou vkládání vlajek');
  p = await px([14.5, 47.5]); await page.mouse.click(p.x, p.y); await page.waitForTimeout(600);
  const lab = await page.evaluate(() => { const l = window.__pzFns.state.mapLabels.at(-1), el = l && l.marker.getElement(); return l && {text: l.text, box: !!el.querySelector('.map-label-bubble'), square: getComputedStyle(el.querySelector('.map-label-square')).display}; });
  check(lab && lab.text === 'Rakousko' && lab.box && lab.square === 'none', 'klik do státu přidá popisek s jeho názvem, bez červeného čtverečku ' + JSON.stringify(lab));
  const saved = await page.evaluate(() => window.__pzFns.serializeProjectSnapshot().mapLabels?.at?.(-1)?.side);
  check(saved === 'none', 'popisek bez čtverečku se tak i uloží (' + saved + ')');
  check(!errors.length, 'bez chyb v konzoli ' + errors.join(' | '));
  await close(); done();
})();
