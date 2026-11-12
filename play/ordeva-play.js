/* =====================================================================
   ORDEVA PLAY · el cliente (pedido.html → pestaña «🎮 Play»). Se carga SOLO al tocar la pestaña: el menú y los pedidos no
   cargan nada de esto.
   • El servidor manda (supabase/migrations/20261203000000_play.sql): este archivo solo muestra la vista que le da el
     servidor y manda jugadas. Las respuestas correctas, el tiempo, los puntos y quién gana los decide el servidor.
   • Entrar sin registrarse: alias + avatar; el token temporal queda en este celular (12 h).
   • Al día con la sala: pregunta play_estado con la versión que ya tiene (si nada cambió, la respuesta es corta), una
     pregunta a la vez, cada 2 s jugando y cada 3,5 s en la sala de espera. No pregunta si la pestaña Play no se ve o el
     celular está bloqueado, y deja de preguntar cuando la partida termina. PLAY no usa los canales de los pedidos.
   • Cada jugada lleva un id único (un doble toque o un reintento no cuenta dos veces) y la ronda que vio el jugador
     (una jugada hecha en una pantalla vieja no cuenta).
   ===================================================================== */
(function(){
  'use strict';
  if(window.ordevaPlay) return;
  const JUEGOS = {
    show: { ic: '🎤', n: 'El Show de la Mesa', d: 'Preguntas rápidas: el que responde bien y más rápido gana más puntos.', min: 2, como: ['Sale una pregunta con 4 opciones.', 'Tienes 20 segundos: entre más rápido, más puntos.', '8 preguntas y gana quien más sume.'] },
    bomba: { ic: '💣', n: 'La Bomba', d: 'Responde bien para pasar la bomba antes de que explote.', min: 2, como: ['Si tienes la bomba, responde la cuenta para pasarla.', 'Si fallas, sale otra cuenta y esperas 3 segundos.', 'Nadie sabe cuándo explota.', 'A quien le explota, sale y le toca un reto (puede pasar).'] },
    impostor: { ic: '🕵️', n: 'El Impostor', d: 'Todos tienen la palabra secreta menos uno. ¿Quién es?', min: 3, como: ['Cada uno da una pista de la palabra, sin decirla.', 'El impostor no la sabe: tiene que disimular.', 'Voten quién es el impostor.'] },
    ruleta: { ic: '🎡', n: 'Ruleta del Caos', d: 'La ruleta elige a alguien y un reto divertido.', min: 2, como: ['Gira la ruleta: elige a una persona y un reto.', 'Puede cumplirlo, cambiarlo una vez o pasar.', 'Si lo cumple, los demás aplauden: cada aplauso le da puntos.'] },
    sobreviviente: { ic: '🏆', n: 'Último Sobreviviente', d: 'Cada ronda más rápida. Quien falla, sale. Gana el último.', min: 2, como: ['Sale un reto de cálculo con 4 opciones.', 'Si fallas o no respondes a tiempo, quedas fuera.', 'Cada ronda hay menos tiempo.'] }
  };
  const AVATARES = ['😎', '🦁', '🐯', '🦊', '🐼', '🐸', '🦄', '🐙', '🤖', '👽', '🎃', '🌟'];
  const ERRORES = {
    play_no_disponible: 'ORDEVA PLAY no está activo en este local.', play_mesa: 'Este QR no es de una mesa reconocida. Pídele al mesero el QR de tu mesa.',
    play_sesion: 'Tu sesión de juego se venció. Vuelve a entrar.', play_sala: 'No encontramos esa sala. Revisa el código.', play_otra_mesa: 'Esa sala es de otra mesa.',
    play_empezo: 'Esa partida ya empezó. Espera a la próxima.', play_llena: 'La sala está llena (12 jugadores).', play_pocos: 'Faltan jugadores para empezar.',
    play_anfitrion: 'Solo quien creó la sala la puede empezar.', play_pista_palabra: '¡No digas la palabra! Da otra pista.', play_juego: 'Ese juego no está disponible aquí.',
    play_grosero: 'Esa pista tiene una grosería. Da otra.', play_local: 'Este local no tiene activado jugar contra otras mesas.',
    play_lleno: 'Hay muchas salas abiertas en el local. Únete a una o espera un momento.', play_jugada: 'Esa jugada no vale. Intenta otra vez.',
    demasiados: 'Vas muy rápido: espera un momento.'
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nube = () => { let c = null; try{ c = JSON.parse(localStorage.getItem('vento_nube_cfg') || 'null'); }catch(e){} if(!c || !c.url || !c.key) c = window.VENTO_NUBE_DEFAULT || null; return c && c.url && c.key ? { url: String(c.url).replace(/\/+$/, ''), key: c.key } : null; };
  // Cada llamada tiene 8 s; si no hay internet se ve el aviso «Sin conexión» hasta que vuelva.
  let fallos = 0;
  async function rpc(fn, args){
    const c = nube(); if(!c) throw new Error('Sin conexión con ORDEVA.');
    const ac = typeof AbortController !== 'undefined' ? new AbortController() : null, to = ac ? setTimeout(() => ac.abort(), 8000) : null;
    let r, t;
    try{
      r = await fetch(c.url + '/rest/v1/rpc/' + fn, { method: 'POST', cache: 'no-store', signal: ac ? ac.signal : undefined, headers: { apikey: c.key, Authorization: 'Bearer ' + c.key, 'Content-Type': 'application/json' }, body: JSON.stringify(args || {}) });
      t = await r.text();
    }catch(e){ fallos++; sinRed(); const x = new Error('Sin conexión. Revisa el internet.'); x.codigo = 'red'; throw x; }
    finally{ if(to) clearTimeout(to); }
    if(fallos){ fallos = 0; sinRed(); }
    let j = null; try{ j = t ? JSON.parse(t) : null; }catch(e){}
    if(!r.ok){ const m = (j && (j.message || j.hint)) || ('HTTP ' + r.status); const k = Object.keys(ERRORES).find(x => m.indexOf(x) >= 0); const e = new Error(k ? ERRORES[k] : 'No se pudo: ' + m); e.codigo = k || ''; throw e; }
    // El servidor contesta {error: …} (sin lanzar error, para que su límite de llamadas sí cuente): aquí se vuelve un error.
    // Una jugada que no vale trae la vista Y el error: esa la maneja jugar().
    if(j && typeof j.error === 'string' && !j.sala){ const e = new Error(ERRORES[j.error] || ERRORES.play_jugada); e.codigo = j.error; throw e; }
    return j;
  }
  const cid = () => 'j' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  let ctx = null, root = null, st = { token: null, jugador: null, juegos: [], local: false, sala: null, vista: null, desfase: 0, ver: 0 }, poll = null, reloj = null, ocupado = false, pidiendo = false, completa = 0, ultimoTick = 0;
  const KEY = () => 'play_' + (ctx && ctx.c) + '_' + (ctx && ctx.mesa);
  const guardar = () => { try{ localStorage.setItem(KEY(), JSON.stringify({ token: st.token, jugador: st.jugador, alias: st.alias, avatar: st.avatar, sala: st.sala, local: st.local })); }catch(e){} };
  const leer = () => { try{ return JSON.parse(localStorage.getItem(KEY()) || 'null'); }catch(e){ return null; } };

  function sinRed(){
    const b = root && root.querySelector('.pl-off'); if(!b) return;
    b.hidden = !(fallos >= 2 || (typeof navigator !== 'undefined' && navigator.onLine === false));
  }
  try{ window.addEventListener('online', () => { fallos = 0; sinRed(); refrescar(true); }); window.addEventListener('offline', sinRed); }catch(e){}
  function aviso(msg, malo){ const b = root.querySelector('.pl-aviso'); if(!b) return; b.textContent = msg || ''; b.className = 'pl-aviso' + (malo ? ' malo' : ''); b.hidden = !msg; if(msg) clearTimeout(aviso._t), aviso._t = setTimeout(() => { b.hidden = true; }, 5000); }
  function pintar(html){ root.innerHTML = '<div class="pl"><div class="pl-off" role="status" hidden>📡 Sin conexión… reintentando</div><div class="pl-aviso" role="status" aria-live="polite" hidden></div>' + html + '</div>'; sinRed(); }

  // ---------- Entrar (alias y avatar) ----------
  function pantallaEntrar(prev){
    const av = (prev && prev.avatar) || AVATARES[Math.floor(Math.random() * AVATARES.length)];
    pintar('<div class="pl-hero"><div class="pl-logo">🎮</div><h2>ORDEVA PLAY</h2><p>Juega con tu mesa o contra las otras mesas. Sin registrarte.</p></div>' +
      '<label class="pl-lbl" for="plAlias">¿Cómo te llamamos?</label><input id="plAlias" class="pl-in" maxlength="20" autocomplete="off" placeholder="Tu apodo" value="' + esc((prev && prev.alias) || '') + '">' +
      '<div class="pl-lbl">Elige tu avatar</div><div class="pl-avs">' + AVATARES.map(a => '<button type="button" class="pl-av' + (a === av ? ' on' : '') + '" data-av="' + a + '" aria-pressed="' + (a === av) + '" aria-label="Avatar ' + a + '">' + a + '</button>').join('') + '</div>' +
      '<button type="button" class="pl-cta" id="plEntrar">Entrar a jugar</button><p class="pl-nota">Solo usamos tu apodo para el juego. Nada de datos personales.</p>');
    let elegido = av;
    root.querySelectorAll('.pl-av').forEach(b => b.onclick = () => { root.querySelectorAll('.pl-av').forEach(x => { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); }); b.classList.add('on'); b.setAttribute('aria-pressed', 'true'); elegido = b.dataset.av; });
    root.querySelector('#plEntrar').onclick = async () => {
      const alias = root.querySelector('#plAlias').value.trim(); if(!alias){ aviso('Escribe tu apodo.', true); return; }
      try{
        const r = await rpc('play_entrar', { p_canal: ctx.c, p_mesa: +ctx.mesa, p_vm: ctx.v, p_alias: alias, p_avatar: elegido, p_token: (prev && prev.token) || null });
        Object.assign(st, { token: r.token, jugador: r.jugador, juegos: r.juegos || [], local: !!r.local, alias, avatar: elegido }); guardar(); inicio();
      }catch(e){ aviso(e.message, true); }
    };
  }

  // ---------- Inicio: juegos, unirse con código, salas abiertas, clasificación ----------
  async function inicio(){
    salirSala(true);
    const cards = Object.keys(JUEGOS).filter(k => !st.juegos.length || st.juegos.includes(k)).map(k => { const g = JUEGOS[k];
      return '<button type="button" class="pl-card" data-j="' + k + '"><span class="pl-cic">' + g.ic + '</span><span class="pl-ctx"><b>' + esc(g.n) + '</b><small>' + esc(g.d) + '</small></span><span class="pl-min">' + g.min + '+</span></button>'; }).join('');
    pintar('<div class="pl-top"><span class="pl-yo">' + esc(st.avatar) + ' ' + esc(st.alias) + ' · Mesa ' + esc(ctx.mesa) + '</span><button type="button" class="pl-link" id="plCambiar">Cambiar</button></div>' +
      '<div class="pl-unirse"><input id="plCod" class="pl-in pl-cod" maxlength="4" autocomplete="off" placeholder="CÓDIGO" aria-label="Código de la sala"><button type="button" class="pl-btn" id="plUnirse">Unirme</button></div>' +
      '<div class="pl-abiertas" id="plAbiertas"></div><h3 class="pl-h3">Elige un juego</h3><div class="pl-cards">' + cards + '</div>' +
      '<button type="button" class="pl-btn pl-ghost pl-wide" id="plRanking">🏅 Clasificación de hoy</button>');
    root.querySelector('#plCambiar').onclick = () => pantallaEntrar({ alias: st.alias, avatar: st.avatar, token: st.token });
    root.querySelector('#plUnirse').onclick = () => unirse(root.querySelector('#plCod').value);
    root.querySelector('#plCod').onkeydown = e => { if(e.key === 'Enter') unirse(e.target.value); };
    root.querySelectorAll('.pl-card').forEach(b => b.onclick = () => presentacion(b.dataset.j));
    root.querySelector('#plRanking').onclick = ranking;
    try{
      const l = await rpc('play_salas_abiertas', { p_token: st.token }), box = root.querySelector('#plAbiertas'); if(!box) return;
      box.innerHTML = l.length ? '<h3 class="pl-h3">Salas abiertas</h3>' + l.slice(0, 6).map(s => '<button type="button" class="pl-sala" data-cod="' + esc(s.codigo) + '">' + (JUEGOS[s.juego] || {}).ic + ' <b>' + esc((JUEGOS[s.juego] || {}).n) + '</b> · ' + (s.modo === 'local' ? 'todo el local' : 'Mesa ' + esc(s.mesa)) + ' · ' + s.jugadores + ' 👤 <span>Unirme · ' + esc(s.codigo) + '</span></button>').join('') : '';
      box.querySelectorAll('.pl-sala').forEach(b => b.onclick = () => unirse(b.dataset.cod));
    }catch(e){ if(e.codigo === 'play_sesion') pantallaEntrar({ alias: st.alias, avatar: st.avatar }); }
  }
  function presentacion(k){
    const g = JUEGOS[k];
    pintar('<button type="button" class="pl-link" id="plVolver">← Juegos</button><div class="pl-hero"><div class="pl-logo">' + g.ic + '</div><h2>' + esc(g.n) + '</h2><p>' + esc(g.d) + '</p></div>' +
      '<ol class="pl-como">' + g.como.map(x => '<li>' + esc(x) + '</li>').join('') + '</ol><p class="pl-nota">Mínimo ' + g.min + ' jugadores. Todos los retos se pueden pasar.</p>' +
      '<button type="button" class="pl-cta" data-modo="mesa">Jugar con mi mesa</button>' + (st.local ? '<button type="button" class="pl-btn pl-wide" data-modo="local">⚔️ Contra otras mesas</button>' : ''));
    root.querySelector('#plVolver').onclick = inicio;
    root.querySelectorAll('[data-modo]').forEach(b => b.onclick = async () => { try{ const v = await rpc('play_crear', { p_token: st.token, p_juego: k, p_modo: b.dataset.modo }); entrarSala(v); }catch(e){ aviso(e.message, true); } });
  }
  async function unirse(cod){
    cod = String(cod || '').trim().toUpperCase(); if(cod.length !== 4){ aviso('El código tiene 4 letras.', true); return; }
    try{ entrarSala(await rpc('play_unirse', { p_token: st.token, p_codigo: cod })); }catch(e){ aviso(e.message, true); }
  }
  async function ranking(){
    let r = null; try{ r = await rpc('play_ranking', { p_token: st.token }); }catch(e){ aviso(e.message, true); return; }
    pintar('<button type="button" class="pl-link" id="plVolver">← Juegos</button><h2 class="pl-h2">🏅 Clasificación de hoy</h2>' +
      '<h3 class="pl-h3">Jugadores</h3>' + (r.jugadores.length ? '<ol class="pl-rank">' + r.jugadores.map((x, i) => '<li><span>' + (i === 0 ? '👑' : (i + 1) + '.') + ' ' + esc(x.avatar) + ' ' + esc(x.alias) + ' <small>Mesa ' + esc(x.mesa) + '</small></span><b>' + x.puntos + '</b></li>').join('') + '</ol>' : '<p class="pl-nota">Todavía nadie ha jugado hoy.</p>') +
      '<h3 class="pl-h3">Mesas</h3>' + (r.mesas.length ? '<ol class="pl-rank">' + r.mesas.map((x, i) => '<li><span>' + (i === 0 ? '🏆' : (i + 1) + '.') + ' Mesa ' + esc(x.mesa) + '</span><b>' + x.puntos + '</b></li>').join('') + '</ol>' : ''));
    root.querySelector('#plVolver').onclick = inicio;
  }

  // ---------- La sala ----------
  function entrarSala(v){
    st.sala = v.sala.id; guardar(); completa = 0; aplicar(v, true);
    programar(); clearInterval(reloj); reloj = setInterval(pintarReloj, 250);
  }
  function parar(){ clearTimeout(poll); clearInterval(reloj); poll = reloj = null; }
  function salirSala(silencio){
    parar();
    if(!silencio && st.sala) rpc('play_salir', { p_token: st.token, p_sala: st.sala }).catch(() => {});
    st.sala = null; st.vista = null; st.ver = 0; guardar();
  }
  // La próxima pregunta: 2 s jugando, 3,5 s en la sala de espera; terminada la partida, no pregunta más.
  function programar(){
    clearTimeout(poll); poll = null;
    if(!st.sala || (st.vista && st.vista.sala.estado === 'fin')) return;
    poll = setTimeout(() => { refrescar().finally(programar); }, st.vista && st.vista.sala.estado === 'jugando' ? 2000 : 3500);
  }
  const visible = () => root && root.isConnected && root.offsetParent !== null && !document.hidden;
  async function refrescar(ya){
    if(!st.sala || ocupado || pidiendo || !visible()) return;
    const sala = st.sala; pidiendo = true;
    // Cada 10 preguntas pide la vista completa (para ver quién sigue conectado), aunque la versión no haya cambiado.
    const ver = (++completa % 10 === 0 || ya === true) ? null : st.ver;
    try{
      const v = await rpc('play_estado', { p_token: st.token, p_sala: sala, p_ver: ver || null });
      if(sala !== st.sala) return;   // ya salió de esa sala: no se vuelve a pintar
      if(v && v.igual){ st.desfase = v.ahora - Date.now(); return; }
      aplicar(v);
    }catch(e){ if(sala === st.sala && (e.codigo === 'play_sala' || e.codigo === 'play_sesion')){
      // Primero la pantalla y después el aviso (la pantalla nueva borraba el aviso).
      salirSala(true); if(e.codigo === 'play_sesion') pantallaEntrar({ alias: st.alias, avatar: st.avatar }); else inicio();
      aviso(e.message, true); } }
    finally{ pidiendo = false; }
  }
  async function jugar(tipo, dato){
    if(ocupado || !st.vista) return; ocupado = true;
    const s = st.vista.sala, d = Object.assign({ r: s.ronda }, st.vista.publico && st.vista.publico.n != null ? { n: st.vista.publico.n } : {}, dato || {});
    try{
      const v = await rpc('play_accion', { p_token: st.token, p_sala: s.id, p_tipo: tipo, p_dato: d, p_cid: cid() });
      if(s.id !== st.sala) return;
      aplicar(v, true);
      if(v && v.error) aviso(ERRORES[v.error] || ERRORES.play_jugada, true);
    }
    catch(e){ aviso(e.message, true); }
    finally{ ocupado = false; }
  }
  function aplicar(v, forzar){
    if(!v || !v.sala || v.sala.id !== st.sala) return;
    if(st.vista && v.sala.version < st.ver) return;   // una respuesta vieja que llegó tarde no pisa lo más nuevo
    if(!forzar && st.vista && v.sala.version === st.ver && v.sala.fase === st.vista.sala.fase) { st.vista = v; return; }
    const antes = st.vista; st.vista = v; st.ver = v.sala.version; st.desfase = v.sala.ahora - Date.now();
    pintarSala(antes);
  }
  const yo = () => (st.vista.jugadores || []).find(x => x.yo) || {};
  const quien = id => (st.vista.jugadores || []).find(x => x.id === id) || { alias: '¿?', avatar: '🙂' };
  const nombre = id => { const j = quien(id); return esc(j.avatar) + ' ' + esc(j.alias) + (j.yo ? ' (tú)' : ''); };
  function pintarReloj(){
    pintarBloqueo();
    const e = root && root.querySelector('.pl-reloj'); if(!e || !st.vista) return;
    const h = st.vista.sala.hasta; if(!h){ e.hidden = true; return; }
    const s = Math.max(0, Math.ceil((h - (Date.now() + st.desfase)) / 1000)); e.hidden = false; e.textContent = '⏱ ' + s + ' s'; e.classList.toggle('poco', s <= 5);
    // Se acabó el tiempo: pregunta ya (como mucho una vez por segundo) para ver lo que sigue.
    if(s === 0 && Date.now() - ultimoTick > 1000){ ultimoTick = Date.now(); refrescar(); }
  }
  // LA BOMBA: si falló, 3 s sin poder responder.
  function pintarBloqueo(){
    const b = root && root.querySelector('.pl-bloq'); if(!b || !st.vista) return;
    const r = Math.ceil(((st.vista.publico.bloqueo || 0) - (Date.now() + st.desfase)) / 1000);
    if(r > 0){ b.hidden = false; b.textContent = '🔒 ¡Fallaste! Espera ' + r + ' s'; }
    else if(!b.hidden){ b.hidden = true; root.querySelectorAll('.pl-op[data-i]').forEach(x => { x.disabled = false; }); }
  }
  function cabeza(){
    const v = st.vista, g = JUEGOS[v.sala.juego] || {};
    return '<div class="pl-sbar"><button type="button" class="pl-link" id="plSalir">✕ Salir</button><b>' + g.ic + ' ' + esc(g.n) + '</b><span class="pl-cod-s">' + esc(v.sala.codigo) + '</span></div>' +
      (v.sala.estado === 'jugando' ? '<div class="pl-ronda">Ronda ' + v.sala.ronda + (v.publico.total ? ' de ' + v.publico.total : '') + '<span class="pl-reloj" hidden></span></div>' : '');
  }
  function tabla(){
    return '<div class="pl-jug">' + st.vista.jugadores.map(j => '<span class="pl-j' + (j.vivo ? '' : ' fuera') + (j.yo ? ' yo' : '') + '">' + esc(j.avatar) + ' ' + esc(j.alias) + ' <b>' + j.puntos + '</b>' + (j.enLinea ? '' : ' 💤') + '</span>').join('') + '</div>';
  }
  const opciones = (ops, dis, marca) => '<div class="pl-ops">' + ops.map((o, i) => '<button type="button" class="pl-op' + (marca && marca(i) || '') + '" data-i="' + i + '"' + (dis ? ' disabled' : '') + '>' + esc(o) + '</button>').join('') + '</div>';

  function pintarSala(antes){
    const v = st.vista, s = v.sala, p = v.publico || {}, m = v.mio || {}, me = yo();
    let html = cabeza();
    if(s.estado === 'espera'){
      const g = JUEGOS[s.juego], n = v.jugadores.length;
      html += '<div class="pl-hero"><p>Comparte este código con tu ' + (s.modo === 'local' ? 'mesa o con otras mesas' : 'mesa') + ':</p><div class="pl-codigo">' + esc(s.codigo) + '</div></div>' +
        '<h3 class="pl-h3">Cómo se juega</h3><ol class="pl-como">' + g.como.map(x => '<li>' + esc(x) + '</li>').join('') + '<li>Todos los retos se pueden pasar.</li></ol>' +
        '<h3 class="pl-h3">Jugadores (' + n + ')</h3>' + tabla() +
        (s.anfitrion ? '<button type="button" class="pl-cta" id="plEmpezar"' + (n < g.min ? ' disabled' : '') + '>' + (n < g.min ? 'Faltan ' + (g.min - n) + ' para empezar' : '▶ Empezar') + '</button>' : '<p class="pl-nota">Esperando a que ' + nombre(s.anfitrionId) + ' empiece…</p>');
    } else if(s.estado === 'fin'){
      const f = p.final || [], gan = f.filter(x => x.gano);
      const titulo = gan.length > 1 ? '¡Empate! ' + gan.map(x => esc(x.avatar) + ' ' + esc(x.alias)).join(' y ') : gan.length ? esc(gan[0].avatar) + ' ' + esc(gan[0].alias) + ' gana' : 'Fin del juego';
      html += '<div class="pl-hero"><div class="pl-logo">🏆</div><h2>' + titulo + '</h2></div>' +
        '<ol class="pl-rank">' + f.map((x, i) => '<li class="' + (x.j === st.jugador ? 'yo' : '') + '"><span>' + (x.gano ? '👑' : (i + 1) + '.') + ' ' + esc(x.avatar) + ' ' + esc(x.alias) + ' <small>Mesa ' + esc(x.mesa) + '</small></span><b>' + x.puntos + '</b></li>').join('') + '</ol>' +
        '<button type="button" class="pl-cta" id="plOtra">Jugar otra</button>';
      if(!antes || antes.sala.estado !== 'fin'){ try{ window.mesoraCelebrar && window.mesoraCelebrar(['🏆', '🎉', '✨']); }catch(e){} }
    } else html += juego(s, p, m, me);
    // Lo que el jugador estaba escribiendo (la pista) no se pierde cuando llega una actualización.
    const escr = root.querySelector('#plPistaTxt'), txt = escr ? escr.value : '', foco = escr && document.activeElement === escr;
    pintar(html);
    const escr2 = root.querySelector('#plPistaTxt'); if(escr2 && txt){ escr2.value = txt; if(foco) escr2.focus(); }
    const $ = id => root.querySelector(id);
    if($('#plSalir')) $('#plSalir').onclick = () => { salirSala(false); inicio(); };
    if($('#plEmpezar')) $('#plEmpezar').onclick = async () => { try{ aplicar(await rpc('play_empezar', { p_token: st.token, p_sala: s.id }), true); }catch(e){ aviso(e.message, true); } };
    if($('#plOtra')) $('#plOtra').onclick = () => { salirSala(true); inicio(); };
    root.querySelectorAll('.pl-op[data-i]').forEach(b => b.onclick = () => jugar('responder', { i: +b.dataset.i }));
    root.querySelectorAll('[data-act]').forEach(b => b.onclick = () => jugar(b.dataset.act, b.dataset.j ? { j: b.dataset.j } : {}));
    const fp = $('#plPista'); if(fp) fp.onsubmit = e => { e.preventDefault(); const t = $('#plPistaTxt').value.trim(); if(t) jugar('pista', { t }); };
    pintarReloj();
  }

  function juego(s, p, m, me){
    const J = s.juego, f = s.fase;
    if(J === 'show'){
      if(f === 'pregunta') return '<div class="pl-q"><small>' + esc(p.cat || '') + '</small>' + esc(p.q) + '</div>' + opciones(p.opciones || [], m.hecho) + (m.hecho ? '<p class="pl-nota">✅ Respondiste. Esperando a los demás…</p>' : '') + tabla();
      const c = +p.correcta;
      return '<div class="pl-q">' + esc(p.q) + '</div>' + opciones(p.opciones || [], true, i => (i === c ? ' ok' : '')) + '<p class="pl-res">' + (m.acerte ? '🎉 ¡Acertaste!' : '😅 Esta vez no') + '</p>' + tabla();
    }
    if(J === 'bomba'){
      if(f === 'bomba'){
        const mia = p.portador === st.jugador;
        const bloq = (p.bloqueo || 0) > Date.now() + st.desfase;
        return (mia ? '<div class="pl-bomba mia">💣<b>¡Tienes la bomba!</b><span>Responde bien para pasarla</span></div><div class="pl-q">' + esc(p.q) + '</div><p class="pl-bloq pl-res" role="status"' + (bloq ? '' : ' hidden') + '></p>' + opciones(p.opciones || [], bloq)
          : '<div class="pl-bomba">💣<b>La tiene ' + nombre(p.portador) + '</b><span>Pases: ' + (p.pases || 0) + ' · tic, tac…</span></div>') + tabla();
      }
      return '<div class="pl-bomba boom">💥<b>¡Explotó! ' + nombre(p.perdio) + ' sale</b></div>' + (p.reto ? '<div class="pl-reto"><small>Reto (se puede pasar)</small>' + esc(p.reto) + '</div>' : '') + tabla();
    }
    if(J === 'impostor'){
      const rol = m.rol === 'impostor' ? '<div class="pl-rol imp">🕵️ <b>Eres el impostor</b><span>Categoría: ' + esc(m.cat || '') + '. Disimula.</span></div>'
        : m.rol ? '<div class="pl-rol">🔑 La palabra es <b>' + esc(m.palabra) + '</b><span>Categoría: ' + esc(m.cat || '') + '</span></div>' : '';
      const pistas = (p.pistas || []).length ? '<h3 class="pl-h3">Pistas</h3><ul class="pl-pistas">' + p.pistas.map(x => '<li>' + nombre(x.j) + ': <b>' + esc(x.t) + '</b></li>').join('') + '</ul>' : '';
      if(f === 'pistas') return rol + pistas + (m.hecho ? '<p class="pl-nota">✅ Diste tu pista. Esperando a los demás…</p>'
        : '<form id="plPista" class="pl-unirse"><input id="plPistaTxt" class="pl-in" maxlength="24" autocomplete="off" aria-label="Tu pista" placeholder="Una pista (sin decir la palabra)"><button class="pl-btn">Enviar</button></form>') + tabla();
      if(f === 'votar') return rol + pistas +
        (m.hecho ? '<p class="pl-nota">✅ Votaste. Esperando…</p>' : '<h3 class="pl-h3">¿Quién es el impostor?</h3><div class="pl-ops">' + st.vista.jugadores.filter(j => !j.yo && j.vivo).map(j => '<button type="button" class="pl-op" data-act="votar" data-j="' + esc(j.id) + '">' + esc(j.avatar) + ' ' + esc(j.alias) + '</button>').join('') + '</div>');
      return '<div class="pl-rol' + (p.ganan === 'impostor' ? ' imp' : '') + '">' + (p.ganan === 'grupo' ? '🎉 ¡Lo descubrieron!' : p.ganan === 'salio' ? '🚪 El impostor se fue' : '🕵️ ¡Ganó el impostor!') + '<span>Era ' + nombre(p.impostor) + ' · la palabra: <b>' + esc(p.palabra) + '</b></span></div>' + tabla();
    }
    if(J === 'ruleta'){
      if(f === 'girar') return '<div class="pl-bomba">🎡<b>¡A girar la ruleta!</b><span>Cualquiera puede girarla</span></div><button type="button" class="pl-cta" data-act="girar">🎡 Girar</button>' + tabla();
      if(f === 'reto'){
        const mio = p.elegido === st.jugador;
        return '<div class="pl-bomba">🎯<b>' + nombre(p.elegido) + '</b></div><div class="pl-reto"><small>Reto (se puede pasar)</small>' + esc(p.reto) + '</div>' +
          (mio ? '<p class="pl-nota">Hazlo y toca «¡Lo hice!»: los puntos te los dan los aplausos de los demás.</p><div class="pl-ops"><button type="button" class="pl-op ok" data-act="cumplir">✅ ¡Lo hice!</button>' + (p.cambio ? '<button type="button" class="pl-op" data-act="cambiar">🔄 Cambiar reto</button>' : '') + '<button type="button" class="pl-op" data-act="pasar">⏭ Paso</button></div>'
            : '<p class="pl-nota">Cuando lo haga, podrás aplaudir 👏 (cada aplauso le da +25).</p>') + tabla();
      }
      return '<div class="pl-bomba">' + (p.hizo === 'cumplir' ? '🎉<b>¡Lo cumplió!</b>' : '⏭<b>Pasó</b>') + '</div>' + (p.hizo === 'cumplir' && p.elegido !== st.jugador ? aplauso(p, m) : '') + tabla();
    }
    if(J === 'sobreviviente'){
      if(f === 'reto'){
        if(!me.vivo) return '<div class="pl-bomba">👀<b>Quedaste fuera</b><span>Mira quién gana · quedan ' + (p.vivos || 0) + '</span></div><div class="pl-q">' + esc(p.q) + '</div>' + tabla();
        return '<div class="pl-q"><small>Quedan ' + (p.vivos || 0) + '</small>' + esc(p.q) + '</div>' + opciones(p.opciones || [], m.hecho) + (m.hecho ? '<p class="pl-nota">✅ Listo. Esperando…</p>' : '') + tabla();
      }
      const c = +p.correcta, fuera = p.fuera || [];
      return '<div class="pl-q">' + esc(p.q) + '</div>' + opciones(p.opciones || [], true, i => (i === c ? ' ok' : '')) +
        '<p class="pl-res">' + (fuera.length ? '❌ Salen: ' + fuera.map(nombre).join(', ') : '🤝 Nadie sale esta ronda') + '</p>' + tabla();
    }
    return tabla();
  }

  function aplauso(p, m){
    return m.hecho ? '<p class="pl-nota">👏 Aplaudiste</p>' : '<button type="button" class="pl-btn pl-wide" data-act="aplaudir">👏 Aplaudir (+25 para ' + esc(quien(p.elegido).alias) + ')</button>';
  }

  // ---------- Abrir ----------
  function abrir(el, c){
    if(root === el && st.token){ if(st.sala){ refrescar(true); if(!poll) programar(); if(!reloj) reloj = setInterval(pintarReloj, 250); } return; }   // ya estaba abierto: solo se actualiza
    root = el; ctx = c;
    const prev = leer();
    if(prev && prev.token){
      Object.assign(st, prev);
      rpc('play_entrar', { p_canal: ctx.c, p_mesa: +ctx.mesa, p_vm: ctx.v, p_alias: prev.alias, p_avatar: prev.avatar, p_token: prev.token })
        .then(r => { Object.assign(st, { token: r.token, jugador: r.jugador, juegos: r.juegos || [], local: !!r.local }); guardar();
          if(prev.sala) rpc('play_estado', { p_token: st.token, p_sala: prev.sala }).then(entrarSala, () => inicio()); else inicio(); })
        .catch(e => { if(e.codigo === 'play_no_disponible' || e.codigo === 'play_mesa'){ pintar('<div class="pl-hero"><div class="pl-logo">🎮</div><p>' + esc(e.message) + '</p></div>'); } else pantallaEntrar(prev); });
    } else pantallaEntrar(null);
  }
  function cerrar(){ parar(); }
  window.ordevaPlay = { abrir, cerrar, JUEGOS };
})();
