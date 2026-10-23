// Pruebas del SERVIDOR: los respaldos del negocio se pueden restaurar de verdad (hallazgo D10), contra PostgreSQL REAL.
//  • Cada guardado deja como máximo un respaldo por hora (los últimos 48).
//  • Restaurar trae el documento del respaldo, sube la versión (los equipos lo bajan) y deja el estado de antes como
//    respaldo: se puede deshacer restaurando ese.
//  • Solo dueño o administrador; ni el mesero ni otro negocio; la lista de respaldos tampoco la ven.
//  • Un respaldo viejo (con la clave de IA o el nombre de quien pagó) NO vuelve a meter eso en los datos compartidos.
//  • Después de restaurar, las tablas de reportes quedan iguales al documento restaurado.
// Corre solo:   node pruebas/servidor/respaldos.test.js
'use strict';
const { iniciar } = require('./supabase-local');
let ok = 0, mal = 0;
const chk = (n, c, x) => { if (c) { ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
if (!process.env.VENTO_LOGS) for (const k of ['log', 'warn', 'error']) { const o = console[k].bind(console); console[k] = (...a) => { if (typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; o(...a); }; }

async function pruebas(sb) {
  const cab = (tok) => ({ apikey: sb.anonKey, 'Content-Type': 'application/json', Authorization: 'Bearer ' + (tok || sb.anonKey) });
  const rpc = async (fn, args, tok) => { const r = await fetch(sb.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: cab(tok), body: JSON.stringify(args || {}) }); return { st: r.status, j: await r.json().catch(() => null) }; };
  const uno = async (q, p) => (await sb.sql(q, p))[0];

  const dueno = await sb.usuario('dueno@resp.co');
  const NEG = (await rpc('crear_negocio', { p_nombre: 'Bar Respaldos', p_datos: {} }, dueno.token)).j;
  const mesero = await sb.usuario('mesero@resp.co');
  const cod = (await rpc('crear_invitacion', { p_negocio: NEG, p_rol: 'mesero' }, dueno.token)).j;
  await rpc('unirse_con_codigo', { p_codigo: cod, p_nombre: 'Pedro' }, mesero.token);
  const otro = await sb.usuario('otro@resp.co');
  await rpc('crear_negocio', { p_nombre: 'Otro', p_datos: {} }, otro.token);

  const venta = (id, total) => ({ id, total, date: '2026-10-23T01:00:00Z', items: [{ name: 'Águila', qty: total / 5000, price: 5000 }], payments: [{ amount: total, method: 'efectivo' }] });
  let ver = (await rpc('guardar_datos', { p_negocio: NEG, p_datos: { businessName: 'Bar Respaldos', products: [{ id: 'p1', name: 'Águila', price: 5000 }], history: [venta('v1', 10000), venta('v2', 5000)] }, p_version: 1 }, dueno.token)).j;
  await sb.sql('select proyectar_negocio($1)', [NEG]);
  const resp = await sb.sql('select id, version from respaldos where negocio_id = $1 order by id', [NEG]);
  chk('El primer guardado deja un respaldo', resp.length === 1 && Number(resp[0].version) === ver, resp);
  // Se «pierden» ventas por un error en un celular…
  ver = (await rpc('guardar_datos', { p_negocio: NEG, p_datos: { businessName: 'Bar Respaldos', products: [], history: [] }, p_version: ver }, dueno.token)).j;
  chk('Un segundo guardado en la misma hora no hace otro respaldo', Number((await uno('select count(*) n from respaldos where negocio_id = $1', [NEG])).n) === 1);
  await sb.sql('select proyectar_negocio($1)', [NEG]);
  chk('Las tablas de reportes ven las ventas como eliminadas', Number((await uno('select count(*) n from ventas where negocio_id = $1 and eliminada_en is not null', [NEG])).n) === 2);

  // ---------- Permisos ----------
  let r = await rpc('restaurar_respaldo', { p_respaldo: resp[0].id }, mesero.token);
  chk('El mesero NO puede restaurar', r.st >= 400, r);
  r = await rpc('restaurar_respaldo', { p_respaldo: resp[0].id }, otro.token);
  chk('Otro negocio NO puede restaurar el respaldo de este', r.st >= 400, r);
  const lm = await fetch(sb.url + '/rest/v1/respaldos?negocio_id=eq.' + NEG + '&select=id', { headers: cab(mesero.token) }).then((x) => x.json());
  chk('El mesero tampoco ve la lista de respaldos', Array.isArray(lm) && lm.length === 0, lm);

  // ---------- Restaurar ----------
  r = await rpc('restaurar_respaldo', { p_respaldo: resp[0].id }, dueno.token);
  let doc = await uno('select datos, version from datos_negocio where negocio_id = $1', [NEG]);
  chk('El dueño restaura: vuelven las 2 ventas y el producto', r.st === 200 && doc.datos.history.length === 2 && doc.datos.products.length === 1, [r, doc.datos]);
  chk('… y la versión sube (los equipos bajan el documento restaurado)', Number(doc.version) === ver + 1 && r.j === Number(doc.version), [r.j, doc.version, ver]);
  const aud = await uno("select usuario_id from auditoria where negocio_id = $1 and accion = 'respaldo_restaurado'", [NEG]);
  chk('Queda en la auditoría quién restauró', aud && aud.usuario_id === dueno.id, aud);
  await sb.sql('select proyectar_negocio($1)', [NEG]);
  chk('Las tablas de reportes vuelven a tener las 2 ventas activas', Number((await uno('select count(*) n from ventas where negocio_id = $1 and eliminada_en is null', [NEG])).n) === 2);
  // Deshacer: el estado de antes quedó como respaldo
  const antes = await uno('select id from respaldos where negocio_id = $1 order by id desc limit 1', [NEG]);
  r = await rpc('restaurar_respaldo', { p_respaldo: antes.id }, dueno.token);
  doc = await uno('select datos from datos_negocio where negocio_id = $1', [NEG]);
  chk('Se puede deshacer: el estado de antes de restaurar quedó como respaldo', r.st === 200 && doc.datos.history.length === 0, doc.datos);

  // ---------- Un respaldo viejo no trae secretos ----------
  await sb.sql("insert into respaldos(negocio_id, datos, version) values ($1, jsonb_build_object('businessName', 'Viejo', 'iaClave', 'AIzaSyVIEJA-de-antes-0123456789', 'qrCanales', jsonb_build_array('vitorespaldocanal'), 'pagos', jsonb_build_object('lista', jsonb_build_array(jsonb_build_object('id', 'a9', 'monto', 7000, 'de', 'LUCÍA', 'txt', 'Nequi: LUCÍA te envió')))), 3)", [NEG]);
  const viejo = await uno("select id from respaldos where negocio_id = $1 and datos->>'businessName' = 'Viejo'", [NEG]);
  r = await rpc('restaurar_respaldo', { p_respaldo: viejo.id }, dueno.token);
  doc = await uno('select datos from datos_negocio where negocio_id = $1', [NEG]);
  chk('Un respaldo de antes de la 1.53 / 1.55 NO vuelve a meter la clave de IA ni el nombre de quien pagó', r.st === 200 && doc.datos.businessName === 'Viejo' && !('iaClave' in doc.datos) && !JSON.stringify(doc.datos).includes('LUCÍA'), doc.datos);
  chk('… la clave queda en el servidor y el detalle del pago aparte (no se pierden)', !!(await uno("select 1 x from integraciones where negocio_id = $1 and tipo = 'ia'", [NEG])) && (await uno("select de from pago_avisos_detalle where negocio_id = $1 and aviso_id = 'a9'", [NEG])).de === 'LUCÍA');
  chk('… y el canal de pedidos del respaldo queda anotado a nombre del negocio', (await uno("select negocio_id from canal_privado where canal = 'vitorespaldocanal'")).negocio_id === NEG);

  // ---------- Se guardan los últimos 48 ----------
  for (let i = 0; i < 50; i++) await sb.sql("insert into respaldos(negocio_id, datos, version, creado_en) values ($1, '{}'::jsonb, 1, now() - interval '3 hours' - ($2 || ' minutes')::interval)", [NEG, i]);
  ver = Number((await uno('select version from datos_negocio where negocio_id = $1', [NEG])).version);
  await sb.sql("update respaldos set creado_en = now() - interval '2 hours' where negocio_id = $1", [NEG]);
  await rpc('guardar_datos', { p_negocio: NEG, p_datos: { businessName: 'Bar Respaldos' }, p_version: ver }, dueno.token);
  chk('Con más de 48 respaldos se quedan los 48 más nuevos', Number((await uno('select count(*) n from respaldos where negocio_id = $1', [NEG])).n) === 48);
}

(async () => {
  let sb = null;
  try { sb = await iniciar(); await pruebas(sb); }
  catch (e) { mal++; console.log('❌ Error inesperado → ' + (e && e.stack || e)); }
  finally { if (sb) await sb.cerrar().catch(() => {}); }
  console.log('RESULTADO', ok, 'bien', mal, 'mal');
  process.exit(mal ? 1 : 0);
})();
