// Společné kousky pro Pages Functions TNmapy.

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Api-Token',
  'Access-Control-Max-Age': '86400'
};

export const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS, ...extra }
  });

export const preflight = () => new Response(null, { status: 204, headers: CORS });

// Token, který posílá index.html (SERVER_API_TOKEN). Je v prohlížeči vidět,
// takže to není ochrana proti útočníkovi — brání tomu, aby data přepsal
// požadavek, který z appky nepřišel.
const APP_TOKEN = 'cb33ba7ccfac453f960cccf692654bbd3f7cf79a7264460a';

/**
 * Zápis projde jen se správným tokenem. Když proměnná API_TOKEN chybí,
 * NEPOUŠTÍ se všechno — platí token z appky. Dřívější verze tu vracela true
 * a na náhledovém prostředí bez API_TOKEN tím jeden prázdný požadavek smazal
 * všechny projekty v ostré databázi (náhled a produkce sdílejí jednu D1).
 */
export function writeAllowed(request, env, body) {
  const given = request.headers.get('X-Api-Token') || (body && body.token) || '';
  if (!given) return false;
  return given === APP_TOKEN || (!!env.API_TOKEN && given === env.API_TOKEN);
}

export async function readJson(request) {
  try { return await request.json(); } catch { return {}; }
}
