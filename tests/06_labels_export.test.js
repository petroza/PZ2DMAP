// Styly popisků (Nova) na mapě i v exportu PNG; křížek se do exportu nekreslí.
const {check, done, open, tab, openSection, OUT} = require('./lib');
const path = require('path');
(async () => {
  const {page, errors, close} = await open();
  await page.evaluate(() => window.TNMAP.gotoPlace({query:'Brno'})); await page.waitForTimeout(2500);
  await tab(page, 'scena'); await openSection(page, 'mapLabelSection');
  const add = async (style, text, dx, dy) => { await page.fill('#mapLabelText', text); await page.click('#addMapLabelBtn'); await page.mouse.click(1000 + dx, 470 + dy);
    await page.waitForTimeout(500); await page.keyboard.press('Escape'); await page.selectOption('#mapLabelStyle', style); await page.waitForTimeout(200); };
  await add('classic', 'KLASIK', -250, -150); await add('navy', 'NOVA', 150, -150); await add('red', 'ŽIVĚ', -250, 120); await add('dark', 'ČERNÝ', 150, 120);
  const styles = await page.$$eval('.maplibregl-marker.map-label-marker', e => e.map(x => x.dataset.lstyle).join(','));
  check(styles === 'classic,navy,red,dark', 'styly popisků: ' + styles);
  const bg = await page.$$eval('.map-label-bubble', e => e.map(x => getComputedStyle(x).backgroundColor));
  check(bg[1] === 'rgb(13, 23, 103)' && bg[2] === 'rgb(240, 59, 59)', 'barvy Nova modrá a červená');
  await tab(page, 'export');
  const dl = page.waitForEvent('download', {timeout: 120000}).catch(() => null);
  await page.evaluate(() => document.getElementById('exportPngBtn').click());
  const d = await dl; check(!!d, 'export PNG proběhl');
  if(d) await d.saveAs(path.join(OUT, 'labels_export.png'));
  check(errors.length === 0, 'žádná chyba stránky');
  await close(); done();
})();
