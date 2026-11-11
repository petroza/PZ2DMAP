// Animace: stavy přehrávače, časová osa, kamera (sledování, přelet záběry, návrat po stopu),
// krok zpět po změně parametrů a uložení nastavení do projektu. Trasa je ze souřadnic
// a OSRM podvržený — test nepotřebuje geokódování.
const {check, done, open, tab, openSection, shot} = require('./lib');
const ROAD = [[14.42,50.08],[14.6,50.0],[14.9,49.8],[15.2,49.65],[15.6,49.43],[16.0,49.3],[16.4,49.2],[16.6,49.19]];
const near = (a, b, tol) => Math.abs(a - b) <= tol;

async function start(opts){
  const o = await open(opts);
  await o.ctx.route(/routing\.openstreetmap\.de|router\.project-osrm\.org/, r => r.fulfill({status:200, contentType:'application/json',
    body: JSON.stringify({code:'Ok', routes:[{geometry:{type:'LineString', coordinates:ROAD}, distance:205000, duration:7500, legs:[]}], waypoints:[]})}));
  const {page} = o;
  page.setDefaultTimeout(90000);   // vytížený stroj: kliknutí čeká na ustálení prvku i desítky sekund
  o.route = async () => { const r = await page.evaluate(() => window.TNMAP.routeBetween({from:'50.08, 14.42', to:'49.19, 16.6', mode:'driving'})); await page.waitForTimeout(1500); return r; };
  o.st = () => page.evaluate(() => { const s = window.__pzFns.state, g = id => document.getElementById(id);
    return {playing: s.animPlaying, elapsed: s.animElapsed, info: g('animInfo').textContent, scrub: +g('animScrub').value,
      playHidden: g('animPlayBtn').hidden, pauseHidden: g('animPauseBtn').hidden, barHidden: g('floatingPlayer').hidden,
      empty: g('floatingPlayer').classList.contains('is-empty'), tabPlaying: g('animTabPlayBtn').classList.contains('is-playing'),
      status: g('statusBar').textContent.trim()}; });
  o.cam = () => page.evaluate(() => { const m = window.__tnMap, c = m.getCenter(); return {lng:c.lng, lat:c.lat, zoom:m.getZoom(), pitch:m.getPitch(), bearing:m.getBearing()}; });
  o.anim = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__pzFns.serializeProjectSnapshot().animation)));
  o.playing = (want = true) => page.waitForFunction(w => window.__pzFns.state.animPlaying === w, want, {timeout: 20000}).then(() => true, () => false);
  o.elapsedOver = s => page.waitForFunction(s => window.__pzFns.state.animElapsed > s, s, {timeout: 20000}).then(() => true, () => false);
  // Přehraje do času `sec` a hned pozastaví — stroj bývá vytížený, kliknutí na Pauzu by přišlo pozdě.
  o.playUntil = async sec => { await page.click('#animPlayBtn'); return page.evaluate(sec => new Promise(res => { const F = window.__pzFns, t0 = Date.now();
    (function poll(){ if(F.state.animElapsed >= sec || !F.state.animPlaying || Date.now() - t0 > 20000){ F.pauseAnimation(); const m = window.__tnMap, c = m.getCenter();
      return res({elapsed: F.state.animElapsed, lng:c.lng, lat:c.lat, zoom:m.getZoom(), pitch:m.getPitch(), bearing:m.getBearing()}); } requestAnimationFrame(poll); })(); }), sec); };
  o.undo = () => page.evaluate(() => { document.activeElement?.blur?.(); return window.__pzUndo(); }).then(r => page.waitForTimeout(900).then(() => r));
  return o;
}
const sameCam = (a, b) => near(a.lng, b.lng, 0.002) && near(a.lat, b.lat, 0.002) && near(a.zoom, b.zoom, 0.02) && near(a.pitch, b.pitch, 0.5) && near(a.bearing, b.bearing, 0.5);

(async () => {
  const o = await start();
  const {page, errors} = o;
  let s, c;

  // ---- 1. bez trasy: nic rozbitého -----------------------------------------
  s = await o.st();
  check(s.barHidden, 'bez trasy je přehrávač mimo záložku Animace schovaný');
  await tab(page, 'animace'); await page.waitForTimeout(300);
  s = await o.st();
  check(!s.barHidden && s.empty && await page.$eval('#animScrub', e => e.disabled), 'v záložce Animace je přehrávač vidět, ale ztlumený');
  await page.click('#animTabPlayBtn'); await page.waitForTimeout(200);
  s = await o.st();
  check(!s.playing && /trasu/i.test(s.status), 'Přehrát bez trasy jen poradí: ' + s.status);
  const first = await page.evaluate(() => { const b = document.querySelector('.tab-pane[data-pane="animace"] .section-body'); const k = [...b.children].filter(e => e.offsetParent !== null);
    return [k[0]?.id, k[1]?.querySelector('label')?.textContent.trim()]; });
  check(first[0] === 'animTabPlayBtn' && /Délka animace/.test(first[1]), 'první v záložce je Přehrát a Délka animace');
  check(await page.$$eval('.tab-pane[data-pane="animace"] p.hint', e => e.length) === 0, 'v záložce nejsou vysvětlující odstavce');

  // ---- 2. přehrát → pauza → pokračovat → stop -------------------------------
  const r = await o.route();
  check(r.ok, 'trasa ze souřadnic (' + r.distanceKm + ' km)');
  await tab(page, 'scena'); await page.waitForTimeout(700);
  s = await o.st();
  check(!s.barHidden && !s.empty, 's trasou je přehrávač vidět na každé záložce');
  await tab(page, 'animace');
  await page.evaluate(() => window.TNMAP.setValues({animDuration: 120}));   // ať animace nedoběhne dřív, než test klikne
  await page.click('#animPlayBtn');
  check(await o.playing() && await o.elapsedOver(0.3), 'Přehrát spustí animaci');
  s = await o.st();
  check(s.playHidden && !s.pauseHidden && s.tabPlaying, 'při přehrávání je místo Přehrát tlačítko Pauza (i v záložce)');
  await page.click('#animPauseBtn'); await page.waitForTimeout(150);
  const paused = await o.st();
  await page.waitForTimeout(500);
  s = await o.st();
  check(!s.playing && s.elapsed === paused.elapsed && !s.playHidden && s.pauseHidden, `pauza drží čas (${s.info})`);
  await page.click('#animTabPlayBtn');
  check(await o.playing() && await o.elapsedOver(paused.elapsed + 0.2), 'Přehrát po pauze pokračuje od místa pauzy');
  s = await o.st();
  check(s.elapsed >= paused.elapsed, 'čas se po pokračování nevrátil na začátek');
  // „Na začátek“ při přehrávání: jede dál od nuly
  const before = (await o.st()).elapsed;
  await page.evaluate(() => document.getElementById('animRewindBtn').click()); await page.waitForTimeout(120);
  s = await o.st();
  check(s.playing && s.elapsed < before, `Na začátek při přehrávání pokračuje od nuly (${before.toFixed(1)} → ${s.elapsed.toFixed(1)} s)`);
  await page.click('#animStopBtn'); await page.waitForTimeout(200);
  s = await o.st();
  check(!s.playing && s.elapsed === 0 && s.scrub === 0 && /^0\.0 \/ 120\.0 s$/.test(s.info) && !s.playHidden, 'Stop vrátí na začátek: ' + s.info);

  // ---- 3. mezerník ----------------------------------------------------------
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Space');
  check(await o.playing(), 'mezerník spustí');
  await page.keyboard.press('Space'); await page.waitForTimeout(150);
  check(!(await o.st()).playing, 'mezerník pozastaví');
  await page.click('#animStopBtn');

  // ---- 4. časová osa --------------------------------------------------------
  const box = await page.$eval('#animScrub', e => { const b = e.getBoundingClientRect(); return {x:b.x, y:b.y + b.height / 2, w:b.width}; });
  await page.mouse.click(box.x + box.w * 0.5, box.y); await page.waitForTimeout(200);
  s = await o.st();
  check(!s.playing && near(s.elapsed, 60, 6) && /^\d\d\.\d \/ 120\.0 s$/.test(s.info), `klik do osy v klidu skočí na čas (${s.info})`);
  const mk = await page.evaluate(() => { const m = window.__pzFns.state.animatedMarker?.getLngLat(); return m ? [m.lng, m.lat] : null; });
  check(mk && mk[0] > 15.0 && mk[0] < 15.9, 'objekt stojí zhruba v půli trasy');
  // změna délky v půli animace zachová místo (např. 60/120 → 30/60)
  const half = s.elapsed / 120;
  await page.evaluate(() => window.TNMAP.setValues({animDuration: 60})); await page.waitForTimeout(150);
  s = await o.st();
  check(near(s.elapsed, half * 60, 0.05) && / \/ 60\.0 s$/.test(s.info), `změna délky zachová místo v animaci (${s.info})`);
  await page.evaluate(() => window.TNMAP.setValues({animDuration: 120}));
  // tažení během přehrávání: po puštění se pokračuje
  await page.click('#animStopBtn'); await page.click('#animPlayBtn'); await o.elapsedOver(0.2);
  await page.mouse.move(box.x + box.w * 0.6, box.y); await page.mouse.down();
  await page.mouse.move(box.x + box.w * 0.3, box.y, {steps: 3}); await page.waitForTimeout(250);
  const drag = await o.st();
  await page.waitForTimeout(300);
  s = await o.st();
  check(!s.playing && near(s.elapsed, 36, 6) && s.elapsed === drag.elapsed, `při tažení animace stojí na vybraném čase (${s.info})`);
  await page.mouse.up();
  check(await o.playing() && await o.elapsedOver(drag.elapsed + 0.2), 'po puštění osy přehrávání pokračuje');
  await page.click('#animStopBtn');
  await page.evaluate(() => window.TNMAP.setValues({animDuration: 8}));

  // ---- 5. konec animace + krajní hodnoty -------------------------------------
  let v = await page.evaluate(() => window.TNMAP.setValues({animDuration: 0.1}));
  check(v.changed.animDuration === 1 && (await o.anim()).animDuration === '1', 'délka 0,1 s se ořízne na 1 s');
  await page.click('#animPlayBtn');
  check(await o.playing(false), 'krátká animace doběhne');
  s = await o.st();
  check(near(s.elapsed, 1, 0.001) && s.scrub === 1000 && /dokončena/i.test(s.status) && !s.playHidden, 'na konci zůstane stát na konci: ' + s.info + ' · ' + s.status);
  const again = await page.evaluate(() => { document.getElementById('animPlayBtn').click(); const st = window.__pzFns.state; return {playing: st.animPlaying, elapsed: st.animElapsed}; });
  check(again.playing && again.elapsed === 0, 'Přehrát na konci začne znovu od začátku');
  await o.playing(false);
  // prodleva delší než délka
  await page.evaluate(() => { const e = document.getElementById('animStart'); e.value = '10'; e.dispatchEvent(new Event('input', {bubbles:true})); });
  await page.evaluate(() => window.__pzFns.seekAnimationToTime(9.5)); await page.waitForTimeout(150);
  s = await o.st();
  const atStart = await page.evaluate(() => { const m = window.__pzFns.state.animatedMarker?.getLngLat(); return m ? Math.hypot(m.lng - 14.42, m.lat - 50.08) < 0.01 : false; });
  check(/ \/ 11\.0 s$/.test(s.info) && atStart, 'prodleva 10 s + délka 1 s: během prodlevy objekt stojí na startu (' + s.info + ')');
  await page.click('#animPlayBtn');
  check(await o.playing(false) && near((await o.st()).elapsed, 11, 0.001), 'animace s dlouhou prodlevou doběhne');
  await page.evaluate(() => { const e = document.getElementById('animStart'); e.value = '0'; e.dispatchEvent(new Event('input', {bubbles:true})); window.TNMAP.setValues({animDuration: 8}); });
  await page.click('#animStopBtn');

  // ---- 6. náhled křivky odpovídá zvolenému průběhu ---------------------------
  const curves = await page.evaluate(() => [...document.getElementById('animEasing').options].map(op => {
    const sel = document.getElementById('animEasing'); sel.value = op.value; sel.dispatchEvent(new Event('change', {bubbles:true}));
    const pts = document.getElementById('easingPreviewLine').getAttribute('points').trim().split(/\s+/).map(p => p.split(',').map(Number));
    const q = pts[6];   // čtvrtina času (bod 6 z 24)
    return {mode: op.value, drawn: (40 - q[1]) / 36, real: window.__pzFns.applyAnimEasing(0.25)}; }));
  check(curves.length === 4 && curves.every(k => near(k.drawn, k.real, 0.01)) && new Set(curves.map(k => k.drawn.toFixed(2))).size === 4,
    'náhled křivky odpovídá průběhu rychlosti: ' + curves.map(k => k.mode + ' ' + k.drawn.toFixed(2)).join(', '));
  await page.evaluate(() => { const sel = document.getElementById('animEasing'); sel.value = 'linear'; sel.dispatchEvent(new Event('change', {bubbles:true})); });

  // ---- 7. kamera sleduje objekt a po stopu / přepnutí se vrátí ---------------
  await openSection(page, 'cameraAnimSection');
  const home = await o.cam();
  await page.click('[data-cammode2="follow"]'); await page.waitForTimeout(300);
  c = await o.cam();
  check(near(c.pitch, 45, 0.5) && near(c.lng, 14.42, 0.01) && near(c.lat, 50.08, 0.01), 'Sleduje objekt: kamera se nakloní nad start trasy');
  await page.evaluate(() => window.TNMAP.setValues({cameraPitch: 60})); await page.waitForTimeout(200);
  check(near((await o.cam()).pitch, 60, 0.5), 'náklon kamery se projeví hned, bez přehrání');
  await page.click('#followCameraRotate'); await page.waitForTimeout(300);
  check(Math.abs((await o.cam()).bearing) > 20 && await page.$eval('#camHeadingSmoothField', e => e.offsetParent !== null), 'otáčení podle směru jízdy natočí kameru a ukáže plynulost natáčení');
  c = await o.playUntil(2);
  check(c.lng > 14.5 && near(c.pitch, 60, 0.5), `při přehrávání kamera jede s objektem (${c.elapsed.toFixed(1)} s, ${c.lng.toFixed(2)}°)`);
  await page.click('#animStopBtn'); await page.waitForTimeout(300);
  const stopped = await o.cam();
  check(near(stopped.lng, 14.42, 0.01) && near(stopped.lat, 50.08, 0.01) && near(stopped.pitch, 60, 0.5), 'po stopu se sledující kamera vrátí na první snímek');
  await page.click('#followCameraRotate'); await page.waitForTimeout(300);
  check(near((await o.cam()).bearing, home.bearing, 0.5) && await page.$eval('#camHeadingSmoothField', e => e.offsetParent === null), 'vypnutí otáčení kameru srovná');
  // skrytý objekt: kamera se po stopu vrátí taky
  await page.evaluate(() => document.getElementById('animDot').click());
  c = await o.playUntil(2);
  await page.click('#animStopBtn'); await page.waitForTimeout(300);
  const back = await o.cam();
  check(c.lng > 14.5 && near(back.lng, 14.42, 0.01) && near(back.lat, 50.08, 0.01), 'se skrytým objektem se kamera po stopu vrátí na start');
  await page.evaluate(() => document.getElementById('animDot').click());
  await page.click('[data-cammode2="static"]'); await page.waitForTimeout(300);
  c = await o.cam();
  check(sameCam(c, home), `návrat na Statickou vrátí původní záběr (náklon ${c.pitch.toFixed(0)}°, zoom ${c.zoom.toFixed(2)})`);

  // ---- 8. přelet kamery přes záběry ------------------------------------------
  await page.click('[data-cammode2="keyframes"]'); await page.waitForTimeout(200);
  check(/Přidat záběr/.test((await o.st()).status), 'Přelet bez záběrů poradí, co dál');
  const views = [{center:[14.5,50.05], zoom:9, pitch:0, bearing:0}, {center:[16.6,49.19], zoom:11, pitch:50, bearing:40}, {center:[15.6,49.4], zoom:8.5, pitch:20, bearing:-20}];
  for(const vw of views){ await page.evaluate(vw => window.__tnMap.jumpTo(vw), vw); await page.click('#cameraAddKeyframeBtn'); await page.waitForTimeout(120); }
  const rows = () => page.$$eval('#cameraKeyframeList .camera-kf-info', e => e.map(x => x.textContent));
  let rw = await rows();
  check(rw.length === 3 && /^0\.0 s · zoom 9\.0$/.test(rw[0]) && /^4\.0 s · zoom 11\.0 · 50°$/.test(rw[1]) && /^8\.0 s/.test(rw[2]), 'tři záběry s časy: ' + rw.join(' | '));
  await page.click('#cameraKeyframeList .camera-kf-row:nth-child(3) .kf-up'); await page.waitForTimeout(150);
  rw = await rows();
  check(/zoom 8\.5/.test(rw[1]) && /zoom 11\.0/.test(rw[2]) && /^4\.0 s/.test(rw[1]), 'záběr jde přeřadit: ' + rw.join(' | '));
  await o.undo();
  rw = await rows();
  check(/zoom 11\.0/.test(rw[1]) && /zoom 8\.5/.test(rw[2]), 'krok zpět vrátí pořadí záběrů');
  await page.click('#cameraKeyframeList .camera-kf-row:nth-child(3) .kf-del'); await page.waitForTimeout(150);
  rw = await rows();
  check(rw.length === 2 && /^8\.0 s · zoom 11\.0/.test(rw[1]), 'záběr jde odebrat, časy se přepočítají');
  await page.evaluate(() => window.__tnMap.jumpTo({center:[15,49.6], zoom:7, pitch:0, bearing:0}));   // grafik si mapu posunul jinam
  c = await o.playUntil(3.5);
  check(c.elapsed < 7.5 && c.lng > 14.6 && c.lng < 16.6 && c.pitch > 3, `přelet hýbe kamerou mezi záběry (${c.elapsed.toFixed(1)} s: ${c.lng.toFixed(2)}°, náklon ${c.pitch.toFixed(0)}°)`);
  await page.click('#animStopBtn'); await page.waitForTimeout(300);
  c = await o.cam();
  check(sameCam(c, {lng:14.5, lat:50.05, zoom:9, pitch:0, bearing:0}), 'po stopu se kamera vrátí na první záběr');
  // oddálení uprostřed přeletu jde vypnout
  const mid = () => page.evaluate(() => window.__pzFns.getCameraStateAtProgress(0.5).zoom);
  const zArc = await mid();
  await page.click('#cameraMoreDetails > summary'); await page.click('#cameraArc'); await page.waitForTimeout(150);
  const zFlat = await mid();
  check(near(zFlat, 10, 0.01) && zArc < zFlat - 0.5, `„Oddálit při přeletu“: zoom v půli ${zArc.toFixed(2)} → ${zFlat.toFixed(2)}`);
  await page.click('#cameraArc');
  // přelet funguje i bez trasy
  const keep = await o.anim();
  await page.evaluate(() => window.TNMAP.clearRoute()); await page.waitForTimeout(300);
  s = await o.st();
  check(!s.empty && (await o.anim()).camera.keyframes.length === 2, 'bez trasy zůstane přelet připravený a přehrávač aktivní');
  c = await o.playUntil(3.5);
  check(c.elapsed >= 3.5 && c.lng > 14.6, 'přelet se přehraje i bez trasy');
  await page.click('#animStopBtn');
  await page.click('[data-cammode2="static"]'); await page.waitForTimeout(300);
  check(sameCam(await o.cam(), home), 'z Přeletu zpět na Statickou: původní záběr');
  check((await o.st()).empty, 'bez trasy a bez přeletu je přehrávač zase ztlumený');
  // starší projekty: start + cíl → dva záběry
  const legacy = await page.evaluate(() => { const n = window.__pzFns.normalizeCameraAnim, a = {center:[14,50], zoom:8, pitch:0, bearing:0}, b = {center:[16,49], zoom:10, pitch:30, bearing:10};
    return [n({enabled:true, mode:'flyTo', start:a, end:b, keyframes:[]}), n({enabled:true, mode:'zoom', start:a, end:b}), n(undefined)]; });
  check(legacy[0].keyframes.length === 2 && legacy[0].arc === true && legacy[0].keyframes[1].view.zoom === 10 && legacy[1].arc === false && legacy[2].keyframes.length === 0 && !legacy[2].enabled,
    'starší projekt (Přelet / Zoom se startem a cílem) se převede na dva záběry');

  // ---- 9. krok zpět vrací jednu změnu -----------------------------------------
  await o.route();
  await page.evaluate(() => document.querySelector('.sidebar-content').scrollTop = 0);
  await page.fill('#animDurationNum', '12'); await page.keyboard.press('Tab'); await page.waitForTimeout(150);
  check((await o.anim()).animDuration === '12' && / \/ 12\.0 s$/.test((await o.st()).info), 'délka jde zadat číslem (12 s)');
  const sl = await page.$eval('#animDuration', e => { const b = e.getBoundingClientRect(); return {x:b.x, y:b.y + b.height / 2, w:b.width}; });
  await page.mouse.click(sl.x + sl.w * 0.5, sl.y); await page.waitForTimeout(150);
  const dragged = (await o.anim()).animDuration;
  check(+dragged > 60 && await page.$eval('#animDurationNum', e => e.value) === dragged, `posuvník délky (${dragged} s) přepíše i číslo`);
  await page.focus('#animEasing'); await page.selectOption('#animEasing', 'easeOut'); await page.waitForTimeout(150);
  await o.undo();
  let a = await o.anim();
  check(a.animEasing === 'linear' && a.animDuration === dragged, 'krok zpět 1: vrátí jen průběh rychlosti');
  check(await page.evaluate(() => { const p = document.getElementById('easingPreviewLine').getAttribute('points').trim().split(/\s+/)[6].split(','); return Math.abs((40 - p[1]) / 36 - 0.25) < 0.01; }), 'náhled křivky se po kroku zpět překreslí');
  await o.undo();
  check((await o.anim()).animDuration === '12', 'krok zpět 2: vrátí jen tah posuvníkem');
  await o.undo();
  a = await o.anim();
  check(a.animDuration === '8' && await page.$eval('#animDurationNum', e => e.value) === '8', 'krok zpět 3: vrátí číslo zadané z klávesnice');
  await page.click('#animMoreDetails > summary');
  await page.click('#showTrail'); await page.waitForTimeout(100);
  await page.click('[data-cammode2="follow"]'); await page.waitForTimeout(250);
  await o.undo();
  a = await o.anim();
  check(a.followCamera === false && a.showTrail === false && await page.$eval('[data-cammode2="static"]', e => e.classList.contains('active')), 'krok zpět vrátí režim kamery, zaškrtávátko nechá');
  await o.undo();
  check((await o.anim()).showTrail === true, 'další krok zpět vrátí zaškrtávátko');

  // ---- 10. uložení a načtení projektu ------------------------------------------
  await page.evaluate(() => { const set = (id, val) => { const e = document.getElementById(id); e.value = String(val); e.dispatchEvent(new Event('input', {bubbles:true})); };
    set('animDuration', 14); set('animStart', 2.5); set('objSmooth', 30); set('cameraPitch', 55); set('camHeadingSmooth', 40);
    const sel = document.getElementById('animEasing'); sel.value = 'easeInOut'; sel.dispatchEvent(new Event('change', {bubbles:true}));
    document.getElementById('animDot').click(); document.getElementById('showTrail').click(); });
  await page.click('[data-cammode2="follow"]'); await page.click('#followCameraRotate');
  const follow = await o.anim();
  await page.click('[data-cammode2="keyframes"]');
  await page.click('#cameraClearKeyframesBtn'); await page.waitForTimeout(100);
  check(await page.$$eval('#cameraKeyframeList .camera-kf-row', e => e.length) === 0 && await page.$eval('#cameraClearKeyframesBtn', e => e.disabled), '„Smazat vše“ odstraní záběry');
  for(const vw of views.slice(0, 2)){ await page.evaluate(vw => window.__tnMap.jumpTo(vw), vw); await page.click('#cameraAddKeyframeBtn'); await page.waitForTimeout(100); }
  await page.click('#cameraArc');
  const flight = await page.evaluate(() => JSON.parse(JSON.stringify(window.__pzFns.serializeProjectSnapshot())));
  const pick = an => JSON.stringify([an.animStart, an.animDuration, an.animEasing, an.objSmooth, an.cameraPitch, an.camHeadingSmooth, an.animDot, an.showTrail, an.followCamera, an.followCameraRotate, an.camera]);
  check(flight.animation.objSmooth === '30' && flight.animation.camera.keyframes.length === 2 && flight.animation.camera.arc === false && flight.animation.camera.enabled, 'projekt obsahuje plynulost pohybu i záběry kamery');
  // rozházet a načíst zpět
  await page.evaluate(() => { const blank = JSON.parse(JSON.stringify(window.__pzFns.serializeProjectSnapshot()));
    blank.animation = {...blank.animation, animStart:'0', animDuration:'8', animEasing:'linear', objSmooth:'0', cameraPitch:'45', camHeadingSmooth:'80', animDot:true, showTrail:true, followCamera:false, followCameraRotate:false, camera:{enabled:false, mode:'flyTo', start:null, end:null, keyframes:[]}};
    window.__pzFns.applyProjectSnapshot(blank); }); await page.waitForTimeout(900);
  a = await o.anim();
  check(a.animDuration === '8' && a.camera.keyframes.length === 0 && !a.camera.enabled && await page.$eval('[data-cammode2="static"]', e => e.classList.contains('active')), 'výchozí stav po načtení prázdného nastavení');
  await page.evaluate(snap => window.__pzFns.applyProjectSnapshot(snap), flight); await page.waitForTimeout(900);
  a = await o.anim();
  check(pick(a) === pick(flight.animation), 'načtení projektu vrátí všechna nastavení animace a přeletu');
  const ui = await page.evaluate(() => ({num: document.getElementById('animDurationNum').value, start: document.getElementById('animStartNum').value, smooth: document.getElementById('objSmoothNum').value,
    mode: document.querySelector('.camera-mode2-btn.active')?.dataset.cammode2, rows: document.querySelectorAll('#cameraKeyframeList .camera-kf-row').length,
    arc: document.getElementById('cameraArc').checked, info: document.getElementById('animInfo').textContent, last: document.querySelector('#cameraKeyframeList .camera-kf-row:last-child .camera-kf-info')?.textContent}));
  check(ui.num === '14' && ui.start === '2.5' && ui.smooth === '30' && ui.mode === 'keyframes' && ui.rows === 2 && ui.arc === false && / \/ 16\.5 s$/.test(ui.info) && /^16\.5 s/.test(ui.last),
    'ovládací prvky po načtení odpovídají projektu: ' + JSON.stringify(ui));
  await page.evaluate(snap => { snap.animation = {...snap.animation, ...snap.__follow}; window.__pzFns.applyProjectSnapshot(snap); }, {...flight, __follow: follow}); await page.waitForTimeout(900);
  a = await o.anim();
  check(pick(a) === pick(follow) && a.followCamera && a.followCameraRotate && await page.$eval('[data-cammode2="follow"]', e => e.classList.contains('active')), 'načtení projektu vrátí sledování kamerou');
  // starý projekt bez nových polí a s dvoubodovým přeletem
  await page.evaluate(snap => { const an = snap.animation; delete an.objSmooth; an.followCamera = true;
    an.camera = {enabled:true, mode:'flyTo', start:{center:[14,50], zoom:8, pitch:0, bearing:0}, end:{center:[16,49], zoom:10, pitch:30, bearing:10}, keyframes:[]};
    window.__pzFns.applyProjectSnapshot(snap); }, flight); await page.waitForTimeout(900);
  a = await o.anim();
  check(a.objSmooth === '0' && a.camera.keyframes.length === 2 && a.camera.arc === true && a.followCamera === false && await page.$eval('[data-cammode2="keyframes"]', e => e.classList.contains('active')),
    'starý projekt se načte: start + cíl jako dva záběry, přelet má přednost před sledováním');

  check(errors.length === 0, 'žádná chyba stránky' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  await o.close();

  // ---- 11. vzhled: posuvníky se nedotýkají popisků, přehrávač nic nepřekrývá ----
  for(const [w, h, theme] of [[1280, 800, 'dark'], [1600, 950, 'light'], [1024, 720, 'light']]){
    const q = await start({viewport:{width:w, height:h}, theme});
    await q.route();
    await tab(q.page, 'animace');
    await q.page.click('#animMoreDetails > summary');
    await openSection(q.page, 'cameraAnimSection');
    await q.page.click('[data-cammode2="follow"]'); await q.page.click('#followCameraRotate'); await q.page.waitForTimeout(300);
    const touch = await q.page.evaluate(() => { const pane = document.querySelector('.tab-pane[data-pane="animace"]'), out = [];
      const texts = [...pane.querySelectorAll('label, summary, .check, select, .anim-num')].filter(e => e.offsetParent !== null).map(e => e.getBoundingClientRect());
      for(const r of pane.querySelectorAll('input[type=range]')){ if(r.offsetParent === null) continue; const b = r.getBoundingClientRect();
        const top = b.top + b.height / 2 - 8, bottom = b.top + b.height / 2 + 8;   // jezdec je vysoký 16 px
        for(const tr of texts){ if(tr.right < b.left || tr.left > b.right) continue; const gap = tr.bottom <= b.top ? top - tr.bottom : tr.top - bottom; if(gap < 3) out.push(r.id + ' ' + gap.toFixed(1)); } }
      return out; });
    check(touch.length === 0, `${w}px ${theme}: jezdce posuvníků mají odstup od popisků` + (touch.length ? ' — ' + touch.join(', ') : ''));
    const lay = await q.page.evaluate(() => { const rect = sel => { const e = document.querySelector(sel); if(!e || e.offsetParent === null) return null; const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; };
      const p = rect('.floating-player .player-controls'), hit = (a, b) => a && b && Math.min(a[2], b[2]) - Math.max(a[0], b[0]) > 2 && Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > 2;
      const info = document.getElementById('animInfo'), cs = getComputedStyle(info);
      return {p, status: hit(p, rect('#statusBar')), fab: hit(p, rect('.tnchat-fab')), side: hit(p, rect('.sidebar')), inside: p && p[0] >= 0 && p[2] <= innerWidth && p[3] <= innerHeight,
        oneLine: info.getBoundingClientRect().height < 22, scrubW: document.getElementById('animScrub').getBoundingClientRect().width}; });
    check(lay.p && lay.inside && !lay.status && !lay.fab && !lay.side && lay.oneLine && lay.scrubW >= 100,
      `${w}px ${theme}: přehrávač nepřekrývá stavový řádek, panel ani asistenta (osa ${Math.round(lay.scrubW)} px)`);
    await shot(q.page, `23_animace_${w}_${theme}.png`);
    check(q.errors.length === 0, `${w}px ${theme}: žádná chyba stránky`);
    await q.close();
  }
  done();
})();
