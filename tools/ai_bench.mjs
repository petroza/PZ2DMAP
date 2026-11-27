// Srovnávací test AI asistenta: zadání redaktorů → plán (nástroje + argumenty).
// Mapa se nespouští, hodnotí se jen plán z workeru, takže to stojí jen dotazy na model.
//   node tools/ai_bench.mjs <url-workeru> [model] [filtr]
//   např. node tools/ai_bench.mjs https://xxxxxxxx-tnmap-chat.petrzavorka.workers.dev @cf/google/gemma-4-26b-a4b-it
// Origin localhost dovolí workeru vybrat model z požadavku (jen pro testy).
const [, , URL_ = 'https://tnmap-chat.petrzavorka.workers.dev', MODEL, FILTER] = process.argv;
const S0 = {baseStyle: 'positron', zoom: 6.5, center: {lng: 15.4, lat: 49.8}, hasRoute: false, scene: {}};
const SR = {...S0, hasRoute: true, transportMode: 'driving', scene: {route: {from: 'Praha', to: 'Brno', mode: 'driving'}}};
const SP = {...S0, baseStyle: 'political', scene: {colored: {'Ukrajina': '#ffd500', 'Rusko': '#d00000'}}};
const T = (tool, args) => ({tool, args});
const re = r => ({re: r});
const CASES = [
  // základ
  {q: 'přepni na satelit', expect: [T('setBaseStyle', {style: 'satellite'})]},
  {q: 'chci světlou mapu jako na mapy.cz', expect: [T('applyPreset', {preset: re(/mapycz|mapycomTuristicka/)})]},
  {q: 'dej to do modrého TN stylu', expect: [T('applyPreset', {preset: 'tnModra'})]},
  {q: 'noční mapa jako v TN Live', expect: [T('applyPreset', {preset: 'tnLive'})]},
  {q: 'ukaž Česko', expect: [T('showRegion', {region: 'czechia'})]},
  {q: 'leť na Karlův most', expect: [T('gotoPlace', {query: re(/Karl/)})]},
  {q: 'ukaž 3D pohled na Pražský hrad', expect: [T('show3D', {query: re(/Hrad/i)})]},
  {q: 'nakloň kameru a otoč mapu na východ', expect: [T('setCamera', {})]},
  // trasy
  {q: 'trasa autem z Prahy do Brna', expect: [T('routeBetween', {from: 'Praha', to: 'Brno'})]},
  {q: 'cesta vlakem z Olomouce do Ostravy', expect: [T('routeBetween', {from: 'Olomouc', to: 'Ostrava', mode: 'train'})]},
  {q: 'loď po Vltavě z Prahy do Mělníka', expect: [T('routeBetween', {mode: 'boat'})]},
  {q: 'let z Prahy do New Yorku obloukem', expect: [T('routeBetween', {from: 'Praha', mode: re(/planeArc/)})]},
  {q: 'metrem z Hájů na Letňany', expect: [T('routeBetween', {from: 'Háje', to: 'Letňany', mode: 'metro'})]},
  {q: 'autobus 119 z Nádraží Veleslavín na letiště', expect: [T('routeLine', {line: '119'})]},
  {q: 'ukaž celou linku metra B', expect: [T('routeLine', {line: 'B'})]},
  {q: 'trasa kamionem z Ostravy do Plzně, zelená a tlustší, animace 20 sekund', expect: [T('routeBetween', {mode: 'truck'}), T('setColors', {route: re(/./)}), T('setValues', {routeWidth: re(/./), animDuration: 20})]},
  {q: 'ať po trase jede sanitka', state: SR, expect: [T('setVehicle', {type: 'ambulance'})]},
  {q: 'přidej hasiče, ať jedou proti němu', state: SR, expect: [T('addVehicle', {type: 'fire', reverse: true})]},
  {q: 'udělej to vlakem', state: SR, expect: [T('routeBetween', {from: 'Praha', to: 'Brno', mode: 'train'})]},
  {q: 'vypni stín pod autem a dej mu červenou barvu', state: SR, expect: [T('setVehicleColors', {shadow: false, body: re(/červ|#|red/i)})]},
  {q: 'přehraj animaci', state: SR, expect: [T('playAnimation', {action: 'play'})]},
  // scéna
  {q: 'nehoda na D1 u Humpolce', expect: [T('placeIcon', {kind: 'nehoda'}), T('addLabel', {})]},
  {q: 'požár v Ostravě, dej tam červený popisek POŽÁR', expect: [T('placeIcon', {kind: 'pozar'}), T('addLabel', {text: re(/POŽÁR/i), style: 'red'})]},
  {q: 'šipka z Kyjeva na Charkov', expect: [T('drawArrow', {from: 'Kyjev', to: 'Charkov'})]},
  {q: 'perimetr 30 km kolem Temelína', expect: [T('drawPerimeter', {km: 30})]},
  {q: 'jak daleko je to z Prahy do Moskvy', expect: [T('measureDistance', {from: 'Praha', to: 'Moskva'})]},
  {q: 'uzavírka D1 mezi Humpolcem a Větrným Jeníkovem', expect: [T('roadClosure', {from: 'Humpolec', to: 'Větrný Jeníkov'})]},
  {q: 'výluka metra C mezi Florencí a Kačerovem', expect: [T('metroClosure', {from: 'Florenc', to: 'Kačerov'})]},
  {q: 'zavřený Můstek', expect: [T('metroClosure', {station: 'Můstek'})]},
  // politická
  {q: 'politická mapa, Polsko modře a Německo zeleně, vlajky obou a popisek Varšava', expect: [T('setBaseStyle', {style: 'political'}), T('colorPolitical', {country: 'Polsko'}), T('colorPolitical', {country: 'Německo'}), T('placeFlag', {country: 'Polsko'}), T('placeFlag', {country: 'Německo'}), T('addLabel', {place: 'Varšava'})]},
  {q: 'Rusko tam nechci', state: SP, expect: [T('colorPolitical', {country: 'Rusko', clear: true})]},
  {q: 'Ukrajinu dej modře', state: SP, expect: [T('colorPolitical', {country: 'Ukrajina', color: re(/modr|#|blue/i)})]},
  {q: 'dej tam název státu Slovensko bez toho červeného bodu', expect: [T('addLabel', {place: 'Slovensko', side: 'none'})]},
  {q: 'obarvi Jihomoravský kraj', expect: [], empty: true},
  // vzhled a vrstvy
  {q: 'vypni budovy a popisky', expect: [T('setLayers', {buildings: false, labels: false})]},
  {q: 'slunce ať svítí od západu a zapni stíny', expect: [T('setValues', {sunAzimuth: 270}), T('setShadows', {on: true})]},
  {q: 'udělej dálnice oranžové', expect: [T('setColors', {motorway: re(/./)})]},
  // úklid a ovládání
  {q: 'smaž všechny popisky', expect: [T('clearScene', {what: 'labels'})]},
  {q: 'vrať to', expect: [T('undo', {})]},
  {q: 'ulož screenshot', expect: [T('exportPng', {})]},
  {q: 'chci exportovat video', expect: [T('openTab', {tab: 'export'})]},
  {q: 'jaké bude zítra počasí?', expect: [], empty: true},
];

const norm = v => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
function argOk(want, got){
  if(want && typeof want === 'object' && want.re) return want.re.test(String(got ?? ''));
  if(typeof want === 'boolean' || typeof want === 'number') return got === want || String(got) === String(want);
  return norm(got) === norm(want) || norm(got).startsWith(norm(want));
}
function judge(c, plan){
  const calls = plan.calls || [];
  if(c.empty) return calls.filter(x => !/openTab|openSection/.test(x.tool)).length === 0 ? '' : 'mělo být bez akce';
  const miss = [];
  for(const w of c.expect){
    const hit = calls.find(x => x.tool === w.tool && Object.entries(w.args || {}).every(([k, v]) => argOk(v, (x.args || {})[k])));
    if(!hit) miss.push(w.tool + JSON.stringify(w.args || {}, (k, v) => v && v.re ? String(v.re) : v));
  }
  return miss.length ? 'chybí ' + miss.join(', ') : '';
}

let ok = 0, n = 0, ms = 0;
for(const c of CASES){
  if(FILTER && !c.q.includes(FILTER)) continue;
  n++;
  const t0 = Date.now();
  let plan;
  try{
    const r = await fetch(URL_.replace(/\/$/, '') + '/api/chat', {method: 'POST', headers: {'Content-Type': 'application/json', Origin: 'http://localhost:8788'},
      body: JSON.stringify({model: MODEL, lang: 'cs', mapState: c.state || S0, messages: [{role: 'user', content: c.q}]})});
    plan = await r.json();
  }catch(e){ plan = {say: 'CHYBA ' + e.message, calls: []}; }
  const dt = Date.now() - t0; ms += dt;
  const bad = judge(c, plan);
  if(!bad) ok++;
  console.log((bad ? '✗ ' : '✓ ') + c.q + `  (${(dt / 1000).toFixed(1)} s)` + (bad ? '\n    ' + bad + '\n    plán: ' + (plan.calls || []).map(x => x.tool + JSON.stringify(x.args)).join(' ; ') + '\n    say: ' + plan.say : ''));
}
console.log(`\n${ok}/${n} v pořádku, průměr ${(ms / Math.max(1, n) / 1000).toFixed(1)} s na dotaz`);
