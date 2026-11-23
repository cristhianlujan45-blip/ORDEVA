// ⚠️ 1.99.50 · Auditoría de los datos del dueño (23/11): una venta de $74.800 tenía pagos por $101.800 (se cobró aparte un
// producto de $27.000 y después se quitó de la cuenta). Contabilidad contaba plata que ya no era del negocio. Revisa:
//  1. Se quita un producto que ya estaba pagado: la cuenta avisa «Pagaron $27.000 de más».
//  2. «↩️ Ya se lo devolví» resta los $27.000 de los pagos; al cerrar, la venta y sus pagos cuadran ($74.800).
//  3. Lo fiado que sobra se ajusta solo (sin aviso): debía $50.000 fiado, se quita algo de $20.000 → queda debiendo $30.000.
//  4. «Dejar así» lo esconde y no vuelve a salir.
//  5. Una cuenta normal, o pagada en dólares con vueltas en pesos, no avisa nada.
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
    await p.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); window.showConfirm = async () => true; });
    const aviso = () => p.evaluate(() => { const a = document.getElementById('spAviso'); return a && !a.hidden && a.getClientRects().length ? a.textContent : ''; });
    const abrir = async (id, mesa) => { await p.evaluate(([id, mesa]) => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); data.tables[id] = mesa; saveData(); openTableModal(id); }, [id, mesa]); await p.waitForTimeout(500); };
    // 1
    await abrir(1, { items: [{ productId: 'a', name: 'Bulto concentrado', price: 27000, qty: 1, history: [] }, { productId: 'b', name: 'Abono orgánico', price: 74800, qty: 1, history: [] }], people: [],
      payments: [{ method: 'transferencia', amount: 27000, note: 'Nequi' }, { method: 'transferencia', amount: 74800, note: 'Nequi' }] });
    chk('5. Cuenta pagada justa: no avisa nada', !(await aviso()));
    await p.evaluate(() => document.querySelector('#itemsContainer .li-remove[data-idx="0"]').click()); await p.waitForTimeout(500);
    const a1 = await aviso();
    chk('1. Se quitó un producto ya pagado: «Pagaron $27.000 de más»', /Pagaron \$\s?27\.000 de más/.test(a1), a1);
    // 2
    await p.click('#spAviso [data-sp="devolver"]'); await p.waitForTimeout(400);
    const r2 = await p.evaluate(() => { const t = data.tables[1]; const e = closeTableToHistory(1); saveData(); return { total: e.total, pagos: e.payments.reduce((s, x) => s + x.amount, 0), nota: e.payments.map(x => x.note).join(' | ') }; });
    chk('2. «Ya se lo devolví»: al cerrar, la venta y sus pagos cuadran ($74.800)', r2.total === 74800 && r2.pagos === 74800 && /devuelto/.test(r2.nota), r2);
    // 3
    await abrir(2, { items: [{ productId: 'a', name: 'Semilla', price: 20000, qty: 1, history: [] }, { productId: 'b', name: 'Abono', price: 30000, qty: 1, history: [] }], people: [], payments: [{ method: 'debe', amount: 50000, note: 'Tania' }] });
    await p.evaluate(() => document.querySelector('#itemsContainer .li-remove[data-idx="0"]').click()); await p.waitForTimeout(500);
    const r3 = await p.evaluate(() => data.tables[2].payments.map(x => x.method + ':' + x.amount).join());
    chk('3. Lo fiado que sobra se ajusta solo: queda debiendo $30.000, sin aviso', r3 === 'debe:30000' && !(await aviso()), { r3, a: await aviso() });
    // 4
    await abrir(3, { items: [{ productId: 'a', name: 'Semilla', price: 10000, qty: 1, history: [] }], people: [], payments: [{ method: 'efectivo', amount: 15000, note: '' }] });
    chk('4. (cuenta con $5.000 de más avisa)', /5\.000 de más/.test(await aviso()));
    await p.click('#spAviso [data-sp="dejar"]'); await p.waitForTimeout(300);
    await p.evaluate(() => renderModalItems()); await p.waitForTimeout(300);
    chk('4. «Dejar así» lo esconde y no vuelve a salir', !(await aviso()));
    // 5 USD
    await abrir(4, { items: [{ productId: 'a', name: 'Semilla', price: 18000, qty: 1, history: [] }], people: [], payments: [{ method: 'usd', amount: 20000, vueltasCop: 2000, note: 'USD 5' }] });
    chk('5. Pagada en dólares con vueltas en pesos: no avisa', !(await aviso()));
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
