// 🧾 ORDEVA 1.83.0 · Los errores que encontró la revisión Goldfish (puente/egm/REVISION-GOLDFISH.md, B1–B4) y los ajustes.
//  B2. Número de factura por equipo: el primero sigue con la numeración de siempre (FV-0005…); otro equipo, con su letra
//      (FV-B-0001); si dos toman la misma letra, el que la tomó después pasa a la siguiente; «Deshacer» devuelve el número.
//  B1. Con la facturación electrónica prendida, el impuesto del recibo es el de la DIAN (INC o IVA), y no se deja poner otro.
//  B3. Al juntar dos cierres de la misma caja, lo que debía haber y la diferencia se recalculan con las ventas de los dos,
//      y quedan los dos conteos.
//  B4. La toma de inventario descuenta los lotes (no queda «por vencer 10 u» con stock 0) y los lotes viejos reciben id.
//  Excel de Contabilidad: el período anterior al lado, propinas aparte e INC por pagar.
//  Stock bajo: un solo criterio (el del inventario) en la caja y en el inicio, con «🛒 Pedir» a un toque.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
  const pausa = ms => new Promise(r => setTimeout(r, ms));
  try{
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await pausa(1000);
    await p.evaluate(() => { const s = document.getElementById('authType'); s.value = 'restaurante'; s.dispatchEvent(new Event('change')); });
    await p.fill('#authBiz', 'Restaurante 183'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await pausa(1500);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.products = [{ id: 'a', name: 'Arroz', price: 4000, stock: 4 }, { id: 'l', name: 'Leche', price: 3900, stock: 50, minStock: 5 }]; data.history = []; data.closures = []; delete data.facturaEquipos; data.invoiceNextNo = 5; saveData(); });
    // ===== B2 =====
    let v = await p.evaluate(() => { const a = window.ventoFactura.tomar().no, b = window.ventoFactura.tomar().no; return { a, b, ver: window.ventoFactura.ver(), viejo: data.invoiceNextNo }; });
    chk('B2. El primer equipo sigue la numeración de siempre: FV-0005, FV-0006 (y la siguiente FV-0007)', v.a === 'FV-0005' && v.b === 'FV-0006' && v.ver === 'FV-0007' && v.viejo === 7, v);
    v = await p.evaluate(() => { const yo = codigoEquipo(); delete data.facturaEquipos[yo]; data.facturaEquipos['OTRO-AAAA'] = { l: '', n: 9, at: 1 }; return [window.ventoFactura.tomar().no, window.ventoFactura.tomar().no]; });
    chk('B2. Otro equipo de la misma cuenta: FV-B-0001, FV-B-0002 (no repite los del primero)', v[0] === 'FV-B-0001' && v[1] === 'FV-B-0002', v);
    v = await p.evaluate(() => { const yo = codigoEquipo(); data.facturaEquipos['OTRO-BBBB'] = { l: 'B', n: 4, at: 1 }; data.facturaEquipos[yo].at = Date.now(); return window.ventoFactura.tomar().no; });
    chk('B2. Dos equipos con la letra B a la vez: el que la tomó después pasa a la C (FV-C-0001)', v === 'FV-C-0001', v);
    v = await p.evaluate(() => { const t = window.ventoFactura.tomar(); t.devolver(); return [t.no, window.ventoFactura.ver()]; });
    chk('B2. «Deshacer» devuelve el número (la siguiente vuelve a ser la misma)', v[0] === v[1], v);
    v = await p.evaluate(() => { openTableModal(1); addFavoriteToTable('l'); const e = closeTableToHistory(1); return e && e.invoiceNo; });
    chk('B2. La venta de una mesa sale con el número de este equipo', /^FV-C-000\d$/.test(v || ''), v);
    // ===== B1 =====
    v = await p.evaluate(() => { data.impuestoConsumo = false; data.ivaResponsable = true; window.ventoDian.impuestoAlRecibo({ activo: true, impuesto: 'inc', tarifa: 8 }); return { inc: data.impuestoConsumo, tasa: data.incRate, iva: data.ivaResponsable }; });
    chk('B1. Con la DIAN en «INC 8 %», el recibo también queda con INC 8 % (y sin IVA)', v.inc === true && v.tasa === 8 && v.iva === false, v);
    v = await p.evaluate(() => { window.ventoDian.impuestoAlRecibo({ activo: true, impuesto: 'iva', tarifa: 19 }); return { inc: data.impuestoConsumo, iva: data.ivaResponsable, tasa: data.ivaRate }; });
    chk('B1. Con la DIAN en «IVA 19 %», el recibo queda con IVA 19 % (y sin INC)', v.inc === false && v.iva === true && v.tasa === 19, v);
    await p.evaluate(() => { window.ventoDian.impuestoDian = () => 'iva'; document.querySelector('nav button[data-view="ajustes"]').click(); });
    await pausa(500);
    v = await p.evaluate(() => { const t = document.getElementById('incOnToggle'); t.checked = true; t.dispatchEvent(new Event('change')); return { inc: data.impuestoConsumo, sw: t.checked, aviso: [...document.querySelectorAll('.toast, #toast, .vt-toast')].map(x => x.textContent).join(' ') }; });
    chk('B1. Con la DIAN prendida en IVA, prender el INC del recibo no se deja (y dice dónde cambiarlo)', v.inc === false && v.sw === false, v);
    // ===== B3 =====
    v = await p.evaluate(() => {
      data.history = []; const ahora = Date.now(), desde = new Date(ahora - 3600e3).toISOString();
      [[8000, 'efectivo'], [5000, 'efectivo'], [7000, 'nequi']].forEach(([m, met], i) => data.history.unshift({ id: 'v' + i, total: m, payments: [{ method: met, amount: m }], debt: 0, items: [{ name: 'Arroz', qty: 1, price: m }], date: new Date(ahora - 600e3 + i * 1000).toISOString() }));
      // El celular contó sin la venta de 5.000 en efectivo del computador (no le había llegado): esperado 108.000, contó 113.000
      data.closures = [
        { id: 'c1', date: new Date(ahora - 10e3).toISOString(), from: desde, z: 1, ticketCount: 2, totalSold: 15000, caja: { base: 100000, ventas: 8000, entradas: 0, salidas: 0, esperado: 108000, contado: 113000, diferencia: 5000, por: 'ana' }, by: 'ana' },
        { id: 'c2', date: new Date(ahora - 5e3).toISOString(), from: desde, z: 1, ticketCount: 3, totalSold: 20000, caja: { base: 100000, ventas: 13000, entradas: 0, salidas: 0, esperado: 113000, contado: null, diferencia: null }, by: 'luis' } ];
      juntarCierresRepetidos(); const c = data.closures; return { n: c.length, z: c[0].z, esperado: c[0].caja.esperado, contado: c[0].caja.contado, dif: c[0].caja.diferencia, vendido: c[0].totalSold }; });
    chk('B3. Juntar los dos cierres: uno solo, Z 1, con lo vendido de los dos ($20.000)', v.n === 1 && v.z === 1 && v.vendido === 20000, v);
    chk('B3. … lo que debía haber se recalcula con el efectivo de los dos ($113.000) y ya no sale un sobrante falso', v.esperado === 113000 && v.contado === 113000 && v.dif === 0, v);
    v = await p.evaluate(() => { const ahora = Date.now(), desde = new Date(ahora - 7200e3).toISOString();
      data.closures = [{ id: 'd1', date: new Date(ahora - 9e3).toISOString(), from: desde, z: 2, caja: { base: 0, ventas: 0, entradas: 0, salidas: 0, esperado: 0, contado: 13000, diferencia: 13000, por: 'ana' } },
        { id: 'd2', date: new Date(ahora - 8e3).toISOString(), from: desde, z: 2, caja: { base: 0, ventas: 0, entradas: 0, salidas: 0, esperado: 0, contado: 12000, diferencia: 12000, por: 'luis' } }];
      juntarCierresRepetidos(); return data.closures[0].caja.conteos; });
    chk('B3. Si contaron los dos, quedan los dos conteos', Array.isArray(v) && v.length === 2 && v.some(x => x.contado === 13000) && v.some(x => x.contado === 12000), v);
    // ===== B4 =====
    v = await p.evaluate(() => { const pr = data.products.find(x => x.id === 'l'); pr.stock = 10; pr.lotes = [{ q: 6, vence: '2026-12-01', t: 1 }, { q: 4, vence: '2027-03-01', t: 2 }];
      saveData(); return loadData().then(() => { const q = data.products.find(x => x.id === 'l'); return q.lotes.map(l => l.id); }); });
    chk('B4. Los lotes viejos reciben un id fijo (igual en todos los equipos)', Array.isArray(v) && v.length === 2 && v.every(Boolean) && v[0] === 'lt1-2026-12-01', v);
    v = await p.evaluate(() => { const pr = data.products.find(x => x.id === 'l'); pr.stock = 3; window.ventoFinanzas.ajustarLotes(pr); return pr.lotes.map(l => l.vence + ':' + l.q); });
    chk('B4. Toma de inventario: quedan 3 → los lotes suman 3 (sale primero del que vence antes)', JSON.stringify(v) === JSON.stringify(['2027-03-01:3']), v);
    // ===== Excel =====
    v = await p.evaluate(() => { let hojas = null; const X = window.ventoXlsx, orig = X.descargar; X.descargar = (n, h) => { hojas = h; }; try{
        const ahora = Date.now(); data.impuestoConsumo = true; data.incRate = 8;
        data.history = [{ id: 'x1', total: 21600, inc: 8, payments: [{ method: 'efectivo', amount: 21600 }], debt: 0, items: [{ name: 'Bandeja', qty: 1, price: 18000 }, { name: '🙏 Propina', qty: 1, price: 3600 }], date: new Date(ahora - 3600e3).toISOString() }];
        ctExcel(); }finally{ X.descargar = orig; }
      const R = hojas && (hojas.find(h => h.nombre === 'Resumen') || {}).filas || []; return { cab: R[0], inc: R.find(f => /INC/.test(f[0])), prop: R.find(f => /Propinas/.test(f[0])) }; });
    chk('Excel: el Resumen trae el período anterior al lado y el cambio', v.cab && v.cab.length === 4 && /anterior/.test(v.cab[2]), v);
    chk('Excel: las propinas aparte ($3.600) y el INC por pagar ($1.333 de $18.000)', v.prop && v.prop[1] === 3600 && v.inc && v.inc[1] === 1333, v);
    // ===== Stock bajo =====
    v = await p.evaluate(() => ({ arroz: window.ventoStockBajo(data.products.find(x => x.id === 'a')), leche: window.ventoStockBajo(Object.assign({}, data.products.find(x => x.id === 'l'), { stock: 40 })) }));
    chk('Stock bajo: un solo criterio (Arroz con 4 y sin mínimo: bajo; Leche con 40 y mínimo 5: no)', v.arroz === true && v.leche === false, v);
    v = await p.evaluate(() => { try{ document.querySelector('nav button[data-view="inicio"]').click(); }catch(e){} return new Promise(r => setTimeout(() => { const a = document.getElementById('o2Alertas'); r({ txt: a ? a.textContent : '', pedir: !!(a && a.querySelector('[data-o2ir="pedir"]')) }); }, 800)); });
    chk('Inicio: «Existencias bajas» con el Arroz y el botón «🛒 Pedir»', /Existencias bajas/.test(v.txt) && /Arroz/.test(v.txt) && v.pedir, v);
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ Excepción: ' + (e && e.stack || e)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
