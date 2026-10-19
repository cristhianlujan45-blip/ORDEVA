// Mejoras de la caja y del inventario (como los sistemas POS):
//  1. 💵 Caja con base, ➕ entradas / ➖ salidas de efectivo y 🧮 arqueo al cerrar (sobra / falta), en el cierre y en WhatsApp.
//  2. 🔢 Inventario por código: códigos internos para los que no tienen, 📥 entrada de mercancía escaneando,
//     📋 toma de inventario (conteo físico) con diferencias y ajustes, 🔎 consultar con su 📒 kárdex, Excel con códigos.
//  3. 💲 Precio por cantidad (mayorista) en la caja.
//  4. ↩️ Devolución desde el historial: inventario de vuelta, la venta baja y el efectivo sale de la caja.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0;
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 500) : '')); } };
  const ctx = await b.newContext({ viewport: { width: 1180, height: 860 } });
  await ctx.route('**/*', r => { const u = new URL(r.request().url()); return u.hostname === 'localhost' ? r.continue() : r.abort(); });
  await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); }catch(e){} });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  try{
    await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(2500);
    await p.evaluate(async () => { await enterApp('test', null); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-pp-oculta', '1');
      document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); window.speakVoice = () => {};
      data.products = [{ id: 'ag', name: 'Águila', price: 4000, cost: 2500, stock: 20, barcodes: ['7702004003508'] }, { id: 'em', name: 'Empanada', price: 2500, cost: 1000, stock: 10 }, { id: 'ga', name: 'Gaseosa', price: 3000, cost: 1800, stock: 5 }];
      data.history = []; data.closures = []; data.turno = null; data.kardex = []; data.stockLog = []; await saveData(); renderAll(); ventoPOS.vaciar(); });
    await p.waitForTimeout(400);
    const D = (f, a) => p.evaluate(f, a);
    const vender = (lineas, metodo) => p.evaluate(async ([lineas, metodo]) => { ventoPOS.vaciar(); lineas.forEach(([id, n]) => ventoPOS.agregar(id, n)); const e = await ventoPOS.cobrar({ pago: { method: metodo || 'efectivo', nota: 'Efectivo', metodo: metodo || 'efectivo', vueltas: 0 } }); return e && e.id; }, [lineas, metodo]);

    // ===== 1. Caja con base, entradas, salidas y arqueo =====
    await p.evaluate(() => { const b = document.querySelector('nav button[data-view="historial"]'); b && b.click(); });
    chk('1. En el historial: «💵 Caja: base, entradas y salidas» junto a «Cerrar caja del día»', await p.isVisible('#vtCajaBtn'));
    await p.click('#vtCajaBtn');
    await p.fill('#vtBase', '100.000'); await p.click('#vtAbrir');
    chk('1. Abrir caja con base de $100.000', await D(() => data.turno && data.turno.base === 100000));
    await p.click('.vt-ov [data-m="salida"]');
    await p.fill('#vtMonto', '30000'); await p.click('.vt-ov [data-ej="Pago a proveedor"]'); await p.click('#vtOk');
    await p.click('.vt-ov [data-m="entrada"]');
    await p.fill('#vtMonto', '20000'); await p.fill('#vtMotivo', 'Sencillo'); await p.click('#vtOk');
    const r1 = await D(() => ventoTurno.resumen());
    chk('1. Salida de $30.000 (pago a proveedor) y entrada de $20.000 (sencillo) guardadas con motivo', r1.salidas === 30000 && r1.entradas === 20000 && r1.movs[0].motivo === 'Pago a proveedor' && r1.movs[1].motivo === 'Sencillo', r1);
    chk('1. El panel muestra el efectivo que debe haber ($90.000)', /Efectivo que debe haber\s*\$\s?90\.000/.test(await p.textContent('.vt-ov')), await p.textContent('.vt-ov'));
    await p.click('.vt-ov [data-x]');
    await vender([['ag', 2]]);   // $8.000 en efectivo
    await vender([['em', 2]], 'transferencia');   // $5.000 por Nequi (no entra a la caja)
    chk('1. «Caja de hoy» (POS) muestra el efectivo que debe haber: 100.000 + 8.000 + 20.000 − 30.000 = $98.000', await D(() => /98\.000/.test(ventoTurno.bloqueHoy())));
    const cierre = p.evaluate(() => closeCashRegister());
    await p.waitForSelector('.vt-ov #vtDif', { timeout: 5000 });
    chk('1. Al cerrar: sale el arqueo con billetes y monedas y lo que debe haber', /Arqueo de caja/.test(await p.textContent('.vt-ov')) && /98\.000/.test(await p.textContent('.vt-ov')) && await p.locator('.vt-ov [data-b="50000"]').count() === 1);
    await p.fill('.vt-ov [data-b="50000"]', '1'); await p.fill('.vt-ov [data-b="20000"]', '2'); await p.fill('.vt-ov [data-mo="500"]', '6');   // 50.000 + 40.000 + 3.000 = 93.000
    chk('1. Contado $93.000 → «⚠️ Faltan $5.000» en vivo', /Faltan\s*\$\s?5\.000/.test(await p.textContent('#vtDif')) && /falta/.test(await p.getAttribute('#vtDif', 'class')), await p.textContent('#vtDif'));
    await p.click('.vt-ov [data-si]');
    await cierre;
    const cl = await D(() => data.closures[0]);
    chk('1. El cierre guarda la caja: base, entradas, salidas, debía haber 98.000, contado 93.000, faltan 5.000', cl && cl.caja && cl.caja.esperado === 98000 && cl.caja.contado === 93000 && cl.caja.diferencia === -5000 && cl.caja.detalle['50000'] === 1, cl && cl.caja);
    chk('1. …y la caja queda cerrada (la próxima se abre con su base)', await D(() => data.turno === null && !ventoTurno.turno()));
    const txt = await D(() => buildClosureText(data.closures[0]));
    chk('1. Resumen por WhatsApp con la caja: base, entradas, salidas y «faltan»', /Caja \(efectivo\)/.test(txt) && /Base: \$\s?100\.000/.test(txt) && /Pago a proveedor/.test(txt) && /faltan \$\s?5\.000/.test(txt), txt);
    chk('1. Pantalla del cierre: «⚠️ Faltan»', /Faltan/.test(await p.textContent('#closureReportBody')));
    await p.evaluate(() => document.getElementById('closureOverlay').classList.remove('show'));

    // ===== 2. Inventario por código =====
    await p.evaluate(() => { const b = document.querySelector('nav button[data-view="inventario"]'); b && b.click(); });
    await p.waitForTimeout(200);
    await p.evaluate(() => { const d = document.getElementById('viPanel'); d.open = true; d.dispatchEvent(new Event('toggle')); });
    chk('2. Inventario → «🔢 Inventario por código» avisa que hay productos sin código', /sin código/.test(await p.textContent('#viCuerpo')) && await p.isVisible('#viDar'));
    await p.click('#viDar');
    const cods = await D(() => data.products.map(x => x.name + '=' + (x.codigo || (x.barcodes || [])[0])));
    chk('2. «Darles código interno»: Empanada 1001 y Gaseosa 1002 (el Águila conserva su código de barras)', cods.join() === 'Águila=7702004003508,Empanada=1001,Gaseosa=1002', cods);
    chk('2. El código nuevo sirve en toda la app (la caja lo encuentra)', await D(() => findProductByScannedCode('1001') && findProductByScannedCode('1001').name === 'Empanada'));
    // Consultar
    await p.fill('#viCod', '1002'); await p.press('#viCod', 'Enter');
    chk('2. 🔎 Consultar «1002»: Gaseosa con precio, costo, existencias y kárdex', /Gaseosa/.test(await p.textContent('#viZona')) && /Existencias\s*5/.test(await p.textContent('#viZona')) && /Kárdex/.test(await p.textContent('#viZona')));
    // Entrada de mercancía
    await p.click('[data-vm="entrada"]');
    for(const c of ['7702004003508', '7702004003508', '12*1001']){ await p.fill('#viCod', c); await p.press('#viCod', 'Enter'); }
    chk('2. 📥 Entrada: cada lectura suma (2 Águila) y «12*1001» suma 12 empanadas', await D(() => { const c = JSON.parse(localStorage.getItem('vento_entrada:local')); return c.items.find(x => x.p === 'ag').q === 2 && c.items.find(x => x.p === 'em').q === 12; }));
    await p.fill('[data-ec="em"]', '1200'); await p.dispatchEvent('[data-ec="em"]', 'change');
    await p.fill('#viProv', 'Distribuidora El Sol · FV-889'); await p.dispatchEvent('#viProv', 'change');
    await p.click('#viAplicar');
    const st2 = await D(() => ({ ag: data.products.find(x => x.id === 'ag').stock, em: data.products.find(x => x.id === 'em').stock, costoEm: data.products.find(x => x.id === 'em').cost }));
    chk('2. «Aplicar entrada»: Águila 18→20, Empanada 8→20 y su costo nuevo $1.200', st2.ag === 20 && st2.em === 20 && st2.costoEm === 1200, st2);
    // Toma de inventario
    await p.click('[data-vm="conteo"]');
    for(const c of ['17*7702004003508', '20*1001', '1002', '1002', '1002']){ await p.fill('#viCod', c); await p.press('#viCod', 'Enter'); }
    const z = await p.textContent('#viZona');
    chk('2. 📋 Conteo: compara con el sistema (Águila 17 de 20 → −3, Gaseosa 3 de 5 → −2) y dice cuánto falta en plata', /−?-3/.test(z) && /-2/.test(z) && /faltan \$\s?11\.100/.test(z), z);
    chk('2. El conteo se guarda aunque se cierre la app', await D(() => !!JSON.parse(localStorage.getItem('vento_conteo:local'))));
    await p.click('#viAplicar');
    const st3 = await D(() => data.products.map(x => x.stock).join());
    chk('2. «Aplicar ajustes»: existencias = lo contado (17, 20, 3)', st3 === '17,20,3', st3);
    // Kárdex
    await p.click('[data-vm="consultar"]'); await p.fill('#viCod', '7702004003508'); await p.press('#viCod', 'Enter');
    const k = await D(() => ventoInventario.kardex(data.products.find(x => x.id === 'ag')).map(x => x.tipo + ':' + x.q + ':' + x.saldo));
    chk('2. 📒 Kárdex del Águila: venta −2 (saldo 18), entrada +2 (20), conteo −3 (17)', k.join('|') === 'conteo:-3:17|entrada:2:20|venta:-2:18', k);
    chk('2. …y se ve en pantalla con quién y el proveedor', /Distribuidora El Sol/.test(await p.textContent('#viZona')) && /Ajuste por conteo/.test(await p.textContent('#viZona')));

    // ===== 3. Precio por cantidad =====
    await p.fill('#viEsDesde', '6'); await p.fill('#viEsPrecio', '3500'); await p.click('#viEsAdd');
    chk('3. 💲 Águila: desde 6 unidades a $3.500', await D(() => JSON.stringify(data.products.find(x => x.id === 'ag').escalas) === '[{"desde":6,"precio":3500}]'));
    const pc = await D(() => { ventoPOS.vaciar(); ventoPOS.agregar('ag', 5); const a = ventoPOS.carrito()[0].price; ventoPOS.agregar('ag', 1); const b2 = ventoPOS.carrito()[0].price; ventoPOS.vaciar(); return [a, b2]; });
    chk('3. En la caja: 5 Águilas a $4.000; al llevar la 6ª, todas a $3.500', pc[0] === 4000 && pc[1] === 3500, pc);
    const vMay = await vender([['ag', 6]]);
    chk('3. La venta queda por 6 × $3.500 = $21.000', await D(id => data.history.find(h => h.id === id).total === 21000, vMay));

    // ===== 4. Devolución =====
    await p.evaluate(() => { ventoTurno.abrir(50000); });
    const vDev = await vender([['em', 4], ['ga', 1]]);   // 4 × 2.500 + 3.000 = 13.000 en efectivo
    await p.evaluate(id => window.ventoInventario.devolucion(data.history.find(h => h.id === id)), vDev);
    await p.fill('[data-dv="0"]', '2'); await p.fill('#viDvMot', 'Llegaron frías'); await p.dispatchEvent('[data-dv="0"]', 'input');
    chk('4. ↩️ Devolución: «Devolver: $5.000» y la opción de sacar el efectivo de la caja', /\$\s?5\.000/.test(await p.textContent('#viDvTot')) && await p.isChecked('#viDvEf'));
    await p.click('#viDvOk');
    const dv = await D(id => { const h = data.history.find(x => x.id === id); return { total: h.total, em: h.items.find(i => i.name === 'Empanada').qty, pago: h.payments[0].amount, dev: h.devoluciones, stockEm: data.products.find(x => x.id === 'em').stock, caja: ventoTurno.resumen() }; }, vDev);
    chk('4. La venta baja a $8.000 (2 empanadas + gaseosa) y queda anotada la devolución con su motivo', dv.total === 8000 && dv.em === 2 && dv.pago === 8000 && dv.dev.length === 1 && dv.dev[0].motivo === 'Llegaron frías', dv);
    chk('4. Las 2 empanadas vuelven al inventario (16 + 2 = 18) con su línea en el kárdex', dv.stockEm === 18 && await D(() => ventoInventario.kardex(data.products.find(x => x.id === 'em'))[0].tipo === 'devolucion'), dv.stockEm);
    chk('4. Los $5.000 devueltos salen de la caja (salida «Devolución: Llegaron frías»)', dv.caja.salidas === 5000 && /Devolución: Llegaron frías/.test(dv.caja.movs[0].motivo), dv.caja);
    await p.evaluate(() => { const b = document.querySelector('nav button[data-view="historial"]'); b && b.click(); renderHistorial(); });
    chk('4. En el historial cada venta tiene «↩️ Devolución»', await D(() => !!document.querySelector('.hist-fix[data-fix="devolver"]')));

    // ===== Cierre automático (programado): no se queda esperando el arqueo =====
    await p.evaluate(() => closeCashRegister({ auto: true }));
    chk('Cierre automático: guarda la caja «sin contar» sin abrir el arqueo', await D(() => data.closures[0].caja && data.closures[0].caja.contado === null && !document.querySelector('.vt-ov')));
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
