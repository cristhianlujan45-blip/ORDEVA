// Pruebas del SERVIDOR · ORDEVA PLAY Fase 2: torneos entre mesas (migración 20261204000000_play_torneos), contra
// PostgreSQL REAL. Plan: puente/egm/PLAN-PLAY-FASE2.md.
//  • Quién: solo el dueño o el administrador empiezan y terminan un torneo; uno a la vez; con PLAY apagado, no.
//  • La regla: cada partida le da a la mesa hasta 100 puntos (los de su mejor jugador) y cuentan las 5 mejores. La Ruleta
//    no suma. La misma persona con tres celulares en una partida no suma más. Empate: la que llegó primero.
//  • Qué cuenta: las partidas que TERMINAN dentro del torneo. Los puntos van sin el tope del día y con el +200 del final.
//  • El disparador nunca tumba una partida. Sin torneo, todo sigue como en la fase 1.
//  • Cierre a mano y por tiempo, con el resultado congelado. Se ve 3 horas (cliente) y 12 horas (negocio) desde la hora de fin.
//  • Aislamiento entre negocios y permisos de las funciones internas.
// Corre solo:   node pruebas/servidor/playtorneo.test.js
'use strict';
const fs = require('fs'), path = require('path');
const { iniciar } = require('./supabase-local');
let ok = 0, mal = 0;
const chk = (n, c, x) => { if (c) { ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
if (!process.env.VENTO_LOGS) for (const k of ['log', 'warn', 'error']) { const o = console[k].bind(console); console[k] = (...a) => { if (typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; o(...a); }; }

const C = 'vitotorneobar1', C2 = 'vitotorneootro2';

async function pruebas(sb) {
  const cab = (tok) => ({ apikey: sb.anonKey, 'Content-Type': 'application/json', Authorization: 'Bearer ' + (tok || sb.anonKey) });
  const rpc = async (fn, args, tok) => { const r = await fetch(sb.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: cab(tok), body: JSON.stringify(args || {}) }); return { st: r.status, j: await r.json().catch(() => null) }; };
  const err = (r) => JSON.stringify(r.j || '');
  const uno = async (q, p) => (await sb.sql(q, p))[0];
  // La prueba va mucho más rápido que una persona: el límite de llamadas se reinicia a mano.
  const respiro = () => sb.sql('update play_jugadores set cupo_n = 0');

  const dueno = await sb.usuario('dueno@torneobar.co');
  const NEG = (await rpc('crear_negocio', { p_nombre: 'Bar Torneo', p_datos: {} }, dueno.token)).j;
  await rpc('guardar_datos', { p_negocio: NEG, p_datos: { businessName: 'Bar Torneo', qrCanales: [C], qrCodigos: { 1: ['m1codigo01'], 2: ['m2codigo02'], 3: ['m3codigo03'], 4: ['m4codigo04'] } }, p_version: 1 }, dueno.token);
  const mesero = await sb.usuario('mesero@torneobar.co');
  const inv = (await rpc('crear_invitacion', { p_negocio: NEG, p_rol: 'mesero' }, dueno.token)).j; await rpc('unirse_con_codigo', { p_codigo: inv, p_nombre: 'Pedro' }, mesero.token);
  const otro = await sb.usuario('dueno@otrotorneo.co');
  const NEG2 = (await rpc('crear_negocio', { p_nombre: 'Otro', p_datos: {} }, otro.token)).j;
  await rpc('guardar_datos', { p_negocio: NEG2, p_datos: { businessName: 'Otro', qrCanales: [C2], qrCodigos: { 1: ['o1codigo01'] } }, p_version: 1 }, otro.token);
  const TODOS = ['show', 'bomba', 'impostor', 'ruleta', 'sobreviviente'];

  // ---------- Quién puede ----------
  let r = await rpc('play_torneo_crear', { p_negocio: NEG, p_minutos: 60 }, dueno.token);
  chk('Con PLAY apagado no se puede empezar un torneo', r.st !== 200 && /play_no_disponible/.test(err(r)), r);
  await rpc('play_config_guardar', { p_negocio: NEG, p_activo: true, p_juegos: TODOS, p_retos: ['divertido'], p_local: true }, dueno.token);
  await rpc('play_config_guardar', { p_negocio: NEG2, p_activo: true, p_juegos: TODOS, p_retos: ['divertido'] }, otro.token);
  const entrar = async (mesa, alias, canal, vm) => (await rpc('play_entrar', { p_canal: canal || C, p_mesa: mesa, p_vm: vm || ('m' + mesa + 'codigo0' + mesa), p_alias: alias, p_avatar: '😎' })).j;
  const a1 = await entrar(1, 'Ana'), a2 = await entrar(1, 'Abel'), a3 = await entrar(1, 'Alba');
  const b1 = await entrar(2, 'Beto'), b2 = await entrar(2, 'Bea');
  const c1 = await entrar(3, 'Caro'), c2 = await entrar(3, 'Ciro');
  const d1 = await entrar(4, 'Dani'), d2 = await entrar(4, 'Dora');
  const z1 = await entrar(1, 'Zoe', C2, 'o1codigo01'), z2 = await entrar(1, 'Zac', C2, 'o1codigo01');

  // Una partida de verdad (sala, unirse, empezar) que se termina con los puntos que diga la prueba: pasa por play_terminar
  // y por el disparador. p_bono = el +200 del final de la bomba y el sobreviviente.
  const partida = async (juego, jugadores, opt) => {
    await respiro();
    const o = opt || {}, [primero, ...resto] = jugadores;
    const s = (await rpc('play_crear', { p_token: primero[0].token, p_juego: juego, p_modo: o.local ? 'local' : 'mesa' })).j.sala;
    for (const [t] of resto) await rpc('play_unirse', { p_token: t.token, p_codigo: s.codigo });
    await rpc('play_empezar', { p_token: primero[0].token, p_sala: s.id });
    for (const [t, pts] of jugadores) await sb.sql('update play_miembros set puntos = $3 where sala_id = $1 and jugador_id = $2', [s.id, t.jugador, pts]);
    // En el show, que la pregunta abierta no sume nada más al terminar.
    await sb.sql("update play_salas set fase = 'resultado' where id = $1", [s.id]);
    await sb.sql('select public.play_terminar($1, $2)', [s.id, !!o.bono]);
    return s.id;
  };
  const filas = (sala) => sb.sql('select jugador_id, puntos, brutos, torneo_id from play_puntos where sala_id = $1 order by brutos desc', [sala]);

  r = await rpc('play_torneo_crear', { p_negocio: NEG, p_minutos: 60 }, mesero.token);
  chk('Un mesero NO puede empezar un torneo', r.st !== 200 && /sin_permiso/.test(err(r)), r);
  r = await rpc('play_torneo_crear', { p_negocio: NEG, p_minutos: 60 });
  chk('Sin sesión tampoco', r.st !== 200, r.st);
  r = await rpc('play_torneo', { p_token: a1.token });
  chk('Sin torneo, el cliente recibe «no hay torneo»', r.st === 200 && r.j.torneo === null, r.j);
  const antes = await partida('show', [[a1, 900], [a2, 300]]);
  let f = await filas(antes);
  chk('Sin torneo todo sigue como en la fase 1: la partida termina, sin torneo, y guarda los puntos de la partida', f.length === 2 && f.every((x) => x.torneo_id === null) && f[0].brutos === 900 && f[0].puntos === 900, f);

  r = await rpc('play_torneo_crear', { p_negocio: NEG, p_minutos: 60 }, dueno.token);
  const T = r.j && r.j.torneo;
  chk('El dueño empieza un torneo de 60 minutos', r.st === 200 && T && T.abierto === true && Math.abs((T.fin - T.inicio) - 3600000) < 5000 && T.mesas.length === 0, r.j);
  r = await rpc('play_torneo_crear', { p_negocio: NEG, p_minutos: 30 }, dueno.token);
  chk('Un torneo a la vez: el segundo dice «ya hay uno abierto»', r.st !== 200 && /play_torneo_abierto/.test(err(r)), r);
  r = await rpc('play_torneo_crear', { p_negocio: NEG2, p_minutos: 9999 }, otro.token);
  chk('La duración se limita a 120 minutos', r.st === 200 && Math.abs((r.j.torneo.fin - r.j.torneo.inicio) - 7200000) < 5000, r.j && r.j.torneo);
  r = await rpc('play_torneo_ver', { p_negocio: NEG }, mesero.token);
  chk('Cualquiera del equipo del negocio ve el torneo', r.st === 200 && r.j.torneo && r.j.torneo.id === T.id && r.j.activo === true && r.j.local === true, r.j);
  r = await rpc('play_torneo_ver', { p_negocio: NEG }, otro.token);
  chk('Otro negocio no ve el torneo', r.st !== 200 && /sin_permiso/.test(err(r)), r);
  r = await rpc('play_torneo_cerrar', { p_negocio: NEG }, otro.token);
  chk('… ni lo puede terminar', r.st !== 200 && /sin_permiso/.test(err(r)), r);
  for (const [fn, args] of [['play_torneo_tabla', { p_torneo: T.id }], ['play_torneos_repaso', {}], ['play_torneo_cerrar_uno', { p_torneo: T.id, p_ahora: true }], ['play_torneo_refrescar', { p_torneo: T.id, p_ya: true }], ['play_torneo_actual', { p_neg: NEG }]]) {
    r = await rpc(fn, args, a1.token && undefined);
    chk('Un cliente no puede llamar la función interna ' + fn, r.st !== 200, r.st);
  }
  chk('… y el torneo sigue abierto', (await uno('select cerrado from play_torneos where id = $1', [T.id])).cerrado === null);
  r = await fetch(sb.url + '/rest/v1/play_torneos?select=*', { headers: cab() });
  chk('La tabla de torneos no se lee directo', r.status >= 400 || (await r.json()).length === 0, r.status);

  // ---------- La regla ----------
  r = await rpc('play_torneo', { p_token: a1.token });
  chk('El cliente ve el torneo abierto, su mesa y que todavía no suma', r.j.torneo && r.j.torneo.abierto && r.j.torneo.miMesa === 1 && r.j.torneo.miPuesto === null && r.j.torneo.mesas.length === 0, r.j);
  chk('… y su última partida (de antes del torneo) no sumó', r.j.torneo.miUltima && r.j.torneo.miUltima.sumo === false, r.j.torneo.miUltima);
  const tabla = async (tok) => { await respiro(); return (await rpc('play_torneo', { p_token: (tok || a1).token })).j.torneo; };
  const de = (t, mesa) => t.mesas.find((m) => m.mesa === mesa) || null;

  let s1 = await partida('show', [[a1, 800], [a2, 400], [a3, 1200]]);
  f = await filas(s1);
  chk('Una partida que termina dentro del torneo queda marcada con el torneo', f.length === 3 && f.every((x) => x.torneo_id === T.id), f);
  let t = await tabla();
  chk('De cada partida cuenta el MEJOR de la mesa, en escala de 0 a 100 (1.200 de 1.600 = 75)', de(t, 1) && de(t, 1).puntos === 75 && de(t, 1).partidas === 1 && t.miPuesto === 1, de(t, 1));
  chk('… con los apodos de quienes sumaron', JSON.stringify(de(t, 1).jugadores) === JSON.stringify(['Alba']), de(t, 1));
  r = await rpc('play_torneo', { p_token: a1.token });
  chk('La última partida de Ana sí sumó (lo dice el servidor)', r.j.torneo.miUltima.sumo === true, r.j.torneo.miUltima);
  await partida('show', [[a1, 1600], [a2, 1600], [a3, 1600]]);
  t = await tabla();
  chk('La misma persona con tres celulares en una partida no suma más: esa partida da 100, no 300', de(t, 1).puntos === 175 && de(t, 1).partidas === 2, de(t, 1));
  await partida('bomba', [[b1, 50000], [b2, 10]]);
  t = await tabla();
  chk('Tope por partida: una partida con 50.000 puntos da 100', de(t, 2).puntos === 100, de(t, 2));
  const rul = await partida('ruleta', [[b1, 300], [b2, 100]]);
  t = await tabla(b1);
  chk('La Ruleta no suma al torneo (la mesa 2 sigue en 100)', de(t, 2).puntos === 100 && de(t, 2).partidas === 1, de(t, 2));
  chk('… y el servidor le dice al jugador que esa partida no sumó, y por qué juego', t.miUltima.sumo === false && t.miUltima.juego === 'ruleta' && (await filas(rul)).length === 2, t.miUltima);
  // Cuentan las 5 mejores: la mesa 3 juega 7 de sobreviviente (560 = 100): 56, 112, 168, 224, 280, 336, 392 → 10 a 70.
  for (const pts of [56, 112, 168, 224, 280, 336, 392]) await partida('sobreviviente', [[c1, pts], [c2, 0]]);
  t = await tabla(c1);
  chk('Cuentan las 5 mejores partidas de la mesa (de 7): 70 + 60 + 50 + 40 + 30 = 250', de(t, 3).puntos === 250 && de(t, 3).partidas === 7 && de(t, 3).cuentan === 5, de(t, 3));
  chk('Una mesa de 2 personas compite igual: la mesa 3 va primera', t.mesas[0].mesa === 3 && t.miPuesto === 1 && t.total === 3, t.mesas.map((m) => [m.mesa, m.puntos]));
  // «Todo el local»: dos mesas en la misma sala; cada una suma con su mejor jugador.
  await partida('impostor', [[d1, 300], [d2, 600], [a1, 150]], { local: true });
  t = await tabla(d1);
  chk('En una sala de «todo el local» cada mesa suma lo de su mejor jugador (mesa 4: 100; mesa 1: +25)', de(t, 4).puntos === 100 && de(t, 1).puntos === 200, [de(t, 4), de(t, 1)]);
  // +200 del final y tope del día.
  const sob = await partida('sobreviviente', [[d1, 80], [d2, 20]], { bono: true });
  f = await filas(sob);
  chk('«brutos» trae el +200 del final (80 + 200 y 20 + 200)', f[0].brutos === 280 && f[1].brutos === 220, f);
  // (Dani ya llevaba 3.000 puntos hoy, de partidas de antes del torneo.)
  await sb.sql("insert into play_puntos(negocio_id, sala_id, jugador_id, alias, mesa, juego, puntos) values ($1, gen_random_uuid(), $2, 'Dani', 4, 'show', 3000)", [NEG, d1.jugador]);
  await sb.sql('update play_puntos set torneo_id = null where jugador_id = $1 and puntos = 3000', [d1.jugador]);
  const capada = await partida('show', [[d1, 1280], [d2, 10]]);
  f = await filas(capada);
  chk('El tope del día recorta la clasificación del día (0 puntos) pero NO el torneo (1.280 = 80)', f[0].puntos === 0 && f[0].brutos === 1280 && f[0].torneo_id === T.id, f);
  t = await tabla(d1);
  chk('… la mesa 4 suma 100 + 50 + 80 = 230', de(t, 4).puntos === 230, de(t, 4));
  // Empate: gana la que llegó primero. La mesa 2 (100) recibe 150 más → 250, igual que la mesa 3, pero después.
  await partida('show', [[b1, 1600], [b2, 0]]); await partida('show', [[b1, 800], [b2, 0]]);
  t = await tabla(b1);
  chk('Empate a 250: va primero la mesa que llegó antes a ese puntaje (la 3), y la 2 de segunda', de(t, 2).puntos === 250 && de(t, 3).puntos === 250 && t.mesas[0].mesa === 3 && t.mesas[1].mesa === 2 && t.miPuesto === 2, t.mesas.map((m) => [m.mesa, m.puntos]));

  // ---------- Versión corta, límite y aislamiento ----------
  r = await rpc('play_torneo', { p_token: b1.token, p_ver: t.v });
  chk('Si la tabla no cambió, la respuesta es corta', r.j && r.j.igual === true && !r.j.torneo, r.j);
  const guardada = (await uno('select tabla_en from play_torneos where id = $1', [T.id])).tabla_en;
  for (const tk of [a2, b2, c2]) await rpc('play_torneo', { p_token: tk.token });
  chk('La tabla guardada no se recalcula en cada lectura (solo si terminó una partida nueva)', String((await uno('select tabla_en from play_torneos where id = $1', [T.id])).tabla_en) === String(guardada));
  await partida('show', [[a1, 160], [a2, 0]]);
  r = await rpc('play_torneo', { p_token: a2.token, p_ver: t.v });
  chk('… y apenas termina una partida nueva, la siguiente lectura ya trae la tabla al día (sin esperar)', r.j.torneo && r.j.torneo.v !== t.v && de(r.j.torneo, 1).partidas === de(t, 1).partidas + 1, r.j.torneo && de(r.j.torneo, 1));
  await respiro(); let lim = 0;
  for (let i = 0; i < 32; i++) { const x = await rpc('play_torneo', { p_token: a3.token }); if (x.st === 200 && x.j && x.j.error === 'demasiados') lim++; }
  chk('El límite de llamadas también cuenta aquí y contesta {error} sin lanzar error', lim >= 5, lim);
  await respiro();
  r = await rpc('play_torneo', { p_token: z1.token });
  chk('El cliente de otro negocio ve SU torneo, no este', r.j.torneo && r.j.torneo.id !== T.id && r.j.torneo.mesas.length === 0, r.j);
  await partida('show', [[z1, 1600], [z2, 0]]);
  t = await tabla();
  chk('Las partidas de otro negocio no entran a este torneo', t.total === 4 && !JSON.stringify(t.mesas).includes('Zoe'), t.mesas.map((m) => [m.mesa, m.puntos]));
  r = await rpc('play_torneo', { p_token: 'tokenfalsotokenfalsotokenfalso' });
  chk('Sin un token válido no se ve el torneo', r.st !== 200 && /play_sesion/.test(err(r)), r);

  // ---------- El disparador nunca tumba una partida ----------
  await sb.sql('alter table play_torneos rename column cerrado to cerrado_x');
  const rota = await partida('show', [[a1, 1600], [a2, 0]]);
  await sb.sql('alter table play_torneos rename column cerrado_x to cerrado');
  f = await filas(rota);
  chk('Si el disparador falla, la partida termina igual y queda sin torneo', f.length === 2 && f.every((x) => x.torneo_id === null) && f[0].brutos === 1600 && (await uno('select estado from play_salas where id = $1', [rota])).estado === 'fin', f);

  // ---------- PLAY apagado ----------
  await rpc('play_config_guardar', { p_negocio: NEG, p_activo: false, p_juegos: TODOS, p_retos: ['divertido'], p_local: true }, dueno.token);
  await respiro(); r = await rpc('play_torneo', { p_token: a1.token });
  chk('Con PLAY apagado el cliente no recibe el torneo', r.st === 200 && r.j.torneo === null, r.j);
  r = await rpc('play_torneo_ver', { p_negocio: NEG }, dueno.token);
  chk('… y el negocio lo sigue viendo, con «PLAY apagado»', r.j.torneo && r.j.torneo.abierto && r.j.activo === false, r.j);
  await rpc('play_config_guardar', { p_negocio: NEG, p_activo: true, p_juegos: TODOS, p_retos: ['divertido'], p_local: true }, dueno.token);

  // ---------- Cierre ----------
  r = await rpc('play_torneo_cerrar', { p_negocio: NEG }, mesero.token);
  chk('Un mesero no puede terminar el torneo', r.st !== 200 && /sin_permiso/.test(err(r)), r);
  // Se acaba el tiempo: una partida que termina después ya no cuenta, y al leerlo se cierra con el resultado congelado.
  await sb.sql("update play_torneos set inicio = now() - interval '1 hour', fin = now() - interval '1 second' where id = $1", [T.id]);
  const tarde = await partida('show', [[c1, 1600], [c2, 0]]);
  chk('Una partida que termina después de la hora del torneo no cuenta', (await filas(tarde)).every((x) => x.torneo_id === null));
  await respiro(); r = await rpc('play_torneo', { p_token: c1.token });
  const fin = r.j.torneo;
  chk('Al pasar la hora el torneo se cierra solo (al leerlo) y el cliente ve el resultado', fin && fin.abierto === false && fin.mesas[0].mesa === 3 && fin.mesas[0].puntos === 250 && fin.miPuesto === 1, fin && fin.mesas.map((m) => [m.mesa, m.puntos]));
  chk('… y a Caro le dice que su última partida no alcanzó a sumar', fin.miUltima.sumo === false && fin.miUltima.juego === 'show', fin.miUltima);
  const res = (await uno('select resultado, cerrado from play_torneos where id = $1', [T.id]));
  chk('El resultado queda congelado, con la regla usada y los apodos de quienes sumaron', res.cerrado && res.resultado.regla.mejores === 5 && res.resultado.regla.tope === 100 && res.resultado.mesas[0].mesa === 3 && res.resultado.mesas[0].jugadores.includes('Caro'), res.resultado && res.resultado.mesas[0]);
  r = await rpc('play_torneo_ver', { p_negocio: NEG }, dueno.token);
  chk('El negocio ve el resultado del torneo que acaba de terminar', r.j.torneo && r.j.torneo.abierto === false && r.j.torneo.mesas.length === 4, r.j.torneo && r.j.torneo.mesas.map((m) => [m.mesa, m.puntos]));
  // Visibilidad: 3 horas para el cliente y 12 para el negocio, contadas desde la HORA DE FIN.
  await sb.sql("update play_torneos set fin = now() - interval '4 hours', inicio = now() - interval '5 hours' where id = $1", [T.id]);
  await respiro(); r = await rpc('play_torneo', { p_token: c1.token });
  chk('4 horas después de terminar, el cliente ya no ve ese torneo', r.j.torneo === null, r.j);
  r = await rpc('play_torneo_ver', { p_negocio: NEG }, dueno.token);
  chk('… pero el negocio sí (12 horas: no se pierde al pasar la medianoche)', r.j.torneo && r.j.torneo.id === T.id, r.j);
  await sb.sql("update play_torneos set fin = now() - interval '13 hours', inicio = now() - interval '14 hours' where id = $1", [T.id]);
  r = await rpc('play_torneo_ver', { p_negocio: NEG }, dueno.token);
  chk('13 horas después el negocio tampoco', r.j.torneo === null, r.j);

  // Un torneo que venció ayer y nadie cerró (sin pg_cron): al leerlo hoy se cierra, pero NO se muestra como recién ganado.
  const viejo = (await uno("insert into play_torneos(negocio_id, inicio, fin) values ($1, now() - interval '20 hours', now() - interval '19 hours') returning id", [NEG])).id;
  await respiro(); r = await rpc('play_torneo', { p_token: a1.token });
  chk('Un torneo de ayer que nadie cerró no aparece hoy como «ganó la mesa…»', r.j.torneo === null && (await uno('select cerrado from play_torneos where id = $1', [viejo])).cerrado !== null, r.j);
  // Crear justo después de que venció el anterior, sin que nadie lo haya cerrado.
  await sb.sql("insert into play_torneos(negocio_id, inicio, fin) values ($1, now() - interval '2 hours', now() - interval '1 minute')", [NEG]);
  r = await rpc('play_torneo_crear', { p_negocio: NEG, p_minutos: 30 }, dueno.token);
  const T2 = r.j && r.j.torneo;
  chk('Se puede empezar otro torneo apenas vence el anterior (se cierra solo, sin esperar al repaso)', r.st === 200 && T2 && T2.abierto && T2.mesas.length === 0 && Math.abs((T2.fin - T2.inicio) - 1800000) < 5000, r.j);
  chk('… y solo hay uno abierto', (await uno('select count(*)::int n from play_torneos where negocio_id = $1 and cerrado is null', [NEG])).n === 1);
  // Terminar ahora (a mano), con una mesa sola y luego uno sin partidas.
  await partida('show', [[b1, 800], [b2, 0]]);
  r = await rpc('play_torneo_cerrar', { p_negocio: NEG }, dueno.token);
  chk('El dueño lo termina ahora: queda cerrado, con la hora de fin de este momento y la mesa que jugó', r.st === 200 && r.j.torneo.abierto === false && r.j.torneo.fin <= r.j.torneo.ahora && r.j.torneo.mesas.length === 1 && r.j.torneo.mesas[0].mesa === 2 && r.j.torneo.mesas[0].puntos === 50, r.j.torneo);
  const despues = await partida('show', [[b1, 1600], [b2, 0]]);
  chk('Una partida después de cerrar no entra ni cambia el resultado', (await filas(despues)).every((x) => x.torneo_id === null) && (await uno('select resultado from play_torneos where id = $1', [T2.id])).resultado.mesas[0].puntos === 50);
  r = await rpc('play_torneo_crear', { p_negocio: NEG, p_minutos: 15 }, dueno.token);
  const T3 = r.j.torneo;
  await sb.sql("update play_torneos set inicio = now() - interval '20 minutes', fin = now() - interval '1 second' where id = $1", [T3.id]);
  const rep = (await uno('select public.play_torneos_repaso() r')).r;
  chk('El repaso cierra los torneos vencidos aunque nadie los mire (un torneo sin partidas queda sin mesas)', rep.cerrados >= 1 && (await uno('select resultado, cerrado from play_torneos where id = $1', [T3.id])).resultado.mesas.length === 0, rep);
  await sb.sql("update play_torneos set fin = now() - interval '91 days', inicio = now() - interval '92 days' where id = $1", [T.id]);
  const rep2 = (await uno('select public.play_torneos_repaso() r')).r;
  chk('… y borra los torneos de más de 90 días (sus partidas quedan, sin torneo)', rep2.borrados >= 1 && !(await sb.sql('select 1 from play_torneos where id = $1', [T.id])).length && (await uno('select count(*)::int n from play_puntos where sala_id = $1', [s1])).n === 3, rep2);

  // ---------- Volver a correr la migración ----------
  let e2 = null;
  try { await sb.sql(fs.readFileSync(path.join(__dirname, '..', '..', 'supabase', 'migrations', '20261204000000_play_torneos.sql'), 'utf8')); } catch (e) { e2 = e.message; }
  chk('La migración se puede volver a correr', e2 === null, e2);
  chk('… sin duplicar el disparador ni perder los torneos', (await uno("select count(*)::int n from pg_trigger where tgname = 'play_puntos_torneo_tg'")).n === 1 && (await uno('select count(*)::int n from play_torneos where negocio_id = $1', [NEG])).n >= 3);
}

(async () => {
  let sb = null;
  try { sb = await iniciar(); await pruebas(sb); }
  catch (e) { mal++; console.log('❌ Error inesperado → ' + (e && e.stack || e)); }
  finally { if (sb) await sb.cerrar().catch(() => {}); }
  console.log('RESULTADO', ok, 'bien', mal, 'mal');
  process.exit(mal ? 1 : 0);
})();
