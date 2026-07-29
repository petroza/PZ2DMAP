# Ladění AI asistenta mapy (worker `tnmap-chat`)

Zdroje:

- **Log**: Cloudflare Workers Observability, worker `tnmap-chat`, 86 tahů
  z 29. 7. 2026, 05:33–11:02 UTC. Worker loguje každý tah
  (`tag:"tnchat"`, `q`, `say`, `tools`, `round`, `miss`).
- **Kód**: `GET /workers/services/tnmap-chat/environments/production/content`
  (289 řádků, verze 15 = `322f21b1`, nasazeno 29. 7. 07:12 UTC).
  Model: **`@cf/meta/llama-3.3-70b-instruct-fp8-fast`**, `temperature 0.2`,
  `max_tokens 700`.

---

## Hlavní zjištění: verze 15 je regrese

Prompt byl nasazen 07:12, tedy uprostřed logu. Rozdělení podle verze:

| | tahů | miss | |
|---|---|---|---|
| před v15 (05:33–06:36) | 72 | 2 | **3 %** |
| po v15 (10:43–11:02) | 14 | 5 | **36 %** |

A hlavně se změnil **druh** selhání. Starý prompt vracel vždy platný JSON,
jen občas špatné nástroje. Nový prompt vrací **neplatný JSON** — a to je
mnohem horší, protože z toho uživatel dostane hluché „Nerozumím".

Malý vzorek (14 tahů) — ale všech 5 selhání má stejnou příčinu, viz níže.

---

## Příčina č. 1 — „Nerozumím" neznamená nerozumím

`worker.js:204` — `sanitizePlan()`:

```js
if (!plan || typeof plan !== "object")
  return { say: "Nerozumím, zkus to prosím jinak.", calls: [], done: true };
```

Tato větev nastane **jedině tehdy, když se nepodařilo naparsovat JSON**
z odpovědi modelu. Nemá to nic společného s tím, že by model dotaz nepochopil.

Všech 5 nedávných selhání je tedy: *llama vrátila prózu místo JSON objektu.*

```
ukaz brno - komín a přehradu           → neplatný JSON
ukaž Brno -Komín a přehradu            → neplatný JSON
ukaž Brno - Komín - je to městská část → neplatný JSON
zapni na tom hranice států             → neplatný JSON
ostatní země nechci označit            → neplatný JSON
```

Proč právě u těchhle? Všechny jsou nejednoznačné — dvě místa v jednom dotazu,
zájmenný odkaz, negace. Model chce **doptat se nebo vysvětlit**, a v tu chvíli
sklouzne z JSON formátu do běžné věty. Pravidlo 2 („calls může být prázdné,
když se ptáš na doplnění") mu to dovoluje, ale 70B model si u toho neudrží formát.

### Co s tím — tři opravy, každá samostatně účinná

**a) Vynutit formát na úrovni API místo promptem.** Workers AI umí
`response_format`, což formát garantuje a `extractPlan` se stane jen záložkou:

```js
const out = await env.AI.run(MODEL, {
  messages, max_tokens: 1200, temperature: 0.2,
  response_format: {
    type: "json_schema",
    json_schema: {
      type: "object",
      properties: {
        say:  { type: "string" },
        calls: { type: "array", items: {
          type: "object",
          properties: { tool: {type:"string"}, args: {type:"object"}, label: {type:"string"} },
          required: ["tool"]
        }},
        done: { type: "boolean" }
      },
      required: ["say", "calls"]
    }
  }
});
```

**b) Přidat jedno opravné kolo.** Dnes je parse failure koncová — žádný retry:

```js
if (!plan) {
  const retry = await env.AI.run(MODEL, { messages: [...messages,
    { role: "assistant", content: String(r).slice(0, 500) },
    { role: "user", content: 'Tohle nebyl platný JSON. Vrať POUZE jeden JSON objekt {"say":…,"calls":[…],"done":…}, nic jiného.' }
  ], max_tokens: 700, temperature: 0 });
  plan = extractPlan(retry?.response ?? "");
}
```

**c) Nezahazovat prózu.** Když model vrátí větu, je to skoro vždy použitelná
odpověď nebo doptání. Místo „Nerozumím" ji ukázat jako `say` s prázdnými `calls`:

```js
if (!plan && typeof r === "string" && r.trim().length > 2 && !r.includes("{"))
  plan = { say: r.trim().slice(0, 400), calls: [], done: true };
```

Tím zmizí hluché „Nerozumím" i v případě, že a) a b) neuspějí.

**d) `max_tokens: 700` je málo.** Prompt povoluje až 8 volání
(`calls.slice(0, 8)`). Osm objektů s `args` a `label` plus `say` se do 700
tokenů nevejde → odpověď se odřízne v půlce → neplatný JSON. Zvednout na 1200.

---

## Příčina č. 2 — druhé kolo se nikdy nespustí

`worker.js:225`:

```js
done: plan.done !== false
```

`done` je tedy **`true` pokaždé, když ho model výslovně nenastaví na `false`**.
Klient se na `data.done` spoléhá a smyčku ukončí (`index.html`: `if(data.done) break;`).

Důsledek — přesně to, co je v logu vidět:

```
Q:  ukaž celou zeměkouli globus satelitní a ukaž vzdálenost mezi moskvou a kyjevem
SAY: … Vzdálenost mezi Moskvou a Kyjevem se bude měřit vzdušnou čarou.
TOOLS: setGlobe, setBaseStyle, measureDistance
```

`measureDistance` proběhl a vrátil hodnotu (Moskva–Kyjev = 756 km), ale
`done:true` smyčku ukončil, `toolResults` se nikdy neposlaly zpět a číslo
uživatel nedostal. Odpověď zůstala v budoucím čase.

**Oprava** — když plán obsahuje nástroj, jehož výsledek se má vyslovit,
vynutit další kolo bez ohledu na to, co řekl model:

```js
const READBACK = new Set(["measureDistance", "routeBetween", "getState", "drawPerimeter"]);
const needsRound = finalPlan.calls.some(c => READBACK.has(c.tool));
finalPlan.done = needsRound ? false : (plan.done !== false);
```

## Příčina č. 3 — pravidlo 6d nezná `measureDistance`

Prompt, pravidlo 6d:

> Když se uživatel ptá NA VZDÁLENOST („kolik je to", „jak daleko"), vykresli trasu
> (planeDirect pro vzdušnou linku) — z výsledku dostaneš distanceKm a v dalším kole
> to číslo NAPIŠ do "say".

Mluví se tu jen o `routeBetween`. `measureDistance` — dedikovaný nástroj na
přesně tuhle věc — v pravidle chybí, a tak model buď použije `routeBetween`
(a dostane délku po silnici, ne vzdušnou čarou), nebo `measureDistance` zavolá
a číslo nepřečte. To přímo způsobilo nejhorší nález v logu:

```
Q:  kolik je to vzdušnou linkou z Prahy do Kyjeva
SAY: … Vzdálenost mezi těmito městy je přibližně 1046 km.
TOOLS: routeBetween, fitRoute
```

Skutečná ortodroma Praha–Kyjev je **1142 km**. Model číslo **vymyslel** — nemohl
ho mít odkud vzít, `measureDistance` nezavolal. V nástroji na zpravodajskou
grafiku je vymyšlené číslo nejzávažnější možná vada.

**Oprava** — přeformulovat 6d na `measureDistance` a přidat tvrdý zákaz:

> 6d. Na dotaz NA VZDÁLENOST („kolik je to", „jak daleko", „vzdušnou čarou")
> použij **measureDistance** (from, to) a vrať `done:false`. Číslo NAPIŠ do
> „say" teprve v dalším kole z `distanceKm` ve VÝSLEDCÍCH.
> **NIKDY neuveď žádnou vzdálenost, azimut ani jiné číslo, které nepřišlo ve
> VÝSLEDCÍCH PROVEDENÝCH NÁSTROJŮ.** Když číslo nemáš, změř ho.
> `routeBetween` dává délku po silnici — pro vzdušnou čáru je špatný nástroj.

## Příčina č. 4 — navazující pokyny nemají do čeho se zakotvit

`round` v logu = `history.filter(m => m.role === "user").length`, a historie je
`body.messages.slice(-10)` — proto se `round` zastaví na 5.

Do modelu jde jako asistentův obsah řetězec, který skládá klient:

```js
history.push({role:'assistant', content:(data.say||'') + ' [provedeno: ' + calls.map(c=>c.tool).join(', ') + ']'});
```

Model tedy z minulých tahů vidí jen **jména nástrojů** — ne jejich `args`
ani výsledky. Když pak přijde „ostatní země nechci označit", nemá informaci
o tom, že se v předchozím tahu obarvilo Rusko, ani čím. `mapState` se posílá,
ale ten obarvené státy neobsahuje (`toolMapState()` vrací jen center/zoom/
pitch/bearing/baseStyle/globe/mode/tab/hasRoute/shadows/ao).

**Oprava, dvě části:**

1. Do historie ukládat i argumenty a výsledek, ne jen jméno nástroje:
   `[provedeno: colorPolitical {country:"Rusko",color:"#e63946"} → ok]`
2. Rozšířit `toolMapState()` o seznam aktivních prvků — obarvené státy/kraje,
   nakreslené perimetry, šipky, popisky. Bez toho nemůže model splnit
   „zruš to", „změň barvu", „ostatní ne" — nemá co adresovat.

## Příčina č. 5 — volba modelu

`@cf/meta/llama-3.3-70b-instruct-fp8-fast` musí zvládat současně:

- striktní JSON bez markdownu,
- 26 nástrojů s parametry,
- češtinu včetně skloňování a překlepů,
- systémový prompt, který má po v15 přes 60 řádků pravidel.

To je na 70B model ve fp8 kvantizaci hodně a projevuje se to přesně tam, kde
je vidět: formát se rozpadá u nejednoznačných dotazů, a to i po `temperature 0.2`.
Nález č. 6 (nedeterminismus) má stejný původ.

Doporučení v tomto pořadí:

1. Nasadit `response_format` (výše) — to samo většinu formátových chyb odstraní
   a je zdaleka nejlevnější.
2. Vyzkoušet na Workers AI silnější model s nativním tool-callingem.
3. Nejčastější intenty (globus, podklad, vrstvy, perimetr, barva trasy) vyřídit
   deterministickým routerem **před** LLM. Z logu jde o většinu provozu, byly by
   okamžité a nikdy by neselhaly.

---

## Nedeterminismus — stejný dotaz, jiný výsledek

Ze starší části logu, kde totéž bylo zadáno vícekrát:

| dotaz | 1. pokus | 2. pokus |
|---|---|---|
| perimetr 2000 m od Moskvy na glóbusu | `gotoPlace,setGlobe,setLayers,setValues` — perimetr se vůbec nenakreslil | `gotoPlace,drawPerimeter,setGlobe` ✓ |
| udělej trasu červenou a tlustší | `setLayers,setValues` ✗ | `setColors,setValues` ✓ |
| vypni budovy | `setBaseStyle` — přepnulo podklad ✗ | `setLayers` ✓ |
| ukaz hranice statu | `openSection` ✗ | `setLayers` ✓ |
| cesta vlakem z Prahy do Brna | tvářil se, že vlak umí | správně odmítl a nabídl auto ✓ |

Pro nástroj na výrobu grafiky do vysílání je nepředvídatelnost horší než
otevřené odmítnutí.

## Tiché no-opy

Odpověď tvrdí, že se něco stalo, a nestalo se:

```
Q:  zvýrazni Německo na politické mapě
SAY: Zobrazuji Německo na politické mapě
TOOLS: gotoPlace, setBaseStyle        ← colorPolitical chybí, nic se nezvýraznilo
```

```
Q:  dej šipku z Prahy na Brno
SAY: Vykresluji trasu z Prahy do Brna
TOOLS: routeBetween, fitRoute         ← drawArrow existuje (prompt 6f ho i zmiňuje)
```

Pravidlo 6 („say MUSÍ popisovat jen to, co nástroje SKUTEČNĚ udělaly") tomu
nezabrání, protože `say` vzniká **současně** s `calls`, tedy dřív, než je známý
výsledek. Řešení je stejné jako u příčiny č. 2: u akcí, které mají viditelný
výsledek, vynutit druhé kolo a `say` formulovat až podle `toolResults`.

## Nevyužité nástroje

Za 86 tahů nebyly zavolány ani jednou: `applyPreset`, `placeIcon`, `addLabel`,
`setWeather`, `drawArrow`, `arcBestView`, `getState`. Prompt (6f) je přitom
výslovně jmenuje. `openSection` naopak tvoří **21 % všech tahů** — model se
k němu uchyluje i tam, kde nástroj existuje:

| dotaz | použito | mělo být |
|---|---|---|
| pridej popisek Brno do mapy | `openSection` | `addLabel` |
| vyznač na politické mapě Středočeský kraj červeně | `openSection` | `colorPolitical` |
| přidej ikonku výbuchu do Kyjeva | `openSection` | `placeIcon` |
| zapni radar srážek | `openSection` | `setWeather` |
| ukaž teplotu z OpenWeatheru | `openSection` | `setWeather` |
| zvětši body A a B na trase | `openSection` | `setValues` |

Vyjmenovat nástroj v promptu zjevně nestačí. K popisu každého nástroje
v `TOOLS` přidat 1–2 příkladové dotazy v češtině.

## Drobnosti

**Únik interních jmen.** Na „jake mas nastroje" model vysypal
`gotoPlace, show3D, setCamera, setBaseStyle, …`. Přidat do promptu, že se
schopnosti popisují lidsky.

**Čeština v odpovědích.** „Scho**z**uji vedlejší silnice", „ukazu**jí** Evropu",
„dlouhými stín**ami**", „nahra**n**out", „z **Barandova**" (Barrandov).
Model také přebírá překlepy uživatele do odpovědi („celou zem**e**kouli").
Doplnit pravidlo: odpověď je vždy gramaticky správná čeština a názvy míst se
píší správně i tehdy, když je uživatel napsal s překlepem.

---

## Priority

1. **`response_format` + `max_tokens` 1200 + opravné kolo** — smaže „Nerozumím“ (příčina 1)
2. **`done` u čtecích nástrojů vynutit na `false`** — bez toho asistent nikdy nevysloví změřenou hodnotu (příčina 2)
3. **Pravidlo 6d na `measureDistance` + zákaz nezměřených čísel** (příčina 3)
4. **Historie s argumenty a `mapState` s aktivními prvky** — navazující pokyny (příčina 4)
5. Příklady u nástrojů v `TOOLS`, `openSection` až jako poslední možnost
6. Deterministický router na nejčastější intenty (příčina 5)
7. Kosmetika: interní jména, čeština

---

## Pozn.: repozitář a nasazená verze se rozešly

Ani jedna verze není nadmnožinou druhé:

| | v gitu | na appcreate.cloud |
|---|---|---|
| AI asistent + `window.TNMAP` API (~970 řádků) | ne | **ano** |
| ambientní okluze (`aoOn`) | ne | **ano** |
| 3D terén (`terrain-dem`) | **ano** | ne |
| tramvaje (`praha_tram.js`) | **ano** | ne |

Zdrojový kód workeru `tnmap-chat` není v gitu vůbec (nasazuje se wranglerem
odjinud). Než se bude na asistentovi cokoli opravovat, měl by být worker
i front-end v repozitáři jako jediný zdroj pravdy — jinak každé nasazení
jednu sadu změn přepíše.
