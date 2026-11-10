// Vyhledávání: Hledat skočí na místo (našeptávač ho nepřebije) a při výpadku
// Nominatimu se použije záloha Photon.
const {check, done, open, routeWrites} = require('./lib');
(async () => {
  let {page, errors, close} = await open();
  for(const [q, lng] of [['Brno', 16.6], ['Ostrava', 18.3]]){
    await page.fill('#placeSearchInput', q); await page.click('#placeSearchBtn'); await page.waitForTimeout(3500);
    const c = await page.evaluate(() => window.__tnMap.getCenter().lng);
    const open_ = await page.evaluate(() => !document.getElementById('placeSearchResults').hidden);
    check(Math.abs(c - lng) < 0.6 && !open_, `Hledat „${q}" skočí na místo a seznam zůstane zavřený`);
  }
  await page.fill('#placeSearchInput', 'Jihlava'); await page.waitForSelector('#placeSearchResults .place-search-item', {timeout: 15000}).catch(() => {});
  check(await page.$$eval('#placeSearchResults .place-search-item', e => e.length) > 0, 'našeptávač při psaní nabídne místa');
  await close();
  for(const mode of ['empty', '503']){
    const o = await open({wait: 1}); // nový prohlížeč s rozbitým Nominatimem
    await o.ctx.route(/nominatim\.openstreetmap\.org\/search/, r => mode === 'empty' ? r.fulfill({status:200, contentType:'application/json', body:'[]'}) : r.fulfill({status:503, body:'busy'}));
    await o.page.reload({waitUntil:'load'}); await o.page.waitForTimeout(5000);
    const g = await o.page.evaluate(() => window.TNMAP.gotoPlace({query:'Humpolec'}));
    check(g.ok && /Humpolec/.test(g.found), `Nominatim ${mode}: záloha Photon najde Humpolec`);
    check(o.errors.length === 0, `Nominatim ${mode}: žádná chyba stránky`);
    await o.close();
  }
  check(errors.length === 0, 'žádná chyba stránky');
  done();
})();
