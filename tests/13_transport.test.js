// Druhy dopravy: vlak po železnici (nádraží), loď po řece, kamion s návěsem, uzavírky.
const {check, done, open} = require('./lib');
const ROAD = [[14.42,50.08],[14.6,50.0],[14.9,49.8],[15.2,49.65],[15.6,49.43],[16.0,49.3],[16.4,49.2],[16.6,49.19]];
(async () => {
  const {page, ctx, errors, close} = await open();
  // veřejný OSRM bývá nedostupný — podvržená silniční trasa
  await ctx.route(/routing\.openstreetmap\.de|router\.project-osrm\.org/, r => r.fulfill({status:200, contentType:'application/json',
    body: JSON.stringify({code:'Ok', routes:[{geometry:{type:'LineString', coordinates:ROAD}, distance:205000, duration:7500, legs:[]}], waypoints:[]})}));
  const route = (from, to, mode) => page.evaluate(a => window.TNMAP.routeBetween(a), {from, to, mode});
  let r = await route('Praha', 'Ostrava', 'train');
  check(r.ok && r.distanceKm > 300 && /nádraží/i.test((r.stations || []).join(' ')), `vlak Praha–Ostrava ${r.distanceKm} km, ${JSON.stringify(r.stations)}`);
  await page.waitForTimeout(1500);
  // na startu vyjíždí z bodu A (díly za ním schovává maska) — kontrola uprostřed jízdy
  check(await page.evaluate(() => { window.__pzFns.setAnimProgress(0.5); return (window.__tnMap.getSource('pz-souprava')?.serialize?.().data?.features?.length || 0) >= 2; }), 'vlak má vagony');
  r = await route('Praha', 'Mělník', 'boat'); check(r.ok && r.distanceKm > 25, `loď Praha–Mělník ${r.distanceKm} km`);
  r = await route('Praha', 'Brno', 'truck'); await page.waitForTimeout(1500);
  check(r.ok && await page.evaluate(() => { window.__pzFns.setAnimProgress(0.5); return (window.__tnMap.getSource('pz-souprava')?.serialize?.().data?.features?.length || 0) === 1; }), 'kamion má návěs');
  r = await page.evaluate(() => window.TNMAP.metroClosure({line:'C', from:'Florenc', to:'Pražského povstání'}));
  check(r.ok && r.stations?.length === 6, 'výluka metra C Florenc–Pražského povstání (6 stanic)');
  r = await page.evaluate(() => window.TNMAP.roadClosure({from:'Humpolec', to:'Větrný Jeníkov'}));
  check(r.ok, 'uzavírka silnice');
  check(await page.$$eval('#pzClosureList .wp-item', e => e.length) === 2, 'v seznamu 2 uzavírky');
  check(errors.length === 0, 'žádná chyba stránky');
  await close(); done();
})();
