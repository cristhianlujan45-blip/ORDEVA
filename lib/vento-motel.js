/* =====================================================================
   ORDEVA · ⏱️ Motel por horas (1.85.0)
   El catálogo prometía «tiempo por habitación (horas)», pero nada cobraba el tiempo: el mapa solo decía «Ocupada».
     • El plan sale del nombre de la tarifa: «Rato (3 horas)» = 3 h, «4 horas» = 4 h, «Noche» = 12 h (se cambia en
       Ajustes → Negocio). La «Hora adicional» es la tarifa que se suma cuando se pasa del tiempo.
     • En la cuenta de la habitación: «🕒 Entró 9:10 p. m. · lleva 2 h 40 min · Rato (3 horas) hasta 12:10 a. m.», y si
       se pasó: «⚠️ Se pasó 25 min: falta 1 hora adicional» con el botón «Sumar». Se puede corregir la hora de entrada.
     • En el mapa: «⏳ Sale 12:10 a. m.» y, cuando se pasa, el aviso «⏰ Se pasó 25 min» (resaltado). Un aviso en
       pantalla al vencer (y 10 minutos antes).
     • Al cobrar, si falta cobrar horas adicionales, se pregunta «¿Sumar 1 hora adicional?» (sumar y cobrar / cobrar sin
       sumar / cancelar). NO se suman solas: si cada equipo las sumara solo, con dos equipos prendidos se cobrarían dos
       veces.
     • Antes de cobrar el tiempo se da una tolerancia (10 min, se cambia en Ajustes).
     • La venta guarda la entrada, la salida y los minutos.
   ===================================================================== */
(function(){
  'use strict';
  if(window.ventoMotel) return;
  const D = () => (typeof data !== 'undefined' ? data : null);
  const activo = () => { const d = D(); return !!(d && d.businessType === 'motel'); };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plata = n => { try{ return fmt(Math.round(n || 0)); }catch(e){ return '$' + Math.round(n || 0).toLocaleString('es-CO'); } };
  const toast = (t, ms) => { try{ showToast(t, ms || 6000); }catch(e){} };
  const guardar = () => { try{ saveData(); }catch(e){} };
  const hora = at => new Date(at).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
  const local = at => { const d = new Date(at - new Date(at).getTimezoneOffset() * 6e4); return d.toISOString().slice(0, 16); };
  const cfg = () => { const d = D() || {}, c = d.motelCfg || {}; return { tol: c.tol != null ? Math.max(0, Math.min(60, Number(c.tol) || 0)) : 10, noche: Math.max(1, Math.min(24, Number(c.noche) || 12)) }; };
  function dur(ms){
    const m = Math.max(0, Math.round(ms / 6e4));
    if(m < 60) return m + ' min';
    const h = Math.floor(m / 60), r = m % 60;
    return h + ' h' + (r ? ' ' + r + ' min' : '');
  }

  // ---------- Tarifas ----------
  const EXTRA = /\b(hora|tiempo)s?\s+(adicional|extra)(es)?\b|\bhoras?\s+de\s+m[aá]s\b/i;
  const esExtra = it => !!it && EXTRA.test(it.name || '');
  const producto = id => { const d = D(); return id && d && Array.isArray(d.products) ? d.products.find(p => p.id === id) || null : null; };
  // Horas que da una tarifa (0 si no es un plan de tiempo: bebidas, preservativos, parqueadero…).
  function horasDe(it){
    if(!it || esExtra(it)) return 0;
    const p = producto(it.productId), n = String(it.name || '');
    const fija = p && (Number(p.horas) || (p.det && Number(p.det.horas)));
    if(fija > 0) return fija;
    const m = n.match(/(\d+(?:[.,]\d+)?)\s*(?:h\b|hrs?\b|horas?\b)/i);
    if(m) return Number(m[1].replace(',', '.')) || 0;
    if(/\b(noche|amanecida|pernocta|amanecer|dormida)\b/i.test(n)) return cfg().noche;
    if(/\brato\b/i.test(n)) return 3;
    return 0;
  }
  function entrada(t){
    if(!t || !(t.items || []).length) return null;
    if(Number(t.entrada) > 0) return Number(t.entrada);
    const at = Math.min(...t.items.map(it => (it.history && it.history[0] && Number(it.history[0].at)) || Infinity));
    return isFinite(at) ? at : null;
  }
  const productoExtra = () => { const d = D(); return d && Array.isArray(d.products) ? d.products.find(p => p && EXTRA.test(p.name || '') && !p.oculto) || null : null; };

  // El estado de la habitación: cuánto lleva, hasta cuándo va su plan y cuántas horas adicionales faltan por cobrar.
  function estado(t, ahora){
    if(!activo()) return null;
    const at = entrada(t); if(!at) return null;
    ahora = ahora || Date.now();
    const planes = (t.items || []).filter(it => horasDe(it) > 0);
    const incl = planes.reduce((s, it) => s + horasDe(it) * (Number(it.qty) || 0), 0) * 36e5;
    const lleva = ahora - at;
    const r = { entrada: at, lleva, incluido: incl, plan: planes.map(it => (Number(it.qty) > 1 ? it.qty + ' × ' : '') + it.name).join(' + '), hasta: incl ? at + incl : null, pasado: 0, debidas: 0, cobradas: 0, faltan: 0 };
    if(!incl) return r;
    r.pasado = Math.max(0, lleva - incl);
    r.debidas = r.pasado > cfg().tol * 6e4 ? Math.ceil(r.pasado / 36e5) : 0;
    r.cobradas = (t.items || []).filter(esExtra).reduce((s, it) => s + (Number(it.qty) || 0), 0);
    r.faltan = Math.max(0, r.debidas - r.cobradas);
    return r;
  }
  // Lo que pinta el mapa de la habitación: { txt, alerta, extra }.
  function mapa(t){
    const e = estado(t); if(!e) return null;
    const o = { txt: dur(e.lleva), alerta: '', extra: '' };
    if(e.hasta){
      if(e.faltan > 0) o.alerta = '⏰ Se pasó ' + dur(e.pasado) + ' · ' + e.faltan + (e.faltan === 1 ? ' hora adicional' : ' horas adicionales');
      else if(e.pasado > 0 && e.debidas > 0) o.extra = '⏳ Horas adicionales cobradas · sale ' + hora(e.entrada + e.incluido + e.cobradas * 36e5);
      else o.extra = '⏳ Sale ' + hora(e.hasta);
    }
    return o;
  }

  // Suma n horas adicionales a la cuenta de la habitación (la línea de «Hora adicional» de siempre, con su precio).
  function sumar(id, n){
    const d = D(), t = d && d.tables && d.tables[id], p = productoExtra(); n = Math.round(Number(n) || 0);
    if(!t || !p || !(n > 0)) return false;
    if(!t.items) t.items = [];
    let it = t.items.find(x => x.productId === p.id && !x.personId);
    if(it) it.qty = (Number(it.qty) || 0) + n;
    else { it = { productId: p.id, name: p.name, price: Number(p.price) || 0, size: p.size || '', qty: n, personId: null, history: [] }; t.items.push(it); }
    try{ recordItemHistory(it, n); }catch(e){}
    try{ noteManualChange(id, it.name, n); }catch(e){}
    guardar();
    try{ renderModalItems(); }catch(e){} try{ renderMesas(); }catch(e){}
    return true;
  }

  // ---------- En la cuenta de la habitación ----------
  function pintar(){
    const ov = document.getElementById('overlay'), box0 = document.getElementById('mtTiempo');
    const id = typeof currentTable !== 'undefined' ? currentTable : null, d = D();
    const t = id != null && d && d.tables ? d.tables[id] : null;
    const e = activo() && ov && ov.classList.contains('show') ? estado(t) : null;
    if(!e){ if(box0) box0.hidden = true; return; }
    const cont = document.getElementById('itemsContainer'); if(!cont || !cont.parentNode) return;
    let box = box0;
    if(!box){ box = document.createElement('div'); box.id = 'mtTiempo'; box.className = 'ht-noches mt-tiempo'; }
    if(box.parentNode !== cont.parentNode){ const ck = document.getElementById('ckCocina'); cont.parentNode.insertBefore(box, ck && ck.parentNode === cont.parentNode ? ck : cont); }
    const p = productoExtra();
    const html = '<div class="ht-l"><span>🕒 Entró <b>' + esc(hora(e.entrada)) + '</b> · lleva <b class="mt-lleva">' + esc(dur(e.lleva)) + '</b>' + (e.hasta ? ' · ' + esc(e.plan) + ' hasta <b>' + esc(hora(e.hasta + e.cobradas * 36e5)) + '</b>' : '') + '</span>' +
      '<button type="button" class="ht-cambiar" data-mt="editar">✏️ Cambiar entrada</button></div>' +
      '<div class="ht-ed" hidden><input type="datetime-local" class="ht-in mt-in" value="' + local(e.entrada) + '"><button type="button" class="btn-primary" data-mt="guardar">Guardar</button><button type="button" class="btn-ghost" data-mt="cancelar">Cancelar</button></div>' +
      (!e.hasta ? '<div class="ht-info">Agrega la tarifa (rato, noche…) para que ORDEVA sepa hasta qué hora va.</div>' :
       e.faltan > 0 ? '<div class="ht-aviso mt-aviso"><span>⚠️ Se pasó <b>' + esc(dur(e.pasado)) + '</b>: falta cobrar <b>' + e.faltan + (e.faltan === 1 ? ' hora adicional' : ' horas adicionales') + '</b>' + (p ? ' (' + plata(p.price * e.faltan) + ')' : '') + '.</span> ' +
         (p ? '<button type="button" class="btn-primary" data-mt="sumar">Sumar ' + e.faltan + (e.faltan === 1 ? ' hora' : ' horas') + '</button>' : '<span>Crea el producto «Hora adicional» en Productos para sumarla.</span>') + '</div>' : '');
    // La hora de ahora no entra en la llave (si no, se repinta cada minuto y se cierra «Cambiar entrada» mientras se escribe).
    const llave = html.replace(/<b class="mt-lleva">[^<]*<\/b>/, '') + '|' + id;
    if(box._k !== llave){ box._k = llave; box.innerHTML = html; }
    else { const l = box.querySelector('.mt-lleva'); if(l) l.textContent = dur(e.lleva); }
    const inp = box.querySelector('.mt-in'); if(inp) inp.max = local(Date.now());
    box.hidden = false;
  }
  document.addEventListener('click', ev => {
    const b = ev.target.closest && ev.target.closest('#mtTiempo [data-mt]'); if(!b) return;
    ev.stopPropagation();
    const box = document.getElementById('mtTiempo'), d = D(), id = currentTable, t = d && d.tables[id]; if(!t) return;
    const a = b.dataset.mt;
    if(a === 'editar' || a === 'cancelar'){ box.querySelector('.ht-ed').hidden = a === 'cancelar'; return; }
    if(a === 'guardar'){
      const v = new Date(box.querySelector('.mt-in').value).getTime();
      if(!(v > 0) || v > Date.now() + 6e4) return toast('⚠️ Escribe una hora de entrada que ya pasó.');
      t.entrada = v; box._k = ''; guardar(); pintar(); try{ renderMesas(); }catch(x){}
      return toast('🕒 Entrada: ' + hora(v));
    }
    if(a === 'sumar'){ const e = estado(t); if(e && e.faltan > 0 && sumar(id, e.faltan)){ box._k = ''; pintar(); toast('⏱️ ' + e.faltan + (e.faltan === 1 ? ' hora adicional sumada.' : ' horas adicionales sumadas.')); } }
  }, true);

  // ---------- Al cobrar ----------
  // true (al tiro) si no hay nada que preguntar; si no, una promesa: true = seguir con el cobro, false = canceló.
  function antesDeCobrar(id){
    const d = D(), t = d && d.tables && d.tables[id], e = t ? estado(t) : null, p = productoExtra();
    if(!e || !(e.faltan > 0) || !p) return true;
    return new Promise(res => {
      const ov = document.createElement('div'); ov.className = 'overlay show cm-ov mt-ov'; ov.setAttribute('data-novocab', ''); ov.style.zIndex = '9700';
      let nom = String(id); try{ nom = tableLabel(id); }catch(x){}
      ov.innerHTML = '<div class="modal cm" role="dialog" aria-modal="true"><h2 style="margin:0 0 4px">⏰ Se pasó del tiempo</h2><div class="modal-sub">' + esc(nom) + ': ' + esc(e.plan) + ', entró ' + esc(hora(e.entrada)) + ' y lleva ' + esc(dur(e.lleva)) + ' (se pasó ' + esc(dur(e.pasado)) + ').</div>' +
        '<div class="modal-actions" style="flex-direction:column;align-items:stretch;gap:8px"><button type="button" class="btn-primary" data-r="si">Sumar ' + e.faltan + (e.faltan === 1 ? ' hora adicional' : ' horas adicionales') + ' (' + plata(p.price * e.faltan) + ') y cobrar</button>' +
        '<button type="button" class="btn-ghost" data-r="no">Cobrar sin sumar</button><button type="button" class="btn-ghost" data-r="x">Cancelar</button></div></div>';
      document.body.appendChild(ov);
      let listo = false; const fin = v => { if(listo) return; listo = true; ov.remove(); res(v); };
      ov.addEventListener('click', ev => {
        if(ev.target === ov) return fin(false);
        const b = ev.target.closest('[data-r]'); if(!b) return;
        if(b.dataset.r === 'si'){ sumar(id, e.faltan); return fin(true); }
        fin(b.dataset.r === 'no');
      });
    });
  }
  // La venta guarda la entrada, la salida y los minutos; la habitación queda sin hora de entrada para el siguiente.
  function envolverCierre(){
    const orig = window.closeTableToHistory; if(typeof orig !== 'function' || orig._mt) return;
    const nuevo = function(id){
      const d = D(), t = d && d.tables && d.tables[id], e = activo() && t ? estado(t) : null;
      const r = orig.apply(this, arguments);
      if(r && e){ r.entrada = new Date(e.entrada).toISOString(); r.salida = new Date().toISOString(); r.minutos = Math.round(e.lleva / 6e4); if(e.incluido) r.horasPlan = e.incluido / 36e5; }
      if(t && 'entrada' in t && activo()) delete t.entrada;
      return r;
    };
    // 1.85.0: lleva las marcas de los demás módulos (si no, se envolvían uno al otro sin fin: miles de capas y, a la
    // media hora de tener ORDEVA abierto, «Maximum call stack size exceeded» al cerrar una cuenta).
    for(const k in orig) if(k.charAt(0) === '_') nuevo[k] = orig[k];
    nuevo._mt = true; window.closeTableToHistory = nuevo;
  }

  // ---------- Avisos al vencer (en este equipo; una vez por habitación y por hora) ----------
  const vistos = {};
  function revisar(){
    if(!activo()) return;
    const d = D(); if(!d || !d.tables) return;
    Object.keys(d.tables).forEach(id => {
      const e = estado(d.tables[id]); if(!e || !e.hasta) return;
      const fin = e.hasta + e.cobradas * 36e5, ahora = Date.now(); let nom = String(id); try{ nom = tableLabel(id); }catch(x){}
      const k = id + '|' + e.entrada + '|';
      if(fin - ahora <= 10 * 6e4 && fin > ahora && !vistos[k + 'antes']){ vistos[k + 'antes'] = 1; toast('⏳ ' + nom + ': le quedan ' + dur(fin - ahora) + ' (sale ' + hora(fin) + ').', 8000); }
      if(e.faltan > 0 && !vistos[k + e.debidas]){ vistos[k + e.debidas] = 1; toast('⏰ ' + nom + ' se pasó ' + dur(e.pasado) + ': falta cobrar ' + e.faltan + (e.faltan === 1 ? ' hora adicional.' : ' horas adicionales.'), 9000); try{ window.ventoSonidos && window.ventoSonidos.alerta && window.ventoSonidos.alerta(); }catch(x){} }
    });
  }

  // ---------- Ajustes → Negocio (motel) ----------
  function pintarAjustes(){
    const g = document.querySelector('#view-ajustes .settings-group[data-cat="negocio"]'); if(!g) return;
    let box = document.getElementById('motelBox');
    let jefe = true; try{ jefe = !window.ventoRoles || window.ventoRoles.esJefe(); }catch(e){}
    if(!activo() || !jefe){ if(box) box.remove(); return; }
    if(!box){ box = document.createElement('div'); box.id = 'motelBox'; box.className = 'settings-row'; box.style.cssText = 'flex-direction:column;align-items:stretch;gap:8px'; g.appendChild(box); }
    const c = cfg();
    box.innerHTML = '<div class="settings-row-text"><strong>⏱️ Tiempo de las habitaciones</strong><span>El plan sale del nombre de la tarifa («Rato (3 horas)», «Noche»). Cuando se pasa, ORDEVA avisa y al cobrar ofrece sumar la «Hora adicional».</span></div>' +
      '<label style="display:flex;gap:8px;align-items:center">Tolerancia antes de cobrar la hora adicional <input class="mz-in" id="mtTol" inputmode="numeric" value="' + c.tol + '" style="width:64px;text-align:center"> min</label>' +
      '<label style="display:flex;gap:8px;align-items:center">La «Noche» dura <input class="mz-in" id="mtNoche" inputmode="numeric" value="' + c.noche + '" style="width:64px;text-align:center"> horas</label>' +
      (productoExtra() ? '' : '<small style="color:var(--brick)">⚠️ No hay un producto «Hora adicional»: créalo en Productos para poder sumarla.</small>');
    const poner = () => { const d = D(); if(!d) return; d.motelCfg = { tol: Math.max(0, Math.min(60, parseInt(box.querySelector('#mtTol').value, 10) || 0)), noche: Math.max(1, Math.min(24, parseInt(box.querySelector('#mtNoche').value, 10) || 12)) }; guardar(); toast('✅ Tiempo de las habitaciones guardado.'); };
    box.querySelector('#mtTol').onchange = poner; box.querySelector('#mtNoche').onchange = poner;
  }
  document.addEventListener('click', ev => { if(ev.target.closest && ev.target.closest('.ajustes-cat[data-cat="negocio"], nav button[data-view="ajustes"], .more-tile[data-go]')) setTimeout(pintarAjustes, 95); }, true);

  envolverCierre();
  setInterval(() => { try{ envolverCierre(); if(activo()) pintar(); }catch(e){} }, 1000);
  setInterval(() => { try{ revisar(); }catch(e){} }, 30000);
  setTimeout(() => { try{ revisar(); pintarAjustes(); }catch(e){} }, 3000);
  // Con el mapa abierto, el tiempo de cada habitación se repinta cada minuto.
  setInterval(() => { try{ if(activo() && document.querySelector('#view-mesas.active, .view.active#view-mesas')) renderMesas(); }catch(e){} }, 60000);

  window.ventoMotel = { activo, horasDe, esExtra, entrada, estado, mapa, sumar, antesDeCobrar, productoExtra, revisar, pintar, pintarAjustes, cfg };
})();
