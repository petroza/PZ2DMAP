// POMALÝ (~5 min): hromadný export 16:9 + 9:16 — formát na výšku musí trasu doramovat.
const {check, done, open, OUT} = require('./lib');
const path = require('path'), {execFileSync} = require('child_process');
(async () => {
  const {page, errors, close} = await open();
  const r = await page.evaluate(async () => { const x = await window.TNMAP.routeBetween({from:'Praha', to:'Ostrava', mode:'train'}); window.TNMAP.setValues({animDuration:1}); return x.ok; });
  check(r, 'trasa Praha–Ostrava'); await page.waitForTimeout(3000);
  await page.click('.tab-btn[data-tab="export"]');
  await page.evaluate(() => document.querySelectorAll('#exportBatchList input').forEach(c => { c.checked = ['16x9', '9x16'].includes(c.dataset.tag); }));
  const files = []; page.on('download', async d => { const f = path.join(OUT, 'batch_' + d.suggestedFilename()); await d.saveAs(f); files.push(f); });
  await page.evaluate(() => document.getElementById('exportBatchBtn').click());
  for(let i = 0; i < 120 && files.length < 2; i++) await page.waitForTimeout(5000);
  await page.waitForTimeout(3000);
  check(files.length === 2, 'vznikla 2 videa');
  try{
    for(const f of files){ const o = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', f]).toString().trim(); check(/1920,1080|1080,1920/.test(o), path.basename(f) + ' ' + o); }
  }catch(e){ console.log('   (ffprobe není k dispozici, rozměry neověřeny)'); }
  check(errors.length === 0, 'žádná chyba stránky');
  await close(); done();
})();
