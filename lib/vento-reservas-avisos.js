/* ORDEVA · lib/vento-reservas-avisos.js — 1.77.0: ⚡ Reservas de Booking / Airbnb al instante, con los datos del huésped.
   Booking y Airbnb no dejan que ORDEVA lea sus reservas directo (solo a empresas certificadas). Pero sus apps (Booking.com
   Pulse, Airbnb…) avisan en el celular del dueño apenas alguien reserva. La app Android de ORDEVA lee ese aviso (el mismo
   permiso de «Acceso a notificaciones» de los pagos) y aquí:
   • Se entiende: reserva nueva / cancelada / cambiada, el nombre del huésped, las fechas (español o inglés), las personas
     y el código de la reserva.
   • Se guarda en el servidor (reserva_aviso_guardar) y se le pide al servidor leer YA el calendario de esa plataforma: la
     reserva queda en su habitación con el nombre del huésped (si el calendario ya la tenía, se le pone el nombre).
   • Avisa con voz y notificación: «🏨 Booking: reserva de Juan Pérez · 5–7 nov · 2 personas · Habitación 3».
   • «📲 Avisos de reservas» (en 📅 Reservas): lo que llegó y dónde quedó; lo que el calendario todavía no trae se puede
     asignar a una habitación con un toque.
   Si la cancelan allá, avisa al instante y el calendario la libera aquí. */
(function(){
  'use strict';
  if(window.ventoReservasAvisos) return;
  const D = () => (typeof data !== 'undefined' ? data : null);
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (t, ms) => { try{ showToast(t, ms || 6000); }catch(e){} };
  const nb = () => window.ventoNube || null;
  const neg = () => { try{ return nb() && nb().negocio ? nb().negocio() : null; }catch(e){ return null; } };
  const R = () => window.ventoReservas;
  const activo = () => { try{ return !!R() && R().tipo() === 'habitacion'; }catch(e){ return false; } };
  const etiqueta = id => { try{ return tableLabel(id); }catch(e){ return 'Habitación ' + id; } };
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  // ---------- Entender el aviso ----------
  const MESES = { ene: 0, enero: 0, jan: 0, january: 0, feb: 1, febrero: 1, february: 1, mar: 2, marzo: 2, march: 2, abr: 3, abril: 3, apr: 3, april: 3,
    may: 4, mayo: 4, jun: 5, junio: 5, june: 5, jul: 6, julio: 6, july: 6, ago: 7, agosto: 7, aug: 7, august: 7, sep: 8, sept: 8, septiembre: 8, setiembre: 8, september: 8,
    oct: 9, octubre: 9, october: 9, nov: 10, noviembre: 10, november: 10, dic: 11, diciembre: 11, dec: 11, december: 11 };
  const MES = '(ene(?:ro)?|jan(?:uary)?|feb(?:rero|ruary)?|mar(?:zo|ch)?|abr(?:il)?|apr(?:il)?|may(?:o)?|jun(?:io|e)?|jul(?:io|y)?|ago(?:sto)?|aug(?:ust)?|sept?(?:iembre|ember)?|setiembre|oct(?:ubre|ober)?|nov(?:iembre|ember)?|dic(?:iembre)?|dec(?:ember)?)';
  function anio(m, d, y, base){
    if(y) return +y < 100 ? 2000 + +y : +y;
    const hoy = base || new Date(), f = new Date(hoy.getFullYear(), m, d);
    return f.getTime() < hoy.getTime() - 3 * 864e5 ? hoy.getFullYear() + 1 : hoy.getFullYear();   // «5 ene» en diciembre = el año que viene
  }
  function fechas(txt, base){
    const t = norm(txt).replace(/[–—]/g, '-'), out = [];
    let m;
    // «5-7 nov», «del 5 al 7 de noviembre», «5 to 7 november»
    if((m = new RegExp('\\b(\\d{1,2})\\s*(?:-|al|a|to|until|hasta)\\s*(\\d{1,2})\\s*(?:de\\s+)?' + MES + '\\.?(?:,?\\s*(?:de\\s+)?(\\d{4}))?').exec(t))){
      const mm = MESES[m[3].replace(/\.$/, '')] ?? MESES[m[3].slice(0, 3)], y = anio(mm, +m[1], m[4], base);
      return [new Date(y, mm, +m[1]), new Date(+m[2] < +m[1] ? y + (mm === 11 ? 1 : 0) : y, +m[2] < +m[1] ? (mm + 1) % 12 : mm, +m[2])];
    }
    // «nov 5 - 7», «Nov 5-7, 2026»
    if((m = new RegExp('\\b' + MES + '\\.?\\s+(\\d{1,2})\\s*-\\s*(\\d{1,2})\\b(?:,?\\s*(\\d{4}))?').exec(t))){
      const mm = MESES[m[1]] ?? MESES[m[1].slice(0, 3)], y = anio(mm, +m[2], m[4], base);
      return [new Date(y, mm, +m[2]), new Date(y, mm, +m[3])];
    }
    const re = new RegExp('\\b(\\d{1,2})\\s*(?:de\\s+)?' + MES + '\\.?(?:,?\\s*(?:de\\s+)?(\\d{4}))?|\\b' + MES + '\\.?\\s+(\\d{1,2})(?:,?\\s*(\\d{4}))?|\\b(\\d{4})-(\\d{2})-(\\d{2})\\b|\\b(\\d{1,2})/(\\d{1,2})/(\\d{2,4})\\b', 'g');
    while((m = re.exec(t)) && out.length < 2){
      if(m[1]){ const mm = MESES[m[2]] ?? MESES[m[2].slice(0, 3)]; out.push(new Date(anio(mm, +m[1], m[3], base), mm, +m[1])); }
      else if(m[4]){ const mm = MESES[m[4]] ?? MESES[m[4].slice(0, 3)]; out.push(new Date(anio(mm, +m[5], m[6], base), mm, +m[5])); }
      else if(m[7]) out.push(new Date(+m[7], +m[8] - 1, +m[9]));
      else if(m[10]) out.push(new Date(anio(+m[11] - 1, +m[10], m[12], base), +m[11] - 1, +m[10]));   // dd/mm (Colombia)
    }
    if(out.length === 1){ const n = /(\d{1,2})\s*(?:noches?|nights?)/.exec(t); if(n) out.push(new Date(out[0].getTime() + +n[1] * 864e5)); }
    if(out.length === 2 && out[1] <= out[0]) out[1] = new Date(out[1].getFullYear() + 1, out[1].getMonth(), out[1].getDate());
    return out.length === 2 ? out : null;
  }
  const PAL = '[A-ZÁÉÍÓÚÑÜ][a-záéíóúñü\'-]+';
  const NOMBRE = PAL + '(?:\\s+(?:de\\s+|del\\s+|la\\s+)?' + PAL + '){0,3}';
  const NO_NOMBRE = /^(Nueva|New|Reserva|Reservation|Booking|Airbnb|Expedia|Vrbo|Pulse|Hola|Hi|Tienes|You|Confirmada|Confirmed|Cancelada|Cancelled|Canceled|Check|Llegada|Arrival|Solicitud|Request|El|La|Los|Las|Un|Una|Su|Tu|Your)\b/;
  function nombre(titulo, texto){
    const todo = (titulo || '') + '\n' + (texto || '');
    const pruebas = [
      new RegExp('(?:reserva(?:ci[oó]n)?\\s+(?:nueva\\s+)?(?:de|por|para)|booking\\s+from|reservation\\s+from|from|hu[eé]sped:?|guest:?|a nombre de)\\s+(' + NOMBRE + ')'),
      new RegExp('(' + NOMBRE + ')\\s+(?:ha\\s+reservado|reserv[oó]|booked|made a reservation|llega|arrives|lleg[oó]|cancel[oó]|cancelled|canceled|te envi[oó]|sent you|ha cancelado)'),
    ];
    for(const re of pruebas){ const m = re.exec(todo); if(m && !NO_NOMBRE.test(m[1])) return m[1].trim().slice(0, 60); }
    const t = String(titulo || '').trim();   // Airbnb: el título del aviso suele ser el nombre del huésped
    if(new RegExp('^' + NOMBRE + '$').test(t) && !NO_NOMBRE.test(t)) return t.slice(0, 60);
    return '';
  }
  function entender(av, base){
    const titulo = av.ti || '', texto = av.tx || '', todo = norm(titulo + ' ' + texto);
    const tipo = /cancel/.test(todo) ? 'cancelada'
      : /modific|cambi[oó] (?:las|la|su)|changed|updated|alter/.test(todo) ? 'cambio'
      : /nueva reserva|reserva nueva|new (?:booking|reservation)|reserva confirmada|reservation confirmed|ha reservado|reservo|booked|solicitud de reserva|request to book|instant book|reserva instantanea|tienes una reserva|you have a (?:new )?(?:booking|reservation)/.test(todo) ? 'nueva' : 'otro';
    const f = fechas(titulo + ' ' + texto, base);
    const per = /(\d{1,2})\s*(?:hu[eé]sped(?:es)?|huespedes|personas?|adultos?|guests?|adults?|pax)\b/i.exec(titulo + ' ' + texto);
    const cod = /\b(HM[A-Z0-9]{6,12})\b/.exec(titulo + ' ' + texto) || /(?:reserva|booking|confirmaci[oó]n|n[º°o.]+)\D{0,12}(\d{9,11})\b/i.exec(titulo + ' ' + texto);
    const tel = /(\+?\d[\d\s]{8,14}\d)/.exec(texto);
    return { fuente: av.f || 'Otra', tipo, cliente: nombre(titulo, texto), personas: per ? +per[1] : null, codigo: cod ? cod[1] : '', telefono: tel ? tel[1].replace(/\s/g, '') : '',
      desde: f ? f[0] : null, hasta: f ? f[1] : null, texto: (titulo + ' · ' + texto).slice(0, 400) };
  }

  // ---------- Al llegar un aviso ----------
  const hm = s => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '')); return m ? [+m[1], +m[2]] : [12, 0]; };
  function conHora(f, h){ const d = new Date(f); const [a, b] = hm(h); d.setHours(a, b, 0, 0); return d; }
  const fc = t => new Date(t).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  async function procesar(lista){
    const n = neg(); if(!activo() || !n || !lista.length) return [];
    const reglas = Object.assign({ entrada: '15:00', salida: '12:00' }, (((R().estado() || {}).cfg) || {}).reglas || {});
    const c = await nb().cliente(), hechos = [];
    for(const av of lista){
      const x = entender(av);
      if(x.tipo === 'otro') continue;   // mensajes del chat, promociones…: no es una reserva
      const desde = x.desde ? conHora(x.desde, reglas.entrada) : null, hasta = x.hasta ? conHora(x.hasta, reglas.salida) : null;
      let r = null;
      try{
        const q = await c.rpc('reserva_aviso_guardar', { p_negocio: n.id, p_fuente: x.fuente, p_tipo: x.tipo, p_cliente: x.cliente || null, p_telefono: x.telefono || null, p_personas: x.personas,
          p_codigo: x.codigo || null, p_desde: desde ? desde.toISOString() : null, p_hasta: hasta ? hasta.toISOString() : null, p_texto: x.texto });
        r = q.error ? null : q.data;
      }catch(e){}
      if(r && r.duplicado) continue;
      hechos.push(Object.assign({}, x, { desde, hasta, srv: r }));
    }
    if(!hechos.length) return hechos;
    // El calendario de esa plataforma, YA (así queda en su habitación con el nombre).
    let sync = null; try{ sync = window.ventoIcal ? await window.ventoIcal.sincronizar(false) : null; }catch(e){}
    let L = []; try{ const q = await c.rpc('reservas_avisos_lista', { p_negocio: n.id }); L = q.data || []; }catch(e){}
    hechos.forEach(h => {
      const a = h.srv && L.find(y => y.id === h.srv.id);
      const donde = a && a.recurso_nombre ? ' · ' + a.recurso_nombre : (h.tipo === 'nueva' ? ' · sin habitación todavía' : '');
      const txt = (h.tipo === 'cancelada' ? '❌ ' + h.fuente + ' canceló' : h.tipo === 'cambio' ? '✏️ ' + h.fuente + ' cambió' : '🏨 ' + h.fuente + ': reserva') + (h.cliente ? ' de ' + h.cliente : '') +
        (h.desde ? ' · ' + fc(h.desde) + (h.hasta ? '–' + fc(h.hasta) : '') : '') + (h.personas ? ' · ' + h.personas + (h.personas === 1 ? ' persona' : ' personas') : '') + donde;
      toast(txt, 10000);
      try{ (window.speakVoice || function(){})((h.tipo === 'cancelada' ? 'Cancelaron una reserva de ' : h.tipo === 'cambio' ? 'Cambiaron una reserva de ' : 'Reserva nueva de ') + h.fuente + (h.cliente ? ', ' + h.cliente : '') + (h.desde ? ', llega el ' + fc(h.desde) : '') + '.'); }catch(e){}
      try{ const A = window.VentoAndroid; if(A && A.notificar) A.notificar(h.tipo === 'cancelada' ? '❌ Reserva cancelada' : '🏨 Reserva de ' + h.fuente, txt.replace(/^\S+\s/, ''), 'reservas', true); }catch(e){}
    });
    pintarBoton(L);
    try{ R().cargar(true); }catch(e){}
    void sync;
    return hechos;
  }
  // La app Android la llama apenas llega el aviso (y por si acaso se revisa cada 30 s).
  let tomando = false;
  async function tomar(){
    const A = window.VentoAndroid; if(tomando || !A || typeof A.reservasAvisosTomar !== 'function') return [];
    tomando = true;
    try{ let l = []; try{ l = JSON.parse(A.reservasAvisosTomar() || '[]') || []; }catch(e){} return await procesar(l); }
    finally{ tomando = false; }
  }
  window.ventoReservasAvisosNativos = () => { tomar(); };
  setInterval(() => { try{ tomar(); }catch(e){} }, 30000);

  // ---------- «📲 Avisos de reservas» ----------
  async function abrir(){
    const n = neg(); if(!n) return;
    let ov = $('raOv');
    if(!ov){ ov = document.createElement('div'); ov.id = 'raOv'; ov.className = 'overlay'; ov.setAttribute('data-novocab', ''); document.body.appendChild(ov); }
    ov.innerHTML = '<div class="modal ra-modal"><p>Cargando…</p></div>'; ov.classList.add('show');
    let L = []; try{ const c = await nb().cliente(); const q = await c.rpc('reservas_avisos_lista', { p_negocio: n.id }); L = q.data || []; }catch(e){}
    const habs = Object.keys((D() || {}).tables || {}).sort((a, b) => a - b);
    const fila = a => '<div class="ra-f' + (a.tipo === 'nueva' && !a.reserva ? ' ra-falta' : '') + '"><b>' + esc(a.tipo === 'cancelada' ? '❌ Cancelada' : a.tipo === 'cambio' ? '✏️ Cambio' : '🏨 Nueva') + ' · ' + esc(a.fuente) + (a.cliente ? ' · ' + esc(a.cliente) : '') + '</b>' +
      '<small>' + (a.desde ? esc(fc(a.desde)) + (a.hasta ? ' → ' + esc(fc(a.hasta)) : '') : 'Sin fechas en el aviso') + (a.personas ? ' · ' + a.personas + ' personas' : '') + (a.codigo ? ' · ' + esc(a.codigo) : '') + (a.telefono ? ' · ' + esc(a.telefono) : '') + '</small>' +
      (a.reserva ? '<span class="ra-ok">✅ ' + esc(a.recurso_nombre || 'En su habitación') + '</span>' : a.tipo === 'nueva' && a.desde ? '<div class="ra-asig"><select data-ra-hab="' + a.id + '">' + habs.map(h => '<option value="' + esc(h) + '">' + esc(etiqueta(h)) + '</option>').join('') + '</select><button type="button" class="btn-primary" data-ra="asignar" data-id="' + a.id + '">Asignar</button></div>' : '') + '</div>';
    ov.innerHTML = '<div class="modal ra-modal"><div class="modal-title-row"><h2>📲 Avisos de reservas</h2><button class="rename-table-btn" data-ra="cerrar" title="Cerrar">✕</button></div>' +
      '<p class="settings-desc">Lo que avisaron Booking, Airbnb y las otras apps en este celular. La reserva queda sola en su habitación cuando el calendario de esa plataforma la trae (al instante); si todavía no, asígnala aquí.</p>' +
      (L.length ? L.map(fila).join('') : '<p class="settings-desc">Todavía no llegan avisos. Para que lleguen: en este celular, la app de ORDEVA con «Acceso a notificaciones» y la app de Booking.com Pulse / Airbnb con las notificaciones prendidas.</p>') + '</div>';
  }
  document.addEventListener('click', async e => {
    const b = e.target.closest && e.target.closest('[data-ra]'); if(!b) return;
    e.stopPropagation();
    const a = b.dataset.ra, ov = $('raOv');
    if(a === 'abrir') return abrir();
    if(a === 'cerrar'){ ov.classList.remove('show'); return; }
    if(a === 'asignar'){
      const sel = ov.querySelector('[data-ra-hab="' + b.dataset.id + '"]'), h = sel ? sel.value : '';
      b.disabled = true;
      try{
        const c = await nb().cliente(); const q = await c.rpc('reserva_aviso_asignar', { p_aviso: b.dataset.id, p_recurso: String(h), p_recurso_nombre: etiqueta(isNaN(+h) ? h : +h) });
        if(q.error) throw new Error(q.error.message || q.error);
        if(q.data && q.data.ok === false) toast('⚠️ ' + etiqueta(isNaN(+h) ? h : +h) + ' ya está ocupada en esas fechas: elige otra.', 8000);
        else toast('✅ Reserva asignada a ' + etiqueta(isNaN(+h) ? h : +h) + '.');
      }catch(err){ toast('⚠️ No se pudo: ' + (err.message || err)); }
      try{ R().cargar(true); }catch(x){}
      abrir();
    }
  }, true);
  function pintarBoton(L){
    const tabs = document.querySelector('#rsOv .rs-tabs'); if(!tabs) return;
    let b = $('raBtn');
    if(!activo()){ if(b) b.remove(); return; }
    if(!b){ b = document.createElement('button'); b.type = 'button'; b.id = 'raBtn'; b.dataset.ra = 'abrir'; tabs.appendChild(b); }
    const falta = (L || []).filter(a => a.tipo === 'nueva' && !a.reserva && a.desde).length;
    b.textContent = '📲 Avisos' + (falta ? ' (' + falta + ' sin habitación)' : '');
  }
  // Al abrir 📅 Reservas: el botón, y se le pide al servidor revisar los calendarios ya (si hace más de 2 min).
  let rsVisto = false, ultPedido = 0;
  setInterval(() => {
    try{
      const ov = $('rsOv'), abierto = !!ov && ov.classList.contains('show');
      if(abierto && !rsVisto){
        pintarBoton(null);
        const n = neg();
        if(n && Date.now() - ultPedido > 2 * 6e4 && window.ventoIcal){ ultPedido = Date.now(); window.ventoIcal.sincronizar(false).catch(() => {}); }
        if(n) nb().cliente().then(c => c.rpc('reservas_avisos_lista', { p_negocio: n.id })).then(q => pintarBoton(q.data || [])).catch(() => {});
      }
      rsVisto = abierto;
    }catch(e){}
  }, 800);

  const css = document.createElement('style');
  css.textContent = '.ra-modal{max-width:640px;width:min(640px,96vw);max-height:92vh;overflow:auto}.ra-f{border:1px solid var(--line);border-radius:12px;padding:9px 11px;margin:6px 0;display:flex;flex-direction:column;gap:3px;background:var(--surface)}' +
    '.ra-f small{color:var(--ink-soft);font-size:12.5px}.ra-falta{border-color:#f59e0b}.ra-ok{font-size:13px;font-weight:700;color:#16a34a}.ra-asig{display:flex;gap:6px;margin-top:4px}.ra-asig select{flex:1;padding:6px 8px;border-radius:9px;border:1px solid var(--line);background:var(--surface-2,#fff);color:var(--ink)}';
  document.head.appendChild(css);

  window.ventoReservasAvisos = { entender, fechas, nombre, procesar, tomar, abrir };
})();
