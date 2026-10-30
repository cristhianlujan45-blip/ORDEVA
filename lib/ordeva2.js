/* =====================================================================
   ORDEVA 2.0 · Diseño (lib/ordeva2.css) + 🏠 Inicio
   • body.o2: la apariencia «◐ ORDEVA 2.0» está puesta (se sigue eligiendo en Ajustes → Apariencia, como las demás).
   • body.o2-lado: navegación lateral en el computador (Ajustes → Apariencia → «Navegación lateral»; prendida de fábrica).
   • 🏠 Inicio: el resumen del negocio con datos REALES de la app, por período (hoy, 7 días, mes o fechas):
       - Ventas (lo vendido), Efectivo en caja, Por cobrar en cuentas abiertas y Gastos;
       - Resultado: vendido · cobrado · costo de lo vendido · gastos · utilidad estimada (conceptos distintos, cada uno
         con su nombre: vender no es cobrar, y cobrar no es ganar);
       - Ventas por día, productos más vendidos, alertas (existencias bajas, pedidos por aceptar o listos) y lo último
         que se vendió.
     No guarda nada ni cambia ninguna cuenta: lee lo mismo que usan el cierre de caja (computeClosureStats), la caja
     (ventoTurno), la contabilidad (ctMovimientos) y la pantalla de pedidos (vitoPedidos). Si un dato no existe, no se
     muestra (nunca se inventa una cifra).
   • Lo ve el dueño, el administrador y quien tenga el permiso «Ver las estadísticas».
   ===================================================================== */
(function(){
  'use strict';
  if(window.ordeva2) return;
  var DIA = 864e5;
  var $ = function(id){ return document.getElementById(id); };
  var D = function(){ return typeof data !== 'undefined' && data ? data : null; };
  var esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var plata = function(n){ n = Math.round(Number(n) || 0); return (n < 0 ? '−$ ' : '$ ') + Math.abs(n).toLocaleString('es-CO'); };
  var corto = function(n){ n = Math.round(Number(n) || 0); var a = Math.abs(n); return a >= 1e6 ? '$' + (n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace('.', ',') + 'M' : a >= 1e3 ? '$' + Math.round(n / 1e3) + 'k' : '$' + n; };
  var ls = function(k, v){ try{ if(v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); }catch(e){ return null; } };
  var ymd = function(d){ return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };   // fecha local (no UTC)
  var puedeVer = function(){ try{ return !window.ventoRoles || window.ventoRoles.puede('estadisticas'); }catch(e){ return true; } };

  // ---------- Apariencia y navegación lateral ----------
  function ladoOn(){ return ls('vento_o2_lado') !== '0'; }
  function aplicarClases(){
    var d = D(), b = document.body; if(!b) return;
    b.classList.toggle('o2', !!d && (d.theme || 'ordeva2') === 'ordeva2');
    b.classList.toggle('o2-lado', ladoOn());
  }
  function engancharPaleta(){
    var orig = window.applyPalette;
    if(typeof orig !== 'function' || orig.__o2) return;
    var envuelta = function(){ var r = orig.apply(this, arguments); try{ aplicarClases(); }catch(e){} return r; };
    envuelta.__o2 = true; window.applyPalette = envuelta;
  }
  function iniciales(t){ var p = String(t || '').trim().split(/\s+/).filter(Boolean); return ((p[0] || 'O')[0] + (p[1] ? p[1][0] : '')).toUpperCase(); }
  function montarLado(){
    var tb = document.querySelector('.tabbar'), nav = tb && tb.querySelector('nav'); if(!nav || $('o2Marca')) return;
    var m = document.createElement('div'); m.className = 'o2-marca'; m.id = 'o2Marca';
    m.innerHTML = '<img src="icons/ordeva.svg" alt=""><div><b>ORDEVA</b><small>Tu negocio, en control</small></div>';
    tb.insertBefore(m, nav);
    var n = document.createElement('button'); n.type = 'button'; n.className = 'o2-negocio'; n.id = 'o2Negocio'; n.title = 'Datos del negocio';
    n.addEventListener('click', function(){
      var aj = document.querySelector('nav button[data-view="ajustes"]');
      if(aj && aj.offsetParent !== null){ aj.click(); var c = document.querySelector('.ajustes-cat[data-cat="negocio"]'); if(c) c.click(); }
    });
    tb.appendChild(n);
    pintarNegocio();
  }
  function pintarNegocio(){
    var n = $('o2Negocio'), d = D(); if(!n) return;
    var nombre = (d && d.businessName) || (($('brandName') || {}).value) || 'Mi negocio';
    var h = '<span class="o2-av">' + esc(iniciales(nombre)) + '</span><span><b>Mi negocio</b><small>' + esc(nombre) + '</small></span>';
    if(n._h !== h){ n._h = h; n.innerHTML = h; }
  }
  function montarAjuste(){
    var grupos = document.querySelectorAll('#view-ajustes .settings-group[data-cat="apariencia"]');
    if(!grupos.length || $('o2LadoOn')) return;
    var g = document.createElement('div'); g.className = 'settings-group'; g.hidden = true; g.dataset.cat = 'apariencia'; g.id = 'o2Ajuste';
    g.innerHTML = '<h2>◐ ORDEVA 2.0</h2><div class="settings-desc">La apariencia nueva se elige abajo, en «Apariencia» (◐ ORDEVA 2.0). Los demás diseños siguen ahí.</div>' +
      '<div class="settings-row"><div class="settings-row-text"><strong>Navegación lateral</strong><span>En el computador, el menú va a la izquierda con todas las secciones. En el celular sigue abajo.</span></div>' +
      '<label class="switch"><input type="checkbox" id="o2LadoOn"><span class="switch-slider"></span></label></div>' +
      '<div class="settings-row"><div class="settings-row-text"><strong>Abrir en 🏠 Inicio</strong><span>Al entrar, mostrar el resumen del negocio en vez de las cuentas (solo quien puede ver las estadísticas).</span></div>' +
      '<label class="switch"><input type="checkbox" id="o2AbrirInicio"><span class="switch-slider"></span></label></div>';
    var vs = $('vsGrupo'), ref = vs && vs.closest ? vs.closest('.settings-group') || vs : null;   // después de «🧭 Vista sencilla», que va de primera
    if(ref && ref.parentNode) ref.parentNode.insertBefore(g, ref.nextSibling); else grupos[0].parentNode.insertBefore(g, grupos[0]);
    var a = $('o2LadoOn'), b = $('o2AbrirInicio');
    a.checked = ladoOn(); b.checked = ls('vento_o2_abrir_inicio') === '1';
    a.onchange = function(){ ls('vento_o2_lado', a.checked ? '1' : '0'); aplicarClases(); };
    b.onchange = function(){ ls('vento_o2_abrir_inicio', b.checked ? '1' : '0'); };
  }

  // ---------- 🏠 Inicio: cálculos (solo leen) ----------
  var st = { p: 'hoy', d1: '', d2: '' };
  function rango(p, d1, d2){
    var h = new Date(); h.setHours(0, 0, 0, 0);
    var ini = h.getTime(), fin = ini + DIA, t;
    if(p === '7d') ini -= 6 * DIA;
    else if(p === 'mes') ini = new Date(h.getFullYear(), h.getMonth(), 1).getTime();
    else if(p === 'rango' && d1){ ini = new Date(d1 + 'T00:00').getTime(); fin = new Date((d2 || d1) + 'T00:00').getTime() + DIA; if(fin <= ini){ t = ini; ini = fin - DIA; fin = t + DIA; } }
    return { ini: ini, fin: fin };
  }
  function ventasDe(r){
    var d = D(), tot = 0, n = 0, prods = {};
    ((d && d.history) || []).forEach(function(h){
      var t = new Date(h.date).getTime(); if(!(t >= r.ini && t < r.fin)) return;
      tot += Number(h.total) || 0; n++;
      (h.items || []).forEach(function(it){
        if(/^(domicilio|propina)/i.test(it.name || '')) return;
        var k = (it.productId || '') + '|' + (it.name || '') + '|' + (it.size || ''), q = Number(it.qty) || 0;
        var x = prods[k] || (prods[k] = { id: it.productId, nombre: (it.name || 'Producto') + (it.size ? ' · ' + it.size : ''), q: 0, v: 0 });
        x.q += q; x.v += (Number(it.price) || 0) * q;
      });
    });
    return { total: tot, n: n, top: Object.keys(prods).map(function(k){ return prods[k]; }).sort(function(a, b){ return b.v - a.v || b.q - a.q; }) };
  }
  function porDia(r){
    var d = D(), dias = Math.max(1, Math.round((r.fin - r.ini) / DIA)), l = [];
    if(dias === 1){ r = { ini: r.fin - 7 * DIA, fin: r.fin }; dias = 7; }       // «Hoy»: los últimos 7 días, para comparar
    var mensual = dias > 62;
    if(mensual){
      var a = new Date(r.ini); a = new Date(a.getFullYear(), a.getMonth(), 1);
      while(a.getTime() < r.fin){ var s = new Date(a.getFullYear(), a.getMonth() + 1, 1); l.push({ ini: Math.max(a.getTime(), r.ini), fin: Math.min(s.getTime(), r.fin), et: a.toLocaleDateString('es-CO', { month: 'short' }), v: 0 }); a = s; }
    } else for(var i = 0; i < dias; i++){ var x = r.ini + i * DIA, f = new Date(x); l.push({ ini: x, fin: x + DIA, et: dias <= 7 ? f.toLocaleDateString('es-CO', { weekday: 'short' }) + ' ' + f.getDate() : String(f.getDate()), v: 0 }); }
    ((d && d.history) || []).forEach(function(h){ var t = new Date(h.date).getTime(); for(var j = 0; j < l.length; j++){ if(t >= l[j].ini && t < l[j].fin){ l[j].v += Number(h.total) || 0; break; } } });
    return l;
  }
  function caja(){
    try{
      var tu = window.ventoTurno && window.ventoTurno.turno && window.ventoTurno.turno();
      if(tu){ var r = window.ventoTurno.resumen(); return { v: r.esperado, txt: 'Base + efectivo + entradas − salidas (caja abierta)' }; }
    }catch(e){}
    try{
      var d = D(), u = d && d.closures && d.closures.length ? d.closures[0] : null;
      var s = computeClosureStats(u ? u.date : null, new Date().toISOString());
      return { v: s.totalEfectivo, txt: u ? 'Efectivo cobrado desde el último cierre' : 'Efectivo cobrado (aún sin cierre de caja)' };
    }catch(e){ return null; }
  }
  function abiertas(){
    var d = D(), n = 0, v = 0;
    try{ Object.keys((d && d.tables) || {}).forEach(function(id){ var t = d.tables[id]; if(t && (t.items || []).length){ n++; v += Math.max(0, tableBalance(Number(id))); } }); }catch(e){ return null; }
    return { n: n, v: v };
  }
  function contab(r){
    try{
      if(typeof ctMovimientos !== 'function') return null;
      var c = ctMovimientos(r), g = 0, cob = 0;
      c.mov.forEach(function(m){ if(m.tipo === 'gasto') g += m.monto; else if(m.tipo === 'venta' || m.tipo === 'ingreso') cob += m.monto; });
      return { gastos: g, cobrado: cob, vendido: c.vendido, costo: c.costo, sinCosto: c.sinCosto, utilidad: c.vendido - c.costo - g };
    }catch(e){ return null; }
  }
  function alertas(){
    var d = D(), l = [];
    var bajos = ((d && d.products) || []).filter(function(p){ return p.stock != null && p.minStock != null && p.minStock !== '' && Number(p.stock) <= Number(p.minStock); });
    if(bajos.length) l.push({ c: 'ojo', ic: '⚠️', t: 'Existencias bajas (' + bajos.length + ')', s: bajos.slice(0, 3).map(function(p){ return p.name + ' (' + p.stock + ')'; }).join(' · '), ir: 'inventario' });
    try{
      var P = window.vitoPedidos && window.vitoPedidos.lista ? window.vitoPedidos.lista() : [];
      var nuevos = P.filter(function(p){ return p.estado === 'nuevo'; }), listos = P.filter(function(p){ return p.estado === 'listo'; }), prep = P.filter(function(p){ return p.estado === 'recibido' || p.estado === 'preparacion'; });
      if(nuevos.length) l.push({ c: 'mal', ic: '🛎️', t: nuevos.length + ' pedido' + (nuevos.length === 1 ? '' : 's') + ' por aceptar', s: 'Llegaron por QR o de los meseros', ir: 'cocina' });
      if(prep.length) l.push({ c: 'info', ic: '👩‍🍳', t: prep.length + ' en preparación', s: 'Pantalla de pedidos', ir: 'cocina' });
      if(listos.length) l.push({ c: 'ok', ic: '🔔', t: listos.length + ' listo' + (listos.length === 1 ? '' : 's') + ' para entregar', s: 'Pantalla de pedidos', ir: 'cocina' });
    }catch(e){}
    return l;
  }
  function calc(p, d1, d2){
    var r = rango(p, d1, d2), largo = r.fin - r.ini, ant = { ini: r.ini - largo, fin: r.ini };
    var v = ventasDe(r), va = ventasDe(ant);
    return { r: r, ventas: v, antes: va, cambio: va.total > 0 ? Math.round((v.total - va.total) / va.total * 100) : null, caja: caja(), abiertas: abiertas(), contab: contab(r), dias: porDia(r), alertas: alertas() };
  }

  // ---------- 🏠 Inicio: pintar ----------
  // La gráfica se dibuja al ancho real de su tarjeta (st.gw, medido al pintar): sin estirar letras ni puntos.
  function grafica(l){
    var W = Math.max(260, st.gw || 640), H = window.innerWidth <= 760 ? 180 : 220, pi = 44, pd = 10, ps = 12, pb = 26, max = Math.max.apply(null, l.map(function(x){ return x.v; }).concat([0]));
    if(!(max > 0)) return '<div class="o2-vacio">Todavía no hay ventas en estas fechas.</div>';
    var paso = Math.pow(10, Math.floor(Math.log10(max))), tope = Math.ceil(max / paso) * paso; if(tope / paso > 5) paso *= 2;
    var X = function(i){ return pi + (l.length === 1 ? (W - pi - pd) / 2 : i * (W - pi - pd) / (l.length - 1)); }, Y = function(v){ return ps + (H - ps - pb) * (1 - v / tope); };
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Ventas por día"><defs><linearGradient id="o2Deg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#16a34a" stop-opacity=".22"/><stop offset="1" stop-color="#16a34a" stop-opacity="0"/></linearGradient></defs>';
    for(var v = 0; v <= tope + 1; v += paso){ s += '<line class="rej" x1="' + pi + '" x2="' + (W - pd) + '" y1="' + Y(v) + '" y2="' + Y(v) + '"/><text class="ej" x="' + (pi - 8) + '" y="' + (Y(v) + 4) + '" text-anchor="end">' + corto(v) + '</text>'; }
    var pts = l.map(function(x, i){ return X(i).toFixed(1) + ',' + Y(x.v).toFixed(1); });
    s += '<path class="are" d="M' + X(0) + ',' + Y(0) + ' L' + pts.join(' L') + ' L' + X(l.length - 1) + ',' + Y(0) + ' Z"/><polyline class="lin" points="' + pts.join(' ') + '"/>';
    var cada = Math.ceil(l.length / 10);
    l.forEach(function(x, i){ s += '<circle class="pto" cx="' + X(i) + '" cy="' + Y(x.v) + '" r="3.2"><title>' + esc(x.et) + ': ' + esc(plata(x.v)) + '</title></circle>'; if(i % cada === 0 || i === l.length - 1) s += '<text class="ej" x="' + X(i) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(x.et) + '</text>'; });
    return s + '</svg>';
  }
  function foto(id){ try{ return typeof fotosCache !== 'undefined' && id && fotosCache[id] ? fotosCache[id] : ''; }catch(e){ return ''; } }
  function nombreUsuario(){
    try{ var u = typeof authUser !== 'undefined' ? String(authUser || '') : ''; u = u.split('@')[0]; return u ? u.charAt(0).toUpperCase() + u.slice(1) : ''; }catch(e){ return ''; }
  }
  var TIT = { hoy: 'hoy', '7d': 'en los últimos 7 días', mes: 'este mes', rango: 'en las fechas elegidas' };
  function pintar(){
    var box = $('o2Inicio'); if(!box || !D()) return;
    if(!puedeVer()){ box.innerHTML = '<div class="o2-card o2-vacio">El resumen del negocio lo ve el dueño, el administrador o quien tenga el permiso de estadísticas.</div>'; return; }
    var c = calc(st.p, st.d1, st.d2), k = c.contab, n = nombreUsuario(), hoy = new Date();
    var cambio = c.cambio == null ? '<em>Sin ventas en el período anterior para comparar</em>' : '<em class="' + (c.cambio >= 0 ? 'o2-sube' : 'o2-baja') + '">' + (c.cambio >= 0 ? '▲ ' : '▼ ') + Math.abs(c.cambio) + '%</em> <em>vs. período anterior</em>';
    var top = c.ventas.top.slice(0, 5);
    var ult = ((D().history) || []).slice().sort(function(a, b){ return new Date(b.date) - new Date(a.date); }).slice(0, 6);
    var h = '<div class="o2-ini">' +
      '<div class="o2-ini-top"><div><h1>' + (n ? 'Hola, ' + esc(n) : 'Resumen del negocio') + '</h1><p>Así va tu negocio ' + esc(TIT[st.p]) + ' · ' + esc(hoy.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })) + '</p></div>' +
        '<div class="o2-rango"><div class="o2-chips" role="tablist">' + [['hoy', 'Hoy'], ['7d', '7 días'], ['mes', 'Mes'], ['rango', 'Fechas']].map(function(x){ return '<button type="button" role="tab" data-o2p="' + x[0] + '" class="' + (st.p === x[0] ? 'on' : '') + '" aria-selected="' + (st.p === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>' +
        (st.p === 'rango' ? '<label>Desde <input type="date" id="o2D1" value="' + esc(st.d1) + '"></label><label>Hasta <input type="date" id="o2D2" value="' + esc(st.d2) + '"></label>' : '') + '</div></div>' +
      '<div class="o2-kpis">' +
        '<div class="o2-card o2-kpi" id="o2KVentas"><span class="o2-ic ok">🧾</span><div><small>Ventas</small><strong>' + plata(c.ventas.total) + '</strong>' + cambio + '<em style="display:block">' + c.ventas.n + ' venta' + (c.ventas.n === 1 ? '' : 's') + '</em></div></div>' +
        (c.caja ? '<div class="o2-card o2-kpi" id="o2KCaja"><span class="o2-ic info">💵</span><div><small>En caja (efectivo)</small><strong>' + plata(c.caja.v) + '</strong><em>' + esc(c.caja.txt) + '</em></div></div>' : '') +
        (c.abiertas ? '<div class="o2-card o2-kpi" id="o2KPend"><span class="o2-ic ojo">🧮</span><div><small>Por cobrar en cuentas abiertas</small><strong>' + plata(c.abiertas.v) + '</strong><em>' + c.abiertas.n + ' cuenta' + (c.abiertas.n === 1 ? '' : 's') + ' abierta' + (c.abiertas.n === 1 ? '' : 's') + '</em></div></div>' : '') +
        (k ? '<div class="o2-card o2-kpi" id="o2KGastos"><span class="o2-ic mal">📤</span><div><small>Gastos</small><strong>' + plata(k.gastos) + '</strong><em>Compras, arriendo, servicios y demás</em></div></div>' : '') +
      '</div>' +
      (k ? '<div class="o2-card"><h2>Resultado ' + esc(TIT[st.p]) + '<button type="button" data-o2ir="contabilidad">Contabilidad ›</button></h2><div class="o2-res" id="o2Res">' +
        '<div><span>Vendido</span><b>' + plata(k.vendido) + '</b></div><div><span>Cobrado (entró)</span><b>' + plata(k.cobrado) + '</b></div><div><span>Costo de lo vendido</span><b>' + plata(k.costo) + '</b></div>' +
        '<div><span>Gastos</span><b>' + plata(k.gastos) + '</b></div><div><span>Utilidad estimada</span><b class="' + (k.utilidad >= 0 ? 'o2-sube' : 'o2-baja') + '">' + plata(k.utilidad) + '</b></div></div>' +
        '<div class="o2-nota">Vendido es lo que se facturó; cobrado, la plata que entró (incluye fiados que pagaron); utilidad = vendido − costo − gastos.' + (k.sinCosto ? ' ⚠️ Hay productos vendidos sin costo: la utilidad sale más alta de lo real hasta que les pongas el costo.' : '') + '</div></div>' : '') +
      '<div class="o2-fila">' +
        '<div class="o2-card o2-graf"><h2>' + (st.p === 'hoy' ? 'Ventas de los últimos 7 días' : 'Ventas por ' + (c.dias.length && c.dias[0].fin - c.dias[0].ini > DIA ? 'mes' : 'día')) + '</h2>' + grafica(c.dias) + '</div>' +
        '<div class="o2-card"><h2>Más vendidos<button type="button" data-o2ir="estadisticas">Ver todo ›</button></h2>' + (top.length ? '<ul class="o2-lista" id="o2Top">' + top.map(function(x){ var f = foto(x.id); return '<li>' + (f ? '<img class="o2-av" src="' + esc(f) + '" alt="">' : '<span class="o2-av">' + esc(iniciales(x.nombre)) + '</span>') + '<span class="o2-nom">' + esc(x.nombre) + '</span><span class="o2-can">' + esc(Math.round(x.q * 100) / 100) + '</span><span class="o2-val">' + plata(x.v) + '</span></li>'; }).join('') + '</ul>' : '<div class="o2-vacio">Sin ventas en este período.</div>') + '</div>' +
        '<div class="o2-card"><h2>Alertas</h2>' + (c.alertas.length ? '<div class="o2-alertas" id="o2Alertas">' + c.alertas.map(function(a){ return '<div class="o2-alerta"><span class="o2-ic ' + a.c + '">' + a.ic + '</span><div><b>' + esc(a.t) + '</b><small>' + esc(a.s) + '</small></div><button type="button" data-o2ir="' + a.ir + '">Ver</button></div>'; }).join('') + '</div>' : '<div class="o2-vacio">✅ Todo en orden: sin alertas.</div>') + '</div>' +
      '</div>' +
      '<div class="o2-card"><h2>Últimas ventas<button type="button" data-o2ir="historial">Historial ›</button></h2>' + (ult.length ? '<table class="o2-tabla"><thead><tr><th>Cuándo</th><th>Dónde</th><th class="o2-cpago">Pago</th><th class="num">Total</th></tr></thead><tbody>' +
        ult.map(function(x){ var fx = new Date(x.date), hoyX = fx.toDateString() === new Date().toDateString(); var m = (x.payments || []).filter(function(p){ return Number(p.amount) > 0; }).map(function(p){ return p.method; }), deb = (x.payments || []).some(function(p){ return p.method === 'debe'; });
          return '<tr><td class="o2-cuando">' + esc(hoyX ? fx.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) : fx.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })) + '</td><td>' + esc(x.tableName || (x.table != null ? 'Mesa ' + x.table : 'Mostrador')) + '</td><td class="o2-cpago">' +
            (deb ? '<span class="o2-estado ojo">Fiado</span>' : '<span class="o2-estado ok">' + esc(m.length ? m.filter(function(v, i){ return m.indexOf(v) === i; }).join(' + ') : 'pagado') + '</span>') + '</td><td class="num">' + plata(x.total) + '</td></tr>'; }).join('') + '</tbody></table>'
        : '<div class="o2-vacio">Aún no hay ventas.</div>') + '</div>' +
    '</div>';
    if(box._h !== h){ box._h = h; box.innerHTML = h; }
    var g = box.querySelector('.o2-graf'), w = g ? g.clientWidth - (parseFloat(getComputedStyle(g).paddingLeft) || 0) - (parseFloat(getComputedStyle(g).paddingRight) || 0) : 0;
    if(w > 0 && Math.abs(w - (st.gw || 0)) > 24){ st.gw = Math.round(w); pintar(); }
  }
  function visible(){ var v = $('view-inicio'); return !!v && v.classList.contains('active'); }
  function enlazar(){
    var box = $('o2Inicio'); if(!box || box._o2) return; box._o2 = true;
    box.addEventListener('click', function(e){
      var b = e.target.closest('[data-o2p]');
      if(b){ st.p = b.dataset.o2p; if(st.p === 'rango' && !st.d1){ var h = new Date(); st.d2 = ymd(h); h.setDate(1); st.d1 = ymd(h); } pintar(); return; }
      var ir = e.target.closest('[data-o2ir]');
      if(ir){ var n = document.querySelector('nav button[data-view="' + ir.dataset.o2ir + '"]'); if(n) n.click(); }
    });
    box.addEventListener('change', function(e){ if(e.target.id === 'o2D1') st.d1 = e.target.value; if(e.target.id === 'o2D2') st.d2 = e.target.value; pintar(); });
    var nb = document.querySelector('nav button[data-view="inicio"]'); if(nb) nb.addEventListener('click', function(){ setTimeout(pintar, 0); });
    setInterval(function(){ if(visible() && !document.hidden){ pintar(); pintarNegocio(); } else pintarNegocio(); }, 15000);
  }
  window.addEventListener('resize', function(){ if(visible()){ clearTimeout(st.rt); st.rt = setTimeout(pintar, 200); } });
  function abrirAlEntrar(){
    if(ls('vento_o2_abrir_inicio') !== '1' || !puedeVer()) return;
    var b = document.querySelector('nav button[data-view="inicio"]'); if(b && getComputedStyle(b).display !== 'none') b.click();
  }

  function iniciar(){
    engancharPaleta(); aplicarClases(); montarLado(); montarAjuste(); enlazar();
    var n = 0, t = setInterval(function(){ if(D() || ++n > 40){ clearInterval(t); aplicarClases(); pintarNegocio(); montarAjuste(); abrirAlEntrar(); if(visible()) pintar(); } }, 250);
  }
  window.ordeva2 = { calc: calc, rango: rango, pintar: pintar, aplicar: aplicarClases, ladoOn: ladoOn };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
