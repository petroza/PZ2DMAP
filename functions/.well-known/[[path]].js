// Konektor pro Claude (MCP) je bez přihlášení. Claude se při přidání konektoru ptá
// na /.well-known/oauth-* — bez této funkce by Pages vrátily úvodní stránku (HTML)
// s kódem 200 a Claude by konektor odmítl jako chybně nastavený.
export function onRequest(){
  return new Response(JSON.stringify({error: 'not_found'}), {status: 404, headers: {'Content-Type': 'application/json'}});
}
