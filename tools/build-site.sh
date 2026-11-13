#!/usr/bin/env bash
# Složí dist/ pro Cloudflare Pages: statické soubory + functions/.
# Do nasazení patří jen to, co má být veřejné — ne .git, ne dokumentace,
# ne PHP (nahradily ho Functions) a ne zálohy dat z map_data/.
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf dist
mkdir -p dist

cp index.html dist/
cp -r assets dist/
cp -r functions dist/
# presets.json / projects.json se už nenasazují: appka je nečte a ve veřejném
# webu by byl k stažení starý projekt. Zálohy dat jsou v map_data/.

echo "dist/ hotovo: $(du -sh dist | cut -f1)"
find dist -maxdepth 2 -mindepth 1 -type d -printf '  %P/\n' | sort
echo "  index.html ($(du -h dist/index.html | cut -f1))"
