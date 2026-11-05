// ✈️ ORDEVA 1.82.0 · Agencias de viajes: cupos reales, viajeros y voucher con RNT. Sin internet.
//  1. Plan «San Andrés 4 días» con 3 cupos: se venden 2 (cobrados) y 1 queda en otra cuenta abierta → ya no deja agregar
//     otro: «ya no tiene cupos». Otro plan sin cupos puestos se agrega sin límite.
//  2. «🎫 Voucher y viajeros» en la cuenta: 2 viajeros (nombre, documento, nacimiento, contacto de emergencia).
//  3. El voucher: plan con destino, salida, incluye y no incluye; los viajeros; total, pagado y saldo; y el RNT.
//  4. Sin RNT puesto avisa que falta. RNT en Ajustes → Facturación: sale también en el recibo.
//  5. Al cobrar, los viajeros quedan guardados con la venta.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  const pausa = ms => new Promise(r => setTimeout(r, ms));
  try{
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await pausa(1000);
    await p.evaluate(() => { const s = document.getElementById('authType'); if(s){ s.value = 'agencia_viajes'; s.dispatchEvent(new Event('change')); } });
    await p.fill('#authBiz', 'Viajes Caribe'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn');
    await p.waitForFunction(() => document.getElementById('authOverlay').hidden, null, { timeout: 15000 });
    await p.click('#onbSaltar', { timeout: 4000 }).catch(() => {});
    await p.waitForFunction(() => !!window.ventoAgencia, null, { timeout: 10000 });
    await pausa(700);
    let v = await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.products = [{ id: 'sa', name: 'San Andrés 4 días', price: 1500000, det: { destino: 'San Andrés', dias: '4 días, 3 noches', salida: '15 de diciembre', incluye: 'Vuelo, hotel y traslados', noincluye: 'Tarjeta de turismo', cupos: '3' } },
        { id: 'gu', name: 'Tour Guatapé', price: 120000, det: { destino: 'Guatapé', salida: 'Todos los sábados' } }];
      data.history = [{ id: 'h1', table: 1, total: 3000000, payments: [{ method: 'transferencia', amount: 3000000 }], debt: 0, date: new Date().toISOString(), items: [{ name: 'San Andrés 4 días', qty: 2, price: 1500000 }] }];
      Object.keys(data.tables).forEach(k => { data.tables[k].items = []; }); data.rnt = ''; saveData();
      return { tipo: data.businessType, mesas: Object.keys(data.tables).length }; });
    // ===== 1 =====
    v = await p.evaluate(() => { openTableModal(1); addFavoriteToTable('sa'); const a = (data.tables[1].items || []).length;
      openTableModal(2); addFavoriteToTable('sa'); const b = (data.tables[2].items || []).length; addFavoriteToTable('gu'); addFavoriteToTable('gu');
      return { a, b, gu: (data.tables[2].items || []).filter(i => i.productId === 'gu').reduce((s, i) => s + i.qty, 0), c: window.ventoAgencia.cupos(data.products[0]) }; });
    chk('1. Con 2 vendidos y 3 cupos: la 3.ª va a una cuenta', v.a === 1, v);
    chk('1. Ya no deja agregar una 4.ª: «ya no tiene cupos»', v.b === 0 && v.c.quedan === 0, v);
    chk('1. Un plan sin cupos puestos se agrega sin límite (2 Tour Guatapé)', v.gu === 2, v);
    // ===== 2 =====
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); openTableModal(1); });
    await p.waitForFunction(() => { const b = document.getElementById('agVoucherBtn'); return b && !b.hidden; }, null, { timeout: 5000 }).catch(() => {});
    chk('2. En la cuenta sale «🎫 Voucher y viajeros»', await p.evaluate(() => { const b = document.getElementById('agVoucherBtn'); return !!b && !b.hidden; }));
    await p.click('#agVoucherBtn'); await pausa(300);
    v = await p.evaluate(() => (document.getElementById('agOv') || {}).textContent || '');
    chk('4. Sin RNT avisa que falta', /Falta el RNT/.test(v), v.slice(0, 200));
    const llenar = async (i, vals) => { for(const [k, x] of Object.entries(vals)){ await p.fill('#agOv .ag-v[data-i="' + i + '"] [data-k="' + k + '"]', x); } };
    await llenar(0, { nombre: 'Laura Gómez', doc: 'CC 1020304050', nacimiento: '12/03/1990', emergencia: 'Pedro Gómez 3001112233' });
    await p.click('#agOv [data-ag="mas"]'); await pausa(200);
    await llenar(1, { nombre: 'Mateo Gómez', doc: 'TI 1122334455', nacimiento: '05/08/2012', emergencia: 'Pedro Gómez 3001112233' });
    await p.evaluate(() => document.querySelector('#agOv [data-ag="x"]').click());
    v = await p.evaluate(() => data.tables[1].viajeros);
    chk('2. Quedan 2 viajeros con documento, nacimiento y contacto de emergencia', v.length === 2 && v[0].doc === 'CC 1020304050' && v[1].nacimiento === '05/08/2012' && /3001112233/.test(v[0].emergencia), v);
    // ===== 4 (RNT) =====
    await p.evaluate(() => { document.querySelector('nav button[data-view="ajustes"]').click(); });
    await pausa(400);
    await p.evaluate(() => { const i = document.getElementById('bizRntInput'); i.value = '98765'; i.dispatchEvent(new Event('blur')); });
    chk('4. RNT en Ajustes → Facturación', await p.evaluate(() => data.rnt === '98765'));
    // ===== 3 =====
    v = await p.evaluate(() => { const d = window.ventoAgencia.datosVoucher(1); return { txt: window.ventoAgencia.voucherTexto(d), html: window.ventoAgencia.voucherHtml(d), recibo: buildReceiptText(currentTableReceiptData ? (currentTable = 1, currentTableReceiptData()) : {}) }; });
    chk('3. Voucher: el plan con destino, salida, incluye y no incluye', /San Andrés 4 días/.test(v.txt) && /Salida: 15 de diciembre/.test(v.txt) && /Incluye: Vuelo, hotel y traslados/.test(v.txt) && /No incluye: Tarjeta de turismo/.test(v.txt), v.txt);
    chk('3. Voucher: los 2 viajeros con su documento y contacto de emergencia', /Laura Gómez · CC 1020304050/.test(v.txt) && /Mateo Gómez · TI 1122334455/.test(v.txt) && /emergencia: Pedro Gómez/.test(v.txt), v.txt);
    chk('3. Voucher: total $1.500.000 y saldo por pagar, y el RNT 98765', /Total: \$\s?1\.500\.000/.test(v.txt) && /Saldo por pagar: \$\s?1\.500\.000/.test(v.txt) && /RNT: 98765/.test(v.txt) && /RNT 98765/.test(v.html), v.txt);
    chk('4. El recibo también dice «RNT: 98765»', /RNT: 98765/.test(v.recibo), v.recibo.slice(0, 300));
    // ===== 5 =====
    v = await p.evaluate(() => { closeTableToHistory(1); const h = data.history[0]; return { viajeros: (h.viajeros || []).map(x => x.nombre), mesa: data.tables[1].viajeros }; });
    chk('5. Al cobrar, los viajeros quedan con la venta (y la cuenta queda limpia)', v.viajeros.join(',') === 'Laura Gómez,Mateo Gómez' && !v.mesa, v);
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ Excepción: ' + (e && e.stack || e)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
