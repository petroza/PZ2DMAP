// Bohatá scéna → Uložit projekt → nový prohlížeč → Načíst → beze ztrát.
const {check, done, open} = require('./lib');
const norm = s => { const o = JSON.parse(JSON.stringify(s, (k, v) => k === 'id' && typeof v === 'string' && /^(scene|label)_/.test(v) ? undefined : v));
  delete o.view; delete o.savedAt; delete o.updatedAt; delete o.createdAt; return o; };
function diff(a, b, p = '', out = []){ if(JSON.stringify(a) === JSON.stringify(b)) return out;
  if(a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a)){ for(const k of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[k], b[k], p + '.' + k, out); }
  else out.push(p); return out; }
(async () => {
  const store = {};
  const A = await open({store});
  const r = await A.page.evaluate(async () => { const T = window.TNMAP, o = {};
    o.route = (await T.routeBetween({from:'Praha', to:'Plzeň', mode:'train'})).ok;
    o.metro = (await T.metroClosure({line:'B', from:'Anděl', to:'Smíchovské nádraží', fit:false})).ok;
    o.arrow = (await T.drawArrow({from:'Beroun', to:'Rokycany', color:'#ff0000', fit:false})).ok;
    o.label = (await T.addLabel({place:'Plzeň', text:'VÝLUKA'})).ok;
    document.getElementById('mapLabelStyle').value = 'red'; document.getElementById('mapLabelStyle').dispatchEvent(new Event('change', {bubbles:true}));
    o.icon = (await T.placeIcon({place:'Rokycany', kind:'nehoda'})).ok;
    o.perim = (await T.drawPerimeter({place:'Beroun', km:5, fit:false})).ok;
    o.col = (await T.colorPolitical({region:'Plzeňský kraj', color:'#3366ff', fit:false})).ok;
    o.vals = T.setValues({routeWidth:7, routeGlow:30, animDuration:12}).ok;
    return o; });
  check(Object.values(r).every(Boolean), 'scéna postavena: ' + JSON.stringify(r));
  await A.page.waitForTimeout(2000);
  await A.page.click('.tab-btn[data-tab="projekt"]'); await A.page.fill('#projectName', 'ZZ test roundtrip');
  await A.page.click('#saveProjectBtn'); await A.page.waitForTimeout(3000);
  const snapA = (store.projects || []).find(x => x.name === 'ZZ test roundtrip')?.snapshot;
  check(!!snapA, 'projekt se uložil');
  await A.close();
  const B = await open({store, wait: 6000});
  await B.page.click('.tab-btn[data-tab="projekt"]'); await B.page.waitForTimeout(500);
  const opt = (await B.page.$$eval('#savedProjectSelect option', o => o.map(x => [x.value, x.textContent]))).find(o => /ZZ test roundtrip/.test(o[1]));
  check(!!opt, 'projekt je v seznamu');
  if(opt){ await B.page.selectOption('#savedProjectSelect', opt[0]); await B.page.click('#loadProjectBtn'); await B.page.waitForTimeout(6000); }
  await B.page.fill('#projectName', 'ZZ test roundtrip B'); await B.page.click('#saveProjectBtn'); await B.page.waitForTimeout(3000);
  const snapB = (store.projects || []).find(x => x.name === 'ZZ test roundtrip B')?.snapshot;
  const d = snapA && snapB ? diff(norm(snapA), norm(snapB)) : ['chybí snímek'];
  check(d.length === 0, 'načtený projekt = uložený' + (d.length ? ' (rozdíly: ' + d.slice(0, 8).join(', ') + ')' : ''));
  check(B.errors.length === 0 && A.errors.length === 0, 'žádná chyba stránky');
  await B.close(); done();
})();
