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
  // přetažení dlaždice do mapy: vloží se na místo puštění, bez hledání
  const before = await cnt();
  const drag = async (sel, tx, ty) => {
    const b = await (await page.$(sel)).boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down();
    for(let i = 1; i <= 12; i++){ await page.mouse.move(b.x + (tx - b.x) * i / 12, b.y + (ty - b.y) * i / 12); await page.waitForTimeout(15); }
    await page.mouse.up(); await page.waitForTimeout(800);
  };
  await drag('.pz-tpl-btn[data-tpl="vybuch"]', 1000, 450);
  c = await cnt(); check(c.i === before.i + 1 && c.l === before.l + 1 && c.p === before.p + 1, 'přetažení Výbuchu do mapy vloží ikonku, popisek i perimetr');
  const centers = await page.$$eval('.maplibregl-marker.scene-icon-marker', els => els.map(e => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }));
  check(centers.some(([x, y]) => Math.abs(x - 1000) < 4 && Math.abs(y - 450) < 4), 'ikonka leží přesně na místě puštění');
  await drag('.pz-tpl-btn[data-tpl="nehoda"]', 250, 500);
  check((await cnt()).i === c.i, 'puštění nad panelem nic nevloží');
  await page.keyboard.press('Control+z'); await page.waitForTimeout(1500);
  c = await cnt(); check(c.i === before.i && c.p === before.p, 'Ctrl+Z vrátí přetaženou šablonu');
  check(errors.length === 0, 'žádná chyba stránky');
  await close(); done();
})();
