// 🧾 1.99.51 · Auditoría de los datos del dueño: 42 ventas sin número de factura (la de hoy: «Mostrador — Tania», sin
// «N.º FV-…»). Las ventas de mostrador (Caja POS), los domicilios y la cuenta de UNA persona de la mesa se guardaban sin
// número. Revisa:
//  1. Venta de mostrador → FV-0001; cuenta de mesa → FV-0002 (el mismo consecutivo, sin repetir).
//  2. Deshacer la venta de mostrador al instante devuelve el número (la siguiente vuelve a ser la misma).
//  3. Cobrar la cuenta de una persona de la mesa → también con su número.
//  4. Ninguna venta nueva queda sin número.
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
    const r = await p.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); window.showConfirm = async () => true;
      data.history = []; data.invoiceNextNo = 1; data.facturaEquipos = null; await saveData();
      const out = {};
      const v1 = qsRegistrarVenta([{ productId: 'x', name: 'Concentrado', price: 50000, qty: 1 }], { method: 'efectivo' });
      out.mostrador = v1.invoiceNo;
      qsDeshacerVenta(v1);
      const v2 = qsRegistrarVenta([{ productId: 'x', name: 'Concentrado', price: 50000, qty: 1 }], { method: 'debe', deudor: 'Tania' });
      out.trasDeshacer = v2.invoiceNo;
      data.tables[1] = { items: [{ productId: 'y', name: 'Semilla', price: 10000, qty: 1 }], people: [], payments: [{ method: 'efectivo', amount: 10000 }] };
      out.mesa = closeTableToHistory(1).invoiceNo;
      return out; });
    chk('1. Venta de mostrador con su número: FV-0001', r.mostrador === 'FV-0001', r);
    chk('2. Deshacerla devuelve el número: la siguiente vuelve a ser FV-0001', r.trasDeshacer === 'FV-0001', r);
    chk('1. La cuenta de mesa sigue el mismo consecutivo: FV-0002', r.mesa === 'FV-0002', r);
    // 3. Persona de la mesa
    await p.evaluate(() => { data.tables[2] = { items: [{ productId: 'z', name: 'Abono', price: 8000, qty: 1, personId: 'pa' }, { productId: 'z', name: 'Abono', price: 8000, qty: 1 }], people: [{ id: 'pa', name: 'Ana' }], payments: [{ method: 'efectivo', amount: 8000, personId: 'pa' }] }; saveData(); openTableModal(2); });
    await p.waitForTimeout(600);
    const r3 = await p.evaluate(async () => { try{ openPersonModal('pa'); }catch(e){ return { err: String(e) }; } await new Promise(r => setTimeout(r, 400));
      const b = document.getElementById('personCloseBtn') || [...document.querySelectorAll('#personOverlay button, .person-modal button')].find(x => /Cerrar|Cobrar/.test(x.textContent) && x.getClientRects().length);
      if(b) b.click(); await new Promise(r => setTimeout(r, 600));
      const h = data.history.find(x => x.person === 'Ana'); return { hay: !!h, no: h && h.invoiceNo }; });
    chk('3. La cuenta de una persona de la mesa también con su número (FV-0003)', r3.hay && r3.no === 'FV-0003', r3);
    chk('4. Ninguna venta nueva quedó sin número', await p.evaluate(() => data.history.every(h => !!h.invoiceNo)), await p.evaluate(() => data.history.map(h => h.invoiceNo || '—')));
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
