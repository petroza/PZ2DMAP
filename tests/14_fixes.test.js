// Opravy z velkého testu agentů: panel Projekt, karty, stav, státy česky,
// jazyky, trasa, export, krok zpět.
const {check, done, open, status, tab} = require('./lib');
(async () => {
  const {page, ctx, errors, close} = await open({wait: 1000,
    store: {}});
  // návrat uživatele, který naposledy skončil na Stylu (před přestavbou karet)
  await page.evaluate(() => { localStorage.setItem('map60_tab', 'styly'); localStorage.removeItem('pzTabsV2Migrated'); });
  await page.reload({waitUntil:'load'});
  await page.waitForFunction(() => /Mapa načtena/.test(document.getElementById('statusBar')?.textContent || '') || window.__tnMap?.loaded?.(), null, {timeout: 60000}).catch(() => {});
  check(await page.$eval('.tab-btn.active', e => e.dataset.tab) === 'scena', 'vracející se uživatel ze Stylu začne na Scéně');

  // první spuštění: výřez se zarovná na celé Česko (zoom už není výchozích 7)
  await page.waitForTimeout(1500);
  const cam = await page.evaluate(() => ({z: window.__tnMap.getZoom(), c: window.__tnMap.getCenter()}));
  check(Math.abs(cam.z - 7) > 0.01, `první spuštění zarovná zemi do rámečku (zoom ${cam.z.toFixed(2)})`);

  // stavový řádek nevykonává HTML
  await page.evaluate(() => __pzFns.setStatus('<img src=x onerror="window.__xss=1"><b>tučně</b>'));
  check(await page.evaluate(() => !document.querySelector('#statusBar img,#statusBar b') && !window.__xss), 'stav je jen text (žádné HTML)');

  // panel Projekt: bez fokusu do názvu, Enter uloží, klik mimo zavře
  await page.click('#projectPanelBtn');
  check(await page.evaluate(() => !document.getElementById('projectPanel').hidden), 'panel Projekt se otevře');
  check(await page.evaluate(() => document.activeElement?.id !== 'projectName'), 'otevření panelu neskočí do pole názvu');
  await page.fill('#projectName', 'Test ' + Date.now());
  await page.press('#projectName', 'Enter'); await page.waitForTimeout(600);
  check(/ulož/i.test(await status(page)), 'Enter v názvu projekt uloží (' + (await status(page)).slice(0, 60) + ')');
  await page.mouse.click(900, 600); await page.waitForTimeout(300);
  check(await page.evaluate(() => document.getElementById('projectPanel').hidden), 'klik do mapy panel zavře');
  // „?" při otevřeném Nastavení nic neotevře
  await page.evaluate(() => __pzFns.openSettings()); await page.keyboard.press('?');
  check(await page.evaluate(() => document.getElementById('shortcutsPanel').hidden), '„?" v Nastavení neotevře zkratky');
  await page.keyboard.press('Escape');

  // t() dosadí parametr i bez překladu
  check(await page.evaluate(() => __pzFns.t('Ahoj {0} světe', 3) === 'Ahoj 3 světe'), 't() bez překladu dosadí parametr');

  // státy česky, vyhledání česky i anglicky
  await page.evaluate(() => { __pzFns.requestGeoData(); });
  await page.waitForFunction(() => (document.getElementById('politicalCountrySelect')?.options.length || 0) > 50, null, {timeout: 60000}).catch(() => {});
  const names = await page.$$eval('#politicalCountrySelect option', o => o.map(x => x.textContent));
  check(names.includes('Německo') && names.includes('Rakousko'), 'seznam států česky (Německo, Rakousko)');
  const sug = q => page.evaluate(q => __pzFns.getCountrySearchItems(q).map(i => i.name), q);
  check((await sug('Německo'))[0] === 'Německo', 'hledání „Německo" najde Německo první');
  check((await sug('Germany'))[0] === 'Německo', 'hledání anglicky („Germany") funguje dál');
  check((await sug('Čad'))[0] === 'Čad', 'přesná shoda má přednost (Čad)');
  check(await page.evaluate(() => __pzFns.pzCountryFillOpacity(0.9) === 0 || document.getElementById('baseStyle').value === 'political'),
    'bez obarvených států žádný závoj přes mapu');

  // slovenština v sekci Státy
  await page.evaluate(() => __pzFns.applyLang('sk')); await page.waitForTimeout(800);
  const sk = await page.$eval('#countryBordersOverlaySection', e => e.textContent);
  check(/Štáty/.test(sk) && /Vyfarbiť/.test(sk) && /Ďalšie možnosti/.test(sk) && !/Obarvit|Další možnosti|Hranice států|Krytí/.test(sk), 'slovensky bez českých zbytků v sekci států');
  const skNames = await page.$$eval('#politicalCountrySelect option', o => o.map(x => x.textContent));
  check(skNames.includes('Nemecko'), 'slovensky názvy států slovensky (Nemecko)');
  await page.evaluate(() => __pzFns.applyLang('cs')); await page.waitForTimeout(500);
  check(/Obarvit/.test(await page.$eval('#countryBordersOverlaySection', e => e.textContent)), 'zpět česky');

  // seznam obarvených států: křížek zruší jeden, Smazat barvy všechny
  await page.evaluate(() => { __pzFns.state.countryColorMap = {DE:'#ff0000', AT:'#00ff00'}; __pzFns.syncCountrySelects('DE');
    document.getElementById('showPoliticalCountries').dispatchEvent(new Event('change', {bubbles:true})); });
  await page.waitForTimeout(400);
  check(await page.$$eval('#pzCountryColorList .wp-item', e => e.length) === 2, 'seznam obarvených států má 2 řádky');
  await page.evaluate(() => document.querySelector('#pzCountryColorList .wp-item[data-country="DE"] .btn-remove').click());
  check(await page.evaluate(() => !__pzFns.state.countryColorMap.DE && !!__pzFns.state.countryColorMap.AT), 'křížek v seznamu zruší jen ten stát');
  await page.evaluate(() => document.getElementById('clearPoliticalCountryColorsBtn').click());
  check(await page.evaluate(() => Object.keys(__pzFns.state.countryColorMap).length === 0), 'Smazat barvy zruší všechny');

  // krok zpět: snímek shodný se stavem se přeskočí
  const undoOk = await page.evaluate(() => { const before = document.getElementById('mapLabelStyle')?.value;
    window.__pzPushUndo(); window.__pzPushUndo(); return window.__pzUndo(); });
  check(undoOk !== undefined, 'Ctrl+Z bez změny nespadne');

  // trasa: výchozí Auto má ikonku, po zastavení animace objekt zůstane
  const ROAD = [[14.42,50.08],[14.9,49.8],[15.6,49.43],[16.6,49.19]];
  await ctx.route(/routing\.openstreetmap\.de|router\.project-osrm\.org/, r => r.fulfill({status:200, contentType:'application/json',
    body: JSON.stringify({code:'Ok', routes:[{geometry:{type:'LineString', coordinates:ROAD}, distance:205000, duration:7500, legs:[]}], waypoints:[]})}));
  await page.evaluate(() => { __pzFns.state.animSystemIcon = null; __pzFns.state.animIconData = null; });
  await page.evaluate(() => window.TNMAP.routeBetween({from:'Praha', to:'Brno', mode:'driving'}));
  await page.waitForTimeout(1500);
  check(await page.evaluate(() => __pzFns.state.animSystemIcon === 'car'), 'Auto bez zvolené ikonky dostane ikonku auta');
  await page.evaluate(() => { __pzFns.playAnimation(); }); await page.waitForTimeout(700);
  await page.evaluate(() => { __pzFns.stopAnimation(); }); await page.waitForTimeout(500);
  check(await page.$$eval('.animated-marker', e => e.length) >= 1, 'po zastavení animace objekt zůstane na startu');
  check(await page.evaluate(() => { __pzFns.state.animSystemIcon = null; __pzFns.state.animIconData = 'data:image/png;base64,x'; const a = __pzFns.finalAngle(0); __pzFns.state.animIconData = null; return Math.abs(a - __pzFns.pzAutoHeading(__pzFns.state.routeCoords, 0)) < 0.5; }),
    'vlastní ikonka bez základního úhlu auta');

  // export: sekce Akce otevřená, název souboru s diakritikou
  await tab(page, 'export');
  check(await page.evaluate(() => !document.getElementById('exportActionsSection').classList.contains('collapsed')), 'sekce Akce je rozbalená');
  check(await page.evaluate(() => { document.getElementById('projectName').value = 'Světlá Ústí'; return __pzFns.getExportBaseName(); }) === 'svetla-usti', 'název souboru převede diakritiku');
  check(await page.evaluate(() => { document.getElementById('projectName').value = ''; return /^tnmap-\d{8}-\d{4}$/.test(__pzFns.getExportBaseName()); }), 'bez projektu tnmap-datum-čas');

  // asistent: openSection přepne záložku
  const os = await page.evaluate(() => window.TNMAP.openSection?.({section:'countryBordersOverlaySection'}));
  check(await page.$eval('.tab-btn.active', e => e.dataset.tab) === 'scena', 'openSection přepne na záložku sekce ' + JSON.stringify(os));

  check(errors.length === 0, 'žádná chyba stránky' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await close(); done();
})();
