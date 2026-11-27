// 📦🧂 1.99.90 · Lo que se vendió de más (sin existencias) no vuelve como existencia de mentira. Revisa:
//  1. Producto: hay 1, se agregan 3 a la cuenta (queda 0) y se quitan 2 → queda 0 (antes 2, que nunca existieron).
//  2. … y si se quitan los 3 → vuelve a 1 (lo que había de verdad).
//  3. Normal (había suficiente): hay 10, se agregan 3 (7) y se quitan 3 → 10.
//  4. Insumo de una receta: hay 1 kg, se venden 3 platos de 0,5 kg (queda 0) y se quita 1 → sigue 0; se quitan todos → 1 kg.
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
    await p.goto(BASE); await p.waitForTimeout(900);
    await p.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); });
    const r = await p.evaluate(() => {
      data.products = (data.products || []).concat([{ id: 'pa', name: 'Purina', price: 8000, stock: 1 }, { id: 'pb', name: 'Gaseosa', price: 3000, stock: 10 }]);
      const it = { productId: 'pa', name: 'Purina', price: 8000, qty: 3 };
      invOnSale(it, 3); const tras3 = data.products.find(x => x.id === 'pa').stock;
      invOnSale(it, -2); const tras2 = data.products.find(x => x.id === 'pa').stock;
      invOnSale(it, -1); const todo = data.products.find(x => x.id === 'pa').stock;
      const g = { productId: 'pb', name: 'Gaseosa', price: 3000, qty: 3 };
      invOnSale(g, 3); const g7 = data.products.find(x => x.id === 'pb').stock; invOnSale(g, -3); const g10 = data.products.find(x => x.id === 'pb').stock;
      return { tras3, tras2, todo, g7, g10 }; });
    chk('1. hay 1, se agregan 3 (0) y se quitan 2 → queda 0', r.tras3 === 0 && r.tras2 === 0, r);
    chk('2. … se quita el último → vuelve a 1', r.todo === 1, r);
    chk('3. normal: 10 → 7 → 10', r.g7 === 7 && r.g10 === 10, r);
    await p.waitForTimeout(1200);   // las recetas se enganchan al vender a los ~0,4 s de abrir
    const i = await p.evaluate(() => { const R = window.ventoRecetas; if(!R) return 'sin recetas';
      data.modulos = Object.assign({}, data.modulos || {}, { r: true }); data.insumos = [{ id: 'carne', name: 'Carne', unidad: 'kg', stock: 1, cost: 20000 }];
      data.products.push({ id: 'ham', name: 'Hamburguesa', price: 15000, receta: [{ ref: 'i:carne', qty: 0.5 }] });
      const it = { productId: 'ham', name: 'Hamburguesa', price: 15000, qty: 3 }, st = () => data.insumos[0].stock;
      recordItemHistory(it, 3); const a = st(); it.qty -= 1; recordItemHistory(it, -1); const b1 = st(); it.qty -= 2; recordItemHistory(it, -2); const c = st();
      return { a, b1, c, activo: R.activo ? R.activo() : null }; });
    chk('4. insumo: 1 kg → 3 platos (0) → quitar 1: sigue 0 → quitar todos: 1 kg', i && i.a === 0 && i.b1 === 0 && i.c === 1, i);
    chk('5. sin errores de página', errs.length === 0, errs);
  }catch(e){ mal++; console.log('❌ excepción: ' + e.message); }
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
