// 🧾 ORDEVA 1.70.0 · Caja profesional (rediseño del módulo CAJA). Sin internet. Prueba TODAS las operaciones:
//  1. Computador: dos columnas (productos ~60 % · venta ~40 %), buscador, escáner, categorías, favoritos, total grande
//     y COBRAR siempre a la vista. Estado de la caja arriba: «Caja sin abrir» → «Caja abierta» → cerrar.
//  2. Agregar con un toque (tarjeta, favorito), buscar + Enter, lector de código de barras, categorías.
//  3. Cantidad escrita, quitar, descuento (subtotal y descuento a la vista).
//  4. Cobro: «¿Con cuánto paga?» a la vista, billetes, falta / exacto / vuelto en grande y al instante; efectivo,
//     transferencia, Nequi, DaviPlata, tarjeta y pago combinado. Confirmación del pago con el vuelto e imprimir.
//  5. Ventas pendientes (suspender / recuperar) y recuperación de la venta en curso al volver a abrir.
//  6. Atajos de teclado (F1 buscar, F2 cobrar, Esc cancelar).
//  7. Favoritos configurables (con permiso).
//  8. Permisos: anular una venta cobrada o sacar efectivo → al equipo se le pide la clave del dueño.
//  9. Restaurante: las cuentas abiertas se cobran desde la caja con el mismo cobro.
// 10. Cierre de caja desde la caja (arqueo) → vuelve a «Caja sin abrir».
// 11. Celular: una sola columna; el total y COBRAR siempre a la vista; la venta se puede plegar sin perder el total.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';

(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  const nuevo = async (w, h, tactil) => {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: !!tactil });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(w + ': ' + e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1100);
    return { ctx, p };
  };
  const preparar = p => p.evaluate(() => {
    document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
    data.categories = [{ id: 'b', name: 'Bebidas' }, { id: 'c', name: 'Comidas' }];
    data.products = [
      { id: 'a', name: 'Águila', price: 3500, categoryId: 'b', favorite: true, barcodes: ['7702004003508'] },
      { id: 'k', name: 'Póker', price: 3300, categoryId: 'b' },
      { id: 'e', name: 'Empanada', price: 2000, categoryId: 'c', favorite: true },
      { id: 'h', name: 'Hamburguesa', price: 15000, categoryId: 'c' },
      { id: 'g', name: 'Gaseosa', price: 2500, categoryId: 'b' }
    ];
    data.history = []; data.turno = null; saveData();
    window.__imp = []; window.printReceipt = rd => window.__imp.push(rd);   // 🖨️ la impresión se registra (sin ventana)
    window.ventoPOS.vaciar(); window.ventoPOS.abrirCaja();
  });
  const R = '#pzCajaOv .pz-caja-root';
  try{
    // ======================= COMPUTADOR =======================
    let { ctx, p } = await nuevo(1366, 800);
    await p.fill('#authBiz', 'Tienda Pro'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1400);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await preparar(p); await p.waitForTimeout(400);
    const lineas = () => p.evaluate(() => window.ventoPOS.carrito().map(x => x.id + '×' + x.qty).join(','));
    const caja = () => p.evaluate(R => {
      const r = document.querySelector(R), q = s => r.querySelector(s), rect = s => { const e = q(s); if(!e) return null; const x = e.getBoundingClientRect(); return { l: Math.round(x.left), r: Math.round(x.right), t: Math.round(x.top), b: Math.round(x.bottom), w: Math.round(x.width), h: Math.round(x.height) }; };
      return { prod: rect('.pz-prod'), cart: rect('.pz-cart'), cobrar: rect('.pz-cobrar'), q: rect('.pz-q'), scan: rect('.pz-scan'), cats: [...r.querySelectorAll('.pz-cats button')].map(x => x.textContent),
        favs: [...r.querySelectorAll('.pz-fav span')].map(x => x.textContent), estado: (q('.pz-estado') || {}).innerText || '', estadoCls: (q('.pz-estado') || {}).className || '',
        total: q('.pz-total b').textContent, totalPx: parseFloat(getComputedStyle(q('.pz-total b')).fontSize), subt: (q('.pz-subt') || {}).innerText || '', subtVis: !!q('.pz-subt') && !q('.pz-subt').hidden,
        grid: [...r.querySelectorAll('.pz-grid .pz-tile')].map(x => x.dataset.add || x.dataset.fav), vh: innerHeight };
    }, R);

    // ===== 1. Pantalla en dos columnas =====
    let v = await caja();
    const ancho = v.prod && v.cart ? v.prod.w / (v.prod.w + v.cart.w) : 0;
    chk('1. Dos columnas: productos a la izquierda (~60 %) y la venta a la derecha (~40 %)', v.cart.l > v.prod.r - 2 && ancho > 0.55 && ancho < 0.66, { ancho: ancho.toFixed(2), prod: v.prod, cart: v.cart });
    chk('1. Izquierda: buscador permanente, escáner (📷), categorías y favoritos', v.q && v.q.w > 300 && v.scan && v.cats.join('|') === 'Todos|⭐ Favoritos|Bebidas|Comidas' && v.favs.join('|') === 'Águila|Empanada', v);
    chk('1. Derecha: TOTAL grande (≥ 34 px) y COBRAR a la vista', v.totalPx >= 34 && v.cobrar.b <= v.vh && v.cobrar.t > 0 && v.cobrar.w > 300, v);
    chk('1. Estado de la caja arriba: «Caja sin abrir» con «💵 Abrir caja»', /Caja sin abrir/.test(v.estado) && /Abrir caja/.test(v.estado) && /cerrada/.test(v.estadoCls), v.estado);

    v = await p.evaluate(R => (document.querySelector(R + ' .pz-pasos') || {}).innerText || '', R);
    chk('1. Venta vacía: «Cobrar en 3 pasos» para el empleado nuevo (productos → COBRAR → vuelto)', /Cobrar en 3 pasos/.test(v) && /COBRAR/.test(v) && /vuelto/.test(v), v);

    // ===== Apertura =====
    await p.click(R + ' [data-turno="abrir"]'); await p.waitForSelector('#vtBase'); await p.fill('#vtBase', '50000'); await p.click('#vtAbrir'); await p.waitForTimeout(300);
    await p.click('.vt-ov [data-x]').catch(() => {}); await p.waitForTimeout(200);
    v = await caja();
    chk('1. Abrir caja con base $50.000 → «Caja abierta · base $50.000» y botones de efectivo y cierre', /Caja abierta/.test(v.estado) && /50\.000/.test(v.estado) && /Cerrar caja/.test(v.estado) && /abierta/.test(v.estadoCls), v.estado);

    // ===== 2. Agregar =====
    await p.click(R + ' .pz-grid [data-add="a"]');
    await p.click(R + ' .pz-favs [data-add="e"]');
    chk('2. Un toque en la tarjeta y un toque en el favorito → al carrito', (await lineas()) === 'a×1,e×1', await lineas());
    await p.fill(R + ' .pz-q', 'hambur'); await p.press(R + ' .pz-q', 'Enter'); await p.waitForTimeout(150);
    chk('2. Búsqueda rápida: «hambur» + Enter agrega la Hamburguesa', (await lineas()) === 'a×1,e×1,h×1', await lineas());
    await p.click(R + ' .pz-cats [data-cat="c"]'); await p.waitForTimeout(100);
    v = await caja();
    chk('2. Categoría «Comidas» → solo comidas en la cuadrícula', v.grid.join(',') === 'e,h' || v.grid.sort().join(',') === 'e,h', v.grid);
    await p.click(R + ' .pz-cats [data-cat=""]');
    await p.evaluate(() => document.activeElement && document.activeElement.blur());
    await p.keyboard.type('7702004003508', { delay: 5 }); await p.keyboard.press('Enter'); await p.waitForTimeout(250);
    chk('2. Lector de código de barras (teclado rápido + Enter) suma el producto aunque el cursor no esté en el buscador', (await lineas()) === 'a×2,e×1,h×1', await lineas());

    // ===== 3. Cantidad escrita, quitar, descuento =====
    await p.click(R + ' .pz-qn[data-qn="e"]'); await p.waitForSelector(R + ' .pz-qin');
    await p.fill(R + ' .pz-qin', '4'); await p.press(R + ' .pz-qin', 'Enter'); await p.waitForTimeout(150);
    chk('3. Tocar la cantidad y escribir 4 → Empanada ×4', (await lineas()) === 'a×2,e×4,h×1', await lineas());
    await p.click(R + ' .pz-qn[data-qn="e"]'); await p.fill(R + ' .pz-qin', '9'); await p.press(R + ' .pz-qin', 'Escape'); await p.waitForTimeout(150);
    chk('3. Esc deja la cantidad como estaba', (await lineas()) === 'a×2,e×4,h×1', await lineas());
    await p.click(R + ' [data-quitar="h"]'); await p.waitForTimeout(100);
    chk('3. ✕ quita el producto', (await lineas()) === 'a×2,e×4', await lineas());
    await p.click(R + ' [data-desc]'); await p.waitForSelector('.pz-mini-ov'); await p.click('.pz-mini-ov [data-t="%"]'); await p.fill('.pz-mini-ov .pz-dv', '10'); await p.click('.pz-mini-ov [data-ok]'); await p.waitForTimeout(250);
    v = await caja();
    chk('3. Descuento 10 % (dueño): subtotal $15.000, descuento −$1.500 y TOTAL $13.500 a la vista', v.subtVis && /15\.000/.test(v.subt) && /1\.500/.test(v.subt) && /13\.500/.test(v.total), v);

    // ===== 6. Atajos + 4. Cobro en efectivo =====
    await p.keyboard.press('F1'); await p.waitForTimeout(100);
    chk('6. F1 → el cursor en el buscador', await p.evaluate(() => document.activeElement && document.activeElement.classList.contains('pz-q')));
    await p.evaluate(() => document.activeElement.blur());
    await p.keyboard.press('F2'); await p.waitForSelector('.pz-pago-ov.show', { timeout: 3000 });
    const pago = () => p.evaluate(() => { const o = document.querySelector('.pz-pago-ov.show'); if(!o) return null; const vu = o.querySelector('.pz-vu'), i = o.querySelector('.pz-pagacon'), r = i.getBoundingClientRect(), b = vu.querySelector('b');
      return { txt: vu.textContent.replace(/\s+/g, ' ').trim(), cls: vu.className, px: b ? parseFloat(getComputedStyle(b).fontSize) : 0, inVis: r.top >= 0 && r.bottom <= innerHeight && r.width > 150, rec: (o.querySelector('.pz-vu-rec') || {}).textContent || '',
        mets: [...o.querySelectorAll('.pz-met')].map(x => x.dataset.m).join(',') }; });
    v = await pago();
    chk('6. F2 → abre el cobro', !!v);
    chk('4. «¿Con cuánto paga el cliente?» a la vista sin desplazar', v.inVis, v);
    chk('4. Medios: efectivo, Nequi, DaviPlata, transferencia y tarjeta', v.mets === 'efectivo,nequi,daviplata,transferencia,tarjeta', v.mets);
    await p.click('.pz-pago-ov [data-b="10000"]'); v = await pago();
    chk('4. Billete de $10.000 por $13.500 → «Faltan $3.500» en rojo', /Faltan \$\s?3\.500/.test(v.txt) && /falta/.test(v.cls), v);
    await p.click('.pz-pago-ov [data-b="10000"]'); v = await pago();
    chk('4. Otro de $10.000 (se suman: $20.000) → vuelto $6.500 al instante y en GRANDE (≥ 34 px)', /Cambio que debe devolver: \$\s?6\.500/.test(v.txt) && /vueltas/.test(v.cls) && v.px >= 34 && /20\.000/.test(v.rec) && /13\.500/.test(v.rec), v);
    await p.click('.pz-pago-ov [data-b="exacto"]'); v = await pago();
    chk('4. «Pago exacto» → indicador de PAGO EXACTO', /PAGO EXACTO/.test(v.txt) && /exacto/.test(v.cls), v);
    await p.fill('.pz-pago-ov .pz-pagacon', '20000'); await p.waitForTimeout(100);
    await p.click('.pz-pago-ov .pz-met[data-m="efectivo"]'); await p.waitForTimeout(400);
    v = await p.evaluate(() => { const h = data.history[0] || {}, r = document.querySelector('#pzCajaOv .pz-caja-root'), x = r.querySelector('.pz-hecho');
      return { n: data.history.length, total: h.total, pago: h.payments && h.payments[0], hecho: x && !x.hidden ? x.innerText : '', vuPx: x && x.querySelector('.pz-hecho-vu b') ? parseFloat(getComputedStyle(x.querySelector('.pz-hecho-vu b')).fontSize) : 0, cobrar: r.querySelector('.pz-cobrar').disabled }; });
    chk('4. Efectivo: UNA venta de $13.500 con recibido $20.000 y vuelto $6.500 (el motor de ventas de siempre)', v.n === 1 && v.total === 13500 && v.pago.method === 'efectivo' && v.pago.recibido === 20000 && v.pago.vueltas === 6500, v);
    chk('4. Confirmación del pago: «Pago confirmado», cómo pagó, lo recibido y el VUELTO en grande', /Pago confirmado/.test(v.hecho) && /Efectivo/.test(v.hecho) && /20\.000/.test(v.hecho) && /VUELTO/.test(v.hecho) && /6\.500/.test(v.hecho) && v.vuPx >= 28, v);
    await p.click(R + ' [data-imprimir]'); await p.waitForTimeout(150);
    v = await p.evaluate(() => window.__imp.map(x => x && (x.total || (x.totals && x.totals.total))));
    chk('4. 🖨️ «Imprimir comprobante» imprime el recibo de esa venta', v.length === 1, v);
    await p.click(R + ' [data-nueva]'); await p.waitForTimeout(100);
    chk('4. «Nueva venta» deja la caja lista (la confirmación se quita)', await p.evaluate(R => document.querySelector(R + ' .pz-hecho').hidden, R));

    // ===== 4. Los demás medios =====
    const cobrarCon = async (m, id) => {
      await p.evaluate(id => { window.ventoPOS.agregar(id); }, id); await p.waitForTimeout(80);
      await p.click(R + ' .pz-cobrar'); await p.waitForSelector('.pz-pago-ov.show');
      await p.click('.pz-pago-ov .pz-met[data-m="' + m + '"]'); await p.waitForTimeout(350);
      return p.evaluate(() => { const h = data.history[0]; return { total: h.total, met: h.payments[0].method, nota: h.payments[0].note, vu: h.payments[0].vueltas || 0 }; });
    };
    for(const [m, nota] of [['transferencia', 'Transferencia'], ['nequi', 'Nequi'], ['daviplata', 'DaviPlata'], ['tarjeta', 'Tarjeta']]){
      v = await cobrarCon(m, 'k');
      chk('4. ' + nota + ': venta de $3.300 registrada como transferencia «' + nota + '», sin vuelto', v.total === 3300 && v.met === 'transferencia' && new RegExp(nota).test(v.nota) && !v.vu, v);
    }
    v = await p.evaluate(() => document.querySelector('#pzCajaOv .pz-hecho').innerText);
    chk('4. La confirmación dice cómo pagó (💳 Tarjeta) y no inventa vuelto', /Tarjeta/.test(v) && !/VUELTO/.test(v), v);
    // Pago combinado: $5.000 en efectivo + el resto por Nequi
    await p.evaluate(() => { window.ventoPOS.agregar('h'); }); await p.click(R + ' .pz-cobrar'); await p.waitForSelector('.pz-pago-ov.show');
    await p.click('.pz-pago-ov .pz-mixto-btn'); await p.fill('.pz-pago-ov [data-mx="efectivo"]', '5000'); await p.fill('.pz-pago-ov [data-mx="nequi"]', '10000'); await p.waitForTimeout(100);
    await p.click('.pz-pago-ov .pz-mixto-ok'); await p.waitForTimeout(350);
    v = await p.evaluate(() => { const h = data.history[0]; return { total: h.total, pagos: h.payments.map(x => x.method + ':' + x.amount + ':' + x.note) }; });
    chk('4. Pago combinado $15.000: efectivo $5.000 + Nequi $10.000', v.total === 15000 && v.pagos.join('|') === 'efectivo:5000:Efectivo|transferencia:10000:Nequi', v);

    // ===== 5. Pendientes y recuperación =====
    await p.click(R + ' [data-nueva]').catch(() => {});
    await p.evaluate(() => { window.ventoPOS.agregar('a', 3); }); await p.waitForTimeout(80);
    await p.click(R + ' [data-susp]'); await p.waitForSelector('.pz-mini-ov .pz-sn'); await p.fill('.pz-mini-ov .pz-sn', 'Don Pedro'); await p.click('.pz-mini-ov [data-ok]'); await p.waitForTimeout(200);
    v = await p.evaluate(R => ({ L: window.ventoPOS.carrito().length, pend: (document.querySelector(R + ' [data-pend]') || {}).textContent || '' }), R);
    chk('5. ⏸️ Suspender: la caja queda libre y sale «📂 Pendientes (1)»', v.L === 0 && /Pendientes \(1\)/.test(v.pend), v);
    await p.click(R + ' [data-pend]'); await p.waitForSelector('.pz-mini-ov .pz-pf'); await p.click('.pz-mini-ov .pz-pf [data-rec]'); await p.waitForTimeout(200);
    chk('5. 📂 Recuperar la venta de «Don Pedro» → vuelve al carrito', (await lineas()) === 'a×3', await lineas());
    await p.reload(); await p.waitForTimeout(1500);
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); window.__imp = []; window.printReceipt = rd => window.__imp.push(rd); window.ventoPOS.abrirCaja(); }); await p.waitForTimeout(300);
    v = await p.evaluate(R => { const x = document.querySelector(R + ' .pz-recup'); return { vis: x && !x.hidden, txt: x ? x.textContent : '', L: window.ventoPOS.carrito().map(y => y.id + '×' + y.qty).join(',') }; }, R);
    chk('5. 🛟 Al volver a abrir ORDEVA, la venta en curso se recupera y lo dice', v.vis && /recuperó/.test(v.txt) && v.L === 'a×3', v);
    await p.click(R + ' [data-recupok]'); await p.waitForTimeout(100);
    chk('5. «Entendido» quita el aviso y la venta sigue', await p.evaluate(R => document.querySelector(R + ' .pz-recup').hidden && window.ventoPOS.carrito().length === 1, R));
    await p.keyboard.press('F2'); await p.waitForSelector('.pz-pago-ov.show'); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    chk('6. Esc cancela el cobro (no registra nada)', await p.evaluate(() => !document.querySelector('.pz-pago-ov.show') && window.ventoPOS.carrito().length === 1));
    await p.evaluate(() => window.ventoPOS.vaciar());

    // ===== 7. Favoritos configurables =====
    await p.click(R + ' [data-favedit="on"]'); await p.waitForTimeout(100);
    v = await p.evaluate(R => ({ aviso: !document.querySelector(R + ' .pz-favaviso').hidden, fed: document.querySelectorAll(R + ' .pz-grid [data-fav]').length }), R);
    chk('7. «✏️ Editar» (dueño): modo favoritos con aviso y las tarjetas para marcar', v.aviso && v.fed === 5, v);
    await p.click(R + ' .pz-grid [data-fav="k"]'); await p.click(R + ' .pz-grid [data-fav="e"]'); await p.click(R + ' .pz-favaviso [data-favedit="off"]'); await p.waitForTimeout(100);
    v = await caja();
    chk('7. Marcar Póker y quitar Empanada → favoritos: Águila y Póker (guardado en el producto)', v.favs.join('|') === 'Águila|Póker' && await p.evaluate(() => !!data.products.find(x => x.id === 'k').favorite && !data.products.find(x => x.id === 'e').favorite), v.favs);
    chk('7. Al salir del modo favoritos las tarjetas vuelven a vender con un toque', v.grid.every(x => x) && (await p.evaluate(R => document.querySelectorAll(R + ' .pz-grid [data-fav]').length, R)) === 0);

    // ===== 8. Permisos =====
    await p.evaluate(() => { window.__jefe = window.ventoRoles.esJefe; window.__puede = window.ventoRoles.puede; window.ventoRoles.esJefe = () => false; window.ventoRoles.puede = () => false; });
    await p.click(R + ' [data-favedit="on"]'); await p.waitForTimeout(100);
    chk('8. Empleado sin permiso de productos: no puede cambiar los favoritos', await p.evaluate(R => document.querySelector(R + ' .pz-favaviso').hidden && !document.querySelector(R + ' .pz-grid [data-fav]'), R));
    await p.evaluate(() => { window.ventoPOS.agregar('g'); }); await p.click(R + ' .pz-cobrar'); await p.waitForSelector('.pz-pago-ov.show'); await p.click('.pz-pago-ov .pz-met[data-m="efectivo"]'); await p.waitForTimeout(350);
    const n0 = await p.evaluate(() => data.history.length);
    await p.click(R + ' [data-anular]'); await p.waitForTimeout(300);
    chk('8. Empleado: «Anular» una venta cobrada sin la clave del dueño → NO se anula', (await p.evaluate(() => data.history.length)) === n0 && !(await p.evaluate(() => document.querySelector('#vfOv.show'))));
    await p.evaluate(async () => { window.ventoRoles.esJefe = window.__jefe; await window.ventoVentaFix.ponerClave('2468'); window.ventoRoles.esJefe = () => false; });
    await p.click(R + ' [data-anular]'); await p.waitForSelector('#vfOv.show #vfClave'); await p.fill('#vfClave', '1111'); await p.click('#vfSi'); await p.waitForTimeout(400);
    chk('8. Clave equivocada → tampoco', (await p.evaluate(() => data.history.length)) === n0);
    await p.fill('#vfClave', '2468'); await p.click('#vfSi'); await p.waitForTimeout(500);
    v = await p.evaluate(() => ({ n: data.history.length, L: window.ventoPOS.carrito().map(x => x.id + '×' + x.qty).join(','), aud: (data.auditoria || []).some(a => /anul/.test(a.accion + ' ' + a.detalle)) }));
    chk('8. Con la clave del dueño → la venta se anula, los productos vuelven al carrito y queda en la auditoría', v.n === n0 - 1 && v.L === 'g×1' && v.aud, v);
    await p.evaluate(() => window.ventoPOS.vaciar());
    // Sacar efectivo de la caja (empleado): pide la clave
    await p.click(R + ' [data-turno="mov"]'); await p.waitForSelector('.vt-ov [data-m="salida"]'); await p.click('.vt-ov [data-m="salida"]'); await p.waitForSelector('#vtMonto');
    await p.fill('#vtMonto', '10000'); await p.fill('#vtMotivo', 'Domicilio'); await p.click('#vtOk'); await p.waitForSelector('#vfOv.show #vfClave');
    await p.click('#vfNo'); await p.waitForTimeout(300);
    chk('8. Empleado: sacar $10.000 de la caja sin la clave → no queda ninguna salida', await p.evaluate(() => !(data.turno.movs || []).length));
    await p.click('#vtOk'); await p.waitForSelector('#vfOv.show #vfClave'); await p.fill('#vfClave', '2468'); await p.click('#vfSi'); await p.waitForTimeout(500);
    chk('8. Con la clave → la salida de $10.000 queda registrada', await p.evaluate(() => (data.turno.movs || []).length === 1 && data.turno.movs[0].monto === 10000 && data.turno.movs[0].tipo === 'salida'));
    await p.evaluate(() => { document.querySelectorAll('.vt-ov').forEach(o => o.remove()); window.ventoRoles.esJefe = window.__jefe; window.ventoRoles.puede = window.__puede; });

    // ===== 9. Restaurante: cuentas abiertas en la caja =====
    await p.evaluate(() => { data.tables[3] = { items: [{ productId: 'a', name: 'Águila', price: 3500, qty: 4, personId: null, history: [] }], payments: [], people: [] }; saveData(); renderMesas(); });
    await p.waitForTimeout(250);
    v = await p.evaluate(R => { const m = document.querySelector(R + ' .pz-mesas'); return { vis: m && !m.hidden, txt: m ? m.innerText : '' }; }, R);
    chk('9. Restaurante: «por cobrar» muestra la cuenta abierta con su saldo ($14.000)', v.vis && /14\.000/.test(v.txt), v);
    await p.click(R + ' .pz-mesa-c[data-mesa="3"]'); await p.waitForSelector('.pz-pago-ov.show'); await p.click('.pz-pago-ov .pz-met[data-m="nequi"]'); await p.waitForTimeout(500);
    v = await p.evaluate(R => ({ abierta: !!(data.tables[3] && (data.tables[3].items || []).length), h: data.history[0] && { total: data.history[0].total, table: data.history[0].table }, chips: (document.querySelector(R + ' .pz-mesas') || {}).hidden }), R);
    chk('9. «Cobrar» la cuenta desde la caja (Nequi) → se cierra con su venta de $14.000 y sale de «por cobrar»', !v.abierta && v.h.total === 14000 && String(v.h.table) === '3' && v.chips, v);

    // ===== 10. Cierre de caja desde la caja =====
    await p.click(R + ' [data-turno="cerrar"]'); await p.waitForSelector('#confirmOverlay.show', { timeout: 4000 }); await p.click('#confirmOkBtn');
    await p.waitForSelector('.vt-ov [data-sin]', { timeout: 5000 }); await p.click('.vt-ov [data-sin]'); await p.waitForTimeout(600);
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => { if(o.id !== 'pzCajaOv') o.classList.remove('show'); }); });
    v = await p.evaluate(R => ({ turno: !!data.turno, cierres: (data.closures || []).length, estado: document.querySelector(R + ' .pz-estado').innerText }), R);
    chk('10. «🔒 Cerrar caja» hace el cierre del día (con el arqueo) y la caja vuelve a «Caja sin abrir»', !v.turno && v.cierres >= 1 && /Caja sin abrir/.test(v.estado), v);
    await ctx.close();

    // ======================= CELULAR =======================
    ({ ctx, p } = await nuevo(390, 844, true));
    await p.fill('#authBiz', 'Tienda Cel'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1400);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await preparar(p); await p.waitForTimeout(300);
    for(const id of ['a', 'e', 'h', 'k']) await p.tap(R + ' .pz-grid [data-add="' + id + '"]');
    await p.waitForTimeout(200);
    v = await p.evaluate(R => { const r = document.querySelector(R), g = s => { const e = r.querySelector(s); const x = e.getBoundingClientRect(); return { l: Math.round(x.left), r: Math.round(x.right), t: Math.round(x.top), b: Math.round(x.bottom), w: Math.round(x.width) }; };
      return { prod: g('.pz-prod'), cart: g('.pz-cart'), cobrar: g('.pz-cobrar'), total: g('.pz-total'), lineas: r.querySelectorAll('.pz-linea').length, vw: innerWidth, vh: innerHeight, sx: document.documentElement.scrollWidth }; }, R);
    chk('11. Celular: una sola columna (la venta a lo ancho, no al lado)', v.cart.w >= v.vw - 40 && v.prod.w >= v.vw - 40, v);
    chk('11. Celular: el TOTAL y COBRAR a la vista sin desplazar, y sin barra horizontal', v.cobrar.b <= v.vh && v.cobrar.t >= 0 && v.total.b <= v.vh && v.sx <= v.vw + 1, v);
    chk('11. Celular: se ven los 4 productos de la venta', v.lineas === 4, v.lineas);
    await p.tap(R + ' [data-plegar]'); await p.waitForTimeout(100);
    v = await p.evaluate(R => { const r = document.querySelector(R), L = r.querySelector('.pz-lineas'), c = r.querySelector('.pz-cobrar').getBoundingClientRect(); return { lineasOcultas: getComputedStyle(L).display === 'none', total: r.querySelector('.pz-total b').textContent, n: r.querySelector('.pz-n').textContent, cobrarVis: c.bottom <= innerHeight && c.height > 40 }; }, R);
    chk('11. Plegar la venta: quedan a la vista cuántos productos, el TOTAL ($23.800) y COBRAR', v.lineasOcultas && /23\.800/.test(v.total) && /4 productos/.test(v.n) && v.cobrarVis, v);
    await p.tap(R + ' [data-plegar]');
    await p.tap(R + ' .pz-cobrar'); await p.waitForSelector('.pz-pago-ov.show');
    v = await p.evaluate(() => { const o = document.querySelector('.pz-pago-ov.show'), i = o.querySelector('.pz-pagacon').getBoundingClientRect(); return { inVis: i.top >= 0 && i.bottom <= innerHeight }; });
    chk('11. Celular: al cobrar, «¿Con cuánto paga?» se ve sin desplazar', v.inVis, v);
    await p.tap('.pz-pago-ov [data-b="50000"]'); await p.waitForTimeout(100);
    v = await p.evaluate(() => { const vu = document.querySelector('.pz-pago-ov .pz-vu'), r = vu.getBoundingClientRect(), b = vu.querySelector('b'); return { txt: vu.textContent, px: parseFloat(getComputedStyle(b).fontSize), vis: r.top >= 0 && r.bottom <= innerHeight }; });
    chk('11. Celular: billete de $50.000 → vuelto $26.200 grande y a la vista', /26\.200/.test(v.txt) && v.px >= 34 && v.vis, v);
    await p.tap('.pz-pago-ov .pz-met[data-m="efectivo"]'); await p.waitForTimeout(400);
    v = await p.evaluate(R => { const x = document.querySelector(R + ' .pz-hecho'); const r = x.getBoundingClientRect(); return { txt: x.innerText, vis: !x.hidden && r.top < innerHeight, n: data.history.length }; }, R);
    chk('11. Celular: venta registrada y la confirmación con el vuelto $26.200 a la vista', v.n === 1 && /26\.200/.test(v.txt) && v.vis, v);
    await ctx.close();

    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ Excepción: ' + (e && e.stack || e)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
