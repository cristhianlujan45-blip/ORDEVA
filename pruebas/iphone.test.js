// 📱 iPhone / iPad (Safari): que ORDEVA abra y se vea bien también en los iPhone viejos (iOS 15.4 en adelante).
//  1. Revisión del código: nada que Safari 15.4–16.3 no entienda y que tumbe un bloque entero al abrir (lookbehind en
//     expresiones regulares, «static {}» en clases, flag «v») ni funciones de iOS 16+ (toSorted…), ni requestIdleCallback
//     sin revisar que exista (Safari no lo tiene). Si alguien lo agrega después, esta prueba lo dice con archivo y línea.
//  2. Colores mezclados (color-mix, iOS 16.2+): en un Safari que no los entiende, lib/vento-colormix.js los calcula
//     con los colores del tema (sin dejar ningún color-mix ni var sin resolver) y la cuenta da bien.
//  3. Al cambiar de tema se vuelven a calcular.
//  4. En los navegadores que sí los entienden no hace nada.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('fs'), path = require('path');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
let acorn = null, walk = null;
for(const d of [path.join(__dirname, 'node_modules'), '/opt/node-tools/node_modules', path.join(__dirname, '../pc/node_modules')]){ try{ acorn = require(path.join(d, 'acorn')); walk = require(path.join(d, 'acorn-walk')); break; }catch(e){} }
(async () => {
  let ok = 0, mal = 0;
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 900) : '')); } };
  const raiz = path.join(__dirname, '..');
  // ===== 1. Revisión del código =====
  if(acorn){
    const archivos = fs.readdirSync(raiz).filter(f => /\.html$/.test(f))
      .concat(fs.readdirSync(path.join(raiz, 'lib')).filter(f => /\.js$/.test(f) && !/vento-ocr|vento-pdf/.test(f)).map(f => 'lib/' + f), fs.readdirSync(path.join(raiz, 'nube')).filter(f => /\.js$/.test(f)).map(f => 'nube/' + f), fs.readdirSync(path.join(raiz, 'app')).filter(f => /\.js$/.test(f)).map(f => 'app/' + f), ['sw.js']);
    const IOS16 = new Set(['toSorted', 'toReversed', 'toSpliced', 'fromAsync', 'groupBy', 'withResolvers']);
    const malos = [], ilegibles = [];
    const revisar = (cod, a, l0) => {
      let ast; try{ ast = acorn.parse(cod, { ecmaVersion: 'latest', sourceType: 'script', allowAwaitOutsideFunction: true, allowReturnOutsideFunction: true, locations: true }); }
      catch(e){ ilegibles.push(a + ':' + (l0 + (e.loc ? e.loc.line - 1 : 0)) + ' ' + e.message); return; }
      walk.full(ast, n => {
        const L = a + ':' + (l0 + n.loc.start.line - 1);
        if(n.type === 'Literal' && n.regex && (/\(\?<[=!]/.test(n.regex.pattern) || /v/.test(n.regex.flags))) malos.push(L + ' expresión regular de iOS 16.4+ /' + n.regex.pattern.slice(0, 40) + '/');
        if(n.type === 'StaticBlock') malos.push(L + ' static {} (iOS 16.4+)');
        if(n.type === 'MemberExpression' && !n.computed && n.property && IOS16.has(n.property.name)) malos.push(L + ' .' + n.property.name + ' (iOS 16+)');
        if(n.type === 'CallExpression' && n.callee.type === 'Identifier' && n.callee.name === 'requestIdleCallback') malos.push(L + ' requestIdleCallback() sin window. (no existe en Safari)');
      });
    };
    let bloques = 0;
    for(const a of archivos){
      const txt = fs.readFileSync(path.join(raiz, a), 'utf8');
      if(/\.js$/.test(a)){ revisar(txt, a, 1); bloques++; continue; }
      const re = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi; let m;
      while((m = re.exec(txt))){ if(/type=["']?(application\/ld\+json|text\/template|text\/plain|importmap|module)/i.test(m[1])) continue; revisar(m[2], a, txt.slice(0, m.index).split('\n').length); bloques++; }
    }
    chk('1. Todo el código se puede leer (' + bloques + ' bloques de ' + archivos.length + ' archivos)', !ilegibles.length, ilegibles);
    chk('1. Nada que Safari de iOS 15.4–16.3 no entienda', !malos.length, malos);
  } else console.log('ℹ️ 1. Sin acorn en este equipo: se omite la revisión del código');

  // ===== 2–4. Colores mezclados =====
  const b = await chromium.launch(); const errs = [];
  try{
    const abrir = async (forzar, pg) => {
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
      await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
      await ctx.addInitScript(f => { if(f) window.__ventoForzarColorMix = true; try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); }catch(e){} }, forzar);
      const p = await ctx.newPage(); p.on('pageerror', e => errs.push(pg + ': ' + e.message));
      await p.goto(BASE + '/' + pg); await p.waitForTimeout(1800);
      return { ctx, p };
    };
    const { ctx, p } = await abrir(true, 'index.html');
    let r = await p.evaluate(() => { const t = (document.getElementById('ventoColorMix') || {}).textContent || ''; return { n: (t.match(/\{/g) || []).length, mix: (t.match(/color-mix/g) || []).length, vars: (t.match(/var\(/g) || []).length, act: (t.match(/\.more-tile\.active\{[^}]*\}/) || [''])[0],
      ultima: document.head.lastElementChild && document.head.lastElementChild.id, a: window.ventoColorMix._mezclar('color-mix(in srgb, #ff0000 50%, #0000ff)'), tr: window.ventoColorMix._mezclar('color-mix(in srgb, #16a34a 16%, transparent)'), sinPct: window.ventoColorMix._mezclar('color-mix(in srgb, #000000, #ffffff)') }; });
    chk('2. Safari sin color-mix: se calculan las ' + r.n + ' reglas de la app, sin dejar color-mix ni var() sueltos', r.n > 80 && !r.mix && !r.vars, r);
    chk('2. Va de última (gana como la línea original): ej. «' + r.act + '»', r.ultima === 'ventoColorMix' && /rgba\(\d+,\d+,\d+,1\)/.test(r.act), r);
    chk('2. Las cuentas dan bien: rojo+azul 50% = morado; verde 16% con transparente = verde con 16% de opacidad; sin % = mitad', r.a === 'rgba(128,0,128,1)' && r.tr === 'rgba(22,163,74,0.16)' && r.sinPct === 'rgba(128,128,128,1)', r);
    const antes = r.act;
    await p.evaluate(() => { document.documentElement.style.setProperty('--amber', '#ff0000'); document.documentElement.style.setProperty('--surface', '#000000'); });
    await p.waitForTimeout(300);
    r = await p.evaluate(() => ((document.getElementById('ventoColorMix') || {}).textContent.match(/\.more-tile\.active\{[^}]*\}/) || [''])[0]);
    chk('3. Al cambiar los colores del tema se vuelven a calcular (rojo 12% sobre negro)', r !== antes && /rgba\(31,0,0,1\)/.test(r), [antes, r]);
    await ctx.close();
    const m = await abrir(true, 'mesero.html');
    chk('2. También en la app de meseros', await m.p.evaluate(() => !!document.getElementById('ventoColorMix') && !/color-mix/.test(document.getElementById('ventoColorMix').textContent)));
    await m.ctx.close();
    const n = await abrir(false, 'index.html');
    chk('4. Donde sí se entiende color-mix (Chrome, Safari nuevo) no hace nada', await n.p.evaluate(() => !document.getElementById('ventoColorMix')));
    await n.ctx.close();
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ Error: ' + (e && e.stack || e)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
