// Angličtina bez zbytků češtiny (kromě chatu asistenta) a čistý návrat do češtiny.
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
  check(errors.length === 0, 'žádná chyba stránky');
  await close(); done();
})();
