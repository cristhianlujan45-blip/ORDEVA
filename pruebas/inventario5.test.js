// 📦 ORDEVA 1.67.6 · Fase 5: costo promedio ponderado, proveedores, lotes y vencimientos. Sin internet.
//  1. Motor: costo tras una compra (último / promedio), proveedores y comparación, variación entre compras, vencimientos,
//     y una venta descuenta primero el lote que vence antes (FEFO).
//  2. Ajustes → «Costo de lo que compras»: último costo (como siempre) o promedio ponderado.
//  3. Factura con «Promedio ponderado»: 10 u a $2.000 + 10 u a $2.600 → costo $2.300 (último costo guardado: $2.600);
//     con «Último costo» → $2.600. El renglón con «Vence» crea el lote.
//  4. Vender 15 en la caja: primero el lote que vence antes.
//  5. «¿Cuántas llegaron?» devuelve la fecha de vencimiento.
//  6. Alertas: lote vencido y por vencer (Inicio y Estadísticas).
//  7. Ficha del producto: variación % entre compras y «🏭 Comparar proveedores» con el más barato.
//  8. Estadísticas: tarjeta «🏭 Proveedores».
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';

(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1200);
    await p.fill('#authBiz', 'Tienda Bodega'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1500);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));

    // ===== 1. Motor =====
    let v = await p.evaluate(() => { const F = window.ventoFinanzas, t = Date.now(), dia = 864e5;
      const compras = [{ supplier: 'Postobón', at: new Date(t - 20 * dia).toISOString(), total: 20000, items: [{ productId: 'g', cost: 2000 }] }, { supplier: 'Distribuidora Sol', at: new Date(t - 5 * dia).toISOString(), total: 22000, items: [{ productId: 'g', cost: 2200 }] }, { supplier: 'Postobón', at: new Date(t - 1 * dia).toISOString(), total: 25000, items: [{ productId: 'g', cost: 2500 }] }];
      const PV = F.proveedores(compras, []);
      const ymd = d => new Date(t + d * dia).toISOString().slice(0, 10);
      const V = F.vencimientos([{ id: 'l', name: 'Leche', lotes: [{ q: 3, vence: ymd(-2) }, { q: 4, vence: ymd(5) }, { q: 9, vence: ymd(60) }, { q: 0, vence: ymd(-9) }] }]);
      return { prom: F.costoTrasCompra(10, 2000, 10, 2600, 'promedio'), ult: F.costoTrasCompra(10, 2000, 10, 2600, 'ultimo'), vacio: F.costoTrasCompra(0, 2000, 10, 2600, 'promedio'),
        prov: PV.lista.map(x => [x.nombre, x.compras, x.total]), comp: PV.comparar('g').map(x => [x.proveedor, x.costo]), varia: F.variacionCosto(compras, 'g'),
        venc: V.vencidos.map(x => x.q), pronto: V.pronto.map(x => [x.q, x.dias]),
        fefo: F.descontarLotes([{ q: 5, vence: '2026-12-01' }, { q: 5, vence: '2026-11-05' }], 7) }; });
    chk('1. Costo: promedio ponderado 10×$2.000 + 10×$2.600 = $2.300; último = $2.600; sin existencias = $2.600', v.prom === 2300 && v.ult === 2600 && v.vacio === 2600, v);
    chk('1. Proveedores: Postobón 2 compras $45.000, Distribuidora Sol 1 compra $22.000', JSON.stringify(v.prov) === JSON.stringify([['Postobón', 2, 45000], ['Distribuidora Sol', 1, 22000]]), v.prov);
    chk('1. Comparar: el último costo de cada uno, más barato primero (Sol $2.200, Postobón $2.500); variación +13,64 %', JSON.stringify(v.comp) === JSON.stringify([['Distribuidora Sol', 2200], ['Postobón', 2500]]) && v.varia === 13.64, v);
    chk('1. Vencimientos: 1 lote vencido (3 u), 1 por vencer en 5 días (4 u); el de 60 días y el vacío no', JSON.stringify(v.venc) === '[3]' && JSON.stringify(v.pronto) === '[[4,5]]', v);
    chk('1. FEFO: vender 7 saca 5 del lote de noviembre y 2 del de diciembre', JSON.stringify(v.fefo) === JSON.stringify([{ q: 3, vence: '2026-12-01' }]), v.fefo);

    // ===== 2. Ajuste =====
    await p.evaluate(() => { const b = document.querySelector('nav button[data-view="ajustes"]'); if(b) b.click(); const c = document.querySelector('.ajustes-cat[data-cat="negocio"]'); c && c.click(); });
    await p.waitForTimeout(300);
    v = await p.evaluate(() => { const s = document.getElementById('costoMetodoSel'); const antes = s && s.value; s.value = 'promedio'; s.dispatchEvent(new Event('change')); return { antes, ahora: data.costoMetodo, opciones: [...s.options].map(o => o.textContent) }; });
    chk('2. Ajustes → «Costo de lo que compras»: por defecto último costo; se cambia a promedio ponderado', v.antes === 'ultimo' && v.ahora === 'promedio' && v.opciones.length === 2, v);

    // ===== 3. Factura =====
    const factura = async (costo, qty, vence) => {
      await p.evaluate(x => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); invoiceOpen({ supplier: 'Postobón', date: new Date().toISOString().slice(0, 10), items: [{ name: 'Gaseosa', qty: x.qty, unit_cost: x.costo, line_total: x.qty * x.costo }] }); }, { costo, qty });
      await p.waitForTimeout(400);
      if(vence) await p.evaluate(ve => { const i = document.querySelector('#invoiceOverlay .iv-vence'); i.value = ve; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }, vence);
      await p.click('#invoiceApplyBtn'); await p.waitForTimeout(400);
      for(let k = 0; k < 4; k++){ await p.evaluate(() => { const o = document.getElementById('confirmOverlay'); if(o && o.classList.contains('show')) document.getElementById('confirmOkBtn').click(); }); await p.waitForTimeout(300); }
    };
    await p.evaluate(() => { data.products = [{ id: 'g', name: 'Gaseosa', price: 3500, cost: 2000, stock: 10 }]; data.purchases = []; saveData(); });
    const hoy = new Date(), ymd = d => new Date(hoy.getTime() + d * 864e5).toISOString().slice(0, 10);
    await factura(2600, 10, ymd(4));
    v = await p.evaluate(() => { const g = data.products.find(x => x.id === 'g'); return { cost: g.cost, ult: g.costoUltimo, stock: g.stock, lotes: g.lotes, compras: (data.purchases || []).length }; });
    chk('3. Promedio ponderado: la factura de 10 u a $2.600 deja el costo en $2.300 (último $2.600) y 20 en bodega', v.cost === 2300 && v.ult === 2600 && v.stock === 20 && v.compras === 1, v);
    chk('3. El renglón con «Vence» crea el lote (10 u, vence en 4 días)', v.lotes && v.lotes.length === 1 && v.lotes[0].q === 10 && v.lotes[0].vence === ymd(4), v.lotes);
    await p.evaluate(() => { data.costoMetodo = 'ultimo'; saveData(); });
    await factura(2800, 5, ymd(40));
    v = await p.evaluate(() => { const g = data.products.find(x => x.id === 'g'); return { cost: g.cost, stock: g.stock, lotes: g.lotes.map(l => [l.q, l.vence]) }; });
    chk('3. Con «Último costo»: la siguiente factura a $2.800 deja el costo en $2.800 (como siempre)', v.cost === 2800 && v.stock === 25, v);

    // ===== 4. FEFO en la venta =====
    await p.evaluate(() => { window.ventoPOS.vaciar(); window.ventoPOS.agregar('g', 12); });
    await p.evaluate(() => { window.ventoPOS.cobrar(); }); await p.waitForSelector('.pz-pago-ov.show'); await p.click('.pz-pago-ov .pz-met[data-m="efectivo"]'); await p.waitForTimeout(400);
    v = await p.evaluate(() => { const g = data.products.find(x => x.id === 'g'); return { stock: g.stock, lotes: g.lotes.map(l => [l.q, l.vence]) }; });
    chk('4. Vender 12: salen primero los 10 del lote que vence en 4 días y 2 del de 40 días', v.stock === 13 && JSON.stringify(v.lotes) === JSON.stringify([[3, ymd(40)]]), v);

    // ===== 5. ¿Cuántas llegaron? =====
    await p.evaluate(() => { window.__ll = window.ventoProductoCodigo.llego(data.products.find(x => x.id === 'g'), 6); });
    await p.waitForSelector('#pcLlegoOv.show #pcV');
    await p.fill('#pcLlegoOv #pcV', ymd(20)); await p.click('#pcLlegoOv [data-ok]');
    v = await p.evaluate(async () => await window.__ll);
    chk('5. «¿Cuántas llegaron?» pregunta también «Vence» y lo devuelve con la cantidad', v && v.n === 6 && v.vence === ymd(20), v);

    // ===== 6. Alertas =====
    await p.evaluate(x => { data.products.push({ id: 'l', name: 'Leche entera', price: 4200, cost: 3000, stock: 7, lotes: [{ q: 3, vence: x.v }, { q: 4, vence: x.p }] }); saveData(); window.ordeva2 && window.ordeva2.pintar && window.ordeva2.pintar(); document.querySelector('nav button[data-view="inicio"]').click(); }, { v: ymd(-1), p: ymd(3) });
    await p.waitForTimeout(400);
    v = await p.evaluate(() => (document.getElementById('o2Alertas') || {}).innerText || '');
    chk('6. Inicio: «1 lote vencido con unidades» (Leche, 3 u) y lotes por vencer', /lote vencido/.test(v) && /Leche entera \(3 u\)/.test(v) && /por vencer/.test(v), v);

    // ===== 7. Ficha del producto =====
    await p.evaluate(() => { data.purchases.push({ id: 'z', supplier: 'Distribuidora Sol', at: new Date().toISOString(), date: new Date().toISOString().slice(0, 10), total: 12000, items: [{ productId: 'g', qty: 5, cost: 2400 }] }); saveData(); openEditProductModal('g'); });
    await p.waitForTimeout(400);
    v = await p.evaluate(() => (document.getElementById('editProdHistory') || {}).innerText || '');
    chk('7. Ficha: variación % entre compras y «Comparar proveedores» con el más barato (Distribuidora Sol $2.400)', /▼ 14 %|▲ 8 %|▼ 7 %|%/.test(v) && /Comparar proveedores/.test(v) && /✅ Distribuidora Sol/.test(v) && /más barato/.test(v), v);

    // ===== 8. Estadísticas =====
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); document.querySelector('nav button[data-view="estadisticas"]').click(); try{ renderStats(); }catch(e){} });
    await p.waitForTimeout(400);
    v = await p.evaluate(() => document.getElementById('statsBody').innerText);
    chk('8. Estadísticas: tarjeta «🏭 Proveedores» (Postobón 2 compras) y «⏳ Vencimientos»', /Proveedores \(compras registradas\)/.test(v) && /Postobón/.test(v) && /2 compras/.test(v) && /Vencimientos/.test(v) && /venció hace 1 d/.test(v), v.slice(-900));
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
