// Rychlá scéna: šablona vloží ikonku, popisek (a perimetr) naráz, jeden krok zpět.
const {check, done, open, status, tab} = require('./lib');
(async () => {
  const {page, errors, close} = await open();
  await tab(page, 'scena');
  const cnt = () => page.evaluate(() => ({i: document.querySelectorAll('#sceneIconList .wp-item').length,
    l: document.querySelectorAll('.maplibregl-marker.map-label-marker').length, p: document.querySelectorAll('#scenePerimeterList .wp-item').length}));
  const run = async (place, tpl) => { await page.evaluate(() => { document.getElementById('statusBar').textContent = ''; });
    await page.fill('#pzTplPlace', place); await page.click(`.pz-tpl-btn[data-tpl="${tpl}"]`);
    await page.waitForFunction(() => /Scéna připravena|nenalezeno/.test(document.getElementById('statusBar').textContent), null, {timeout: 25000}).catch(() => {});
    await page.waitForTimeout(1200); };
  check(await page.$$eval('.pz-tpl-btn', e => e.length) === 8, '8 šablon');
  await run('Humpolec', 'nehoda');
  check(/Scéna připravena: Nehoda/.test(await status(page)), 'šablona Nehoda hotová');
  let c = await cnt(); check(c.i === 1 && c.l === 1 && c.p === 0, 'nehoda: 1 ikonka + 1 popisek');
  check(await page.$eval('.map-label-bubble', e => e.textContent) === 'NEHODA', 'text popisku NEHODA');
  await run('Brno', 'vybuch');
  c = await cnt(); check(c.i === 2 && c.l === 2 && c.p === 1, 'výbuch přidá i perimetr');
  await page.keyboard.press('Control+z'); await page.waitForTimeout(1500);
  c = await cnt(); check(c.i === 1 && c.l === 1 && c.p === 0, 'jeden Ctrl+Z vrátí celou šablonu');
  await page.fill('#pzTplPlace', ''); await page.click('.pz-tpl-btn[data-tpl="pozar"]'); await page.waitForTimeout(400);
  check(/Nejdřív napiš místo/.test(await status(page)), 'prázdné místo → upozornění');
  check(errors.length === 0, 'žádná chyba stránky');
  await close(); done();
})();
