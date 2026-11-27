# Testy TN mapy

Prohlížečové testy (Playwright) hlavních postupů grafika. Pouštěj je před každým
nasazením, ať se nic nerozbije.

```bash
npm install            # jednou: nainstaluje Playwright
npx playwright install chromium
npm test               # rychlé testy (~5 min) proti místnímu serveru
SLOW=1 npm test        # i hromadný export videa (~5 min navíc)
node tests/run.mjs 05 11                         # jen vybrané testy
BASE_URL=https://tnmap.pages.dev/ npm test       # proti nasazené verzi
```

`tests/serve.mjs` servíruje appku z repozitáře a `/api/*` jen ČTE z ostré
verze. Všechny zápisy (projekty, presety, sdílení, statistika) testy zachytí —
náhled i produkce sdílejí jednu databázi D1, test ji nesmí přepsat.

| Test | Co ověřuje |
|---|---|
| 01 syntax | všechny skripty v `index.html` jdou zparsovat |
| 02 controls | proklikne všechny ovládací prvky na všech záložkách bez chyby |
| 03 undo_keys | Ctrl+Z/Y, Delete, Ctrl+D, tažení a smazání popisku, krok zpět po trase; posun mapy není krok, popisky po kroku zpět drží velikost, Delete bez výběru nechá Vpřed |
| 04 project_roundtrip | bohatá scéna → uložit → načíst v čistém prohlížeči beze ztrát (i výřez exportního rámu) |
| 05 icon_palette | paleta vestavěných ikonek: klik + klik do mapy, přetažení do mapy na místo puštění, Ctrl+Z |
| 06 labels_export | styly popisků Nova na mapě i v exportu PNG |
| 07 advanced | Pokročilé funkce schované / zapnuté / zapamatované |
| 08 contrast | kontrast textu ≥ 3:1 ve světlém i tmavém režimu |
| 09 layout | telefon, tablet, notebook: nic se nepřekrývá, 5 záložek v řádku |
| 10 i18n | angličtina bez zbytků češtiny, čistý návrat do češtiny |
| 11 assistant | rychlé povely a délka trasy bez dotazu na model (odpovědi podvržené) |
| 12 search | Hledat skočí na místo, záloha Photon při výpadku Nominatimu |
| 13 transport | vlak (nádraží, vagony), loď, kamion s návěsem, uzavírky |
| 24 export | záložka Export (předvolby, shrnutí), PNG se všemi vrstvami a s průhledným pozadím, krátké video (průběh, dvojklik, zrušení), PNG sekvence, více formátů, názvy souborů |
| 23 animation | přehrávač (přehrát/pauza/stop, časová osa, mezerník, konec animace), kamera (sledování, přelet záběry, návrat po stopu), krok zpět a uložení nastavení animace do projektu |
| 22 route | Trasa: klik/psaní/tažení A a B, prohození, zastávky, vlastní kreslená trasa, 10 druhů dopravy, chybové stavy, délka a doba, „Předkreslit celou trasu“ v náhledu i exportu PNG, „Délku do mapy“ vedle čáry (ne přes ni) a po změně trasy s novou délkou, krok zpět po každé akci (geokódování i OSRM podvržené) |
| 28 style_layers | Styl a mapové vrstvy: preset se použije a označí („upraveno“ po ruční změně), přepnutí podkladu zachová scénu, na satelitu zmizí volby bez účinku, obarvený stát je v seznamu i v exportu PNG, uzavírka přežije přepnutí podkladu a krok zpět |
| 32 kraje | Kraje ČR: názvy krajů jak je píšou reportéři (MSK, Vysočina, bez diakritiky, v pádech), Obarvit / Obrys v panelu, paleta po kliknutí do kraje, ostatní kraje, názvy krajů, krok zpět, uložení a načtení projektu, nástroj colorRegion (zadání reportérů), datová škála `pzKraje.colorByValue`, kraj v exportu PNG, kraje nad výplní států na Politické mapě, „Zarámovat scénu“ v 9:16 ukáže celou ČR se zvýrazněným krajem |
| 33 datova_mapa | Datová mapa: „Česko: 26,6 / Slovensko: 43,5" i řádky z Excelu, česká čísla a jednotky, státy / kraje / města (tečka + číslo, neznámé město ohlásí), pásma s kulatými hranicemi i vlastní, škály TN, čísla jen u vybraných (i z asistenta „ČR, Německa"), čísla u měst se nepřekrývají, legenda v bezpečné zóně a přetažení do rohu, krok zpět, projekt, clearScene, barvy legendy a území v exportu PNG, kartogram krajů s titulkem: hranice ani pod legendou, ani pod titulkem, v 9:16 menší čísla a zpět, Francie/Španělsko bez zámoří v záběru, krok zpět po smazání |
| 34 titulek_nazev | titulek a zdroj v grafice: náhled v rámečku = PNG (16:9 i 9:16), title-safe, zdroj nenarazí na „Zdroj mapy", krok zpět (titulek a zdroj popořadě), legenda úseků v náhledu pod dvouřádkovým titulkem, projekt, nástroj setTitle; název souboru mapa-popis-nick-gfx[-opr][-pořad]-RRMMDD, přípona dávky, nick a pořad zapamatované v prohlížeči |
| 35 useky | Liniové úseky (Scéna › Úseky): stav z textu zadání („ve výstavbě", „v plánu", „zvýraznit"), D35 Opatovice–Ostrov–Litomyšl–Janůvky nástrojem roadSections (Ostrov hledaný mezi sousedy, navazující úseky sdílí bod), popisky termínů, legenda stavů v bezpečné zóně, změna stavu a popisku v seznamu + krok zpět, přidání z panelu s navázáním Od, klik na čáru + Delete, projekt, clearScene, trať po železnici, barvy úseku a legendy v exportu PNG, termín úseku se nepíše přes uzavírku, Celá scéna nenechá úsek pod legendou, nápovědy polí v angličtině (geokodér i OSRM podvržené) |
| 36 sipky_piktogram | Šipky s piktogramem (lidé, letadlo, loď, kamion, peníze, zbraně, zboží…): svazek „z několika míst do jednoho cíle" jedním voláním `flowArrows` (rozvějířené hroty, piktogramy a popisky se nepřekrývají), letadlo se natáčí, kamion doleva zrcadlený, oblouk k pólu, krok zpět/vpřed, projekt, piktogramy v exportu PNG, panel Šipky (piktogram, oblouk, Víc míst do jednoho cíle), clearScene |
| 37 najezd | Nájezd na místa (typ G, „jingle"): `flyInTo` z ČR / Evropy na město, čtvrť, budovu (3D náklon), špendlík a název naskočí až na konci nájezdu (v klidu vidět celé), náhled = PNG, krok zpět, projekt, clearScene, stejné záběry za sebou drží kameru, panel Animace › Nájezd na místa (řádek s kurzorem, název souboru), dávka `flyInBatch` = video na každé místo s místem v názvu (nick, pořad), návrat nastavení po dávce, Zrušit zastaví dávku |
| 38 graf | Sloupcový graf v mapě (Scéna › Sloupcový graf): „Moravskoslezský kraj a dva vyskakující sloupce z něj" (colorRegion + `barChart`, 2024: 1 250 Kč / 2025: 1 480 Kč), 3 státy po jednom sloupci se společným měřítkem, panel v bezpečné zóně, náhled = PNG, ve videu sloupce vyrostou z nuly během první sekundy (MP4 bez trasy i kamery, snímky přes ffmpeg), stejné záběry kamery = pauza, přetažení / dvojklik / krok zpět, projekt, clearScene, panel ve Scéně, sloupce z datové mapy (jen u vybraných zemí, nad 12 míst zbytek s čísly), grafy sousedních států se nepřekrývají, v 9:16 graf pod titulkem a nad krajem |
| 20 api_d1 | serverové API nad náhradní D1 (node:sqlite): token, ochrana proti hromadnému smazání, historie verzí a obnova, statistika |
| 90 batch_export (pomalý) | hromadný export 16:9 + 9:16 |

Testy 03, 05, 12, 13 potřebují internet (geokódování Nominatim / Photon).
Asistenta s opravdovým modelem ověřuje `worker/tools/eval.mjs` — stojí ~23
dotazů z denního limitu Workers AI, proto se nepouští automaticky.

Snímky a exporty se ukládají do `tests/out/` (není v gitu).
