// Titulek a zdroj v grafice (náhled = PNG, 16:9 i 9:16, nekoliduje se „Zdrojem mapy",
// krok zpět, projekt, nástroj setTitle) a název souboru podle zvyklostí redakce
// (mapa-popis-nick-gfx[-opr][-pořad]-RRMMDD, nick a pořad si pamatuje prohlížeč).
const {check, done, open, tab, OUT} = require('./lib');
const path = require('path'), fs = require('fs');

(async () => {
  const {page, ctx, errors, close} = await open();
  const downloads = []; page.on('download', d => downloads.push(d));
  const waitDl = async (n, ms = 120000) => { const t0 = Date.now(); while(downloads.length < n && Date.now() - t0 < ms) await page.waitForTimeout(300); return downloads.length >= n; };
  const save = async (d, name) => { const f = path.join(OUT, name); await d.saveAs(f); return f; };
  const d = new Date(), z = n => String(n).padStart(2, '0'), YMD = String(d.getFullYear()).slice(2) + z(d.getMonth() + 1) + z(d.getDate());
  const setSize = (w, h) => page.evaluate(([w, h]) => { const r = document.getElementById('exportResolution'); r.value = 'custom'; r.dispatchEvent(new Event('change', {bubbles:true}));
    const a = document.getElementById('exportCustomWidth'), b = document.getElementById('exportCustomHeight'); a.value = w; b.value = h; a.dispatchEvent(new Event('input', {bubbles:true})); }, [w, h]);
  // barvy v obdélníku PNG / plátna: navy (#0D1767), tmavá pilulka, bílý text
  const colorsIn = (src, rect) => page.evaluate(async ([src, rect]) => {
    let c;
    if(src.startsWith('#')) c = document.querySelector(src);
    else { const img = new Image(); img.src = 'data:image/png;base64,' + src; await img.decode(); c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').drawImage(img, 0, 0); }
    const kx = rect.k || 1, x = Math.round(rect.x * kx), y = Math.round(rect.y * kx), w = Math.max(1, Math.round(rect.w * kx)), h = Math.max(1, Math.round(rect.h * kx));
    const px = c.getContext('2d', {willReadFrequently:true}).getImageData(x, y, w, h).data; let navy = 0, dark = 0, white = 0, n = 0;
    for(let i = 0; i < px.length; i += 4){ n++; const [r, g, b, a] = [px[i], px[i+1], px[i+2], px[i+3]]; if(a < 200) continue;
      if(r < 40 && g < 50 && b > 80 && b < 140) navy++; if(r < 60 && g < 60 && b < 60) dark++; if(r > 230 && g > 230 && b > 230) white++; }
    return {navy: navy / n, dark: dark / n, white: white / n, w: c.width, h: c.height}; }, [src, rect]);
  // rozvržení, jaké kreslí export pro daný rozměr (stejná funkce kreslí náhled)
  const layout = (W, H) => page.evaluate(([W, H]) => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    const F = window.__pzFns; return {...F.pzDrawTitleOverlay(x, W, H), wm: F.drawMapSourceWatermark(x, W, H, true)}; }, [W, H]);
  const hit = (a, b) => a && b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

  await tab(page, 'export');
  check(await page.evaluate(() => ['exportTitleSection', 'exportNameSection'].every(id => document.getElementById(id)?.offsetParent)), 'Export: sekce Titulek a zdroj + Název souboru');

  // --- titulek z panelu: psaní ho zapne, náhled v rámečku ---
  check(await page.evaluate(() => !document.getElementById('pzTitleOverlay') || document.getElementById('pzTitleOverlay').hidden), 'bez titulku žádná vrstva v náhledu');
  await page.fill('#pzTitleText', 'Název: Uzavírka D1 u Humpolce');
  await page.fill('#pzSourceText', 'Zdroj: ŘSD'); await page.press('#pzSourceText', 'Tab'); await page.press('#pzTitleText', 'Tab');
  await page.waitForTimeout(300);
  const ui = await page.evaluate(() => ({t: document.getElementById('pzTitleText').value, s: document.getElementById('pzSourceText').value, on: document.getElementById('pzTitleOn').checked, son: document.getElementById('pzSourceOn').checked}));
  check(ui.on && ui.son && ui.t === 'Uzavírka D1 u Humpolce' && ui.s === 'ŘSD', 'psaní zapne titulek i zdroj, „Název:" a „Zdroj:" ze zadání se umažou — ' + JSON.stringify(ui));
  await setSize(640, 360); await page.waitForTimeout(400);
  let L = await layout(640, 360);
  const pv = await page.evaluate(() => { const c = document.getElementById('pzTitleOverlay'), f = document.getElementById('exportFrame').getBoundingClientRect(), b = c.getBoundingClientRect();
    return {vis: !c.hidden && b.width > 0, dx: Math.abs(b.left - f.left), dw: Math.abs(b.width - f.width), k: c.width / 640}; });
  check(pv.vis && pv.dx < 3 && pv.dw < 4, 'vrstva titulku leží přesně na výřezu exportu — ' + JSON.stringify(pv));
  const tIn = r => ({x: r.x + r.w * 0.55, y: r.y + r.h * 0.08, w: r.w * 0.4, h: Math.max(2, r.h * 0.1)});   // pruh nad textem: jen barva bubliny
  let cv = await colorsIn('#pzTitleOverlay', {...tIn(L.title), k: pv.k});
  check(cv.navy > 0.9, 'náhled: titulek Nova modrý vlevo nahoře — ' + JSON.stringify(cv));
  const safe = L.title.x >= 640 * 0.05 - 1 && L.title.y >= 360 * 0.05 - 1 && L.title.x + L.title.w <= 640 * 0.95;
  check(safe && L.source && L.source.x <= L.title.x + 1 && L.source.y > 300 && !hit(L.source, L.wm), 'titulek v title-safe, zdroj vlevo dole mimo „Zdroj mapy" — ' + JSON.stringify(L));

  // --- PNG: stejné místo a barvy jako náhled, výchozí název ---
  let d0 = downloads.length; await page.click('#exportPngBtn');
  check(await waitDl(d0 + 1), 'PNG staženo');
  check(/^tnmap-\d{8}-\d{4}\.png$/.test(downloads[d0].suggestedFilename()), 'bez popisu a nicku zůstává tnmap-datum-čas: ' + downloads[d0].suggestedFilename());
  const png = fs.readFileSync(await save(downloads[d0], '32_titulek.png')).toString('base64');
  cv = await colorsIn(png, tIn(L.title));
  check(cv.w === 640 && cv.navy > 0.9, 'PNG: titulek na stejném místě jako v náhledu — ' + JSON.stringify(cv));
  cv = await colorsIn(png, {x: L.source.x + 2, y: L.source.y + 2, w: 6, h: L.source.h - 4});
  check(cv.dark > 0.5, 'PNG: pilulka se zdrojem vlevo dole — ' + JSON.stringify(cv));
  cv = await colorsIn(png, {x: 640 * 0.6, y: 360 * 0.4, w: 20, h: 20});
  check(cv.navy < 0.05, 'mimo titulek je mapa');

  // --- 9:16 a dlouhý zdroj: zalomení, bezpečné zóny sítí, žádná kolize ---
  await page.evaluate(() => window.TNMAP.setTitle({title: 'Ministerstvo zdravotnictví hlásí rekordní počet nakažených chřipkou v krajích', source: 'Ministerstvo zdravotnictví ČR, Státní zdravotní ústav, krajské hygienické stanice'}));
  for(const [W, H] of [[1080, 1920], [1920, 1080], [1280, 720]]){
    L = await layout(W, H);
    const social = W < H, sl = W * (social ? 0.06 : 0.05), st = H * (social ? 0.14 : 0.05), sr = W * (social ? 0.14 : 0.05);
    check(L.title.lines >= 2 && L.title.lines <= 3 && L.title.x >= sl - 1 && L.title.y >= st - 1 && L.title.x + L.title.w <= W - sr + 1 && L.title.fontSize >= Math.min(W, H) / 1080 * 30,
      `${W}×${H}: titulek zalomený v title-safe (${L.title.lines} ř., ${L.title.fontSize} px)`);
    check(!hit(L.source, L.wm) && !hit(L.source, L.title) && L.source.x + L.source.w <= W && L.source.y + L.source.h <= H, `${W}×${H}: zdroj nenarazí na „Zdroj mapy" ani titulek`);
  }

  // --- nástroj setTitle, stav, styl, vypnutí ---
  let r = await page.evaluate(() => window.TNMAP.setTitle({title: 'Výluka metra C', source: '', style: 'TN červený'}));
  check(r.ok && r.title === 'Výluka metra C' && r.source === null && r.style === 'red', 'setTitle: titulek, prázdný zdroj = vypnout, styl červený — ' + JSON.stringify(r));
  check(await page.evaluate(() => window.TNMAP.getState().graphic?.title === 'Výluka metra C' && document.getElementById('pzTitleStyle').value === 'red'), 'stav mapy hlásí titulek, panel ukazuje styl');
  check((await page.evaluate(() => window.TNMAP.setTitle({style: 'duhový'}))).ok === false, 'setTitle: neznámý styl vrátí chybu');
  r = await page.evaluate(() => window.TNMAP.setTitle({off: true}));
  check(r.ok && r.title === null && await page.evaluate(() => document.getElementById('pzTitleOverlay').hidden && !document.getElementById('pzTitleOn').checked), 'setTitle off:true skryje titulek i zdroj');

  // --- krok zpět: psaní titulku = jeden krok ---
  await page.evaluate(() => window.TNMAP.setTitle({title: 'První'}));
  await page.click('#pzTitleText'); await page.fill('#pzTitleText', 'Druhý titulek'); await page.press('#pzTitleText', 'Tab'); await page.waitForTimeout(200);
  await page.evaluate(() => window.__pzUndo()); await page.waitForTimeout(500);
  check(await page.$eval('#pzTitleText', e => e.value) === 'První' && await page.evaluate(() => window.TNMAP.getState().graphic.title === 'První'), 'Ctrl+Z vrátí předchozí titulek');
  await page.evaluate(() => window.__pzRedo()); await page.waitForTimeout(500);
  check(await page.$eval('#pzTitleText', e => e.value) === 'Druhý titulek', 'Ctrl+Y ho zase vrátí');

  // --- projekt: uložit a načíst ---
  await page.evaluate(() => window.TNMAP.setTitle({title: 'Volby 2026', source: 'ČSÚ', style: 'bílý'}));
  const snap = await page.evaluate(() => JSON.parse(JSON.stringify(window.__pzFns.serializeProjectSnapshot())));
  check(snap.graphicTitle?.title === 'Volby 2026' && snap.graphicTitle.source === 'ČSÚ' && snap.graphicTitle.style === 'classic', 'projekt nese titulek a zdroj');
  await page.evaluate(() => window.TNMAP.setTitle({off: true, title: 'Jiný'}));
  await page.evaluate(s => window.__pzFns.applyProjectSnapshot(s, 'test'), snap); await page.waitForTimeout(800);
  check(await page.evaluate(() => { const g = window.TNMAP.getState().graphic; return g.title === 'Volby 2026' && g.source === 'ČSÚ' && document.getElementById('pzSourceOn').checked && !document.getElementById('pzTitleOverlay').hidden; }), 'načtení projektu vrátí titulek, zdroj i náhled');
  await page.evaluate(s => window.__pzFns.applyProjectSnapshot({...s, graphicTitle: undefined}, 'test'), snap); await page.waitForTimeout(500);
  check(await page.evaluate(() => !window.TNMAP.getState().graphic.title && document.getElementById('pzTitleOverlay').hidden), 'starý projekt bez titulku = bez titulku');

  await page.evaluate(() => window.TNMAP.setTitle({title: 'Volby 2026', source: 'ČSÚ', style: 'bílý'}));

  // --- název souboru podle redakce ---
  await page.fill('#pzNamePopis', 'Potok'); await page.fill('#pzNameNick', 'MAJ'); await page.selectOption('#pzNamePorad', 'tn');
  await setSize(1920, 1080); await page.waitForTimeout(300);
  check(await page.$eval('#pzNamePreview', e => e.textContent) === `mapa-potok-maj-gfx-tn-${YMD}.png`, 'náhled názvu: ' + await page.$eval('#pzNamePreview', e => e.textContent));
  await page.check('#pzNameOprava');
  check(await page.evaluate(() => window.__pzFns.getExportBaseName()) === `mapa-potok-maj-gfx-opr-tn-${YMD}`, 'oprava: -gfx-opr-tn-');
  await page.evaluate(() => { window.__pzFns.state._exportNameSuffix = '9x16'; });
  check(await page.evaluate(() => window.__pzFns.getExportBaseName()) === `mapa-potok-maj-gfx-opr-tn-${YMD}-9x16`, 'dávka drží příponu -9x16');
  await page.evaluate(() => { window.__pzFns.state._exportNameSuffix = null; });
  await page.uncheck('#pzNameOprava');
  d0 = downloads.length; await page.click('#exportChips .exp-chip[data-res="1080x1920"]'); await page.waitForTimeout(400); await page.click('#exportPngBtn');
  check(await waitDl(d0 + 1) && downloads[d0].suggestedFilename() === `mapa-potok-maj-gfx-tn-${YMD}-9x16.png`, 'PNG 9:16: ' + downloads[d0]?.suggestedFilename());
  const png916 = fs.readFileSync(await save(downloads[d0], '32_titulek_9x16.png')).toString('base64');
  L = await layout(1080, 1920);
  cv = await colorsIn(png916, {x: L.title.x + L.title.w * 0.5, y: L.title.y + 2, w: L.title.w * 0.4, h: 4});
  check(cv.w === 1080 && cv.h === 1920 && cv.white > 0.9, 'PNG 9:16: bílý titulek v bezpečné zóně sítí — ' + JSON.stringify(cv));
  r = await page.evaluate(() => window.TNMAP.setExportName({popis: 'Vietnam', nick: 'cze', porad: 'Střepiny', oprava: false}));
  check(r.ok && r.file === `mapa-vietnam-cze-gfx-str-${YMD}-9x16`, 'setExportName: ' + JSON.stringify(r));
  check((await page.evaluate(() => window.TNMAP.setExportName({nick: 'abcd'}))).ok === false, 'setExportName: nick musí mít 3 písmena');
  check((await page.evaluate(() => window.TNMAP.setExportName({porad: 'Ulice'}))).ok === false, 'setExportName: neznámý pořad vrátí chybu');
  // jen nick (popis prázdný) → popis z názvu projektu
  await page.fill('#pzNamePopis', ''); await page.evaluate(() => { document.getElementById('projectName').value = 'Kanál Labe'; });
  check(await page.evaluate(() => window.__pzFns.getExportBaseName()) === `mapa-kanal-labe-cze-gfx-str-${YMD}`, 'bez popisu poslouží název projektu');

  // --- nick a pořad si pamatuje prohlížeč, popis ne ---
  await page.reload({waitUntil: 'load'}); await page.waitForTimeout(5000);
  const kept = await page.evaluate(() => ({n: document.getElementById('pzNameNick').value, p: document.getElementById('pzNamePorad').value, d: document.getElementById('pzNamePopis').value}));
  check(kept.n === 'cze' && kept.p === 'str' && kept.d === '', 'po obnovení stránky: nick a pořad zůstaly, popis ne — ' + JSON.stringify(kept));
  await page.evaluate(() => { document.getElementById('pzNameNick').value = ''; document.getElementById('pzNameNick').dispatchEvent(new Event('input', {bubbles:true})); document.getElementById('projectName').value = ''; });
  check(await page.evaluate(() => /^tnmap-\d{8}-\d{4}$/.test(window.__pzFns.getExportBaseName())), 'bez nicku a popisu zpět tnmap-datum-čas');

  check(errors.length === 0, 'žádná chyba stránky' + (errors.length ? ' — ' + errors[0] : ''));
  await close(); done();
})();
