// 🛏️ ORDEVA 1.72.3 · Hotel, hostal y apartamentos: la habitación sabe desde cuándo está ocupada y cuántas noches lleva.
// El catálogo prometía «cuenta por habitación con noches», pero las noches se contaban a mano. Ahora:
//  • En la cuenta de la habitación: «🛏️ Llegó el vie 30 oct, 3:10 p. m. · 2 noches» (se puede corregir la hora de llegada).
//  • Si la cuenta tiene menos noches de habitación que las que lleva, lo avisa con un botón para ponerlas.
//    No cambia nada solo: el dueño decide (puede ser una noche de cortesía).
//  • Al cobrar, la venta guarda la llegada y las noches.
// Las noches se cuentan por fecha: llegó hoy = 1 noche; llegó ayer = 1; antier = 2…  (al salir al día siguiente se cobra 1).
// No aplica al motel (por horas) ni al salón de eventos.
(function(){
  'use strict';
  const TIPOS = ['hotel', 'hostal', 'apartamentos'];
  // Lo que cuenta como «noche de habitación» en la cuenta (las tarifas de fábrica y las que crea el dueño).
  const ES_NOCHE = /\b(habitaci[oó]n|noche|cama|dormitorio|suite|apartamento|apto|caba[ñn]a|alojamiento|hospedaje)\b/i;
  const NO_NOCHE = /\b(aseo|lavander[ií]a|desayuno|almuerzo|cena|minibar|dep[oó]sito|traslado|parqueadero)\b/i;
  const D = () => (typeof data !== 'undefined' ? data : null);
  const activo = () => { const d = D(); return !!(d && TIPOS.includes(d.businessType)); };
  const dia = t => { const x = new Date(t); x.setHours(0, 0, 0, 0); return x.getTime(); };
  const noches = (desde, ahora) => Math.max(1, Math.round((dia(ahora || Date.now()) - dia(desde)) / 864e5));
  function entrada(t){
    if(!t || !(t.items || []).length) return null;
    if(Number(t.entrada) > 0) return Number(t.entrada);
    const at = Math.min(...t.items.map(it => (it.history && it.history[0] && Number(it.history[0].at)) || Infinity));
    return isFinite(at) ? at : null;
  }
  const esNoche = it => !!it && ES_NOCHE.test(it.name || '') && !NO_NOCHE.test(it.name || '');
  const nochesCobradas = t => (t.items || []).filter(esNoche).reduce((s, it) => s + (Number(it.qty) || 0), 0);
  const fecha = at => { const d = new Date(at); return d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }); };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const local = at => { const d = new Date(at - new Date(at).getTimezoneOffset() * 6e4); return d.toISOString().slice(0, 16); };

  function pintar(){
    const ov = document.getElementById('overlay'), box0 = document.getElementById('htNoches');
    const id = typeof currentTable !== 'undefined' ? currentTable : null, d = D();
    const t = id != null && d && d.tables ? d.tables[id] : null;
    const at = activo() && ov && ov.classList.contains('show') ? entrada(t) : null;
    if(!at){ if(box0) box0.hidden = true; return; }
    const cont = document.getElementById('itemsContainer'); if(!cont || !cont.parentNode) return;
    let box = box0;
    if(!box){ box = document.createElement('div'); box.id = 'htNoches'; box.className = 'ht-noches'; }
    if(box.parentNode !== cont.parentNode){ const ck = document.getElementById('ckCocina'); cont.parentNode.insertBefore(box, ck && ck.parentNode === cont.parentNode ? ck : cont); }
    const n = noches(at), c = nochesCobradas(t), tarifas = (t.items || []).filter(esNoche);
    const falta = c > 0 && c < n && tarifas.length === 1;   // con una sola tarifa se sabe a cuál sumarle
    const html = '<div class="ht-l"><span>🛏️ Llegó el <b>' + esc(fecha(at)) + '</b> · <b>' + n + (n === 1 ? ' noche' : ' noches') + '</b></span>' +
      '<button type="button" class="ht-cambiar" data-ht="editar">✏️ Cambiar llegada</button></div>' +
      '<div class="ht-ed" hidden><input type="datetime-local" class="ht-in" value="' + local(at) + '"><button type="button" class="btn-primary" data-ht="guardar">Guardar</button><button type="button" class="btn-ghost" data-ht="cancelar">Cancelar</button></div>' +
      (falta ? '<div class="ht-aviso"><span>⚠️ Lleva <b>' + n + ' noches</b> y la cuenta tiene <b>' + c + '</b>.</span> <button type="button" class="btn-primary" data-ht="poner">Poner ' + n + ' noches</button></div>'
        : (c > n ? '<div class="ht-info">La cuenta tiene ' + c + ' noches de habitación (más de las que lleva: reserva anticipada o varias habitaciones).</div>' : ''));
    const llave = html + '|' + id;
    // 1.76.0: la hora de ahora (el máximo) NO va en lo que se compara: antes, al cambiar el minuto se volvía a pintar y se
    // cerraba «✏️ Cambiar llegada» mientras se escribía.
    if(box._k !== llave){ box._k = llave; box.innerHTML = html; }
    const inp = box.querySelector('.ht-in'); if(inp) inp.max = local(Date.now());
    box.hidden = false;
  }

  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('#htNoches [data-ht]'); if(!b) return;
    e.stopPropagation();
    const box = document.getElementById('htNoches'), d = D(), id = currentTable, t = d && d.tables[id]; if(!t) return;
    const a = b.dataset.ht;
    if(a === 'editar' || a === 'cancelar'){ box.querySelector('.ht-ed').hidden = a === 'cancelar'; if(a === 'editar') try{ box.querySelector('.ht-in').focus(); }catch(x){} return; }
    if(a === 'guardar'){
      const v = new Date(box.querySelector('.ht-in').value).getTime();
      if(!(v > 0) || v > Date.now() + 6e4){ try{ showToast('⚠️ Escribe una fecha y hora de llegada que ya pasó.'); }catch(x){} return; }
      t.entrada = v; box._k = ''; saveData(); pintar(); try{ renderMesas(); }catch(x){}
      try{ showToast('🛏️ Llegada: ' + fecha(v) + ' · ' + noches(v) + (noches(v) === 1 ? ' noche' : ' noches')); }catch(x){}
      return;
    }
    if(a === 'poner'){
      const tar = (t.items || []).filter(esNoche); if(tar.length !== 1) return;
      const it = tar[0], n = noches(entrada(t)), suma = n - (Number(it.qty) || 0); if(suma <= 0) return;
      it.qty = n;
      try{ recordItemHistory(it, suma); }catch(x){}
      try{ noteManualChange(id, it.name, suma); }catch(x){}
      box._k = ''; saveData();
      try{ renderModalItems(); }catch(x){} try{ renderMesas(); }catch(x){}
      try{ showToast('🛏️ ' + it.name + ': ' + n + ' noches.'); }catch(x){}
    }
  }, true);

  // Al cobrar: la venta guarda la llegada y las noches; la habitación queda sin hora de llegada para el siguiente huésped.
  function envolverCierre(){
    const orig = window.closeTableToHistory; if(typeof orig !== 'function' || orig._ht) return;
    const nuevo = function(id){
      const d = D(), t = d && d.tables && d.tables[id], at = activo() ? entrada(t) : null;
      const e = orig.apply(this, arguments);
      if(e && at){ e.entrada = new Date(at).toISOString(); e.noches = noches(at); e.nochesCobradas = nochesCobradas({ items: e.items }); }
      if(t && 'entrada' in t){ delete t.entrada; }
      return e;
    };
    nuevo._ht = true; window.closeTableToHistory = nuevo;
  }
  envolverCierre();
  // La cuenta se repinta en muchos sitios: se revisa a menudo (barato: solo si la cuenta está abierta y es un hotel).
  setInterval(() => { try{ envolverCierre(); pintar(); }catch(e){} }, 400);
  // Una habitación que quedó vacía (se quitaron todos los productos) olvida la llegada corregida.
  setInterval(() => { try{ const d = D(); if(!d || !d.tables || !activo()) return; let c = false; Object.values(d.tables).forEach(t => { if(t && t.entrada && !(t.items || []).length){ delete t.entrada; c = true; } }); if(c) saveData(); }catch(e){} }, 5000);

  const css = document.createElement('style');
  css.textContent = '.ht-noches{margin:6px 0 10px;padding:9px 12px;border-radius:12px;border:1px solid var(--line);background:var(--surface-2,var(--surface));font-size:14px;display:flex;flex-direction:column;gap:7px}.ht-noches[hidden]{display:none}' +
    '.ht-l{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}.ht-cambiar{border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:999px;padding:4px 10px;font:600 12.5px/1.2 var(--font-main,inherit);cursor:pointer}' +
    '.ht-ed{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.ht-ed[hidden]{display:none}.ht-in{flex:1;min-width:190px;padding:7px 9px;border-radius:9px;border:1px solid var(--line);background:var(--surface-2,#fff);color:var(--ink);font:inherit}' +
    '.ht-aviso{padding:8px 10px;border-radius:10px;background:color-mix(in srgb,#f59e0b 16%,var(--surface));border:1px solid #f59e0b;display:flex;align-items:center;gap:8px;flex-wrap:wrap}.ht-aviso .btn-primary{padding:6px 12px;font-size:13px}' +
    '.ht-info{font-size:12.5px;color:var(--ink-soft)}';
  document.head.appendChild(css);
  window.ventoHotel = { activo, noches, entrada, nochesCobradas, esNoche, pintar };
})();
