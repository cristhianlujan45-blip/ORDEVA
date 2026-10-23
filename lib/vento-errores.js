/* =====================================================================
   ORDEVA · reporte de errores → ORDEVA Admin (🐞 Errores)
   Cuando algo falla en un equipo (un error de la página, la música que no suena, un pedido por QR que no llega…), se
   manda un reporte corto al servidor de ORDEVA para verlo y arreglarlo antes de que el cliente tenga que avisar.
   • Solo el error: mensaje, en qué parte de la página, la versión y el equipo (+ el nombre del negocio). Nunca ventas,
     productos, clientes, contraseñas ni el link secreto de los QR (de la dirección solo va la página, sin «#…» ni «?…»).
   • El mismo error se agrupa: se manda como mucho una vez cada 10 minutos, sumando las veces.
   • Sin internet se guarda (máx. 40) y se manda al volver la conexión.
   • Se ignora el ruido que no es de ORDEVA (extensiones del navegador, cortes de red, «Script error.» de otros sitios).
   Uso desde la app:  window.ventoError('musica', 'La cola tiene canciones pero no suena nada', { cola: 3 })
   ===================================================================== */
(function(){
  'use strict';
  if(window.ventoError) return;
  var K_PEND = 'vento-err-pend', K_EQ = 'vento-err-equipo', ESPERA = 10 * 60e3, MAX_PEND = 40;
  var TIPOS = { js: 1, promesa: 1, musica: 1, pedido: 1, pago: 1, red: 1, otro: 1 };
  var RUIDO = /ResizeObserver loop|Script error\.?$|^Script error|Non-Error promise rejection captured|chrome-extension:|moz-extension:|safari-extension:|webkit-masked-url|__gCrWeb|instantSearchSDKJSBridge|Can't find variable: (?:gmo|zaloJSV2|_AutofillCallbackHandler)|NotAllowedError: play\(\) failed|The play\(\) request was interrupted|AbortError|Failed to fetch|NetworkError|Load failed|network error|ERR_INTERNET_DISCONNECTED|cancelado|cancelled/i;
  var lsG = function(k, d){ try{ var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; }catch(e){ return d; } };
  var lsS = function(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
  function g(nombre){ try{ return (0, eval)('typeof ' + nombre + ' !== "undefined" ? ' + nombre + ' : undefined'); }catch(e){ return undefined; } }   // «let» globales de la página
  function cfg(){
    var c = null;
    try{ if(window.ventoNube && window.ventoNube.configurada && window.ventoNube.configurada()) c = window.ventoNube.config(); }catch(e){}
    if(!c || !c.url || !c.key) c = lsG('vento_nube_cfg', null);
    if(!c || !c.url || !c.key) c = window.VENTO_NUBE_DEFAULT || null;
    return c && /^https:\/\/[\w.-]+/.test(String(c.url)) && String(c.key).length > 20 ? { url: String(c.url).replace(/\/+$/, ''), key: String(c.key) } : null;
  }
  // El mismo identificador que usa ORDEVA Admin para «Equipos»; en la página de pedidos (celular del cliente) uno propio.
  function equipo(){
    var c = '';
    try{ c = localStorage.getItem('mesora-equipo') || ''; }catch(e){}
    if(!c && typeof window.codigoEquipo === 'function') try{ c = window.codigoEquipo(); }catch(e){}
    if(!/^[A-Za-z0-9_-]{6,64}$/.test(c)){
      c = lsG(K_EQ, '');
      if(!/^[A-Za-z0-9_-]{6,64}$/.test(c)){ c = 'web-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); lsS(K_EQ, c); }
    }
    return c;
  }
  function pagina(){ var p = (location.pathname || '').split('/').pop() || 'index.html'; return p.replace(/\.html$/, '').slice(0, 40) || 'index'; }
  function contexto(){
    var x = {};
    try{ if(typeof window.ventoErroresContexto === 'function') x = window.ventoErroresContexto() || {}; }catch(e){}
    var d = g('data'), u = g('authUser'), v = g('MESORA_VERSION');
    if(!x.negocio && d && d.businessName) x.negocio = String(d.businessName);
    if(!x.usuario && u) x.usuario = String(u);
    if(!x.negocio_id) try{ var n = window.ventoNube && window.ventoNube.negocio && window.ventoNube.negocio(); if(n && n.id) x.negocio_id = n.id; }catch(e){}
    if(!x.version) x.version = v ? String(v).replace(/^.*v/, '') : (window.VENTO_VERSION || '');
    return x;
  }
  // Huella: lo que identifica «el mismo error» aunque cambien números, ids o textos entre comillas.
  function normal(m){ return String(m || '').replace(/https?:\/\/\S+/g, 'URL').replace(/["'«»][^"'«»]{0,80}["'«»]/g, '«…»').replace(/\b[0-9a-f]{8,}\b/gi, 'ID').replace(/\d+/g, '#').replace(/\s+/g, ' ').trim().slice(0, 140); }
  function limpiarPila(s){ return String(s || '').split('\n').slice(0, 8).map(function(l){ return l.replace(/https?:\/\/[^\s)]*\/([^\/\s)?#]+)(?:[?#][^\s):]*)?/g, '$1').trim(); }).join('\n').slice(0, 1500); }

  // El mismo código corto que guarda la app (E-XXXX, index.html → mesoraLogError): con él el administrador encuentra el error.
  function codigo(msg){ var h = 0; msg = String(msg || '').replace(/\s+/g, ' ').slice(0, 300); for(var i = 0; i < msg.length; i++) h = (h * 31 + msg.charCodeAt(i)) | 0; var c = (Math.abs(h) % 1679616).toString(36).toUpperCase(); while(c.length < 4) c = '0' + c; return 'E-' + c; }
  var ultimoEnvio = {}, enviando = false;
  function reportar(tipo, mensaje, detalle, huella){
    try{
      tipo = TIPOS[tipo] ? tipo : 'otro';
      mensaje = String(mensaje == null ? '' : mensaje).replace(/\s+/g, ' ').trim().slice(0, 500);
      if(!mensaje) return false;
      if((tipo === 'js' || tipo === 'promesa') && (!detalle || !detalle.codigo)){ detalle = Object.assign({}, detalle || {}); detalle.codigo = codigo(mensaje); }
      if((tipo === 'js' || tipo === 'promesa') && RUIDO.test(mensaje + ' ' + (detalle && detalle.archivo || ''))) return false;
      var h = String(huella || (tipo + '|' + normal(mensaje) + (detalle && detalle.archivo ? '|' + detalle.archivo + ':' + (detalle.linea || 0) : ''))).slice(0, 200);
      var pend = lsG(K_PEND, []), x = null;
      for(var i = 0; i < pend.length; i++) if(pend[i].huella === h){ x = pend[i]; break; }
      if(x){ x.veces = (x.veces || 1) + 1; x.mensaje = mensaje; if(detalle) x.detalle = detalle; x.t = Date.now(); }
      else{ pend.push({ huella: h, tipo: tipo, mensaje: mensaje, detalle: detalle || null, veces: 1, t: Date.now(), pagina: pagina() }); if(pend.length > MAX_PEND) pend = pend.slice(-MAX_PEND); }
      lsS(K_PEND, pend);
      if(!ultimoEnvio[h] || Date.now() - ultimoEnvio[h] > ESPERA) setTimeout(enviar, 1500);
      return true;
    }catch(e){ return false; }
  }
  function enviar(){
    if(enviando || navigator.onLine === false) return;
    var c = cfg(); if(!c) return;
    var pend = lsG(K_PEND, []), ahora = Date.now();
    var listos = pend.filter(function(x){ return !ultimoEnvio[x.huella] || ahora - ultimoEnvio[x.huella] > ESPERA; }).slice(0, 10);
    if(!listos.length) return;
    enviando = true;
    var ctx = contexto(), eq = equipo(), plat = window.VentoAndroid ? 'apk' : (/Android/.test(navigator.userAgent) ? 'android' : /iPhone|iPad/.test(navigator.userAgent) ? 'iphone' : 'web');
    var modelo = String(navigator.userAgent || '').replace(/^Mozilla\/5\.0 /, '').slice(0, 110);
    var fetchN = (window.ventoCanal && window.__ventoFetchNativo) || window.fetch;
    var uno = function(i){
      if(i >= listos.length){ enviando = false; return; }
      var x = listos[i];
      var p = { equipo: eq, tipo: x.tipo, mensaje: x.mensaje, huella: x.huella, veces: x.veces || 1, detalle: x.detalle || undefined, pagina: x.pagina || pagina(),
        negocio: ctx.negocio || '', negocio_id: ctx.negocio_id || null, usuario: ctx.usuario || '', version: ctx.version || '', plataforma: plat, modelo: modelo };
      fetchN.call(window, c.url + '/rest/v1/rpc/reportar_error', { method: 'POST', headers: { apikey: c.key, Authorization: 'Bearer ' + c.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ p: p }), keepalive: true })
        .then(function(r){
          if(!r.ok && r.status !== 400) throw new Error('http ' + r.status);
          ultimoEnvio[x.huella] = Date.now();
          // Se quita de pendientes (si mientras tanto pasó otra vez, queda con las veces nuevas).
          var l = lsG(K_PEND, []), y = null; for(var k = 0; k < l.length; k++) if(l[k].huella === x.huella){ y = l[k]; break; }
          if(y){ var resto = (y.veces || 1) - (x.veces || 1); if(resto > 0){ y.veces = resto; } else l.splice(k, 1); lsS(K_PEND, l); }
          uno(i + 1);
        })
        .catch(function(){ enviando = false; });      // sin red: se reintenta después
    };
    uno(0);
  }

  window.addEventListener('error', function(ev){
    try{
      if(!ev || ev.target && ev.target !== window && ev.target.tagName) return;   // una imagen o un script que no cargó: no es un error de ORDEVA
      var arch = String(ev.filename || '');
      if(arch && !/^https?:/.test(arch)) return;
      if(arch){ try{ var u = new URL(arch); if(u.origin !== location.origin) return; arch = u.pathname.split('/').pop() || 'index.html'; }catch(e){} }
      reportar('js', ev.message || (ev.error && ev.error.message) || 'Error', { archivo: arch || pagina() + '.html', linea: ev.lineno || 0, columna: ev.colno || 0, pila: limpiarPila(ev.error && ev.error.stack) });
    }catch(e){}
  });
  window.addEventListener('unhandledrejection', function(ev){
    try{
      var r = ev && ev.reason, m = r && (r.message || (typeof r === 'string' ? r : '')) || '';
      if(!m || RUIDO.test(m)) return;
      reportar('promesa', m, { pila: limpiarPila(r && r.stack) });
    }catch(e){}
  });
  window.addEventListener('online', function(){ setTimeout(enviar, 2000); });
  setInterval(enviar, 60e3);
  setTimeout(enviar, 8000);

  window.ventoError = reportar;
  window.ventoServidorCfg = cfg;   // la misma conexión al servidor (p. ej. para las frases de pago del administrador)
  window.ventoErrores = { pendientes: function(){ return lsG(K_PEND, []); }, enviar: enviar, equipo: equipo, _normal: normal };
})();
