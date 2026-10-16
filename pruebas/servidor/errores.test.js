// Pruebas del SERVIDOR: errores de los equipos → Vento Admin (🐞 Errores) y 💜 Frases de pago, contra PostgreSQL 16 REAL
// (pruebas/servidor/supabase-local.js) y la Edge Function vento-suscripciones.
// Corre solo:   node pruebas/servidor/errores.test.js
'use strict';
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

async function pruebas(sb) {
  const F = sb.url + '/functions/v1/vento-suscripciones';
  const cab = (tok) => ({ apikey: sb.anonKey, 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) });
  const api = async (ruta, cuerpo, tok) => { const r = await fetch(F + ruta, { method: 'POST', headers: cab(tok), body: JSON.stringify(cuerpo || {}) }); return { st: r.status, j: await r.json().catch(() => ({})) }; };
  const rpc = async (fn, args, tok) => { const r = await fetch(sb.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: cab(tok || sb.anonKey), body: JSON.stringify(args || {}) }); return { st: r.status, j: await r.json().catch(() => null) }; };
  const signup = async (email, clave) => { const r = await fetch(sb.url + '/auth/v1/signup', { method: 'POST', headers: cab(), body: JSON.stringify({ email, password: clave }) }); return r.json(); };
  const uno = async (q, p) => (await sb.sql(q, p))[0];
  const reportar = (p, tok) => rpc('reportar_error', { p }, tok);

  const admin = await signup('cristhianwkh@gmail.com', 'clave-del-admin-1');
  const dueno = await signup('dueno@bar.co', 'clave123');

  // ===== Un equipo reporta (sin cuenta) =====
  let r = await reportar({ equipo: 'EQ-bar-000001', tipo: 'musica', huella: 'musica|no-arranca', mensaje: 'Hay canciones listas pero el reproductor no arranca', detalle: { listas: 3 }, negocio: 'Bar Las Palmas', usuario: 'ana', version: '1.37.0', plataforma: 'apk', pagina: 'index' });
  chk('Un equipo sin cuenta reporta un error', r.st === 200 && r.j && r.j.ok === true, r);
  await reportar({ equipo: 'EQ-bar-000001', tipo: 'musica', huella: 'musica|no-arranca', mensaje: 'Hay canciones listas pero el reproductor no arranca', veces: 4, version: '1.37.0' });
  let f = await uno("select count(*)::int n, sum(veces)::int v from app_errores where huella = 'musica|no-arranca'");
  chk('El mismo error del mismo equipo se agrupa (1 fila, 5 veces)', f.n === 1 && f.v === 5, f);
  await reportar({ equipo: 'EQ-bar-000002', tipo: 'musica', huella: 'musica|no-arranca', mensaje: 'Hay canciones listas pero el reproductor no arranca', negocio: 'Café Central', version: '1.37.0' });
  r = await reportar({ equipo: 'cli-qr-telefono1', tipo: 'pedido', huella: 'pedido|sin-confirmar', mensaje: 'El local no confirmó un pedido del QR en 3 minutos', detalle: { mesa: '4' }, pagina: 'pedido' });
  chk('El celular de un cliente (página del QR) también reporta', r.st === 200 && r.j.ok, r);

  // ===== Datos inválidos o de más: se ignoran sin romper =====
  r = await reportar({ equipo: 'x', tipo: 'js', mensaje: 'algo' });
  chk('Un equipo con identificador inválido no guarda nada (y no da error)', r.st === 200 && r.j.ok === false && !(await uno("select 1 x from app_errores where equipo = 'x'")), r);
  r = await reportar({ equipo: 'EQ-bar-000003', tipo: 'inventado', mensaje: 'Algo raro', detalle: { grande: 'x'.repeat(6000) } });
  f = await uno("select tipo, detalle from app_errores where equipo = 'EQ-bar-000003'");
  chk('Tipo desconocido → «otro» y el detalle gigante se recorta', r.j.ok && f.tipo === 'otro' && f.detalle.recortado === true, f);
  r = await reportar({ equipo: 'EQ-bar-000003', tipo: 'js', mensaje: 'y'.repeat(900) });
  f = await uno("select char_length(mensaje) n from app_errores where equipo = 'EQ-bar-000003' and tipo = 'js'");
  chk('El mensaje se corta a 500 letras', f && f.n === 500, f);

  // ===== Límite por equipo: 60 errores distintos por hora =====
  for (let i = 0; i < 70; i++) await reportar({ equipo: 'EQ-ruidoso-01', tipo: 'js', huella: 'js|ruido-' + i, mensaje: 'Error ' + i });
  f = await uno("select count(*)::int n from app_errores where equipo = 'EQ-ruidoso-01'");
  chk('Un equipo no puede llenar la base (máx. 60 errores distintos por hora)', f.n === 60, f);
  r = await reportar({ equipo: 'EQ-ruidoso-01', tipo: 'js', huella: 'js|ruido-3', mensaje: 'Error 3' });
  f = await uno("select veces from app_errores where equipo = 'EQ-ruidoso-01' and huella = 'js|ruido-3'");
  chk('… pero los que ya tiene siguen sumando veces', r.j.ok && f.veces === 2, f);

  // ===== Nadie lee la tabla directo =====
  r = await fetch(sb.url + '/rest/v1/app_errores?select=*', { headers: cab(sb.anonKey) }).then(async x => ({ st: x.status, j: await x.json().catch(() => null) }));
  chk('Sin cuenta no se pueden leer los errores', r.st >= 400 || (Array.isArray(r.j) && !r.j.length), r);
  r = await rpc('srv_admin_errores', {}, dueno.access_token);
  chk('Un cliente no puede llamar las funciones del administrador', r.st >= 400, r);
  r = await api('/admin/errores', {}, dueno.access_token);
  chk('Un cliente no puede ver 🐞 Errores en Vento Admin', r.st === 403, r);

  // ===== Vento Admin =====
  r = await api('/admin/errores', {}, admin.access_token);
  const e = (r.j.errores || []).find(x => x.huella === 'musica|no-arranca');
  chk('El administrador ve los errores agrupados', r.st === 200 && !!e, r);
  chk('… con cuántas veces, en cuántos equipos y negocios', e && e.veces === 6 && e.equipos === 2 && e.negocios === 2 && e.tipo === 'musica' && e.version === '1.37.0', e);
  chk('… y dónde pasó (negocio, usuario, plataforma y detalle)', e && e.casos.some(c => c.negocio === 'Bar Las Palmas' && c.usuario === 'ana' && c.plataforma === 'apk' && c.detalle && c.detalle.listas === 3), e && e.casos);
  r = await api('/admin/errores_abiertos', {}, admin.access_token);
  const abiertos = r.j.abiertos;
  chk('Cuenta de errores sin resolver (para el globito de la pestaña)', r.st === 200 && abiertos >= 4, r);
  r = await api('/admin/error_resolver', { huella: 'musica|no-arranca' }, admin.access_token);
  chk('«✅ Ya lo arreglé» marca resuelto en todos los equipos', r.st === 200 && r.j.r.filas === 2, r);
  r = await api('/admin/errores', {}, admin.access_token);
  chk('Ya no sale entre los sin resolver', !(r.j.errores || []).some(x => x.huella === 'musica|no-arranca'));
  r = await api('/admin/errores', { estado: 'todos' }, admin.access_token);
  chk('… pero sí en «Todos», como resuelto', (r.j.errores || []).some(x => x.huella === 'musica|no-arranca' && x.resuelto === true));
  await reportar({ equipo: 'EQ-bar-000001', tipo: 'musica', huella: 'musica|no-arranca', mensaje: 'Hay canciones listas pero el reproductor no arranca', version: '1.37.1' });
  r = await api('/admin/errores', {}, admin.access_token);
  const otra = (r.j.errores || []).find(x => x.huella === 'musica|no-arranca');
  chk('Si vuelve a pasar después de arreglarlo, aparece otra vez (contando desde cero, con la versión nueva)', otra && otra.veces === 1 && otra.version === '1.37.1' && otra.equipos === 1, otra);
  r = await api('/admin/error_resolver', { huella: 'pedido|sin-confirmar' }, admin.access_token);
  r = await api('/admin/error_resolver', { huella: 'pedido|sin-confirmar', resuelto: false }, admin.access_token);
  r = await api('/admin/errores', {}, admin.access_token);
  chk('«↩️ Volver a abrir» lo devuelve a los sin resolver', (r.j.errores || []).some(x => x.huella === 'pedido|sin-confirmar' && !x.resuelto));

  // ===== 💜 Frases de pago: el administrador las maneja y le llegan a la app de todos =====
  r = await rpc('frases_pago_lista', {});
  chk('Frases de pago: sin frases, la app recibe una lista vacía', r.st === 200 && Array.isArray(r.j.l) && !r.j.l.length && r.j.v === 0, r);
  r = await api('/admin/frase_pago_guardar', { frase: { texto: 'Abono a tu   DaviPlata', tipo: 'pago', banco: 'DaviPlata' } }, admin.access_token);
  chk('El administrador agrega «Abono a tu DaviPlata» = es un pago', r.st === 200 && r.j.frase && r.j.frase.texto === 'Abono a tu DaviPlata' && r.j.frase.tipo === 'pago', r);
  await api('/admin/frase_pago_guardar', { frase: { texto: 'Tu saldo es', tipo: 'ignorar' } }, admin.access_token);
  r = await api('/admin/frase_pago_guardar', { frase: { texto: 'abono a tu daviplata', tipo: 'pago', banco: 'DaviPlata' } }, admin.access_token);
  f = await uno('select count(*)::int n from frases_pago');
  chk('La misma frase (aunque cambien mayúsculas) no se repite', r.st === 200 && f.n === 2, f);
  r = await rpc('frases_pago_lista', {});
  chk('Cualquier equipo (sin cuenta) recibe las frases al instante, con su marca de actualización', r.st === 200 && r.j.l.length === 2 && r.j.l.some(x => x.t === 'Abono a tu DaviPlata' && x.tipo === 'pago' && x.banco === 'DaviPlata') && r.j.l.some(x => x.t === 'Tu saldo es' && x.tipo === 'ignorar') && r.j.v > 0, r);
  r = await api('/admin/frase_pago_guardar', { frase: { texto: 'ab' } }, admin.access_token);
  chk('Una frase de menos de 3 letras no se guarda (con su mensaje)', r.st === 400 && /3 y 120/.test(JSON.stringify(r.j)), r);
  r = await api('/admin/frase_pago_guardar', { frase: { texto: 'Te regalamos plata', tipo: 'pago' } }, dueno.access_token);
  chk('Un cliente no puede agregar frases', r.st === 403, r);
  r = await rpc('srv_admin_frase_pago_guardar', { p: { texto: 'Te regalamos plata' } }, dueno.access_token);
  chk('… ni llamando la función directo', r.st >= 400, r);
  r = await fetch(sb.url + '/rest/v1/frases_pago', { method: 'POST', headers: { ...cab(dueno.access_token), Prefer: 'return=representation' }, body: JSON.stringify({ texto: 'Te regalamos plata' }) }).then(async x => ({ st: x.status, j: await x.json().catch(() => null) }));
  chk('… ni escribiendo en la tabla', r.st >= 400 && !(await uno("select 1 x from frases_pago where texto = 'Te regalamos plata'")), r);
  r = await api('/admin/frases_pago', {}, admin.access_token);
  const saldo = (r.j.frases || []).find(x => x.texto === 'Tu saldo es');
  chk('El administrador ve todas las frases', r.st === 200 && r.j.frases.length === 2 && !!saldo, r);
  r = await api('/admin/frase_pago_borrar', { id: saldo.id }, admin.access_token);
  r = await rpc('frases_pago_lista', {});
  chk('Al borrarla, deja de llegarle a la app', r.j.l.length === 1 && !r.j.l.some(x => x.t === 'Tu saldo es'), r);
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
