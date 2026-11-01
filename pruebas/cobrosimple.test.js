// 💰 ORDEVA 1.72.5 · Cobrar una cuenta en un solo paso. Pedido del dueño: «simplifica el cobro». Sin internet.
// Antes: «Cobrar todo y liberar mesa» (sin vuelto), el cuadro «Registrar un pago o abono» y el «Cobrar» de abajo (que solo
// llenaba el cuadro). Ahora un solo «Cobrar» abre la ventana de cobro de la Caja POS y deja la mesa cobrada y libre.
//  1. Un solo «Cobrar» a la vista; el botón de la cuenta dice cuánto («💰 Cobrar $35.500»); abonos plegados.
//  2. Efectivo con «¿con cuánto paga?» 50.000 → vuelto $14.500; la mesa queda libre; «Deshacer» la devuelve.
//  3. Nequi. 4. Fiado con el nombre (va a la libreta). 5. Mixto (efectivo + Nequi).
//  6. Un abono por el cuadro plegado y después «Cobrar» lo que falta.  7. Ya pagaron todo: «Cerrar la cuenta».
//  8. Con propina activada: primero la propina, después el cobro.  9. Cancelar el cobro no cambia nada.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  const pausa = ms => new Promise(r => setTimeout(r, ms));
  try{
    const ctx = await b.newContext({ viewport: { width: 1366, height: 800 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await pausa(1000);
    await p.evaluate(() => { const s = document.getElementById('authType'); s.value = 'bar'; s.dispatchEvent(new Event('change')); });
    await p.fill('#authBiz', 'Bar La 45'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await pausa(1500);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); data.products = [{ id: 'a', name: 'Águila', price: 3500 }, { id: 'k', name: 'Picada', price: 25000 }]; data.history = []; saveData(); });
    const abrir = (n) => p.evaluate(n => { document.querySelectorAll('.overlay.show').forEach(o => { if(o.id !== 'overlay') o.classList.remove('show'); }); openTableModal(n); if(!(data.tables[n].items || []).length){ addFavoriteToTable('a'); addFavoriteToTable('a'); addFavoriteToTable('a'); addFavoriteToTable('k'); } }, n).then(() => pausa(700));
    const cobrar = () => p.evaluate(() => { const b = [document.getElementById('vsCobrarBtn'), document.getElementById('chargeBtn')].find(x => x && x.offsetParent); b.click(); }).then(() => pausa(600));
    const ventana = () => p.evaluate(() => { const v = document.querySelector('.pz-pago-ov.show'); return v ? v.innerText.replace(/\s+/g, ' ') : ''; });
    const ult = () => p.evaluate(() => { const h = data.history[0] || {}; return { total: h.total, debt: h.debt, person: h.person, pagos: (h.payments || []).map(x => x.method + ':' + x.amount + (x.vueltas ? ':v' + x.vueltas : '') + ':' + x.note), n: data.history.length }; });
    const libre = n => p.evaluate(n => !(data.tables[n].items || []).length && !document.getElementById('overlay').classList.contains('show'), n);
    // ===== 1 =====
    await abrir(1);
    let v = await p.evaluate(() => { const vis = id => { const e = document.getElementById(id); return !!e && e.offsetParent !== null; };
      return { vs: vis('vsCobrarBtn'), izq: vis('chargeBtn'), txt: document.getElementById('chargeBtn').textContent, abono: vis('csAbono'), cuadro: vis('paymentAmount'),
        cobrares: [...document.querySelectorAll('#overlay.show button')].filter(b => b.offsetParent && /cobrar/i.test(b.textContent)).length }; });
    chk('1. Un solo «Cobrar» a la vista (antes 2 botones de cobrar y el cuadro)', v.cobrares === 1 && v.vs && !v.izq, v);
    chk('1. El botón de la cuenta dice cuánto: «💰 Cobrar $35.500»', /💰 Cobrar \$\s?35\.500/.test(v.txt), v.txt);
    chk('1. Abonos y dividir: plegados en «➕ Abono o dividir la cuenta»', v.abono && !v.cuadro, v);
    // ===== 2 =====
    await cobrar();
    v = await ventana();
    chk('2. «Cobrar» abre la ventana de cobro de la Caja con $35.500 y todos los medios', /35\.500/.test(v) && /Nequi/.test(v) && /DaviPlata/.test(v) && /Tarjeta/.test(v) && /debiendo|fiado/i.test(v), v.slice(0, 300));
    await p.fill('#pzPagaCon', '50000'); await pausa(200);
    chk('2. Con cuánto paga 50.000 → vuelto $14.500 en grande', /14\.500/.test(await ventana()));
    await p.click('.pz-pago-ov .pz-met[data-m="efectivo"]'); await pausa(800);
    v = await ult();
    chk('2. Cobrada en efectivo con el vuelto anotado, y la mesa queda libre', v.n === 1 && v.total === 35500 && /^efectivo:35500:v14500/.test(v.pagos[0]) && await libre(1), v);
    chk('2. Aviso «✅ Cobrado $35.500 · Mesa 1 · Vueltas $14.500» con «Deshacer»', await p.evaluate(() => [...document.querySelectorAll('.pz-dmsg')].some(x => /Cobrado.*35\.500.*Mesa 1.*Vueltas.*14\.500/.test(x.innerText))));
    await p.evaluate(() => { const b = [...document.querySelectorAll('.pz-dbtn')].find(x => x.offsetParent); b && b.click(); }); await pausa(500);
    chk('2. «Deshacer» devuelve la mesa como estaba', await p.evaluate(() => data.history.length === 0 && (data.tables[1].items || []).length === 2));
    // ===== 3 =====
    await abrir(1); await cobrar();
    await p.click('.pz-pago-ov .pz-met[data-m="nequi"]'); await pausa(800);
    v = await ult();
    chk('3. Nequi: transferencia «Nequi» y la mesa libre', v.total === 35500 && /^transferencia:35500:.*Nequi/.test(v.pagos[0]) && await libre(1), v);
    // ===== 4 =====
    await abrir(2); await cobrar();
    await p.click('.pz-pago-ov .pz-fiado'); await p.fill('.pz-pago-ov .pz-deudor', 'Don Pedro'); await p.click('.pz-pago-ov .pz-fiado-ok'); await pausa(800);
    v = await ult();
    chk('4. Fiado: queda debiendo $35.500 a nombre de Don Pedro (va a la libreta)', v.total === 35500 && v.debt === 35500 && v.person === 'Don Pedro' && /^debe:35500:Don Pedro/.test(v.pagos[0]) && await libre(2), v);
    // ===== 5 =====
    await abrir(3); await cobrar();
    await p.click('.pz-pago-ov .pz-mixto-btn'); await p.fill('.pz-pago-ov [data-mx="efectivo"]', '20000'); await p.fill('.pz-pago-ov [data-mx="nequi"]', '15500'); await pausa(150);
    await p.click('.pz-pago-ov .pz-mixto-ok'); await pausa(800);
    v = await ult();
    chk('5. Mixto: $20.000 en efectivo + $15.500 por Nequi, sin deuda', v.total === 35500 && !v.debt && v.pagos.length === 2 && v.pagos.some(x => /^efectivo:20000/.test(x)) && v.pagos.some(x => /^transferencia:15500/.test(x)) && await libre(3), v);
    // ===== 6 =====
    await abrir(4);
    await p.click('#csAbono'); await pausa(200);
    await p.fill('#paymentAmount', '10000'); await p.click('#addPaymentBtn'); await pausa(500);
    v = await p.evaluate(() => ({ saldo: tableBalance(4), txt: document.getElementById('chargeBtn').textContent }));
    chk('6. Abono de $10.000 por el cuadro plegado: «Cobrar $25.500»', v.saldo === 25500 && /25\.500/.test(v.txt), v);
    await cobrar();
    chk('6. «Cobrar» pide solo lo que falta ($25.500)', /25\.500/.test(await ventana()));
    await p.click('.pz-pago-ov .pz-met[data-m="efectivo"]'); await pausa(800);
    v = await ult();
    chk('6. Venta de $35.500 con el abono y el resto, mesa libre', v.total === 35500 && v.pagos.length === 2 && !v.debt && await libre(4), v);
    // ===== 7 =====
    await abrir(2);
    await p.evaluate(() => { data.tables[2].payments = [{ note: 'abono', amount: 35500, method: 'efectivo', at: Date.now() }]; saveData(); renderModalItems(); }); await pausa(500);
    v = await p.evaluate(() => document.getElementById('chargeBtn').textContent);
    chk('7. Ya pagaron todo con abonos: «✅ Cerrar la cuenta (ya pagaron)»', /Cerrar la cuenta/.test(v), v);
    await cobrar(); await p.click('#confirmOkBtn'); await pausa(500);
    chk('7. Se cierra sin pedir otro pago', (await ult()).total === 35500 && await libre(2));
    // ===== 8 =====
    await p.evaluate(() => { data.tipsOn = true; saveData(); });
    await abrir(3); await cobrar();
    chk('8. Con propina activada: primero pregunta la propina', await p.evaluate(() => !!document.querySelector('button[data-v="3550"]')));
    await p.click('button[data-v="3550"]'); await pausa(700);
    chk('8. …y después el cobro con la propina incluida ($39.050)', /39\.050/.test(await ventana()));
    await p.click('.pz-pago-ov .pz-met[data-m="efectivo"]'); await pausa(800);
    chk('8. Cobrada con la propina', (await ult()).total === 39050 && await libre(3), await ult());
    await p.evaluate(() => { data.tipsOn = false; saveData(); });
    // ===== 9 =====
    await abrir(1); const h0 = await p.evaluate(() => data.history.length);
    await cobrar(); await p.click('.pz-pago-ov .pz-cancel'); await pausa(400);
    chk('9. Cancelar el cobro: la mesa sigue abierta y no se registra nada', await p.evaluate(h0 => data.history.length === h0 && (data.tables[1].items || []).length === 2 && document.getElementById('overlay').classList.contains('show'), h0));
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ Excepción: ' + (e && e.stack || e)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
