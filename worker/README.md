# worker/ — AI asistent mapy (`tnmap-chat`)

## `tnmap-chat.built.js`

Zbuildovaná verze workeru **vytažená z Cloudflare**, ne původní zdroják.
Získáno přes:

```
GET /client/v4/accounts/{account_id}/workers/services/tnmap-chat/environments/production/content
```

(endpoint `/workers/scripts/tnmap-chat/content` vrací API tokenu chybu 10405
„Method not allowed for this authentication scheme")

**Aktuálně nasazeno: verze 18** = `483cfa46-b23f-417f-8b95-94ea029a99c2`
(fáze 1, viz `NAVRH_ZLEPSENI.md`). Předchůdce byla verze 15 =
`322f21b1-8685-4b2d-bcbc-9ef5497b9e46`. Model
`@cf/meta/llama-3.3-70b-instruct-fp8-fast`, `temperature 0.2`, `max_tokens 1200`.

### Nasazení a rollback přes API

Wrangler není potřeba. Upload nové verze (provoz ještě neobsluhuje):

```bash
curl -X POST -H "Authorization: Bearer $CF_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/workers/scripts/tnmap-chat/versions" \
  -F 'metadata={"main_module":"worker.js","bindings":[{"name":"AI","type":"ai"}],"compatibility_date":"2026-01-15"};type=application/json' \
  -F 'worker.js=@tnmap-chat.built.js;filename=worker.js;type=application/javascript+module'
```

Pozor: `filename` v multipartu **musí** být `worker.js`, jinak vrátí
`10021 No such module`.

Každá verze má preview URL `https://<prvních 8 znaků version id>-tnmap-chat.<subdoména>.workers.dev`
— **vždy na ní odlaď dřív, než verzi nasadíš na produkci.**

Nasazení na 100 % provozu:

```bash
curl -X POST -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" \
  "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/workers/scripts/tnmap-chat/deployments" \
  -d '{"strategy":"percentage","versions":[{"version_id":"<ID>","percentage":100}]}'
```

Rollback = totéž se starším `version_id`. Verze se nemažou, takže je návrat
okamžitý.

## `tools/eval.sh`

Regresní sada složená z reálných dotazů z logu. Bere endpoint jako argument,
takže se pouští i na preview URL:

```bash
./tools/eval.sh https://<version>-tnmap-chat.<subdoména>.workers.dev/api/chat
```

Je tu proto, že zdrojový kód workeru nebyl ve verzovacím systému **nikde** —
existoval jen jako nasazený artefakt. Až se najde originál (`wrangler.toml`
+ `src/worker.js`), měl by tenhle soubor nahradit.

## `NAVRH_ZLEPSENI.md`

Návrh oprav ve čtyřech fázích s konkrétními patchi. Vychází z analýzy
86 reálných dotazů — viz `../AI_CHAT_LOG_ANALYZA.md`.

## Jak si vytáhnout log asistenta

Worker loguje každý tah (`console.log` s `tag:"tnchat"`), observability má
zapnutou i s `persist`. Dotaz na posledních 14 dní:

```bash
curl -sS -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" \
  -X POST "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/workers/observability/telemetry/query" \
  -d '{"queryId":"custom-query","timeframe":{"from":FROM_MS,"to":TO_MS},"limit":500,
       "parameters":{"datasets":["cloudflare-workers"],
         "filters":[{"key":"$metadata.service","operation":"eq","type":"string","value":"tnmap-chat"}]},
       "view":"events"}'
```

Každý event má v `source`: `q` (dotaz), `say` (odpověď), `tools` (volané
nástroje), `round` (pořadí tahu), `miss` (nevrátil žádný nástroj).

Tokeny ber z prostředí, nikdy je nedávej do repozitáře.
