/* ORDEVA · lib/vento-sencilla.js — 1.63.0: «Vista sencilla» (Ajustes → Apariencia), por equipo y opcional.
   El diseño de siempre sigue igual y es el de fábrica. Prendida, muestra LO MISMO más simple (no cambia ninguna función):
     • Abajo solo 4: Cuentas · Productos · 💵 Caja (dueño o administrador) · Más.
     • «Más» en una lista por grupos (Mi negocio · Ayudantes · Mi cuenta), cada cosa con su nombre.
     • 💵 Caja: lo vendido desde el último cierre (efectivo, transferencias, fiado), lo que falta cobrar en las cuentas
       abiertas, y Historial / Quién me debe / Cuenta general / Cerrar caja del día. Las cifras salen de las mismas cuentas
       que usa el cierre de caja (computeClosureStats): nada se calcula aparte ni se inventa.
     • En la cuenta: los iconos sin nombre pasan a «⋯ Opciones» (con nombre cada uno) y abajo queda fijo lo que falta por
       pagar con el botón «Cobrar».
     • En Cuentas: los botones que se usan poco quedan en «⋯ Más opciones». */
(function(){
  var K = 'vento_vista_sencilla';
  var $ = function(id){ return document.getElementById(id); };
  function on(){ try{ return localStorage.getItem(K) === '1'; }catch(e){ return false; } }
  function plata(n){ return typeof fmt === 'function' ? fmt(n) : '$' + Math.round(n || 0).toLocaleString('es-CO'); }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function jefe(){ try{ return !window.ventoRoles || window.ventoRoles.esJefe(); }catch(e){ return true; } }
  function clic(sel){ var b = typeof sel === 'string' ? document.querySelector(sel) : sel; if(b) b.click(); return !!b; }

  var css = document.createElement('style'); css.id = 'vsCss';
  css.textContent =
    // Barra de abajo: 4 botones grandes y fondo sólido
    'body:not(.vs-on) #vsCajaNav,body.vs-on:not(.vs-jefe) #vsCajaNav{display:none!important}' +
    'body.vs-on .tabbar nav>button:not([data-view="mesas"]):not([data-view="inventario"]):not(#vsCajaNav){display:none!important}' +
    'body.vs-on .nav-more{display:flex!important}' +
    'body.vs-on .tabbar{background:var(--surface)!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important}' +
    'body.vs-on nav button,body.vs-on .nav-more{font-size:12.5px}' +
    'body.vs-on .nav-ic{width:25px;height:25px}' +
    // «Más» en lista por grupos
    '.vs-grp{display:none}' +
    'body.vs-on #navMoreSheet .more-grid{display:flex!important;flex-direction:column;gap:0}' +
    'body.vs-on #navMoreSheet .vs-grp{display:block;font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-soft);margin:14px 4px 6px}' +
    'body.vs-on #navMoreSheet .more-tile{display:grid!important;grid-template-columns:42px 1fr;grid-template-rows:auto auto;align-items:center;text-align:left;column-gap:10px;min-height:58px;padding:8px 12px;border-radius:0;margin:0;border-width:0 0 1px;box-shadow:none}' +
    'body.vs-on #navMoreSheet .more-tile .more-ic{grid-row:1/3;font-size:24px;margin:0;width:auto;height:auto}' +
    'body.vs-on #navMoreSheet .more-tile strong{font-size:16px}' +
    'body.vs-on #navMoreSheet .more-tile small{grid-column:2;font-size:12.5px;opacity:.75}' +
    'body.vs-on #navMoreSheet .more-title{display:none}' +
    '#vsMasCocina{display:none!important}body.vs-on.mod-k #vsMasCocina{display:grid!important}' +
    // Cuentas: lo que se usa poco va en «⋯ Más opciones»
    '#vsMasOp{display:none}body.vs-on #vsMasOp{display:inline-flex}' +
    'body.vs-on:not(.vs-masop) #mesaViewListBtn,body.vs-on:not(.vs-masop) #mesaViewMapBtn,body.vs-on:not(.vs-masop) #generalBillBtn,body.vs-on:not(.vs-masop) #tableCountToggle{display:none!important}' +
    'body.vs-on.vs-jefe #closeDayTop{display:none!important}' +
    // La cuenta: «⋯ Opciones» en vez de iconos sueltos, métodos de pago grandes y lo que falta abajo con «Cobrar»
    // !important: «.mesa-acts button» de la cuenta pesaba más y el botón salía aunque la vista sencilla estuviera apagada
    'body:not(.vs-on) #vsOpcBtn,body:not(.vs-on) #vsCobrar{display:none!important}' +
    'body.vs-on #overlay .mesa-acts>.mesa-ico:not(#vsOpcBtn){display:none!important}' +
    'body.vs-on #vsOpcBtn{display:inline-flex;align-items:center;gap:6px;width:auto;padding:0 14px;font:700 14px/1 var(--font-main);border-radius:999px}' +
    'body.vs-on #overlay .pay-methods button{min-height:64px;font-size:15px}' +
    'body.vs-on #vsCobrar{display:flex;position:sticky;bottom:-1px;z-index:5;align-items:center;gap:10px;margin:12px -4px -4px;padding:10px 12px calc(10px + env(safe-area-inset-bottom));background:var(--paper,var(--surface));border-top:1px solid var(--line);box-shadow:0 -8px 20px rgba(0,0,0,.18)}' +
    // el micrófono sube cuando la cuenta está abierta (para no tapar «Cobrar»)
    'body.vs-on:has(#overlay.show) .voice-fab-wrap{bottom:calc(108px + env(safe-area-inset-bottom))!important}' +
    '#vsCobrar .vs-falta{flex:1;min-width:0}#vsCobrar .vs-falta small{display:block;font-size:12px;opacity:.75}#vsCobrar .vs-falta b{font-size:22px}' +
    '#vsCobrar button{min-height:52px;padding:0 26px;font-size:17px;font-weight:800}' +
    '.vs-sheet .vs-acc{display:flex;align-items:center;gap:12px;width:100%;min-height:56px;padding:10px 14px;margin:0 0 8px;text-align:left;font-size:16px;font-weight:700}' +
    '.vs-sheet .vs-acc i{font-style:normal;font-size:22px;width:28px;text-align:center}' +
    '.vs-sheet .vs-acc.vs-peligro{color:var(--brick,#e5484d);border-color:color-mix(in srgb,var(--brick,#e5484d) 45%,transparent)}' +
    // Caja de hoy
    '.vs-caja-total{font:800 34px/1.1 var(--font-main);text-align:center;margin:6px 0 2px}' +
    '.vs-caja-filas{margin:12px 0;border:1px solid var(--line);border-radius:14px;overflow:hidden}' +
    '.vs-caja-filas div{display:flex;justify-content:space-between;gap:10px;padding:11px 14px;border-top:1px solid var(--line);font-size:15px}.vs-caja-filas div:first-child{border-top:0}' +
    '.vs-caja-filas b{white-space:nowrap}';
  document.head.appendChild(css);

  // ---------- Ajustes → Apariencia: el interruptor ----------
  function montarAjuste(){
    if($('vsGrupo')) return;
    var ref = document.querySelector('#view-ajustes .settings-group[data-cat="apariencia"]'); if(!ref) return;
    var g = document.createElement('div'); g.className = 'settings-group'; g.id = 'vsGrupo'; g.hidden = ref.hidden; g.setAttribute('data-cat', 'apariencia');
    g.innerHTML = '<h2>🧭 Vista sencilla</h2><div class="settings-desc">Menos botones y cada cosa con su nombre: abajo solo <b>Cuentas · Productos · Caja · Más</b>, el menú «Más» en una lista ordenada y, en la cuenta, el total abajo con «Cobrar». Es solo otra forma de ver lo mismo: no se borra ni se cambia nada.</div>' +
      '<div class="settings-row"><div class="settings-row-text"><strong>Usar la vista sencilla en este equipo</strong><span>Puedes volver al diseño de siempre cuando quieras.</span></div><label class="switch"><input type="checkbox" id="vsOn"><span class="switch-slider"></span></label></div>';
    ref.parentNode.insertBefore(g, ref);
    $('vsOn').checked = on();
    $('vsOn').onchange = function(){ poner(this.checked); };
  }
  function poner(si){
    try{ localStorage.setItem(K, si ? '1' : '0'); }catch(e){}
    aplicar();
    try{ window.showToast && window.showToast(si ? '🧭 Vista sencilla prendida en este equipo.' : '🎨 Volviste al diseño de siempre.'); }catch(e){}
  }

  // ---------- Barra de abajo: 💵 Caja ----------
  function montarNav(){
    var nav = document.querySelector('.tabbar nav'); if(!nav || $('vsCajaNav')) return;
    var b = document.createElement('button'); b.type = 'button'; b.id = 'vsCajaNav';
    b.innerHTML = '<svg class="nav-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6.5 9.5v5M17.5 9.5v5"/></svg><span class="nav-lbl">Caja</span>';
    b.addEventListener('click', function(e){ e.stopPropagation(); abrirCaja(); });
    var prod = nav.querySelector('button[data-view="inventario"]');   // «Productos» (productos e inventario son una sola pantalla)
    nav.insertBefore(b, prod ? prod.nextSibling : null);
  }

  // ---------- «Más» por grupos ----------
  var GRUPOS = [['Mi negocio', ['contabilidad', 'estadisticas', 'carta', 'historial', 'cocina', 'musica', 'libreta', 'pagos']], ['Ayudantes', ['ia', 'calculadora']], ['Mi cuenta', ['plan', 'ajustes', 'reportar', 'salir']]];
  function montarMas(){
    var grid = document.querySelector('#navMoreSheet .more-grid'); if(!grid || grid.querySelector('.vs-grp')) return;
    if(!grid.querySelector('[data-go="cocina"]')){
      var t = document.createElement('button'); t.type = 'button'; t.className = 'more-tile'; t.id = 'vsMasCocina'; t.dataset.go = 'cocina';
      t.innerHTML = '<span class="more-ic">🖥️</span><strong>Pantalla de pedidos</strong><small>Los pedidos para preparar</small>';
      grid.appendChild(t);
    }
    var n = 0;
    GRUPOS.forEach(function(gr){
      var h = document.createElement('div'); h.className = 'vs-grp'; h.textContent = gr[0]; h.style.order = String(n++); grid.appendChild(h);
      gr[1].forEach(function(go){ var x = grid.querySelector('.more-tile[data-go="' + go + '"]'); if(x) x.style.order = String(n++); });
    });
    // Lo que no está en ningún grupo queda al final de «Mi negocio» (por si se agregan cosas nuevas al menú).
    grid.querySelectorAll('.more-tile').forEach(function(x){ if(!x.style.order) x.style.order = '9'; });
  }

  // ---------- Cuentas: «⋯ Más opciones» ----------
  function montarCuentas(){
    var fila = $('quickSaleBtn') && $('quickSaleBtn').parentNode; if(!fila || $('vsMasOp')) return;
    var b = document.createElement('button'); b.type = 'button'; b.className = 'btn-ghost'; b.id = 'vsMasOp'; b.textContent = '⋯ Más opciones';
    b.onclick = function(){ var si = document.body.classList.toggle('vs-masop'); b.textContent = si ? '✕ Menos opciones' : '⋯ Más opciones'; };
    fila.appendChild(b);
  }

  // ---------- Una hoja (ventana desde abajo) ----------
  function hoja(id){
    var ov = $(id);
    if(!ov){ ov = document.createElement('div'); ov.id = id; ov.className = 'overlay vs-sheet'; ov.setAttribute('data-novocab', ''); ov.style.zIndex = '10050';
      ov.addEventListener('click', function(e){ if(e.target === ov) ov.classList.remove('show'); }); }
    document.body.appendChild(ov);   // siempre encima de lo que esté abierto
    return ov;
  }

  // ---------- La cuenta: «⋯ Opciones» y «Cobrar» ----------
  function montarCuenta(){
    var acts = document.querySelector('#overlay .mesa-acts');
    if(acts && !$('vsOpcBtn')){
      var b = document.createElement('button'); b.type = 'button'; b.className = 'mesa-ico'; b.id = 'vsOpcBtn'; b.setAttribute('aria-label', 'Opciones de la cuenta');
      b.textContent = '⋯ Opciones'; b.onclick = abrirOpciones; acts.appendChild(b);
    }
    var modal = document.querySelector('#overlay .mesa-modal');
    if(modal && !$('vsCobrar')){
      var c = document.createElement('div'); c.id = 'vsCobrar';
      c.innerHTML = '<div class="vs-falta"><small>Falta por pagar</small><b id="vsFalta">$0</b></div><button type="button" class="btn-primary" id="vsCobrarBtn">Cobrar</button>';
      modal.appendChild(c);
      $('vsCobrarBtn').onclick = function(){
        var card = document.querySelector('#overlay .pay-card[data-scope="table"]'); if(!card) return;
        clic(card.querySelector('[data-q="all"]'));
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      };
    }
  }
  var ICONOS = { renameTableBtn: '✏️', moveTableBtn: '↔️', combinarMesaBtn: '🔗', reiniciarMesaBtn: '🧹', sndMesaBtn: '🔊' };
  var NOMBRES = { renameTableBtn: 'Cambiar el nombre', moveTableBtn: 'Pasar a otra mesa', combinarMesaBtn: 'Juntar con otra mesa', reiniciarMesaBtn: 'Vaciar la mesa' };
  function abrirOpciones(){
    var acts = document.querySelector('#overlay .mesa-acts'); if(!acts) return;
    var bs = [].slice.call(acts.querySelectorAll('.mesa-ico')).filter(function(x){ return x.id !== 'vsOpcBtn' && x.style.display !== 'none' && !x.hidden; });
    bs.sort(function(a, b){ return (a.id === 'reiniciarMesaBtn') - (b.id === 'reiniciarMesaBtn'); });   // vaciar, siempre de último
    var ov = hoja('vsOpcOv');
    ov.innerHTML = '<div class="modal" style="max-width:440px;width:100%"><h2>Opciones de la cuenta</h2>' +
      bs.map(function(x, i){ return '<button type="button" class="btn-ghost vs-acc' + (x.id === 'reiniciarMesaBtn' ? ' vs-peligro' : '') + '" data-i="' + i + '"><i>' + (ICONOS[x.id] || '•') + '</i>' + esc(NOMBRES[x.id] || x.title || x.getAttribute('aria-label') || '') + '</button>'; }).join('') +
      '<div class="modal-actions"><button type="button" class="btn-close" data-x>Cerrar</button></div></div>';
    ov.classList.add('show');
    ov.querySelector('[data-x]').onclick = function(){ ov.classList.remove('show'); };
    [].forEach.call(ov.querySelectorAll('.vs-acc'), function(a){ a.onclick = function(){ ov.classList.remove('show'); bs[+a.dataset.i].click(); }; });
  }
  function pintarFalta(){
    var f = $('vsFalta'); if(!f || !document.body.classList.contains('vs-on')) return;
    var ov = $('overlay'); if(!ov || !ov.classList.contains('show')) return;
    var mesa = typeof currentTable !== 'undefined' ? currentTable : null; if(mesa == null) return;
    var v = 0; try{ v = Math.max(0, tableBalance(mesa)); }catch(e){ return; }
    var t = plata(v); if(f.textContent !== t) f.textContent = t;
  }

  // ---------- 💵 Caja de hoy ----------
  function abrirCaja(){
    if(!jefe()){ try{ showToast('La caja la ve el dueño o el administrador.'); }catch(e){} return; }
    var ultimo = (data.closures && data.closures.length) ? data.closures[0] : null, s;
    try{ s = computeClosureStats(ultimo ? ultimo.date : null, new Date().toISOString()); }catch(e){ s = null; }
    var abiertas = 0, porCobrar = 0;
    try{ Object.keys(data.tables || {}).forEach(function(id){ if((data.tables[id].items || []).length){ abiertas++; porCobrar += Math.max(0, tableBalance(Number(id))); } }); }catch(e){}
    var desde = ultimo ? 'Desde el último cierre (' + new Date(ultimo.date).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ')' : 'Desde que empezaste (todavía no has cerrado caja)';
    var ov = hoja('vsCajaOv');
    ov.innerHTML = '<div class="modal" style="max-width:440px;width:100%"><h2>💵 Caja</h2><div class="modal-sub">' + esc(desde) + '</div>' +
      (s ? '<div class="vs-caja-total">' + plata(s.totalSold) + '</div><div class="modal-sub" style="text-align:center">vendido en ' + s.tickets.length + ' cuenta' + (s.tickets.length === 1 ? '' : 's') + ' cerrada' + (s.tickets.length === 1 ? '' : 's') + '</div>' +
        '<div class="vs-caja-filas"><div><span>💵 Efectivo</span><b>' + plata(s.totalEfectivo) + '</b></div><div><span>📲 Nequi y transferencias</span><b>' + plata(s.totalTransferencia) + '</b></div><div><span>📝 Quedaron debiendo</span><b>' + plata(s.totalDebe) + '</b></div>' +
        '<div><span>🧾 Falta cobrar en ' + abiertas + ' cuenta' + (abiertas === 1 ? '' : 's') + ' abierta' + (abiertas === 1 ? '' : 's') + '</span><b>' + plata(porCobrar) + '</b></div></div>'
        : '<p class="modal-sub">No se pudo sumar la caja en este momento.</p>') +
      '<button type="button" class="btn-ghost vs-acc" data-c="historial"><i>🧾</i>Historial de ventas</button>' +
      '<button type="button" class="btn-ghost vs-acc" data-c="fiados"><i>📒</i>Quién me debe</button>' +
      '<button type="button" class="btn-ghost vs-acc" data-c="general"><i>🧮</i>Cuenta general de las mesas</button>' +
      '<button type="button" class="btn-primary vs-acc" data-c="cerrar"><i>🔒</i>Cerrar caja del día</button>' +
      '<div class="modal-actions"><button type="button" class="btn-close" data-x>Cerrar</button></div></div>';
    ov.classList.add('show');
    ov.querySelector('[data-x]').onclick = function(){ ov.classList.remove('show'); };
    [].forEach.call(ov.querySelectorAll('[data-c]'), function(a){ a.onclick = function(){
      ov.classList.remove('show');
      var c = a.dataset.c;
      if(c === 'historial') clic('nav button[data-view="historial"]');
      else if(c === 'fiados') clic('#fiadosBtn');
      else if(c === 'general') clic('#generalBillBtn');
      else if(c === 'cerrar') clic('#closeDayTopBtn');   // pregunta antes de cerrar, como siempre
    }; });
  }

  // ---------- Prender / apagar ----------
  function aplicar(){
    var si = on();
    document.body.classList.toggle('vs-on', si);
    document.body.classList.toggle('vs-jefe', jefe());
    if(!si) document.body.classList.remove('vs-masop');
    montarAjuste(); montarNav(); montarMas(); montarCuentas(); montarCuenta();
    var t = $('vsOn'); if(t) t.checked = si;
  }
  function iniciar(){
    aplicar();
    // El rol puede cambiar (otro usuario entra en este equipo): la Caja solo para el dueño o el administrador.
    document.addEventListener('click', function(e){ if(e.target.closest && e.target.closest('#authBtn, .ajustes-cat, nav button')) setTimeout(aplicar, 120); }, true);
    setInterval(pintarFalta, 700);
  }
  window.ventoVistaSencilla = { on: on, poner: poner, abrirCaja: abrirCaja };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
