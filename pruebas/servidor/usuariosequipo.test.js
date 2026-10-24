// Pruebas del SERVIDOR: usuarios del equipo creados solo con un nombre, en todos los equipos del negocio
// (migración 20261111000000_usuarios_equipo, ORDEVA 1.60.0), contra PostgreSQL REAL.
//  • El dueño y el administrador los guardan y los leen (huella de la contraseña con su sal, nunca la contraseña).
//  • El mesero, cajero o empleado con cuenta propia NO ve las huellas ni cambia usuarios; otro negocio tampoco.
//  • Cada cambio sube la versión; quitar deja la marca «borrado» (los otros equipos también lo quitan).
//  • Nombres con @ (cuentas con correo) no se guardan aquí. La tabla no se lee directo.
// Corre solo:   node pruebas/servidor/usuariosequipo.test.js
'use strict';
const fs = require('fs'), path = require('path');
const { iniciar } = require('./supabase-local');
let ok = 0, mal = 0;
const chk = (n, c, x) => { if (c) { ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
if (!process.env.VENTO_LOGS) for (const k of ['log', 'warn', 'error']) { const o = console[k].bind(console); console[k] = (...a) => { if (typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; o(...a); }; }

async function pruebas(sb) {
  const cab = (tok) => ({ apikey: sb.anonKey, 'Content-Type': 'application/json', Authorization: 'Bearer ' + (tok || sb.anonKey) });
  const rpc = async (fn, args, tok) => { const r = await fetch(sb.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: cab(tok), body: JSON.stringify(args || {}) }); return { st: r.status, j: await r.json().catch(() => null) }; };

  const dueno = await sb.usuario('dueno@equipo.co');
  const NEG = (await rpc('crear_negocio', { p_nombre: 'Bar Equipo', p_datos: {} }, dueno.token)).j;
  const unir = async (email, rol) => {
    const u = await sb.usuario(email);
    const cod = (await rpc('crear_invitacion', { p_negocio: NEG, p_rol: rol }, dueno.token)).j;
    await rpc('unirse_con_codigo', { p_codigo: cod, p_nombre: rol }, u.token);
    return u;
  };
  const admin = await unir('admin@equipo.co', 'admin');
  const mesero = await unir('mesero@equipo.co', 'mesero');
  const cajero = await unir('caja@equipo.co', 'cajero');
  const otro = await sb.usuario('otro@negocio.co');
  await rpc('crear_negocio', { p_nombre: 'Otro bar', p_datos: {} }, otro.token);

  const guardar = (tok, u, extra) => rpc('usuarios_equipo_guardar', Object.assign({ p_negocio: NEG, p_usuario: u, p_salt: 'sal123', p_hash: 'p2:' + 'a'.repeat(64), p_rol: 'staff', p_borrado: false }, extra || {}), tok);
  const lista = async (tok) => rpc('usuarios_equipo_lista', { p_negocio: NEG }, tok);

  let r = await guardar(dueno.token, 'Juan');
  chk('El dueño guarda a «juan» (el nombre queda en minúsculas, versión 1)', r.st === 200 && r.j === 1, r);
  r = await lista(dueno.token);
  const j1 = r.j && r.j.find((x) => x.usuario === 'juan');
  chk('…y lo lee con la huella, la sal y el rol', r.st === 200 && j1 && j1.hash === 'p2:' + 'a'.repeat(64) && j1.salt === 'sal123' && j1.rol === 'staff' && j1.borrado === false, r);
  r = await guardar(admin.token, 'juan', { p_hash: 'p2:' + 'b'.repeat(64), p_rol: 'cajero' });
  chk('El administrador le cambia la contraseña y el rol: versión 2', r.st === 200 && r.j === 2, r);
  chk('…y el dueño ve el cambio', (await lista(dueno.token)).j.find((x) => x.usuario === 'juan').hash === 'p2:' + 'b'.repeat(64));
  r = await lista(mesero.token);
  chk('Un mesero con cuenta propia NO ve los usuarios ni sus huellas', r.st >= 400, r);
  r = await lista(cajero.token);
  chk('Un cajero tampoco', r.st >= 400, r);
  r = await guardar(mesero.token, 'juan', { p_rol: 'admin' });
  chk('Un mesero no se puede volver administrador ni cambiar contraseñas', r.st >= 400 && (await lista(dueno.token)).j.find((x) => x.usuario === 'juan').rol === 'cajero', r);
  r = await rpc('usuarios_equipo_lista', { p_negocio: NEG }, otro.token);
  chk('El dueño de OTRO negocio no los ve', r.st >= 400, r);
  r = await guardar(otro.token, 'pedro');
  chk('…ni los cambia', r.st >= 400, r);
  r = await rpc('usuarios_equipo_lista', { p_negocio: NEG });
  chk('Sin cuenta, nada', r.st >= 400, r);
  r = await fetch(sb.url + '/rest/v1/usuarios_equipo?select=*', { headers: cab(dueno.token) });
  const directo = await r.json().catch(() => null);
  chk('La tabla no se lee directo (ni siquiera el dueño)', r.status >= 400 || (Array.isArray(directo) && !directo.length), { st: r.status, directo });
  r = await guardar(dueno.token, 'ana@correo.co');
  chk('Una cuenta con correo no se guarda aquí', r.st >= 400, r);
  r = await guardar(dueno.token, 'maria', { p_hash: '' });
  chk('Sin huella no se guarda', r.st >= 400, r);
  r = await guardar(dueno.token, 'maria', { p_rol: 'dueno' });
  chk('Un rol que no existe no se guarda', r.st >= 400, r);
  r = await guardar(dueno.token, 'juan', { p_borrado: true, p_salt: null, p_hash: null, p_rol: null });
  const jb = (await lista(dueno.token)).j.find((x) => x.usuario === 'juan');
  chk('Quitar a «juan»: queda la marca «borrado» sin su huella (versión 3)', r.st === 200 && r.j === 3 && jb.borrado === true && jb.hash === null, { r, jb });
  r = await guardar(dueno.token, 'juan', { p_hash: 'p2:' + 'c'.repeat(64) });
  chk('Se puede volver a crear (versión 4)', r.st === 200 && r.j === 4 && (await lista(dueno.token)).j.find((x) => x.usuario === 'juan').borrado === false, r);

  let err = null;
  try { await sb.sql(fs.readFileSync(path.join(__dirname, '..', '..', 'supabase', 'migrations', '20261111000000_usuarios_equipo.sql'), 'utf8')); } catch (e) { err = e.message; }
  chk('La migración se vuelve a correr sin errores', !err, err);
  chk('…sin perder los usuarios', (await lista(dueno.token)).j.some((x) => x.usuario === 'juan' && x.version === 4));
}

(async () => {
  let sb = null;
  try { sb = await iniciar(); await pruebas(sb); }
  catch (e) { mal++; console.log('❌ Error inesperado → ' + (e && e.stack || e)); }
  finally { if (sb) await sb.cerrar().catch(() => {}); }
  console.log('RESULTADO', ok, 'bien', mal, 'mal');
  process.exit(mal ? 1 : 0);
})();
