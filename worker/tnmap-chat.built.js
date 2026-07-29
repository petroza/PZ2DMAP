var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/worker.js
var MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
// Nástroje, jejichž výsledek se musí uživateli říct nahlas -> vynutí další kolo.
var READBACK = new Set(["measureDistance", "routeBetween", "drawPerimeter", "getState"]);
var TOOL_NAME = /^[a-zA-Z][a-zA-Z0-9_]*$/;
var ALLOWED = [
  "https://www.appcreate.cloud",
  "https://appcreate.cloud",
  "https://www.appcrate.cloud",
  "https://appcrate.cloud",
  "https://tnmap.petrzavorka.workers.dev"
];
// Verze workeru mají preview URL <hash>-tnmap.<subdoména>.workers.dev, takže je
// potřeba pustit i je — jinak se nová verze mapy nedá odladit vedle produkce.
var ALLOWED_RE = /^https:\/\/([a-z0-9-]+\.)?(tnmap|map3d)\.petrzavorka\.workers\.dev$/;
function corsHeaders(origin) {
  const ok = origin && (ALLOWED.includes(origin) || ALLOWED_RE.test(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin));
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
gotoPlace {query}                  \u2013 odlet\xED na m\xEDsto (m\u011Bsto, ulice, "lat,lng"). Pou\u017Eij pro "uka\u017E/najdi/le\u0165 na X".
show3D {query?, pitch?, zoom?}     \u2013 KOMBO: odlet\xED na m\xEDsto, p\u0159epne na Liberty 3D a naklon\xED kameru. Pro "uka\u017E 3D X", "3D pohled na X".
setCamera {zoom?, pitch?, bearing?} \u2013 jen kamera. pitch 0=shora, 60-85=hodn\u011B naklonit. bearing = oto\u010Den\xED (0=sever).
setBaseStyle {style}               \u2013 podklad. Povolen\xE9: liberty (3D budovy, v\xFDchoz\xED), bright, positron (sv\u011Btl\xFD), satellite, hybrid, osmStandard, openTopo, cyclOsm, esriTerrain, political.
placeIcon {place, size?}            \u2013 um\xEDst\xED U\u017D NAHRANOU ikonku sc\xE9ny na m\xEDsto. Obr\xE1zek ikonky
                                     nahr\xE1t neum\xED\u0161 \u2014 kdy\u017E \u017E\xE1dn\xE1 nen\xED, n\xE1stroj to \u0159ekne a otev\u0159e sekci.
addLabel {place, text?, size?, side?} \u2013 P\u0158ID\xC1 POPISEK do mapy na dan\xE9 m\xEDsto. Bez "text" pou\u017Eije
                                     n\xE1zev m\xEDsta. "p\u0159idej popisek Let\u0148any" -> {"place":"Let\u0148any"}.
setWeather {vrstva:true/false, opacity?} \u2013 zapne/vypne vrstvy po\u010Das\xED. Kl\xED\u010De: radar (radar sr\xE1\u017Eek),
                                     precip, clouds, temp, wind, pressure, owmClouds, opacity 20-100.
                                     "zapni radar sr\xE1\u017Eek" -> {"radar":true}.
drawArrow {from, to, color?, width?} \u2013 VYKRESL\xCD \u0160IPKU z m\xEDsta do m\xEDsta (postup vojsk, migrace,
                                     sm\u011Br \xFAderu). "\u0161ipka z Prahy na Brno" -> {"from":"Praha","to":"Brno"}.
                                     \u0160ipka NEN\xCD trasa \u2014 nikdy na to nepou\u017E\xEDvej routeBetween!
measureDistance {from, to, color?}  \u2013 ZM\u011A\u0158\xCD vzdu\u0161nou vzd\xE1lenost mezi dv\u011Bma m\xEDsty, vykresl\xED ji
                                     s popiskem a vr\xE1t\xED distanceKm (to \u010D\xEDslo pak napi\u0161 do "say").
                                     Pro "zm\u011B\u0159 vzd\xE1lenost", "jak daleko je to z A do B".
placeModel3d {place?, size?, scale?, rotation?, snap?} \u2013 um\xEDst\xED U\u017D NAHRAN\xDD GLB model na m\xEDsto
                                     a nastav\xED velikost/m\u011B\u0159\xEDtko/rotaci. Samotn\xFD .glb soubor
                                     nahr\xE1t neum\xED\u0161 \u2014 kdy\u017E \u017E\xE1dn\xFD nen\xED, n\xE1stroj to \u0159ekne a otev\u0159e sekci.
colorPolitical {region?, country?, color?, clear?} \u2013 VYBARV\xCD kraj \u010CR nebo st\xE1t na politick\xE9 map\u011B
                                     (volebn\xED/region\xE1ln\xED grafika). "vyzna\u010D St\u0159edo\u010Desk\xFD kraj \u010Derven\u011B"
                                     -> {"region":"St\u0159edo\u010Desk\xFD kraj","color":"\u010Derven\xE1"};
                                     "zv\xFDrazni N\u011Bmecko mod\u0159e" -> {"country":"N\u011Bmecko","color":"modr\xE1"}.
                                     clear:true sma\u017Ee v\u0161echno vybarven\xED. Nezapome\u0148, \u017Ee politickou
                                     mapu obvykle chce\u0161 i jako podklad: setBaseStyle {"style":"political"}.
setColors {prvek:"#rrggbb", \u2026}     \u2013 nastav\xED BARVY. Kl\xED\u010De: route (trasa), routeDots (body A/B),
                                     land, water, building, park, landcover, landuse, aeroway,
                                     roadMajor, roadMinor, label, labelHalo, boundary,
                                     countryBorder, perimeter, arrow, distance, czRegion, country.
                                     Bere #rrggbb i \u010Desk\xE9 n\xE1zvy (\u010Derven\xE1, modr\xE1, zelen\xE1, \u017Elut\xE1,
                                     oran\u017Eov\xE1, b\xEDl\xE1, \u010Dern\xE1, \u0161ed\xE1).
                                     "ud\u011Blej trasu \u010Dervenou" -> {"route":"\u010Derven\xE1"}.
                                     Barvy NIKDY nepos\xEDlej p\u0159es setValues!
drawPerimeter {place?, km?, meters?, color?} \u2013 VYKRESL\xCD KRU\u017DNICI (perimetr) o dan\xE9m r\xE1diusu
                                     okolo m\xEDsta a doramuje ji. Pro "perimetr/okruh/dosah/
                                     do vzd\xE1lenosti X od Y", "kruh 2000 km okolo Moskvy".
                                     Bez "place" pou\u017Eije st\u0159ed mapy. P\u0159\xEDklad:
                                     "perimetr 2000 metr\u016F od Moskvy" -> {"place":"Moskva","meters":2000}.
setValues {ovlada\u010D:\u010D\xEDslo, \u2026}       \u2013 nastav\xED \u010D\xEDseln\xE9 ovlada\u010De. Kl\xED\u010De a rozsahy:
                                     sunAzimuth 0-360 (0=od severu, 90=od v\xFDchodu, 180=od jihu,
                                       270=od z\xE1padu), sunElevation 5-85 (n\xEDzko=dlouh\xE9 st\xEDny),
                                     shadowOpacity 0-100, shadowSoftness 0-100, aoStrength 0-100,
                                     buildingOpacity 0-1, routeWidth 1-16, mapLabelSize 14-80,
                                     boundaryWidth 0.2-5, boundaryOpacity 0-1,
                                     majorRoadWidth 0.2-4, minorRoadWidth 0.2-3,
                                     sceneIconSize 16-96, animIconSize 18-96,
                                     animDuration 1-180, cameraPitch 0-85,
                                     routeEndpointSize 12-48 (velikost bod\u016F A/B).
                                     P\u0159\xEDklady: "slunce od z\xE1padu" -> {"sunAzimuth":270};
                                     "n\xEDzk\xE9 slunce, dlouh\xE9 st\xEDny" -> {"sunElevation":10};
                                     "tlust\u0161\xED trasa" -> {"routeWidth":10}.
setLayers {vrstva:true/false, \u2026}    \u2013 ZAPNE/VYPNE jednotliv\xE9 vrstvy v map\u011B. Tohle pou\u017Eij pro
                                     "vypni budovy", "skryj popisky", "schovej silnice" \u2014
                                     NIKDY na to nem\u011B\u0148 podklad p\u0159es setBaseStyle!
                                     Kl\xED\u010De: buildings, parks, labels, roadShields, majorRoads,
                                     minorRoads, motorways, railways, waterways, metro, transit,
                                     boundaries, landcover, landuse, aeroway, exportFrame.
                                     P\u0159\xEDklad: "vypni budovy a popisky" -> {"buildings":false,"labels":false}.
applyPreset {preset}               \u2013 barevn\xE9 sch\xE9ma. Nap\u0159.: dark, paper, news, uber, ct24, tn, tnNovaClean, ocean, mint, neon, sunset, slate, novaBlue, mapycz, reset.
setGlobe {on}                      \u2013 3D zem\u011Bkoule zapnout/vypnout.
setShadows {on?, ao?, strength?}   \u2013 POZOR, dv\u011B R\u016EZN\xC9 v\u011Bci (jen styl liberty, zoom 14+):
                                     on = vr\u017Een\xE9 st\xEDny budov od slunce ("st\xEDny", "vrhat st\xEDny").
                                     ao = ambientn\xED okluze / AO ("ambientn\xED okluze", "AO", "zast\xEDn\u011Bn\xED",
                                          "hloubka budov") \u2014 NIKDY nepou\u017E\xEDvej "on" pro AO!
                                     strength = s\xEDla AO 0-100. P\u0159\xEDklad: "zapni AO" -> {"ao":true}.
setTransportMode {mode}            \u2013 re\u017Eim trasy: driving (auto), foot (p\u011B\u0161ky), cycle (kolo), planeDirect, planeArc, planeCustom.
routeBetween {from, to, mode?}     \u2013 NAJDE A VYKRESL\xCD trasu mezi dv\u011Bma m\xEDsty. Pro "trasa z A do B", "cesta autem z A do B".
fitRoute {}                        \u2013 doramuje pohled na celou trasu.
arcBestView {}                     \u2013 ide\xE1ln\xED 3D pohled na leteck\xFD oblouk (jen po routeBetween s planeArc).
clearRoute {}                      \u2013 sma\u017Ee trasu.
openTab {tab}                      \u2013 otev\u0159e z\xE1lo\u017Eku: styly, trasa, scena, animace, projekt, export.
openSection {section}              \u2013 otev\u0159e konkr\xE9tn\xED n\xE1stroj/sekci. POVOLEN\xC1 ID (jin\xE1 NEEXISTUJ\xCD):
                                     stylePresetSection, styleColorsSection, presetManageSection,
                                     tileSourcesSection, sunShadowSection,
                                     countryBordersOverlaySection, czPoliticalSection,
                                     waypointSection (zast\xE1vky NA TRASE i vzhled trasy),
                                     flightWaypointSection, scenePerimeterSection,
                                     sceneDistanceSection, sceneArrowSection, sceneIconSection,
                                     model3dSection, mapLabelSection, weatherLayersSection,
                                     weatherModelSection, cameraAnimSection.
resetApp {}                        \u2013 reset na za\u010D\xE1tek (cel\xE1 \u010CR, Positron).
`.trim();
function systemPrompt(mapState) {
  return `Jsi asistent v \u010Desk\xE9 mapov\xE9 aplikaci PZ MAP (TN mapa) pro televizn\xED grafiku.
Ovl\xE1d\xE1\u0161 mapu VOL\xC1N\xCDM N\xC1STROJ\u016E. Odpov\xEDd\xE1\u0161 V\xDDHRADN\u011A \u010Desky.

DOSTUPN\xC9 N\xC1STROJE (jm\xE9no + parametry):
${TOOLS}

AKTU\xC1LN\xCD STAV MAPY:
${JSON.stringify(mapState || {}, null, 1)}

PRAVIDLA:
1. Odpov\u011Bz V\u017DDY jen jedn\xEDm JSON objektem, bez markdownu, bez \`\`\`:
   {"say":"kr\xE1tk\xE1 v\u011Bta co d\u011Bl\xE1\u0161","calls":[{"tool":"nazev","args":{...},"label":"co to d\u011Bl\xE1"}],"done":true}
2. "calls" m\u016F\u017Ee b\xFDt pr\xE1zdn\xE9, kdy\u017E jen odpov\xEDd\xE1\u0161 na dotaz nebo se pt\xE1\u0161 na dopln\u011Bn\xED.
2b. Kdy\u017E dotaz s mapou nesouvis\xED (\u010Das, po\u010Das\xED mimo mapu, obecn\xE9 ot\xE1zky) nebo ho neum\xED\u0161,
   vra\u0165 PR\xC1ZDN\xC9 "calls" a jen to vysv\u011Btli. NIKDY neotv\xEDrej n\xE1hodnou sekci jen proto,
   abys n\u011Bco ud\u011Blal \u2014 otev\u0159\xEDt sekci sm\xED jen kdy\u017E o ten n\xE1stroj u\u017Eivatel opravdu stoj\xED.
3. Pou\u017E\xEDvej JEN n\xE1stroje a hodnoty ze seznamu v\xFD\u0161e. Nevym\xFD\u0161lej si nov\xE9.
4. Skl\xE1dej v\xEDc krok\u016F do "calls" v logick\xE9m po\u0159ad\xED (nap\u0159. re\u017Eim \u2192 trasa \u2192 doramovat).
5. Pro "uka\u017E 3D X" pou\u017Eij show3D. Pro "trasa z A do B" pou\u017Eij routeBetween.
   Po routeBetween p\u0159idej fitRoute. Kdy\u017E je mode planeArc, p\u0159idej m\xEDsto fitRoute
   rovnou arcBestView (d\xE1 ide\xE1ln\xED 3D pohled na oblouk).
   V JEDNOM pl\xE1nu nikdy ned\xE1vej dvakr\xE1t gotoPlace/show3D \u2014 druh\xFD by prvn\xED p\u0159ebil.
   Kdy\u017E u\u017Eivatel jmenuje v\xEDc m\xEDst pro pohled, vyber to hlavn\xED a zmi\u0148 to v "say".
6. "say" je kr\xE1tk\xE9, v\u011Bcn\xE9, \u010Desky, bez odr\xE1\u017Eek. Max 2 v\u011Bty.
   "say" MUS\xCD popisovat jen to, co n\xE1stroje SKUTE\u010CN\u011A ud\u011Blaly. Kdy\u017E jsi jen otev\u0159el
   sekci, \u0159ekni "Otev\xEDr\xE1m\u2026" a dodej, co mus\xED u\u017Eivatel dokon\u010Dit s\xE1m \u2014 NIKDY netvr\u010F
   "P\u0159id\xE1v\xE1m popisek" nebo "M\u011B\u0159\xEDm", kdy\u017E jsi jen otev\u0159el n\xE1stroj.
6b. gotoPlace/show3D pou\u017Eij POUZE kdy\u017E u\u017Eivatel opravdu jmenuje m\xEDsto. Slova jako
   "ho\u010F", "hod tam", "dej", "\u0161oupni", "koukni" jsou POKYNY, ne n\xE1zvy m\u011Bst \u2014
   z nich NIKDY ned\u011Blej m\xEDsto (nap\u0159. "ho\u010F tam satelit" = jen setBaseStyle satellite,
   \u017E\xE1dn\xFD p\u0159elet). Kdy\u017E si nejsi jist\xFD, \u017Ee jde o m\xEDsto, p\u0159elet vynech.
6e. routeBetween um\xED JEN from/to/mode \u2014 parametr "via"/"p\u0159es" NEEXISTUJE. Kdy\u017E u\u017Eivatel chce
   trasu P\u0158ES n\u011Bjak\xE9 m\xEDsto nebo p\u0159idat zast\xE1vku, vykresli z\xE1kladn\xED trasu a otev\u0159i
   waypointSection s vysv\u011Btlen\xEDm, \u017Ee zast\xE1vku doklikne v map\u011B s\xE1m.
6f. UM\xCD\u0160 p\u0159\xEDmo: perimetr (drawPerimeter), \u0161ipku (drawArrow), m\u011B\u0159en\xED vzd\xE1lenosti
   (measureDistance), um\xEDst\u011Bn\xED u\u017E nahran\xE9ho GLB (placeModel3d) a vybarven\xED politick\xE9
   mapy (colorPolitical). \u0160ipka z A do B NEN\xCD routeBetween \u2014 pou\u017Eij drawArrow!
   Um\xED\u0161 i popisky (addLabel), po\u010Das\xED (setWeather) a um\xEDst\u011Bn\xED u\u017E nahran\xE9 ikonky (placeIcon).
   Vlastn\xED OBR\xC1ZEK ikonky ani .glb soubor nahr\xE1t neum\xED\u0161 \u2014 to je u\u017Eivatel\u016Fv soubor; tyhle
   n\xE1stroje ti samy \u0159eknou, kdy\u017E nic nahran\xE9ho nen\xED, a otev\u0159ou spr\xE1vnou sekci.
6c. Re\u017Eimy trasy jsou JEN: driving, foot, cycle, planeDirect, planeArc, planeCustom.
   VLAK ANI AUTOBUS aplikace neum\xED \u2014 nevym\xFD\u0161lej mode "train"/"bus". Kdy\u017E u\u017Eivatel chce
   vlak/autobus, \u0159ekni to na rovinu a nab\xEDdni auto (driving) nebo vzdu\u0161nou linku
   (planeDirect) jako n\xE1hradu; trasu vykresli jen v tom n\xE1hradn\xEDm re\u017Eimu.
6d. Na dotaz NA VZD\xC1LENOST ("kolik je to", "jak daleko", "vzdu\u0161nou \u010Darou")
   pou\u017Eij measureDistance {from, to} a vra\u0165 "done":false. \u010C\xEDslo NAPI\u0160 do "say"
   TEPRVE v dal\u0161\xEDm kole z distanceKm ve V\xDDSLEDC\xCDCH.
   NIKDY neuve\u010F \u017E\xE1dnou vzd\xE1lenost, azimut, plochu ani jin\xE9 \u010D\xEDslo, kter\xE9 nep\u0159i\u0161lo
   ve V\xDDSLEDC\xCDCH PROVEDEN\xDDCH N\xC1STROJ\u016E. Kdy\u017E \u010D\xEDslo nem\xE1\u0161, ZM\u011A\u0158 ho \u2014 nikdy nehádej.
   routeBetween d\xE1v\xE1 d\xE9lku po silnici; pro vzdu\u0161nou \u010D\xE1ru je to \u0161patn\xFD n\xE1stroj.
6g. Z\xE1jmena a odkazy ("to", "tam", "ten kraj", "na t\xE9 map\u011B", "tu barvu") vztahuj
   k AKTU\xC1LN\xCDMU STAVU MAPY v\xFD\u0161e a k tomu, co se provedlo v p\u0159edchoz\xEDch tazích.
   Kdy\u017E se odpov\u011B\u010F d\xE1 ur\u010Dit ze stavu, NEPTEJ se znovu a rovnou to prove\u010F.
   Odeb\xEDrac\xED a opravn\xE9 pokyny ("nechci", "zru\u0161", "ostatn\xED ne", "jen X", "vra\u0165 zp\xE1tky")
   NEJSOU nov\xFD p\u0159\xEDkaz \u2014 jsou \xFAprava toho, co u\u017E na map\u011B je. Spl\u0148 je zru\u0161en\xEDm nebo
   p\u0159ebarven\xEDm existuj\xEDc\xEDho prvku (nap\u0159. colorPolitical {"clear":true}), ne nov\xFDm vytvo\u0159en\xEDm.
6h. N\xE1zvy m\xEDst se spojovn\xEDkem jsou JEDNO m\xEDsto: "Brno-Kom\xEDn", "Praha-Libu\u0161",
   "Fr\xFDdek-M\xEDstek" -> gotoPlace {"query":"Brno-Kom\xEDn"}. Pomlčka NEN\xCD odd\u011Blova\u010D dvou m\xEDst
   a m\u011Bstsk\xE9 \u010D\xE1sti pi\u0161 v\u017Edy s m\u011Bstem: {"query":"Brno-Kom\xEDn"}.
6i. Odpov\xEDdej gramaticky spr\xE1vnou \u010De\u0161tinou a n\xE1zvy m\xEDst pi\u0161 spr\xE1vn\u011B i tehdy,
   kdy\u017E je u\u017Eivatel napsal s p\u0159eklepem (\u201EBarandov" -> Barrandov, \u201Ezemekoule" ->
   zem\u011Bkoule). P\u0159eklepy u\u017Eivatele do odpov\u011Bdi nep\u0159eb\xEDrej.
   Na dotaz "co um\xED\u0161" popi\u0161 schopnosti lidsky \u2014 NIKDY nevypisuj intern\xED jm\xE9na funkc\xED.
7. NEUM\xCD\u0160: exportovat video, mazat projekty, ukl\xE1dat presety. Kdy\u017E to u\u017Eivatel chce,
   nastav "calls" na otev\u0159en\xED spr\xE1vn\xE9 z\xE1lo\u017Eky (openTab export / projekt) a v "say"
   vysv\u011Btli, \u017Ee posledn\xED krok mus\xED kliknout s\xE1m.
8. Kdy\u017E u\u017Eivatel chce "otev\u0159i n\xE1stroj X": pro KONKR\xC9TN\xCD n\xE1stroj pou\u017Eij openSection
   (st\xEDny/AO/slunce \u2192 sunShadowSection, 3D model/GLB \u2192 model3dSection, popisky \u2192
   mapLabelSection, po\u010Das\xED \u2192 weatherLayersSection, presety \u2192 stylePresetSection,
   barvy \u2192 styleColorsSection, kamera \u2192 cameraAnimSection, zast\xE1vky \u2192 waypointSection,
   trasa A\u2192B \u2192 navigationABSection). Jen pro celou oblast pou\u017Eij openTab
   (export \u2192 export, projekt \u2192 projekt, animace \u2192 animace).`;
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
function sanitizePlan(plan) {
  if (typeof plan === "string") plan = extractPlan(plan);
  if (!plan || typeof plan !== "object") return { say: "Nerozum\xEDm, zkus to pros\xEDm jinak.", calls: [], done: true };
  if (!plan.say && !plan.calls) {
    for (const k of ["response", "plan", "result", "output"]) {
      if (plan[k] && typeof plan[k] === "object") {
        plan = plan[k];
        break;
      }
    }
  }
  const calls = Array.isArray(plan.calls) ? plan.calls.slice(0, 8) : [];
  let say = plan.say;
  if (typeof say !== "string") say = say == null ? "" : Array.isArray(say) ? say.filter((x) => typeof x === "string").join(" ") : "";
  return {
    say: say.trim() ? say.trim().slice(0, 400) : calls.length ? "Prov\xE1d\xEDm\u2026" : "Hotovo.",
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
    if (request.method !== "POST") return json({ error: "Pou\u017Eij POST." }, 405, origin);
    let body;
    try {
      body = await request.json();
    } catch (_) {
      return json({ error: "Neplatn\xFD JSON." }, 400, origin);
    }
    const history = Array.isArray(body.messages) ? body.messages.slice(-10) : [];
    if (!history.length) return json({ say: "Napi\u0161 mi, co m\xE1 mapa ud\u011Blat.", calls: [], done: true }, 200, origin);
    const messages = [{ role: "system", content: systemPrompt(body.mapState) }];
    for (const m of history) {
      const role = m && m.role === "assistant" ? "assistant" : "user";
      const content = String(m && m.content || "").slice(0, 2e3);
      if (content) messages.push({ role, content });
    }
    if (Array.isArray(body.toolResults) && body.toolResults.length) {
      messages.push({
        role: "user",
        content: "V\xDDSLEDKY PROVEDEN\xDDCH N\xC1STROJ\u016E:\n" + JSON.stringify(body.toolResults).slice(0, 3e3) + '\nPokud je \xFAkol hotov\xFD, vra\u0165 {"say":"...","calls":[],"done":true}. Pokud n\u011Bco selhalo, vysv\u011Btli to v "say" nebo to zkus jinak. Pokud je pot\u0159eba dal\u0161\xED krok, vra\u0165 ho v "calls".'
      });
    }
    try {
      const out = await env.AI.run(MODEL, { messages, max_tokens: 1200, temperature: 0.2 });
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
          const fix = await env.AI.run(MODEL, {
            messages: [
              ...messages,
              { role: "assistant", content: String(r || "").slice(0, 500) },
              { role: "user", content: 'Tohle nebyl platn\xFD JSON. Vra\u0165 POUZE jeden JSON objekt {"say":"\u2026","calls":[],"done":true}, nic jin\xE9ho, \u017E\xE1dn\xFD text okolo.' }
            ],
            max_tokens: 900,
            temperature: 0
          });
          const fr = fix && (fix.response ?? fix.result ?? fix.output_text);
          plan = fr && typeof fr === "object" ? fr : typeof fr === "string" ? extractPlan(fr) : null;
        } catch (_) {
        }
      }
      // Když i tak přišla próza, je to skoro vždy použitelná odpověď nebo doptání.
      // Ukázat ji je vždy lepší než ji zahodit a napsat "Nerozumím".
      if (!plan && typeof r === "string" && r.trim().length > 2 && !r.includes("{")) {
        plan = { say: r.trim().slice(0, 400), calls: [], done: true };
      }
      const finalPlan = sanitizePlan(plan);
      // Model občas pošle totéž volání dvakrát — jednou s prázdnými args. Nechat
      // oboje znamená nakreslit dvě čáry nebo spustit akci dvakrát. Držíme pro
      // každý nástroj tu variantu, která opravdu nese argumenty.
      {
        const best = /* @__PURE__ */ new Map();
        for (const c of finalPlan.calls) {
          if (!TOOL_NAME.test(c.tool)) continue;
          const prev = best.get(c.tool);
          const n = Object.keys(c.args || {}).length;
          if (!prev || n > Object.keys(prev.args || {}).length) best.set(c.tool, c);
        }
        finalPlan.calls = [...best.values()];
      }
      // say občas nese ocásek rozbitého JSON — uživateli ho neukazujeme.
      finalPlan.say = String(finalPlan.say || "").replace(/[,{\[]?\s*['"]?(done|calls|args|tool)['"]?\s*:.*$/s, "").trim() || (finalPlan.calls.length ? "Prov\xE1d\xEDm\u2026" : "Hotovo.");
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
      return json({ say: "Asistent te\u010F nem\u016F\u017Ee odpov\u011Bd\u011Bt (" + String(e && e.message || e).slice(0, 120) + ").", calls: [], done: true }, 200, origin);
    }
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map

