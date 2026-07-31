// Výstrahy ČHMÚ (náhrada chmi_vystrahy.php) — Pages Function.
//
// Workers nemají SimpleXML ani DOMParser, takže CAP se parsuje ručně. Logika
// i výstupní JSON drží původní PHP, aby appka fungovala bez úprav:
//   {updated, source, maxColor, count, events:[…], orpColors:{CISORP: barva}}
// Při jakékoli chybě se vrací prázdná, ale platná struktura — mapa se nesmí
// rozbít jen proto, že je ČHMÚ nedostupné.

const CAP_URL = 'https://vystrahy-cr.chmi.cz/data2/XOCZ50_OKPR.xml';
const RANK = { green: 0, yellow: 1, orange: 2, red: 3 };
const rk = c => RANK[c] ?? 0;

const json = obj =>
  new Response(JSON.stringify(obj), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=600',
    },
  });

const fail = msg => json({ error: msg, events: [], orpColors: {}, maxColor: 'green', count: 0 });

// --- minimální XML pomocníci (CAP je plochý a předvídatelný) ---------------
const unesc = s =>
  String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&amp;/g, '&');

const blocks = (xml, tag) => {
  const out = [];
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g');
  let m;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
};
const one = (xml, tag) => {
  const m = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`).exec(xml);
  return m ? unesc(m[1]).trim() : '';
};
const ts = s => { const t = Date.parse(s); return Number.isFinite(t) ? Math.floor(t / 1000) : 0; };

export async function onRequest() {
  let xmlStr = '';
  try {
    const r = await fetch(CAP_URL, {
      headers: { 'User-Agent': 'PZMAP/1.0 (+https://appcreate.cloud)', Accept: '*/*' },
      cf: { cacheTtl: 900, cacheEverything: true },
    });
    if (!r.ok) return fail('CAP nedostupný (HTTP ' + r.status + ')');
    xmlStr = await r.text();
  } catch (e) {
    return fail('CAP nedostupný');
  }
  if (!xmlStr) return fail('CAP nedostupný');

  // Jmenné prostory pryč, ať se dá hledat podle čistých názvů tagů.
  const clean = xmlStr.replace(/xmlns(:\w+)?="[^"]*"/g, '').replace(/<(\/?)\w+:/g, '<$1');

  const now = Math.floor(Date.now() / 1000);
  const events = [];
  const orpColors = {};
  let maxRank = 0;

  for (const info of blocks(clean, 'info')) {
    const lang = one(info, 'language').toLowerCase();
    // Jen české znění, jinak by každá výstraha přišla dvakrát (cs + en).
    if (lang && !lang.includes('cs') && !lang.includes('cz')) continue;

    let color = 'green', type = '', endTime = one(info, 'expires');
    for (const p of blocks(info, 'parameter')) {
      const vn = one(p, 'valueName');
      const vv = one(p, 'value');
      if (vn === 'awareness_level') {
        const parts = vv.split(';').map(s => s.trim());
        if (parts[1]) color = parts[1].toLowerCase();
      } else if (vn === 'awareness_type') {
        const parts = vv.split(';').map(s => s.trim());
        if (parts[1]) type = parts[1];
      } else if (vn === 'eventEndingTime') {
        endTime = vv;
      }
    }

    const endTs = endTime ? ts(endTime) : 0;
    if (endTs && endTs < now - 4 * 3600) continue;   // skončilo víc než 4 h zpět

    const onset = one(info, 'onset');
    const areas = [];
    for (const a of blocks(info, 'area')) {
      const orps = [];
      for (const g of blocks(a, 'geocode')) {
        if (one(g, 'valueName') !== 'CISORP') continue;
        const code = one(g, 'value');
        if (!code) continue;
        orps.push(code);
        // Na ORP se drží NEJHORŠÍ barva ze všech výstrah, které ho zasahují.
        const cur = code in orpColors ? rk(orpColors[code]) : -1;
        if (rk(color) > cur) orpColors[code] = color;
      }
      areas.push({ name: one(a, 'areaDesc'), orp: orps });
    }
    if (rk(color) > maxRank) maxRank = rk(color);

    const onsetTs = onset ? ts(onset) : 0;
    events.push({
      event: one(info, 'event'),
      severity: one(info, 'severity'),
      color, type,
      start: onset,
      end: endTime,
      in_progress: !!(onsetTs && onsetTs <= now && (!endTs || endTs >= now)),
      areas,
      detail: one(info, 'description'),
      instruction: one(info, 'instruction'),
    });
  }

  const byRank = Object.fromEntries(Object.entries(RANK).map(([k, v]) => [v, k]));
  return json({
    updated: new Date().toISOString(),
    source: 'ČHMÚ SIVS (CC BY 4.0)',
    maxColor: byRank[maxRank] || 'green',
    count: events.length,
    events,
    orpColors,
  });
}
