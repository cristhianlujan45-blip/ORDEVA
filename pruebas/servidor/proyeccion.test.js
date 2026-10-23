// Pruebas del SERVIDOR: proyección relacional del documento del negocio (migración 20261031000000_proyeccion, Fase A)
// contra PostgreSQL REAL y la Edge Function vento-pagos (/sync del repaso).
//  • Las tablas reflejan EXACTAMENTE el documento: categorías, productos, costos, ventas con ítems y pagos (precios
//    históricos), movimientos de inventario y cierres de caja.
//  • Idempotente: proyectar dos veces el mismo documento no duplica ni cambia nada.
//  • No borra: lo que sale del documento queda con eliminada_en; los movimientos recortados se quedan.
//  • RLS por rol: el mesero ve el catálogo pero no ventas, pagos ni costos; el cajero no ve costos; otro negocio nada.
//  • Un negocio con error no frena a los demás, y el guardado de la app sigue igual.
// Corre solo:   node pruebas/servidor/proyeccion.test.js
'use strict';
const fs = require('fs'), path = require('path');
const { iniciar } = require('./supabase-local');
let ok = 0, mal = 0;
const chk = (n, c, x) => { if (c) { ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
if (!process.env.VENTO_LOGS) for (const k of ['log', 'warn', 'error']) { const o = console[k].bind(console); console[k] = (...a) => { if (typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; o(...a); }; }

function documento() {
  return {
    businessName: 'Bar Proyección',
    categories: [{ id: 'c-cer', name: 'Cervezas' }, { id: 'c-com', name: 'Comidas' }],
    products: [
      { id: 'p1', name: 'Águila', size: '330 ml', price: 5000, cost: 2800, stock: 48, minStock: 12, categoryId: 'c-cer', barcodes: ['7702004001', ' 7702004001 ', ''], favorite: true },
      { id: 'p2', name: 'Picada', price: 32000, cost: 15000, categoryId: 'c-com' },
      { id: 'p3', name: 'Queso', price: 21000.5, cost: '9000', stock: 2.75, categoryId: 'c-borrada' },
      { id: 'combo-1', name: 'Combo cerveza + picada', price: 35000, categoryId: null, combo: [{ id: 'p1', qty: 2 }, { id: 'p2', qty: 1 }] },
    ],
    history: [
      { id: '1761200000000-qs', table: null, tableName: 'Mostrador', total: 52502, debt: 0, by: 'Caja 1', date: '2026-10-23T03:20:00.000Z',
        items: [{ name: 'Queso', qty: 2.5, price: 21000.5, cost: 9000, unidad: 'kg' }],
        payments: [{ note: 'Venta de mostrador', amount: 30000, method: 'efectivo' }, { note: '', amount: 22502, method: 'nequi', receiptId: 'r-9' }] },
      { id: '1761190000000-4', table: '4', tableName: 'Terraza', invoiceNo: 'FV-0007', total: 42000, debt: 10000, date: '2026-10-23T01:00:00.000Z',
        items: [{ name: 'Águila', qty: 2, price: 5000, cost: 2800, person: 'Ana' }, { name: 'Picada', qty: 1, price: 32000, cost: 15000 }],
        payments: [{ note: 'Ana', amount: 32000, method: 'transferencia' }, { note: 'Saldo sin registrar al cerrar', amount: 10000, method: 'debe' }],
        dian: { cufe: 'abc' } },
      { id: '1761180000000-dom', table: null, tableName: '🛵 Domicilio: Luis', total: 37000, debt: 0, date: 'fecha mala',
        delivery: { cliente: 'Luis', telefono: '300', direccion: 'Calle 1', envio: 2000 },
        items: [{ name: 'Combo cerveza + picada', qty: 1, price: 35000, cost: null }, { name: '🛵 Domicilio', qty: 1, price: 2000, cost: null }],
        payments: [{ note: 'Domicilio', amount: 37000, method: 'efectivo' }] },
      { total: 1000, date: '2026-10-22T10:00:00Z', items: [{ name: 'Tinto', qty: 1, price: 1000 }], payments: [{ amount: 1000, method: 'efectivo' }] },
      'esto no es una venta',
    ],
    inventarioMov: [
      { id: 'm1', tipo: 'entrada', productId: 'p1', name: 'Águila', qty: 24, costo: 2800, unidad: 'und', usuario: 'Dueño', at: 1761100000000 },
      { id: 'm2', tipo: 'conteo', productId: 'p-que-ya-no-existe', name: 'Ron', qty: 3, at: 1761110000000 },
    ],
    closures: [{ id: '1761000000000', date: '2026-10-21T05:00:00.000Z', from: '2026-10-20T17:00:00.000Z', ticketCount: 31, totalSold: 812000,
      totalEfectivo: 500000, totalTransferencia: 312000, totalDebe: 0, hourly: { 22: 300000 }, caja: { base: 100000 } }],
    tables: { 1: { items: [{ name: 'Águila', qty: 1, price: 5000 }] } },
  };
}

async function pruebas(sb) {
  const cab = (tok, extra) => ({ apikey: sb.anonKey, 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}), ...(extra || {}) });
  const rpc = async (fn, args, tok) => { const r = await fetch(sb.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: cab(tok), body: JSON.stringify(args || {}) }); return { st: r.status, j: await r.json().catch(() => null) }; };
  const tabla = async (q, tok) => { const r = await fetch(sb.url + '/rest/v1/' + q, { headers: cab(tok) }); return { st: r.status, j: await r.json().catch(() => null) }; };
  const repaso = async () => { const r = await fetch(sb.url + '/functions/v1/vento-pagos/sync', { method: 'POST', headers: cab(null, { 'x-vento-cron': sb.cron }), body: '{}' }); return { st: r.status, j: await r.json().catch(() => null) }; };
  const uno = async (q, p) => (await sb.sql(q, p))[0];
  const filas = (q, p) => sb.sql(q, p);

  const dueno = await sb.usuario('dueno@proy.co');
  const NEG = (await rpc('crear_negocio', { p_nombre: 'Bar Proyección', p_datos: {} }, dueno.token)).j;
  const unir = async (email, rol) => {
    const u = await sb.usuario(email);
    const cod = (await rpc('crear_invitacion', { p_negocio: NEG, p_rol: rol }, dueno.token)).j;
    await rpc('unirse_con_codigo', { p_codigo: cod, p_nombre: rol }, u.token);
    return u;
  };
  const admin = await unir('admin@proy.co', 'admin');
  const cajero = await unir('caja@proy.co', 'cajero');
  const mesero = await unir('mesero@proy.co', 'mesero');
  const empleado = await unir('empleado@proy.co', 'empleado');
  const otro = await sb.usuario('otro@bar2.co');
  const NEG2 = (await rpc('crear_negocio', { p_nombre: 'Otro Bar', p_datos: {} }, otro.token)).j;

  // ---------- El guardado de la app no cambia ----------
  let doc = documento();
  let r = await rpc('guardar_datos', { p_negocio: NEG, p_datos: doc, p_version: 1 }, dueno.token);
  chk('guardar_datos sigue igual (sube la versión a 2)', r.st === 200 && r.j === 2, r);
  let ver = 2;
  r = await rpc('guardar_datos', { p_negocio: NEG2, p_datos: { products: [{ id: 'p1', name: 'Club Colombia', price: 6000, cost: 3000 }], history: [{ id: 'v-otro', total: 6000, date: '2026-10-23T00:00:00Z', items: [{ name: 'Club Colombia', qty: 1, price: 6000 }], payments: [{ amount: 6000, method: 'efectivo' }] }] }, p_version: 1 }, otro.token);
  chk('El otro negocio guarda su documento', r.st === 200 && r.j === 2, r);
  chk('Antes del repaso no hay nada proyectado (el guardado no hace trabajo extra)', Number((await uno('select count(*) n from ventas')).n) === 0);

  // ---------- Primer repaso ----------
  r = await repaso();
  chk('El repaso (/sync con x-vento-cron) proyecta los 2 negocios', r.st === 200 && r.j.proyeccion && r.j.proyeccion.proyectados === 2 && r.j.proyeccion.fallidos === 0 && r.j.proyeccion.pendientes === 0, r.j);

  const est = await uno('select * from proyeccion_estado where negocio_id = $1', [NEG]);
  chk('proyeccion_estado: versión 2, sin error, con conteos', est && Number(est.version_proyectada) === 2 && !est.error && est.filas.ventas === 4 && est.filas.productos === 4, est);

  const cats = await filas('select id, nombre, eliminado_en from producto_categorias where negocio_id = $1 order by id', [NEG]);
  chk('Categorías: las 2 del documento', cats.length === 2 && cats[0].nombre === 'Cervezas' && cats[1].nombre === 'Comidas', cats);

  const prods = await filas('select * from productos where negocio_id = $1 order by id', [NEG]);
  const p1 = prods.find((p) => p.id === 'p1'), p3 = prods.find((p) => p.id === 'p3'), combo = prods.find((p) => p.id === 'combo-1');
  chk('Productos: los 4, con precio, tamaño, stock y mínimo', prods.length === 4 && p1.precio === 5000 && p1.tamano === '330 ml' && p1.stock === 48 && p1.stock_minimo === 12 && p1.categoria_id === 'c-cer', p1);
  chk('Códigos de barras limpios y sin repetir', JSON.stringify(p1.codigos) === '["7702004001"]', p1.codigos);
  chk('Decimales: precio 21000.50 y stock 2.750', p3.precio === 21000.5 && p3.stock === 2.75, p3);
  chk('Categoría que ya no existe → sin categoría (la clave foránea no se rompe)', p3.categoria_id === null, p3);
  chk('El combo queda marcado como combo', combo.es_combo === true && p1.es_combo === false, combo);
  chk('«extra» guarda lo demás (favorito, combo) pero NUNCA el costo', p1.extra.favorite === true && !('cost' in p1.extra) && Array.isArray(combo.extra.combo) && !prods.some((p) => JSON.stringify(p.extra).includes('cost')), p1.extra);
  const costos = await filas('select producto_id, costo from producto_costos where negocio_id = $1 order by producto_id', [NEG]);
  chk('Costos aparte: 2800, 15000, 9000 (texto convertido) y el combo sin costo', JSON.stringify(costos.map((c) => [c.producto_id, c.costo])) === JSON.stringify([['combo-1', null], ['p1', 2800], ['p2', 15000], ['p3', 9000]]), costos);

  const ventas = await filas('select * from ventas where negocio_id = $1 order by fecha desc', [NEG]);
  const vMos = ventas.find((v) => v.id === '1761200000000-qs'), vMesa = ventas.find((v) => v.id === '1761190000000-4'), vDom = ventas.find((v) => v.id === '1761180000000-dom');
  const vSin = ventas.find((v) => v.id.startsWith('sin-id-'));
  chk('Ventas: las 4 válidas (lo que no es una venta se ignora)', ventas.length === 4 && vMos && vMesa && vDom && vSin, ventas.map((v) => v.id));
  chk('Venta de mesa: mesa 4 «Terraza», factura FV-0007, total 42000 y deuda 10000', vMesa.lugar === 'mesa' && vMesa.mesa === '4' && vMesa.mesa_nombre === 'Terraza' && vMesa.factura === 'FV-0007' && vMesa.total === 42000 && vMesa.deuda === 10000, vMesa);
  chk('Fecha en UTC igual a la del documento', new Date(vMesa.fecha).toISOString() === '2026-10-23T01:00:00.000Z', vMesa.fecha);
  chk('Mostrador y domicilio bien clasificados; quién cobró', vMos.lugar === 'mostrador' && vMos.cobro_por === 'Caja 1' && vDom.lugar === 'domicilio' && vDom.extra.delivery.cliente === 'Luis', [vMos, vDom]);
  chk('Fecha mala → se toma la del ID (Date.now() de la app)', new Date(vDom.fecha).getTime() === 1761180000000, vDom.fecha);
  chk('Lo de la DIAN queda en «extra»', vMesa.extra.dian && vMesa.extra.dian.cufe === 'abc', vMesa.extra);
  chk('Venta sin ID: queda con un ID estable', vSin.total === 1000, vSin);

  const items = await filas('select venta_id, linea, producto_nombre, cantidad, precio, subtotal, unidad, persona from venta_items where negocio_id = $1 order by venta_id, linea', [NEG]);
  const iMesa = items.filter((i) => i.venta_id === vMesa.id);
  chk('Ítems de la mesa: 2 líneas con precio HISTÓRICO, cantidad, subtotal y persona', iMesa.length === 2 && iMesa[0].producto_nombre === 'Águila' && iMesa[0].cantidad === 2 && iMesa[0].precio === 5000 && iMesa[0].subtotal === 10000 && iMesa[0].persona === 'Ana' && iMesa[1].subtotal === 32000, iMesa);
  const iMos = items.find((i) => i.venta_id === vMos.id);
  chk('Venta por peso: 2.5 kg × 21000.50 = 52501.25', iMos.cantidad === 2.5 && iMos.unidad === 'kg' && iMos.subtotal === 52501.25, iMos);
  chk('Total de ítems = 6', items.length === 6, items.length);
  const vcost = await filas('select venta_id, linea, costo from venta_costos where negocio_id = $1 order by venta_id, linea', [NEG]);
  chk('Costos históricos de cada línea, aparte (las líneas sin costo no se inventan)', vcost.length === 3 && vcost.find((c) => c.venta_id === vMesa.id && c.linea === 2).costo === 15000, vcost);
  const pagos = await filas('select venta_id, linea, metodo, monto, nota, comprobante_id from venta_pagos where negocio_id = $1 order by venta_id, linea', [NEG]);
  const pMos = pagos.filter((p) => p.venta_id === vMos.id);
  chk('Pago mixto: efectivo 30000 + Nequi 22502 con su comprobante', pMos.length === 2 && pMos[0].metodo === 'efectivo' && pMos[0].monto === 30000 && pMos[1].metodo === 'nequi' && pMos[1].comprobante_id === 'r-9', pMos);
  chk('Lo fiado queda como pago «debe»', pagos.some((p) => p.venta_id === vMesa.id && p.metodo === 'debe' && p.monto === 10000), pagos);
  const cuadre = await uno("select sum(total) t, (select sum(monto) from venta_pagos where negocio_id = $1) p from ventas where negocio_id = $1", [NEG]);
  chk('Cuadre: suma de ventas = suma de pagos (132502)', cuadre.t === 132502 && cuadre.p === 132502, cuadre);

  const movs = await filas('select * from inventario_movimientos where negocio_id = $1 order by id', [NEG]);
  chk('Movimientos de inventario: los 2, con fecha desde milisegundos', movs.length === 2 && movs[0].producto_id === 'p1' && movs[0].cantidad === 24 && new Date(movs[0].fecha).getTime() === 1761100000000 && movs[0].usuario === 'Dueño', movs[0]);
  chk('Movimiento de un producto que ya no existe: sin clave rota (nombre guardado) y sin costo en «extra»', movs[1].producto_id === null && movs[1].producto_nombre === 'Ron' && !('costo' in movs[0].extra), movs);
  const cierre = await uno('select * from caja_cierres where negocio_id = $1', [NEG]);
  chk('Cierre de caja con totales y lo demás en «extra»', cierre && cierre.tickets === 31 && cierre.total_vendido === 812000 && cierre.total_transferencia === 312000 && cierre.extra.caja.base === 100000, cierre);

  // ---------- Idempotencia ----------
  const huellaDe = async () => JSON.stringify(await filas(`select (select json_agg(t order by id) from (select id, huella, actualizado_en, eliminada_en from ventas where negocio_id = $1) t) v,
    (select json_agg(t order by venta_id, linea) from venta_items t where negocio_id = $1) i, (select json_agg(t order by venta_id, linea) from venta_pagos t where negocio_id = $1) p,
    (select json_agg(t order by id) from (select id, actualizado_en from productos where negocio_id = $1) t) pr, (select count(*) from inventario_movimientos where negocio_id = $1) m`, [NEG]));
  const antes = await huellaDe();
  const otra = await uno('select proyectar_negocio($1) r', [NEG]);
  chk('Proyectar otra vez el mismo documento: 0 cambios', otra.r.ventas === 0 && otra.r.productos === 0 && otra.r.categorias === 0 && otra.r.movimientos === 0 && otra.r.cierres === 0 && otra.r.ventas_eliminadas === 0, otra.r);
  chk('… y las tablas quedan idénticas (ni duplicados ni fechas tocadas)', (await huellaDe()) === antes);
  r = await repaso();
  chk('Repaso sin versiones nuevas: no proyecta nada', r.j.proyeccion && r.j.proyeccion.proyectados === 0, r.j);

  // ---------- Cambios: corrección, venta deshecha, producto borrado, inventario recortado, venta nueva ----------
  doc = documento();
  doc.history[1].items[0].qty = 3; doc.history[1].total = 47000; doc.history[1].payments[0].amount = 37000;   // corrigen la mesa 4
  const deshecha = doc.history.splice(2, 1)[0];                                                                 // deshacen el domicilio
  doc.history.unshift({ id: '1761210000000-qs', table: null, total: 5000, debt: 0, date: '2026-10-23T04:00:00Z', items: [{ name: 'Águila', qty: 1, price: 5000, cost: 2800 }], payments: [{ amount: 5000, method: 'efectivo' }] });
  doc.products = doc.products.filter((p) => p.id !== 'p2');                                                     // borran la picada
  doc.products[0].price = 5500;                                                                                 // sube el precio
  doc.inventarioMov = [doc.inventarioMov[1], { id: 'm3', tipo: 'venta', productId: 'p1', qty: -1, at: 1761210000000 }];   // la app recortó m1
  r = await rpc('guardar_datos', { p_negocio: NEG, p_datos: doc, p_version: ver }, dueno.token); ver = r.j;   // el dueño (desde la 1.55.0 el cajero sin permiso «productos» no cambia precios ni borra productos)
  r = await repaso();
  chk('El repaso proyecta solo el negocio que cambió', r.j.proyeccion && r.j.proyeccion.proyectados === 1, r.j);
  const est2 = await uno('select filas from proyeccion_estado where negocio_id = $1', [NEG]);
  chk('Solo se reescribe lo que cambió: 2 ventas (corregida y nueva), 1 eliminada, 1 producto, 1 movimiento', est2.filas.ventas === 2 && est2.filas.ventas_eliminadas === 1 && est2.filas.productos === 1 && est2.filas.movimientos === 1, est2.filas);
  const vMesa2 = await uno('select total from ventas where negocio_id = $1 and id = $2', [NEG, vMesa.id]);
  const iMesa2 = await filas('select cantidad, subtotal from venta_items where negocio_id = $1 and venta_id = $2 order by linea', [NEG, vMesa.id]);
  chk('La corrección se refleja: 3 Águilas, total 47000', vMesa2.total === 47000 && iMesa2.length === 2 && iMesa2[0].cantidad === 3 && iMesa2[0].subtotal === 15000, [vMesa2, iMesa2]);
  const vDom2 = await uno('select eliminada_en from ventas where negocio_id = $1 and id = $2', [NEG, vDom.id]);
  const iDom2 = await filas('select 1 from venta_items where negocio_id = $1 and venta_id = $2', [NEG, vDom.id]);
  chk('La venta deshecha NO se borra: queda con eliminada_en y sus ítems', vDom2 && vDom2.eliminada_en && iDom2.length === 2, vDom2);
  const pic = await uno("select eliminado_en from productos where negocio_id = $1 and id = 'p2'", [NEG]);
  chk('El producto borrado queda con eliminado_en (las ventas viejas lo siguen nombrando)', pic && pic.eliminado_en, pic);
  const p1b = await uno("select precio from productos where negocio_id = $1 and id = 'p1'", [NEG]);
  const iViejo = await uno('select precio from venta_items where negocio_id = $1 and venta_id = $2 and linea = 1', [NEG, vMesa.id]);
  chk('Precio nuevo en el catálogo (5500) y la venta conserva su precio histórico (5000)', p1b.precio === 5500 && iViejo.precio === 5000, [p1b, iViejo]);
  const movs2 = await filas('select id from inventario_movimientos where negocio_id = $1 order by id', [NEG]);
  chk('Inventario: el movimiento que la app recortó se queda (m1, m2, m3)', JSON.stringify(movs2.map((m) => m.id)) === '["m1","m2","m3"]', movs2);
  doc.history.push(deshecha);
  r = await rpc('guardar_datos', { p_negocio: NEG, p_datos: doc, p_version: ver }, dueno.token); ver = r.j;
  await repaso();
  const vDom3 = await uno('select eliminada_en from ventas where negocio_id = $1 and id = $2', [NEG, vDom.id]);
  chk('Si la venta vuelve al documento (otro equipo la tenía), vuelve a estar activa', vDom3 && vDom3.eliminada_en === null, vDom3);

  // ---------- RLS por rol ----------
  const n = async (q, tok) => { const x = await tabla(q, tok); return x.st === 200 && Array.isArray(x.j) ? x.j.length : -x.st; };
  const qNEG = (t) => t + '?negocio_id=eq.' + NEG;
  chk('Dueño: ve ventas, ítems, pagos, costos y el estado', (await n(qNEG('ventas'), dueno.token)) === 5 && (await n(qNEG('venta_items'), dueno.token)) > 0 && (await n(qNEG('venta_pagos'), dueno.token)) > 0 && (await n(qNEG('producto_costos'), dueno.token)) === 4 && (await n(qNEG('venta_costos'), dueno.token)) > 0 && (await n(qNEG('proyeccion_estado'), dueno.token)) === 1);
  chk('Administrador: igual que el dueño', (await n(qNEG('ventas'), admin.token)) === 5 && (await n(qNEG('producto_costos'), admin.token)) === 4);
  chk('Cajero: ve ventas, pagos, inventario y cierres', (await n(qNEG('ventas'), cajero.token)) === 5 && (await n(qNEG('venta_pagos'), cajero.token)) > 0 && (await n(qNEG('inventario_movimientos'), cajero.token)) === 3 && (await n(qNEG('caja_cierres'), cajero.token)) === 1);
  chk('Cajero: NO ve costos ni márgenes', (await n(qNEG('producto_costos'), cajero.token)) === 0 && (await n(qNEG('venta_costos'), cajero.token)) === 0 && (await n(qNEG('proyeccion_estado'), cajero.token)) === 0);
  chk('Mesero: ve el catálogo (productos y categorías)', (await n(qNEG('productos'), mesero.token)) === 4 && (await n(qNEG('producto_categorias'), mesero.token)) === 2);
  chk('Mesero: NO ve ventas, ítems, pagos, costos, inventario ni cierres', [await n(qNEG('ventas'), mesero.token), await n(qNEG('venta_items'), mesero.token), await n(qNEG('venta_pagos'), mesero.token), await n(qNEG('producto_costos'), mesero.token), await n(qNEG('venta_costos'), mesero.token), await n(qNEG('inventario_movimientos'), mesero.token), await n(qNEG('caja_cierres'), mesero.token)].every((x) => x === 0));
  chk('Empleado: tampoco ve ventas ni costos', (await n(qNEG('ventas'), empleado.token)) === 0 && (await n(qNEG('producto_costos'), empleado.token)) === 0);
  chk('Dueño de OTRO negocio: no ve nada de este', [await n(qNEG('productos'), otro.token), await n(qNEG('ventas'), otro.token), await n(qNEG('venta_pagos'), otro.token)].every((x) => x === 0));
  chk('Cada negocio ve lo suyo: el otro dueño ve su venta', (await n('ventas?negocio_id=eq.' + NEG2, otro.token)) === 1 && (await n('ventas', otro.token)) === 1);
  const anon = await tabla('ventas', null);
  chk('Sin sesión (clave pública): no se lee nada', anon.st >= 400 || (Array.isArray(anon.j) && anon.j.length === 0), anon);
  const esc = await fetch(sb.url + '/rest/v1/ventas', { method: 'POST', headers: cab(dueno.token), body: JSON.stringify({ negocio_id: NEG, id: 'falsa', fecha: new Date().toISOString(), lugar: 'mesa', total: 1, huella: 'x' }) });
  chk('Ni el dueño escribe directo en las tablas (solo la proyección)', esc.status >= 400 && Number((await uno("select count(*) n from ventas where id = 'falsa'")).n) === 0, esc.status);
  r = await rpc('proyectar_negocio', { p_negocio: NEG }, dueno.token);
  const r2 = await rpc('proyectar_pendientes', {}, dueno.token);
  chk('Un cliente NO puede llamar la proyección (solo el servidor)', r.st >= 400 && r2.st >= 400, [r, r2]);
  const sinCron = await fetch(sb.url + '/functions/v1/vento-pagos/sync', { method: 'POST', headers: cab(null, { 'x-vento-cron': 'adivinando' }), body: '{}' });
  const sjson = await sinCron.json().catch(() => ({}));
  chk('El repaso con una clave inventada no proyecta', !sjson.proyeccion, sjson);

  // ---------- Errores y tope de tiempo ----------
  const malo = await sb.usuario('malo@bar3.co');
  const NEG3 = (await rpc('crear_negocio', { p_nombre: 'Bar Raro', p_datos: {} }, malo.token)).j;
  await rpc('guardar_datos', { p_negocio: NEG3, p_datos: { products: 'no es lista', history: [{ id: 'x', total: 'mucho', items: 'tampoco', payments: [null, 5, { amount: 'abc' }] }], categories: null, closures: [{}] }, p_version: 1 }, malo.token);
  await sb.sql("alter table ventas add constraint prueba_falla check (id <> 'x')");
  r = await rpc('guardar_datos', { p_negocio: NEG, p_datos: Object.assign(doc, { businessName: 'otra vez' }), p_version: ver }, dueno.token); ver = r.j;
  r = await repaso();
  const e3 = await uno('select error, intentos from proyeccion_estado where negocio_id = $1', [NEG3]);
  chk('Un negocio con error no frena a los demás (1 bien, 1 con error anotado)', r.j.proyeccion && r.j.proyeccion.proyectados === 1 && r.j.proyeccion.fallidos === 1 && e3 && /prueba_falla/.test(e3.error) && e3.intentos === 1, [r.j, e3]);
  r = await repaso();
  chk('El negocio con error no se reintenta enseguida (espera cada vez más)', r.j.proyeccion.proyectados === 0 && r.j.proyeccion.fallidos === 0 && r.j.proyeccion.pendientes === 1, r.j);
  await sb.sql('alter table ventas drop constraint prueba_falla');
  await sb.sql("update proyeccion_estado set intentado_en = now() - interval '1 hour' where negocio_id = $1", [NEG3]);
  r = await repaso();
  const v3 = await uno('select total, (select count(*) from venta_pagos where negocio_id = $1) pagos from ventas where negocio_id = $1', [NEG3]);
  const e3b = await uno('select error from proyeccion_estado where negocio_id = $1', [NEG3]);
  chk('Datos raros no rompen nada: total ilegible → 0 y solo el pago que es objeto', r.j.proyeccion.proyectados === 1 && v3 && v3.total === 0 && Number(v3.pagos) === 1 && e3b.error === null, [r.j, v3, e3b]);

  for (const N of [NEG, NEG2]) await sb.sql('update datos_negocio set version = version + 1 where negocio_id = $1', [N]);
  const tope = await uno('select proyectar_pendientes(20, 0) r');
  chk('Con el tope de tiempo agotado igual avanza (1 negocio) y deja el resto para el próximo repaso', tope.r.proyectados === 1 && tope.r.pendientes === 1, tope.r);

  await sb.sql('update datos_negocio set version = version + 1 where negocio_id = $1', [NEG]);
  const lleno = await uno('select proyectar_pendientes(20, 4, 1) r');
  chk('Seguro de espacio: con la base por encima del tope no proyecta nada y lo dice', lleno.r.pausado === 'espacio' && lleno.r.proyectados === 0 && lleno.r.base_mb > 1, lleno.r);
  await uno('select proyectar_pendientes(20, 4) r');

  // ---------- Rendimiento: negocio grande ----------
  const grande = documento();
  grande.history = [];
  for (let i = 0; i < 8000; i++) grande.history.push({ id: 'g' + i, table: String(i % 20), total: 15000, debt: 0, date: new Date(1760000000000 - i * 60000).toISOString(), by: 'Caja',
    items: [{ name: 'Águila', qty: 1, price: 5000, cost: 2800 }, { name: 'Picada', qty: 1, price: 10000, cost: 5000 }], payments: [{ amount: 15000, method: i % 3 ? 'efectivo' : 'nequi', note: '' }] });
  await sb.sql('update datos_negocio set datos = $2, version = version + 1 where negocio_id = $1', [NEG2, grande]);
  const tanda = await uno('select proyectar_negocio($1, 3000) r', [NEG2]);
  const estT = await uno('select version_proyectada v, (select version from datos_negocio where negocio_id = $1) actual from proyeccion_estado where negocio_id = $1', [NEG2]);
  chk('Negocio grande por tandas: 3000 ventas y quedan 5000 para la próxima (la versión sigue pendiente)', tanda.r.ventas === 3000 && tanda.r.parcial === true && tanda.r.ventas_faltan === 5000 && Number(estT.v) < Number(estT.actual), [tanda.r, estT]);
  const masRec = await uno("select min(fecha) f from ventas where negocio_id = $1 and id like 'g%'", [NEG2]);
  chk('… empezando por las más recientes', new Date(masRec.f).getTime() === 1760000000000 - 2999 * 60000, masRec);
  let t = Date.now(); const pg1 = await uno('select proyectar_negocio($1, 100000) r', [NEG2]); const ms1 = Date.now() - t;
  grande.history[10].total = 20000; grande.history.unshift({ id: 'g-nueva', total: 5000, date: new Date().toISOString(), items: [], payments: [] });
  await sb.sql('update datos_negocio set datos = $2, version = version + 1 where negocio_id = $1', [NEG2, grande]);
  t = Date.now(); const pg2 = await uno('select proyectar_negocio($1) r', [NEG2]); const ms2 = Date.now() - t;
  console.log('   ⏱  8000 ventas: las 5000 restantes ' + ms1 + ' ms; con 2 cambios ' + ms2 + ' ms');
  chk('Negocio de 8000 ventas: la segunda tanda completa el resto', pg1.r.ventas === 5000 && pg1.r.parcial === false, [pg1.r, ms1]);
  chk('… y después solo reescribe lo que cambió (2 ventas) en menos de 4 s', pg2.r.ventas === 2 && pg2.r.ventas_eliminadas === 0 && ms2 < 4000, [pg2.r, ms2]);
  const cnt = await uno('select count(*) n, sum(total) t from ventas where negocio_id = $1 and eliminada_en is null', [NEG2]);
  chk('Conteo y total del negocio grande cuadran con el documento', Number(cnt.n) === 8001 && cnt.t === 7999 * 15000 + 20000 + 5000, cnt);

  grande.history = grande.history.slice(0, 7000);
  await sb.sql('update datos_negocio set datos = $2, version = version + 1 where negocio_id = $1', [NEG2, grande]);
  for (let i = 0; i < 3; i++) grande.history.push({ id: 'z' + i, total: 1, date: '2026-10-01T00:00:00Z', items: [], payments: [] });
  const vista = await uno('select proyectar_pendientes(20, 30) r');
  const fin = await uno('select version_proyectada v, (select version from datos_negocio where negocio_id = $1) actual from proyeccion_estado where negocio_id = $1', [NEG2]);
  chk('El repaso termina un negocio grande por tandas dentro de su tiempo (1001 ventas recortadas → eliminadas)', vista.r.proyectados >= 1 && vista.r.pendientes === 0 && Number(fin.v) === Number(fin.actual) && Number((await uno('select count(*) n from ventas where negocio_id = $1 and eliminada_en is not null and id like $2', [NEG2, 'g%'])).n) === 1001, [vista.r, fin]);

  // ---------- La migración se puede correr otra vez ----------
  let err = null;
  try { await sb.sql(fs.readFileSync(path.join(__dirname, '..', '..', 'supabase', 'migrations', '20261031000000_proyeccion.sql'), 'utf8')); } catch (e) { err = e.message; }
  chk('La migración se vuelve a correr sin errores (idempotente) y sin perder filas', !err && Number((await uno('select count(*) n from ventas where negocio_id = $1', [NEG2])).n) === 8002, err);
}

(async () => {
  let sb = null;
  try { sb = await iniciar(); await pruebas(sb); }
  catch (e) { mal++; console.log('❌ Error inesperado → ' + (e && e.stack || e)); }
  finally { if (sb) await sb.cerrar().catch(() => {}); }
  console.log('RESULTADO', ok, 'bien', mal, 'mal');
  process.exit(mal ? 1 : 0);
})();
