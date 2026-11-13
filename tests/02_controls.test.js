// Proklikne každé viditelné tlačítko, zaškrtávátko a select na všech záložkách.
const {check, done, open} = require('./lib');
const SKIP = /deleteProject|exportVideo|exportPng|exportPngSeq|batch|share|sendLink|saveProject|savePreset|updatePreset|deletePreset|restoreBackup|downloadBackup|backupImport|brandLogo|uiThemeBtn|lang-btn|resetApp|tnchat/i;
(async () => {
  const {page, errors, close} = await open({wait: 6000});
  await page.evaluate(() => window.TNMAP.routeBetween({from:'Praha', to:'Brno', mode:'planeDirect'}));
  const tabs = await page.$$eval('.tab-btn', bs => bs.map(b => b.dataset.tab));
  let clicked = 0;
  for(const tb of tabs){
    await page.click(`.tab-btn[data-tab="${tb}"]`); await page.waitForTimeout(300);
    await page.evaluate(() => document.querySelectorAll('.tab-pane.active .section.collapsed h3').forEach(h => h.click()));
    const items = await page.$$eval('.tab-pane.active button, .tab-pane.active input[type=checkbox], .tab-pane.active select', els =>
      els.filter(e => e.offsetParent !== null).map(e => { e.dataset.mk = e.dataset.mk || ('mk' + Math.random().toString(36).slice(2, 8)); return {mk:e.dataset.mk, id:e.id || e.className, tag:e.tagName, text:(e.textContent || '').trim().slice(0, 30)}; }));
    for(const it of items){
      if(SKIP.test(it.id + ' ' + it.text)) continue;
      await page.evaluate(({mk, tag}) => { const e = document.querySelector(`[data-mk="${mk}"]`); if(!e) return;
        if(tag === 'SELECT'){ if(e.options.length > 1){ e.selectedIndex = (e.selectedIndex + 1) % e.options.length; e.dispatchEvent(new Event('change', {bubbles:true})); } }
        else e.click(); }, it).catch(() => {});
      clicked++; await page.waitForTimeout(100); await page.keyboard.press('Escape').catch(() => {});
    }
  }
  check(clicked > 100, `prokliknuto ${clicked} prvků`);   // po zrušení Rychlé scény, krajů a počasí je prvků méně
  check(errors.length === 0, 'žádná chyba stránky' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  await close(); done();
})();
