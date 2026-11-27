// Politická mapa: vlajky klikem do státu (Delete smaže), barva státu paletou u
// kurzoru, uložení vlajek do projektu.
const {check, done, open, tab, openSection} = require('./lib');
(async () => {
  const {page, errors, close} = await open();
  await tab(page, 'styly');
  await page.evaluate(() => { const s = document.getElementById('baseStyle'); s.value = 'political'; s.dispatchEvent(new Event('change', {bubbles:true})); });
  await page.waitForTimeout(6000);
  await page.evaluate(() => window.__tnMap.jumpTo({center: [17, 50], zoom: 4}));
  await page.waitForTimeout(2500);
  check(await page.isVisible('#pzClickPaintOn'), 'volba Barvit kliknutím je v Podkladu u politické mapy');
  const px = ll => page.evaluate(ll => { const q = window.__tnMap.project(ll), r = document.getElementById('map').getBoundingClientRect(); return {x: q.x + r.left, y: q.y + r.top}; }, ll);
  // barva paletou
  let p = await px([19.4, 52.1]); await page.mouse.click(p.x, p.y); await page.waitForTimeout(500);
  await page.click('.pz-country-pop button[data-c="#3a86ff"]'); await page.waitForTimeout(500);
  check(await page.evaluate(() => window.__pzFns.state.countryColorMap.PL === '#3a86ff'), 'klik na Polsko → paleta → modrá');
  // vlajky: Scéna > Státy (na každém podkladu)
  await tab(page, 'scena'); await openSection(page, 'countryBordersOverlaySection'); await page.waitForTimeout(400);
  check(await page.isVisible('#pzFlagsOn') && await page.isVisible('#pzCountryLabelsOn'), 'Vlajky a Popisky států jsou ve Scéna > Státy');
  await page.check('#pzFlagsOn');
  p = await px([15.3, 49.8]); await page.mouse.click(p.x, p.y); await page.waitForTimeout(1500);
  p = await px([10.4, 51.0]); await page.mouse.click(p.x, p.y); await page.waitForTimeout(1500);
  let fl = await page.evaluate(() => window.__pzFns.pzFlagList().map(f => f.iso).join(','));
  check(fl === 'cz,de', 'klik do Česka a Německa přidá jejich vlajky (' + fl + ')');
  check((await page.textContent('#pzFlagList')).includes('Německo'), 'vlajky jsou v seznamu ve Scéna > Státy');
  p = await px([15.3, 49.8]); await page.mouse.click(p.x, p.y); await page.waitForTimeout(500);
  await page.keyboard.press('Delete'); await page.waitForTimeout(500);
  fl = await page.evaluate(() => window.__pzFns.pzFlagList().map(f => f.iso).join(','));
  check(fl === 'de', 'klik na vlajku + Delete ji smaže (' + fl + ')');
  // přesun tažením
  const before = await page.evaluate(() => window.__pzFns.pzFlagList()[0].lngLat);
  p = await px(before); await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(p.x + 60, p.y + 40, {steps: 8}); await page.mouse.up(); await page.waitForTimeout(500);
  const after = await page.evaluate(() => window.__pzFns.pzFlagList()[0].lngLat);
  const n = await page.evaluate(() => window.__pzFns.pzFlagList().length);
  check(n === 1 && after[0] > before[0] + 0.5 && after[1] < before[1] - 0.3, 'vlajku jde přetáhnout jinam (' + before.map(v => v.toFixed(2)) + ' → ' + after.map(v => v.toFixed(2)) + ', vlajek ' + n + ')');
  const snap = await page.evaluate(() => window.__pzFns.serializeProjectSnapshot().countryFlags);
  check(Array.isArray(snap) && snap.length === 1 && snap[0].iso === 'de', 'vlajky se ukládají do projektu');
  await page.keyboard.press('Control+z'); await page.waitForTimeout(1500);   // vrátí přesun
  await page.keyboard.press('Control+z'); await page.waitForTimeout(1500);   // vrátí smazání
  fl = await page.evaluate(() => window.__pzFns.pzFlagList().map(f => f.iso).sort().join(','));
  check(fl === 'cz,de', 'krok zpět vrátí smazanou vlajku (' + fl + ')');
  // popisky států: klik do Rakouska → popisek „Rakousko" v boxu jako ostatní popisky
  await page.check('#pzCountryLabelsOn');
  check(!(await page.isChecked('#pzFlagsOn')), 'popisky států vypnou vkládání vlajek');
  p = await px([14.5, 47.5]); await page.mouse.click(p.x, p.y); await page.waitForTimeout(600);
  const lab = await page.evaluate(() => { const l = window.__pzFns.state.mapLabels.at(-1), el = l && l.marker.getElement(); return l && {text: l.text, box: !!el.querySelector('.map-label-bubble'), square: getComputedStyle(el.querySelector('.map-label-square')).display}; });
  check(lab && lab.text === 'Rakousko' && lab.box && lab.square === 'none', 'klik do státu přidá popisek s jeho názvem, bez červeného čtverečku ' + JSON.stringify(lab));
  const saved = await page.evaluate(() => window.__pzFns.serializeProjectSnapshot().mapLabels?.at?.(-1)?.side);
  check(saved === 'none', 'popisek bez čtverečku se tak i uloží (' + saved + ')');
  // oddálení: popisek se zmenší, ale ne pod čitelných 14 px; přiblížení ho nezvětší
  const fs = () => page.evaluate(() => parseFloat(getComputedStyle(window.__pzFns.state.mapLabels.at(-1).marker.getElement().querySelector('.map-label-bubble')).fontSize));
  const f0 = await fs();
  await page.evaluate(() => window.__tnMap.jumpTo({zoom: 3})); await page.waitForTimeout(400);
  const f1 = await fs();
  await page.evaluate(() => window.__tnMap.jumpTo({zoom: 0.5})); await page.waitForTimeout(400);
  const f2 = await fs();
  await page.evaluate(() => window.__tnMap.jumpTo({zoom: 7})); await page.waitForTimeout(400);
  const f3 = await fs();
  check(f1 < f0 && f2 >= 13.9 && f2 <= f1 && Math.abs(f3 - f0) < 0.5, `popisek se při oddálení zmenší, ale zůstane čitelný (${f0} → ${f1} → ${f2}, přiblížení ${f3})`);
  check(await page.evaluate(() => window.__pzFns.serializeProjectSnapshot().mapLabels.at(-1).baseZoom) === 4, 'přiblížení popisku se uloží do projektu');
  // klik na vlajku s vypnutým „Vlajky států" ho zapne a vlajku vybere
  await page.evaluate(() => window.__tnMap.jumpTo({center: [17, 50], zoom: 4})); await page.waitForTimeout(800);
  await page.uncheck('#pzCountryLabelsOn');
  check(!(await page.isChecked('#pzFlagsOn')), 'vlajky jsou vypnuté');
  const fp = await page.evaluate(() => window.__pzFns.pzFlagList().find(f => f.iso === 'de').lngLat);
  p = await px(fp); await page.mouse.click(p.x, p.y); await page.waitForTimeout(600);
  const selIso = await page.evaluate(() => { const s = window.__pzFns.state; return (s.pzFlagSel && window.__pzFns.pzFlagList().find(f => f.id === s.pzFlagSel)?.iso) || null; });
  check(await page.isChecked('#pzFlagsOn') && selIso === 'de', 'klik na vlajku zapne Vlajky států a vybere ji (' + selIso + ')');
  // vlajka do čitelného místa uvnitř státu (Rusko u Moskvy, ne na Sibiři)
  await page.evaluate(() => window.TNMAP.placeFlag({country: 'Rusko'})); await page.waitForTimeout(500);
  const ru = await page.evaluate(() => window.__pzFns.pzFlagList().find(f => f.iso === 'ru')?.lngLat);
  check(ru && ru[0] < 45, 'vlajka Ruska u Moskvy (' + ru + ')');
  // názvy států: Řecko ≠ Grenada, Británie ≠ Abyei, pády, chybějící Kosovo
  const col = await page.evaluate(async () => { const o = {}; for(const c of ['Řecko', 'Velká Británie', 'Ukrajinu', 'USA', 'Kosovo']){ const r = await window.TNMAP.colorPolitical({country: c, fit: false}); o[c] = r.ok ? r.painted[0].id : 'ERR:' + r.error; } return o; });
  check(col['Řecko'] === 'EL' && col['Velká Británie'] === 'UK' && col['Ukrajinu'] === 'UA' && col['USA'] === 'US' && /v datech hranic není/.test(col['Kosovo']), 'obarvení států podle českých názvů ' + JSON.stringify(col));
  const sug = await page.evaluate(() => ['USA', 'Británie', 'Ukrajinu'].map(q => window.__pzFns.getCountrySearchItems(q)[0]?.id).join(','));
  check(sug === 'US,UK,UA', 'našeptávač států: USA, Británie, Ukrajinu (' + sug + ')');
  // metro: běžné zápisy a hovorové názvy
  const mt = await page.evaluate(async () => [(await window.TNMAP.metroClosure({station: 'IP Pavlova', fit: false})).ok, (await window.TNMAP.metroClosure({station: 'Hlavák', fit: false})).ok, (await window.TNMAP.metroClosure({})).error]);
  check(mt[0] && mt[1] && /Chybí station/.test(mt[2]), 'metro: IP Pavlova, Hlavák a srozumitelná chyba bez stanice ' + JSON.stringify(mt));
  check(!errors.length, 'bez chyb v konzoli ' + errors.join(' | '));
  await close(); done();
})();
