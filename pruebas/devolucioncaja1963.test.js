// ↩️ 1.99.63 · Devoluciones y caja, y la libreta en Contabilidad. Revisa:
//  1. Caja abierta, venta $70.000 en efectivo, se devuelven $35.000 EN EFECTIVO → la caja espera $35.000 (antes $0: bajaba
//     el pago Y anotaba la salida; al contar decía «sobran $35.000»).
//  2. Venta pagada mitad efectivo y mitad Nequi, se devuelven $50.000 en efectivo → baja el efectivo ($30.000) y solo los
//     $20.000 que se pagaron por Nequi son salida de caja.
//  3. Devolución que queda como saldo a favor (no sale plata) de una venta en efectivo → la caja sigue esperando lo que hay.
//  4. Sin caja abierta, una devolución en efectivo NO abre una caja sola.
//  5. Con la caja abierta, pagar en efectivo desde la libreta cuenta UNA vez en Contabilidad (antes dos: la libreta y la
//     salida de caja).
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
    await p.goto(BASE); await p.waitForTimeout(1000);
    await p.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); window.speakVoice = () => {}; window.showConfirm = async () => true;
      data.products = [{ id: 'pa', name: 'Purina', price: 35000, stock: 10 }, { id: 'pb', name: 'Bulto', price: 50000, stock: 10 }];
      data.libreta = { movs: [] }; data.contab = []; data.purchases = []; await saveData(); });
    const venta = (id, items, payments) => p.evaluate(([id, items, payments]) => { data.history.unshift({ id, invoiceNo: 'FV-' + id, date: new Date().toISOString(), table: null, tableName: 'Mostrador', total: items.reduce((s, i) => s + i.price * i.qty, 0), debt: 0, items, payments }); return saveData(); }, [id, items, payments]);
    const devolver = async (id, n, ef, saldo) => { await p.evaluate(id => { window.ventoVentaFix('devolver', id); }, id); await p.waitForSelector('[data-dv="0"]', { timeout: 5000 });
      await p.fill('[data-dv="0"]', String(n));
      await p.evaluate(([ef, saldo]) => { const e = document.getElementById('viDvEf'); if(e && e.checked !== ef) e.click(); const s = document.getElementById('viDvSal'); if(saldo && s){ s.click(); document.getElementById('viDvCn').value = 'Juan'; } }, [ef, saldo]);
      await p.click('#viDvOk'); await p.waitForTimeout(300); };
    const caja = () => p.evaluate(() => { const r = ventoTurno.resumen(); return { abierta: r.abierta, ventas: r.ventas, entradas: r.entradas, salidas: r.salidas, esperado: r.esperado }; });
    // 4. sin caja abierta
    await p.evaluate(() => { data.history = []; ventoTurno.ponerTurno(null); });
    await venta('s0', [{ productId: 'pa', name: 'Purina', price: 35000, qty: 2 }], [{ method: 'efectivo', amount: 70000 }]);
    await devolver('s0', 1, true);
    chk('4. Sin caja abierta, la devolución en efectivo no abre una caja sola', !(await p.evaluate(() => !!ventoTurno.turno())));
    // 1.
    await p.evaluate(() => { data.history = []; ventoTurno.ponerTurno({ abierto_en: new Date(Date.now() - 3600e3).toISOString(), base: 0, por: 'ana', movs: [] }); });
    await venta('s1', [{ productId: 'pa', name: 'Purina', price: 35000, qty: 2 }], [{ method: 'efectivo', amount: 70000 }]);
    await devolver('s1', 1, true); let c = await caja();
    chk('1. Devolución en efectivo de $35.000 de una venta en efectivo: la caja espera $35.000', c.esperado === 35000 && c.salidas === 0, c);
    // 2.
    await p.evaluate(() => { data.history = []; ventoTurno.ponerTurno({ abierto_en: new Date(Date.now() - 3600e3).toISOString(), base: 0, por: 'ana', movs: [] }); });
    await venta('s2', [{ productId: 'pb', name: 'Bulto', price: 50000, qty: 1 }], [{ method: 'efectivo', amount: 30000 }, { method: 'transferencia', amount: 20000, note: 'Nequi' }]);
    await devolver('s2', 1, true); c = await caja();
    chk('2. Mitad efectivo y mitad Nequi, devuelve $50.000 en efectivo: salen de la caja $50.000 en total (30.000 del pago + 20.000 de salida)', c.ventas === 0 && c.salidas === 20000 && c.esperado === -20000, c);
    // 3.
    await p.evaluate(() => { data.history = []; ventoTurno.ponerTurno({ abierto_en: new Date(Date.now() - 3600e3).toISOString(), base: 0, por: 'ana', movs: [] }); });
    await venta('s3', [{ productId: 'pa', name: 'Purina', price: 35000, qty: 2 }], [{ method: 'efectivo', amount: 70000 }]);
    const haySaldo = await p.evaluate(() => !!(window.ventoCajaMas && window.ventoCajaMas.sumarSaldo));
    if(haySaldo){ await devolver('s3', 1, false, true); c = await caja();
      chk('3. Devolución como saldo a favor de una venta en efectivo: la caja sigue esperando $70.000 (la plata no salió)', c.esperado === 70000, c); }
    // 5.
    await p.evaluate(() => { data.history = []; data.contab = []; data.libreta = { movs: [] }; ventoTurno.ponerTurno({ abierto_en: new Date(Date.now() - 3600e3).toISOString(), base: 0, por: 'ana', movs: [] }); });
    await p.evaluate(async () => { await window.libretaEntender('le pagué al proveedor Agro Sur 40 mil'); await window.libretaEntender('le pagué a Pedro 30 mil'); });
    const g = await p.evaluate(() => ctMovimientos({ ini: new Date().setHours(0, 0, 0, 0), fin: Date.now() + 1000 }).mov.filter(m => m.tipo === 'gasto').map(m => m.monto));
    c = await caja();
    chk('5. Contabilidad cuenta los pagos de la libreta una sola vez ($40.000 y $30.000)', JSON.stringify(g.sort()) === JSON.stringify([30000, 40000]), g);
    chk('5. Y la caja sí los tiene como salidas ($70.000)', c.salidas === 70000, c);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
