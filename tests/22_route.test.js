// Trasa: zadání A/B (klik, psaní, tažení, prohození), zastávky, vlastní kreslená
// trasa, druhy dopravy, chybové stavy, délka trasy, „Předkreslit celou trasu"
// (náhled i export PNG) a krok zpět po každé akci. Geokódování i OSRM jsou podvržené.
const {check, done, open, tab, openSection, OUT} = require('./lib');
const fs = require('fs'), path = require('path');

const PLACES = {praha:[14.4378,50.0755,'Praha'], brno:[16.6068,49.1951,'Brno'], jihlava:[15.5912,49.3961,'Jihlava']};
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const item = p => ({lat:String(p[1]), lon:String(p[0]), display_name:p[2] + ', Česko', name:p[2], namedetails:{name:p[2]}, addresstype:'city', class:'place', type:'city',
  boundingbox:[String(p[1]-.05), String(p[1]+.05), String(p[0]-.08), String(p[0]+.08)], address:{city:p[2], country:'Česko', country_code:'cz'}});

(async () => {
  const {page, ctx, errors, close} = await open({wait: 1});
  const net = {osrm: 'ok'};
  await ctx.route(/nominatim\.openstreetmap\.org\/search/, r => {
    const q = norm(new URL(r.request().url()).searchParams.get('q') || '');
    r.fulfill({status:200, contentType:'application/json', body: JSON.stringify(Object.keys(PLACES).filter(k => k.startsWith(q) || q.startsWith(k)).map(k => item(PLACES[k])))});
  });
  await ctx.route(/photon\.komoot\.io/, r => r.fulfill({status:200, contentType:'application/json', body:'{"features":[]}'}));
  await ctx.route(/nominatim\.openstreetmap\.org\/reverse/, r => {
    const u = new URL(r.request().url()), lat = +u.searchParams.get('lat');
    const n = 'Místo ' + lat.toFixed(2);
    r.fulfill({status:200, contentType:'application/json', body: JSON.stringify({lat:String(lat), lon:u.searchParams.get('lon'), display_name:n + ', Česko', name:n, namedetails:{name:n}, addresstype:'village', address:{village:n, country:'Česko', country_code:'cz'}})});
  });
  await ctx.route(/routing\.openstreetmap\.de|router\.project-osrm\.org/, async r => {
    if(net.osrm === 'down') return r.abort();
    if(net.osrm === '503') return r.fulfill({status:503, body:'busy'});
    if(net.osrm === 'noroute') return r.fulfill({status:400, contentType:'application/json', body:'{"code":"NoRoute","message":"Impossible route between points"}'});
    if(net.osrm === 'slow') await new Promise(x => setTimeout(x, 2500));
    const pts = r.request().url().match(/\/(?:car|driving)\/([^?]+)/)[1].split(';').map(s => s.split(',').map(Number));
    const coords = [];
    for(let i = 1; i < pts.length; i++) for(let k = (i === 1 ? 0 : 1); k <= 10; k++){ const t = k / 10; coords.push([pts[i-1][0] + (pts[i][0]-pts[i-1][0]) * t, pts[i-1][1] + (pts[i][1]-pts[i-1][1]) * t]); }
    r.fulfill({status:200, contentType:'application/json', body: JSON.stringify({code:'Ok', routes:[{geometry:{type:'LineString', coordinates:coords}, distance:205000, duration:7500, legs:[]}], waypoints:[]})});
  });
  await page.reload({waitUntil:'load'}); await page.waitForTimeout(5000);
  page.setDefaultTimeout(120000);   // vytížený stroj: vykreslení mapy po změně pohledu trvá i desítky sekund

  const S = () => page.evaluate(() => { const s = window.__pzFns.state, src = id => window.__tnMap.getSource(id)?.serialize?.().data?.features || [];
    return {A: s.pointA, B: s.pointB, rc: (s.routeCoords || []).length, via: s.manualViaPoints.length, mode: s.currentTransportMode,
      a: document.getElementById('startInput').value, b: document.getElementById('endInput').value, status: document.getElementById('statusBar').textContent.trim(),
      mk: document.querySelectorAll('.route-dot.dot-a,.route-dot.dot-b').length, wp: document.querySelectorAll('.route-dot.dot-wp').length,
      rows: [...document.querySelectorAll('#waypointList .nav-stop-name')].map(e => e.textContent),
      sum: document.getElementById('routeSummary').hidden ? '' : document.getElementById('routeSummary').textContent,
      busy: document.getElementById('findRouteBtn').classList.contains('is-busy'),
      active: document.querySelector('.transport-btn.active')?.dataset.mode,
      ghost: src('route-ghost').length, anim: (src('route-anim')[0]?.geometry?.coordinates || []).length, icons: s.sceneIcons.length}; });
  const until = (fn, arg, ms = 15000) => page.waitForFunction(fn, arg, {timeout: ms}).then(() => true).catch(() => false);
  const idle = () => until(() => window.__tnMap.loaded() && !window.__tnMap.isMoving(), null, 90000);
  const routed = (n = 2) => until(n => (window.__pzFns.state.routeCoords || []).length >= n && !document.getElementById('findRouteBtn').classList.contains('is-busy'), n);
  const settled = () => until(() => !document.getElementById('findRouteBtn').classList.contains('is-busy'));
  const px = (lng, lat) => page.evaluate(([lng, lat]) => { const p = window.__tnMap.project([lng, lat]), r = document.getElementById('map').getBoundingClientRect(); return [r.left + p.x, r.top + p.y]; }, [lng, lat]);
  const clickMap = async (lng, lat, opts) => { await idle(); const [x, y] = await px(lng, lat); await page.mouse.click(x, y, opts); await page.waitForTimeout(250); };
  const undo = async () => { await page.keyboard.press('Control+z'); await page.waitForTimeout(900); await idle(); };
  const home = async () => { await page.evaluate(() => window.__tnMap.jumpTo({center:[15.5,49.7], zoom:6.4, pitch:0, bearing:0})); await idle(); };
  let s;

  // ---- rozhraní: žádné odstavce, vše podstatné vidět hned ----
  await tab(page, 'trasa'); await home();
  const ui = await page.evaluate(() => ({hints: document.querySelectorAll('#navigationABSection .hint, #routeLookSection .hint, #navigationABSection p').length,
    swap: !!document.getElementById('swapRouteBtn'), lookOpen: !document.getElementById('routeLookSection').classList.contains('collapsed'),
    pre: !!document.getElementById('routePreDraw')?.offsetParent, preOn: document.getElementById('routePreDraw')?.checked,
    oldSections: document.querySelectorAll('.tab-pane[data-pane="trasa"] > .section').length}));
  check(ui.hints === 0, 'Navigace a Vzhled trasy bez vysvětlujících odstavců');
  check(ui.swap && ui.lookOpen && ui.pre && ui.preOn, '„Prohodit" a „Předkreslit celou trasu" jsou vidět hned (zapnuto)');
  check(ui.oldSections === 3, 'záložka Trasa má 3 sekce (zastávky jsou součástí Navigace): ' + ui.oldSections);

  // ---- klik do mapy: A, B → trasa se najde sama; krok zpět = jeden klik ----
  await clickMap(14.44, 50.08); s = await S();
  check(!!s.A && !s.B && s.mk === 1 && /cíl/i.test(s.status), 'klik nastaví start a řekne, co dál: ' + s.status);
  await clickMap(16.61, 49.2); await routed(); s = await S();
  check(s.rc > 1 && s.mk === 2 && /Trasa nalezena.*km/.test(s.status), 'druhý klik najde trasu sám: ' + s.status);
  check(/^\d+ km · \d+ h( \d+ min)?$/.test(s.sum), 'pod tlačítky je délka a doba: ' + s.sum);
  await undo(); s = await S();
  check(!!s.A && !s.B && s.rc === 0 && s.mk === 1 && s.sum === '', 'krok zpět vrátí jen cíl s trasou (start zůstane)');
  await page.keyboard.press('Control+y'); await page.waitForTimeout(900); await idle(); s = await S();
  check(!!s.B && s.rc > 1 && s.sum !== '', 'krok vpřed trasu vrátí i s délkou');

  // ---- zastávky: tlačítko, Ctrl+klik, pořadí, přeřazení, smazání, Backspace ----
  await page.click('#addWaypointBtn');
  check(await page.$eval('#addWaypointBtn', e => e.classList.contains('is-on')), '„+ Zastávka" svítí, dokud čeká na klik');
  await clickMap(15.9, 49.5); await routed(13); s = await S();
  check(s.via === 1 && s.wp === 1 && s.rows.length === 1 && !(await page.$eval('#addWaypointBtn', e => e.classList.contains('is-on'))), 'klik přidá jednu zastávku a vkládání se vypne');
  await page.keyboard.down('Control'); await clickMap(15.0, 49.95); await page.keyboard.up('Control'); await routed(23);
  await until(() => [...document.querySelectorAll('#waypointList .nav-stop-name')].every(e => /Místo/.test(e.textContent)), null, 8000); s = await S();
  check(s.via === 2 && s.wp === 2 && /49\.95/.test(s.rows[0]) && /49\.50/.test(s.rows[1]), 'Ctrl+klik blíž startu se zařadí před první zastávku, seznam má jména: ' + s.rows.join(' | '));
  await page.click('#waypointList .nav-stop:nth-child(1) .nav-stop-btn[title="Posunout níž"]'); await page.waitForTimeout(300); await settled(); s = await S();
  check(/49\.50/.test(s.rows[0]) && s.wp === 2, '▼ přeřadí zastávku');
  await undo(); s = await S(); check(/49\.95/.test(s.rows[0]), 'krok zpět vrátí pořadí');
  await page.click('#waypointList .nav-stop:nth-child(1) .nav-stop-del'); await page.waitForTimeout(300); await settled(); s = await S();
  check(s.via === 1 && s.wp === 1 && s.rows.length === 1 && s.rc > 1, '× smaže zastávku ze seznamu i z mapy');
  await undo(); s = await S(); check(s.via === 2 && s.wp === 2, 'krok zpět vrátí smazanou zastávku');
  await page.mouse.click(1500, 900); await page.keyboard.press('Backspace'); await page.waitForTimeout(300); await settled(); s = await S();
  check(s.via === 1 && s.wp === 1, 'Backspace smaže poslední zastávku');
  await undo(); s = await S(); check(s.via === 2 && s.rows.length === 2, 'krok zpět po Backspace');

  // ---- prohodit A↔B ----
  const before = await S();
  await page.click('#swapRouteBtn'); await page.waitForTimeout(300); await settled(); s = await S();
  check(s.a === before.b && s.b === before.a && s.A[0] === before.B[0] && /49\.50/.test(s.rows[0]) && s.rc > 1, 'prohození vymění start s cílem a obrátí zastávky');
  await undo(); s = await S(); check(s.a === before.a && s.A[0] === before.A[0], 'krok zpět vrátí prohození');

  // ---- tažení bodu A ----
  await idle(); let [ax, ay] = await px(s.A[0], s.A[1]);
  await page.mouse.move(ax, ay); await page.mouse.down();
  for(let i = 1; i <= 8; i++){ await page.mouse.move(ax - i * 6, ay - i * 5); await page.waitForTimeout(25); }
  await page.mouse.up(); await page.waitForTimeout(400); await settled(); const moved = await S();
  check(moved.A[0] < s.A[0] - 0.05 && moved.rc > 1 && moved.mk === 2, 'bod A jde přetáhnout a trasa se přepočítá');
  await undo(); const backA = await S(); check(Math.abs(backA.A[0] - s.A[0]) < 1e-6, 'krok zpět vrátí přetažený bod');

  // ---- smazání jednoho bodu vymazáním pole; klik ho doplní ----
  await page.fill('#endInput', ''); await page.waitForTimeout(300); s = await S();
  check(!s.B && s.rc === 0 && s.mk === 1 && s.sum === '', 'vymazané pole cíle smaže bod i čáru z mapy');
  await home(); await clickMap(16.2, 49.6); await routed(); s = await S();
  check(!!s.B && s.rc > 1 && s.mk === 2, 'klik do mapy doplní chybějící cíl a trasu najde');
  // výběr bodu + Delete
  await idle(); [ax, ay] = await px(s.A[0], s.A[1]); await page.mouse.click(ax, ay); await page.keyboard.press('Delete'); await page.waitForTimeout(300); s = await S();
  check(!s.A && !!s.B && s.rc === 0 && s.a === '', 'Delete smaže vybraný start');
  await undo(); s = await S(); check(!!s.A && s.rc > 1, 'krok zpět vrátí start i trasu');

  // ---- chybové stavy: řeknou co dál, nic nezůstane viset ----
  for(const [mode, re] of [['down', /neodpovídá.*znovu/i], ['503', /přetížen.*znovu/i], ['noroute', /nevede cesta.*(Posuň|doprav)/i]]){
    net.osrm = mode; await page.click('#findRouteBtn'); await page.waitForTimeout(300); await settled(); s = await S();
    check(re.test(s.status) && !s.busy && s.rc === 0 && s.sum === '' && s.mk === 2, `router ${mode}: „${s.status}", stará čára pryč, body zůstaly`);
  }
  net.osrm = 'ok'; await page.click('#findRouteBtn'); await routed(); s = await S();
  check(s.rc > 1 && /Trasa nalezena/.test(s.status), 'po chybě jde hned hledat znovu');
  // Smazat během hledání: pozdní odpověď nesmí trasu vrátit; ikonky scény zůstanou
  await page.evaluate(() => window.TNMAP.placeIcon({place:'49.6, 15.6', kind:'policie'})); await page.waitForTimeout(500);
  const iconsBefore = (await S()).icons;
  net.osrm = 'slow'; await page.click('#findRouteBtn'); await page.waitForTimeout(400);
  check((await S()).busy, 'při hledání je na tlačítku vidět, že pracuje');
  await page.click('#clearRouteBtn'); await page.waitForTimeout(3500); s = await S();
  check(!s.A && !s.B && s.rc === 0 && s.mk === 0 && s.wp === 0 && s.a === '' && !s.busy && /Trasa smazána/.test(s.status), 'Smazat během hledání: trasa se už neobjeví');
  check(iconsBefore >= 1 && s.icons === iconsBefore, 'Smazat u trasy nechá ikonky scény být');
  net.osrm = 'ok';
  await page.click('#findRouteBtn'); await page.waitForTimeout(400); s = await S();
  check(/Zadej start/.test(s.status) && !s.busy, 'Najít trasu bez bodů: ' + s.status);

  // ---- psaní: našeptávač, Enter, neznámé místo ----
  await page.fill('#startInput', 'Praha');
  await until(() => document.querySelectorAll('#startInputSuggest .nav-suggest-item').length > 0);
  await page.keyboard.press('Enter'); await page.waitForTimeout(300); s = await S();
  check(!!s.A && /Praha/.test(s.a) && s.mk === 1, 'našeptávač + Enter nastaví start');
  await page.fill('#endInput', 'Xyzzyq'); await page.keyboard.press('Enter');
  await until(() => /nenalezeno/.test(document.getElementById('statusBar').textContent)); s = await S();
  check(/„Xyzzyq“ nenalezeno.*(název|mapy)/.test(s.status) && !s.B && !s.busy, 'neznámé místo: ' + s.status);
  await page.fill('#endInput', 'Brno'); await page.keyboard.press('Enter'); await routed(); s = await S();
  check(!!s.B && /Brno/.test(s.b) && s.rc > 1, 'Enter hned po napsání cíle najde trasu');
  await undo(); s = await S(); check(!!s.A && !s.B && s.rc === 0, 'krok zpět po napsaném cíli vrátí jen cíl');
  await page.fill('#endInput', 'Brno'); await until(() => document.querySelectorAll('#endInputSuggest .nav-suggest-item').length > 0);
  await page.click('#endInputSuggest .nav-suggest-item'); await routed(); s = await S();
  check(!!s.B && s.rc > 1, 'klik na výsledek našeptávače najde trasu');

  // ---- všech 10 druhů dopravy: tlačítko, stav a mapa si odpovídají ----
  const modes = ['truck','moto','train','boat','foot','cycle','planeDirect','planeArc','driving'];
  const bad = [];
  for(const m of modes){
    await page.click(`.transport-btn[data-mode="${m}"]`); await page.waitForTimeout(300); await settled(); s = await S();
    const ok = s.active === m && s.mode === m && !s.busy && (m === 'boat'
      ? (s.rc === 0 && s.sum === '' && /Lodí to nejde/.test(s.status))
      : (s.rc > 1 && /km/.test(s.sum) && s.mk === 2));
    if(!ok) bad.push(m + ': ' + JSON.stringify({rc: s.rc, sum: s.sum, status: s.status, active: s.active}));
    if(m === 'train') check(/nádraží/.test(s.status) && !/ h /.test(s.sum), 'vlak: stanice ve stavu, délka bez doby jízdy: ' + s.status);
  }
  check(bad.length === 0, 'přepnutí dopravy s hotovou trasou přepočítá / vysvětlí' + (bad.length ? ' — ' + bad.join(' ; ') : ''));
  await page.click('#clearRouteBtn'); await page.click('.transport-btn[data-mode="cycle"]'); await page.waitForTimeout(300); s = await S();
  check(/zadej start a cíl/i.test(s.status) && !s.busy && s.rc === 0, 'doprava bez trasy řekne, co chybí: ' + s.status);
  await page.fill('#startInput', 'Praha'); await page.fill('#endInput', 'Brno'); await page.click('.transport-btn[data-mode="driving"]'); await routed(); s = await S();
  check(s.rc > 1 && /Praha/.test(s.a) && /Brno/.test(s.b), 'doprava s rozepsanými poli trasu rovnou najde');

  // ---- vlastní kreslená trasa ----
  await page.click('.transport-btn[data-mode="planeCustom"]'); await page.waitForTimeout(300); await home(); s = await S();
  check(!s.A && s.rc === 0 && /Vlastní trasa/.test(s.status) && await page.$eval('#addWaypointBtn', e => e.hidden), 'Vlastní: čistý začátek a nápověda ve stavu');
  await clickMap(14.5, 50.0); await clickMap(15.2, 49.9); await clickMap(15.8, 49.6); await clickMap(16.4, 49.3); s = await S();
  check(!!s.A && !s.B && s.via === 3 && s.wp === 3 && s.rows.length === 3 && s.rc === 4 && s.anim === 4, 'kreslení: start + 3 body, čára roste, seznam odpovídá mapě');
  await undo(); s = await S(); check(s.via === 2 && s.rc === 3 && s.wp === 2, 'krok zpět uprostřed kreslení ubere poslední bod');
  await page.mouse.click(1500, 900, {button: 'middle'}); await page.keyboard.press('Backspace'); await page.waitForTimeout(300); s = await S();
  check(s.via === 1 && s.rc === 2, 'Backspace uprostřed kreslení ubere další');
  await clickMap(15.8, 49.6); await idle();
  const [rx, ry] = await px(16.0, 49.9); await page.mouse.click(rx, ry, {button: 'right'}); await page.waitForTimeout(400); await settled(); s = await S();
  check(!!s.B && s.via === 1 && s.rc === 3 && s.mk === 2 && /km/.test(s.sum), 'pravé tlačítko trasu ukončí (poslední bod = cíl): ' + s.sum);
  await home(); await clickMap(15.0, 49.3); s = await S();
  check(!!s.B && s.rc === 3 && /hotová/.test(s.status), 'obyčejný klik hotovou trasu nesmaže');
  await undo(); s = await S(); check(!s.B && s.via === 2 && s.rc === 3, 'krok zpět vrátí jen ukončení');
  await page.click('#findRouteBtn'); await page.waitForTimeout(400); await settled(); s = await S();
  check(!!s.B && s.rc === 3, '„Najít trasu" rozkreslenou trasu dokončí');

  // ---- Vzhled trasy: každý prvek něco dělá ----
  await page.click('.transport-btn[data-mode="planeDirect"]'); await page.waitForTimeout(300); await settled();
  await page.click('#clearRouteBtn');
  const r0 = await page.evaluate(() => window.TNMAP.routeBetween({from:'50.08, 14.44', to:'49.2, 16.61', mode:'planeDirect'}));
  check(r0.ok, 'letecká trasa pro kontrolu vzhledu'); await page.waitForTimeout(1200); await home();
  await openSection(page, 'routeLookSection');
  const look = await page.evaluate(() => {
    const m = window.__tnMap, set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', {bubbles:true})); };
    const o = {};
    set('routeColor', '#ff0000'); o.color = m.getPaintProperty('route-anim-line', 'line-color');
    set('routeWidth', '9'); o.width = m.getPaintProperty('route-anim-line', 'line-width');
    set('routeDotColor', '#00ff00'); o.glowColor = m.getPaintProperty('route-anim-glow', 'line-color');
    set('routeGlow', '60'); o.glow = m.getPaintProperty('route-anim-glow', 'line-opacity');
    document.getElementById('routeLookMore').open = true;
    document.querySelector('.endpoint-shape[data-endpoint-shape="square"]').click(); o.square = document.querySelector('.route-dot.dot-a').classList.contains('shape-square');
    set('routeEndpointSize', '40'); o.size = document.querySelector('.route-dot.dot-a').style.width;
    return o; });
  check(look.color === '#ff0000' && look.width === 10 && look.glowColor === '#00ff00' && Math.abs(look.glow - 0.6) < 0.01 && look.square && look.size === '40px', 'barva, tloušťka, záře, tvar a velikost konců se projeví: ' + JSON.stringify(look));
  await page.evaluate(() => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', {bubbles:true})); }; set('routeColor', '#002ee6'); set('routeWidth', '6'); set('routeGlow', '0'); });

  // ---- „Předkreslit celou trasu": náhled, přehrávání, projekt, export PNG ----
  const seek = v => page.evaluate(v => { const e = document.getElementById('animScrub'); e.value = String(v); e.dispatchEvent(new Event('input', {bubbles:true})); }, v);
  await seek(500); await page.waitForTimeout(400); s = await S();
  check(s.ghost === 1 && s.anim >= 2, 'zapnuto: uprostřed animace je před objektem předkreslená trasa');
  await page.click('#routePreDraw'); await page.waitForTimeout(400); s = await S();
  check(s.ghost === 0 && s.anim >= 2 && /přehrání/.test(s.status), 'vypnuto: před objektem nic, za ním plná čára; stav: ' + s.status);
  const snap = await page.evaluate(() => { const f = window.__pzFns, sn = JSON.parse(JSON.stringify(f.serializeProjectSnapshot())); const pre = sn.route.preDraw; delete sn.route.preDraw;
    f.applyProjectSnapshot(sn, ''); const old = document.getElementById('routePreDraw').checked; sn.route.preDraw = false; f.applyProjectSnapshot(sn, ''); return {pre, old, now: document.getElementById('routePreDraw').checked}; });
  check(snap.pre === false && snap.old === true && snap.now === false, 'volba se ukládá do projektu; starý projekt bez pole = předkreslovat');
  await page.waitForTimeout(600);

  // export PNG uprostřed animace: úsek před objektem musí být prázdný (vypnuto) / s trasou (zapnuto)
  const exportDiff = async name => {
    await seek(500); await page.waitForTimeout(500); await idle();
    const geo = await page.evaluate(() => { const m = window.__tnMap, f = document.getElementById('exportFrame').getBoundingClientRect(), mr = document.getElementById('map').getBoundingClientRect();
      const P = t => { const p = m.project([14.44 + (16.61 - 14.44) * t, 50.08 + (49.2 - 50.08) * t]); return [(mr.left + p.x - f.left) / f.width, (mr.top + p.y - f.top) / f.height]; };
      return {ahead: [0.66, 0.72, 0.78, 0.84, 0.9].map(P), behind: [0.1, 0.2, 0.3, 0.4].map(P)}; });
    const dl = page.waitForEvent('download', {timeout: 180000}).catch(() => null);
    await page.evaluate(() => document.getElementById('exportPngBtn').click());
    const d = await dl; if(!d) return null;
    const file = path.join(OUT, name); await d.saveAs(file);
    const b64 = fs.readFileSync(file).toString('base64');
    return page.evaluate(async ({b64, geo}) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const off = Math.round(img.height * 0.03);
      // rozdíl barvy na trase proti místu kousek vedle (medián přes několik bodů)
      const diff = list => { const v = list.map(([u, w]) => { const x = Math.round(u * img.width), y = Math.round(w * img.height);
        const a = g.getImageData(x, y, 1, 1).data, b = g.getImageData(x, y - off, 1, 1).data; return Math.abs(a[0]-b[0]) + Math.abs(a[1]-b[1]) + Math.abs(a[2]-b[2]); }).sort((p, q) => p - q); return v[Math.floor(v.length / 2)]; };
      return {ahead: diff(geo.ahead), behind: diff(geo.behind), w: img.width};
    }, {b64, geo});
  };
  await tab(page, 'export');
  const off = await exportDiff('route_predraw_off.png');
  check(off && off.behind > 120 && off.ahead < 40, 'export PNG bez předkreslení: za objektem čára, před ním nic ' + JSON.stringify(off));
  await tab(page, 'trasa'); await page.click('#routePreDraw'); await page.waitForTimeout(300); await tab(page, 'export');
  const on = await exportDiff('route_predraw_on.png');
  check(on && on.behind > 120 && on.ahead > 60, 'export PNG s předkreslením: trasa je i před objektem ' + JSON.stringify(on));
  // v klidu na začátku není bez předkreslení vidět nic (body A/B zůstávají)
  await tab(page, 'trasa'); await page.click('#routePreDraw'); await page.click('#animStopBtn'); await page.waitForTimeout(500); s = await S();
  check(s.ghost === 0 && s.anim === 0 && s.mk === 2 && s.rc === 2, 'vypnuto a animace na začátku: čára žádná, body A/B zůstávají');
  await page.click('#routePreDraw'); await page.waitForTimeout(300); s = await S();
  check(s.ghost === 1 && /předkreslená/.test(s.status), 'zapnutí trasu zase ukáže celou');

  check(errors.length === 0, 'žádná chyba stránky' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await close(); done();
})();
