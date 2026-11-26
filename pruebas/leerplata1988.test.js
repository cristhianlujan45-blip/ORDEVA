// 💵 1.99.88 · Leer la plata escrita o pegada («$ 8.000,00» como la copia la app del banco). Antes varios campos quitaban
// todo lo que no fuera cifra y «8.000,00» quedaba en 800000 (100 veces más). Revisa:
//  1. ventoLeerPlata: 8.000 · $ 8.000 · 8000 · 8.000,00 · 8000.50 · 1.500.000 · 1,500,000.00 → bien.
//  2. Consumo mínimo de una mesa con «50.000,00» → 50000.
//  3. Movimiento de caja (entrada) con «$ 20.000,00» → 20000.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 500) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 412, height: 915 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-guia-tour', '1'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE); await p.waitForTimeout(900);
    await p.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); });
    const u = await p.evaluate(() => ['8.000', '$ 8.000', '8000', '8.000,00', '8000.50', '1.500.000', '1,500,000.00', '$ 1.500.000,00', ''].map(x => window.ventoLeerPlata(x)));
    chk('1. ventoLeerPlata lee bien los formatos', JSON.stringify(u) === JSON.stringify([8000, 8000, 8000, 8000, 8000, 1500000, 1500000, 1500000, 0]), u);
    const m = await p.evaluate(() => { data.tables = data.tables || {}; data.tables['9'] = { items: [], payments: [] }; window.ventoMinimo.ponerCuenta('9', '50.000,00'); return data.tables['9'].minimo; });
    chk('2. consumo mínimo «50.000,00» → 50000', m === 50000, m);
    const t = await p.evaluate(() => { const T = window.ventoTurno; try{ if(!T.turno()) T.abrir(0); }catch(e){}
      const mv = T.movimiento('entrada', '$ 20.000,00', 'prueba'); return mv ? mv.monto : (T.turno() && (T.turno().movs || []).slice(-1)[0] || {}).monto; });
    chk('3. entrada de caja «$ 20.000,00» → 20000', t === 20000, t);
    chk('4. sin errores de página', errs.length === 0, errs);
  }catch(e){ mal++; console.log('❌ excepción: ' + e.message); }
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
