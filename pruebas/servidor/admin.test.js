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

  // ===== Soporte con fotos y pantallazos (los sube el servidor a un almacenamiento privado) =====
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAJ0lEQVR4nGP8z8Dwn4GBgYGBiYGBgYHh/38GBgYGRgYGBgYGBgYAAP//AwBQ6Af5dN4JiAAAAABJRU5ErkJggg==', 'base64');
  const img = { base64: Buffer.concat([PNG, Buffer.alloc(80)]).toString('base64') };
  r = await api('/soporte-adjunto', { caso: casoRosa.id, clave: casoRosa.clave, imagen: img, texto: 'Así me sale el error' });
  chk('Sin cuenta, con la clave del caso: manda una foto/pantallazo', r.st === 200 && r.j.ok && r.j.caso.mensajes.slice(-1)[0].adjunto === true && r.j.caso.mensajes.slice(-1)[0].texto === 'Así me sale el error', r);
  const conImg = await uno("select id, adjunto, adjunto_tipo from soporte_mensajes where caso_id = $1 and adjunto is not null", [casoRosa.id]);
  chk('…queda en el almacenamiento PRIVADO «soporte» con una ruta que pone el servidor', /^soporte\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.png$/.test(conImg.adjunto) && conImg.adjunto_tipo === 'image/png' &&
    (await uno("select public from storage.buckets where id = 'soporte'")).public === false, conImg);
  r = await api('/soporte-adjunto', { caso: casoRosa.id, clave: 'f'.repeat(36), imagen: img });
  chk('Con una clave falsa no se puede mandar imágenes a un caso ajeno', r.st === 403, r);
  r = await api('/soporte-adjunto', { caso: casoDueno.id, imagen: img }, sinNeg.token);
  chk('…ni con otra cuenta', r.st === 403, r);
  r = await api('/soporte-adjunto', { caso: casoDueno.id, imagen: img }, dueno.token);
  chk('Con su cuenta, en su caso: sí', r.st === 200 && r.j.caso.mensajes.some(m => m.adjunto), r);
  r = await api('/soporte-adjunto', { caso: casoRosa.id, clave: casoRosa.clave, imagen: { base64: Buffer.from('<script>alert(1)</script>'.repeat(10)).toString('base64') } });
  chk('Un archivo que no es imagen se rechaza (imagen_invalida)', r.st === 400 && r.j.error === 'imagen_invalida', r);
  r = await api('/admin/soporte_imagen', { mensaje: conImg.id }, admin.token);
  chk('El administrador abre la imagen con un enlace firmado que vence', r.st === 200 && /\/object\/sign\/soporte\//.test(r.j.url) && r.j.vence_en === 600, r);
  r = await api('/admin/soporte_imagen', { mensaje: conImg.id }, dueno.token);
  chk('Un cliente NO puede pedir imágenes por el panel', r.st === 403, r);
  r = await rpc('srv_soporte_adjunto_de', { p_mensaje: conImg.id }, dueno.token);
  chk('…ni leerlas desde la base directo', r.st >= 400, r);
  r = await api('/admin/push_guardar', { sub: { endpoint: 'https://push.ejemplo.co/abc', keys: { p256dh: 'BOr5', auth: 'x1' } } }, admin.token);
  chk('El administrador guarda las notificaciones push de su equipo', r.st === 200 && (await uno("select count(*)::int n from admin_push where endpoint = 'https://push.ejemplo.co/abc'")).n === 1, r);
  r = await api('/admin/push_guardar', { sub: { endpoint: 'https://push.ejemplo.co/cliente', keys: { p256dh: 'BOr5', auth: 'x1' } } }, dueno.token);
  chk('Un cliente no puede apuntarse a los avisos del administrador', r.st === 403, r);
  r = await api('/admin/push_guardar', { sub: { endpoint: 'http://inseguro/x', keys: { p256dh: 'a', auth: 'b' } } }, admin.token);
  chk('Solo direcciones https', r.st === 400, r);
  await sb.sql('delete from admin_push');
  await rpc('soporte_escribir', { p_caso: casoRosa.id, p_clave: casoRosa.clave, p_texto: 'Sigue pasando' });
  await sb.sql('update soporte_casos set avisado_en = null where id = $1', [casoRosa.id]);
  r = await api('/soporte-avisar', { caso: casoRosa.id, clave: casoRosa.clave });
  const av1 = await uno('select avisado_en from soporte_casos where id = $1', [casoRosa.id]);
  r = await api('/soporte-avisar', { caso: casoRosa.id, clave: casoRosa.clave });
  const av2 = await uno('select avisado_en from soporte_casos where id = $1', [casoRosa.id]);
  chk('Aviso al administrador por mensaje nuevo, y como mucho uno cada 20 s por caso (no lo pueden llenar de avisos)', r.st === 200 && !!av1.avisado_en && String(av1.avisado_en) === String(av2.avisado_en), { av1, av2 });
  r = await api('/soporte-avisar', { caso: casoRosa.id, clave: 'f'.repeat(36) });
  chk('Sin la clave no se avisa nada', r.st === 200 && r.j.avisados === 0, r);

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
  // ===== Ponerle una contraseña (la escribe el administrador) =====
  r = await api('/admin/usuario_clave_poner', { usuario: dueno.id, clave: 'corta' }, admin.token);
  chk('Ponerle contraseña: mínimo 8 caracteres', r.st === 400, r);
  r = await api('/admin/usuario_clave_poner', { usuario: dueno.id, clave: 'Puesta-por-admin-1', pedir_cambio: false }, admin.token);
  const rViejaP = await entrar('dueno@bar.co', 'nueva-clave-9'), rNuevaP = await entrar('dueno@bar.co', 'Puesta-por-admin-1');
  chk('Ponerle una contraseña: la vieja deja de servir y entra con la que puso el administrador', r.st === 200 && rViejaP.st === 400 && rNuevaP.st === 200, { r, v: rViejaP.st, n: rNuevaP.st });
  chk('… sin «pedir que la cambie»: la app no le pide otra', (await rpc('perfil_yo', {}, rNuevaP.j.access_token)).j.cambiar_clave === false);
  r = await api('/admin/usuario_clave_poner', { usuario: dueno.id, clave: 'Puesta-por-admin-2' }, admin.token);
  chk('… y por defecto la app le pide poner una propia al entrar', r.st === 200 && r.j.pedir_cambio === true && (await rpc('perfil_yo', {}, (await entrar('dueno@bar.co', 'Puesta-por-admin-2')).j.access_token)).j.cambiar_clave === true, r);
  r = await api('/admin/usuario_clave_poner', { usuario: sinNeg.id, clave: 'No-soy-admin-1' }, dueno.token);
  chk('Un cliente no le puede cambiar la contraseña a nadie', r.st === 403, r);
  await api('/admin/usuario_clave_poner', { usuario: dueno.id, clave: 'nueva-clave-9', pedir_cambio: false }, admin.token);   // como estaba, para lo que sigue
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
  chk('Resumen: licencias activas (3) y soporte abierto (2: la foto reabrió el del dueño)', r.j.resumen.licencias_activas === 3 && r.j.resumen.soporte_abiertos === 2, r.j.resumen);

  // ===== Cambiar el tipo de negocio necesita permiso del administrador =====
  r = await api('/tipo-pedir', { negocio: neg, de: 'bar', de_nombre: 'Bar / Cervecería', a: 'ropa_segunda_bar', a_nombre: 'Segunda Vuelta · Ropa de segunda y tragos' }, dueno.token);
  chk('El dueño pide cambiar el tipo de negocio (queda pendiente)', r.st === 200 && r.j.solicitud.estado === 'pendiente' && r.j.solicitud.a === 'ropa_segunda_bar', r);
  const solTipo = r.j.solicitud;
  r = await api('/tipo-pedir', { negocio: neg, a: 'tienda' }, sinNeg.token);
  chk('Alguien de otro negocio no puede pedirlo', r.st === 403, r);
  r = await api('/tipo-pedir', { negocio: neg, a: '<script>' }, dueno.token);
  chk('Un tipo inválido se rechaza', r.st === 400 && r.j.error === 'tipo_invalido', r);
  r = await rpc('tipo_mi_cambio', { p_negocio: neg }, dueno.token);
  chk('La app del negocio ve su solicitud pendiente', r.st === 200 && r.j && r.j.id === solTipo.id && r.j.estado === 'pendiente', r);
  r = await rpc('tipo_mi_cambio', { p_negocio: neg }, sinNeg.token);
  chk('…otra cuenta no la ve', r.st === 200 && r.j === null, r);
  r = await api('/admin/tipos', {}, dueno.token);
  chk('Un cliente no ve las solicitudes del panel', r.st === 403, r);
  r = await api('/admin/tipos', {}, admin.token);
  chk('El administrador ve la solicitud con el negocio y el cambio', r.st === 200 && r.j.solicitudes.some(x => x.id === solTipo.id && x.negocio === 'Bar Las Palmas' && x.de === 'bar'), r.j);
  r = await api('/admin/tipo_resolver', { solicitud: solTipo.id, aprobar: true }, dueno.token);
  chk('Un cliente no se lo puede aprobar a sí mismo', r.st === 403, r);
  r = await api('/admin/tipo_resolver', { solicitud: solTipo.id, aprobar: true }, admin.token);
  chk('El administrador lo aprueba', r.st === 200 && r.j.solicitud.estado === 'aprobado', r);
  r = await api('/admin/tipo_resolver', { solicitud: solTipo.id, aprobar: false }, admin.token);
  chk('Una solicitud resuelta no se vuelve a resolver', r.st === 409 && r.j.error === 'solicitud_resuelta', r);
  r = await rpc('tipo_cambio_aplicado', { p_id: solTipo.id }, dueno.token);
  const tras = (await rpc('tipo_mi_cambio', { p_negocio: neg }, dueno.token)).j;
  chk('La app la marca como aplicada', r.st === 200 && r.j === true && tras.estado === 'aplicado', { r, tras });
  r = await api('/tipo-pedir', { negocio: neg, de: 'ropa_segunda_bar', a: 'ropa_nueva_bar', a_nombre: 'Estreno & Brindis' }, dueno.token);
  const sol2 = r.j.solicitud;
  r = await api('/admin/tipo_resolver', { solicitud: sol2.id, aprobar: false, respuesta: 'Primero termina de vender la ropa de segunda' }, admin.token);
  const rech = (await rpc('tipo_mi_cambio', { p_negocio: neg }, dueno.token)).j;
  chk('Rechazada con motivo: la app lo ve', r.st === 200 && rech.estado === 'rechazado' && /ropa de segunda/.test(rech.respuesta), rech);
  r = await rpc('srv_tipo_resolver', { p_id: sol2.id, p_aprobar: true, p_respuesta: null, p_admin: dueno.id }, dueno.token);
  chk('Nadie puede aprobar llamando la base directo', r.st >= 400, r);

  // ===== Seguridad =====
  chk('El administrador quedó AMARRADO a su cuenta la primera vez que entró (platform_admins)', (await uno('select count(*)::int n from platform_admins where user_id = $1', [admin.id])).n === 1);
  await sb.sql("insert into admin_correos(email) values ('socio.admin@vento.co') on conflict do nothing");
  let x = await signup('socio.admin@vento.co', 'clave-socio-1');
  const socio1 = x.j.user.id;
  r = await api('/admin/yo', {}, x.j.access_token);
  chk('Un correo de administrador entra la primera vez y queda amarrado a esa cuenta', r.st === 200 && (await uno('select count(*)::int n from platform_admins where user_id = $1', [socio1])).n === 1, r);
  r = await api('/admin/usuario_clave_poner', { usuario: socio1, clave: 'Cambiada-por-otro-1' }, admin.token);
  chk('Un administrador NO le cambia la contraseña a otro administrador (solo él mismo)', r.st === 403 && (await entrar('socio.admin@vento.co', 'clave-socio-1')).st === 200, r);
  await sb.sql('delete from auth.users where id = $1', [socio1]);
  x = await signup('socio.admin@vento.co', 'clave-del-atacante');
  r = await api('/admin/yo', {}, x.j.access_token);
  chk('Si alguien vuelve a crear una cuenta con ese correo (la original se borró), NO entra al panel', r.st === 403, r);
  const rest = (tabla, metodo, cuerpo, tok) => fetch(sb.url + '/rest/v1/' + tabla, { method: metodo, headers: { ...cab(tok || sb.anonKey), Prefer: 'return=representation' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined }).then(async q => ({ st: q.status, j: await q.json().catch(() => null) }));
  r = await rest('miembros', 'POST', { negocio_id: neg, usuario_id: sinNeg.id, rol: 'dueno' }, sinNeg.token);
  chk('Nadie se puede meter como dueño de un negocio ajeno escribiendo directo en la tabla', r.st >= 400 && !(await uno('select count(*)::int n from miembros where negocio_id = $1 and usuario_id = $2', [neg, sinNeg.id])).n, r);
  r = await rest('datos_negocio?negocio_id=eq.' + neg, 'PATCH', { datos: { hackeado: true } }, sinNeg.token);
  chk('…ni cambiar los datos de otro negocio', r.st >= 400 || (Array.isArray(r.j) && r.j.length === 0), r);
  r = await rest('negocios', 'GET', null, null);
  chk('Sin cuenta no se lee ningún negocio', r.st >= 400 || (Array.isArray(r.j) && r.j.length === 0), r);
  r = await rest('admin_correos', 'GET', null, dueno.token);
  chk('Nadie lee la lista de correos de administradores', r.st >= 400 || (Array.isArray(r.j) && r.j.length === 0), r);
  r = await rest('plans', 'POST', { id: 'gratis-para-mi', name: 'x', price: 0 }, dueno.token);
  chk('Nadie crea planes escribiendo directo', r.st >= 400, r);

  // ===== Equipo: empleado (vendedor, médico, barbero…), segundo administrador y ACTIVIDAD de cada persona =====
  r = await signup('emp@bar.co', 'clave123'); const emp = { id: r.j.user.id, token: r.j.access_token };
  r = await signup('admin2@bar.co', 'clave123'); const adm2 = { id: r.j.user.id, token: r.j.access_token };
  r = await rpc('crear_invitacion', { p_negocio: neg, p_rol: 'empleado' }, dueno.token);
  chk('El dueño invita a un EMPLEADO', r.st === 200 && typeof r.j === 'string', r);
  r = await rpc('unirse_con_codigo', { p_codigo: r.j, p_nombre: 'Laura' }, emp.token);
  chk('El empleado entra con el código', r.st === 200, r);
  chk('Queda con el rol empleado', (await uno('select rol from miembros where negocio_id=$1 and usuario_id=$2', [neg, emp.id])).rol === 'empleado');
  r = await rpc('crear_invitacion', { p_negocio: neg, p_rol: 'admin' }, dueno.token);
  await rpc('unirse_con_codigo', { p_codigo: r.j, p_nombre: 'Segundo admin' }, adm2.token);
  chk('El dueño nombra un segundo administrador', (await uno('select rol from miembros where negocio_id=$1 and usuario_id=$2', [neg, adm2.id])).rol === 'admin');
  r = await rpc('crear_invitacion', { p_negocio: neg, p_rol: 'admin' }, adm2.token);
  chk('El segundo administrador NO puede nombrar otro administrador', r.st >= 400, r);
  r = await rpc('crear_invitacion', { p_negocio: neg, p_rol: 'empleado' }, emp.token);
  chk('Un empleado no invita a nadie', r.st >= 400, r);
  r = await rpc('cambiar_rol', { p_negocio: neg, p_usuario: emp.id, p_rol: 'admin' }, adm2.token);
  chk('Solo el dueño cambia roles', r.st >= 400, r);
  r = await rpc('cambiar_rol', { p_negocio: neg, p_usuario: emp.id, p_rol: 'jefe' }, dueno.token);
  chk('Un rol inventado no se acepta', r.st >= 400, r);
  r = await rpc('pagos_puedo', { p_negocio: neg, p_accion: 'cobrar' }, emp.token);
  chk('El empleado puede cobrar', r.st === 200, r);
  r = await rpc('pagos_puedo', { p_negocio: neg, p_accion: 'configurar' }, emp.token);
  chk('El empleado NO configura los pagos', r.st >= 400, r);

  r = await rpc('actividad_registrar', { p_negocio: neg, p_eventos: [{ a: 'venta', d: 'Mesa 3 · 2 Cerveza', m: 12000, u: 'laura', t: Date.now() }, { a: 'venta borrada', d: 'Venta #12 de $8.000', m: -8000 }, { a: '' }, 'x'] }, emp.token);
  chk('La app del empleado manda lo que hace (lo vacío o raro no entra)', r.st === 200 && r.j === 2, r);
  r = await rpc('actividad_registrar', { p_negocio: neg, p_eventos: [{ a: 'precio cambiado', d: 'Cerveza $5.000 → $4.000' }] }, adm2.token);
  chk('Lo del segundo administrador también queda', r.st === 200 && r.j === 1, r);
  r = await rpc('actividad_registrar', { p_negocio: neg, p_eventos: [{ a: 'venta' }] }, sinNeg.token);
  chk('Alguien de afuera no puede escribir en la actividad del negocio', r.st >= 400, r);
  r = await rpc('actividad_registrar', { p_negocio: neg, p_eventos: Array.from({ length: 101 }, () => ({ a: 'x' })) }, emp.token);
  chk('Lotes de más de 100 eventos se rechazan', r.st >= 400, r);
  r = await rpc('actividad_ver', { p_negocio: neg }, dueno.token);
  const act = r.j || {};
  chk('El DUEÑO ve toda la actividad, con quién y con qué rol', r.st === 200 && act.eventos.length >= 3 &&
    act.eventos.some(e => e.accion === 'app:venta borrada' && e.email === 'emp@bar.co' && e.rol === 'empleado' && e.detalle.m === -8000) &&
    act.eventos.some(e => e.accion === 'app:precio cambiado' && e.rol === 'admin'), r);
  chk('Trae la lista de personas para filtrar', (act.personas || []).length >= 3, act.personas);
  r = await rpc('actividad_ver', { p_negocio: neg, p_usuario: emp.id }, dueno.token);
  chk('Se filtra por persona', r.st === 200 && r.j.eventos.length === 2 && r.j.eventos.every(e => e.usuario_id === emp.id), r);
  r = await rpc('actividad_ver', { p_negocio: neg }, adm2.token);
  chk('El segundo administrador NO puede ver la actividad (no puede tapar lo suyo)', r.st >= 400, r);
  r = await rpc('actividad_ver', { p_negocio: neg }, emp.token);
  chk('El empleado no ve la actividad', r.st >= 400, r);
  r = await rest('auditoria', 'GET', null, adm2.token);
  chk('Leyendo la tabla directo, el segundo administrador no ve nada', r.st >= 400 || (Array.isArray(r.j) && r.j.length === 0), r);
  r = await rest('auditoria?accion=like.app:*', 'DELETE', null, dueno.token);
  const quedan = (await uno("select count(*)::int n from auditoria where negocio_id=$1 and accion like 'app:%'", [neg])).n;
  chk('Nadie borra la actividad (ni el dueño)', quedan >= 3, { r, quedan });
  r = await rest('auditoria', 'POST', { negocio_id: neg, accion: 'app:falso' }, dueno.token);
  chk('Nadie escribe directo en la actividad', r.st >= 400, r);

  // ===== Soporte: el diagnóstico (códigos de error) va al administrador, el cliente no lo ve =====
  const diag = { version: '1.40.2', plataforma: 'apk', pagina: 'index.html', vista: 'mesas', modelo: 'Android 14; Redmi',
    errores: [{ cod: 'E-1K9Z', tipo: 'guardar', msg: 'No se pudo guardar: QuotaExceededError', donde: 'saveData', n: 3, t: Date.now() }], extra: 'x'.repeat(50) };
  r = await rpc('soporte_crear', { p: { tipo: 'error', asunto: 'No guarda', mensaje: 'Las ventas no se guardan', negocio_id: neg, diagnostico: diag } }, dueno.token);
  const casoDiag = r.j || {};
  chk('El reporte se crea con el diagnóstico, y al cliente NO le vuelve (ni códigos ni errores)', r.st === 200 && casoDiag.id && !JSON.stringify(casoDiag).includes('E-1K9Z') && !('diagnostico' in (casoDiag.caso || {})), r);
  r = await rpc('soporte_mis_casos', { p_claves: [] }, dueno.token);
  chk('En «Mis casos» del cliente tampoco aparece el diagnóstico', r.st === 200 && !JSON.stringify(r.j).includes('E-1K9Z') && !JSON.stringify(r.j).includes('diagnostico'), r);
  r = await api('/admin/soporte', { estado: 'todos' }, admin.token);
  const casoAdm = ((r.j && r.j.casos) || []).find(c => c.id === casoDiag.id) || {};
  chk('El administrador ve el diagnóstico del equipo: código, qué pasó, dónde, veces, versión y equipo', casoAdm.diagnostico && casoAdm.diagnostico.errores[0].cod === 'E-1K9Z' && casoAdm.diagnostico.errores[0].n === 3 && casoAdm.diagnostico.version === '1.40.2' && casoAdm.diagnostico.vista === 'mesas' && !('extra' in casoAdm.diagnostico), casoAdm.diagnostico);
  r = await rpc('soporte_diagnostico', { p_caso: casoDiag.id, p_clave: casoDiag.clave, p: Object.assign({}, diag, { errores: [{ cod: 'E-ZZ01', tipo: 'js', msg: 'otro', n: 1 }] }) });
  chk('Al volver a escribir, el diagnóstico se pone al día (con la clave del caso)', r.st === 200 && r.j === true && (await uno('select diagnostico from soporte_casos where id = $1', [casoDiag.id])).diagnostico.errores[0].cod === 'E-ZZ01', r);
  r = await rpc('soporte_diagnostico', { p_caso: casoDiag.id, p_clave: 'mala', p: diag });
  chk('Sin la clave (ni la cuenta) no se puede cambiar el diagnóstico de otro', r.st === 200 && r.j === false, r);
  r = await rpc('soporte_crear', { p: { tipo: 'error', asunto: 'Grande', mensaje: 'Diagnóstico enorme', equipo: 'EQ-grande-01', diagnostico: { errores: [{ msg: 'x'.repeat(20000) }] } } });
  chk('Un diagnóstico enorme no se guarda (el caso sí)', r.st === 200 && (await uno('select diagnostico from soporte_casos where id = $1', [r.j.id])).diagnostico === null, r);

  // ===== Aviso de PAGO (push) solo al dueño, al administrador y a quien cobra esa mesa =====
  r = await signup('caja2@bar.co', 'clave123'); const caja2 = { id: r.j.user.id, token: r.j.access_token };
  r = await rpc('crear_invitacion', { p_negocio: neg, p_rol: 'cajero' }, dueno.token);
  await rpc('unirse_con_codigo', { p_codigo: r.j, p_nombre: 'Otra caja' }, caja2.token);
  const disp = async (u, n) => (await uno("insert into dispositivos(negocio_id, usuario_id, nombre, token_hash, push) values ($1, $2, $3, md5(random()::text), '{\"endpoint\":\"https://push.example/x\"}'::jsonb) returning id", [neg, u, n])).id;
  const dDueno = await disp(dueno.id, 'dueño'), dAdm = await disp(adm2.id, 'admin2'), dEmp = await disp(emp.id, 'laura'), dCaja = await disp(caja2.id, 'otra caja');
  await sb.sql("insert into datos_negocio(negocio_id, datos, version) values ($1, $2::jsonb, 1) on conflict (negocio_id) do update set datos = excluded.datos",
    [neg, JSON.stringify({ tables: { '3': { items: [{ name: 'Blusa', qty: 1, price: 85000 }], atiende: { u: 'laura@boutique.co', e: 'EMP@bar.co', t: Date.now() } }, '4': { items: [] } } })]);
  const pagoMesa = (await uno("insert into pagos(negocio_id, referencia, proveedor, metodo, canal, monto, mesa, estado) values ($1, 'REF-mesa3', 'dispositivo', 'NEQUI', 'notificacion', 85000, '3', 'aprobado') returning id", [neg])).id;
  const pagoSin = (await uno("insert into pagos(negocio_id, referencia, proveedor, metodo, canal, monto, estado) values ($1, 'REF-sinmesa', 'dispositivo', 'NEQUI', 'notificacion', 12000, 'aprobado') returning id", [neg])).id;
  const dest = async pago => (await sb.sql('select id from srv_push_destinos($1, $2)', [neg, pago])).map(x => x.id).sort();
  const dM = await dest(pagoMesa), dS = await dest(pagoSin);
  chk('Pago de la mesa 3: le llega al dueño, al administrador y a quien atiende esa mesa (el empleado)', dM.includes(dDueno) && dM.includes(dAdm) && dM.includes(dEmp), dM);
  chk('…y NO a la otra caja (no está cobrando esa mesa): sin avisos repetidos', !dM.includes(dCaja), dM);
  chk('Pago sin mesa: solo dueño y administrador', dS.includes(dDueno) && dS.includes(dAdm) && !dS.includes(dEmp) && !dS.includes(dCaja), dS);
  await sb.sql("update datos_negocio set datos = jsonb_set(datos, '{tables,3,cobrando}', jsonb_build_object('u', 'otra', 'e', 'caja2@bar.co', 't', (extract(epoch from now()) * 1000)::bigint)) where negocio_id = $1", [neg]);
  chk('Si la otra caja la está cobrando ahora, también le llega a ella', (await dest(pagoMesa)).includes(dCaja));
  const pagoCobro = (await uno("insert into pagos(negocio_id, referencia, proveedor, metodo, canal, monto, estado, creado_por) values ($1, 'REF-cobro', 'nequi', 'NEQUI', 'push', 30000, 'aprobado', $2) returning id", [neg, caja2.id])).id;
  chk('Quien creó el cobro recibe su aviso', (await dest(pagoCobro)).includes(dCaja));
  r = await rpc('srv_push_destinos', { p_negocio: neg, p_pago: pagoMesa }, dueno.token);
  chk('Nadie de afuera puede pedir los destinos', r.st >= 400, r);

  // ===== La migración se puede volver a correr =====
  let errMig = null;
  try { await sb.sql(fs.readFileSync(path.join(__dirname, '..', '..', 'supabase', 'migrations', '20261015000000_admin_soporte_licencias.sql'), 'utf8')); } catch (x) { errMig = x.message; }
  for (const m of ['20261020000000_licencias_un_negocio.sql', '20261021000000_soporte_fotos_avisos.sql', '20261022000000_seguridad.sql', '20261023000000_cambio_tipo_negocio.sql', '20261024000000_equipo_actividad.sql', '20261025000000_avisos_pago_a_quien_cobra.sql', '20261026000000_soporte_diagnostico.sql'])
    try { if(!errMig) await sb.sql(fs.readFileSync(path.join(__dirname, '..', '..', 'supabase', 'migrations', m), 'utf8')); } catch (x) { errMig = m + ': ' + x.message; }
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
