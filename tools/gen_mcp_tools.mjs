// Vygeneruje seznam nástrojů pro MCP konektor (worker/tnmap-mcp/src/tools.js)
// z popisu nástrojů AI asistenta (worker/tnmap-chat.built.js) — jeden zdroj pravdy.
//   node tools/gen_mcp_tools.mjs
import fs from 'fs';
const src = fs.readFileSync(new URL('../worker/tnmap-chat.built.js', import.meta.url), 'utf8');
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
