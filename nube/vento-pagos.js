/* =====================================================================
   ORDEVA · Pagos con Nequi y DaviPlata (lado de la app)

   Núcleo:  Nequi / DaviPlata → integración autorizada (Wompi, Nequi Conecta o la API Pago con DaviPlata) → Servidor ORDEVA
            (Supabase Edge Function «vento-pagos») → base de datos → esta app → celulares autorizados.

   Esta parte:
   • Ajustes → 💜 Pagos: estado de Nequi y DaviPlata, asistente «Conectar», comprobaciones automáticas,
     URL de eventos, celulares autorizados, historial y avisos del celular (auxiliar).
   • Cuenta/mesa → «💜 Cobrar Nequi / DaviPlata»: link/QR de Wompi, cobro push o QR de Nequi, con el
     estado en vivo, o «DaviPlata con código» (API oficial: le llega un código al celular del cliente y la caja
     lo confirma). Cuando se aprueba, se registra solo en la cuenta (una sola vez aunque haya varios celulares).
   • Registro del celular (id + token seguro), latido, notificaciones push con la app cerrada.
   • Tiempo real (Supabase Realtime) + sincronización al reconectarse (los pagos quedan en el servidor).
   Sin ORDEVA Nube configurada no hace nada: ORDEVA sigue funcionando igual.
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
      if(!s.token) throw Object.assign(new Error('Entra a ORDEVA Nube para usar los pagos.'), { codigo: 'sin_sesion' });
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
  /* 1.65.2: el nombre que se ve en «🔊 Celulares y dónde suenan los pagos». Antes todos salían «Dueño · Android» y no se
     sabía cuál era cuál. Ahora sale la marca y el modelo del celular: «Samsung Galaxy A34», «Xiaomi 24090RA29G»,
     «Computador Windows»… (sale del texto del navegador que guarda el servidor; si el dueño le puso nombre, ese manda). */
  function equipoDe(ua){
    ua = String(ua || '');
    var m = /Android[^;)]*;\s*([^;)]+?)(?:\s+Build\/|[;)])/.exec(ua), mod = m ? m[1].trim() : '';
    if(/Windows/.test(ua)) return '💻 Computador Windows';
    if(/Macintosh|Mac OS X/.test(ua) && !/iPhone|iPad/.test(ua)) return '💻 Computador Mac';
    if(/iPad/.test(ua)) return '📱 iPad';
    if(/iPhone/.test(ua)) return '📱 iPhone';
    if(/Android/.test(ua)){
      if(!mod || /^K$/.test(mod)) return '📱 Celular Android';
      var g = /^SM-([AMF])(\d{2})\d/i.exec(mod);
      if(g) return '📱 Samsung Galaxy ' + g[1].toUpperCase() + g[2] + ' (' + mod + ')';
      if(/^SM-/i.test(mod)) return '📱 Samsung ' + mod;
      if(/^(Redmi|POCO|Mi )/i.test(mod)) return '📱 Xiaomi ' + mod;
      if(/^\d{4,5}[A-Z0-9]{3,8}$/i.test(mod)) return '📱 Xiaomi ' + mod;
      if(/^(CPH|RMX)\d/i.test(mod)) return '📱 OPPO/Realme ' + mod;
      if(/^moto/i.test(mod)) return '📱 Motorola ' + mod;
      if(/^(TECNO|Infinix|itel)/i.test(mod)) return '📱 ' + mod;
      return '📱 ' + mod;
    }
    if(/Linux/.test(ua)) return '💻 Computador Linux';
    return '🌐 Navegador';
  }
  // Nombre puesto solo (de antes): «Dueño · Android», «Caja · Windows»… Ese no lo eligió nadie: se muestra el del modelo.
  function nombreAuto(n){ return !n || /^(Dueño|Administrador|Caja|Mesero|Empleado|Celular|[^·]{1,30}) · (Android|Windows|iPhone|Mac|Navegador)$/.test(String(n)); }
  // 1.65.6: el que el propio equipo se pone al entrar (marca, modelo y dónde corre ORDEVA): empieza con 📱 / 💻 / 🌐.
  function nombreDetectado(n){ return /^(📱|💻|🌐)/.test(String(n || '')); }
  function nombreVer(d){
    if(nombreDetectado(d.nombre)) return d.nombre;
    if(nombreAuto(d.nombre)) return equipoDe(d.plataforma) + (navegadorDe(d.plataforma) ? ' · ' + navegadorDe(d.plataforma) : '');
    return '🏷️ ' + d.nombre + (d.plataforma && /Android|iPhone|iPad|Windows|Mac/.test(d.plataforma) ? ' · ' + equipoDe(d.plataforma).replace(/^\S+\s/, '') : '');
  }
  // Dónde corre ORDEVA en ese equipo (si se ve en el texto del navegador que guardó el servidor).
  function navegadorDe(ua){
    ua = String(ua || '');
    return /VentoPC\//.test(ua) ? 'programa ORDEVA' : /VentoAndroid\//.test(ua) ? 'app ORDEVA' : /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
      : /Firefox\//.test(ua) ? 'Firefox' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
  }
  /* El nombre de ESTE equipo, para que en la lista se sepa cuál es cuál: «📱 Samsung Galaxy A34 (SM-A346M) · app ORDEVA»,
     «💻 Computador Windows · programa ORDEVA», «📱 Xiaomi 24090RA29G · Chrome». Chrome en Android esconde el modelo en su
     texto («K»): ahí se le pregunta al navegador (userAgentData). */
  function equipoAqui(){
    var ua = navigator.userAgent || '';
    return Promise.resolve().then(function(){
      var uad = navigator.userAgentData;
      return uad && uad.getHighEntropyValues ? uad.getHighEntropyValues(['model']).then(function(h){ return h && h.model || ''; }, function(){ return ''; }) : '';
    }).then(function(modelo){
      var base = modelo && /Android/.test(ua) ? equipoDe('Android; ' + modelo + ')') : equipoDe(ua), nav = navegadorDe(ua);
      return (base + (nav ? ' · ' + nav : '')).slice(0, 60);
    });
  }
  // Una vez al día: si este equipo tiene el nombre de antes («Dueño · Android») o uno detectado que ya no es, se pone el
  // nombre de verdad. Si el dueño le puso uno propio (✏️ «Caja», «Celular de Ana»), ese no se toca.
  var K_NOMBRADO = 'vento_pagos_nombrado';
  function nombrarEsteEquipo(){
    var d = miDispositivo(), n = negocio(); if(!d || !n) return;
    var v = lsGet(K_NOMBRADO, {}); if(v.id === d.id && Date.now() - (v.t || 0) < 864e5) return;
    equipoAqui().then(function(nombre){
      return rpc('dispositivos_lista', { p_negocio: n.id }).then(function(l){
        var yo = (l || []).find(function(x){ return x.id === d.id; });
        lsSet(K_NOMBRADO, { id: d.id, t: Date.now() });
        if(!yo || yo.nombre === nombre || !(nombreAuto(yo.nombre) || nombreDetectado(yo.nombre))) return;
        return rpc('dispositivo_nombre', { p_dispositivo: d.id, p_nombre: nombre });
      });
    }).catch(function(){});
  }
  function nombreRol(r){ return ({ dueno: 'Dueño', admin: 'Administrador', cajero: 'Caja', mesero: 'Mesero', empleado: (window.ventoRolNombre ? window.ventoRolNombre('empleado') : 'Empleado') })[r] || 'Celular'; }
  function miDispositivo(){ var n = negocio(), d = lsGet(K_DEV, null); return n && d && d.negocio === n.id ? d : null; }
  function registrarDispositivo(forzar){
    var n = negocio(); if(!n) return Promise.resolve(null);
    var d = miDispositivo();
    if(d && !forzar) return Promise.resolve(d);
    return rpc('registrar_dispositivo', { p_negocio: n.id, p_nombre: nombreRol(n.rol) + ' · ' + plataforma(), p_plataforma: (navigator.userAgent || '').slice(0, 120), p_dispositivo: d ? d.id : null })
      .then(function(r){ var nd = { negocio: n.id, id: r.id, token: r.token, desde: Date.now() }; lsSet(K_DEV, nd); est.dev = nd; est.revocado = false; cruceAndroid(); return nd; });
  }
  function latido(push){
    var d = miDispositivo(); if(!d) return Promise.resolve(false);
    return rpc('latido_dispositivo', { p_dispositivo: d.id, p_push: push || null }).then(function(ok){
      // Retirado (o el token se perdió): mientras siga con la sesión del negocio se vuelve a autorizar solo. Antes quedaba
      // con el token viejo: el servidor rechazaba sus avisos sin decir nada y los demás equipos nunca se enteraban.
      if(ok === false){ est.revocado = true; reautorizar(); }
      else if(ok === true) cruceAndroid();
      return ok;
    }).catch(function(){ return null; });
  }

  // ---------- 🔊 ¿Suenan AQUÍ los avisos de pago? (1.62.0: lo elige el dueño o el administrador en Ajustes → Pagos) ----------
  // En los equipos que no suenan, el pago igual llega y queda en la lista, pero sin voz, sin sonido y sin notificación.
  var K_SUENA = 'vento_pagos_suena', revSuena = 0;
  function suenaAqui(){ return lsGet(K_SUENA, true) !== false; }
  function suenaAndroid(){ try{ var A = window.VentoAndroid; if(A && A.pagosSuena) A.pagosSuena(suenaAqui()); }catch(e){} }
  function revisarSuena(ya){
    var d = miDispositivo(); if(!d || (!ya && Date.now() - revSuena < 30e3)) return Promise.resolve(suenaAqui());
    revSuena = Date.now();
    return rpc('dispositivo_suena', { p_dispositivo: d.id }).then(function(v){
      if(v === true || v === false){ var antes = suenaAqui(); lsSet(K_SUENA, v); suenaAndroid(); if(antes !== v) toast(v ? '🔊 En este equipo vuelven a sonar los avisos de pago.' : '🔕 El administrador eligió que en este equipo no suenen los avisos de pago (igual llegan a la lista).', 7000); }
      return suenaAqui();
    }).catch(function(){ return suenaAqui(); });
  }
  window.ventoPagoSuenaAqui = suenaAqui;
  suenaAndroid();

  var ultimaReaut = 0;
  function reautorizar(){
    if(!negocio() || Date.now() - ultimaReaut < 5 * 60e3) return Promise.resolve(null);
    ultimaReaut = Date.now();
    return registrarDispositivo(true).then(function(d){ est.revocado = false; cruceAndroid(); try{ mandarPendientes(); }catch(e){} return d; }).catch(function(){ return null; });
  }
  // App Android: los pagos de los otros equipos los pregunta Android cada 2,5 s desde el servicio de fondo (Cruce.java),
  // también con el celular bloqueado y la página dormida, y el aviso que lee este celular sale de una al servidor.
  var cruceDado = '';
  function cruceAndroid(){
    var A = window.VentoAndroid; if(!A || !A.pagosCruce) return;
    var n = negocio(), d = miDispositivo(), c = nube() && nube().config && nube().config();
    // 1.65.2: ya no se le quita a Android mientras la página lo vuelve a autorizar («est.revocado»). Antes, si esa nueva
    // autorización no salía (la página dormida con el celular bloqueado, sin internet un momento), Android se quedaba sin
    // su conexión directa (pagos de los otros equipos y reenvío al instante) hasta abrir la app. Android usa el token del
    // celular: si de verdad lo retiraron, el servidor se lo dice a Android y la página lo vuelve a autorizar (ventoPagosCruceMal).
    var j = n && d && d.token && c && c.url && c.key ? JSON.stringify({ url: c.url, key: c.key, token: d.token, negocio: n.id }) : '';
    if(j === cruceDado) return;
    cruceDado = j;
    try{ A.pagosCruce(j); }catch(e){}
  }
  window.ventoPagosCruceMal = function(err){ if(err === 'dispositivo_no_autorizado' || err === 'sin_permiso') reautorizar(); };

  // ---------- Notificaciones con la app cerrada (Web Push) ----------
  function pushSoportado(){ return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
  function b64aBytes(s){ var t = s.replace(/-/g, '+').replace(/_/g, '/'); t += '==='.slice((t.length + 3) % 4); var b = atob(t), u = new Uint8Array(b.length); for(var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function activarPush(){
    if(!pushSoportado()) return Promise.reject(new Error('Este navegador no permite notificaciones push. En iPhone, primero agrega ORDEVA a la pantalla de inicio.'));
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
  /* 1.65.4: con ORDEVA CERRADA en un computador o una tableta (navegador), el pago solo llega por notificación push. Ningún
     equipo la tenía prendida: se ofrece una vez (y otra a los 3 días si dice «Luego») al dueño, administrador o caja.
     No en la app Android (avisa ella misma) ni en el programa de PC (sigue trabajando junto al reloj). */
  var K_PUSH_LUEGO = 'vento-push-luego';
  function sugerirPush(){
    var n = negocio(); if(!n || !puedeCaja() || window.VentoAndroid || /VentoPC\//.test(navigator.userAgent || '')) return;
    var prueba = false; try{ prueba = localStorage.getItem('vento-push-prueba') === '1'; }catch(e){}
    if(location.protocol !== 'https:' && !prueba) return;   // solo en ORDEVA de verdad (en las pruebas locales no estorba)
    if(Date.now() < (Number(lsGet(K_PUSH_LUEGO, 0)) || 0) || document.hidden || typeof window.showConfirm !== 'function') return;
    // iPhone / iPad: Safari solo deja las notificaciones push si ORDEVA está en la pantalla de inicio (iOS 16.4 o más).
    var ios = /iPhone|iPad|iPod/.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var instalada = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
    if(ios && !instalada){
      lsSet(K_PUSH_LUEGO, Date.now() + 3 * 864e5);
      window.showConfirm({ icon: '📲', title: 'Para que los pagos te lleguen en este iPhone o iPad', confirmText: 'Entendido', cancelText: 'Luego',
        message: 'Con la pantalla bloqueada, el iPhone solo avisa si ORDEVA está en la pantalla de inicio. En Safari toca Compartir (el cuadro con la flecha) → «Agregar a pantalla de inicio». Luego abre ORDEVA desde ese icono y acepta las notificaciones.' });
      return;
    }
    if(!pushSoportado() || pushActivo() || Notification.permission === 'denied') return;
    lsSet(K_PUSH_LUEGO, Date.now() + 3 * 864e5);
    window.showConfirm({ icon: '🔔', title: 'Que los pagos te lleguen aunque cierres ORDEVA', confirmText: 'Sí, avisarme', cancelText: 'Luego',
      message: 'En este equipo, cuando te paguen te sale el aviso al instante aunque ORDEVA esté cerrada (como en el celular). El navegador te va a pedir permiso: toca «Permitir».' })
      .then(function(ok){ if(ok) activarPush().then(function(){ toast('🔔 Listo: en este equipo te llegan los pagos aunque ORDEVA esté cerrada.', 6000); }, function(e){ toast(e.message, 9000); }); });
  }
  window.ventoPagosSugerirPush = sugerirPush;

  // ---------- Pagos que llegan del servidor ----------
  var cache = lsGet(K_CACHE, {});          // id → pago (últimos 150)
  var oyentes = [];                        // ventanas de cobro abiertas
  function guardarCache(){ var ks = Object.keys(cache); if(ks.length > 150){ ks.sort(function(a, b){ return String(cache[a].actualizado_en).localeCompare(String(cache[b].actualizado_en)); }).slice(0, ks.length - 150).forEach(function(k){ delete cache[k]; }); } lsSet(K_CACHE, cache); }
  function puedeCaja(){ var n = negocio(); return n && ['dueno', 'admin', 'cajero'].indexOf(n.rol) >= 0; }
  function esJefePagos(){ var n = negocio(); return !!n && (n.rol === 'dueno' || n.rol === 'admin'); }

  function regLocal(p){
    if(typeof data === 'undefined' || !data) return null;
    if(!data.pagos) data.pagos = { on: false, topic: '', lista: [], vistos: [], espera: {} };
    var g = data.pagos; g.lista = g.lista || [];
    var id = 'srv-' + p.id, x = g.lista.find(function(y){ return y.id === id || y.srv === p.id; });
    // Un aviso que este mismo celular ya leyó por MacroDroid (y reenvió al servidor) no se duplica: se enlaza.
    if(p.proveedor === 'dispositivo' && !(x && leidoAqui(x))){
      var tp = Date.parse(p.creado_en || p.actualizado_en) || Date.now();
      // Un SMS se enlaza con el SMS y un aviso de la app con el de la app (el mismo pago puede llegar por los dos).
      // 1.55.0: a quien no es dueño ni administrador el servidor no le da el texto del banco, solo si fue SMS («sms»).
      var smsP = p.sms != null ? !!p.sms : /\bSMS\b/.test(String(p.detalle || '')),
        smsY = function(y){ return y.sms != null ? !!y.sms : /\bSMS\b/.test(String((window.pagoDet ? window.pagoDet(y).fuente : y.fuente) || '')); };
      // 1.50.0: la copia «srv-…» que bajó de la nube (la registró la tablet o el computador) NO es de este celular; si
      // este celular tiene su propio registro de ese pago (lo leyó y ya sonó aquí), vale el suyo y la copia sobra.
      // Antes el celular que leyó el pago a veces lo volvía a anunciar como si viniera de otro equipo.
      var otra = x;
      x = g.lista.find(function(y){ return y !== otra && (!y.srv || y.srv === p.id) && (!otra || leidoAqui(y)) && Number(y.monto) === Number(p.monto) && Math.abs((y.t || 0) - tp) < 3 * 60e3 && String(y.app || '').toUpperCase().replace('TRANSFERENCIA', '') === String(nombreMetodo(p.metodo)).toUpperCase().replace('TRANSFERENCIA', '') && smsY(y) === smsP; });
      if(x){ x.srv = p.id; if(otra){ g.lista = g.lista.filter(function(y){ return y !== otra; }); if(otra.aplicado && !x.aplicado) x.aplicado = otra.aplicado; } return x; }
      x = otra;
    }
    var fuente = p.verificado ? 'Verificado por ' + entidad(p, true) + (p.aprobacion ? ' · N.º ' + p.aprobacion : '') : (p.detalle || 'Aviso del celular');
    if(!x){
      x = { id: id, srv: p.id, t: Date.parse(p.aprobado_en || p.actualizado_en || p.creado_en) || Date.now(), monto: Number(p.monto), app: nombreMetodo(p.metodo), de: p.pagador || '', mesa: p.mesa ? (isNaN(+p.mesa) ? p.mesa : +p.mesa) : null,
        estado: p.confianza === 'revisar' ? 'revisar' : p.confianza === 'falso' ? 'falso' : 'app', fuente: fuente, txt: (p.referencia || '').slice(0, 60) };
      if(p.proveedor === 'dispositivo') x.sms = p.sms != null ? !!p.sms : /\bSMS\b/.test(String(p.detalle || ''));
      g.lista.unshift(x); g.lista = g.lista.slice(0, 200);
    } else if(x.estado === 'revisar' && p.confianza === 'ok'){ x.estado = 'ok'; }
    if(p.aplicado_en && !x.aplicado) x.aplicado = p.aplicado_mesa ? (isNaN(+p.aplicado_mesa) ? p.aplicado_mesa : +p.aplicado_mesa) : true;
    if(p.estado === 'anulado') x.estado = 'falso', x.fuente = 'Anulado por ' + entidad(p);
    return x;
  }

  // App Android: aviso del celular con sonido aunque ORDEVA esté cerrada o la pantalla apagada (en el navegador
  // eso lo hace el push). Si la ventana de ORDEVA se está viendo, no hace falta (ya sale en pantalla).
  function avisoCelular(titulo, texto){ try{ window.VentoAndroid && window.VentoAndroid.notificar && window.VentoAndroid.notificar(titulo, texto, 'pedidos', false); }catch(e){} }
  // ¿Este aviso es para quien usa este celular? Solo el dueño, los administradores y quien está cobrando o atiende esa
  // mesa (mesero, empleado o cajero). A los demás no les sale ni les suena (antes les llegaba a todos repetido).
  function paraMi(p, x){
    try{ return !window.ventoPagoParaMi || window.ventoPagoParaMi(Number(p.monto), p.mesa || p.aplicado_mesa || (x && x.mesa) || null); }catch(e){ return true; }
  }
  // Un pago que leyó OTRO equipo del negocio (o que confirmó el banco) sale aquí igual que uno leído en este celular:
  // en la app Android, la notificación de pagos con la 🪟 ventana del valor (también con el celular bloqueado); en el
  // computador o la tablet, la ventana en ORDEVA y, con ORDEVA de fondo, la notificación del navegador.
  function avisoPagoCompleto(p, x, nivel){
    var tit = nivel === 'falso' ? '🚨 Mensaje de pago FALSO: ' + plata(p.monto) : nivel === 'revisar' ? '⚠️ Aviso de ' + plata(p.monto) + ': revísalo' : '💜 Recibiste ' + plata(p.monto) + ' por ' + nombreMetodo(p.metodo);
    var fr = 'Recibiste ' + p.monto + ' pesos por ' + nombreMetodo(p.metodo) + (p.pagador ? ', de ' + p.pagador : '') + '.' + (p.mesa ? ' ' + etiquetaMesa(p.mesa) + '.' : '');
    var orig = (p.verificado ? '✅ Verificado' + (p.aprobacion ? ' (N.º ' + p.aprobacion + ')' : '') : String(p.detalle || '')).slice(0, 200);
    var A = window.VentoAndroid, apagado = window.ventoAvisoOn && !window.ventoAvisoOn('pagos');
    if(A && A.pagoNotificar){
      if(!apagado) try{ A.pagoNotificar(tit.slice(0, 80), fr, orig, plata(p.monto), nombreMetodo(p.metodo), nivel); }catch(e){}
      return true;
    }
    if(A) return false;                                    // app Android vieja: el aviso de siempre
    try{ if(document.visibilityState === 'visible' && window.ventoPagoVentana) window.ventoPagoVentana({ monto: Number(p.monto), app: nombreMetodo(p.metodo), de: p.pagador || '', mesa: p.mesa ? etiquetaMesa(p.mesa) : '', txt: orig, nivel: nivel }); }catch(e){}
    if(!apagado && document.visibilityState !== 'visible') try{
      if('Notification' in window && Notification.permission === 'granted'){
        var op = { body: fr, tag: 'pago-' + p.id, renotify: true, icon: 'icons/ordeva-192.png', badge: 'icons/ordeva-64.png' };
        if(navigator.serviceWorker && navigator.serviceWorker.getRegistration) navigator.serviceWorker.getRegistration().then(function(r){ if(r) r.showNotification(tit, op); else new Notification(tit, op); }).catch(function(){ try{ new Notification(tit, op); }catch(e){} });
        else new Notification(tit, op);
      }
    }catch(e){}
    return true;
  }
  // ¿Android hace sonar los pagos de este equipo? Su revisión (Cruce) respondió bien hace poco y aquí es dueño o
  // administrador (Android solo anuncia a ellos; al cajero le suena la página, como antes).
  function androidSuena(){
    try{
      var A = window.VentoAndroid, n = negocio(), e = JSON.parse(A.pagosCruceEstado() || '{}');
      return !!n && (n.rol === 'dueno' || n.rol === 'admin') && e.ok === true && Date.now() - Number(e.t || 0) < 20000;
    }catch(x){ return false; }
  }
  function avisar(p, x, enPantalla){
    if(!paraMi(p, x)) return;
    // Mesero, empleado o cajero: solo «✅ Mesa 3 ya pagó», sin el valor ni quién pagó.
    try{ if(window.ventoConfirma && window.ventoConfirma.mesero(x || p)) return; }catch(e){}
    var m = (p.mesa ? ' · ' + etiquetaMesa(p.mesa) : '');
    var nivel = p.confianza === 'falso' ? 'falso' : p.confianza === 'revisar' ? 'revisar' : 'ok';
    // En este equipo no suenan (lo eligió el administrador): solo se ve, sin voz, sonido ni notificación.
    if(!suenaAqui()){ toast('🔕 ' + (nivel === 'falso' ? 'Pago FALSO: ' : nivel === 'revisar' ? 'Pago por revisar: ' : 'Pago confirmado · ') + plata(p.monto) + ' por ' + nombreMetodo(p.metodo) + m, 9000); return; }
    var A0 = window.VentoAndroid;
    /* 1.65.7: en la app Android SUENA ANDROID, con ORDEVA abierta o no (igual que con el celular bloqueado, que es lo que
       siempre funcionó): la página le avisa que hay un pago nuevo (pagosCruceYa) y Android pregunta en ese instante y lo
       dice con su voz, su notificación y su 🪟 ventana. Antes, con ORDEVA abierta, la página lo reclamaba y lo sonaba ella,
       y si algo de la página fallaba, ese pago quedaba en silencio (Xiaomi desbloqueado). Aquí solo se ve. */
    if(A0 && A0.pagosCruceYa && androidSuena()){
      var ya = false; try{ ya = A0.pagosCruceYa(); }catch(e){}
      if(ya){
        toast((nivel === 'falso' ? '🚨 Pago FALSO: ' : nivel === 'revisar' ? '⚠️ Pago por revisar: ' : '✅ Pago confirmado · ') + plata(p.monto) + ' por ' + nombreMetodo(p.metodo) + m, 9000);
        if(nivel === 'ok') try{ window.mesoraCelebrar && window.mesoraCelebrar(['💜', '💰', '✨']); }catch(e){}
        return;
      }
    }
    // Cada pago suena UNA vez: si Android ya lo anunció (Cruce, con la página dormida), aquí solo se muestra.
    if(A0 && A0.pagoReclamar){ var mio = true; try{ mio = A0.pagoReclamar(String(p.id)); }catch(e){}
      if(!mio){ toast((nivel === 'falso' ? '🚨 Pago FALSO: ' : nivel === 'revisar' ? '⚠️ Pago por revisar: ' : '✅ Pago confirmado · ') + plata(p.monto) + ' por ' + nombreMetodo(p.metodo) + m, 9000); return; } }
    if(enPantalla && document.visibilityState === 'visible'){}         // ya lo muestra la pantalla «Esperando el pago»
    else if(!avisoPagoCompleto(p, x, nivel))
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
      hablarPago('Llegó un aviso de ' + p.monto + ' pesos por ' + nombreMetodo(p.metodo) + '. Revísalo en la aplicación del banco antes de entregar.');
      return;
    }
    // Como el parlante de Bold: sonido de éxito y «Pago confirmado» en voz alta.
    toast('✅ Pago confirmado · ' + plata(p.monto) + ' por ' + nombreMetodo(p.metodo) + (p.pagador ? ' de ' + p.pagador : '') + m + (p.aprobacion ? ' · N.º ' + p.aprobacion : ''), 9000);
    try{ window.ventoSonidos && window.ventoSonidos.success(); }catch(e){}
    hablarPago('Llegaron ' + p.monto + ' pesos por ' + nombreMetodo(p.metodo) + (p.mesa ? ', de la ' + etiquetaMesa(p.mesa) : ''));   // la cantidad, sin el nombre
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

  // ¿Ese aviso lo leyó ESTE equipo (y ya sonó aquí)? La lista de pagos se copia a los demás equipos del negocio: antes
  // la tablet o el computador encontraban ahí el pago que leyó el celular, creían que ya lo habían avisado ellos y no
  // sonaba ni salía la ventana.
  function leidoAqui(x){ try{ return !!x && !!x.eq && !!window.ventoPagosEquipo && x.eq === window.ventoPagosEquipo(); }catch(e){ return false; } }
  function recibir(p, enVivo){
    if(!p || !p.id) return;
    var antes = cache[p.id];
    cache[p.id] = Object.assign({}, antes || {}, p); guardarCache();
    oyentes.forEach(function(f){ try{ f(cache[p.id]); }catch(e){} });
    var nuevoAprobado = p.estado === 'aprobado' && (!antes || antes.estado !== 'aprobado');
    if(p.estado !== 'aprobado' && !(p.estado === 'rechazado' && p.confianza === 'falso') && p.estado !== 'anulado') { pintarHistorial(); return; }
    // Un aviso que leyó un celular: si fue ESTE, Android ya lo dijo y lo tiene en su cola para la página. Se toma la cola
    // ANTES de decidir, así se enlaza con el de este equipo y no suena dos veces (1.50.0: con la revisión más rápida, el
    // servidor a veces le ganaba a la cola y el celular que lo leyó lo volvía a anunciar como si fuera de otro equipo).
    if(enVivo && p.proveedor === 'dispositivo' && window.VentoAndroid) try{ window.ventoAvisosNativos && window.ventoAvisosNativos(); }catch(e){}
    var x = regLocal(p); if(!x){ return; }
    try{ saveData(); }catch(e){}
    // ⏳ «Esperando el pago» abierta aquí, o el mismo pago por SMS y por la app (lib/vento-confirma.js).
    var vc = null;
    if(nuevoAprobado && enVivo && !leidoAqui(x)){ try{ vc = window.ventoConfirma ? window.ventoConfirma.llego(x, p) : null; }catch(e){} }
    if(vc === 'duplicado' || vc === 'junto'){ try{ saveData(); }catch(e){} pintarHistorial(); return; }
    if(nuevoAprobado && enVivo && !leidoAqui(x)) avisar(p, x, !!vc);
    else if(p.estado === 'rechazado' && p.confianza === 'falso' && !antes && enVivo) avisar(p, x);
    pintarHistorial();
    try{ window.layaPintarTarjeta && window.layaPintarTarjeta(); }catch(e){}
    if(p.estado !== 'aprobado' || p.aplicado_en || p.confianza === 'falso' || p.confianza === 'revisar' || !puedeCaja()) return;
    var mesa = p.mesa && data.tables && data.tables[p.mesa] ? p.mesa : null;
    if(mesa) aplicarEnMesa(p, x, isNaN(+mesa) ? mesa : +mesa);
    else if(nuevoAprobado && enVivo && !leidoAqui(x) && paraMi(p, x)){ try{ window.pagoLlego && window.pagoLlego(x); }catch(e){} }
  }

  // Los avisos que llegan por MacroDroid (canal privado de ORDEVA) también se mandan al Servidor ORDEVA:
  // quedan guardados en la nube, se cruzan entre celulares sin duplicarse y avisan con push aunque ORDEVA esté cerrada.
  // Con el ID del aviso: así dos pagos iguales seguidos (mismo valor y persona) llegan como DOS a los demás celulares.
  // Con lo que entendió la página (pista: valor, banco, quién y si es confiable): el servidor lo usa cuando su propia
  // lectura no entiende el aviso, así le llega a los demás equipos igual que aquí.
  // Si no hay internet en ese momento (o el celular todavía no está registrado), queda en espera y se vuelve a mandar
  // apenas se pueda (hasta 30 min): antes se perdía y los demás equipos nunca se enteraban.
  var K_REENV = 'vento_pagos_reenvio', mandando = false;
  function cuerpoAviso(r){
    var j = { text: String(r.txt).slice(0, 1000) };
    if(r.id) j.id = String(r.id).slice(0, 160);
    // En su propio objeto: un servidor de antes no lo conoce y lo deja pasar (un «app» suelto lo confundía).
    if(r.pista && Number(r.pista.monto) > 0) j.pista = { monto: Math.round(Number(r.pista.monto)), app: String(r.pista.app || '').slice(0, 40), de: String(r.pista.de || '').slice(0, 80), nivel: String(r.pista.nivel || '').slice(0, 10) };
    return r.id || j.pista ? JSON.stringify(j) : j.text;
  }
  function mandarPendientes(){
    var l = lsGet(K_REENV, []); if(!l.length || mandando) return;
    l = l.filter(function(r){ return Date.now() - (r.t || 0) < 30 * 60e3; });
    if(!l.length){ lsSet(K_REENV, []); return; }
    var d = miDispositivo();
    if(!d){ if(negocio() && !est.revocado) registrarDispositivo(false).catch(function(){}); lsSet(K_REENV, l); return; }
    mandando = true;
    var r = l[0];
    fetch(base() + '/aviso/' + d.token, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: cuerpoAviso(r), keepalive: true })
      .then(function(res){
        if(res.status === 401){ est.revocado = true; mandando = false; reautorizar(); return Promise.reject(new Error('reautorizar')); }
        return res.status >= 500 ? Promise.reject(new Error('http ' + res.status)) : res;
      })
      .then(function(){ est.servidor = true; var q = lsGet(K_REENV, []).filter(function(y){ return !(y.t === r.t && y.txt === r.txt); }); lsSet(K_REENV, q); mandando = false; if(q.length) mandarPendientes(); })
      .catch(function(){ mandando = false; });
  }
  window.ventoPagosReenviarAviso = function(txt, id, pista){
    if(!negocio() || !puedeCaja() || !txt) return;
    var l = lsGet(K_REENV, []);
    l.push({ txt: String(txt).slice(0, 1000), id: id ? String(id) : '', pista: pista || null, t: Date.now() });
    lsSet(K_REENV, l.slice(-30));
    try{ mandarPendientes(); }catch(e){}
  };

  // Al registrar a mano desde «Llegó un pago», el servidor también lo marca (y otro celular ya no lo repite).
  window.ventoPagosAntesDeRegistrar = function(x, mesa){
    if(!x || !x.srv || !negocio()) return Promise.resolve(true);
    var d = miDispositivo();
    return rpc('aplicar_pago', { p_pago: x.srv, p_mesa: String(mesa), p_dispositivo: d ? d.id : null }).catch(function(){ return true; });
  };

  function sincronizar(){
    var n = negocio(); if(!n) return Promise.resolve();
    // 1.65.4: si ya hay una pregunta en camino, se pregunta otra vez apenas termine (el aviso en vivo puede llegar justo
    // después de que esa pregunta salió, y el pago nuevo no venía en ella).
    if(est.revisando){ est.otraVez = true; return Promise.resolve(); }
    est.revisando = true;
    var desde = lsGet(K_VISTO, {})[n.id] || null;
    return rpc('pagos_desde', { p_negocio: n.id, p_desde: desde, p_limite: 200 }).then(function(l){
      var max = desde;
      (l || []).forEach(function(p){ recibir(p, !!desde && Date.parse(p.actualizado_en) > Date.now() - 15 * 60e3); if(!max || p.actualizado_en > max) max = p.actualizado_en; });
      var v = lsGet(K_VISTO, {}); v[n.id] = max || new Date(Date.now() - 2 * 864e5).toISOString(); lsSet(K_VISTO, v);
      est.ultimoSync = Date.now();
    }).catch(function(){}).then(function(){ est.revisando = false; if(est.otraVez){ est.otraVez = false; sincronizar(); } });
  }

  /* ⚡ 1.65.4: el pago llega AL MISMO TIEMPO a todos los equipos (celulares, computador, tabletas, navegador). El servidor
     avisa por el canal secreto del negocio («vp-…», Supabase Realtime) apenas un pago queda aprobado, y aquí se trae en
     ese instante. Es el mismo aviso que usa la app Android (EnVivo.java). Sirve para todos los roles (antes la caja y los
     empleados preguntaban cada 6 s) y no depende del permiso de la tabla de pagos. Si se cae, se vuelve a conectar a los
     3 s (no a los 15). La pregunta cada 6 / 20 s sigue de respaldo. */
  /* 🔔 1.65.6: «Probar» en la lista de equipos: el servidor manda la prueba por el canal en vivo solo para ESE equipo
     (dispositivo_probar). Suena igual que un pago de verdad (ventana o notificación, sonido y voz), sin crear ningún
     pago. En «🔕 NO SUENA» no suena: así se comprueba que apagar y volver a prender el sonido funciona. En la app Android
     la atiende Android mismo (también con el celular bloqueado). */
  function probarAqui(){
    // Se pregunta otra vez si este equipo suena (el dueño pudo cambiarlo hace un segundo).
    return revisarSuena(true).catch(function(){}).then(probarYa);
  }
  function probarYa(){
    if(!suenaAqui()){ toast('🔕 Llegó la prueba, pero en este equipo los pagos están en «NO SUENA». Préndelo en la lista de equipos para que suene.', 9000); return; }
    toast('🧪 Prueba: Recibiste $1.000 por Nequi. Así suena un pago en este equipo.', 9000);
    try{ window.ventoSonidos && window.ventoSonidos.success(); }catch(e){}
    hablarPago('Prueba de ORDEVA. Llegaron mil pesos por Nequi.');
    try{ avisoPagoCompleto({ id: 'prueba-' + Date.now(), monto: 1000, metodo: 'NEQUI', pagador: '', mesa: null, confianza: 'app', detalle: 'Prueba de ORDEVA' }, null, 'ok'); }catch(e){}
  }
  window.ventoPagosProbarAqui = probarAqui;
  function conectarAvisoVivo(){
    var n = negocio(); if(!n || est.avisoVivo) return;
    est.avisoVivo = 'conectando';
    rpc('pagos_canal_vivo', { p_negocio: n.id }).then(function(t){
      if(!/^vp-[0-9a-f]{32}$/.test(String(t || ''))) throw new Error('sin_canal');
      return nube().cliente().then(function(c){
        if(!c.channel) throw new Error('sin_tiempo_real');
        var cerrado = false, ch = c.channel(t, { config: { broadcast: { self: false, ack: false }, private: false } });
        est.avisoVivo = ch;
        ch.on('broadcast', { event: 'p' }, function(){ est.ultimoAvisoVivo = Date.now(); sincronizar(); })
          .on('broadcast', { event: 'prueba' }, function(m){ var d = miDispositivo(), x = m && (m.payload || m); if(!window.VentoAndroid && d && x && x.d === d.id){ if(typeof x.s === 'boolean') lsSet(K_SUENA, x.s); probarAqui(); } })
          .subscribe(function(st){
            if(st === 'SUBSCRIBED'){ est.avisoVivoOk = true; sincronizar(); return; }   // recién conectado: lo que llegó sin conexión
            if(cerrado || !(st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' || st === 'CLOSED')) return;
            cerrado = true; est.avisoVivoOk = false;
            if(est.avisoVivo === ch) est.avisoVivo = null;
            try{ Promise.resolve(c.removeChannel(ch)).catch(function(){}); }catch(e){}
            setTimeout(conectarAvisoVivo, 3000);
          });
      });
    }).catch(function(){ if(est.avisoVivo === 'conectando') est.avisoVivo = null; setTimeout(conectarAvisoVivo, 15000); });
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
  var ultimoLatido = 0;
  function vigilar(){
    var n = negocio(); if(!n){ cruceAndroid(); return; }
    cruceAndroid();
    // «Visto hace…» en «📱 Celulares autorizados»: así el chequeo sabe qué equipos están escuchando.
    if(Date.now() - ultimoLatido > 60e3 && (!document.hidden || est.vivo)){ ultimoLatido = Date.now(); latido(null); }
    try{ mandarPendientes(); }catch(e){}
    if(est.servidor && !document.hidden && hayPendientes() && Date.now() - (est.ultimoApiSync || 0) > 10000){ est.ultimoApiSync = Date.now(); api('sync', { negocio: n.id }).then(function(){ return sincronizar(); }).catch(function(){}); return; }
    // También con ORDEVA de fondo o el celular bloqueado: si el tiempo real se cayó (Android lo corta cuando duerme), se
    // pregunta cada 6 s (1.50.0; antes 20 s); y aunque diga que está vivo, cada 20 s (antes cada minuto), por si quedó
    // colgado sin avisar. «Que llegue en todo, siempre, y más rápido».
    // 1.55.0: quien no es dueño ni administrador ya no recibe en tiempo real los pagos de otros (sin los datos de quien
    // paga, el servidor solo se los da al preguntar): para él se pregunta cada 6 s siempre.
    if(Date.now() - est.ultimoSync > (est.vivo && esJefePagos() ? 20000 : 6000)) sincronizar();
    if(!est.canal && Date.now() - (est.intentoCanal || 0) > 30000){ est.intentoCanal = Date.now(); conectarTiempoReal(); }
    if(!est.avisoVivo && Date.now() - (est.intentoAviso || 0) > 10000){ est.intentoAviso = Date.now(); conectarAvisoVivo(); }
  }
  // La app Android despierta la página cada 5 s (window.ventoLatido): con ORDEVA cerrada Android frena los relojes de la
  // página hasta 1 vez por minuto, y los pagos de los otros equipos llegarían tarde.
  var ultimoPulso = 0;
  window.ventoPagosLatido = function(){ if(Date.now() - ultimoPulso < 4500) return; ultimoPulso = Date.now(); try{ vigilar(); }catch(e){} };

  function arrancar(){
    if(!negocio()) return;
    salud().then(function(ok){
      registrarDispositivo(false).then(function(){ cruceAndroid(); revisarSuena(true); setTimeout(nombrarEsteEquipo, 3000); return latido(null); }).catch(function(){});
      sincronizar().then(conectarTiempoReal);
      conectarAvisoVivo();
      setTimeout(function(){ try{ sugerirPush(); }catch(e){} }, 20000);
      if(ok) crearBotonCuenta();
    });
  }
  setInterval(vigilar, 5000);
  setInterval(function(){ if(negocio()){ latido(null); revisarSuena(true); } }, 5 * 60e3);
  window.addEventListener('vento-aviso-vivo', function(){ if(negocio()) setTimeout(function(){ revisarSuena(true); }, 300); });   // el administrador lo cambió
  window.addEventListener('online', function(){ if(negocio()){ mandarPendientes(); sincronizar(); conectarTiempoReal(); if(!est.avisoVivo) conectarAvisoVivo(); } });
  document.addEventListener('visibilitychange', function(){ if(!document.hidden && negocio()){ sincronizar(); revisarSuena(false); } });
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
    '.vp-eq-ayuda{font-size:13px;color:var(--ink-soft);padding:2px 0 8px;line-height:1.4}' +
    '.vp-eq-grupo{font-size:12px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-soft);margin:12px 2px 6px}' +
    '.vp-eq-viejos{margin-top:12px}.vp-eq-viejos summary{cursor:pointer;font-weight:700;padding:6px 0}.vp-eq-viejos .vp-eq{opacity:.75}.vp-eq-viejos [data-rev-viejos]{margin:6px 0 10px}' +
    '#vpDevs .vp-eq{display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;padding:10px 12px;margin:0 0 8px;border:1px solid var(--line);border-top:1px solid var(--line);border-radius:12px;justify-content:flex-start}' +
    '#vpDevs .vp-eq.este{border-color:var(--accent,#8b5cf6);box-shadow:0 0 0 1px var(--accent,#8b5cf6) inset}' +
    '.vp-eq-txt{flex:1 1 180px;min-width:0}.vp-eq-txt b{font-size:15px;word-break:break-word}.vp-eq-txt small{margin-top:2px}' +
    '.vp-eq-este{display:inline-block;margin-left:6px;padding:1px 7px;border-radius:999px;font-size:11px;font-weight:800;background:var(--accent,#8b5cf6);color:#fff;vertical-align:2px}' +
    '.vp-eq-sw{flex:0 0 auto;min-width:118px;padding:10px 14px;border-radius:12px;font:inherit;font-weight:800;font-size:14px;cursor:pointer;border:2px solid #9a9aa8;background:transparent;color:inherit}' +
    '.vp-eq.on .vp-eq-sw{border-color:#2fbf6b;background:#2fbf6b;color:#04220f}' +
    '.vp-eq-mas{flex:1 1 100%;display:flex;gap:6px;flex-wrap:wrap}.vp-eq-mas .btn-ghost{padding:4px 10px;font-size:13px}' +
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
    var n = negocio(); if(!n) return toast('Conecta ORDEVA Nube y los pagos en Ajustes → 💜 Pagos.');
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
      [cfg, 'ORDEVA Nube configurada', 'Falta: Ajustes → ☁️ Nube y usuarios.'],
      [!!n, 'Sesión iniciada en un negocio', 'Entra con tu correo en ORDEVA Nube.'],
      [est.servidor === true, 'Servidor ORDEVA activo' + (est.version ? ' (v' + est.version + ')' : ''), est.servidor === false ? 'El servidor de pagos aún no está desplegado en tu Supabase (ver abajo).' : 'Comprobando…'],
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
        '<div class="settings-desc">Los pagos llegan al <b>Servidor ORDEVA</b> por una integración autorizada (Wompi, Nequi Conecta o la API de DaviPlata), quedan guardados en la base de datos y aparecen al instante en todos los celulares del negocio. ORDEVA verifica la firma, evita duplicados y los registra solos en la cuenta.</div>' +
        '<div class="vp-cards">' + estadoHtml('NEQUI', r && r.nequi, '🟢') + estadoHtml('DAVIPLATA', r && r.daviplata, '🔵') + '</div>' +
        (admin && est.servidor ? '<div class="mz-actions" style="flex-wrap:wrap"><button type="button" class="btn-primary" id="vpConNequi">Conectar Nequi</button><button type="button" class="btn-primary" id="vpConDavi">Conectar DaviPlata</button>' + (r && (r.nequi.estado === 'conectado' || r.daviplata.estado === 'conectado') ? '<button type="button" class="btn-ghost" id="vpProbar">🔄 Comprobar</button>' : '') + '</div>' : '') +
        chequeos();
      if(est.servidor === false) html += servidorPendienteHtml();
      if(!n) html += '<div class="mz-actions"><button type="button" class="btn-primary" id="vpNube">☁️ Abrir ORDEVA Nube</button></div>';
      if(n && est.servidor){
        html += '<div class="mz-actions" style="flex-wrap:wrap">' + (pushActivo() ? '' : '<button type="button" class="btn-ghost" id="vpPush">🔔 Activar avisos aunque ORDEVA esté cerrada</button>') +
          ((!miDispositivo() || est.revocado) ? '<button type="button" class="btn-ghost" id="vpAutorizar">📱 Autorizar este celular</button>' : '') + '</div>';
        if(admin && info.webhook_wompi) html += '<div class="settings-row" style="flex-direction:column;align-items:stretch;gap:6px"><div class="settings-row-text"><strong>Eventos de Wompi ' + (r.webhook === 'recibiendo' ? '<span class="vp-ok">✅ recibiendo</span>' : '<span class="vp-pend">⏳ esperando el primero</span>') + '</strong><span>Pégala una vez en Wompi → Desarrolladores → «URL de Eventos». Mientras tanto ORDEVA consulta el estado de cada cobro, así que igual funciona.</span></div><input class="mz-in vp-url" readonly id="vpHook" value="' + esc(info.webhook_wompi) + '"><div class="mz-actions"><button type="button" class="btn-ghost" id="vpCopHook">📋 Copiar URL de eventos</button><a class="btn-ghost" href="https://comercios.wompi.co" target="_blank" rel="noopener">Abrir Wompi</a></div></div>';
        html += '<div class="settings-row" style="flex-direction:column;align-items:stretch"><div class="settings-row-text"><strong>Últimos pagos en el servidor</strong></div><div class="vp-hist" id="vpHist"></div></div>';
        if(admin) html += '<div class="settings-row" style="flex-direction:column;align-items:stretch"><div class="settings-row-text"><strong>🔊 Celulares y dónde suenan los pagos</strong><span>Cada celular, tablet o computador de tu negocio, con su marca y modelo. El tuyo dice <b>ESTE CELULAR</b>.</span></div><div class="vp-hist" id="vpDevs">Cargando…</div><div class="settings-desc" id="vpDevsAviso"></div></div>';
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
    return '<details class="settings-desc" open><summary><b>Activar el Servidor ORDEVA (una sola vez)</b></summary><p style="margin:8px 0 0">El código del servidor ya está listo en el proyecto (carpeta <b>supabase/</b>) y se despliega solo con GitHub. Solo falta autorizarlo, porque esas llaves son de tu cuenta:</p><ol style="margin:6px 0 0;padding-left:20px;line-height:1.55">' +
      '<li>En Supabase → tu foto → <b>Account → Access Tokens</b> crea un token.</li>' +
      '<li>En GitHub → el repositorio de ORDEVA → <b>Settings → Secrets and variables → Actions</b> agrega: <b>SUPABASE_ACCESS_TOKEN</b> (el token), <b>SUPABASE_PROJECT_REF</b> (lo que va antes de .supabase.co en tu URL) y <b>SUPABASE_DB_PASSWORD</b> (la contraseña que pusiste al crear el proyecto).</li>' +
      '<li>En GitHub → <b>Actions → «Servidor ORDEVA» → Run workflow</b>. Crea las tablas, sube el servidor y conecta todos los celulares solo.</li></ol><p style="margin:6px 0 0">Cuando termine, vuelve aquí: esta pantalla lo detecta sola.</p></details>';
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
    if(q('vpPush')) q('vpPush').onclick = function(){ activarPush().then(function(){ toast('🔔 Listo: te avisamos de cada pago aunque ORDEVA esté cerrada.'); pintarAjustes(); }).catch(function(e){ toast(e.message, 9000); }); };
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
    // dispositivos_lista (1.62.0) trae «suena»; si el servidor todavía no la tiene, la de antes.
    rpc('dispositivos_lista', { p_negocio: n.id }).catch(function(){ return rpc('mis_dispositivos', { p_negocio: n.id }); }).then(function(l){
      var mio = miDispositivo(), conSuena = (l || []).some(function(d){ return typeof d.suena === 'boolean'; });
      /* 1.65.6: solo los equipos de verdad. Arriba los de TU cuenta que se están usando; luego los de tus empleados (si
         hay); y aparte, cerrados, los viejos (más de 14 días sin abrir ORDEVA), los repetidos (el mismo equipo registrado
         otra vez al reinstalar) y los de cuentas que ya no están en el negocio, con «🧹 Retirar los viejos». */
      var ahora = Date.now(), DIA = 864e5, vistos = {};
      l = (l || []).map(function(d){ var ms = ahora - (Date.parse(d.ultimo_visto) || 0); return Object.assign({}, d, { ms: ms, este: !!(mio && mio.id === d.id), nombreV: nombreVer(d) }); })
        .sort(function(x, y){ return (y.este - x.este) || (x.ms - y.ms); });
      l.forEach(function(d){
        var clave = (d.propio ? 'yo' : d.usuario || '') + '|' + d.nombreV.replace(/^\S+\s/, '').split(' · ')[0];   // el modelo, sin «· Chrome»
        // el mismo modelo otra vez (al reinstalar se registra de nuevo): el que lleva más de 2 días sin usarse. Dos celulares
        // iguales que se usan los dos no se esconden; con nombre propio (🏷️) tampoco.
        d.repetido = !d.este && !!vistos[clave] && d.ms > 2 * DIA && !/^🏷️/.test(d.nombreV); vistos[clave] = 1;
        d.huerfano = !d.propio && 'rol' in d && !d.rol;   // de una cuenta que ya no está en el negocio
        d.viejo = !d.este && (d.huerfano || d.ms > 14 * DIA || d.repetido);
      });
      var mios = l.filter(function(d){ return !d.viejo && (d.propio || d.este); }), otros = l.filter(function(d){ return !d.viejo && !d.propio && !d.este; }), viejos = l.filter(function(d){ return d.viejo; });
      var fila = function(d){
        var suena = d.suena !== false, ms = d.ms, compu = /^💻/.test(d.nombreV);
        var estado = ms < 2 * 60e3 ? '🟢 Conectado ahora' : ms < 30 * 60e3 ? '🟡 Visto ' + haceTxt(ms) : '⚪ Visto ' + haceTxt(ms) + ' (cerrado o dormido: no va a sonar)';
        return '<div class="vp-eq' + (d.este ? ' este' : '') + (suena ? ' on' : '') + '">' +
          '<div class="vp-eq-txt"><b>' + esc(d.nombreV) + '</b>' + (d.este ? '<span class="vp-eq-este">' + (compu ? 'ESTE EQUIPO' : 'ESTE CELULAR') + '</span>' : '') +
          '<small>' + estado + (d.propio || d.este ? '' : ' · ' + esc(d.usuario || '') + ' (' + nombreRol(d.rol) + ')') + '</small></div>' +
          (conSuena ? '<button type="button" class="vp-eq-sw" data-suena="' + esc(d.id) + '" data-v="' + (suena ? '0' : '1') + '" aria-pressed="' + suena + '">' + (suena ? '🔊 SUENA' : '🔕 NO SUENA') + '</button>' : '') +
          '<span class="vp-eq-mas"><button type="button" class="btn-ghost" data-probar="' + esc(d.id) + '" data-nombre="' + esc(d.nombreV) + '" title="Hace sonar un pago de prueba en ese equipo (no crea ningún pago)">🔔 Probar</button>' +
          '<button type="button" class="btn-ghost" data-nom="' + esc(d.id) + '" data-actual="' + esc(nombreAuto(d.nombre) || nombreDetectado(d.nombre) ? '' : d.nombre) + '" title="Ponerle nombre (ej. Caja, Celular de Ana)">✏️ Nombre</button>' +
          '<button type="button" class="btn-ghost" data-rev="' + esc(d.id) + '">Retirar</button></span></div>';
      };
      var viejaFila = function(d){ return '<div class="vp-eq vp-eq-viejo"><div class="vp-eq-txt"><b>' + esc(d.nombreV) + '</b><small>' + (d.huerfano ? 'De una cuenta que ya no está en el negocio' : d.repetido ? 'Repetido (el mismo equipo, registrado otra vez)' : 'Sin abrir ORDEVA') + ' · visto ' + haceTxt(d.ms) + '</small></div><span class="vp-eq-mas"><button type="button" class="btn-ghost" data-rev="' + esc(d.id) + '">Retirar</button></span></div>'; };
      el.innerHTML = '<div class="vp-eq-ayuda">Toca el botón de cada uno para elegir si <b>SUENA</b> (voz, sonido y aviso) cuando llega un pago. En los que no suenan, el pago igual queda en la lista. Con <b>🔔 Probar</b> suena un pago de prueba en ese equipo (no se crea ningún pago).</div>' +
        '<div class="vp-eq-grupo">Tus equipos</div>' + (mios.map(fila).join('') || '<div class="empty-note">Ninguno conectado en estos días.</div>') +
        (otros.length ? '<div class="vp-eq-grupo">De tu equipo de trabajo</div>' + otros.map(fila).join('') : '') +
        (viejos.length ? '<details class="vp-eq-viejos"><summary>🗂️ Equipos viejos o repetidos (' + viejos.length + ')</summary><div class="settings-desc">No se usan: no suenan ni reciben pagos. Puedes retirarlos para que la lista quede limpia.</div>' +
          '<button type="button" class="btn-ghost" data-rev-viejos="' + esc(viejos.map(function(d){ return d.id; }).join(',')) + '">🧹 Retirar los ' + viejos.length + ' viejos</button>' + viejos.map(viejaFila).join('') + '</details>' : '');
      var av = document.getElementById('vpDevsAviso');
      if(av) av.textContent = conSuena && (l || []).length && !(l || []).some(function(d){ return d.suena !== false; }) ? '⚠️ Ningún equipo va a sonar con los pagos: elige al menos uno.' : '';
      el.onclick = function(e){
        var bs = e.target.closest('[data-suena]'), bn = e.target.closest('[data-nom]'), b = e.target.closest('[data-rev]'), bp = e.target.closest('[data-probar]'), bv = e.target.closest('[data-rev-viejos]');
        if(bp){
          bp.disabled = true;
          rpc('dispositivo_probar', { p_dispositivo: bp.dataset.probar }).then(function(ok){
            toast(ok === false ? '⚠️ No se pudo mandar la prueba (el aviso en vivo del servidor no respondió).' : '🔔 Prueba enviada a ' + bp.dataset.nombre + ': debe sonar en un instante (si está en «🔊 SUENA»).', 7000);
          }, function(x){ toast('⚠️ No se pudo: ' + (x && x.message || x), 6000); }).then(function(){ setTimeout(function(){ bp.disabled = false; }, 2000); });
          return;
        }
        if(bv){
          var ids = bv.dataset.revViejos.split(',').filter(Boolean);
          if(!ids.length || !confirm('¿Retirar los ' + ids.length + ' equipos viejos o repetidos? No se usan: no suenan ni reciben pagos.')) return;
          bv.disabled = true;
          Promise.all(ids.map(function(id){ return rpc('revocar_dispositivo', { p_dispositivo: id }).catch(function(){ return null; }); }))
            .then(function(){ toast('🧹 Listo: ' + ids.length + ' equipos viejos retirados.'); pintarDispositivos(); });
          return;
        }
        if(bs){
          bs.disabled = true;
          rpc('dispositivo_sonar', { p_dispositivo: bs.dataset.suena, p_suena: bs.dataset.v === '1' }).then(function(v){
            toast(v ? '🔊 Ahí sí suenan los avisos de pago.' : '🔕 Ahí ya no suenan los avisos de pago (igual llegan a la lista).', 5000);
            if(mio && mio.id === bs.dataset.suena) revisarSuena(true);
            pintarDispositivos();
          }, function(x){ bs.disabled = false; toast('⚠️ No se pudo: ' + (x && x.message || x), 6000); });
          return;
        }
        if(bn){
          var nom = prompt('Nombre para reconocer este equipo (ej. Caja, Barra, Celular de Ana):', bn.dataset.actual || ''); if(nom == null || !nom.trim()) return;
          rpc('dispositivo_nombre', { p_dispositivo: bn.dataset.nom, p_nombre: nom.trim().slice(0, 60) }).then(function(){ pintarDispositivos(); }, function(x){ toast('⚠️ No se pudo: ' + (x && x.message || x), 6000); });
          return;
        }
        if(!b || !confirm('¿Retirar este equipo? Dejará de recibir y mandar avisos de pagos.')) return;
        rpc('revocar_dispositivo', { p_dispositivo: b.dataset.rev }).then(function(){ toast('Equipo retirado.'); pintarDispositivos(); });
      };
    }).catch(function(){ el.textContent = 'No se pudo cargar la lista.'; });
  }

  // ---------- 🩺 Chequeo: ¿les llegan los pagos a todos los equipos? ----------
  // Este equipo (lectura de avisos, voz, servidor, autorizado, avisos por mandar, cómo recibe los de los demás) y cada
  // equipo de la cuenta con «visto hace…»: Android pregunta cada 2,5 s y la página cada minuto, así que un equipo que no se
  // ve hace rato está cerrado o dormido y NO va a sonar.
  function haceTxt(ms){ var s = Math.max(0, Math.round(ms / 1000)); return s < 60 ? 'hace ' + s + ' s' : s < 3600 ? 'hace ' + Math.round(s / 60) + ' min' : s < 86400 ? 'hace ' + Math.round(s / 3600) + ' h' : 'hace ' + Math.round(s / 86400) + ' días'; }
  window.ventoPagosChequeo = function(){
    var ov = ventana('vpChequeo');
    ov.innerHTML = '<div class="modal vp-modal" role="dialog" aria-label="Chequeo de pagos"><h2>🩺 Pagos en todos los equipos</h2><div class="modal-sub">Revisando…</div></div>';
    ov.classList.add('show');
    var n = negocio(), A = window.VentoAndroid;
    var fila = function(ok, t, d, bt){ return '<li><span>' + (ok === true ? '✅' : ok === false ? '❌' : '⚠️') + '</span><span><b>' + t + '</b>' + (d ? '<br><small>' + d + '</small>' : '') + (bt || '') + '</span></li>'; };
    var dev = n ? rpc('mis_dispositivos', { p_negocio: n.id }).catch(function(){ return null; }) : Promise.resolve(null);
    Promise.all([n ? salud() : Promise.resolve(false), dev]).then(function(r){
      var L = [], and = null, cr = null, voz = true;
      try{ and = A && A.pagosAvisosEstado ? JSON.parse(A.pagosAvisosEstado() || '{}') : null; }catch(e){}
      try{ cr = A && A.pagosCruceEstado ? JSON.parse(A.pagosCruceEstado() || '{}') : null; }catch(e){}
      try{ voz = A && A.pagosVozEstado ? !!A.pagosVozEstado() : (window.ventoPagosVozOn ? window.ventoPagosVozOn() : true); }catch(e){}
      if(and) L.push(fila(and.on && and.permiso && and.vivo !== false, '📲 Leer los avisos de Nequi, DaviPlata y Bre-B de este celular',
        and.on && and.permiso && and.vivo !== false ? 'Conectado.' : !and.permiso ? 'Falta el permiso «Acceso a notificaciones» para ORDEVA.' : !and.on ? 'Apagado (Ajustes → Pagos → «Leer los avisos de ESTE celular»), si en este celular tienes Nequi o DaviPlata.' : 'Android lo desconectó: apaga y prende «Acceso a notificaciones» para ORDEVA.'));
      // Con el celular bloqueado: sin ahorro de batería, el servicio de fondo prendido y los pasos de cada marca.
      var pm = null, marca = '';
      try{ pm = A && A.permisos ? JSON.parse(A.permisos() || '{}') : null; }catch(e){}
      try{ marca = A && A.fabricante ? String(A.fabricante() || '').toLowerCase() : ''; }catch(e){}
      if(pm){
        L.push(fila(pm.avisos !== false, '🔔 Notificaciones de ORDEVA', pm.avisos !== false ? 'Permitidas.' : 'Bloqueadas: los pagos no salen en la barra ni con el celular bloqueado.', pm.avisos !== false ? '' : '<br><button type="button" class="btn-ghost" data-ck="perm" style="margin-top:6px">🔓 Permitir</button>'));
        L.push(fila(pm.bateria !== false, '🔋 ORDEVA sin ahorro de batería', pm.bateria !== false ? 'Sí: trabaja con el celular bloqueado.' : 'No: con el celular bloqueado Android la frena y los pagos llegan tarde o no suenan. Elige «Sin restricciones».', pm.bateria !== false ? '' : '<br><button type="button" class="btn-ghost" data-ck="bat" style="margin-top:6px">🔋 Arreglar</button>'));
        L.push(fila(pm.fondo === true, '⚙️ ORDEVA trabajando de fondo', pm.fondo === true ? 'Prendido (aviso fijo de ORDEVA en la barra).' : 'Apagado: los pagos de los otros equipos no van a sonar con el celular bloqueado.'));
        var m = /xiaomi|redmi|poco/.test(marca) ? 'Xiaomi' : /oppo|realme|oneplus/.test(marca) ? 'Oppo / Realme' : /vivo|iqoo/.test(marca) ? 'Vivo' : /huawei|honor/.test(marca) ? 'Huawei / Honor' : /tecno|infinix|itel/.test(marca) ? 'Tecno / Infinix' : /asus/.test(marca) ? 'Asus' : /samsung/.test(marca) ? 'Samsung' : '';
        if(m === 'Samsung') L.push(fila(null, '📱 Samsung', 'Ajustes → Batería → Límites de uso en segundo plano: que ORDEVA NO esté en «Aplicaciones en suspensión» ni «en suspensión profunda».'));
        else if(m) L.push(fila(null, '🚀 ' + m + ': inicio automático', 'Prende «Inicio automático» para ORDEVA (y para Nequi y DaviPlata). Sin eso la marca cierra ORDEVA de fondo.', '<br><button type="button" class="btn-ghost" data-ck="auto" style="margin-top:6px">🚀 Abrir inicio automático</button>'));
      }
      // 1.52.0: qué motor de voz dice los pagos (en Samsung, el de fábrica muchas veces no tiene español).
      var motor = ''; try{ motor = A && A.pagosMotorVoz ? String(A.pagosMotorVoz() || '') : ''; }catch(e){}
      var motorTxt = !motor ? '' : /google/.test(motor) ? ' Motor: Google.' : /samsung/i.test(motor) ? ' Motor: Samsung (si no suena, instala «Servicios de voz de Google» desde la Play Store).' : ' Motor: ' + motor.replace(/^sistema:/, '') + '.';
      L.push(fila(voz ? true : null, '🗣️ Voz de los pagos', (voz ? 'Prendida.' : 'Apagada: los pagos llegan sin voz (Ajustes → Pagos → «Decir los pagos en voz alta»).') + motorTxt, '<br><button type="button" class="btn-ghost" data-ck="voz" style="margin-top:6px">▶ Probar la voz</button>'));
      if(!n){ L.push(fila(false, '👥 Pagos entre equipos', 'Entra con tu correo (ORDEVA Nube) en cada equipo: así los pagos que lee un celular les llegan a todos.')); }
      else {
        L.push(fila(r[0] === true, '🌐 Servidor ORDEVA', r[0] === true ? 'Activo' + (est.version ? ' (v' + est.version + ')' : '') + '.' : 'No responde: sin internet, o el servidor de pagos no está desplegado.'));
        var d = miDispositivo(), cola = (lsGet(K_REENV, []) || []).length;
        L.push(fila(!!d && !est.revocado, '🔑 Este equipo autorizado', d && !est.revocado ? 'Sí: lo que lee aquí les llega a los demás.' : 'No: toca «Autorizar».', d && !est.revocado ? '' : '<br><button type="button" class="btn-ghost" data-ck="aut" style="margin-top:6px">📱 Autorizar este equipo</button>'));
        L.push(fila(cola ? null : true, '📤 Avisos por mandar', cola ? cola + ' esperando internet: se mandan solos al volver.' : 'Ninguno: todo salió.'));
        var ahora = Date.now();
        if(cr && cr.t) L.push(fila(cr.ok && ahora - cr.t < 60e3, '📡 Recibir los pagos de los otros equipos (Android)', cr.ok && ahora - cr.t < 60e3 ? 'Android pregunta cada 2,5 s, también con el celular bloqueado. Última: ' + haceTxt(ahora - cr.t) + '.' : 'Última vez ' + haceTxt(ahora - cr.t) + (cr.error ? ' (' + esc(cr.error) + ')' : '') + '. Revisa que ORDEVA no tenga ahorro de batería.'));
        else L.push(fila(est.vivo ? true : null, '📡 Recibir los pagos de los otros equipos', est.vivo ? 'En vivo.' : 'Revisa cada 20 s' + (est.ultimoSync ? ' (última ' + haceTxt(ahora - est.ultimoSync) + ')' : '') + '.'));
        var devs = r[1] || [], mio = d && d.id;
        L.push('<li><span>👥</span><span><b>Equipos de la cuenta</b><br><small>Android pregunta cada 2,5 s; el computador y el navegador, cada minuto mientras ORDEVA esté abierto.</small>' +
          (devs.length ? '<ul class="vp-checks" style="margin:6px 0 0">' + devs.map(function(x){
            var ms = ahora - Date.parse(x.ultimo_visto), oye = ms < 90e3, rato = ms < 15 * 60e3;
            return '<li><span>' + (oye ? '🟢' : rato ? '🟡' : '🔴') + '</span><span>' + esc(x.nombre) + (mio === x.id ? ' <b>(este)</b>' : '') + '<br><small>' + esc((x.usuario || '') + ' · ' + nombreRol(x.rol)) + ' · ' +
              (oye ? 'escuchando (' + haceTxt(ms) + ')' : rato ? 'visto ' + haceTxt(ms) + ': puede estar dormido' : 'cerrado (visto ' + haceTxt(ms) + '): no le sonará hasta abrir ORDEVA') + '</small></span></li>';
          }).join('') + '</ul>' : '<br><small>No se pudo cargar la lista.</small>') + '</span></li>');
      }
      ov.innerHTML = '<div class="modal vp-modal" role="dialog" aria-label="Chequeo de pagos"><h2>🩺 Pagos en todos los equipos</h2><ul class="vp-checks">' + L.join('') + '</ul>' +
        '<div class="mz-actions" style="flex-wrap:wrap;gap:8px"><button type="button" class="btn-ghost" data-ck="otra">🔄 Revisar otra vez</button><button type="button" class="btn-close" data-ck="x">Cerrar</button></div></div>';
      ov.onclick = function(e){
        var b = e.target.closest('[data-ck]'); if(!b) return;
        var k = b.dataset.ck;
        if(k === 'x') return cerrarVentana(ov);
        if(k === 'otra') return window.ventoPagosChequeo();
        if(k === 'voz'){ try{ if(A && A.pagosProbarVoz) A.pagosProbarVoz(); else hablar('Llegaron 200 pesos por Nequi.'); }catch(x){} return; }
        if(k === 'bat'){ try{ A.ajustesBateria(); }catch(x){} return; }
        if(k === 'auto'){ try{ A.abrirInicioAutomatico(); }catch(x){} return; }
        if(k === 'perm'){ try{ A.pedirPermisos ? A.pedirPermisos() : A.ajustesBateria(); }catch(x){} return; }
        if(k === 'aut'){ est.revocado = false; ultimaReaut = 0; reautorizar().then(function(){ window.ventoPagosChequeo(); }); }
      };
    });
  };

  // ---------- Asistente «Conectar Nequi / Conectar DaviPlata» ----------
  function asistente(cual){
    var n = negocio(), ov = ventana('vpAsisOv');
    var r = est.resumen || {}, wompiYa = (est.info && est.info.proveedores || []).some(function(p){ return p.proveedor === 'wompi' && p.estado === 'conectado'; });
    // ¿Solo quiere que ORDEVA le avise cuando le pagan? Eso NO necesita la API ni convenio: el paso a paso de los avisos.
    var soloAvisos = '<div class="vp-guia"><b>¿Solo quieres que ORDEVA te avise «Pagaron $20.000 por ' + (cual === 'daviplata' ? 'DaviPlata' : 'Nequi') + '» cuando te pasan plata?</b> No necesitas esto (ni convenio con el banco).' +
      ' <button type="button" class="btn-primary" data-vp-guia>📘 Paso a paso: agregar ' + (cual === 'daviplata' ? 'DaviPlata' : 'Nequi') + '</button></div>';
    var intro = soloAvisos + (cual === 'daviplata'
      ? '<div class="modal-sub">Para <b>cobrar</b> con la integración oficial hay dos vías. Puedes usar una o las dos: la <b>API Pago con DaviPlata</b> de Davivienda (cobro con código al celular del cliente) o <b>Wompi</b> (link o QR que se paga con DaviPlata, Nequi o tarjeta).</div>'
      : '<div class="modal-sub">Para <b>cobrar</b> con la integración oficial hay dos vías. Puedes usar una o las dos:</div>');
    var provD = (est.info && est.info.proveedores || []).find(function(p){ return p.proveedor === 'daviplata'; }) || null, pubD = provD && provD.publico || {};
    var formD = '<div class="vp-form" id="vpFormD"><h3 style="margin:14px 0 0">Conectar DaviPlata (API oficial de Davivienda)' + (provD && provD.estado === 'conectado' ? ' <span class="vp-ok">· conectada</span>' : provD && provD.estado === 'error' ? ' <span class="vp-mal">· con error</span>' : '') + '</h3>' +
      '<div class="modal-sub">Cobras con el <b>documento</b> del cliente: a su celular le llega un código y tú lo escribes en ORDEVA; DaviPlata responde «Aprobado» en ese momento (no manda aviso aparte). Necesitas: <b>convenio con Davivienda</b>, tu aplicación en el <a href="https://conectesunegocio.daviplata.com" target="_blank" rel="noopener">Developer Portal</a> (Client ID y Secret), su <b>certificado</b> (.cer + llave .pem) y los códigos de <b>comercio y terminal</b> que asigna Redeban.</div>' +
      '<label for="vpDamb">Ambiente</label><select class="mz-in" id="vpDamb"><option value="sandbox">Laboratorio (pruebas · lun–vie 8:00–17:00)</option><option value="produccion">Producción (cobros reales)</option></select>' +
      '<label for="vpDcid">Client ID (Consumer Key)</label><input class="mz-in" id="vpDcid" autocomplete="off" autocapitalize="none" spellcheck="false">' +
      '<label for="vpDsec">Client Secret (Consumer Secret)</label><input class="mz-in" id="vpDsec" type="password" autocomplete="off"' + (provD ? ' placeholder="Vacío = conservar el guardado"' : '') + '>' +
      '<label for="vpDtr">Conexión segura (TLS mutuo)</label><select class="mz-in" id="vpDtr"><option value="directo">Directa desde el Servidor ORDEVA</option><option value="puente">Por mi puente de Cloudflare (Worker)</option></select>' +
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
      if(!n) return msg('Primero entra a ORDEVA Nube.', true);
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

  // Google / YouTube sin vencerse: el Servidor ORDEVA guarda la llave de renovación (ver index.html → yRenovarServidor).
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

  // 🤖 IA con la clave propia del NEGOCIO por el Servidor ORDEVA (1.53.0): la clave vive cifrada allá y ningún celular
  // la guarda. estado() → { tiene, final }; guardar(clave) / borrar() solo dueño o administrador; pedir(ruta, init)
  // llama a Gemini por el servidor (ruta como «/models/…:generateContent»).
  var ia = {
    disponible: function(){ return !!(nube() && nube().configurada && nube().configurada() && negocio()); },
    estado: function(){ var n = negocio(); return n ? api('ia-clave', { negocio: n.id, accion: 'estado' }) : Promise.resolve({ tiene: false }); },
    guardar: function(k){ var n = negocio(); return n ? api('ia-clave', { negocio: n.id, accion: 'guardar', clave: k }) : Promise.reject(new Error('sin_negocio')); },
    borrar: function(){ var n = negocio(); return n ? api('ia-clave', { negocio: n.id, accion: 'borrar' }) : Promise.reject(new Error('sin_negocio')); },
    pedir: function(ruta, init){
      var n = negocio(); if(!n) return Promise.reject(new Error('sin_negocio'));
      return sesion().then(function(s){
        if(!s.token) throw Object.assign(new Error('sin_sesion'), { codigo: 'sin_sesion' });
        var o = Object.assign({}, init || {}), h = Object.assign({}, o.headers || {});
        delete h['x-goog-api-key']; h.apikey = nube().config().key; h.Authorization = 'Bearer ' + s.token; o.headers = h;
        return fetch(base() + '/ia/' + encodeURIComponent(n.id) + '/v1beta' + ruta, o);
      });
    }
  };
  window.ventoPagos = { estado: function(){ return est; }, sincronizar: sincronizar, recibir: recibir, cobrar: function(m, v){ return window.ventoPagosCobrar(m, v); }, activarPush: activarPush, abrirAjustes: pintarAjustes, ia: ia, _cache: cache };
})();
