// Konektor TN mapy pro Claude na adrese aplikace: https://tnmap.pages.dev/mcp[/KÓD]
// Jen přeposílá na worker tnmap-mcp (Durable Objects drží spojení s mapou).
const UPSTREAM = 'https://tnmap-mcp.petrzavorka.workers.dev';
export async function onRequest({request}){
  const url = new URL(request.url);
  const target = UPSTREAM + url.pathname + url.search;
  const init = {method: request.method, headers: request.headers, redirect: 'manual'};
  if(!['GET', 'HEAD'].includes(request.method)) init.body = await request.arrayBuffer();
  const r = await fetch(target, init);
  return new Response(r.body, {status: r.status, headers: r.headers});
}
