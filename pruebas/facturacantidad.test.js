// Facturas: cantidades que no se leyeron y escribir la cantidad a mano para que Vento DIVIDA el total.
//  1. Renglón sin cantidad (solo el total, ej. «CAJA AGUILA … $60.000»): sale marcado «⚠️ No se leyó cuántas unidades
//     son» y con «📦 ¿Viene en cajas?» abierto.
//  2. Escribir 24 en «Cantidad» → el total ($60.000) se divide: $2.500 cada una, a la vista («÷ 24 unidades»).
//     (Antes se dejaba el costo por unidad y el total se multiplicaba: 24 × $60.000.)
//  3. Por cajas: 2 cajas × 12 unidades → 24 unidades a $1.250 (total $30.000 del renglón).
//  4. Al aplicar, el inventario queda con las unidades y el costo por unidad correctos.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';

(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1500);
    await p.fill('#authBiz', 'Bar F'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1200);
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      invoiceOpen({ supplier: 'Distribuidora Prueba', items: [
        { original: 'CERVEZA LA PRUEBA LATA CAJA', name: 'Cerveza La Prueba lata', qty: null, unit_cost: null, line_total: 60000 },
        { original: 'GASEOSA PRUEBA 400', name: 'Gaseosa Prueba 400 ml', qty: 1, unit_cost: 30000, line_total: 30000 }
      ] });
    });
    await p.waitForSelector('#invoiceBody .iv-item');
    const r0 = await p.evaluate(() => { const row = document.querySelector('#invoiceBody .iv-item[data-i="0"]'); return { msg: (row.querySelector('.iv-falta-msg') || {}).textContent || '', marcado: row.querySelector('.iv-qty').classList.contains('iv-falta'), cajasAbierto: row.querySelector('.iv-boxdetails').open, qty: row.querySelector('.iv-qty').value, cost: row.querySelector('.iv-cost').value }; });
    chk('1. Renglón sin cantidad: «⚠️ No se leyó cuántas unidades son…» y el campo marcado', /No se leyó cuántas unidades son/.test(r0.msg) && r0.marcado, r0);
    chk('1. … con «📦 ¿Viene en cajas?» abierto, y por ahora 1 unidad de $60.000', r0.cajasAbierto && r0.qty === '1' && Number(r0.cost) === 60000, r0);

    // 2. Escribir 24 (tecla por tecla, como en el celular)
    await p.click('#invoiceBody .iv-item[data-i="0"] .iv-qty', { clickCount: 3 });
    await p.keyboard.type('24');
    const r1 = await p.evaluate(() => { const row = document.querySelector('#invoiceBody .iv-item[data-i="0"]'), it = invoiceDraft.items[0]; return { cost: Number(row.querySelector('.iv-cost').value), total: Number(row.querySelector('.iv-totalcompra').value), div: row.querySelector('.iv-division').textContent, msg: !!row.querySelector('.iv-falta-msg'), qty: it.qty, itCost: it.cost }; });
    chk('2. Cantidad 24 → el total se DIVIDE: $2.500 cada una', r1.qty === 24 && Math.round(r1.itCost) === 2500 && r1.cost === 2500, r1);
    chk('2. El total del renglón sigue en $60.000 (no se multiplica)', r1.total === 60000, r1);
    chk('2. Se ve la división: «$60.000 ÷ 24 unidades = $2.500 cada una»', /60\.000 ÷ 24 unidades = \$\s?2\.500 cada una/.test(r1.div), r1.div);
    chk('2. El aviso de «no se leyó» se quita', !r1.msg, r1);

    // 3. Por cajas en el otro renglón: 2 cajas × 12 unidades
    await p.evaluate(() => { const row = document.querySelector('#invoiceBody .iv-item[data-i="1"]'); row.querySelector('.iv-boxdetails').open = true; });
    await p.fill('#invoiceBody .iv-item[data-i="1"] .iv-cajas', '2');
    await p.fill('#invoiceBody .iv-item[data-i="1"] .iv-totalcompra', '30000');
    await p.fill('#invoiceBody .iv-item[data-i="1"] .iv-unidxcaja', '12');
    const r2 = await p.evaluate(() => { const it = invoiceDraft.items[1], row = document.querySelector('#invoiceBody .iv-item[data-i="1"]'); return { qty: it.qty, cost: it.cost, div: row.querySelector('.iv-division').textContent }; });
    chk('3. 2 cajas × 12 unidades con total $30.000 → 24 unidades a $1.250', r2.qty === 24 && Math.round(r2.cost) === 1250, r2);
    chk('3. Se ve «(2 × 12)» en la división', /÷ 24 unidades = \$\s?1\.250 cada una \(2 × 12\)/.test(r2.div), r2.div);

    // 4. Aplicar al inventario
    await p.evaluate(() => { window.showConfirm = async () => true; });
    await p.click('#invoiceApplyBtn');
    await p.waitForTimeout(800);
    const prods = await p.evaluate(() => data.products.filter(x => /Prueba/.test(x.name)).map(x => ({ n: x.name, stock: x.stock, cost: x.cost })));
    const cer = prods.find(x => /Cerveza/.test(x.n)), gas = prods.find(x => /Gaseosa/.test(x.n));
    chk('4. Inventario: 24 cervezas a $2.500 y 24 gaseosas a $1.250', cer && cer.stock === 24 && Math.round(cer.cost) === 2500 && gas && gas.stock === 24 && Math.round(gas.cost) === 1250, prods);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
