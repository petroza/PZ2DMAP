// Paleta vestavěných ikonek (Scéna → Ikonky): klik vybere ikonu a zapne
// vkládání, klik do mapy ji vloží; přetažení ikony z palety do mapy ji vloží
// na místo puštění; puštění mimo mapu nic nevloží; Ctrl+Z vrátí.
const {check, done, open, tab, openSection} = require('./lib');
(async () => {
  const {page, errors, close} = await open();
  await tab(page, 'scena'); await openSection(page, 'sceneIconSection');
  const ICONS = '#sceneIconList .wp-item';
  const n = () => page.$$eval(ICONS, e => e.length);
  check(await page.$$eval('#pzIconPalette .pz-icon-pick', e => e.length) >= 8, 'paleta vestavěných ikon je v sekci');
  // klik na ikonu + klik do mapy
  await page.click('#pzIconPalette .pz-icon-pick[data-kind="vybuch"]');
  await page.mouse.click(1000, 450); await page.waitForTimeout(500);
  check(await n() === 1, 'výběr ikony a klik do mapy vloží ikonku');
  await page.keyboard.press('Escape');
  // přetažení do mapy
  const drag = async (sel, tx, ty) => {
    const b = await (await page.$(sel)).boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down();
    for(let i = 1; i <= 12; i++){ await page.mouse.move(b.x + (tx - b.x) * i / 12, b.y + (ty - b.y) * i / 12); await page.waitForTimeout(15); }
    await page.mouse.up(); await page.waitForTimeout(800);
  };
  await drag('#pzIconPalette .pz-icon-pick[data-kind="pozar"]', 1200, 600);
  check(await n() === 2, 'přetažení ikony z palety do mapy ji vloží');
  const centers = await page.$$eval('.maplibregl-marker.scene-icon-marker', els => els.map(e => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }));
  check(centers.some(([x, y]) => Math.abs(x - 1200) < 4 && Math.abs(y - 600) < 4), 'ikonka leží přesně na místě puštění');
  await drag('#pzIconPalette .pz-icon-pick[data-kind="nehoda"]', 200, 500);
  check(await n() === 2, 'puštění nad panelem nic nevloží');
  await page.keyboard.press('Control+z'); await page.waitForTimeout(1500);
  check(await n() === 1, 'Ctrl+Z vrátí přetaženou ikonku');
  check(errors.length === 0, 'žádná chyba stránky' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await close(); done();
})();
