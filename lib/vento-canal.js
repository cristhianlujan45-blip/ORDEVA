/* =====================================================================
   Vento · canales en vivo por el servidor de Vento (reemplazan a ntfy.sh)
   Pedidos y canciones por QR, estado del pedido, carta, cuenta en vivo, meseros, preparación, TV, avisos de pagos
   y WhatsApp. Las páginas siguen escribiendo como antes:
     fetch('https://canal.vento.local/<canal>', { method: 'POST', body })          → publica
     fetch('https://canal.vento.local/<c1,c2>/json?poll=1&since=12h')              → lee lo guardado (una línea JSON por mensaje)
     new EventSource('https://canal.vento.local/<c1,c2>/sse?since=12h')           → escucha (onmessage con el mensaje)
   y este archivo lo pasa al servidor (funciones canal_publicar / canal_leer de Supabase). Escuchar = revisar cada
   2,5 s (8 s con la app en segundo plano) y, si el servidor lo tiene, aviso al instante por Realtime.
   También entiende las direcciones viejas de ntfy.sh (por si quedó alguna guardada).
   Necesita la dirección del servidor: nube/config.js (VENTO_NUBE_DEFAULT) o la guardada en el equipo.
   ===================================================================== */
(function(){
  'use strict';
  if(window.ventoCanal) return;
  var HOSTS = { 'canal.vento.local': 1, 'ntfy.sh': 1 };
  var fetchNativo = window.fetch ? window.fetch.bind(window) : null, ESNativo = window.EventSource || null;

  function cfg(){
    var c = null;
    try{ c = JSON.parse(localStorage.getItem('vento_nube_cfg') || 'null'); }catch(e){}
    if(!c || !c.url || !c.key) c = window.VENTO_NUBE_DEFAULT || null;
    return c && c.url && c.key ? { url: String(c.url).replace(/\/+$/, ''), key: String(c.key) } : null;
  }
  function esCanal(u){ try{ var x = new URL(String(u), location.href); return HOSTS[x.hostname] ? x : null; }catch(e){ return null; } }
  function partes(x){
    var p = x.pathname.replace(/^\/+/, '').split('/');
    return { canales: (p[0] || '').split(',').map(function(s){ return s.trim(); }).filter(function(s){ return /^[A-Za-z0-9_-]{4,80}$/.test(s); }), modo: p[1] || '', since: x.searchParams.get('since') || '' };
  }
  // «since» como lo entendía ntfy: 12h, 10m, 7d, 30s, all, segundos unix, o el id de un mensaje.
  function desde(since){
    since = String(since || '').trim(); if(!since || since === 'all') return { seg: null, id: null };
    var m = /^(\d+)([smhd])$/.exec(since);
    if(m) return { seg: Math.floor(Date.now() / 1000) - (+m[1]) * ({ s: 1, m: 60, h: 3600, d: 86400 })[m[2]], id: null };
    if(/^\d+$/.test(since)) return +since > 1e9 ? { seg: +since, id: null } : { seg: null, id: +since };
    return { seg: null, id: null };
  }
  function rpc(fn, args, signal, token){
    var c = cfg(); if(!c || !fetchNativo){ conexion(false); return Promise.reject(new Error('Sin servidor de Vento configurado')); }
    return fetchNativo(c.url + '/rest/v1/rpc/' + fn, { method: 'POST', signal: signal, cache: 'no-store',
      headers: { apikey: c.key, Authorization: 'Bearer ' + (token || c.key), 'Content-Type': 'application/json' }, body: JSON.stringify(args) })
      .then(function(r){ conexion(r.status < 500); return r.text().then(function(t){ var j = null; try{ j = t ? JSON.parse(t) : null; }catch(e){}
        if(!r.ok){ var e = new Error((j && j.message) || ('HTTP ' + r.status)); e.status = /demasiados/.test(e.message) ? 429 : r.status; throw e; }
        return j; }); }, function(e){ if(!(e && e.name === 'AbortError')) conexion(false); throw e; });
  }
  /* 1.54.0: los canales de PEDIDOS del negocio solo los lee un miembro del negocio (el cliente del QR solo escribe
     ahí). La app del local lee con su sesión de Vento; las páginas sin sesión (pedido, mesero, preparación, TV) leen
     como siempre los canales que sí les tocan. Si la sesión falla (vencida, otra cuenta), se lee como antes. */
  function sesion(){
    try{
      var n = window.ventoNube;
      if(!n || !n.cliente || !n.negocio || !n.negocio()) return Promise.resolve(null);
      return n.cliente().then(function(c){ return c.auth.getSession(); })
        .then(function(r){ return r && r.data && r.data.session ? r.data.session.access_token : null; }, function(){ return null; });
    }catch(e){ return Promise.resolve(null); }
  }

  /* ¿Hay conexión con la base de datos de Vento? Las páginas que NO funcionan sin ella (mesero, preparación; con
     window.VENTO_REQUIERE_BD = true antes de cargar este archivo) se tapan con «Sin conexión con Vento» mientras no
     haya respuesta, y se destapan solas cuando vuelve. */
  var CX = { ok: false, hubo: false, falloDesde: 0, inicio: Date.now(), ov: null };
  function conexion(bien){
    if(bien){ CX.ok = true; CX.hubo = true; CX.falloDesde = 0; }
    else{ CX.ok = false; if(!CX.falloDesde) CX.falloDesde = Date.now(); }
    pintarConexion();
  }
  function pintarConexion(){
    if(!window.VENTO_REQUIERE_BD || !document.body) return;
    var sin = !CX.ok && (CX.falloDesde ? Date.now() - CX.falloDesde > 4000 : Date.now() - CX.inicio > 12000);
    if(!sin){ if(CX.ov){ CX.ov.remove(); CX.ov = null; } return; }
    if(CX.ov) return;
    var o = CX.ov = document.createElement('div'); o.id = 'vcSinConexion'; o.setAttribute('role', 'alert');
    o.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(10,10,10,.96);color:#fff;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;font-family:system-ui,sans-serif';
    o.innerHTML = '<div style="max-width:360px"><div style="font-size:54px">📡</div><b style="display:block;font-size:22px;margin:8px 0">Sin conexión con Vento</b>' +
      '<div style="font-size:15px;line-height:1.5;opacity:.85">Esta pantalla solo funciona conectada a la base de datos de Vento. Revisa el internet: apenas vuelva, sigue sola.</div></div>';
    document.body.appendChild(o);
  }
  setInterval(pintarConexion, 1500);
  window.addEventListener('online', function(){ CX.inicio = Date.now(); });
  function respuesta(cuerpo, status, tipo){
    try{ return new Response(cuerpo, { status: status || 200, headers: { 'Content-Type': tipo || 'application/json' } }); }
    catch(e){ return { ok: (status || 200) < 300, status: status || 200, text: function(){ return Promise.resolve(cuerpo); }, json: function(){ return Promise.resolve(JSON.parse(cuerpo)); } }; }
  }
  function cuerpoTexto(b){
    if(b == null) return Promise.resolve('');
    if(typeof b === 'string') return Promise.resolve(b);
    if(b instanceof Blob) return b.text();
    if(b instanceof URLSearchParams) return Promise.resolve(b.toString());
    try{ return Promise.resolve(new TextDecoder().decode(b)); }catch(e){ return Promise.resolve(String(b)); }
  }
  function cabecera(h, k){ if(!h) return null; try{ if(h instanceof Headers) return h.get(k); }catch(e){} for(var n in h){ if(String(n).toLowerCase() === k) return h[n]; } return null; }

  // ---------- fetch ----------
  function publicar(canal, texto, titulo, signal){ return rpc('canal_publicar', { p_canal: canal, p_cuerpo: texto, p_titulo: titulo || null }, signal); }
  function leer(canales, since, signal){
    var d = desde(since), args = { p_canales: canales, p_desde_id: d.id, p_desde: d.seg, p_limite: 300 };
    return sesion().then(function(tok){
      if(!tok) return rpc('canal_leer', args, signal);
      return rpc('canal_leer', args, signal, tok).catch(function(e){ if(e && (e.status === 401 || e.status === 403)) return rpc('canal_leer', args, signal); throw e; });
    });
  }
  function fetchCanal(x, init){
    init = init || {};
    var p = partes(x), metodo = String(init.method || 'GET').toUpperCase();
    if(!p.canales.length) return Promise.resolve(respuesta('{"error":"canal_invalido"}', 400));
    if(metodo === 'POST' || metodo === 'PUT'){
      return cuerpoTexto(init.body).then(function(t){ return publicar(p.canales[0], t, cabecera(init.headers, 'title') || cabecera(init.headers, 't'), init.signal); })
        .then(function(m){ avisarLocal(p.canales[0]); return respuesta(JSON.stringify(m), 200); }, function(e){ if(e && e.name === 'AbortError') throw e; return respuesta(JSON.stringify({ error: e.message }), e.status || 502); });
    }
    if(p.modo === 'json' || p.modo === 'raw' || p.modo === ''){
      return leer(p.canales, p.since || 'all', init.signal).then(function(l){
        l = l || [];
        return p.modo === 'raw' ? respuesta(l.map(function(m){ return m.message; }).join('\n') + (l.length ? '\n' : ''), 200, 'text/plain')
          : respuesta(l.map(function(m){ return JSON.stringify(m); }).join('\n') + (l.length ? '\n' : ''), 200, 'application/x-ndjson');
      }, function(e){ if(e && e.name === 'AbortError') throw e; return respuesta('', e.status || 502, 'text/plain'); });
    }
    return Promise.resolve(respuesta('', 404, 'text/plain'));
  }
  if(fetchNativo) window.fetch = function(u, init){
    var x = esCanal(u && u.url ? u.url : u);
    if(x) return fetchCanal(x, init || (u && u.url ? { method: u.method, headers: u.headers, body: u.body } : {}));
    return fetchNativo(u, init);
  };

  // ---------- XMLHttpRequest (páginas sencillas: pantalla de preparación) ----------
  if(window.XMLHttpRequest){
    var XP = window.XMLHttpRequest.prototype, xOpen = XP.open, xSend = XP.send, xHead = XP.setRequestHeader;
    var fijar = function(o, k, v){ try{ Object.defineProperty(o, k, { value: v, configurable: true }); }catch(e){} };
    XP.open = function(m, u){ var x = esCanal(u); this.__vc = x ? { x: x, m: m, h: {} } : null; if(!x) return xOpen.apply(this, arguments); };
    XP.setRequestHeader = function(k, v){ if(this.__vc){ this.__vc.h[k] = v; return; } return xHead.apply(this, arguments); };
    XP.send = function(b){
      if(!this.__vc) return xSend.apply(this, arguments);
      var me = this, vc = this.__vc;
      fetchCanal(vc.x, { method: vc.m, body: b, headers: vc.h }).then(function(r){ return r.text().then(function(t){
        fijar(me, 'readyState', 4); fijar(me, 'status', r.status); fijar(me, 'responseText', t); fijar(me, 'response', t);
        try{ me.onreadystatechange && me.onreadystatechange(); }catch(e){} try{ me.onload && me.onload(); }catch(e){} try{ me.dispatchEvent(new Event('load')); }catch(e){}
      }); }, function(){ fijar(me, 'readyState', 4); fijar(me, 'status', 0); try{ me.onerror && me.onerror(); }catch(e){} try{ me.dispatchEvent(new Event('error')); }catch(e){} });
    };
  }

  // ---------- EventSource ----------
  var oyentes = [];   // instancias abiertas
  function avisarLocal(canal){ oyentes.forEach(function(o){ if(o._canales.indexOf(canal) >= 0) o._pronto(150); }); }   // lo publicado en esta misma página llega enseguida
  function CanalES(url){
    var x = esCanal(url), p = partes(x), self = this;
    this.url = String(url); this.readyState = 0; this.withCredentials = false;
    this.onopen = null; this.onmessage = null; this.onerror = null;
    this._canales = p.canales; this._ult = null; this._since = p.since || 'all'; this._oy = {}; this._t = null; this._cerrado = false; this._fallas = 0; this._vistos = {}; this._nVistos = 0;
    oyentes.push(this);
    rt.unir(this._canales);
    setTimeout(function(){ self._revisar(true); }, 0);
  }
  CanalES.CONNECTING = 0; CanalES.OPEN = 1; CanalES.CLOSED = 2;
  CanalES.prototype.CONNECTING = 0; CanalES.prototype.OPEN = 1; CanalES.prototype.CLOSED = 2;
  CanalES.prototype.addEventListener = function(t, f){ (this._oy[t] = this._oy[t] || []).push(f); };
  CanalES.prototype.removeEventListener = function(t, f){ this._oy[t] = (this._oy[t] || []).filter(function(g){ return g !== f; }); };
  CanalES.prototype.dispatchEvent = function(ev){ var f = this['on' + ev.type]; try{ if(typeof f === 'function') f.call(this, ev); }catch(e){ setTimeout(function(){ throw e; }); } (this._oy[ev.type] || []).slice().forEach(function(g){ try{ g.call(this, ev); }catch(e){ setTimeout(function(){ throw e; }); } }, this); return true; };
  CanalES.prototype.close = function(){ this._cerrado = true; this.readyState = 2; clearTimeout(this._t); var me = this; oyentes = oyentes.filter(function(o){ return o !== me; }); };
  CanalES.prototype._pronto = function(ms){ var me = this; if(me._cerrado) return; clearTimeout(me._t); me._t = setTimeout(function(){ me._revisar(); }, ms); };
  CanalES.prototype._revisar = function(primera){
    var me = this; if(me._cerrado) return;
    if(me._ocupado){ me._pendiente = true; return; }
    me._ocupado = true;
    var since = me._ult != null ? String(me._ult) : me._since;
    leer(me._canales, since).then(function(l){
      if(me._cerrado) return;
      if(me.readyState !== 1){ me.readyState = 1; me.dispatchEvent(mkEv('open')); }
      else me.dispatchEvent(mkEv('keepalive', JSON.stringify({ event: 'keepalive', time: Math.floor(Date.now() / 1000) })));   // «sigo vivo» (como lo mandaba antes el canal)
      me._fallas = 0;
      (l || []).forEach(function(m){
        var id = +m.id; if(me._ult == null || id > me._ult) me._ult = id;
        if(me._vistos[m.id]) return; me._vistos[m.id] = 1;
        // 1.56.0: con la pantalla prendida días (TV, cocina) no crece sin fin: quedan los 1.000 más nuevos (los ids crecen).
        if(++me._nVistos > 3000){ var ks = Object.keys(me._vistos); for(var q = 0; q < ks.length - 1000; q++) delete me._vistos[ks[q]]; me._nVistos = 1000; }
        me.dispatchEvent(mkEv('message', JSON.stringify(m)));
      });
    }, function(){
      if(me._cerrado) return;
      me._fallas++;
      if(me._fallas === 1 || me.readyState === 1){ me.readyState = 0; me.dispatchEvent(mkEv('error')); }
    }).then(function(){
      me._ocupado = false;
      if(me._cerrado) return;
      if(me._pendiente){ me._pendiente = false; return me._pronto(50); }
      var base = document.hidden ? 8000 : (rt.vivo() ? 6000 : 2500);
      me._pronto(me._fallas ? Math.min(30000, base * Math.pow(2, Math.min(me._fallas, 4))) : base);
    });
  };
  function mkEv(tipo, data){
    var ev; try{ ev = data !== undefined ? new MessageEvent(tipo, { data: data }) : new Event(tipo); }catch(e){ ev = { type: tipo, data: data }; }
    return ev;
  }
  window.EventSource = function(url, opts){
    if(esCanal(url)) return new CanalES(url);
    if(!ESNativo) throw new Error('EventSource no disponible');
    return new ESNativo(url, opts);
  };
  window.EventSource.CONNECTING = 0; window.EventSource.OPEN = 1; window.EventSource.CLOSED = 2;
  document.addEventListener('visibilitychange', function(){ if(!document.hidden) oyentes.forEach(function(o){ o._pronto(100); }); });
  window.addEventListener('online', function(){ oyentes.forEach(function(o){ o._fallas = 0; o._pronto(100); }); });
  // Al despertar (pantalla desbloqueada, pestaña descongelada o de vuelta del historial) se revisa al instante:
  // lo que llegó mientras estaba dormida se trae completo (el servidor guarda los mensajes 8 días).
  ['focus', 'pageshow'].forEach(function(ev){ window.addEventListener(ev, function(){ oyentes.forEach(function(o){ o._fallas = 0; o._pronto(100); }); }); });
  document.addEventListener('resume', function(){ oyentes.forEach(function(o){ o._fallas = 0; o._pronto(50); }); });

  /* Pantallas que trabajan solas (mesero, preparación; window.VENTO_REQUIERE_BD): la pantalla no se apaga mientras
     están abiertas (Screen Wake Lock), así el celular o la tablet no se bloquea y la conexión nunca se pierde. */
  var luz = null;
  function pedirLuz(){
    if(!window.VENTO_REQUIERE_BD || luz || document.hidden || !(navigator.wakeLock && navigator.wakeLock.request)) return;
    navigator.wakeLock.request('screen').then(function(l){ luz = l; l.addEventListener('release', function(){ luz = null; }); }).catch(function(){ luz = null; });
  }
  document.addEventListener('visibilitychange', function(){ if(!document.hidden) pedirLuz(); });
  ['click', 'touchstart'].forEach(function(ev){ document.addEventListener(ev, pedirLuz, { passive: true }); });
  setTimeout(pedirLuz, 500);

  // ---------- Aviso al instante (Supabase Realtime, broadcast «vc-<canal>») ----------
  var rt = (function(){
    var ws = null, ref = 0, unidos = {}, latido = null, abierto = false, intentos = 0, ultimoMsg = 0;
    function enviar(o){ try{ if(ws && ws.readyState === 1){ ws.send(JSON.stringify(o)); return true; } }catch(e){} return false; }
    function unirUno(c){ var c2 = cfg(); enviar({ topic: 'realtime:vc-' + c, event: 'phx_join', payload: { config: { broadcast: { self: false, ack: false }, presence: { key: '' }, private: false }, access_token: c2 && c2.key }, ref: String(++ref) }); }
    function conectar(){
      var c = cfg(); if(!c || !window.WebSocket || ws) return;
      try{ ws = new WebSocket(c.url.replace(/^http/, 'ws') + '/realtime/v1/websocket?apikey=' + encodeURIComponent(c.key) + '&vsn=1.0.0'); }catch(e){ ws = null; return; }
      ws.onopen = function(){ abierto = true; intentos = 0; Object.keys(unidos).forEach(unirUno); clearInterval(latido); latido = setInterval(function(){ enviar({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(++ref) }); }, 25000); };
      ws.onmessage = function(e){
        var m = null; try{ m = JSON.parse(e.data); }catch(x){ return; }
        if(!m || m.event !== 'broadcast' || !/^realtime:vc-/.test(m.topic || '')) return;
        ultimoMsg = Date.now();
        var canal = m.topic.slice('realtime:vc-'.length);
        oyentes.forEach(function(o){ if(o._canales.indexOf(canal) >= 0) o._pronto(30); });
      };
      ws.onclose = function(){ abierto = false; ws = null; clearInterval(latido); if(Object.keys(unidos).length && intentos < 8){ intentos++; setTimeout(conectar, Math.min(60000, 2000 * Math.pow(2, intentos))); } };
      ws.onerror = function(){ try{ ws && ws.close(); }catch(e){} };
    }
    return {
      unir: function(canales){ canales.forEach(function(c){ if(!unidos[c]){ unidos[c] = 1; if(abierto) unirUno(c); } }); conectar(); },
      // Solo se revisa más despacio cuando el aviso al instante ya demostró que funciona (llegó alguno).
      vivo: function(){ return abierto && ultimoMsg > 0 && Date.now() - ultimoMsg < 30 * 60e3; }
    };
  })();

  window.ventoCanal = { conectado: function(){ return CX.ok; }, publicar: publicar, leer: leer, EventSource: CanalES, url: function(canal){ var c = cfg(); return c ? c.url + '/functions/v1/vento-pagos/canal/' + canal : ''; } };
})();
