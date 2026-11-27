// Vícenásobný výběr grafiky: Ctrl+klik, Alt+tažení (obdélník), Ctrl+A,
// Delete smaže vybrané, tažení posune celou skupinu, Esc zruší, Ctrl+Z vrátí.
// Přetažení dlaždice Rychlé scény do mapy je v 05_templates.
const {check, done, open, status, shot} = require('./lib');
(async () => {
  const {page, errors, close} = await open();
  const ICON = '.maplibregl-marker.scene-icon-marker', LABEL = '.maplibregl-marker.map-label-marker';
  const n = sel => page.$$eval(sel, e => e.length);
  const multi = () => page.$$eval('.pz-multi', e => e.length);
  const center = async (sel, i) => { const b = await (await page.$$(sel))[i].boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
  // tři ikonky a jeden popisek kolem Brna
  await page.evaluate(async () => {
    const T = window.TNMAP; await T.gotoPlace({query:'Brno'});
  });
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const m = window.__tnMap, c = m.getCenter();
    window.__pzFns.state.sceneIconData = null;
  });
  await page.evaluate(async () => {
    const T = window.TNMAP;
    await T.placeIcon({place:'Brno', kind:'policie'});
    await T.placeIcon({place:'Brno-Líšeň', kind:'pozar'});
    await T.placeIcon({place:'Brno-Bystrc', kind:'nehoda'});
    await T.addLabel({place:'Brno-Žabovřesky', text:'TEST'});
  });
  await page.waitForTimeout(1500);
  check(await n(ICON) === 3 && await n(LABEL) === 1, 'připraveny 3 ikonky a popisek');
  // Ctrl+klik na dvě ikonky (nejdřív klik do mapy zruší výběr naposledy vložené)
  await page.mouse.click(1500, 880); await page.waitForTimeout(300);
  const a = await center(ICON, 0), b = await center(ICON, 1), c3 = await center(ICON, 2);
  await page.keyboard.down('Control');
  await page.mouse.click(a[0], a[1]); await page.mouse.click(b[0], b[1]);
  await page.keyboard.up('Control');
  await page.waitForTimeout(300);
  check(await multi() === 2, 'Ctrl+klik vybere 2 ikonky (' + await multi() + ')');
  check(/Vybráno 2/.test(await status(page)), 'stav hlásí Vybráno 2');
  // tažení jedné z vybraných posune obě, třetí zůstane
  await page.mouse.move(a[0], a[1]); await page.mouse.down();
  for(let i = 1; i <= 10; i++){ await page.mouse.move(a[0] + i * 8, a[1] + i * 5); await page.waitForTimeout(20); }
  await page.mouse.up(); await page.waitForTimeout(500);
  const a2 = await center(ICON, 0), b2 = await center(ICON, 1), c32 = await center(ICON, 2);
  check(Math.abs(a2[0] - a[0] - 80) < 6 && Math.abs(b2[0] - b[0] - 80) < 6, `skupina se posunula spolu (${Math.round(a2[0]-a[0])}, ${Math.round(b2[0]-b[0])})`);
  check(Math.abs(c32[0] - c3[0]) < 2, 'nevybraná ikonka zůstala');
  // Ctrl+Z vrátí posun skupiny
  await page.keyboard.press('Control+z'); await page.waitForTimeout(1500);
  const a3 = await center(ICON, 0); check(Math.abs(a3[0] - a[0]) < 6, 'Ctrl+Z vrátí posun skupiny');
  // Esc zruší výběr, Ctrl+A vybere vše, Delete smaže vše
  await page.keyboard.press('Escape');
  check(await multi() === 0, 'Esc zruší výběr');
  await page.mouse.click(1000, 700); await page.keyboard.press('Control+a'); await page.waitForTimeout(200);
  check(await multi() === 4, 'Ctrl+A vybere všechny 4');
  await page.keyboard.press('Delete'); await page.waitForTimeout(400);
  check(await n(ICON) === 0 && await n(LABEL) === 0, 'Delete smaže všechno vybrané');
  await page.keyboard.press('Control+z'); await page.waitForTimeout(1500);
  check(await n(ICON) === 3 && await n(LABEL) === 1, 'Ctrl+Z vrátí smazané');
  // Alt+tažení: obdélník kolem prvních dvou ikonek
  const p = [await center(ICON, 0), await center(ICON, 1), await center(ICON, 2)];
  const box = [Math.min(...p.map(q => q[0])), Math.min(...p.map(q => q[1])), Math.max(...p.map(q => q[0])), Math.max(...p.map(q => q[1]))];
  await page.keyboard.down('Alt');
  await page.mouse.move(box[0] - 30, box[1] - 30); await page.mouse.down();
  await page.mouse.move((box[0] + box[2]) / 2, (box[1] + box[3]) / 2, {steps: 5});
  await page.mouse.move(box[2] + 30, box[3] + 30, {steps: 5});
  await page.mouse.up(); await page.keyboard.up('Alt'); await page.waitForTimeout(300);
  check(await multi() >= 3, 'Alt+tažení vybere ikonky v obdélníku (' + await multi() + ')');
  // klik do prázdné mapy výběr zruší
  await page.mouse.click(1500, 880); await page.waitForTimeout(400);
  check(await multi() === 0, 'klik do mapy výběr zruší');
  await shot(page, 'multiselect.png');
  check(errors.length === 0, 'žádná chyba stránky' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await close(); done();
})();
