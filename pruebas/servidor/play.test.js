// Pruebas del SERVIDOR · ORDEVA PLAY Fase 1 (migración 20261203000000_play), contra PostgreSQL REAL.
//  • Entrar sin registrarse: con el canal del negocio y el código secreto de SU mesa; con un código malo, no. Apagado por
//    defecto: el negocio lo prende (solo dueño o administrador).
//  • Aislamiento: un jugador de otro negocio no ve ni entra a las salas; un jugador de otra mesa no entra a una sala «mesa».
//  • El servidor manda: la respuesta correcta nunca llega al celular, una jugada por ronda (un reintento no suma dos veces),
//    fuera de tiempo no cuenta, los puntos los calcula el servidor y quedan una sola vez al terminar.
//  • Los 5 juegos de punta a punta: EL SHOW DE LA MESA, LA BOMBA, EL IMPOSTOR, RULETA DEL CAOS y ÚLTIMO SOBREVIVIENTE.
//  • Retos sin alcohol (ni brindis).
//  • Revisión goldfish (puente/egm/REVISION-GOLDFISH-PLAY.md): PLAY no escribe en canal_mensajes; el impostor no puede
//    descubrir la palabra con las pistas; salir solo si está en la sala; límite de jugadas (también las que no valen);
//    la bomba no se gana adivinando; quien sale no cuenta; la ruleta no da puntos por decir «lo hice»; modo «todo el
//    local» apagado por defecto; avatar de la lista y apodos sin groserías; versión corta si nada cambió; el anfitrión
//    ausente pasa la sala; apagar PLAY termina las partidas; limpieza con pg_cron.
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
  // El límite de jugadas (25 cada 10 s por jugador) se reinicia entre partes: la prueba va mucho más rápido que una persona.
  const respiro = () => sb.sql('update play_jugadores set cupo_n = 0');
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
  const raro = (await rpc('play_entrar', { p_canal: C, p_mesa: 3, p_vm: 'm3codigo03', p_alias: 'hijueputa', p_avatar: '<img src=x>' })).j;
  const raroV = await uno('select alias, avatar from play_jugadores where id = $1', [raro.jugador]);
  chk('Un apodo grosero queda como «Jugador» y un avatar que no es de la lista queda 🙂', raroV.alias === 'Jugador' && raroV.avatar === '🙂', raroV);
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
  const pq = await uno('select opciones, correcta from play_preguntas where q = $1', [v.publico.q]);
  chk('Las opciones salen revueltas y la correcta sigue siendo la misma', pq && v.publico.opciones[corr] === pq.opciones[pq.correcta] && [...v.publico.opciones].sort().join() === [...pq.opciones].sort().join(), { pub: v.publico.opciones, corr, pq });
  r = await rpc('play_estado', { p_token: beto.token, p_sala: show.id, p_ver: v.sala.version });
  chk('Si nada cambió, play_estado responde corto (sin toda la vista)', r.j && r.j.igual === true && !r.j.sala, r.j);
  r = await rpc('play_accion', { p_token: ana.token, p_sala: show.id, p_tipo: 'responder', p_dato: { i: corr }, p_cid: cid() });
  chk('Mientras la pregunta está abierta no se dice si acertó (no sirve para probar opciones)', r.j.sala.fase === 'pregunta' && r.j.mio.hecho === true && r.j.mio.acerte === false, r.j.mio);
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
  await respiro();
  const bom = (await rpc('play_crear', { p_token: ana.token, p_juego: 'bomba' })).j.sala;
  await rpc('play_unirse', { p_token: beto.token, p_codigo: bom.codigo }); await rpc('play_unirse', { p_token: caro.token, p_codigo: bom.codigo });
  v = (await rpc('play_empezar', { p_token: ana.token, p_sala: bom.id })).j;
  chk('LA BOMBA: alguien tiene la bomba y una pregunta; la hora de la explosión NO se manda', v.sala.fase === 'bomba' && v.publico.portador && v.sala.hasta === null && v.publico.opciones.length === 4, v);
  const tokDe = { [ana.jugador]: ana.token, [beto.jugador]: beto.token, [caro.jugador]: caro.token };
  const port = v.publico.portador, cb = (await uno('select secreto->>\'correcta\' c from play_salas where id = $1', [bom.id])).c | 0;
  const noPort = Object.keys(tokDe).find((x) => x !== port);
  await rpc('play_accion', { p_token: tokDe[noPort], p_sala: bom.id, p_tipo: 'responder', p_dato: { i: 0 }, p_cid: cid() });
  chk('Quien no tiene la bomba no puede responder por el otro', (await uno('select publico->>\'portador\' p from play_salas where id = $1', [bom.id])).p === port);
  const q0 = v.publico.q, n0 = v.publico.n;
  v = (await rpc('play_accion', { p_token: tokDe[port], p_sala: bom.id, p_tipo: 'responder', p_dato: { i: (cb + 1) % 4, n: n0 }, p_cid: cid() })).j;
  chk('LA BOMBA: si falla, sigue la MISMA pregunta y queda 3 s bloqueado', v.publico.portador === port && v.publico.q === q0 && v.publico.n === n0 && v.publico.bloqueo > v.sala.ahora + 2000, v.publico);
  v = (await rpc('play_accion', { p_token: tokDe[port], p_sala: bom.id, p_tipo: 'responder', p_dato: { i: cb, n: n0 }, p_cid: cid() })).j;
  chk('… y mientras está bloqueado, ni la correcta pasa la bomba (adivinar rápido no sirve)', v.publico.portador === port, v.publico);
  await sb.sql("update play_salas set publico = publico - 'bloqueo' where id = $1", [bom.id]);
  v = (await rpc('play_accion', { p_token: tokDe[port], p_sala: bom.id, p_tipo: 'responder', p_dato: { i: cb, n: n0 - 1 }, p_cid: cid() })).j;
  chk('Una respuesta a una pregunta vieja (pantalla atrasada) no cuenta', v.publico.portador === port, v.publico);
  v = (await rpc('play_accion', { p_token: tokDe[port], p_sala: bom.id, p_tipo: 'responder', p_dato: { i: cb, n: n0 }, p_cid: cid() })).j;
  chk('Responder bien pasa la bomba a otro (+20)', v.publico.portador !== port && v.publico.pases === 1, v.publico);
  await vencer(bom.id); v = (await rpc('play_estado', { p_token: ana.token, p_sala: bom.id })).j;
  const perdio = v.publico.perdio;
  chk('¡Explota!: quien la tenía sale y le toca un reto (sin alcohol)', v.sala.fase === 'explota' && perdio && v.jugadores.find((x) => x.id === perdio).vivo === false && v.publico.reto && !/beb|trago|shot|alcohol|cerveza/i.test(v.publico.reto), v.publico);
  for (let i = 0; i < 12 && v.sala.estado !== 'fin'; i++) { await vencer(bom.id); v = (await rpc('play_estado', { p_token: ana.token, p_sala: bom.id })).j; }
  chk('Al final queda uno: gana con +200', v.sala.estado === 'fin' && v.jugadores.filter((x) => x.vivo).length === 1 && v.publico.final[0].puntos >= 200, v.publico);

  // ---------- EL IMPOSTOR ----------
  await respiro();
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
  const civ1 = Object.keys(tokDe).find((x) => x !== impId);
  const sinTilde = sec.secreto.palabra.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().split('').join('-');
  r = await rpc('play_accion', { p_token: tokDe[civ1], p_sala: imp.id, p_tipo: 'pista', p_dato: { t: 'es ' + sinTilde }, p_cid: cid() });
  chk('Una pista que dice la palabra no se acepta (también sin tildes, en mayúscula o con guiones)', r.st === 200 && r.j.error === 'play_pista_palabra' && !r.j.mio.hecho, { t: sinTilde, e: r.j && r.j.error });
  r = await rpc('play_accion', { p_token: tokDe[civ1], p_sala: imp.id, p_tipo: 'pista', p_dato: { t: 'qué mierda' }, p_cid: cid() });
  chk('Una pista grosera no se acepta', r.j && r.j.error === 'play_grosero', r.j && r.j.error);
  const guess = (await uno('select string_agg(palabra, \' \') g from (select palabra from play_palabras where categoria = $1 limit 3) x', [sec.secreto.cat])).g;
  r = await rpc('play_accion', { p_token: tokDe[impId], p_sala: imp.id, p_tipo: 'pista', p_dato: { t: sec.secreto.palabra }, p_cid: cid() });
  chk('Al impostor NO se le revisa la pista: no puede descubrir la palabra probando (no hay error que la delate)', r.st === 200 && !r.j.error && r.j.mio.hecho === true, r.j && { e: r.j.error, m: r.j.mio, guess });
  chk('Las pistas se ven a medida que llegan', (r.j.publico.pistas || []).length === 1, r.j.publico);
  for (const [jid, tk] of Object.entries(tokDe)) await rpc('play_accion', { p_token: tk, p_sala: imp.id, p_tipo: 'pista', p_dato: { t: 'pista de ' + jid.slice(0, 4) }, p_cid: cid() });
  v = (await rpc('play_estado', { p_token: ana.token, p_sala: imp.id })).j;
  chk('Con todas las pistas se pasa a votar y se ven las pistas', v.sala.fase === 'votar' && v.publico.pistas.length === 3, v.publico);
  r = await rpc('play_accion', { p_token: ana.token, p_sala: imp.id, p_tipo: 'votar', p_dato: { j: ana.jugador }, p_cid: cid() });
  chk('Nadie vota por sí mismo', r.j && r.j.error === 'play_jugada' && !r.j.mio.hecho, r.j && r.j.error);
  for (const [jid, tk] of Object.entries(tokDe)) { const a = jid === impId ? Object.keys(tokDe).find((x) => x !== impId) : impId; await rpc('play_accion', { p_token: tk, p_sala: imp.id, p_tipo: 'votar', p_dato: { j: a }, p_cid: cid() }); }
  v = (await rpc('play_estado', { p_token: ana.token, p_sala: imp.id })).j;
  chk('Lo descubren: gana el grupo, se revela quién era y la palabra', v.sala.fase === 'resultado' && v.publico.ganan === 'grupo' && v.publico.impostor === impId && v.publico.palabra === sec.secreto.palabra, v.publico);
  for (let i = 0; i < 8 && v.sala.estado !== 'fin'; i++) { await vencer(imp.id); v = (await rpc('play_estado', { p_token: ana.token, p_sala: imp.id })).j; }
  chk('Tres rondas y termina', v.sala.estado === 'fin' && v.sala.ronda === 3, v.sala);

  // ---------- RULETA DEL CAOS ----------
  await respiro();
  const rul = (await rpc('play_crear', { p_token: ana.token, p_juego: 'ruleta' })).j.sala;
  await rpc('play_unirse', { p_token: beto.token, p_codigo: rul.codigo });
  await rpc('play_empezar', { p_token: ana.token, p_sala: rul.id });
  v = (await rpc('play_accion', { p_token: beto.token, p_sala: rul.id, p_tipo: 'girar', p_dato: {}, p_cid: cid() })).j;
  chk('RULETA: gira, elige a alguien y un reto de las categorías del negocio (sin alcohol)', v.sala.fase === 'reto' && v.publico.elegido && v.publico.reto && !/beb|trago|shot|alcohol/i.test(v.publico.reto), v.publico);
  const eleg = v.publico.elegido, tkE = eleg === ana.jugador ? ana.token : beto.token, tkO = eleg === ana.jugador ? beto.token : ana.token;
  const reto1 = v.publico.reto;
  v = (await rpc('play_accion', { p_token: tkE, p_sala: rul.id, p_tipo: 'cambiar', p_dato: {}, p_cid: cid() })).j;
  chk('Puede cambiar el reto una vez', v.publico.cambio === false && v.sala.fase === 'reto', v.publico);
  v = (await rpc('play_accion', { p_token: tkE, p_sala: rul.id, p_tipo: 'cumplir', p_dato: {}, p_cid: cid() })).j;
  chk('Decir «¡lo hice!» NO da puntos solo (los puntos los dan los demás)', v.sala.fase === 'resultado' && v.publico.hizo === 'cumplir' && v.jugadores.find((x) => x.id === eleg).puntos === 0, v.jugadores);
  await rpc('play_accion', { p_token: tkO, p_sala: rul.id, p_tipo: 'aplaudir', p_dato: {}, p_cid: cid() });
  v = (await rpc('play_accion', { p_token: tkO, p_sala: rul.id, p_tipo: 'aplaudir', p_dato: {}, p_cid: cid() })).j;
  chk('Cada uno de los demás aplaude una vez: +25', v.jugadores.find((x) => x.id === eleg).puntos === 25, v.jugadores);
  r = await rpc('play_accion', { p_token: tkE, p_sala: rul.id, p_tipo: 'aplaudir', p_dato: {}, p_cid: cid() });
  chk('Nadie se aplaude a sí mismo', r.j.jugadores.find((x) => x.id === eleg).puntos === 25, r.j.jugadores);

  // ---------- ÚLTIMO SOBREVIVIENTE ----------
  await respiro();
  r = await rpc('play_crear', { p_token: ana.token, p_juego: 'sobreviviente', p_modo: 'local' });
  chk('«Contra otras mesas» viene apagado: no se puede crear una sala de todo el local', r.st !== 200 && /play_local/.test(err(r)), r);
  r = await rpc('play_config_guardar', { p_negocio: NEG, p_activo: true, p_juegos: ['show', 'bomba', 'impostor', 'ruleta', 'sobreviviente'], p_retos: ['divertido', 'musica'], p_local: true }, dueno.token);
  chk('El dueño prende «contra otras mesas»', r.st === 200 && r.j.local === true, r.j);
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

  // ---------- Quien sale de la partida ----------
  await respiro();
  const sh2 = (await rpc('play_crear', { p_token: ana.token, p_juego: 'show' })).j.sala;
  await rpc('play_unirse', { p_token: beto.token, p_codigo: sh2.codigo }); await rpc('play_unirse', { p_token: caro.token, p_codigo: sh2.codigo });
  const ver0 = (await uno('select version from play_salas where id = $1', [sh2.id])).version;
  r = await rpc('play_salir', { p_token: dani.token, p_sala: sh2.id });
  chk('Quien NO está en la sala no la puede tocar con «salir»', (await uno('select version from play_salas where id = $1', [sh2.id])).version === ver0, r.j);
  await rpc('play_empezar', { p_token: ana.token, p_sala: sh2.id });
  await rpc('play_accion', { p_token: ana.token, p_sala: sh2.id, p_tipo: 'responder', p_dato: { i: 0 }, p_cid: cid() });
  await rpc('play_salir', { p_token: ana.token, p_sala: sh2.id });
  r = await rpc('play_accion', { p_token: ana.token, p_sala: sh2.id, p_tipo: 'responder', p_dato: { i: 1 }, p_cid: cid() });
  v = (await rpc('play_accion', { p_token: beto.token, p_sala: sh2.id, p_tipo: 'responder', p_dato: { i: 0 }, p_cid: cid() })).j;
  chk('Quien salió no cuenta: con su respuesta y la de Beto NO se cierra la pregunta (falta Caro)', v.sala.fase === 'pregunta', v.sala);
  v = (await rpc('play_accion', { p_token: caro.token, p_sala: sh2.id, p_tipo: 'responder', p_dato: { i: 0 }, p_cid: cid() })).j;
  chk('… y cuando responden los que siguen, se cierra', v.sala.fase === 'resultado', v.sala);
  const bo2 = (await rpc('play_crear', { p_token: ana.token, p_juego: 'bomba' })).j.sala;
  await rpc('play_unirse', { p_token: beto.token, p_codigo: bo2.codigo }); await rpc('play_unirse', { p_token: caro.token, p_codigo: bo2.codigo });
  v = (await rpc('play_empezar', { p_token: ana.token, p_sala: bo2.id })).j;
  const p2 = v.publico.portador; await rpc('play_salir', { p_token: tokDe[p2], p_sala: bo2.id });
  v = (await rpc('play_estado', { p_token: tokDe[Object.keys(tokDe).find((x) => x !== p2)], p_sala: bo2.id })).j;
  chk('Si quien tiene la bomba se va, la bomba pasa a otro', v.sala.fase === 'bomba' && v.publico.portador && v.publico.portador !== p2, v.publico);
  const lob = (await rpc('play_crear', { p_token: ana.token, p_juego: 'show' })).j.sala;
  await rpc('play_unirse', { p_token: beto.token, p_codigo: lob.codigo });
  await sb.sql("update play_jugadores set visto = now() - interval '2 minutes' where id = $1", [ana.jugador]);
  v = (await rpc('play_estado', { p_token: beto.token, p_sala: lob.id })).j;
  chk('Si quien creó la sala lleva más de 60 s sin aparecer, la puede empezar el siguiente', v.sala.anfitrion === true, v.sala);
  await respiro();
  let lim = 0; for (let i = 0; i < 32; i++) { const x = await rpc('play_accion', { p_token: caro.token, p_sala: sh2.id, p_tipo: 'nada', p_dato: {}, p_cid: cid() }); if (/demasiados/.test(err(x))) lim++; }
  chk('Límite de jugadas: también cuentan las que no hacen nada (25 cada 10 s)', lim >= 5, lim);

  // ---------- Clasificación ----------
  await respiro();
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
  const filas = await sb.sql("select count(*)::int n from play_retos where texto ~* 'beb|trago|shot|alcohol|cerveza|emborrach|brind|tomando|licor|guaro|aguardiente'");
  chk('Ningún reto habla de beber ni de brindar', filas[0].n === 0, filas);
  const loc = await uno("select count(*) filter (where public.play_reto($1, 'local') ~* '(mesa|derecha)')::int malos from generate_series(1, 300)", [NEG]);
  chk('En «todo el local» no salen retos de «tu mesa» o «tu derecha»', loc.malos === 0 && (await uno('select count(*)::int n from play_retos where solo_mesa')).n > 0, loc);
  const cm = await uno("select count(*)::int n from canal_mensajes where canal like 'ply%'");
  chk('PLAY no escribió NI UN mensaje en canal_mensajes (no le quita cupo a los pedidos)', cm.n === 0, cm);
  r = await rpc('play_config_guardar', { p_negocio: NEG, p_activo: true, p_juegos: [], p_retos: ['divertido'] }, dueno.token);
  chk('No se puede prender sin ningún juego', r.st !== 200 && /play_sin_juegos/.test(err(r)), r);
  const abiertas = (await sb.sql("select count(*)::int n from play_salas where negocio_id = $1 and estado <> 'fin'", [NEG]))[0].n;
  await rpc('play_config_guardar', { p_negocio: NEG, p_activo: false, p_juegos: ['show'], p_retos: ['divertido'] }, dueno.token);
  const quedan = (await sb.sql("select count(*)::int n from play_salas where negocio_id = $1 and estado <> 'fin'", [NEG]))[0].n;
  chk('Apagar PLAY termina las partidas abiertas', abiertas > 0 && quedan === 0, { abiertas, quedan });
  await sb.sql("update play_jugadores set creado = now() - interval '3 days' where id = $1", [raro.jugador]);
  await sb.sql("insert into play_puntos(negocio_id, sala_id, jugador_id, alias, mesa, juego, puntos, creado) values ($1, gen_random_uuid(), gen_random_uuid(), 'viejo', 1, 'show', 10, now() - interval '100 days')", [NEG]);
  const lp = await uno('select public.play_limpiar() r');
  chk('La limpieza borra jugadores de hace más de 2 días y puntos de más de 90 días', lp.r.jugadores_borrados >= 1 && lp.r.puntos_borrados >= 1 && !(await sb.sql('select 1 from play_jugadores where id = $1', [raro.jugador])).length, lp.r);
  r = await rpc('play_limpiar', {});
  chk('La limpieza no la puede llamar un cliente', r.st !== 200, r.st);
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
