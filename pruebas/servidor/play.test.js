// Pruebas del SERVIDOR · ORDEVA PLAY Fase 1 (migración 20261203000000_play), contra PostgreSQL REAL.
//  • Entrar sin registrarse: con el canal del negocio y el código secreto de SU mesa; con un código malo, no. Apagado por
//    defecto: el negocio lo prende (solo dueño o administrador).
//  • Aislamiento: un jugador de otro negocio no ve ni entra a las salas; un jugador de otra mesa no entra a una sala «mesa».
//  • El servidor manda: la respuesta correcta nunca llega al celular, una jugada por ronda (un reintento no suma dos veces),
//    fuera de tiempo no cuenta, los puntos los calcula el servidor y quedan una sola vez al terminar.
//  • Los 5 juegos de punta a punta: EL SHOW DE LA MESA, LA BOMBA, EL IMPOSTOR, RULETA DEL CAOS y ÚLTIMO SOBREVIVIENTE.
//  • Retos sin alcohol.
// Corre solo:   node pruebas/servidor/play.test.js
'use strict';
const { iniciar } = require('./supabase-local');
let ok = 0, mal = 0;
const chk = (n, c, x) => { if (c) { ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
if (!process.env.VENTO_LOGS) for (const k of ['log', 'warn', 'error']) { const o = console[k].bind(console); console[k] = (...a) => { if (typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; o(...a); }; }

const C = 'vitoplaybar01', C2 = 'vitoplayotro02';

async function pruebas(sb) {
  const cab = (tok) => ({ apikey: sb.anonKey, 'Content-Type': 'application/json', Authorization: 'Bearer ' + (tok || sb.anonKey) });
  const rpc = async (fn, args, tok) => { const r = await fetch(sb.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: cab(tok), body: JSON.stringify(args || {}) }); return { st: r.status, j: await r.json().catch(() => null) }; };
  const err = (r) => JSON.stringify(r.j || '');
  const uno = async (q, p) => (await sb.sql(q, p))[0];
  let cidN = 0; const cid = () => 'c' + (++cidN) + 'x' + Date.now().toString(36);

  // Dos negocios con sus canales y los códigos de sus mesas.
  const dueno = await sb.usuario('dueno@playbar.co');
  const NEG = (await rpc('crear_negocio', { p_nombre: 'Bar Play', p_datos: {} }, dueno.token)).j;
  await rpc('guardar_datos', { p_negocio: NEG, p_datos: { businessName: 'Bar Play', qrCanales: [C], qrCodigos: { 1: ['m1codigo01'], 2: ['m2codigo02'], 3: ['m3codigo03'] } }, p_version: 1 }, dueno.token);
  const mesero = await sb.usuario('mesero@playbar.co');
  const inv = (await rpc('crear_invitacion', { p_negocio: NEG, p_rol: 'mesero' }, dueno.token)).j; await rpc('unirse_con_codigo', { p_codigo: inv, p_nombre: 'Pedro' }, mesero.token);
  const otro = await sb.usuario('dueno@otroplay.co');
  const NEG2 = (await rpc('crear_negocio', { p_nombre: 'Otro', p_datos: {} }, otro.token)).j;
  await rpc('guardar_datos', { p_negocio: NEG2, p_datos: { businessName: 'Otro', qrCanales: [C2], qrCodigos: { 1: ['o1codigo01'] } }, p_version: 1 }, otro.token);

  // ---------- Activar ----------
  let r = await rpc('play_entrar', { p_canal: C, p_mesa: 1, p_vm: 'm1codigo01', p_alias: 'Ana' });
  chk('Apagado por defecto: no se puede entrar', r.st !== 200 && /play_no_disponible/.test(err(r)), r);
  r = await rpc('play_config_guardar', { p_negocio: NEG, p_activo: true, p_juegos: ['show', 'bomba', 'impostor', 'ruleta', 'sobreviviente'], p_retos: ['divertido', 'musica'] }, mesero.token);
  chk('Un mesero NO puede prender ORDEVA PLAY', r.st !== 200 && /sin_permiso/.test(err(r)), r);
  r = await rpc('play_config_guardar', { p_negocio: NEG, p_activo: true, p_juegos: ['show', 'bomba', 'impostor', 'ruleta', 'sobreviviente', 'hackeo'], p_retos: ['divertido', 'musica', 'beber'] }, dueno.token);
  chk('El dueño lo prende (los juegos y categorías raros no entran)', r.st === 200 && r.j.activo && r.j.juegos.length === 5 && !r.j.retos.includes('beber'), r);
  await rpc('play_config_guardar', { p_negocio: NEG2, p_activo: true, p_juegos: ['show'], p_retos: ['divertido'] }, otro.token);

  // ---------- Entrar ----------
  r = await rpc('play_entrar', { p_canal: C, p_mesa: 1, p_vm: 'codigofalso', p_alias: 'Ana' });
  chk('Con un código de mesa falso NO se entra', r.st !== 200 && /play_mesa/.test(err(r)), r);
  r = await rpc('play_entrar', { p_canal: C, p_mesa: 2, p_vm: 'm1codigo01', p_alias: 'Ana' });
  chk('Con el código de OTRA mesa tampoco', r.st !== 200 && /play_mesa/.test(err(r)), r);
  const entrar = async (mesa, alias, avatar) => (await rpc('play_entrar', { p_canal: C, p_mesa: mesa, p_vm: 'm' + mesa + 'codigo0' + mesa, p_alias: alias, p_avatar: avatar || '😎' })).j;
  const ana = await entrar(1, 'Ana'), beto = await entrar(1, 'Beto'), caro = await entrar(1, 'Caro'), dani = await entrar(2, 'Dani');
  chk('Con el código de su mesa entra sin registrarse y recibe un token', ana && ana.token && ana.token.length >= 40 && ana.jugador, ana);
  chk('El token se guarda cifrado (no se ve en la base de datos)', !(await sb.sql('select 1 from play_jugadores where token_h = $1', [ana.token])).length);
  const ana2 = (await rpc('play_entrar', { p_canal: C, p_mesa: 1, p_vm: 'm1codigo01', p_alias: 'Anita', p_token: ana.token })).j;
  chk('Si recarga la página con su token, sigue siendo el mismo jugador', ana2.jugador === ana.jugador, ana2);
  const zoe = (await rpc('play_entrar', { p_canal: C2, p_mesa: 1, p_vm: 'o1codigo01', p_alias: 'Zoe' })).j;

  // ---------- EL SHOW DE LA MESA ----------
  r = await rpc('play_crear', { p_token: ana.token, p_juego: 'show', p_modo: 'mesa' });
  const show = r.j && r.j.sala;
  chk('Ana crea una sala del SHOW con un código de 4 letras', show && /^[A-Z0-9]{4}$/.test(show.codigo) && show.anfitrion === true, r);
  r = await rpc('play_unirse', { p_token: zoe.token, p_codigo: show.codigo });
  chk('Un jugador de OTRO negocio no encuentra la sala', r.st !== 200 && /play_sala/.test(err(r)), r);
  r = await rpc('play_unirse', { p_token: dani.token, p_codigo: show.codigo });
  chk('Uno de OTRA mesa no entra a una sala «de mesa»', r.st !== 200 && /play_otra_mesa/.test(err(r)), r);
  r = await rpc('play_empezar', { p_token: ana.token, p_sala: show.id });
  chk('Solo no se puede empezar (mínimo 2)', r.st !== 200 && /play_pocos/.test(err(r)), r);
  await rpc('play_unirse', { p_token: beto.token, p_codigo: show.codigo });
  r = await rpc('play_empezar', { p_token: beto.token, p_sala: show.id });
  chk('Solo quien creó la sala la empieza', r.st !== 200 && /play_anfitrion/.test(err(r)), r);
  r = await rpc('play_empezar', { p_token: ana.token, p_sala: show.id });
  let v = r.j;
  chk('Empieza: pregunta 1 con 4 opciones y 20 s', v.sala.estado === 'jugando' && v.sala.fase === 'pregunta' && v.publico.opciones.length === 4 && v.sala.hasta - v.sala.ahora > 15000, v);
  chk('La respuesta correcta NO viaja al celular', !JSON.stringify(v).includes('correcta') && !JSON.stringify(v).includes('secreto'), v.publico);
  const corr = (await uno('select secreto->>\'correcta\' c from play_salas where id = $1', [show.id])).c | 0;
  r = await rpc('play_accion', { p_token: ana.token, p_sala: show.id, p_tipo: 'responder', p_dato: { i: corr }, p_cid: cid() });
  const pAna = (await uno('select puntos from play_miembros where sala_id = $1 and jugador_id = $2', [show.id, ana.jugador])).puntos;
  await rpc('play_accion', { p_token: ana.token, p_sala: show.id, p_tipo: 'responder', p_dato: { i: corr }, p_cid: cid() });
  chk('Responder bien da 100 + rapidez; responder otra vez no suma de nuevo', pAna >= 100 && (await uno('select puntos from play_miembros where sala_id = $1 and jugador_id = $2', [show.id, ana.jugador])).puntos === pAna, pAna);
  r = await rpc('play_accion', { p_token: beto.token, p_sala: show.id, p_tipo: 'responder', p_dato: { i: (corr + 1) % 4 }, p_cid: cid() });
  chk('Cuando todos respondieron: se muestra la correcta y cuántos eligieron cada una', r.j.sala.fase === 'resultado' && Number(r.j.publico.correcta) === corr && r.j.publico.conteo, r.j.publico);
  // Se acaba el tiempo del resultado → la siguiente pregunta. (Se adelanta el reloj en la base de datos.)
  const vencer = (id) => sb.sql("update play_salas set fase_hasta = now() - interval '1 second' where id = $1", [id]);
  await vencer(show.id); v = (await rpc('play_estado', { p_token: beto.token, p_sala: show.id })).j;
  chk('Al acabarse el tiempo sigue la pregunta 2', v.sala.ronda === 2 && v.sala.fase === 'pregunta', v.sala);
  await vencer(show.id);
  r = await rpc('play_accion', { p_token: beto.token, p_sala: show.id, p_tipo: 'responder', p_dato: { i: 0 }, p_cid: cid() });
  chk('Una respuesta fuera de tiempo no cuenta', !(await sb.sql('select 1 from play_eventos where sala_id = $1 and ronda = 2 and jugador_id = $2', [show.id, beto.jugador])).length && r.j.sala.fase === 'resultado', r.j.sala);
  for (let i = 0; i < 20 && v.sala.estado !== 'fin'; i++) { await vencer(show.id); v = (await rpc('play_estado', { p_token: ana.token, p_sala: show.id })).j; }
  chk('Después de 8 preguntas termina, con la tabla final', v.sala.estado === 'fin' && v.publico.final.length === 2 && v.publico.final[0].alias === 'Anita', v.publico);
  const pp = await sb.sql('select alias, puntos, gano from play_puntos where sala_id = $1 order by puntos desc', [show.id]);
  chk('Los puntos quedan una sola vez por jugador (Anita gana)', pp.length === 2 && pp[0].alias === 'Anita' && pp[0].gano === true, pp);

  // ---------- LA BOMBA ----------
  const bom = (await rpc('play_crear', { p_token: ana.token, p_juego: 'bomba' })).j.sala;
  await rpc('play_unirse', { p_token: beto.token, p_codigo: bom.codigo }); await rpc('play_unirse', { p_token: caro.token, p_codigo: bom.codigo });
  v = (await rpc('play_empezar', { p_token: ana.token, p_sala: bom.id })).j;
  chk('LA BOMBA: alguien tiene la bomba y una pregunta; la hora de la explosión NO se manda', v.sala.fase === 'bomba' && v.publico.portador && v.sala.hasta === null && v.publico.opciones.length === 4, v);
  const tokDe = { [ana.jugador]: ana.token, [beto.jugador]: beto.token, [caro.jugador]: caro.token };
  const port = v.publico.portador, cb = (await uno('select secreto->>\'correcta\' c from play_salas where id = $1', [bom.id])).c | 0;
  const noPort = Object.keys(tokDe).find((x) => x !== port);
  await rpc('play_accion', { p_token: tokDe[noPort], p_sala: bom.id, p_tipo: 'responder', p_dato: { i: 0 }, p_cid: cid() });
  chk('Quien no tiene la bomba no puede responder por el otro', (await uno('select publico->>\'portador\' p from play_salas where id = $1', [bom.id])).p === port);
  v = (await rpc('play_accion', { p_token: tokDe[port], p_sala: bom.id, p_tipo: 'responder', p_dato: { i: cb }, p_cid: cid() })).j;
  chk('Responder bien pasa la bomba a otro (+20)', v.publico.portador !== port && v.publico.pases === 1, v.publico);
  await vencer(bom.id); v = (await rpc('play_estado', { p_token: ana.token, p_sala: bom.id })).j;
  const perdio = v.publico.perdio;
  chk('¡Explota!: quien la tenía sale y le toca un reto (sin alcohol)', v.sala.fase === 'explota' && perdio && v.jugadores.find((x) => x.id === perdio).vivo === false && v.publico.reto && !/beb|trago|shot|alcohol|cerveza/i.test(v.publico.reto), v.publico);
  for (let i = 0; i < 12 && v.sala.estado !== 'fin'; i++) { await vencer(bom.id); v = (await rpc('play_estado', { p_token: ana.token, p_sala: bom.id })).j; }
  chk('Al final queda uno: gana con +200', v.sala.estado === 'fin' && v.jugadores.filter((x) => x.vivo).length === 1 && v.publico.final[0].puntos >= 200, v.publico);

  // ---------- EL IMPOSTOR ----------
  const imp = (await rpc('play_crear', { p_token: ana.token, p_juego: 'impostor' })).j.sala;
  await rpc('play_unirse', { p_token: beto.token, p_codigo: imp.codigo });
  r = await rpc('play_empezar', { p_token: ana.token, p_sala: imp.id });
  chk('EL IMPOSTOR necesita 3 o más', r.st !== 200 && /play_pocos/.test(err(r)), r);
  await rpc('play_unirse', { p_token: caro.token, p_codigo: imp.codigo });
  await rpc('play_empezar', { p_token: ana.token, p_sala: imp.id });
  const sec = await uno('select secreto from play_salas where id = $1', [imp.id]);
  const vistas = {}; for (const [jid, tk] of Object.entries(tokDe)) vistas[jid] = (await rpc('play_estado', { p_token: tk, p_sala: imp.id })).j;
  const impId = sec.secreto.impostor;
  chk('El impostor NO recibe la palabra (solo la categoría); los demás sí', vistas[impId].mio.rol === 'impostor' && !JSON.stringify(vistas[impId]).includes(sec.secreto.palabra) && Object.keys(vistas).filter((x) => x !== impId).every((x) => vistas[x].mio.palabra === sec.secreto.palabra), Object.fromEntries(Object.entries(vistas).map(([k, x]) => [k === impId ? 'imp' : 'civ', x.mio])));
  r = await rpc('play_accion', { p_token: tokDe[Object.keys(tokDe).find((x) => x !== impId)], p_sala: imp.id, p_tipo: 'pista', p_dato: { t: 'es ' + sec.secreto.palabra }, p_cid: cid() });
  chk('Una pista que dice la palabra no se acepta', r.st !== 200 && /play_pista_palabra/.test(err(r)), r);
  for (const [jid, tk] of Object.entries(tokDe)) await rpc('play_accion', { p_token: tk, p_sala: imp.id, p_tipo: 'pista', p_dato: { t: 'pista de ' + jid.slice(0, 4) }, p_cid: cid() });
  v = (await rpc('play_estado', { p_token: ana.token, p_sala: imp.id })).j;
  chk('Con todas las pistas se pasa a votar y se ven las pistas', v.sala.fase === 'votar' && v.publico.pistas.length === 3, v.publico);
  r = await rpc('play_accion', { p_token: ana.token, p_sala: imp.id, p_tipo: 'votar', p_dato: { j: ana.jugador }, p_cid: cid() });
  chk('Nadie vota por sí mismo', r.st !== 200, r);
  for (const [jid, tk] of Object.entries(tokDe)) { const a = jid === impId ? Object.keys(tokDe).find((x) => x !== impId) : impId; await rpc('play_accion', { p_token: tk, p_sala: imp.id, p_tipo: 'votar', p_dato: { j: a }, p_cid: cid() }); }
  v = (await rpc('play_estado', { p_token: ana.token, p_sala: imp.id })).j;
  chk('Lo descubren: gana el grupo, se revela quién era y la palabra', v.sala.fase === 'resultado' && v.publico.ganan === 'grupo' && v.publico.impostor === impId && v.publico.palabra === sec.secreto.palabra, v.publico);
  for (let i = 0; i < 8 && v.sala.estado !== 'fin'; i++) { await vencer(imp.id); v = (await rpc('play_estado', { p_token: ana.token, p_sala: imp.id })).j; }
  chk('Dos rondas y termina', v.sala.estado === 'fin', v.sala);

  // ---------- RULETA DEL CAOS ----------
  const rul = (await rpc('play_crear', { p_token: ana.token, p_juego: 'ruleta' })).j.sala;
  await rpc('play_unirse', { p_token: beto.token, p_codigo: rul.codigo });
  await rpc('play_empezar', { p_token: ana.token, p_sala: rul.id });
  v = (await rpc('play_accion', { p_token: beto.token, p_sala: rul.id, p_tipo: 'girar', p_dato: {}, p_cid: cid() })).j;
  chk('RULETA: gira, elige a alguien y un reto de las categorías del negocio (sin alcohol)', v.sala.fase === 'reto' && v.publico.elegido && v.publico.reto && !/beb|trago|shot|alcohol/i.test(v.publico.reto), v.publico);
  const eleg = v.publico.elegido, tkE = eleg === ana.jugador ? ana.token : beto.token, tkO = eleg === ana.jugador ? beto.token : ana.token;
  const reto1 = v.publico.reto;
  v = (await rpc('play_accion', { p_token: tkE, p_sala: rul.id, p_tipo: 'cambiar', p_dato: {}, p_cid: cid() })).j;
  chk('Puede cambiar el reto una vez', v.publico.cambio === false && v.sala.fase === 'reto', v.publico);
  await rpc('play_accion', { p_token: tkO, p_sala: rul.id, p_tipo: 'aplaudir', p_dato: {}, p_cid: cid() });
  v = (await rpc('play_accion', { p_token: tkE, p_sala: rul.id, p_tipo: 'cumplir', p_dato: {}, p_cid: cid() })).j;
  chk('Lo cumple: +100 y +10 por el aplauso', v.sala.fase === 'resultado' && v.jugadores.find((x) => x.id === eleg).puntos === 110, v.jugadores);

  // ---------- ÚLTIMO SOBREVIVIENTE ----------
  const sob = (await rpc('play_crear', { p_token: ana.token, p_juego: 'sobreviviente', p_modo: 'local' })).j.sala;
  r = await rpc('play_salas_abiertas', { p_token: dani.token });
  chk('Una sala «de todo el local» la ven las otras mesas', (r.j || []).some((x) => x.id === sob.id), r);
  await rpc('play_unirse', { p_token: dani.token, p_codigo: sob.codigo }); await rpc('play_unirse', { p_token: beto.token, p_codigo: sob.codigo });
  await rpc('play_empezar', { p_token: ana.token, p_sala: sob.id });
  let cs = (await uno('select secreto->>\'correcta\' c from play_salas where id = $1', [sob.id])).c | 0;
  await rpc('play_accion', { p_token: ana.token, p_sala: sob.id, p_tipo: 'responder', p_dato: { i: cs }, p_cid: cid() });
  await rpc('play_accion', { p_token: dani.token, p_sala: sob.id, p_tipo: 'responder', p_dato: { i: cs }, p_cid: cid() });
  v = (await rpc('play_accion', { p_token: beto.token, p_sala: sob.id, p_tipo: 'responder', p_dato: { i: (cs + 1) % 4 }, p_cid: cid() })).j;
  chk('SOBREVIVIENTE: quien falla sale (Beto); los que aciertan siguen (+30)', v.sala.fase === 'resultado' && v.publico.fuera.includes(beto.jugador) && v.jugadores.filter((x) => x.vivo).length === 2, v.publico);
  await vencer(sob.id); v = (await rpc('play_estado', { p_token: ana.token, p_sala: sob.id })).j;
  cs = (await uno('select secreto->>\'correcta\' c from play_salas where id = $1', [sob.id])).c | 0;
  await rpc('play_accion', { p_token: ana.token, p_sala: sob.id, p_tipo: 'responder', p_dato: { i: (cs + 1) % 4 }, p_cid: cid() });
  v = (await rpc('play_accion', { p_token: dani.token, p_sala: sob.id, p_tipo: 'responder', p_dato: { i: (cs + 2) % 4 }, p_cid: cid() })).j;
  chk('Si todos fallan, nadie sale en esa ronda', v.publico.fuera.length === 0 && v.jugadores.filter((x) => x.vivo).length === 2, v.publico);
  await vencer(sob.id); await rpc('play_estado', { p_token: ana.token, p_sala: sob.id });
  cs = (await uno('select secreto->>\'correcta\' c from play_salas where id = $1', [sob.id])).c | 0;
  await rpc('play_accion', { p_token: dani.token, p_sala: sob.id, p_tipo: 'responder', p_dato: { i: cs }, p_cid: cid() });
  await vencer(sob.id); v = (await rpc('play_estado', { p_token: ana.token, p_sala: sob.id })).j;
  chk('Quien no responde a tiempo sale (Ana)', v.publico.fuera && v.publico.fuera.includes(ana.jugador), v.publico);
  await vencer(sob.id); v = (await rpc('play_estado', { p_token: ana.token, p_sala: sob.id })).j;
  chk('Queda uno solo: Dani gana (de otra mesa, modo «todo el local»)', v.sala.estado === 'fin' && v.publico.final[0].alias === 'Dani', v.publico);

  // ---------- Clasificación ----------
  r = await rpc('play_ranking', { p_token: dani.token });
  chk('La clasificación del día trae jugadores y mesas del negocio', r.st === 200 && r.j.jugadores.length >= 3 && r.j.mesas.length >= 2, r.j);
  r = await rpc('play_ranking', { p_token: zoe.token });
  chk('… y el otro negocio no ve los puntos de este', r.st === 200 && r.j.jugadores.length === 0, r.j);
  r = await rpc('play_config_ver', { p_negocio: NEG }, mesero.token);
  chk('El equipo del negocio ve las partidas y jugadores de hoy', r.st === 200 && r.j.hoy.partidas >= 4 && r.j.hoy.jugadores >= 4, r.j && r.j.hoy);
  r = await rpc('play_config_ver', { p_negocio: NEG }, otro.token);
  chk('Otro negocio no ve la configuración ni las estadísticas', r.st !== 200, r);
  r = await rpc('play_estado', { p_token: zoe.token, p_sala: show.id });
  chk('Un jugador de otro negocio no puede ver una sala ajena', r.st !== 200 && /play_sala/.test(err(r)), r);
  r = await rpc('play_estado', { p_token: 'tokenfalsotokenfalsotokenfalso', p_sala: show.id });
  chk('Sin un token válido no se ve nada', r.st !== 200 && /play_sesion/.test(err(r)), r);
  const filas = await sb.sql("select count(*)::int n from play_retos where texto ~* 'beb|trago|shot|alcohol|cerveza|emborrach'");
  chk('Ningún reto habla de beber', filas[0].n === 0, filas);
  r = await fetch(sb.url + '/rest/v1/play_salas?select=*', { headers: cab() });
  chk('Las tablas no se leen directo (sin pasar por las funciones)', r.status >= 400 || (await r.json()).length === 0, r.status);
}

(async () => {
  let sb = null;
  try { sb = await iniciar(); await pruebas(sb); }
  catch (e) { mal++; console.log('❌ Error inesperado → ' + (e && e.stack || e)); }
  finally { if (sb) await sb.cerrar().catch(() => {}); }
  console.log('RESULTADO', ok, 'bien', mal, 'mal');
  process.exit(mal ? 1 : 0);
})();
