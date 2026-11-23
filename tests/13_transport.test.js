// Druhy dopravy: vlak po železnici (nádraží), loď po řece, kamion s návěsem, uzavírky.
const {check, done, open} = require('./lib');
const ROAD = [[14.42,50.08],[14.6,50.0],[14.9,49.8],[15.2,49.65],[15.6,49.43],[16.0,49.3],[16.4,49.2],[16.6,49.19]];
(async () => {
  const {page, ctx, errors, close} = await open();
  // veřejný OSRM bývá nedostupný — podvržená silniční trasa
  // Krátký dotaz (uzavírka) = čára přes zadané body, dlouhý = ROAD.
  await ctx.route(/routing\.openstreetmap\.de|router\.project-osrm\.org/, r => {
    const pts = (decodeURIComponent(new URL(r.request().url()).pathname).match(/-?\d+\.\d+,-?\d+\.\d+/g) || []).map(s => s.split(',').map(Number));
    const near = pts.length > 1 && pts.every(p => Math.abs(p[0] - pts[0][0]) < 0.6 && Math.abs(p[1] - pts[0][1]) < 0.6);
    return r.fulfill({status:200, contentType:'application/json',
      body: JSON.stringify({code:'Ok', routes:[{geometry:{type:'LineString', coordinates: near ? pts : ROAD}, distance:205000, duration:7500, legs:[]}], waypoints:[]})});
  });
  const route = (from, to, mode) => page.evaluate(a => window.TNMAP.routeBetween(a), {from, to, mode});
  let r = await route('Praha', 'Ostrava', 'train');
  check(r.ok && r.distanceKm > 300 && /nádraží/i.test((r.stations || []).join(' ')), `vlak Praha–Ostrava ${r.distanceKm} km, ${JSON.stringify(r.stations)}`);
  await page.waitForTimeout(1500);
  // na startu vyjíždí z bodu A (díly za ním schovává maska) — kontrola uprostřed jízdy
  check(await page.evaluate(() => { window.__pzFns.setAnimProgress(0.5); return (window.__pzFns.pzVehicleParts(window.__pzFns.state._pzVehVp).filter(q => !q.lead && !q.hidden).map(q => ({geometry:{coordinates:q.c}, properties:{rot:q.rot}}))).length >= 2; }), 'vlak má vagony');
  r = await route('Praha', 'Mělník', 'boat'); check(r.ok && r.distanceKm > 25, `loď Praha–Mělník ${r.distanceKm} km`);
  r = await route('Praha', 'Brno', 'truck'); await page.waitForTimeout(1500);
  check(r.ok && await page.evaluate(() => { window.__pzFns.setAnimProgress(0.5); return (window.__pzFns.pzVehicleParts(window.__pzFns.state._pzVehVp).filter(q => !q.lead && !q.hidden).map(q => ({geometry:{coordinates:q.c}, properties:{rot:q.rot}}))).length === 1; }), 'kamion má návěs');
  r = await page.evaluate(() => window.TNMAP.metroClosure({line:'C', from:'Florenc', to:'Pražského povstání'}));
  check(r.ok && r.stations?.length === 6, 'výluka metra C Florenc–Pražského povstání (6 stanic)');
  r = await page.evaluate(() => window.TNMAP.roadClosure({from:'Humpolec', to:'Větrný Jeníkov'}));
  check(r.ok, 'uzavírka silnice');
  check(await page.$$eval('#pzClosureList .wp-item', e => e.length) === 2, 'v seznamu 2 uzavírky');
  // přestupní stanice uvnitř výluky mají název
  const lbl = await page.evaluate(() => (window.__pzFns.state.map.getSource('pz-closures')?.serialize?.().data?.features || []).filter(f => f.properties.kind === 'label').map(f => f.properties.text));
  check(lbl.includes('Muzeum') && lbl.includes('Hlavní nádraží'), 'výluka pojmenuje přestupní stanice: ' + lbl.join(', '));
  // místa se hledají v okolí: „Ruda" u Velkého Meziříčí, ne Ruda Śląska v Polsku
  await page.evaluate(() => window.__pzFns.state.map.jumpTo({center:[16.05, 49.35], zoom:10}));
  r = await page.evaluate(() => window.TNMAP.roadClosure({from:'Velké Meziříčí', to:'Velká Bíteš', detourVia:'Ruda'}));
  const det = await page.evaluate(() => window.__pzFns.state.pzClosures.slice(-1)[0]?.detour || []);
  check(r.ok && det.length && det.every(p => p[0] > 15.7 && p[0] < 16.5 && p[1] > 49.1 && p[1] < 49.6), 'objížďka přes Rudu zůstane u Velkého Meziříčí');
  // úprava: ✎ vrátí hodnoty do formuláře, Uložit změny přepíše stávající uzavírku
  await page.click('.tab-btn[data-tab="scena"]');
  await page.evaluate(() => { const s = document.getElementById('pzClosureSection'); if(s?.classList.contains('collapsed')) s.querySelector('h3').click(); s.scrollIntoView(); });
  await page.click('#pzClosureList .wp-item:last-child button:has-text("✎")');
  check(await page.$eval('#pzClDetour', e => e.value) === 'Ruda' && /Uložit/.test(await page.$eval('#pzClRoadBtn', e => e.textContent)), 'úprava uzavírky naplní formulář');
  await page.fill('#pzClLabel', 'Zavřeno'); await page.click('#pzClRoadBtn');
  await page.waitForFunction(() => !document.getElementById('pzClRoadBtn').disabled && /Vyznačit/.test(document.getElementById('pzClRoadBtn').textContent), null, {timeout:60000});
  const cls = await page.evaluate(() => window.__pzFns.state.pzClosures.map(c => c.label));
  check(cls.length === 3 && cls[2] === 'ZAVŘENO', 'Uložit změny přepíše uzavírku (' + cls.join(', ') + ')');
  check(errors.length === 0, 'žádná chyba stránky');
  await close(); done();
})();
