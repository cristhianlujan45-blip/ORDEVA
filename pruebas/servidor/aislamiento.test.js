// Pruebas del SERVIDOR: aislamiento entre negocios (auditoría ORDEVA, etapa 7), contra PostgreSQL REAL.
// Recorre TODAS las tablas de la base (no una lista a mano: si mañana se agrega una tabla, entra sola):
//  • El dueño de otro negocio, un mesero de otro negocio y alguien sin sesión no ven NINGUNA fila de este negocio.
//  • El dueño de este negocio sí ve todas las suyas (las lecturas funcionan; no es que nadie vea nada).
//  • Nadie de afuera cambia ni borra filas de este negocio por la API de tablas, ni guarda su documento.
//  • Cada regla de lectura de una tabla con negocio pasa por la membresía (es_miembro / rol_en); las únicas
//    abiertas a todos son los catálogos de planes. Todas las tablas con RLS y nada de plata en decimales inexactos.
// Corre solo:   node pruebas/servidor/aislamiento.test.js
'use strict';
const { iniciar } = require('./supabase-local');
let ok = 0, mal = 0;
const chk = (n, c, x) => { if (c) { ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
if (!process.env.VENTO_LOGS) for (const k of ['log', 'warn', 'error']) { const o = console[k].bind(console); console[k] = (...a) => { if (typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; o(...a); }; }

const CATALOGOS = ['plans', 'plan_entitlements', 'entitlements'];   // iguales para todos los negocios (sin datos de nadie)

function documento(nombre, precio) {
  return {
    businessName: nombre,
    categories: [{ id: 'c1', name: 'Cervezas' }],
    products: [{ id: 'p1', name: 'Águila', price: precio, cost: 2800, stock: 40, categoryId: 'c1' }, { id: 'p2', name: 'Picada', price: 32000, cost: 15000 }],
    history: [{ id: 'v-' + precio, table: '4', tableName: 'Mesa 4', total: precio * 2, debt: 0, date: '2026-10-23T01:00:00.000Z',
      items: [{ name: 'Águila', qty: 2, price: precio, cost: 2800 }], payments: [{ note: '', amount: precio * 2, method: 'nequi' }] }],
    inventarioMov: [{ id: 'm1', tipo: 'entrada', productId: 'p1', name: 'Águila', qty: 24, costo: 2800, unidad: 'und', at: 1761100000000 }],
    closures: [{ id: '1761000000000', date: '2026-10-21T05:00:00.000Z', from: '2026-10-20T17:00:00.000Z', ticketCount: 1, totalSold: precio * 2, totalEfectivo: 0, totalTransferencia: precio * 2, totalDebe: 0 }],
  };
}

async function pruebas(sb) {
  const cab = (tok, extra) => ({ apikey: sb.anonKey, 'Content-Type': 'application/json', Authorization: 'Bearer ' + (tok || sb.anonKey), ...(extra || {}) });
  const rpc = async (fn, args, tok) => { const r = await fetch(sb.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: cab(tok), body: JSON.stringify(args || {}) }); return { st: r.status, j: await r.json().catch(() => null) }; };
  const leer = async (t, tok) => { const r = await fetch(sb.url + '/rest/v1/' + t + '?select=*', { headers: cab(tok) }); const j = await r.json().catch(() => null); return { st: r.status, filas: Array.isArray(j) ? j : [] }; };
  const repaso = () => fetch(sb.url + '/functions/v1/vento-pagos/sync', { method: 'POST', headers: cab(null, { 'x-vento-cron': sb.cron }), body: '{}' }).then((r) => r.text());

  // Negocio A (dueño + mesero) y negocio B (dueño + mesero), con datos de verdad en los dos.
  const duenoA = await sb.usuario('dueno@bar-a.co');
  const A = (await rpc('crear_negocio', { p_nombre: 'Bar A', p_datos: {} }, duenoA.token)).j;
  const meseroA = await sb.usuario('mesero@bar-a.co');
  await rpc('unirse_con_codigo', { p_codigo: (await rpc('crear_invitacion', { p_negocio: A, p_rol: 'mesero' }, duenoA.token)).j, p_nombre: 'Mesero A' }, meseroA.token);
  await rpc('crear_invitacion', { p_negocio: A, p_rol: 'cajero' }, duenoA.token);    // queda una invitación sin usar
  const duenoB = await sb.usuario('dueno@bar-b.co');
  const B = (await rpc('crear_negocio', { p_nombre: 'Bar B', p_datos: {} }, duenoB.token)).j;
  const meseroB = await sb.usuario('mesero@bar-b.co');
  await rpc('unirse_con_codigo', { p_codigo: (await rpc('crear_invitacion', { p_negocio: B, p_rol: 'mesero' }, duenoB.token)).j, p_nombre: 'Mesero B' }, meseroB.token);
  let r = await rpc('guardar_datos', { p_negocio: A, p_datos: documento('Bar A', 5000), p_version: 1 }, duenoA.token);
  const r2 = await rpc('guardar_datos', { p_negocio: B, p_datos: documento('Bar B', 6000), p_version: 1 }, duenoB.token);
  chk('Dos negocios con datos (productos, ventas, inventario, cierres)', r.st === 200 && r2.st === 200, { r, r2 });
  await rpc('guardar_datos', { p_negocio: A, p_datos: documento('Bar A', 5100), p_version: 2 }, duenoA.token);   // y un respaldo
  await repaso();

  // Todas las tablas de la base, con la columna que dice de qué negocio es.
  const tablas = await sb.sql(`select c.relname t,
      (select k.column_name from information_schema.columns k where k.table_schema = 'public' and k.table_name = c.relname
        and k.column_name in ('negocio_id', 'business_id') order by k.column_name desc limit 1) col
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm') order by 1`);
  const deA = async (t, col) => col ? Number((await sb.sql(`select count(*) n from public.${t} where ${col} = $1`, [A]))[0].n)
    : t === 'negocios' ? 1 : 0;
  const filtrarA = (filas, t, col) => filas.filter((f) => (col ? f[col] === A : t === 'negocios' && f.id === A) || JSON.stringify(f).includes(A));

  const fugas = [], sinVer = [], conDatos = [];
  for (const { t, col } of tablas) {
    const n = await deA(t, col);
    if (n) conDatos.push(t + ':' + n);
    for (const [quien, tok] of [['dueño de B', duenoB.token], ['mesero de B', meseroB.token], ['sin sesión', null]]) {
      const x = await leer(t, tok);
      const f = filtrarA(x.filas, t, col);
      if (f.length) fugas.push({ tabla: t, quien, filas: f.length });
    }
    if (n) { const x = await leer(t, duenoA.token); const vistas = filtrarA(x.filas, t, col).length; if (vistas !== n && !['app_errores', 'canal_privado', 'cambios_tipo', 'dispositivos', 'instalaciones', 'integraciones', 'licencia_usos', 'pago_avisos_detalle', 'pago_proveedores', 'soporte_casos'].includes(t)) sinVer.push({ tabla: t, hay: n, ve: vistas }); }
  }
  chk('Se probaron todas las tablas y hay datos del negocio A en varias (' + conDatos.length + ' tablas)', tablas.length >= 40 && conDatos.length >= 8, { tablas: tablas.length, conDatos });
  chk('Ni el dueño de otro negocio, ni su mesero, ni alguien sin sesión ven UNA sola fila del negocio A', !fugas.length, fugas);
  chk('El dueño del negocio A sí ve todas las suyas (las que su app lee)', !sinVer.length, sinVer);
  const vistoB = filtrarA((await leer('productos', duenoB.token)).filas, 'productos', 'negocio_id').length;
  const propiosB = (await leer('productos', duenoB.token)).filas.filter((f) => f.negocio_id === B).length;
  chk('… y el dueño de B ve sus propios productos (no es que nadie vea nada)', propiosB === 2 && vistoB === 0, { propiosB, vistoB });

  // Escrituras desde afuera por la API de tablas: no cambian nada del negocio A.
  const huella = async () => JSON.stringify(await sb.sql(`select (select json_agg(p order by id) from productos p where negocio_id = $1) p,
    (select json_agg(v order by id) from ventas v where negocio_id = $1) v, (select json_agg(m order by usuario_id) from miembros m where negocio_id = $1) m,
    (select row_to_json(d) from datos_negocio d where negocio_id = $1) d, (select row_to_json(x) from negocios x where id = $1) x`, [A]));
  const antes = await huella();
  const intentos = [];
  for (const tok of [duenoB.token, meseroB.token, null]) {
    const h = cab(tok, { Prefer: 'return=representation' });
    intentos.push((await fetch(sb.url + '/rest/v1/productos?negocio_id=eq.' + A, { method: 'PATCH', headers: h, body: JSON.stringify({ precio: 1 }) })).status);
    intentos.push((await fetch(sb.url + '/rest/v1/ventas?negocio_id=eq.' + A, { method: 'DELETE', headers: h })).status);
    intentos.push((await fetch(sb.url + '/rest/v1/negocios?id=eq.' + A, { method: 'PATCH', headers: h, body: JSON.stringify({ nombre: 'Robado' }) })).status);
    intentos.push((await fetch(sb.url + '/rest/v1/miembros', { method: 'POST', headers: h, body: JSON.stringify({ negocio_id: A, usuario_id: duenoB.id, rol: 'dueno' }) })).status);
    intentos.push((await fetch(sb.url + '/rest/v1/datos_negocio?negocio_id=eq.' + A, { method: 'PATCH', headers: h, body: JSON.stringify({ datos: {} }) })).status);
    intentos.push((await rpc('guardar_datos', { p_negocio: A, p_datos: { businessName: 'Robado' }, p_version: 3 }, tok)).st);
  }
  chk('Nadie de afuera cambia, borra ni se mete en el negocio A (precios, ventas, nombre, miembros, documento)', (await huella()) === antes, intentos);

  // Reglas: cada lectura de una tabla con negocio pasa por la membresía.
  const pol = await sb.sql(`select tablename t, policyname p, cmd, coalesce(qual, '') || ' ' || coalesce(with_check, '') q from pg_policies where schemaname = 'public'`);
  const conNeg = new Set(tablas.filter((x) => x.col || x.t === 'negocios').map((x) => x.t));
  const sueltas = pol.filter((x) => !CATALOGOS.includes(x.t) && !/es_miembro|rol_en|auth\.uid\(\)/.test(x.q)).map((x) => x.t + '.' + x.p);
  const abiertas = pol.filter((x) => conNeg.has(x.t) && /^\s*true\s*$/.test(x.q)).map((x) => x.t + '.' + x.p);
  chk('Toda regla de las tablas con negocio pasa por la membresía (las únicas abiertas son los catálogos de planes)', !sueltas.length && !abiertas.length, { sueltas, abiertas });
  const sinRls = await sb.sql(`select c.relname t from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
  chk('Todas las tablas tienen RLS', !sinRls.length, sinRls);
  const flotantes = await sb.sql(`select table_name || '.' || column_name c from information_schema.columns where table_schema = 'public' and data_type in ('real', 'double precision', 'money')`);
  chk('Ningún valor (plata, cantidades) se guarda con decimales inexactos: todo es NUMERIC o entero', !flotantes.length, flotantes);
}

(async () => {
  let sb = null;
  try { sb = await iniciar(); await pruebas(sb); }
  catch (e) { mal++; console.log('❌ Error inesperado → ' + (e && e.stack || e)); }
  finally { if (sb) await sb.cerrar().catch(() => {}); }
  console.log('RESULTADO', ok, 'bien', mal, 'mal');
  process.exit(mal ? 1 : 0);
})();
