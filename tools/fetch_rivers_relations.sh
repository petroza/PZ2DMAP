#!/bin/bash
# Hlavní řeky a kanály ČR podle jména — malý dotaz, Overpass ho zvládne i v zátěži.
Q='[out:json][timeout:300];(way["waterway"="river"]["name"~"^(Vltava|Labe|Morava|Ohře|Berounka|Sázava|Otava|Lužnice|Dyje|Odra|Svratka|Jihlava|Jizera|Orlice|Bečva|Opava|Ostravice|Malše|Svitava|Mže|Radbuza|Úhlava|Úslava|Cidlina|Chrudimka|Olše|Oslava|Doubrava|Ploučnice|Bílina|Tichá Orlice|Divoká Orlice|Elbe|Moldau|March|Thaya|Oder)$"](48.5,12.0,51.1,18.9);way["waterway"="canal"]["name"~"Baťův|Baťa"](48.5,12.0,51.1,18.9);relation["waterway"="river"]["name"~"^(Vltava|Labe|Morava|Ohře|Berounka|Sázava|Otava|Lužnice|Dyje|Odra|Svratka|Jihlava|Jizera|Orlice|Bečva|Opava|Ostravice|Malše|Svitava|Mže|Radbuza|Úhlava|Úslava|Cidlina|Chrudimka|Olše|Oslava|Doubrava|Ploučnice|Bílina|Tichá Orlice|Divoká Orlice)$"](48.5,12.0,51.1,18.9);way(r:"main_stream")(48.5,12.0,51.1,18.9);way(r:"")(48.5,12.0,51.1,18.9););way._["waterway"~"^(river|canal)$"];out geom qt;'
for try in 1 2 3 4 5 6; do
  for host in overpass-api.de overpass.kumi.systems maps.mail.ru/osm/tools/overpass; do
    curl -sS --max-time 400 -G --data-urlencode "data=$Q" "https://$host/api/interpreter" -o t_0_1.json 2>/dev/null
    if grep -q '"elements"' t_0_1.json 2>/dev/null && ! grep -q '"remark"' t_0_1.json; then echo "OK $(wc -c < t_0_1.json) B ($host)"; exit 0; fi
    echo "selhalo: $host ($(head -c 120 t_0_1.json 2>/dev/null | tr '\n' ' '))"; sleep 10
  done
done
echo SELHALO
