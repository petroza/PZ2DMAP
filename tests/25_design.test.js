// Společný vzhled na počítači (tmavý i světlý režim): jedna výška ovládacích prvků,
// nic nepřetéká ze sekce, panel se neposouvá do stran, fokus z klávesnice je vidět
// a nepřetéká, lišta nad mapou a stavový řádek mají čitelné stavy, plovoucí panely
// (Projekt, Nastavení, zkratky) se vejdou na 1280×720 a zavírají se křížkem i Esc.
const {check, done, open, shot} = require('./lib');

const TABS = ['scena', 'trasa', 'animace', 'export', 'styly'];

// Pomůcky běžící ve stránce (barvy, kontrast, viditelnost).
const HELPERS = () => {
  const parse = c => { const m = String(c).match(/[\d.]+/g); return m ? [+m[0], +m[1], +m[2], m[3] === undefined ? 1 : +m[3]] : [0, 0, 0, 0]; };
  const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const blend = (t, b) => [0, 1, 2].map(i => t[i] * t[3] + b[i] * (1 - t[3])).concat(1);
  const bgOf = el => { const st = []; for(let e = el; e; e = e.parentElement){ const c = parse(getComputedStyle(e).backgroundColor); if(c[3] > 0){ st.push(c); if(c[3] >= .98) break; } }
    let bg = [255, 255, 255, 1]; for(let i = st.length - 1; i >= 0; i--) bg = blend(st[i], bg); return bg; };
  const ratio = (a, b) => { const L1 = lum(a), L2 = lum(b); return (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05); };
  const vis = el => { if(!el || !el.offsetParent) return false; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && +cs.opacity > .05 && r.right > 0 && r.left < innerWidth; };
  const nm = el => (el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '')).slice(0, 44);
  window.__dz = {parse, lum, blend, bgOf, ratio, vis, nm};
};

// Měření jedné záložky se všemi sekcemi rozbalenými.
const measurePane = () => {
  const {vis, nm} = window.__dz;
  const pane = document.querySelector('.tab-pane.active'), sc = document.querySelector('.sidebar-content');
  const H = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pz-h')) || 30;
  const out = {hScroll: sc.scrollWidth - sc.clientWidth, btnH: [], fieldH: [], overflow: [], slider: [], check: [], n: {btn: 0, field: 0, range: 0}};
  // textová tlačítka .btn: dlaždice (sloupec s obrázkem) a hlavní dvojice akcí trasy mají vlastní rozměr
  pane.querySelectorAll('.btn').forEach(b => { if(!vis(b)) return; const cs = getComputedStyle(b);
    if(cs.flexDirection === 'column' || b.querySelector('img,canvas') || b.closest('.nav-actions')) return;
    out.n.btn++; const h = b.getBoundingClientRect().height; if(Math.abs(h - H) > .6) out.btnH.push(nm(b) + ' ' + h.toFixed(1)); });
  pane.querySelectorAll('select,input[type=text],input[type=number],input[type=search]').forEach(f => { if(!vis(f)) return;
    out.n.field++; const h = f.getBoundingClientRect().height; if(Math.abs(h - H) > .6) out.fieldH.push(nm(f) + ' ' + h.toFixed(1)); });
  pane.querySelectorAll('.section').forEach(s => { if(!vis(s)) return; const sr = s.getBoundingClientRect();
    s.querySelectorAll('*').forEach(el => { if(!vis(el) || el.closest('.nav-suggest,.preset-context-menu')) return; const r = el.getBoundingClientRect();
      if(r.right > sr.right + 1 || r.left < sr.left - 1) out.overflow.push(nm(s) + ' › ' + nm(el) + ' o ' + Math.round(Math.max(r.right - sr.right, sr.left - r.left)) + ' px'); }); });
  // posuvník: prvek je aspoň tak vysoký jako jezdec a nepřekrývá sousední řádek
  pane.querySelectorAll('input[type=range]').forEach(r => { if(!vis(r)) return; out.n.range++; const b = r.getBoundingClientRect();
    if(b.height < 16) out.slider.push(nm(r) + ' výška ' + b.height.toFixed(1));
    const col = r.parentElement, kids = [...col.children].filter(vis), i = kids.indexOf(r);
    if(getComputedStyle(col).display.includes('flex') && getComputedStyle(col).flexDirection.startsWith('row')) return;
    const prev = kids[i - 1], next = kids[i + 1];
    if(prev && prev.getBoundingClientRect().bottom > b.top + .6) out.slider.push(nm(r) + ' zasahuje do prvku nad sebou (' + nm(prev) + ')');
    if(next && next.getBoundingClientRect().top < b.bottom - .6) out.slider.push(nm(r) + ' zasahuje do prvku pod sebou (' + nm(next) + ')'); });
  pane.querySelectorAll('input[type=checkbox]').forEach(c => { if(!vis(c)) return; const b = c.getBoundingClientRect();
    if(Math.abs(b.width - 16) > .6 || Math.abs(b.height - 16) > .6) out.check.push(nm(c) + ' ' + b.width + '×' + b.height); });
  return out;
};

// Ukazatel fokusu na právě zaměřeném prvku: je vidět (≥ 2 px, kontrast ≥ 3:1) a nepřetéká.
const focusInfo = () => {
  const {parse, bgOf, ratio, nm} = window.__dz;
  const el = document.activeElement; if(!el || el === document.body) return {name: '(nic)', ok: false, why: 'nic nemá fokus'};
  const cs = getComputedStyle(el), r = el.getBoundingClientRect(), name = nm(el);
  const ow = parseFloat(cs.outlineWidth) || 0, off = parseFloat(cs.outlineOffset) || 0;
  if(cs.outlineStyle !== 'none' && ow >= 2){
    const ext = Math.max(0, off + ow);                                   // o kolik rámeček přesahuje prvek
    let clip = null; for(let p = el.parentElement; p; p = p.parentElement){ const o = getComputedStyle(p); if(/(hidden|auto|scroll|clip)/.test(o.overflowX + o.overflowY)){ clip = p; break; } }
    const c = clip ? clip.getBoundingClientRect() : {left: 0, top: 0, right: innerWidth, bottom: innerHeight};
    const clipped = r.left - ext < c.left - .5 || r.right + ext > c.right + .5;
    // sousedé ve stejném řádku: rámeček do nich nesmí zasahovat
    const sib = [...(el.parentElement?.children || [])].filter(s => s !== el && s.offsetParent).some(s => { const q = s.getBoundingClientRect();
      return q.width > 1 && !(q.left >= r.right + ext - .5 || q.right <= r.left - ext + .5 || q.top >= r.bottom + ext - .5 || q.bottom <= r.top - ext + .5); });
    const under = off < 0 ? bgOf(el) : bgOf(el.parentElement || el);
    const cr = ratio(parse(cs.outlineColor), under);
    return {name, ok: !clipped && !sib && cr >= 3, why: clipped ? 'rámeček je oříznutý' : sib ? 'rámeček zasahuje do souseda' : cr < 3 ? 'kontrast rámečku ' + cr.toFixed(2) : ''};
  }
  // textová pole a výběry: červený okraj + záře
  const bc = parse(cs.borderTopColor), acc = parse(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().replace(/^#(..)(..)(..)$/, (m, a, b, c) => `rgb(${parseInt(a, 16)},${parseInt(b, 16)},${parseInt(c, 16)})`));
  const same = Math.abs(bc[0] - acc[0]) + Math.abs(bc[1] - acc[1]) + Math.abs(bc[2] - acc[2]) < 12;
  return {name, ok: same && cs.boxShadow !== 'none', why: 'chybí rámeček i zvýrazněný okraj'};
};

async function run(theme, viewport){
  const tag = `${theme} ${viewport.width}×${viewport.height}`;
  const {page, errors, close} = await open({theme, viewport, wait: 4500});
  page.setDefaultTimeout(90000);
  await page.evaluate(HELPERS);

  // ---- 1. záložky: výšky, přetékání, posuvníky ----
  for(const tb of TABS){
    await page.click(`.tab-btn[data-tab="${tb}"]`); await page.waitForTimeout(250);
    await page.evaluate(() => { document.querySelectorAll('.tab-pane.active .section.collapsed > h3').forEach(h => h.click());
      document.querySelectorAll('.tab-pane.active details').forEach(d => { d.open = true; }); });
    await page.waitForTimeout(250);
    const m = await page.evaluate(measurePane);
    const few = a => a.length ? ' — ' + a.slice(0, 4).join('; ') : '';
    check(m.hScroll <= 0, `${tag} ${tb}: panel se neposouvá do stran` + (m.hScroll > 0 ? ` (o ${m.hScroll} px)` : ''));
    check(m.btnH.length === 0, `${tag} ${tb}: tlačítka .btn mají jednu výšku (${m.n.btn}×)` + few(m.btnH));
    check(m.fieldH.length === 0, `${tag} ${tb}: pole a výběry mají jednu výšku (${m.n.field}×)` + few(m.fieldH));
    check(m.overflow.length === 0, `${tag} ${tb}: nic nepřetéká ze sekce` + few(m.overflow));
    check(m.slider.length === 0, `${tag} ${tb}: posuvníky se nedotýkají sousedních řádků (${m.n.range}×)` + few(m.slider));
    check(m.check.length === 0, `${tag} ${tb}: zaškrtávátka 16×16` + few(m.check));
  }

  // ---- 2. fokus z klávesnice: pořadí v hlavičce a záložkách ----
  await page.click('.tab-btn[data-tab="scena"]');
  await page.evaluate(() => { document.activeElement?.blur(); document.querySelector('.sidebar-content').scrollTop = 0; });
  const expected = await page.evaluate(() => {
    const v = el => el && el.offsetParent && getComputedStyle(el).visibility !== 'hidden';
    return ['#brandLogo', ...[...document.querySelectorAll('#langSwitcherSlot .lang-btn')].filter(v).map(b => `.lang-btn[data-lang="${b.dataset.lang}"]`), '#uiThemeBtn',
      '#placeSearchInput', '#placeSearchBtn', '#clearPlaceSearchBtn', ...[...document.querySelectorAll('.sidebar-tabs .tab-btn')].map(b => `.tab-btn[data-tab="${b.dataset.tab}"]`)]; });
  const seq = [], bad = [];
  // začátek na logu (po klávese, ať platí režim klávesnice); dál už jen Tab
  await page.keyboard.press('Shift'); await page.evaluate(() => document.getElementById('brandLogo').focus());
  for(let i = 0; i < expected.length; i++){
    if(i) await page.keyboard.press('Tab');
    await page.waitForTimeout(160);                    // přechod barvy okraje (120 ms)
    const hit = await page.evaluate(sel => document.activeElement === document.querySelector(sel), expected[i]);
    seq.push(hit);
    const f = await page.evaluate(focusInfo); if(!f.ok) bad.push(f.name + ': ' + f.why);
  }
  check(seq.every(Boolean), `${tag}: Tab jde logo → vlajky → režim → hledání → záložky` + (seq.every(Boolean) ? '' : ' — nesedí krok ' + (seq.indexOf(false) + 1) + ' (' + expected[seq.indexOf(false)] + ')'));
  check(bad.length === 0, `${tag}: fokus v hlavičce a záložkách je vidět a nepřetéká` + (bad.length ? ' — ' + bad.slice(0, 4).join('; ') : ''));
  await shot(page, `25_design_${theme}_focus.png`, {clip: {x: 0, y: 0, width: 420, height: 220}}).catch(() => {});

  // ---- 3. fokus u vzorku ovládacích prvků v panelu (po klávese = režim klávesnice) ----
  const kinds = ['.tab-pane.active .section-toggle', '.tab-pane.active .btn:not(.btn-primary):not(.btn-danger):not([disabled])', '.tab-pane.active .btn-primary:not([disabled])',
    '.tab-pane.active .btn-danger:not([disabled])', '.tab-pane.active select', '.tab-pane.active input[type=text]', '.tab-pane.active input[type=checkbox]',
    '.tab-pane.active input[type=range]', '#openSettingsBtn'];
  const badK = [];
  for(const tb of ['scena', 'trasa']){
    await page.click(`.tab-btn[data-tab="${tb}"]`); await page.keyboard.press('Shift');
    for(const sel of kinds){
      const ok = await page.evaluate(sel => { const el = [...document.querySelectorAll(sel)].find(window.__dz.vis); if(!el) return false; el.scrollIntoView({block: 'center'}); el.focus(); return true; }, sel);
      if(!ok) continue;
      await page.waitForTimeout(160);
      const f = await page.evaluate(focusInfo); if(!f.ok) badK.push(`${tb} ${f.name}: ${f.why}`);
    }
  }
  check(badK.length === 0, `${tag}: fokus je vidět a nepřetéká u tlačítek, polí, výběrů, zaškrtávátek a posuvníků` + (badK.length ? ' — ' + badK.slice(0, 4).join('; ') : ''));

  // ---- 4. lišta nad mapou ----
  await page.evaluate(() => { document.activeElement?.blur(); document.querySelector('.sidebar-content').scrollTop = 0; });
  const bar = await page.evaluate(() => {
    const {parse, bgOf, ratio} = window.__dz;
    const bs = [...document.querySelectorAll('.map-actions .map-action-btn')];
    const hs = [...new Set(bs.map(b => Math.round(b.getBoundingClientRect().height)))];
    const noTip = bs.filter(b => !(b.title || '').trim() || !(b.getAttribute('aria-label') || '').trim()).map(b => b.id);
    const act = document.querySelector('.map-actions').getBoundingClientRect(), side = document.querySelector('.sidebar').getBoundingClientRect();
    const u = document.getElementById('undoActionBtn'), p = document.getElementById('projectPanelBtn');
    const crU = ratio(parse(getComputedStyle(u).color), bgOf(u)), crP = ratio(parse(getComputedStyle(p).color), bgOf(p));
    // zapnutý Glóbus má vypadat stejně jako zapnuté Zóny
    const g = document.getElementById('globeToggleBtn'), z = document.getElementById('safeGuidesBtn');
    const had = g.classList.contains('globe-on'); [g, z, p].forEach(b => { b.style.transition = 'none'; }); g.classList.add('globe-on'); z.classList.add('active');
    const same = getComputedStyle(g).backgroundColor === getComputedStyle(z).backgroundColor && getComputedStyle(g).color === getComputedStyle(z).color;
    const onBg = getComputedStyle(z).backgroundColor, offBg = getComputedStyle(p).backgroundColor;
    if(!had) g.classList.remove('globe-on'); z.classList.remove('active'); [g, z, p].forEach(b => { b.style.transition = ''; });
    return {hs, noTip, clear: act.left > side.right + 4, inView: act.right <= innerWidth && act.top >= 0, undoDisabled: u.disabled, crU, crP, same, onDiffers: onBg !== offBg};
  });
  check(bar.hs.length === 1, `${tag}: tlačítka lišty mají jednu výšku (${bar.hs.join('/')} px)`);
  check(bar.noTip.length === 0, `${tag}: každé tlačítko lišty má tooltip a aria-label` + (bar.noTip.length ? ' — ' + bar.noTip.join(', ') : ''));
  check(bar.clear && bar.inView, `${tag}: lišta nezajíždí pod panel ani mimo okno`);
  check(bar.undoDisabled && bar.crU >= 3 && bar.crU < bar.crP, `${tag}: zakázaný Krok zpět je tlumený, ale čitelný (${bar.crU.toFixed(1)}:1 vs ${bar.crP.toFixed(1)}:1)`);
  check(bar.same && bar.onDiffers, `${tag}: zapnuté Zóny a Glóbus vypadají stejně a liší se od vypnutých`);
  await page.click('#safeGuidesBtn'); await page.waitForTimeout(150);
  check(await page.evaluate(() => document.getElementById('safeGuidesBtn').getAttribute('aria-pressed') === 'true'), `${tag}: Zóny hlásí stav zapnuto (aria-pressed)`);
  await page.click('#safeGuidesBtn');
  // pořadí tabulátorem v liště
  await page.keyboard.press('Shift'); await page.evaluate(() => document.getElementById('projectPanelBtn').focus());
  const barSeq = [];
  for(let i = 0; i < 4; i++){ await page.keyboard.press('Tab'); barSeq.push(await page.evaluate(() => document.activeElement?.id || '')); }
  await page.waitForTimeout(160);
  check(barSeq.join(',') === 'safeGuidesBtn,refreshMapBtn,globeToggleBtn,shortcutsBtn', `${tag}: Tab v liště jde zleva doprava (${barSeq.join(' → ')})`);
  const fb = await page.evaluate(focusInfo);
  check(fb.ok, `${tag}: fokus v liště je vidět a nepřetéká` + (fb.ok ? '' : ' — ' + fb.name + ': ' + fb.why));

  // ---- 5. stavový řádek: informace vs. chyba ----
  const st = await page.evaluate(() => {
    const {parse, bgOf, ratio} = window.__dz; const el = document.getElementById('statusBar');
    const snap = () => { const cs = getComputedStyle(el); return {bg: cs.backgroundColor, border: cs.borderTopColor, cr: ratio(parse(cs.color), bgOf(el)),
      mark: getComputedStyle(el.querySelector('.dot'), '::before').content}; };
    window.__pzFns.setStatus('Zkouška: informace.'); const info = snap();
    window.__pzFns.setStatus('Zkouška: chyba.', 'error'); const err = snap();
    window.__pzFns.setStatus('Připraveno.');
    return {info, err};
  });
  check(st.info.bg !== st.err.bg && st.info.border !== st.err.border && /!/.test(st.err.mark) && !/!/.test(st.info.mark), `${tag}: chyba ve stavovém řádku se liší barvou i značkou`);
  check(st.info.cr >= 4.5 && st.err.cr >= 4.5, `${tag}: stavový řádek je čitelný (${st.info.cr.toFixed(1)}:1, chyba ${st.err.cr.toFixed(1)}:1)`);

  // ---- 6. plovoucí panely: vejdou se, nemají vodorovný posuv, zavírají se křížkem i Esc ----
  const fits = sel => page.evaluate(sel => { const el = document.querySelector(sel), r = el.getBoundingClientRect();
    const scroller = el.querySelector('.settings-body') || el;
    return {in: r.top >= 0 && r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, hs: scroller.scrollWidth - scroller.clientWidth,
      para: [...el.querySelectorAll('p,.hint')].filter(window.__dz.vis).length}; }, sel);
  const hidden = id => page.evaluate(id => document.getElementById(id).hidden, id);
  const panels = [['Projekt', '#projectPanelBtn', 'projectPanel', '#projectPanel', '#projectPanelClose'],
                  ['Zkratky', '#shortcutsBtn', 'shortcutsPanel', '#shortcutsPanel', '#shortcutsPanelClose'],
                  ['Nastavení', '#openSettingsBtn', 'settingsPanel', '#settingsPanel .settings-card', '#closeSettingsBtn']];
  for(const [name, opener, id, box, closer] of panels){
    await page.click(opener); await page.waitForTimeout(250);
    const f = await fits(box);
    check(!(await hidden(id)) && f.in && f.hs <= 0, `${tag}: ${name} se vejde do okna a nemá vodorovný posuv`);
    check(f.para === 0, `${tag}: ${name} bez vysvětlujících odstavců`);
    await shot(page, `25_design_${theme}_${id}.png`).catch(() => {});
    await page.click(closer); await page.waitForTimeout(150);
    const byX = await hidden(id);
    await page.click(opener); await page.waitForTimeout(200); await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    check(byX && await hidden(id), `${tag}: ${name} zavře křížek i Esc`);
  }
  await page.waitForTimeout(100);
  check(await page.evaluate(() => document.activeElement?.id === 'openSettingsBtn'), `${tag}: po zavření Nastavení se fokus vrátí na tlačítko`);

  // ---- 7. čitelnost textu společných prvků (≥ 4,5:1) ----
  const low = await page.evaluate(() => {
    const {parse, bgOf, ratio, vis, nm, blend} = window.__dz; const out = [];
    document.querySelectorAll('.sidebar label, .sidebar .tab-btn, .sidebar .section > h3, .sidebar .hint, .sidebar .small, .map-actions .map-action-btn:not([disabled]), #statusBar, .settings-gear, .brand-title')
      .forEach(el => { if(!vis(el) || ![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1)) return;
        const bg = bgOf(el), cr = ratio(blend(parse(getComputedStyle(el).color), bg), bg); if(cr < 4.45) out.push(nm(el) + ' ' + cr.toFixed(2)); });
    return [...new Set(out)];
  });
  check(low.length === 0, `${tag}: popisky, nápovědy, záložky a lišta mají kontrast ≥ 4,5:1` + (low.length ? ' — ' + low.slice(0, 5).join('; ') : ''));

  check(errors.length === 0, `${tag}: žádná chyba stránky` + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  await close();
}

(async () => {
  await run('dark', {width: 1600, height: 950});
  await run('light', {width: 1280, height: 720});
  done();
})();
