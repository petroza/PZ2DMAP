#!/bin/bash
# eval.sh <endpoint>  — prožene regresní sadu z reálného logu
U="$1"
S='"mapState":{"center":{"lng":14.44,"lat":50.08},"zoom":7,"baseStyle":"satellite","globe":true,"transportMode":"driving","tab":"styly","hasRoute":false}'
QS=(
 "ukaž Brno - Komín a přehradu"
 "ukaz brno - komín a přehradu"
 "kolik je to vzdušnou linkou z Prahy do Kyjeva"
 "zapni na tom hranice států"
 "dej šipku z Prahy na Brno"
 "zapni radar srážek"
 "přidej popisek Letňany na mapu"
 "vyznač Středočeský kraj červeně"
 "změř vzdálenost z Prahy do Brna"
 "vypni budovy"
 "ukaž mi perimetr 2000 metrů od Moskvy na glóbusu"
 "jake mas nastroje"
)
for q in "${QS[@]}"; do
  r=$(curl -sS --max-time 90 -X POST -H "Content-Type: application/json" -H "Origin: https://www.appcreate.cloud" \
      -d "{\"messages\":[{\"role\":\"user\",\"content\":\"$q\"}],$S}" "$U")
  echo "── $q"
  echo "$r" | python3 -c "
import sys,json
try: d=json.load(sys.stdin)
except Exception as e: print('   ✗ nevalidní odpověď:',e); raise SystemExit
t=[c['tool'] for c in d.get('calls') or []]
print(('   ✗ MISS' if not t else '   ✓'),'| done:',d.get('done'))
print('   say:',d.get('say'))
for c in d.get('calls') or []: print('    ',c['tool'],json.dumps(c.get('args'),ensure_ascii=False))
"
done
