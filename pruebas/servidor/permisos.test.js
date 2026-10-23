// Pruebas del SERVIDOR: alguien que NO es del negocio no puede invitarse, cambiar roles ni restaurar respaldos
// (migración 20261104100000_permisos_sin_hueco, Vento 1.54.0), contra PostgreSQL REAL.
//  • rol_en() da NULL para quien no es miembro; antes «NULL not in (...)» dejaba pasar.
//  • Otra cuenta con sesión: no saca códigos (ni de administrador), no cambia roles, no restaura respaldos.
//  • El dueño y el administrador siguen igual (el admin no invita administradores ni cambia roles).
//  • Códigos viejos hechos por alguien de afuera: quedan en la auditoría y, si no se usaron, vencidos.
// Corre solo:   node pruebas/servidor/permisos.test.js
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
  const rolDe = async (neg, u) => ((await uno('select rol from miembros where negocio_id = $1 and usuario_id = $2', [neg, u])) || {}).rol || null;

  const dueno = await sb.usuario('dueno@permisos.co');
  const NEG = (await rpc('crear_negocio', { p_nombre: 'Bar Permisos', p_datos: { businessName: 'Bar Permisos' } }, dueno.token)).j;
  const admin = await sb.usuario('admin@permisos.co');
  await rpc('unirse_con_codigo', { p_codigo: (await rpc('crear_invitacion', { p_negocio: NEG, p_rol: 'admin' }, dueno.token)).j }, admin.token);
  const mesero = await sb.usuario('mesero@permisos.co');
  await rpc('unirse_con_codigo', { p_codigo: (await rpc('crear_invitacion', { p_negocio: NEG, p_rol: 'mesero' }, dueno.token)).j }, mesero.token);
  chk('Equipo armado: dueño, administrador y mesero', (await rolDe(NEG, admin.id)) === 'admin' && (await rolDe(NEG, mesero.id)) === 'mesero');
  const intruso = await sb.usuario('intruso@afuera.co');
  await rpc('crear_negocio', { p_nombre: 'Del intruso', p_datos: {} }, intruso.token);

  // ---------- Alguien de afuera ----------
  let r = await rpc('crear_invitacion', { p_negocio: NEG, p_rol: 'admin' }, intruso.token);
  chk('Otra cuenta NO saca un código de administrador para este negocio', r.st >= 400 && /sin_permiso/.test(JSON.stringify(r.j)), r);
  r = await rpc('crear_invitacion', { p_negocio: NEG, p_rol: 'mesero' }, intruso.token);
  chk('… ni de mesero', r.st >= 400, r);
  chk('… y no quedó ningún código suyo', Number((await uno('select count(*) n from invitaciones where creado_por = $1', [intruso.id])).n) === 0);
  r = await rpc('cambiar_rol', { p_negocio: NEG, p_usuario: dueno.id, p_rol: 'empleado' }, intruso.token);
  chk('Otra cuenta NO le cambia el rol al dueño', r.st >= 400 && (await rolDe(NEG, dueno.id)) === 'dueno', r);
  r = await rpc('cambiar_rol', { p_negocio: NEG, p_usuario: mesero.id, p_rol: 'admin' }, intruso.token);
  chk('… ni sube a un mesero a administrador', r.st >= 400 && (await rolDe(NEG, mesero.id)) === 'mesero', r);
  await rpc('guardar_datos', { p_negocio: NEG, p_datos: { businessName: 'Bar Permisos', products: [{ id: 'p1', name: 'Águila', price: 5000 }] }, p_version: 1 }, dueno.token);
  const resp = await uno('select id from respaldos where negocio_id = $1 order by id limit 1', [NEG]);
  r = await rpc('restaurar_respaldo', { p_respaldo: resp.id }, intruso.token);
  chk('Otra cuenta NO restaura un respaldo de este negocio', r.st >= 400 && /sin_permiso/.test(JSON.stringify(r.j)), r);
  r = await rpc('quitar_miembro', { p_negocio: NEG, p_usuario: mesero.id }, intruso.token);
  chk('Otra cuenta NO saca a nadie (ya estaba bien)', r.st >= 400 && (await rolDe(NEG, mesero.id)) === 'mesero', r);

  // ---------- Los de adentro, igual que antes ----------
  r = await rpc('crear_invitacion', { p_negocio: NEG, p_rol: 'cajero' }, mesero.token);
  chk('El mesero no saca códigos', r.st >= 400, r);
  r = await rpc('crear_invitacion', { p_negocio: NEG, p_rol: 'admin' }, admin.token);
  chk('El administrador no saca códigos de administrador', r.st >= 400, r);
  r = await rpc('crear_invitacion', { p_negocio: NEG, p_rol: 'empleado' }, admin.token);
  chk('El administrador sí saca códigos de empleado', r.st === 200 && /^[A-Z0-9a-z]{8}$/.test(r.j), r);
  r = await rpc('cambiar_rol', { p_negocio: NEG, p_usuario: mesero.id, p_rol: 'cajero' }, admin.token);
  chk('El administrador no cambia roles', r.st >= 400 && (await rolDe(NEG, mesero.id)) === 'mesero', r);
  r = await rpc('cambiar_rol', { p_negocio: NEG, p_usuario: mesero.id, p_rol: 'cajero' }, dueno.token);
  chk('El dueño sí cambia roles', r.st === 200 && (await rolDe(NEG, mesero.id)) === 'cajero', r);
  r = await rpc('restaurar_respaldo', { p_respaldo: resp.id }, mesero.token);
  chk('El cajero no restaura respaldos', r.st >= 400, r);
  r = await rpc('restaurar_respaldo', { p_respaldo: resp.id }, admin.token);
  chk('El administrador sí restaura', r.st === 200 && typeof r.j === 'number', r);
  r = await rpc('restaurar_respaldo', { p_respaldo: resp.id }, dueno.token);
  chk('El dueño sí restaura', r.st === 200, r);

  // ---------- Si alguien ya lo había usado ----------
  await sb.sql("insert into invitaciones(codigo, negocio_id, rol, creado_por) values ('MALO0001', $1, 'admin', $2), ('MALO0002', $1, 'admin', $2)", [NEG, intruso.id]);
  await sb.sql("update invitaciones set usada_por = $1, usada_en = now() where codigo = 'MALO0002'", [intruso.id]);
  const sql = fs.readFileSync(path.join(__dirname, '../../supabase/migrations/20261104100000_permisos_sin_hueco.sql'), 'utf8');
  await sb.sql(sql); await sb.sql(sql);
  const aud = await sb.sql("select detalle->>'codigo' c from auditoria where negocio_id = $1 and accion = 'invitacion_sospechosa' order by 1", [NEG]);
  chk('Los códigos hechos por alguien de afuera quedan en la auditoría del negocio (una sola vez)', aud.map((a) => a.c).join() === 'MALO0001,MALO0002', aud);
  r = await rpc('unirse_con_codigo', { p_codigo: 'MALO0001' }, intruso.token);
  chk('… y el que nadie usó queda vencido', r.st >= 400 && /codigo_vencido/.test(JSON.stringify(r.j)) && (await rolDe(NEG, intruso.id)) === null, r);
  chk('Los códigos buenos del dueño y del administrador no se tocan', Number((await uno("select count(*) n from invitaciones where negocio_id = $1 and vence > now() and usada_por is null and codigo not like 'MALO%'", [NEG])).n) === 1);
}

(async () => {
  let sb = null;
  try { sb = await iniciar(); await pruebas(sb); }
  catch (e) { mal++; console.log('❌ Error inesperado → ' + (e && e.stack || e)); }
  finally { if (sb) await sb.cerrar().catch(() => {}); }
  console.log('RESULTADO', ok, 'bien', mal, 'mal');
  process.exit(mal ? 1 : 0);
})();
