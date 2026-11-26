/* ORDEVA · app/01-menus-saltan-arriba.js — antes estaba dentro de index.html (línea 8). Se carga en el mismo lugar y orden. */
/* ==================== Menús que no saltan arriba solos ====================
   Muchas partes de ORDEVA se refrescan solas (estado de los pagos, cola de canciones, pedidos de cocina…) rehaciendo su
   contenido. Al rehacerlo, la lista que uno estaba bajando volvía arriba sola. Ahora, al refrescar un bloque, se guarda
   dónde iba la lista (el bloque y sus listas internas, hasta 2 niveles) y se deja ahí mismo. Si el código manda arriba a
   propósito después (cambiar de pestaña o de paso), eso sigue funcionando. */
(function(){
  try{
    var d = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    if(!d || !d.set || !d.get) return;
    var guardar = function(raiz){
      var l = [];
      if(raiz.scrollTop > 0 || raiz.scrollLeft > 0) l.push({ c: [], t: raiz.scrollTop, x: raiz.scrollLeft });
      var hijos = raiz.children, n = 0;
      for(var i = 0; i < hijos.length && n < 300; i++){
        var h = hijos[i]; n++;
        if(h.scrollTop > 0 || h.scrollLeft > 0) l.push({ c: [i], t: h.scrollTop, x: h.scrollLeft, k: h.className, g: h.tagName });
        for(var j = 0; j < h.children.length && n < 300; j++){ var nn = h.children[j]; n++; if(nn.scrollTop > 0 || nn.scrollLeft > 0) l.push({ c: [i, j], t: nn.scrollTop, x: nn.scrollLeft, k: nn.className, g: nn.tagName }); }
      }
      return l;
    };
    var poner = function(raiz, l){
      l.forEach(function(r){
        var el = raiz;
        for(var i = 0; i < r.c.length && el; i++) el = el.children[r.c[i]];
        if(!el || (r.g && (el.tagName !== r.g || el.className !== r.k))) return;
        if(r.t) el.scrollTop = r.t; if(r.x) el.scrollLeft = r.x;
      });
    };
    Object.defineProperty(Element.prototype, 'innerHTML', {
      configurable: true, enumerable: d.enumerable,
      get: function(){ return d.get.call(this); },
      set: function(v){
        var l = null;
        try{ if(this.isConnected && this.firstElementChild) l = guardar(this); }catch(e){ l = null; }
        d.set.call(this, v);
        if(l && l.length) try{ poner(this, l); }catch(e){}
      }
    });
  }catch(e){}
})();
/* ==================== App Android o ORDEVA Web ====================
   En Android hay dos «ORDEVA»: la APP (lee los avisos de DaviPlata/Nequi, dice «Pago confirmado» aunque esté minimizada)
   y VENTO WEB (la página en el navegador o su acceso directo instalado desde el navegador), que NO puede leer los avisos
   de otras apps. Antes no se distinguían y el paso a paso decía «Falta instalarla» con la app ya instalada.
   ventoAbrirApp() abre la app (o la descarga si no está). */
(function(){
  var APK = 'https://github.com/cristhianlujan45-blip/ORDEVA/releases/latest/download/vento.apk';
  var ua = navigator.userAgent || '';
  window.ventoEnApp = function(){ return !!window.VentoAndroid; };
  // La app sin su puente (no cargó bien): el navegador de la app dice «VentoAndroid/…» pero falta window.VentoAndroid.
  window.ventoAppSinPuente = function(){ return /VentoAndroid\//.test(ua) && !window.VentoAndroid; };
  window.ventoAndroidWeb = function(){ return /Android/i.test(ua) && !window.VentoAndroid && !/VentoAndroid\//.test(ua); };
  // La app ORDEVA instalada es VIEJA (de antes del 13 de octubre): tiene conexión con Android pero no lee los avisos de
  // pagos. Antes el paso a paso la tomaba por ORDEVA Web.
  window.ventoAppVieja = function(){ var A = window.VentoAndroid; return !!A && !A.pagosAvisosTomar; };
  // La app lee los avisos de pagos pero no los SMS (antes de la 1.38.3).
  window.ventoAppSinSms = function(){ var A = window.VentoAndroid; return !!A && !!A.pagosAvisosTomar && !A.pagosSmsConfiar; };
  window.ventoAppVersion = function(){ var m = ua.match(/VentoAndroid\/([\w.]+)/); return m ? m[1] : ''; };
  window.ventoIntentApp = function(consulta){
    return 'intent://abrir' + (consulta ? '?' + consulta : '') + '#Intent;scheme=vento;package=co.vento.app;S.browser_fallback_url=' + encodeURIComponent(APK) + ';end';
  };
  window.ventoAbrirApp = function(consulta){ location.href = window.ventoIntentApp(consulta || ''); };
  try{
    var q = new URLSearchParams(location.search), h = new URLSearchParams((location.hash || '').replace(/^#/, ''));
    // En la app: la vuelta de Google llega como «?…&_h=<lo que iba después del #>» (el # no cabe en el enlace a la app).
    if(q.get('_h') !== null){
      var hh = q.get('_h'); q.delete('_h');
      history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q.toString() : '') + (hh ? '#' + hh : ''));
      return;
    }
    // En el navegador: «Conectar mi cuenta de YouTube» se empezó en la APP (state=vento-yt.app…), pero Google volvió al
    // navegador (en la app Google no deja entrar). Se manda a la app, que es donde se terminó de conectar.
    var st = q.get('state') || h.get('state') || '';
    if(/^vento-yt\.app/.test(st) && !window.VentoAndroid && !/VentoAndroid\//.test(ua) && (q.get('code') || q.get('error') || h.get('access_token') || h.get('error'))){
      var p = new URLSearchParams(location.search);
      if((location.hash || '').length > 1) p.set('_h', location.hash.slice(1));
      var ir = 'intent://abrir?' + p.toString() + '#Intent;scheme=vento;package=co.vento.app;end';
      window.__ventoVolverApp = ir;
      history.replaceState(null, '', location.pathname);       // ORDEVA Web no la procesa (es de la app)
      var pintar = function(){
        var d = document.createElement('div');
        d.id = 'ventoVolverApp';
        d.setAttribute('style', 'position:fixed;inset:0;z-index:2147483647;background:#0b0a12;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:24px;text-align:center;font:17px system-ui,sans-serif');
        d.innerHTML = '<div style="font-size:44px">✅</div><b style="font-size:21px">Google listo</b><div>Vuelve a la <b>app ORDEVA</b> para terminar de conectar tu cuenta de YouTube.</div>' +
          '<a id="ventoVolverAppBtn" href="' + ir.replace(/"/g, '&quot;') + '" style="background:#22c55e;color:#06210f;font-weight:800;padding:16px 22px;border-radius:14px;text-decoration:none;font-size:18px">📲 Volver a la app ORDEVA</a>' +
          '<small style="opacity:.7">Si no se abre sola, toca el botón.</small>';
        document.body.appendChild(d);
      };
      if(document.body) pintar(); else document.addEventListener('DOMContentLoaded', pintar);
      // 1.99.66: se va a la app cuando la página ya cargó (y se ve «Google listo» con su botón). Antes iba a los 300 ms
      // pasara lo que pasara: con la página aún cargando, el salto cortaba la carga y el botón podía no alcanzar a salir.
      var irApp = function(){ setTimeout(function(){ try{ location.href = ir; }catch(e){} }, 300); };
      if(document.readyState !== 'loading') irApp(); else document.addEventListener('DOMContentLoaded', irApp);
    }
  }catch(e){}
})();

/* 💵 1.99.85 · Plata escrita con puntos de miles. En los campos de número del navegador, «8.000» quedaba en 8 (el punto es
   el decimal) y «1.500.000» en 1,5: un pago de $8.000 se podía registrar como $8. En los campos de PLATA (precio, costo,
   pago, abono, envío, valor…) el punto y la coma de miles se ignoran al escribir o pegar: «8.000» → 8000. Los de
   porcentaje, tarifa, cantidad, peso o días no se tocan (ahí sí puede haber decimales). */
(function(){
  var IDS = { prodPrice: 1, prodCost: 1, ctMonto: 1, qpPrice: 1, qpCost: 1, paymentAmount: 1, personPaymentAmount: 1, editProdPrice: 1, editProdCost: 1,
    qsEnvio: 1, calcDescPrecio: 1, calcPrimaSalario: 1, calcReteicaValor: 1 };
  var NO = /pct|porc|tarifa|iva|rate|ret[A-Z]|qty|cant|stock|dias|d[ií]as|peso|kg|min\b|count|split|nota|vol|puntos|%/i;
  var SI = /precio|price|monto|valor|cost|plata|pago|payment|abono|env[ií]o|cuota|salario|tarifaNoche|\$/i;
  function esPlata(el){
    if(!el || el.tagName !== 'INPUT' || el.type !== 'number') return false;
    if(el.dataset && el.dataset.plata === '0') return false;
    if(IDS[el.id] || (el.dataset && el.dataset.plata === '1')) return true;
    var txt = [el.id, el.className, el.name, el.placeholder, el.getAttribute('aria-label'), el.dataset ? (el.dataset.k || '') + ' ' + (el.dataset.q || '') + ' ' + (el.dataset.a || '') : ''].join(' ');
    if(NO.test(txt)) return false;
    var paso = Number(el.getAttribute('step'));
    return SI.test(txt) || (paso >= 50 && paso % 50 === 0);
  }
  window.ventoEsPlata = esPlata;
  function soloCifras(s){ return String(s == null ? '' : s).replace(/[^\d]/g, ''); }
  // Teclado de computador: el punto y la coma no entran.
  document.addEventListener('keydown', function(e){ if((e.key === '.' || e.key === ',' || e.key === 'Decimal') && esPlata(e.target)) e.preventDefault(); }, true);
  // Celular (Gboard y otros mandan «beforeinput») y pegar: solo las cifras.
  document.addEventListener('beforeinput', function(e){
    var el = e.target; if(!esPlata(el) || !e.data || !/[.,]/.test(e.data)) return;
    if(!e.cancelable) return;
    e.preventDefault();
    var c = soloCifras(e.data); if(c){ el.value = soloCifras(el.value) + c; el.dispatchEvent(new Event('input', { bubbles: true })); }
  }, true);
  document.addEventListener('paste', function(e){
    var el = e.target; if(!esPlata(el)) return;
    var t = (e.clipboardData && e.clipboardData.getData('text')) || ''; if(!/[.,]/.test(t)) return;
    e.preventDefault(); el.value = soloCifras(t); el.dispatchEvent(new Event('input', { bubbles: true }));
  }, true);
  // Por si se coló («8.000» exacto, de un teclado que no avisa): al cambiar, los miles con punto se vuelven cifras.
  document.addEventListener('input', function(e){
    var el = e.target; if(!esPlata(el)) return;
    var v = String(el.value || ''); if(/^\d{1,3}([.,]\d{3})+$/.test(v)) el.value = soloCifras(v);
  }, true);
})();
