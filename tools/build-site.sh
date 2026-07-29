#!/usr/bin/env bash
# Složí dist/ pro Workers Assets. Do nasazení patří jen to, co má být veřejné —
# ne .git, ne PHP (nahradil ho Worker), ne dokumentace a ne screenshoty.
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf dist
mkdir -p dist

cp index.html dist/
cp -r assets dist/

# presets.json a projects.json jsou výchozí (builtin) data, která si front-end
# načítá jako fallback, když server nic nemá. Uživatelská data žijí v R2.
cp presets.json projects.json dist/ 2>/dev/null || true

# map_data/ se nekopíruje schválně: na Forpsi to bylo úložiště, které
# .htaccess skrýval před webem. Tady ta data drží R2 a veřejná nejsou vůbec.

echo "dist/ hotovo:"
du -sh dist
find dist -maxdepth 1 -mindepth 1 -printf '  %f\n' | sort
