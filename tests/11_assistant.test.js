// Asistent bez spotřeby limitu Workers AI: rychlé povely (bez dotazu na model)
// a doplnění délky trasy / vzdálenosti bez druhého kola (odpovědi modelu podvržené).
const {check, done, open} = require('./lib');
const PLANS = {
  'vlak praha brno': {say:'Kreslím trasu vlakem.', calls:[{tool:'routeBetween', args:{from:'Praha', to:'Brno', mode:'train'}, label:'Vlak'}], done:false},
  'kolik je to do kyjeva': {say:'Měřím.', calls:[{tool:'measureDistance', args:{from:'Praha', to:'Kyjev'}, label:'Měření'}], done:false},
  'chyba': {say:'Kreslím trasu.', calls:[{tool:'routeBetween', args:{from:'Xqzwyvxqq', to:'Brno', mode:'train'}, label:'Trasa'}], done:false},
};
(async () => {
  const {page, ctx, errors, close} = await open();
  page.setDefaultTimeout(120000);   // vytížený stroj: překreslení mapy umí zdržet i obyčejné psaní do pole
  let n = 0, lastQ = '';
  await ctx.route(/tnmap-chat/, r => { n++; const b = JSON.parse(r.request().postData() || '{}');
    const resp = (b.toolResults && b.toolResults.length) ? {say:'(druhé kolo)', calls:[], done:true} : (PLANS[lastQ] || {say:'?', calls:[], done:true});
    r.fulfill({status:200, contentType:'application/json', body: JSON.stringify(resp)}); });
  // Geokodér jen pro místa z rychlého povelu „nehoda v …" (ostatní dotazy jdou na skutečnou službu).
  const GEO = {Humpolec: [{lat:'49.5415', lon:'15.3593', name:'Humpolec', display_name:'Humpolec, okres Pelhřimov, Česko'}]};
  await ctx.route(/nominatim\.openstreetmap\.org\/search/, r => { const q = new URL(r.request().url()).searchParams.get('q') || '';
    if(GEO[q]) return r.fulfill({status:200, contentType:'application/json', body: JSON.stringify(GEO[q])});
    if(/^(Humpol|Xqzw)/.test(q)) return r.fulfill({status:200, contentType:'application/json', body:'[]'});
    return r.continue(); });
  await ctx.route(/photon\.komoot\.io/, r => /q=(Humpol|Xqzw)/.test(r.request().url()) ? r.fulfill({status:200, contentType:'application/json', body:'{"features":[]}'}) : r.continue());
  await page.click('.tnchat-fab'); await page.waitForTimeout(300);
  const ask = async q => { lastQ = q; n = 0; await page.fill('#tnchatInput', q); await page.press('#tnchatInput', 'Enter');
    await page.waitForFunction(() => !document.getElementById('tnchatSend').disabled, null, {timeout: 60000}).catch(() => {}); await page.waitForTimeout(600);
    return page.$$eval('.tnchat-msg.bot', e => e[e.length - 1].textContent); };
  for(const [q, check_] of [['satelit', () => page.$eval('#baseStyle', e => e.value === 'satellite')], ['Zpět!', () => page.$eval('#baseStyle', e => e.value !== 'satellite')],
      ['zapni glóbus', () => page.$eval('#globeProjection', e => e.checked)], ['vypni glóbus', () => page.$eval('#globeProjection', e => !e.checked)],
      ['otevři export', () => page.$eval('.tab-btn[data-tab="export"]', e => e.classList.contains('active'))]]){
    await ask(q); check(n === 0 && await check_(), `rychlý povel „${q}" bez dotazu na model`);
  }
  // --- další rychlé povely: žádný z nich nesmí stát dotaz na model -----------------
  const scene = () => page.evaluate(() => window.TNMAP.getState().scene);
  const zoom = () => page.evaluate(() => window.__tnMap.getZoom());
  let m;
  await ask('prepni na svetly rezim'); check(n === 0 && await page.evaluate(() => document.documentElement.dataset.ui === 'light'), 'rychlý povel „prepni na svetly rezim" (bez diakritiky)');
  await ask('tmavý režim'); check(n === 0 && await page.evaluate(() => document.documentElement.dataset.ui !== 'light'), 'rychlý povel „tmavý režim"');
  await ask('anglicky'); await page.waitForTimeout(500); check(n === 0 && await page.evaluate(() => document.documentElement.lang === 'en'), 'rychlý povel „anglicky" přepne jazyk');
  await ask('přepni do češtiny'); await page.waitForTimeout(500); check(n === 0 && await page.evaluate(() => document.documentElement.lang === 'cs'), 'rychlý povel „přepni do češtiny"');
  await ask('ukaž Evropu'); await page.waitForTimeout(1300); check(n === 0 && await zoom() < 5, 'rychlý povel „ukaž Evropu"');
  const z0 = await zoom(); await ask('přiblížit'); await page.waitForTimeout(1200); check(n === 0 && await zoom() - z0 > 0.9, 'rychlý povel „přiblížit"');
  await ask('oddal'); await page.waitForTimeout(1200); check(n === 0 && Math.abs(await zoom() - z0) < 0.2, 'rychlý povel „oddal"');
  m = await ask('otevri nastaveni'); check(n === 0 && await page.$eval('#settingsPanel', e => !e.hidden), 'rychlý povel „otevri nastaveni"');
  await page.evaluate(() => { document.getElementById('settingsPanel').hidden = true; });
  // událost na místě: ikonka + popisek, jeden krok zpět vrátí obojí
  m = await ask('nehoda v Humpolci'); await page.waitForTimeout(600);
  let sc = await scene();
  check(n === 0 && sc.icons === 1 && (sc.labels || []).join() === 'NEHODA' && /Humpolec/.test(m) && /Ctrl\+Z/.test(m), '„nehoda v Humpolci": ikonka + popisek bez modelu — ' + m);
  await ask('zpět'); await page.waitForTimeout(1500); sc = await scene();
  check(n === 0 && !sc.icons && !(sc.labels || []).length, 'jeden krok zpět vrátí ikonku i popisek najednou');
  await ask('nehoda v Xqzwci'); check(n === 1, 'neznámé místo události rozhodne model (1 dotaz)');
  // mazání druhů prvků
  await page.evaluate(async () => { await window.TNMAP.addLabel({place:'49.2,16.6', text:'A'}); await window.TNMAP.addLabel({place:'49.3,16.7', text:'B'}); });
  m = await ask('smaž popisky'); sc = await scene();
  check(n === 0 && !(sc.labels || []).length && /Ctrl\+Z/.test(m), '„smaž popisky" smaže a řekne, že to jde vrátit — ' + m);
  await ask('vrať to'); await page.waitForTimeout(1500); sc = await scene();
  check(n === 0 && (sc.labels || []).length === 2, 'smazané popisky vrátí krok zpět');
  m = await ask('smaz sipky'); check(n === 0 && /Není co mazat/.test(m), '„smaz sipky" bez šipek nic nemaže — ' + m);
  m = await ask('smaž všechno'); sc = await scene();
  check(n === 0 && Object.keys(sc).length === 0 && /Ctrl\+Z/.test(m), '„smaž všechno" vyčistí scénu');
  m = await ask('přehraj'); check(n === 0 && /Není co přehrát/.test(m), '„přehraj" bez trasy řekne proč — ' + m);
  m = await ask('stop'); check(n === 0, '„stop" bez dotazu na model');
  const dl = page.waitForEvent('download', {timeout: 60000}).catch(() => null);
  m = await ask('export png'); check(n === 0 && !!(await dl), '„export png" stáhne snímek');
  m = await ask('ulož projekt'); check(n === 0 && /ulož|Ulož/.test(m), '„ulož projekt" uloží bez modelu — ' + m);
  const recog = await page.evaluate(() => ['hybrid', 'prepni podklad na satelit', 'politická mapa', 'smaž uzavírky', 'zruš barvy států', 'vymaž trasu', 'ukaž celou trasu', 'pauza', 'screenshot', 'celý svět', 'dej požár do Ostravy', 'otevři trasu', 'slovensky', 'co umíš'].filter(q => !window.__tnchat.quick(q)));
  check(recog.length === 0, 'rozpoznání dalších povelů bez modelu' + (recog.length ? ' — nepoznal: ' + recog.join(', ') : ''));
  const notQuick = await page.evaluate(() => ['trasa z Prahy do Brna', 'udělej z toho volební mapu', 'nehoda na D1 u Humpolce směr Brno', 'ukaž Brno'].filter(q => { const p = window.__tnchat.quick(q); return p && !p.prepare; }));
  check(notQuick.length === 0, 'složitější zadání zůstávají modelu' + (notQuick.length ? ' — chybně rychlé: ' + notQuick.join(', ') : ''));
  check(JSON.stringify(await page.evaluate(() => [window.__tnchat.guesses('Brně'), window.__tnchat.guesses('Humpolci').list[0], window.__tnchat.guesses('Zlíně').sure, window.__tnchat.guesses('Jihlavě').sure])) === JSON.stringify([{sure:'Brno'}, 'Humpolec', 'Zlín', 'Jihlava']), 'skloněné názvy míst se převedou do 1. pádu');

  m = await ask('vlak praha brno'); check(n === 1 && /Délka trasy \d/.test(m), 'trasa: 1 dotaz, délku doplní appka — ' + m);
  m = await ask('kolik je to do kyjeva'); check(n === 1 && /Vzdušnou čarou .* km/.test(m), 'vzdálenost: 1 dotaz — ' + m);
  m = await ask('chyba'); check(n === 2, 'při chybě proběhne druhé kolo (model vysvětlí)');
  check(errors.length === 0, 'žádná chyba stránky');
  await close(); done();
})();
