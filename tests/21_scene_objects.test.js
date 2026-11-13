// Objekty scény jako v grafickém editoru: vícenásobný výběr i pro šipky, perimetry
// a vzdálenosti (Ctrl+klik, Alt+obdélník, Ctrl+A), společný posun tažením i šipkami
// na klávesnici, Ctrl+C/V skupiny, zarovnání, Delete — a všechno jde vrátit Ctrl+Z.
const {check, done, open, status, shot} = require('./lib');
(async () => {
  const {page, errors, close} = await open();
  const seen = [];   // všechny stavové hlášky během testu (kontrola nedosazeného {0})
  const st = async () => { const s = await status(page); seen.push(s); return s; };
  // stav scény v pixelech mapy
  const S = () => page.evaluate(() => { const s = __pzFns.state, m = __tnMap; const P = ll => { const p = m.project(ll); return [Math.round(p.x), Math.round(p.y)]; };
    return {multi: [...s.multiSel].map(k => k[0]).sort().join(''), icons: s.sceneIcons.map(i => P(i.marker.getLngLat())), labels: s.mapLabels.map(i => P(i.marker.getLngLat())),
      arrows: s.sceneArrows.map(a => [P(a.tail), P(a.head)]), perims: s.scenePerimeters.map(p => P(p.lngLat)), dists: s.sceneDistances.map(d => [P(d.a), P(d.b)]),
      sel: [s.selectedSceneIconId && 'i', s.selectedMapLabelId && 'l', s.selectedSceneArrowId && 'a', s.selectedScenePerimeterId && 'p', s.selectedSceneDistanceId && 'd'].filter(Boolean).join('')}; });
  const counts = s => [s.icons.length, s.labels.length, s.arrows.length, s.perims.length, s.dists.length].join(',');
  // Krok zpět přepočítává i velké vrstvy států — na vytíženém stroji trvá; čekat na stav, ne na čas.
  const until = async (fn, ms = 60000) => { const t0 = Date.now(); for(;;){ const s = await S(); if(fn(s)) return s; if(Date.now() - t0 > ms) return s; await page.waitForTimeout(300); } };
  const near = (a, b, tol = 2) => Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol;
  const idle = () => page.waitForFunction(() => window.__tnMap && __tnMap.loaded() && !__tnMap.isMoving(), null, {timeout: 30000}).catch(() => {});
  const EMPTY = [1450, 850];
  await idle();
  await page.evaluate(() => { const F = __pzFns, m = __tnMap; const U = (x, y) => { const l = m.unproject([x, y]); return [l.lng, l.lat]; };
    F.createSceneIconAt(U(700, 300), {data: F.pzIconDataUrl('policie'), silent:true});
    F.addMapLabelAt(U(900, 300), {text:'TEST', silent:true});
    F.createSceneArrow(U(700, 450), U(850, 500), {silent:true});
    F.createScenePerimeterAt(U(1100, 450), {radiusMeters: 20000, unit:'km', silent:true});
    F.createSceneDistance(U(700, 650), U(950, 620), {silent:true});
    window.__pzPushUndo();
  });
  await page.waitForTimeout(900); await idle();
  await page.mouse.click(...EMPTY); await page.waitForTimeout(400);
  const s0 = await S();
  check(counts(s0) === '1,1,1,1,1' && s0.multi === '' && s0.sel === '', 'připravena ikonka, popisek, šipka, perimetr a vzdálenost; nic vybraného');

  // --- Ctrl+klik skládá výběr ze všech druhů objektů ---
  await page.keyboard.down('Control');
  for(const [x, y] of [[700, 300], [775, 475], [1100, 440], [825, 635]]){ await page.mouse.click(x, y); await page.waitForTimeout(450); }
  await page.keyboard.up('Control');
  let s = await S();
  check(s.multi === 'adip', 'Ctrl+klik vybere ikonku, šipku, perimetr i vzdálenost (' + s.multi + ')');
  check(/Vybráno 4/.test(await st()), 'stav hlásí Vybráno 4');
  check(await page.$eval('#pzMultiBar', e => !e.hidden && e.querySelector('#pzMultiCount').textContent === '4'), 'lišta výběru ukazuje 4');
  check(s.sel === '', 'jednotlivý výběr je při skupině prázdný');
  await shot(page, 'scene_multi_layers.png');

  // --- tažení za šipku posune celou skupinu; popisek mimo výběr zůstane ---
  await page.mouse.move(775, 475); await page.mouse.down();
  for(let i = 1; i <= 10; i++){ await page.mouse.move(775 + i * 6, 475 + i * 4); await page.waitForTimeout(25); }
  await page.mouse.up(); await page.waitForTimeout(600);
  s = await S();
  const D = [60, 40], plus = p => [p[0] + D[0], p[1] + D[1]];
  check(near(s.icons[0], plus(s0.icons[0]), 3) && near(s.arrows[0][0], plus(s0.arrows[0][0]), 3) && near(s.arrows[0][1], plus(s0.arrows[0][1]), 3)
    && near(s.perims[0], plus(s0.perims[0]), 3) && near(s.dists[0][0], plus(s0.dists[0][0]), 3) && near(s.dists[0][1], plus(s0.dists[0][1]), 3),
    'tažením za šipku se posunula ikonka, šipka, perimetr i vzdálenost o stejný kus');
  check(near(s.labels[0], s0.labels[0]), 'popisek mimo výběr zůstal na místě');
  check(/Posunuto 4/.test(await st()), 'stav hlásí Posunuto 4 položek');
  check(s.multi === 'adip', 'skupina zůstává vybraná i po tažení');
  await page.keyboard.press('Control+z');
  s = await until(x => near(x.arrows[0][0], s0.arrows[0][0]) && near(x.icons[0], s0.icons[0]));
  check(near(s.arrows[0][0], s0.arrows[0][0]) && near(s.icons[0], s0.icons[0]) && near(s.perims[0], s0.perims[0]) && near(s.dists[0][1], s0.dists[0][1]), 'jeden Ctrl+Z vrátí posun celé skupiny');

  // --- Ctrl+A + šipky na klávesnici; série stisků = jeden krok zpět ---
  await page.mouse.click(...EMPTY); await page.waitForTimeout(300);
  await page.keyboard.press('Control+a'); await page.waitForTimeout(300);
  check((await S()).multi === 'adilp', 'Ctrl+A vybere všech 5 objektů');
  const lng0 = await page.evaluate(() => __tnMap.getCenter().lng);
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('Shift+ArrowDown'); await page.waitForTimeout(400);
  s = await S();
  check(near(s.icons[0], [701, 310], 1) && near(s.labels[0], [901, 310], 1) && near(s.arrows[0][1], [851, 510], 1) && near(s.perims[0], [1101, 460], 1) && near(s.dists[0][0], [701, 660], 1),
    'šipka posune o 1 px, Shift+šipka o 10 px (všechny druhy)');
  check(Math.abs(lng0 - await page.evaluate(() => __tnMap.getCenter().lng)) < 1e-9, 'mapa se šipkami neposouvá, když je něco vybráno');
  await page.keyboard.press('Control+z');
  s = await until(x => near(x.icons[0], s0.icons[0], 1) && near(x.dists[0][0], s0.dists[0][0], 1));
  check(near(s.icons[0], s0.icons[0], 1) && near(s.arrows[0][1], s0.arrows[0][1], 1) && near(s.dists[0][0], s0.dists[0][0], 1), 'jeden Ctrl+Z vrátí celou sérii posunů klávesnicí');

  // --- Ctrl+C / Ctrl+V celé skupiny se zachováním rozestupů ---
  await page.mouse.click(...EMPTY); await page.waitForTimeout(300);
  await page.keyboard.press('Control+a'); await page.waitForTimeout(200);
  await page.keyboard.press('Control+c'); await page.waitForTimeout(200);
  check(/Zkopírováno 5/.test(await st()), 'Ctrl+C hlásí Zkopírováno 5');
  await page.keyboard.press('Control+v'); await page.waitForTimeout(900);
  s = await S();
  check(counts(s) === '2,2,2,2,2', 'Ctrl+V vloží kopii všech 5 objektů (' + counts(s) + ')');
  const off = p => [p[0] + 26, p[1] + 22];
  check(near(s.icons[1], off(s0.icons[0]), 2) && near(s.labels[1], off(s0.labels[0]), 2) && near(s.arrows[1][1], off(s0.arrows[0][1]), 2) && near(s.perims[1], off(s0.perims[0]), 2) && near(s.dists[1][0], off(s0.dists[0][0]), 2),
    'kopie drží rozestupy (celá skupina posunutá o stejný kus)');
  check(s.multi === 'adilp' && /Vloženo 5/.test(await st()), 'vložená skupina je vybraná a stav hlásí Vloženo 5');
  await shot(page, 'scene_multi_paste.png');
  await page.keyboard.press('Control+z');
  s = await until(x => counts(x) === '1,1,1,1,1');
  check(counts(s) === '1,1,1,1,1', 'Ctrl+Z vrátí vložení skupiny');
  // Ctrl+D duplikuje skupinu
  await page.mouse.click(...EMPTY); await page.waitForTimeout(300);
  await page.keyboard.press('Control+a'); await page.keyboard.press('Control+d'); await page.waitForTimeout(900);
  s = await S(); check(counts(s) === '2,2,2,2,2' && /Duplikováno 5/.test(await st()), 'Ctrl+D duplikuje celou skupinu');
  await page.keyboard.press('Delete'); await page.waitForTimeout(500);
  s = await S(); check(counts(s) === '1,1,1,1,1' && near(s.icons[0], s0.icons[0], 1), 'Delete smaže právě vloženou (vybranou) skupinu, originály zůstanou');

  // --- Delete smaže celou skupinu, Ctrl+Z ji vrátí ---
  await page.mouse.click(...EMPTY); await page.waitForTimeout(300);
  await page.keyboard.press('Control+a'); await page.keyboard.press('Delete'); await page.waitForTimeout(500);
  s = await S(); check(counts(s) === '0,0,0,0,0' && /Smazáno 5/.test(await st()), 'Delete smaže všech 5 vybraných');
  check(await page.$eval('#pzMultiBar', e => e.hidden), 'lišta výběru zmizí');
  await page.keyboard.press('Control+z'); s = await until(x => counts(x) === '1,1,1,1,1');
  check(counts(s) === '1,1,1,1,1', 'Ctrl+Z vrátí smazanou skupinu');

  // Krok zpět znovu nahrává i velké vrstvy států; dokud mapa nedokreslí, klik do ní
  // šipku „nenajde“ (queryRenderedFeatures je prázdné) — počkat, až se uklidní.
  await idle(); await page.waitForTimeout(1500); await idle();

  // --- jedna věc: klik vybere, šipka posune, Delete smaže a řekne co ---
  await page.mouse.click(...EMPTY); await page.waitForTimeout(400);
  await page.mouse.click(775, 475); await page.waitForTimeout(400);
  s = await S(); check(s.sel === 'a' && s.multi === '', 'klik na šipku vybere jen šipku');
  const t0 = s.arrows[0][0];
  await page.keyboard.press('ArrowUp'); await page.waitForTimeout(300);
  s = await S(); check(near(s.arrows[0][0], [t0[0], t0[1] - 1], 0) && /Posunuto šipkami/.test(await st()), 'šipka na klávesnici posune vybranou šipku o 1 px');
  await page.keyboard.press('Control+c'); await page.keyboard.press('Control+v'); await page.waitForTimeout(500);
  s = await S(); check(s.arrows.length === 2 && /Šipka vložena/.test(await st()), 'Ctrl+C / Ctrl+V umí i šipku');
  await page.keyboard.press('Delete'); await page.waitForTimeout(300);
  s = await S(); check(s.arrows.length === 1 && /Šipka smazána/.test(await st()), 'Delete smaže vybranou šipku a stav to řekne');
  // tažení šipky, která není ve skupině, skupinu zruší a posune jen ji
  await page.mouse.click(...EMPTY); await page.waitForTimeout(300);
  await page.keyboard.down('Control'); await page.mouse.click(700, 300); await page.waitForTimeout(400); await page.mouse.click(1100, 440); await page.waitForTimeout(400); await page.keyboard.up('Control');
  const b = await S();
  await page.mouse.move(775, 474); await page.mouse.down(); for(let i = 1; i <= 8; i++){ await page.mouse.move(775 + i * 5, 474); await page.waitForTimeout(25); } await page.mouse.up(); await page.waitForTimeout(500);
  s = await S();
  check(s.multi === '' && near(s.icons[0], b.icons[0]) && s.arrows[0][0][0] - b.arrows[0][0][0] > 30, 'tažení věci mimo skupinu posune jen ji a skupinu zruší');
  await page.keyboard.press('Control+z'); s = await until(x => near(x.arrows[0][0], b.arrows[0][0], 2));
  check(near(s.arrows[0][0], b.arrows[0][0], 2), 'Ctrl+Z vrátí posun šipky, která nebyla předem vybraná');
  await idle(); await page.waitForTimeout(1500); await idle();

  // --- Alt+tažení obdélníkem bere i vrstvy; zarovnání do řady ---
  await page.mouse.click(...EMPTY); await page.waitForTimeout(300);
  await page.keyboard.down('Alt');
  await page.mouse.move(640, 240); await page.mouse.down(); await page.mouse.move(900, 500, {steps: 5}); await page.mouse.move(1180, 700, {steps: 5}); await page.mouse.up();
  await page.keyboard.up('Alt'); await page.waitForTimeout(400);
  check((await S()).multi === 'adilp', 'Alt+tažení vybere obdélníkem všech 5 objektů (' + (await S()).multi + ')');
  await page.click('#pzMultiBar [data-act="row"]'); await page.waitForTimeout(500);
  s = await S();
  const cy = [s.icons[0][1], s.labels[0][1], (s.arrows[0][0][1] + s.arrows[0][1][1]) / 2, s.perims[0][1], (s.dists[0][0][1] + s.dists[0][1][1]) / 2];
  check(Math.max(...cy) - Math.min(...cy) <= 2, 'Zarovnat do řady srovná středy na jednu linii (' + cy.map(Math.round).join(', ') + ')');
  check(near([s.icons[0][0], 0], [s0.icons[0][0], 0], 1) && /Zarovnáno do řady/.test(await st()), 'vodorovná poloha se zarovnáním nemění, stav to hlásí');
  await shot(page, 'scene_multi_align.png');

  // --- seznamy v panelu: klik vybere, Ctrl+klik skládá skupinu, × maže ---
  for(const id of ['sceneIconSection', 'sceneArrowSection', 'scenePerimeterSection', 'sceneDistanceSection']) await page.evaluate(id => { const x = document.getElementById(id); if(x.classList.contains('collapsed')) x.querySelector('h3').click(); }, id);
  await page.waitForTimeout(300);
  const rows = await page.evaluate(() => ['mapLabelList', 'sceneIconList', 'sceneArrowList', 'scenePerimeterList', 'sceneDistanceList'].map(id => document.querySelectorAll('#' + id + ' .wp-item[data-pz-key]').length).join(','));
  check(rows === '1,1,1,1,1', 'každý seznam má jednotný řádek pro svůj objekt (' + rows + ')');
  await page.click('#sceneArrowList .wp-item'); await page.waitForTimeout(300);
  s = await S();
  check(s.sel === 'a' && /Vybráno\./.test(await st()), 'klik na řádek šipky ji vybere a stav poradí, co dál');
  check(await page.$eval('#sceneArrowList .wp-item', e => e.classList.contains('active')), 'vybraný řádek je zvýrazněný');
  await page.click('#scenePerimeterList .wp-item', {modifiers: ['Control']}); await page.waitForTimeout(300);
  s = await S(); check(s.multi === 'ap', 'Ctrl+klik na řádek perimetru přidá do skupiny (' + s.multi + ')');
  check(await page.$$eval('.wp-item.pz-multi-row', e => e.length) === 2, 'řádky skupiny jsou v seznamech označené');
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  check((await S()).multi === '' && /Výběr zrušen/.test(await st()), 'Esc zruší výběr');
  await page.click('#sceneDistanceList .btn-remove'); await page.waitForTimeout(300);
  s = await S(); check(s.dists.length === 0 && /Vzdálenost smazána/.test(await st()), '× v seznamu smaže vzdálenost');

  // --- tlačítka „Klikni do mapy“ ukazují, že je vkládání zapnuté ---
  const armed = [];
  for(const id of ['addMapLabelBtn', 'addSceneIconBtn', 'addSceneArrowBtn', 'addScenePerimeterBtn', 'addSceneDistanceBtn']){
    await page.evaluate(id => document.getElementById(id).scrollIntoView({block:'center'}), id);
    await page.click('#' + id); await page.waitForTimeout(150);
    const on = await page.evaluate(() => [...document.querySelectorAll('.btn.is-on')].map(b => b.id).join(','));
    armed.push(on === id); await st();
  }
  check(armed.every(Boolean), 'zapnuté vkládání svítí vždy jen na jednom tlačítku (' + armed.join(',') + ')');
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  check(await page.$$eval('.btn.is-on', e => e.length) === 0, 'Esc vkládání vypne a tlačítko zhasne');
  check(await page.$$eval('#updateMapLabelBtn,#deleteMapLabelBtn,#updateSceneIconBtn,#deleteSceneArrowBtn,#updateScenePerimeterBtn,#deleteSceneDistanceBtn,.pane-scena .hint, #pzTemplateSection', e => e.length) === 0, 'tlačítka „Upravit / Smazat vybraný“ a Rychlá scéna jsou pryč');

  check(!seen.some(x => /\{\d\}/.test(x)), 'žádná hláška s nedosazeným {0}' + (seen.filter(x => /\{\d\}/.test(x)).join(' | ')));
  check(errors.length === 0, 'žádná chyba stránky' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await close(); done();
})();
