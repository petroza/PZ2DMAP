// Pokročilé funkce: výchozí skryté, zapnutí v Nastavení, pamatuje si volbu.
const {check, done, open} = require('./lib');
(async () => {
  const {page, errors, close} = await open();
  const vis = id => page.evaluate(id => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none'; }, id);
  const opts = () => page.$$eval('#baseStyle option', o => o.filter(x => !x.hidden).map(x => x.value));
  check(!(await vis('model3dSection')) && !(await vis('settingsCustomSources')), 'výchozí: 3D model a vlastní zdroje skryté');
  check(!(await opts()).includes('openTopo') && (await opts()).includes('satellite'), 'výchozí nabídka podkladů bez OpenTopo');
  await page.click('#openSettingsBtn'); await page.check('#advancedFeatures'); await page.waitForTimeout(300);
  check(await vis('model3dSection') && (await opts()).includes('openTopo'), 'zapnuto: vše vidět');
  await page.reload({waitUntil:'load'}); await page.waitForTimeout(5000);
  check(await vis('model3dSection'), 'volba přežije obnovení stránky');
  await page.click('#openSettingsBtn'); await page.uncheck('#advancedFeatures'); await page.keyboard.press('Escape');
  check(!(await vis('model3dSection')), 'vypnuto: zase skryté');
  check(errors.length === 0, 'žádná chyba stránky');
  await close(); done();
})();
