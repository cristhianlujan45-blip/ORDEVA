// 🧾📊 ORDEVA 1.69.0 · IVA detallado y Excel completo. Sin internet.
//  1. Producto gravado (19 %, 5 %), exento o excluido (ficha del producto → «Tipo de IVA»).
//  2. Contabilidad → «🧾 IVA del período»: IVA generado por tarifa, exentas, excluidas, IVA descontable de las compras,
//     saldo por pagar y retenciones (Ajustes → Negocio) — estimado para el contador.
//  3. «📊 Excel completo»: un .xlsx de verdad (se abre con una librería de hojas de cálculo) con Resumen, Ventas,
//     Productos vendidos, Gastos e IVA, y los números como números.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const { spawnSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';

(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 900) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1200);
    await p.fill('#authBiz', 'Tienda IVA'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1500);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});

    // ===== 1. Tipo de IVA en la ficha =====
    await p.evaluate(() => {
      document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.ivaResponsable = true; data.ivaRate = 19;
      data.products = [{ id: 'g', name: 'Gaseosa', price: 11900, cost: 5000 }, { id: 'p', name: 'Pan', price: 10500, iva: 5 }, { id: 'l', name: 'Leche', price: 4000 }, { id: 'a', name: 'Arroz', price: 5000 }];
      saveData(); openEditProductModal('a'); document.getElementById('editProdCostWrap').open = true;
    });
    await p.waitForTimeout(300);
    await p.selectOption('#editProdIvaTipo', 'excluido');
    await p.evaluate(() => document.getElementById('editProdSaveBtn').click());
    await p.waitForTimeout(300);
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); openEditProductModal('l'); document.getElementById('editProdCostWrap').open = true; });
    await p.waitForTimeout(200);
    await p.selectOption('#editProdIvaTipo', 'exento');
    await p.evaluate(() => document.getElementById('editProdSaveBtn').click());
    await p.waitForTimeout(300);
    let v = await p.evaluate(() => ({ a: data.products.find(x => x.id === 'a').ivaTipo, l: data.products.find(x => x.id === 'l').ivaTipo, g: data.products.find(x => x.id === 'g').ivaTipo, ivaA: ivaDeProducto(data.products.find(x => x.id === 'a')), ivaG: ivaDeProducto(data.products.find(x => x.id === 'g')) }));
    chk('1. La ficha guarda «Excluido» (Arroz) y «Exento» (Leche); la Gaseosa queda gravada', v.a === 'excluido' && v.l === 'exento' && !v.g, v);
    chk('1. El IVA del producto excluido es 0 y el gravado 19 %', v.ivaA === 0 && v.ivaG === 19, v);

    // ===== 2. IVA del período =====
    await p.evaluate(() => {
      const hoy = new Date();
      data.history = [{ id: 'v1', date: hoy.toISOString(), total: 43300, items: [{ productId: 'g', name: 'Gaseosa', price: 11900, cost: 5000, qty: 2 }, { productId: 'p', name: 'Pan', price: 10500, qty: 1 }, { productId: 'l', name: 'Leche', price: 4000, qty: 1 }, { productId: 'a', name: 'Arroz', price: 5000, qty: 1 }],
        payments: [{ method: 'efectivo', amount: 43300, note: 'Efectivo' }] }];
      data.purchases = [{ id: 'c1', supplier: 'Postobón', date: hoy.toISOString().slice(0, 10), at: hoy.toISOString(), total: 11900, items: [{ productId: 'g', name: 'Gaseosa', qty: 2, cost: 5950, taxRate: 19, lineTotal: 11900 }] }];
      data.contab = [{ id: 'x', tipo: 'gasto', cat: 'servicios', monto: 50000, fecha: hoy.toISOString().slice(0, 10) }];
      data.retenciones = { retefuente: 2.5, reteica: 4.14 };
      saveData();
      const bt = document.querySelector('nav button[data-view="contabilidad"]'); if(bt) bt.click(); ctPeriodo = 'mes'; renderConta();
    });
    await p.waitForTimeout(300);
    v = await p.evaluate(() => { const I = window.ventoFinanzas.informeIva(data, { ini: 0, fin: Date.now() + 1000 }); return { I, txt: document.getElementById('ctIva').innerText }; });
    const I = v.I;
    chk('2. Gravadas al 19 %: ventas $23.800 → base $20.000, IVA $3.800', I.ventas.porTarifa.some(t => t.tarifa === 19 && t.ventas === 23800 && t.base === 20000 && t.iva === 3800), I.ventas.porTarifa);
    chk('2. Gravadas al 5 % (Pan): $10.500 → base $10.000, IVA $500', I.ventas.porTarifa.some(t => t.tarifa === 5 && t.base === 10000 && t.iva === 500), I.ventas.porTarifa);
    chk('2. Exentas $4.000 y excluidas $5.000 (sin IVA)', I.ventas.exentas === 4000 && I.ventas.excluidas === 5000, I.ventas);
    chk('2. IVA generado $4.300; descontable de la factura $1.900; por pagar $2.400', I.ventas.generado === 4300 && I.compras.descontable === 1900 && I.saldo === 2400, I);
    chk('2. Retenciones sobre compras: ReteFuente 2,5 % de $10.000 = $250 · ReteICA 4,14 ‰ = $41', I.retenciones.retefuente === 250 && I.retenciones.reteica === 41 && I.retenciones.reteiva === 0, I.retenciones);
    chk('2. La tarjeta «IVA del período» lo muestra (por pagar $2.400) y aclara que es un estimado para el contador', /IVA por pagar/.test(v.txt) && /2\.400/.test(v.txt) && /contador/.test(v.txt), v.txt);
    await p.evaluate(() => { document.getElementById('retFuenteIn') && (document.getElementById('retFuenteIn').value = '1.5'); const el = document.getElementById('retFuenteIn'); el && el.dispatchEvent(new Event('blur')); });
    chk('2. Ajustes → Negocio: las retenciones se guardan', (await p.evaluate(() => data.retenciones.retefuente)) === 1.5);

    // ===== 3. Excel =====
    const espera = p.waitForEvent('download', { timeout: 10000 });
    await p.evaluate(() => document.getElementById('ctXlsx').click());
    const dl = await espera;
    const ruta = path.join(os.tmpdir(), 'ordeva-prueba-' + process.pid + '.xlsx');
    await dl.saveAs(ruta);
    chk('3. Se descarga un archivo .xlsx', /\.xlsx$/.test(dl.suggestedFilename()) && fs.statSync(ruta).size > 1000, dl.suggestedFilename());
    const py = spawnSync('python3', ['-c', `
import sys, json, openpyxl
wb = openpyxl.load_workbook(sys.argv[1])
out = {'hojas': wb.sheetnames}
def filas(n): return [[c for c in r] for r in wb[n].iter_rows(values_only=True)]
out['resumen'] = filas('Resumen'); out['ventas'] = filas('Ventas'); out['productos'] = filas('Productos vendidos'); out['gastos'] = filas('Gastos'); out['iva'] = filas('IVA')
print(json.dumps(out, default=str))`, ruta], { encoding: 'utf8' });
    let X = null; try{ X = JSON.parse(py.stdout); }catch(e){}
    chk('3. Es un Excel de verdad: una librería de hojas de cálculo lo abre, con 5 hojas', X && JSON.stringify(X.hojas) === JSON.stringify(['Resumen', 'Ventas', 'Productos vendidos', 'Gastos', 'IVA']), py.stderr || X);
    if(X){
      const val = (f, c) => (f.find(r => r[0] === c) || [])[1];
      chk('3. Resumen: vendido 43300, salidas 61900 (gasto + factura de compra), gastos operativos 50000 e IVA por pagar 2400 (como números)', val(X.resumen, 'Vendido') === 43300 && val(X.resumen, 'Gastos (salidas)') === 61900 && val(X.resumen, 'Gastos operativos') === 50000 && val(X.resumen, 'IVA por pagar (estimado)') === 2400, X.resumen);
      chk('3. Ventas: una fila con el total 43300 y el medio de pago', X.ventas.length === 2 && X.ventas[1][3] === 43300 && /Efectivo/.test(X.ventas[1][6]), X.ventas);
      chk('3. Productos vendidos: Gaseosa 2 unidades, 23800 vendidos, ganancia 13800', X.productos.some(r => r[0] === 'Gaseosa' && r[2] === 2 && r[3] === 23800 && r[5] === 13800), X.productos);
      chk('3. Gastos: Servicios 50000 (tipo Operativos)', X.gastos.some(r => /Servicios/.test(r[1]) && /Operativos/.test(r[2]) && r[5] === 50000), X.gastos);
      chk('3. IVA: gravadas al 19 % con IVA 3800, compras con IVA 1900 y la nota para el contador', X.iva.some(r => /19 %/.test(r[0]) && r[3] === 3800) && X.iva.some(r => /Compras/.test(r[0]) && r[3] === 1900) && X.iva.some(r => /contador/.test(String(r[0]))), X.iva);
    }
    const crc = await p.evaluate(() => window.ventoXlsx._crc32(new TextEncoder().encode('123456789')).toString(16));
    chk('3. CRC32 del ZIP correcto (valor de control estándar cbf43926)', crc === 'cbf43926', crc);
    try{ fs.unlinkSync(ruta); }catch(e){}

    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ Excepción: ' + (e && e.stack || e)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
