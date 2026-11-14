// 🧾 ORDEVA 1.99.0 · «Facturas» mejor organizadas (app/04g-productos-historial-caja.js).
//  1. Cada fila muestra el número y la forma de pago.
//  2. Las ventas salen por día, con cuántas facturas y el subtotal de cada día.
//  3. El buscador encuentra por número, cliente, producto y valor; el mes filtra; se combina con «Deben».
//  4. El libro de facturas (Excel) trae una fila por factura, solo las que se ven con el filtro.
//  5. «Borrar historial de un día» queda al final, lejos de «Cerrar caja». En 390 px nada se sale de lado.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  const pausa = ms => new Promise(r => setTimeout(r, ms));
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    { const m = new Date(2026, 10, 14, 15, 0, 0); await ctx.clock.setSystemTime(m); }
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await pausa(1000);
    await p.evaluate(() => { const s = document.getElementById('authType'); s.value = 'restaurante'; s.dispatchEvent(new Event('change')); });
    await p.fill('#authBiz', 'Fonda 199'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await pausa(1500);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await p.evaluate(() => {
      document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      const f = (d, h) => new Date(2026, 10, 14 - d, h, 0, 0).toISOString();
      const v = (id, d, h, mesa, total, pagos, extra) => Object.assign({ id, date: f(d, h), table: mesa, tableName: 'Mesa ' + mesa, items: [{ name: 'Bandeja paisa', qty: 1, price: total }], payments: pagos, total, debt: 0, by: 'ana' }, extra || {});
      data.history = [
        v('h1', 0, 13, 1, 32000, [{ method: 'efectivo', amount: 32000 }], { invoiceNo: 'F-105' }),
        v('h2', 0, 12, 2, 18500, [{ method: 'transferencia', amount: 18500, note: 'Nequi' }], { invoiceNo: 'F-104', person: 'Carlos Pérez' }),
        v('h3', 1, 20, 3, 50000, [{ method: 'debe', amount: 50000 }], { invoiceNo: 'F-103', debt: 50000, person: 'Doña Marta', items: [{ name: 'Sancocho', qty: 2, price: 25000 }] }),
        v('h4', 1, 19, 4, 12000, [{ method: 'efectivo', amount: 6000 }, { method: 'transferencia', amount: 6000, note: 'DaviPlata' }], {}),
        v('h5', 40, 13, 5, 77700, [{ method: 'efectivo', amount: 77700 }], { invoiceNo: 'F-050' })
      ];
      saveData();
    });
    await pausa(300);
    await p.evaluate(() => { if(!document.getElementById('view-historial').classList.contains('active')){ const b = document.querySelector('[data-view="historial"]'); b && b.click(); } renderHistorial(); });
    await pausa(300);
    let v = await p.evaluate(() => [...document.querySelectorAll('#histList .hist-row')].map(r => (r.querySelector('.hist-ref') || {}).textContent || ''));
    chk('1. Cada fila muestra el número y la forma de pago («N.º F-105 · Efectivo», «N.º F-104 · Nequi»)', v[0] === 'N.º F-105 · Efectivo' && v[1] === 'N.º F-104 · Nequi', v);
    chk('1. Una venta sin número muestra solo cómo pagaron («Efectivo + DaviPlata»); la fiada dice «Fiado»', v[3] === 'Efectivo + DaviPlata' && /F-103 · Fiado/.test(v[2]), v);
    v = await p.evaluate(() => [...document.querySelectorAll('#histList .hist-dia')].map(r => r.textContent));
    chk('2. Las ventas salen por día: «Hoy · 2 facturas $50.500», ayer con 2 y $62.000, y el día viejo con su año no hace falta', v.length === 3 && /^Hoy · 2 facturas/.test(v[0]) && /50\.500/.test(v[0]) && /^Viernes, 13 de noviembre · 2 facturas/.test(v[1]) && /62\.000/.test(v[1]) && /octubre · 1 factura/.test(v[2]), v);
    const busca = async q => { await p.fill('#histBuscar', q); await pausa(350); return p.evaluate(() => ({ n: document.querySelectorAll('#histList .hist-row').length, res: document.getElementById('histBuscarRes').hidden ? '' : document.getElementById('histBuscarRes').textContent, t: [...document.querySelectorAll('#histList .hist-row .hist-table')].map(x => x.textContent.trim()), vacio: (document.querySelector('#histList .empty-state') || {}).textContent || '' })); };
    v = await busca('F-104'); chk('3. Buscar por número «F-104» → una factura', v.n === 1 && /Carlos/.test(v.t[0]) && /^1 factura · /.test(v.res), v);
    v = await busca('marta'); chk('3. Buscar por cliente «marta» (sin tilde ni mayúscula) → Doña Marta', v.n === 1 && /Marta/.test(v.t[0]), v);
    v = await busca('sancocho'); chk('3. Buscar por producto «sancocho» → esa venta', v.n === 1 && /Marta/.test(v.t[0]), v);
    v = await busca('77.700'); chk('3. Buscar por valor «77.700» → la venta de $77.700', v.n === 1 && /Mesa 5/.test(v.t[0]), v);
    v = await busca('nequi'); chk('3. Buscar por forma de pago «nequi» → la de Nequi', v.n === 1 && /Carlos/.test(v.t[0]), v);
    v = await busca('zzzz'); chk('3. Sin resultados dice «No hay facturas con esa búsqueda.»', v.n === 0 && /No hay facturas con esa búsqueda/.test(v.vacio), v);
    await busca('');
    v = await p.evaluate(() => [...document.querySelectorAll('#histMes option')].map(o => o.value + '|' + o.textContent));
    chk('3. El selector trae solo los meses con ventas (noviembre y octubre de 2026)', v.length === 3 && /^2026-11\|noviembre de 2026/.test(v[1]) && /^2026-10\|octubre de 2026/.test(v[2]), v);
    await p.selectOption('#histMes', '2026-10'); await pausa(200);
    v = await p.evaluate(() => ({ n: document.querySelectorAll('#histList .hist-row').length, res: document.getElementById('histBuscarRes').textContent }));
    chk('3. Octubre: 1 factura · $77.700', v.n === 1 && /1 factura · .*77\.700/.test(v.res), v);
    await p.selectOption('#histMes', '2026-11'); await p.click('#histFilter [data-f="deben"]'); await pausa(200);
    v = await p.evaluate(() => ({ n: document.querySelectorAll('#histList .hist-row').length, t: (document.querySelector('#histList .hist-table') || {}).textContent }));
    chk('3. Noviembre + «Deben» → solo Doña Marta', v.n === 1 && /Marta/.test(v.t), v);
    await p.click('#histFilter [data-f="todos"]'); await pausa(200);
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 8000 }), p.click('#histLibro')]);
    const csv = require('fs').readFileSync(await dl.path(), 'utf8'), lin = csv.replace(/^﻿/, '').split('\r\n');
    chk('4. El libro de facturas baja como «facturas-Fonda-199-2026-11.csv» con encabezado y 4 filas (las de noviembre)', /^facturas-Fonda-199-2026-11\.csv$/.test(dl.suggestedFilename()) && lin.length === 5 && /^"Fecha";"Hora";"Número";"Mesa o cliente";"Productos";"Forma de pago";"Total"/.test(lin[0]), { n: dl.suggestedFilename(), lin });
    chk('4. … de la más vieja a la más nueva, con número, forma de pago, total y lo que queda debiendo', /"F-103";"Mesa 3 — Doña Marta";"Sancocho ×2";"Fiado";"50000";"0";"0";"50000";"ana"/.test(lin[2]) && /"F-105";"Mesa 1";"Bandeja paisa ×1";"Efectivo";"32000"/.test(lin[4]) && /""; ?"Mesa 4"|"";"Mesa 4"/.test(lin[1]), lin);
    await p.selectOption('#histMes', ''); await pausa(200);
    v = await p.evaluate(() => { const c = document.getElementById('closeDayBtn').getBoundingClientRect(), d = document.getElementById('deleteHistoryDayBtn').getBoundingClientRect(), l = document.getElementById('histList').getBoundingClientRect(), i = document.getElementById('histBuscar').getBoundingClientRect();
      return { abajo: d.top > l.bottom - 1 && d.top > c.bottom + 200, ancho: document.documentElement.scrollWidth <= window.innerWidth + 1, alto: Math.round(i.height), detalle: (() => { const r = document.querySelector('#histList .hist-row .hist-row-top'); r.click(); return document.querySelector('#histList .hist-row').classList.contains('expanded'); })() }; });
    chk('5. «Borrar historial de un día» queda al final, debajo de la lista y lejos de «Cerrar caja»', v.abajo, v);
    chk('5. En 390 px nada se sale de lado, el buscador mide 44 px o más y la fila se sigue abriendo al tocarla', v.ancho && v.alto >= 44 && v.detalle, v);
    v = await p.evaluate(() => { const a = JSON.stringify(data.history.map(h => [h.id, h.total, h.invoiceNo || '', h.debt])); return a; });
    chk('5. Buscar, filtrar y descargar no cambian ninguna venta', v === JSON.stringify([['h1', 32000, 'F-105', 0], ['h2', 18500, 'F-104', 0], ['h3', 50000, 'F-103', 50000], ['h4', 12000, '', 0], ['h5', 77700, 'F-050', 0]]), v);
    // ===== 6. La cuenta de la mesa (auditoría de diseño) =====
    v = await p.evaluate(async () => {
      data.products = [{ id: 'bp', name: 'Bandeja paisa', price: 28000 }]; data.tables = data.tables || {};
      data.tables[1] = Object.assign(data.tables[1] || {}, { items: [{ productId: 'bp', name: 'Bandeja paisa', price: 28000, qty: 1, personId: null, history: [{ qty: 1, at: Date.now() }] }], payments: [] });
      await saveData(); const b = document.querySelector('nav button[data-view="mesas"]'); b && b.click(); openTableModal(1); await new Promise(r => setTimeout(r, 700));
      const r = e => e ? e.getBoundingClientRect() : null, m = r(document.querySelector('#overlay .modal')), c = r(document.getElementById('vsCobrar')), f = r(document.getElementById('voiceFabWrap'));
      const t = s => [...document.querySelectorAll('#overlay ' + s)].filter(e => e.offsetParent).map(e => { const x = e.getBoundingClientRect(); return Math.round(Math.min(x.width, x.height)); });
      return { vs: document.body.classList.contains('vs-on'), pie: c && m ? Math.round(m.bottom - c.bottom) : null, fabSobre: c && f ? f.bottom <= c.top + 1 || f.top >= c.bottom : null, qty: t('.li-qty-btn'), quitar: t('.li-remove'), reloj: t('.li-clock'), ancho: document.documentElement.scrollWidth <= window.innerWidth + 1 };
    });
    chk('6. En la cuenta de la mesa la barra «Falta por pagar · Cobrar» es el pie de la ventana (antes flotaba 120 px arriba)', v.vs && v.pie != null && v.pie >= 0 && v.pie <= 12, v);
    chk('6. El micrófono no queda encima de la barra de cobrar', v.fabSobre === true, v);
    chk('6. En el celular − / +, el reloj y la ✕ de cada producto miden 44 px o más', v.qty.length === 2 && v.qty.every(x => x >= 44) && v.quitar.every(x => x >= 44) && v.reloj.every(x => x >= 44) && v.ancho, v);
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.message)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
