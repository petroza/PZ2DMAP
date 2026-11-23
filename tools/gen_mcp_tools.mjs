// Vygeneruje seznam nástrojů pro MCP konektor (worker/tnmap-mcp/src/tools.js)
// z popisu nástrojů AI asistenta (worker/tnmap-chat.built.js) — jeden zdroj pravdy.
//   node tools/gen_mcp_tools.mjs
import fs from 'fs';
// Seznam presetů pro applyPreset bere z index.html jen ty, které grafik ve Stylu
// vidí (DEFAULT_VISIBLE_BUILTIN_PRESETS) — skryté (dark, uber…) by asistent
// nabízel, ale v appce nemají dlaždici.
const BUILT = new URL('../worker/tnmap-chat.built.js', import.meta.url);
{
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const arr = (/const DEFAULT_VISIBLE_BUILTIN_PRESETS = (\[[^\]]*\]);/.exec(html) || [])[1];
  const lab = (/const BUILTIN_PRESET_LABELS = (\{[\s\S]*?\n\});/.exec(html) || [])[1];
  if(arr && lab){
    const keys = JSON.parse(arr.replace(/'/g, '"')), labels = Function('return ' + lab)();
    const order = (/const BUILTIN_PRESET_ORDER = (\[[^\]]*\]);/.exec(html) || [])[1];
    const sorted = order ? JSON.parse(order.replace(/'/g, '"')).filter(k => keys.includes(k)) : keys;
    const line = 'applyPreset {preset, force?} – barevné schéma (jen tyto jsou v appce vidět): ' + sorted.map(k => k + ' (' + labels[k] + ')').join(', ')
      + '. Jiný preset (tmavý apod.) nehádej: když žádný nesedí, zeptej se grafika a nabídni tyto; force:true jen na výslovné přání.';
    const b = fs.readFileSync(BUILT, 'utf8');
    fs.writeFileSync(BUILT, b.replace(/^applyPreset \{[^}]*\} – .*$/m, () => line));
  }
}
const src = fs.readFileSync(BUILT, 'utf8');
const txt = src.slice(src.indexOf('var TOOLS = `') + 13, src.indexOf('`.trim();'));
const tools = [];
for(const line of txt.split('\n')){
  for(const part of line.split(/\s{2,}(?=[a-zA-Z]+ \{)/)){
    const m = /^([a-zA-Z][a-zA-Z0-9]*) \{([^}]*)\} – (.*)$/.exec(part.trim());
    if(!m) continue;
    const [, name, params, desc] = m;
    const props = {}, required = [];
    let free = false;
    for(const p of params.split(',').map(s => s.trim()).filter(Boolean)){
      if(/[:…]/.test(p)){ free = true; continue; }          // {prvek:"barva", …} = volné klíče
      const opt = p.endsWith('?'), k = p.replace(/\?$/, '');
      props[k] = {};
      if(!opt) required.push(k);
    }
    tools.push({name, description: desc.trim(), inputSchema: {type: 'object', properties: props, ...(required.length ? {required} : {}), additionalProperties: free || !Object.keys(props).length ? true : true}});
  }
}
fs.writeFileSync(new URL('../worker/tnmap-mcp/src/tools.js', import.meta.url),
  '// VYGENEROVÁNO tools/gen_mcp_tools.mjs z worker/tnmap-chat.built.js — neupravovat ručně.\nexport const MAP_TOOLS = ' + JSON.stringify(tools, null, 1) + ';\n');
console.log(tools.length + ' nástrojů:', tools.map(t => t.name).join(', '));
