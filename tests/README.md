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
| 03 undo_keys | Ctrl+Z/Y, Delete, Ctrl+D, tažení a smazání popisku, krok zpět po trase |
| 04 project_roundtrip | bohatá scéna → uložit → načíst v čistém prohlížeči beze ztrát |
| 05 templates | Rychlá scéna (ikonka + popisek + perimetr, jeden krok zpět) |
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
| 20 api_d1 | serverové API nad náhradní D1 (node:sqlite): token, ochrana proti hromadnému smazání, historie verzí a obnova, statistika |
| 90 batch_export (pomalý) | hromadný export 16:9 + 9:16 |

Testy 03, 05, 12, 13 potřebují internet (geokódování Nominatim / Photon).
Asistenta s opravdovým modelem ověřuje `worker/tools/eval.mjs` — stojí ~23
dotazů z denního limitu Workers AI, proto se nepouští automaticky.

Snímky a exporty se ukládají do `tests/out/` (není v gitu).
