// 🧮 ORDEVA 1.67.2 · Fase 2: motor financiero en toda la app + alertas. Sin internet.
//  1. Resultado: las compras de mercancía NO se restan dos veces (ya están en el costo de lo vendido); los gastos
//     operativos sí. Rentabilidad por producto y categoría con el costo guardado en cada venta; inventario valorizado.
//  2. Alertas con datos reales: producto con pérdida, margen bajo, costo que subió (precio desactualizado), gastos del
//     mes por encima de lo normal y categoría con peor margen que el mes pasado. Sin datos, ninguna.
//  3. Inicio: utilidad = vendido − costo − gastos operativos (la factura del proveedor no la baja) y las alertas salen.
//  4. Contabilidad: «Te quedó (caja)» (flujo de caja) y «🧮 Resultado estimado» por separado.
//  5. Estadísticas: utilidad bruta, margen, gastos operativos, resultado neto, margen por categoría, menor margen y
//     plata invertida en el inventario.
//  6. Las fórmulas que estaban repetidas (facturas, asistente, Laya) dan lo mismo con el motor.
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
    await p.fill('#authBiz', 'Tienda Finanzas'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1500);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});

    // ===== 1. Motor =====
    let v = await p.evaluate(() => { const F = window.ventoFinanzas;
      const R = F.resultado(100000, 60000, [{ cat: 'proveedores', monto: 80000 }, { cat: 'servicios', monto: 15000 }, { cat: 'mercancia', monto: 5000 }]);
      const hist = [{ date: new Date().toISOString(), items: [{ productId: 'a', name: 'Gaseosa', price: 3000, cost: 2000, qty: 10 }, { productId: 'b', name: 'Papas', price: 2000, cost: 1500, qty: 4 }, { name: 'Domicilio', price: 3000, qty: 1 }] }];
      const RT = F.rentabilidad(hist, [{ id: 'a', name: 'Gaseosa', categoryId: 'k1' }, { id: 'b', name: 'Papas', categoryId: 'k2' }], [{ id: 'k1', name: 'Bebidas' }, { id: 'k2', name: 'Snacks' }]);
      const IV = F.inventario([{ price: 3000, cost: 2000, stock: 10 }, { price: 2000, stock: 5 }, { price: 1000, cost: 500, stock: 0 }]);
      return { R, cat: RT.categorias.map(c => [c.nombre, c.utilidad, c.margen]), prods: RT.productos.length, IV }; });
    chk('1. Resultado: utilidad bruta $40.000 − gastos operativos $15.000 = $25.000 (las compras de $85.000 no se restan otra vez)', v.R.utilidadBruta === 40000 && v.R.gastosOperativos === 15000 && v.R.comprasInventario === 85000 && v.R.resultadoNeto === 25000 && v.R.margenBruto === 40, v.R);
    chk('1. Rentabilidad por categoría: Bebidas $10.000 (33,33 %), Snacks $2.000 (25 %); el domicilio no cuenta', JSON.stringify(v.cat.sort()) === JSON.stringify([['Bebidas', 10000, 33.33], ['Snacks', 2000, 25]]) && v.prods === 2, v.cat);
    chk('1. Inventario: invertido $20.000, venta potencial $40.000, ganancia potencial $20.000, 1 sin costo', v.IV.inversion === 20000 && v.IV.ventaPotencial === 40000 && v.IV.gananciaPotencial === 20000 && v.IV.productosSinCosto === 1, v.IV);

    // ===== 2. Alertas =====
    v = await p.evaluate(() => { const F = window.ventoFinanzas, ahora = Date.now(), dia = 864e5;
      const mes = k => { const x = new Date(ahora); x.setDate(1); x.setHours(0, 0, 0, 0); x.setMonth(x.getMonth() - k); return x; };
      const f = (k, d) => { const x = new Date(mes(k)); x.setDate(d || 2); return x; };
      const ymd = x => x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
      const d = { margenObjetivo: 30,
        products: [{ id: 'p', name: 'Pérdida', price: 1000, cost: 1200 }, { id: 'm', name: 'Margen flaco', price: 1000, cost: 900 }, { id: 'c', name: 'Aceite', price: 10000, cost: 7000 }, { id: 'g', name: 'Gaseosa', price: 3000, cost: 1500, categoryId: 'k' }],
        categories: [{ id: 'k', name: 'Bebidas' }],
        purchases: [{ at: new Date(ahora - 30 * dia).toISOString(), items: [{ productId: 'c', cost: 6000 }] }, { at: new Date(ahora - 2 * dia).toISOString(), items: [{ productId: 'c', cost: 7500 }] }],
        contab: [1, 2, 3].map(k => ({ tipo: 'gasto', cat: 'servicios', monto: 100000, fecha: ymd(f(k, 5)) })).concat([{ tipo: 'gasto', cat: 'servicios', monto: 200000, fecha: ymd(new Date(ahora)) }, { tipo: 'gasto', cat: 'proveedores', monto: 9e6, fecha: ymd(new Date(ahora)) }]),
        history: [{ date: f(1, 10).toISOString(), items: [{ productId: 'g', name: 'Gaseosa', price: 3000, cost: 1500, qty: 10 }] }, { date: new Date(ahora - 1000).toISOString(), items: [{ productId: 'g', name: 'Gaseosa', price: 3000, cost: 2400, qty: 10 }] }] };
      const A = F.alertas(d, { ahora }), vacio = F.alertas({ products: [{ id: 'x', name: 'X', price: 5000, cost: 2000 }] });
      return { k: A.map(a => a.k), t: A.map(a => a.t + ' — ' + a.s), vacio }; });
    chk('2. Alerta: producto con pérdida (precio ≤ costo)', v.k.includes('perdida') && v.t.some(t => /Pérdida/.test(t)), v.t);
    chk('2. Alerta: margen bajo (menos de la mitad del objetivo)', v.k.includes('margen') && v.t.some(t => /Margen flaco 10 %/.test(t)), v.t);
    chk('2. Alerta: el Aceite subió 25 % de costo y quedó bajo el margen objetivo (revisar el precio)', v.k.includes('costo') && v.t.some(t => /Aceite \(25 %\)/.test(t)), v.t);
    chk('2. Alerta: gastos operativos del mes por encima de lo normal (la compra de mercancía no cuenta)', v.k.includes('gastos') && v.t.some(t => /100 % más/.test(t)), v.t);
    chk('2. Alerta: la categoría Bebidas bajó de margen frente al mes pasado (50 % → 20 %)', v.k.includes('categoria') && v.t.some(t => /Bebidas 50 % → 20 %/.test(t)), v.t);
    chk('2. Sin problemas, ninguna alerta (nada inventado)', Array.isArray(v.vacio) && v.vacio.length === 0, v.vacio);

    // ===== 3-5. Pantallas =====
    await p.evaluate(() => {
      document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      const hoy = new Date(), ymd = (hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-' + String(hoy.getDate()).padStart(2, '0'));
      const ini = new Date(); ini.setHours(0, 0, 0, 0); const cuando = new Date(ini.getTime() + (Date.now() - ini.getTime()) / 2).toISOString();
      data.categories = [{ id: 'k1', name: 'Bebidas' }, { id: 'k2', name: 'Snacks' }];
      data.products = [{ id: 'a', name: 'Gaseosa', price: 3000, cost: 2000, stock: 10, categoryId: 'k1' }, { id: 'b', name: 'Papas', price: 2000, cost: 1500, stock: 4, categoryId: 'k2' }, { id: 'z', name: 'Chicle', price: 500, cost: 600, stock: 20 }];
      data.history = [{ id: 'h1', date: cuando, total: 38000, table: null, items: [{ productId: 'a', name: 'Gaseosa', price: 3000, cost: 2000, qty: 10 }, { productId: 'b', name: 'Papas', price: 2000, cost: 1500, qty: 4 }], payments: [{ method: 'efectivo', amount: 38000 }] }];
      data.purchases = [{ id: 'f1', supplier: 'Postobón', at: cuando, date: ymd, total: 50000, items: [{ productId: 'a', qty: 25, cost: 2000 }] }];
      data.contab = [{ id: 'g1', tipo: 'gasto', cat: 'servicios', monto: 4000, fecha: ymd, metodo: 'efectivo', nota: 'Luz' }];
      saveData(); window.ordeva2 && window.ordeva2.pintar && window.ordeva2.pintar();
      document.querySelector('nav button[data-view="inicio"]').click();
    });
    await p.waitForTimeout(500);
    v = await p.evaluate(() => ({ res: [...document.querySelectorAll('#o2Res b')].map(x => +x.textContent.replace(/[^\d-]/g, '')), nota: (document.querySelector('#o2Res + .o2-nota') || {}).textContent || '', al: (document.getElementById('o2Alertas') || {}).innerText || '' }));
    // vendido 38.000, costo 26.000 → bruta 12.000; gastos operativos 4.000 → 8.000 (la factura de 50.000 no se resta)
    chk('3. Inicio: utilidad = $38.000 − $26.000 − $4.000 = $8.000 (la factura de $50.000 no se resta otra vez)', JSON.stringify(v.res) === JSON.stringify([38000, 38000, 26000, 4000, 8000]) && /no se restan otra vez/.test(v.nota), v);
    chk('3. Inicio: sale la alerta del producto con pérdida (Chicle)', /pérdida/.test(v.al) && /Chicle/.test(v.al), v.al);
    await p.evaluate(() => { const b = document.querySelector('nav button[data-view="contabilidad"]'); b.click(); try{ renderConta(); }catch(e){} });
    await p.waitForTimeout(400);
    v = await p.evaluate(() => document.getElementById('ctKpis').innerText);
    chk('4. Contabilidad: «Te quedó (caja)» y «🧮 Resultado estimado $8.000» por separado', /Te quedó \(caja\)|Faltó \(caja\)/.test(v) && /Resultado estimado\s*\$\s?8\.000/.test(v), v);
    await p.evaluate(() => { document.querySelector('nav button[data-view="estadisticas"]').click(); });
    await p.waitForTimeout(300);
    await p.evaluate(() => { const b = document.querySelector('#stPer [data-p="hoy"]'); b && b.click(); try{ renderStats(); }catch(e){} });
    await p.waitForTimeout(400);
    v = await p.evaluate(() => document.getElementById('statsBody').innerText);
    chk('5. Estadísticas: utilidad bruta $12.000, gastos operativos $4.000 y resultado neto $8.000', /Utilidad bruta\s*\$\s?12\.000/.test(v) && /Gastos operativos\s*\$\s?4\.000/.test(v) && /Resultado neto estimado\s*\$\s?8\.000/.test(v), v.slice(0, 900));
    chk('5. … margen por categoría (Bebidas 33,3 %, Snacks 25 %) y «Menor margen»', /Margen por categoría/.test(v) && /33,3 %/.test(v) && /Menor margen/.test(v), v.slice(0, 1400));
    chk('5. … y la plata invertida en el inventario ($38.000 a costo)', /Plata invertida \(a costo\)\s*\$\s?38\.000/.test(v), (v.match(/Plata invertida[^\n]*\n?[^\n]*/) || [''])[0]);

    // ===== 6. Fórmulas unificadas =====
    v = await p.evaluate(() => ({ inf: invoiceInferMargin({ price: 10000, cost: 8000 }), pr: invoicePriceFromMargin(8000, 0.3), as: asisMargin({ price: 10000, cost: 8000 }) }));
    chk('6. Facturas y asistente con el motor: margen 0,2 · precio para 30 % $11.400 (a la centena) · 20 %', v.inf === 0.2 && v.pr === 11400 && v.as.pct === 20 && v.as.gan === 2000, v);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
