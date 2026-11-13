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
  "description": "výřez: world, europe, centralEurope, czechia, slovakia, bulgaria, croatia, romania.",
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
  "description": "kamera; zoomBy +1 přiblížit / -1 oddálit; pitch 0-85; bearing 0=sever.",
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
  "description": "barevné schéma: tnSvetla, tnSvetlaKontrast, tnSvetlaVyrazna, tnModra (Modrá TN), tnStudio, tnLive (noční), libertyKlasicka, zelenaPrirodni (jako Google), modraPrirodni, mapycz, mapycomTuristicka (jako mapy.com), flightradar, waze, uber, ct24, tnNovaClean, novaBlue, novaTerrain, dark, slate, paper, news, sunset, ocean, mint, candy, neon, tn, reset.",
  "inputSchema": {
   "type": "object",
   "properties": {
    "preset": {}
   },
   "required": [
    "preset"
   ],
   "additionalProperties": true
  }
 },
 {
  "name": "placeIcon",
  "description": "ikona na místo; kind: pin, vybuch, pozar, nehoda, policie, zachranka, povoden, letadlo, vlak, varovani.",
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
  "description": "šipka z místa do místa (postup, migrace). NENÍ to trasa.",
  "inputSchema": {
   "type": "object",
   "properties": {
    "from": {},
    "to": {},
    "color": {},
    "width": {}
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
  "description": "kružnice/okruh kolem místa.",
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
  "description": "obarví stát; clear:true se státem = zrušit jen ten, bez státu = všechny. Kraje ČR NEUMÍ.",
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
  "description": "čísla: sunAzimuth 0-360, sunElevation 5-85, shadowOpacity 0-100, shadowSoftness 0-100, aoStrength 0-100, buildingOpacity 0-1, routeWidth 1-16, routeGlow 0-100, mapLabelSize 14-80, boundaryWidth 0.2-5, boundaryOpacity 0-1, majorRoadWidth 0.2-4, minorRoadWidth 0.2-3, motorwayWidth 0.2-4, railwayWidth 0.2-4, sceneIconSize 16-96, animIconSize 18-96, arrowWidth 2-16, distanceWidth 1-12, perimeterOpacity 0-80, countryBorderWidth 0.5-10, countryFillOpacity 0-1, animDuration 1-180, cameraPitch 0-85, routeEndpointSize 12-48.",
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
  "description": "glóbus.",
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
  "description": "najde a vykreslí trasu (sama doramuje). Jen from/to/mode, žádné \"via\".",
  "inputSchema": {
   "type": "object",
   "properties": {
    "from": {},
    "to": {},
    "mode": {}
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
  "description": "vozidlo na trase: car, truck (kamion s návěsem), lorry (nákladní), train, metro, tram, bus, boat, fire, police, ambulance, plane.",
  "inputSchema": {
   "type": "object",
   "properties": {
    "type": {}
   },
   "required": [
    "type"
   ],
   "additionalProperties": true
  }
 },
 {
  "name": "addVehicle",
  "description": "další vozidlo na stejné trase; reverse:true = opačný směr; delay 0-0.9.",
  "inputSchema": {
   "type": "object",
   "properties": {
    "type": {},
    "reverse": {},
    "delay": {}
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
  "name": "fitRoute",
  "description": "ukáže celou trasu.",
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
  "description": "play, pause, stop, rewind.",
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
  "description": "all, none, delete (ikonky a popisky).",
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
  "description": "smaže: labels, icons, arrows, perimeters, distances, closures, colors, flags, route, all.",
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
  "description": "POVOLENÁ ID: mapLabelSection, sceneIconSection, sceneArrowSection, pzClosureSection, scenePerimeterSection, sceneDistanceSection, countryBordersOverlaySection, model3dSection, navigationABSection, animationSystemIconsSection, waypointSection, flightWaypointSection, cameraAnimSection, exportActionsSection, stylePresetSection, presetManageSection, sunShadowSection, tileSourcesSection.",
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
  "description": "vzhled aplikace light|dark.",
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
