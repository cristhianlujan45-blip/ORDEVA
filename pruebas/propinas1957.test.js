// 🤝 1.99.57 · Las propinas son de los empleados: el cierre de caja y Contabilidad ya las sacaban de «Vendido», pero
// Estadísticas, el análisis de ventas (y su GANANCIA) y el asistente las sumaban. Mismas ventas del día → misma cifra en todos:
//  v1 efectivo $20.000 (2 × A) · v2 Nequi $11.000 (1 × A + 🙏 Propina $1.000 como renglón) · v3 fiado $30.000 (1 × B, abonó $10.000)
//  v4 efectivo $21.000 (2 × A, propina $1.000 guardada en h.propina) → vendido sin propinas $80.000; ganancia $30.000.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 412, height: 915 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-guia-tour', '1'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE); await p.waitForTimeout(1000);
    const r = await p.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); window.speakVoice = () => {};
      const t = m => new Date(Date.now() - m * 60e3).toISOString();
      data.products = [{ id: 'pa', name: 'Arroz', price: 10000, cost: 6000, stock: 50 }, { id: 'pb', name: 'Bulto', price: 30000, cost: 20000, stock: 10 }];
      const A = q => ({ productId: 'pa', name: 'Arroz', price: 10000, qty: q, cost: 6000 });
      data.closures = []; data.turno = null; data.libreta = { movs: [] }; data.contab = []; data.purchases = [];
      data.history = [
        { id: 'v1', invoiceNo: 'FV-1', date: t(50), table: null, tableName: 'Mostrador', total: 20000, debt: 0, items: [A(2)], payments: [{ method: 'efectivo', amount: 20000 }] },
        { id: 'v2', invoiceNo: 'FV-2', date: t(40), table: 1, total: 11000, debt: 0, by: 'ana', items: [A(1), { productId: null, name: '🙏 Propina', price: 1000, qty: 1 }], payments: [{ method: 'transferencia', amount: 11000, note: 'Nequi' }] },
        { id: 'v3', invoiceNo: 'FV-3', date: t(30), table: 2, total: 30000, debt: 20000, items: [{ productId: 'pb', name: 'Bulto', price: 30000, qty: 1, cost: 20000 }], payments: [{ method: 'efectivo', amount: 10000 }, { method: 'debe', amount: 20000, note: 'Juan' }] },
        { id: 'v4', invoiceNo: 'FV-4', date: t(20), table: 3, total: 21000, propina: 1000, debt: 0, by: 'ana', items: [A(2)], payments: [{ method: 'efectivo', amount: 21000 }] }];
      await saveData();
      const cs = computeClosureStats(null, new Date().toISOString());
      const ct = ctMovimientos({ ini: new Date().setHours(0, 0, 0, 0), fin: Date.now() + 1000 });
      try{ stPer = 'hoy'; }catch(e){}
      renderStats(); const st = document.getElementById('statsBody').innerText;
      const kpi = [...document.querySelectorAll('#statsBody .st-kpi')].map(k => k.innerText.replace(/\s+/g, ' '));
      const asis = asisVentasEntre(new Date().setHours(0, 0, 0, 0), Date.now() + 1000);
      const caja = await Laya.responder('cuánto hay en caja');
      const gan = await Laya.responder('cuánto gané hoy');
      const posHoy = (window.ventoFacil && window.ventoFacil.hoy) ? window.ventoFacil.hoy().total : null;
      const voz = getVoiceSalesTotal();
      const cx = (window.ventoCajaMas && window.ventoCajaMas.corte) ? window.ventoCajaMas.corte(null) : null;
      return { posHoy, voz, cx: cx && { t: cx.total, p: cx.prop }, cs: cs.totalSold, prop: cs.totalPropinas, ct: ct.vendido, kpi, propEnStats: /🙏\s*Propina/.test(st), asis: asis.total, caja: caja && (caja.text || caja.texto || caja), gan: gan && (gan.text || gan.texto || gan) };
    });
    chk('Cierre de caja: vendido $80.000 y propinas $2.000 aparte', r.cs === 80000 && r.prop === 2000, r);
    chk('Contabilidad: vendido $80.000', r.ct === 80000, r.ct);
    chk('Estadísticas: «💰 Ventas» $80.000 (antes $82.000)', r.kpi.some(k => /Ventas\s*\$\s?80\.000/.test(k)), r.kpi);
    chk('Estadísticas: el comparativo «Esta semana» y «Este mes» $80.000', r.kpi.some(k => /Esta semana\s*\$\s?80\.000/.test(k)) && r.kpi.some(k => /Este mes\s*\$\s?80\.000/.test(k)), r.kpi);
    chk('Estadísticas: «🙏 Propina» no sale como producto vendido', !r.propEnStats);
    chk('Total por voz: $80.000', r.voz === 80000, r.voz);
    if(r.cx) chk('Corte X: ventas $80.000 y propinas $2.000 en su renglón', r.cx.t === 80000 && r.cx.p === 2000, r.cx); else console.log('ℹ️ Corte X no expuesto: se revisa en pantalla');
    if(r.posHoy != null) chk('Punto de venta «Hoy»: $80.000', r.posHoy === 80000, r.posHoy);
    chk('Asistente «¿cuánto vendí?»: $80.000', r.asis === 80000, r.asis);
    chk('Laya «¿cuánto hay en caja?»: «Hoy vendiste $80.000»', /Hoy vendiste \$\s?80\.000/.test(String(r.caja)), r.caja);
    chk('Laya «¿cuánto gané hoy?»: ganancia $30.000 (sin las propinas)', /30\.000/.test(String(r.gan)) && !/32\.000/.test(String(r.gan)), r.gan);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
