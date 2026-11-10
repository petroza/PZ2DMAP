// Rozvržení: na telefonu, tabletu i notebooku se přehrávač, stav, asistent ani
// zdroj mapy nepřekrývají; na telefonu jsou všechny záložky v jednom řádku.
const {check, done, open} = require('./lib');
async function overlaps(page){
  return page.evaluate(() => {
    const sel = {player:'.floating-player .player-controls', status:'#statusBar', actions:'.map-actions', fab:'.tnchat-fab', zoom:'.maplibregl-ctrl-top-right .maplibregl-ctrl', wm:'.map-source-watermark', menu:'#mobileMenuBtn'};
    const b = {}; for(const [k, s] of Object.entries(sel)){ const e = document.querySelector(s); if(e && e.offsetParent !== null){ const r = e.getBoundingClientRect(); if(r.width) b[k] = [r.left, r.top, r.right, r.bottom]; } }
    const ks = Object.keys(b), ov = [];
    for(let i = 0; i < ks.length; i++) for(let j = i + 1; j < ks.length; j++){ const a = b[ks[i]], c = b[ks[j]];
      if(Math.min(a[2], c[2]) - Math.max(a[0], c[0]) > 2 && Math.min(a[3], c[3]) - Math.max(a[1], c[1]) > 2) ov.push(ks[i] + '×' + ks[j]); }
    const off = Object.entries(b).filter(([k, r]) => r[0] < -1 || r[1] < -1 || r[2] > innerWidth + 1 || r[3] > innerHeight + 1).map(([k]) => k);
    return {ov, off}; });
}
(async () => {
  for(const dev of ['iPhone SE', 'iPhone 13', 'Pixel 7', 'iPad Mini']){
    const {page, close} = await open({device: dev});
    await page.evaluate(() => window.TNMAP.routeBetween({from:'Praha', to:'Brno', mode:'planeArc'})); await page.waitForTimeout(2000);
    const r = await overlaps(page);
    check(!r.ov.length && !r.off.length, `${dev}: bez překryvů a mimo obrazovku` + (r.ov.length || r.off.length ? ' — ' + r.ov.concat(r.off).join(', ') : ''));
    if(/iPhone|Pixel/.test(dev)){
      await page.tap('#mobileMenuBtn'); await page.waitForTimeout(600);
      const w = await page.$$eval('.tab-btn', bs => bs.map(b => b.getBoundingClientRect().right));
      const vw = await page.evaluate(() => innerWidth);
      check(w.length === 6 && Math.max(...w) <= vw, `${dev}: všech 6 záložek v řádku`);
      await page.tap('#mobileCloseBtn'); await page.waitForTimeout(500);
      check(await page.evaluate(() => !document.body.classList.contains('mobile-panel-open')), `${dev}: menu jde zavřít`);
    }
    await close();
  }
  for(const [w, h] of [[1280, 720], [1366, 768], [1920, 1080]]){
    const {page, close} = await open({viewport:{width:w, height:h}});
    await page.evaluate(() => window.TNMAP.routeBetween({from:'Praha', to:'Londýn', mode:'planeArc'})); await page.waitForTimeout(2500);
    await page.click('.tnchat-fab'); await page.waitForTimeout(300);
    const r = await overlaps(page);
    check(!r.ov.length, `${w}×${h}: bez překryvů` + (r.ov.length ? ' — ' + r.ov.join(', ') : ''));
    await close();
  }
  done();
})();
