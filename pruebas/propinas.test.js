// 🤝 ORDEVA 1.82.0 · La propina NO es venta (es de los empleados, Ley 1935 de 2018). Antes sumaba a «Vendido», a las
// entradas por ventas de Contabilidad y al cierre de caja.
//  1. Se cobra una mesa de $35.500 con propina de $3.550 en efectivo: el cliente paga $39.050 (igual que antes).
//  2. Cierre de caja: «Total vendido» $35.500 (sin la propina) y aparte «🤝 Propinas (de los empleados)» $3.550, con lo
//     de quien cobró; el efectivo que debe haber en la caja sí incluye la propina (la plata está ahí).
//  3. Contabilidad: «Vendido» $35.500; la propina sale aparte (🤝) y no cuenta como venta ni ganancia; lo cobrado en
//     ventas es $35.500. En el Excel la fila dice «Propina (de los empleados)».
//  4. Ventas viejas (de antes de esta versión) con «🙏 Propina» también se separan.
//  5. Inicio: «Ventas» de hoy sin la propina.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
  const pausa = ms => new Promise(r => setTimeout(r, ms));
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await pausa(1000);
    await p.evaluate(() => { const s = document.getElementById('authType'); s.value = 'bar'; s.dispatchEvent(new Event('change')); });
    await p.fill('#authBiz', 'Bar Propinas'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await pausa(1500);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); data.products = [{ id: 'a', name: 'Águila', price: 3500 }, { id: 'k', name: 'Picada', price: 25000 }]; data.history = []; data.closures = []; data.tipsOn = true; saveData(); });
    // ===== 1 =====
    await p.evaluate(() => { openTableModal(3); addFavoriteToTable('a'); addFavoriteToTable('a'); addFavoriteToTable('a'); addFavoriteToTable('k'); }); await pausa(700);
    await p.evaluate(() => { const b = [document.getElementById('vsCobrarBtn'), document.getElementById('chargeBtn')].find(x => x && x.offsetParent); b.click(); }); await pausa(600);
    await p.click('button[data-v="3550"]'); await pausa(700);
    await p.click('.pz-pago-ov .pz-met[data-m="efectivo"]'); await pausa(900);
    let v = await p.evaluate(() => { const h = data.history[0] || {}; return { total: h.total, pagado: (h.payments || []).reduce((s, x) => s + x.amount, 0), propina: window.propinaDe ? window.propinaDe(h) : null }; });
    chk('1. El cliente paga $39.050 (cuenta $35.500 + propina $3.550), como antes', v.total === 39050 && v.pagado === 39050, v);
    chk('1. ORDEVA reconoce la propina de esa venta ($3.550)', v.propina === 3550, v);
    // ===== 5 =====
    v = await p.evaluate(() => { try{ document.querySelector('nav button[data-view="inicio"]') && document.querySelector('nav button[data-view="inicio"]').click(); }catch(e){} return new Promise(r => setTimeout(() => r((document.getElementById('o2KVentas') || {}).textContent || ''), 700)); });
    chk('5. Inicio: «Ventas» de hoy $35.500 (sin la propina)', !v || (/35\.500/.test(v) && !/39\.050/.test(v)), v);
    // ===== 2 =====
    v = await p.evaluate(async () => { await closeCashRegister({ auto: true }); const c = data.closures[0]; return { vendido: c.totalSold, prop: c.totalPropinas, por: c.propinas, efectivo: c.totalEfectivo, txt: buildClosureText(c), pantalla: (document.getElementById('closureReportBody') || {}).textContent || '' }; });
    chk('2. Cierre: «Total vendido» $35.500 (sin la propina)', v.vendido === 35500 && /Total vendido: \$\s?35\.500/.test(v.txt), { vendido: v.vendido, txt: v.txt.slice(0, 300) });
    chk('2. Cierre: «🤝 Propinas (de los empleados)» $3.550 aparte, con quien cobró', v.prop === 3550 && /Propinas \(de los empleados[^)]*\): \$\s?3\.550/.test(v.txt) && v.por && v.por.ana === 3550, v);
    chk('2. Pantalla del cierre: la línea de propinas', /Propinas/.test(v.pantalla) && /3\.550/.test(v.pantalla), v.pantalla.slice(0, 300));
    chk('2. El efectivo que debe haber sí incluye la propina ($39.050: la plata está en la caja)', v.efectivo === 39050, v);
    // ===== 3 =====
    v = await p.evaluate(() => { const i = new Date(); i.setHours(0, 0, 0, 0); const x = ctMovimientos({ ini: i.getTime(), fin: Date.now() + 1000 });
      const s = t => x.mov.filter(m => m.tipo === t).reduce((a, m) => a + m.monto, 0); return { vendido: x.vendido, ventas: s('venta'), propinas: s('propina') }; });
    chk('3. Contabilidad: «Vendido» $35.500 y lo cobrado en ventas $35.500', v.vendido === 35500 && v.ventas === 35500, v);
    chk('3. Contabilidad: la propina sale aparte ($3.550), no como venta', v.propinas === 3550, v);
    v = await p.evaluate(() => { try{ document.querySelector('nav button[data-view="contabilidad"], [data-view="contabilidad"]') && document.querySelector('[data-view="contabilidad"]').click(); }catch(e){} return new Promise(r => setTimeout(() => r((document.getElementById('ctKpis') || {}).textContent || ''), 700)); });
    chk('3. En la pantalla de Contabilidad sale «🤝 Propinas»', !v || /Propinas/.test(v), v.slice(0, 300));
    // ===== 4 =====
    v = await p.evaluate(async () => {
      data.history.unshift({ id: 'viejo-1', table: 5, total: 22000, payments: [{ method: 'transferencia', amount: 22000 }], debt: 0, date: new Date().toISOString(), by: 'luis',
        items: [{ name: 'Picada', qty: 1, price: 20000 }, { name: '🙏 Propina', qty: 1, price: 2000 }] });
      saveData(); await closeCashRegister({ auto: true }); const c = data.closures[0]; return { vendido: c.totalSold, prop: c.totalPropinas, por: c.propinas }; });
    chk('4. Una venta vieja con «🙏 Propina» también se separa ($20.000 vendido, $2.000 de propina para luis)', v.vendido === 20000 && v.prop === 2000 && v.por.luis === 2000, v);
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ Excepción: ' + (e && e.stack || e)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
