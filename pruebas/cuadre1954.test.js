// 💵 1.99.54 · Auditoría de «Cuadre» (pestaña de abajo). La fila «Efectivo» era solo lo de las ventas: lo que pagaban de
// FIADOS en efectivo (libreta, «Ya pagó» del Historial) estaba en el cajón pero no salía, y el dueño (que no abre la caja con
// base) no lo veía en ningún lado. Revisa:
//  1. Ventas de hoy $10.000 en efectivo y $20.000 por Nequi; Juan paga en la libreta $30.000 que debía de ayer →
//     «📒 Fiados que pagaron $30.000» y «💵 Efectivo que debe haber $40.000».
//  2. Un fiado pagado por transferencia sale aparte (no suma al efectivo).
//  3. Con la caja abierta (base $50.000): «Efectivo que debe haber» es el de la caja ($50.000 + $10.000 + $30.000 = $90.000).
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 500) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 412, height: 915 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-guia-tour', '1'); localStorage.setItem('vento_vista_sencilla', '1'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE); await p.waitForTimeout(1000);
    await p.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); window.speakVoice = () => {}; window.showConfirm = async () => true;
      const ayer = new Date(Date.now() - 864e5).toISOString(), hoy = new Date().toISOString();
      data.closures = [{ id: 'c1', date: new Date(Date.now() - 3600e3).toISOString(), from: null, ticketCount: 0, totalSold: 0 }];
      data.history = [
        { id: 'f1', invoiceNo: 'FV-1', date: ayer, table: 1, total: 30000, debt: 30000, items: [{ name: 'x', price: 30000, qty: 1 }], payments: [{ method: 'debe', amount: 30000, note: 'Juan' }] },
        { id: 'f2', invoiceNo: 'FV-2', date: ayer, table: 2, total: 12000, debt: 12000, items: [{ name: 'x', price: 12000, qty: 1 }], payments: [{ method: 'debe', amount: 12000, note: 'Rosa' }] },
        { id: 'v1', invoiceNo: 'FV-3', date: hoy, table: null, tableName: 'Mostrador', total: 10000, debt: 0, items: [{ name: 'x', price: 10000, qty: 1 }], payments: [{ method: 'efectivo', amount: 10000 }] },
        { id: 'v2', invoiceNo: 'FV-4', date: hoy, table: null, tableName: 'Mostrador', total: 20000, debt: 0, items: [{ name: 'x', price: 20000, qty: 1 }], payments: [{ method: 'transferencia', amount: 20000, note: 'Nequi' }] }];
      data.libreta = { movs: [] }; data.turno = null; await saveData();
      await window.libretaEntender('Juan me pagó 30000'); pagarDeuda(data.history.find(h => h.id === 'f2'), 'transferencia'); });
    await p.waitForTimeout(1500);
    const leer = () => p.evaluate(async () => { document.getElementById('vsCajaNav').click(); await new Promise(r => setTimeout(r, 300));
      const ov = document.getElementById('vsCajaOv'); const filas = [...ov.querySelectorAll('.vs-caja-filas div')].map(d => d.innerText.replace(/\s+/g, ' ').trim()); ov.classList.remove('show'); return filas; });
    let f = await leer();
    chk('1. «📒 Fiados que pagaron» $42.000 (efectivo $30.000 · otros $12.000)', f.some(x => /Fiados que pagaron \(efectivo \$\s?30\.000 · otros \$\s?12\.000\) \$\s?42\.000/.test(x)), f);
    chk('1. «💵 Efectivo que debe haber» $40.000 (ventas $10.000 + fiado $30.000; sin el de transferencia)', f.some(x => /Efectivo que debe haber \$\s?40\.000/.test(x)), f);
    chk('2. La fila de efectivo de ventas sigue siendo $10.000', f.some(x => /Efectivo \$\s?10\.000/.test(x)), f);
    await p.evaluate(() => { ventoTurno.ponerTurno({ abierto_en: new Date(Date.now() - 1800e3).toISOString(), base: 50000, por: 'ana', movs: [{ id: 'm1', t: new Date().toISOString(), tipo: 'entrada', monto: 30000, motivo: 'Fiado cobrado · Juan' }] }); });
    f = await leer();
    chk('3. Con la caja abierta: «Efectivo que debe haber (con la base $50.000)» $90.000', f.some(x => /Efectivo que debe haber \(con la base \$\s?50\.000\) \$\s?90\.000/.test(x)), f);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
