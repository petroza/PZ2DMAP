// Spuštění: node worker/tools/eval.mjs   (EP=<endpoint> pro jiný worker). Stojí ~28 dotazů z denního limitu Workers AI.
// Regresní sada asistenta: jednotahové dotazy + navazující pokyny.
const U = process.env.EP || 'https://tnmap-chat.petrzavorka.workers.dev/api/chat';
const baseState = {center:{lng:15.5,lat:49.8}, zoom:7, baseStyle:'positron', globe:false, transportMode:'driving', tab:'styly', hasRoute:false};
const single = [
 ['ukaž Brno - Komín a přehradu', /gotoPlace|show3D/],
 ['kolik je to vzdušnou čarou z Prahy do Kyjeva', /measureDistance/],
 ['dej šipku z Prahy na Brno', /drawArrow/],
 ['zapni radar srážek', /^$/],                       // vrstvy počasí appka už nemá → žádný nástroj
 ['přidej popisek Letňany na mapu', /addLabel/],
 ['vyznač Středočeský kraj červeně', /^$/],          // barvení krajů zrušeno → jen vysvětlení
 ['nehoda v Humpolci', /placeIcon.*addLabel/],
 ['smaž všechno', /clearScene.*all/],
 ['dej popisky modře', /setLabelStyle/],
 ['červené auto na trase', /setVehicleColors/],
 ['ukaž celou Evropu', /showRegion/],
 ['ulož mi to jako png', /exportPng/],
 ['vypni budovy', /setLayers|setValues/],
 ['perimetr 2 km kolem Moskvy', /drawPerimeter/],
 ['satelit', /setBaseStyle/],
 ['zpět', /undo/],
 ['nehoda na D1 u Humpolce, uzavřeno směr Brno', /roadClosure|placeIcon/],
 ['vlakem z Brna do Ostravy', /routeBetween/],
 ['loď z Prahy do Mělníka', /routeBetween/],
 ['obarvi Ukrajinu žlutě a Rusko červeně', /colorPolitical/],
 ['přepni na tmavou mapu', /setBaseStyle|applyPreset/],
 ['otevři export', /openTab/],
 ['ikona požáru v Ostravě', /placeIcon/],
 ['kamion z Plzně do Prahy', /routeBetween/],
];
const multi = [
 {name:'přebarvit stát', turns:[['obarvi Polsko modře','colorPolitical({"country":"Polsko","color":"modrá"}) → ok']], state:{scene:{colored:{'Polsko':'#1f4fd8'}}}, q:'a teď ho dej červeně', expect:/colorPolitical.*Polsk.*(červ|#[ef])/i},
 {name:'zrušit stát', turns:[['obarvi Ukrajinu žlutě a Rusko červeně','colorPolitical({"country":"Ukrajina","color":"žlutá"}) → ok; colorPolitical({"country":"Rusko","color":"červená"}) → ok']], state:{scene:{colored:{'Ukrajina':'#ffd400','Rusko':'#e30613'}}}, q:'Rusko tam nechci', expect:/colorPolitical.*Rusko.*clear|clearScene.*Rusko/i},
 {name:'smazat popisek', turns:[['přidej popisek NEHODA v Brně','addLabel({"place":"Brno","text":"NEHODA"}) → ok']], state:{scene:{labels:['NEHODA']}}, q:'smaž ten popisek', expect:/clearScene|removeLabel|undo/i},
 {name:'zájmeno místo', turns:[['ukaž Ostravu','gotoPlace({"query":"Ostrava"}) → ok']], state:{}, q:'dej tam ikonu požáru', expect:/placeIcon.*Ostrav/i},
 {name:'změnit trasu', turns:[['trasa autem z Prahy do Brna','routeBetween({"from":"Praha","to":"Brno","mode":"driving"}) → ok']], state:{hasRoute:true, route:{from:'Praha',to:'Brno',mode:'driving'}}, q:'udělej to vlakem', expect:/routeBetween.*Praha.*Brno.*train|routeBetween.*train/i},
];
const post = async (messages, mapState) => {
  const t0 = Date.now();
  const r = await fetch(U, {method:'POST', headers:{'Content-Type':'application/json','Origin':'https://tnmap.pages.dev'}, body: JSON.stringify({messages, mapState})});
  const d = await r.json(); d._ms = Date.now()-t0; return d;
};
const fmt = d => (d.calls||[]).map(c=>c.tool+JSON.stringify(c.args||{})).join(' ; ');
let ok=0, n=0;
const only = process.env.ONLY;
for(const [q, re] of single){ if(only && only!=='single') break; n++;
  const d = await post([{role:'user',content:q}], baseState); const s = fmt(d); const pass = re.test(s); ok+=pass;
  console.log((pass?'✓':'✗'), q, '→', s.slice(0,150) || ('say: '+d.say), `(${d._ms} ms)`); }
for(const m of multi){ if(only==='single') break; n++;
  const msgs=[]; for(const [u,a] of m.turns){ msgs.push({role:'user',content:u}); msgs.push({role:'assistant',content:'Hotovo.\n[provedeno: '+a+']'}); }
  msgs.push({role:'user',content:m.q});
  const d = await post(msgs, Object.assign({}, baseState, m.state)); const s = fmt(d); const pass = m.expect.test(s); ok+=pass;
  console.log((pass?'✓':'✗'), '['+m.name+']', m.q, '→', s.slice(0,160) || ('say: '+d.say), `(${d._ms} ms)`); }
console.log(`\nVÝSLEDEK: ${ok}/${n}`);
