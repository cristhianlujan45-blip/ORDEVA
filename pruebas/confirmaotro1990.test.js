// ⏳ 1.99.90 · «Esperando el pago» con dos equipos. Revisa:
//  1. Otro equipo ya registró ese pago en OTRA cuenta: esta pantalla NO se pone verde «PAGADO»; sigue «Esperando el pago».
//  2. Otro equipo lo registró en ESTA misma cuenta: sí se pone verde (como antes).
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
    await p.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.pagos = { on: true, lista: [], vistos: [], espera: {} };
      data.tables = data.tables || {}; data.tables[3] = { items: [{ productId: null, name: 'Cerveza', price: 45000, qty: 1 }], payments: [] }; data.tables[5] = { items: [{ productId: null, name: 'Gaseosa', price: 30000, qty: 1 }], payments: [] };
      await saveData(); });
    const caso = (aplicadoEn) => p.evaluate(async (ap) => { const C = window.ventoConfirma;
      data.tables[3].payments = []; C.cerrar(true); C.abrir(3);
      window.ventoPagosAntesDeRegistrar = (x, id) => { x.aplicado = ap; return Promise.resolve(false); };
      const x = { id: 'srv-' + ap + Date.now(), srv: 'p' + ap, monto: 45000, estado: 'ok', app: 'Nequi', t: Date.now() };
      data.pagos.lista.unshift(x); C.llego(x); await new Promise(r => setTimeout(r, 300));
      const ov = document.getElementById('vcEspera'); return { clase: ov && ov.className, txt: ov && ov.textContent.slice(0, 80) }; }, aplicadoEn);
    const r1 = await caso(5);
    chk('1. lo registró otro equipo en la mesa 5: no se pone verde, sigue «Esperando»', r1.clase !== 'vc-ok' && /Esperando el pago/.test(r1.txt), r1);
    const r2 = await caso(3);
    chk('2. lo registró otro equipo en esta misma mesa: sí sale «PAGADO»', r2.clase === 'vc-ok' && /PAGADO/.test(r2.txt), r2);
    chk('3. sin errores de página', errs.length === 0, errs);
  }catch(e){ mal++; console.log('❌ excepción: ' + e.message); }
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
