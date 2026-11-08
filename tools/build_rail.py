"""Železniční graf ČR z OSM dlaždic (Overpass `out geom`) → kompaktní JSON pro prohlížeč.

Výstup: {"v":1,"q":1e5,"n":[lon,lat,...] (int), "e":[[a,b,len_m,[dlon,dlat,...]],...]}
  n  … uzly grafu (výhybky/konce) v 1e-5 °,
  e  … hrany mezi nimi; geometrie bez krajních bodů, delta-kódovaná od uzlu a.
"""
import json, sys, glob, math
from collections import Counter
from collections import defaultdict

src_dir, out_path = sys.argv[1], sys.argv[2]   # [3] = volitelně stanice (Overpass railway=station|halt)
TOL_M = 18.0            # Douglas-Peucker — pod pixel na regionálním zoomu
MIN_COMPONENT_KM = 12   # ostrůvky (vlečky, muzejní tratě) pryč

ways = {}
for f in sorted(glob.glob(src_dir + '/t_*_*.json')):
    try: d = json.load(open(f))
    except Exception: continue
    for w in d.get('elements', []):
        if w.get('type') != 'way' or 'geometry' not in w: continue
        if w.get('tags', {}).get('usage') in ('industrial', 'military', 'test', 'tourism'): continue
        if w.get('tags', {}).get('gauge') not in (None, '1435'): continue
        ways[w['id']] = w
print('cest', len(ways), file=sys.stderr)

BRANCH_FACTOR = 1.6     # vedlejší tratě: router dá přednost hlavní trati
seg_f = {}
coord = {}
use = defaultdict(int)
for w in ways.values():
    for nid, g in zip(w['nodes'], w['geometry']):
        coord[nid] = (g['lon'], g['lat'])
    f = BRANCH_FACTOR if w.get('tags', {}).get('usage') == 'branch' else 1.0
    for i in range(1, len(w['nodes'])):
        seg_f[(w['nodes'][i-1], w['nodes'][i])] = seg_f[(w['nodes'][i], w['nodes'][i-1])] = f
    for i, nid in enumerate(w['nodes']):
        use[nid] += 1 if i in (0, len(w['nodes']) - 1) else 2
def hav(a, b):
    R = 6371000.0
    la1, la2 = math.radians(a[1]), math.radians(b[1])
    dla, dlo = la2 - la1, math.radians(b[0] - a[0])
    h = math.sin(dla/2)**2 + math.cos(la1)*math.cos(la2)*math.sin(dlo/2)**2
    return 2 * R * math.asin(min(1, math.sqrt(h)))

# --- Hojení mezer: v OSM chybí kousky kolejí (odfiltrované spojky, rozdělené
# cesty bez společného uzlu), trať pak „končí" pár set metrů před pokračováním.
# Slepý konec napojíme na nejbližší kolej PŘED sebou (≤ 600 m, odchylka ≤ 35°).
GAP_M, GAP_DEG = 600.0, 35.0
_sid = [0]
def new_id():
    _sid[0] -= 1; return _sid[0]
cell = 0.01
grid = defaultdict(list)
node_way = {}
for wid, w in ways.items():
    for nid in w['nodes']:
        node_way.setdefault(nid, set()).add(wid)
        c = coord[nid]; grid[(int(c[0] / cell), int(c[1] / cell))].append(nid)
healed = 0
for wid, w in list(ways.items()):
    ns = w['nodes']
    for end, back in ((ns[-1], ns[-2::-1]), (ns[0], ns[1:])):
        if use[end] != 1: continue                                    # není slepý konec
        p = coord[end]; q = None
        for nb in back:                                               # směr z ~80 m zpět
            q = coord[nb]
            if hav(p, q) >= 80: break
        if q is None: continue
        kx = math.cos(math.radians(p[1]))
        dx, dy = (p[0] - q[0]) * kx, p[1] - q[1]; dl = math.hypot(dx, dy) or 1
        gx, gy = int(p[0] / cell), int(p[1] / cell)
        best = None
        for ix in range(gx - 1, gx + 2):
            for iy in range(gy - 1, gy + 2):
                for cand in grid.get((ix, iy), ()):
                    if wid in node_way[cand]: continue
                    c = coord[cand]; dist = hav(p, c)
                    if dist > GAP_M or (best and dist >= best[0]): continue
                    ex, ey = (c[0] - p[0]) * kx, c[1] - p[1]; el = math.hypot(ex, ey) or 1
                    if dist > 25:
                        cosang = (dx * ex + dy * ey) / (dl * el)
                        if cosang < math.cos(math.radians(GAP_DEG)): continue
                    best = (dist, cand)
        if best:
            sid = new_id()
            ways[sid] = {'id': sid, 'nodes': [end, best[1]], 'geometry': [{'lon': p[0], 'lat': p[1]}, {'lon': coord[best[1]][0], 'lat': coord[best[1]][1]}], 'tags': {}}
            use[end] += 1; use[best[1]] += 1; healed += 1
            node_way[end].add(sid); node_way[best[1]].add(sid)
print('zahojeno mezer', healed, file=sys.stderr)
# --- Propojení souběžných kolejí: dvoukolejka je v OSM jako dvě samostatné
# cesty a spojky (service=crossover) jsme odfiltrovali — router by pak na
# „špatné" koleji dojel na konec a otočil se. Každý konec cesty propojíme
# s nejbližším uzlem jiné cesty do 35 m.
LINK_M = 35.0
linked = 0
for wid, w in list(ways.items()):
    if wid < 0: continue
    for end in (w['nodes'][0], w['nodes'][-1]):
        p = coord[end]; gx, gy = int(p[0] / cell), int(p[1] / cell)
        best = None
        for ix in range(gx - 1, gx + 2):
            for iy in range(gy - 1, gy + 2):
                for cand in grid.get((ix, iy), ()):
                    if cand == end or (node_way[cand] & node_way[end]): continue
                    dist = hav(p, coord[cand])
                    if dist <= LINK_M and (not best or dist < best[0]): best = (dist, cand)
        if best:
            sid = new_id()
            c = coord[best[1]]
            ways[sid] = {'id': sid, 'nodes': [end, best[1]], 'geometry': [{'lon': p[0], 'lat': p[1]}, {'lon': c[0], 'lat': c[1]}], 'tags': {'_link': 1}}
            use[end] += 1; use[best[1]] += 1; linked += 1
            node_way[end].add(sid); node_way[best[1]].add(sid)
print('propojeno kolejí', linked, file=sys.stderr)
junction = {nid for nid, c in use.items() if c != 2}
for w in ways.values():
    junction.add(w['nodes'][0]); junction.add(w['nodes'][-1])

_lk=[w for k,w in ways.items() if k<0]
print('linků', len(_lk), 'oba konce junction', sum(1 for w in _lk if w['nodes'][0] in junction and w['nodes'][1] in junction), 'use konců', sorted(Counter(use[w['nodes'][0]] for w in _lk).items())[:5], file=sys.stderr)
# hrany junction→junction
edges = []
for w in ways.values():
    ns = w['nodes']; start = 0
    for i in range(1, len(ns)):
        if ns[i] in junction:
            seg = ns[start:i+1]
            if len(seg) >= 2 and seg[0] != seg[-1]: edges.append(seg)
            start = i

# --- Smrštění propojek: konce spojené propojkou (≤ 35 m) jsou jeden uzel.
# Dvoukolejka se tím v grafu chová jako jedna trať a uzlů je zlomek.
rep_of = {}
def root(x):
    while rep_of.get(x, x) != x:
        rep_of[x] = rep_of.get(rep_of[x], rep_of[x]); x = rep_of[x]
    return x
for w in ways.values():
    if w.get('tags', {}).get('_link'):
        a, b = root(w['nodes'][0]), root(w['nodes'][1])
        if a != b: rep_of[a] = b
best_edge = {}
for e in edges:
    a, b = root(e[0]), root(e[-1])
    if a == b: continue
    L = sum(hav(coord[e[i]], coord[e[i+1]]) * seg_f.get((e[i], e[i+1]), 1.0) for i in range(len(e)-1))
    key = (a, b) if a < b else (b, a)
    seq = [a] + e[1:-1] + [b]
    if key not in best_edge or L < best_edge[key][0]: best_edge[key] = (L, seq)
edges = [v[1] for v in best_edge.values()]
print('po smrštění hran', len(edges), file=sys.stderr)
# slučování přes uzly stupně 2 (vzniklé odfiltrováním cest)
adj = defaultdict(list)
for k, e in enumerate(edges):
    adj[e[0]].append(k); adj[e[-1]].append(k)
alive = [True] * len(edges)
for nid in list(adj):
    ks = [k for k in adj[nid] if alive[k]]
    if len(ks) != 2 or ks[0] == ks[1]: continue
    a, b = edges[ks[0]], edges[ks[1]]
    if a[-1] != nid: a = a[::-1]
    if b[0] != nid: b = b[::-1]
    if a[0] == b[-1]: continue
    merged = a + b[1:]
    alive[ks[0]] = alive[ks[1]] = False
    edges.append(merged); alive.append(True); k = len(edges) - 1
    for end in (merged[0], merged[-1]):
        adj[end] = [x for x in adj[end] if alive[x]] + [k]
    adj[nid] = []
edges = [e for k, e in enumerate(edges) if alive[k]]
deg = defaultdict(int)
for e in edges: deg[e[0]] += 1; deg[e[-1]] += 1
from collections import Counter
print('hran', len(edges), 'stupně uzlů', sorted(Counter(deg.values()).items())[:6], file=sys.stderr)

# komponenty
par = {}
def find(x):
    while par.get(x, x) != x:
        par[x] = par.get(par[x], par[x]); x = par[x]
    return x
for e in edges:
    ra, rb = find(e[0]), find(e[-1])
    if ra != rb: par[ra] = rb
comp_len = defaultdict(float)
elen = []; ecost = []
for e in edges:
    L = sum(hav(coord[e[i]], coord[e[i+1]]) for i in range(len(e)-1))
    C = sum(hav(coord[e[i]], coord[e[i+1]]) * seg_f.get((e[i], e[i+1]), 1.0) for i in range(len(e)-1))
    elen.append(L); ecost.append(C); comp_len[find(e[0])] += L
keep = [i for i, e in enumerate(edges) if comp_len[find(e[0])] >= MIN_COMPONENT_KM * 1000]
print('hran', len(edges), '→', len(keep), '| km', round(sum(elen[i] for i in keep)/1000), file=sys.stderr)

def dp(pts, tol):
    if len(pts) < 3: return pts
    lat0 = math.radians(pts[0][1]); kx = 111320 * math.cos(lat0); ky = 110540
    P = [((p[0]) * kx, p[1] * ky) for p in pts]
    keepf = [False] * len(P); keepf[0] = keepf[-1] = True
    stack = [(0, len(P) - 1)]
    while stack:
        i, j = stack.pop()
        ax, ay = P[i]; bx, by = P[j]; dx, dy = bx - ax, by - ay; L2 = dx*dx + dy*dy
        best, bi = -1, -1
        for k in range(i + 1, j):
            px, py = P[k]
            if L2 == 0: d = math.hypot(px - ax, py - ay)
            else:
                t = max(0, min(1, ((px-ax)*dx + (py-ay)*dy) / L2))
                d = math.hypot(px - ax - t*dx, py - ay - t*dy)
            if d > best: best, bi = d, k
        if best > tol:
            keepf[bi] = True; stack += [(i, bi), (bi, j)]
    return [p for p, f in zip(pts, keepf) if f]

q = lambda v: int(round(v * 1e5))
node_idx = {}; nodes = []
def nidx(nid):
    if nid not in node_idx:
        node_idx[nid] = len(nodes) // 2
        c = coord[nid]; nodes.extend([q(c[0]), q(c[1])])
    return node_idx[nid]
out_e = []; npts = 0
for i in keep:
    e = edges[i]
    pts = dp([coord[n] for n in e], TOL_M)
    a, b = nidx(e[0]), nidx(e[-1])
    flat = []; px, py = q(coord[e[0]][0]), q(coord[e[0]][1])
    for p in pts[1:-1]:
        x, y = q(p[0]), q(p[1]); flat += [x - px, y - py]; px, py = x, y
    npts += len(pts)
    k = round(ecost[i] / elen[i], 2) if elen[i] > 0 else 1
    out_e.append([a, b, int(round(elen[i])), flat] + ([k] if k != 1 else []))
stations = []
if len(sys.argv) > 3:
    for el in json.load(open(sys.argv[3])).get('elements', []):
        t = el.get('tags', {}); nm = t.get('name')
        if not nm or 'lat' not in el: continue
        stations.append([q(el['lon']), q(el['lat']), nm, 1 if t.get('railway') == 'station' else 0])
    print('stanic', len(stations), file=sys.stderr)
json.dump({'v': 1, 'q': 1e5, 'n': nodes, 'e': out_e, 's': stations,
           'attribution': '© OpenStreetMap contributors, ODbL'}, open(out_path, 'w'), separators=(',', ':'))
import os
print('uzlů', len(nodes)//2, 'hran', len(out_e), 'bodů', npts, 'velikost', os.path.getsize(out_path), file=sys.stderr)
