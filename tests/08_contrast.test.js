// Kontrast textu ve všech záložkách, nápovědě a chatu — světlý i tmavý režim (min. 3:1).
const {check, done, open} = require('./lib');
async function scanAll(page){
  const scan = () => page.evaluate(() => {
    const parse = c => { const m = c.match(/[\d.]+/g); return m ? [+m[0], +m[1], +m[2], m[3] === undefined ? 1 : +m[3]] : null; };
    const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
    const blend = (t, b) => [0, 1, 2].map(i => t[i] * t[3] + b[i] * (1 - t[3])).concat(1);
    const bgOf = el => { const st = []; for(let e = el; e; e = e.parentElement){ const c = parse(getComputedStyle(e).backgroundColor); if(c && c[3] > 0){ st.push(c); if(c[3] >= .98) break; } if(e.id === 'map') return null; }
      let bg = [255, 255, 255, 1]; for(let i = st.length - 1; i >= 0; i--) bg = blend(st[i], bg); return bg; };
    const out = [];
    for(const el of document.querySelectorAll('body *')){
      if(![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1)) continue;
      const r = el.getBoundingClientRect(); if(r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > 950) continue;
      const cs = getComputedStyle(el); if(cs.visibility === 'hidden' || +cs.opacity < .3) continue;
      const bg = bgOf(el); if(!bg) continue;
      const fg = blend(parse(cs.color), bg); const L1 = lum(fg), L2 = lum(bg); const cr = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
      if(cr < 2.95) out.push(cr.toFixed(2) + ' ' + (el.id || el.className || el.tagName) + ' „' + el.textContent.trim().slice(0, 25) + '"');
    }
    return out; });
  let all = await scan();
  for(const tb of ['scena', 'trasa', 'animace', 'export', 'styly']){
    await page.click(`.tab-btn[data-tab="${tb}"]`); await page.mouse.move(1590, 940); await page.waitForTimeout(250);
    await page.evaluate(() => [...document.querySelectorAll('.section.collapsed h3')].filter(h => h.offsetParent).forEach(h => h.click()));
    for(let y = 0; y < 6; y++){ await page.evaluate(y => { document.querySelector('.sidebar-content').scrollTop = y * 700; }, y); await page.waitForTimeout(100); all = all.concat(await scan()); }
  }
  await page.click('#projectPanelBtn'); await page.mouse.move(1590, 940); await page.waitForTimeout(200); all = all.concat(await scan()); await page.keyboard.press('Escape');
  await page.click('#shortcutsBtn'); await page.mouse.move(1590, 940); await page.waitForTimeout(200); all = all.concat(await scan()); await page.keyboard.press('Escape');
  await page.click('.tnchat-fab'); await page.waitForTimeout(300); all = all.concat(await scan());
  return [...new Set(all)];
}
(async () => {
  for(const theme of ['light', 'dark']){
    const {page, close} = await open({theme});
    const bad = await scanAll(page);
    check(bad.length === 0, `${theme}: kontrast ≥ 3:1` + (bad.length ? ' — ' + bad.slice(0, 5).join('; ') : ''));
    await close();
  }
  done();
})();
