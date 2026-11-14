// 💸 Salidas de Nequi / DaviPlata por clasificar (1.66.5). La app Android se simula (VentoAndroid.pagosSalidasTomar);
// lo demás es la app de verdad.
//  1. Lectura: el valor y a quién se le pagó, con avisos reales («Enviaste $250.000 a…», «Pasaste $100 a otro DaviPlata»,
//     SMS del 85888 «Compra exitosa en la Tienda Virtual por 20,000», «$1.250.000,00»).
//  2. Un empleado (no administrador) NO las toma ni las ve.
//  3. El administrador: salen en Contabilidad con valor, app y a quién; sin valor no se anota nada; y en Inicio, la alerta.
//  4. 1.79.0: cada salida queda en Contabilidad APENAS llega («Otros gastos», por revisar), sin esperar a clasificarla.
//  5. 📦 Proveedor → el gasto pasa a «Proveedores» con el nombre (sin duplicarlo); la próxima vez a ese nombre queda sola
//     como proveedor.
//  6. 🗂️ Otro gasto → gasto de la categoría elegida (Arriendo).
//  7. Pago de una factura escaneada (mismo proveedor y valor) → se sugiere «Ya estaba anotada» y no se suma dos veces.
//  8. 🙈 No es del negocio → pide confirmación; con «No» queda; con «Sí» se quita el gasto.
//  9. 🏧 Retiro en cajero o corresponsal → «retiro: de banco a efectivo», que no suma a gastos ni a entradas.
// 10. ➖ Salida de efectivo de la caja → también queda en Contabilidad (y «Retiro del dueño» no es gasto).
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';

(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => {
      try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){}
      const A = window.__and = { salidas: [], tomadas: 0 };
      window.VentoAndroid = {
        pagosAvisosTomar: () => '[]',
        pagosSalidasTomar: () => { A.tomadas++; const s = JSON.stringify(A.salidas); A.salidas = []; return s; },
      };
    });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1500);
    await p.fill('#authBiz', 'Tienda Salidas'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1500);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));

    // ===== 1. Lectura =====
    const L = await p.evaluate(() => {
      const S = window.ventoSalidas, x = t => [S.montoDe(t), S.destinoDe(t)];
      return {
        nequi: x('Nequi | Envío | Enviaste $250.000 a DISTRIBUIDORA EL SOL'),
        davi: x('DaviPlata | DaviPlata | Pasaste $100 a otro DaviPlata. Para saber mas, consulta tus movimientos.'),
        sms: x('SMS | 85888 | DaviPlata: Compra exitosa en la Tienda Virtual por  20,000. Para saber mas, consulta tus movimientos'),
        dec: x('Bancolombia | Bancolombia | Transferiste $1.250.000,00 a ARRENDAMIENTOS LA 80 desde tu cuenta *1234'),
        sin: x('Nequi | Nequi | Pagaste con tu Nequi. Revisa tus movimientos'),
        appSms: S.appDe({ app: 'SMS 85888', txt: 'SMS | 85888 | DaviPlata: Compra exitosa' })
      };
    });
    chk('1. Nequi «Enviaste $250.000 a DISTRIBUIDORA EL SOL» → $250.000, a «DISTRIBUIDORA EL SOL»', L.nequi[0] === 250000 && L.nequi[1] === 'DISTRIBUIDORA EL SOL', L.nequi);
    chk('1. DaviPlata «Pasaste $100 a otro DaviPlata» → $100', L.davi[0] === 100 && L.davi[1] === 'otro DaviPlata', L.davi);
    chk('1. SMS 85888 «Compra exitosa en la Tienda Virtual por 20,000» → $20.000 en «Tienda Virtual» (DaviPlata)', L.sms[0] === 20000 && L.sms[1] === 'Tienda Virtual' && L.appSms === 'DaviPlata', L);
    chk('1. «$1.250.000,00 a ARRENDAMIENTOS LA 80 desde tu cuenta» → $1.250.000 (sin los centavos), a «ARRENDAMIENTOS LA 80»', L.dec[0] === 1250000 && L.dec[1] === 'ARRENDAMIENTOS LA 80', L.dec);
    chk('1. Sin valor en el aviso → 0 (no se inventa)', L.sin[0] === 0, L.sin);

    const ahora = Date.now();
    const llegan = l => p.evaluate(l => { window.__and.salidas.push(...l); return window.ventoSalidas.tomar(); }, l);
    const S1 = [
      { id: 'n1', app: 'Nequi', txt: 'Nequi | Envío | Enviaste $250.000 a DISTRIBUIDORA EL SOL', t: ahora - 3600e3 },
      { id: 'd1', app: 'DaviPlata', txt: 'DaviPlata | DaviPlata | Pasaste $800.000 a JUAN ARRENDADOR', t: ahora - 7200e3 },
      { id: 'x1', app: 'Nequi', txt: 'Nequi | Nequi | Pagaste con tu Nequi. Revisa tus movimientos', t: ahora }   // sin valor
    ];

    // ===== 2. Empleado =====
    await p.evaluate(() => { window.__jefe = window.ventoRoles.esJefe; window.ventoRoles.esJefe = () => false; });
    let n = await llegan(S1);
    let v = await p.evaluate(() => ({ quedan: window.__and.salidas.length, box: !!document.getElementById('salidasBox') && !document.getElementById('salidasBox').hidden, cuantas: window.ventoSalidas.cuantas() }));
    chk('2. Un empleado NO las toma (se quedan en la app) ni las ve', n === 0 && v.quedan === 3 && !v.box && v.cuantas === 0, v);

    // ===== 3. Administrador =====
    await p.evaluate(() => { window.ventoRoles.esJefe = window.__jefe; });
    n = await p.evaluate(() => window.ventoSalidas.tomar());
    await p.evaluate(() => { const b = document.querySelector('nav button[data-view="contabilidad"]') ; if(b){ b.hidden = false; b.click(); } else document.querySelector('.more-tile[data-go="contabilidad"]').click(); });
    await p.waitForTimeout(400);
    const filas = () => p.evaluate(() => [...document.querySelectorAll('#salidasBox .sl-fila')].map(f => ({ id: f.dataset.id, txt: f.innerText.replace(/\s+/g, ' '), sug: [...f.querySelectorAll('.sl-sug')].map(x => x.dataset.sl) })));
    let F = await filas();
    chk('3. El administrador las toma: 2 con valor (la que no trae valor no se anota)', n === 2 && F.length === 2, { n, F });
    chk('3. Cada una con valor, app y a quién («$250.000 · Nequi · A DISTRIBUIDORA EL SOL»)', F.some(f => /250\.000/.test(f.txt) && /Nequi/.test(f.txt) && /A DISTRIBUIDORA EL SOL/.test(f.txt)) && F.some(f => /800\.000/.test(f.txt) && /DaviPlata/.test(f.txt)), F);
    v = await p.evaluate(() => { const a = window.ordeva2 && window.ordeva2.calc ? window.ordeva2.calc('hoy').alertas : []; return a.map(x => x.t); });
    chk('3. En Inicio sale la alerta «2 salidas del banco por revisar»', v.some(t => /2 salidas del banco por revisar/.test(t)), v);

    // ===== 4. Ya en Contabilidad =====
    v = await p.evaluate(() => (data.contab || []).map(g => ({ tipo: g.tipo, cat: g.cat, monto: g.monto, nota: g.nota, metodo: g.metodo, origen: g.origen, ref: g.ref })));
    chk('4. Las 2 salidas ya quedaron en Contabilidad como gasto «Otros» (sin clasificar todavía)', v.length === 2 && v.every(g => g.tipo === 'gasto' && g.cat === 'otros' && g.origen === 'salida') && v.some(g => g.monto === 250000 && /DISTRIBUIDORA EL SOL/.test(g.nota)), v);
    F = await filas();
    chk('4. En la lista dice cómo quedó y deja «✅ Así está bien»', F.every(f => /Quedó como gasto: «Otros gastos»/.test(f.txt) && /Así está bien/.test(f.txt)), F);

    // ===== 5. Proveedor =====
    await p.click('#salidasBox [data-id="n1"] [data-sl="prov"]'); await p.waitForTimeout(300);
    v = await p.evaluate(() => (data.contab || []).map(g => ({ cat: g.cat, monto: g.monto, nota: g.nota, metodo: g.metodo, origen: g.origen })));
    chk('5. 📦 Proveedor → el gasto de $250.000 pasa a «proveedores» por Nequi, con el nombre (sin duplicar)', v.length === 2 && v.filter(g => g.monto === 250000).length === 1 && (v = v.find(g => g.monto === 250000)) && (v = [v]) && v[0].cat === 'proveedores' && v[0].monto === 250000 && v[0].metodo === 'nequi' && /DISTRIBUIDORA EL SOL/.test(v[0].nota) && v[0].origen === 'salida', v);
    F = await filas();
    chk('5. … y sale de la lista de por clasificar', F.length === 1 && F[0].id === 'd1', F);
    await llegan([{ id: 'n2', app: 'Nequi', txt: 'Nequi | Envío | Enviaste $90.000 a DISTRIBUIDORA EL SOL', t: ahora }]);
    F = await filas();
    v = await p.evaluate(() => (data.contab || []).find(g => g.ref === 'n2') || null);
    chk('5. Otra salida a DISTRIBUIDORA EL SOL: queda sola como proveedor', v && v.cat === 'proveedores' && v.monto === 90000 && /Quedó como gasto de proveedor/.test((F.find(f => f.id === 'n2') || {}).txt) && F.length === 2, { v, F });

    // ===== 6. Otro gasto =====
    await p.click('#salidasBox [data-id="d1"] [data-sl="gasto"]');
    await p.selectOption('#salidasBox [data-id="d1"] .sl-cat select', 'arriendo');
    await p.click('#salidasBox [data-id="d1"] [data-sl="gok"]'); await p.waitForTimeout(300);
    v = await p.evaluate(() => (data.contab || []).filter(g => g.monto === 800000));
    chk('6. 🗂️ Otra categoría → «Arriendo» de $800.000 por DaviPlata (uno solo)', v.length === 1 && v[0].cat === 'arriendo' && v[0].metodo === 'nequi' && /JUAN ARRENDADOR/.test(v[0].nota), v);

    // ===== 7. Factura escaneada =====
    await p.click('#salidasBox [data-id="n2"] [data-sl="ok"]'); await p.waitForTimeout(300);
    await p.evaluate(t => { data.purchases = [{ id: 'f1', supplier: 'Distribuidora El Sol S.A.S.', date: new Date(t - 2 * 864e5).toISOString().slice(0, 10), at: t - 2 * 864e5, total: 120000, items: [] }]; saveData(); }, ahora);
    const antes = await p.evaluate(() => (data.contab || []).length);
    await llegan([{ id: 'n3', app: 'Nequi', txt: 'Nequi | Envío | Enviaste $120.000 a DISTRIBUIDORA EL SOL', t: ahora }]);
    F = await filas();
    const f7 = F.find(f => f.id === 'n3') || {};
    v = await p.evaluate(() => (data.contab || []).length);
    chk('7. Pago de la factura escaneada (mismo proveedor y valor): NO se suma otra vez y lo dice', v === antes && /parece el pago de una factura/.test(f7.txt || ''), { v, antes, f7 });
    await p.click('#salidasBox [data-id="n3"] [data-sl="ok"]'); await p.waitForTimeout(300);
    v = await p.evaluate(() => ({ n: (data.contab || []).length, filas: document.querySelectorAll('#salidasBox .sl-fila').length }));
    chk('7. «Así está bien» la quita de la lista sin sumar nada', v.n === antes && v.filas === 0, v);

    // ===== 8. No es del negocio =====
    await llegan([{ id: 'p1', app: 'Nequi', txt: 'Nequi | Envío | Enviaste $40.000 a MAMÁ', t: ahora }]);
    await p.click('#salidasBox [data-id="p1"] [data-sl="no"]'); await p.waitForTimeout(300);
    const conf = await p.evaluate(() => { const o = document.getElementById('confirmOverlay'); return !!o && o.classList.contains('show'); });
    await p.evaluate(() => { const c = document.querySelector('#confirmOverlay .btn-ghost, #confirmCancelBtn'); c && c.click(); }); await p.waitForTimeout(300);
    v = await p.evaluate(() => document.querySelectorAll('#salidasBox .sl-fila').length);
    chk('8. «No es del negocio» pide confirmación; con «No» se queda', conf && v === 1, { conf, v });
    await p.click('#salidasBox [data-id="p1"] [data-sl="no"]'); await p.waitForTimeout(300);
    await p.click('#confirmOkBtn'); await p.waitForTimeout(300);
    v = await p.evaluate(() => ({ filas: document.querySelectorAll('#salidasBox .sl-fila').length, oculto: document.getElementById('salidasBox').hidden, gasto: (data.contab || []).some(g => /MAM/.test(g.nota || '')) }));
    chk('8. Con «Sí» se quita, sin gasto, y la tarjeta se esconde', v.filas === 0 && v.oculto && !v.gasto, v);
    await llegan([{ id: 'p2', app: 'Nequi', txt: 'Nequi | Envío | Enviaste $15.000 a MAMÁ', t: ahora }]);
    v = await p.evaluate(() => ({ filas: document.querySelectorAll('#salidasBox .sl-fila').length, gasto: (data.contab || []).some(g => /MAM/.test(g.nota || '')) }));
    chk('8. La próxima vez a MAMÁ ya no se anota sola', v.filas === 0 && !v.gasto, v);

    // ===== 9. Retiros =====
    // 1.98.3: el mismo pago avisado por la app del banco y por su SMS se anota UNA vez; dos iguales por el mismo camino, dos.
    const antesN = await p.evaluate(() => window.ventoSalidas.lista().length), t0 = Date.now();
    const par = await llegan([{ id: 'dup-app', app: 'Bancolombia', txt: 'Bancolombia | Bancolombia | Transferiste $77.700 a la cuenta 123', t: t0 }, { id: 'dup-sms', app: 'SMS 85540', txt: 'SMS | 85540 | Bancolombia: Transferiste $77.700 a la cuenta 123', t: t0 + 20000 }]);
    const dos = await llegan([{ id: 'ig-1', app: 'Nequi', txt: 'Nequi | Nequi | Enviaste $3.300 a JUAN', t: t0 }, { id: 'ig-2', app: 'Nequi', txt: 'Nequi | Nequi | Enviaste $3.300 a JUAN', t: t0 + 30000 }]);
    const despN = await p.evaluate(() => window.ventoSalidas.lista().length);
    chk('1.98.3 El mismo pago por la app del banco y por SMS se anota una sola vez (dos pagos iguales por el mismo camino siguen siendo dos)', par === 1 && dos === 2 && despN === antesN + 3, { par, dos, antesN, despN });
    // 1.98.1: más formas en que Nequi, DaviPlata y los bancos avisan lo que el dueño pagó o envió.
    const L98 = await p.evaluate(() => { const S = window.ventoSalidas; return [
      'Nequi | Envío exitoso | Tu envío de $35.000 a DISTRIBUIDORA EL SOL fue exitoso', 'Nequi | Nequi | Pago exitoso por $18.500 en TIENDA D1',
      'SMS | 85888 | DaviPlata: Transaccion exitosa por 25,000 a otro DaviPlata', 'Nequi | Nequi | Hiciste un pago de $12.000 a CLARO'].map(t => [S.montoDe(t), S.destinoDe(t)]); });
    chk('1.98.1 «Envío exitoso», «Pago exitoso», «Transacción exitosa» y «Hiciste un pago»: se lee el valor y a quién', JSON.stringify(L98.map(x => x[0])) === JSON.stringify([35000, 18500, 25000, 12000]) && /DISTRIBUIDORA EL SOL/i.test(L98[0][1]) && /TIENDA D1/i.test(L98[1][1]) && /CLARO/i.test(L98[3][1]), L98);
    const L9 = await p.evaluate(() => { const S = window.ventoSalidas; return ['Bancolombia | Bancolombia | Retiraste $50.000 en cajero Bancolombia', 'DaviPlata | DaviPlata | Retiro exitoso por $200.000 en corresponsal', 'Nequi | Nequi | Enviaste $5.000 a JUAN'].map(t => [S.esRetiro(t), S.montoDe(t)]); });
    chk('9. «Retiraste $50.000 en cajero» y «Retiro exitoso por $200.000 en corresponsal» son retiros; «Enviaste» no', L9[0][0] && L9[0][1] === 50000 && L9[1][0] && L9[1][1] === 200000 && !L9[2][0], L9);
    const res0 = await p.evaluate(() => { const x = ctMovimientos({ ini: 0, fin: Date.now() + 864e5 }); const s = t => x.mov.filter(m => m.tipo === t).reduce((a, m) => a + m.monto, 0); return { g: s('gasto'), i: s('venta') + s('ingreso') }; });
    await llegan([{ id: 'r1', app: 'DaviPlata', txt: 'DaviPlata | DaviPlata | Retiro exitoso por $200.000 en corresponsal', t: ahora }]);
    await p.evaluate(() => renderConta()); await p.waitForTimeout(200);
    v = await p.evaluate(() => { const g = (data.contab || []).find(x => x.ref === 'r1'); const x = ctMovimientos({ ini: 0, fin: Date.now() + 864e5 }); const s = t => x.mov.filter(m => m.tipo === t).reduce((a, m) => a + m.monto, 0);
      const fila = [...document.querySelectorAll('#ctLista .ct-mov')].map(d => d.innerText.replace(/\s+/g, ' ')).find(t => /200\.000/.test(t)) || '';
      return { g, gastos: s('gasto'), entradas: s('venta') + s('ingreso'), fila, quedo: (document.querySelector('#salidasBox [data-id="r1"]') || {}).innerText || '' }; });
    chk('9. El retiro queda como «traslado» de banco a efectivo y no suma a gastos ni a entradas', v.g && v.g.tipo === 'traslado' && v.g.cat === 'banco_efectivo' && v.gastos === res0.g && v.entradas === res0.i, { v, res0 });
    chk('9. En los movimientos se ve con 🏧 y «no es gasto»', /🏧/.test(v.fila) && /no es gasto/.test(v.fila) && /Quedó como retiro/.test(v.quedo), v);
    await p.click('#salidasBox [data-id="r1"] [data-sl="dueno"]'); await p.waitForTimeout(300);
    v = await p.evaluate(() => (data.contab || []).filter(x => x.ref === 'r1'));
    chk('9. Se puede cambiar a «Retiro del dueño» (uno solo)', v.length === 1 && v[0].tipo === 'traslado' && v[0].cat === 'retiro_dueno', v);

    // ===== 10. Salida de efectivo de la caja =====
    v = await p.evaluate(() => { window.ventoTurno.movimiento('salida', 30000, 'Pago a proveedor'); window.ventoTurno.movimiento('salida', 100000, 'Retiro del dueño'); window.ventoTurno.movimiento('salida', 8000, 'Devolución: dañado');
      return (data.contab || []).filter(g => g.origen === 'caja').map(g => ({ tipo: g.tipo, cat: g.cat, monto: g.monto, metodo: g.metodo })); });
    chk('10. ➖ Salida de caja «Pago a proveedor» → gasto de proveedores en efectivo; «Retiro del dueño» → retiro; la devolución no se duplica', v.length === 2 && v.some(g => g.tipo === 'gasto' && g.cat === 'proveedores' && g.monto === 30000 && g.metodo === 'efectivo') && v.some(g => g.tipo === 'traslado' && g.cat === 'retiro_dueno' && g.monto === 100000), v);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
