// Názvy podkladu uhnou grafice: náš popisek nad názvem z podkladu ho schová
// (queryRenderedFeatures v obdélníku bubliny nevrátí nic ze symbolových vrstev podkladu),
// stejnojmenný název vedle popisku zmizí, vypínač ve Vrstvách názvy vrátí, export funguje.
const {check, done, open} = require('./lib');

(async () => {
  const {page, errors, close} = await open();
  const settle = (ms = 1500) => page.waitForTimeout(ms);
  check(await page.evaluate(() => !!document.getElementById('basemapYield')?.checked), 'vypínač „Názvy podkladu uhnou grafice" je ve Vrstvách a výchozí zapnutý');
  await page.evaluate(() => window.__tnMap.jumpTo({center:[16.61, 49.2], zoom:7, pitch:0, bearing:0}));
  await page.evaluate(() => new Promise(r => { const m = window.__tnMap; if(m.loaded() && m.areTilesLoaded()) r(); else m.once('idle', r); setTimeout(r, 15000); }));
  await settle(1200);
  // název podkladu (bod) poblíž středu
  const target = await page.evaluate(() => {
    const m = window.__tnMap, ids = window.__pzFns.pzOccInfo(m).basemapSymbols, c = m.getCanvas().getBoundingClientRect();
    const fs = m.queryRenderedFeatures([[c.width / 2 - 300, c.height / 2 - 220], [c.width / 2 + 300, c.height / 2 + 220]], {layers: ids})
      .filter(f => f.geometry.type === 'Point' && (f.properties['name:cs'] || f.properties.name));
    const f = fs[0]; if(!f) return null;
    return {ll: f.geometry.coordinates, name: f.properties['name:cs'] || f.properties.name, layer: f.layer.id, ids};
  });
  check(!!target, 'v záběru je název z podkladu' + (target ? ' — ' + target.name + ' (' + target.layer + ')' : ''));
  if(!target){ await close(); return done(); }
  const add = await page.evaluate(t => window.TNMAP.addLabel({place: t.ll[1].toFixed(5) + ',' + t.ll[0].toFixed(5), text: 'Testovací popisek', side: 'none', fit: false}), target);
  check(add?.ok, 'popisek přidán přímo na název podkladu');
  await settle(1800);
  // názvy podkladu v obdélníku bubliny (s rezervou 2 px dovnitř)
  const inBox = () => page.evaluate(ids => {
    const m = window.__tnMap, c = m.getCanvas().getBoundingClientRect();
    const b = [...document.querySelectorAll('.map-label-marker .map-label-bubble')].find(e => e.textContent.trim() === 'Testovací popisek');
    if(!b) return -1;
    const r = b.getBoundingClientRect();
    return m.queryRenderedFeatures([[r.left - c.left + 2, r.top - c.top + 2], [r.right - c.left - 2, r.bottom - c.top - 2]], {layers: ids}).length;
  }, target.ids);
  const nameShown = n => page.evaluate(([ids, n]) => window.__tnMap.queryRenderedFeatures({layers: ids}).filter(f => (f.properties['name:cs'] || f.properties.name) === n).length, [target.ids, n]);
  const on = await inBox();
  check(on === 0, 'pod bublinou popisku není žádný název podkladu (' + on + ')');
  const info = await page.evaluate(() => window.__pzFns.pzOccInfo());
  check(info.layer && info.features > 0, 'zakrývač je ve stylu nad názvy podkladu (' + info.features + ' prvků)');
  // naše vrstvy zakrývač neschová: leží nad ním
  check(await page.evaluate(() => { const L = window.__tnMap.getStyle().layers.map(l => l.id), i = L.indexOf('pz-occ-zakryvac');
    return L.slice(0, i).every(id => !/^(scene-|pzuz-|pz-flags|pz-souprava|route-)/.test(id) || window.__tnMap.getLayer(id).type !== 'symbol'); }), 'vlastní symbolové vrstvy leží nad zakrývačem');
  // vypnout → názvy podkladu zpět
  await page.evaluate(() => { const c = document.getElementById('basemapYield'); c.checked = false; c.dispatchEvent(new Event('change', {bubbles: true})); });
  await settle(1500);
  const off = await inBox();
  check(off > 0, 'vypnutý vypínač vrátí názvy podkladu pod popiskem (' + off + ')');
  await page.evaluate(() => { const c = document.getElementById('basemapYield'); c.checked = true; c.dispatchEvent(new Event('change', {bubbles: true})); });
  await settle(1500);
  check(await inBox() === 0, 'znovu zapnuto → zase schované');
  // stejnojmenný název vedle našeho popisku zmizí
  const left = await page.evaluate(() => { const S = window.__pzFns.state; (S.mapLabels || []).forEach(it => it.marker?.remove()); S.mapLabels = []; return document.querySelectorAll('.map-label-marker').length; });
  await settle(1800);
  const n0 = await nameShown(target.name);
  check(n0 > 0, `bez popisků je název „${target.name}" z podkladu vidět (${n0}, popisků ${left})`);
  await page.evaluate(t => { const m = window.__tnMap, p = m.project(t.ll), ll = m.unproject([p.x + 140, p.y + 90]);
    return window.TNMAP.addLabel({place: ll.lat.toFixed(5) + ',' + ll.lng.toFixed(5), text: t.name, fit: false}); }, target);
  await settle(1800);
  const n1 = await nameShown(target.name);
  check(n1 === 0, `stejnojmenný název podkladu „${target.name}" vedle popisku zmizel (${n0} → ${n1})`);
  // export (stejná cesta jako PNG) proběhne a zakrývač má i exportní mapa
  const ex = await page.evaluate(async () => { const c = document.createElement('canvas'); const ok = await window.__pzFns.drawCurrentMapFrame(c); return {ok, w: c.width}; });
  check(ex.ok && ex.w > 0, 'snímek exportu s popisky se vykreslí (' + ex.w + ' px)');
  // projekt si vypínač pamatuje
  await page.evaluate(() => { document.getElementById('basemapYield').checked = false; const s = window.__pzFns.serializeProjectSnapshot(); document.getElementById('basemapYield').checked = true; window.__pzFns.applyProjectSnapshot(s); });
  await settle(2500);
  const snap = await page.evaluate(() => document.getElementById('basemapYield').checked);
  check(snap === false, 'vypnutý vypínač se uloží do projektu a načte');
  check(errors.length === 0, 'bez chyb na stránce' + (errors.length ? ' — ' + errors.slice(0, 3).join(' | ') : ''));
  await close();
  done();
})();
