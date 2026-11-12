# tnmap-mcp — konektor TN mapy pro Claude

Claude (claude.ai, desktop) ovládá otevřenou TN mapu přes MCP (Streamable HTTP, bez přihlášení).

- `https://tnmap-mcp.petrzavorka.workers.dev/mcp` — **společný konektor** (přidá jednou správce
  organizace nebo kdokoli pro sebe). Claude se k mapě připojí nástrojem `pripojit_mapu {kod}`.
- `https://tnmap-mcp.petrzavorka.workers.dev/mcp/<KÓD>` — konektor napevno pro jednu mapu (prohlížeč).
- `wss://…/ws/<KÓD>` — připojení mapy z prohlížeče (TN mapa → asistent → Claude → Povolit).

Kód (10 znaků) si drží prohlížeč v `localStorage` (`pzClaudeCode`), „Nový kód" ho změní.
Každá mapa = Durable Object `MapRoom`; volání nástroje se pošle do prohlížeče, ten ho provede
přes `window.TNMAP` (stejné nástroje jako AI asistent) a vrátí výsledek. `snimek_mapy` vrací
JPEG exportního snímku, aby si Claude výsledek zkontroloval.

Nástroje se generují z popisu asistenta: `node tools/gen_mcp_tools.mjs` (po změně TOOLS v
`worker/tnmap-chat.built.js`), pak nasazení:

```bash
cd worker/tnmap-mcp && npx wrangler deploy
```

Bezplatný plán Workers (SQLite Durable Objects). AI se tu nevolá — model je Claude u uživatele.
