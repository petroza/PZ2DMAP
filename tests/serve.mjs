// Místní server pro testy: statické soubory z kořene repozitáře, /api/* se
// přeposílá na ostrou appku JEN pro čtení (GET). Zápisy (POST) se nikam
// nepouštějí — náhled i produkce sdílejí jednu databázi D1.
//   node tests/serve.mjs [port]        (výchozí 8788)
//   API_UPSTREAM=https://tnmap.pages.dev
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UP = process.env.API_UPSTREAM || 'https://tnmap.pages.dev';
const PORT = Number(process.argv[2] || process.env.PORT || 8788);
const TYPES = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css',
  '.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.geojson':'application/json','.glb':'model/gltf-binary'};

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    if (req.method !== 'GET') { res.writeHead(200, {'content-type':'application/json'}); return res.end('{"ok":true,"testServer":true}'); }
    try {
      const r = await fetch(UP + url.pathname + url.search, {headers:{accept:'application/json'}});
      res.writeHead(r.status, {'content-type': r.headers.get('content-type') || 'application/json'});
      return res.end(Buffer.from(await r.arrayBuffer()));
    } catch (e) { res.writeHead(502); return res.end(JSON.stringify({ok:false, error:String(e)})); }
  }
  const rel = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const file = path.join(ROOT, rel);
  // skryté složky se kontrolují jen v cestě uvnitř repozitáře — kopie repozitáře
  // může sama ležet ve složce .claude/worktrees/…
  if (!file.startsWith(ROOT) || /[\\/]\.(git|claude)[\\/]/.test(path.sep + path.relative(ROOT, file))) { res.writeHead(403); return res.end(); }
  try {
    const buf = await readFile(file);
    res.writeHead(200, {'content-type': TYPES[path.extname(file)] || 'application/octet-stream'});
    res.end(buf);
  } catch { res.writeHead(404); res.end('not found'); }
}).listen(PORT, () => console.log(`tests/serve.mjs: http://localhost:${PORT}/ (API jen čtení z ${UP})`));
