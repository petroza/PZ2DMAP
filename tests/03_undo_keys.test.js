// Krok zpět / vpřed a klávesové zkratky (Delete, Ctrl+D, tažení, popisek).
const {check, done, open, status} = require('./lib');
(async () => {
  const {page, errors, close} = await open();
  const n = sel => page.$$eval(sel, e => e.length);
  const ICONS = '#sceneIconList .wp-item', LABELS = '.maplibregl-marker.map-label-marker';
  await page.evaluate(() => window.TNMAP.gotoPlace({query:'Brno'})); await page.waitForTimeout(2500);
  await page.evaluate(() => window.TNMAP.placeIcon({place:'Brno', kind:'policie'})); await page.waitForTimeout(800);
  await page.click('.tab-btn[data-tab="trasa"]');
  const ib = await (await page.$('.maplibregl-marker.scene-icon-marker')).boundingBox();
  await page.mouse.click(ib.x + ib.width / 2, ib.y + ib.height / 2); await page.waitForTimeout(300);
  check(/Ikonka vybrána/.test(await status(page)), 'klik na ikonku ji vybere');
  await page.keyboard.press('Control+d'); await page.waitForTimeout(300);
  check(await n(ICONS) === 2, 'Ctrl+D duplikuje ikonku');
  await page.keyboard.press('Delete'); await page.waitForTimeout(300);
  check(await n(ICONS) === 1, 'Delete smaže vybranou ikonku');
  await page.keyboard.press('Control+z'); await page.waitForTimeout(1500);
  check(await n(ICONS) === 2, 'Ctrl+Z vrátí smazanou ikonku');
  check(/Krok zpět/.test(await status(page)), 'stav hlásí „Krok zpět."');
  await page.keyboard.press('Control+y'); await page.waitForTimeout(1500);
  check(await n(ICONS) === 1, 'Ctrl+Y zopakuje smazání');
  // popisek: tažení + křížek + krok zpět
  await page.evaluate(() => window.TNMAP.addLabel({place:'Brno', text:'TEST'})); await page.waitForTimeout(800);
  const pos = async () => { const r = await (await page.$(LABELS + ' .map-label-bubble')).boundingBox(); return [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)]; };
  const a = await pos();
  await page.mouse.move(a[0], a[1]); await page.mouse.down();
  for(let i = 1; i <= 10; i++){ await page.mouse.move(a[0] + i * 15, a[1] + i * 8); await page.waitForTimeout(20); }
  await page.mouse.up(); await page.waitForTimeout(400);
  const moved = await pos(); check(moved[0] - a[0] > 80, 'popisek jde přetáhnout');
  await page.keyboard.press('Control+z'); await page.waitForTimeout(1500);
  const back = await pos(); check(Math.abs(back[0] - a[0]) < 3, 'Ctrl+Z vrátí přesun popisku');
  const bb = await (await page.$(LABELS + ' .map-label-bubble')).boundingBox();
  await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.waitForTimeout(400);
  const x = await (await page.$('.map-label-del')).boundingBox();
  await page.mouse.click(x.x + x.width / 2, x.y + x.height / 2); await page.waitForTimeout(500);
  check(await n(LABELS) === 0, 'křížek smaže popisek');
  await page.mouse.click(300, 700); await page.keyboard.press('Control+z'); await page.waitForTimeout(1500);
  check(await n(LABELS) === 1, 'Ctrl+Z vrátí smazaný popisek');
  // asistentův nástroj undo před nalezením trasy odstraní trasu celou
  const r = await page.evaluate(async () => { window.__pzPushUndo(); await window.TNMAP.routeBetween({from:'Praha', to:'Londýn', mode:'planeDirect'}); await new Promise(r => setTimeout(r, 1200)); window.TNMAP.undo(); await new Promise(r => setTimeout(r, 1500));
    return {marker: document.querySelectorAll('.animated-marker').length, a: document.getElementById('startInput').value}; });
  check(r.marker === 0 && r.a === '', 'krok zpět po nové trase odstraní objekt i text pole A');
  check(errors.length === 0, 'žádná chyba stránky' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await close(); done();
})();
