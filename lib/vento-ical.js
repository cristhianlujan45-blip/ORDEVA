/* ORDEVA · lib/vento-ical.js — 1.76.0: 🔗 Calendario con Booking, Airbnb y otras plataformas (iCal), sin dobles reservas.
   En «📅 Reservas → 🔗 Booking y Airbnb», por cada habitación:
   • ORDEVA → plataforma: el link del calendario de esa habitación (se pega en Booking: Tarifas y disponibilidad →
     Sincronizar calendarios; en Airbnb: Calendario → Disponibilidad → Conectar calendarios). Solo lleva fechas ocupadas.
   • Plataforma → ORDEVA: se pega el link iCal que da Booking / Airbnb. Sus reservas bloquean la habitación aquí (el agente
     y el calendario ya no la ofrecen); si allá se cancela, aquí se cancela.
   • Se sincroniza solo cada 30 min mientras ORDEVA está abierto (en cualquier equipo del negocio) y con «🔄 Sincronizar».
   • Si algo de afuera choca con una reserva de ORDEVA, la base de datos NO lo guarda y la app avisa: «⚠️ Doble reserva».
   Los links de afuera se guardan con los datos del negocio (data.icalLinks). Solo hoteles, hostales y apartamentos. */
(function(){
  'use strict';
  if(window.ventoIcal) return;
  const D = () => (typeof data !== 'undefined' ? data : null);
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (t, ms) => { try{ showToast(t, ms || 5000); }catch(e){} };
  const nb = () => window.ventoNube || null;
  const neg = () => { try{ return nb() && nb().negocio ? nb().negocio() : null; }catch(e){ return null; } };
  const R = () => window.ventoReservas;
  const activo = () => { try{ return !!R() && R().tipo() === 'habitacion'; }catch(e){ return false; } };
  const jefe = () => { try{ return !window.ventoRoles || window.ventoRoles.esJefe(); }catch(e){ return true; } };
  const etiqueta = id => { try{ return tableLabel(id); }catch(e){ return 'Habitación ' + id; } };
  const DIA = 864e5, CADA = 30 * 6e4;
  const LS = 'vento_ical_ult';
  const lsG = (k, d) => { try{ const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; }catch(e){ return d; } };
  const lsS = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };

  function fuenteDe(url){
    const h = (() => { try{ return new URL(url).hostname; }catch(e){ return ''; } })();
    if(/booking\./.test(h)) return 'Booking'; if(/airbnb\./.test(h)) return 'Airbnb'; if(/vrbo|homeaway/.test(h)) return 'Vrbo';
    if(/expedia/.test(h)) return 'Expedia'; if(/despegar/.test(h)) return 'Despegar'; if(/hostelworld/.test(h)) return 'Hostelworld'; if(/agoda/.test(h)) return 'Agoda';
    if(/google/.test(h)) return 'Google'; if(!h || /^[\d.:]+$/.test(h)) return 'Otra'; return (h.split('.').slice(-2, -1)[0] || 'Otra').replace(/^\w/, c => c.toUpperCase());
  }
  const links = () => { const d = D(); return (d && d.icalLinks && typeof d.icalLinks === 'object') ? d.icalLinks : {}; };
  const habitaciones = () => Object.keys((D() || {}).tables || {}).sort((a, b) => a - b);

  // ---------- Leer un iCal ----------
  function desdoblar(txt){ return String(txt || '').replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n'); }
  function fechaDe(valor, params, hora){
    const v = String(valor || '').trim();
    let m = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
    if(m || /VALUE=DATE(?!-)/i.test(params || '')){
      if(!m) m = /^(\d{4})(\d{2})(\d{2})/.exec(v); if(!m) return null;
      const [hh, mm] = String(hora || '12:00').split(':').map(Number);
      return new Date(+m[1], +m[2] - 1, +m[3], hh || 0, mm || 0, 0, 0);   // hora del hotel (entrada / salida)
    }
    m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(v); if(!m) return null;
    return m[7] ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0))) : new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  }
  function leerIcs(txt, entrada, salida){
    const ev = []; let cur = null;
    for(const l of desdoblar(txt)){
      if(/^BEGIN:VEVENT/i.test(l)){ cur = {}; continue; }
      if(/^END:VEVENT/i.test(l)){
        if(cur && cur.uid && cur.desde && cur.hasta && !/CANCELLED/i.test(cur.status || '')) ev.push(cur);
        cur = null; continue;
      }
      if(!cur) continue;
      const i = l.indexOf(':'); if(i < 0) continue;
      const [nom, ...ps] = l.slice(0, i).split(';'), val = l.slice(i + 1), params = ps.join(';');
      const k = nom.toUpperCase();
      if(k === 'UID') cur.uid = val.trim();
      else if(k === 'DTSTART') cur.desde = fechaDe(val, params, entrada);
      else if(k === 'DTEND') cur.hasta = fechaDe(val, params, salida);
      else if(k === 'SUMMARY') cur.resumen = val.replace(/\\,/g, ',').replace(/\\;/g, ';').trim();
      else if(k === 'STATUS') cur.status = val;
    }
    // Un evento de un solo día (DTEND igual a DTSTART) bloquea esa noche.
    return ev.map(e => { let h = e.hasta; if(h <= e.desde) h = new Date(e.desde.getTime() + DIA); return { uid: e.uid, desde: e.desde.toISOString(), hasta: h.toISOString(), resumen: e.resumen || '' }; })
      .filter(e => /@ordeva$/.test(e.uid) === false);   // lo que ORDEVA mismo exportó no se vuelve a importar
  }

  // ---------- Servidor ----------
  async function sesion(){
    const c = await nb().cliente(); const s = await c.auth.getSession();
    const tok = s && s.data && s.data.session ? s.data.session.access_token : null;
    const cfg = nb().config(); return { c, tok, base: String(cfg.url || '').replace(/\/+$/, ''), key: cfg.key };
  }
  async function traer(url){
    const s = await sesion();
    const r = await fetch(s.base + '/functions/v1/vento-ical/leer', { method: 'POST', headers: { apikey: s.key, Authorization: 'Bearer ' + (s.tok || s.key), 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
    const j = await r.json().catch(() => ({}));
    if(!r.ok || !j.ok) throw new Error(j.mensaje || j.error || ('error ' + r.status));
    return j.ics;
  }
  async function publico(crear){
    const est = R().estado();
    if(est.cfg && est.cfg.publico) return est.cfg.publico;
    const n = neg(); if(!n) return null;
    const s = await sesion();
    let c = await s.c.rpc('reservas_config_ver', { p_negocio: n.id }).then(r => r.data).catch(() => null);
    if(!c && crear && jefe()){
      // Sin configuración todavía: se crea con el agente APAGADO (solo para tener el link del calendario).
      const r = await s.c.rpc('reservas_config_guardar', { p_negocio: n.id, p_activo: false, p_tipo: 'habitacion', p_nombre: (D() || {}).businessName || null, p_recursos: [], p_reglas: {} });
      if(!r.error) c = r.data;
    }
    if(c){ est.cfg = c; return c.publico; }
    return null;
  }
  const linkExport = (pub, id) => { const cfg = nb().config(); return String(cfg.url || '').replace(/\/+$/, '') + '/functions/v1/vento-ical/cal/' + pub + '/' + encodeURIComponent(id) + '.ics'; };

  // ---------- Sincronizar ----------
  let sincronizando = null;
  async function sincronizar(manual){
    if(sincronizando) return sincronizando;
    sincronizando = (async () => {
      const n = neg(); if(!activo() || !n) return { ok: false, error: 'sin_nube' };
      const L = links(), reglas = Object.assign({ entrada: '15:00', salida: '12:00' }, ((R().estado().cfg || {}).reglas) || {});
      const res = { ok: true, nuevas: 0, cambiadas: 0, canceladas: 0, choques: [], errores: [] };
      const s = await sesion();
      for(const id of Object.keys(L)){
        for(const x of (L[id] || [])){
          if(!x || !x.url) continue;
          try{
            const ev = leerIcs(await traer(x.url), reglas.entrada, reglas.salida);
            const r = await s.c.rpc('reserva_ical_sincronizar', { p_negocio: n.id, p_recurso: String(id), p_recurso_nombre: etiqueta(id), p_fuente: x.fuente || fuenteDe(x.url), p_eventos: ev });
            if(r.error) throw new Error(r.error.message || r.error);
            const j = r.data || {};
            res.nuevas += j.nuevas || 0; res.cambiadas += j.cambiadas || 0; res.canceladas += j.canceladas || 0;
            (j.choques || []).forEach(c => res.choques.push(Object.assign({ hab: etiqueta(id), fuente: x.fuente || fuenteDe(x.url) }, c)));
            x.ult = Date.now(); x.error = ''; x.n = ev.length;
          }catch(e){ x.error = String(e.message || e).slice(0, 160); res.errores.push(etiqueta(id) + ' (' + (x.fuente || fuenteDe(x.url)) + '): ' + x.error); }
        }
      }
      lsS(LS + ':' + n.id, Date.now());
      try{ saveData(); }catch(e){}
      try{ R().cargar(true); }catch(e){}
      const fd = t => new Date(t).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
      res.choques.forEach(c => {
        const txt = '⚠️ Doble reserva: ' + c.fuente + ' trae ' + c.hab + ' del ' + fd(c.desde) + ' al ' + fd(c.hasta) + (c.con ? ' y choca con ' + (c.con.cliente || 'una reserva') + ' (' + fd(c.con.desde) + ')' : '') + '. Cierra esas fechas en una de las dos.';
        toast(txt, 12000);
        try{ const A = window.VentoAndroid; if(A && A.notificar) A.notificar('⚠️ Doble reserva', txt.replace(/^⚠️ Doble reserva: /, ''), 'reservas', true); }catch(e){}
      });
      // El aviso de doble reserva es lo importante: el resumen solo sale si no hay choques (no lo tapa).
      if(manual && !res.choques.length) toast(res.errores.length ? '⚠️ ' + res.errores[0] : '🔄 Calendarios al día: ' + res.nuevas + ' nuevas, ' + res.canceladas + ' canceladas.', 8000);
      pintar();
      return res;
    })().finally(() => { sincronizando = null; });
    return sincronizando;
  }
  setInterval(() => {
    try{
      const n = neg(); if(!activo() || !n || !Object.keys(links()).length || document.hidden || navigator.onLine === false) return;
      if(Date.now() - (lsG(LS + ':' + n.id, 0) || 0) < CADA) return;
      sincronizar(false);
    }catch(e){}
  }, 60e3);

  // ---------- Pantalla ----------
  async function abrir(){
    let ov = $('icOv');
    if(!ov){ ov = document.createElement('div'); ov.id = 'icOv'; ov.className = 'overlay ic-ov'; ov.setAttribute('data-novocab', ''); document.body.appendChild(ov); }
    ov.classList.add('show');
    ov.innerHTML = '<div class="modal ic-modal"><p>Cargando…</p></div>';
    let pub = null; try{ pub = await publico(true); }catch(e){}
    ov._pub = pub;
    pintar();
  }
  function pintar(){
    const ov = $('icOv'); if(!ov || !ov.classList.contains('show')) return;
    const L = links(), pub = ov._pub;
    const filas = habitaciones().map(id => {
      const ls = L[id] || [];
      return '<div class="ic-hab"><b>' + esc(etiqueta(id)) + '</b>' +
        '<label>📤 ORDEVA → Booking / Airbnb (copia este link allá)<div class="ic-l"><input readonly value="' + esc(pub ? linkExport(pub, id) : 'Necesita la cuenta en la nube') + '"><button type="button" class="btn-ghost" data-ic="copiar" data-id="' + esc(id) + '"' + (pub ? '' : ' disabled') + '>📋 Copiar</button></div></label>' +
        '<div class="ic-imp">📥 Booking / Airbnb → ORDEVA' + ls.map((x, i) => '<div class="ic-l"><span class="ic-f">' + esc(x.fuente || fuenteDe(x.url)) + '</span><input readonly value="' + esc(x.url) + '"><button type="button" class="hp-mini" data-ic="quitar" data-id="' + esc(id) + '" data-i="' + i + '" title="Quitar">✕</button></div>' +
          '<small class="ic-est">' + (x.error ? '⚠️ ' + esc(x.error) : x.ult ? '✅ ' + (x.n || 0) + ' reservas · ' + esc(new Date(x.ult).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })) : 'Se sincroniza en un momento') + '</small>').join('') +
        '<div class="ic-l"><input data-ic-nuevo="' + esc(id) + '" placeholder="Pega aquí el link iCal (.ics) de Booking o Airbnb"><button type="button" class="btn-primary" data-ic="agregar" data-id="' + esc(id) + '">➕</button></div></div></div>';
    }).join('');
    ov.innerHTML = '<div class="modal ic-modal"><div class="modal-title-row"><h2>🔗 Booking y Airbnb</h2><button class="rename-table-btn" data-ic="cerrar" title="Cerrar">✕</button></div>' +
      '<p class="settings-desc">Así una habitación vendida en una plataforma queda ocupada en las otras y aquí. <b>Booking</b>: Tarifas y disponibilidad → Sincronizar calendarios. <b>Airbnb</b>: Calendario → Disponibilidad → Conectar calendarios. Se sincroniza solo cada 30 minutos.</p>' +
      '<div class="ic-bar"><button type="button" class="btn-primary" data-ic="sync">🔄 Sincronizar ahora</button></div>' + filas + '</div>';
  }
  document.addEventListener('click', async e => {
    const b = e.target.closest && e.target.closest('[data-ic]'); if(!b) return;
    e.stopPropagation();
    const a = b.dataset.ic, ov = $('icOv'), d = D(), id = b.dataset.id;
    if(a === 'abrir') return abrir();
    if(a === 'cerrar'){ ov.classList.remove('show'); return; }
    if(a === 'copiar'){ const v = linkExport(ov._pub, id); try{ await navigator.clipboard.writeText(v); toast('📋 Link de ' + etiqueta(id) + ' copiado: pégalo en Booking o Airbnb.'); }catch(x){ toast(v, 9000); } return; }
    if(a === 'sync'){ b.disabled = true; await sincronizar(true); return; }
    if(!jefe()){ toast('🔒 Solo el dueño o el administrador cambian los calendarios.'); return; }
    if(a === 'agregar'){
      const inp = ov.querySelector('[data-ic-nuevo="' + id + '"]'), url = String(inp.value || '').trim();
      if(!/^https:\/\/\S+$/i.test(url)){ toast('⚠️ Pega el link completo (empieza con https://).'); return; }
      d.icalLinks = Object.assign({}, d.icalLinks); d.icalLinks[id] = (d.icalLinks[id] || []).filter(x => x.url !== url).concat([{ fuente: fuenteDe(url), url }]);
      try{ saveData(); }catch(x){}
      pintar(); sincronizar(true);
      return;
    }
    if(a === 'quitar'){
      const ls = (d.icalLinks || {})[id] || [], x = ls[+b.dataset.i]; if(!x) return;
      ls.splice(+b.dataset.i, 1); if(!ls.length) delete d.icalLinks[id];
      try{ saveData(); }catch(err){}
      // Lo que esa plataforma había bloqueado se cancela (lista vacía).
      try{ const n = neg(), s = await sesion(); await s.c.rpc('reserva_ical_sincronizar', { p_negocio: n.id, p_recurso: String(id), p_recurso_nombre: etiqueta(id), p_fuente: x.fuente || fuenteDe(x.url), p_eventos: [] }); R().cargar(true); }catch(err){}
      pintar();
    }
  }, true);
  // Botón dentro de 📅 Reservas
  setInterval(() => {
    try{
      const tabs = document.querySelector('#rsOv .rs-tabs'); if(!tabs) return;
      let b = $('icBtn');
      if(!activo()){ if(b) b.remove(); return; }
      if(!b){ b = document.createElement('button'); b.type = 'button'; b.id = 'icBtn'; b.dataset.ic = 'abrir'; b.textContent = '🔗 Booking y Airbnb'; tabs.appendChild(b); }
    }catch(e){}
  }, 700);

  const css = document.createElement('style');
  css.textContent = '.ic-modal{max-width:820px;width:min(820px,96vw);max-height:92vh;overflow:auto}.ic-bar{margin:6px 0 10px}' +
    '.ic-hab{border:1px solid var(--line);border-radius:12px;padding:10px;margin:8px 0;background:var(--surface);display:flex;flex-direction:column;gap:6px}.ic-hab label,.ic-imp{display:flex;flex-direction:column;gap:4px;font-size:12.5px;font-weight:600}' +
    '.ic-l{display:flex;gap:6px;align-items:center}.ic-l input{flex:1;min-width:0;padding:7px 9px;border-radius:9px;border:1px solid var(--line);background:var(--surface-2,#fff);color:var(--ink);font:12.5px/1.3 inherit}' +
    '.ic-f{font-weight:800;min-width:70px}.ic-est{font-weight:500;color:var(--ink-soft)}';
  document.head.appendChild(css);

  window.ventoIcal = { abrir, sincronizar, leerIcs, fuenteDe, linkExport, activo };
})();
