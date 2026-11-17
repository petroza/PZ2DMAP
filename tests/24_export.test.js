// Export: záložka (předvolby, shrnutí), PNG se všemi vrstvami, průhledné pozadí,
// krátké video (průběh, zrušení, dvojklik), PNG sekvence, více formátů, názvy souborů.
// Exporty jsou malé (640×360, 1 s, 5 fps), ať test netrvá.
const {check, done, open, tab, status, OUT} = require('./lib');
const path = require('path'), fs = require('fs'), {execFileSync} = require('child_process');
const ROAD = [[14.42,50.08],[14.6,50.0],[14.9,49.8],[15.2,49.65],[15.6,49.43],[16.0,49.3],[16.4,49.2],[16.6,49.19]];
const probe = f => { try{ return execFileSync('ffprobe', ['-v','error','-count_frames','-show_entries','stream=width,height,nb_read_frames','-of','csv=p=0', f]).toString().trim(); }catch(e){ return null; } };

(async () => {
  const {page, ctx, errors, close} = await open();
  await ctx.route(/routing\.openstreetmap\.de|router\.project-osrm\.org/, r => r.fulfill({status:200, contentType:'application/json',
    body: JSON.stringify({code:'Ok', routes:[{geometry:{type:'LineString', coordinates:ROAD}, distance:205000, duration:7500, legs:[]}], waypoints:[]})}));
  const downloads = []; page.on('download', d => downloads.push(d));
  const waitDl = async (n, ms = 240000) => { const t0 = Date.now(); while(downloads.length < n && Date.now() - t0 < ms) await page.waitForTimeout(300); return downloads.length >= n; };
  const save = async (d, name) => { const f = path.join(OUT, name); await d.saveAs(f); return f; };
  const ui = () => page.evaluate(() => ({
    progress: !document.getElementById('exportProgress').hidden, cover: document.getElementById('exportCover').classList.contains('show'),
    disabled: ['exportVideoBtn','exportPngBtn','exportPngSeqBtn','exportBatchBtn'].filter(id => document.getElementById(id).disabled).length,
    title: document.title, count: document.getElementById('exportProgressCount').textContent}));
  const idle = async label => { const u = await ui(); check(!u.progress && !u.cover && u.disabled === 0 && !/%/.test(u.title), label + ': rozhraní zpět v klidu (průběh, překryv, tlačítka, titulek)'); };
  const setSize = (w, h) => page.evaluate(([w, h]) => { const r = document.getElementById('exportResolution'); r.value = 'custom'; r.dispatchEvent(new Event('change', {bubbles:true}));
    const a = document.getElementById('exportCustomWidth'), b = document.getElementById('exportCustomHeight'); a.value = w; b.value = h; a.dispatchEvent(new Event('input', {bubbles:true})); }, [w, h]);

  // --- záložka: předvolby a shrnutí u tlačítek ---
  await tab(page, 'export');
  check(await page.$$eval('#exportChips .exp-chip', e => e.length) === 4 && await page.$eval('#exportChips .exp-chip.active', e => e.dataset.res) === '1920x1080', 'předvolby formátu, výchozí TV 16:9');
  check(await page.$$eval('.tab-pane[data-pane="export"] p.hint, .tab-pane[data-pane="export"] .small', e => e.length) === 0, 'záložka bez vysvětlujících odstavců');
  check(await page.evaluate(() => !document.getElementById('exportMoreDetails').open && !document.getElementById('exportBatchDetails').open &&
    document.getElementById('exportPngBtn').offsetParent && document.getElementById('exportVideoBtn').offsetParent), 'hned vidět jen Screenshot PNG a Export video, zbytek sbalený');
  await page.click('#exportChips .exp-chip[data-res="1080x1920"]'); await page.waitForTimeout(300);
  let fr = await page.evaluate(() => { const f = document.getElementById('exportFrame'), b = f.getBoundingClientRect(); return {label: f.getAttribute('data-label'), ratio: b.width / b.height, png: document.getElementById('exportPngInfo').textContent}; });
  check(/1080×1920/.test(fr.label) && /9:16/.test(fr.label) && Math.abs(fr.ratio - 9 / 16) < 0.01 && /1080×1920/.test(fr.png), 'předvolba 9:16 přepne rámeček i shrnutí: ' + fr.label);
  await page.click('#exportChips .exp-chip[data-res="1920x1080"]');

  // --- bez trasy: video řekne předem, co chybí ---
  check(await page.$eval('#exportVideoInfo', e => e.classList.contains('warn')), 'bez trasy je u Export video upozornění');
  await page.click('#exportVideoBtn'); await page.waitForTimeout(400);
  check(/Trasa/.test(await status(page)) && await page.$eval('#statusBar', e => e.classList.contains('error')), 'video bez trasy: hláška říká, co udělat');
  await idle('video bez trasy');

  // --- scéna: trasa, ikonka, popisek, šipka, perimetr ---
  const r = await page.evaluate(async () => { const T = window.TNMAP;
    const a = await T.routeBetween({from:'50.08,14.42', to:'49.19,16.6', mode:'driving'});
    await T.placeIcon({place:'49.4,15.59', kind:'požár'}); await T.addLabel({place:'49.61,15.58', text:'BROD'});
    await T.drawArrow({from:'49.95,16.2', to:'49.55,16.0', fit:false}); await T.drawPerimeter({place:'49.75,15.0', km:15, fit:false});
    T.setValues({animDuration:1}); return a.ok; });
  check(r, 'scéna připravena'); await page.waitForTimeout(2500);
  await tab(page, 'export');
  await page.evaluate(() => { const s = document.getElementById('exportFps'); const o = document.createElement('option'); o.value = '5'; o.textContent = '5'; s.appendChild(o); s.value = '5'; s.dispatchEvent(new Event('change', {bubbles:true})); });
  await setSize(640, 360); await page.waitForTimeout(300);
  check(/MP4 · 5 fps · 1 s/.test(await page.$eval('#exportVideoInfo', e => e.textContent)) && await page.$eval('#exportPngInfo', e => e.textContent) === 'PNG · 640×360', 'shrnutí u tlačítek: ' + await page.$eval('#exportVideoInfo', e => e.textContent));

  // --- PNG: výřez rámečku a vrstvy ---
  await page.evaluate(() => { const F = window.__pzFns; F.state.animElapsed = 0.5; F.setAnimProgress(0.5); }); await page.waitForTimeout(600);
  // kde mají prvky ve výstupu být (poloha vůči rámečku × měřítko výstupu)
  const pts = await page.evaluate(() => { const m = window.__tnMap, f = document.getElementById('exportFrame').getBoundingClientRect(), c = m.getCanvas().getBoundingClientRect(), k = 640 / f.width;
    const P = ll => { const p = m.project(ll); return [Math.round((p.x + c.left - f.left) * k), Math.round((p.y + c.top - f.top) * k)]; };
    return {icon: P([15.59, 49.4]), label: P([15.58, 49.61]), arrow: P([16.1, 49.75]), route: P([14.6, 50.0]), perim: P([15.0, 49.75]), perimTop: P([15.0, 49.75 + 15 / 111.32]), k}; });
  let d0 = downloads.length;
  await page.click('#exportPngBtn');
  check(await waitDl(d0 + 1), 'PNG staženo');
  check(/^tnmap-\d{8}-\d{4}\.png$/.test(downloads[d0].suggestedFilename()), 'název bez projektu: ' + downloads[d0].suggestedFilename());
  const pngFile = await save(downloads[d0], '24_export.png');
  await idle('PNG');
  const scan = (file, spots) => page.evaluate(async ([b64, spots]) => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d', {willReadFrequently:true}); x.drawImage(img, 0, 0);
    const out = {w: img.width, h: img.height};
    for(const [name, [px, py], rad] of spots){ const R = rad || 6, d = x.getImageData(Math.max(0, px - R), Math.max(0, py - R), 2 * R + 1, 2 * R + 1).data; let red = 0, blue = 0, white = 0, dark = 0, clear = 0, n = 0;
      for(let i = 0; i < d.length; i += 4){ n++; const [r, g, b, a] = [d[i], d[i+1], d[i+2], d[i+3]]; if(a < 20){ clear++; continue; }
        if(r > 170 && g < 110 && b < 110) red++; if(b > 150 && r < 110) blue++; if(r > 240 && g > 240 && b > 240) white++; if(r < 70 && g < 70 && b < 70) dark++; }
      out[name] = {red: red / n, blue: blue / n, white: white / n, dark: dark / n, clear: clear / n}; }
    return out; }, [fs.readFileSync(file).toString('base64'), spots]);
  const spots = [['icon', pts.icon, 5], ['arrow', pts.arrow, 5], ['route', pts.route, 4], ['perim', pts.perim, 3], ['label', [pts.label[0] - 40, pts.label[1]], 14], ['perimTag', [pts.perimTop[0] + 30, pts.perimTop[1]], 10], ['corner', [8, 8], 6]];
  let px = await scan(pngFile, spots);
  check(px.w === 640 && px.h === 360, `PNG má rozměr výstupu ${px.w}×${px.h}`);
  check(px.icon.red > 0.15, 'v PNG je ikonka'); check(px.arrow.red > 0.3, 'v PNG je šipka'); check(px.route.blue > 0.05, 'v PNG je trasa');
  check(px.label.white > 0.2 && px.label.dark > 0.02, 'v PNG je popisek'); check(px.perimTag.dark > 0.15, 'v PNG je popisek perimetru');
  check(px.corner.clear === 0, 'běžné PNG má podklad mapy');

  // --- průhledné pozadí + název podle projektu ---
  await page.evaluate(() => { const p = document.getElementById('projectName'); if(p) p.value = 'Požár Světlá'; const t = document.getElementById('exportTransparent'); t.checked = true; t.dispatchEvent(new Event('change', {bubbles:true})); });
  check(window_name_ok(await page.evaluate(() => window.__pzFns.getExportBaseName())), 'název podle projektu: pozar-svetla');
  d0 = downloads.length; await page.click('#exportPngBtn');
  check(await waitDl(d0 + 1) && downloads[d0].suggestedFilename() === 'pozar-svetla-alpha.png', 'průhledné PNG: ' + downloads[d0]?.suggestedFilename());
  px = await scan(await save(downloads[d0], '24_export_alpha.png'), spots);
  check(px.corner.clear === 1, 'průhledné PNG: podklad je průhledný');
  check(px.arrow.red > 0.3 && px.icon.red > 0.15 && px.route.blue > 0.05 && px.perimTag.dark > 0.15, 'průhledné PNG: šipka, ikonka, trasa i popisek perimetru zůstaly');
  await page.evaluate(() => { const t = document.getElementById('exportTransparent'); t.checked = false; t.dispatchEvent(new Event('change', {bubbles:true})); });

  // --- video: průběh, dvojklik, délka; k tomu skript pro After Effects ---
  await page.evaluate(() => { document.getElementById('aeExport').checked = true; });
  d0 = downloads.length;
  await page.evaluate(() => { const b = document.getElementById('exportVideoBtn'); b.click(); b.click(); });
  await page.waitForFunction(() => /%/.test(document.getElementById('exportProgressCount').textContent), null, {timeout: 120000}).catch(() => {});
  let u = await ui();
  check(u.progress && u.cover && u.disabled === 4 && /\d+ % · \d+\/5/.test(u.count), 'během exportu: průběh v procentech, tlačítka zakázaná — ' + u.count);
  await page.evaluate(() => window.__pzFns && document.getElementById('exportVideoBtn').click());
  check(await waitDl(d0 + 2), 'video i AE skript staženy');
  await page.waitForTimeout(1500);
  const names = downloads.slice(d0).map(d => d.suggestedFilename());
  check(names.length === 2 && names.includes('pozar-svetla.mp4') && names.includes('pozar-svetla_AE.jsx'), 'dvojklik nespustil druhý export; názvy: ' + names.join(', '));
  const mp4 = await save(downloads[d0 + names.indexOf('pozar-svetla.mp4')], '24_export.mp4');
  const pr = probe(mp4);
  if(pr === null) console.log('   (ffprobe není k dispozici — rozměr a počet snímků neověřen)');
  else check(pr === '640,360,5', 'MP4 640×360, 5 snímků: ' + pr);
  check(fs.statSync(mp4).size > 5000, 'MP4 není prázdné');
  await idle('video');
  await page.evaluate(() => { document.getElementById('aeExport').checked = false; });

  // --- zrušení ---
  d0 = downloads.length;
  await page.click('#exportVideoBtn');
  await page.waitForFunction(() => !document.getElementById('exportProgress').hidden, null, {timeout: 60000});
  await page.click('#exportCancelBtn');
  await page.waitForFunction(() => document.getElementById('exportProgress').hidden, null, {timeout: 120000}).catch(() => {});
  await page.waitForTimeout(800);
  check(/zrušen/i.test(await status(page)) && downloads.length === d0, 'zrušení: nic se nestáhlo, stav „' + await status(page) + '“');
  await idle('po zrušení');

  // --- PNG sekvence ---
  await page.evaluate(() => { document.getElementById('exportMoreDetails').open = true; });
  d0 = downloads.length; await page.click('#exportPngSeqBtn');
  check(await waitDl(d0 + 1) && downloads[d0].suggestedFilename() === 'pozar-svetla-png-sequence.zip', 'PNG sekvence: ' + downloads[d0]?.suggestedFilename());
  const zip = fs.readFileSync(await save(downloads[d0], '24_export_seq.zip')).toString('latin1');
  const frames = [...new Set(zip.match(/frame_\d{5}\.png/g) || [])].sort();
  check(frames.length === 5 && frames[0] === 'frame_00000.png' && frames[4] === 'frame_00004.png', 'ZIP má 5 snímků frame_00000–00004');
  await idle('PNG sekvence');

  // --- více formátů: každý svůj výřez a přípona ---
  await page.evaluate(() => document.querySelectorAll('#exportBatchList input').forEach(c => { c.checked = ['16x9', '9x16'].includes(c.dataset.tag); c.dataset.res = c.dataset.tag === '16x9' ? '640x360' : '360x640'; }));
  d0 = downloads.length;
  await page.evaluate(() => { const b = document.getElementById('exportBatchBtn'); b.click(); b.click(); });
  check(await waitDl(d0 + 2), 'více formátů: 2 videa');
  await page.waitForTimeout(2500);
  const bn = downloads.slice(d0).map(d => d.suggestedFilename());
  check(bn.length === 2 && bn[0] === 'pozar-svetla-16x9.mp4' && bn[1] === 'pozar-svetla-9x16.mp4', 'názvy s příponou poměru: ' + bn.join(', '));
  const p1 = probe(await save(downloads[d0], '24_batch_16x9.mp4')), p2 = probe(await save(downloads[d0 + 1], '24_batch_9x16.mp4'));
  if(p1 !== null) check(p1 === '640,360,5' && p2 === '360,640,5', `rozměry ${p1} a ${p2}`);
  check(/Hotovo/.test(await status(page)) && await page.$eval('#exportResolution', e => e.value) === 'custom', 'po dávce: hlášení a původní rozlišení zpět — ' + await status(page));
  await idle('více formátů');

  check(errors.length === 0, 'žádná chyba stránky' + (errors.length ? ' — ' + errors[0] : ''));
  await close(); done();
})();
function window_name_ok(n){ return n === 'pozar-svetla'; }
