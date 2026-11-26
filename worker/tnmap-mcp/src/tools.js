// VYGENEROVÁNO tools/gen_mcp_tools.mjs z worker/tnmap-chat.built.js — neupravovat ručně.
export const MAP_TOOLS = [
 {
  "name": "gotoPlace",
  "description": "přelet na místo (město, ulice, \"lat,lng\").",
  "inputSchema": {
   "type": "object",
   "properties": {
    "query": {}
   },
   "required": [
    "query"
   ],
   "additionalProperties": true
  }
 },
 {
  "name": "showRegion",
  "description": "výřez: world, europe, centralEurope, czechia, slovakia, bulgaria, croatia, romania, baltics (Pobaltí), balkans, scandinavia, middleEast (Blízký východ), nearEast (Izrael a okolí), mediterranean, westernEurope, easternEurope, africa, asia, northAmerica, southAmerica, nebo název libovolného státu česky (\"Polsko\").",
  "inputSchema": {
   "type": "object",
   "properties": {
    "region": {}
   },
   "required": [
    "region"
   ],
   "additionalProperties": true
  }
 },
 {
  "name": "show3D",
  "description": "místo ve 3D (Liberty + náklon).",
  "inputSchema": {
   "type": "object",
   "properties": {
    "query": {},
    "pitch": {},
    "zoom": {}
   },
   "additionalProperties": true
  }
 },
 {
  "name": "setCamera",
  "description": "kamera, hodnoty jen čísla; zoom 0-22; zoomBy +1 přiblížit / -1 oddálit; pitch 0-85; bearing 0=sever.",
  "inputSchema": {
   "type": "object",
   "properties": {
    "zoom": {},
    "zoomBy": {},
    "pitch": {},
    "bearing": {}
   },
   "additionalProperties": true
  }
 },
 {
  "name": "setBaseStyle",
  "description": "podklad: positron (světlý, výchozí), liberty (3D budovy), bright, basic, terrain (reliéf), omt3d, satellite, hybrid, osmStandard, openTopo (turistická), cyclOsm, esriTerrain, political (politická).",
  "inputSchema": {
   "type": "object",
   "properties": {
    "style": {}
   },
   "required": [
    "style"
   ],
   "additionalProperties": true
  }
 },
 {
  "name": "applyPreset",
  "description": "barevné schéma (jen tyto jsou v appce vidět): tnSvetla (Světlá), tnSvetlaKontrast (Světlá – kontrast), tnSvetlaVyrazna (Světlá – výrazná), tnModra (Modrá – TN), tnStudio (Studio – TN), tnLive (Noc – TN Live), libertyKlasicka (Liberty klasická), zelenaPrirodni (Zelená přírodní), modraPrirodni (Modrá přírodní), mapycomTuristicka (Turistická). Jiný preset (tmavý apod.) nehádej: když žádný nesedí, zeptej se grafika a nabídni tyto; force:true jen na výslovné přání.",
  "inputSchema": {
   "type": "object",
   "properties": {
    "preset": {},
    "force": {}
   },
   "required": [
    "preset"
   ],
   "additionalProperties": true
  }
 },
 {
  "name": "placeIcon",
  "description": "ikona na místo (size 16-96 px, bez size výchozí); kind: pin, vybuch, pozar, nehoda, policie, zachranka, povoden, letadlo, vlak, varovani.",
  "inputSchema": {
   "type": "object",
   "properties": {
    "place": {},
    "kind": {},
    "size": {},
    "zoom": {}
   },
   "required": [
    "place"
   ],
   "additionalProperties": true
  }
 },
 {
  "name": "addLabel",
  "description": "popisek; bez text = název místa; side right|left|none (none = bez červeného bodu, např. název státu); style classic|navy|red|dark.",
  "inputSchema": {
   "type": "object",
   "properties": {
    "place": {},
    "text": {},
    "size": {},
    "side": {},
    "style": {}
   },
   "required": [
    "place"
   ],
   "additionalProperties": true
  }
 },
 {
  "name": "setLabelStyle",
  "description": "změní styl existujících popisků (all:true = všech).",
  "inputSchema": {
   "type": "object",
   "properties": {
    "style": {},
    "text": {},
    "all": {}
   },
   "required": [
    "style"
   ],
   "additionalProperties": true
  }
 },
 {
  "name": "drawArrow",
  "description": "šipka z místa do místa (postup, migrace). NENÍ to trasa. icon = piktogram na šipce: lide, letadlo, lod, kamion, penize, raketa (zbraně), balik (zboží), vlak; curve:true = oblouk pro dlouhé vzdálenosti.",
  "inputSchema": {
   "type": "object",
   "properties": {
    "from": {},
    "to": {},
    "color": {},
    "width": {},
    "icon": {},
    "iconSize": {},
    "curve": {}
   },
   "required": [
    "from",
    "to"
   ],
   "additionalProperties": true
  }
 },
 {
  "name": "flowArrows",
  "description": "víc šipek z několika míst (from = seznam států/měst) do jednoho cíle jedním voláním, rozvějířené, aby se hroty nepřekrývaly („z Německa, Rakouska… čáry s obrázkem lidí do Rwandy“ → icon:\"lide\", labels:true). Nevolej drawArrow pro každé místo zvlášť.",
  "inputSchema": {
   "type": "object",
   "properties": {
    "from": {},
    "to": {},
    "icon": {},
    "color": {},
    "width": {},
    "labels": {},
    "toLabel": {},
    "curve": {}
   },
   "required": [
    "from",
    "to"
   ],
   "additionalProperties": true
  }
 },
 {
  "name": "measureDistance",
  "description": "vzdušná vzdálenost; číslo vrátí ve výsledku.",
  "inputSchema": {
   "type": "object",
   "properties": {
    "from": {},
    "to": {},
    "color": {}
   },
   "required": [
    "from",
    "to"
   ],
   "additionalProperties": true
  }
 },
 {
  "name": "drawPerimeter",
  "description": "kružnice/okruh kolem místa, rádius nejvýš 5000 km; bez place střed výřezu. Když redaktor místo nezmínil a ve scéně není jasný střed, zeptej se přes options.",
  "inputSchema": {
   "type": "object",
   "properties": {
    "place": {},
    "km": {},
    "meters": {},
    "color": {}
   },
   "additionalProperties": true
  }
 },
 {
  "name": "colorPolitical",
  "description": "obarví stát; clear:true se státem = zrušit jen ten, bez státu = všechny. Kraje ČR = colorRegion.",
  "inputSchema": {
   "type": "object",
   "properties": {
    "country": {},
    "color": {},
    "clear": {}
   },
   "required": [
    "country"
   ],
   "additionalProperties": true
  }
 },
 {
  "name": "colorRegion",
  "description": "kraje ČR (14 krajů, funguje na každém podkladu): region = jeden nebo víc krajů (\"Praha, Jihočeský a Jihomoravský\", \"MSK\", \"Vysočina\", \"všechny\"); color = výplň; outline = zvýrazněná hranice (true nebo barva, width px, výchozí 4) – \"obkreslit hranicí\" = outline bez color; others = barva všech ostatních krajů (false = zrušit); labels:true = názvy krajů; clear:true s regionem = zrušit jen ty, bez regionu = všechny kraje. Bez color i outline = červená výplň. Víc barev = víc volání.",
  "inputSchema": {
   "type": "object",
   "properties": {
    "region": {},
    "color": {},
    "outline": {},
    "width": {},
    "others": {},
    "labels": {},
    "clear": {}
   },
   "additionalProperties": true
  }
 },
 {
  "name": "dataMap",
  "description": "datová mapa (kartogram) z čísel od reportéra: rows = [{\"name\":\"Česko\",\"value\":26.6}, …] – státy, kraje ČR nebo města (jde i text \"Česko: 26,6 / Slovensko: 43,5\"); státy a kraje obarví barevnou škálou po pásmech, města dostanou tečku v barvě pásma; čísla v mapě s jednotkou (unit \"%\", \"Kč\", \"mil. Kč\"…); scale = red (TN červená, \"v červených odstínech\") | blue (TN modrá) | orange | green | purple | gray nebo pole barev; bands = počet pásem (výchozí 4) nebo hranice [2, 5, 10] = \"méně než 2 %, 2–5 %, 5–10 %, více než 10 %\"; labels = \"all\" | \"none\" (jen barevná škála) | [\"Česko\",\"Německo\"] (čísla jen u nich); legendTitle = nadpis legendy (legenda s pásmy je vždy, legend = roh bl|tl|tr|br nebo false); kind = country|kraj|city když to nejde poznat; clear:true = smazat datovou mapu. Hodnoty opiš přesně ze zadání, nic nedopočítávej.",
  "inputSchema": {
   "type": "object",
   "properties": {
    "rows": {},
    "unit": {},
    "scale": {},
    "bands": {},
    "labels": {},
    "legendTitle": {},
    "legend": {},
    "kind": {},
    "clear": {}
   },
   "required": [
    "rows"
   ],
   "additionalProperties": true
  }
 },
 {
  "name": "placeFlag",
  "description": "vlajka státu na mapu. Víc států = víc volání.",
  "inputSchema": {
   "type": "object",
   "properties": {
    "country": {},
    "place": {}
   },
   "required": [
    "country"
   ],
   "additionalProperties": true
  }
 },
 {
  "name": "roadClosure",
  "description": "uzavírka silnice/dálnice mezi obcemi (via = obec na úseku, detourVia = objížďka).",
  "inputSchema": {
   "type": "object",
   "properties": {
    "from": {},
    "to": {},
    "via": {},
    "detourVia": {},
    "label": {}
   },
   "required": [
    "from",
    "to"
   ],
   "additionalProperties": true
  }
 },
 {
  "name": "roadSections",
  "description": "liniové úseky dálnice / tratě / ulice podle stavu, jedním voláním všechny: sections = [{\"from\":\"Opatovice nad Labem\",\"to\":\"Ostrov\",\"status\":\"hotový\"}, {\"from\":\"Ostrov\",\"to\":\"Litomyšl\",\"status\":\"ve výstavbě\",\"label\":\"2026\"}, …]; status hotový (šedomodrá) | ve výstavbě (oranžová čárkovaná) | plánovaný (světlá čárkovaná) | zvýrazněný (červená, úseky \"o kterých budeme mluvit\"); label = datum/termín u úseku (\"2027\", \"otevřeno 2025\"); via = obec na úseku, když trasa vede jinudy; mode \"rail\" = po železnici (tratě), jinak po silnici (i ulice ve městě). Nahradí dosavadní úseky (append:true = přidá); legend = roh bl|tl|tr|br nebo false (legenda stavů je sama, když jsou aspoň dva stavy); legendTitle = nadpis legendy; names:false = bez názvů míst na koncích; clear:true = smazat. Uzavírka s objížďkou = roadClosure.",
  "inputSchema": {
   "type": "object",
   "properties": {
    "sections": {},
    "legend": {},
    "legendTitle": {},
    "names": {},
    "append": {},
    "clear": {}
   },
   "required": [
    "sections"
   ],
   "additionalProperties": true
  }
 },
 {
  "name": "metroClosure",
  "description": "výluka pražského metra A/B/C: stanice nebo úsek.",
  "inputSchema": {
   "type": "object",
   "properties": {
    "line": {},
    "station": {},
    "from": {},
    "to": {},
    "label": {}
   },
   "additionalProperties": true
  }
 },
 {
  "name": "placeModel3d",
  "description": "umístí už nahraný GLB model.",
  "inputSchema": {
   "type": "object",
   "properties": {
    "place": {},
    "size": {},
    "scale": {},
    "rotation": {},
    "snap": {}
   },
   "additionalProperties": true
  }
 },
 {
  "name": "setColors",
  "description": "barvy (#rrggbb nebo česky): route, routeDots, land, water, building, park, landcover, landuse, aeroway, roadMajor, roadMinor, motorway, roadPrimary, roadSecondary, railway, transit, label, labelHalo, boundary, countryBorder, perimeter, arrow, distance, country.",
  "inputSchema": {
   "type": "object",
   "properties": {},
   "additionalProperties": true
  }
 },
 {
  "name": "setValues",
  "description": "čísla: sunAzimuth 0-360, sunElevation 5-85, shadowOpacity 0-100, shadowSoftness 0-100, aoStrength 0-100, buildingOpacity 0-1, routeWidth 1-16, routeGlow 0-100, mapLabelSize 14-80, boundaryWidth 0.2-5, boundaryOpacity 0-1, majorRoadWidth 0.2-4, minorRoadWidth 0.2-3, motorwayWidth 0.2-4, railwayWidth 0.2-4, sceneIconSize 16-96, animIconSize 18-96, arrowWidth 2-16, distanceWidth 1-12, perimeterOpacity 0-80, countryBorderWidth 0.5-10, countryFillOpacity 0-1, animDuration 1-180, animStart 0-10 (prodleva startu), animEndHold 0-10 (pauza na konci — záběr po doběhnutí stojí), cameraPitch 0-85, routeEndpointSize 12-48. sun*, shadow* a aoStrength jen na podkladu liberty.",
  "inputSchema": {
   "type": "object",
   "properties": {},
   "additionalProperties": true
  }
 },
 {
  "name": "setLayers",
  "description": "zapnout/vypnout vrstvy: buildings, parks, labels, roadShields, majorRoads, minorRoads, motorways, primaryRoads, secondaryRoads, railways, waterways, metro, transit, boundaries, countryBorders, countryColors, landcover, landuse, aeroway, routeTrail, exportFrame.",
  "inputSchema": {
   "type": "object",
   "properties": {},
   "additionalProperties": true
  }
 },
 {
  "name": "setGlobe",
  "description": "glóbus: on true = zapnout, false = vypnout (plochá mapa).",
  "inputSchema": {
   "type": "object",
   "properties": {
    "on": {}
   },
   "required": [
    "on"
   ],
   "additionalProperties": true
  }
 },
 {
  "name": "setShadows",
  "description": "on = stíny budov, ao = ambientní okluze (jiná věc), strength 0-100.",
  "inputSchema": {
   "type": "object",
   "properties": {
    "on": {},
    "ao": {},
    "strength": {}
   },
   "additionalProperties": true
  }
 },
 {
  "name": "setTransportMode",
  "description": "driving, truck, moto, train, metro, tram, boat, foot, cycle, planeDirect, planeArc, planeCustom.",
  "inputSchema": {
   "type": "object",
   "properties": {
    "mode": {}
   },
   "required": [
    "mode"
   ],
   "additionalProperties": true
  }
 },
 {
  "name": "routeBetween",
  "description": "najde a vykreslí trasu (sama doramuje). Jen from/to/mode, žádné \"via\". kmLabel:true = popisek s délkou trasy doprostřed (\"trasa s údajem km\").",
  "inputSchema": {
   "type": "object",
   "properties": {
    "from": {},
    "to": {},
    "mode": {},
    "kmLabel": {}
   },
   "required": [
    "from",
    "to"
   ],
   "additionalProperties": true
  }
 },
 {
  "name": "routeLine",
  "description": "trasa linky MHD Praha (bus, tramvaj, metro, vlak S) mezi zastávkami; bez from/to celá linka.",
  "inputSchema": {
   "type": "object",
   "properties": {
    "line": {},
    "from": {},
    "to": {}
   },
   "required": [
    "line"
   ],
   "additionalProperties": true
  }
 },
 {
  "name": "setVehicle",
  "description": "vozidlo na trase (label = cedulka, která jede s vozidlem; color = barva vozidla): car, truck (kamion s návěsem), lorry (nákladní), train, metro, tram, bus, boat, fire, police, ambulance, plane.",
  "inputSchema": {
   "type": "object",
   "properties": {
    "type": {},
    "label": {},
    "color": {}
   },
   "required": [
    "type"
   ],
   "additionalProperties": true
  }
 },
 {
  "name": "addVehicle",
  "description": "další vozidlo na stejné trase (label = cedulka u vozidla, color = vlastní barva); reverse:true = opačný směr; delay 0-0.9; crashAt = místo srážky (\"lat,lng\"/název): vozidlo jede proti a obě se zastaví tam, kde se srazí (kdekoli na trase; místo dál než 3 km od trasy vrátí chybu se vzdáleností — pak se grafika zeptej, kde přesně na trase); crash:true bez crashAt = srážka uprostřed; při srážce se v místě rozsvítí záblesk s cedulkou crashLabel (výchozí „SRÁŽKA\", \"\" = bez cedulky); speed = rychlost protijedoucího vůči vozidlu na trase (výchozí 0,7).",
  "inputSchema": {
   "type": "object",
   "properties": {
    "type": {},
    "reverse": {},
    "delay": {},
    "crash": {},
    "crashAt": {},
    "crashLabel": {},
    "speed": {},
    "label": {},
    "color": {}
   },
   "required": [
    "type"
   ],
   "additionalProperties": true
  }
 },
 {
  "name": "setVehicleColors",
  "description": "barvy vozidla: preset auto|light|dark|blue, body, accent, shadow true/false (stín pod vozidlem).",
  "inputSchema": {
   "type": "object",
   "properties": {
    "preset": {},
    "body": {},
    "accent": {},
    "shadow": {}
   },
   "additionalProperties": true
  }
 },
 {
  "name": "setCameraFlight",
  "description": "PŘELET KAMERY během animace: keyframes = záběry v pořadí [{center:\"lat,lng\" nebo místo, zoom, pitch?, bearing?}], rovnoměrně v čase; záběr = co bude ve videu (center = střed výřezu exportu, zoom pro výřez široký 1280 px); lift = výška zdvihu kamery mezi vzdálenými záběry (0 = bez oddálení, 1 = automaticky podle vzdálenosti – výchozí, 1.5–2 = výš, max 2.5); přelet ČR → město je plynulý nájezd, město → město se zvedne nad obě; off:true = statická kamera.",
  "inputSchema": {
   "type": "object",
   "properties": {
    "keyframes": {},
    "lift": {},
    "off": {}
   },
   "required": [
    "keyframes"
   ],
   "additionalProperties": true
  }
 },
 {
  "name": "flyInTo",
  "description": "NÁJEZD NA MÍSTO jedním voláním („mapu ČR a nájezd na Valašské Meziříčí\"): přelet kamery z celku na místo + špendlík a název, které naskočí na konci; from = cz (výchozí), eu, world, current (současný výřez) nebo stát/oblast (Polsko, Pobaltí); zoom = city (výchozí), district (čtvrť, náměstí), building (budova, 3D náklon) nebo číslo; duration = délka nájezdu v s (výchozí 6), hold = pauza na konci (2); label = vlastní text popisku nebo false; pin:false = bez špendlíku.",
  "inputSchema": {
   "type": "object",
   "properties": {
    "place": {},
    "from": {},
    "zoom": {},
    "duration": {},
    "hold": {},
    "label": {},
    "pin": {}
   },
   "required": [
    "place"
   ],
   "additionalProperties": true
  }
 },
 {
  "name": "flyInBatch",
  "description": "DÁVKA VIDEÍ „ke každému městu zvlášť nájezd jako jingle\": places = seznam míst, jedno video na každé (název souboru s místem); běží v pozadí a vrátí hned počet. Jen konektor Claude (export videa) – asistent v chatu ho nevolá.",
  "inputSchema": {
   "type": "object",
   "properties": {
    "places": {},
    "from": {},
    "zoom": {},
    "duration": {},
    "hold": {},
    "label": {},
    "pin": {}
   },
   "required": [
    "places"
   ],
   "additionalProperties": true
  }
 },
 {
  "name": "fitRoute",
  "description": "ukáže celou trasu.",
  "inputSchema": {
   "type": "object",
   "properties": {},
   "additionalProperties": true
  }
 },
 {
  "name": "fitScene",
  "description": "zarámuje celou scénu (všechna místa, popisky, šipky, kraje) do výřezu s místem pro titulek; volej na konci, když jsi přidal víc míst.",
  "inputSchema": {
   "type": "object",
   "properties": {},
   "additionalProperties": true
  }
 },
 {
  "name": "arcBestView",
  "description": "3D pohled na letecký oblouk.",
  "inputSchema": {
   "type": "object",
   "properties": {},
   "additionalProperties": true
  }
 },
 {
  "name": "playAnimation",
  "description": "play, pause, stop, rewind; seek + time (s) = zastavit na daném okamžiku.",
  "inputSchema": {
   "type": "object",
   "properties": {
    "action": {},
    "time": {}
   },
   "required": [
    "action"
   ],
   "additionalProperties": true
  }
 },
 {
  "name": "setTitle",
  "description": "titulek grafiky (\"Název:\" ze zadání) vlevo nahoře a zdroj dat (\"Zdroj:\") vlevo dole, je i v PNG a videu; style navy|red|classic|dark; off:true skryje oba, off:\"title\"/\"source\" jen jeden.",
  "inputSchema": {
   "type": "object",
   "properties": {
    "title": {},
    "source": {},
    "style": {},
    "off": {}
   },
   "additionalProperties": true
  }
 },
 {
  "name": "setExportName",
  "description": "název souboru exportu podle redakce mapa-popis-nick-gfx[-opr][-pořad]-RRMMDD: popis = krátké slovo bez diakritiky (potok), nick = 3 písmena reportéra, porad tn|ptn|otn|nvs|str|vik, oprava:true = opravená verze (opr).",
  "inputSchema": {
   "type": "object",
   "properties": {
    "popis": {},
    "nick": {},
    "porad": {},
    "oprava": {}
   },
   "additionalProperties": true
  }
 },
 {
  "name": "exportPng",
  "description": "uloží snímek PNG.",
  "inputSchema": {
   "type": "object",
   "properties": {},
   "additionalProperties": true
  }
 },
 {
  "name": "selectObjects",
  "description": "all, none, delete (objekty scény: popisky, ikonky, šipky, perimetry, vzdálenosti).",
  "inputSchema": {
   "type": "object",
   "properties": {
    "action": {}
   },
   "required": [
    "action"
   ],
   "additionalProperties": true
  }
 },
 {
  "name": "clearScene",
  "description": "smaže: labels, icons, arrows, perimeters, distances, closures, colors, regions, data (datová mapa), flags, route, vehicles (další vozidla), title (titulek a zdroj), all; víc druhů = pole [\"labels\",\"icons\"].",
  "inputSchema": {
   "type": "object",
   "properties": {
    "what": {}
   },
   "required": [
    "what"
   ],
   "additionalProperties": true
  }
 },
 {
  "name": "undo",
  "description": "krok zpět.",
  "inputSchema": {
   "type": "object",
   "properties": {},
   "additionalProperties": true
  }
 },
 {
  "name": "redo",
  "description": "krok vpřed.",
  "inputSchema": {
   "type": "object",
   "properties": {},
   "additionalProperties": true
  }
 },
 {
  "name": "openTab",
  "description": "scena, trasa, animace, export, styly, projekt, nastaveni.",
  "inputSchema": {
   "type": "object",
   "properties": {
    "tab": {}
   },
   "required": [
    "tab"
   ],
   "additionalProperties": true
  }
 },
 {
  "name": "openSection",
  "description": "POVOLENÁ ID: mapLabelSection, sceneIconSection, sceneArrowSection, pzClosureSection, pzSectionsSection, scenePerimeterSection, sceneDistanceSection, countryBordersOverlaySection, model3dSection, navigationABSection, animationSystemIconsSection, waypointSection, flightWaypointSection, cameraAnimSection, exportActionsSection, exportTitleSection, exportNameSection, stylePresetSection, presetManageSection, sunShadowSection, tileSourcesSection.",
  "inputSchema": {
   "type": "object",
   "properties": {
    "section": {}
   },
   "required": [
    "section"
   ],
   "additionalProperties": true
  }
 },
 {
  "name": "setUiTheme",
  "description": "vzhled aplikace light|dark|toggle.",
  "inputSchema": {
   "type": "object",
   "properties": {
    "mode": {}
   },
   "required": [
    "mode"
   ],
   "additionalProperties": true
  }
 },
 {
  "name": "setLanguage",
  "description": "cs, sk, bg, hr, ro, en.",
  "inputSchema": {
   "type": "object",
   "properties": {
    "lang": {}
   },
   "required": [
    "lang"
   ],
   "additionalProperties": true
  }
 },
 {
  "name": "resetApp",
  "description": "rozhraní na začátek (nic nemaže).",
  "inputSchema": {
   "type": "object",
   "properties": {},
   "additionalProperties": true
  }
 }
];
