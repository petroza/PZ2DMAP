# Návrh řešení: aby asistent dělal, co mu řekneme

Vychází z logu 86 reálných dotazů a ze zdrojáku workeru `tnmap-chat`
(viz `AI_CHAT_LOG_ANALYZA.md`). Opravy jsou seřazené podle poměru
přínos/práce — první tři jsou malé zásahy do `worker.js` a řeší většinu
toho, co uživatele štve.

Jedna věc předem: **problém není v tom, že by model nerozuměl česky.**
Ve 5 z 5 nedávných selhání model odpověděl rozumně, jen ne ve formátu JSON,
a worker tu odpověď zahodil. Proto se to řeší kódem, ne přemlouváním promptu.

---

## Fáze 1 — zastavit „Nerozumím" a vymyšlená čísla

Tři zásahy, dohromady cca 40 řádků. Po nich by měl miss rate spadnout
z 36 % k nule a asistent přestat uvádět čísla, která neměřil.

### 1.1 Vynutit JSON schématem, ne promptem

Ověřeno v docs (`workers-ai/features/json-mode/`): `response_format`
Workers AI podporuje a **`@cf/meta/llama-3.3-70b-instruct-fp8-fast` je na
seznamu podporovaných modelů**. Formát pak garantuje runtime, ne ochota modelu.

```js
const PLAN_SCHEMA = {
  type: "object",
  properties: {
    say:   { type: "string" },
    calls: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tool:  { type: "string" },
          args:  { type: "object" },
          label: { type: "string" }
        },
        required: ["tool"]
      }
    },
    done: { type: "boolean" }
  },
  required: ["say", "calls"]
};

const out = await env.AI.run(MODEL, {
  messages,
  max_tokens: 1200,          // bylo 700 — na 8 volání to nestačilo
  temperature: 0.2,
  response_format: { type: "json_schema", json_schema: PLAN_SCHEMA }
});
```

Pozor na dva detaily:

- V JSON módu vrací Workers AI **objekt**, ne string (`{"response": {…}}`).
  Stávající kód to už zvládá (`if (r && typeof r === "object") plan = r;`),
  takže se na této cestě nic měnit nemusí.
- Docs uvádějí, že v krajním případě model schéma nesplní a vrátí chybu
  `JSON Mode couldn't be met`. Proto pořád platí 1.2 a 1.3 jako záložka.
- JSON mód **neumí streaming** — tady to nevadí, worker nestreamuje.

### 1.2 Nezahazovat prózu

Když model vrátí větu místo JSON, je to skoro vždy použitelná odpověď nebo
doptání. Dnes z ní uživatel dostane hluché „Nerozumím". Před `sanitizePlan`:

```js
if (!plan && typeof r === "string" && r.trim().length > 2 && !r.includes("{")) {
  plan = { say: r.trim().slice(0, 400), calls: [], done: true };
}
```

### 1.3 Jedno opravné kolo

Parse failure je dnes koncový stav, žádný retry neexistuje:

```js
if (!plan) {
  const fix = await env.AI.run(MODEL, {
    messages: [...messages,
      { role: "assistant", content: String(r || "").slice(0, 500) },
      { role: "user", content: 'Tohle nebyl platný JSON. Vrať POUZE jeden JSON objekt {"say":…,"calls":[…],"done":…}, nic jiného.' }
    ],
    max_tokens: 700, temperature: 0,
    response_format: { type: "json_schema", json_schema: PLAN_SCHEMA }
  });
  plan = fix?.response ?? null;
  if (typeof plan === "string") plan = extractPlan(plan);
}
```

### 1.4 Vynutit druhé kolo u čtecích nástrojů

Dnešní `done: plan.done !== false` znamená `true` pokaždé, když to model
neuvede — a klient tím smyčku ukončí. Proto asistent nikdy nevysloví
změřenou vzdálenost. V `sanitizePlan` (nebo hned za ním):

```js
// Nástroje, jejichž výsledek se musí uživateli říct nahlas.
const READBACK = new Set(["measureDistance", "routeBetween", "drawPerimeter", "getState"]);
const needsRound = calls.some(c => READBACK.has(c.tool));
// ...
done: needsRound ? false : (plan.done !== false)
```

### 1.5 Zakázat čísla, která nepřišla z nástroje

Pravidlo 6d v promptu mluví jen o `routeBetween` a `measureDistance` vůbec
nezmiňuje. Přepsat na:

> 6d. Na dotaz NA VZDÁLENOST („kolik je to", „jak daleko", „vzdušnou čarou")
> použij **measureDistance** (from, to). Číslo NAPIŠ do „say" teprve v dalším
> kole z `distanceKm` ve VÝSLEDCÍCH.
> **NIKDY neuveď žádnou vzdálenost, azimut, plochu ani jiné číslo, které
> nepřišlo ve VÝSLEDCÍCH PROVEDENÝCH NÁSTROJŮ.** Když číslo nemáš, změř ho.
> `routeBetween` dává délku po silnici — pro vzdušnou čáru je to špatný nástroj.

Bez tohoto pravidla model tvrdil „Praha–Kyjev přibližně 1046 km“ (skutečnost 1142 km).

---

## Fáze 2 — aby fungovaly navazující pokyny

Tohle je to, co uživatele nejvíc frustruje: *„zapni na tom hranice států"*,
*„ostatní země nechci označit"*, *„označ ten kraj modře"*. Model dnes nemá
do čeho ta zájmena zakotvit.

### 2.1 Do historie ukládat argumenty a výsledek

Klient dnes posílá jako asistentův obsah jen jména nástrojů:

```js
history.push({role:'assistant', content:(data.say||'') + ' [provedeno: ' + calls.map(c=>c.tool).join(', ') + ']'});
```

Model tedy neví, *co* se obarvilo ani *jakou barvou*. Změnit na:

```js
const done = calls.map((c, i) => {
  const r = toolResults?.[i]?.result;
  return `${c.tool}(${JSON.stringify(c.args || {})}) → ${r?.ok === false ? 'CHYBA: ' + r.error : 'ok'}`;
}).join('; ');
history.push({ role: 'assistant', content: (data.say || '') + '\n[provedeno: ' + done + ']' });
```

### 2.2 `mapState` musí obsahovat aktivní prvky

`toolMapState()` dnes vrací jen center/zoom/pitch/bearing/baseStyle/globe/
mode/tab/hasRoute/shadows/ao. Chybí v něm přesně to, na co uživatel odkazuje.
Doplnit:

```js
politicalColors: <{ "Rusko": "#e63946", "Jihočeský kraj": "#ffd166" }>,
perimeters:      <[{ place, meters }]>,
arrows:          <[{ from, to }]>,
labels:          <[{ text, place }]>,
icons:           <[{ place }]>,
measures:        <[{ from, to, distanceKm }]>
```

Bez tohoto seznamu nemůže model splnit „zruš to", „změň barvu",
„ostatní ne" — nemá co adresovat. Tohle je z celého návrhu ta část,
která nejvíc přidá na „chytrosti".

### 2.3 Naučit prompt zájmena a negaci

> Zájmena a odkazy („to", „tam", „ten kraj", „na té mapě", „tu barvu")
> vždy vztahuj k AKTUÁLNÍMU STAVU MAPY výše a k tomu, co se provedlo
> v předchozích tazích. Nikdy se kvůli nim neptej znovu, když se dá
> odpověď určit ze stavu.
>
> Odebírací a opravné pokyny („nechci", „zruš", „ostatní ne", „jen X",
> „vrať zpátky") NEJSOU nový příkaz — jsou úprava toho, co už je na mapě.
> Splň je zrušením nebo přebarvením existujícího prvku, ne novým vytvořením.

---

## Fáze 3 — aby používal nástroje, které má

`addLabel`, `placeIcon`, `setWeather`, `drawArrow`, `applyPreset`,
`arcBestView` nebyly za 86 tahů zavolány **ani jednou**, přitom je prompt
jmenuje. `openSection` naopak tvoří **21 % tahů**. Vyjmenovat nástroj zjevně
nestačí — chybí příklad.

### 3.1 Ke každému nástroji dát příkladový dotaz

V bloku `TOOLS` u každé položky přidat řádek `Např.:`:

```
addLabel(place, text, size, side)
  Přidá textový popisek k místu.
  Např.: "přidej popisek Letňany na mapu", "napiš k Brnu Morava"

setWeather(radar, clouds, temp, wind)
  Zapne vrstvy počasí.
  Např.: "zapni radar srážek", "ukaž teplotu", "vypni počasí"

drawArrow(from, to, color, width)
  Nakreslí šipku mezi dvěma místy. NENÍ to trasa.
  Např.: "dej šipku z Prahy na Brno", "ukaž směr postupu na Charkov"

colorPolitical(region, country, color, clear)
  Obarví stát nebo český kraj na politické mapě.
  Např.: "označ Rusko červeně", "vyznač Středočeský kraj", "zruš obarvení"
```

### 3.2 `openSection` degradovat na poslední možnost

> `openSection`/`openTab` použij TEPRVE tehdy, když žádný nástroj ze seznamu
> úkol neumí (nahrání souboru uživatele, export videa, uložení projektu).
> Když nástroj existuje, VŽDY ho zavolej. Otevřít sekci místo zavolání
> nástroje je chyba.

---

## Fáze 4 — spolehlivost a rychlost

### 4.1 Deterministický router před LLM

Z logu je vidět, že většinu provozu tvoří pár opakujících se intentů:
glóbus, podklad, vrstvy, kamera, perimetr, barva. Ty nepotřebují LLM —
a když jdou přes LLM, občas selžou nebo trvají sekundy.

```js
const FAST = [
  [/\b(glóbus|globus|zeměkoul|planet)/i,          () => [{tool:'setGlobe', args:{on:true}, label:'zapnout glóbus'}]],
  [/\bsatelit/i,                                   () => [{tool:'setBaseStyle', args:{style:'satellite'}, label:'satelitní podklad'}]],
  [/\bvypni (3d )?budovy/i,                        () => [{tool:'setLayers', args:{buildings3d:false}, label:'vypnout budovy'}]],
  [/\b(hranice států|politick[áé] map)/i,          () => [{tool:'setBaseStyle', args:{style:'political'}, label:'politická mapa'}]],
  // …
];
```

Trefa = odpověď bez volání modelu: rychlejší, zdarma a **nikdy neselže**.
Netrefa propadne na LLM jako dnes. Tohle je jediná změna, která zároveň
zlepší latenci a sníží náklady.

### 4.2 Případná výměna modelu

`llama-3.3-70b-fp8-fast` musí současně držet striktní JSON, 26 nástrojů,
češtinu se skloňováním a překlepy a 60+ řádků pravidel. To je na 70B model
ve fp8 hodně a projevuje se to jako nedeterminismus (stejný dotaz → jiný plán).

Doporučuju v tomto pořadí: **nejdřív nasadit fázi 1** (`response_format`
většinu formátových chyb odstraní samo a je zdaleka nejlevnější), teprve
pak měřit, jestli výměna modelu ještě něco přinese. Zbytečně silný model
by jen zdražil provoz.

### 4.3 Kosmetika

- Na „jaké máš nástroje" nevypisovat interní jména funkcí, ale schopnosti lidsky.
- Do promptu: *odpověď je vždy gramaticky správná čeština; názvy míst piš
  správně i tehdy, když je uživatel napsal s překlepem* (v logu „Barandov",
  „zemekouli", „Schozuji", „ukazují Evropu").

---

## Jak to změřit — regresní sada z reálného provozu

Těch 86 dotazů v logu je hotová testovací sada, na kterou se dá po každé
změně promptu pustit kontrola. To je zásadní, protože **v15 byla regrese,
která se poznala teprve z logu** — bez měření se to bude opakovat.

```
tools/eval.mjs   # pošle N dotazů na worker, porovná calls s očekáváním
```

Minimálně tyto případy, všechny z reálného logu:

| dotaz | očekávané `calls` | dnes |
|---|---|---|
| ukaz brno - komín a přehradu | `gotoPlace` | ✗ „Nerozumím" |
| zapni na tom hranice států | `setBaseStyle`/`setLayers` | ✗ „Nerozumím" |
| ostatní země nechci označit | `colorPolitical{clear}` | ✗ „Nerozumím" |
| kolik je to vzdušnou linkou z Prahy do Kyjeva | `measureDistance` + číslo z výsledku | ✗ vymyslel 1046 km |
| dej šipku z Prahy na Brno | `drawArrow` | ✗ `routeBetween` |
| přidej popisek Letňany na mapu | `addLabel` | ✗ `openSection` |
| zapni radar srážek | `setWeather` | ✗ `openSection` |
| vyznač Středočeský kraj červeně | `colorPolitical` | ✗ `openSection` |
| vypni budovy | `setLayers` | ~ jednou `setBaseStyle` |
| perimetr 2000 m od Moskvy | `drawPerimeter` | ~ jednou vynechal |

Sledovat dvě čísla: **miss rate** (má být 0) a **podíl `openSection`**
(dnes 21 %, cíl pod 5 %).

---

## Souhrn a odhad práce

| fáze | co | práce | přínos |
|---|---|---|---|
| 1 | `response_format`, `max_tokens`, prose fallback, retry, `done`, pravidlo 6d | ~40 řádků | **zmizí „Nerozumím" a vymyšlená čísla** |
| 2 | historie s argumenty, `mapState` s prvky, zájmena a negace | ~80 řádků, i front-end | **navazující pokyny začnou fungovat** |
| 3 | příklady u nástrojů, `openSection` jako poslední možnost | jen prompt | využije se 6 nepoužívaných nástrojů |
| 4 | router, případně model, kosmetika | ~60 řádků | rychlost, cena, předvídatelnost |
| — | regresní sada z logu | ~100 řádků | zabrání další regresi typu v15 |

Doporučený postup: **fáze 1 samostatně, nasadit, změřit na logu.**
Je malá, nízkoriziková a řeší nejviditelnější vady. Fázi 2 pak dělat
s vědomím, že sahá i do front-endu (`index.html`), takže se dřív musí
vyřešit rozejití repa a nasazené verze.

---

## Co k tomu potřebuju od tebe

1. **Zdroják workeru** — v gitu je jen build vytažený z Cloudflare
   (`worker/tnmap-chat.built.js`, 289 řádků, čitelný, ale zbuildovaný).
   Máš někde složku s `wrangler.toml` a `src/worker.js`? Hezčí je patchovat originál.
2. **Rozhodnutí o sloučení repa a webu** — fáze 2 se dotýká `index.html`,
   kde je AI chat jen na webu a v gitu vůbec. Bez sloučení každý deploy
   jednu sadu změn přepíše.
3. **Deploy** — FTP i `wrangler deploy` jsou z mého prostředí nedostupné
   (proxy pouští jen HTTPS), takže nasazení musí proběhnout u tebe.
