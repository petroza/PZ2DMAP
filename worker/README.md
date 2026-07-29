# worker/ — AI asistent mapy (`tnmap-chat`)

## `tnmap-chat.built.js`

Zbuildovaná verze workeru **vytažená z Cloudflare**, ne původní zdroják.
Získáno přes:

```
GET /client/v4/accounts/{account_id}/workers/services/tnmap-chat/environments/production/content
```

(endpoint `/workers/scripts/tnmap-chat/content` vrací API tokenu chybu 10405
„Method not allowed for this authentication scheme")

Verze 15 = `322f21b1-8685-4b2d-bcbc-9ef5497b9e46`, nasazeno 29. 7. 2026 07:12 UTC
wranglerem. Model `@cf/meta/llama-3.3-70b-instruct-fp8-fast`,
`temperature 0.2`, `max_tokens 700`.

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
