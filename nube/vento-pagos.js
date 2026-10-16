/* =====================================================================
   Vento · Pagos con Nequi y DaviPlata (lado de la app)

   Núcleo:  Nequi / DaviPlata → integración autorizada (Wompi, Nequi Conecta o la API Pago con DaviPlata) → Servidor Vento
            (Supabase Edge Function «vento-pagos») → base de datos → esta app → celulares autorizados.

   Esta parte:
   • Ajustes → 💜 Pagos: estado de Nequi y DaviPlata, asistente «Conectar», comprobaciones automáticas,
     URL de eventos, celulares autorizados, historial y avisos del celular (auxiliar).
   • Cuenta/mesa → «💜 Cobrar Nequi / DaviPlata»: link/QR de Wompi, cobro push o QR de Nequi, con el
     estado en vivo, o «DaviPlata con código» (API oficial: le llega un código al celular del cliente y la caja
     lo confirma). Cuando se aprueba, se registra solo en la cuenta (una sola vez aunque haya varios celulares).
   • Registro del celular (id + token seguro), latido, notificaciones push con la app cerrada.
   • Tiempo real (Supabase Realtime) + sincronización al reconectarse (los pagos quedan en el servidor).
   Sin Vento Nube configurada no hace nada: Vento sigue funcionando igual.
   ===================================================================== */
(function(){
  'use strict';
  var K_DEV = 'vento_pagos_dev', K_VISTO = 'vento_pagos_visto', K_CACHE = 'vento_pagos_cache';
  var plata = function(n){ return '$' + Math.round(n || 0).toLocaleString('es-CO'); };
  var esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function lsGet(k, d){ try{ var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; }catch(e){ return d; } }
  function lsSet(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
  function toast(t, ms){ try{ window.showToast && window.showToast(t, ms || 5000); }catch(e){} }
  function hablar(t){ try{ (window.ventoHablar || window.speakVoice || function(){})(t); }catch(e){} }
  // Los avisos de PAGOS con la voz de los pagos (su volumen propio; en la app Android, aunque esté minimizada).
  function hablarPago(t){ try{ if(window.ventoDecirPago) return window.ventoDecirPago(t); }catch(e){} hablar(t); }
  function nube(){ return window.ventoNube || null; }
  function negocio(){ var n = nube(); return n && n.negocio ? n.negocio() : null; }
  function etiquetaMesa(m){ try{ return window.tableLabel ? window.tableLabel(m) : 'Mesa ' + m; }catch(e){ return 'Mesa ' + m; } }
  var METODO = { NEQUI: 'Nequi', DAVIPLATA: 'DaviPlata', CARD: 'Tarjeta', PSE: 'PSE', BANCOLOMBIA_TRANSFER: 'Bancolombia', BANCOLOMBIA_QR: 'QR Bancolombia', BANCOLOMBIA: 'Bancolombia', TRANSFERENCIA: 'Transferencia', 'BRE-B': 'Bre-B' };
  var nombreMetodo = function(m){ return METODO[String(m || '').toUpperCase()] || (m ? String(m).charAt(0) + String(m).slice(1).toLowerCase() : 'Pago digital'); };
  // Quién verificó el pago (para los textos).
  var entidad = function(p, largo){ return p.proveedor === 'nequi' ? (largo ? 'Nequi Conecta' : 'Nequi') : p.proveedor === 'daviplata' ? 'DaviPlata' : 'Wompi'; };
  // Explicación de un cobro que no se pagó (DaviPlata deja el motivo final en «detalle»).
  var nota = function(x){ return x.proveedor === 'daviplata' ? (x.detalle || x.ultimo_error) : (x.ultimo_error || x.detalle); };
  var ESTADO = { pendiente: '⏳ Esperando el pago', aprobado: '✅ Pagado', rechazado: '❌ Rechazado', anulado: '↩️ Anulado', error: '⚠️ Error', vencido: '⌛ Venció' };
  // DaviPlata no respondió y no se sabe si cobró: nunca se muestra como un simple «Error» (el cajero cobraría otra vez).
  var etiqueta = function(p){ return p.incierto && p.estado === 'error' ? '⚠️ Sin confirmar: revisa con el cliente' : (ESTADO[p.estado] || esc(p.estado)); };

  // ---------- Conexión con el servidor ----------
  var est = { servidor: null, version: null, resumen: null, info: null, dev: null, canal: null, ultimoSync: 0, revisando: false };
  function base(){ var c = nube().config(); return c.url.replace(/\/+$/, '') + '/functions/v1/vento-pagos'; }
  function sesion(){
    return nube().cliente().then(function(c){ return c.auth.getSession().then(function(r){ return { c: c, token: r && r.data && r.data.session ? r.data.session.access_token : null }; }); });
  }
  function api(ruta, cuerpo){
    return sesion().then(function(s){
      if(!s.token) throw Object.assign(new Error('Entra a Vento Nube para usar los pagos.'), { codigo: 'sin_sesion' });
      return fetch(base() + '/' + ruta, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: nube().config().key, Authorization: 'Bearer ' + s.token }, body: JSON.stringify(cuerpo || {}) });
    }).then(function(r){
      return r.json().catch(function(){ return {}; }).then(function(j){
        if(!r.ok) throw Object.assign(new Error(j.mensaje || ('El servidor respondió ' + r.status)), { codigo: j.error || ('http_' + r.status), status: r.status });
        return j;
      });
    });
  }
  function rpc(fn, args){ return nube().cliente().then(function(c){ return c.rpc(fn, args || {}); }).then(function(r){ if(r.error) throw r.error; return r.data; }); }
  function salud(){
    if(!nube() || !nube().configurada()) return Promise.resolve(false);
    var ctrl = window.AbortController ? new AbortController() : null, t = setTimeout(function(){ ctrl && ctrl.abort(); }, 8000);
    return fetch(base() + '/salud', ctrl ? { signal: ctrl.signal } : {}).then(function(r){ clearTimeout(t); return r.ok ? r.json() : null; })
      .then(function(j){ est.servidor = !!(j && j.ok); est.version = j && j.version; return est.servidor; })
      .catch(function(){ clearTimeout(t); est.servidor = false; return false; });
  }

  // ---------- Este celular ----------
  function plataforma(){ var u = navigator.userAgent || ''; return /iPhone|iPad/.test(u) ? 'iPhone' : /Android/.test(u) ? 'Android' : /Windows/.test(u) ? 'Windows' : /Mac/.test(u) ? 'Mac' : 'Navegador'; }
  function nombreRol(r){ return ({ dueno: 'Dueño', admin: 'Administrador', cajero: 'Caja', mesero: 'Mesero', empleado: (window.ventoRolNombre ? window.ventoRolNombre('empleado') : 'Empleado') })[r] || 'Celular'; }
  function miDispositivo(){ var n = negocio(), d = lsGet(K_DEV, null); return n && d && d.negocio === n.id ? d : null; }
  function registrarDispositivo(forzar){
    var n = negocio(); if(!n) return Promise.resolve(null);
    var d = miDispositivo();
    if(d && !forzar) return Promise.resolve(d);
    return rpc('registrar_dispositivo', { p_negocio: n.id, p_nombre: nombreRol(n.rol) + ' · ' + plataforma(), p_plataforma: (navigator.userAgent || '').slice(0, 120), p_dispositivo: d ? d.id : null })
      .then(function(r){ var nd = { negocio: n.id, id: r.id, token: r.token, desde: Date.now() }; lsSet(K_DEV, nd); est.dev = nd; return nd; });
  }
  function latido(push){
    var d = miDispositivo(); if(!d) return Promise.resolve(false);
    return rpc('latido_dispositivo', { p_dispositivo: d.id, p_push: push || null }).then(function(ok){
      if(ok === false){ est.revocado = true; }   // lo retiró el dueño: se vuelve a autorizar desde Ajustes → Pagos
      return ok;
    }).catch(function(){ return null; });
  }

  // ---------- Notificaciones con la app cerrada (Web Push) ----------
  function pushSoportado(){ return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
  function b64aBytes(s){ var t = s.replace(/-/g, '+').replace(/_/g, '/'); t += '==='.slice((t.length + 3) % 4); var b = atob(t), u = new Uint8Array(b.length); for(var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function activarPush(){
    if(!pushSoportado()) return Promise.reject(new Error('Este navegador no permite notificaciones push. En iPhone, primero agrega Vento a la pantalla de inicio.'));
    return Notification.requestPermission().then(function(p){
      if(p !== 'granted') throw new Error('No diste permiso de notificaciones. Actívalo en los ajustes del navegador para este sitio.');
      return navigator.serviceWorker.register('sw.js');
    }).then(function(reg){ return navigator.serviceWorker.ready.then(function(){ return reg; }); })
      .then(function(reg){
        return fetch(base() + '/push-clave').then(function(r){ return r.json(); }).then(function(j){
          return reg.pushManager.getSubscription().then(function(s){ return s || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64aBytes(j.publica) }); });
        });
      }).then(function(sus){ return registrarDispositivo(false).then(function(){ return latido(sus.toJSON()); }); })
      .then(function(){ lsSet('vento_pagos_push', true); return true; });
  }
  function pushActivo(){ return !!lsGet('vento_pagos_push', false) && pushSoportado() && Notification.permission === 'granted'; }

  // ---------- Pagos que llegan del servidor ----------
  var cache = lsGet(K_CACHE, {});          // id → pago (últimos 150)
  var oyentes = [];                        // ventanas de cobro abiertas
  function guardarCache(){ var ks = Object.keys(cache); if(ks.length > 150){ ks.sort(function(a, b){ return String(cache[a].actualizado_en).localeCompare(String(cache[b].actualizado_en)); }).slice(0, ks.length - 150).forEach(function(k){ delete cache[k]; }); } lsSet(K_CACHE, cache); }
  function puedeCaja(){ var n = negocio(); return n && ['dueno', 'admin', 'cajero'].indexOf(n.rol) >= 0; }

  function regLocal(p){
    if(typeof data === 'undefined' || !data) return null;
    if(!data.pagos) data.pagos = { on: false, topic: '', lista: [], vistos: [], espera: {} };
    var g = data.pagos; g.lista = g.lista || [];
    var id = 'srv-' + p.id, x = g.lista.find(function(y){ return y.id === id || y.srv === p.id; });
    // Un aviso que este mismo celular ya leyó por MacroDroid (y reenvió al servidor) no se duplica: se enlaza.
    if(!x && p.proveedor === 'dispositivo'){
      var tp = Date.parse(p.creado_en || p.actualizado_en) || Date.now();
      x = g.lista.find(function(y){ return !y.srv && Number(y.monto) === Number(p.monto) && Math.abs((y.t || 0) - tp) < 3 * 60e3 && String(y.app || '').toUpperCase().replace('TRANSFERENCIA', '') === String(nombreMetodo(p.metodo)).toUpperCase().replace('TRANSFERENCIA', ''); });
      if(x){ x.srv = p.id; x._yaAvisado = true; return x; }
    }
    var fuente = p.verificado ? 'Verificado por ' + entidad(p, true) + (p.aprobacion ? ' · N.º ' + p.aprobacion : '') : (p.detalle || 'Aviso del celular');
    if(!x){
      x = { id: id, srv: p.id, t: Date.parse(p.aprobado_en || p.actualizado_en || p.creado_en) || Date.now(), monto: Number(p.monto), app: nombreMetodo(p.metodo), de: p.pagador || '', mesa: p.mesa ? (isNaN(+p.mesa) ? p.mesa : +p.mesa) : null,
        estado: p.confianza === 'revisar' ? 'revisar' : p.confianza === 'falso' ? 'falso' : 'app', fuente: fuente, txt: (p.referencia || '').slice(0, 60) };
      g.lista.unshift(x); g.lista = g.lista.slice(0, 200);
    } else if(x.estado === 'revisar' && p.confianza === 'ok'){ x.estado = 'ok'; }
    if(p.aplicado_en && !x.aplicado) x.aplicado = p.aplicado_mesa ? (isNaN(+p.aplicado_mesa) ? p.aplicado_mesa : +p.aplicado_mesa) : true;
    if(p.estado === 'anulado') x.estado = 'falso', x.fuente = 'Anulado por ' + entidad(p);
    return x;
  }

  // App Android: aviso del celular con sonido aunque Vento esté cerrada o la pantalla apagada (en el navegador
  // eso lo hace el push). Si la ventana de Vento se está viendo, no hace falta (ya sale en pantalla).
  function avisoCelular(titulo, texto){ try{ window.VentoAndroid && window.VentoAndroid.notificar && window.VentoAndroid.notificar(titulo, texto, 'pedidos', false); }catch(e){} }
  // ¿Este aviso es para quien usa este celular? Solo el dueño, los administradores y quien está cobrando o atiende esa
  // mesa (mesero, empleado o cajero). A los demás no les sale ni les suena (antes les llegaba a todos repetido).
  function paraMi(p, x){
    try{ return !window.ventoPagoParaMi || window.ventoPagoParaMi(Number(p.monto), p.mesa || p.aplicado_mesa || (x && x.mesa) || null); }catch(e){ return true; }
  }
  function avisar(p, x){
    if(!paraMi(p, x)) return;
    var m = (p.mesa ? ' · ' + etiquetaMesa(p.mesa) : '');
    avisoCelular(p.confianza === 'falso' ? '🚨 Pago FALSO' : p.confianza === 'revisar' ? '⚠️ Pago por revisar' : '✅ Pago confirmado',
      plata(p.monto) + ' por ' + nombreMetodo(p.metodo) + (p.pagador ? ' de ' + p.pagador : '') + m + (p.verificado ? ' · ✅ verificado' + (p.aprobacion ? ' (N.º ' + p.aprobacion + ')' : '') : ''));
    if(p.confianza === 'falso'){
      toast('🚨 OJO, PAGO FALSO: ' + plata(p.monto) + '. ' + (p.detalle || 'No entregues nada.'), 15000);
      hablarPago('Ojo. Llegó un mensaje de pago sospechoso por ' + p.monto + ' pesos. Parece falso.');
      try{ navigator.vibrate && navigator.vibrate([500, 150, 500]); }catch(e){}
      return;
    }
    if(p.confianza === 'revisar'){
      toast('⚠️ ' + nombreMetodo(p.metodo) + ': ' + plata(p.monto) + (p.pagador ? ' de ' + p.pagador : '') + m + '. ' + (p.detalle || 'Confírmalo en la app del banco.'), 12000);
      return;
    }
    // Como el parlante de Bold: sonido de éxito y «Pago confirmado» en voz alta.
    toast('✅ Pago confirmado · ' + plata(p.monto) + ' por ' + nombreMetodo(p.metodo) + (p.pagador ? ' de ' + p.pagador : '') + m + (p.aprobacion ? ' · N.º ' + p.aprobacion : ''), 9000);
    try{ window.ventoSonidos && window.ventoSonidos.success(); }catch(e){}
    hablarPago('Recibiste ' + p.monto + ' pesos por ' + nombreMetodo(p.metodo) + (p.pagador ? ', de ' + p.pagador : '') + (p.mesa ? ', de la ' + etiquetaMesa(p.mesa) : ''));
    try{ navigator.vibrate && navigator.vibrate([150, 80, 150]); }catch(e){}
    try{ window.mesoraCelebrar && window.mesoraCelebrar(['💜', '💰', '✨']); }catch(e){}
  }

  // Registrar en la cuenta: el servidor decide quién lo hace (aplicar_pago devuelve true a UN solo celular).
  function aplicarEnMesa(p, x, mesa){
    var d = miDispositivo();
    return rpc('aplicar_pago', { p_pago: p.id, p_mesa: String(mesa), p_dispositivo: d ? d.id : null }).then(function(gane){
      if(!gane){ x.aplicado = x.aplicado || mesa; try{ saveData(); }catch(e){} return false; }
      var msg = window.pagoRegistrar ? window.pagoRegistrar(x, mesa) : null;
      if(msg) toast(msg, 7000);
      return true;
    }).catch(function(e){ toast('No se pudo registrar el pago en la cuenta: ' + (e.message || e), 8000); return false; });
  }

  function recibir(p, enVivo){
    if(!p || !p.id) return;
    var antes = cache[p.id];
    cache[p.id] = Object.assign({}, antes || {}, p); guardarCache();
    oyentes.forEach(function(f){ try{ f(cache[p.id]); }catch(e){} });
    var nuevoAprobado = p.estado === 'aprobado' && (!antes || antes.estado !== 'aprobado');
    if(p.estado !== 'aprobado' && !(p.estado === 'rechazado' && p.confianza === 'falso') && p.estado !== 'anulado') { pintarHistorial(); return; }
    var x = regLocal(p); if(!x){ return; }
    try{ saveData(); }catch(e){}
    if(nuevoAprobado && enVivo && !x._yaAvisado) avisar(p, x);
    else if(p.estado === 'rechazado' && p.confianza === 'falso' && !antes && enVivo) avisar(p, x);
    pintarHistorial();
    try{ window.layaPintarTarjeta && window.layaPintarTarjeta(); }catch(e){}
    if(p.estado !== 'aprobado' || p.aplicado_en || p.confianza === 'falso' || p.confianza === 'revisar' || !puedeCaja()) return;
    var mesa = p.mesa && data.tables && data.tables[p.mesa] ? p.mesa : null;
    if(mesa) aplicarEnMesa(p, x, isNaN(+mesa) ? mesa : +mesa);
    else if(nuevoAprobado && enVivo && !x._yaAvisado && paraMi(p, x)){ try{ window.pagoLlego && window.pagoLlego(x); }catch(e){} }
  }

  // Los avisos que llegan por MacroDroid (canal privado de Vento) también se mandan al Servidor Vento:
  // quedan guardados en la nube, se cruzan entre celulares sin duplicarse y avisan con push aunque Vento esté cerrada.
  // Con el ID del aviso: así dos pagos iguales seguidos (mismo valor y persona) llegan como DOS a los demás celulares.
  window.ventoPagosReenviarAviso = function(txt, id){
    var d = miDispositivo();
    if(!d || !est.servidor || !puedeCaja() || !txt) return;
    var cuerpo = id ? JSON.stringify({ text: String(txt).slice(0, 1000), id: String(id).slice(0, 160) }) : String(txt).slice(0, 1000);
    try{ fetch(base() + '/aviso/' + d.token, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: cuerpo, keepalive: true }).catch(function(){}); }catch(e){}
  };

  // Al registrar a mano desde «Llegó un pago», el servidor también lo marca (y otro celular ya no lo repite).
  window.ventoPagosAntesDeRegistrar = function(x, mesa){
    if(!x || !x.srv || !negocio()) return Promise.resolve(true);
    var d = miDispositivo();
    return rpc('aplicar_pago', { p_pago: x.srv, p_mesa: String(mesa), p_dispositivo: d ? d.id : null }).catch(function(){ return true; });
  };

  function sincronizar(){
    var n = negocio(); if(!n || est.revisando) return Promise.resolve();
    est.revisando = true;
    var desde = lsGet(K_VISTO, {})[n.id] || null;
    return rpc('pagos_desde', { p_negocio: n.id, p_desde: desde, p_limite: 200 }).then(function(l){
      var max = desde;
      (l || []).forEach(function(p){ recibir(p, !!desde && Date.parse(p.actualizado_en) > Date.now() - 15 * 60e3); if(!max || p.actualizado_en > max) max = p.actualizado_en; });
      var v = lsGet(K_VISTO, {}); v[n.id] = max || new Date(Date.now() - 2 * 864e5).toISOString(); lsSet(K_VISTO, v);
      est.ultimoSync = Date.now();
    }).catch(function(){}).then(function(){ est.revisando = false; });
  }

  function conectarTiempoReal(){
    var n = negocio(); if(!n || est.canal) return;
    nube().cliente().then(function(c){
      if(!c.channel) return;
      var canal = c.channel('vento-pagos-' + n.id), cerrado = false;
      est.canal = canal
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pagos', filter: 'negocio_id=eq.' + n.id }, function(ev){
          var p = ev && ev.new; if(!p || !p.id) return;
          recibir(p, true);
          var v = lsGet(K_VISTO, {}); if(!v[n.id] || p.actualizado_en > v[n.id]){ v[n.id] = p.actualizado_en; lsSet(K_VISTO, v); }
        })
        .subscribe(function(s){
          est.vivo = s === 'SUBSCRIBED';
          if(cerrado || !(s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED')) return;
          // Una sola vez: quitar el canal vuelve a avisar «CLOSED» y antes esto se llamaba a sí mismo hasta reventar
          // la pila («Maximum call stack size exceeded») cada vez que se caía el tiempo real.
          cerrado = true;
          if(est.canal === canal) est.canal = null;
          try{ Promise.resolve(c.removeChannel(canal)).catch(function(){}); }catch(e){}
          setTimeout(conectarTiempoReal, 15000);
        });
    }).catch(function(){});
  }

  // Mientras haya cobros esperando, le pide al servidor que consulte a Wompi/Nequi (además del webhook).
  function hayPendientes(){ return Object.keys(cache).some(function(k){ var p = cache[k]; return p.estado === 'pendiente' && Date.now() - Date.parse(p.creado_en || 0) < 45 * 60e3; }); }
  function vigilar(){
    var n = negocio(); if(!n || !est.servidor || document.hidden) return;
    if(hayPendientes()) api('sync', { negocio: n.id }).then(function(){ return sincronizar(); }).catch(function(){});
    else if(!est.vivo && Date.now() - est.ultimoSync > 20000) sincronizar();
  }

  function arrancar(){
    if(!negocio()) return;
    salud().then(function(ok){
      registrarDispositivo(false).then(function(){ return latido(null); }).catch(function(){});
      sincronizar().then(conectarTiempoReal);
      if(ok) crearBotonCuenta();
    });
  }
  setInterval(vigilar, 10000);
  setInterval(function(){ if(negocio()) latido(null); }, 5 * 60e3);
  window.addEventListener('online', function(){ if(negocio()){ sincronizar(); conectarTiempoReal(); } });
  document.addEventListener('visibilitychange', function(){ if(!document.hidden && negocio()) sincronizar(); });
  var espera = setInterval(function(){ if(typeof data !== 'undefined' && data && nube()){ clearInterval(espera); if(negocio()) arrancar(); else setInterval(function(){ if(negocio() && !est.dev && !miDispositivo()) arrancar(); }, 20000); } }, 1500);

  // ---------- Estilos ----------
  var st = document.createElement('style');
  st.textContent =
    '.vp-cards{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:8px 0}@media(max-width:420px){.vp-cards{grid-template-columns:1fr}}' +
    '.vp-card{border:1px solid var(--line);border-radius:16px;padding:14px;background:var(--surface-2,transparent)}' +
    '.vp-card h3{margin:0 0 6px;font-size:15px;letter-spacing:.06em}.vp-card .vp-st{font-weight:800;font-size:15px}.vp-card small{display:block;color:var(--ink-soft);margin-top:4px;line-height:1.35}' +
    '.vp-ok{color:#22c55e}.vp-pend{color:#f5a524}.vp-mal{color:#e5484d}' +
    '.vp-checks{list-style:none;padding:0;margin:8px 0;font-size:14px;line-height:1.7}.vp-checks li{display:flex;gap:8px;align-items:flex-start}' +
    '.vp-form label{display:block;font-size:13px;color:var(--ink-soft);margin:10px 0 4px}.vp-form input,.vp-form select{width:100%;box-sizing:border-box}' +
    '.vp-hist{font-size:14px}.vp-hist div{display:flex;gap:8px;justify-content:space-between;padding:7px 0;border-top:1px solid var(--line)}.vp-hist small{display:block;color:var(--ink-soft)}' +
    '.vp-url{width:100%;box-sizing:border-box;font-size:12px}' +
    '.vp-guia{border:1px solid color-mix(in srgb,#8b5cf6 55%,transparent);border-radius:14px;padding:10px 12px;margin:10px 0;font-size:14px;line-height:1.5}.vp-guia button{display:block;width:100%;margin-top:8px}' +
    '.vp-modal{max-width:440px;width:100%}.vp-opc{display:grid;gap:8px;margin:10px 0}.vp-opc button{text-align:left;padding:12px 14px;border-radius:14px;border:1px solid var(--line);background:var(--surface-2,transparent);color:inherit;font:600 15px var(--font-main);cursor:pointer}.vp-opc button small{display:block;font-weight:400;color:var(--ink-soft);margin-top:2px}' +
    '.vp-qr{display:grid;place-items:center;margin:12px auto;background:#fff;padding:12px;border-radius:16px;width:max-content;max-width:100%}' +
    '.vp-monto{font:800 34px/1.2 var(--font-main);text-align:center;margin:6px 0}.vp-estado{text-align:center;font-weight:800;font-size:17px;margin:10px 0}' +
    '.vp-btn-cuenta{width:100%;margin:8px 0 4px;padding:12px;border-radius:14px;border:1px solid #7c3aed;background:color-mix(in srgb,#7c3aed 14%,transparent);color:inherit;font:700 15px var(--font-main);cursor:pointer}' +
    '.vp-opc[hidden]{display:none}.vp-nw{white-space:nowrap}' +
    '.vp-doc{display:grid;grid-template-columns:96px 1fr;gap:8px}.vp-doc select,.vp-doc input{font-size:18px;min-height:48px}' +
    '.vp-grande{width:100%;min-height:52px;margin-top:12px;font-size:16px}' +
    '.vp-otp{width:100%;box-sizing:border-box;font:800 34px/1.2 ui-monospace,monospace;letter-spacing:.35em;text-align:center;padding:12px 6px;min-height:64px}' +
    '.vp-prueba{margin:10px 0 0;padding:10px 12px;border-radius:12px;border:1px dashed #f5a524;font-size:14px;display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap}' +
    '.vp-form input[type=file]{font-size:13px}.vp-ayuda{display:block;color:var(--ink-soft);font-size:12px;margin-top:3px}' +
    '@keyframes vpGira{to{transform:rotate(360deg)}}.vp-gira{display:inline-block;animation:vpGira 1.2s linear infinite}';
  document.head.appendChild(st);

  // ---------- Ventanas ----------
  function ventana(id){
    var ov = document.getElementById(id);
    if(!ov){ ov = document.createElement('div'); ov.id = id; ov.className = 'overlay'; ov.setAttribute('data-novocab', ''); document.body.appendChild(ov);
      ov.addEventListener('click', function(e){ if(e.target === ov) cerrarVentana(ov); }); }
    return ov;
  }
  function cerrarVentana(ov){ ov.classList.remove('show'); if(ov._fin) try{ ov._fin(); }catch(e){} ov._fin = null; }

  // ---------- Cobrar desde la cuenta ----------
  function saldoMesa(id){ try{ return Math.max(0, tableTotal(id) - tablePaid(id)); }catch(e){ return 0; } }
  window.ventoPagosCobrar = function(mesa, monto){
    var n = negocio(); if(!n) return toast('Conecta Vento Nube y los pagos en Ajustes → 💜 Pagos.');
    var r = est.resumen || {}, por = function(x, v){ return !!(x && x.via && x.via.indexOf(v) >= 0); };
    var wompi = por(r.nequi, 'Wompi') || por(r.daviplata, 'Wompi');
    var nequiDirecto = por(r.nequi, 'Nequi Conecta'), daviApi = por(r.daviplata, 'API DaviPlata');
    var ov = ventana('vpCobroOv');
    monto = Math.round(monto != null ? monto : (mesa != null ? saldoMesa(mesa) : 0));
    ov.innerHTML = '<div class="modal vp-modal"><h2>💜 Cobrar con Nequi o DaviPlata</h2>' +
      '<label style="display:block;font-size:13px;color:var(--ink-soft)">Valor a cobrar' + (mesa != null ? ' · ' + esc(etiquetaMesa(mesa)) : '') + '</label>' +
      '<input id="vpMonto" class="mz-in" type="number" min="100" step="100" inputmode="numeric" value="' + (monto || '') + '" style="width:100%;font-size:22px;font-weight:800">' +
      '<div class="vp-opc">' +
      (wompi ? '<button type="button" data-c="link">🔗 Link / QR de pago<small>El cliente escanea y paga con Nequi, DaviPlata, tarjeta o PSE (Wompi).</small></button>' : '') +
      (nequiDirecto ? '<button type="button" data-c="push">📲 Cobro a su Nequi<small>Le llega una notificación al celular del cliente para aprobar.</small></button>' +
        '<button type="button" data-c="qr">🔳 QR de Nequi<small>El cliente lo escanea desde su app Nequi.</small></button>' : '') +
      (daviApi ? '<button type="button" data-c="otp">🔐 DaviPlata con código<small>Con su documento: le llega un código al celular y tú lo escribes aquí.</small></button>' : '') +
      (!wompi && !nequiDirecto && !daviApi ? '<div class="modal-sub">Todavía no hay una integración conectada. Ve a <b>Ajustes → 💜 Pagos</b> y toca «Conectar Nequi» o «Conectar DaviPlata».</div>' : '') +
      '</div><div id="vpCobroRes"></div><div class="modal-actions"><button type="button" class="btn-close" id="vpCobroX">Cerrar</button></div></div>';
    ov.classList.add('show');
    ov.querySelector('#vpCobroX').onclick = function(){ cerrarVentana(ov); };
    var clave = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    ov.querySelectorAll('[data-c]').forEach(function(b){ b.onclick = function(){
      var canal = b.dataset.c, valor = Math.round(+ov.querySelector('#vpMonto').value || 0);
      if(valor < 100) return toast('Escribe el valor a cobrar.');
      if(canal === 'otp') return cobroDavi(ov, n, mesa, valor);
      var tel = null;
      if(canal === 'push'){ tel = (prompt('Celular Nequi del cliente (10 dígitos):') || '').replace(/\D/g, ''); if(!/^3\d{9}$/.test(tel)) return toast('El celular debe tener 10 dígitos y empezar por 3.'); }
      var res = ov.querySelector('#vpCobroRes');
      res.innerHTML = '<div class="vp-estado"><span class="vp-gira">⏳</span> Creando el cobro…</div>';
      ov.querySelectorAll('[data-c]').forEach(function(x){ x.disabled = true; });
      try{ if(mesa != null && window.ventoAtiende) window.ventoAtiende.marcar(mesa, 'cobro'); }catch(e){}   // quien cobra esta mesa recibe el aviso del pago
      api('cobro', { negocio: n.id, canal: canal, monto: valor, mesa: mesa != null ? String(mesa) : null, telefono: tel, clave: clave + canal })
        .then(function(j){ recibir(j.pago, false); mostrarCobro(ov, j.pago); })
        .catch(function(e){ res.innerHTML = '<div class="vp-estado vp-mal">⚠️ ' + esc(e.message) + '</div>'; ov.querySelectorAll('[data-c]').forEach(function(x){ x.disabled = false; }); });
    }; });
  };
  function mostrarCobro(ov, p){
    var res = ov.querySelector('#vpCobroRes'); ov.querySelector('.vp-opc').hidden = true;
    var pintar = function(x){
      var html = '<div class="vp-monto">' + plata(x.monto) + '</div>';
      if(x.estado === 'pendiente'){
        if(x.canal === 'link' && x.url) html += '<div class="vp-qr" id="vpQr"></div><div class="mz-actions" style="justify-content:center;flex-wrap:wrap"><button type="button" class="btn-ghost" id="vpCopiar">📋 Copiar link</button><a class="btn-ghost" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent('Paga aquí con Nequi o DaviPlata: ' + x.url) + '">WhatsApp</a></div>';
        if(x.canal === 'qr' && x.qr) html += '<div class="vp-qr" id="vpQr"></div><div class="modal-sub" style="text-align:center">Escanéalo desde la app Nequi.</div>';
        if(x.canal === 'push') html += '<div class="modal-sub" style="text-align:center">Le llegó una notificación a su Nequi (' + esc(x.telefono || '') + '). Debe aprobarla en su celular.</div>';
        html += '<div class="vp-estado"><span class="vp-gira">⏳</span> Esperando el pago…</div><div class="modal-sub" style="text-align:center">Se registra solo en la cuenta cuando Nequi/DaviPlata lo confirmen.</div>';
      } else if(x.estado === 'aprobado' && x.proveedor === 'daviplata'){
        html += '<div class="vp-estado vp-ok" id="vpAprobado">✅ Pago aprobado' + (x.aprobacion ? ' · N.º de aprobación ' + esc(x.aprobacion) : '') + '</div>' +
          '<div class="modal-sub" style="text-align:center">DaviPlata' + (x.documento ? ' · <span class="vp-nw">' + esc(x.documento) + '</span>' : '') + '. ' + (!x.mesa ? '' : puedeCaja() ? 'Quedó registrado en la cuenta.' : 'La caja lo registra en la cuenta.') + '</div>';
      } else {
        html += '<div class="vp-estado ' + (x.estado === 'aprobado' ? 'vp-ok' : 'vp-mal') + '">' + etiqueta(x) + (x.estado === 'aprobado' ? ' · ' + esc(nombreMetodo(x.metodo)) + (x.pagador ? ' · ' + esc(x.pagador) : '') : '') + '</div>' +
          (x.estado === 'aprobado' ? '<div class="modal-sub" style="text-align:center">✅ Verificado por ' + entidad(x) + '. Quedó registrado en la cuenta.</div>' : nota(x) ? '<div class="modal-sub" style="text-align:center">' + esc(nota(x)) + '</div>' : '');
      }
      res.innerHTML = html;
      var q = res.querySelector('#vpQr');
      if(q && window.QRCode) try{ new QRCode(q, { text: x.canal === 'qr' ? x.qr : x.url, width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M }); }catch(e){ q.textContent = 'No se pudo dibujar el QR.'; }
      var cp = res.querySelector('#vpCopiar'); if(cp) cp.onclick = function(){ try{ navigator.clipboard.writeText(x.url); toast('📋 Link copiado.'); }catch(e){ prompt('Copia el link:', x.url); } };
      if(x.estado === 'aprobado'){ try{ window.mesoraCelebrar && window.mesoraCelebrar(['💜', '✅', '✨']); }catch(e){} }
    };
    pintar(p);
    var oye = function(x){ if(x.id === p.id && (x.estado !== p.estado)){ p = x; pintar(x); } };
    oyentes.push(oye);
    ov._fin = function(){ oyentes = oyentes.filter(function(f){ return f !== oye; }); };
  }

  // ---------- DaviPlata con código (API oficial de Davivienda) ----------
  // 1) documento del cliente → «Enviar código» (DaviPlata le manda un código por mensaje a su celular)
  // 2) la caja escribe el código → «Confirmar pago» → «Aprobado» (no hay aviso aparte: esta respuesta ES la confirmación).
  function cobroDavi(ov, n, mesa, valor){
    var res = ov.querySelector('#vpCobroRes'); ov.querySelector('.vp-opc').hidden = true;
    var q = function(id){ return ov.querySelector('#' + id); };
    if(q('vpMonto')) q('vpMonto').disabled = true;   // el valor ya quedó fijo para este cobro
    var intento = 0, base = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    res.innerHTML = '<div class="vp-form" id="vpDaviF"><div class="vp-monto">' + plata(valor) + '</div>' +
      '<label for="vpDnum">Documento del cliente (el de su DaviPlata)</label>' +
      '<div class="vp-doc"><select class="mz-in" id="vpDtipo" aria-label="Tipo de documento"><option value="01">CC</option><option value="02">CE</option><option value="04">TI</option></select>' +
      '<input class="mz-in" id="vpDnum" inputmode="numeric" autocomplete="off" maxlength="16" placeholder="Número"></div>' +
      '<button type="button" class="btn-primary vp-grande" id="vpDenviar">📲 Enviar código al celular del cliente</button><div id="vpDmsg" class="vp-estado"></div></div>';
    var msg = function(t, malo){ var m = q('vpDmsg'); if(m){ m.className = 'vp-estado ' + (malo ? 'vp-mal' : ''); m.innerHTML = t; } };
    setTimeout(function(){ try{ q('vpDnum').focus(); }catch(e){} }, 50);
    q('vpDenviar').onclick = function(){
      var num = (q('vpDnum').value || '').replace(/[\s.\-]/g, '');
      if(!/^\d{3,14}$/.test(num)) return msg('⚠️ Escribe el número de documento (solo números).', true);
      var b = q('vpDenviar'); b.disabled = true; msg('<span class="vp-gira">⏳</span> Pidiendo el código a DaviPlata…');
      try{ if(mesa != null && window.ventoAtiende) window.ventoAtiende.marcar(mesa, 'cobro'); }catch(e){}   // quien cobra esta mesa recibe el aviso del pago
      api('cobro', { negocio: n.id, proveedor: 'daviplata', canal: 'otp', monto: valor, mesa: mesa != null ? String(mesa) : null, tipo_documento: q('vpDtipo').value, numero_documento: num, idem: base + '-' + intento })
        .then(function(j){ recibir(j.pago, false); pantallaCodigo(ov, n, j.pago, j.otp_prueba); })
        .catch(function(e){ intento++; b.disabled = false; msg('⚠️ ' + esc(e.message), true); });
    };
  }
  function pantallaCodigo(ov, n, p, prueba){
    var res = ov.querySelector('#vpCobroRes'), q = function(id){ return ov.querySelector('#' + id); };
    res.innerHTML = '<div class="vp-form"><div class="vp-monto">' + plata(p.monto) + '</div>' +
      '<div class="modal-sub" style="text-align:center">DaviPlata le mandó un <b>código de 6 dígitos</b> por mensaje al celular del cliente' + (p.documento ? ' (<span class="vp-nw">' + esc(p.documento) + '</span>)' : '') + '. Pídeselo y escríbelo:</div>' +
      '<input class="mz-in vp-otp" id="vpDotp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••" aria-label="Código de DaviPlata">' +
      (prueba ? '<div class="vp-prueba" id="vpDprueba"><span>🧪 Laboratorio: código de prueba <b>' + esc(prueba) + '</b></span><button type="button" class="btn-ghost" id="vpDusar">Usar</button></div>' : '') +
      '<button type="button" class="btn-primary vp-grande" id="vpDconf">✅ Confirmar pago</button><div id="vpDmsg" class="vp-estado"></div></div>';
    var msg = function(t, malo){ var m = q('vpDmsg'); if(m){ m.className = 'vp-estado ' + (malo ? 'vp-mal' : ''); m.innerHTML = t; } };
    var listo = false;
    var terminar = function(x){ if(listo) return; listo = true; if(ov._fin){ try{ ov._fin(); }catch(e){} } ov._fin = null; mostrarCobro(ov, x); };
    // Si otro celular lo confirma, o vence / queda rechazado, esta ventana se entera (tiempo real o sincronización).
    var oye = function(x){ if(x.id === p.id && x.estado !== 'pendiente') terminar(x); };
    oyentes.push(oye);
    ov._fin = function(){ oyentes = oyentes.filter(function(f){ return f !== oye; }); };
    if(q('vpDusar')) q('vpDusar').onclick = function(){ q('vpDotp').value = prueba; };
    setTimeout(function(){ try{ q('vpDotp').focus(); }catch(e){} }, 50);
    var otp = q('vpDotp');
    otp.oninput = function(){ otp.value = otp.value.replace(/\D/g, '').slice(0, 6); };
    otp.onkeydown = function(e){ if(e.key === 'Enter') q('vpDconf').click(); };
    q('vpDconf').onclick = function(){
      var c = (otp.value || '').replace(/\D/g, '');
      if(c.length !== 6) return msg('⚠️ El código tiene 6 dígitos.', true);
      var b = q('vpDconf'); b.disabled = true; msg('<span class="vp-gira">⏳</span> Confirmando con DaviPlata…');
      api('confirmar', { negocio: n.id, pago: p.id, otp: c }).then(function(j){
        // La respuesta «Aprobado» ES el aviso del pago: se recibe «en vivo» (sin mesa abre «Registrar en la mesa»).
        if(j.pago) recibir(j.pago, !!(j.ok && !j.repetido));
        if(j.ok || (j.pago && j.pago.estado !== 'pendiente')) return terminar(cache[(j.pago || p).id] || j.pago);
        b.disabled = false;
        if(!j.incierto){ otp.value = ''; }   // sin respuesta de DaviPlata se reintenta con el MISMO código
        otp.focus();
        msg('⚠️ ' + esc(j.mensaje || 'No se pudo confirmar.'), true);
      }).catch(function(e){ b.disabled = false; msg('⚠️ ' + esc(e.message), true); });
    };
  }

  function crearBotonCuenta(){
    if(document.getElementById('vpCobrarCuenta')) return;
    var cont = document.getElementById('paymentsContainer'); if(!cont) return;
    var b = document.createElement('button'); b.type = 'button'; b.id = 'vpCobrarCuenta'; b.className = 'vp-btn-cuenta'; b.setAttribute('data-novocab', '');
    b.textContent = '💜 Cobrar Nequi / DaviPlata';
    b.onclick = function(){ try{ window.ventoPagosCobrar(typeof currentTable !== 'undefined' ? currentTable : null); }catch(e){ window.ventoPagosCobrar(null); } };
    cont.parentNode.insertBefore(b, cont);
    refrescarEstado().then(function(){ b.hidden = !(est.resumen && (est.resumen.nequi.estado === 'conectado' || est.resumen.daviplata.estado === 'conectado')); });
  }

  // ---------- Ajustes → 💜 Pagos ----------
  function refrescarEstado(){
    var n = negocio(); if(!n || !est.servidor) return Promise.resolve(null);
    return api('config', { negocio: n.id, accion: 'estado' }).then(function(j){ est.info = j; est.resumen = j.resumen; var b = document.getElementById('vpCobrarCuenta'); if(b) b.hidden = !(j.resumen.nequi.estado === 'conectado' || j.resumen.daviplata.estado === 'conectado'); return j; }).catch(function(e){ est.errorEstado = e.message; return null; });
  }
  function crearCategoria(){
    var cats = document.getElementById('ajustesCats'); if(!cats || document.getElementById('vpGrupo')) return;
    var b = cats.querySelector('[data-cat="pagos"]');   // la categoría ya viene en index.html (ahí están también la pasarela y los avisos de pagos)
    if(!b){
      b = document.createElement('button'); b.type = 'button'; b.className = 'ajustes-cat'; b.dataset.cat = 'pagos'; b.setAttribute('data-novocab', '');
      b.innerHTML = '<span class="ac-icon">💜</span><span class="ac-label">Pagos: Nequi y DaviPlata</span><span class="ac-arrow">›</span>';
      var ref = cats.querySelector('[data-cat="pedidos"]'); cats.insertBefore(b, ref ? ref.nextSibling : null);
      b.addEventListener('click', function(){ if(window.mostrarCategoriaAjustes) window.mostrarCategoriaAjustes('pagos'); });
    }
    b.addEventListener('click', function(){ pintarAjustes(); });
    var g = document.createElement('div'); g.className = 'settings-group'; g.id = 'vpGrupo'; g.dataset.cat = 'pagos'; g.hidden = true; g.setAttribute('data-novocab', '');
    var otro = document.querySelector('#view-ajustes .settings-group[data-cat]'); if(otro) otro.parentNode.insertBefore(g, otro); else return;
  }
  function estadoHtml(nombre, r, color){
    var ok = r && r.estado === 'conectado';
    return '<div class="vp-card"><h3>' + nombre + '</h3><div class="vp-st ' + (ok ? 'vp-ok' : 'vp-pend') + '">' + (ok ? color + ' Conectado' : '🟠 Pendiente') + '</div><small>' + esc(r ? r.detalle : 'Falta conectar') + '</small></div>';
  }
  function chequeos(){
    var n = negocio(), cfg = nube() && nube().configurada();
    var l = [
      [cfg, 'Vento Nube configurada', 'Falta: Ajustes → ☁️ Nube y usuarios.'],
      [!!n, 'Sesión iniciada en un negocio', 'Entra con tu correo en Vento Nube.'],
      [est.servidor === true, 'Servidor Vento activo' + (est.version ? ' (v' + est.version + ')' : ''), est.servidor === false ? 'El servidor de pagos aún no está desplegado en tu Supabase (ver abajo).' : 'Comprobando…'],
      [!!miDispositivo() && !est.revocado, 'Este celular autorizado', est.revocado ? 'Este celular fue retirado. Toca «Autorizar este celular».' : 'Se autoriza solo al entrar.'],
      [pushActivo(), 'Avisos con la app cerrada', 'Opcional: toca «🔔 Activar avisos».']
    ];
    return '<ul class="vp-checks">' + l.map(function(c){ return '<li><span>' + (c[0] ? '✅' : (c[2].indexOf('Opcional') === 0 ? '▫️' : '⚠️')) + '</span><span>' + esc(c[1]) + (c[0] ? '' : '<br><small style="color:var(--ink-soft)">' + esc(c[2]) + '</small>') + '</span></li>'; }).join('') + '</ul>';
  }
  function pintarAjustes(){
    crearCategoria();
    var g = document.getElementById('vpGrupo'); if(!g) return;
    var n = negocio();
    var pinta = function(){
      var r = est.resumen, info = est.info || {}, admin = n && (n.rol === 'dueno' || n.rol === 'admin');
      var html = '<h2>💜 Pagos: Nequi y DaviPlata</h2>' +
        '<div class="settings-desc">Los pagos llegan al <b>Servidor Vento</b> por una integración autorizada (Wompi, Nequi Conecta o la API de DaviPlata), quedan guardados en la base de datos y aparecen al instante en todos los celulares del negocio. Vento verifica la firma, evita duplicados y los registra solos en la cuenta.</div>' +
        '<div class="vp-cards">' + estadoHtml('NEQUI', r && r.nequi, '🟢') + estadoHtml('DAVIPLATA', r && r.daviplata, '🔵') + '</div>' +
        (admin && est.servidor ? '<div class="mz-actions" style="flex-wrap:wrap"><button type="button" class="btn-primary" id="vpConNequi">Conectar Nequi</button><button type="button" class="btn-primary" id="vpConDavi">Conectar DaviPlata</button>' + (r && (r.nequi.estado === 'conectado' || r.daviplata.estado === 'conectado') ? '<button type="button" class="btn-ghost" id="vpProbar">🔄 Comprobar</button>' : '') + '</div>' : '') +
        chequeos();
      if(est.servidor === false) html += servidorPendienteHtml();
      if(!n) html += '<div class="mz-actions"><button type="button" class="btn-primary" id="vpNube">☁️ Abrir Vento Nube</button></div>';
      if(n && est.servidor){
        html += '<div class="mz-actions" style="flex-wrap:wrap">' + (pushActivo() ? '' : '<button type="button" class="btn-ghost" id="vpPush">🔔 Activar avisos aunque Vento esté cerrada</button>') +
          ((!miDispositivo() || est.revocado) ? '<button type="button" class="btn-ghost" id="vpAutorizar">📱 Autorizar este celular</button>' : '') + '</div>';
        if(admin && info.webhook_wompi) html += '<div class="settings-row" style="flex-direction:column;align-items:stretch;gap:6px"><div class="settings-row-text"><strong>Eventos de Wompi ' + (r.webhook === 'recibiendo' ? '<span class="vp-ok">✅ recibiendo</span>' : '<span class="vp-pend">⏳ esperando el primero</span>') + '</strong><span>Pégala una vez en Wompi → Desarrolladores → «URL de Eventos». Mientras tanto Vento consulta el estado de cada cobro, así que igual funciona.</span></div><input class="mz-in vp-url" readonly id="vpHook" value="' + esc(info.webhook_wompi) + '"><div class="mz-actions"><button type="button" class="btn-ghost" id="vpCopHook">📋 Copiar URL de eventos</button><a class="btn-ghost" href="https://comercios.wompi.co" target="_blank" rel="noopener">Abrir Wompi</a></div></div>';
        html += '<div class="settings-row" style="flex-direction:column;align-items:stretch"><div class="settings-row-text"><strong>Últimos pagos en el servidor</strong></div><div class="vp-hist" id="vpHist"></div></div>';
        if(admin) html += '<div class="settings-row" style="flex-direction:column;align-items:stretch"><div class="settings-row-text"><strong>📱 Celulares autorizados</strong><span>Cada celular que entra a Vento con tu negocio queda autorizado con su propio token. Puedes retirar uno perdido.</span></div><div class="vp-hist" id="vpDevs">Cargando…</div></div>';
        if(puedeCaja() && miDispositivo() && !(window.VentoAndroid && window.VentoAndroid.pagosAvisosTomar)) html += '<details class="settings-desc"><summary><b>Avisos del celular (método auxiliar, MacroDroid)</b></summary><p style="margin:8px 0 0">Si quieres que también cuenten las notificaciones de la app Nequi/DaviPlata de ESTE celular (por ejemplo, transferencias normales a tu número), en MacroDroid crea una macro: disparador <b>Notificación recibida</b> (apps Nequi y DaviPlata) → acción <b>Solicitud HTTP POST</b> a esta dirección, con el cuerpo <b>[app] | [título] | [texto]</b>. Quedan marcadas como «aviso del celular» (no verificadas por la entidad).</p><input class="mz-in vp-url" readonly id="vpAvisoUrl" value="' + esc((info.aviso_url || (base() + '/aviso')) + '/' + miDispositivo().token) + '"><div class="mz-actions"><button type="button" class="btn-ghost" id="vpCopAviso">📋 Copiar dirección</button></div></details>';
      }
      g.innerHTML = html;
      enlazarAjustes(g);
      pintarHistorial();
      if(admin && est.servidor) pintarDispositivos();
    };
    pinta();
    if(!n){ return; }
    salud().then(function(){ return refrescarEstado(); }).then(pinta);
  }
  function servidorPendienteHtml(){
    return '<details class="settings-desc" open><summary><b>Activar el Servidor Vento (una sola vez)</b></summary><p style="margin:8px 0 0">El código del servidor ya está listo en el proyecto (carpeta <b>supabase/</b>) y se despliega solo con GitHub. Solo falta autorizarlo, porque esas llaves son de tu cuenta:</p><ol style="margin:6px 0 0;padding-left:20px;line-height:1.55">' +
      '<li>En Supabase → tu foto → <b>Account → Access Tokens</b> crea un token.</li>' +
      '<li>En GitHub → el repositorio de Vento → <b>Settings → Secrets and variables → Actions</b> agrega: <b>SUPABASE_ACCESS_TOKEN</b> (el token), <b>SUPABASE_PROJECT_REF</b> (lo que va antes de .supabase.co en tu URL) y <b>SUPABASE_DB_PASSWORD</b> (la contraseña que pusiste al crear el proyecto).</li>' +
      '<li>En GitHub → <b>Actions → «Servidor Vento» → Run workflow</b>. Crea las tablas, sube el servidor y conecta todos los celulares solo.</li></ol><p style="margin:6px 0 0">Cuando termine, vuelve aquí: esta pantalla lo detecta sola.</p></details>';
  }
  function enlazarAjustes(g){
    var q = function(id){ return g.querySelector('#' + id); };
    if(q('vpNube')) q('vpNube').onclick = function(){ nube() && nube().abrir(); };
    if(q('vpConNequi')) q('vpConNequi').onclick = function(){ asistente('nequi'); };
    if(q('vpConDavi')) q('vpConDavi').onclick = function(){ asistente('daviplata'); };
    if(q('vpProbar')) q('vpProbar').onclick = function(){
      var n = negocio(), provs = (est.info && est.info.proveedores || []).map(function(p){ return p.proveedor; });
      Promise.all(provs.map(function(p){ return api('config', { negocio: n.id, accion: 'probar', proveedor: p }).catch(function(e){ toast('⚠️ ' + p + ': ' + e.message, 8000); }); }))
        .then(function(){ toast('🔄 Comprobado con ' + provs.join(' y ') + '.'); pintarAjustes(); });
    };
    if(q('vpPush')) q('vpPush').onclick = function(){ activarPush().then(function(){ toast('🔔 Listo: te avisamos de cada pago aunque Vento esté cerrada.'); pintarAjustes(); }).catch(function(e){ toast(e.message, 9000); }); };
    if(q('vpAutorizar')) q('vpAutorizar').onclick = function(){ est.revocado = false; registrarDispositivo(true).then(function(){ toast('📱 Celular autorizado.'); pintarAjustes(); }).catch(function(e){ toast(e.message || String(e)); }); };
    var copiar = function(id, msg){ var el = q(id); try{ navigator.clipboard.writeText(el.value); toast(msg); }catch(e){ el.select(); } };
    if(q('vpCopHook')) q('vpCopHook').onclick = function(){ copiar('vpHook', '📋 Copiada. Pégala en Wompi → Desarrolladores → URL de Eventos.'); };
    if(q('vpCopAviso')) q('vpCopAviso').onclick = function(){ copiar('vpAvisoUrl', '📋 Copiada. Pégala en MacroDroid (Solicitud HTTP → URL).'); };
  }
  function pintarHistorial(){
    var el = document.getElementById('vpHist'); if(!el) return;
    var l = Object.keys(cache).map(function(k){ return cache[k]; }).sort(function(a, b){ return String(b.actualizado_en || '').localeCompare(String(a.actualizado_en || '')); }).slice(0, 20);
    el.innerHTML = l.length ? l.map(function(p){
      return '<div><span>' + esc(nombreMetodo(p.metodo)) + (p.pagador ? ' · ' + esc(p.pagador) : '') + ' <b class="' + (p.estado === 'aprobado' ? 'vp-ok' : p.estado === 'pendiente' ? 'vp-pend' : 'vp-mal') + '">' + etiqueta(p) + '</b>' +
        '<small>' + new Date(p.actualizado_en || p.creado_en).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + (p.mesa ? ' · ' + esc(etiquetaMesa(p.mesa)) : '') + (p.aplicado_en ? ' · registrado' : '') + ' · ' + (p.verificado ? 'verificado por ' + entidad(p) : 'aviso del celular') + '</small></span><b>' + plata(p.monto) + '</b></div>';
    }).join('') : '<div class="empty-note">Todavía no hay pagos en el servidor.</div>';
  }
  function pintarDispositivos(){
    var el = document.getElementById('vpDevs'), n = negocio(); if(!el || !n) return;
    rpc('mis_dispositivos', { p_negocio: n.id }).then(function(l){
      var mio = miDispositivo();
      el.innerHTML = (l || []).map(function(d){ return '<div><span>' + esc(d.nombre) + (mio && mio.id === d.id ? ' <b>(este)</b>' : '') + '<small>' + esc(d.usuario || '') + ' · ' + nombreRol(d.rol) + ' · visto ' + new Date(d.ultimo_visto).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + (d.push ? ' · 🔔' : '') + '</small></span><button type="button" class="btn-ghost" data-rev="' + esc(d.id) + '" style="padding:4px 10px">Retirar</button></div>'; }).join('') || '<div class="empty-note">Ninguno.</div>';
      el.onclick = function(e){ var b = e.target.closest('[data-rev]'); if(!b || !confirm('¿Retirar este celular? Dejará de recibir y mandar avisos de pagos.')) return; rpc('revocar_dispositivo', { p_dispositivo: b.dataset.rev }).then(function(){ toast('Celular retirado.'); pintarDispositivos(); }); };
    }).catch(function(){ el.textContent = 'No se pudo cargar la lista.'; });
  }

  // ---------- Asistente «Conectar Nequi / Conectar DaviPlata» ----------
  function asistente(cual){
    var n = negocio(), ov = ventana('vpAsisOv');
    var r = est.resumen || {}, wompiYa = (est.info && est.info.proveedores || []).some(function(p){ return p.proveedor === 'wompi' && p.estado === 'conectado'; });
    // ¿Solo quiere que Vento le avise cuando le pagan? Eso NO necesita la API ni convenio: el paso a paso de los avisos.
    var soloAvisos = '<div class="vp-guia"><b>¿Solo quieres que Vento te avise «Pagaron $20.000 por ' + (cual === 'daviplata' ? 'DaviPlata' : 'Nequi') + '» cuando te pasan plata?</b> No necesitas esto (ni convenio con el banco).' +
      ' <button type="button" class="btn-primary" data-vp-guia>📘 Paso a paso: agregar ' + (cual === 'daviplata' ? 'DaviPlata' : 'Nequi') + '</button></div>';
    var intro = soloAvisos + (cual === 'daviplata'
      ? '<div class="modal-sub">Para <b>cobrar</b> con la integración oficial hay dos vías. Puedes usar una o las dos: la <b>API Pago con DaviPlata</b> de Davivienda (cobro con código al celular del cliente) o <b>Wompi</b> (link o QR que se paga con DaviPlata, Nequi o tarjeta).</div>'
      : '<div class="modal-sub">Para <b>cobrar</b> con la integración oficial hay dos vías. Puedes usar una o las dos:</div>');
    var provD = (est.info && est.info.proveedores || []).find(function(p){ return p.proveedor === 'daviplata'; }) || null, pubD = provD && provD.publico || {};
    var formD = '<div class="vp-form" id="vpFormD"><h3 style="margin:14px 0 0">Conectar DaviPlata (API oficial de Davivienda)' + (provD && provD.estado === 'conectado' ? ' <span class="vp-ok">· conectada</span>' : provD && provD.estado === 'error' ? ' <span class="vp-mal">· con error</span>' : '') + '</h3>' +
      '<div class="modal-sub">Cobras con el <b>documento</b> del cliente: a su celular le llega un código y tú lo escribes en Vento; DaviPlata responde «Aprobado» en ese momento (no manda aviso aparte). Necesitas: <b>convenio con Davivienda</b>, tu aplicación en el <a href="https://conectesunegocio.daviplata.com" target="_blank" rel="noopener">Developer Portal</a> (Client ID y Secret), su <b>certificado</b> (.cer + llave .pem) y los códigos de <b>comercio y terminal</b> que asigna Redeban.</div>' +
      '<label for="vpDamb">Ambiente</label><select class="mz-in" id="vpDamb"><option value="sandbox">Laboratorio (pruebas · lun–vie 8:00–17:00)</option><option value="produccion">Producción (cobros reales)</option></select>' +
      '<label for="vpDcid">Client ID (Consumer Key)</label><input class="mz-in" id="vpDcid" autocomplete="off" autocapitalize="none" spellcheck="false">' +
      '<label for="vpDsec">Client Secret (Consumer Secret)</label><input class="mz-in" id="vpDsec" type="password" autocomplete="off"' + (provD ? ' placeholder="Vacío = conservar el guardado"' : '') + '>' +
      '<label for="vpDtr">Conexión segura (TLS mutuo)</label><select class="mz-in" id="vpDtr"><option value="directo">Directa desde el Servidor Vento</option><option value="puente">Por mi puente de Cloudflare (Worker)</option></select>' +
      '<div id="vpDdir"><label for="vpDcer">Certificado (.cer, .crt o .pem)</label><input class="mz-in" id="vpDcer" type="file" accept=".cer,.crt,.pem"><small class="vp-ayuda" id="vpDcerOk">' + (provD ? 'Vacío = conservar el guardado' : 'El que descargas en el Developer Portal (paso 4 de la Guía de inicio)') + '</small>' +
      '<label for="vpDkey">Llave privada (.pem o .key)</label><input class="mz-in" id="vpDkey" type="file" accept=".pem,.key"><small class="vp-ayuda" id="vpDkeyOk"></small></div>' +
      '<div id="vpDpte" hidden><label for="vpDurl">Dirección del puente</label><input class="mz-in" id="vpDurl" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="https://vento-daviplata.tu-cuenta.workers.dev">' +
      '<label for="vpDpsec">Secreto del puente</label><input class="mz-in" id="vpDpsec" type="password" autocomplete="off"' + (provD ? ' placeholder="Vacío = conservar el guardado"' : '') + '><small class="vp-ayuda">El certificado se sube al Worker (puente/daviplata-worker.js). Pasos en supabase/LEEME.md.</small></div>' +
      '<label for="vpDcom">Código de comercio (idComercio)</label><input class="mz-in" id="vpDcom" inputmode="numeric" autocomplete="off">' +
      '<label for="vpDter">Terminal (idTerminal)</label><input class="mz-in" id="vpDter" autocomplete="off" autocapitalize="characters">' +
      '<div class="mz-actions"><button type="button" class="btn-primary" id="vpDok">Comprobar y conectar</button>' + (provD ? '<button type="button" class="btn-ghost" id="vpDquitar">Desconectar</button>' : '') + '</div></div>';
    var formW = '<div class="vp-form" id="vpFormW"><h3 style="margin:14px 0 0">Wompi ' + (wompiYa ? '<span class="vp-ok">· ya conectado</span>' : '') + '</h3>' +
      '<div class="modal-sub">En <a href="https://comercios.wompi.co" target="_blank" rel="noopener">comercios.wompi.co</a> → <b>Desarrolladores</b> están las 4 llaves. Para pruebas usa las de «Sandbox» (empiezan por <b>pub_test_</b>); para cobrar de verdad, las de producción (<b>pub_prod_</b>).</div>' +
      '<label>Llave pública</label><input class="mz-in" id="vpWpub" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="pub_prod_…">' +
      '<label>Llave privada</label><input class="mz-in" id="vpWprv" type="password" autocomplete="off" placeholder="prv_prod_…">' +
      '<label>Secreto de eventos</label><input class="mz-in" id="vpWev" type="password" autocomplete="off" placeholder="prod_events_…">' +
      '<label>Secreto de integridad</label><input class="mz-in" id="vpWint" type="password" autocomplete="off" placeholder="prod_integrity_…">' +
      '<div class="mz-actions"><button type="button" class="btn-primary" id="vpWok">Conectar con Wompi</button></div></div>';
    var formN = '<div class="vp-form" id="vpFormN"><h3 style="margin:14px 0 0">Nequi Conecta (cobro push y QR directo de Nequi)</h3>' +
      '<div class="modal-sub">En <a href="https://conecta.nequi.com.co" target="_blank" rel="noopener">conecta.nequi.com.co</a> registra tu negocio y crea la aplicación: ahí salen el Client ID, el Client Secret, la API Key y tu código de comercio.</div>' +
      '<label>Ambiente</label><select class="mz-in" id="vpNamb"><option value="produccion">Producción (cobros reales)</option><option value="sandbox">Pruebas (sandbox)</option></select>' +
      '<label>Client ID</label><input class="mz-in" id="vpNcid" autocomplete="off" autocapitalize="none" spellcheck="false">' +
      '<label>Client Secret</label><input class="mz-in" id="vpNsec" type="password" autocomplete="off">' +
      '<label>API Key</label><input class="mz-in" id="vpNkey" type="password" autocomplete="off">' +
      '<label>Código de comercio</label><input class="mz-in" id="vpNcod" autocomplete="off" autocapitalize="none" placeholder="El que te asignó Nequi Conecta">' +
      '<div class="mz-actions"><button type="button" class="btn-primary" id="vpNok">Conectar con Nequi Conecta</button></div></div>';
    ov.innerHTML = '<div class="modal vp-modal" style="max-height:90vh;overflow:auto"><h2>' + (cual === 'daviplata' ? 'Conectar DaviPlata' : 'Conectar Nequi') + '</h2>' + chequeos() + intro +
      (cual === 'daviplata' ? formD + formW : formN + formW) +
      '<div id="vpAsisMsg" class="vp-estado"></div><div class="modal-actions"><button type="button" class="btn-close" id="vpAsisX">Cerrar</button></div></div>';
    ov.classList.add('show');
    var q = function(id){ return ov.querySelector('#' + id); };
    var msg = function(t, mal){ q('vpAsisMsg').innerHTML = t; q('vpAsisMsg').className = 'vp-estado ' + (mal ? 'vp-mal' : 'vp-ok'); };
    q('vpAsisX').onclick = function(){ cerrarVentana(ov); pintarAjustes(); };
    var bg = ov.querySelector('[data-vp-guia]'); if(bg) bg.onclick = function(){ cerrarVentana(ov); try{ window.ventoPagosGuia && window.ventoPagosGuia(); }catch(e){} };
    var enviar = function(btn, cuerpo){
      if(!n) return msg('Primero entra a Vento Nube.', true);
      btn.disabled = true; msg('<span class="vp-gira">⏳</span> Comprobando con la entidad…');
      api('config', Object.assign({ negocio: n.id }, cuerpo)).then(function(j){
        est.info = j; est.resumen = j.resumen;
        var rn = j.resumen;
        msg('✅ Verificado. Nequi: ' + (rn.nequi.estado === 'conectado' ? '🟢 conectado' : '🟠 ' + esc(rn.nequi.detalle)) + ' · DaviPlata: ' + (rn.daviplata.estado === 'conectado' ? '🔵 conectado' : '🟠 ' + esc(rn.daviplata.detalle)) +
          (cuerpo.accion === 'guardar_wompi' && j.webhook_wompi ? '<div class="modal-sub" style="font-weight:400;margin-top:8px">Último paso (recomendado): en Wompi → Desarrolladores → <b>URL de Eventos</b> pega esta dirección para que los pagos lleguen en segundos:</div><input class="mz-in vp-url" readonly value="' + esc(j.webhook_wompi) + '" onclick="this.select()"><div class="mz-actions" style="justify-content:center"><button type="button" class="btn-ghost" id="vpCopHook2">📋 Copiar</button></div>' : ''));
        var c2 = q('vpCopHook2'); if(c2) c2.onclick = function(){ try{ navigator.clipboard.writeText(j.webhook_wompi); toast('📋 Copiada.'); }catch(e){} };
        var b = document.getElementById('vpCobrarCuenta'); if(b) b.hidden = !(rn.nequi.estado === 'conectado' || rn.daviplata.estado === 'conectado'); else crearBotonCuenta();
        ov.querySelectorAll('input[type=password]').forEach(function(i){ i.value = ''; });
      }).catch(function(e){ msg('⚠️ ' + esc(e.message), true); }).then(function(){ btn.disabled = false; });
    };
    if(q('vpWok')) q('vpWok').onclick = function(){ enviar(q('vpWok'), { accion: 'guardar_wompi', llave_publica: q('vpWpub').value.trim(), llave_privada: q('vpWprv').value.trim(), secreto_eventos: q('vpWev').value.trim(), secreto_integridad: q('vpWint').value.trim() }); };
    if(q('vpFormD')) formularioDavi(ov, provD, enviar, msg);
    if(q('vpNok')) q('vpNok').onclick = function(){ enviar(q('vpNok'), { accion: 'guardar_nequi', ambiente: q('vpNamb').value, client_id: q('vpNcid').value.trim(), client_secret: q('vpNsec').value.trim(), api_key: q('vpNkey').value.trim(), codigo: q('vpNcod').value.trim() }); };
  }

  // Lee el certificado / la llave del archivo como texto PEM (un .cer binario DER se convierte a PEM aquí mismo).
  function leerPem(file, tipo){
    if(!file) return Promise.resolve('');
    if(file.size > 64 * 1024) return Promise.reject(new Error('Ese archivo es demasiado grande para ser un ' + (tipo === 'cert' ? 'certificado' : 'archivo de llave') + '.'));
    return file.arrayBuffer().then(function(buf){
      var u = new Uint8Array(buf), txt = '';
      try{ txt = new TextDecoder('utf-8').decode(u); }catch(e){}
      if(tipo === 'cert'){
        var m = /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/.exec(txt);
        if(m) return m[0];
        if(u[0] === 0x30 && u.length > 200){
          var s = ''; for(var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
          return '-----BEGIN CERTIFICATE-----\n' + btoa(s).replace(/(.{64})/g, '$1\n').replace(/\n$/, '') + '\n-----END CERTIFICATE-----';
        }
        throw new Error('Ese archivo no parece un certificado (.cer, .crt o .pem).');
      }
      if(/-----BEGIN ENCRYPTED PRIVATE KEY-----/.test(txt)) throw new Error('La llave tiene contraseña: expórtala sin contraseña.');
      var k = /-----BEGIN (RSA |EC )?PRIVATE KEY-----[\s\S]+?-----END (RSA |EC )?PRIVATE KEY-----/.exec(txt);
      if(k) return k[0];
      throw new Error('Ese archivo no parece una llave privada (.pem o .key).');
    });
  }
  function formularioDavi(ov, provD, enviar, msg){
    var q = function(id){ return ov.querySelector('#' + id); }, pub = provD && provD.publico || {};
    var LAB = { com: '0010203040', ter: 'ESB10934' };
    if(provD){ q('vpDamb').value = provD.ambiente === 'produccion' ? 'produccion' : 'sandbox'; q('vpDtr').value = pub.transporte === 'puente' ? 'puente' : 'directo'; if(pub.puente_url) q('vpDurl').value = pub.puente_url; if(pub.terminal) q('vpDter').value = pub.terminal; }
    var lab = function(){
      // Laboratorio: los códigos estándar de Redeban; producción: los propios del comercio.
      if(q('vpDamb').value === 'sandbox'){ if(!q('vpDcom').value) q('vpDcom').value = LAB.com; if(!q('vpDter').value) q('vpDter').value = LAB.ter; }
      else { if(q('vpDcom').value === LAB.com) q('vpDcom').value = ''; if(q('vpDter').value === LAB.ter) q('vpDter').value = ''; }
    };
    var modo = function(){ var p = q('vpDtr').value === 'puente'; q('vpDdir').hidden = p; q('vpDpte').hidden = !p; };
    q('vpDamb').onchange = lab; q('vpDtr').onchange = modo; lab(); modo();
    var pem = { cert: '', key: '' };
    var archivo = function(inp, tipo, nota){
      inp.onchange = function(){
        pem[tipo] = '';
        leerPem(inp.files && inp.files[0], tipo).then(function(t){ pem[tipo] = t; q(nota).textContent = t ? '✅ ' + (tipo === 'cert' ? 'Certificado' : 'Llave') + ' leído' : ''; q(nota).className = 'vp-ayuda vp-ok'; })
          .catch(function(e){ inp.value = ''; q(nota).textContent = '⚠️ ' + e.message; q(nota).className = 'vp-ayuda vp-mal'; });
      };
    };
    archivo(q('vpDcer'), 'cert', 'vpDcerOk'); archivo(q('vpDkey'), 'key', 'vpDkeyOk');
    q('vpDok').onclick = function(){
      var directo = q('vpDtr').value === 'directo';
      var c = { accion: 'guardar_daviplata', ambiente: q('vpDamb').value, transporte: q('vpDtr').value, client_id: q('vpDcid').value.trim(), client_secret: q('vpDsec').value.trim(),
        id_comercio: q('vpDcom').value.trim(), id_terminal: q('vpDter').value.trim().toUpperCase() };
      if(!c.client_id) return msg('⚠️ Falta el Client ID.', true);
      if(!c.id_comercio || !c.id_terminal) return msg('⚠️ Faltan los códigos de comercio y terminal de Redeban.', true);
      if(directo){
        if(!provD && (!pem.cert || !pem.key)) return msg('⚠️ Elige el certificado (.cer) y la llave (.pem).', true);
        c.cert = pem.cert; c.key = pem.key;
      } else {
        c.puente_url = q('vpDurl').value.trim(); c.puente_secreto = q('vpDpsec').value.trim();
        if(!/^https:\/\//.test(c.puente_url)) return msg('⚠️ La dirección del puente empieza por https://', true);
      }
      enviar(q('vpDok'), c);
    };
    if(q('vpDquitar')) q('vpDquitar').onclick = function(){
      if(!confirm('¿Desconectar la API de DaviPlata? Se borran sus credenciales del servidor.')) return;
      var n = negocio();
      api('config', { negocio: n.id, accion: 'desconectar', proveedor: 'daviplata' }).then(function(j){ est.info = j; est.resumen = j.resumen; msg('DaviPlata (API) desconectado.'); })
        .catch(function(e){ msg('⚠️ ' + esc(e.message), true); });
    };
  }

  // La categoría aparece siempre (aunque la nube no esté lista: el asistente dice qué falta).
  var tCat = setInterval(function(){ if(document.getElementById('ajustesCats')){ clearInterval(tCat); crearCategoria(); } }, 1000);
  document.addEventListener('click', function(e){ if(e.target.closest && e.target.closest('.ajustes-cat[data-cat="pagos"]')) setTimeout(pintarAjustes, 30); });

  // Google / YouTube sin vencerse: el Servidor Vento guarda la llave de renovación (ver index.html → yRenovarServidor).
  window.ventoGoogle = {
    disponible: function(){ return !!(negocio() && est.servidor); },
    // Por qué no está disponible (para decirle a la persona qué falta): sin_sesion | comprobando | sin_servidor | ok
    motivo: function(){ return !negocio() ? 'sin_sesion' : est.servidor === true ? 'ok' : est.servidor === false ? 'sin_servidor' : 'comprobando'; },
    estado: function(){ return api('google', { negocio: negocio().id, accion: 'estado' }); },
    canjear: function(code, clientId, secret, redir){ return api('google', { negocio: negocio().id, accion: 'codigo', code: code, client_id: clientId, client_secret: secret || '', redirect_uri: redir || 'postmessage' }); },
    token: function(){ return api('google', { negocio: negocio().id, accion: 'token' }); },
    cuenta: function(nombre){ return api('google', { negocio: negocio().id, accion: 'cuenta', cuenta: nombre }).catch(function(){}); },
    olvidar: function(){ return api('google', { negocio: negocio().id, accion: 'olvidar' }); }
  };

  window.ventoPagos = { estado: function(){ return est; }, sincronizar: sincronizar, recibir: recibir, cobrar: function(m, v){ return window.ventoPagosCobrar(m, v); }, activarPush: activarPush, abrirAjustes: pintarAjustes, _cache: cache };
})();
