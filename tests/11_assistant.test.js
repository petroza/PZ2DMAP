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
  let n = 0, lastQ = '';
  await ctx.route(/tnmap-chat/, r => { n++; const b = JSON.parse(r.request().postData() || '{}');
    const resp = (b.toolResults && b.toolResults.length) ? {say:'(druhé kolo)', calls:[], done:true} : (PLANS[lastQ] || {say:'?', calls:[], done:true});
    r.fulfill({status:200, contentType:'application/json', body: JSON.stringify(resp)}); });
  await page.click('.tnchat-fab'); await page.waitForTimeout(300);
  const ask = async q => { lastQ = q; n = 0; await page.fill('#tnchatInput', q); await page.press('#tnchatInput', 'Enter');
    await page.waitForFunction(() => !document.getElementById('tnchatSend').disabled, null, {timeout: 60000}).catch(() => {}); await page.waitForTimeout(600);
    return page.$$eval('.tnchat-msg.bot', e => e[e.length - 1].textContent); };
  for(const [q, check_] of [['satelit', () => page.$eval('#baseStyle', e => e.value === 'satellite')], ['Zpět!', () => page.$eval('#baseStyle', e => e.value !== 'satellite')],
      ['zapni glóbus', () => page.$eval('#globeProjection', e => e.checked)], ['vypni glóbus', () => page.$eval('#globeProjection', e => !e.checked)],
      ['otevři export', () => page.$eval('.tab-btn[data-tab="export"]', e => e.classList.contains('active'))]]){
    await ask(q); check(n === 0 && await check_(), `rychlý povel „${q}" bez dotazu na model`);
  }
  let m = await ask('vlak praha brno'); check(n === 1 && /Délka trasy \d/.test(m), 'trasa: 1 dotaz, délku doplní appka — ' + m);
  m = await ask('kolik je to do kyjeva'); check(n === 1 && /Vzdušnou čarou .* km/.test(m), 'vzdálenost: 1 dotaz — ' + m);
  m = await ask('chyba'); check(n === 2, 'při chybě proběhne druhé kolo (model vysvětlí)');
  check(errors.length === 0, 'žádná chyba stránky');
  await close(); done();
})();
