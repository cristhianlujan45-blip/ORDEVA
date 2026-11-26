// 💵 1.99.85 · Plata escrita con puntos de miles. Antes «8.000» en el valor del pago quedaba en 8 (y «1.500.000» en 1,5).
// Revisa:
//  1. Pago: escribir «8.000» → 8000; «1.500.000» → 1500000; pegar «12.500» → 12500.
//  2. Precio y costo del producto, gasto de contabilidad: igual.
//  3. Celular (beforeinput con «.»): el punto no entra.
//  4. Porcentajes, retenciones, cantidades y días NO se tocan («2.5» sigue 2.5).
//  5. Campos de plata creados después (libreta, caja, reservas) también; el costo por kg de recetas no.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 500) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, locale: 'es-CO', permissions: ['clipboard-read', 'clipboard-write'] });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-guia-tour', '1'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE); await p.waitForTimeout(900);
    await p.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); });
    const escribir = async (sel, txt) => { await p.evaluate(s => { const i = document.querySelector(s); i.value = ''; i.style.cssText = 'position:fixed;top:10px;left:10px;z-index:99999;display:block;width:200px'; document.body.appendChild(i); }, sel); await p.focus(sel); await p.keyboard.type(txt); return p.evaluate(s => document.querySelector(s).value, sel); };
    chk('1a. pago «8.000» → 8000', await escribir('#paymentAmount', '8.000') === '8000');
    chk('1b. pago «1.500.000» → 1500000', await escribir('#paymentAmount', '1.500.000') === '1500000');
    const pegado = await p.evaluate(() => { const i = document.getElementById('paymentAmount'); i.value = ''; const dt = new DataTransfer(); dt.setData('text', '12.500'); i.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); return i.value; });
    chk('1c. pegar «12.500» → 12500', pegado === '12500', pegado);
    chk('2a. precio del producto «35.000» → 35000', await escribir('#editProdPrice', '35.000') === '35000');
    chk('2b. costo «28.000» → 28000', await escribir('#editProdCost', '28.000') === '28000');
    chk('2c. gasto de contabilidad «150.000» → 150000', await escribir('#ctMonto', '150.000') === '150000');
    const cel = await p.evaluate(() => { const i = document.getElementById('paymentAmount'); i.value = '5'; const e = new InputEvent('beforeinput', { data: '.', inputType: 'insertText', bubbles: true, cancelable: true }); const ok = i.dispatchEvent(e); return { cancelado: !ok, valor: i.value }; });
    chk('3. celular: el punto no entra', cel.cancelado && cel.valor === '5', cel);
    const r4 = [];
    for(const id of ['#retFuenteIn', '#ivaRateInput', '#addQty', '#calcPrimaDias', '#calcDescPct']){ const v = await escribir(id, '2.5'); r4.push([id, v]); }
    chk('4. porcentajes, retención, cantidad y días quedan con su decimal', r4.every(x => x[1] === '2.5'), r4);
    const r5 = await p.evaluate(() => { const mk = h => { const d = document.createElement('div'); d.innerHTML = h; document.body.appendChild(d); return d.firstChild; };
      return { libreta: ventoEsPlata(mk('<input id="lbMonto" type="number" inputmode="numeric" placeholder="¿Cuánta plata?" min="0" step="500">')),
        caja: ventoEsPlata(mk('<input class="fz-in fz-precio" type="number" min="0" step="50">')),
        reservas: ventoEsPlata(mk('<input data-k="precio" type="number" min="0" step="1000" aria-label="Precio por noche">')),
        receta: ventoEsPlata(mk('<input type="number" id="insCosto" min="0" step="any" inputmode="decimal" placeholder="Costo por unidad (ej. por kg)">')),
        cantidad: ventoEsPlata(mk('<input type="number" id="qsQty" step="any">')) }; });
    chk('5. campos creados después: libreta, caja y reservas sí; receta por kg y cantidad no', r5.libreta && r5.caja && r5.reservas && !r5.receta && !r5.cantidad, r5);
    chk('6. sin errores de página', errs.length === 0, errs);
  }catch(e){ mal++; console.log('❌ excepción: ' + e.message); }
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
