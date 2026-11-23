// 💵 1.99.46 · Auditoría del cuadre de caja y la contabilidad (pedido del dueño, 23/11). Lo que pagan de un FIADO en
// efectivo entra al cajón, pero el cuadre solo contaba las ventas del día: al contar salían «sobran $30.000». Y «Pagó»
// en el Historial pasaba TODO lo fiado a pagado aunque ya hubiera abonado una parte: Contabilidad contaba el abono dos veces.
//  1. Caja abierta con $100.000 y una venta de $10.000 en efectivo: debe haber $110.000.
//  2. «Juan me pagó 30000» en la libreta: entra a la caja («Fiado cobrado · Juan») → debe haber $140.000.
//  3. «Me equivoqué» borra el abono Y su entrada de caja → $110.000, y Juan vuelve a deber $30.000.
//  4. Rosa debía $40.000, abonó $10.000 en la libreta y luego «✅ Ya pagó (efectivo)» en el Historial: solo se cobran los
//     $30.000 que faltaban → debe haber $150.000; Contabilidad de hoy: fiados cobrados $40.000 (no $50.000).
//  5. Pagado por transferencia: no entra a la caja del efectivo. Sin caja abierta, un abono no abre ninguna.
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
      const ayer = new Date(Date.now() - 864e5).toISOString(), f = (id, n, m) => ({ id, invoiceNo: 'FV-' + id, date: ayer, table: 1, total: m, debt: m, items: [{ name: 'Cerveza', price: m, qty: 1 }], payments: [{ method: 'debe', amount: m, note: n }] });
      data.history = [f('f1', 'Juan', 30000), f('f2', 'Rosa', 40000), f('f3', 'Ana', 15000), f('f4', 'Luis', 8000)]; data.libreta = { movs: [] }; data.turno = null; saveData(); });
    const esp = () => p.evaluate(() => ventoTurno.resumen().esperado);
    // 5b. Sin caja abierta
    await p.evaluate(() => window.libretaEntender('Luis me pagó 8000')); await p.waitForTimeout(200);
    chk('5. Sin caja abierta, un abono no abre ninguna', await p.evaluate(() => !ventoTurno.turno() && window.libretaSaldo('Luis') === 0));
    // 1
    await p.evaluate(() => { ventoTurno.abrir(100000); data.history.push({ id: 'v1', invoiceNo: 'FV-v1', date: new Date(Date.now() + 50).toISOString(), table: 3, total: 10000, items: [{ name: 'Cerveza', price: 5000, qty: 2 }], payments: [{ method: 'efectivo', amount: 10000 }] }); saveData(); });
    chk('1. Caja con $100.000 y una venta de $10.000: debe haber $110.000', (await esp()) === 110000, await esp());
    // 2
    await p.evaluate(() => window.libretaEntender('Juan me pagó 30000')); await p.waitForTimeout(200);
    const m2 = await p.evaluate(() => ventoTurno.resumen().movs.map(m => m.tipo + ':' + m.monto + ':' + m.motivo));
    chk('2. «Juan me pagó 30000» entra a la caja («Fiado cobrado · Juan») → $140.000', (await esp()) === 140000 && m2.includes('entrada:30000:Fiado cobrado · Juan'), { esp: await esp(), m2 });
    // 3
    await p.evaluate(() => window.libretaEntender('me equivoqué')); await p.waitForTimeout(200);
    chk('3. «Me equivoqué» borra el abono y su entrada de caja → $110.000, Juan vuelve a deber $30.000', (await esp()) === 110000 && await p.evaluate(() => window.libretaSaldo('Juan') === 30000 && !ventoTurno.resumen().movs.length), { esp: await esp() });
    // 4
    await p.evaluate(() => window.libretaEntender('Rosa me pagó 10000')); await p.waitForTimeout(200);
    await p.evaluate(() => pagarDeuda(data.history.find(h => h.id === 'f2'), 'efectivo')); await p.waitForTimeout(200);
    const r4 = await p.evaluate(() => { const h = data.history.find(x => x.id === 'f2'), d0 = new Date(); d0.setHours(0, 0, 0, 0);
      const fi = ctMovimientos({ ini: d0.getTime(), fin: Date.now() + 1000 }).mov.filter(m => /Fiado cobrado/.test(m.desc || '') && /Rosa|Mesa|FV-f2|Cuenta/.test(m.desc || '') || /Rosa/.test(m.desc || ''));
      return { esp: ventoTurno.resumen().esperado, debt: h.debt, pagos: h.payments.map(x => x.method + ':' + x.amount), rosa: window.libretaSaldo('Rosa'), conta: fi.map(m => m.monto + ':' + m.desc), sum: fi.reduce((a, m) => a + m.monto, 0) }; });
    chk('4. Rosa: «Ya pagó (efectivo)» cobra solo los $30.000 que faltaban → debe haber $150.000', r4.esp === 150000 && r4.debt === 0 && r4.rosa === 0 && r4.pagos.includes('efectivo:30000'), r4);
    chk('4. … Contabilidad de hoy: lo cobrado de Rosa suma $40.000 (no $50.000)', r4.sum === 40000, r4);
    // 5a. Transferencia
    await p.evaluate(() => pagarDeuda(data.history.find(h => h.id === 'f3'), 'transferencia')); await p.waitForTimeout(200);
    chk('5. Pagado por transferencia: no entra a la caja del efectivo', (await esp()) === 150000, await esp());
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
