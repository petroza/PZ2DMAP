# Kde co běží a jak to nasadit

Stav k 8. 11. 2026.

## Živá mapa

**https://tnmap.pages.dev** — Cloudflare Pages, projekt `tnmap`.

Běží na nasazení `c1aeeb91` z 19. 9. 2026. Nasazuje se **ad-hoc uploadem**,
projekt není napojený na git — proto se obsah repozitáře a živé verze
opakovaně rozcházel.

Backend jsou Pages Functions nad D1 databází `23869285-146f-4a51-9ed3-247c42e387e3`:

| endpoint | co dělá |
|---|---|
| `/api/map?entity=presets\|projects` | čte a ukládá presety a projekty (tabulka `items`) |
| `/api/chmi` | výstrahy ČHMÚ |
| `/api/share` | sdílení přes token (tabulka `shares`) |
| `/api/usage` | statistiky používání (tabulka `usage_daily`) |
| `/api/planes`, `/api/ships`, `/api/tle`, `/api/satnogs` | letadla, lodě a družice v reálném čase |
| `map_api.php`, `chmi_vystrahy.php`, `wx_owm.php` | aliasy pro nasazení na Forpsi |

Front-end si cestu vybírá sám podle hostitele:

```js
const PZ_ON_PHP_HOST = /(^|\.)appcreate\.cloud$/i.test(location.hostname);
const PZ_API = (php, fn) => PZ_ON_PHP_HOST ? php : fn;
```

**Zdrojový kód těchto Functions v repozitáři není** a z Cloudflare ho stáhnout
nejde. Dokud se nenajde (naposledy hlášen v `O:\TNmap`), nelze nasadit nový
front-end bez toho, že by se backend ztratil.

## AI asistent

**https://tnmap-chat.petrzavorka.workers.dev/api/chat** — samostatný Worker
`tnmap-chat`, model `@cf/meta/llama-3.3-70b-instruct-fp8-fast`.
Zdroják je v `worker/tnmap-chat.built.js`, postup nasazení v `worker/README.md`.

CORS pouští `appcreate.cloud`, `tnmap.pages.dev` a náhledové adresy
`*.tnmap.workers.dev`.

## Jak se to rozešlo

Pět verzí, žádná nebyla nadmnožinou ostatních:

| verze | kde | čím byla jediná |
|---|---|---|
| 29. 7. | git | tramvaje, větší ikonka chatu |
| 2. 8. | Pages `f735c93d` | barvy u vrstev, šířky vrstev, panely družic/letadel/lodí, 3D terén |
| 4. 8. | Pages `8c40eae6` | terén odebrán (byl pomalý) |
| 19. 9. | Pages `c1aeeb91` ← živá | rychlý router chatu (`localPlan`), Functions nad D1 |
| ? | `O:\TNmap` (lokál) | nedostupné z cloudu |

19. 9. se nasadil starší soubor (970 kB) přes srpnovou verzi (1,13 MB), čímž
se srpnová práce z živé verze ztratila. Větev `claude/tnmap-improvement-mq79cw`
to slučuje zpátky — základ je srpnová linie, do ní jsou přenesené tramvaje
z gitu.

## Nasazení front-endu

Po doplnění zdrojáku Functions do `functions/`:

```bash
npx wrangler pages deploy dist --project-name=tnmap --branch=preview-nazev   # náhled
npx wrangler pages deploy dist --project-name=tnmap                          # produkce
```

**Náhled vždy první.** Každé nasazení má vlastní adresu
`https://<id>.tnmap.pages.dev`, produkce se nemění, dokud se nepovýší.

Rollback na libovolné starší nasazení:

```bash
curl -X POST -H "Authorization: Bearer $CF_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/pages/projects/tnmap/deployments/<ID>/rollback"
```

Pozor: rollback **povýší stávající nasazení**, nevytváří nové. Nasazení, na
které se vrátíš, se tím stává produkcí a nejde smazat, dokud produkce nestojí
na něčem jiném.

## Lokální náhled proti živému backendu

Bez nasazování, statické soubory z repa a `/api/*` proxované na produkci:

```bash
node tools/preview.mjs     # http://localhost:8788
```

## Zálohy dat

`map_data/presets.json` a `map_data/projects.json` jsou kopie z D1 z 8. 11.
(3 presety, 3 projekty). Jiná kopie mimo databázi neexistovala.

## Tokeny

Přístupové údaje patří do proměnných prostředí, ne do repozitáře:
`CF_API_TOKEN`, `CF_ACCOUNT_ID`, `OWM_KEY`.
