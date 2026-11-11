// Vozidla na trase (sada „vozidla v2“ — realistické obrázky shora):
// kloubové soupravy (kamion, vlak, metro, tramvaj) se v zatáčkách lámou a nikdy
// nerozpojí, počet vagonů u vlaku, majáky záchranných složek blikají jen za
// jízdy, barvy (karoserie + akcent) u kreslených vozidel (letadlo), uložení do
// projektu a export PNG zakřivené trasy s vlakem i kamionem.
const {check, done, open, tab, OUT} = require('./lib');
const path = require('path');
const ROAD = [[14.42,50.08],[14.5,50.06],[14.55,50.02],[14.52,49.98],[14.6,49.95],[14.75,49.96],[14.8,49.9],[14.95,49.88],[15.0,49.8],[15.2,49.65],[15.25,49.62],[15.22,49.58],[15.3,49.55],[15.6,49.43],[16.0,49.3],[16.4,49.2],[16.6,49.19]];
(async () => {
  const {page, ctx, errors, close} = await open();
  await ctx.route(/routing\.openstreetmap\.de|router\.project-osrm\.org/, r => r.fulfill({status:200, contentType:'application/json',
    body: JSON.stringify({code:'Ok', routes:[{geometry:{type:'LineString', coordinates:ROAD}, distance:205000, duration:7500, legs:[]}], waypoints:[]})}));
  await tab(page, 'trasa');
  await page.evaluate(() => { const s = document.getElementById('animationSystemIconsSection'); if(s?.classList.contains('collapsed')) s.querySelector('h3').click(); });
  await page.evaluate(() => window.TNMAP.routeBetween({from:'50.08,14.42', to:'49.19,16.6', mode:'driving'}));
  await page.waitForTimeout(1500);
  await page.waitForFunction(() => Object.keys(window.__pzFns.PZ_SPRITE_GEO).length >= 10, null, {timeout: 20000}).catch(() => {});
  check(await page.evaluate(() => Object.keys(window.__pzFns.PZ_SPRITE_GEO).length) >= 10, 'načteno všech 10 obrázků vozidel');
  const pick = t => page.click(`.sys-icon-btn[data-sys-icon="${t}"]`).then(() => page.waitForTimeout(600));

  // mezera ve spojích podél celé trasy (v násobcích velikosti vedoucího dílu)
  const gaps = () => page.evaluate(() => {
    const m = window.__tnMap, F = window.__pzFns, st = F.state, out = {max:0, missing:0, masked:0};
    const dir = deg => [Math.sin(deg * Math.PI / 180), -Math.cos(deg * Math.PI / 180)];
    for(let k = 0; k <= 40; k++){
      const p = k / 40; F.setAnimProgress(p);
      const spec = F.pzConsistSpec(), f = m.getSource('pz-souprava')?.serialize?.().data?.features || [];
      // na startu vyjíždí souprava z bodu A — díly za ním schovává maska
      const rp = F.pzRailPose(st._pzConsistLast), shown = rp ? rp.length - 1 : spec?.units.length;   // _pzConsistLast = průběh po easingu
      if(!spec || f.length !== shown){ out.missing++; continue; }
      if(shown < spec.units.length) out.masked++;
      const size = parseFloat(st.animatedMarkerEl.style.width);
      let prev = {c: m.project(st.animatedMarker.getLngLat()), rot: (F.pzLeadHeading ? F.pzLeadHeading(p) : F.pzAutoHeading(st.routeCoords, p)), back: spec.rear};
      f.forEach((x, i) => {
        const u = spec.units[i], c = m.project(x.geometry.coordinates), da = dir(prev.rot), db = dir(x.properties.rot);
        const g = Math.hypot((prev.c.x - da[0] * prev.back * size) - (c.x + db[0] * u.front * size), (prev.c.y - da[1] * prev.back * size) - (c.y + db[1] * u.front * size)) / size;
        out.max = Math.max(out.max, g); prev = {c, rot: x.properties.rot, back: u.back};
      });
    }
    return out;
  });
  for(const [t, n] of [['truck', 1], ['metro', 2], ['tram', 2], ['train', 2]]){
    await pick(t);
    const units = await page.evaluate(() => window.__pzFns.pzConsistSpec()?.units.length || 0);
    const g = await gaps();
    check(units === n && g.missing === 0 && g.max < 0.03, `${t}: ${units} vlečených dílů, žádné rozpojení (největší mezera ${g.max.toFixed(3)}, chybí ${g.missing}, maska ${g.masked})`);
  }
  // vlak: počet vagonů
  await page.evaluate(() => { const e = document.getElementById('pzWagonCount'); e.value = '5'; e.dispatchEvent(new Event('input', {bubbles:true})); });
  const g5 = await gaps();
  check(await page.evaluate(() => window.__pzFns.pzConsistSpec().units.length) === 5 && g5.missing === 0 && g5.max < 0.03, `vlak s 5 vagony drží pohromadě (${g5.max.toFixed(3)})`);
  check(await page.evaluate(() => document.getElementById('pzVehiclePalette').hidden && !document.getElementById('pzWagonRow').hidden), 'u vlaku z obrázku je počet vagonů, barvy ne');
  await page.evaluate(() => { const e = document.getElementById('pzWagonCount'); e.value = '2'; e.dispatchEvent(new Event('input', {bubbles:true})); });

  // majáky: blikají jen za jízdy, střídavě
  await pick('fire');
  const flash = await page.evaluate(() => { const F = window.__pzFns, el = () => F.state.animatedMarkerEl, out = [];
    for(const [t, p] of [[0.1, 0.4], [0.3, 0.4], [0, 0], [0.1, 1]]){ F.state.animElapsed = t; F.setAnimProgress(p); out.push((el().classList.contains('pz-flash-a') ? 'a' : '') + (el().classList.contains('pz-flash-b') ? 'b' : '') || '-'); }
    return {seq: out.join(','), n: el().querySelectorAll('.pz-beacon').length}; });
  check(flash.n === 2 && flash.seq === 'a,b,-,-', 'hasiči: 2 majáky, za jízdy střídavě blikají, v klidu ne (' + flash.seq + ')');
  await pick('ambulance');
  check(await page.evaluate(() => window.__pzFns.state.animatedMarkerEl.querySelectorAll('.pz-beacon').length) === 4, 'sanitka má 4 majáky');
  await pick('police');
  check(await page.evaluate(() => window.__pzFns.state.animatedMarkerEl.querySelectorAll('.pz-beacon').length) === 2, 'policie má majáky');
  await pick('car');
  check(await page.evaluate(() => window.__pzFns.state.animatedMarkerEl.querySelectorAll('.pz-beacon').length) === 0, 'auto majáky nemá');

  // barvy jen u kreslených vozidel (letadlo): předvolby, vlastní, uložení
  await pick('plane');
  check(await page.evaluate(() => !document.getElementById('pzVehiclePalette').hidden), 'u letadla je nabídka barvy ikonky');
  await page.selectOption('#pzVehiclePreset', 'blue'); await page.waitForTimeout(300);
  check(await page.evaluate(() => document.getElementById('pzVehicleAccent').value.toLowerCase() === '#ffac62'), 'předvolba Pro modrý podklad nastaví akcent');
  await page.evaluate(() => { const b = document.getElementById('pzVehicleBody'); b.value = '#112233'; b.dispatchEvent(new Event('change', {bubbles:true})); });
  await page.waitForTimeout(300);
  check(await page.$eval('#pzVehiclePreset', e => e.value) === 'custom', 'vlastní barva přepne na Vlastní barvy');
  check(await page.evaluate(() => decodeURIComponent(window.__pzFns.state.animIconData).includes('#112233')), 'karoserie má zvolenou barvu');
  const snap = await page.evaluate(() => JSON.parse(JSON.stringify(window.__pzFns.serializeProjectSnapshot())));
  check(snap.animation?.vehiclePalette?.body === '#112233' && snap.animation.vehiclePalette.auto === false && snap.animation.wagonCount === 2 && snap.animation.animSystemIcon === 'plane', 'ikona, barvy a počet vagonů se ukládají do projektu');
  await page.selectOption('#pzVehiclePreset', 'light'); await pick('bus');
  await page.evaluate(s => window.__pzFns.applyProjectSnapshot(s, 'test'), snap); await page.waitForTimeout(1500);
  check(await page.evaluate(() => window.__pzFns.state.animSystemIcon === 'plane' && document.getElementById('pzVehicleBody').value === '#112233' && document.getElementById('pzVehiclePreset').value === 'custom'), 'po znovuotevření projektu je ikona i barva zpět');

  // export zakřivené trasy: kamion a vlak
  await tab(page, 'export');
  for(const t of ['truck', 'train']){
    await tab(page, 'trasa'); await pick(t); await page.evaluate(() => window.__pzFns.setAnimProgress(0.5)); await tab(page, 'export');
    const dl = page.waitForEvent('download', {timeout: 120000}).catch(() => null);
    await page.evaluate(() => document.getElementById('exportPngBtn').click());
    const d = await dl; check(!!d, 'export PNG ' + t);
    if(d) await d.saveAs(path.join(OUT, 'vehicles_' + t + '.png'));
  }
  check(errors.length === 0, 'žádná chyba stránky' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await close(); done();
})();
