// Pohodlí ve scéně: velikost popisku tažením za levý horní roh, ukončení
// vkládání klikem jinam v menu (posun mapy pak nepřidává další popisky) a
// výchozí vzhled po „Výchozí vzhled" = Positron + Modrá přírodní.
const {check, done, open, tab} = require('./lib');
(async () => {
  const {page, errors, close} = await open();
  await tab(page, 'scena');
  await page.evaluate(() => { const s = document.getElementById('mapLabelSection'); if(s?.classList.contains('collapsed')) s.querySelector('h3').click(); });
  // vkládání popisků zapnout, dva popisky klikem do mapy
  await page.click('#addMapLabelBtn');
  const map = await (await page.$('#map')).boundingBox();
  await page.mouse.click(map.x + map.width * 0.55, map.y + map.height * 0.45); await page.waitForTimeout(300);
  await page.keyboard.press('Escape').catch(() => {});
  await page.click('#addMapLabelBtn').catch(() => {});
  const armed = await page.evaluate(() => window.__pzFns.state.addingMapLabel);
  // klik jinam v menu (sekce Ikonky) → vkládání se vypne
  await page.click('.tab-btn[data-tab="trasa"]'); await page.waitForTimeout(200);
  const after = await page.evaluate(() => window.__pzFns.state.addingMapLabel);
  const n0 = await page.evaluate(() => window.__pzFns.state.mapLabels.length);
  await page.mouse.click(map.x + map.width * 0.7, map.y + map.height * 0.6); await page.waitForTimeout(300);
  const n1 = await page.evaluate(() => window.__pzFns.state.mapLabels.length);
  check(armed && !after && n1 === n0, `klik jinam v menu ukončí vkládání (zapnuto ${armed}, po kliku ${after}, popisků ${n0} → ${n1})`);
  // velikost za levý horní roh
  await tab(page, 'scena');
  const lab = await page.evaluate(() => { const it = window.__pzFns.state.mapLabels[0]; return {id: it.id, size: it.size}; });
  await page.evaluate(id => { const it = window.__pzFns.state.mapLabels.find(l => l.id === id); it.marker.getElement().classList.add('selected'); }, lab.id);
  const h = await page.evaluate(id => { const el = window.__pzFns.state.mapLabels.find(l => l.id === id).marker.getElement().querySelector('.map-label-resize'); const r = el.getBoundingClientRect(); return {x: r.x + r.width / 2, y: r.y + r.height / 2, vis: getComputedStyle(el).display !== 'none'}; }, lab.id);
  await page.mouse.move(h.x, h.y); await page.mouse.down(); await page.mouse.move(h.x - 40, h.y - 25, {steps: 6}); await page.mouse.up(); await page.waitForTimeout(200);
  const big = await page.evaluate(id => window.__pzFns.state.mapLabels.find(l => l.id === id).size, lab.id);
  check(h.vis && big > lab.size + 4, `tažení za levý horní roh zvětší popisek (${lab.size} → ${big} px)`);
  // výchozí vzhled
  await tab(page, 'styly');
  await page.click('#resetStyleBtn'); await page.waitForTimeout(2500);
  const look = await page.evaluate(() => ({base: document.getElementById('baseStyle').value, preset: window.__pzFns.state.activePresetToken}));
  check(look.base === 'positron' && look.preset === 'builtin:modraPrirodni', 'Výchozí vzhled = Positron + Modrá přírodní ' + JSON.stringify(look));
  check(!errors.length, 'bez chyb v konzoli ' + errors.join(' | '));
  await close(); done();
})();
