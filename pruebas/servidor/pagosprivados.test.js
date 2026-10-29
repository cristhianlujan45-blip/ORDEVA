// Pruebas del SERVIDOR: los datos de quien paga solo para dueño y administrador (migración 20261105000000_pagos_privados,
// Vento 1.55.0, hallazgo D5: «solamente el administrador puede ver lo del Nequi»), contra PostgreSQL REAL.
//  • pagos_desde, pagos_dispositivo, confirmar_pago, /estado y la tabla pagos: el mesero, el cajero y el empleado reciben
//    el valor, la mesa y el estado, pero NO quién pagó, su teléfono, su documento ni el texto del banco. Quien creó el
//    cobro sí lo ve completo. El dueño y el administrador, todo.
//  • Los datos del negocio (data.pagos.lista) ya no llevan «de», «txt» ni «fuente»: quedan en el servidor y solo dueño y
//    administrador los leen. Nada se pierde (también la mudanza de lo que ya estaba).
// Corre solo:   node pruebas/servidor/pagosprivados.test.js
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { iniciar } = require('./supabase-local');
let ok = 0, mal = 0;
const chk = (n, c, x) => { if (c) { ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
if (!process.env.VENTO_LOGS) for (const k of ['log', 'warn', 'error']) { const o = console[k].bind(console); console[k] = (...a) => { if (typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; o(...a); }; }

async function pruebas(sb) {
  const cab = (tok) => ({ apikey: sb.anonKey, 'Content-Type': 'application/json', Authorization: 'Bearer ' + (tok || sb.anonKey) });
  const rpc = async (fn, args, tok) => { const r = await fetch(sb.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: cab(tok), body: JSON.stringify(args || {}) }); return { st: r.status, j: await r.json().catch(() => null) }; };
  const api = async (ruta, cuerpo, tok) => { const r = await fetch(sb.url + '/functions/v1/vento-pagos/' + ruta, { method: 'POST', headers: cab(tok), body: JSON.stringify(cuerpo || {}) }); return { st: r.status, j: await r.json().catch(() => ({})) }; };
  const uno = async (q, p) => (await sb.sql(q, p))[0];

  const dueno = await sb.usuario('dueno@pagos.co');
  const NEG = (await rpc('crear_negocio', { p_nombre: 'Bar Pagos', p_datos: {} }, dueno.token)).j;
  const unir = async (email, rol) => {
    const u = await sb.usuario(email);
    const cod = (await rpc('crear_invitacion', { p_negocio: NEG, p_rol: rol }, dueno.token)).j;
    await rpc('unirse_con_codigo', { p_codigo: cod, p_nombre: rol }, u.token);
    return u;
  };
  const admin = await unir('admin@pagos.co', 'admin');
  const cajero = await unir('caja@pagos.co', 'cajero');
  const mesero = await unir('mesero@pagos.co', 'mesero');
  const empleado = await unir('empleado@pagos.co', 'empleado');

  // Un aviso de Nequi leído en el celular (con nombre, teléfono y el texto del banco) y un cobro que creó el cajero.
  const av = await uno(`insert into pagos(negocio_id, referencia, proveedor, metodo, canal, monto, estado, confianza, mesa, pagador, telefono, documento, detalle, verificado, aprobado_en)
    values ($1, 'AV-prueba1', 'dispositivo', 'NEQUI', 'notificacion', 20000, 'aprobado', 'app', '3', 'JUAN PÉREZ', '•••4567', 'CC •••8019', 'Nequi: JUAN PÉREZ te envió $20.000 · SMS', false, now()) returning id`, [NEG]);
  const cob = await uno(`insert into pagos(negocio_id, referencia, proveedor, metodo, canal, monto, estado, mesa, pagador, detalle, creado_por, verificado, aprobado_en)
    values ($1, 'VNT-prueba2', 'wompi', 'NEQUI', 'push', 15000, 'aprobado', '5', 'ANA GÓMEZ', 'Aprobada por Nequi', $2, true, now()) returning id`, [NEG, cajero.id]);

  // ---------- pagos_desde ----------
  const ver = async (u) => { const r = await rpc('pagos_desde', { p_negocio: NEG, p_desde: null }, u.token); return { av: (r.j || []).find((x) => x.id === av.id) || {}, cob: (r.j || []).find((x) => x.id === cob.id) || {} }; };
  let v = await ver(dueno);
  chk('Dueño: ve quién pagó, el teléfono, el documento y el texto del banco', v.av.pagador === 'JUAN PÉREZ' && v.av.telefono === '•••4567' && v.av.documento === 'CC •••8019' && /JUAN/.test(v.av.detalle), v.av);
  v = await ver(admin);
  chk('Administrador: igual', v.av.pagador === 'JUAN PÉREZ' && /JUAN/.test(v.av.detalle), v.av);
  for (const [n, u] of [['Mesero', mesero], ['Empleado', empleado]]) {
    v = await ver(u);
    chk(n + ': el valor, la mesa y el estado sí («Mesa 3 ya pagó»), pero NI quién pagó NI el texto del banco', v.av.monto === 20000 && v.av.mesa === '3' && v.av.estado === 'aprobado' && v.av.pagador === null && v.av.telefono === null && v.av.documento === null && v.av.detalle === null && !JSON.stringify(v).includes('JUAN'), v.av);
  }
  v = await ver(cajero);
  chk('Cajero: el aviso del celular sin datos de quien pagó, pero sabe que fue por SMS (para no repetirlo)', v.av.pagador === null && v.av.detalle === null && v.av.sms === true, v.av);
  chk('Cajero: SU cobro lo ve completo (lo creó él)', v.cob.pagador === 'ANA GÓMEZ' && v.cob.detalle === 'Aprobada por Nequi', v.cob);

  // ---------- Tabla pagos directo (tiempo real) ----------
  const tabla = async (u) => { const r = await fetch(sb.url + '/rest/v1/pagos?negocio_id=eq.' + NEG, { headers: cab(u.token) }); const j = await r.json().catch(() => null); return Array.isArray(j) ? j.map((x) => x.id) : j; };
  chk('Tabla pagos: el dueño ve los 2', (await tabla(dueno)).length === 2);
  chk('Tabla pagos: el mesero ninguno (antes los veía todos, con nombre)', (await tabla(mesero)).length === 0);
  const tc = await tabla(cajero);
  chk('Tabla pagos: el cajero solo el que creó', tc.length === 1 && tc[0] === cob.id, tc);

  // ---------- confirmar_pago y /estado ----------
  await sb.sql("update pagos set confianza = 'revisar' where id = $1", [av.id]);
  let r = await rpc('confirmar_pago', { p_pago: av.id }, cajero.token);
  chk('El cajero confirma un aviso «por revisar» y la respuesta no trae quién pagó', r.st === 200 && r.j.confianza === 'ok' && r.j.pagador === null, r.j);
  r = await api('estado', { negocio: NEG, pago: av.id }, mesero.token);
  chk('/estado (mesero): sin quién pagó', r.st === 200 && r.j.pago && r.j.pago.monto === 20000 && r.j.pago.pagador === null && r.j.pago.detalle === null, r.j);
  r = await api('estado', { negocio: NEG, pago: av.id }, dueno.token);
  chk('/estado (dueño): completo', r.st === 200 && r.j.pago.pagador === 'JUAN PÉREZ', r.j);

  // ---------- pagos_dispositivo (la app Android con el celular bloqueado) ----------
  const tok = (u) => 'tok-' + u + '-' + crypto.randomBytes(12).toString('hex');
  const tM = tok('m'), tD = tok('d');
  await sb.sql("insert into dispositivos(negocio_id, usuario_id, token_hash) values ($1, $2, encode(extensions.digest($3, 'sha256'), 'hex')), ($1, $4, encode(extensions.digest($5, 'sha256'), 'hex'))", [NEG, mesero.id, tM, dueno.id, tD]);
  const pdM = (await rpc('pagos_dispositivo', { p_token: tM, p_desde: null })).j;
  const pdD = (await rpc('pagos_dispositivo', { p_token: tD, p_desde: null })).j;
  const am = (pdM.pagos || []).find((x) => x.id === av.id) || {}, ad = (pdD.pagos || []).find((x) => x.id === av.id) || {};
  chk('Android del mesero: el pago (valor y mesa) sin quién pagó', pdM.ok && am.monto === 20000 && am.pagador === null && am.detalle === null, am);
  chk('Android del dueño: completo', pdD.ok && ad.pagador === 'JUAN PÉREZ', ad);
  // 1.65.2: Android sabe del servidor si ESTE celular suena (no de la página, que con el celular bloqueado duerme).
  chk('pagos_dispositivo dice «suena» (por defecto sí)', pdD.suena === true && pdM.suena === true, { d: pdD.suena, m: pdM.suena });
  await sb.sql("update dispositivos set suena = false where token_hash = encode(extensions.digest($1, 'sha256'), 'hex')", [tD]);
  chk('… y «no suena» en el celular que el dueño eligió callar', (await rpc('pagos_dispositivo', { p_token: tD, p_desde: null })).j.suena === false);
  await sb.sql("update dispositivos set suena = true where token_hash = encode(extensions.digest($1, 'sha256'), 'hex')", [tD]);
  // 1.65.3: el pago les llega AL INSTANTE a todos: pagos_dispositivo le da a Android el canal en vivo del negocio y el
  // servidor avisa por ahí apenas un pago queda aprobado (aquí realtime.send se simula y se anota).
  chk('pagos_dispositivo le da a Android el canal en vivo secreto del negocio (el mismo para todos sus celulares)', /^vp-[0-9a-f]{32}$/.test(pdD.vivo || '') && pdD.vivo === pdM.vivo && !String(pdD.vivo).includes(NEG), { d: pdD.vivo, m: pdM.vivo });
  await sb.sql(`create schema if not exists realtime;
    create table if not exists realtime.enviados(t timestamptz default clock_timestamp(), payload jsonb, evento text, topic text);
    create or replace function realtime.send(payload jsonb, event text, topic text, private boolean default true) returns void language sql as $$ insert into realtime.enviados(payload, evento, topic) values (payload, event, topic) $$;`);
  const nuevoPago = await uno(`insert into pagos(negocio_id, referencia, proveedor, metodo, canal, monto, estado, confianza, verificado, aprobado_en)
    values ($1, 'AV-instante', 'dispositivo', 'NEQUI', 'notificacion', 7000, 'aprobado', 'app', false, now()) returning id`, [NEG]);
  let env = await sb.sql("select topic, evento, payload from realtime.enviados");
  chk('Pago aprobado: el servidor avisa en vivo por el canal del negocio, sin datos del pago', env.length === 1 && env[0].topic === pdD.vivo && env[0].evento === 'p' && !JSON.stringify(env[0].payload).includes('7000'), env);
  const pend = await uno(`insert into pagos(negocio_id, referencia, proveedor, metodo, canal, monto, estado) values ($1, 'VNT-espera', 'wompi', 'NEQUI', 'push', 9000, 'pendiente') returning id`, [NEG]);
  env = await sb.sql("select topic from realtime.enviados");
  chk('Un cobro que todavía espera el pago no avisa', env.length === 1, env.length);
  await sb.sql("update pagos set estado = 'aprobado', aprobado_en = now() where id = $1", [pend.id]);
  env = await sb.sql("select topic from realtime.enviados");
  chk('… y avisa en el instante en que queda pagado', env.length === 2, env.length);
  await sb.sql("update pagos set detalle = 'otra cosa' where id = $1", [pend.id]);
  chk('Cambiar otra cosa del pago no vuelve a avisar', (await sb.sql("select count(*)::int n from realtime.enviados"))[0].n === 2);
  // 1.65.6: «🔔 Probar» un equipo: la prueba va por el mismo canal en vivo, con el id del equipo que debe sonar, sin crear pagos.
  chk('pagos_dispositivo le dice a Android cuál es él (para atender solo su prueba)', /^[0-9a-f-]{36}$/.test(pdD.dispositivo || '') && pdD.dispositivo !== pdM.dispositivo, { d: pdD.dispositivo, m: pdM.dispositivo });
  const nPagos = (await uno('select count(*)::int n from pagos where negocio_id = $1', [NEG])).n;
  chk('dispositivo_probar: el dueño prueba el celular del mesero', (await rpc('dispositivo_probar', { p_dispositivo: pdM.dispositivo }, dueno.token)).j === true);
  env = await sb.sql("select topic, evento, payload from realtime.enviados where evento = 'prueba'");
  chk('… sale por el canal en vivo del negocio, solo con el id de ese equipo', env.length === 1 && env[0].topic === pdD.vivo && env[0].payload.d === pdM.dispositivo && Object.keys(env[0].payload).sort().join() === 'd,s,t' && env[0].payload.s === true, env);
  chk('… y no crea ningún pago', (await uno('select count(*)::int n from pagos where negocio_id = $1', [NEG])).n === nPagos);
  chk('El administrador también puede probar', (await rpc('dispositivo_probar', { p_dispositivo: pdD.dispositivo }, admin.token)).j === true);
  chk('El mesero puede probar SU celular', (await rpc('dispositivo_probar', { p_dispositivo: pdM.dispositivo }, mesero.token)).j === true);
  const pr1 = await rpc('dispositivo_probar', { p_dispositivo: pdD.dispositivo }, mesero.token), pr2 = await rpc('dispositivo_probar', { p_dispositivo: pdD.dispositivo }, cajero.token);
  chk('… pero ni el mesero ni el cajero pueden hacer sonar el celular del dueño', pr1.st >= 400 && pr2.st >= 400, { pr1, pr2 });
  const pr3 = await rpc('dispositivo_probar', { p_dispositivo: pdD.dispositivo });
  chk('Sin entrar (anónimo) no se puede', pr3.st >= 400, pr3);
  const otro = await sb.usuario('otro@negocio.co'); await rpc('crear_negocio', { p_nombre: 'Otro Bar', p_datos: {} }, otro.token);
  const pr4 = await rpc('dispositivo_probar', { p_dispositivo: pdD.dispositivo }, otro.token);
  chk('El dueño de OTRO negocio no puede', pr4.st >= 400, pr4);
  chk('Solo salieron las 3 pruebas permitidas', (await sb.sql("select count(*)::int n from realtime.enviados where evento = 'prueba'"))[0].n === 3);
  await sb.sql('delete from pagos where id = any($1)', [[nuevoPago.id, pend.id]]);
  await sb.sql('drop table realtime.enviados; drop function realtime.send(jsonb, text, text, boolean);');

  // ---------- Los avisos en los datos del negocio ----------
  const lista = [
    { id: 'and-1', via: 'and', t: Date.now(), monto: 20000, app: 'Nequi', de: 'JUAN PÉREZ', mesa: 3, estado: 'app', fuente: 'Confirmado por la app del banco', txt: 'Nequi | Nequi | JUAN PÉREZ te envió $20.000', sms: false, th: 'abc' },
    { id: 'srv-x', srv: av.id, t: Date.now(), monto: 15000, app: 'Nequi', de: '', estado: 'app', fuente: 'Nequi: MARÍA te envió', txt: 'AV-1' },
    { id: 'viejo', monto: 1000, app: 'Daviplata', estado: 'ok' }
  ];
  r = await rpc('guardar_datos', { p_negocio: NEG, p_datos: { businessName: 'Bar Pagos', pagos: { on: true, lista, espera: {} } }, p_version: 1 }, cajero.token);
  let vv = r.j;
  const doc = (await uno('select datos from datos_negocio where negocio_id = $1', [NEG])).datos;
  chk('Los datos del negocio (que van a todos los celulares) ya no llevan quién pagó, el texto ni la explicación', !JSON.stringify(doc).includes('JUAN') && !JSON.stringify(doc).includes('MARÍA') && doc.pagos.lista.every((x) => !('de' in x) && !('txt' in x) && !('fuente' in x)), doc.pagos.lista);
  chk('… y lo demás del aviso queda igual (valor, mesa, estado, si fue SMS, la huella)', doc.pagos.lista[0].monto === 20000 && doc.pagos.lista[0].mesa === 3 && doc.pagos.lista[0].sms === false && doc.pagos.lista[0].th === 'abc' && doc.pagos.lista.length === 3, doc.pagos.lista[0]);
  r = await rpc('pago_avisos_detalle_de', { p_negocio: NEG }, dueno.token);
  chk('El dueño recupera quién pagó y el texto de cada aviso', r.st === 200 && r.j['and-1'].de === 'JUAN PÉREZ' && /20.000/.test(r.j['and-1'].txt) && r.j['srv-x'].fuente === 'Nequi: MARÍA te envió', r.j);
  r = await rpc('pago_avisos_detalle_de', { p_negocio: NEG }, admin.token);
  chk('El administrador también', r.st === 200 && r.j['and-1'].de === 'JUAN PÉREZ', r.j);
  for (const [n, u] of [['cajero', cajero], ['mesero', mesero]]) {
    r = await rpc('pago_avisos_detalle_de', { p_negocio: NEG }, u.token);
    chk('El ' + n + ' NO', r.st >= 400, r);
  }
  r = await fetch(sb.url + '/rest/v1/pago_avisos_detalle', { headers: cab(dueno.token) });
  const rj = await r.json().catch(() => null);
  chk('Nadie lee la tabla de detalles directo', r.status >= 400 || (Array.isArray(rj) && !rj.length), [r.status, rj]);
  r = await rpc('guardar_datos', { p_negocio: NEG, p_datos: { businessName: 'Bar Pagos', pagos: { on: true, lista: [{ id: 'and-1', monto: 20000, app: 'Nequi', de: '', estado: 'app' }], espera: {} } }, p_version: vv }, mesero.token); vv = r.j;
  r = await rpc('pago_avisos_detalle_de', { p_negocio: NEG }, dueno.token);
  chk('Un celular que guarda el aviso sin el nombre no borra el detalle que ya estaba', r.j['and-1'].de === 'JUAN PÉREZ', r.j['and-1']);

  // ---------- Mudanza de lo que ya estaba en los datos ----------
  const dueno2 = await sb.usuario('otro@pagos.co');
  const NEG2 = (await rpc('crear_negocio', { p_nombre: 'Otro', p_datos: {} }, dueno2.token)).j;
  await sb.sql("update datos_negocio set datos = jsonb_build_object('pagos', jsonb_build_object('lista', jsonb_build_array(jsonb_build_object('id', 'v1', 'monto', 5000, 'de', 'PEDRO', 'txt', 'Bancolombia: PEDRO te transfirió')))) where negocio_id = $1", [NEG2]);
  const v0 = Number((await uno('select version from datos_negocio where negocio_id = $1', [NEG2])).version);
  let err = null;
  try { await sb.sql(fs.readFileSync(path.join(__dirname, '..', '..', 'supabase', 'migrations', '20261105000000_pagos_privados.sql'), 'utf8')); } catch (e) { err = e.message; }
  const d2 = await uno('select datos, version from datos_negocio where negocio_id = $1', [NEG2]);
  const det2 = await uno("select de, txt from pago_avisos_detalle where negocio_id = $1 and aviso_id = 'v1'", [NEG2]);
  chk('La migración (otra vez, idempotente) muda los avisos que ya estaban: los datos sin el nombre y la versión sube', !err && !JSON.stringify(d2.datos).includes('PEDRO') && Number(d2.version) === v0 + 1 && det2 && det2.de === 'PEDRO', [err, d2, det2]);
  const d1 = await uno('select version from datos_negocio where negocio_id = $1', [NEG]);
  chk('Los datos que ya estaban limpios no se tocan', Number(d1.version) === vv, [d1, vv]);
  chk('El guardado sigue quitando la clave de IA y anotando los canales de pedidos', (await rpc('guardar_datos', { p_negocio: NEG, p_datos: { iaClave: 'AIzaSyQUITAR-del-documento-12345', qrCanales: ['vitopagoscanal1'] }, p_version: vv }, dueno.token)).st === 200
    && !('iaClave' in (await uno('select datos from datos_negocio where negocio_id = $1', [NEG])).datos) && !!(await uno("select 1 x from canal_privado where canal = 'vitopagoscanal1'")));
}

(async () => {
  let sb = null;
  try { sb = await iniciar(); await pruebas(sb); }
  catch (e) { mal++; console.log('❌ Error inesperado → ' + (e && e.stack || e)); }
  finally { if (sb) await sb.cerrar().catch(() => {}); }
  console.log('RESULTADO', ok, 'bien', mal, 'mal');
  process.exit(mal ? 1 : 0);
})();
