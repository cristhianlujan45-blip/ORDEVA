/* =====================================================================
   ORDEVA · 📱 el celular como lector de códigos de este equipo (1.65.0)
   En «🔳 Escanear código» (mesa, Venta rápida, caja, productos, inventario…) sale «📱 Usar el celular como lector»:
   un QR que se escanea UNA vez con el celular y abre lector.html. Desde ahí, cada código de barras o QR que lea la
   cámara del celular llega a este equipo como si lo hubiera leído su propia cámara.
   • Inalámbrico, por los canales del servidor de ORDEVA (lib/vento-canal.js): sirve con wifi o con datos, sin estar
     en la misma red. El emparejamiento queda guardado en los dos equipos.
   • Canales (nombre al azar de 24 letras, que solo conocen los dos equipos):
       <c>   celular → equipo   { t:'hola', d }   { t:'cod', v, id, s }
       <c>r  equipo → celular   { t:'listo', on, s, h, n }   { t:'ok', id, s }
     «s» es esta apertura de ORDEVA: un código que el celular leyó cuando aquí no había nada abierto donde ponerlo nunca
     se suma después (ni una lectura vieja que siga guardada en el servidor). 1.65.6: también {t:'sin', id} (no había
     dónde ponerlo) y el celular lector manda a lo que esté abierto aunque no esté «🔳 Escanear» (ver destino()).
   • Por cable: el celular conectado por USB como cámara web sale en «📷 Cámara» (app/04g…, scanAbrirCamara).
   ===================================================================== */
(function(){
  'use strict';
  if(window.ventoLectorCel) return;
  var LS = 'vento_lector_cel', CANAL = 'https://canal.vento.local/';
  var st = { abierto: false, onCode: null, hint: '', s: '', es: null, vistos: {}, celVisto: 0, expandido: false };

  function esc(t){ return String(t == null ? '' : t).replace(/[&<>"]/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function azar(n){
    var a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789', r = '', b = new Uint8Array(n);
    try{ crypto.getRandomValues(b); }catch(e){ for(var j = 0; j < n; j++) b[j] = Math.floor(Math.random() * 256); }
    for(var i = 0; i < n; i++) r += a[b[i] % a.length];
    return r;
  }
  function guardado(){ try{ var g = JSON.parse(localStorage.getItem(LS) || 'null'); return g && /^lc[A-Za-z0-9]{20,40}$/.test(g.c || '') ? g : null; }catch(e){ return null; } }
  function guardar(g){ try{ localStorage.setItem(LS, JSON.stringify(g)); }catch(e){} }
  function canal(crear){
    var g = guardado();
    if(!g && crear){ g = { c: 'lc' + azar(22) }; guardar(g); }
    return g ? g.c : '';
  }
  // Dirección de lector.html junto a esta página (GitHub Pages, el programa de PC o la copia local de pruebas).
  function enlace(c){ return new URL('lector.html', location.href).href.split('#')[0] + '#c=' + c; }
  function publicar(c, o){ return fetch(CANAL + c, { method: 'POST', body: JSON.stringify(o) }).catch(function(){}); }
  function negocio(){ try{ return (typeof data !== 'undefined' && data && data.businessName) || ''; }catch(e){ return ''; } }   // «data» es let (no está en window)

  /* 1.65.6 · El celular lector SIEMPRE conectado (no solo con «🔳 Escanear» abierto): mientras ORDEVA está abierta, cada
     código va a lo que esté abierto en este equipo. Cada pantalla se anota en window.ventoLectorDestinos (así no importa
     el orden en que cargan los archivos) con { nombre, prioridad, activo(), hint, leer(código) }:
       «🔳 Escanear» abierto (lo de siempre) › 🧾 caja › cuenta de una mesa › venta rápida › 🔢 inventario por código.
     El celular ve a dónde va lo que lea («🧾 Caja: cada código se suma a la venta»); si no hay nada abierto, no manda. */
  var DEST = window.ventoLectorDestinos = window.ventoLectorDestinos || [];
  function destino(){
    if(st.onCode) return { h: st.hint, leer: st.onCode };
    var l = DEST.slice().sort(function(x, y){ return (y.prioridad || 0) - (x.prioridad || 0); });
    for(var i = 0; i < l.length; i++){
      try{ if(l[i].activo()) return { h: typeof l[i].hint === 'function' ? l[i].hint() : l[i].hint, leer: l[i].leer }; }catch(e){}
    }
    return null;
  }
  var dicho = null;   // lo último que se le dijo al celular (para no repetirlo)
  function decir(d){
    var c = canal(false); if(!c) return;
    dicho = d ? String(d.h || '') : '';
    publicar(c + 'r', d ? { t: 'listo', on: true, s: st.s, h: String(d.h || '').slice(0, 160), n: String(negocio()).slice(0, 60) } : { t: 'listo', on: false, s: st.s });
  }
  function revisarDestino(){
    if(!guardado()) return;
    escuchar();
    var d = destino(), h = d ? String(d.h || '') : '';
    if(dicho === null || h !== dicho) decir(d);
  }
  function escuchar(){
    var c = canal(false); if(!c || st.es) return;
    // Lo de los últimos 10 min: el «hola» del celular dice si está conectado; los códigos solo cuentan con «s» de ahora.
    try{ st.es = new EventSource(CANAL + c + '/sse?since=10m'); }catch(e){ st.es = null; return; }
    st.es.onmessage = function(ev){
      var m = null, o = null;
      try{ m = JSON.parse(ev.data); o = JSON.parse(m.message); }catch(e){ return; }
      if(!o) return;
      if(o.t === 'hola'){
        var t = (+m.time || 0) * 1000;
        if(t > st.celVisto){ st.celVisto = t; var g = guardado(); if(g){ g.cel = String(o.d || 'Celular').slice(0, 40); g.visto = t; guardar(g); } pintar(); }
        // Un celular que se acaba de abrir se entera enseguida de a dónde va lo que lea.
        if(Date.now() - t < 60000) decir(destino());
        return;
      }
      if(o.t === 'cod' && o.s === st.s && o.id && !st.vistos[o.id]){
        st.vistos[o.id] = 1;
        var v = String(o.v == null ? '' : o.v).trim().slice(0, 300);
        if(!v) return;
        st.celVisto = Math.max(st.celVisto, Date.now());
        var d = destino();
        if(!d){ publicar(c + 'r', { t: 'sin', id: o.id, s: st.s }); return; }   // ya no hay nada abierto donde ponerlo
        publicar(c + 'r', { t: 'ok', id: o.id, s: st.s });
        try{ d.leer(v); }catch(e){ setTimeout(function(){ throw e; }); }
        pintar();
      }
    };
  }
  function dejar(){ if(st.es){ try{ st.es.close(); }catch(e){} st.es = null; } }

  function conectado(){ return st.celVisto && Date.now() - st.celVisto < 3 * 60e3; }
  function pintar(){
    var g = guardado(), c = g && g.c;
    ['scanCelBox', 'lcelPanelBox'].forEach(function(id){
      var box = document.getElementById(id); if(!box) return;
      var fijo = id === 'lcelPanelBox', abierto = fijo || st.expandido;
      var estado = !c ? '' : conectado() ? '<span class="lcel-pt ok">🟢 ' + esc(g.cel || 'Celular') + ' conectado: lo que lea llega aquí</span>'
        : g.visto ? '<span class="lcel-pt">⚪ Celular emparejado: abre en él el lector (o vuelve a escanear el QR)</span>'
        : '<span class="lcel-pt">⚪ Todavía ningún celular: escanea el QR con el celular</span>';
      var h = (fijo ? '' : '<button type="button" class="btn-ghost lcel-btn" data-lcel="ver" aria-expanded="' + (st.expandido ? 'true' : 'false') + '">📱 ' + (st.expandido ? 'Ocultar' : 'Usar el celular como lector') + '</button>') + estado;
      if(abierto){
        h += '<div class="lcel-panel"><div class="lcel-qr"></div><div class="lcel-pasos">' +
          '<b>📶 Inalámbrico (wifi o datos)</b><ol><li>Con la cámara del celular escanea este código (o en ORDEVA del celular: «📷 Escanear»).</li>' +
          '<li>Se abre el lector en el celular: apunta a los códigos y entran solos a lo que tengas abierto aquí: la <b>caja</b>, el <b>inventario</b>, la <b>cuenta de una mesa</b> o la <b>venta rápida</b>.</li></ol>' +
          '<b>🔵 Bluetooth (sin internet)</b><div>Con la app ORDEVA en el celular: en el lector toca «🔵 Bluetooth» y empareja el celular con este computador como teclado. Cada código se escribe aquí como con una pistola lectora.</div>' +
          '<b>🔌 Por cable USB</b><div>Android 14 o más: conecta el celular, toca el aviso «USB» y elige <i>Cámara web</i>. Luego, en «🔳 Escanear código», elígelo en «📷 Cámara». (También sirven DroidCam o Iriun.)</div>' +
          '<div class="lcel-acc"><button type="button" class="btn-ghost" data-lcel="copiar">🔗 Copiar enlace</button><button type="button" class="btn-ghost" data-lcel="nuevo" title="Los celulares emparejados dejan de mandar códigos">🔄 Desconectar celulares</button></div></div></div>';
      }
      box.innerHTML = h;
      box.querySelectorAll('[data-lcel]').forEach(function(b){ b.addEventListener('click', accion); });
      var q = box.querySelector('.lcel-qr');
      if(q && c){
        try{ new QRCode(q, { text: enlace(c), width: 168, height: 168, correctLevel: QRCode.CorrectLevel.M }); }
        catch(e){ q.textContent = enlace(c); q.classList.add('txt'); }
      }
    });
    // Los avisos chiquitos «📱 conectado» que pone cada pantalla (caja, inventario).
    document.querySelectorAll('[data-lcel-estado]').forEach(function(el){ el.textContent = !c ? '' : conectado() ? '🟢' : '⚪'; });
  }
  function accion(e){
    var a = e.currentTarget.getAttribute('data-lcel');
    if(a === 'ver'){
      st.expandido = !st.expandido;
      if(st.expandido && !guardado()){ canal(true); revisarDestino(); }
      pintar();
    } else if(a === 'copiar'){
      var u = enlace(canal(true));
      try{ navigator.clipboard.writeText(u).then(function(){ aviso('🔗 Enlace copiado: ábrelo en el celular.'); }, function(){ prompt('Abre este enlace en el celular:', u); }); }
      catch(x){ prompt('Abre este enlace en el celular:', u); }
    } else if(a === 'nuevo'){
      if(!confirm('¿Desconectar los celulares emparejados? Dejan de mandar códigos a este equipo y hay que volver a escanear el QR nuevo.')) return;
      decir(null);
      dejar(); guardar({ c: 'lc' + azar(22) }); st.celVisto = 0; dicho = null;
      revisarDestino();
      pintar(); aviso('🔄 Listo: escanea el QR nuevo con el celular.');
    }
  }
  function aviso(t){ try{ if(typeof showToast === 'function') showToast(t, 4000); }catch(e){} }

  // Ventana propia «📱 Celular como lector» (botones con data-lcel-abrir en la caja y el inventario).
  function abrirPanel(){
    canal(true); revisarDestino();
    var ov = document.getElementById('lcelOv');
    if(!ov){
      ov = document.createElement('div'); ov.id = 'lcelOv'; ov.className = 'overlay'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Celular como lector');
      ov.innerHTML = '<div class="modal scan-modal"><div class="modal-title-row"><h2>📱 Celular como lector</h2><button class="rename-table-btn" type="button" data-lcel-cerrar title="Cerrar">✕</button></div>' +
        '<div class="modal-sub">Escanea los códigos de barras con la cámara del celular y entran solos aquí, sin cables.</div><div id="lcelPanelBox"></div>' +
        '<div class="modal-actions"><button class="btn-close" type="button" data-lcel-cerrar style="flex:1">Listo</button></div></div>';
      document.body.appendChild(ov);
      ov.addEventListener('click', function(e){ if(e.target === ov || e.target.closest('[data-lcel-cerrar]')) ov.classList.remove('show'); });
    }
    document.body.appendChild(ov);
    ov.classList.add('show');
    pintar();
  }
  document.addEventListener('click', function(e){ var b = e.target.closest && e.target.closest('[data-lcel-abrir]'); if(b){ e.preventDefault(); abrirPanel(); } });

  st.s = azar(8);   // esta apertura de ORDEVA: un código leído antes de abrirla nunca se suma
  window.ventoLectorCel = {
    abrir: function(hint, onCode){
      st.abierto = true; st.onCode = onCode; st.hint = hint || '';
      var g = guardado(); st.celVisto = Math.max(st.celVisto, g && g.visto && Date.now() - g.visto < 3 * 60e3 ? g.visto : 0);
      st.expandido = false;
      revisarDestino();
      pintar();
    },
    cerrar: function(){
      if(!st.abierto) return;
      st.abierto = false; st.onCode = null;
      revisarDestino();
    },
    mostrar: function(si){ st.expandido = !!si; if(si && !guardado()){ canal(true); revisarDestino(); } pintar(); },
    abrirPanel: abrirPanel,
    enlace: function(){ return enlace(canal(true)); },
    estado: function(){ var g = guardado(); return { emparejado: !!g, conectado: !!conectado(), celular: g && g.cel || '', destino: (destino() || {}).h || '' }; }
  };
  // ORDEVA se cierra: el celular deja de mostrar «listo».
  window.addEventListener('pagehide', function(){ if(guardado()) decir(null); });
  setInterval(function(){ try{ revisarDestino(); }catch(e){} }, 1000);                     // ¿cambió lo que está abierto?
  setInterval(function(){ var ov = document.getElementById('lcelOv'); if(guardado() && !st.expandido && !(ov && ov.classList.contains('show'))) pintar(); }, 30000);   // «conectado» se apaga solo si el celular se calla
})();
