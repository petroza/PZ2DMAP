#!/bin/bash
Q='[out:json][timeout:200];(way["waterway"="river"]["name"~"Dyje|Thaya|Morava|March|Svratka|Jihlava|Svitava|Oslava|Opava|Odra|Oder|Olše|Olza|Ostravice"](48.4,15.3,50.2,18.9););out geom qt;'
for try in 1 2 3 4 5 6 7 8; do
  for host in overpass.kumi.systems maps.mail.ru/osm/tools/overpass overpass-api.de; do
    curl -sS --max-time 300 -G --data-urlencode "data=$Q" "https://$host/api/interpreter" -o t_0_2.tmp 2>/dev/null
    if grep -q '"elements"' t_0_2.tmp 2>/dev/null && ! grep -q '"remark"' t_0_2.tmp; then mv t_0_2.tmp t_0_2.json; echo "OK $host $(wc -c < t_0_2.json)"; exit 0; fi
    sleep 20
  done
done
echo SELHALO
