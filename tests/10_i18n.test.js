// Angličtina a slovenština bez zbytků češtiny (kromě chatu asistenta) a čistý návrat do češtiny.
const {check, done, open} = require('./lib');
(async () => {
  const {page, errors, close} = await open();
  await page.click('[data-lang="en"]'); await page.waitForTimeout(1200);
  const scan = () => page.evaluate(() => { const re = /[ěščřžýáíéůúťďňĚŠČŘŽÝÁÍÉŮÚŤĎŇ]/, out = new Set();
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
    while(n = w.nextNode()){ const t = n.textContent.trim(); if(!t || !re.test(t)) continue; const el = n.parentElement;
      if(!el || el.closest('script,style,.tnchat-panel,.place-search-results,option,.lang-switcher,.lang-toggle-list')) continue;
      const r = el.getBoundingClientRect(); if(!r.width || r.bottom < 0 || r.top > 950) continue; out.add(t.slice(0, 50)); }
    for(const el of document.querySelectorAll('[placeholder],[title]')){ if(el.closest('.tnchat-panel,.lang-switcher,.preset-card,.maplibregl-marker')) continue;
      const r = el.getBoundingClientRect(); if(!r.width) continue; for(const a of ['placeholder', 'title']){ const v = el.getAttribute(a); if(v && re.test(v) && !/^(e\.g\.|např)/i.test(v) && !/[A-Z][a-z]+ř|ň|Pelhřimov/.test(v)) out.add('@' + a + ': ' + v.slice(0, 50)); } }
    return [...out]; });
  let left = new Set(await scan());
  for(const tb of ['scena', 'trasa', 'animace', 'export', 'styly']){
    await page.click(`.tab-btn[data-tab="${tb}"]`); await page.waitForTimeout(250);
    await page.evaluate(() => [...document.querySelectorAll('.section.collapsed h3')].filter(h => h.offsetParent).forEach(h => h.click()));
    for(let y = 0; y < 8; y++){ await page.evaluate(y => { document.querySelector('.sidebar-content').scrollTop = y * 700; }, y); await page.waitForTimeout(80); (await scan()).forEach(x => left.add(x)); }
  }
  left = [...left].filter(x => !/^@title: (Čeština|Slovenčina)/.test(x));
  check(left.length === 0, 'angličtina bez českých zbytků' + (left.length ? ' — ' + left.slice(0, 8).join(' | ') : ''));
  await page.click('[data-lang="cs"]'); await page.waitForTimeout(1200);
  // po návratu nesmí zůstat žádný anglický text ze slovníku (EN_OVERRIDES / PZ_EN_TEXT)
  const enLeft = await page.evaluate(() => { const pairs = [...Object.entries(typeof PZ_EN_TEXT !== 'undefined' ? PZ_EN_TEXT : {}), ...Object.entries(typeof EN_OVERRIDES !== 'undefined' ? EN_OVERRIDES : {})];
    const csSame = new Set(pairs.map(([k]) => k));   // texty, které jsou česky i anglicky stejně (MP4 / H.264…)
    const en = new Set(pairs.filter(([k, v]) => typeof v === 'string' && v.length > 6 && k !== v && !csSame.has(v)).map(([, v]) => v));
    const out = new Set(); const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
    while(n = w.nextNode()){ const t = n.textContent.trim(); if(t && en.has(t) && !n.parentElement?.closest('.tnchat-panel,script,style')) out.add(t.slice(0, 50)); }
    for(const el of document.querySelectorAll('[title],[placeholder]')) for(const a of ['title', 'placeholder']){ const v = el.getAttribute(a); if(v && en.has(v)) out.add('@' + a + ': ' + v.slice(0, 50)); }
    return [...out]; });
  check(enLeft.length === 0, 'návrat do češtiny beze zbytků angličtiny' + (enLeft.length ? ' — ' + enLeft.slice(0, 6).join(' | ') : ''));

  // Slovenština: ě, ř a ů slovenská abeceda nemá — text s nimi je zbytek češtiny.
  // (Vlastní jména — stanice metra, kraje, příklady míst — se nepřekládají.)
  await page.click('[data-lang="sk"]'); await page.waitForTimeout(1200);
  const scanSk = () => page.evaluate(() => { const re = /[ěřůĚŘŮ]/, out = new Set();
    const skip = 'script,style,.tnchat-log,.place-search-results,option,.lang-switcher,.lang-toggle-list,.preset-card,.maplibregl-marker,.maplibregl-map,#pzTemplateSection';
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
    while(n = w.nextNode()){ const t = n.textContent.trim(); if(!t || !re.test(t)) continue; const el = n.parentElement;
      if(!el || el.closest(skip)) continue;
      const r = el.getBoundingClientRect(); if(!r.width || r.bottom < 0 || r.top > 950) continue; out.add(t.slice(0, 50)); }
    for(const el of document.querySelectorAll('[placeholder],[title],[aria-label]')){ if(el.closest(skip)) continue;
      const r = el.getBoundingClientRect(); if(!r.width) continue;
      for(const a of ['placeholder', 'title', 'aria-label']){ const v = el.getAttribute(a); if(v && re.test(v) && !/^(napr|např)/i.test(v)) out.add('@' + a + ': ' + v.slice(0, 50)); } }
    return [...out]; });
  let skLeft = new Set(await scanSk());
  for(const tb of ['scena', 'trasa', 'animace', 'export', 'styly']){
    await page.click(`.tab-btn[data-tab="${tb}"]`); await page.waitForTimeout(250);
    await page.evaluate(() => [...document.querySelectorAll('.section.collapsed h3')].filter(h => h.offsetParent).forEach(h => h.click()));
    for(let y = 0; y < 8; y++){ await page.evaluate(y => { document.querySelector('.sidebar-content').scrollTop = y * 700; }, y); await page.waitForTimeout(80); (await scanSk()).forEach(x => skLeft.add(x)); }
  }
  // plovoucí panely: zkratky, Projekt, chat asistenta (prázdný stav s příklady)
  await page.click('#shortcutsBtn'); await page.waitForTimeout(250); (await scanSk()).forEach(x => skLeft.add(x)); await page.keyboard.press('Escape');
  await page.click('#projectPanelBtn'); await page.waitForTimeout(250); (await scanSk()).forEach(x => skLeft.add(x)); await page.keyboard.press('Escape');
  await page.click('.tnchat-fab'); await page.waitForTimeout(300); (await scanSk()).forEach(x => skLeft.add(x));
  const chatSk = await page.evaluate(() => ({head: document.querySelector('.tnchat-head [data-i18n]').textContent, ph: document.getElementById('tnchatInput').placeholder, chips: [...document.querySelectorAll('#tnchatChips .tnchat-chip')].map(b => b.textContent)}));
  check(/Napíš/.test(chatSk.ph) && chatSk.chips.some(c => /autom/.test(c)), 'chat asistenta je slovensky (pole i příklady) — ' + chatSk.ph);
  await page.keyboard.press('Escape');
  skLeft = [...skLeft];
  check(skLeft.length === 0, 'slovenština bez českých zbytků' + (skLeft.length ? ' — ' + skLeft.slice(0, 8).join(' | ') : ''));
  // stavová hláška volaná bez t() se přeloží ve stavovém řádku
  await page.evaluate(() => window.__pzFns.setStatus('Projekt uložen.'));
  check(/uložený/.test(await page.$eval('#statusBar', e => e.textContent)), 'stavová hláška bez t() je slovensky');

  await page.click('[data-lang="cs"]'); await page.waitForTimeout(1200);
  // po návratu nesmí zůstat žádný slovenský text ze slovníku
  const skBack = await page.evaluate(() => { const csAll = new Set(Object.values(I18N).map(e => e && e.cs).filter(Boolean));
    const sk = new Set(Object.entries(I18N).filter(([k, e]) => e && typeof e.sk === 'string' && e.sk.length > 6 && e.sk !== e.cs && e.sk !== k && !csAll.has(e.sk)).map(([, e]) => e.sk));
    const out = new Set(); const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
    while(n = w.nextNode()){ const t = n.textContent.trim(); if(t && sk.has(t) && !n.parentElement?.closest('script,style,.tnchat-log,#statusBar')) out.add(t.slice(0, 50)); }
    for(const el of document.querySelectorAll('[title],[placeholder],[aria-label]')) for(const a of ['title', 'placeholder', 'aria-label']){ const v = el.getAttribute(a); if(v && sk.has(v)) out.add('@' + a + ': ' + v.slice(0, 50)); }
    return [...out]; });
  check(skBack.length === 0, 'návrat do češtiny beze zbytků slovenštiny' + (skBack.length ? ' — ' + skBack.slice(0, 6).join(' | ') : ''));
  check(await page.$eval('#tnchatInput', e => /Napiš/.test(e.placeholder)), 'chat asistenta je po návratu česky');
  check(errors.length === 0, 'žádná chyba stránky');
  await close(); done();
})();
