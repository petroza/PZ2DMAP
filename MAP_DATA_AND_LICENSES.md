# Map data and third-party licensing

This repository contains application code. It does not grant rights to third-party map tiles, vector styles, routing services, geocoding services, satellite imagery or geographic datasets used by the application.

The app may reference or use several external providers, for example:

- OpenStreetMap and OSM-derived data
- OpenFreeMap vector map styles
- CARTO basemaps
- Esri / ArcGIS imagery and terrain services
- OpenTopoMap
- CyclOSM
- Humanitarian OpenStreetMap Team tiles
- Nominatim geocoding and reverse geocoding
- OpenStreetMap routing demo servers
- EU GISCO country boundaries
- Natural Earth datasets
- CDN-hosted JavaScript libraries such as MapLibre GL JS, JSZip and mp4-muxer

Before publishing, broadcasting, exporting, redistributing or using the map commercially, review the current terms for every enabled provider. Pay attention to:

- required attribution text and logo placement
- export/screenshot/video usage permissions
- commercial/broadcast usage restrictions
- request limits and caching rules
- whether public demo endpoints may be used in production
- data redistribution rules
- required notices for modified or derived data

Recommended production practice:

1. Keep attribution visible in the UI and exported outputs where required.
2. Replace public demo endpoints with approved production endpoints.
3. Document the exact providers enabled in a deployment.
4. Keep API keys and provider credentials outside Git.
5. Re-check provider terms before each public release, because terms can change.

## Bundled OpenStreetMap extracts

Two datasets ship with the app instead of being fetched at runtime, because the
vector basemap tiles only carry transit geometry from zoom 14 up and do not
distinguish individual lines — at the country-wide framing a news graphic uses,
the networks would simply vanish.

| file | contents | source |
|---|---|---|
| inlined in `index.html` | Prague metro lines A/B/C and stops | OpenStreetMap via Overpass |
| `assets/mhd_cz_tram.json` | tram networks of Praha, Brno, Ostrava, Plzeň, Olomouc, Liberec and Most–Litvínov | OpenStreetMap via Overpass |
| `assets/water_cz.json` | major Czech rivers and Baťův kanál as a routing graph (boat mode) | OpenStreetMap via Overpass (`tools/fetch_rivers.sh`), built by `tools/build_rail.py` |
| `assets/rail_cz.json` | Czech standard-gauge rail network as a routing graph (train mode) | OpenStreetMap via Overpass, built by `tools/build_rail.py` |

Both are **© OpenStreetMap contributors, ODbL**. Geometry is simplified to about
6 m, which is under one pixel at the zooms these exist for; coordinates are
rounded to five decimal places. Simplification makes these *derived databases*
under ODbL, so the attribution above has to travel with them — it is shown in
the map's attribution control and belongs on exported graphics too.

`assets/mhd_cz_tram.json` is fetched once, the first time the MHD layer is
switched on, rather than on every start. `assets/rail_cz.json` (~240 kB gzip)
is fetched the first time a train route is searched.

The rail graph drops industrial, military, test and heritage lines and narrow
gauge, heals mapping gaps up to 600 m and treats parallel tracks closer than
35 m as one line, so a route never makes a U-turn on a double-track line.
Rebuild: download `way[railway=rail]` tiles with `out geom`, then
`python3 tools/build_rail.py <tile-dir> assets/rail_cz.json`.

The MIT license for this repository applies only to the application wrapper code unless a file states otherwise. All third-party services, datasets and libraries remain under their own licenses and terms.
