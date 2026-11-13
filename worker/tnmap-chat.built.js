var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/worker.js
// Gemma 4 (MoE 26B/4B aktivních): ~9 000 neuronů / M vstupních tokenů oproti 26 668 u Llamy 3.3 70B.
// Se zkráceným promptem ~30 neuronů na dotaz → ~300 dotazů denně v bezplatném limitu (dřív ~45).
var MODEL = "@cf/google/gemma-4-26b-a4b-it";
// Bez „přemýšlení" — jinak model spálí max_tokens na úvahu a JSON nedopíše.
var NO_THINK = { chat_template_kwargs: { enable_thinking: false } };
// Jen pro srovnávací testy (Origin localhost): model z požadavku, ze seznamu.
var TEST_MODELS = ["@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/zai-org/glm-4.7-flash", "@cf/google/gemma-4-26b-a4b-it", "@cf/qwen/qwen3-30b-a3b-fp8", "@cf/openai/gpt-oss-20b", "@cf/meta/llama-4-scout-17b-16e-instruct"];
// Nástroje, jejichž výsledek se musí uživateli říct nahlas -> vynutí další kolo.
var READBACK = new Set(["measureDistance", "routeBetween", "drawPerimeter", "getState"]);
var TOOL_NAME = /^[a-zA-Z][a-zA-Z0-9_]*$/;
var ALLOWED = [
  "https://www.appcreate.cloud",
  "https://appcreate.cloud",
  "https://www.appcrate.cloud",
  "https://appcrate.cloud",
  "https://tnmap.pages.dev",
  "https://tnmap.petrzavorka.workers.dev"
];
var ALLOWED_PATTERN = /^https:\/\/[a-z0-9-]+\.tnmap\.pages\.dev$/;
// Verze workeru mají preview URL <hash>-tnmap.<subdoména>.workers.dev.
var ALLOWED_RE = /^https:\/\/([a-z0-9-]+\.)?(tnmap|map3d)\.petrzavorka\.workers\.dev$/;
function corsHeaders(origin) {
  const ok = origin && (ALLOWED.includes(origin) || ALLOWED_PATTERN.test(origin) || ALLOWED_RE.test(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin));
  return {
    "Access-Control-Allow-Origin": ok ? origin : ALLOWED[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}
__name(corsHeaders, "corsHeaders");
var json = /* @__PURE__ */ __name((obj, status, origin) => new Response(JSON.stringify(obj), {
  status: status || 200,
  headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(origin) }
}), "json");
var TOOLS = `
gotoPlace {query} – přelet na místo (město, ulice, "lat,lng").
showRegion {region} – výřez: world, europe, centralEurope, czechia, slovakia, bulgaria, croatia, romania.
show3D {query?, pitch?, zoom?} – místo ve 3D (Liberty + náklon).
setCamera {zoom?, zoomBy?, pitch?, bearing?} – kamera; zoomBy +1 přiblížit / -1 oddálit; pitch 0-85; bearing 0=sever.
setBaseStyle {style} – podklad: positron (světlý, výchozí), liberty (3D budovy), bright, basic, terrain (reliéf), omt3d, satellite, hybrid, osmStandard, openTopo (turistická), cyclOsm, esriTerrain, political (politická).
applyPreset {preset} – barevné schéma: tnSvetla, tnSvetlaKontrast, tnSvetlaVyrazna, tnModra (Modrá TN), tnStudio, tnLive (noční), libertyKlasicka, zelenaPrirodni (jako Google), modraPrirodni, mapycz, mapycomTuristicka (jako mapy.com), flightradar, waze, uber, ct24, tnNovaClean, novaBlue, novaTerrain, dark, slate, paper, news, sunset, ocean, mint, candy, neon, tn, reset.
placeIcon {place, kind?, size?, zoom?} – ikona na místo; kind: pin, vybuch, pozar, nehoda, policie, zachranka, povoden, letadlo, vlak, varovani.
addLabel {place, text?, size?, side?, style?} – popisek; bez text = název místa; side right|left|none (none = bez červeného bodu, např. název státu); style classic|navy|red|dark.
setLabelStyle {style, text?, all?} – změní styl existujících popisků (all:true = všech).
drawArrow {from, to, color?, width?} – šipka z místa do místa (postup, migrace). NENÍ to trasa.
measureDistance {from, to, color?} – vzdušná vzdálenost; číslo vrátí ve výsledku.
drawPerimeter {place?, km?, meters?, color?} – kružnice/okruh kolem místa.
colorPolitical {country, color?, clear?} – obarví stát; clear:true se státem = zrušit jen ten, bez státu = všechny. Kraje ČR NEUMÍ.
placeFlag {country, place?} – vlajka státu na mapu. Víc států = víc volání.
roadClosure {from, to, via?, detourVia?, label?} – uzavírka silnice/dálnice mezi obcemi (via = obec na úseku, detourVia = objížďka).
metroClosure {line?, station?, from?, to?, label?} – výluka pražského metra A/B/C: stanice nebo úsek.
placeModel3d {place?, size?, scale?, rotation?, snap?} – umístí už nahraný GLB model.
setColors {prvek:"barva", …} – barvy (#rrggbb nebo česky): route, routeDots, land, water, building, park, landcover, landuse, aeroway, roadMajor, roadMinor, motorway, roadPrimary, roadSecondary, railway, transit, label, labelHalo, boundary, countryBorder, perimeter, arrow, distance, country.
setValues {ovladač:číslo, …} – čísla: sunAzimuth 0-360, sunElevation 5-85, shadowOpacity 0-100, shadowSoftness 0-100, aoStrength 0-100, buildingOpacity 0-1, routeWidth 1-16, routeGlow 0-100, mapLabelSize 14-80, boundaryWidth 0.2-5, boundaryOpacity 0-1, majorRoadWidth 0.2-4, minorRoadWidth 0.2-3, motorwayWidth 0.2-4, railwayWidth 0.2-4, sceneIconSize 16-96, animIconSize 18-96, arrowWidth 2-16, distanceWidth 1-12, perimeterOpacity 0-80, countryBorderWidth 0.5-10, countryFillOpacity 0-1, animDuration 1-180, cameraPitch 0-85, routeEndpointSize 12-48.
setLayers {vrstva:true/false, …} – zapnout/vypnout vrstvy: buildings, parks, labels, roadShields, majorRoads, minorRoads, motorways, primaryRoads, secondaryRoads, railways, waterways, metro, transit, boundaries, countryBorders, countryColors, landcover, landuse, aeroway, routeTrail, exportFrame.
setGlobe {on} – glóbus.
setShadows {on?, ao?, strength?} – on = stíny budov, ao = ambientní okluze (jiná věc), strength 0-100.
setTransportMode {mode} – driving, truck, moto, train, metro, tram, boat, foot, cycle, planeDirect, planeArc, planeCustom.
routeBetween {from, to, mode?} – najde a vykreslí trasu (sama doramuje). Jen from/to/mode, žádné "via".
routeLine {line, from?, to?} – trasa linky MHD Praha (bus, tramvaj, metro, vlak S) mezi zastávkami; bez from/to celá linka.
setVehicle {type} – vozidlo na trase: car, truck (kamion s návěsem), lorry (nákladní), train, metro, tram, bus, boat, fire, police, ambulance, plane.
addVehicle {type, reverse?, delay?} – další vozidlo na stejné trase; reverse:true = opačný směr; delay 0-0.9.
setVehicleColors {preset?, body?, accent?, shadow?} – barvy vozidla: preset auto|light|dark|blue, body, accent, shadow true/false (stín pod vozidlem).
fitRoute {} – ukáže celou trasu.
arcBestView {} – 3D pohled na letecký oblouk.
playAnimation {action} – play, pause, stop, rewind.
exportPng {} – uloží snímek PNG.
selectObjects {action} – all, none, delete (ikonky a popisky).
clearScene {what} – smaže: labels, icons, arrows, perimeters, distances, closures, colors, flags, route, all.
undo {} – krok zpět.  redo {} – krok vpřed.
openTab {tab} – scena, trasa, animace, export, styly, projekt, nastaveni.
openSection {section} – POVOLENÁ ID: mapLabelSection, sceneIconSection, sceneArrowSection, pzClosureSection, scenePerimeterSection, sceneDistanceSection, countryBordersOverlaySection, model3dSection, navigationABSection, animationSystemIconsSection, waypointSection, flightWaypointSection, cameraAnimSection, exportActionsSection, stylePresetSection, presetManageSection, sunShadowSection, tileSourcesSection.
setUiTheme {mode} – vzhled aplikace light|dark.
setLanguage {lang} – cs, sk, bg, hr, ro, en.
resetApp {} – rozhraní na začátek (nic nemaže).
`.trim();
var LANG_NAMES = { sk: "slovensky", bg: "bulharsky", hr: "chorvatsky", ro: "rumunsky", en: "anglicky" };
function systemPrompt(mapState, lang) {
  const replyLang = LANG_NAMES[lang] ? '"say" piš ' + LANG_NAMES[lang] + "." : '"say" piš česky.';
  return `Jsi asistent mapové aplikace TN mapa (televizní grafika). Mapu ovládáš voláním nástrojů. ${replyLang}

NÁSTROJE:
${TOOLS}

STAV MAPY: ${JSON.stringify(mapState || {})}

ODPOVĚĎ: vždy JEN jeden JSON objekt, bez markdownu:
{"say":"krátká věta","calls":[{"tool":"…","args":{…},"label":"…"}],"done":true}

PRAVIDLA:
- Splň CELÉ zadání redaktora: rozlož ho na všechny potřebné kroky v logickém pořadí (podklad → trasa → vozidlo → popisky…). Neptej se, když to jde udělat.
- Jen nástroje a hodnoty ze seznamu. Místa v 1. pádu (z Prahy → Praha). "Brno-Komín" je jedno místo. Opravuj překlepy.
- Nevymýšlej místa z běžných slov ("hoď tam satelit" = jen setBaseStyle). Nejvýš jeden gotoPlace/show3D v plánu.
- Víc států / vlajek / ikon = samostatné volání pro každý.
- Vzdálenost: measureDistance a "done":false; číslo řekni až z výsledků. Nikdy nehádej čísla.
- Odkazy ("to", "ho", "tam", "Rusko ne", "udělej to vlakem") vztahuj ke STAVU MAPY (scene) a předchozím krokům: uprav existující věc, nevytvářej novou.
- "vrať/zpět/zruš to" = undo; "smaž všechno" = clearScene all; resetApp jen na "reset/na začátek".
- Událost na místě ("nehoda v Humpolci") = placeIcon + addLabel se stejným place.
- Praha MHD: "metrem/tramvají z A do B" = routeBetween s mode metro/tram; konkrétní číslo linky = routeLine. Vozidlo (autobus, sanitka…) = setVehicle, víc vozidel = addVehicle.
- Trasa přes místo: routeBetween + openSection waypointSection a v "say" řekni, ať zastávku doklikne.
- Neumíš: barvit kraje ČR, počasí, export videa, ukládat projekty, nahrávat soubory. Řekni to a případně otevři správnou záložku. PNG umíš (exportPng).
- "say" max 2 věty, popisuje jen to, co nástroje opravdu dělají. Na "co umíš" odpověz lidsky bez názvů funkcí. Nesouvisející dotaz: prázdné calls.

PŘÍKLADY:
"trasa vlakem z Prahy do Brna" -> {"say":"Kreslím trasu vlakem Praha–Brno.","calls":[{"tool":"routeBetween","args":{"from":"Praha","to":"Brno","mode":"train"},"label":"Trasa"}],"done":true}
"nehoda v Humpolci" -> {"say":"Označuji nehodu v Humpolci.","calls":[{"tool":"placeIcon","args":{"place":"Humpolec","kind":"nehoda","zoom":12.5},"label":"Ikonka"},{"tool":"addLabel","args":{"place":"Humpolec","text":"NEHODA"},"label":"Popisek"}],"done":true}
"politická mapa, Ukrajina žlutě, Rusko červeně, k tomu vlajky" -> {"say":"Politická mapa s Ukrajinou a Ruskem a jejich vlajkami.","calls":[{"tool":"setBaseStyle","args":{"style":"political"},"label":"Politická"},{"tool":"colorPolitical","args":{"country":"Ukrajina","color":"žlutá"},"label":"Ukrajina"},{"tool":"colorPolitical","args":{"country":"Rusko","color":"červená"},"label":"Rusko"},{"tool":"placeFlag","args":{"country":"Ukrajina"},"label":"Vlajka"},{"tool":"placeFlag","args":{"country":"Rusko"},"label":"Vlajka"}],"done":true}
"tramvaj 22 z Bílé Hory na Náměstí Míru" -> {"say":"Kreslím trasu tramvaje 22.","calls":[{"tool":"routeLine","args":{"line":"22","from":"Bílá Hora","to":"Náměstí Míru"},"label":"Linka 22"}],"done":true}
"obarvi Jihomoravský kraj" -> {"say":"Barvení krajů aplikace nemá. Můžu obarvit stát nebo nakreslit perimetr kolem Brna.","calls":[],"done":true}
"kolik je to z Prahy do Vídně" -> {"say":"Měřím.","calls":[{"tool":"measureDistance","args":{"from":"Praha","to":"Vídeň"},"label":"Vzdálenost"}],"done":false}`;
}
__name(systemPrompt, "systemPrompt");
function extractPlan(text) {
  if (!text || typeof text !== "string") return null;
  let t = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(t);
  } catch (_) {
  }
  const start = t.indexOf("{");
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < t.length; i++) {
    const c = t[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(t.slice(start, i + 1));
        } catch (_) {
          return null;
        }
      }
    }
  }
  return null;
}
__name(extractPlan, "extractPlan");
// Klient ukládá své odpovědi do historie jako text „věta\n[provedeno: nástroj({…}) → ok; …]".
// Model pak ten tvar napodobil a z jeho prózy se jako „plán" vytáhly jen argumenty
// (→ prázdné „Hotovo." a nic se nestalo). Historii proto posíláme jako JSON plány
// a napodobeninu, když přece jen přijde, převedeme na skutečná volání.
function parseDoneCalls(text) {
  const m = /\[provedeno:\s*([\s\S]*?)\]\s*$/.exec(String(text || ""));
  if (!m) return null;
  const calls = [];
  for (const part of m[1].split(/;\s*(?=[a-zA-Z][a-zA-Z0-9]*\()/)) {
    const mm = /^([a-zA-Z][a-zA-Z0-9]*)\(([\s\S]*)\)(?:\s*→[\s\S]*)?$/.exec(part.trim());
    if (!mm) continue;
    let args = {};
    try { args = mm[2].trim() ? JSON.parse(mm[2]) : {}; } catch (_) { continue; }
    calls.push({ tool: mm[1], args: args && typeof args === "object" ? args : {}, label: mm[1] });
  }
  return { say: String(text).slice(0, m.index).trim(), calls };
}
__name(parseDoneCalls, "parseDoneCalls");
function historyAsPlan(text) {
  const p = parseDoneCalls(text);
  if (!p) return JSON.stringify({ say: String(text || "").trim(), calls: [], done: true });
  return JSON.stringify({ say: p.say, calls: p.calls.map((c) => ({ tool: c.tool, args: c.args })), done: true });
}
__name(historyAsPlan, "historyAsPlan");
function sanitizePlan(plan) {
  if (typeof plan === "string") plan = extractPlan(plan);
  if (!plan || typeof plan !== "object") return { say: "Nerozumím, zkus to prosím jinak.", calls: [], done: true };
  if (!plan.say && !plan.calls) {
    for (const k of ["response", "plan", "result", "output"]) {
      if (plan[k] && typeof plan[k] === "object") {
        plan = plan[k];
        break;
      }
    }
  }
  if (!plan.say && !plan.calls && !plan.tool) return { say: "Nerozumím, zkus to prosím jinak.", calls: [], done: true };
  if (!plan.calls && typeof plan.tool === "string") plan = { say: "", calls: [plan], done: true };
  const calls = Array.isArray(plan.calls) ? plan.calls.slice(0, 8) : [];
  let say = plan.say;
  if (typeof say !== "string") say = say == null ? "" : Array.isArray(say) ? say.filter((x) => typeof x === "string").join(" ") : "";
  return {
    say: say.trim() ? say.trim().slice(0, 400) : calls.length ? "Provádím…" : "Hotovo.",
    calls: calls.filter((c) => c && typeof c.tool === "string").map((c) => ({
      tool: c.tool,
      args: c.args && typeof c.args === "object" ? c.args : {},
      label: typeof c.label === "string" ? c.label.slice(0, 80) : c.tool
    })),
    done: plan.done !== false
  };
}
__name(sanitizePlan, "sanitizePlan");
var worker_default = {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (request.method === "GET") return json({ ok: true, service: "tnmap-chat", model: MODEL }, 200, origin);
    if (request.method !== "POST") return json({ error: "Použij POST." }, 405, origin);
    let body;
    try {
      body = await request.json();
    } catch (_) {
      return json({ error: "Neplatný JSON." }, 400, origin);
    }
    const history = Array.isArray(body.messages) ? body.messages.slice(-8) : [];
    const model = /^http:\/\/localhost(:\d+)?$/.test(origin) && TEST_MODELS.includes(body.model) ? body.model : MODEL;
    if (!history.length) return json({ say: "Napiš mi, co má mapa udělat.", calls: [], done: true }, 200, origin);
    const messages = [{ role: "system", content: systemPrompt(body.mapState, typeof body.lang === "string" ? body.lang.slice(0, 2).toLowerCase() : "cs") }];
    for (const m of history) {
      const role = m && m.role === "assistant" ? "assistant" : "user";
      let content = String(m && m.content || "").slice(0, 2e3);
      if (role === "assistant" && content && !/^\s*\{/.test(content)) content = historyAsPlan(content);
      if (content) messages.push({ role, content });
    }
    if (Array.isArray(body.toolResults) && body.toolResults.length) {
      messages.push({
        role: "user",
        content: "VÝSLEDKY PROVEDENÝCH NÁSTROJŮ:\n" + JSON.stringify(body.toolResults).slice(0, 3e3) + '\nPokud je úkol hotový, vrať {"say":"...","calls":[],"done":true}. Pokud něco selhalo, vysvětli to v "say" nebo to zkus jinak. Pokud je potřeba další krok, vrať ho v "calls".'
      });
    }
    try {
      // Strop se platí jen za skutečně vygenerované tokeny, krátkou odpověď
      // nezdraží; 450 ale ořízne delší plán uprostřed JSONu.
      const extra = model !== MODEL && body.extra && typeof body.extra === "object" ? body.extra : {};
      const think = /gemma-4|qwen3|glm-4/.test(model) ? NO_THINK : {};
      const out = await env.AI.run(model, { messages, max_tokens: 900, temperature: 0.2, ...think, ...extra });
      if (body.debug && model !== MODEL) return json({ raw: out }, 200, origin);
      const r = out && (out.response ?? out.result ?? out.output_text);
      let plan = null;
      if (r && typeof r === "object") plan = r;
      else if (typeof r === "string" && r.trim()) plan = extractPlan(r);
      if (!plan) {
        const c = out && out.choices && out.choices[0] && out.choices[0].message && out.choices[0].message.content;
        if (typeof c === "string") plan = extractPlan(c);
        else if (c && typeof c === "object") plan = c;
      }
      // Jedno opravné kolo. Bez něj je selhání parsování koncový stav a uživatel
      // dostane hluché "Nerozumím" i na dotaz, kterému model rozuměl.
      if (!plan) {
        try {
          const fix = await env.AI.run(model, {
            messages: [
              ...messages,
              { role: "assistant", content: String(r || "").slice(0, 500) },
              { role: "user", content: 'Tohle nebyl platný JSON. Vrať POUZE jeden JSON objekt {"say":"…","calls":[],"done":true}, nic jiného, žádný text okolo.' }
            ],
            max_tokens: 900,
            temperature: 0,
            ...think
          });
          const fr = fix && (fix.response ?? fix.result ?? fix.output_text);
          plan = fr && typeof fr === "object" ? fr : typeof fr === "string" ? extractPlan(fr) : null;
        } catch (_) {
        }
      }
      // Když i tak přišla próza, je to skoro vždy použitelná odpověď nebo doptání.
      // Ukázat ji je vždy lepší než ji zahodit a napsat "Nerozumím".
      if (typeof r === "string" && /\[provedeno:/.test(r)) {
        const p = parseDoneCalls(r.trim());
        if (p && p.calls.length) plan = { say: p.say, calls: p.calls, done: true };
      }
      if (!plan && typeof r === "string" && r.trim().length > 2 && !r.includes("{")) {
        plan = { say: r.trim().slice(0, 400), calls: [], done: true };
      }
      const finalPlan = sanitizePlan(plan);
      // Model občas pošle totéž volání dvakrát — jednou s prázdnými args. Nechat
      // oboje znamená nakreslit dvě čáry nebo spustit akci dvakrát. Držíme pro
      // každý nástroj tu variantu, která opravdu nese argumenty.
      {
        // Pozor: víc volání TÉHOŽ nástroje s různými args je legitimní (dvě země,
        // dvě ikony, dvě šipky). Zahazujeme jen přesné duplikáty a prázdné kopie.
        const valid = finalPlan.calls.filter((c) => TOOL_NAME.test(c.tool));
        const withArgs = new Set(valid.filter((c) => Object.keys(c.args || {}).length).map((c) => c.tool));
        const seenKeys = /* @__PURE__ */ new Set();
        finalPlan.calls = valid.filter((c) => {
          const empty = !Object.keys(c.args || {}).length;
          if (empty && withArgs.has(c.tool)) return false;
          const key = c.tool + "|" + JSON.stringify(c.args || {});
          if (seenKeys.has(key)) return false;
          seenKeys.add(key);
          return true;
        });
      }
      // say občas nese ocásek rozbitého JSON — uživateli ho neukazujeme.
      finalPlan.say = String(finalPlan.say || "").replace(/[,{\[]?\s*['"]?(done|calls|args|tool)['"]?\s*:.*$/s, "").trim() || (finalPlan.calls.length ? "Provádím…" : "Hotovo.");
      // done defaultuje na true, takže klient smyčku ukončil a změřenou hodnotu
      // nikdy nevyslovil. U čtecích nástrojů si další kolo vynutíme sami.
      if (finalPlan.calls.some((c) => READBACK.has(c.tool))) finalPlan.done = false;
      try {
        const lastUser = [...history].reverse().find((m) => m && m.role === "user");
        const tools = (finalPlan.calls || []).map((c) => c.tool).join(",") || "NONE";
        console.log(JSON.stringify({
          tag: "tnchat",
          miss: tools === "NONE",
          q: String(lastUser && lastUser.content || "").slice(0, 200),
          tools,
          say: String(finalPlan.say || "").slice(0, 120),
          round: history.filter((m) => m && m.role === "user").length
        }));
      } catch (_) {
      }
      return json(finalPlan, 200, origin);
    } catch (e) {
      const msg = String(e && e.message || e);
      // Vyčerpaný denní limit Workers AI (4006) — grafik dřív viděl anglickou technickou hlášku.
      if (/4006|daily free allocation|neurons/i.test(msg)) {
        return json({ say: "Asistent má na dnešek vyčerpaný denní limit (obnoví se v 1:00). Jednoduché povely jako „zpět“, „satelit“, „nehoda v Brně“, „smaž popisky“ nebo „export png“ fungují dál, vše ostatní zvládneš v panelu vlevo.", calls: [], done: true, quota: true }, 200, origin);
      }
      return json({ say: "Asistent teď nemůže odpovědět (" + msg.slice(0, 120) + ").", calls: [], done: true }, 200, origin);
    }
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map

