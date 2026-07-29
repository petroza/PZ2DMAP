# Analýza logu AI asistenta mapy (tnmap-chat)

Zdroj: Cloudflare Workers Observability, worker `tnmap-chat`
(account 24472f8c…4281, script version 322f21b1-8685-4b2d-bcbc-9ef5497b9e46).
Worker loguje každý tah s poli `tag:"tnchat"`, `q`, `say`, `tools`, `round`, `miss`.

Vzorek: **86 konverzačních tahů**, 29. 7. 2026, 05:33–11:02 UTC.

---

## Souhrn

| Metrika | Hodnota |
|---|---|
| Tahů celkem | 86 |
| `miss` (model nevrátil žádný nástroj) | 7 (8 %) |
| Tahů končících `openSection` („udělej si to sám") | 18 (21 %) |
| Nástrojů v API | 26 |
| Nástrojů nikdy nepoužitých | 7 |

Rozložení nástrojů:

```
 18x openSection      5x show3D           1x clearRoute
 12x routeBetween     5x drawPerimeter    1x resetApp
 11x gotoPlace        4x setCamera        1x openTab
 11x setLayers        4x setTransportMode 1x measureDistance
 11x setValues        3x setColors        1x colorPolitical
 11x fitRoute         2x setShadows
  8x setGlobe         6x setBaseStyle
```

Nikdy nepoužité: `applyPreset`, `placeIcon`, `addLabel`, `setWeather`,
`drawArrow`, `arcBestView`, `getState`.

---

## Nálezy podle závažnosti

### 1. Model si vymýšlí čísla, která jdou do vysílání — kritické

```
Q:  kolik je to vzdušnou linkou z Prahy do Kyjeva
SAY: … Vzdálenost mezi těmito městy je přibližně 1046 km.
TOOLS: routeBetween, fitRoute
```

Skutečná ortodroma Praha–Kyjev je **1142 km**. Model číslo neodečetl z výsledku
nástroje (nezavolal `measureDistance`), ale vygeneroval ho z hlavy — chyba 8 %.
V nástroji na zpravodajskou grafiku je vymyšlené číslo nejhorší možná vada.

**Oprava:** systémový prompt musí zakázat uvádět jakoukoli číselnou hodnotu
(vzdálenost, azimut, čas), která nepřišla v `toolResults`. Když číslo chybí,
zavolej `measureDistance` a odpověz až v dalším kole z jeho výstupu.

### 2. Nástroj se zavolá, ale výsledek se nikdy nepřečte

```
Q:  ukaž celou zeměkouli globus satelitní a ukaž vzdálenost bezi moskvou a kyjevem
SAY: … Vzdálenost mezi Moskvou a Kyjevem se bude měřit vzdušnou čarou.
TOOLS: setGlobe, setBaseStyle, measureDistance
```

`measureDistance` proběhl a vrátil hodnotu (756 km), ale asistent ji uživateli
neřekl — skončil budoucím časem „bude se měřit". Klient přitom smyčku na další
kolo má (`MAX_ROUNDS = 4`, `toolResults` se posílají zpět).

**Oprava:** když plán obsahuje měřicí/čtecí nástroj, worker nesmí nastavit
`done:true` — musí si vyžádat další kolo a hodnotu vyslovit.

### 3. Pomlčka v názvu místa asistenta úplně složí

```
10:45:18  ukaz brno - komín a přehradu        → Nerozumím, zkus to prosím jinak.
10:45:43  ukaž Brno -Komín a přehradu         → Nerozumím, zkus to prosím jinak.
10:46:08  ukaž Brno - Komín - je to městská část → Nerozumím, zkus to prosím jinak.
```

Uživatel to zkusil **třikrát** a třikrát dostal `miss`. „Brno-Komín" je běžný
tvar názvu městské části; jméno s pomlčkou/spojovníkem musí projít.

**Oprava:** normalizovat `-`/`–`/`—` v dotazu, tolerovat `Město-Část` jako jeden
`gotoPlace.query`, a fallback „nenašel jsem, mysleli jste Komín (Brno)?" místo
hluchého „Nerozumím".

### 4. Navazující a opravné pokyny padají — kontext se ztrácí

```
round 4:  zapni na tom hranice států        → Nerozumím
round 5:  zapni hranice států ted na té mapě a označ rusko červeně → OK
round 5:  ostatní země nechci označit       → Nerozumím
```

Miss podle pořadí tahu v konverzaci:

| round | miss / tahů |
|---|---|
| 1 | 2 / 74 |
| 2 | 0 / 4 |
| 3 | 0 / 2 |
| 4 | **2 / 2** |
| 5 | **3 / 4** |

První tah selhává v 3 % případů, čtvrtý a pátý v **83 %**. Selhávají přesně
ty dotazy, které odkazují na dřívější kontext („na tom", „ostatní země
nechci"). To ukazuje na to, že se historie do workeru nepředává celá /
prompt s ní nepracuje.

**Oprava:** předávat plnou historii včetně provedených nástrojů a aktuálního
`mapState`; naučit prompt zájmenné odkazy („to"/„tam"/„ta mapa" = současný
stav mapy) a odebírací pokyny („nechci", „zruš", „jen X") jako `clear`/negaci
existujícího nástroje, ne jako nový příkaz.

### 5. `openSection` jako výmluva — 21 % tahů

Asistent otevře panel a řekne „udělejte to sám", i když **nástroj existuje**:

| Dotaz | Použito | Mělo být |
|---|---|---|
| pridej popisek Brno do mapy | `openSection` | `addLabel` |
| přidej popisek Letňany na mapu | `openSection` | `addLabel` |
| vyznač na politické mapě Středočeský kraj červeně | `openSection` | `colorPolitical` |
| přidej ikonku výbuchu do Kyjeva | `openSection` | `placeIcon` |
| zapni radar srážek | `openSection` | `setWeather` |
| ukaž teplotu z OpenWeatheru | `openSection` | `setWeather` |
| ukaz hranice statu | `openSection` | `setLayers` |
| zvětši body A a B na trase | `openSection` | `setValues` |

`addLabel`, `placeIcon`, `setWeather` nebyly za 86 tahů zavolány **ani jednou**,
přitom v API jsou. Model o nich zjevně neví, nebo je popis v promptu tak slabý,
že si na ně netroufne.

**Oprava:** doplnit do promptu ke každému nástroji 1–2 příkladové dotazy;
`openSection` povolit teprve jako poslední možnost s výslovným zdůvodněním.

### 6. Nedeterminismus — stejný dotaz, jiný (a někdy špatný) výsledek

| Dotaz | 1. pokus | 2. pokus |
|---|---|---|
| ukaž mi perimetr 2000 m od Moskvy na glóbusu | `gotoPlace,setGlobe,setLayers,setValues` ✗ perimetr se nenakreslil | `gotoPlace,drawPerimeter,setGlobe` ✓ |
| udělej trasu červenou a tlustší | `setLayers,setValues` ✗ | `setColors,setValues` ✓ |
| vypni budovy | `setBaseStyle` ✗ přepnul podklad | `setLayers` ✓ |
| ukaž mi cestu vlakem z Prahy do Brna | `setTransportMode,routeBetween` — tvářil se, že vlak umí | správně odmítl a nabídl auto |
| ukaz hranice statu | `openSection` ✗ | `setLayers` ✓ |

Pro nástroj na výrobu grafiky do vysílání je nepředvídatelnost horší než
otevřené odmítnutí. Snížit `temperature`, případně několik nejčastějších
intentů (perimetr, barva trasy, vrstvy) řešit deterministickým routerem před LLM.

### 7. Tiché no-opy — asistent tvrdí, že něco udělal, a neudělal

```
Q:  zvýrazni Německo na politické mapě
SAY: Zobrazuji Německo na politické mapě
TOOLS: gotoPlace, setBaseStyle          ← colorPolitical chybí, nic se nezvýraznilo
```

```
Q:  dej šipku z Prahy na Brno
SAY: Vykresluji trasu z Prahy do Brna
TOOLS: routeBetween, fitRoute           ← drawArrow existuje, nebyl použit
```

```
Q:  změř vzdálenost z Prahy do Brna
TOOLS: routeBetween, fitRoute           ← measureDistance existuje, nebyl použit
```

**Oprava:** `say` generovat teprve po `toolResults` a formulovat podle toho,
co se skutečně povedlo. Rozlišit v promptu „šipka" → `drawArrow`,
„změř / vzdušnou čarou" → `measureDistance`, „trasa / kudy" → `routeBetween`.

### 8. Únik interních detailů

```
Q:  jake mas nastroje
SAY: Mám následující nástroje: gotoPlace, show3D, setCamera, setBaseStyle, setLayers, applyPreset, setGlobe, setShadows, setT…
```

Uživateli se vysypaly interní názvy funkcí. Má odpovědět lidsky
(„umím lítat na místa, přepínat podklad, kreslit trasy a perimetry, …").

### 9. Čeština v odpovědích

Drobné, ale je to vidět ve vysílacím nástroji: „Scho**z**uji vedlejší silnice",
„ukazu**jí** Evropu", „dlouhými stín**ami**", „nahra**n**out",
„Vyhledávám trasu z **Barandova**" (Barrandov — a přesto to geokódoval).
Model také přebírá překlepy uživatele do odpovědi („celou zem**e**kouli").

**Oprava:** do promptu pravidlo, že odpověď je vždy gramaticky správná čeština
a názvy míst se píší správně, i když je uživatel napsal s překlepem.

---

## Priority

1. Zákaz vymyšlených čísel + dočtení výsledku měření (nálezy 1, 2)
2. Předávání kontextu a navazující/opravné pokyny (nález 4)
3. Pomlčka v názvech míst (nález 3)
4. Zpřístupnit modelu `addLabel`, `placeIcon`, `setWeather`, `drawArrow` (nálezy 5, 7)
5. Snížit nedeterminismus (nález 6)
6. Kosmetika: interní názvy, čeština (nálezy 8, 9)

---

## Pozn.: repozitář a nasazená verze se rozešly

Ani jedna verze není nadmnožinou druhé:

| | v gitu | na appcreate.cloud |
|---|---|---|
| AI asistent + `window.TNMAP` API (~970 řádků) | ne | **ano** |
| ambientní okluze (`aoOn`) | ne | **ano** |
| 3D terén (`terrain-dem`) | **ano** | ne |
| tramvaje (`praha_tram.js`) | **ano** | ne |

Než se bude cokoli na asistentovi opravovat, je potřeba tyto dvě linie sloučit
do gitu jako jediný zdroj pravdy — jinak každé nasazení jednu sadu změn přepíše.
