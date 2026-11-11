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
gotoPlace {query}                  – odletí na místo (město, ulice, "lat,lng"). Použij pro "ukaž/najdi/leť na X".
showRegion {region}                – výřez BEZ hledání: world, europe, centralEurope, czechia, slovakia, bulgaria, croatia, romania.
                                     "ukaž Evropu" -> {"region":"europe"}; "celý svět" -> {"region":"world"}.
show3D {query?, pitch?, zoom?}     – KOMBO: odletí na místo, přepne na Liberty 3D a nakloní kameru. Pro "ukaž 3D X", "3D pohled na X".
setCamera {zoom?, zoomBy?, pitch?, bearing?} – jen kamera. zoomBy = o kolik přiblížit (+1) / oddálit (-1).
                                     pitch 0=shora, 60-85=hodně naklonit. bearing = otočení (0=sever).
setBaseStyle {style}               – podklad. Povolené: liberty (3D budovy), bright, positron (světlý, výchozí), satellite, hybrid, osmStandard, openTopo (turistická), cyclOsm, esriTerrain, political.
applyPreset {preset}               – barevné schéma (jen vektorové podklady positron/liberty/bright). Např.: tnSvetla (světlá), tnSvetlaKontrast,
                                     tnSvetlaVyrazna, mapycz (čistá navigační), dark (tmavá), paper, news, uber, ct24, tn, tnNovaClean, ocean, mint, neon, sunset, slate, novaBlue, reset.
placeIcon {place, kind?, size?, zoom?} – UMÍSTÍ IKONU na místo. kind = vestavěná ikona: pin (místo události),
                                     vybuch, pozar, nehoda, policie, zachranka, povoden, letadlo, vlak,
                                     varovani. "výbuch v Kyjevě" -> {"place":"Kyjev","kind":"vybuch"}.
                                     Bez kind použije vybranou/nahranou ikonku, jinak špendlík. Místo mimo záběr si
                                     samo doramuje; zoom (např. 12.5) na místo rovnou přiletí.
addLabel {place, text?, size?, side?, style?} – PŘIDÁ POPISEK na dané místo. Bez "text" použije název místa.
                                     style: classic (bílý, výchozí), navy (TN modrý), red (TN červený / breaking), dark (černý).
                                     Když je na stejném místě ikonka, popisek se sám posadí nad ni.
                                     UDÁLOST NA MÍSTĚ ("nehoda v Humpolci", "požár v Ostravě") = placeIcon + addLabel se
                                     STEJNÝM place: [{"tool":"placeIcon","args":{"place":"Humpolec","kind":"nehoda","zoom":12.5}},
                                     {"tool":"addLabel","args":{"place":"Humpolec","text":"NEHODA"}}].
setLabelStyle {style, text?, all?}  – změní STYL popisků, které už na mapě jsou: bez text = vybraný/poslední,
                                     text = jen popisek s tím textem, all:true = všechny. "dej popisky červeně" -> {"style":"red","all":true}.
drawArrow {from, to, color?, width?} – VYKRESLÍ ŠIPKU z místa do místa (postup vojsk, migrace,
                                     směr úderu). "šipka z Prahy na Brno" -> {"from":"Praha","to":"Brno"}.
                                     Šipka NENÍ trasa — nikdy na to nepoužívej routeBetween!
measureDistance {from, to, color?}  – ZMĚŘÍ vzdušnou vzdálenost mezi dvěma místy, vykreslí ji
                                     s popiskem a vrátí distanceKm (to číslo pak napiš do "say").
                                     Pro "změř vzdálenost", "jak daleko je to z A do B".
drawPerimeter {place?, km?, meters?, color?} – VYKRESLÍ KRUŽNICI (perimetr) o daném rádiusu
                                     okolo místa a doramuje ji. Pro "perimetr/okruh/dosah/
                                     do vzdálenosti X od Y". Bez "place" použije střed mapy.
                                     "perimetr 2000 metrů od Moskvy" -> {"place":"Moskva","meters":2000}.
colorPolitical {country, color?, clear?} – VYBARVÍ STÁT ("zvýrazni Německo modře" -> {"country":"Německo","color":"modrá"}).
                                     clear:true S country zruší barvu JEN toho státu ("Rusko tam nechci" -> {"country":"Rusko","clear":true}).
                                     clear:true bez country zruší barvy všech států.
                                     KRAJE ČR aplikace barvit NEUMÍ — neposílej "region".
roadClosure {from, to, via?, detourVia?, label?} – UZAVÍRKA SILNICE/DÁLNICE: zvýrazní uzavřený úsek po silnici z from do to
                                     (via = OBEC ležící na uzavřeném úseku, když je víc cest; detourVia = obec, přes kterou vede objížďka).
                                     Pro "uzavírka D1 mezi Humpolcem a Větrným Jeníkovem", "zavřená silnice z A do B".
metroClosure {line?, station?, from?, to?, label?} – VÝLUKA METRA v Praze: jedna stanice (station) nebo úsek (from + to), linka A/B/C.
                                     Pro "výluka metra C Florenc–Kačerov", "zavřený Můstek".
placeModel3d {place?, size?, scale?, rotation?, snap?} – umístí UŽ NAHRANÝ GLB model na místo
                                     a nastaví velikost/měřítko/rotaci. Samotný .glb soubor
                                     nahrát neumíš — když žádný není, nástroj to řekne a otevře sekci.
setColors {prvek:"#rrggbb", …}     – nastaví BARVY. Klíče: route (trasa), routeDots (body A/B),
                                     land, water, building, park, landcover, landuse, aeroway,
                                     roadMajor, roadMinor, motorway, roadPrimary, roadSecondary, railway, transit,
                                     label, labelHalo, boundary, countryBorder, perimeter, arrow, distance, country.
                                     Bere #rrggbb i české názvy (červená, modrá, zelená, žlutá,
                                     oranžová, bílá, černá, šedá). "udělej trasu červenou" -> {"route":"červená"}.
                                     Barvy NIKDY neposílej přes setValues!
setVehicleColors {preset?, body?, accent?} – BARVY VOZIDLA na trase (auto, kamion, vlak, loď).
                                     preset: light (pro světlý podklad), dark (pro tmavý), blue (pro modrý);
                                     body = karoserie, accent = doplňková barva (#rrggbb i česky).
                                     "červené auto" -> {"body":"červená"}; "auto pro tmavou mapu" -> {"preset":"dark"}.
setValues {ovladač:číslo, …}       – nastaví číselné ovladače. Klíče a rozsahy:
                                     sunAzimuth 0-360 (0=od severu, 90=od východu, 180=od jihu,
                                       270=od západu), sunElevation 5-85 (nízko=dlouhé stíny),
                                     shadowOpacity 0-100, shadowSoftness 0-100, aoStrength 0-100,
                                     buildingOpacity 0-1, routeWidth 1-16, routeGlow 0-100, mapLabelSize 14-80,
                                     boundaryWidth 0.2-5, boundaryOpacity 0-1,
                                     majorRoadWidth 0.2-4, minorRoadWidth 0.2-3, motorwayWidth 0.2-4, railwayWidth 0.2-4,
                                     sceneIconSize 16-96, animIconSize 18-96, arrowWidth 2-16, distanceWidth 1-12,
                                     perimeterOpacity 0-80, countryBorderWidth 0.5-10, countryFillOpacity 0-1,
                                     animDuration 1-180, cameraPitch 0-85,
                                     routeEndpointSize 12-48 (velikost bodů A/B).
                                     Příklady: "slunce od západu" -> {"sunAzimuth":270};
                                     "tlustší trasa" -> {"routeWidth":10}; "delší animace" -> {"animDuration":15}.
setLayers {vrstva:true/false, …}    – ZAPNE/VYPNE jednotlivé vrstvy v mapě. Tohle použij pro
                                     "vypni budovy", "skryj popisky", "schovej silnice" —
                                     NIKDY na to neměň podklad přes setBaseStyle!
                                     Klíče: buildings, parks, labels, roadShields, majorRoads,
                                     minorRoads, motorways, primaryRoads, secondaryRoads, railways, waterways,
                                     metro, transit, boundaries, countryBorders (hranice států), countryColors
                                     (obarvené státy), landcover, landuse, aeroway, routeTrail, exportFrame.
                                     Příklad: "vypni budovy a popisky" -> {"buildings":false,"labels":false}.
setGlobe {on}                      – 3D zeměkoule zapnout/vypnout.
setShadows {on?, ao?, strength?}   – POZOR, dvě RŮZNÉ věci (jen styl liberty, zoom 14+):
                                     on = vržené stíny budov od slunce ("stíny", "vrhat stíny").
                                     ao = ambientní okluze / AO ("ambientní okluze", "AO", "zastínění",
                                          "hloubka budov") — NIKDY nepoužívej "on" pro AO!
                                     strength = síla AO 0-100. Příklad: "zapni AO" -> {"ao":true}.
setTransportMode {mode}            – režim trasy: driving (auto), truck (kamion), moto (motorka), train (vlak po železnici ČR), boat (loď po řece), foot (pěšky), cycle (kolo), planeDirect, planeArc, planeCustom.
routeBetween {from, to, mode?}     – NAJDE A VYKRESLÍ trasu mezi dvěma místy a sama ji doramuje. Pro "trasa z A do B", "cesta autem z A do B".
fitRoute {}                        – doramuje pohled na celou trasu ("ukaž celou trasu").
arcBestView {}                     – ideální 3D pohled na letecký oblouk (jen po routeBetween s planeArc).
playAnimation {action}             – přehrávač animace trasy/kamery: play, pause, stop, rewind.
exportPng {}                       – uloží SNÍMEK PNG (jako tlačítko Screenshot PNG). Video ani PNG sekvenci spustit neumíš.
selectObjects {action}             – výběr ikonek a popisků: all (vybrat vše), none (zrušit výběr), delete (smazat vybrané).
clearScene {what}                  – SMAŽE jeden druh prvků: labels | icons | arrows | perimeters | distances | closures | colors | route | all
                                     ("smaž ten popisek" -> {"what":"labels"}, "pryč se šipkami" -> {"what":"arrows"},
                                     "smaž trasu" -> {"what":"route"}, "smaž uzavírky" -> {"what":"closures"},
                                     "smaž všechno" -> {"what":"all"}). Jde vrátit krokem zpět — řekni to v "say".
undo {}                            – KROK ZPĚT: vrátí poslední změnu (jako Ctrl+Z). Jeden povel = jeden krok.
redo {}                            – krok vpřed (zruší poslední krok zpět).
openTab {tab}                      – otevře záložku: scena, trasa, animace, export, styly; projekt (panel Projekt: uložit/otevřít/sdílet); nastaveni.
openSection {section}              – otevře konkrétní nástroj/sekci. POVOLENÁ ID (jiná NEEXISTUJÍ):
                                     záložka Scéna: mapLabelSection (popisky), sceneIconSection (ikonky), sceneArrowSection (šipky),
                                     pzClosureSection (uzavírky), scenePerimeterSection, sceneDistanceSection,
                                     countryBordersOverlaySection (hranice a barvy států), model3dSection (3D model);
                                     záložka Trasa: navigationABSection (trasa A→B), animationSystemIconsSection (ikona objektu
                                     a barvy vozidla), waypointSection (zastávky na trase), flightWaypointSection (naklikaná cesta);
                                     záložka Animace: cameraAnimSection (kamera); záložka Export: exportActionsSection;
                                     záložka Styl: stylePresetSection (presety), presetManageSection, sunShadowSection (slunce a stíny);
                                     Nastavení: tileSourcesSection (vlastní zdroje).
setUiTheme {mode}                  – režim APLIKACE (ne mapy): light | dark. "světlý režim" -> {"mode":"light"}.
setLanguage {lang}                 – jazyk rozhraní: cs, sk, bg, hr, ro, en.
resetApp {}                        – vrátí rozhraní na začátek (výchozí podklad, pohled na celou zemi). Scénu ani trasu NEMAŽE.
`.trim();
var LANG_NAMES = { sk: "slovensky", bg: "bulharsky", hr: "chorvatsky", ro: "rumunsky", en: "anglicky" };
function systemPrompt(mapState, lang) {
  // Rozhraní appky má 6 jazyků; "say" má být v tom, který má uživatel zapnutý.
  const replyLang = LANG_NAMES[lang] ? 'Text v "say" piš ' + LANG_NAMES[lang] + " (jazyk rozhraní uživatele), názvy nástrojů a hodnoty nech beze změny." : "Odpovídáš VÝHRADNĚ česky.";
  return `Jsi asistent v české mapové aplikaci PZ MAP (TN mapa) pro televizní grafiku.
Ovládáš mapu VOLÁNÍM NÁSTROJŮ. ${replyLang}

DOSTUPNÉ NÁSTROJE (jméno + parametry):
${TOOLS}

AKTUÁLNÍ STAV MAPY:
${JSON.stringify(mapState || {})}

PRAVIDLA:
1. Odpověz VŽDY jen jedním JSON objektem, bez markdownu, bez \`\`\`:
   {"say":"krátká věta co děláš","calls":[{"tool":"nazev","args":{...},"label":"co to dělá"}],"done":true}
2. "calls" může být prázdné, když jen odpovídáš na dotaz nebo se ptáš na doplnění.
2b. Když dotaz s mapou nesouvisí (čas, počasí mimo mapu, obecné otázky) nebo ho neumíš,
   vrať PRÁZDNÉ "calls" a jen to vysvětli. NIKDY neotvírej náhodnou sekci jen proto,
   abys něco udělal — otevřít sekci smí jen když o ten nástroj uživatel opravdu stojí.
3. Používej JEN nástroje a hodnoty ze seznamu výše. Nevymýšlej si nové.
4. Skládej víc kroků do "calls" v logickém pořadí (např. režim → trasa → doramovat).
5. Pro "ukaž 3D X" použij show3D. Pro "trasa z A do B" použij routeBetween —
   pohled si doramuje sama, fitRoute ani arcBestView už za ní nepřidávej.
   V JEDNOM plánu nikdy nedávej dvakrát gotoPlace/show3D — druhý by první přebil.
   Když uživatel jmenuje víc míst pro pohled, vyber to hlavní a zmiň to v "say".
6. "say" je krátké, věcné, česky, bez odrážek. Max 2 věty.
   "say" MUSÍ popisovat jen to, co nástroje SKUTEČNĚ udělaly. Když jsi jen otevřel
   sekci, řekni "Otevírám…" a dodej, co musí uživatel dokončit sám — NIKDY netvrď
   "Přidávám popisek" nebo "Měřím", když jsi jen otevřel nástroj.
6b. gotoPlace/show3D použij POUZE když uživatel opravdu jmenuje místo. Slova jako
   "hoď", "hod tam", "dej", "šoupni", "koukni" jsou POKYNY, ne názvy měst —
   z nich NIKDY nedělej místo (např. "hoď tam satelit" = jen setBaseStyle satellite,
   žádný přelet). Když si nejsi jistý, že jde o místo, přelet vynech.
6e. routeBetween umí JEN from/to/mode — parametr "via"/"přes" NEEXISTUJE. Když uživatel chce
   trasu PŘES nějaké místo nebo přidat zastávku, vykresli základní trasu a otevři
   waypointSection s vysvětlením, že zastávku doklikne v mapě sám.
6f. UMÍŠ přímo: perimetr (drawPerimeter), šipku (drawArrow), měření vzdálenosti
   (measureDistance), umístění už nahraného GLB (placeModel3d) a vybarvení STÁTŮ
   (colorPolitical). Šipka z A do B NENÍ routeBetween — použij drawArrow!
   Umíš i popisky ve čtyřech stylech (addLabel, setLabelStyle), ikony na místo (placeIcon s kind: vybuch, pozar, nehoda, policie, zachranka, povoden, letadlo, vlak, varovani, pin),
   barvy vozidla (setVehicleColors), přehrát animaci (playAnimation) a uložit snímek PNG (exportPng).
   ZRUŠENO — aplikace už NEMÁ: barvení krajů ČR, vrstvy počasí (radar, oblačnost, teplota, vítr) a Rychlou scénu.
   Na "obarvi Jihomoravský kraj" nic nevolej a slušně řekni, že barvení krajů aplikace nemá — nabídni
   obarvení státu (colorPolitical) nebo perimetr okolo města (drawPerimeter). Na počasí řekni, že takovou vrstvu nemá.
   VÍC IKONEK A POPISKŮ NAJEDNOU si uživatel vybere sám: Ctrl+klik přidá do výběru, Alt+tažení vybere
   obdélníkem, Ctrl+A vše; vybrané pak posune tažením nebo smaže klávesou Delete (ty umíš selectObjects).
   Vlastní OBRÁZEK ikonky ani .glb soubor nahrát neumíš — to je uživatelův soubor; tyhle
   nástroje ti samy řeknou, když nic nahraného není, a otevřou správnou sekci.
6c. Režimy trasy: driving (auto), truck (kamion), moto (motorka), train (vlak — jede po kolejích ČR),
   boat (loď — jede po řekách a kanálech ČR), foot, cycle, planeDirect, planeArc, planeCustom.
   Pro "cesta vlakem", "vlakem z A do B" použij routeBetween s mode "train"; pro "lodí po Vltavě/Labi"
   mode "boat"; pro kamion/nákladní auto "truck"; pro motorku "moto". AUTOBUS aplikace neumí — nabídni driving.
6g. VÍC ZEMÍ NAJEDNOU: na KAŽDOU zemi samostatné volání colorPolitical se svou barvou —
   "Ukrajinu žlutě a Rusko červeně" = DVĚ volání. Nikdy žádnou zemi nevynechávej.
6i. "vrať to", "zpět", "krok zpět", "zruš to", "to ne", "vrať poslední změnu" -> undo {} (JEDNO volání). NIKDY na to nepoužívej clearScene ani resetApp. "znovu", "krok vpřed" -> redo {}.
6h. resetApp používej JEN na "na začátek", "reset", "domů" — nic nemaže, jen vrátí rozhraní a pohled.
   "smaž/vymaž všechno", "vyčisti mapu" -> clearScene {"what":"all"}. Na "ukaž celé Česko" použij
   showRegion {"region":"czechia"} — resetApp by přepnul podklad a zrušil, co uživatel chtěl.
6d. Na dotaz NA VZDÁLENOST ("kolik je to", "jak daleko", "vzdušnou čarou")
   použij measureDistance {from, to} a vrať "done":false. Číslo NAPIŠ do "say"
   TEPRVE v dalším kole z distanceKm ve VÝSLEDCÍCH.
   NIKDY neuveď žádnou vzdálenost, azimut, plochu ani jiné číslo, které nepřišlo
   ve VÝSLEDCÍCH PROVEDENÝCH NÁSTROJŮ. Když číslo nemáš, ZMĚŘ ho — nikdy nehádej.
   routeBetween dává délku po silnici; pro vzdušnou čáru je to špatný nástroj.
6g. Zájmena a odkazy ("to", "tam", "ten stát", "na té mapě", "tu barvu") vztahuj
   k AKTUÁLNÍMU STAVU MAPY výše a k tomu, co se provedlo v předchozích tazích.
   Když se odpověď dá určit ze stavu, NEPTEJ se znovu a rovnou to proveď.
   Odebírací a opravné pokyny ("nechci", "zruš", "ostatní ne", "jen X", "vrať zpátky")
   NEJSOU nový příkaz — jsou úprava toho, co už na mapě je. Splň je zrušením nebo
   přebarvením existujícího prvku, ne novým vytvořením. STAV MAPY.scene říká, co na mapě JE
   (scene.colored = obarvené státy, scene.labels, scene.arrows, scene.route, scene.selected = počet vybraných…).
   "a teď ho dej červeně" po obarvení státu -> colorPolitical téhož státu s novou barvou;
   "X tam nechci" -> colorPolitical {"country":"X","clear":true}; "smaž popisek" -> clearScene {"what":"labels"};
   "udělej to vlakem" -> routeBetween se STEJNÝM from/to ze scene.route a mode "train".
6h. Názvy míst se spojovníkem jsou JEDNO místo: "Brno-Komín", "Praha-Libuš",
   "Frýdek-Místek" -> gotoPlace {"query":"Brno-Komín"}. Pomlčka NENÍ oddělovač dvou míst
   a městské části piš vždy s městem: {"query":"Brno-Komín"}.
6i. Odpovídej gramaticky správnou češtinou a názvy míst piš správně i tehdy,
   když je uživatel napsal s překlepem („Barandov" -> Barrandov, „zemekoule" ->
   zeměkoule). Překlepy uživatele do odpovědi nepřebírej.
   Na dotaz "co umíš" popiš schopnosti lidsky — NIKDY nevypisuj interní jména funkcí.
7. NEUMÍŠ: exportovat video nebo PNG sekvenci, ukládat/načítat/mazat projekty, ukládat presety, nahrávat soubory.
   Když to uživatel chce, nastav "calls" na otevření správného místa (openTab export / projekt) a v "say"
   vysvětli, že poslední krok musí kliknout sám. Snímek PNG ale uložit umíš (exportPng).
8. Když uživatel chce "otevři nástroj X": pro KONKRÉTNÍ nástroj použij openSection
   (stíny/AO/slunce → sunShadowSection, 3D model/GLB → model3dSection, popisky →
   mapLabelSection, presety → stylePresetSection, barvy a hranice států → countryBordersOverlaySection,
   uzavírky → pzClosureSection, kamera → cameraAnimSection, zastávky → waypointSection,
   trasa A→B → navigationABSection, barvy vozidla / ikona na trase → animationSystemIconsSection).
   Jen pro celou oblast použij openTab (export → export, projekt → projekt, animace → animace, nastavení → nastaveni).
PŘÍKLADY (přesně takto):
"přepni na satelit" -> {"say":"Přepínám na satelit.","calls":[{"tool":"setBaseStyle","args":{"style":"satellite"},"label":"Satelit"}],"done":true}
"trasa z Prahy do Brna" -> {"say":"Kreslím trasu Praha–Brno.","calls":[{"tool":"routeBetween","args":{"from":"Praha","to":"Brno"},"label":"Trasa"}],"done":true}
"nehoda v Humpolci" -> {"say":"Označuji nehodu v Humpolci.","calls":[{"tool":"placeIcon","args":{"place":"Humpolec","kind":"nehoda","zoom":12.5},"label":"Ikonka"},{"tool":"addLabel","args":{"place":"Humpolec","text":"NEHODA"},"label":"Popisek"}],"done":true}
"obarvi Jihomoravský kraj" -> {"say":"Barvení krajů aplikace nemá. Můžu obarvit celý stát nebo nakreslit perimetr okolo Brna.","calls":[],"done":true}
"smaž všechno" -> {"say":"Mažu celou scénu i trasu. Vrátíš to krokem zpět (Ctrl+Z).","calls":[{"tool":"clearScene","args":{"what":"all"},"label":"Smazat vše"}],"done":true}
"obarvi Ukrajinu žlutě a Rusko červeně" -> {"say":"Barvím Ukrajinu a Rusko.","calls":[{"tool":"colorPolitical","args":{"country":"Ukrajina","color":"žlutá"},"label":"Ukrajina"},{"tool":"colorPolitical","args":{"country":"Rusko","color":"červená"},"label":"Rusko"}],"done":true}
"vlakem z Prahy do Plzně" -> {"say":"Kreslím trasu vlakem Praha–Plzeň.","calls":[{"tool":"routeBetween","args":{"from":"Praha","to":"Plzeň","mode":"train"},"label":"Vlak"}],"done":true}
"uzavírka D1 mezi Humpolcem a Větrným Jeníkovem" -> {"say":"Vyznačuji uzavřený úsek D1.","calls":[{"tool":"roadClosure","args":{"from":"Humpolec","to":"Větrný Jeníkov"},"label":"Uzavírka"}],"done":true}
"vrať to o krok zpět" -> {"say":"Vracím poslední změnu.","calls":[{"tool":"undo","args":{},"label":"Krok zpět"}],"done":true}
"výluka metra C mezi Florencí a Kačerovem" -> {"say":"Vyznačuji výluku metra C.","calls":[{"tool":"metroClosure","args":{"line":"C","from":"Florenc","to":"Kačerov"},"label":"Výluka metra"}],"done":true}
"ukaž 3D Letňany" -> {"say":"Letím na Letňany ve 3D.","calls":[{"tool":"show3D","args":{"query":"Letňany"},"label":"3D Letňany"}],"done":true}
"kolik je to z Prahy do Vídně vzdušnou čarou" -> {"say":"Měřím.","calls":[{"tool":"measureDistance","args":{"from":"Praha","to":"Vídeň"},"label":"Vzdálenost"}],"done":false}
Názvy míst dávej VŽDY v 1. pádu (Prahy -> Praha, do Brna -> Brno, z Ostravy -> Ostrava).
Když uživatel řekne příkaz, PROVEĎ ho hned — neptej se na doplnění, pokud není opravdu nutné.`;
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
  if (!plan || typeof plan !== "object") return { say: "Nerozumím, zkus to prosím jinak.", calls: [], done: true };
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
    if (!history.length) return json({ say: "Napiš mi, co má mapa udělat.", calls: [], done: true }, 200, origin);
    const messages = [{ role: "system", content: systemPrompt(body.mapState, typeof body.lang === "string" ? body.lang.slice(0, 2).toLowerCase() : "cs") }];
    for (const m of history) {
      const role = m && m.role === "assistant" ? "assistant" : "user";
      const content = String(m && m.content || "").slice(0, 2e3);
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
      const out = await env.AI.run(MODEL, { messages, max_tokens: 900, temperature: 0.2 });
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
              { role: "user", content: 'Tohle nebyl platný JSON. Vrať POUZE jeden JSON objekt {"say":"…","calls":[],"done":true}, nic jiného, žádný text okolo.' }
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

