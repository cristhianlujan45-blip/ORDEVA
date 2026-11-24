// 🚫 1.99.55 · Anular una factura de proveedor aplicada por error (por ejemplo, escaneada y aplicada dos veces).
// Antes no había cómo: el inventario quedaba inflado y el gasto contado doble. Revisa:
//  1. Desde «📚 Facturas anteriores» → la factura repetida → «🚫 Anular esta factura» (motivo) → sale de las compras.
//  2. El inventario baja lo que la factura sumó; si ya no alcanza, queda en 0 (no negativo).
//  3. Sus movimientos de inventario y su lote con vencimiento se quitan; los de la otra factura quedan.
//  4. Contabilidad: la compra deja de contar como gasto (queda una sola).
//  5. El pago de la libreta enlazado a la repetida pasa a la factura buena (no se cuenta dos veces).
//  6. Queda en data.anuladas (tipo 'compra') y se ve en Historial → «Anuladas».
//  7. Si otro equipo todavía la tiene, al juntar los datos no vuelve (ventoQuitarAnuladas).
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
    await p.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); window.speakVoice = () => {};
      const t1 = Date.now() - 3 * 864e5, t2 = Date.now() - 2 * 864e5;
      const item = (id, name, qty, cost) => ({ productId: id, name, qty, cost, total: qty * cost, subtotal: qty * cost, ivaTotal: 0 });
      const compra = (t, n) => ({ id: String(t), supplier: 'Agro Sur', date: new Date(t).toISOString().slice(0, 10), invoiceNumber: 'AS-77', items: [item('pa', 'Concentrado', 10, 1000), item('pb', 'Vacuna', 4, 5000)],
        total: 30000, subtotal: 30000, ivaTotal: 0, header: {}, procesadaEn: new Date(t + 800).toISOString(), at: new Date(t + 800).toISOString(), n });
      data.products = [{ id: 'pa', name: 'Concentrado', price: 1500, cost: 1000, stock: 25, lotes: [{ id: 'l1', q: 10, vence: '2027-01-01', t: t1 + 300, costo: 1000 }, { id: 'l2', q: 10, vence: '2027-02-01', t: t2 + 300, costo: 1000, compra: String(t2) }] },
                       { id: 'pb', name: 'Vacuna', price: 8000, cost: 5000, stock: 3 }];
      data.purchases = [compra(t2, 2), compra(t1, 1)];
      data.inventarioMov = [{ id: t1 + '-pa', compraId: String(t1), productId: 'pa', name: 'Concentrado', qty: 10, tipo: 'entrada', at: t1 }, { id: t2 + '-pa', compraId: String(t2), productId: 'pa', name: 'Concentrado', qty: 10, tipo: 'entrada', at: t2 }];
      data.libreta = { movs: [{ id: 'lm1', tipo: 'prov', persona: 'Agro Sur', monto: 30000, fecha: new Date(t2 + 3600e3).toISOString(), metodo: 'efectivo', compra: String(t2) }] };
      data.purchases[0].pagadoMov = 'lm1';
      window.__t1 = String(t1); window.__t2 = String(t2);
      await saveData(); });
    const gastos = () => p.evaluate(() => ctMovimientos({ ini: 0, fin: Date.now() + 1000 }).mov.filter(m => m.tipo === 'gasto' && m.cat === 'proveedores').map(m => m.monto));
    chk('Antes: dos compras de $30.000 en contabilidad', JSON.stringify(await gastos()) === '[30000,30000]', await gastos());
    // 1. Por la pantalla: Facturas anteriores → la repetida (la más nueva) → Anular
    await p.evaluate(() => { fiAbrirHistorialFacturas(); document.querySelector('#fiHistOv .fi-hrow[data-id="' + window.__t2 + '"]').click(); });
    await p.waitForTimeout(300);
    chk('1. El detalle tiene «🚫 Anular esta factura»', await p.evaluate(() => !!document.querySelector('#fiDetOv.show .fi-anular')));
    await p.evaluate(() => document.querySelector('#fiDetOv .fi-anular').click());
    await p.waitForSelector('#vfMotivo', { timeout: 5000 });
    const txt = await p.evaluate(() => document.getElementById('vfMotivo').closest('.overlay, .modal, div').parentElement.innerText);
    chk('1. Avisa que la Vacuna ya no alcanza y que el pago de la libreta se queda', /Vacuna \(hay 3, la factura sumó 4\)/.test(txt) && /pagada en la libreta/.test(txt), txt);
    await p.fill('#vfMotivo', 'la apliqué dos veces'); await p.click('#vfSi'); await p.waitForTimeout(500);
    const r = await p.evaluate(() => ({ compras: data.purchases.map(x => x.id), a: data.products[0].stock, b: data.products[1].stock, lotes: data.products[0].lotes.map(l => l.id),
      mov: data.inventarioMov.map(m => m.compraId), an: (data.anuladas || []).filter(x => x.tipo === 'compra').map(x => ({ id: x.compraId, m: x.motivo, items: (x.compra.items || []).length })),
      lm: data.libreta.movs[0].compra, pag: (data.purchases.find(x => x.id === window.__t1) || {}).pagadoMov, det: document.querySelector('#fiDetOv.show') ? 1 : 0,
      lista: [...document.querySelectorAll('#fiHistOv .fi-hrow')].map(x => x.dataset.id) }));
    chk('1. Sale de las compras (queda solo la buena) y se cierra el detalle', JSON.stringify(r.compras) === JSON.stringify([await p.evaluate(() => window.__t1)]) && !r.det && r.lista.length === 1, r);
    chk('2. Concentrado 25 → 15; Vacuna 3 → 0 (no negativo)', r.a === 15 && r.b === 0, r);
    chk('3. Su movimiento de inventario y su lote se quitan; los de la otra quedan', JSON.stringify(r.mov) === JSON.stringify([await p.evaluate(() => window.__t1)]) && JSON.stringify(r.lotes) === '["l1"]', r);
    chk('4. Contabilidad: una sola compra', JSON.stringify(await gastos()) === '[30000]', await gastos());
    chk('5. El pago de la libreta pasa a la factura buena', r.lm === await p.evaluate(() => window.__t1) && r.pag === 'lm1', r);
    chk('5. Y no se cuenta aparte en contabilidad', await p.evaluate(() => (window.libretaConta(0, Date.now() + 1000) || []).filter(m => m.tipo === 'gasto').length) === 0);
    chk('6. Queda en anuladas con el motivo', r.an.length === 1 && r.an[0].m === 'la apliqué dos veces' && r.an[0].items === 2, r);
    const fila = await p.evaluate(() => { const c = document.getElementById('histFAnuladas'); document.querySelectorAll('#histFilter button').forEach(x => x.classList.toggle('on', x === c));
      renderHistorial(); const row = document.querySelector('#histList .hist-row.anulada'); return row ? row.innerText.replace(/\s+/g, ' ') : ''; });
    chk('6. Se ve en Historial → «Anuladas» (factura, ANULADA, motivo, total)', /Factura de Agro Sur/.test(fila) && /ANULADA/.test(fila) && /la apliqué dos veces/.test(fila) && /30\.000/.test(fila), fila);
    // 7. Otro equipo que todavía la tenía
    const otro = await p.evaluate(() => { const o = JSON.parse(JSON.stringify(data)); o.purchases.unshift(JSON.parse(JSON.stringify(data.anuladas[0].compra))); o.inventarioMov.push({ id: 'x', compraId: window.__t2, qty: 10 });
      window.ventoQuitarAnuladas(o); return { c: o.purchases.map(x => x.id), m: o.inventarioMov.map(x => x.compraId) }; });
    chk('7. Al juntar los datos de otro equipo, la anulada no vuelve', JSON.stringify(otro.c) === JSON.stringify([await p.evaluate(() => window.__t1)]) && otro.m.every(x => x !== (null)) && !otro.m.includes(await p.evaluate(() => window.__t2)), otro);
    // Al recargar sigue anulada
    await p.reload(); await p.waitForTimeout(1500);
    chk('Al volver a abrir sigue anulada', await p.evaluate(async () => { await enterApp('test', null); return data.purchases.length === 1 && data.anuladas.some(x => x.tipo === 'compra'); }));
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
