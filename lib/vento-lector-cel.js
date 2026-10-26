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
     «s» es la apertura de «Escanear» de este equipo: un código que el celular leyó cuando aquí no se estaba
     escaneando nunca se suma después (ni una lectura vieja que siga guardada en el servidor).
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

  function decir(on){
    var c = canal(false); if(!c) return;
    publicar(c + 'r', on ? { t: 'listo', on: true, s: st.s, h: String(st.hint || '').slice(0, 160), n: String(negocio()).slice(0, 60) } : { t: 'listo', on: false, s: st.s });
  }
  function escuchar(){
    var c = canal(false); if(!c || st.es) return;
    // Lo de los últimos 10 min: el «hola» del celular dice si está conectado; los códigos solo cuentan con «s» de ahora.
    try{ st.es = new EventSource(CANAL + c + '/sse?since=10m'); }catch(e){ st.es = null; return; }
    st.es.onmessage = function(ev){
      var m = null, o = null;
      try{ m = JSON.parse(ev.data); o = JSON.parse(m.message); }catch(e){ return; }
      if(!o || !st.abierto) return;
      if(o.t === 'hola'){
        var t = (+m.time || 0) * 1000;
        if(t > st.celVisto){ st.celVisto = t; var g = guardado(); if(g){ g.cel = String(o.d || 'Celular').slice(0, 40); g.visto = t; guardar(g); } pintar(); }
        // Un celular que se acaba de abrir se entera enseguida de que aquí se está escaneando.
        if(Date.now() - t < 60000) decir(true);
        return;
      }
      if(o.t === 'cod' && o.s === st.s && o.id && !st.vistos[o.id]){
        st.vistos[o.id] = 1;
        var v = String(o.v == null ? '' : o.v).trim().slice(0, 300);
        if(!v) return;
        st.celVisto = Math.max(st.celVisto, Date.now());
        publicar(c + 'r', { t: 'ok', id: o.id, s: st.s });
        try{ if(st.onCode) st.onCode(v); }catch(e){ setTimeout(function(){ throw e; }); }
        pintar();
      }
    };
  }
  function dejar(){ if(st.es){ try{ st.es.close(); }catch(e){} st.es = null; } }

  function conectado(){ return st.celVisto && Date.now() - st.celVisto < 3 * 60e3; }
  function pintar(){
    var box = document.getElementById('scanCelBox'); if(!box) return;
    var g = guardado(), c = g && g.c;
    var estado = !c ? '' : conectado() ? '<span class="lcel-pt ok">🟢 ' + esc(g.cel || 'Celular') + ' conectado: lo que lea llega aquí</span>'
      : g.visto ? '<span class="lcel-pt">⚪ Celular emparejado: abre en él el lector (o vuelve a escanear el QR)</span>'
      : '<span class="lcel-pt">⚪ Todavía ningún celular: escanea el QR con el celular</span>';
    var h = '<button type="button" class="btn-ghost lcel-btn" data-lcel="ver" aria-expanded="' + (st.expandido ? 'true' : 'false') + '">📱 ' + (st.expandido ? 'Ocultar' : 'Usar el celular como lector') + '</button>' + estado;
    if(st.expandido){
      h += '<div class="lcel-panel"><div class="lcel-qr" id="lcelQr"></div><div class="lcel-pasos">' +
        '<b>Inalámbrico (wifi o datos)</b><ol><li>Con la cámara del celular escanea este código (o en ORDEVA del celular: «📷 Escanear»).</li>' +
        '<li>Se abre el lector en el celular: apunta a los códigos y llegan aquí solos.</li></ol>' +
        '<b>Por cable USB</b><div>Android 14 o más: conecta el celular, toca el aviso «USB» y elige <i>Cámara web</i>. Luego elígelo arriba en «📷 Cámara». (También sirven DroidCam o Iriun.)</div>' +
        '<div class="lcel-acc"><button type="button" class="btn-ghost" data-lcel="copiar">🔗 Copiar enlace</button><button type="button" class="btn-ghost" data-lcel="nuevo" title="Los celulares emparejados dejan de mandar códigos">🔄 Desconectar celulares</button></div></div></div>';
    }
    box.innerHTML = h;
    box.querySelectorAll('[data-lcel]').forEach(function(b){ b.addEventListener('click', accion); });
    if(st.expandido && c){
      var q = document.getElementById('lcelQr');
      try{ new QRCode(q, { text: enlace(c), width: 168, height: 168, correctLevel: QRCode.CorrectLevel.M }); }
      catch(e){ q.textContent = enlace(c); q.classList.add('txt'); }
    }
  }
  function accion(e){
    var a = e.currentTarget.getAttribute('data-lcel');
    if(a === 'ver'){
      st.expandido = !st.expandido;
      if(st.expandido && !guardado()){ canal(true); if(st.abierto){ escuchar(); decir(true); } }
      pintar();
    } else if(a === 'copiar'){
      var u = enlace(canal(true));
      try{ navigator.clipboard.writeText(u).then(function(){ aviso('🔗 Enlace copiado: ábrelo en el celular.'); }, function(){ prompt('Abre este enlace en el celular:', u); }); }
      catch(x){ prompt('Abre este enlace en el celular:', u); }
    } else if(a === 'nuevo'){
      if(!confirm('¿Desconectar los celulares emparejados? Dejan de mandar códigos a este equipo y hay que volver a escanear el QR nuevo.')) return;
      if(st.abierto) decir(false);
      dejar(); guardar({ c: 'lc' + azar(22) }); st.celVisto = 0;
      if(st.abierto){ escuchar(); decir(true); }
      pintar(); aviso('🔄 Listo: escanea el QR nuevo con el celular.');
    }
  }
  function aviso(t){ try{ if(typeof showToast === 'function') showToast(t, 4000); }catch(e){} }

  window.ventoLectorCel = {
    abrir: function(hint, onCode){
      st.abierto = true; st.onCode = onCode; st.hint = hint || ''; st.s = azar(8);
      var g = guardado(); st.celVisto = g && g.visto && Date.now() - g.visto < 3 * 60e3 ? g.visto : 0;
      st.expandido = false;
      if(g){ escuchar(); decir(true); }
      pintar();
    },
    cerrar: function(){
      if(!st.abierto) return;
      decir(false);
      st.abierto = false; st.onCode = null; st.vistos = {};
      dejar();
    },
    mostrar: function(si){ st.expandido = !!si; if(si && !guardado()){ canal(true); if(st.abierto){ escuchar(); decir(true); } } pintar(); },
    enlace: function(){ return enlace(canal(true)); }
  };
  // La app se cierra con «Escanear» abierto: el celular deja de mostrar «listo».
  window.addEventListener('pagehide', function(){ if(st.abierto) decir(false); });
  setInterval(function(){ if(st.abierto && !st.expandido && guardado()) pintar(); }, 30000);   // «conectado» se apaga solo si el celular se calla
})();
