// Pruebas del SERVIDOR de Vento Admin: usuarios registrados, equipos, soporte, licencias y recuperar contraseñas,
// contra PostgreSQL 16 REAL (pruebas/servidor/supabase-local.js) y la Edge Function vento-suscripciones.
// Corre solo:   node pruebas/servidor/admin.test.js
'use strict';
const fs = require('fs');
const path = require('path');
const { iniciar } = require('./supabase-local');

let ok = 0, mal = 0;
const chk = (n, c, x) => {
  if (c) { ok++; console.log('✅ ' + n); }
  else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 600) : '')); }
};
if (!process.env.VENTO_LOGS) for (const k of ['log', 'warn', 'error']) {
  const orig = console[k].bind(console);
  console[k] = (...a) => { if (typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; orig(...a); };
}
const DIA = 86400e3;
const ADMIN = 'cristhianwkh@gmail.com';

async function pruebas(sb) {
  const F = sb.url + '/functions/v1/vento-suscripciones';
  const cab = (tok) => ({ apikey: sb.anonKey, 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) });
  async function api(ruta, cuerpo, tok) {
    const r = await fetch(F + ruta, { method: 'POST', headers: cab(tok), body: JSON.stringify(cuerpo || {}) });
    return { st: r.status, j: await r.json().catch(() => ({})) };
  }
  const rpc = async (fn, args, tok) => { const r = await fetch(sb.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: cab(tok || sb.anonKey), body: JSON.stringify(args || {}) }); return { st: r.status, j: await r.json().catch(() => null) }; };
  const signup = async (email, clave) => { const r = await fetch(sb.url + '/auth/v1/signup', { method: 'POST', headers: cab(), body: JSON.stringify({ email, password: clave }) }); return { st: r.status, j: await r.json() }; };
  const entrar = async (email, clave) => { const r = await fetch(sb.url + '/auth/v1/token?grant_type=password', { method: 'POST', headers: cab(), body: JSON.stringify({ email, password: clave }) }); return { st: r.status, j: await r.json() }; };
  const uno = async (q, p) => (await sb.sql(q, p))[0];

  // ===== El administrador crea su cuenta (la contraseña la pone él; no está en el código) =====
  let r = await signup(ADMIN, 'clave-del-admin-1');
  chk('El administrador crea su cuenta con su correo', r.st === 200 && r.j.access_token, r);
  const admin = { id: r.j.user.id, token: r.j.access_token };
  r = await api('/admin/yo', {}, admin.token);
  chk('Su correo ya es administrador de Vento (sin tocar la base a mano)', r.st === 200 && r.j.admin === true && r.j.email === ADMIN, r);
  r = await rpc('es_correo_admin', { p_email: ' CristhianWKH@gmail.com ' });
  chk('La app puede saber que ese correo es de administrador (para no usarlo como cliente)', r.st === 200 && r.j === true, r);
  r = await rpc('es_correo_admin', { p_email: 'cliente@bar.co' });
  chk('Un correo normal no es de administrador', r.st === 200 && r.j === false, r);

  // ===== Clientes que se registran =====
  r = await signup('dueno@bar.co', 'clave123'); const dueno = { id: r.j.user.id, token: r.j.access_token };
  const neg = (await rpc('crear_negocio', { p_nombre: 'Bar Las Palmas', p_datos: {} }, dueno.token)).j;
  r = await signup('sin.negocio@x.co', 'clave123'); const sinNeg = { id: r.j.user.id, token: r.j.access_token };
  r = await signup('cristhianwkh+cliente@gmail.com', 'otra-clave-cliente'); const cliAdmin = { id: r.j.user.id, token: r.j.access_token };
  const negCli = (await rpc('crear_negocio', { p_nombre: 'Mi bar (prueba)', p_datos: {} }, cliAdmin.token)).j;
  chk('El administrador puede tener aparte su cuenta de cliente (otro correo, otra contraseña)', !!negCli);
  r = await api('/admin/yo', {}, cliAdmin.token);
  chk('La cuenta de cliente NO es administradora', r.st === 403 && r.j.error === 'no_admin', r);
  r = await api('/admin/usuarios', {}, dueno.token);
  chk('Un cliente no puede ver la lista de usuarios', r.st === 403, r);

  // ===== Equipos: también las cuentas sin nube =====
  r = await rpc('registrar_instalacion', { p: { equipo: 'EQ-local-0001', negocio: 'Tienda Doña Rosa', usuario: 'rosa', version: '1.34.0', plataforma: 'apk' } });
  chk('Un equipo sin cuenta en la nube avisa que existe (sin iniciar sesión)', r.st === 200 && r.j.ok, r);
  r = await rpc('registrar_instalacion', { p: { equipo: 'EQ-dueno-0001', negocio: 'Bar Las Palmas', usuario: 'dueno@bar.co', negocio_id: neg, version: '1.34.0', plataforma: 'web' } }, dueno.token);
  await rpc('registrar_instalacion', { p: { equipo: 'EQ-dueno-0002', negocio: 'Bar Las Palmas', negocio_id: neg, plataforma: 'apk' } }, dueno.token);
  await rpc('registrar_instalacion', { p: { equipo: 'EQ-dueno-0001', negocio: 'Bar Las Palmas', negocio_id: neg } }, dueno.token);
  const eq = await uno("select count(*) n, sum(veces) v, max(tipo) t from instalaciones where usuario_id = $1", [dueno.id]);
  chk('Los equipos de una cuenta quedan con su usuario (2 equipos, 3 aperturas)', eq.n === 2 && eq.v === 3 && eq.t === 'nube', eq);
  r = await rpc('registrar_instalacion', { p: { equipo: 'x' } });
  chk('Un equipo inválido se rechaza', r.st >= 400, r);
  r = await fetch(sb.url + '/rest/v1/instalaciones?select=*', { headers: cab(dueno.token) }).then(x => x.json().then(j => ({ st: x.status, j })));
  chk('Nadie puede leer la tabla de equipos directo', r.st >= 400 || (Array.isArray(r.j) && r.j.length === 0), r);

  // ===== Panel: resumen y usuarios =====
  r = await api('/admin/resumen', {}, admin.token);
  const R = r.j.resumen || {};
  chk('Resumen: cuenta TODOS los usuarios registrados (4) y negocios (2)', r.st === 200 && R.usuarios === 4 && R.negocios === 2, R);
  chk('Resumen: equipos (3) y equipos sin nube (1)', R.equipos === 3 && R.equipos_locales === 1, R);
  chk('Resumen: los registrados más recientes', Array.isArray(R.recientes) && R.recientes.some(x => x.email === 'dueno@bar.co' && x.negocio === 'Bar Las Palmas'), R.recientes);
  r = await api('/admin/usuarios', {}, admin.token);
  const us = r.j.usuarios || [];
  chk('Usuarios: aparecen todos, también el que no tiene negocio', r.st === 200 && us.length === 4 && us.some(u => u.email === 'sin.negocio@x.co' && u.negocios.length === 0), us.map(u => u.email));
  const ud = us.find(u => u.email === 'dueno@bar.co') || {};
  chk('Usuarios: con su negocio, su rol, su plan y sus equipos', ud.negocios && ud.negocios[0].nombre === 'Bar Las Palmas' && ud.negocios[0].rol === 'dueno' && ud.equipos === 2, ud);
  chk('Usuarios: el administrador sale marcado', us.find(u => u.email === ADMIN).admin === true);
  r = await api('/admin/usuarios', { buscar: 'palmas' }, admin.token);
  chk('Usuarios: buscar por el nombre del negocio', r.j.usuarios.length === 1 && r.j.usuarios[0].email === 'dueno@bar.co', r.j.usuarios);
  r = await api('/admin/usuario', { usuario: dueno.id }, admin.token);
  chk('Ficha de un usuario: lista de sus equipos', r.st === 200 && r.j.usuario.equipos_lista.length === 2 && r.j.usuario.email === 'dueno@bar.co', r.j);
  r = await api('/admin/equipos', { solo_locales: true }, admin.token);
  chk('Equipos sin cuenta en la nube (para ver a quién invitar)', r.st === 200 && r.j.equipos.length === 1 && r.j.equipos[0].negocio === 'Tienda Doña Rosa', r.j);

  // ===== Soporte =====
  r = await rpc('soporte_crear', { p: { equipo: 'EQ-local-0001', nombre: 'Rosa', telefono: '300 123 4567', email: 'rosa@x.co', negocio: 'Tienda Doña Rosa', tipo: 'clave', asunto: 'No puedo entrar', mensaje: 'Olvidé mi contraseña, ayúdenme por mensaje de texto' } });
  chk('Soporte sin cuenta: crea el caso y devuelve su clave', r.st === 200 && r.j.id && r.j.clave && r.j.caso.mensajes.length === 1, r);
  const casoRosa = r.j;
  r = await rpc('soporte_crear', { p: { asunto: 'Factura', mensaje: '¿Cómo escaneo una factura?', negocio_id: neg } }, dueno.token);
  chk('Soporte con cuenta: el caso queda con su correo y su negocio', r.st === 200 && (await uno('select email, negocio_id from soporte_casos where id = $1', [r.j.id])).negocio_id === neg, r);
  const casoDueno = r.j;
  r = await api('/admin/soporte', {}, admin.token);
  chk('El administrador ve los casos abiertos con el celular y el correo', r.st === 200 && r.j.casos.length === 2 && r.j.casos.some(c => c.telefono === '3001234567' && c.tipo === 'clave'), r.j);
  r = await api('/admin/soporte_responder', { caso: casoDueno.id, texto: 'Toca 📷 Escanear factura en Inventario.' }, admin.token);
  chk('El administrador responde (el caso queda «respondido»)', r.st === 200 && r.j.caso.estado === 'respondido' && r.j.caso.mensajes.length === 2, r);
  r = await rpc('soporte_mis_casos', { p_claves: [] }, dueno.token);
  const visto = (r.j || []).find(c => c.id === casoDueno.id) || {};
  chk('El cliente ve la respuesta en la app (con aviso de «sin leer»)', visto.mensajes && visto.mensajes[1].autor === 'admin' && visto.sin_leer === 1, r.j);
  await rpc('soporte_visto', { p_caso: casoDueno.id, p_clave: null }, dueno.token);
  r = await rpc('soporte_mis_casos', { p_claves: [] }, dueno.token);
  chk('Al abrirla ya no sale como «sin leer»', r.j.find(c => c.id === casoDueno.id).sin_leer === 0, r.j);
  r = await rpc('soporte_mis_casos', { p_claves: [{ id: casoRosa.id, clave: casoRosa.clave }] });
  chk('Sin cuenta: con la clave del caso se ve desde el mismo equipo', Array.isArray(r.j) && r.j.length === 1 && r.j[0].id === casoRosa.id, r.j);
  r = await rpc('soporte_mis_casos', { p_claves: [{ id: casoRosa.id, clave: 'mala' }] });
  chk('Con una clave falsa no se ve nada', Array.isArray(r.j) && r.j.length === 0, r.j);
  r = await rpc('soporte_escribir', { p_caso: casoDueno.id, p_clave: null, p_texto: 'Gracias' }, sinNeg.token);
  chk('Otra cuenta no puede escribir en un caso ajeno', r.st >= 400, r);
  r = await rpc('soporte_escribir', { p_caso: casoRosa.id, p_clave: casoRosa.clave, p_texto: 'Mi celular es el 3001234567' });
  chk('El cliente contesta en su caso (vuelve a «abierto»)', r.st === 200 && r.j.estado === 'abierto' && r.j.mensajes.length === 2, r);

  // ===== Recuperar contraseñas desde soporte =====
  r = await api('/admin/usuario_clave_temporal', { usuario: dueno.id }, admin.token);
  const temp = r.j.clave;
  chk('Contraseña temporal para mandarle por SMS o WhatsApp', r.st === 200 && /^Vento-[a-z]{4}[2-9]{4}$/.test(temp || ''), r);
  r = await entrar('dueno@bar.co', 'clave123');
  chk('La contraseña vieja ya no sirve', r.st === 400, r);
  r = await entrar('dueno@bar.co', temp);
  chk('Con la temporal sí entra', r.st === 200 && r.j.access_token, r);
  dueno.token = r.j.access_token;
  r = await rpc('perfil_yo', {}, dueno.token);
  chk('La app sabe que debe pedirle una contraseña nueva', r.st === 200 && r.j.cambiar_clave === true, r);
  await fetch(sb.url + '/auth/v1/user', { method: 'PUT', headers: cab(dueno.token), body: JSON.stringify({ password: 'nueva-clave-9' }) });
  r = await rpc('perfil_guardar', { p: { clave_cambiada: true, telefono: '+57 300 123 4567' } }, dueno.token);
  chk('Al cambiarla ya no la pide, y guarda el celular para recuperar la cuenta', r.st === 200 && r.j.cambiar_clave === false && r.j.telefono === '+573001234567', r);
  r = await rpc('perfil_guardar', { p: { telefono: 'abc' } }, dueno.token);
  chk('Un celular inválido se rechaza', r.st >= 400, r);
  r = await api('/admin/usuario_enlace_clave', { email: 'dueno@bar.co' }, admin.token);
  chk('Enviar el enlace para cambiar la contraseña al correo', r.st === 200 && sb.recuperaciones.some(x => x.ruta === '/recover' && x.email === 'dueno@bar.co'), r);
  r = await api('/admin/soporte', {}, admin.token);
  const cr = r.j.casos.find(c => c.id === casoRosa.id);
  chk('En el caso de soporte se ve si el correo tiene cuenta', cr && cr.cuenta_por_correo === null, cr);

  // ===== Crear la cuenta de un cliente =====
  r = await api('/admin/usuario_crear', { email: 'nuevo@cliente.co', negocio: 'Café Central', nombre: 'Ana' }, admin.token);
  chk('El administrador crea la cuenta de un cliente con su negocio', r.st === 200 && r.j.id && r.j.negocio && r.j.clave, r);
  const nuevo = r.j;
  r = await entrar('nuevo@cliente.co', nuevo.clave);
  chk('El cliente entra con la contraseña que le dieron', r.st === 200, r);
  r = await rpc('perfil_yo', {}, r.j.access_token);
  chk('…y la app le pide cambiarla', r.j && r.j.cambiar_clave === true, r);
  r = await api('/admin/usuario_crear', { email: 'nuevo@cliente.co' }, admin.token);
  chk('No deja crear dos cuentas con el mismo correo', r.st === 409, r);

  // ===== Bloquear =====
  r = await api('/admin/usuario_bloquear', { usuario: sinNeg.id }, admin.token);
  chk('Bloquear una cuenta', r.st === 200 && r.j.bloqueado === true, r);
  r = await entrar('sin.negocio@x.co', 'clave123');
  chk('Una cuenta bloqueada no puede entrar', r.st === 400, r);
  r = await api('/admin/usuario_bloquear', { usuario: sinNeg.id, bloquear: false }, admin.token);
  r = await entrar('sin.negocio@x.co', 'clave123');
  chk('Desbloquearla', r.st === 200, r);
  r = await api('/admin/usuario_bloquear', { usuario: admin.id }, admin.token);
  chk('No se puede bloquear a sí mismo', r.st === 400, r);

  // ===== Licencias =====
  r = await api('/admin/licencia_crear', { licencia: { plan: 'pro', dias: 90, correos: ['Dueno@Bar.co', 'amigo@bar.co'] } }, admin.token);
  chk('Una licencia es para UN cliente: con 2 correos → licencia_un_correo', r.st === 400 && r.j.error === 'licencia_un_correo', r);
  r = await api('/admin/licencia_crear', { licencia: { plan: 'pro', dias: 90, correos: ['Dueno@Bar.co', 'malo'], usos_max: 5, nota: 'Venta de octubre' } }, admin.token);
  const lic = r.j.licencia || {};
  chk('Crear licencia de 90 días para un correo (el inválido se descarta): ÚNICA, un solo uso aunque pidan 5', r.st === 200 && /^VENTO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(lic.codigo || '') && lic.correos.length === 1 && lic.usos_max === 1, lic);
  r = await api('/admin/licencia_crear', { licencia: { plan: 'pro', dias: 30 } }, dueno.token);
  chk('Un cliente NO puede crear licencias (solo el proveedor)', r.st === 403, r);
  r = await rpc('srv_lic_crear', { p: { plan: 'pro', dias: 30 }, p_admin: dueno.id }, dueno.token);
  chk('Tampoco llamando la base directo', r.st >= 400, r);
  r = await api('/estado', { negocio: neg }, dueno.token);
  chk('Al entrar el dueño (correo de la lista) la licencia se activa sola', r.st === 200 && r.j.licencias_activadas && r.j.licencias_activadas.length === 1 && r.j.plan_efectivo === 'pro', r.j);
  const vence = Date.parse(r.j.subscription.expiry_date);
  chk('…por 90 días', Math.abs(vence - (Date.now() + 90 * DIA)) < 2 * DIA, r.j.subscription);
  r = await api('/estado', { negocio: neg }, dueno.token);
  chk('No se activa dos veces', !r.j.licencias_activadas, r.j);
  r = await api('/licencia', { negocio: negCli, codigo: lic.codigo }, cliAdmin.token);
  chk('Con el código pero otro correo: no se puede (no se puede revender ni pasar)', r.st === 403 && r.j.error === 'licencia_otro_correo', r);
  r = await api('/admin/licencia_crear', { licencia: { plan: 'pro', para_siempre: true, usos_max: 1 } }, admin.token);
  const licVida = r.j.licencia;
  chk('Licencia para siempre, de un solo uso, por código', r.st === 200 && licVida.dias === 36500 && licVida.usos_max === 1, r.j);
  r = await api('/licencia', { negocio: negCli, codigo: licVida.codigo.toLowerCase() }, cliAdmin.token);
  chk('Activar con el código (en minúsculas también)', r.st === 200 && r.j.ok && r.j.estado.plan_efectivo === 'pro', r.j);
  const n2 = (await rpc('crear_negocio', { p_nombre: 'Otro', p_datos: {} }, sinNeg.token)).j;
  r = await api('/licencia', { negocio: n2, codigo: licVida.codigo }, sinNeg.token);
  chk('El mismo código no sirve una segunda vez (agotada)', r.st === 409 && r.j.error === 'licencia_agotada', r);
  r = await api('/licencia', { negocio: n2, codigo: 'VENTO-AAAA-BBBB-CCCC' }, sinNeg.token);
  chk('Un código que no existe: mensaje claro', r.st === 404 && /no existe/.test(r.j.mensaje), r);
  r = await api('/licencia', { negocio: neg, codigo: licVida.codigo }, sinNeg.token);
  chk('Solo el dueño o administrador del negocio puede activarla', r.st === 403, r);
  r = await api('/admin/licencia_crear', { licencia: { plan: 'pro', hasta: new Date(Date.now() + 10 * DIA).toISOString(), correos: ['sin.negocio@x.co'] } }, admin.token);
  const licFecha = r.j.licencia;
  r = await api('/estado', { negocio: n2 }, sinNeg.token);
  chk('Licencia hasta una fecha fija: se activa hasta esa fecha', r.j.plan_efectivo === 'pro' && Math.abs(Date.parse(r.j.subscription.expiry_date) - (Date.now() + 10 * DIA)) < DIA, r.j.subscription);
  r = await api('/admin/licencia_correos', { licencia: lic.id, agregar: ['tercero@bar.co'] }, admin.token);
  chk('No se le puede agregar un segundo correo (un solo cliente)', r.st === 400 && r.j.error === 'licencia_un_correo', r);
  r = await api('/admin/licencia_crear', { licencia: { plan: 'pro', dias: 30 } }, admin.token);
  const licSin = r.j.licencia;
  r = await api('/admin/licencia_correos', { licencia: licSin.id, agregar: ['tercero@bar.co'] }, admin.token);
  chk('A una sin correo sí se le puede poner el correo del cliente', r.st === 200 && r.j.licencia.correos.map(c => c.email).join() === 'tercero@bar.co', r.j);

  // ===== Un negocio por cuenta (la suscripción sirve en todos sus equipos, pero no en otro negocio) =====
  r = await rpc('crear_negocio', { p_nombre: 'Segunda sede', p_datos: {} }, dueno.token);
  chk('El dueño NO puede crear otro negocio u otra sede con la misma cuenta', r.st >= 400 && /un_negocio_por_cuenta/.test(JSON.stringify(r.j)), r);
  r = await rpc('crear_negocio', { p_nombre: 'Sede Norte', p_datos: {} }, sinNeg.token);
  chk('…tampoco otra cuenta que ya tiene su negocio', r.st >= 400 && /un_negocio_por_cuenta/.test(JSON.stringify(r.j)), r);
  r = await rpc('mi_negocio_propio', {}, dueno.token);
  chk('La app puede preguntar cuál es el negocio de la cuenta', r.st === 200 && r.j === neg, r);
  r = await rpc('pasar_negocio_a', { p_negocio: neg, p_email: 'sin.negocio@x.co' }, dueno.token);
  chk('No se puede pasar el negocio a una cuenta que ya es dueña de otro', r.st >= 400 && /un_negocio_por_cuenta/.test(JSON.stringify(r.j)), r);
  const e1 = (await api('/estado', { negocio: neg }, dueno.token)).j, e2 = (await api('/estado', { negocio: neg }, dueno.token)).j;
  chk('La licencia del negocio sirve en varios equipos a la vez (computador, tablet, celular)', e1.plan_efectivo === 'pro' && e2.plan_efectivo === 'pro', { e1: e1.subscription, e2: e2.subscription });
  r = await api('/admin/licencias', {}, admin.token);
  const l1 = (r.j.licencias || []).find(x => x.id === lic.id) || {};
  chk('Lista de licencias con quién la usó', r.st === 200 && r.j.licencias.length === 4 && l1.usos === 1 && l1.activaciones[0].negocio === 'Bar Las Palmas' && l1.correos.find(c => c.email === 'dueno@bar.co').usada, l1);
  r = await api('/admin/licencia_revocar', { licencia: licFecha.id, quitar_acceso: true }, admin.token);
  chk('Anular una licencia y quitar el acceso', r.st === 200 && r.j.licencia.estado === 'revocada', r);
  r = await api('/estado', { negocio: n2 }, sinNeg.token);
  chk('…el negocio vuelve al plan gratis', r.j.plan_efectivo === 'free', r.j);
  r = await api('/admin/usuario', { usuario: dueno.id }, admin.token);
  chk('En la ficha del usuario se ven sus licencias', r.j.usuario.licencias.length === 1 && r.j.usuario.licencias[0].codigo === lic.codigo, r.j.usuario);
  r = await api('/admin/resumen', {}, admin.token);
  chk('Resumen: licencias activas (3) y soporte abierto (1)', r.j.resumen.licencias_activas === 3 && r.j.resumen.soporte_abiertos === 1, r.j.resumen);

  // ===== La migración se puede volver a correr =====
  let errMig = null;
  try { await sb.sql(fs.readFileSync(path.join(__dirname, '..', '..', 'supabase', 'migrations', '20261015000000_admin_soporte_licencias.sql'), 'utf8')); } catch (x) { errMig = x.message; }
  try { if(!errMig) await sb.sql(fs.readFileSync(path.join(__dirname, '..', '..', 'supabase', 'migrations', '20261020000000_licencias_un_negocio.sql'), 'utf8')); } catch (x) { errMig = x.message; }
  r = await rpc('crear_negocio', { p_nombre: 'Otra más', p_datos: {} }, dueno.token);
  chk('Las migraciones se vuelven a correr sin errores ni perder datos (y la regla sigue)', !errMig && (await uno('select count(*) n from licencias')).n === 4 && r.st >= 400, errMig || r);
}

(async () => {
  let sb = null;
  try {
    sb = await iniciar();
    console.log('ℹ️ Base de prueba ' + sb.base + ' (' + sb.migraciones.length + ' archivos SQL aplicados)');
    await pruebas(sb);
  } catch (e) {
    mal++; console.log('❌ Error inesperado → ' + (e && e.stack || e));
  } finally {
    if (sb) await sb.cerrar().catch(() => {});
  }
  console.log('RESULTADO', ok, 'bien', mal, 'mal');
  process.exit(mal ? 1 : 0);
})();
