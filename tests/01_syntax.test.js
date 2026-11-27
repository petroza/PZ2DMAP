// Syntaxe všech vložených skriptů v index.html (bez prohlížeče).
const {check, done} = require('./lib');
const fs = require('fs'), path = require('path');
const s = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scripts = [...s.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)];
let bad = 0;
for(const m of scripts){ try{ new Function(m[1]); }catch(e){ if(!/import|export/.test(e.message)){ bad++; console.log('   ', e.message); } } }
check(scripts.length > 5, `nalezeno ${scripts.length} skriptů`);
check(bad === 0, 'všechny skripty jdou zparsovat');
done();
