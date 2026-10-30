// 💸 Salidas de Nequi / DaviPlata por clasificar (1.66.5). La app Android se simula (VentoAndroid.pagosSalidasTomar);
// lo demás es la app de verdad.
//  1. Lectura: el valor y a quién se le pagó, con avisos reales («Enviaste $250.000 a…», «Pasaste $100 a otro DaviPlata»,
//     SMS del 85888 «Compra exitosa en la Tienda Virtual por 20,000», «$1.250.000,00»).
//  2. Un empleado (no administrador) NO las toma ni las ve.
//  3. El administrador: salen en Contabilidad con valor, app y a quién; sin valor no se anota nada; y en Inicio, la alerta.
//  4. Las salidas NO van al documento compartido (data) ni al servidor: solo en este celular.
//  5. 📦 Proveedor → gasto «Proveedores» con el nombre; la próxima vez a ese mismo nombre se sugiere «Proveedor».
//  6. 🗂️ Otro gasto → gasto de la categoría elegida (Arriendo).
//  7. Pago de una factura escaneada (mismo proveedor y valor) → se sugiere «Ya estaba anotada» y no se suma dos veces.
//  8. 🙈 No es del negocio → pide confirmación; con «No» queda; con «Sí» se quita sin gasto.
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
    chk('3. En Inicio sale la alerta «2 salidas de Nequi / DaviPlata por clasificar»', v.some(t => /2 salidas de Nequi \/ DaviPlata por clasificar/.test(t)), v);

    // ===== 4. Privacidad =====
    v = await p.evaluate(() => JSON.stringify(data));
    chk('4. Las salidas NO están en los datos compartidos del negocio (solo en este celular)', !/DISTRIBUIDORA|JUAN ARRENDADOR/.test(v), v.length);

    // ===== 5. Proveedor =====
    await p.click('#salidasBox [data-id="n1"] [data-sl="prov"]'); await p.waitForTimeout(300);
    v = await p.evaluate(() => (data.contab || []).map(g => ({ cat: g.cat, monto: g.monto, nota: g.nota, metodo: g.metodo, origen: g.origen })));
    chk('5. 📦 Proveedor → gasto «proveedores» de $250.000 por Nequi, con el nombre', v.length === 1 && v[0].cat === 'proveedores' && v[0].monto === 250000 && v[0].metodo === 'nequi' && /DISTRIBUIDORA EL SOL/.test(v[0].nota) && v[0].origen === 'salida', v);
    F = await filas();
    chk('5. … y sale de la lista de por clasificar', F.length === 1 && F[0].id === 'd1', F);
    await llegan([{ id: 'n2', app: 'Nequi', txt: 'Nequi | Envío | Enviaste $90.000 a DISTRIBUIDORA EL SOL', t: ahora }]);
    F = await filas();
    chk('5. Otra salida a DISTRIBUIDORA EL SOL: se sugiere «Proveedor» (no se clasifica sola)', (F.find(f => f.id === 'n2') || {}).sug.join() === 'prov' && F.length === 2, F);

    // ===== 6. Otro gasto =====
    await p.click('#salidasBox [data-id="d1"] [data-sl="gasto"]');
    await p.selectOption('#salidasBox [data-id="d1"] .sl-cat select', 'arriendo');
    await p.click('#salidasBox [data-id="d1"] [data-sl="gok"]'); await p.waitForTimeout(300);
    v = await p.evaluate(() => (data.contab || []).find(g => g.monto === 800000) || null);
    chk('6. 🗂️ Otro gasto → «Arriendo» de $800.000 por DaviPlata', v && v.cat === 'arriendo' && v.metodo === 'nequi' && /JUAN ARRENDADOR/.test(v.nota), v);

    // ===== 7. Factura escaneada =====
    await p.evaluate(t => { data.purchases = [{ id: 'f1', supplier: 'Distribuidora El Sol S.A.S.', date: new Date(t - 2 * 864e5).toISOString().slice(0, 10), at: t - 2 * 864e5, total: 90000, items: [] }]; saveData(); window.ventoSalidas.pintar(); }, ahora);
    F = await filas();
    const f7 = F.find(f => f.id === 'n2') || {};
    chk('7. Pago de la factura escaneada (mismo proveedor y valor): sugiere «Ya estaba anotada»', f7.sug && f7.sug.join() === 'ya' && /ya cuenta como compra/.test(f7.txt), f7);
    const antes = await p.evaluate(() => (data.contab || []).length);
    await p.click('#salidasBox [data-id="n2"] [data-sl="ya"]'); await p.waitForTimeout(300);
    v = await p.evaluate(() => ({ n: (data.contab || []).length, filas: document.querySelectorAll('#salidasBox .sl-fila').length }));
    chk('7. «Ya estaba anotada» → no se suma otro gasto', v.n === antes && v.filas === 0, v);

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
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
