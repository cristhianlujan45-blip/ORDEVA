// Pruebas del SERVIDOR · ORDEVA 1.96 (migración 20261202000000_canales_del_negocio), contra PostgreSQL REAL.
//  S1 · Los canales del negocio (c+e estados, c+k carta, c+f fotos y QR de pago, c+a ambiente) solo los escribe el negocio:
//       • durante la gracia (72 h) se escribe como antes; cerrado, un desconocido no escribe y sus mensajes viejos no se leen;
//       • un miembro sí escribe (con su sesión), y el cliente sigue leyendo la carta y el QR de pago;
//       • el canal de pedidos (c) sigue abierto para el cliente del QR;
//       • un negocio que registra el derivado de otro (c+'f') no se lo apropia ni lo abre; tampoco por la ruta abierta del
//         servidor de pagos (/vento-pagos/canal/…), que no tiene la sesión de un miembro;
//       • un canal que no es de ningún negocio sigue abierto; correr la migración otra vez no mueve la fecha.
//  S10 · pagos_estado: el código de Nequi, la terminal de DaviPlata y la llave de Wompi solo los ven dueño y administrador.
//  S6  · Bonos: crear y ver la lista solo dueño, administrador o cajero; devolver, esos roles o quien redimió.
// Corre solo:   node pruebas/servidor/canalescritura.test.js
'use strict';
const fs = require('fs'), path = require('path');
const { iniciar } = require('./supabase-local');
let ok = 0, mal = 0;
const chk = (n, c, x) => { if (c) { ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
if (!process.env.VENTO_LOGS) for (const k of ['log', 'warn', 'error']) { const o = console[k].bind(console); console[k] = (...a) => { if (typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; o(...a); }; }

const C = 'vitobar196canal', OTRO = 'vitootro196canal';

async function pruebas(sb) {
  const cab = (tok) => ({ apikey: sb.anonKey, 'Content-Type': 'application/json', Authorization: 'Bearer ' + (tok || sb.anonKey) });
  const rpc = async (fn, args, tok) => { const r = await fetch(sb.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: cab(tok), body: JSON.stringify(args || {}) }); return { st: r.status, j: await r.json().catch(() => null) }; };
  const pub = (canal, txt, tok) => rpc('canal_publicar', { p_canal: canal, p_cuerpo: txt }, tok);
  const leer = async (canales, tok) => { const r = await rpc('canal_leer', { p_canales: canales, p_desde: Math.floor(Date.now() / 1000) - 3600 }, tok); return r.st === 200 ? r.j.map((m) => m.topic + ':' + m.message) : r; };
  const uno = async (q, p) => (await sb.sql(q, p))[0];

  const dueno = await sb.usuario('dueno@bar196.co');
  const NEG = (await rpc('crear_negocio', { p_nombre: 'Bar 196', p_datos: {} }, dueno.token)).j;
  const unir = async (email, rol) => { const u = await sb.usuario(email); const cod = (await rpc('crear_invitacion', { p_negocio: NEG, p_rol: rol }, dueno.token)).j; await rpc('unirse_con_codigo', { p_codigo: cod, p_nombre: rol }, u.token); return u; };
  const admin = await unir('admin@bar196.co', 'admin'), cajero = await unir('caja@bar196.co', 'cajero'), mesero = await unir('mesero@bar196.co', 'mesero'), empleado = await unir('empleado@bar196.co', 'empleado');
  await rpc('guardar_datos', { p_negocio: NEG, p_datos: { businessName: 'Bar 196', qrCanales: [C] }, p_version: 1 }, dueno.token);
  // Otro negocio (un atacante que vio el QR) intenta registrar como «suyo» el canal del QR de pago del bar.
  const malo = await sb.usuario('malo@otro196.co');
  const NEG2 = (await rpc('crear_negocio', { p_nombre: 'Otro', p_datos: {} }, malo.token)).j;
  await rpc('guardar_datos', { p_negocio: NEG2, p_datos: { businessName: 'Otro', qrCanales: [OTRO, C + 'f', C + 'k'] }, p_version: 1 }, malo.token);
  const reg = (await sb.sql('select canal, negocio_id from canal_privado order by canal')).map((r) => r.canal + ':' + (r.negocio_id === NEG ? 'bar' : 'otro'));
  chk('Otro negocio no puede registrar como suyo el canal de la carta ni del QR de pago del bar (c+k, c+f)', reg.join() === [C + ':bar', OTRO + ':otro'].sort().join(), reg);

  // ---------- Gracia: se escribe como antes ----------
  let g = await uno("select (valor->>'t')::timestamptz - now() > interval '71 hours' x from servidor_config where clave = 'canal_escribir_desde'");
  chk('La gracia es de 72 horas', g && g.x === true, g);
  let r = await pub(C + 'f', '{"n":"__qrpago__","l":"@falsa"}');
  chk('Durante la gracia, un desconocido todavía escribe (los celulares del bar con la versión anterior no se quedan sin carta)', r.st === 200, r);
  r = await pub(C + 'f', '{"n":"__qrpago__","l":"@bar196"}', dueno.token);
  chk('El dueño (con su sesión) publica el QR de pago', r.st === 200, r);
  let marcas = await sb.sql("select cuerpo, firmado from canal_mensajes where canal = $1 order by id", [C + 'f']);
  chk('El mensaje del dueño queda «firmado» y el del desconocido no', marcas.length === 2 && marcas[0].firmado === false && marcas[1].firmado === true, marcas);

  // ---------- Cerrado ----------
  await sb.sql("update servidor_config set valor = jsonb_build_object('t', now() - interval '1 minute') where clave = 'canal_escribir_desde'");
  for (const s of ['e', 'k', 'f', 'a']) {
    r = await pub(C + s, '{"falso":1}');
    chk('Cerrado: un desconocido NO escribe en c+' + s + ' (error de permiso, 401/403)', (r.st === 401 || r.st === 403) && /sin_permiso/.test(JSON.stringify(r.j)), r);
  }
  for (const [u, n] of [[dueno, 'dueño'], [mesero, 'mesero'], [empleado, 'empleado']]) {
    r = await pub(C + 'e', '{"t":"estado","id":"p1","e":"listo"}', u.token);
    chk('Cerrado: un miembro (' + n + ') sí escribe los estados', r.st === 200, r);
  }
  r = await pub(C + 'k', '{"carta":1}', malo.token);
  chk('Cerrado: un usuario de OTRO negocio no escribe en la carta del bar', r.st === 401 || r.st === 403, r);
  let l = await leer([C + 'f'], null);
  chk('El cliente lee el QR de pago del dueño, y el falso de antes ya NO aparece', Array.isArray(l) && l.length === 1 && l[0].includes('@bar196') && !JSON.stringify(l).includes('@falsa'), l);
  r = await pub(C, '{"t":"pedido","id":"p9","mesa":3}');
  chk('El canal de pedidos (c) sigue abierto para el cliente del QR', r.st === 200, r);
  r = await pub('vitocanalsinnegocio9', 'hola');
  chk('Un canal que no es de ningún negocio sigue abierto', r.st === 200, r);
  r = await pub('vitocanalsinnegociof', 'hola');
  chk('… aunque termine en f (no hay un canal de pedidos «vitocanalsinnegocio»)', r.st === 200, r);
  const ruta = await fetch(sb.url + '/functions/v1/vento-pagos/canal/' + C + 'f', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{"n":"__qrpago__","l":"@ruta"}' });
  chk('La ruta abierta del servidor de pagos (/vento-pagos/canal/…) tampoco escribe en el QR de pago del bar', !ruta.ok && !(await leer([C + 'f'], null)).join().includes('@ruta'), ruta.status);
  const ch = await sb.sql('select * from canal_choques()');
  chk('canal_choques() no muestra choques (el registro malo nunca entró)', ch.length === 0, ch);

  let err = null;
  try { await sb.sql(fs.readFileSync(path.join(__dirname, '..', '..', 'supabase', 'migrations', '20261202000000_canales_del_negocio.sql'), 'utf8')); } catch (e) { err = e.message; }
  g = await uno("select (valor->>'t')::timestamptz < now() x from servidor_config where clave = 'canal_escribir_desde'");
  chk('La migración se vuelve a correr sin errores y sin mover la fecha de cierre', !err && g.x === true, [err, g]);

  // ---------- S10 · pagos_estado ----------
  await sb.sql(`insert into pago_proveedores(negocio_id, proveedor, ambiente, estado, publico) values
    ($1, 'nequi', 'produccion', 'conectado', '{"codigo":"NQ-123456"}'),
    ($1, 'daviplata', 'produccion', 'conectado', '{"terminal":"T-99","comercio":"•••1234"}'),
    ($1, 'wompi', 'produccion', 'conectado', '{"llave_publica":"pub_prod_xyz","comercio_id":"77","metodos":["NEQUI","CARD"]}')`, [NEG]);
  const est = async (u) => { const x = await rpc('pagos_estado', { p_negocio: NEG }, u.token); return x.j && x.j.proveedores ? Object.fromEntries(x.j.proveedores.map((p) => [p.proveedor, p])) : x; };
  for (const [u, n] of [[dueno, 'dueño'], [admin, 'administrador']]) {
    const e = await est(u);
    chk('S10 · ' + n + ': ve el código de Nequi, la terminal de DaviPlata y la llave de Wompi', e.nequi.publico.codigo === 'NQ-123456' && e.daviplata.publico.terminal === 'T-99' && e.wompi.publico.llave_publica === 'pub_prod_xyz', e);
  }
  for (const [u, n] of [[cajero, 'cajero'], [mesero, 'mesero'], [empleado, 'empleado']]) {
    const e = await est(u), txt = JSON.stringify(e);
    chk('S10 · ' + n + ': NO ve el código de Nequi ni la terminal ni la llave, pero sí que están conectados y los métodos de Wompi', !/NQ-123456|T-99|pub_prod_xyz|•••1234|"77"/.test(txt) && e.nequi.estado === 'conectado' && JSON.stringify(e.wompi.publico) === '{"metodos":["NEQUI","CARD"]}', e);
  }
  const cfg = await fetch(sb.url + '/functions/v1/vento-pagos/config', { method: 'POST', headers: cab(mesero.token), body: JSON.stringify({ negocio: NEG, accion: 'estado' }) }).then((x) => x.json()).catch(() => null);
  chk('S10 · por /vento-pagos/config el mesero sigue viendo Nequi «conectado» (el botón «Cobrar cuenta») sin el código', cfg && cfg.resumen && cfg.resumen.nequi && cfg.resumen.nequi.estado === 'conectado' && !JSON.stringify(cfg).includes('NQ-123456'), cfg);

  // ---------- S6 · Bonos ----------
  for (const [u, n, puede] of [[dueno, 'dueño', true], [admin, 'administrador', true], [cajero, 'cajero', true], [mesero, 'mesero', false], [empleado, 'empleado', false]]) {
    r = await rpc('bono_crear', { p_negocio: NEG, p_valor: 50000, p_cliente: n, p_meses: 0 }, u.token);
    chk('S6 · ' + n + (puede ? ' crea bonos' : ' NO crea bonos'), puede ? (r.st === 200 && r.j && r.j.codigo) : (r.st !== 200 && /sin_permiso/.test(JSON.stringify(r.j))), r);
  }
  const lmes = await rpc('bono_lista', { p_negocio: NEG }, mesero.token), lcaj = await rpc('bono_lista', { p_negocio: NEG }, cajero.token);
  chk('S6 · el mesero no ve la lista de bonos con sus códigos; el cajero sí', lmes.j === null && Array.isArray(lcaj.j) && lcaj.j.length === 3, [lmes.j, (lcaj.j || []).length]);
  const cod = lcaj.j[0].codigo;
  r = await rpc('bono_redimir', { p_negocio: NEG, p_codigo: cod, p_monto: 10000, p_ref: 'ref-mesero-1' }, mesero.token);
  chk('S6 · el mesero sí cobra con un bono', r.st === 200 && r.j && r.j.ok, r);
  r = await rpc('bono_devolver', { p_negocio: NEG, p_ref: 'ref-mesero-1' }, empleado.token);
  chk('S6 · otro empleado NO puede devolver el saldo de una redención que no hizo', r.st !== 200 && /sin_permiso/.test(JSON.stringify(r.j)), r);
  r = await rpc('bono_devolver', { p_negocio: NEG, p_ref: 'ref-mesero-1' }, mesero.token);
  chk('S6 · quien la hizo sí la devuelve (la devolución de la 1.95.4 sigue funcionando)', r.st === 200 && r.j && r.j.devueltos === 1, r);
  r = await rpc('bono_devolver', { p_negocio: NEG, p_ref: 'ref-que-no-existe' }, mesero.token);
  chk('S6 · devolver una referencia sin redención no hace nada ni da error', r.st === 200 && r.j && r.j.devueltos === 0, r);
}

(async () => {
  let sb = null;
  try { sb = await iniciar(); await pruebas(sb); }
  catch (e) { mal++; console.log('❌ Error inesperado → ' + (e && e.stack || e)); }
  finally { if (sb) await sb.cerrar().catch(() => {}); }
  console.log('RESULTADO', ok, 'bien', mal, 'mal');
  process.exit(mal ? 1 : 0);
})();
