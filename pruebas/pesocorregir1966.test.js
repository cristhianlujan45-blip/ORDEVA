// ⚖️ 1.99.65 · Corregir y devolver ventas por kilo. Corregir redondeaba las cantidades a entero: al corregir OTRO renglón,
// 2,5 kg de maíz pasaban a 3 kg (el total subía y se descontaba medio kilo de más). Revisa:
//  1. Venta: 2,5 kg de maíz ($2.000/kg) + 2 vasijas ($5.000). Corregir solo las vasijas a 1 → el maíz sigue en 2,5 kg,
//     total $10.000, el inventario del maíz no cambia.
//  2. Corregir el maíz a 1,5 kg → vuelve 1 kg al inventario y el total baja a $8.000.
//  3. Devolver 0,5 kg → vuelve medio kilo y el total baja $1.000.
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
      data.products = [{ id: 'mz', name: 'Maíz', price: 2000, stock: 40, unidad: 'kg' }, { id: 'v', name: 'Vasija', price: 5000, stock: 10 }];
      data.history = [{ id: 's1', invoiceNo: 'FV-1', date: new Date().toISOString(), table: null, tableName: 'Mostrador', total: 15000, debt: 0, items: [{ productId: 'mz', name: 'Maíz', price: 2000, qty: 2.5, unidad: 'kg' }, { productId: 'v', name: 'Vasija', price: 5000, qty: 2 }], payments: [{ method: 'efectivo', amount: 15000 }] }];
      await saveData(); });
    const est = () => p.evaluate(() => ({ items: data.history[0].items.map(i => i.name + ' ' + i.qty), total: data.history[0].total, maiz: data.products[0].stock, vasija: data.products[1].stock }));
    const corregir = async (i, v) => { await p.evaluate(() => { window.ventoVentaFix('corregir', 's1'); }); await p.waitForSelector('[data-q="' + i + '"]'); await p.fill('[data-q="' + i + '"]', v); await p.click('#vfSi'); await p.waitForTimeout(300); };
    await corregir(1, '1'); let e = await est();
    chk('1. Corregir las vasijas: el maíz sigue en 2,5 kg, total $10.000 y su inventario igual (40)', e.items.includes('Maíz 2.5') && e.total === 10000 && e.maiz === 40 && e.vasija === 11, e);
    await corregir(0, '1.5'); e = await est();
    chk('2. Corregir el maíz a 1,5 kg: vuelve 1 kg (40 → 41) y el total baja a $8.000', e.items.includes('Maíz 1.5') && e.total === 8000 && e.maiz === 41, e);
    await p.evaluate(() => { window.ventoVentaFix('devolver', 's1'); }); await p.waitForSelector('[data-dv="0"]'); await p.fill('[data-dv="0"]', '0.5'); await p.click('#viDvOk'); await p.waitForTimeout(300); e = await est();
    chk('3. Devolver 0,5 kg: vuelve medio kilo (41 → 41,5) y el total baja a $7.000', e.items.includes('Maíz 1') && e.total === 7000 && Math.abs(e.maiz - 41.5) < 1e-9, e);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
