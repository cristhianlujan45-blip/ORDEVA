// Pruebas del SERVIDOR: el equipo no reescribe precios, costos ni permisos (migración 20261106000000_equipo_no_reescribe,
// Vento 1.56.0, hallazgo D2), contra PostgreSQL REAL. Con los permisos que el dueño da en «👥 Permisos del equipo».
//  • Sin permiso: el precio, el nombre y el costo de los productos vuelven a los de antes; los productos borrados vuelven;
//    el stock y los productos nuevos sí cambian.
//  • Con «productos»: puede cambiar precios. Con solo «inventario»: el costo sí, el precio no.
//  • Los permisos y la clave de autorización: solo dueño o administrador.
//  • Ventas borradas por el equipo: no se bloquean, quedan completas en la auditoría.
//  • Dueño y administrador: todo igual que antes.
// Corre solo:   node pruebas/servidor/equiponoreescribe.test.js
'use strict';
const fs = require('fs'), path = require('path');
const { iniciar } = require('./supabase-local');
let ok = 0, mal = 0;
const chk = (n, c, x) => { if (c) { ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
if (!process.env.VENTO_LOGS) for (const k of ['log', 'warn', 'error']) { const o = console[k].bind(console); console[k] = (...a) => { if (typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; o(...a); }; }

async function pruebas(sb) {
  const cab = (tok) => ({ apikey: sb.anonKey, 'Content-Type': 'application/json', Authorization: 'Bearer ' + (tok || sb.anonKey) });
  const rpc = async (fn, args, tok) => { const r = await fetch(sb.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: cab(tok), body: JSON.stringify(args || {}) }); return { st: r.status, j: await r.json().catch(() => null) }; };
  const uno = async (q, p) => (await sb.sql(q, p))[0];
  const clon = (o) => JSON.parse(JSON.stringify(o));
  const orden = (o) => Array.isArray(o) ? o.map(orden) : o && typeof o === 'object' ? Object.keys(o).sort().reduce((m, k) => (m[k] = orden(o[k]), m), {}) : o;
  const igual = (a, b) => JSON.stringify(orden(a)) === JSON.stringify(orden(b));

  const dueno = await sb.usuario('dueno@d2.co');
  const NEG = (await rpc('crear_negocio', { p_nombre: 'Bar D2', p_datos: {} }, dueno.token)).j;
  const unir = async (email, rol) => {
    const u = await sb.usuario(email);
    const cod = (await rpc('crear_invitacion', { p_negocio: NEG, p_rol: rol }, dueno.token)).j;
    await rpc('unirse_con_codigo', { p_codigo: cod, p_nombre: rol }, u.token);
    return u;
  };
  const admin = await unir('admin@d2.co', 'admin');
  const mesero = await unir('mesero@d2.co', 'mesero');
  const empleado = await unir('empleado@d2.co', 'empleado');
  const cajero = await unir('caja@d2.co', 'cajero');

  const base = {
    businessName: 'Bar D2',
    products: [
      { id: 'p1', name: 'Águila', price: 5000, cost: 2800, stock: 10 },
      { id: 'p2', name: 'Picada', price: 32000, cost: 15000, stock: 5 },
    ],
    permisosEquipo: { empleado: { productos: false, inventario: true }, cajero: { productos: true }, clave: { h: 'hash-del-dueño' } },
    history: [{ id: 'v2', total: 10000, items: [{ name: 'Águila', qty: 2, price: 5000 }] }, { id: 'v1', total: 32000, items: [{ name: 'Picada', qty: 1, price: 32000 }] }],
  };
  let ver = (await rpc('guardar_datos', { p_negocio: NEG, p_datos: base, p_version: 1 }, dueno.token)).j;
  const doc = async () => (await uno('select datos from datos_negocio where negocio_id = $1', [NEG])).datos;
  const guardar = async (u, d) => { const r = await rpc('guardar_datos', { p_negocio: NEG, p_datos: d, p_version: ver }, u.token); if (r.st === 200) ver = r.j; return r; };

  // ---------- Mesero sin permisos ----------
  let d = clon(await doc());
  d.products[0].price = 100; d.products[0].name = 'Águila GRATIS'; d.products[0].cost = 1; d.products[0].stock = 9;   // vendió una
  d.products = d.products.filter((p) => p.id !== 'p2');                                                              // borra la picada
  d.products.push({ id: 'p9', name: 'Tinto', price: 1500, stock: 20 });                                              // producto nuevo
  d.permisosEquipo.mesero = { productos: true, historial: true }; d.permisosEquipo.clave = { h: 'mio' };            // se da permisos
  d.history = d.history.filter((v) => v.id !== 'v1');                                                                // borra una venta
  let r = await guardar(mesero, d);
  let s = await doc();
  const p1 = s.products.find((p) => p.id === 'p1');
  chk('El guardado del mesero NO falla (el celular sigue sincronizando)', r.st === 200, r);
  chk('Mesero: el precio, el nombre y el costo vuelven a los de antes', p1.price === 5000 && p1.name === 'Águila' && p1.cost === 2800, p1);
  chk('Mesero: el stock sí cambia (vender descuenta)', p1.stock === 9, p1);
  chk('Mesero: el producto que borró vuelve', !!s.products.find((p) => p.id === 'p2' && p.price === 32000), s.products.map((p) => p.id));
  chk('Mesero: el producto nuevo sí queda', !!s.products.find((p) => p.id === 'p9'), s.products.map((p) => p.id));
  chk('Mesero: los permisos y la clave de autorización quedan como los dejó el dueño', igual(s.permisosEquipo, base.permisosEquipo), s.permisosEquipo);
  chk('Mesero: la venta que borró NO se bloquea (la app pide la clave del dueño para eso)…', s.history.length === 1 && s.history[0].id === 'v2', s.history);
  const aud = await sb.sql("select accion, usuario_id, detalle from auditoria where negocio_id = $1 order by id", [NEG]);
  const vb = aud.find((a) => a.accion === 'venta_borrada_equipo');
  chk('… pero queda COMPLETA en la auditoría, con quién la borró', vb && vb.usuario_id === mesero.id && vb.detalle.venta.id === 'v1' && vb.detalle.venta.total === 32000 && vb.detalle.venta.items[0].name === 'Picada', vb);
  chk('Lo revertido también queda en la auditoría (productos y permisos)', aud.some((a) => a.accion === 'productos_revertidos' && a.detalle.productos >= 2) && aud.some((a) => a.accion === 'permisos_revertidos'), aud.map((a) => a.accion));

  // ---------- Empleado con «inventario» (sin «productos») ----------
  d = clon(await doc());
  d.products[0].cost = 3000; d.products[0].price = 6000;
  r = await guardar(empleado, d); s = await doc();
  const e1 = s.products.find((p) => p.id === 'p1');
  chk('Empleado con «inventario»: el costo sí cambia (factura del proveedor), el precio no', r.st === 200 && e1.cost === 3000 && e1.price === 5000, e1);

  // ---------- Cajero con «productos» ----------
  d = clon(await doc());
  d.products[0].price = 5500; d.products[0].name = 'Águila 330';
  r = await guardar(cajero, d); s = await doc();
  const c1 = s.products.find((p) => p.id === 'p1');
  chk('Cajero con el permiso «productos»: sí cambia precios y nombres', r.st === 200 && c1.price === 5500 && c1.name === 'Águila 330', c1);
  d = clon(await doc()); d.permisosEquipo.cajero.estadisticas = true;
  await guardar(cajero, d); s = await doc();
  chk('… pero tampoco puede darse permisos', !s.permisosEquipo.cajero.estadisticas, s.permisosEquipo);

  // ---------- Dueño y administrador: como siempre ----------
  d = clon(await doc()); d.products[0].price = 7000; d.permisosEquipo.mesero = { productos: true };
  r = await guardar(admin, d); s = await doc();
  chk('Administrador: cambia precios y permisos como siempre', r.st === 200 && s.products[0].price === 7000 && s.permisosEquipo.mesero.productos === true, s.permisosEquipo);
  d = clon(await doc()); d.products[0].price = 8000; d.products = d.products.filter((p) => p.id !== 'p9');
  r = await guardar(dueno, d); s = await doc();
  chk('Dueño: cambia y borra productos como siempre', r.st === 200 && s.products[0].price === 8000 && !s.products.find((p) => p.id === 'p9'), s.products);
  d = clon(await doc()); d.products[0].price = 9000;
  r = await guardar(mesero, d); s = await doc();
  chk('El mesero, con el permiso que le acaba de dar el administrador, ya puede cambiar precios', s.products[0].price === 9000, s.products[0]);

  // ---------- Lo demás sigue igual ----------
  d = clon(await doc()); d.iaClave = 'AIzaSyQUITAR-del-documento-12345'; d.qrCanales = ['vitod2canal1234']; d.pagos = { lista: [{ id: 'a1', monto: 1, de: 'JUAN' }] };
  r = await guardar(mesero, d); s = await doc();
  chk('El guardado del equipo sigue quitando la clave de IA y los datos de quien paga, y anota los canales', r.st === 200 && !('iaClave' in s) && !JSON.stringify(s).includes('JUAN') && !!(await uno("select 1 x from canal_privado where canal = 'vitod2canal1234'")));
  r = await rpc('guardar_datos', { p_negocio: NEG, p_datos: d, p_version: 1 }, mesero.token);
  chk('Con una versión vieja sigue respondiendo «conflicto» (la app mezcla y vuelve a guardar)', r.st >= 400 && /conflicto/.test(JSON.stringify(r.j)), r);
  r = await rpc('datos_proteger_equipo', { p_negocio: NEG, p_rol: 'dueno', p_usuario: mesero.id, p_viejo: {}, p_nuevo: {} }, mesero.token);
  chk('Un cliente no puede llamar la función interna', r.st >= 400, r);

  // ---------- Rendimiento: negocio grande ----------
  const grande = clon(await doc());
  grande.history = Array.from({ length: 8000 }, (_, i) => ({ id: 'g' + i, total: 1000, items: [{ name: 'Tinto', qty: 1, price: 1000 }] }));
  grande.products = Array.from({ length: 600 }, (_, i) => ({ id: 'x' + i, name: 'Producto ' + i, price: 1000 + i, cost: 500, stock: 10 }));
  await guardar(dueno, grande);
  const g2 = clon(grande); g2.history.unshift({ id: 'nueva', total: 1000 }); g2.products[5].stock = 9;
  const t0 = Date.now(); r = await guardar(mesero, g2); const ms = Date.now() - t0;
  console.log('   ⏱  guardado del mesero con 8000 ventas y 600 productos: ' + ms + ' ms');
  chk('Negocio grande (8000 ventas, 600 productos): el guardado del mesero sigue rápido (< 1,5 s aquí)', r.st === 200 && ms < 1500, ms);

  let err = null;
  try { await sb.sql(fs.readFileSync(path.join(__dirname, '..', '..', 'supabase', 'migrations', '20261106000000_equipo_no_reescribe.sql'), 'utf8')); } catch (e) { err = e.message; }
  chk('La migración se vuelve a correr sin errores', !err, err);
}

(async () => {
  let sb = null;
  try { sb = await iniciar(); await pruebas(sb); }
  catch (e) { mal++; console.log('❌ Error inesperado → ' + (e && e.stack || e)); }
  finally { if (sb) await sb.cerrar().catch(() => {}); }
  console.log('RESULTADO', ok, 'bien', mal, 'mal');
  process.exit(mal ? 1 : 0);
})();
