#!/usr/bin/env python3
"""Linky PID (metro, tramvaje, autobusy, vlaky S, trolejbusy, přívozy, lanovka)
pro „Trasu podle linky“ — z otevřených dat PID (GTFS, CC BY 4.0, data.pid.cz).

Pro každou linku a směr vezme nejčastější tvar trasy (shape) z jízd, zjednoduší
ho (Douglas–Peucker ~4 m), přidá zastávky v pořadí a barvu linky.

Použití:  python3 tools/build_pid.py PID_GTFS.zip assets/pid_lines.json
"""
import csv, io, json, math, sys, zipfile
from collections import Counter, defaultdict

src, dst = sys.argv[1], sys.argv[2]
z = zipfile.ZipFile(src)
def rows(name):
    with z.open(name) as f:
        yield from csv.DictReader(io.TextIOWrapper(f, encoding='utf-8-sig'))

TYPES = {'0': 'tram', '1': 'metro', '2': 'vlak', '3': 'bus', '4': 'privoz', '7': 'lanovka', '11': 'trolejbus'}
routes = {}
for r in rows('routes.txt'):
    t = TYPES.get(r['route_type'])
    if not t or not r['route_short_name']: continue
    routes[r['route_id']] = {'n': r['route_short_name'], 't': t, 'c': '#' + (r.get('route_color') or '888888'),
                             'name': r.get('route_long_name', '')}

shape_count = defaultdict(Counter)
for t in rows('trips.txt'):
    if t['route_id'] in routes and t.get('shape_id'):
        shape_count[(t['route_id'], t.get('direction_id') or '0')][t['shape_id']] += 1
best = {k: c.most_common(1)[0][0] for k, c in shape_count.items()}
need = set(best.values())

shapes = defaultdict(list)
for s in rows('shapes.txt'):
    if s['shape_id'] in need:
        shapes[s['shape_id']].append((int(s['shape_pt_sequence']), float(s['shape_pt_lon']), float(s['shape_pt_lat'])))

def dp(pts, tol):
    if len(pts) < 3: return pts
    kx = math.cos(math.radians(pts[0][1]))
    keep = [False] * len(pts); keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = pts[a][0] * kx, pts[a][1]; bx, by = pts[b][0] * kx, pts[b][1]
        dx, dy = bx - ax, by - ay; L = math.hypot(dx, dy) or 1e-12
        idx, dmax = -1, 0
        for i in range(a + 1, b):
            px, py = pts[i][0] * kx, pts[i][1]
            d = abs(dy * px - dx * py + bx * ay - by * ax) / L
            if d > dmax: idx, dmax = i, d
        if dmax * 111320 > tol and idx > 0:
            keep[idx] = True; stack += [(a, idx), (idx, b)]
    return [p for p, k in zip(pts, keep) if k]

stops = {s['stop_id']: (s['stop_name'], float(s['stop_lon']), float(s['stop_lat'])) for s in rows('stops.txt') if s.get('stop_lat')}
route_stops = defaultdict(list)
for rs in rows('route_stops.txt'):
    k = (rs['route_id'], rs.get('direction_id') or '0')
    if k in best and rs['stop_id'] in stops: route_stops[k].append((int(rs['stop_sequence']), rs['stop_id']))

Q = 1e5
out = []
for (rid, d), sid in sorted(best.items(), key=lambda kv: (routes[kv[0][0]]['t'], routes[kv[0][0]]['n'], kv[0][1])):
    pts = [(lon, lat) for _, lon, lat in sorted(shapes.get(sid, []))]
    if len(pts) < 2: continue
    pts = dp(pts, 4)
    flat = []; px = py = 0
    for lon, lat in pts:   # delta kódování
        x, y = round(lon * Q), round(lat * Q); flat += [x - px, y - py]; px, py = x, y
    st = []
    for _, s_id in sorted(route_stops.get((rid, d), [])):
        name, lon, lat = stops[s_id]
        if st and st[-1][0] == name: continue
        st.append([name, round(lon * Q), round(lat * Q)])
    r = routes[rid]
    out.append({'n': r['n'], 't': r['t'], 'c': r['c'], 'd': int(d), 'g': flat, 's': st})

json.dump({'src': 'PID GTFS (data.pid.cz, CC BY 4.0)', 'q': Q, 'lines': out}, open(dst, 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(out), 'linek/směrů', Counter(l['t'] for l in out))
