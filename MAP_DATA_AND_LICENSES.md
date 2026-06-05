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

The MIT license for this repository applies only to the application wrapper code unless a file states otherwise. All third-party services, datasets and libraries remain under their own licenses and terms.
