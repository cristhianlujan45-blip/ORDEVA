// Pruebas del SERVIDOR: 🔗 calendario con Booking / Airbnb (migración 20261126000000_reservas_ical y Edge Function
// vento-ical, ORDEVA 1.76.0), contra PostgreSQL REAL. Un «Booking» de mentira sirve un .ics en este mismo equipo.
//  • Exportar: el .ics de una habitación trae solo las fechas ocupadas (sin nombre ni celular del cliente).
//  • Leer: solo plataformas permitidas y con sesión de ORDEVA (no sirve para leer cualquier página).
//  • Importar: las reservas de afuera bloquean la habitación; las que se cancelan allá se cancelan aquí; si chocan con una
//    reserva de ORDEVA NO se guardan y vuelven como «choque». Otro negocio no puede importar aquí.
'use strict';
const http = require('http');
const { iniciar } = require('./supabase-local');
let ok = 0, mal = 0;
const chk = (n, c, x) => { if (c) { ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
if (!process.env.VENTO_LOGS) for (const k of ['log', 'warn', 'error']) { const o = console[k].bind(console); console[k] = (...a) => { if (typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; o(...a); }; }

const ymd = (d) => d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
const enDias = (n) => { const x = new Date(); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() + n); return x; };
let ICS = '';
const booking = http.createServer((req, res) => { if (req.url.startsWith('/ical/')) { res.writeHead(200, { 'Content-Type': 'text/calendar' }); res.end(ICS); } else { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<html>hola</html>'); } });

async function pruebas(sb, puerto) {
  const cab = (tok) => ({ apikey: sb.anonKey, 'Content-Type': 'application/json', Authorization: 'Bearer ' + (tok || sb.anonKey) });
  const rpc = async (fn, args, tok) => { const r = await fetch(sb.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: cab(tok), body: JSON.stringify(args || {}) }); return { st: r.status, j: await r.json().catch(() => null) }; };
  const dueno = await sb.usuario('dueno@palmas.co');
  const NEG = (await rpc('crear_negocio', { p_nombre: 'Hotel Palmas', p_datos: {} }, dueno.token)).j;
  const otro = await sb.usuario('otro@x.co');
  const NEG2 = (await rpc('crear_negocio', { p_nombre: 'Otro', p_datos: {} }, otro.token)).j;
  const PUB = (await rpc('reservas_config_guardar', { p_negocio: NEG, p_activo: false, p_tipo: 'habitacion', p_nombre: 'Hotel Palmas', p_recursos: [], p_reglas: {} }, dueno.token)).j.publico;

  // ---------- Exportar ----------
  const d1 = enDias(2), d2 = enDias(4);
  let r = await rpc('reserva_guardar', { p_negocio: NEG, p_id: null, p_recurso: '1', p_recurso_nombre: 'Habitación 101', p_desde: new Date(d1.getTime() + 15 * 36e5).toISOString(), p_hasta: new Date(d2.getTime() + 12 * 36e5).toISOString(), p_cliente: 'Ana Ruiz', p_telefono: '3001234567', p_personas: 2, p_nota: null, p_estado: 'confirmada', p_valor: 240000 }, dueno.token);
  chk('Reserva de ORDEVA en la 101', r.j && r.j.ok, r);
  let ex = await fetch(sb.url + '/functions/v1/vento-ical/cal/' + PUB + '/1.ics');
  let txt = await ex.text();
  chk('Exportar: el .ics de la 101 responde como calendario', ex.status === 200 && /text\/calendar/.test(ex.headers.get('content-type') || '') && /BEGIN:VCALENDAR/.test(txt), [ex.status, txt.slice(0, 200)]);
  chk('… con la reserva por noches (llegada → salida) y «Reservado - ORDEVA»', txt.includes('DTSTART;VALUE=DATE:' + ymd(d1)) && txt.includes('DTEND;VALUE=DATE:' + ymd(d2)) && /SUMMARY:Reservado - ORDEVA/.test(txt), txt);
  chk('… sin datos del cliente (ni nombre, ni celular, ni valor)', !/Ana|Ruiz|3001234567|240000/.test(txt), txt);
  ex = await fetch(sb.url + '/functions/v1/vento-ical/cal/000000000000/1.ics');
  chk('Un código público que no existe: 404', ex.status === 404, ex.status);

  // ---------- Leer ----------
  const urlB = 'http://127.0.0.1:' + puerto + '/ical/abc.ics';
  const leer = (url, tok) => fetch(sb.url + '/functions/v1/vento-ical/leer', { method: 'POST', headers: cab(tok), body: JSON.stringify({ url }) }).then(async x => ({ st: x.status, j: await x.json().catch(() => null) }));
  r = await leer(urlB, null);
  chk('Leer sin sesión de ORDEVA: no deja (401)', r.st === 401, r);
  r = await leer('https://ejemplo.com/cal.ics', dueno.token);
  chk('Leer una página que no es de una plataforma: no deja («link_no_permitido»)', r.st === 400 && r.j.error === 'link_no_permitido', r);
  r = await leer('http://127.0.0.1:' + puerto + '/otra', dueno.token);
  chk('Leer algo que no es un calendario: «no_es_ical»', r.st === 422 && r.j.error === 'no_es_ical', r);
  const e1 = enDias(6), e2 = enDias(8), e3 = enDias(3), e4 = enDias(5);
  ICS = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'UID:bk-111@booking.com', 'DTSTART;VALUE=DATE:' + ymd(e1), 'DTEND;VALUE=DATE:' + ymd(e2), 'SUMMARY:CLOSED - Not available', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  r = await leer(urlB, dueno.token);
  chk('Leer el calendario de «Booking» con sesión: trae el .ics', r.st === 200 && r.j.ok && /bk-111/.test(r.j.ics), r);

  // ---------- Importar ----------
  const ev = (uid, a, b) => ({ uid, desde: new Date(a.getTime() + 15 * 36e5).toISOString(), hasta: new Date(b.getTime() + 12 * 36e5).toISOString() });
  r = await rpc('reserva_ical_sincronizar', { p_negocio: NEG, p_recurso: '1', p_recurso_nombre: 'Habitación 101', p_fuente: 'Booking', p_eventos: [ev('bk-111@booking.com', e1, e2)] }, dueno.token);
  chk('Importar 1 reserva de Booking: queda bloqueada (1 nueva)', r.j && r.j.ok && r.j.nuevas === 1 && !r.j.choques.length, r);
  const disp = await rpc('reservas_disponibles', { p_publico: PUB, p_desde: new Date(e1.getTime() + 15 * 36e5).toISOString(), p_hasta: new Date(e2.getTime() + 12 * 36e5).toISOString(), p_personas: 1 });
  let fila = await sb.sql("select estado, cliente, origen from reservas where negocio_id = $1 and nota = 'ical:Booking:bk-111@booking.com'", [NEG]);
  chk('… como reserva «🔗 Booking» confirmada', fila.length === 1 && fila[0].estado === 'confirmada' && fila[0].cliente === '🔗 Booking', fila);
  r = await rpc('reserva_ical_sincronizar', { p_negocio: NEG, p_recurso: '1', p_recurso_nombre: 'Habitación 101', p_fuente: 'Booking', p_eventos: [ev('bk-111@booking.com', e1, e2)] }, dueno.token);
  chk('Sincronizar otra vez lo mismo: no duplica (0 nuevas)', r.j && r.j.nuevas === 0 && (await sb.sql("select count(*)::int n from reservas where negocio_id = $1 and nota like 'ical:%' and estado <> 'cancelada'", [NEG]))[0].n === 1, r);
  r = await rpc('reserva_ical_sincronizar', { p_negocio: NEG, p_recurso: '1', p_recurso_nombre: 'Habitación 101', p_fuente: 'Booking', p_eventos: [ev('bk-111@booking.com', e1, enDias(9))] }, dueno.token);
  chk('Allá cambian las fechas: aquí se mueven (1 cambiada)', r.j && r.j.cambiadas === 1, r);
  r = await rpc('reserva_ical_sincronizar', { p_negocio: NEG, p_recurso: '1', p_recurso_nombre: 'Habitación 101', p_fuente: 'Airbnb', p_eventos: [ev('ab-9@airbnb.com', e3, e4)] }, dueno.token);
  chk('Airbnb trae una que choca con la de Ana (ORDEVA): NO se guarda y vuelve como «choque» (con las fechas de la de ORDEVA)', r.j && r.j.nuevas === 0 && r.j.choques.length === 1 && r.j.choques[0].con && r.j.choques[0].con.recurso === '1' && !!r.j.choques[0].con.desde, r);
  r = await rpc('reserva_ical_sincronizar', { p_negocio: NEG, p_recurso: '1', p_recurso_nombre: 'Habitación 101', p_fuente: 'Booking', p_eventos: [] }, dueno.token);
  fila = await sb.sql("select estado from reservas where negocio_id = $1 and nota = 'ical:Booking:bk-111@booking.com'", [NEG]);
  chk('Allá la cancelan (ya no viene): aquí se cancela y se libera', r.j && r.j.canceladas === 1 && fila[0].estado === 'cancelada', [r, fila]);
  r = await rpc('reserva_ical_sincronizar', { p_negocio: NEG, p_recurso: '1', p_recurso_nombre: 'Habitación 101', p_fuente: 'Booking', p_eventos: [ev('x', e1, e2)] }, otro.token);
  chk('Otro negocio no puede importar en este hotel', r.st >= 400, r);
  r = await rpc('reserva_ical_sincronizar', { p_negocio: NEG, p_recurso: '1', p_recurso_nombre: 'x', p_fuente: 'Booking', p_eventos: [] }, null);
  chk('Sin sesión no se puede importar', r.st >= 400, r);
  void disp; void NEG2;
}

(async () => {
  let sb;
  try {
    await new Promise(r => booking.listen(0, '127.0.0.1', r));
    const puerto = booking.address().port;
    sb = await iniciar({ env: { VENTO_ICAL_HOSTS: '127.0.0.1' } });
    await pruebas(sb, puerto);
  }
  catch (e) { mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  finally { if (sb) await sb.cerrar().catch(() => {}); booking.close(); }
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
