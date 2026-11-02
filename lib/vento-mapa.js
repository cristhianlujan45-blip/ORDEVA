/* ORDEVA · lib/vento-mapa.js — 1.74.0: 🗺️ Mapa profesional de mesas, habitaciones y puestos.
   Lo que hacen los sistemas de restaurante y hotel serios (Toast, Square, OpenTable, Cloudbeds, Little Hotelier):
   cada mesa o habitación dice de un vistazo EN QUÉ ESTADO está, con un color fijo, y arriba un conteo que también filtra.
   • Estados (el mismo color en la lista y en el mapa del local):
       🟢 Libre · 🟠 Ocupada (con el tiempo que lleva) · 🔵 Reservada (llega pronto) · 🟤 Por limpiar (hoteles)
       ⚫ Fuera de servicio (hoteles) · 🔴 Atención: pedido nuevo del QR, pedido listo para servir, o una mesa ocupada
       que tiene una reserva encima.
   • Hoteles, hostales, apartamentos y moteles: al cobrar, la habitación queda «🧹 Por limpiar»; con «✅ Ya está limpia»
     vuelve a quedar libre. «🔧 Fuera de servicio» para una habitación dañada. «🧳 Sale hoy» si la reserva termina hoy.
     Las habitaciones con número de 3 cifras (101, 204…) se agrupan por piso.
   • Arriba, el conteo (libres, ocupadas, reservadas, por limpiar, por cobrar): al tocar uno se ven solo esas.
   No cambia cómo se abre o se cobra una cuenta: solo pinta mejor y avisa. */
(function(){
  'use strict';
  if(window.ventoMapa) return;
  const D = () => (typeof data !== 'undefined' ? data : null);
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tr = s => { try{ return i18nPut(s); }catch(e){ return s; } };
  const plata = n => { try{ return fmt(n); }catch(e){ return '$' + Math.round(n || 0).toLocaleString('es-CO'); } };
  const hora = t => new Date(t).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
  const HOSPEDAJE = ['hotel', 'hostal', 'apartamentos', 'motel'];
  const hospedaje = () => { const d = D(); return !!(d && HOSPEDAJE.includes(d.businessType)); };
  const etiqueta = id => { try{ return tableLabel(id); }catch(e){ return String(id); } };

  // ---------- Estado de cada mesa / habitación ----------
  const abierta = t => !!(t && t.items && t.items.length);
  function desde(t){
    if(!abierta(t)) return null;
    if(Number(t.entrada) > 0) return Number(t.entrada);
    const at = Math.min(...t.items.map(it => (it.history && it.history[0] && Number(it.history[0].at)) || Infinity));
    return isFinite(at) ? at : null;
  }
  function duracion(ms){
    const m = Math.max(0, Math.round(ms / 6e4));
    if(m < 60) return m + ' min';
    const h = Math.floor(m / 60), r = m % 60;
    return h + ' h' + (r ? ' ' + r + ' min' : '');
  }
  const reservas = () => { try{ const R = window.ventoReservas; return R && R.activo() ? (R.estado().lista || []) : []; }catch(e){ return []; } };
  const pedidos = () => { try{ return window.vitoPedidos ? window.vitoPedidos.lista() : []; }catch(e){ return []; } };
  function capacidad(id){
    try{ const c = window.ventoReservas && window.ventoReservas.estado().cfg; const r = c && (c.recursos || []).find(x => String(x.id) === String(id)); return r && Number(r.capacidad) > 0 ? Number(r.capacidad) : null; }catch(e){ return null; }
  }

  function estado(id, ctx){
    const d = D(), t = d && d.tables ? d.tables[id] : null, ahora = Date.now();
    const lista = (ctx && ctx.res) || reservas(), peds = (ctx && ctx.peds) || pedidos();
    const hosp = hospedaje();
    const e = { k: 'libre', txt: 'Libre', alerta: '', extra: '', min: null };
    const prox = lista.filter(r => r.recurso === String(id) && ['confirmada', 'pendiente'].includes(r.estado) && r.origen !== 'ocupacion' && new Date(r.hasta).getTime() > ahora)
      .sort((a, b) => new Date(a.desde) - new Date(b.desde))[0];
    if(abierta(t)){
      e.k = 'ocupada'; e.txt = 'Ocupada';
      const at = desde(t);
      if(at && !hosp){ e.min = Math.round((ahora - at) / 6e4); e.txt += ' · ' + duracion(ahora - at); }
      const mios = peds.filter(p => String(p.mesa) === String(id));
      if(mios.some(p => p.estado === 'listo')) e.alerta = '🔔 Pedido listo para servir';
      else if(mios.some(p => p.estado === 'nuevo')) e.alerta = '🆕 Pedido nuevo por aceptar';
      if(prox && !e.alerta){
        const falta = new Date(prox.desde).getTime() - ahora;
        if(falta < (hosp ? 6 : 1) * 36e5) e.alerta = '⚠️ Reservada ' + (falta <= 0 ? 'desde' : 'a') + ' las ' + hora(prox.desde) + (prox.cliente ? ' · ' + prox.cliente : '');
      }
      if(hosp){
        const oc = lista.find(r => r.recurso === String(id) && r.estado === 'ocupada' && r.origen !== 'ocupacion');
        if(oc && new Date(oc.hasta).toDateString() === new Date().toDateString()) e.extra = '🧳 Sale hoy ' + hora(oc.hasta);
      }
      return e;
    }
    if(t && t.aseo === 'mant'){ e.k = 'mant'; e.txt = 'Fuera de servicio'; return e; }
    if(prox){
      const falta = new Date(prox.desde).getTime() - ahora;
      const ventana = hosp ? (new Date(prox.desde).toDateString() === new Date().toDateString() || falta < 12 * 36e5) : falta < 3 * 36e5;
      if(ventana){ e.k = 'reservada'; e.txt = falta <= 0 ? 'Reservada · ya debía llegar' : 'Reservada · ' + hora(prox.desde); }
    }
    if(t && t.aseo === 'sucia'){
      if(e.k === 'reservada') e.alerta = '🧹 Hay que limpiarla antes de que llegue';
      else { e.k = 'sucia'; e.txt = 'Por limpiar'; }
    }
    return e;
  }

  // ---------- Tarjeta de la lista ----------
  let filtro = '';
  function tarjeta(card, id, ctx){
    const e = estado(id, ctx), d = D(), t = d.tables[id] || {};
    card.dataset.id = id; card.dataset.est = e.k;
    card.classList.add('mp-est', 'est-' + e.k);
    if(e.alerta) card.classList.add('mp-alerta');
    const st = card.querySelector('.status');
    // Libre / reservada / por limpiar / fuera de servicio: lo dice el texto grande. Ocupada: el valor va grande y el
    // tiempo que lleva va en la etiqueta de arriba.
    if(st && st.classList.contains('empty')) st.textContent = tr(e.k === 'reservada' ? e.txt.replace(/ · \d.*$/, '') : e.txt);
    const cap = capacidad(id);
    if(e.k === 'ocupada' || cap){
      const fila = document.createElement('div'); fila.className = 'mp-fila';
      fila.innerHTML = (e.k === 'ocupada' ? '<span class="mp-pill">' + esc(tr(e.txt)) + '</span>' : '') + (cap ? '<span class="mp-cap" title="Capacidad">👥 ' + cap + '</span>' : '');
      const num = card.querySelector('.num'); if(num) num.insertAdjacentElement('afterend', fila);
    }
    if(e.extra){ const x = document.createElement('div'); x.className = 'mp-extra'; x.textContent = e.extra; card.appendChild(x); }
    if(e.alerta){ const x = document.createElement('div'); x.className = 'mp-aviso'; x.textContent = e.alerta; card.appendChild(x); }
    if(e.k === 'sucia' || (e.k === 'reservada' && t.aseo === 'sucia')){
      const b = document.createElement('span'); b.className = 'mp-acc'; b.setAttribute('role', 'button'); b.tabIndex = 0; b.dataset.mapa = 'limpia'; b.dataset.id = id;
      b.textContent = '✅ ' + tr('Ya está limpia'); card.appendChild(b);
    }
    if(filtro && e.k !== filtro && !(filtro === 'alerta' && e.alerta)) card.classList.add('mp-oculta');
  }

  // Hoteles: habitaciones 101, 102… 201… se agrupan por piso (solo si hay al menos 2 pisos).
  function piso(id){ const m = /(?:^|\D)(\d{3,4})(?:\D|$)/.exec(etiqueta(id)); return m ? Math.floor(Number(m[1]) / 100) : null; }
  function lista(grid){
    if(!grid) return;
    const cards = [...grid.querySelectorAll('.ticket[data-id]')];
    if(hospedaje() && cards.length > 3){
      const ps = cards.map(c => piso(c.dataset.id));
      const distintos = [...new Set(ps.filter(p => p != null))];
      if(distintos.length >= 2 && ps.filter(p => p != null).length >= cards.length * 0.6){
        const orden = cards.map((c, i) => ({ c, p: ps[i] == null ? 999 : ps[i], n: Number(c.dataset.id) })).sort((a, b) => a.p - b.p || a.n - b.n);
        let actual = null;
        orden.forEach(o => {
          if(o.p !== actual){ actual = o.p; const h = document.createElement('div'); h.className = 'mp-piso'; h.textContent = o.p === 999 ? tr('Otras') : (o.p === 0 ? tr('Primer piso') : tr('Piso') + ' ' + o.p); grid.appendChild(h); }
          grid.appendChild(o.c);
        });
      }
    }
    pintarFiltroAviso(grid);
  }
  function pintarFiltroAviso(grid){
    let a = $('mpFiltro');
    if(!filtro){ if(a) a.remove(); return; }
    if(!a){ a = document.createElement('button'); a.type = 'button'; a.id = 'mpFiltro'; a.className = 'mp-filtro'; a.onclick = () => { filtro = ''; repintar(); }; }
    const n = grid.querySelectorAll('.ticket.mp-est:not(.mp-oculta), .floor-table.mp-est:not(.mp-tenue)').length;
    a.innerHTML = tr('Mostrando') + ': <b>' + esc(tr(NOMBRES[filtro] || filtro)) + '</b> (' + n + ') · <u>' + tr('Ver todas') + '</u>';
    const ref = $('tableGrid'); if(ref && a.nextElementSibling !== ref) ref.parentNode.insertBefore(a, ref);
  }

  // ---------- Mapa del local ----------
  const BADGE = { reservada: '📅', sucia: '🧹', mant: '🔧' };
  function plano(el, id, ctx){
    const e = estado(id, ctx);
    el.dataset.id = id; el.dataset.est = e.k;
    el.classList.add('mp-est', 'est-' + e.k);
    if(e.alerta) el.classList.add('mp-alerta');
    const s = el.querySelector('.ft-status');
    if(s){
      if(e.k === 'ocupada'){ if(e.min != null) s.textContent = s.textContent + ' · ' + (e.min < 60 ? e.min + '′' : Math.floor(e.min / 60) + 'h' + String(e.min % 60).padStart(2, '0')); }
      else if(e.k === 'reservada') s.textContent = '📅 ' + e.txt.replace(/^Reservada · /, '');
      else s.textContent = tr(e.k === 'sucia' ? 'Por limpiar' : e.k === 'mant' ? 'Fuera de servicio' : 'Libre');
    }
    const b = e.alerta ? e.alerta.split(' ')[0] : BADGE[e.k];
    if(b){ const x = document.createElement('span'); x.className = 'ft-badge'; x.textContent = b; x.title = e.alerta || e.txt; el.appendChild(x); }
    el.title = etiqueta(id) + ' · ' + e.txt + (e.alerta ? ' · ' + e.alerta : '') + (e.extra ? ' · ' + e.extra : '');
    if(filtro && e.k !== filtro && !(filtro === 'alerta' && e.alerta)) el.classList.add('mp-tenue');
  }
  function planoListo(plan){ if(plan) pintarFiltroAviso(plan); }

  // ---------- Conteo arriba (también filtra) ----------
  const NOMBRES = { libre: 'Libres', ocupada: 'Ocupadas', reservada: 'Reservadas', sucia: 'Por limpiar', mant: 'Fuera de servicio', alerta: 'Para atender' };
  function contexto(){ return { res: reservas(), peds: pedidos() }; }
  function resumen(){
    const el = $('mesasSummary'), d = D(); if(!el || !d || !d.tables) return false;
    const ctx = contexto(), ids = Object.keys(d.tables).map(Number);
    const c = { libre: 0, ocupada: 0, reservada: 0, sucia: 0, mant: 0, alerta: 0 };
    let porCobrar = 0;
    ids.forEach(id => { const e = estado(id, ctx); c[e.k]++; if(e.alerta) c.alerta++; if(e.k === 'ocupada') try{ porCobrar += tableBalance(id); }catch(x){} });
    const item = (k, cls, n, txt) => '<button type="button" class="ms-item mp-ms ' + cls + (filtro === k ? ' on' : '') + '" data-mpf="' + k + '"><b><i class="mp-dot est-' + k + '"></i>' + n + '</b><span>' + esc(tr(txt)) + '</span></button>';
    let h = item('libre', 'ms-free', c.libre, c.libre === 1 ? 'libre' : 'libres') +
      item('ocupada', 'ms-open', c.ocupada, c.ocupada === 1 ? 'ocupada' : 'ocupadas');
    if(c.reservada || (window.ventoReservas && window.ventoReservas.activo())) h += item('reservada', 'ms-res', c.reservada, c.reservada === 1 ? 'reservada' : 'reservadas');
    if(hospedaje() || c.sucia) h += item('sucia', 'ms-sucia', c.sucia, 'por limpiar');
    if(c.mant) h += item('mant', 'ms-mant', c.mant, 'fuera de servicio');
    if(c.alerta) h += item('alerta', 'ms-alerta', c.alerta, 'para atender');
    h += '<div class="ms-item ms-cobrar"><b>' + plata(porCobrar) + '</b><span>' + tr('por cobrar') + '</span></div>';
    el.innerHTML = h; el.classList.add('mp-resumen');
    return true;
  }

  function repintar(){ try{ renderMesas(); }catch(e){} }

  // ---------- Limpieza de habitaciones ----------
  function poner(id, v){
    const d = D(), t = d && d.tables && d.tables[id]; if(!t) return;
    if(v) t.aseo = v; else delete t.aseo;
    try{ saveData(); }catch(e){}
    repintar(); pintarCaja();
  }
  document.addEventListener('click', ev => {
    const f = ev.target.closest && ev.target.closest('[data-mpf]');
    if(f){ const k = f.dataset.mpf; filtro = filtro === k ? '' : k; repintar(); return; }
    const b = ev.target.closest && ev.target.closest('[data-mapa]');
    if(!b) return;
    ev.stopPropagation(); ev.preventDefault();
    const id = Number(b.dataset.id != null ? b.dataset.id : (typeof currentTable !== 'undefined' ? currentTable : NaN));
    if(!isFinite(id)) return;
    const a = b.dataset.mapa;
    if(a === 'limpia'){ poner(id, null); try{ showToast('✅ ' + etiqueta(id) + ' ' + tr('quedó limpia y disponible.')); }catch(e){} }
    else if(a === 'sucia') poner(id, 'sucia');
    else if(a === 'mant'){ poner(id, 'mant'); try{ showToast('🔧 ' + etiqueta(id) + ' ' + tr('quedó fuera de servicio.')); }catch(e){} }
  }, true);
  document.addEventListener('keydown', ev => {
    if((ev.key === 'Enter' || ev.key === ' ') && ev.target && ev.target.matches && ev.target.matches('.mp-acc')){ ev.preventDefault(); ev.target.click(); }
  }, true);

  // Al cobrar una habitación, queda por limpiar.
  function envolverCierre(){
    const orig = window.closeTableToHistory; if(typeof orig !== 'function' || orig._mp) return;
    const nuevo = function(id){
      const r = orig.apply(this, arguments);
      try{ const t = D().tables[id]; if(r && t && hospedaje() && !abierta(t)) t.aseo = 'sucia'; }catch(e){}
      return r;
    };
    nuevo._mp = true; window.closeTableToHistory = nuevo;
  }

  // En la cuenta de una habitación vacía: su estado de limpieza.
  function pintarCaja(){
    const ov = $('overlay'), cont = $('itemsContainer'); let box = $('mpAseo');
    const id = typeof currentTable !== 'undefined' ? currentTable : null, d = D();
    const t = id != null && d && d.tables ? d.tables[id] : null;
    const ver = hospedaje() && ov && ov.classList.contains('show') && t && !abierta(t);
    if(!ver){ if(box) box.hidden = true; return; }
    if(!cont || !cont.parentNode) return;
    if(!box){ box = document.createElement('div'); box.id = 'mpAseo'; box.className = 'mp-aseo'; }
    if(box.parentNode !== cont.parentNode) cont.parentNode.insertBefore(box, cont);
    const a = t.aseo || 'limpia';
    const op = (k, txt) => '<button type="button" class="mp-op' + (a === k ? ' on' : '') + '" data-mapa="' + k + '">' + txt + '</button>';
    const html = '<span>' + tr('Estado de la habitación') + ':</span>' + op('limpia', '✅ ' + tr('Limpia')) + op('sucia', '🧹 ' + tr('Por limpiar')) + op('mant', '🔧 ' + tr('Fuera de servicio'));
    if(box._k !== html){ box._k = html; box.innerHTML = html; }
    box.hidden = false;
  }

  // Resumen: reemplaza el de 3 casillas por el conteo por estado.
  function envolverResumen(){
    const orig = window.renderMesasSummary; if(typeof orig !== 'function' || orig._mp) return;
    const nuevo = function(){ if(!resumen()) return orig.apply(this, arguments); };
    nuevo._mp = true; window.renderMesasSummary = nuevo;
  }
  envolverCierre(); envolverResumen();
  setInterval(() => { try{ envolverCierre(); envolverResumen(); pintarCaja(); }catch(e){} }, 500);
  // El tiempo de cada mesa y los avisos de cocina se refrescan solos (solo si se está viendo Cuentas sin nada encima).
  let firma = '';
  setInterval(() => {
    try{
      const v = $('view-mesas'); if(document.hidden || !v || !v.classList.contains('active') || document.querySelector('.overlay.show')) return;
      if(document.querySelector('.floor-table.dragging')) return;
      const d = D(); if(!d || !d.tables) return;
      const ctx = contexto(), f = Object.keys(d.tables).map(id => { const e = estado(Number(id), ctx); return id + e.k + e.txt + e.alerta; }).join('|');
      if(f !== firma){ firma = f; repintar(); }
    }catch(e){}
  }, 20000);

  const css = document.createElement('style');
  css.textContent =
    ':root{--mp-libre:#16a34a;--mp-ocupada:#f59e0b;--mp-reservada:#2563eb;--mp-sucia:#a16207;--mp-mant:#64748b;--mp-alerta:#dc2626}' +
    '.mesas-summary.mp-resumen{display:flex;flex-wrap:wrap;gap:8px}.mp-resumen .ms-item{flex:1 1 92px;text-align:left;font:inherit;color:inherit;cursor:pointer;transition:border-color .15s,box-shadow .15s}.mp-resumen .ms-cobrar{flex:1.6 1 130px;cursor:default}' +
    '.mp-resumen .ms-item.on{border-color:var(--ink);box-shadow:0 0 0 2px color-mix(in srgb,var(--ink) 25%,transparent)}.mp-resumen .ms-item b{display:flex;align-items:center;gap:7px}' +
    '.mp-dot{display:inline-block;width:10px;height:10px;border-radius:50%;flex:none;background:var(--mp-libre)}.mp-dot.est-ocupada{background:var(--mp-ocupada)}.mp-dot.est-reservada{background:var(--mp-reservada)}.mp-dot.est-sucia{background:var(--mp-sucia)}.mp-dot.est-mant{background:var(--mp-mant)}.mp-dot.est-alerta{background:var(--mp-alerta)}' +
    '.mp-resumen .ms-res b{color:var(--mp-reservada)}.mp-resumen .ms-sucia b{color:var(--mp-sucia)}.mp-resumen .ms-mant b{color:var(--mp-mant)}.mp-resumen .ms-alerta b{color:var(--mp-alerta)}' +
    '.ticket.mp-est{--mp-c:var(--mp-libre);border-top:4px solid var(--mp-c)}.ticket.est-ocupada{--mp-c:var(--mp-ocupada)}.ticket.est-reservada{--mp-c:var(--mp-reservada)}.ticket.est-sucia{--mp-c:var(--mp-sucia)}.ticket.est-mant{--mp-c:var(--mp-mant)}' +
    '.ticket.mp-est .num::before{background:var(--mp-c);box-shadow:0 0 0 3px color-mix(in srgb,var(--mp-c) 25%,transparent)}' +
    '.ticket.est-reservada{background:color-mix(in srgb,var(--mp-reservada) 9%,var(--surface))}.ticket.est-sucia{background:color-mix(in srgb,var(--mp-sucia) 9%,var(--surface))}' +
    '.ticket.est-mant{background:repeating-linear-gradient(135deg,var(--surface) 0 10px,color-mix(in srgb,var(--mp-mant) 10%,var(--surface)) 10px 20px);opacity:.85}' +
    '.mp-fila{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:6px}.mp-pill{font-size:11.5px;font-weight:800;padding:2px 8px;border-radius:999px;background:color-mix(in srgb,var(--mp-c) 18%,transparent);color:var(--ink);border:1px solid color-mix(in srgb,var(--mp-c) 45%,transparent)}' +
    '.ticket.open .mp-pill{background:color-mix(in srgb,#000 10%,transparent);border-color:color-mix(in srgb,#000 22%,transparent)}.mp-cap{font-size:11.5px;color:var(--ink-soft);font-weight:700}' +
    '.mp-extra{font-size:11.5px;font-weight:700;margin-top:3px}.mp-aviso{font-size:12px;font-weight:800;margin-top:5px;padding:3px 7px;border-radius:8px;background:color-mix(in srgb,var(--mp-alerta) 16%,transparent);border:1px solid color-mix(in srgb,var(--mp-alerta) 50%,transparent)}' +
    '.ticket.mp-alerta{box-shadow:0 0 0 2px var(--mp-alerta),0 8px 22px color-mix(in srgb,var(--mp-alerta) 25%,transparent);animation:mpPulso 2s ease-in-out infinite}' +
    '@keyframes mpPulso{0%,100%{box-shadow:0 0 0 2px var(--mp-alerta)}50%{box-shadow:0 0 0 5px color-mix(in srgb,var(--mp-alerta) 45%,transparent)}}' +
    '.mp-acc{display:inline-block;margin-top:7px;padding:5px 10px;border-radius:999px;font-size:12.5px;font-weight:800;background:var(--mp-libre);color:#fff;cursor:pointer;align-self:flex-start}' +
    '.mp-oculta{display:none!important}.mp-piso{grid-column:1/-1;font-weight:800;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-soft);margin:6px 2px -6px;padding-bottom:4px;border-bottom:1px solid var(--line)}' +
    '.mp-filtro{display:block;margin:0 0 10px;padding:8px 12px;border-radius:12px;border:1px dashed var(--line);background:var(--surface);color:var(--ink);font:inherit;font-size:13px;cursor:pointer;text-align:left;width:100%}' +
    '.floor-table.mp-est{--mp-c:var(--mp-libre);border-color:var(--mp-c);border-width:3px;overflow:visible}.floor-table.est-ocupada{--mp-c:var(--mp-ocupada)}.floor-table.est-reservada{--mp-c:var(--mp-reservada);background:color-mix(in srgb,var(--mp-reservada) 14%,var(--paper))}' +
    '.floor-table.est-sucia{--mp-c:var(--mp-sucia);background:color-mix(in srgb,var(--mp-sucia) 14%,var(--paper));border-style:dashed}.floor-table.est-mant{--mp-c:var(--mp-mant);opacity:.7;border-style:dotted}' +
    '.floor-table.mp-alerta{box-shadow:0 0 0 3px var(--mp-alerta),0 6px 14px rgba(0,0,0,.3);animation:mpPulso 2s ease-in-out infinite}.floor-table.mp-tenue{opacity:.22}' +
    '.floor-table .ft-photo{border-radius:inherit}.ft-badge{position:absolute;top:-9px;right:-9px;min-width:22px;height:22px;border-radius:50%;background:var(--surface);border:2px solid var(--mp-c);display:flex;align-items:center;justify-content:center;font-size:12px;line-height:1;box-shadow:0 2px 6px rgba(0,0,0,.25)}' +
    '.floor-table.mp-alerta .ft-badge{border-color:var(--mp-alerta)}' +
    '.floor-table.mp-est.has-photo{overflow:hidden}.floor-table.has-photo .ft-badge{top:3px;right:50%;transform:translateX(50%);z-index:2}' +
    '.mp-aseo{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:6px 0 10px;padding:9px 12px;border-radius:12px;border:1px solid var(--line);background:var(--surface-2,var(--surface));font-size:13.5px}.mp-aseo[hidden]{display:none}' +
    '.mp-op{border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:999px;padding:5px 11px;font:700 12.5px/1.2 var(--font-main,inherit);cursor:pointer}.mp-op.on{background:var(--ink);color:var(--paper,#fff);border-color:var(--ink)}' +
    '@media (prefers-reduced-motion:reduce){.ticket.mp-alerta,.floor-table.mp-alerta{animation:none}}';
  document.head.appendChild(css);

  window.ventoMapa = { estado, tarjeta, plano, lista, planoListo, contexto, resumen, filtro: k => { if(k !== undefined){ filtro = k || ''; repintar(); } return filtro; } };
  // Ya cargó: se repinta una vez con los estados nuevos.
  repintar();
})();
