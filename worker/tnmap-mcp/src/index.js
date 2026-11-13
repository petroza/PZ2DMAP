// TN mapa — MCP konektor pro Claude.
//
// Claude (vlastní konektor, Streamable HTTP, bez přihlášení) volá nástroje mapy.
// Mapa běží v prohlížeči grafika; ten se připojí WebSocketem do „místnosti"
// (Durable Object) se svým kódem. Volání nástroje = zpráva do místnosti → prohlížeč
// ho provede přes window.TNMAP → výsledek se vrátí Claudovi.
//
//   https://tnmap-mcp.<subdoména>.workers.dev/mcp/<KÓD>   konektor napevno pro jednu mapu
//   https://tnmap-mcp.<subdoména>.workers.dev/mcp          společný konektor; mapu spojí
//                                                          nástroj pripojit_mapu {kod}
//   wss://…/ws/<KÓD>                                       prohlížeč s otevřenou mapou
import { MAP_TOOLS } from './tools.js';

const ALLOWED_ORIGIN = /^https:\/\/([a-z0-9-]+\.)?tnmap\.pages\.dev$|^http:\/\/localhost(:\d+)?$/;
const CODE = /^[A-Z2-9]{10}$/;
const normCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];

const INSTRUCTIONS = `Ovládáš TN mapu — webovou aplikaci TV Nova na mapovou grafiku do zpráv (trasy, uzavírky, vlajky, popisky, animace vozidel, export).
Mapa běží v prohlížeči grafika. Když nástroj vrátí, že mapa není připojená, popros grafika, ať v TN mapě otevře asistenta → „Claude" a pošle ti kód; pak zavolej pripojit_mapu.
Postup: splň celé zadání grafika — rozlož ho na kroky a volej nástroje postupně. Místa piš v 1. pádu česky. Po větších změnách zavolej snimek_mapy a zkontroluj výsledek očima; když něco nesedí, oprav to.
Kraje ČR barvit nejde, video ani projekty neuložíš (export videa je tlačítko v záložce Export).`;

const EXTRA_TOOLS = [
  {name: 'pripojit_mapu', description: 'Připojí tento rozhovor k otevřené TN mapě grafika. Kód (10 znaků) najde grafik v TN mapě: asistent → tlačítko Claude.', inputSchema: {type: 'object', properties: {kod: {type: 'string', description: 'Kód z TN mapy, např. K7F3-X9Q2-AB'}}, required: ['kod']}},
  {name: 'stav_mapy', description: 'Aktuální stav mapy: podklad, výřez, režim trasy a co je ve scéně (trasa, popisky, obarvené státy, vlajky…).', inputSchema: {type: 'object', properties: {}}},
  {name: 'snimek_mapy', description: 'Snímek mapy tak, jak vyjde v exportu (obrázek). Použij ke kontrole výsledku.', inputSchema: {type: 'object', properties: {sirka: {type: 'number', description: 'šířka v px, výchozí 1024'}}}},
];
const ALL_TOOLS = [...EXTRA_TOOLS, ...MAP_TOOLS];
const TOOL_NAMES = new Set(MAP_TOOLS.map(t => t.name));

const cors = origin => ({
  'Access-Control-Allow-Origin': origin && ALLOWED_ORIGIN.test(origin) ? origin : '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Mcp-Session-Id, Mcp-Protocol-Version, Authorization',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id',
});
const jsonRes = (obj, status = 200, headers = {}) => new Response(JSON.stringify(obj), {status, headers: {'Content-Type': 'application/json; charset=utf-8', ...headers}});
const rpcOk = (id, result) => ({jsonrpc: '2.0', id, result});
const rpcErr = (id, code, message) => ({jsonrpc: '2.0', id, error: {code, message}});
const textResult = (obj, isError) => ({content: [{type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj)}], ...(isError ? {isError: true} : {})});

// ---------------------------------------------------------------------------
// Místnost = jedna otevřená mapa. Drží WebSocket(y) prohlížeče a čekající volání.
export class MapRoom {
  constructor(state, env){ this.state = state; this.env = env; this.pending = new Map(); this.seq = 0; }
  async fetch(request){
    const url = new URL(request.url);
    if(url.pathname === '/ws'){
      if(request.headers.get('Upgrade') !== 'websocket') return new Response('WebSocket only', {status: 426});
      const pair = new WebSocketPair();
      // novější okno s mapou má přednost — starší spojení zavřít
      for(const old of this.state.getWebSockets()){ try{ old.close(4000, 'Mapa otevřená jinde'); }catch(e){} }
      this.state.acceptWebSocket(pair[1]);
      pair[1].send(JSON.stringify({type: 'hello'}));
      return new Response(null, {status: 101, webSocket: pair[0]});
    }
    if(url.pathname === '/status') return jsonRes({connected: this.state.getWebSockets().length > 0});
    if(url.pathname === '/call'){
      const {tool, args} = await request.json();
      const ws = this.state.getWebSockets()[0];
      if(!ws) return jsonRes({ok: false, notConnected: true, error: 'Mapa není připojená — v TN mapě otevři asistenta a klikni na Claude.'});
      const id = ++this.seq + '-' + Date.now();
      const timeoutMs = tool === '__capture' ? 60000 : 90000;
      const result = await new Promise(resolve => {
        const timer = setTimeout(() => { this.pending.delete(id); resolve({ok: false, error: 'Mapa neodpověděla včas (' + timeoutMs / 1000 + ' s).'}); }, timeoutMs);
        this.pending.set(id, r => { clearTimeout(timer); resolve(r); });
        try{ ws.send(JSON.stringify({type: 'call', id, tool, args: args || {}})); }
        catch(e){ clearTimeout(timer); this.pending.delete(id); resolve({ok: false, error: 'Spojení s mapou spadlo.'}); }
      });
      return jsonRes(result);
    }
    return new Response('Not found', {status: 404});
  }
  webSocketMessage(ws, msg){
    let m; try{ m = JSON.parse(typeof msg === 'string' ? msg : new TextDecoder().decode(msg)); }catch(e){ return; }
    if(m.type === 'ping'){ try{ ws.send('{"type":"pong"}'); }catch(e){} return; }
    if(m.type === 'result' && this.pending.has(m.id)){ const f = this.pending.get(m.id); this.pending.delete(m.id); f(m.result || {ok: true}); }
  }
  webSocketClose(){ /* čekající volání doběhnou na časový limit */ }
}

// Sezení společného konektoru (/mcp): Mcp-Session-Id → kód mapy.
export class Sessions {
  constructor(state){ this.state = state; }
  async fetch(request){
    const url = new URL(request.url), sid = url.searchParams.get('sid');
    if(request.method === 'PUT'){ await this.state.storage.put(sid, {code: url.searchParams.get('code'), t: Date.now()}); return new Response('ok'); }
    const v = await this.state.storage.get(sid);
    return jsonRes({code: v?.code || null});
  }
}

async function roomCall(env, code, tool, args){
  const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
  const r = await stub.fetch('https://room/call', {method: 'POST', body: JSON.stringify({tool, args})});
  return r.json();
}
async function sessionCode(env, sid){
  if(!sid) return null;
  const stub = env.SESSIONS.get(env.SESSIONS.idFromName('all'));
  return (await (await stub.fetch('https://s/get?sid=' + encodeURIComponent(sid))).json()).code;
}
async function setSessionCode(env, sid, code){
  const stub = env.SESSIONS.get(env.SESSIONS.idFromName('all'));
  await stub.fetch('https://s/put?sid=' + encodeURIComponent(sid) + '&code=' + code, {method: 'PUT'});
}

async function callTool(env, code, sid, name, args){
  if(name === 'pripojit_mapu'){
    const c = normCode(args.kod);
    if(!CODE.test(c)) return textResult('Kód má 10 znaků (písmena a číslice), např. K7F3-X9Q2-AB. Najdeš ho v TN mapě: asistent → Claude.', true);
    const st = await (await env.ROOMS.get(env.ROOMS.idFromName(c)).fetch('https://room/status')).json();
    if(!st.connected) return textResult('Mapa s kódem ' + c + ' teď není otevřená. Grafik ji musí mít otevřenou v prohlížeči (asistent → Claude).', true);
    if(sid) await setSessionCode(env, sid, c);
    else return textResult('Připojeno, ale tento klient nepodporuje sezení — použij konektor s kódem v adrese: /mcp/' + c, true);
    return textResult({ok: true, connected: c, note: 'Mapa připojena. Nejdřív se podívej na stav_mapy.'});
  }
  if(!code) code = await sessionCode(env, sid);
  if(!code) return textResult('Mapa zatím není připojená. Požádej grafika o kód z TN mapy (asistent → Claude) a zavolej pripojit_mapu.', true);
  if(name === 'stav_mapy'){ const r = await roomCall(env, code, '__state', {}); return textResult(r, r.ok === false); }
  if(name === 'snimek_mapy'){
    const r = await roomCall(env, code, '__capture', {width: Math.max(320, Math.min(1600, +args.sirka || 1024))});
    if(!r.ok || !r.data) return textResult(r, true);
    return {content: [{type: 'image', data: r.data, mimeType: r.mimeType || 'image/jpeg'}, {type: 'text', text: 'Snímek ' + (r.width || '') + '×' + (r.height || '') + ' px.'}]};
  }
  if(!TOOL_NAMES.has(name)) return textResult('Neznámý nástroj ' + name, true);
  const r = await roomCall(env, code, name, args || {});
  return textResult(r, r && r.ok === false);
}

async function handleRpc(env, code, sid, msg){
  const {id, method, params} = msg || {};
  if(method === 'initialize'){
    const want = params?.protocolVersion;
    return rpcOk(id, {protocolVersion: PROTOCOLS.includes(want) ? want : PROTOCOLS[0],
      capabilities: {tools: {listChanged: false}}, serverInfo: {name: 'tn-mapa', title: 'TN mapa', version: '1.0.0'}, instructions: INSTRUCTIONS});
  }
  if(method === 'ping') return rpcOk(id, {});
  if(method === 'tools/list') return rpcOk(id, {tools: code ? ALL_TOOLS.filter(t => t.name !== 'pripojit_mapu') : ALL_TOOLS});
  if(method === 'tools/call'){
    try{ return rpcOk(id, await callTool(env, code, sid, params?.name, params?.arguments || {})); }
    catch(e){ return rpcOk(id, textResult('Chyba: ' + String(e && e.message || e).slice(0, 200), true)); }
  }
  if(method === 'resources/list') return rpcOk(id, {resources: []});
  if(method === 'prompts/list') return rpcOk(id, {prompts: []});
  if(id === undefined) return null;   // notifikace
  return rpcErr(id, -32601, 'Metoda ' + method + ' není podporovaná.');
}

export default {
  async fetch(request, env){
    const url = new URL(request.url), origin = request.headers.get('Origin') || '';
    if(request.method === 'OPTIONS') return new Response(null, {status: 204, headers: cors(origin)});
    const parts = url.pathname.split('/').filter(Boolean);

    // prohlížeč s mapou
    if(parts[0] === 'ws'){
      const code = normCode(parts[1]);
      if(!CODE.test(code)) return new Response('Bad code', {status: 400});
      if(origin && !ALLOWED_ORIGIN.test(origin)) return new Response('Forbidden', {status: 403});
      return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(new Request('https://room/ws', request));
    }

    if(parts[0] === 'mcp'){
      const code = parts[1] ? normCode(parts[1]) : null;
      if(code && !CODE.test(code)) return jsonRes(rpcErr(null, -32600, 'Neplatný kód v adrese konektoru.'), 400, cors(origin));
      if(request.method === 'GET') return new Response('Použij POST (Streamable HTTP).', {status: 405, headers: {Allow: 'POST', ...cors(origin)}});
      if(request.method === 'DELETE') return new Response(null, {status: 204, headers: cors(origin)});
      if(request.method !== 'POST') return new Response('Method not allowed', {status: 405, headers: cors(origin)});
      let body; try{ body = await request.json(); }catch(e){ return jsonRes(rpcErr(null, -32700, 'Neplatný JSON.'), 400, cors(origin)); }
      let sid = request.headers.get('Mcp-Session-Id');
      const batch = Array.isArray(body) ? body : [body];
      const headers = {...cors(origin)};
      if(batch.some(m => m && m.method === 'initialize')){ sid = crypto.randomUUID(); headers['Mcp-Session-Id'] = sid; }
      const out = (await Promise.all(batch.map(m => handleRpc(env, code, sid, m)))).filter(Boolean);
      if(!out.length) return new Response(null, {status: 202, headers});
      return jsonRes(Array.isArray(body) ? out : out[0], 200, headers);
    }

    if(url.pathname === '/' || url.pathname === '') return jsonRes({ok: true, service: 'tn-mapa MCP', mcp: url.origin + '/mcp', tools: ALL_TOOLS.length});
    return new Response('Not found', {status: 404});
  }
};
