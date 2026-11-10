// Vozidla na trase (sada MINT): barvy karoserie a akcentu, předvolby pro
// podklad, uložení a znovuotevření v projektu, export PNG zakřivené trasy
// s vlakem (vagony) a kamionem (návěs).
const {check, done, open, tab, OUT} = require('./lib');
const path = require('path');
const ROAD = [[14.42,50.08],[14.6,50.0],[14.9,49.8],[15.2,49.65],[15.6,49.43],[16.0,49.3],[16.4,49.2],[16.6,49.19]];
(async () => {
  const {page, ctx, errors, close} = await open();
  await ctx.route(/routing\.openstreetmap\.de|router\.project-osrm\.org/, r => r.fulfill({status:200, contentType:'application/json',
    body: JSON.stringify({code:'Ok', routes:[{geometry:{type:'LineString', coordinates:ROAD}, distance:205000, duration:7500, legs:[]}], waypoints:[]})}));
  await tab(page, 'trasa');
  await page.evaluate(() => { const s = document.getElementById('animationSystemIconsSection'); if(s?.classList.contains('collapsed')) s.querySelector('h3').click(); });
  await page.evaluate(() => window.TNMAP.routeBetween({from:'Praha', to:'Pardubice', mode:'train'}));
  await page.waitForTimeout(1500);
  check(await page.evaluate(() => !document.getElementById('pzVehiclePalette').hidden), 'u vlaku je nabídka barev vozidla');
  check(await page.evaluate(() => /^data:image\/svg\+xml/.test(window.__pzFns.state.animIconData || '')), 'vlak je kreslený z vestavěné SVG sady');
  check(await page.evaluate(() => (window.__tnMap.getSource('pz-souprava')?.serialize?.().data?.features?.length || 0) === 2), 'vlak má 2 vagony');
  // předvolba pro modrý podklad a vlastní barvy
  await page.selectOption('#pzVehiclePreset', 'blue'); await page.waitForTimeout(300);
  check(await page.evaluate(() => document.getElementById('pzVehicleAccent').value.toLowerCase() === '#ffac62'), 'předvolba Pro modrý podklad nastaví akcent');
  await page.evaluate(() => { const b = document.getElementById('pzVehicleBody'); b.value = '#112233'; b.dispatchEvent(new Event('change', {bubbles:true})); });
  await page.waitForTimeout(300);
  check(await page.$eval('#pzVehiclePreset', e => e.value) === 'custom', 'vlastní barva přepne na Vlastní barvy');
  check(await page.evaluate(() => decodeURIComponent(window.__pzFns.state.animIconData).includes('#112233')), 'karoserie má zvolenou barvu');
  // uložení a znovuotevření projektu
  const snap = await page.evaluate(() => JSON.parse(JSON.stringify(window.__pzFns.serializeProjectSnapshot())));
  check(snap.animation?.vehiclePalette?.body === '#112233' && snap.animation.vehiclePalette.accent === '#ffac62', 'barvy se ukládají do projektu (animation.vehiclePalette)');
  await page.selectOption('#pzVehiclePreset', 'light'); await page.waitForTimeout(200);
  await page.evaluate(s => window.__pzFns.applyProjectSnapshot(s, 'test'), snap); await page.waitForTimeout(1500);
  check(await page.evaluate(() => document.getElementById('pzVehicleBody').value === '#112233' && document.getElementById('pzVehiclePreset').value === 'custom'), 'po znovuotevření projektu jsou barvy zpět');
  // u auta nabídka barev vozidla zmizí, zůstává odstín a inverze
  await page.evaluate(() => window.TNMAP.routeBetween({from:'Praha', to:'Brno', mode:'driving'})); await page.waitForTimeout(1200);
  check(await page.evaluate(() => document.getElementById('pzVehiclePalette').hidden && document.getElementById('animIconTintWrap').style.display !== 'none'), 'u auta je místo palety odstín ikonky');
  // export zakřivené trasy: kamion s návěsem a vlak s vagony
  await page.evaluate(() => window.TNMAP.routeBetween({from:'Praha', to:'Brno', mode:'truck'})); await page.waitForTimeout(1500);
  check(await page.evaluate(() => (window.__tnMap.getSource('pz-souprava')?.serialize?.().data?.features?.length || 0) === 1), 'kamion má návěs');
  await page.evaluate(() => window.__pzFns.setAnimProgress(0.5));
  await tab(page, 'export');
  for(const name of ['vehicles_truck.png', 'vehicles_train.png']){
    if(name.includes('train')){ await tab(page, 'trasa'); await page.evaluate(() => window.TNMAP.routeBetween({from:'Praha', to:'Pardubice', mode:'train'})); await page.waitForTimeout(1500); await page.evaluate(() => window.__pzFns.setAnimProgress(0.5)); await tab(page, 'export'); }
    const dl = page.waitForEvent('download', {timeout: 120000}).catch(() => null);
    await page.evaluate(() => document.getElementById('exportPngBtn').click());
    const d = await dl; check(!!d, 'export PNG ' + name);
    if(d) await d.saveAs(path.join(OUT, name));
  }
  check(errors.length === 0, 'žádná chyba stránky' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await close(); done();
})();
