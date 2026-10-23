// 🧾 Recetas e insumos (Vento 1.57.0): los insumos se descuentan solos al vender, vuelven al quitar de la cuenta y, si el
// dueño lo pide, no se vende un plato si falta un ingrediente.
//  1. Inventario → «🧂 Insumos y recetas»: crear insumos (queso por kg, pan por unidad) con cantidad, aviso y costo.
//  2. Editar producto → «🧾 Receta»: la hamburguesa lleva 0,1 kg de queso y 1 pan; su costo sale de la receta.
//  3. Vender 2 en una mesa descuenta 0,2 kg de queso y 2 panes; quitar 1 los devuelve.
//  4. «🚫 No vender si faltan ingredientes»: no deja agregar la hamburguesa si no alcanza el queso (dice qué falta y no
//     deja un renglón en cero en la cuenta); si alcanza, sí.
//  5. Venta rápida de caja: vende igual pero avisa qué falta. Un combo con hamburguesa también descuenta.
//  6. Los insumos no salen en la carta ni en los productos, y no se borra uno que esté en una receta.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';

(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 500) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1200);
    await p.evaluate(() => { const s = document.getElementById('authType'); if(s){ s.value = 'restaurante'; s.dispatchEvent(new Event('change')); } });
    await p.fill('#authBiz', 'Restaurante Recetas'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn');
    await p.waitForFunction(() => document.getElementById('authOverlay').hidden, null, { timeout: 15000 });
    await p.click('#onbSaltar', { timeout: 4000 }).catch(() => {});
    await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    await p.waitForFunction(() => !!window.ventoRecetas, null, { timeout: 10000 });
    const est = () => p.evaluate(() => Object.fromEntries((data.insumos || []).map(x => [x.name, x.stock])));

    // ===== 1. Insumos desde Inventario =====
    await p.evaluate(() => { const b = document.querySelector('nav button[data-view="inventario"]') || document.querySelector('.more-tile[data-go="inventario"]'); b && b.click(); });
    await p.waitForSelector('#insumosPanel', { timeout: 8000 });
    const nuevo = async (n, u, s, m, c) => {
      await p.evaluate(() => { document.getElementById('insumosPanel').open = true; document.querySelector('[data-ins="nuevo"]').click(); });
      await p.fill('#insNombre', n); await p.selectOption('#insUnidad', u); await p.fill('#insStock', String(s)); await p.fill('#insMin', String(m)); await p.fill('#insCosto', String(c));
      await p.click('[data-ins="guardar"]');
    };
    await nuevo('Queso mozzarella', 'kg', 1, 0.2, 30000);
    await nuevo('Pan de hamburguesa', 'und', 10, 3, 500);
    let s = await est();
    chk('1. Se crean los insumos (queso por kg, pan por unidad)', s['Queso mozzarella'] === 1 && s['Pan de hamburguesa'] === 10, s);
    chk('1. El panel los muestra con cuánto hay y su costo', await p.evaluate(() => /Hay 1 kg/.test(document.getElementById('insLista').textContent) && /\$30\.000 \/ kg/.test(document.getElementById('insLista').textContent)));
    await p.evaluate(() => document.querySelector('[data-ins="sumar"]').click());
    const pan = await p.evaluate(() => (data.insumos.find(x => /Pan/.test(x.name)) || {}).id);
    await p.evaluate(id => document.querySelector('[data-ins="sumar"][data-id="' + id + '"]').click(), pan);
    await p.fill('#insLlego', '5'); await p.click('[data-ins="sumarOk"]');
    s = await est();
    chk('1. «➕ Llegó» suma (llegaron 5 panes → 15)', s['Pan de hamburguesa'] === 15, s);

    // ===== 2. Receta =====
    const H = await p.evaluate(() => { data.products.push({ id: 'p-hamb', name: 'Hamburguesa', price: 18000 }); saveData(); return 'p-hamb'; });
    await p.evaluate(id => openEditProductModal(id), H);
    await p.waitForSelector('#editProdRecetaWrap', { timeout: 5000 });
    await p.evaluate(() => { document.getElementById('editProdRecetaWrap').open = true; });
    const ids = await p.evaluate(() => ({ q: 'i:' + data.insumos.find(x => /Queso/.test(x.name)).id, pn: 'i:' + data.insumos.find(x => /Pan/.test(x.name)).id }));
    await p.selectOption('#rcFilas .rc-fila:nth-child(1) [data-rc="ing"]', ids.q);
    await p.fill('#rcFilas .rc-fila:nth-child(1) [data-rc="qty"]', '0.1');
    await p.click('#rcMas');
    await p.selectOption('#rcFilas .rc-fila:nth-child(2) [data-rc="ing"]', ids.pn);
    await p.fill('#rcFilas .rc-fila:nth-child(2) [data-rc="qty"]', '1');
    chk('2. Muestra el costo de la receta mientras se arma ($3.500)', await p.evaluate(() => /\$3\.500/.test(document.getElementById('rcCosto').textContent)), await p.evaluate(() => document.getElementById('rcCosto').textContent));
    await p.click('#editProdSaveBtn');
    const hp = await p.evaluate(() => data.products.find(x => x.id === 'p-hamb'));
    chk('2. La receta queda guardada en el producto', Array.isArray(hp.receta) && hp.receta.length === 2 && hp.receta.some(r => r.qty === 0.1), hp.receta);
    chk('2. El costo del plato sale de la receta (0,1 kg × $30.000 + 1 pan × $500)', hp.cost === 3500 && hp.costoReceta === 3500, hp);
    chk('2. La unidad sale al lado (kg)', await p.evaluate(id => { openEditProductModal(id); return document.querySelector('#rcFilas .rc-fila [data-rc="u"]').textContent === 'kg'; }, H));
    await p.evaluate(() => closeEditProductModal());

    // ===== 3. Vender en una mesa =====
    await p.evaluate(() => { openTableModal(1); addFavoriteToTable('p-hamb'); addFavoriteToTable('p-hamb'); });
    s = await est();
    chk('3. Vender 2 hamburguesas descuenta 0,2 kg de queso y 2 panes', s['Queso mozzarella'] === 0.8 && s['Pan de hamburguesa'] === 13, s);
    await p.evaluate(() => { const t = data.tables[1]; const it = t.items.find(i => i.productId === 'p-hamb'); it.qty -= 1; recordItemHistory(it, -1); saveData(); });
    s = await est();
    chk('3. Quitar 1 de la cuenta devuelve lo suyo', s['Queso mozzarella'] === 0.9 && s['Pan de hamburguesa'] === 14, s);
    chk('3. Queda anotado en la bitácora de insumos', await p.evaluate(() => (data.insumosLog || []).filter(l => l.tipo === 'receta').length >= 6));

    // ===== 4. No vender si faltan ingredientes =====
    await p.evaluate(() => { data.insumos.find(x => /Queso/.test(x.name)).stock = 0.15; saveData(); });
    await p.evaluate(() => { const v = document.getElementById('view-inventario'); window.ventoRecetas.pintarPanel(); document.getElementById('insBloquear').click(); });
    chk('4. Se prende «🚫 No vender si faltan ingredientes»', await p.evaluate(() => data.recetasBloquear === true));
    await p.evaluate(() => { openTableModal(2); });
    await p.evaluate(() => { const qtyIn = document.getElementById('itemQty'); });
    const antes = await p.evaluate(() => JSON.stringify(data.tables[2] && data.tables[2].items || []));
    // 2 hamburguesas más necesitan 0,2 kg: hay 0,15
    await p.evaluate(() => { const t = data.tables[2]; const it = { productId: 'p-hamb', name: 'Hamburguesa', price: 18000, qty: 2, personId: null, history: [] }; recordItemHistory(it, 2); t.items.push(it); saveData(); });
    await p.waitForTimeout(400);
    const t2 = await p.evaluate(() => (data.tables[2].items || []).map(i => [i.name, i.qty]));
    const toast = await p.evaluate(() => (document.getElementById('toast') || document.querySelector('.toast') || {}).textContent || '');
    chk('4. No deja agregar 2 hamburguesas (falta queso) y no queda un renglón en cero', !t2.some(x => x[0] === 'Hamburguesa'), t2);
    chk('4. Dice qué falta: el queso, cuánto necesita y cuánto hay', /Queso mozzarella/.test(toast) && /0,2 kg/.test(toast) && /0,15 kg/.test(toast), toast);
    s = await est();
    chk('4. … y no descontó nada', s['Queso mozzarella'] === 0.15, s);
    await p.evaluate(() => { openTableModal(2); addFavoriteToTable('p-hamb'); });
    s = await est();
    chk('4. Una sí alcanza (0,1 kg): se agrega y descuenta', s['Queso mozzarella'] === 0.05 && (await p.evaluate(() => (data.tables[2].items || []).some(i => i.productId === 'p-hamb' && i.qty === 1))), s);

    // ===== 5. Venta rápida y combos =====
    await p.evaluate(() => { data.recetasBloquear = false; data.insumos.find(x => /Queso/.test(x.name)).stock = 2; data.products.push({ id: 'combo-h', name: 'Combo hamburguesa', price: 22000, combo: [{ id: 'p-hamb', qty: 1 }] }); saveData(); });
    await p.evaluate(() => qsRegistrarVenta([{ productId: 'combo-h', name: 'Combo hamburguesa', price: 22000, qty: 2 }], { method: 'efectivo' }));
    s = await est();
    chk('5. Un combo con hamburguesa también descuenta sus ingredientes (2 combos → 0,2 kg)', s['Queso mozzarella'] === 1.8, s);
    await p.evaluate(() => { data.insumos.find(x => /Queso/.test(x.name)).stock = 0.05; saveData(); });
    const vr = await p.evaluate(() => { const e = qsRegistrarVenta([{ productId: 'p-hamb', name: 'Hamburguesa', price: 18000, qty: 1 }], { method: 'efectivo' }); return { ok: !!e, toast: (document.getElementById('toast') || document.querySelector('.toast') || {}).textContent || '' }; });
    chk('5. Venta rápida de caja: vende igual (no daña el cobro) pero avisa qué falta', vr.ok && /falta Queso mozzarella/.test(vr.toast), vr);

    // ===== 6. Los insumos no se venden y no se borran si están en una receta =====
    chk('6. Los insumos no están en los productos (ni en la carta, ni en las mesas)', await p.evaluate(() => !data.products.some(x => /Queso mozzarella|Pan de hamburguesa/.test(x.name))));
    await p.evaluate(() => { document.getElementById('insumosPanel').open = true; const id = data.insumos.find(x => /Queso/.test(x.name)).id; document.querySelector('[data-ins="editar"][data-id="' + id + '"]').click(); });
    await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    await p.evaluate(() => document.querySelector('[data-ins="borrar"]').click());
    await p.waitForTimeout(300);
    const t6 = await p.evaluate(() => (document.getElementById('toast') || document.querySelector('.toast') || {}).textContent || '');
    chk('6. No deja borrar un insumo que está en una receta (y dice cuál)', /Hamburguesa/.test(t6) && (await p.evaluate(() => data.insumos.some(x => /Queso/.test(x.name)))), t6);
    chk('6. El panel avisa los que se están acabando', await p.evaluate(() => { window.ventoRecetas.pintarPanel(); return /por acabarse/.test(document.querySelector('#insumosPanel summary').textContent); }));
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
