// Kraje ČR (Scéna › Kraje ČR): názvy krajů jak je píšou reportéři, barvení tlačítkem
// i kliknutím do mapy, zvýrazněná hranice, ostatní kraje, názvy krajů, krok zpět,
// uložení do projektu, nástroj asistenta colorRegion, datová škála a export PNG.
const {check, done, open, tab, openSection, OUT, shot} = require('./lib');
const fs = require('fs'), path = require('path');
(async () => {
  const {page, errors, close} = await open();
  const ks = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__pzFns.state.czKraje || {})));
  const px = ll => page.evaluate(ll => { const q = window.__tnMap.project(ll), r = document.getElementById('map').getBoundingClientRect(); return {x: q.x + r.left, y: q.y + r.top}; }, ll);

  // --- názvy krajů: diakritika, pády, zkratky, „kraj" navíc
  const res = await page.evaluate(() => ['Moravskoslezský', 'MSK', 'moravskoslezsky kraj', 'Vysočina', 'Kraj Vysočina', 'Praha', 'Hlavní město Praha', 'Jihomoravský kraj',
    'Jihomoravského kraje', 'jihomor', 'Královéhradecký', 'Ústecký', 'Plzeňský', 'CZ041', 'Olomoucký', 'Brno-venkov', 'jiho'].map(q => window.__pzFns.pzKrajResolve(q)));
  check(JSON.stringify(res) === JSON.stringify(['CZ080', 'CZ080', 'CZ080', 'CZ063', 'CZ063', 'CZ010', 'CZ010', 'CZ064', 'CZ064', 'CZ064', 'CZ052', 'CZ042', 'CZ032', 'CZ041', 'CZ071', null, null]),
    'kraje podle názvu, zkratky i bez diakritiky; nejednoznačné „jiho" nic ' + JSON.stringify(res));
  const lst = await page.evaluate(() => window.__pzFns.pzKrajResolveList('Praha, Jihočeský a Jihomoravský'));
  check(lst.ids.join(',') === 'CZ010,CZ031,CZ064' && !lst.unknown.length, 'seznam „Praha, Jihočeský a Jihomoravský" ' + JSON.stringify(lst));

  const lst2 = await page.evaluate(() => window.__pzFns.pzKrajResolveList('Praha Jihočeský').ids.join(','));
  check(lst2 === 'CZ010,CZ031', 'i bez čárky „Praha Jihočeský" (' + lst2 + ')');
  // rychlý povel asistenta (bez modelu)
  const qc = await page.evaluate(() => ['obarvi Jihomoravský kraj červeně', 'obkresli kraj Vysočina', 'obarvi kraj Bavorsko'].map(q => window.__tnchat.quick(q)?.calls?.[0]?.args || null));
  check(qc[0]?.region === 'Jihomoravský' && qc[0].color === 'červená' && qc[1]?.outline === true && qc[2] === null, 'rychlý povel „obarvi … kraj" volá colorRegion ' + JSON.stringify(qc));

  // --- panel: výběr kraje + Obarvit
  await tab(page, 'scena'); await openSection(page, 'czKrajeSection'); await page.waitForTimeout(400);
  check(await page.$$eval('#czKrajSelect option', o => o.filter(x => x.value).length) === 14, 'v seznamu je 14 krajů');
  await page.selectOption('#czKrajSelect', 'CZ064');
  await page.$eval('#czKrajColor', (e) => { e.value = '#e63946'; e.dispatchEvent(new Event('input', {bubbles: true})); });
  await page.click('#czKrajPaintBtn'); await page.waitForTimeout(2500);
  let s = await ks();
  check(s.fill?.CZ064 === '#e63946', 'Obarvit vyplní Jihomoravský kraj');
  check(await page.evaluate(() => !!window.__tnMap.getLayer('pz-kraje-fill') && window.__tnMap.getLayoutProperty('pz-kraje-fill', 'visibility') !== 'none'), 'vrstva krajů je v mapě');
  check((await page.textContent('#czKrajList')).includes('Jihomoravský kraj'), 'obarvený kraj je v seznamu');
  check(/ČÚZK/.test(await page.textContent('#mapSourceWatermark')), 'zdroj mapy uvádí ČÚZK');
  check(await page.evaluate(() => { const b = window.__tnMap.getBounds(); return b.getWest() < 12.2 && b.getEast() > 18.8; }), 'pohled ukazuje celou ČR');
  // zvýrazněná hranice
  await page.click('#czKrajOutlineBtn'); await page.waitForTimeout(400);
  s = await ks();
  check(s.outline?.CZ064?.color === '#e30613' && s.outline.CZ064.width === 4, 'Obrys obkreslí kraj červeně ' + JSON.stringify(s.outline));
  await page.click('#czKrajList .wp-item[data-kraj="CZ064"] .pz-kraj-ol'); await page.waitForTimeout(300);
  check(!(await ks()).outline?.CZ064, 'tlačítko Obrys v řádku obrys zase vypne');
  await page.click('#undoActionBtn'); await page.waitForTimeout(1500);
  check(!!(await ks()).outline?.CZ064, 'krok zpět obrys vrátí');

  // --- klik do kraje → paleta
  await page.check('#paintKrajOnClick'); await page.waitForTimeout(800);
  let p = await px([17.25, 49.65]); await page.mouse.click(p.x, p.y); await page.waitForTimeout(500);
  check((await page.textContent('.pz-country-pop b').catch(() => '')) === 'Olomoucký kraj', 'klik do Olomouckého kraje otevře paletu s jeho názvem');
  await page.click('.pz-country-pop button[data-c="#9d0208"]'); await page.waitForTimeout(500);
  check((await ks()).fill?.CZ071 === '#9d0208', 'paleta obarví Olomoucký kraj');
  p = await px([18.2, 49.85]); await page.mouse.click(p.x, p.y); await page.waitForTimeout(500);
  await page.click('.pz-country-pop button[data-act="outline"]'); await page.waitForTimeout(400);
  check(!!(await ks()).outline?.CZ080 && !(await ks()).fill?.CZ080, 'v paletě jde kraji dát jen obrys (Moravskoslezský)');
  await page.uncheck('#paintKrajOnClick');
  // ostatní kraje + názvy
  await page.check('#czKrajOthersOn'); await page.waitForTimeout(300);
  check((await ks()).others === '#f4a261', 'Ostatní kraje dostanou barvu');
  await page.check('#czKrajLabelsOn'); await page.waitForTimeout(600);
  const labs = await page.evaluate(() => window.__pzFns.state.mapLabels.filter(l => l.kraj).map(l => l.text).sort().join(','));
  check(labs === 'Jihomoravský,Moravskoslezský,Olomoucký', 'Názvy krajů = popisky zvýrazněných krajů (' + labs + ')');
  await shot(page, 'kraje_panel.png');
  await page.click('#undoActionBtn'); await page.waitForTimeout(1500);
  check(!(await ks()).labels && await page.evaluate(() => window.__pzFns.state.mapLabels.filter(l => l.kraj).length) === 0, 'krok zpět názvy krajů odebere');

  // --- projekt: uložit, smazat, načíst
  const snap = await page.evaluate(() => window.__pzFns.serializeProjectSnapshot());
  check(snap.overlays?.czKraje?.fill?.CZ071 === '#9d0208' && snap.overlays.czKraje.others === '#f4a261', 'kraje jsou v projektu');
  await page.evaluate(() => window.TNMAP.clearScene({what: 'kraje'})); await page.waitForTimeout(400);
  check(!Object.keys((await ks()).fill || {}).length && !(await ks()).others, 'clearScene kraje vše zruší');
  check(await page.evaluate(() => window.__tnMap.getLayoutProperty('pz-kraje-fill', 'visibility')) === 'none', 'bez krajů je vrstva schovaná');
  await page.evaluate(snap => window.__pzFns.applyProjectSnapshot(snap), snap); await page.waitForTimeout(2500);
  s = await ks();
  check(s.fill?.CZ064 === '#e63946' && s.fill?.CZ071 === '#9d0208' && !!s.outline?.CZ080 && s.others === '#f4a261', 'načtení projektu kraje vrátí ' + JSON.stringify(s.fill));
  check(await page.$$eval('#czKrajList .wp-item', e => e.length) === 3 && await page.isChecked('#czKrajOthersOn'), 'i panel ukazuje načtené kraje');

  // --- asistent: zadání reportérů
  const a = await page.evaluate(async () => {
    const T = window.TNMAP, o = {};
    await T.colorRegion({clear: true});
    o.r1 = await T.colorRegion({region: 'Olomoucký', color: 'tmavě rudá'});
    o.r2 = await T.colorRegion({region: 'Praha a Plzeňský', color: 'žlutá', others: 'oranžová'});
    o.r3 = await T.colorRegion({region: 'Kraj Vysočina, JMK', outline: 'červená', width: 5});
    o.bad = await T.colorRegion({region: 'Bavorsko'});
    o.pol = await T.colorPolitical({country: 'Moravskoslezský kraj', color: 'modrá'});
    return o;
  });
  s = await ks();
  check(a.r1.ok && s.fill.CZ071 && parseInt(s.fill.CZ071.slice(1, 3), 16) < 130, 'Olomoucký tmavě rudou ' + s.fill.CZ071);
  check(a.r2.ok && s.fill.CZ010 === '#ffd400' && s.fill.CZ032 === '#ffd400' && s.others === '#e6863c', 'Praha a Plzeňský žlutě, ostatní oranžově');
  check(a.r3.ok && s.outline.CZ063?.width === 5 && s.outline.CZ064?.width === 5 && !s.fill.CZ064, 'dva kraje obkreslené červenou hranicí');
  check(!a.bad.ok && /neznám/.test(a.bad.error), 'neznámý kraj = srozumitelná chyba (' + a.bad.error + ')');
  check(a.pol.ok && s.fill.CZ080 === '#2f81f7', 'colorPolitical s názvem kraje obarví kraj');

  // --- datová škála (API pro datovou mapu s legendou)
  const v = await page.evaluate(() => window.pzKraje.colorByValue({Praha: 10, 'Středočeský': 20, JMK: 30, MSK: 40, 'Neznámý': 5}, {classes: 4, palette: 'blue', others: null}));
  check(v.ok && v.legend.length === 4 && v.unresolved.join() === 'Neznámý' && v.colors.CZ010 !== v.colors.CZ080, 'colorByValue: 4 třídy, legenda, neznámý kraj vrácen ' + JSON.stringify(v.legend.map(l => l.color)));
  check((await ks()).data?.values?.CZ064 === 30, 'hodnoty zůstávají ve stavu (pro legendu a projekt)');

  // --- export PNG: kraj je v exportu stejně jako v náhledu
  await page.evaluate(() => window.TNMAP.colorRegion({clear: true}));
  await page.evaluate(() => window.TNMAP.colorRegion({region: 'Jihomoravský', color: '#e30613', fit: false}));
  await page.evaluate(() => window.__pzFns.pzKrajeFit(true)); await page.waitForTimeout(3000);
  const frac = await page.evaluate(lls => { const f = document.getElementById('exportFrame').getBoundingClientRect(), m = document.getElementById('map').getBoundingClientRect();
    return lls.map(ll => { const q = window.__tnMap.project(ll); return [(q.x + m.left - f.left) / f.width, (q.y + m.top - f.top) / f.height]; }); }, [[16.55, 48.92], [15.6, 49.45]]);
  await tab(page, 'export');
  const dl = page.waitForEvent('download', {timeout: 120000}).catch(() => null);
  await page.evaluate(() => document.getElementById('exportPngBtn').click());
  const d = await dl; check(!!d, 'export PNG proběhl');
  if(d){
    const file = path.join(OUT, 'kraje_export.png'); await d.saveAs(file);
    const b64 = fs.readFileSync(file).toString('base64');
    const c = await page.evaluate(async ([b64, frac]) => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
      const avg = (fx, fy) => { const d = g.getImageData(Math.round(img.width * fx) - 10, Math.round(img.height * fy) - 10, 21, 21).data; const s = [0, 0, 0]; for(let i = 0; i < d.length; i += 4) for(let k = 0; k < 3; k++) s[k] += d[i + k]; return s.map(v => Math.round(v / (d.length / 4))); };
      return frac.map(f => avg(f[0], f[1])); }, [b64, frac]);
    check(c[0][0] - c[0][1] > 80 && c[0][0] - c[0][2] > 60, 've vyexportovaném PNG je Jihomoravský kraj červený ' + JSON.stringify(c[0]));
    check(!(c[1][0] - c[1][1] > 80), 'Vysočina v exportu červená není ' + JSON.stringify(c[1]));
  }

  // --- Politická mapa: kraje nad výplní států a po přepnutí podkladu zůstanou
  await tab(page, 'styly');
  await page.evaluate(() => { const s = document.getElementById('baseStyle'); s.value = 'political'; s.dispatchEvent(new Event('change', {bubbles: true})); });
  await page.waitForTimeout(6000);
  const ord = await page.evaluate(() => { const L = window.__tnMap.getStyle().layers.map(l => l.id); return {k: L.indexOf('pz-kraje-fill'), p: L.indexOf('pz-political-fill'), vis: window.__tnMap.getLayoutProperty('pz-kraje-fill', 'visibility')}; });
  check(ord.k > ord.p && ord.p >= 0 && ord.vis === 'visible', 'na Politické mapě jsou kraje nad výplní států ' + JSON.stringify(ord));

  // --- QA: „Zarámovat scénu" zná zvýrazněné kraje — v 9:16 celá ČR v záběru (dřív kraj mimo)
  await page.evaluate(() => window.TNMAP.colorRegion({region:'Moravskoslezský', color:'červená', fit:false}));
  await page.evaluate(() => { const r = document.getElementById('exportResolution'); r.value = '1080x1920'; r.dispatchEvent(new Event('change', {bubbles:true})); });
  await page.waitForTimeout(800); await page.evaluate(() => window.TNMAP.fitScene()); await page.waitForTimeout(3000);
  const fit = await page.evaluate(() => { const F = window.__pzFns, m = window.__tnMap, f = document.getElementById('exportFrame').getBoundingClientRect(), mr = document.getElementById('map').getBoundingClientRect();
    return [[12.09, 50.25], [18.86, 49.55], [14.32, 51.05], [14.33, 48.55]].map(p => { const q = m.project(p); return [(q.x + mr.left - f.left) / f.width, (q.y + mr.top - f.top) / f.height]; }); });
  check(fit.every(([x, y]) => x > 0.02 && x < 0.98 && y > 0.1 && y < 0.9), '9:16: Zarámovat scénu ukáže celou ČR se zvýrazněným krajem ' + JSON.stringify(fit.map(p => p.map(v => +v.toFixed(2)))));
  await page.evaluate(() => { const r = document.getElementById('exportResolution'); r.value = '1920x1080'; r.dispatchEvent(new Event('change', {bubbles:true})); });

  // --- „Středočeským mostům hrozí uzavření": kraj obrysem + mosty uvnitř → záběr jen na kraj, ne celá ČR
  const bw = () => page.evaluate(() => { const p = window.__pzFns.pzSceneLngLats({countries:true, bubbles:false}), xs = p.map(q => q[0]); return Math.max(...xs) - Math.min(...xs); });
  await page.evaluate(async () => { const T = window.TNMAP; await T.colorRegion({clear:true}); await T.colorRegion({region:'Středočeský', outline:true, fit:false});
    await T.addLabel({place:'50.2416,14.3115', text:'Most přes Vltavu', fit:false}); await T.addLabel({place:'50.1859,15.0428', text:'Most přes Labe', fit:false}); });
  const wK = await bw();
  await page.evaluate(() => window.TNMAP.addLabel({place:'49.1951,16.6068', text:'Brno', fit:false}));
  const wCz = await bw();
  check(wK < 3.2 && wCz > 6, 'Zarámovat scénu: mosty uvnitř kraje → jen kraj (' + wK.toFixed(2) + '°), bod mimo kraj → celá ČR (' + wCz.toFixed(2) + '°)');

  check(errors.length === 0, 'žádná chyba stránky' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await close(); done();
})();
