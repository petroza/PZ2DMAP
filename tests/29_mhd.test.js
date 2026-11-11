// MHD: trasa metrem (linky A/B/C, stanice podle jména, přestupy, barva linky)
// a tramvají (Praha i Brno). Vše offline — síť je přibalená, jména stanic se
// nehledají přes vyhledávání míst.
const {check, done, open, tab} = require('./lib');
(async () => {
  const {page, errors, close} = await open();
  await tab(page, 'trasa');
  const route = (from, to, mode) => page.evaluate(([from, to, mode]) => window.TNMAP.routeBetween({from, to, mode}), [from, to, mode]);
  const info = () => page.evaluate(() => ({status: document.getElementById('statusBar').textContent, n: window.__pzFns.state.routeCoords.length,
    color: document.getElementById('routeColor').value.toLowerCase(), icon: window.__pzFns.state.animSystemIcon,
    a: document.getElementById('startInput').value, b: document.getElementById('endInput').value,
    btns: [...document.querySelectorAll('.transport-btn')].map(b => b.dataset.mode)}));
  const user = await page.evaluate(() => document.getElementById('routeColor').value.toLowerCase());

  let r = await route('Zličín', 'Černý Most', 'metro'), i = await info();
  check(i.btns.includes('metro') && i.btns.includes('tram'), 'Doprava má tlačítka Metro a Tramvaj');
  check(r.ok && i.n > 50 && /linka B$/.test(i.status) && i.color === '#f5c400' && i.icon === 'metro', 'metro Zličín → Černý Most: linka B, žlutá trasa, souprava metra — ' + i.status);
  r = await route('Anděl', 'Hlavní nádraží', 'metro'); i = await info();
  check(r.ok && /B → C/.test(i.status) && i.color === user, 'metro s přestupem B → C vrátí původní barvu trasy — ' + i.status + ' ' + i.color);
  r = await route('Háje', 'Dejvická', 'metro'); i = await info();
  check(r.ok && i.a === 'Háje' && i.b === 'Dejvická' && /C → A/.test(i.status), 'stanice „Háje" se najde v Praze (ne u Příbrami), pole ukazují jména stanic — ' + i.a + ' / ' + i.status);
  r = await route('50.0755,14.3419', '50.0748,14.5150', 'metro'); i = await info();
  check(r.ok && i.a === 'Nemocnice Motol' && i.b === 'Depo Hostivař' && /linka A$/.test(i.status) && i.color === '#00a562', 'kliknutí u stanice → nejbližší stanice, linka A zeleně — ' + i.status);
  r = await route('49.1951,16.6068', '49.2134,16.58', 'metro'); i = await info();
  check(r.ok === false && /jen v Praze/.test(r.error), 'metro mimo Prahu řekne proč nejde');
  r = await route('50.0755,14.4185', '50.1036,14.4740', 'tram'); i = await info();
  check(r.ok && i.n > 10 && i.icon === 'tram' && i.color === user, 'tramvaj v Praze najde trasu po kolejích, tramvaj na trase — ' + i.status);
  r = await route('49.1951,16.6068', '49.2134,16.58', 'tram'); i = await info();
  check(r.ok && i.n > 5, 'tramvaj v Brně — ' + i.status);
  r = await route('49.5,15.5', '49.6,15.6', 'tram');
  check(r.ok === false && /Tramvají to nejde/.test(r.error), 'tramvaj mimo koleje řekne proč nejde');
  // přehrání: souprava jede po trase
  await route('Zličín', 'Háje', 'metro');
  await page.waitForFunction(() => { const F = window.__pzFns, m = window.__tnMap; F.setAnimProgress(0.5); return (m.getSource('pz-souprava')?.serialize?.().data?.features || []).length === 2; }, null, {timeout: 15000, polling: 500}).catch(() => {});
  const ride = await page.evaluate(() => { const F = window.__pzFns, m = window.__tnMap; F.setAnimProgress(0.5); const f = m.getSource('pz-souprava')?.serialize?.().data?.features || []; return f.length; });
  check(ride === 2, 'metro jede jako souprava (2 vlečené vozy)');
  check(!errors.length, 'bez chyb v konzoli ' + errors.join(' | '));
  await close(); done();
})();
