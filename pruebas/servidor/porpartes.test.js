// Pruebas del SERVIDOR: sincronizar solo lo que cambió (migración 20261123000000_datos_por_partes, ORDEVA 1.69.0),
// contra PostgreSQL REAL.
//  • guardar_cambios aplica las partes (v, x, o, l) sobre el documento guardado y da el MISMO resultado que mandar todo.
//  • Versión vieja → «conflicto» (igual que guardar_datos). Cambios mal formados → error y no se toca nada.
//  • Quien no es del negocio no puede guardar ni leer datos_cambios de otro negocio.
//  • Hace lo mismo que guardar_datos: el detalle privado de los pagos no queda en el documento NI en datos_cambios;
//    lo que el equipo no puede cambiar (precios) vuelve a como estaba, también en lo que reciben los demás equipos.
//  • datos_cambios guarda cada versión para que los otros equipos bajen solo eso.
// Corre solo:   node pruebas/servidor/porpartes.test.js
'use strict';
const fs = require('fs'), path = require('path');
const { iniciar } = require('./supabase-local');
let ok = 0, mal = 0;
const chk = (n, c, x) => { if (c) { ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
if (!process.env.VENTO_LOGS) for (const k of ['log', 'warn', 'error']) { const o = console[k].bind(console); console[k] = (...a) => { if (typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; o(...a); }; }

async function pruebas(sb) {
  const cab = (tok) => ({ apikey: sb.anonKey, 'Content-Type': 'application/json', Authorization: 'Bearer ' + (tok || sb.anonKey) });
  const rpc = async (fn, args, tok) => { const r = await fetch(sb.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: cab(tok), body: JSON.stringify(args || {}) }); return { st: r.status, j: await r.json().catch(() => null) }; };
  const tabla = async (q, tok) => { const r = await fetch(sb.url + '/rest/v1/' + q, { headers: cab(tok) }); return { st: r.status, j: await r.json().catch(() => null) }; };
  const uno = async (q, p) => (await sb.sql(q, p))[0];
  const orden = (o) => Array.isArray(o) ? o.map(orden) : o && typeof o === 'object' ? Object.keys(o).sort().reduce((m, k) => (m[k] = orden(o[k]), m), {}) : o;
  const igual = (a, b) => JSON.stringify(orden(a)) === JSON.stringify(orden(b));

  const dueno = await sb.usuario('dueno@partes.co');
  const NEG = (await rpc('crear_negocio', { p_nombre: 'Bar Partes', p_datos: {} }, dueno.token)).j;
  const base = {
    businessName: 'Bar Partes',
    products: [{ id: 'p1', name: 'Águila', price: 3500, stock: 10 }, { id: 'p2', name: 'Póker', price: 3500, stock: 8 }],
    tables: { 1: { items: [{ productId: 'p1', name: 'Águila', price: 3500, qty: 2 }], payments: [], people: [] }, 2: { items: [], payments: [], people: [] } },
    history: [{ id: 'h2', total: 7000 }, { id: 'h1', total: 3500 }],
    theme: 'ordeva2',
  };
  let ver = (await rpc('guardar_datos', { p_negocio: NEG, p_datos: base, p_version: 1 }, dueno.token)).j;
  const doc = async () => (await uno('select datos, version from datos_negocio where negocio_id = $1', [NEG]));

  // ---------- Partes de cada tipo ----------
  const esperado = JSON.parse(JSON.stringify(base));
  esperado.tables[1].items[0].qty = 3; delete esperado.tables[2]; esperado.tables[3] = { items: [], payments: [], people: [] };
  esperado.history = [{ id: 'h3', total: 3500 }].concat([{ id: 'h2', total: 7500 }]);   // h1 se borró, h2 se corrigió, h3 nueva
  esperado.theme = 'noche'; delete esperado.businessName; esperado.nuevo = { a: 1 };
  const cambios = {
    tables: { o: { 1: { v: esperado.tables[1] }, 2: { x: true }, 3: { v: esperado.tables[3] } } },
    history: { l: { pre: [{ id: 'h3', total: 3500 }], set: [{ id: 'h2', total: 7500 }], del: ['h1'] } },
    theme: { v: 'noche' }, businessName: { x: true }, nuevo: { v: { a: 1 } },
  };
  let r = await rpc('guardar_cambios', { p_negocio: NEG, p_cambios: cambios, p_version: ver }, dueno.token);
  let d = await doc();
  chk('guardar_cambios: versión nueva y el documento queda IGUAL a haber mandado todo', r.st === 200 && r.j === ver + 1 && d.version === ver + 1 && igual(d.datos, esperado), { r, d: d.datos });
  ver = r.j;
  const fila = await uno('select cambios from datos_cambios where negocio_id = $1 and version = $2', [NEG, ver]);
  chk('datos_cambios guarda lo que cambió en esa versión', fila && igual(fila.cambios, cambios), fila);
  chk('… y es mucho más pequeño que el documento', JSON.stringify(fila.cambios).length < JSON.stringify(d.datos).length * 2);

  // ---------- Conflicto y cambios mal formados ----------
  r = await rpc('guardar_cambios', { p_negocio: NEG, p_cambios: { theme: { v: 'x' } }, p_version: ver - 1 }, dueno.token);
  chk('Versión vieja → «conflicto» y no se toca nada', r.st >= 400 && /conflicto/.test(JSON.stringify(r.j)) && (await doc()).datos.theme === 'noche', r);
  r = await rpc('guardar_cambios', { p_negocio: NEG, p_cambios: { theme: 'sin-formato' }, p_version: ver }, dueno.token);
  chk('Cambios mal formados → error y no se toca nada', r.st >= 400 && (await doc()).version === ver, r);

  // ---------- Otro negocio ----------
  const intruso = await sb.usuario('intruso@otro.co');
  await rpc('crear_negocio', { p_nombre: 'Otro', p_datos: {} }, intruso.token);
  r = await rpc('guardar_cambios', { p_negocio: NEG, p_cambios: { theme: { v: 'hack' } }, p_version: ver }, intruso.token);
  chk('Alguien de otro negocio NO puede guardar cambios', r.st >= 400 && /sin_permiso/.test(JSON.stringify(r.j)) && (await doc()).datos.theme === 'noche', r);
  const t = await tabla('datos_cambios?select=version,cambios&negocio_id=eq.' + NEG, intruso.token);
  chk('… ni leer los cambios de ese negocio (RLS)', t.st === 200 && Array.isArray(t.j) && t.j.length === 0, t);
  const tDueno = await tabla('datos_cambios?select=version&negocio_id=eq.' + NEG + '&version=gt.' + (ver - 1) + '&order=version.asc', dueno.token);
  chk('El dueño sí los lee (para bajar solo lo nuevo)', tDueno.st === 200 && tDueno.j.length === 1 && tDueno.j[0].version === ver, tDueno);
  const tAnon = await tabla('datos_cambios?select=version&negocio_id=eq.' + NEG);
  chk('Sin sesión no se lee nada', tAnon.st >= 400 || (Array.isArray(tAnon.j) && tAnon.j.length === 0), tAnon);
  r = await fetch(sb.url + '/rest/v1/datos_cambios', { method: 'POST', headers: cab(dueno.token), body: JSON.stringify({ negocio_id: NEG, version: 999, cambios: {} }) });
  chk('Nadie escribe datos_cambios directamente (solo el servidor)', r.status >= 400, r.status);

  // ---------- Pagos privados ----------
  const lista = [{ id: 'a1', monto: 20000, metodo: 'NEQUI', de: 'JUAN PÉREZ', txt: 'Recibiste 20.000 de JUAN PÉREZ', fuente: 'sms' }];
  r = await rpc('guardar_cambios', { p_negocio: NEG, p_cambios: { pagos: { v: { on: true, lista } } }, p_version: ver }, dueno.token);
  ver = r.j; d = await doc();
  const filaP = await uno('select cambios from datos_cambios where negocio_id = $1 and version = $2', [NEG, ver]);
  chk('Pagos: el documento no lleva quién pagó ni el texto', r.st === 200 && !JSON.stringify(d.datos).includes('JUAN') && d.datos.pagos.lista[0].monto === 20000, d.datos.pagos);
  chk('… y lo que reciben los otros equipos (datos_cambios) TAMPOCO', !JSON.stringify(filaP.cambios).includes('JUAN') && filaP.cambios.pagos.v.lista[0].monto === 20000, filaP);

  // ---------- Equipo sin permiso ----------
  const mesero = await sb.usuario('mesero@partes.co');
  const cod = (await rpc('crear_invitacion', { p_negocio: NEG, p_rol: 'mesero' }, dueno.token)).j;
  await rpc('unirse_con_codigo', { p_codigo: cod, p_nombre: 'Pedro' }, mesero.token);
  r = await rpc('guardar_cambios', { p_negocio: NEG, p_cambios: { products: { l: { pre: [], set: [{ id: 'p1', name: 'Águila', price: 100, stock: 9 }], del: [] } }, tables: { o: { 2: { v: { items: [{ productId: 'p2', name: 'Póker', price: 3500, qty: 1 }], payments: [], people: [] } } } } }, p_version: ver }, mesero.token);
  ver = r.j; d = await doc();
  const p1 = d.datos.products.find((p) => p.id === 'p1');
  chk('Mesero: el precio que cambió sin permiso vuelve a $3.500; el stock sí cambia', r.st === 200 && p1.price === 3500 && p1.stock === 9, p1);
  chk('… y su pedido en la mesa 2 sí queda', d.datos.tables[2] && d.datos.tables[2].items[0].qty === 1, d.datos.tables);
  const filaM = await uno('select cambios from datos_cambios where negocio_id = $1 and version = $2', [NEG, ver]);
  chk('… y los otros equipos reciben el precio REAL ($3.500), no el que puso el mesero', filaM && filaM.cambios.products && JSON.stringify(filaM.cambios.products).includes('3500') && !JSON.stringify(filaM.cambios.products).includes('"price":100'), filaM);
  const audit = await uno("select count(*)::int n from auditoria where negocio_id = $1 and accion = 'productos_revertidos'", [NEG]);
  chk('… y queda en la auditoría', audit.n >= 1, audit);

  // ---------- Se guardan solo las últimas 300 ----------
  for (let i = 0; i < 5; i++) { r = await rpc('guardar_cambios', { p_negocio: NEG, p_cambios: { theme: { v: 't' + i } }, p_version: ver }, dueno.token); ver = r.j; }
  await sb.sql('update datos_cambios set version = version where false');
  const nCambios = await uno('select count(*)::int n, min(version) mi, max(version) ma from datos_cambios where negocio_id = $1', [NEG]);
  chk('Una fila por cada versión guardada por partes', nCambios.ma === ver && nCambios.n >= 8, nCambios);

  // ---------- guardar_datos sigue igual ----------
  r = await rpc('guardar_datos', { p_negocio: NEG, p_datos: Object.assign({}, (await doc()).datos, { theme: 'completo' }), p_version: ver }, dueno.token);
  chk('guardar_datos (todo el negocio) sigue funcionando igual', r.st === 200 && r.j === ver + 1 && (await doc()).datos.theme === 'completo', r);
  const sinFila = await uno('select count(*)::int n from datos_cambios where negocio_id = $1 and version = $2', [NEG, ver + 1]);
  chk('… y esa versión NO tiene fila de cambios (los equipos bajan todo, como siempre)', sinFila.n === 0, sinFila);

  let err = null;
  try { await sb.sql(fs.readFileSync(path.join(__dirname, '..', '..', 'supabase', 'migrations', '20261123000000_datos_por_partes.sql'), 'utf8')); } catch (e) { err = e.message; }
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
