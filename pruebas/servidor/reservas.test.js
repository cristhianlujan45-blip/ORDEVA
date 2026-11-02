// Pruebas del SERVIDOR: 📅 reservas sin duplicados (migración 20261125000000_reservas, ORDEVA 1.73.0), contra PostgreSQL REAL.
//  • La base de datos impide dos reservas que se crucen en la misma habitación o mesa: también si llegan AL MISMO TIEMPO
//    (10 a la vez → 1 sola queda), y también por SQL directo.
//  • Atender (cuenta abierta) = ocupada: el agente ya no la ofrece; al cobrar se libera.
//  • Lo público (agente): disponibilidad sin datos de nadie, reservar (el recurso más pequeño que alcance), consultar y
//    cancelar con el código y el teléfono, topes contra abuso.
//  • Permisos: otro negocio y los anónimos no ven ni cambian nada; solo dueño/administrador configuran.
'use strict';
const { iniciar } = require('./supabase-local');
let ok = 0, mal = 0;
const chk = (n, c, x) => { if (c) { ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
if (!process.env.VENTO_LOGS) for (const k of ['log', 'warn', 'error']) { const o = console[k].bind(console); console[k] = (...a) => { if (typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; o(...a); }; }

async function pruebas(sb) {
  const cab = (tok) => ({ apikey: sb.anonKey, 'Content-Type': 'application/json', Authorization: 'Bearer ' + (tok || sb.anonKey) });
  const rpc = async (fn, args, tok) => { const r = await fetch(sb.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: cab(tok), body: JSON.stringify(args || {}) }); return { st: r.status, j: await r.json().catch(() => null) }; };
  const dueno = await sb.usuario('dueno@hotel.co');
  const NEG = (await rpc('crear_negocio', { p_nombre: 'Hotel Prueba', p_datos: {} }, dueno.token)).j;
  const u2 = await sb.usuario('otro@hotel.co');
  const NEG2 = (await rpc('crear_negocio', { p_nombre: 'Otro Hotel', p_datos: {} }, u2.token)).j;
  const cod = (await rpc('crear_invitacion', { p_negocio: NEG, p_rol: 'cajero' }, dueno.token)).j;
  const cajero = await sb.usuario('caja@hotel.co'); await rpc('unirse_con_codigo', { p_codigo: cod, p_nombre: 'Caja' }, cajero.token);
  const dia = (d, h) => { const x = new Date(); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() + d); x.setHours(h); return x.toISOString(); };

  // ---------- Configurar ----------
  const recursos = [{ id: '1', nombre: 'Habitación 101 (doble)', capacidad: 2, precio: 120000 }, { id: '2', nombre: 'Habitación 102 (familiar)', capacidad: 4, precio: 180000 }];
  let r = await rpc('reservas_config_guardar', { p_negocio: NEG, p_activo: true, p_tipo: 'habitacion', p_nombre: 'Hotel Prueba', p_recursos: recursos, p_reglas: { entrada: '15:00', salida: '12:00' } }, dueno.token);
  const PUB = r.j && r.j.publico;
  chk('El dueño configura las reservas en línea (id público al azar)', r.st === 200 && /^[0-9a-f]{12}$/.test(PUB || ''), r);
  r = await rpc('reservas_config_guardar', { p_negocio: NEG, p_activo: false, p_tipo: 'habitacion', p_nombre: 'x', p_recursos: [], p_reglas: {} }, cajero.token);
  chk('El cajero NO puede cambiar la configuración', r.st >= 400, r);

  // ---------- Sin duplicados ----------
  r = await rpc('reserva_guardar', { p_negocio: NEG, p_id: null, p_recurso: '1', p_recurso_nombre: 'Habitación 101', p_desde: dia(1, 15), p_hasta: dia(3, 12), p_cliente: 'Ana', p_telefono: '3001234567', p_personas: 2, p_nota: null, p_estado: null, p_valor: null }, dueno.token);
  chk('Reserva de la 101 del día 1 al 3', r.j && r.j.ok === true, r);
  r = await rpc('reserva_guardar', { p_negocio: NEG, p_id: null, p_recurso: '1', p_recurso_nombre: 'Habitación 101', p_desde: dia(2, 15), p_hasta: dia(4, 12), p_cliente: 'Luis', p_telefono: '3009999999', p_personas: 1, p_nota: null, p_estado: null, p_valor: null }, cajero.token);
  chk('Otra que se cruza (día 2 al 4): NO se guarda («ocupado», dice con cuál choca)', r.j && r.j.ok === false && r.j.error === 'ocupado' && r.j.choque, r);
  r = await rpc('reserva_guardar', { p_negocio: NEG, p_id: null, p_recurso: '1', p_recurso_nombre: 'Habitación 101', p_desde: dia(3, 12), p_hasta: dia(5, 12), p_cliente: 'Eva', p_telefono: '3008888888', p_personas: 2, p_nota: null, p_estado: null, p_valor: null }, dueno.token);
  chk('Una que empieza justo cuando sale la anterior (día 3 a las 12) SÍ se puede', r.j && r.j.ok === true, r);
  // 10 al mismo tiempo
  const varias = await Promise.all(Array.from({ length: 10 }, (_, i) => rpc('reserva_guardar', { p_negocio: NEG, p_id: null, p_recurso: '2', p_recurso_nombre: 'Habitación 102', p_desde: dia(10, 15), p_hasta: dia(12, 12), p_cliente: 'Cliente ' + i, p_telefono: '30000000' + i, p_personas: 3, p_nota: null, p_estado: null, p_valor: null }, i % 2 ? cajero.token : dueno.token)));
  chk('10 reservas de la 102 AL MISMO TIEMPO para las mismas fechas: solo 1 queda', varias.filter(x => x.j && x.j.ok).length === 1 && (await sb.sql("select count(*)::int n from reservas where negocio_id = $1 and recurso = '2' and estado <> 'cancelada'", [NEG]))[0].n === 1, varias.map(x => x.j && (x.j.ok || x.j.error)));
  let sqlErr = null;
  try { await sb.sql("insert into reservas(negocio_id, recurso, desde, hasta, estado) values ($1, '1', $2, $3, 'confirmada')", [NEG, dia(1, 18), dia(2, 10)]); } catch (e) { sqlErr = e.message; }
  chk('Ni por SQL directo se puede guardar una reserva cruzada (la base de datos la rechaza)', /reservas_sin_cruce|exclusion|conflicting/.test(sqlErr || ''), sqlErr);

  // ---------- Atender = ocupada; cobrar = libre ----------
  r = await rpc('reserva_ocupar', { p_negocio: NEG, p_recurso: '3', p_recurso_nombre: 'Habitación 103', p_hasta: dia(1, 12) }, cajero.token);
  chk('Se atiende la 103 (cuenta abierta): queda OCUPADA hasta mañana a las 12', r.j && r.j.ok && r.j.reserva.estado === 'ocupada', r);
  r = await rpc('reserva_ocupar', { p_negocio: NEG, p_recurso: '3', p_recurso_nombre: 'Habitación 103', p_hasta: dia(1, 12) }, cajero.token);
  chk('… atenderla otra vez no crea otra ocupación (sigue una sola)', (await sb.sql("select count(*)::int n from reservas where negocio_id = $1 and recurso = '3' and estado = 'ocupada'", [NEG]))[0].n === 1, r);
  r = await rpc('reserva_liberar', { p_negocio: NEG, p_recurso: '3' }, cajero.token);
  chk('Se cobra la 103: queda libre (la ocupación termina ahora)', r.j && r.j.liberadas === 1 && (await sb.sql("select count(*)::int n from reservas where negocio_id = $1 and recurso = '3' and estado = 'ocupada'", [NEG]))[0].n === 0, r);
  // Llega quien reservó
  await rpc('reserva_guardar', { p_negocio: NEG, p_id: null, p_recurso: '4', p_recurso_nombre: 'Habitación 104', p_desde: new Date(Date.now() - 30 * 60e3).toISOString(), p_hasta: dia(2, 12), p_cliente: 'Marta', p_telefono: '3007777777', p_personas: 2, p_nota: null, p_estado: null, p_valor: null }, dueno.token);
  r = await rpc('reserva_ocupar', { p_negocio: NEG, p_recurso: '4', p_recurso_nombre: 'Habitación 104', p_hasta: dia(1, 12) }, cajero.token);
  chk('Llega Marta (tenía reserva) y se abre su cuenta: SU reserva pasa a «ocupada» (no se crea otra)', r.j && r.j.ok && r.j.llego === true && r.j.reserva.cliente === 'Marta', r);

  // ---------- Público (agente) ----------
  r = await rpc('reservas_publico_info', { p_publico: PUB });
  chk('Público: nombre, tipo y habitaciones (sin datos de clientes)', r.j && r.j.tipo === 'habitacion' && r.j.recursos.length === 2 && !JSON.stringify(r.j).includes('Ana'), r);
  r = await rpc('reservas_disponibles', { p_publico: PUB, p_desde: dia(2, 15), p_hasta: dia(3, 12), p_personas: 2 });
  chk('Disponibles del día 2 al 3 para 2: solo la 102 (la 101 está reservada)', Array.isArray(r.j) && r.j.length === 1 && r.j[0].id === '2', r);
  r = await rpc('reservas_disponibles', { p_publico: PUB, p_desde: dia(2, 15), p_hasta: dia(3, 12), p_personas: 5 });
  chk('Para 5 personas no hay ninguna (capacidad)', Array.isArray(r.j) && r.j.length === 0, r);
  r = await rpc('reserva_publica_crear', { p_publico: PUB, p_recurso: null, p_desde: dia(20, 15), p_hasta: dia(22, 12), p_cliente: 'Pedro Gómez', p_telefono: '300 555 1234', p_personas: 2, p_nota: 'Llego tarde' });
  const COD = r.j && r.j.reserva && r.j.reserva.codigo;
  chk('El agente reserva para 2: le asigna la 101 (la más pequeña que alcanza), con código y valor (2 noches)', r.j && r.j.ok && r.j.reserva.recurso === '1' && /^[A-Z2-9]{6}$/.test(COD || '') && Number(r.j.reserva.valor) === 240000, r);
  chk('… la respuesta pública no trae el nombre ni el teléfono', r.j && !('cliente' in r.j.reserva) && !('telefono' in r.j.reserva), r.j && r.j.reserva);
  r = await rpc('reserva_publica_crear', { p_publico: PUB, p_recurso: '1', p_desde: dia(21, 15), p_hasta: dia(22, 12), p_cliente: 'Otro', p_telefono: '3001112222', p_personas: 1, p_nota: null });
  chk('Otra persona pide la 101 en esas fechas: «ocupado»', r.j && r.j.ok === false && r.j.error === 'ocupado', r);
  r = await rpc('reserva_publica_crear', { p_publico: PUB, p_recurso: null, p_desde: dia(21, 15), p_hasta: dia(22, 12), p_cliente: 'Otro', p_telefono: '3001112222', p_personas: 1, p_nota: null });
  chk('… sin decir cuál: se le da la 102 (la que queda)', r.j && r.j.ok && r.j.reserva.recurso === '2', r);
  r = await rpc('reserva_publica_crear', { p_publico: PUB, p_recurso: null, p_desde: dia(30, 15), p_hasta: dia(31, 12), p_cliente: 'X', p_telefono: '123', p_personas: 1, p_nota: null });
  chk('Sin nombre o teléfono válido no reserva', r.j && r.j.ok === false, r);
  r = await rpc('reserva_publica_ver', { p_codigo: COD.toLowerCase() });
  chk('Consultar con el código', r.j && r.j.codigo === COD && r.j.estado === 'confirmada' && r.j.negocio === 'Hotel Prueba', r);
  r = await rpc('reserva_publica_cancelar', { p_codigo: COD, p_telefono: '3000000000' });
  chk('Cancelar con el teléfono equivocado: no', r.j && r.j.ok === false, r);
  r = await rpc('reserva_publica_cancelar', { p_codigo: COD, p_telefono: '300-555-1234' });
  chk('Cancelar con el teléfono correcto: sí, y la habitación queda libre', r.j && r.j.ok === true && (await rpc('reservas_disponibles', { p_publico: PUB, p_desde: dia(20, 15), p_hasta: dia(21, 12), p_personas: 2 })).j.some(x => x.id === '1'), r);
  // Tope: 3 por teléfono al día
  const tope = [];
  for (let i = 0; i < 4; i++) tope.push((await rpc('reserva_publica_crear', { p_publico: PUB, p_recurso: null, p_desde: dia(40 + i * 2, 15), p_hasta: dia(41 + i * 2, 12), p_cliente: 'Spam', p_telefono: '3116667777', p_personas: 1, p_nota: null })).j);
  chk('Un mismo teléfono: 3 reservas al día como mucho (la 4ª: «demasiadas»)', tope.slice(0, 3).every(x => x.ok) && tope[3].error === 'demasiadas', tope.map(x => x.ok || x.error));

  // ---------- Permisos ----------
  r = await rpc('reservas_lista', { p_negocio: NEG, p_desde: dia(-1, 0), p_hasta: dia(60, 0) }, u2.token);
  chk('El dueño de OTRO negocio no ve estas reservas', r.st >= 400, r);
  r = await rpc('reservas_lista', { p_negocio: NEG, p_desde: dia(-1, 0), p_hasta: dia(60, 0) });
  chk('Sin entrar (anónimo) no se ven', r.st >= 400, r);
  r = await rpc('reservas_lista', { p_negocio: NEG, p_desde: dia(-1, 0), p_hasta: dia(60, 0) }, cajero.token);
  chk('El cajero del hotel sí las ve (con nombre y teléfono)', Array.isArray(r.j) && r.j.some(x => x.cliente === 'Ana' && x.telefono), r.st);
  const q = await fetch(sb.url + '/rest/v1/reservas?select=*', { headers: cab() });
  const qj = await q.json().catch(() => null);
  chk('La tabla no se lee sin entrar (rechazada o vacía)', q.status >= 400 || (Array.isArray(qj) && qj.length === 0), { st: q.status, qj });
  r = await rpc('reserva_guardar', { p_negocio: NEG, p_id: null, p_recurso: '9', p_recurso_nombre: 'x', p_desde: dia(1, 15), p_hasta: dia(2, 12), p_cliente: 'x', p_telefono: null, p_personas: 1, p_nota: null, p_estado: null, p_valor: null }, u2.token);
  chk('Otro negocio no puede crear reservas aquí', r.st >= 400, r);
  void NEG2;
}

(async () => {
  let sb;
  try { sb = await iniciar(); await pruebas(sb); }
  catch (e) { mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  finally { if (sb) await sb.cerrar().catch(() => {}); }
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
