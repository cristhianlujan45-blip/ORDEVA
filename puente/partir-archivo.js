// Busca dónde se puede partir un archivo grande de app/ en varios, SIN cambiar lo que hace al cargar.
// En un solo archivo, las funciones «function x(){}» existen desde el principio (aunque estén escritas más abajo); al
// partirlo, una parte no ve las funciones de las partes que todavía no cargaron. Este revisor encuentra los cortes
// donde nada de lo que corre AL CARGAR (fuera de clics, temporizadores, promesas…) usa algo de una parte posterior.
// Uso: node puente/partir-archivo.js app/04-principal.js [partes]      → lista los cortes posibles (no cambia nada)
//      node puente/partir-archivo.js app/04-principal.js 8 --escribir  → escribe app/04a…, app/04b… (y borra el original)
'use strict';
const fs = require('fs'), path = require('path');
const acorn = require('acorn'), walk = require('acorn-walk');
const archivo = process.argv[2], partes = +process.argv[3] || 8, escribir = process.argv.includes('--escribir');
let src = fs.readFileSync(archivo, 'utf8');
// --subir=a,b: esas «function» se pasan al principio del archivo (hace lo mismo: ya existían desde que abre la app).
const subir = ((process.argv.find(x => x.startsWith('--subir=')) || '').slice(8)).split(',').filter(Boolean);
if(subir.length){
  const ast0 = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script' });
  const sts = ast0.body.filter(st => st.type === 'FunctionDeclaration' && subir.includes(st.id.name));
  if(sts.length !== subir.length){ console.error('❌ No encontré todas: ' + subir.join(', ')); process.exit(1); }
  const textos = sts.map(st => src.slice(st.start, st.end));
  // de abajo hacia arriba, para no correr las posiciones
  sts.slice().sort((x, y) => y.start - x.start).forEach(st => {
    src = src.slice(0, st.start) + '// ' + st.id.name + '(): está al principio del archivo (se usa al abrir la app).' + src.slice(st.end);
  });
  const cab = (src.match(/^\/\*[^\n]*\*\/\n/) || [''])[0];
  src = cab + '/* Funciones que se usan al abrir la app. Estaban más abajo; aquí hacen exactamente lo mismo («function» existe\n   desde el principio del archivo) y así el archivo se puede partir en partes que cargan una tras otra. */\n' +
    textos.join('\n') + '\n' + src.slice(cab.length);
  const ast1 = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script' });
  const firma = a => a.body.map(st => src0(a, st)).sort().join('\u0000');
  function src0(a, st){ return (a === ast0 ? fuente0 : src).slice(st.start, st.end); }
  var fuente0 = fs.readFileSync(archivo, 'utf8');
  if(firma(ast0) !== firma(ast1)){ console.error('❌ Al subir las funciones cambió algo más: no se cambia nada.'); process.exit(1); }
  console.log('Subidas al principio: ' + subir.join(', '));
}
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', allowHashBang: true });
const cuerpo = ast.body;

// 1. Lo que declara cada sentencia de arriba (funciones, var, let, const, class).
const declEn = new Map();              // nombre → índice de la sentencia
const funcDe = new Map();              // nombre → nodo de la función (para seguir lo que usa)
function nombresPatron(p, out){
  if(!p) return out;
  if(p.type === 'Identifier') out.push(p.name);
  else if(p.type === 'ObjectPattern') p.properties.forEach(q => nombresPatron(q.type === 'RestElement' ? q.argument : q.value, out));
  else if(p.type === 'ArrayPattern') p.elements.forEach(e => nombresPatron(e, out));
  else if(p.type === 'AssignmentPattern') nombresPatron(p.left, out);
  else if(p.type === 'RestElement') nombresPatron(p.argument, out);
  return out;
}
cuerpo.forEach((st, i) => {
  if(st.type === 'FunctionDeclaration'){ declEn.set(st.id.name, i); funcDe.set(st.id.name, st); }
  // let / const / class de más abajo NO cuentan: usarlos antes de su línea ya falla en el archivo entero (igual que
  // partido), así que lo que corre al cargar no los usa. Solo «function» y «var» existen desde el principio.
  else if(st.type === 'VariableDeclaration') st.declarations.forEach(d => {
    nombresPatron(d.id, []).forEach(n => { if(st.kind === 'var') declEn.set(n, i); if(d.init && /FunctionExpression|ArrowFunctionExpression/.test(d.init.type) && d.id.type === 'Identifier') funcDe.set(n, d.init); });
  });
  else if(st.type === 'BlockStatement' || st.type === 'IfStatement') walk.simple(st, { FunctionDeclaration(f){ if(!declEn.has(f.id.name)) declEn.set(f.id.name, i); } });
});

// 2. Lo que usa un pedazo de código AL CORRER (sin entrar a funciones que corren después).
//    usa: nombres que tienen que existir ya; llama: funciones que se ejecutan ya (se sigue lo que usan ellas).
//    OJO: entre un archivo y el siguiente el navegador SÍ alcanza a correr promesas (then, await) y temporizadores
//    cortos. Por eso solo cuentan como «después» los eventos de la persona (clics, teclas…), los de cuando ya cargó
//    todo (DOMContentLoaded, load) y los temporizadores de 2 segundos o más.
const EVENTOS_DESPUES = /^(click|dblclick|input|change|keydown|keyup|keypress|submit|focus|blur|focusin|focusout|pointer\w*|mouse\w*|touch\w*|wheel|scroll|contextmenu|drag\w*|drop|DOMContentLoaded|load|beforeunload|pagehide|resize|orientationchange|paste|copy|cut|select)$/;
function esDiferida(c, args){
  const nom = c.type === 'MemberExpression' && !c.computed ? c.property.name : c.type === 'Identifier' ? c.name : '';
  if(/^(addEventListener|removeEventListener)$/.test(nom)) return !!(args[0] && args[0].type === 'Literal' && EVENTOS_DESPUES.test(String(args[0].value)));
  if(/^(setTimeout|setInterval)$/.test(nom)) return !!(args[1] && args[1].type === 'Literal' && +args[1].value >= 2000);
  return false;     // then / catch / finally / queueMicrotask / requestAnimationFrame / observe…: pueden correr antes
}
// .onclick = () => …  (eventos de la persona): después. .onsuccess, .onload de un pedido…: pueden llegar antes.
const ON_DESPUES = /^on(click|dblclick|input|change|keydown|keyup|keypress|submit|focus|blur|pointer\w*|mouse\w*|touch\w*|wheel|scroll|contextmenu|drag\w*|drop|paste|copy|cut|select|close|cancel|toggle)$/;
function usaAlCorrer(nodo, out, llama){
  llama = llama || out.llama || (out.llama = new Set());
  (function visitar(n, padre){
    if(!n || typeof n.type !== 'string') return;
    if(n.type === 'Identifier'){
      out.add(n.name);
      // Se ejecuta ya: f(), new f(), o pasada a algo que la llama ya (forEach, map, sort…).
      if(padre && (padre.type === 'CallExpression' || padre.type === 'NewExpression') && (padre.callee === n || (padre.arguments.includes(n) && !esDiferida(padre.callee, padre.arguments)))) llama.add(n.name);
      // x.onsuccess = f (no es un evento de la persona): f puede correr antes de que carguen las otras partes
      if(padre && padre.type === 'AssignmentExpression' && padre.right === n && padre.left.type === 'MemberExpression' && !padre.left.computed && /^on/.test(padre.left.property.name) && !ON_DESPUES.test(padre.left.property.name)) llama.add(n.name);
      if(padre && padre.type === 'TaggedTemplateExpression' && padre.tag === n) llama.add(n.name);
      return;
    }
    if(/^(FunctionExpression|ArrowFunctionExpression|FunctionDeclaration)$/.test(n.type) && n !== nodo){
      const llamadaYa = padre && ((padre.type === 'CallExpression' && (padre.callee === n || (padre.arguments.includes(n) && !esDiferida(padre.callee, padre.arguments)))) ||
        (padre.type === 'AssignmentExpression' && padre.right === n && padre.left.type === 'MemberExpression' && !padre.left.computed && /^on/.test(padre.left.property.name) && !ON_DESPUES.test(padre.left.property.name)) ||
        (padre.type === 'NewExpression' && padre.arguments.includes(n)));     // new Promise(r => …) corre ya
      if(llamadaYa) visitar(n.body, n);
      return;
    }
    if(n.type === 'MemberExpression'){
      visitar(n.object, n); if(n.computed) visitar(n.property, n);
      // obj.metodo() con obj una función de aquí (ej. f.call()): cuenta como llamarla
      if(padre && padre.type === 'CallExpression' && padre.callee === n && n.object.type === 'Identifier' && !n.computed && /^(call|apply|bind)$/.test(n.property.name)) llama.add(n.object.name);
      return;
    }
    if(n.type === 'Property' || n.type === 'PropertyDefinition' || n.type === 'MethodDefinition'){ if(n.computed) visitar(n.key, n); visitar(n.value, n); return; }
    if(n.type === 'LabeledStatement' || n.type === 'BreakStatement' || n.type === 'ContinueStatement'){ if(n.body) visitar(n.body, n); return; }
    for(const k of Object.keys(n)){
      if(k === 'type' || k === 'start' || k === 'end') continue;
      const v = n[k];
      if(Array.isArray(v)) v.forEach(x => visitar(x, n)); else if(v && typeof v.type === 'string') visitar(v, n);
    }
  })(nodo, null);
  return out;
}
// Lo que necesita una función cuando se la llama (y las que llama a su vez).
const memo = new Map();
function cierre(nombre, visto){
  if(memo.has(nombre)) return memo.get(nombre);
  if(visto.has(nombre)) return new Set();
  visto.add(nombre);
  const f = funcDe.get(nombre), out = new Set();
  if(f){
    const usa = usaAlCorrer(f.body, new Set());
    usa.forEach(n => out.add(n));
    usa.llama.forEach(n => { if(funcDe.has(n)) cierre(n, visto).forEach(x => out.add(x)); });
  }
  memo.set(nombre, out);
  return out;
}

// 3. Para cada sentencia: lo más abajo que necesita al cargar.
const necesita = cuerpo.map((st, i) => {
  let usa;
  if(st.type === 'FunctionDeclaration') return -1;                     // declararla no corre nada
  if(st.type === 'VariableDeclaration'){
    usa = new Set();
    st.declarations.forEach(d => { if(d.init && !/FunctionExpression|ArrowFunctionExpression/.test(d.init.type)) usaAlCorrer(d.init, usa); });
  } else usa = usaAlCorrer(st, new Set());
  const todo = new Set(usa); (usa.llama || new Set()).forEach(n => { if(funcDe.has(n)) cierre(n, new Set()).forEach(x => todo.add(x)); });
  let max = -1; todo.forEach(n => { const j = declEn.get(n); if(j !== undefined && j > max) max = j; });
  return max;
});
// Un corte antes de la sentencia c es seguro si nada antes de c necesita algo de c en adelante.
const seguros = []; let pre = -1;
for(let c = 1; c < cuerpo.length; c++){ pre = Math.max(pre, necesita[c - 1]); if(pre < c) seguros.push(c); }
const bytes = c => cuerpo[c].start;
console.log('Sentencias: ' + cuerpo.length + ' · cortes seguros: ' + seguros.length);
// Elegir cortes lo más parejos posible, mejor donde empieza una sección («/* ---------- Mesas ---------- */»).
const total = src.length, elegidos = [];
const seccion = c => { const prev = src.slice(Math.max(0, cuerpo[c].start - 400), cuerpo[c].start); const m = prev.match(/\/\*\s*-{4,}\s*([^\n*]+?)\s*-{4,}[^\n]*\n?\s*$|\/\*\s*={4,}\s*([^\n=]+?)\s*={4,}[^\n]*\n?\s*$/); return m ? (m[1] || m[2]).trim() : ''; };
for(let k = 1; k < partes; k++){
  const meta = total * k / partes, holgura = total / partes * 0.3;
  const libres = seguros.filter(c => !elegidos.includes(c));
  const conSeccion = libres.filter(c => seccion(c) && Math.abs(bytes(c) - meta) < holgura);
  const lista = conSeccion.length ? conSeccion : libres;
  let mejor = null; lista.forEach(c => { if(mejor === null || Math.abs(bytes(c) - meta) < Math.abs(bytes(mejor) - meta)) mejor = c; });
  if(mejor !== null) elegidos.push(mejor);
}
elegidos.sort((a, b) => a - b);
const lineaDe = off => src.slice(0, off).split('\n').length;
const tramos = []; let ini = 0;
elegidos.concat([cuerpo.length]).forEach(c => { const a = ini === 0 ? 0 : cuerpo[ini].start, z = c === cuerpo.length ? src.length : cuerpo[c].start; tramos.push({ desde: ini, hasta: c, a, z }); ini = c; });
tramos.forEach((t, i) => console.log('  parte ' + (i + 1) + ': líneas ' + lineaDe(t.a) + '–' + lineaDe(t.z) + ' · ' + Math.round((t.z - t.a) / 1024) + ' KB · ' + (i ? seccion(t.desde) || '(sin título)' : 'inicio')));
if(!escribir) process.exit(0);

// 4. Escribir las partes: el mismo código, cortado entre sentencias (con sus comentarios de arriba).
const dir = path.dirname(archivo), base = path.basename(archivo, '.js'), m = /^(\d+)-(.*)$/.exec(base);
const cab = (src.match(/^\/\*[^\n]*\*\/\n/) || [''])[0];
const nombres = [];
tramos.forEach((t, i) => {
  let a = t.a;
  if(i > 0){ const linea = src.lastIndexOf('\n', a - 1) + 1; a = linea; }        // desde el principio de la línea
  let z = t.z; if(i < tramos.length - 1){ z = src.lastIndexOf('\n', cuerpo[t.hasta].start - 1) + 1; }
  // Los comentarios justo encima de la sentencia de corte van con ella (a la parte siguiente).
  if(i < tramos.length - 1){ let k = z; for(;;){ const prev = src.lastIndexOf('\n', k - 2) + 1; const l = src.slice(prev, k).trim(); if(prev < t.a || !(l.startsWith('//') || l.startsWith('/*') || l.startsWith('*') || l === '')) break; k = prev; } z = k; tramos[i + 1].a0 = z; }
  if(i > 0 && t.a0 !== undefined) a = t.a0;
  let txt = src.slice(a, z);
  if(i === 0 && cab) txt = txt.slice(cab.length);
  const primeraFn = cuerpo.slice(t.desde, t.hasta).find(x => x.type === 'FunctionDeclaration');
  const tit = i === 0 ? m[2] : (seccion(t.desde) || (primeraFn ? primeraFn.id.name.replace(/([a-z])([A-Z])/g, '$1 $2') : m[2]));
  const slug = String(tit).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, '-').split('-').filter(Boolean).slice(0, 4).join('-') || m[2];
  const nom = m[1] + String.fromCharCode(97 + i) + '-' + slug + '.js';
  const encab = '/* ORDEVA · app/' + nom + ' — parte ' + (i + 1) + ' de ' + tramos.length + ' de app/' + base + '.js (antes dentro de index.html). Se carga en el mismo lugar y orden. */\n';
  fs.writeFileSync(path.join(dir, nom), encab + txt.replace(/^\n+/, ''));
  nombres.push(nom);
});
const junto = nombres.map((n, i) => { const t = fs.readFileSync(path.join(dir, n), 'utf8'); return t.slice(t.indexOf('\n') + 1); }).join('');
const original = src.slice(cab.length).replace(/^\n+/, '');
if(junto.replace(/\s+/g, '') !== original.replace(/\s+/g, '')){ console.error('❌ Las partes juntas no dan el original: no se cambia nada.'); nombres.forEach(n => fs.unlinkSync(path.join(dir, n))); process.exit(1); }
fs.unlinkSync(archivo);
// index.html: la etiqueta del archivo se cambia por las de sus partes, en el mismo lugar y orden.
const ih = path.join(dir, '..', 'index.html'); let html = fs.readFileSync(ih, 'utf8');
const re = new RegExp('<script src="app/' + base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\.js\\?v=([0-9.]+)"></script>');
const mm = html.match(re); if(!mm){ console.error('❌ No encontré la etiqueta de ' + base + ' en index.html'); process.exit(1); }
html = html.replace(re, nombres.map(n => '<script src="app/' + n + '?v=' + mm[1] + '"></script>').join('\n'));
fs.writeFileSync(ih, html);
console.log('✅ Escritas: ' + nombres.join(', ') + ' · index.html al día');
