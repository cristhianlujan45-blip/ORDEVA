/* ORDEVA · lib/vento-cocina-tiempo.js — 1.76.0: ⏱ Tiempo en cocina (restaurantes, bares, cafeterías).
   • Pantalla de Cocina: «⏱ Hoy: 14 pedidos · promedio 11 min · 2 pasaron de 20 min», y «Avisar a los [20] min».
   • Un pedido que lleva más que eso sin estar «Listo» se resalta y avisa UNA vez (aviso, voz y notificación en Android):
     «⏰ Mesa 4 lleva 22 min esperando: 2 Bandeja paisa». También se ve en la tarjeta de la mesa (mapa).
   • El promedio es desde que se recibe hasta que se marca «Listo» (los pedidos de hoy). Las anulaciones no cuentan. */
(function(){
  'use strict';
  if(window.ventoCocinaTiempo) return;
  const D = () => (typeof data !== 'undefined' ? data : null);
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lista = () => { try{ return window.vitoPedidos ? window.vitoPedidos.lista() : []; }catch(e){ return []; } };
  const prepOn = () => { try{ return typeof usaMod === 'function' && usaMod('k'); }catch(e){ return false; } };
  const limite = () => { const d = D(); const n = Number(d && d.prep && d.prep.alertaMin); return n >= 5 && n <= 120 ? n : 20; };
  const etiqueta = id => { try{ return window.vitoGrupos ? window.vitoGrupos.etiquetaDe(id) : tableLabel(id); }catch(e){ return 'Mesa ' + id; } };
  const desde = p => Number(p.recibidoEn || p.at) || 0;
  const cuando = (p, e) => { const h = (p.hist || []).find(x => x.e === e); return h ? Number(h.at) : 0; };
  const enEspera = p => !p.anula && ['recibido', 'preparacion'].includes(p.estado);
  const minutos = (p, ahora) => Math.max(0, Math.round(((ahora || Date.now()) - desde(p)) / 6e4));

  function hoy(){
    const ini = new Date(); ini.setHours(0, 0, 0, 0);
    const L = lista().filter(p => !p.anula && desde(p) >= ini.getTime() && p.estado !== 'cancelado');
    const listos = L.map(p => { const l = cuando(p, 'listo') || cuando(p, 'entregado'); return l ? (l - desde(p)) / 6e4 : null; }).filter(x => x != null && x >= 0 && x < 600);
    const lim = limite();
    const tarde = listos.filter(m => m > lim).length + L.filter(p => enEspera(p) && minutos(p) > lim).length;
    return { n: L.length, listos: listos.length, prom: listos.length ? Math.round(listos.reduce((s, x) => s + x, 0) / listos.length) : null, tarde, lim };
  }
  // ¿Esta mesa tiene un pedido que ya pasó del límite? (para el mapa)
  function demoradoDe(mesa){
    const lim = limite(), ahora = Date.now();
    const p = lista().filter(x => String(x.mesa) === String(mesa) && enEspera(x) && minutos(x, ahora) > lim).sort((a, b) => desde(a) - desde(b))[0];
    return p ? minutos(p, ahora) : 0;
  }

  // ---------- Barra en la pantalla de Cocina ----------
  function pintarBarra(){
    const head = document.querySelector('#view-cocina .prep-head'); if(!head) return;
    let b = $('ktBarra');
    if(!b){ b = document.createElement('div'); b.id = 'ktBarra'; b.className = 'kt-barra'; head.appendChild(b); }
    const h = hoy();
    const txt = '⏱ Hoy: <b>' + h.n + (h.n === 1 ? ' pedido' : ' pedidos') + '</b>' + (h.prom != null ? ' · promedio <b>' + h.prom + ' min</b> hasta «Listo»' : '') +
      (h.tarde ? ' · <b class="kt-mal">' + h.tarde + ' pasaron de ' + h.lim + ' min</b>' : '') +
      ' <label class="kt-lim">Avisar a los <select id="ktLim">' + [10, 15, 20, 25, 30, 40, 45, 60].map(n => '<option' + (n === h.lim ? ' selected' : '') + '>' + n + '</option>').join('') + '</select> min</label>';
    if(b._h !== txt){ b._h = txt; b.innerHTML = txt; }
  }
  function marcarTickets(){
    const lim = limite(), ahora = Date.now(), L = lista();
    document.querySelectorAll('#kdsTickets .kds-ticket[data-pid]').forEach(t => {
      const p = L.find(x => x.id === t.dataset.pid);
      const muy = !!p && enEspera(p) && minutos(p, ahora) > lim;
      t.classList.toggle('kt-muy', muy);
    });
  }
  function envolver(){
    const orig = window.renderCocina; if(typeof orig !== 'function' || orig._kt) return;
    const nuevo = function(){ const r = orig.apply(this, arguments); try{ pintarBarra(); marcarTickets(); }catch(e){} return r; };
    nuevo._kt = true; window.renderCocina = nuevo;
  }
  document.addEventListener('change', e => {
    const s = e.target && e.target.id === 'ktLim' ? e.target : null; if(!s) return;
    const d = D(); d.prep = Object.assign({}, d.prep, { alertaMin: Number(s.value) || 20 });
    try{ saveData(); }catch(x){}
    try{ window.renderCocina(); }catch(x){}
    try{ showToast('⏱ Avisa cuando un pedido lleve más de ' + s.value + ' min.'); }catch(x){}
  }, true);

  // ---------- Aviso (una vez por pedido) ----------
  const K = 'vento_kt_avisados';
  const avisados = () => { try{ return JSON.parse(localStorage.getItem(K)) || []; }catch(e){ return []; } };
  function revisar(){
    const d = D(); if(!d || !prepOn()) return [];
    try{ if(document.body.classList.contains('modo-mesero')) return []; }catch(e){}
    const lim = limite(), ahora = Date.now(), ya = avisados(), nuevos = [];
    lista().forEach(p => {
      if(!enEspera(p) || minutos(p, ahora) <= lim || ya.includes(p.id)) return;
      if(ahora - desde(p) > 6 * 36e5) return;   // muy viejo (quedó abierto de otro día): no se avisa
      nuevos.push(p);
    });
    if(!nuevos.length) return [];
    try{ localStorage.setItem(K, JSON.stringify(ya.concat(nuevos.map(p => p.id)).slice(-300))); }catch(e){}
    nuevos.forEach(p => {
      const m = minutos(p, ahora), que = (p.items || []).filter(i => i.ok !== false).map(i => i.qty + ' ' + i.name).join(', ').slice(0, 90);
      const txt = '⏰ ' + etiqueta(p.mesa) + ' lleva ' + m + ' min esperando' + (que ? ': ' + que : '');
      try{ showToast(txt, 9000); }catch(e){}
      try{ (window.speakVoice || function(){})(etiqueta(p.mesa) + ' lleva ' + m + ' minutos esperando su pedido.'); }catch(e){}
      try{ const A = window.VentoAndroid; if(A && A.notificar) A.notificar('⏰ Pedido demorado', txt.replace(/^⏰ /, ''), 'pedidos', true); }catch(e){}
    });
    try{ if($('view-cocina') && $('view-cocina').classList.contains('active')) window.renderCocina(); }catch(e){}
    return nuevos;
  }
  envolver();
  setInterval(() => { try{ envolver(); revisar(); if($('view-cocina') && $('view-cocina').classList.contains('active')){ pintarBarra(); marcarTickets(); } }catch(e){} }, 20000);
  setTimeout(() => { try{ envolver(); revisar(); }catch(e){} }, 3000);

  const css = document.createElement('style');
  css.textContent = '.kt-barra{flex-basis:100%;font-size:13.5px;margin:4px 0 2px;display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center}.kt-mal{color:#dc2626}.kt-lim{margin-left:auto;font-size:12.5px;color:var(--ink-soft)}' +
    '.kt-lim select{padding:3px 6px;border-radius:8px;border:1px solid var(--line);background:var(--surface);color:var(--ink);font:inherit}' +
    '.kds-ticket.kt-muy{box-shadow:0 0 0 3px #dc2626;animation:ktPulso 1.6s ease-in-out infinite}@keyframes ktPulso{0%,100%{box-shadow:0 0 0 3px #dc2626}50%{box-shadow:0 0 0 6px rgba(220,38,38,.35)}}' +
    '@media (prefers-reduced-motion:reduce){.kds-ticket.kt-muy{animation:none}}';
  document.head.appendChild(css);

  window.ventoCocinaTiempo = { hoy, revisar, demoradoDe, limite };
})();
