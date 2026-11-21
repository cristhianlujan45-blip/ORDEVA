// 💲 1.99.26 · «Pongo el precio al que lo vendo y me deja el sugerido» (pedido del dueño, 21/11). Al agregar productos de una
// factura (y al revisar el precio de un producto con la cámara), el precio que escribe la persona era reemplazado por el
// sugerido: «A cómo lo vendes» solo se comparaba con el costo, y cada cambio de costo, cantidad o cajas volvía a poner el
// sugerido. Revisa:
//  1. Factura: escribir «A cómo lo vendes» = $3.500 → el precio que se guarda es $3.500 (dice «el TUYO»).
//  2. Cambiar la cantidad o las cajas NO lo reemplaza (solo se ajusta el margen).
//  3. Cambiar el margen a mano pide el sugerido (y lo dice).
//  4. Escribir directo en el precio también manda.
//  5. Al aplicar: el producto nuevo queda a $3.500 y el que ya existía al precio escrito ($2.800), no al sugerido.
//  6. Revisar precio (foto): escribir el precio y luego cambiar el costo visto → sigue el escrito; cambiar el margen → sugerido.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 500) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '', off: true })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1500);
    await p.fill('#authBiz', 'Bar Precio'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1200);
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.products.push({ id: 'gp', name: 'Gaseosa Prueba 400 ml', price: 2500, cost: 1500, categoryId: null, stock: 0 }); saveData();
      invoiceOpen({ supplier: 'Distribuidora Prueba', items: [
        { original: 'GALLETAS NUEVAS X10', name: 'Galletas Nuevas', qty: 10, unit_cost: 2000, line_total: 20000 },
        { original: 'GASEOSA PRUEBA 400', name: 'Gaseosa Prueba 400 ml', qty: 12, unit_cost: 1800, line_total: 21600 }
      ] });
    });
    await p.waitForSelector('#invoiceBody .iv-item');
    const fila = i => '#invoiceBody .iv-item[data-i="' + i + '"] ';
    const estado = i => p.evaluate(i => { const row = document.querySelector('#invoiceBody .iv-item[data-i="' + i + '"]'), it = invoiceDraft.items[i];
      return { campo: Number(row.querySelector('.iv-price').value), newPrice: it.newPrice, fijo: !!it.precioFijo, lbl: (row.querySelector('.iv-price-lbl') || {}).textContent || '', margen: Number(row.querySelector('.iv-margin').value) }; }, i);
    const sug0 = (await estado(0)).newPrice;
    // ===== 1 =====
    await p.click(fila(0) + '.iv-precioactual'); await p.keyboard.type('3500');
    let e = await estado(0);
    chk('1. «A cómo lo vendes» $3.500 → el precio que se guarda es $3.500 (no el sugerido ' + sug0 + ')', e.newPrice === 3500 && e.campo === 3500 && e.fijo && sug0 !== 3500, { e, sug0 });
    chk('1. … y lo dice: «Precio que se guarda: el TUYO»', /el TUYO/.test(e.lbl), e.lbl);
    // ===== 2 =====
    await p.click(fila(0) + '.iv-qty', { clickCount: 3 }); await p.keyboard.type('20');
    e = await estado(0);
    chk('2. Cambiar la cantidad (20) no lo reemplaza: sigue $3.500 y el margen se ajusta', e.newPrice === 3500 && e.campo === 3500, e);
    await p.evaluate(sel => { const r = document.querySelector(sel); r.querySelector('.iv-boxdetails').open = true; }, fila(0));
    await p.fill(fila(0) + '.iv-cajas', '2');
    e = await estado(0);
    chk('2. Cambiar las cajas tampoco: sigue $3.500', e.newPrice === 3500, e);
    // ===== 3 =====
    await p.fill(fila(0) + '.iv-margin', '50');
    e = await estado(0);
    chk('3. Cambiar el margen a mano (50 %) pide el sugerido: cambia el precio y dice «Precio sugerido»', e.newPrice !== 3500 && e.newPrice > 0 && !e.fijo && /sugerido/.test(e.lbl), e);
    // ===== 4 =====
    await p.click(fila(0) + '.iv-price', { clickCount: 3 }); await p.keyboard.type('3500');
    await p.fill(fila(0) + '.iv-cajas', '1');
    e = await estado(0);
    chk('4. Escribir directo en el precio también manda (después de cambiar las cajas sigue $3.500)', e.newPrice === 3500 && e.fijo, e);
    // ===== 5 =====
    await p.click(fila(1) + '.iv-precioactual', { clickCount: 3 }); await p.keyboard.type('2800');
    await p.click(fila(1) + '.iv-qty', { clickCount: 3 }); await p.keyboard.type('24');
    await p.evaluate(() => { window.showConfirm = async () => true; window.showAviso = async () => true; });
    await p.click('#invoiceApplyBtn'); await p.waitForTimeout(800);
    const pr = await p.evaluate(() => data.products.filter(x => /Galletas Nuevas|Gaseosa Prueba/.test(x.name)).map(x => ({ n: x.name, price: x.price })));
    const gal = pr.find(x => /Galletas/.test(x.n)), gas = pr.find(x => /Gaseosa/.test(x.n));
    chk('5. Al aplicar: el producto nuevo queda a $3.500 y el que ya existía a $2.800 (lo escrito), no al sugerido', gal && gal.price === 3500 && gas && gas.price === 2800, pr);
    // ===== 6. Revisar precio (foto) =====
    await p.evaluate(() => pcOpen({ name: 'Galletas Nuevas', price: 2000 }));
    await p.waitForSelector('#pcPrice');
    const sug6 = await p.evaluate(() => pcDraft.newPrice);
    await p.click('#pcPrice', { clickCount: 3 }); await p.keyboard.type('4200');
    await p.click('#pcSeen', { clickCount: 3 }); await p.keyboard.type('2600');
    const r6 = await p.evaluate(() => ({ np: pcDraft.newPrice, campo: Number(document.getElementById('pcPrice').value) }));
    chk('6. Revisar precio: escribo $4.200 y cambio el costo visto: sigue $4.200 (no el sugerido)', r6.np === 4200 && r6.campo === 4200 && sug6 !== 4200, { r6, sug6 });
    await p.fill('#pcTarget', '40');
    const r6b = await p.evaluate(() => pcDraft.newPrice);
    chk('6. … y cambiar el margen pide el sugerido', r6b !== 4200 && r6b > 0, r6b);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
