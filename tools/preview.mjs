// Lokální náhled konsolidované verze proti živému backendu na tnmap.pages.dev.
// Statické soubory z repa, /api/* se proxuje na produkci (jen čtení).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const ROOT = '/home/user/PZ2DMAP';
const UP = 'https://tnmap.pages.dev';
const TYPES = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css',
  '.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.geojson':'application/json'};
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    try {
      const r = await fetch(UP + url.pathname + url.search, {headers:{'accept':'application/json'}});
      const buf = Buffer.from(await r.arrayBuffer());
      res.writeHead(r.status, {'content-type': r.headers.get('content-type') || 'application/json'});
      return res.end(buf);
    } catch (e) { res.writeHead(502); return res.end(JSON.stringify({ok:false,error:String(e)})); }
  }
  const p = url.pathname === '/' ? '/index.html' : url.pathname;
  try {
    const buf = await readFile(path.join(ROOT, decodeURIComponent(p)));
    res.writeHead(200, {'content-type': TYPES[path.extname(p)] || 'application/octet-stream'});
    res.end(buf);
  } catch { res.writeHead(404); res.end('nenalezeno'); }
}).listen(8788, () => console.log('náhled na http://localhost:8788'));
