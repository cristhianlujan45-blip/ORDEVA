// 💵 ORDEVA 1.67.0 · Efectivo recibido, vueltas y motor financiero. Sin internet.
//  1. Cálculos: cambio (exacto, superior, inferior, vacío); margen 20 % vs recargo 25 %; precio para 30 % y comercial.
//  2. Caja: «¿CON CUÁNTO PAGA EL CLIENTE?» a la vista al abrir el cobro (no plegado), con los billetes de COP.
//  3. Billetes que se suman, edición a mano, «Pago exacto» y ↺: el cambio se actualiza al instante.
//  4. Pago inferior en efectivo: NO queda como venta pagada (abre el pago mixto con lo recibido).
//  5. Pago superior: la venta queda por el total; se guardan lo recibido y las vueltas, y el cierre cuenta solo lo aplicado.
//  6. Pago mixto: efectivo $50.000 + Nequi $30.000 = $80.000, sin vueltas; con $60.000 en efectivo, vueltas $10.000
//     solo del efectivo (nunca de la transferencia).
//  7. Cuenta (mesa): $50.000 en efectivo para un saldo de $37.500 → se anota $37.500 y «Cambio que debe devolver $12.500».
//     Por transferencia de más: pregunta; con «Corregir» no se anota nada.
//  8. Ficha del producto: margen bruto y recargo por separado y precios sugeridos; «Usar» no cambia el precio guardado.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';

(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1200);
    await p.fill('#authBiz', 'Tienda Vueltas'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1500);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await p.evaluate(() => {
      document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.products = [{ id: 'a', name: 'Almuerzo', price: 37500, cost: 20000 }, { id: 'c', name: 'Combo', price: 80000, cost: 50000 }];
      data.history = []; saveData();
    });

    // ===== 1. Cálculos =====
    let v = await p.evaluate(() => { const P = window.ventoPOS, F = window.ventoFinanzas;
      return { ex: P.cambio(37500, 37500), sup: P.cambio(37500, 50000), inf: P.cambio(37500, 20000), vac: P.cambio(37500, 0),
        m: F.margen(10000, 8000), r: F.recargo(10000, 8000), u: F.utilidad(10000, 8000), p30: F.precioParaMargen(8000, 30), com: F.redondeoComercial(F.precioParaMargen(8000, 30)), bill: P.billetes() }; });
    chk('1. Cambio: exacto → «exacto», $50.000 por $37.500 → $12.500, $20.000 → faltan $17.500', v.ex.estado === 'exacto' && v.ex.vueltas === 0 && v.sup.vueltas === 12500 && v.sup.aplicado === 37500 && v.inf.estado === 'falta' && v.inf.falta === 17500 && v.vac.estado === 'vacio', v);
    chk('1. Costo $8.000 y precio $10.000: utilidad $2.000, margen 20 %, recargo 25 % (no se confunden)', v.u === 2000 && v.m === 20 && v.r === 25, v);
    chk('1. Costo $8.000 con margen 30 %: $11.428,57 y comercial $11.500', v.p30 === 11428.57 && v.com === 11500, v);
    chk('1. Billetes rápidos en pesos colombianos: 2.000, 5.000, 10.000, 20.000, 50.000 y 100.000', JSON.stringify(v.bill) === JSON.stringify([2000, 5000, 10000, 20000, 50000, 100000]), v.bill);

    // ===== 2-3. Caja =====
    const abrirCobro = async id => {
      await p.evaluate(id => { window.ventoPOS.vaciar(); window.ventoPOS.agregar(id); window.ventoPOS.cobrar(); }, id);
      await p.waitForSelector('.pz-pago-ov.show', { timeout: 4000 });
    };
    const estado = () => p.evaluate(() => { const o = document.querySelector('.pz-pago-ov'); const vu = o.querySelector('.pz-vu'); return { txt: vu.textContent, cls: vu.className, val: o.querySelector('.pz-pagacon').value }; });
    await abrirCobro('a');
    v = await p.evaluate(() => { const o = document.querySelector('.pz-pago-ov'), l = o.querySelector('.pz-vu-l'), i = o.querySelector('.pz-pagacon'), r = i.getBoundingClientRect();
      return { label: l && l.textContent, enDetails: !!i.closest('details'), visible: r.width > 150 && r.height >= 40 && getComputedStyle(i).visibility !== 'hidden', billetes: [...o.querySelectorAll('[data-b]')].map(x => x.textContent) }; });
    chk('2. Al cobrar se ve «¿CON CUÁNTO PAGA EL CLIENTE?» grande, sin abrir nada', v.label === '¿CON CUÁNTO PAGA EL CLIENTE?' && !v.enDetails && v.visible, v);
    chk('2. Con «Pago exacto», los 6 billetes y ↺', v.billetes[0] === 'Pago exacto' && v.billetes.length === 8 && /\+\$\s?2\.000/.test(v.billetes[1]) && /\+\$\s?100\.000/.test(v.billetes[6]), v.billetes);
    await p.click('.pz-pago-ov [data-b="20000"]'); await p.click('.pz-pago-ov [data-b="20000"]');
    v = await estado();
    chk('3. Dos billetes de $20.000 se suman: recibe $40.000 → cambio $2.500', v.val === '40000' && /Cambio que debe devolver: \$\s?2\.500/.test(v.txt) && /vueltas/.test(v.cls), v);
    await p.fill('.pz-pago-ov .pz-pagacon', '50000');
    v = await estado();
    chk('3. Escrito a mano $50.000 → cambio $12.500 al instante', /\$\s?12\.500/.test(v.txt), v);
    await p.click('.pz-pago-ov [data-b="exacto"]'); v = await estado();
    chk('3. «Pago exacto» → «PAGO EXACTO»', /PAGO EXACTO/.test(v.txt) && v.val === '37500', v);
    await p.click('.pz-pago-ov [data-b="0"]'); v = await estado();
    chk('3. ↺ borra lo recibido', v.val === '' && !/Cambio|Faltan/.test(v.txt), v);

    // ===== 4. Inferior =====
    await p.fill('.pz-pago-ov .pz-pagacon', '20000');
    v = await estado();
    chk('4. $20.000 por $37.500 → «Faltan $17.500»', /Faltan \$\s?17\.500/.test(v.txt) && /falta/.test(v.cls), v);
    await p.click('.pz-pago-ov .pz-met[data-m="efectivo"]'); await p.waitForTimeout(300);
    v = await p.evaluate(() => ({ ventas: data.history.length, abierto: !!document.querySelector('.pz-pago-ov.show'), mixto: !document.querySelector('.pz-mixto-box').hidden, ef: document.querySelector('[data-mx="efectivo"]').value }));
    chk('4. Efectivo con lo recibido incompleto NO registra la venta; abre el pago mixto con los $20.000', v.ventas === 0 && v.abierto && v.mixto && v.ef === '20000', v);

    // ===== 5. Superior =====
    await p.fill('.pz-pago-ov .pz-pagacon', '50000');
    await p.click('.pz-pago-ov .pz-met[data-m="efectivo"]'); await p.waitForTimeout(400);
    v = await p.evaluate(() => { const h = data.history[0] || {}; const s = computeClosureStats(null, new Date(Date.now() + 1000).toISOString()); return { n: data.history.length, total: h.total, pagos: h.payments, rec: h.efectivoRecibido, vu: h.vueltas, ef: s.totalEfectivo, sold: s.totalSold }; });
    chk('5. Venta por el total ($37.500): pago en efectivo $37.500 con recibido $50.000 y vueltas $12.500', v.n === 1 && v.total === 37500 && v.pagos.length === 1 && v.pagos[0].amount === 37500 && v.pagos[0].recibido === 50000 && v.pagos[0].vueltas === 12500 && v.rec === 50000 && v.vu === 12500, v);
    chk('5. El cierre de caja cuenta $37.500 en efectivo (lo aplicado), no los $50.000 recibidos', v.ef === 37500 && v.sold === 37500, v);

    // ===== 6. Mixto =====
    await abrirCobro('c');
    await p.click('.pz-pago-ov .pz-mixto-btn');
    await p.fill('.pz-pago-ov [data-mx="efectivo"]', '50000'); await p.fill('.pz-pago-ov [data-mx="nequi"]', '30000');
    v = await p.evaluate(() => document.querySelector('.pz-mx-falta').textContent);
    chk('6. Mixto $50.000 efectivo + $30.000 Nequi por $80.000: «Completo»', /Completo/.test(v), v);
    await p.click('.pz-pago-ov .pz-mixto-ok'); await p.waitForTimeout(400);
    v = await p.evaluate(() => (data.history[0] || {}).payments);
    chk('6. … queda efectivo $50.000 + transferencia (Nequi) $30.000, sin vueltas', v && v.length === 2 && v.some(x => x.method === 'efectivo' && x.amount === 50000 && !x.vueltas) && v.some(x => x.method === 'transferencia' && x.amount === 30000), v);
    await abrirCobro('c');
    await p.click('.pz-pago-ov .pz-mixto-btn');
    await p.fill('.pz-pago-ov [data-mx="efectivo"]', '60000'); await p.fill('.pz-pago-ov [data-mx="nequi"]', '30000');
    await p.click('.pz-pago-ov .pz-mixto-ok'); await p.waitForTimeout(400);
    v = await p.evaluate(() => { const h = data.history[0]; return { pagos: h.payments, vu: h.vueltas, rec: h.efectivoRecibido }; });
    chk('6. Con $60.000 en efectivo: efectivo aplicado $50.000, vueltas $10.000 solo del efectivo, Nequi $30.000', v.pagos.some(x => x.method === 'efectivo' && x.amount === 50000 && x.recibido === 60000 && x.vueltas === 10000) && v.pagos.some(x => x.method === 'transferencia' && x.amount === 30000) && v.vu === 10000, v);

    // ===== 7. Cuenta (mesa) =====
    await p.evaluate(() => { data.tables[3] = { items: [{ productId: 'a', name: 'Almuerzo', price: 37500, qty: 1 }], payments: [], people: [] }; saveData(); openTableModal(3); });
    await p.waitForTimeout(400);
    await p.fill('#paymentAmount', '50000');
    v = await p.evaluate(() => document.querySelector('.pay-vu[data-vu="table"]').textContent);
    chk('7. Cuenta: al escribir $50.000 en efectivo ya dice «Cambio que debe devolver $12.500»', /Cambio que debe devolver: \$\s?12\.500/.test(v), v);
    await p.click('#addPaymentBtn'); await p.waitForTimeout(400);
    v = await p.evaluate(() => ({ pagos: data.tables[3].payments, saldo: tableBalance(3), toast: (document.getElementById('toast') || {}).textContent || '' }));
    chk('7. Se anota $37.500 (lo aplicado) con recibido $50.000 y vueltas $12.500; saldo $0', v.pagos.length === 1 && v.pagos[0].amount === 37500 && v.pagos[0].recibido === 50000 && v.pagos[0].vueltas === 12500 && v.saldo === 0 && /12\.500/.test(v.toast), v);
    await p.evaluate(() => { data.tables[4] = { items: [{ productId: 'a', name: 'Almuerzo', price: 37500, qty: 1 }], payments: [], people: [] }; saveData(); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); openTableModal(4); });
    await p.waitForTimeout(400);
    await p.evaluate(() => { const s = document.getElementById('paymentMethod'); s.value = 'transferencia'; s.dispatchEvent(new Event('change', { bubbles: true })); });
    await p.fill('#paymentAmount', '50000'); await p.click('#addPaymentBtn'); await p.waitForTimeout(300);
    const preg = await p.evaluate(() => { const o = document.getElementById('confirmOverlay'); return o && o.classList.contains('show') ? document.getElementById('confirmMessage').textContent : null; });
    await p.click('#confirmCancelBtn'); await p.waitForTimeout(300);
    v = await p.evaluate(() => data.tables[4].payments.length);
    chk('7. Transferencia de más: pregunta («no hay vueltas») y con «Corregir» no anota nada', /no hay vueltas/.test(preg || '') && v === 0, { preg, v });
    // Al cerrar, el historial guarda lo recibido y las vueltas
    v = await p.evaluate(() => { closeTableToHistory(3); const h = data.history.find(x => x.table === 3); return h && h.payments; });
    chk('7. Al cerrar la cuenta, el historial guarda el pago aplicado con lo recibido y las vueltas', v && v[0].amount === 37500 && v[0].recibido === 50000 && v[0].vueltas === 12500, v);

    // ===== 8. Ficha del producto =====
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); data.products.push({ id: 'g', name: 'Gaseosa', price: 10000, cost: 8000 }); data.margenObjetivo = 30; saveData(); openEditProductModal('g'); });
    await p.waitForTimeout(400);
    v = await p.evaluate(() => ({ txt: document.getElementById('editProdMarginLine').innerText, sug: document.getElementById('editProdSugeridos').innerText }));
    chk('8. Ficha: «Margen bruto 20 %» y «Recargo sobre el costo 25 %» por separado', /Margen bruto[^\n]*\n?\s*20/.test(v.txt) && /Recargo sobre el costo[^\n]*\n?\s*25/.test(v.txt), v.txt);
    chk('8. Precios sugeridos: no perder $8.000, margen 30 % $11.429, comercial $11.500', /8\.000/.test(v.sug) && /11\.429/.test(v.sug) && /11\.500/.test(v.sug), v.sug);
    await p.click('#editProdSugeridos [data-sug="com"]');
    v = await p.evaluate(() => ({ campo: document.getElementById('editProdPrice').value, guardado: data.products.find(x => x.id === 'g').price }));
    chk('8. «Usar» pone $11.500 en el campo, pero el precio guardado sigue en $10.000 hasta guardar', v.campo === '11500' && v.guardado === 10000, v);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
