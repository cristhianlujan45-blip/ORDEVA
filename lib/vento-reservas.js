/* ORDEVA · lib/vento-reservas.js — 1.73.0: 📅 Reservas de habitaciones (hoteles, hostales, apartamentos) y de mesas
   (restaurantes, cafeterías, bares), SIN duplicados.
   • Las reservas viven en el Servidor ORDEVA (tabla «reservas», migración 20261125000000_reservas.sql). La BASE DE DATOS
     impide dos reservas que se crucen en la misma habitación o mesa: ni dos celulares al tiempo ni el agente de IA.
   • Atender = ocupada: apenas se abre la cuenta de una habitación o mesa (se anota el primer producto), queda «ocupada» en
     el servidor y las reservas en línea ya no la ofrecen. Al cobrar (cuenta vacía) se libera. Si sigue ocupada, se alarga
     sola (hotel: un día más; restaurante: una hora más), sin pisar la siguiente reserva.
   • Pantalla «📅 Reservas»: calendario (habitaciones × días o mesas × horas), las de hoy con «✅ Llegó» (abre la cuenta),
     «🚫 No llegó» y «❌ Cancelar», reserva nueva y «🤖 Reservas en línea» (lo que se ofrece y el link del agente).
   • Cuando entra una reserva en línea (agente), avisa con voz y notificación.
   Solo con la cuenta en la nube (así todos los equipos y el agente ven lo mismo). */
(function(){
  'use strict';
  if(window.ventoReservas) return;
  const D = () => (typeof data !== 'undefined' ? data : null);
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plata = n => { try{ return fmt(Math.round(n || 0)); }catch(e){ return '$' + Math.round(n || 0).toLocaleString('es-CO'); } };
  const toast = (t, ms) => { try{ showToast(t, ms || 5000); }catch(e){} };
  const HOTEL = ['hotel', 'hostal', 'apartamentos'];
  const DIA = 864e5;
  const nb = () => window.ventoNube || null;
  const neg = () => { try{ return nb() && nb().negocio ? nb().negocio() : null; }catch(e){ return null; } };
  function tipo(){
    const d = D(); if(!d) return null;
    if(HOTEL.includes(d.businessType)) return 'habitacion';
    let t = null; try{ t = typeof tipoNegocio === 'function' ? tipoNegocio() : null; }catch(e){}
    if(t && (t.fam === 'comida' || t.fam === 'bar')) return 'mesa';
    return null;
  }
  const activo = () => !!tipo();
  // 🤖 El agente (link para los clientes): reservas en hoteles y restaurantes, y domicilios en tiendas, restaurantes y bares.
  function agenteActivo(){
    if(activo()) return true;
    let t = null; try{ t = typeof tipoNegocio === 'function' ? tipoNegocio() : null; }catch(e){}
    return !!t && t.fam === 'tienda';
  }
  const qcfg = () => { try{ return window.vitoQCfg ? window.vitoQCfg() : {}; }catch(e){ return {}; } };
  const etiqueta = id => { try{ return tableLabel(id); }catch(e){ return (tipo() === 'habitacion' ? 'Habitación ' : 'Mesa ') + id; } };
  async function rpc(fn, args){
    const c = await nb().cliente(); const r = await c.rpc(fn, args || {});
    if(r.error) throw r.error; return r.data;
  }
  const st = { lista: [], cfg: null, t: 0, cargando: null, vistos: null, ocupadas: null, vista: 'hoy', inicio: null, error: '' };
  const lsG = (k, d) => { try{ const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; }catch(e){ return d; } };
  const lsS = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
  const kNeg = k => 'vento_res_' + k + ':' + ((neg() || {}).id || '-');

  // ---------- Horarios ----------
  const reglas = () => Object.assign({ entrada: '15:00', salida: '12:00', duracion_min: 120, abre: '12:00', cierra: '22:00', dias: 90 }, (st.cfg && st.cfg.reglas) || {});
  const hm = s => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '')); return m ? [+m[1], +m[2]] : [12, 0]; };
  function conHora(fecha, hora){ const d = new Date(fecha); const [h, m] = hm(hora); d.setHours(h, m, 0, 0); return d; }
  // Hasta cuándo queda ocupada al atender: hotel = la próxima salida; restaurante = la duración de una mesa.
  function hastaAlAtender(){
    const ahora = new Date();
    if(tipo() === 'habitacion'){
      let s = conHora(ahora, reglas().salida);
      if(ahora.getHours() >= 6 || s <= ahora) s = new Date(s.getTime() + DIA);
      return s;
    }
    return new Date(ahora.getTime() + (Number(reglas().duracion_min) || 120) * 6e4);
  }
  const fechaCorta = t => new Date(t).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
  const horaCorta = t => new Date(t).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
  const local = t => { const d = new Date(t); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); };
  const desdeLocal = s => new Date(s).toISOString();

  // ---------- Cargar ----------
  async function cargar(forzar){
    const n = neg(); if(!agenteActivo() || !n) return st.lista;
    if(!forzar && Date.now() - st.t < 15000) return st.lista;
    if(st.cargando) return st.cargando;
    st.cargando = (async () => {
      try{
        const desde = new Date(Date.now() - 2 * DIA).toISOString(), hasta = new Date(Date.now() + 120 * DIA).toISOString();
        const [l, c] = await Promise.all([activo() ? rpc('reservas_lista', { p_negocio: n.id, p_desde: desde, p_hasta: hasta }) : Promise.resolve([]), st.cfg ? Promise.resolve(st.cfg) : rpc('reservas_config_ver', { p_negocio: n.id }).catch(() => null)]);
        st.lista = Array.isArray(l) ? l : []; st.cfg = c || st.cfg; st.t = Date.now(); st.error = '';
        avisarNuevas();
      }catch(e){ st.error = String(e && (e.message || e.code) || e); }
      finally{ st.cargando = null; }
      pintarTodo();
      return st.lista;
    })();
    return st.cargando;
  }
  // Reserva NUEVA que llegó por el agente (o desde otro equipo): voz y notificación, una vez.
  function avisarNuevas(){
    const k = kNeg('vistos'); let v = st.vistos || lsG(k, null);
    const ids = st.lista.map(r => r.id);
    if(v === null){ st.vistos = ids; lsS(k, ids); return; }               // primera vez en este equipo: no se avisa lo de antes
    const nuevas = st.lista.filter(r => !v.includes(r.id) && r.origen === 'agente' && ['confirmada', 'pendiente'].includes(r.estado));
    st.vistos = ids.concat(v.filter(x => !ids.includes(x))).slice(-500); lsS(k, st.vistos);
    nuevas.forEach(r => {
      const txt = '📅 Reserva nueva: ' + (r.recurso_nombre || etiqueta(r.recurso)) + ', ' + fechaCorta(r.desde) + ' ' + horaCorta(r.desde) + (r.personas ? ', ' + r.personas + ' personas' : '') + (r.cliente ? ' · ' + r.cliente : '');
      toast(txt + (r.estado === 'pendiente' ? ' (por confirmar)' : ''), 10000);
      try{ (window.speakVoice || function(){})('Reserva nueva para ' + (r.recurso_nombre || etiqueta(r.recurso)) + ', el ' + fechaCorta(r.desde) + '.'); }catch(e){}
      try{ const A = window.VentoAndroid; if(A && A.notificar) A.notificar('📅 Reserva nueva', txt.replace(/^📅 Reserva nueva: /, ''), 'reservas', true); }catch(e){}
    });
  }

  // ---------- Atender = ocupada (y cobrar = libre) ----------
  let vigilando = false;
  async function vigilarOcupacion(){
    const d = D(), n = neg(); if(vigilando || !d || !n || !activo() || !d.tables) return;
    vigilando = true;
    try{
      const k = kNeg('ocupadas'); const oc = st.ocupadas || lsG(k, {}); st.ocupadas = oc;
      const abiertas = Object.keys(d.tables).filter(id => ((d.tables[id] || {}).items || []).length > 0);
      for(const id of abiertas){
        const x = oc[id];
        if(!x){
          const r = await rpc('reserva_ocupar', { p_negocio: n.id, p_recurso: String(id), p_recurso_nombre: etiqueta(id), p_hasta: hastaAlAtender().toISOString() }).catch(e => ({ ok: false, error: String(e.message || e) }));
          if(r && r.ok){ oc[id] = { hasta: r.reserva.hasta }; if(r.hasta_reserva) toast('⚠️ ' + etiqueta(id) + ' tiene una reserva desde ' + fechaCorta(r.hasta_reserva.desde) + ' ' + horaCorta(r.hasta_reserva.desde) + ': queda ocupada hasta esa hora.', 9000); }
          else if(r && r.error === 'reservada_ya'){ oc[id] = { hasta: new Date(Date.now() + 15 * 6e4).toISOString(), aviso: 1 }; toast('⚠️ ' + etiqueta(id) + ' está RESERVADA para ahora (' + horaCorta(r.choque.desde) + '). Revisa en 📅 Reservas.', 10000); }
          else if(r && /sin_permiso/.test(r.error || '')) break;
        } else if(new Date(x.hasta).getTime() - Date.now() < 30 * 6e4){
          const mas = tipo() === 'habitacion' ? DIA : 60 * 6e4;
          const r = await rpc('reserva_extender', { p_negocio: n.id, p_recurso: String(id), p_hasta: new Date(new Date(x.hasta).getTime() + mas).toISOString() }).catch(() => null);
          if(r && r.ok && r.hasta) x.hasta = r.hasta; else if(r && r.error === 'reservada_despues'){ x.hasta = new Date(Date.now() + DIA).toISOString(); toast('⚠️ ' + etiqueta(id) + ' sigue ocupada y tiene una reserva que empieza ' + fechaCorta(r.desde) + ' ' + horaCorta(r.desde) + '.', 10000); }
          else x.hasta = new Date(Date.now() + 30 * 6e4).toISOString();
        }
      }
      for(const id of Object.keys(oc)){
        if(abiertas.includes(id)) continue;
        await rpc('reserva_liberar', { p_negocio: n.id, p_recurso: String(id) }).catch(() => null);
        delete oc[id];
      }
      lsS(k, oc);
    }catch(e){}
    finally{ vigilando = false; }
  }

  // ---------- 🔧 Fuera de servicio (1.75.0) ----------
  // La habitación o mesa dañada queda BLOQUEADA en el servidor (una reserva «🔧 Fuera de servicio» de hasta 30 días): el
  // agente y el calendario ya no la ofrecen. Si tiene una reserva antes, se bloquea solo hasta esa reserva y se avisa.
  const BLOQUEO = 'bloqueo';
  const esBloqueo = r => !!r && r.nota === BLOQUEO;
  async function bloquear(id, on){
    const n = neg(), d = D(), t = d && d.tables && d.tables[id];
    if(!activo() || !n || !t) return { ok: false, error: 'sin_nube' };
    if(!on){
      if(!t.bloqueo) return { ok: true };
      const r = await rpc('reserva_estado', { p_id: t.bloqueo, p_estado: 'cancelada' }).catch(e => ({ ok: false, error: String(e.message || e) }));
      delete t.bloqueo; try{ saveData(); }catch(e){}
      cargar(true); return r;
    }
    if(t.bloqueo) return { ok: true };
    const desde = new Date(Date.now() - 6e4);
    const args = h => ({ p_negocio: n.id, p_id: null, p_recurso: String(id), p_recurso_nombre: etiqueta(id), p_desde: desde.toISOString(), p_hasta: h.toISOString(),
      p_cliente: '🔧 Fuera de servicio', p_telefono: null, p_personas: null, p_nota: BLOQUEO, p_estado: 'confirmada', p_valor: null });
    let r = await rpc('reserva_guardar', args(new Date(Date.now() + 30 * DIA))).catch(e => ({ ok: false, error: String(e.message || e) }));
    if(r && !r.ok && r.error === 'ocupado' && r.choque && new Date(r.choque.desde).getTime() > Date.now() + 36e5){
      const antes = r.choque;
      r = await rpc('reserva_guardar', args(new Date(antes.desde))).catch(e => ({ ok: false, error: String(e.message || e) }));
      if(r) r.hastaReserva = antes;
    }
    if(r && r.ok && r.reserva){ t.bloqueo = r.reserva.id; try{ saveData(); }catch(e){} }
    cargar(true);
    return r;
  }

  // ---------- En la tarjeta de la mesa / habitación ----------
  function marca(id){
    if(!activo() || !st.lista.length) return '';
    const ahora = Date.now(), lim = ahora + (tipo() === 'habitacion' ? 2 * DIA : 12 * 36e5);
    const r = st.lista.find(x => x.recurso === String(id) && !esBloqueo(x) && ['confirmada', 'pendiente'].includes(x.estado) && new Date(x.hasta).getTime() > ahora && new Date(x.desde).getTime() < lim);
    if(!r) return '';
    const hoy = new Date(r.desde).toDateString() === new Date().toDateString();
    return '<div class="tk-res">📅 Reservada ' + (hoy ? 'hoy ' : fechaCorta(r.desde) + ' ') + esc(horaCorta(r.desde)) + (r.cliente ? ' · ' + esc(r.cliente) : '') + (r.personas ? ' (' + r.personas + ')' : '') + '</div>';
  }

  // ---------- Pantalla ----------
  const ESTADO = { pendiente: ['🟡', 'Por confirmar'], confirmada: ['🟢', 'Confirmada'], ocupada: ['🔴', 'Ocupada'], terminada: ['⚪', 'Terminada'], no_llego: ['🚫', 'No llegó'], cancelada: ['❌', 'Cancelada'] };
  // Todas las habitaciones o mesas del negocio (sus cuentas), con lo configurado para reservar en línea encima. Las que no
  // se ofrecen en línea siguen en el calendario (se pueden reservar desde la app).
  function recursos(){
    const d = D(), h = tipo() === 'habitacion', cfgL = st.cfg && Array.isArray(st.cfg.recursos) ? st.cfg.recursos : null;
    const base = Object.keys((d && d.tables) || {}).sort((a, b) => a - b).map(id => ({ id: String(id), nombre: etiqueta(id), capacidad: h ? 2 : 4, precio: h ? precioNoche() : null }));
    if(!cfgL || !cfgL.length) return base;
    return base.map(x => { const c = cfgL.find(y => String(y.id) === x.id); return c ? Object.assign({}, x, c, { off: !!c.off }) : Object.assign({}, x, { off: true }); });
  }
  function precioNoche(){
    const p = ((D() || {}).products || []).filter(x => /\b(habitaci[oó]n|noche|suite|caba[ñn]a|apartamento|hospedaje)\b/i.test(x.name || '') && Number(x.price) > 0).sort((a, b) => a.price - b.price)[0];
    return p ? Number(p.price) : null;
  }
  function crear(){
    if($('rsOv')) return;
    const ov = document.createElement('div'); ov.className = 'overlay rs-ov'; ov.id = 'rsOv'; ov.setAttribute('data-novocab', '');
    ov.innerHTML = '<div class="modal rs-modal"><div class="modal-title-row"><h2>📅 Reservas</h2><button class="rename-table-btn" data-rs="cerrar" title="Cerrar">✕</button></div>' +
      '<div class="rs-tabs"><button type="button" data-rsv="hoy">Hoy y próximas</button><button type="button" data-rsv="cal">Calendario</button><button type="button" data-rsv="linea">🤖 En línea</button></div>' +
      '<div id="rsCuerpo"></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', clic);
    ov.addEventListener('change', cambio);
  }
  function abrir(vista){
    if(!agenteActivo()) return toast('Las reservas son para hoteles y restaurantes, y el agente de domicilios para tiendas, restaurantes y bares.');
    crear(); if(vista) st.vista = vista;
    if(!activo()) st.vista = 'linea';                          // tienda: solo el agente de domicilios
    $('rsOv').querySelector('.rs-tabs').hidden = !activo();
    $('rsOv').querySelector('h2').textContent = activo() ? '📅 Reservas' : '🤖 Agente de domicilios';
    $('rsCuerpo').dataset.v = '';
    $('rsOv').classList.add('show');
    pintar();
    if(!neg()){ $('rsCuerpo').innerHTML = '<div class="empty-note">Las reservas necesitan tu cuenta en la nube de ORDEVA (así todos los equipos y el agente ven lo mismo y nunca se reserva dos veces). Entra con tu cuenta en Ajustes.</div>'; return; }
    cargar(true);
  }
  let firmaMarcas = '';
  function pintarTodo(){
    pintar(); pintarBarra();
    // Las tarjetas de Cuentas muestran «📅 Reservada…»: se vuelven a dibujar si eso cambió (y no hay nada abierto encima).
    try{
      const f = st.lista.filter(r => ['confirmada', 'pendiente'].includes(r.estado)).map(r => r.id + r.estado + r.desde).join('|');
      const v = $('view-mesas');
      if(f !== firmaMarcas && v && v.classList.contains('active') && !document.querySelector('.overlay.show') && typeof renderMesas === 'function'){ firmaMarcas = f; renderMesas(); }
    }catch(e){}
  }
  function pintar(){
    const ov = $('rsOv'); if(!ov || !ov.classList.contains('show')) return;
    ov.querySelectorAll('[data-rsv]').forEach(b => b.classList.toggle('on', b.dataset.rsv === st.vista));
    const box = $('rsCuerpo');
    if(st.error && !st.lista.length){ box.innerHTML = '<div class="empty-note">⚠️ No se pudieron traer las reservas (' + esc(st.error) + '). Revisa el internet.</div>'; return; }
    // Lo que se está escribiendo (reserva nueva, configuración) NO se borra cuando llegan reservas: solo se actualizan las listas
    // y el calendario. Al cambiar de pestaña sí se pinta todo.
    if(box.dataset.v === st.vista && st.vista === 'hoy' && $('rsListas')){ $('rsListas').innerHTML = htmlListas(); return; }
    if(box.dataset.v === st.vista && st.vista === 'cal' && $('rsCalBox')){ $('rsCalBox').innerHTML = htmlCalTabla(); return; }
    if(box.dataset.v === st.vista && st.vista === 'linea' && $('rsActivo') && !st.repintarLinea) return;
    st.repintarLinea = false; box.dataset.v = st.vista;
    box.innerHTML = st.vista === 'cal' ? htmlCal() : st.vista === 'linea' ? htmlLinea() : htmlHoy();
  }
  function fila(r){
    const e = ESTADO[r.estado] || ['', r.estado];
    const acc = ['confirmada', 'pendiente'].includes(r.estado) ? '<button type="button" class="btn-primary" data-rs="llego" data-id="' + r.id + '">✅ Llegó</button>' +
        (r.estado === 'pendiente' ? '<button type="button" class="btn-ghost" data-rs="confirmar" data-id="' + r.id + '">👍 Confirmar</button>' : '') +
        '<button type="button" class="btn-ghost" data-rs="nollego" data-id="' + r.id + '">🚫 No llegó</button><button type="button" class="btn-ghost" data-rs="cancelar" data-id="' + r.id + '">❌ Cancelar</button>' : '';
    const tel = String(r.telefono || '').replace(/\D/g, '');
    return '<div class="rs-fila"><div class="rs-q"><b>' + esc(r.recurso_nombre || etiqueta(r.recurso)) + '</b><span>' + e[0] + ' ' + e[1] + (r.origen === 'agente' ? ' · 🤖 en línea' : r.origen === 'ocupacion' ? ' · atendida' : '') + '</span></div>' +
      '<div class="rs-c">' + esc(fechaCorta(r.desde) + ' ' + horaCorta(r.desde)) + ' → ' + esc((tipo() === 'habitacion' ? fechaCorta(r.hasta) + ' ' : '') + horaCorta(r.hasta)) +
      (r.cliente ? '<br>👤 ' + esc(r.cliente) + (r.personas ? ' · ' + r.personas + ' personas' : '') : '') + (r.nota ? '<br>📝 ' + esc(r.nota) : '') + (r.valor ? '<br>💰 ' + plata(r.valor) : '') +
      (r.codigo && r.origen !== 'ocupacion' ? ' · <small>Código ' + esc(r.codigo) + '</small>' : '') + '</div>' +
      '<div class="rs-acc">' + acc + (tel.length >= 7 ? '<a class="btn-ghost" href="https://wa.me/' + (tel.length === 10 ? '57' + tel : tel) + '" target="_blank" rel="noopener">💬 WhatsApp</a>' : '') + '</div></div>';
  }
  function htmlForm(pre){
    pre = pre || {};
    const rs = recursos(), h = tipo() === 'habitacion';
    const desde = pre.desde || (h ? conHora(new Date(), reglas().entrada) : new Date(Math.ceil(Date.now() / 18e5) * 18e5));
    const hasta = pre.hasta || (h ? conHora(new Date(new Date(desde).getTime() + DIA), reglas().salida) : new Date(new Date(desde).getTime() + (Number(reglas().duracion_min) || 120) * 6e4));
    return '<details class="rs-nueva"' + (pre.abrir ? ' open' : '') + '><summary>➕ Nueva reserva</summary><div class="rs-form">' +
      '<label>' + (h ? 'Habitación' : 'Mesa') + '<select id="rsRec">' + rs.map(x => '<option value="' + esc(x.id) + '"' + (String(pre.recurso) === String(x.id) ? ' selected' : '') + '>' + esc(x.nombre) + (x.capacidad ? ' · ' + x.capacidad + ' pers.' : '') + '</option>').join('') + '</select></label>' +
      '<label>' + (h ? 'Llega' : 'Desde') + '<input type="datetime-local" id="rsDesde" value="' + local(desde) + '"></label>' +
      '<label>' + (h ? 'Sale' : 'Hasta') + '<input type="datetime-local" id="rsHasta" value="' + local(hasta) + '"></label>' +
      '<label>Nombre<input id="rsCli" autocomplete="off" placeholder="¿A nombre de quién?"></label>' +
      '<label>Teléfono<input id="rsTel" inputmode="tel" autocomplete="off" placeholder="Para confirmar por WhatsApp"></label>' +
      '<label>Personas<input id="rsPer" type="number" min="1" max="99" value="' + (h ? 2 : 2) + '"></label>' +
      '<label class="rs-ancho">Nota<input id="rsNota" autocomplete="off" placeholder="Ej. cumpleaños, llega tarde, cama extra"></label>' +
      '<button type="button" class="btn-primary rs-ancho" data-rs="guardar">Guardar reserva</button><div id="rsMsg" class="rs-ancho"></div></div></details>';
  }
  function htmlHoy(){ return htmlForm() + '<div id="rsListas">' + htmlListas() + '</div>'; }
  function htmlListas(){
    const ahora = Date.now();
    const prox = st.lista.filter(r => ['confirmada', 'pendiente', 'ocupada'].includes(r.estado) && new Date(r.hasta).getTime() > ahora && r.origen !== 'ocupacion').sort((a, b) => new Date(a.desde) - new Date(b.desde));
    const hoy = prox.filter(r => new Date(r.desde).toDateString() === new Date().toDateString() || new Date(r.desde).getTime() <= ahora);
    const luego = prox.filter(r => !hoy.includes(r)).slice(0, 40);
    const pend = prox.filter(r => r.estado === 'pendiente').length;
    return (pend ? '<div class="rs-aviso">🟡 ' + pend + ' reserva' + (pend === 1 ? '' : 's') + ' en línea por confirmar.</div>' : '') +
      '<h3 class="rs-h">Hoy (' + hoy.length + ')</h3>' + (hoy.length ? hoy.map(fila).join('') : '<div class="empty-note">No hay reservas para hoy.</div>') +
      '<h3 class="rs-h">Próximas</h3>' + (luego.length ? luego.map(fila).join('') : '<div class="empty-note">No hay más reservas.</div>');
  }
  function htmlCal(){ return '<div id="rsCalBox">' + htmlCalTabla() + '</div><div id="rsFormCal"></div>'; }
  function htmlCalTabla(){
    const rs = recursos(), h = tipo() === 'habitacion';
    const ini = st.inicio || (() => { const x = new Date(); x.setHours(0, 0, 0, 0); return x.getTime(); })();
    let cols = [];
    if(h){ for(let i = 0; i < 14; i++) cols.push({ ini: ini + i * DIA, fin: ini + (i + 1) * DIA, t: new Date(ini + i * DIA).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' }) }); }
    else { const [a] = hm(reglas().abre), [c] = hm(reglas().cierra); const fin = c > a ? c : 24; for(let x = a; x < fin; x++) cols.push({ ini: ini + x * 36e5, fin: ini + (x + 1) * 36e5, t: (x % 12 || 12) + (x < 12 ? 'a' : 'p') }); }
    const act = st.lista.filter(r => ['confirmada', 'pendiente', 'ocupada'].includes(r.estado));
    const celda = (rec, c) => {
      const r = act.find(x => x.recurso === String(rec.id) && new Date(x.desde).getTime() < c.fin && new Date(x.hasta).getTime() > c.ini);
      if(!r) return '<td class="rs-libre" data-rs="nueva" data-rec="' + esc(rec.id) + '" data-t="' + c.ini + '" title="Libre: tocar para reservar"></td>';
      const ini0 = Math.abs(new Date(r.desde).getTime() - c.ini) < (h ? DIA : 36e5) && new Date(r.desde).getTime() >= c.ini;
      return '<td class="rs-' + r.estado + '" title="' + esc((r.cliente || (r.origen === 'ocupacion' ? 'Atendida' : '')) + ' · ' + fechaCorta(r.desde) + ' ' + horaCorta(r.desde)) + '">' + (ini0 ? esc((r.cliente || (r.origen === 'ocupacion' ? '●' : '')).split(' ')[0].slice(0, 8)) : '') + '</td>';
    };
    return '<div class="rs-nav"><button type="button" class="btn-ghost" data-rs="atras">‹</button><b>' + (h ? fechaCorta(ini) + ' → ' + fechaCorta(ini + 13 * DIA) : new Date(ini).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })) +
      '</b><button type="button" class="btn-ghost" data-rs="adelante">›</button><button type="button" class="btn-ghost" data-rs="hoyc">Hoy</button></div>' +
      '<div class="rs-ley">🟢 confirmada · 🟡 por confirmar · 🔴 ocupada · vacío = libre (tócalo para reservar)</div>' +
      '<div class="rs-cal"><table><thead><tr><th></th>' + cols.map(c => '<th>' + esc(c.t) + '</th>').join('') + '</tr></thead><tbody>' +
      rs.map(rec => '<tr><th>' + esc(rec.nombre) + '</th>' + cols.map(c => celda(rec, c)).join('') + '</tr>').join('') + '</tbody></table></div>';
  }
  function linkAgente(){ return st.cfg && st.cfg.publico ? location.origin + location.pathname.replace(/[^/]*$/, '') + 'agente.html?n=' + st.cfg.publico : ''; }
  function htmlLinea(){
    const c = st.cfg || {}, rg = reglas(), h = tipo() === 'habitacion', rs = recursos();
    const jefe = (() => { try{ return !window.ventoRoles || window.ventoRoles.esJefe(); }catch(e){ return true; } })();
    if(!jefe) return '<div class="empty-note">Las reservas en línea las configura el dueño o el administrador.</div>';
    const link = linkAgente(), reservas = activo(), q = qcfg();
    const resOn = reservas && c.activo && Array.isArray(c.recursos) && c.recursos.length > 0 || (reservas && !st.cfg);
    return '<div class="rs-linea"><p class="modal-sub">El 🤖 <b>agente de ORDEVA</b> atiende a tus clientes por un link (para WhatsApp, Instagram o Google): entiende lo que piden' +
        (reservas ? ', mira la disponibilidad REAL y reserva solo. Nunca reserva dos veces lo mismo: lo que está ocupado o reservado no se ofrece' : ' y arma el pedido con tu carta') + '. Nada se hace sin que el cliente confirme.</p>' +
      (reservas ? '<label class="rs-sw"><input type="checkbox" id="rsActivo"' + (c.activo && resOn ? ' checked' : '') + '> 📅 Recibir reservas en línea</label>' +
        '<label class="rs-sw"><input type="checkbox" id="rsConfirmar"' + (rg.confirmar ? ' checked' : '') + '> Quiero confirmar cada reserva antes (si no, quedan confirmadas solas)</label>' : '<input type="checkbox" id="rsActivo" hidden>') +
      (tipo() !== 'habitacion' ? '<label class="rs-sw"><input type="checkbox" id="rsDom"' + (c.activo && rg.domicilios ? ' checked' : '') + '> 🛵 Recibir domicilios por el agente (con tu carta; llegan como cualquier domicilio)</label>' : '') +
      '<label>WhatsApp para hablar con una persona<input id="rsWa" inputmode="tel" value="' + esc(rg.wa || q.wa || '') + '" placeholder="Ej. 3001234567"></label>' +
      (!reservas ? '' : (h ? '<div class="rs-dos"><label>Hora de entrada<input type="time" id="rsEntrada" value="' + esc(rg.entrada) + '"></label><label>Hora de salida<input type="time" id="rsSalida" value="' + esc(rg.salida) + '"></label></div>'
        : '<div class="rs-dos"><label>Abre<input type="time" id="rsAbre" value="' + esc(rg.abre) + '"></label><label>Cierra<input type="time" id="rsCierra" value="' + esc(rg.cierra) + '"></label><label>Minutos por reserva<input type="number" id="rsDur" min="30" max="480" step="15" value="' + esc(rg.duracion_min) + '"></label></div>')) +
      '<label>Información para los clientes (dirección, horarios, parqueadero, políticas…)<textarea id="rsInfo" rows="2" maxlength="400">' + esc(rg.info || '') + '</textarea></label>' +
      (!reservas ? '' :
      '<h3 class="rs-h">' + (h ? 'Habitaciones que se ofrecen' : 'Mesas que se ofrecen') + '</h3><div class="rs-recs">' +
      rs.map((x, i) => '<div class="rs-rec" data-i="' + i + '"><input data-k="nombre" value="' + esc(x.nombre) + '" aria-label="Nombre"><input data-k="capacidad" type="number" min="1" max="99" value="' + esc(x.capacidad || '') + '" title="Personas" aria-label="Personas">' +
        (h ? '<input data-k="precio" type="number" min="0" step="1000" value="' + esc(x.precio || '') + '" title="Precio por noche" aria-label="Precio por noche">' : '') +
        '<input data-k="detalle" value="' + esc(x.detalle || '') + '" placeholder="' + (h ? 'Ej. cama doble, baño privado' : 'Ej. terraza, junto a la ventana') + '" aria-label="Detalle"><label title="Se ofrece"><input type="checkbox" data-k="on"' + (x.off ? '' : ' checked') + '></label></div>').join('') + '</div>') +
      '<button type="button" class="btn-primary" data-rs="guardarcfg">Guardar</button>' +
      (link && c.activo ? '<div class="rs-link"><b>Link de tu agente:</b><input readonly value="' + esc(link) + '"><div><button type="button" class="btn-ghost" data-rs="copiar">📋 Copiar</button><a class="btn-ghost" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent('Reserva aquí: ' + link) + '">💬 Compartir</a><a class="btn-ghost" target="_blank" rel="noopener" href="' + esc(link) + '">👀 Probar</a></div></div>' : '') + '</div>';
  }
  async function clic(e){
    const v = e.target.closest('[data-rsv]'); if(v){ st.vista = v.dataset.rsv; pintar(); return; }
    const b = e.target.closest('[data-rs]'); if(!b) return;
    const a = b.dataset.rs, id = b.dataset.id, r = st.lista.find(x => x.id === id), n = neg();
    if(a === 'cerrar'){ $('rsOv').classList.remove('show'); return; }
    if(a === 'atras' || a === 'adelante' || a === 'hoyc'){
      const paso = tipo() === 'habitacion' ? 7 * DIA : DIA, base = st.inicio || (() => { const x = new Date(); x.setHours(0, 0, 0, 0); return x.getTime(); })();
      st.inicio = a === 'hoyc' ? null : base + (a === 'atras' ? -paso : paso); pintar(); return;
    }
    if(a === 'nueva'){
      const t = Number(b.dataset.t), h = tipo() === 'habitacion';
      const desde = h ? conHora(new Date(t), reglas().entrada) : new Date(t);
      $('rsFormCal').innerHTML = htmlForm({ recurso: b.dataset.rec, desde, abrir: true });
      $('rsFormCal').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); return;
    }
    if(a === 'guardar') return guardar();
    if(a === 'guardarcfg') return guardarCfg();
    if(a === 'copiar'){ try{ await navigator.clipboard.writeText(linkAgente()); toast('📋 Link copiado.'); }catch(x){ toast(linkAgente(), 9000); } return; }
    if(!r || !n) return;
    if(a === 'cancelar' && !(await confirmar('¿Cancelar la reserva de ' + (r.cliente || r.recurso_nombre) + '?'))) return;
    const estado = { llego: 'ocupada', confirmar: 'confirmada', nollego: 'no_llego', cancelar: 'cancelada' }[a];
    if(!estado) return;
    b.disabled = true;
    try{
      const x = await rpc('reserva_estado', { p_id: r.id, p_estado: estado });
      if(x && x.ok === false) toast('⚠️ No se pudo: ' + (x.error === 'ocupado' ? 'choca con otra reserva.' : x.error), 7000);
      if(a === 'llego'){
        const oc = st.ocupadas || lsG(kNeg('ocupadas'), {}); oc[r.recurso] = { hasta: r.hasta }; st.ocupadas = oc; lsS(kNeg('ocupadas'), oc);
        $('rsOv').classList.remove('show');
        const idMesa = isNaN(+r.recurso) ? r.recurso : +r.recurso;
        try{ const d = D(); if(d.tables[idMesa] && r.cliente && !d.tables[idMesa].nombre) d.tables[idMesa].nombre = r.cliente; }catch(x){}
        // 🪪 1.76.0: el registro del huésped arranca con lo que trae la reserva (nombre, celular y personas).
        try{ const t = D().tables[idMesa]; if(t && !t.huesped) t.huespedPre = { nombre: r.cliente || '', telefono: r.telefono || '', personas: Number(r.personas) || 1 }; saveData(); }catch(x){}
        try{ openTableModal(idMesa); }catch(x){}
        toast('✅ ' + (r.cliente || 'El cliente') + ' llegó: ' + (r.recurso_nombre || etiqueta(r.recurso)) + ' ocupada.', 6000);
      }
    }catch(err){ toast('⚠️ No se pudo: ' + (err.message || err), 7000); }
    cargar(true);
  }
  function confirmar(msg){ try{ return showConfirm({ title: msg, message: 'No se borra: queda en el historial de reservas.', confirmText: 'Sí', cancelText: 'No', icon: '📅' }); }catch(e){ return Promise.resolve(confirm(msg)); } }
  function cambio(){}
  async function guardar(){
    const n = neg(), msg = $('rsMsg'); if(!n) return;
    const rec = $('rsRec').value, recN = (recursos().find(x => String(x.id) === rec) || {}).nombre || etiqueta(rec);
    const desde = $('rsDesde').value, hasta = $('rsHasta').value;
    if(!desde || !hasta || new Date(hasta) <= new Date(desde)){ msg.textContent = '⚠️ Revisa las fechas: la salida tiene que ser después de la llegada.'; return; }
    msg.textContent = 'Guardando…';
    try{
      const r = await rpc('reserva_guardar', { p_negocio: n.id, p_id: null, p_recurso: rec, p_recurso_nombre: recN, p_desde: desdeLocal(desde), p_hasta: desdeLocal(hasta),
        p_cliente: $('rsCli').value.trim() || null, p_telefono: $('rsTel').value.trim() || null, p_personas: Number($('rsPer').value) || null, p_nota: $('rsNota').value.trim() || null, p_estado: null, p_valor: null });
      if(r && r.ok === false){
        const c = r.choque; msg.innerHTML = '⛔ <b>' + esc(recN) + ' ya está ' + (c && c.estado === 'ocupada' ? 'ocupada' : 'reservada') + '</b>' + (c ? ' del ' + esc(fechaCorta(c.desde) + ' ' + horaCorta(c.desde)) + ' al ' + esc(fechaCorta(c.hasta) + ' ' + horaCorta(c.hasta)) : '') + '. Elige otra o cambia las fechas.';
        return;
      }
      toast('📅 Reserva guardada: ' + recN + ', ' + fechaCorta(desde) + ' ' + horaCorta(desde) + '.');
      $('rsCuerpo').dataset.v = '';                              // formulario limpio para la siguiente
      await cargar(true);
    }catch(err){ msg.textContent = '⚠️ No se pudo guardar: ' + (err.message || err); }
  }
  async function guardarCfg(){
    const n = neg(); if(!n) return;
    const h = tipo() === 'habitacion', reservas = activo(), rg = Object.assign({}, reglas());
    rg.confirmar = !!($('rsConfirmar') && $('rsConfirmar').checked); rg.info = $('rsInfo').value.trim().slice(0, 400);
    rg.wa = String($('rsWa').value || '').replace(/[^\d+]/g, '').slice(0, 15);
    rg.domicilios = !!($('rsDom') && $('rsDom').checked);
    if(rg.domicilios){ const q = qcfg(); if(q.topic) rg.c = q.topic; else rg.domicilios = false; } else delete rg.c;
    const resOn = reservas && !!$('rsActivo').checked;
    if(!reservas){}
    else if(h){ rg.entrada = $('rsEntrada').value || '15:00'; rg.salida = $('rsSalida').value || '12:00'; }
    else { rg.abre = $('rsAbre').value || '12:00'; rg.cierra = $('rsCierra').value || '22:00'; rg.duracion_min = Math.min(480, Math.max(30, Number($('rsDur').value) || 120)); }
    const base = reservas ? recursos() : [];
    const rs = [...document.querySelectorAll('#rsOv .rs-rec')].map(el => {
      const x = Object.assign({}, base[+el.dataset.i]), v = k => { const i = el.querySelector('[data-k="' + k + '"]'); return i ? (i.type === 'checkbox' ? i.checked : i.value.trim()) : undefined; };
      x.nombre = v('nombre') || x.nombre; x.capacidad = Number(v('capacidad')) || null; if(h) x.precio = Number(v('precio')) || null; x.detalle = v('detalle') || ''; x.off = !v('on');
      return x;
    });
    try{
      const r = await rpc('reservas_config_guardar', { p_negocio: n.id, p_activo: resOn || rg.domicilios, p_tipo: !reservas ? 'ninguno' : h ? 'habitacion' : 'mesa', p_nombre: (D() || {}).businessName || null,
        p_recursos: resOn ? rs.filter(x => !x.off).map(x => ({ id: String(x.id), nombre: x.nombre, capacidad: x.capacidad, precio: x.precio || null, detalle: x.detalle })) : [], p_reglas: rg });
      st.cfg = r; st.repintarLinea = true; toast(r.activo ? '🤖 Listo: el agente ya atiende a tus clientes. Comparte su link.' : 'Guardado. El agente está apagado.', 6000);
      pintar();
    }catch(err){ toast('⚠️ No se pudo guardar: ' + (err.message || err), 7000); }
  }

  // ---------- Botón en Cuentas ----------
  function pintarBarra(){
    const v = $('view-mesas'), grid = $('tableGrid'); if(!v || !grid) return;
    let b = $('rsBarra');
    if(!activo()){ if(b) b.remove(); return; }
    if(!b){ b = document.createElement('button'); b.type = 'button'; b.id = 'rsBarra'; b.className = 'rs-barra'; b.onclick = () => abrir('hoy'); grid.parentNode.insertBefore(b, grid); }
    const ahora = Date.now(), hoy = st.lista.filter(r => ['confirmada', 'pendiente'].includes(r.estado) && r.origen !== 'ocupacion' && !esBloqueo(r) && new Date(r.desde).toDateString() === new Date().toDateString() && new Date(r.hasta).getTime() > ahora).length;
    const pend = st.lista.filter(r => r.estado === 'pendiente').length;
    b.innerHTML = '📅 Reservas' + (hoy ? ' · <b>' + hoy + ' hoy</b>' : '') + (pend ? ' · 🟡 ' + pend + ' por confirmar' : '');
  }

  const css = document.createElement('style');
  css.textContent = '.rs-modal{max-width:980px;width:min(980px,96vw);max-height:92vh;overflow:auto}' +
    '.rs-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 10px}.rs-tabs button{padding:8px 14px;border-radius:999px;border:1px solid var(--line);background:var(--surface);color:var(--ink);font-weight:700;cursor:pointer}.rs-tabs button.on{background:var(--amber);color:var(--on-amber,#fff);border-color:var(--amber)}' +
    '.rs-fila{display:grid;grid-template-columns:minmax(120px,1fr) 2fr;gap:4px 12px;padding:10px;border:1px solid var(--line);border-radius:12px;margin:6px 0;background:var(--surface)}.rs-q b{display:block}.rs-q span{font-size:12.5px;color:var(--ink-soft)}.rs-c{font-size:14px;line-height:1.45}.rs-acc{grid-column:1/-1;display:flex;gap:6px;flex-wrap:wrap}' +
    '.rs-h{margin:14px 0 4px;font-size:15px}.rs-aviso{padding:8px 10px;border-radius:10px;background:color-mix(in srgb,#f5b301 18%,transparent);margin:8px 0}' +
    '.rs-nueva{border:1px solid var(--line);border-radius:12px;padding:6px 10px;margin:6px 0}.rs-nueva summary{cursor:pointer;font-weight:800;padding:4px 0}.rs-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;margin:8px 0}.rs-form label{display:flex;flex-direction:column;font-size:12.5px;gap:3px}.rs-ancho{grid-column:1/-1}' +
    '.rs-nav{display:flex;gap:8px;align-items:center;margin:4px 0}.rs-nav b{flex:1;text-align:center}.rs-ley{font-size:12px;color:var(--ink-soft);margin:4px 0}' +
    '.rs-cal{overflow:auto;max-width:100%;border:1px solid var(--line);border-radius:10px}.rs-cal table{border-collapse:collapse;font-size:12px;min-width:100%}.rs-cal th,.rs-cal td{border:1px solid var(--line);padding:4px 5px;min-width:42px;height:30px;text-align:center;white-space:nowrap}.rs-cal tbody th{text-align:left;position:sticky;left:0;background:var(--surface);z-index:1;max-width:150px;overflow:hidden;text-overflow:ellipsis}' +
    '.rs-libre{cursor:pointer}.rs-libre:hover{background:color-mix(in srgb,var(--amber) 15%,transparent)}.rs-confirmada{background:#1f8a4c55}.rs-pendiente{background:#f5b30166}.rs-ocupada{background:#d6293f66}' +
    '.rs-linea label{display:flex;flex-direction:column;gap:3px;font-size:13px;margin:8px 0}.rs-linea label.rs-sw{flex-direction:row;align-items:center;gap:8px;font-weight:700}.rs-dos{display:flex;gap:10px;flex-wrap:wrap}.rs-recs{display:flex;flex-direction:column;gap:6px}.rs-rec{display:grid;grid-template-columns:2fr 70px 110px 2fr 30px;gap:6px;align-items:center}.rs-rec input{min-width:0}' +
    '.rs-link{margin-top:12px;padding:10px;border:1px dashed var(--line);border-radius:12px}.rs-link input{width:100%;margin:6px 0}.rs-link div{display:flex;gap:6px;flex-wrap:wrap}' +
    '.rs-barra{display:block;width:100%;margin:6px 0 10px;padding:10px 14px;border-radius:12px;border:1px solid var(--line);background:var(--surface);color:var(--ink);font-weight:700;text-align:left;cursor:pointer}' +
    '.tk-res{font-size:11.5px;margin-top:3px;padding:2px 6px;border-radius:8px;background:color-mix(in srgb,#2563eb 20%,transparent)}' +
    '@media (max-width:640px){.rs-fila{grid-template-columns:1fr}.rs-rec{grid-template-columns:1fr 60px 90px;}.rs-rec [data-k="detalle"]{grid-column:1/3}}';
  document.head.appendChild(css);

  window.ventoReservas = { activo, agenteActivo, tipo, abrir, cargar, marca, bloquear, esBloqueo, vigilar: vigilarOcupacion, estado: () => st, _hastaAlAtender: hastaAlAtender };
  // Cada 5 s: ¿se abrió o se cobró una cuenta? (ocupada / libre en el servidor). Cada minuto: las reservas al día.
  setInterval(() => { if(activo() && neg() && !document.hidden) vigilarOcupacion(); }, 5000);
  setInterval(() => { if(activo() && neg()) cargar(); }, 60000);
  window.addEventListener('vento-aviso-vivo', () => { if(activo() && neg()){ clearTimeout(st.av); st.av = setTimeout(() => cargar(true), 400); } });
  setTimeout(() => { if(activo() && neg()) cargar(true); else pintarBarra(); }, 3000);
  document.addEventListener('click', e => { if(e.target.closest && e.target.closest('nav button[data-view="mesas"]')) setTimeout(pintarBarra, 50); }, true);
})();
