/* ORDEVA · lib/vento-asistencia.js — 1.92.0: 🕒 ASISTENCIA DEL PERSONAL (entrada y salida).
   • «Más → 🕒 Asistencia»: quien está usando ORDEVA marca «▶️ Entrada» y «⏹️ Salida» con un toque (dice a qué hora
     entró y cuánto lleva).
   • El dueño o el administrador ven quién está trabajando ahora, las horas de hoy, de la semana, la quincena o el mes
     por persona, y pueden marcar por alguien que no tiene usuario (escribiendo el nombre).
   • Cada marca queda guardada con la hora y quién la hizo (se sincroniza con los demás equipos; no se borra).
   • «📋 Copiar» deja el resumen de horas listo para pegar (WhatsApp, Excel). */
(function(){
  'use strict';
  if(window.ventoAsistencia) return;
  const D = () => (typeof data !== 'undefined' ? data : null);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (t, ms) => { try{ showToast(t, ms || 4000); }catch(e){} };
  const yo = () => { try{ return (typeof authUser !== 'undefined' && authUser) || ''; }catch(e){ return ''; } };
  const jefe = () => { try{ return !window.ventoRoles || window.ventoRoles.esJefe(); }catch(e){ return true; } };
  const hora = t => new Date(t).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
  const durTxt = ms => { const m = Math.max(0, Math.round(ms / 6e4)); return Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') + ' min'; };
  const dia0 = t => { const x = new Date(t); x.setHours(0, 0, 0, 0); return x.getTime(); };
  function lista(){ const d = D(); if(!d) return []; if(!Array.isArray(d.asistencia)) d.asistencia = []; return d.asistencia; }
  const de = persona => lista().filter(x => x && x.persona === persona).sort((a, b) => a.at - b.at);
  // ¿Está trabajando? (su última marca es una entrada)
  function estado(persona){ const l = de(persona), u = l[l.length - 1]; return u && u.tipo === 'entrada' ? { dentro: true, desde: u.at } : { dentro: false, ultima: u || null }; }
  function marcar(persona, tipo){
    persona = String(persona || '').trim().slice(0, 40); if(!persona) return null;
    const e = estado(persona);
    if(tipo === 'entrada' && e.dentro) return { error: 'ya_dentro', desde: e.desde };
    if(tipo === 'salida' && !e.dentro) return { error: 'no_dentro' };
    const m = { id: 'as' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), persona, tipo, at: Date.now(), por: yo() };
    lista().push(m);
    try{ saveData(); }catch(x){}
    try{ window.ventoAuditar && window.ventoAuditar('asistencia: ' + tipo, persona); }catch(x){}
    return m;
  }
  // Horas trabajadas entre desde y hasta (los turnos abiertos cuentan hasta ahora; los que cruzan la medianoche, la parte del rango).
  function horas(desde, hasta){
    const por = {}, ahora = Date.now();
    const personas = [...new Set(lista().map(x => x.persona))];
    personas.forEach(n => {
      let ent = null, ms = 0, dias = new Set();
      de(n).forEach(x => {
        if(x.tipo === 'entrada'){ if(ent == null) ent = x.at; }
        else if(ent != null){ const a = Math.max(ent, desde), b = Math.min(x.at, hasta); if(b > a){ ms += b - a; dias.add(dia0(a)); } ent = null; }
      });
      if(ent != null){ const a = Math.max(ent, desde), b = Math.min(ahora, hasta); if(b > a){ ms += b - a; dias.add(dia0(a)); } }
      if(ms > 0 || estado(n).dentro) por[n] = { ms, dias: dias.size, dentro: estado(n).dentro };
    });
    return por;
  }
  function rango(k){
    const h = new Date(), hoy = dia0(h), fin = hoy + 864e5;
    if(k === 'semana'){ const dw = (h.getDay() + 6) % 7; return { desde: hoy - dw * 864e5, hasta: fin, t: 'Esta semana' }; }
    if(k === 'quincena'){ const d1 = h.getDate() <= 15 ? 1 : 16; return { desde: new Date(h.getFullYear(), h.getMonth(), d1).getTime(), hasta: fin, t: 'Esta quincena' }; }
    if(k === 'mes') return { desde: new Date(h.getFullYear(), h.getMonth(), 1).getTime(), hasta: fin, t: 'Este mes' };
    return { desde: hoy, hasta: fin, t: 'Hoy' };
  }

  // ---------- La ventana ----------
  function abrir(){
    document.querySelectorAll('.as-ov').forEach(o => o.remove());
    const ov = document.createElement('div'); ov.className = 'overlay show cm-ov as-ov'; ov.setAttribute('data-novocab', '');
    ov.innerHTML = '<div class="modal cm" role="dialog" aria-modal="true"><h2 style="margin:0 0 4px">🕒 Asistencia</h2><div class="as-cuerpo"></div><div class="modal-actions"><button type="button" class="btn-ghost" data-as="cerrar">Cerrar</button></div></div>';
    document.body.appendChild(ov);
    let per = 'hoy';
    const cuerpo = ov.querySelector('.as-cuerpo');
    const pintar = () => {
      const n = yo() || 'Yo', e = estado(n);
      let html = '<div style="text-align:center;margin:6px 0 10px"><div style="font-size:15px">' + esc(n) + ': ' + (e.dentro ? '🟢 trabajando desde las <b>' + esc(hora(e.desde)) + '</b> (' + esc(durTxt(Date.now() - e.desde)) + ')' : '⚪ fuera' + (e.ultima ? ' (salió ' + esc(hora(e.ultima.at)) + ')' : '')) + '</div>' +
        '<button type="button" class="btn-primary" data-as="' + (e.dentro ? 'salida' : 'entrada') + '" style="font-size:20px;padding:14px 22px;margin-top:8px">' + (e.dentro ? '⏹️ Marcar salida' : '▶️ Marcar entrada') + '</button></div>';
      if(jefe()){
        const r = rango(per), h = horas(r.desde, r.hasta), nombres = Object.keys(h).sort();
        html += '<div style="display:flex;gap:4px;flex-wrap:wrap;margin:8px 0">' + [['hoy', 'Hoy'], ['semana', 'Semana'], ['quincena', 'Quincena'], ['mes', 'Mes']].map(x => '<button type="button" class="btn-ghost' + (x[0] === per ? ' btn-primary' : '') + '" data-per="' + x[0] + '" style="padding:6px 10px">' + x[1] + '</button>').join('') + '</div>' +
          '<div class="as-tabla">' + (nombres.length ? nombres.map(k => '<div class="as-fila" style="display:flex;gap:8px;border-top:1px solid var(--line,#ddd);padding:6px 0"><span style="flex:1">' + (h[k].dentro ? '🟢 ' : '') + esc(k) + '</span><span>' + esc(durTxt(h[k].ms)) + (per !== 'hoy' ? ' · ' + h[k].dias + (h[k].dias === 1 ? ' día' : ' días') : '') + '</span></div>').join('')
            : '<div class="modal-sub">Nadie ha marcado en este período.</div>') + '</div>' +
          '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><input class="mz-in as-otro" maxlength="40" placeholder="Marcar por otra persona (nombre)" style="flex:1;min-width:150px"><button type="button" class="btn-ghost" data-as="otro-entrada">▶️ Entrada</button><button type="button" class="btn-ghost" data-as="otro-salida">⏹️ Salida</button></div>' +
          '<button type="button" class="btn-ghost" data-as="copiar" style="width:100%;margin-top:8px">📋 Copiar el resumen de ' + esc(r.t.toLowerCase()) + '</button>';
      }
      cuerpo.innerHTML = html;
    };
    ov.addEventListener('click', ev => {
      if(ev.target === ov) return ov.remove();
      const b = ev.target.closest('[data-as],[data-per]'); if(!b) return;
      if(b.dataset.per){ per = b.dataset.per; return pintar(); }
      const a = b.dataset.as;
      if(a === 'cerrar') return ov.remove();
      if(a === 'entrada' || a === 'salida'){ const r = marcar(yo() || 'Yo', a); if(r && !r.error) toast(a === 'entrada' ? '▶️ Entrada marcada: ' + hora(r.at) : '⏹️ Salida marcada: ' + hora(r.at)); return pintar(); }
      if(a === 'otro-entrada' || a === 'otro-salida'){
        const n = ov.querySelector('.as-otro').value.trim(); if(!n) return toast('Escribe el nombre de la persona.');
        const t = a === 'otro-entrada' ? 'entrada' : 'salida', r = marcar(n, t);
        if(r && r.error) toast(r.error === 'ya_dentro' ? n + ' ya está trabajando (entró ' + hora(r.desde) + ').' : n + ' no ha marcado entrada.');
        else toast((t === 'entrada' ? '▶️ ' : '⏹️ ') + n + ': ' + hora(r.at));
        return pintar();
      }
      if(a === 'copiar'){
        const r = rango(per), h = horas(r.desde, r.hasta), d = D() || {};
        const txt = '🕒 Asistencia · ' + (d.businessName || '') + ' · ' + r.t + '\n' + Object.keys(h).sort().map(k => '• ' + k + ': ' + durTxt(h[k].ms) + (per !== 'hoy' ? ' (' + h[k].dias + (h[k].dias === 1 ? ' día)' : ' días)') : '')).join('\n');
        try{ navigator.clipboard.writeText(txt).then(() => toast('📋 Resumen copiado.')); }catch(x){ toast(txt, 9000); }
      }
    });
    pintar();
  }
  // En «Más»: la casilla de Asistencia (antes de la Calculadora).
  function casilla(){
    const g = document.querySelector('#navMoreSheet .more-grid'); if(!g || g.querySelector('[data-go="asistencia"]')) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'more-tile'; b.dataset.go = 'asistencia';
    b.innerHTML = '<span class="more-ic">🕒</span><strong>Asistencia</strong><small>Entrada y salida del personal</small>';
    const ref = g.querySelector('[data-go="calculadora"]'); g.insertBefore(b, ref || null);
    b.addEventListener('click', ev => { ev.stopPropagation(); const o = document.getElementById('navMoreSheet'); if(o) o.classList.remove('show'); abrir(); }, true);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', casilla); else casilla();
  setTimeout(casilla, 1500);

  window.ventoAsistencia = { lista, estado, marcar, horas, rango, abrir, durTxt };
})();
