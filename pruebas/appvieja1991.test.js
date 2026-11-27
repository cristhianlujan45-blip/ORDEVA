// 📲 1.99.91 · El aviso «Hay una versión nueva de ORDEVA» de la app Android no se queda escondido para siempre. Revisa:
//  1. Hay versión nueva y se tocó «Luego» hace un rato: no sale (se respeta «Luego»).
//  2. Si esa versión nueva ya lleva más de un día esperando: el aviso vuelve aunque se haya tocado «Luego».
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 400) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 412, height: 915 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-guia-tour', '1');
      localStorage.setItem('vento-act-luego', String(Date.now() + 3 * 864e5)); }catch(e){}
      window.VentoAndroid = { actualizacionEstado: () => JSON.stringify({ codigo: 93, nombre: '1.0.93', nueva: 94, nuevaNombre: '1.0.94', permiso: true, estado: 'esperando' }), actualizarAhora: () => {}, actualizacionPermiso: () => {} }; });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE); await p.waitForTimeout(900);
    await p.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); });
    const r1 = await p.evaluate(() => { window.ventoActualizacion.pintar(); const b = document.getElementById('actBanner'); return !!(b && !b.hidden); });
    chk('1. con «Luego» reciente: el aviso no sale', r1 === false, r1);
    const r2 = await p.evaluate(() => { localStorage.setItem('vento-act-desde-94', String(Date.now() - 2 * 864e5)); window.ventoActualizacion.pintar(); const b = document.getElementById('actBanner'); return { sale: !!(b && !b.hidden), txt: b ? b.textContent.slice(0, 80) : '' }; });
    chk('2. la versión nueva lleva 2 días esperando: el aviso vuelve', r2.sale && /versión nueva/i.test(r2.txt), r2);
    chk('3. sin errores de página', errs.length === 0, errs);
  }catch(e){ mal++; console.log('❌ excepción: ' + e.message); }
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
