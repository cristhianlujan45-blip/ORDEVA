// 📷 ORDEVA 1.72.4 · Modo escáner en la Caja POS: la cámara del celular queda prendida DENTRO de la caja.
// Pedido del dueño: «cuando uso el celular para escanear, que se active la cámara de una vez y se oculte el menú: se van
// pasando los productos y se van agregando solos, como un sistema POS; que no tenga que abrir la cámara cada vez».
//  • 📷 en la Caja POS prende la cámara arriba de la caja (antes era una ventana que tapaba la venta y el total).
//  • Se pasan los productos y se agregan solos. El mismo código quieto frente a la cámara no se suma dos veces: para
//    otra unidad se retira y se vuelve a pasar (igual que antes).
//  • Mientras escanea, se esconden el menú de abajo y los botones de productos (en el celular): quedan la cámara, la
//    venta, el total y COBRAR.
//  • Al cobrar no lee (no se cuela nada en el cobro); después sigue prendida para el siguiente cliente.
//  • Se acuerda: la próxima vez que se abre la Caja POS en este equipo, la cámara prende sola. «✕ Apagar cámara» lo quita.
//  • Al cerrar la caja se suelta la cámara (no queda gastando batería).
// Agrega por el mismo camino de la pistola lectora (ventoPOS.leerCodigo): balanza, códigos nuevos, etc. igual que siempre.
(function(){
  'use strict';
  const LS = 'vento-ec-on';
  let stream = null, detector = null, vivo = false, vez = 0, abriendo = false;
  const vistos = new Map();
  const $ = id => document.getElementById(id);
  const ls = { get: k => { try{ return localStorage.getItem(k); }catch(e){ return null; } }, set: (k, v) => { try{ v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); }catch(e){} } };
  const raiz = () => { const ov = $('pzCajaOv'); return ov && ov.classList.contains('show') ? ov.querySelector('.pz-caja-root') : null; };
  // Solo lee con la caja a la vista: con el cobro, «producto nuevo» u otra ventana encima, espera.
  const libre = () => { const ov = $('pzCajaOv'); return !!(ov && ov.classList.contains('show')) && ![...document.querySelectorAll('.overlay.show')].some(x => x !== ov && !x.contains(ov)); };
  const activo = () => !!stream;

  function panel(r){
    let p = $('ecPanel');
    if(!p){
      p = document.createElement('div'); p.id = 'ecPanel'; p.className = 'ec-panel';
      p.innerHTML = '<div class="ec-video"><video id="ecVideo" playsinline muted autoplay></video><div class="ec-linea"></div></div>' +
        '<div class="ec-barra"><span id="ecEstado" class="ec-estado">📷 Abriendo la cámara…</span>' +
        '<button type="button" id="ecLuz" class="ec-b" hidden>🔦</button>' +
        (window.ventoLectorCel ? '<button type="button" id="ecCel" class="ec-b" title="Escanear con otro celular (se conecta con un código QR)">📱 Celular <i data-lcel-estado></i></button>' : '') +
        '<button type="button" id="ecApagar" class="ec-b">✕ Apagar cámara</button></div>';
      p.querySelector('#ecApagar').onclick = e => { e.stopPropagation(); apagar(true); };
      const cb = p.querySelector('#ecCel'); if(cb) cb.onclick = e => { e.stopPropagation(); celular(); };
    }
    // Arriba de todo en la columna de los productos (o de la caja).
    const col = r.querySelector('.pz-prod') || r;
    if(p.parentNode !== col) col.insertBefore(p, col.firstChild);
    return p;
  }
  const estado = t => { const e = $('ecEstado'); if(e) e.textContent = t; };

  // 📱 1.79.0: otro celular como lector de esta caja (lib/vento-lector-cel.js): el QR para conectarlo.
  function celular(){ try{ window.ventoLectorCel.abrirPanel(); }catch(e){} }
  async function hayCamara(){ try{ const l = await navigator.mediaDevices.enumerateDevices(); return !l.length || l.some(d => d.kind === 'videoinput'); }catch(e){ return true; } }
  async function prender(){
    const r = raiz(); if(!r || abriendo || stream) return;
    // Un computador sin cámara: 📷 abre de una vez «conectar el celular como lector».
    if(window.ventoLectorCel && navigator.mediaDevices && navigator.mediaDevices.enumerateDevices && !(await hayCamara())){ ls.set(LS, null); celular(); return; }
    if(!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) || typeof scanAbrirCamara !== 'function'){
      try{ showToast('📷 Este equipo no deja usar la cámara aquí. Busca el producto a mano o usa un lector de códigos.'); }catch(e){}
      return;
    }
    const mio = ++vez; abriendo = true;
    panel(r); document.body.classList.add('ec-on'); ls.set(LS, '1');
    estado('📷 Abriendo la cámara…');
    const lector = window.ventoCodigos ? window.ventoCodigos.detector(typeof SCAN_FORMATOS !== 'undefined' ? SCAN_FORMATOS : undefined) : Promise.reject(new Error('sin_lector'));
    lector.catch(() => {});
    let s;
    try{ s = await scanAbrirCamara(); }
    catch(e){
      abriendo = false; if(mio !== vez) return;
      estado(/NotAllowed|Security/.test((e && e.name) || '') ? '📷 Sin permiso de la cámara: toca el candado 🔒 (o Ajustes del celular → ORDEVA → Permisos → Cámara) y vuelve a tocar 📷.' : '📷 No se pudo abrir la cámara (otra app la está usando). · o usa 📱 Celular');
      return;
    }
    abriendo = false;
    if(mio !== vez || !raiz()){ s.getTracks().forEach(t => t.stop()); return; }
    stream = s; despierto(true);
    // Si el celular suelta la cámara (bloqueo, otra app, una llamada), vuelve a prenderse sola: solo se apaga con «✕».
    s.getVideoTracks().forEach(t => { t.onended = () => { if(mio === vez && stream === s) reabrir(); }; });
    const v = $('ecVideo'); v.srcObject = s; try{ await v.play(); }catch(e){}
    try{ detector = await lector; }catch(e){ estado('No se pudo preparar el lector de códigos (revisa el internet).'); return; }
    if(mio !== vez) return;
    // Linterna, si la cámara la tiene (en un local oscuro).
    try{ const tr = s.getVideoTracks()[0], cap = tr && tr.getCapabilities ? tr.getCapabilities() : {}; const lb = $('ecLuz');
      if(lb && cap && cap.torch){ lb.hidden = false; lb.onclick = async e => { e.stopPropagation(); const on = !lb.classList.contains('on'); try{ await tr.applyConstraints({ advanced: [{ torch: on }] }); lb.classList.toggle('on', on); }catch(x){} }; } }catch(e){}
    estado('✅ Listo: pasa los productos frente a la cámara');
    vivo = true; leer(mio);
  }
  async function leer(mio){
    let ocupado = false;
    const paso = async () => {
      if(!vivo || mio !== vez) return;
      const v = $('ecVideo');
      if(!ocupado && detector && v && v.videoWidth && libre()){
        ocupado = true;
        try{
          const codes = await detector.detect(v), ahora = Date.now();
          [...new Set((codes || []).filter(c => c && c.rawValue).map(c => c.rawValue))].forEach(raw => {
            const ult = vistos.get(raw) || 0; vistos.set(raw, ahora);
            if(ahora - ult < 800 || mio !== vez) return;                      // sigue quieto frente a la cámara: no se repite
            if(navigator.vibrate) try{ navigator.vibrate(60); }catch(e){}
            try{ if(typeof scanBeep === 'function') scanBeep(); }catch(e){}
            try{ window.ventoPOS.leerCodigo(raw, 1); }catch(e){}
            estado('✅ Leído: ' + raw);
          });
          if(vistos.size > 200) vistos.clear();
        }catch(e){}
        ocupado = false;
      }
      if(!vivo || mio !== vez) return;
      if(detector && detector.zxing) setTimeout(paso, 120);
      else { const vv = $('ecVideo'); (vv && vv.requestVideoFrameCallback) ? vv.requestVideoFrameCallback(paso) : requestAnimationFrame(paso); }
    };
    paso();
  }
  // recordar=true: «✕ Apagar cámara» (la próxima vez no prende sola). false: se cerró la caja (se acuerda).
  // 🔆 Mientras la cámara lee, la pantalla no se apaga (como una pistola lectora). Se suelta al apagar la cámara.
  let wake = null;
  function despierto(on){
    try{
      if(on && !wake && navigator.wakeLock && !document.hidden) navigator.wakeLock.request('screen').then(w => { wake = w; w.addEventListener('release', () => { if(wake === w) wake = null; }); }, () => {});
      if(!on && wake){ const w = wake; wake = null; w.release().catch(() => {}); }
    }catch(e){}
  }
  function reabrir(){
    if(abriendo || document.hidden || !raiz()) return;
    vez++; vivo = false; detector = null;
    if(stream){ stream.getTracks().forEach(t => { t.onended = null; t.stop(); }); stream = null; }
    prender();
  }
  document.addEventListener('visibilitychange', () => {
    if(document.hidden){ wake = null; return; }
    if(ls.get(LS) === '1' && raiz()){ const tr = stream && stream.getVideoTracks()[0]; if(!stream || !tr || tr.readyState === 'ended') reabrir(); else despierto(true); }
  });
  setInterval(() => {   // vigilante: la cámara se cortó sin avisar (video negro o congelado)
    if(!stream || abriendo || document.hidden) return;
    const tr = stream.getVideoTracks()[0], v = $('ecVideo');
    if(!tr || tr.readyState === 'ended') reabrir(); else if(v && v.paused) v.play().catch(() => {});
    if(!wake) despierto(true);
  }, 2500);
  function apagar(recordar){
    vez++; vivo = false; abriendo = false; detector = null; vistos.clear(); despierto(false);
    if(stream){ stream.getTracks().forEach(t => { t.onended = null; t.stop(); }); stream = null; }
    try{ const v = $('ecVideo'); if(v){ v.pause(); v.srcObject = null; } }catch(e){}
    const p = $('ecPanel'); if(p) p.remove();
    document.body.classList.remove('ec-on');
    if(recordar) ls.set(LS, null);
  }
  // Mientras la cámara abre, más toques no hacen nada (pedirla otra vez la deja «ocupada» en muchos celulares).
  function alternar(){ if(abriendo) return; if(activo()) apagar(true); else prender(); }

  // La caja se abre: si quedó prendido, la cámara arranca sola. Se cierra: se suelta la cámara.
  let abierta = false;
  setInterval(() => {
    const ahora = !!raiz();
    if(ahora && !abierta && ls.get(LS) === '1') prender();
    if(!ahora && abierta && (activo() || abriendo)) apagar(false);
    abierta = ahora;
  }, 300);
  window.addEventListener('pagehide', () => apagar(false));

  const css = document.createElement('style');
  css.textContent = '.ec-panel{margin:0 0 10px;border-radius:16px;overflow:hidden;background:#000;border:2px solid #16a34a;position:relative}' +
    '.ec-video{position:relative;height:clamp(150px,26vh,240px)}.ec-video video{width:100%;height:100%;object-fit:cover;display:block}' +
    '.ec-linea{position:absolute;left:8%;right:8%;top:50%;height:2px;background:#ef4444;box-shadow:0 0 8px #ef4444;animation:ecL 1.6s ease-in-out infinite}' +
    '@keyframes ecL{0%,100%{transform:translateY(-34px)}50%{transform:translateY(34px)}}' +
    '.ec-barra{display:flex;align-items:center;gap:6px;padding:7px 8px;background:#0b0f14;color:#fff}.ec-estado{flex:1;font:700 13px/1.3 var(--font-main,inherit)}' +
    '.ec-b{border:1px solid rgba(255,255,255,.35);background:transparent;color:#fff;border-radius:999px;padding:6px 10px;font:700 12.5px/1 var(--font-main,inherit);cursor:pointer}.ec-b.on{background:#facc15;color:#000}' +
    // Escaneando: sin el menú de abajo ni el botón de voz flotante; en el celular, sin los botones de productos.
    'body.ec-on .tabbar,body.ec-on .voice-fab-wrap,body.ec-on .o2-side{display:none!important}' +
    '@media (max-width:760px){body.ec-on #pzCajaOv .pz-grid,body.ec-on #pzCajaOv .pz-cats,body.ec-on #pzCajaOv .pz-favs,body.ec-on #pzCajaOv .pz-favaviso,body.ec-on #pzCajaOv .pz-kb,body.ec-on #pzCajaOv .pz-mesas,body.ec-on #pzCajaOv .cv-barra,body.ec-on #pzCajaOv .cv-atajos{display:none!important}' +
      // La venta va debajo de la cámara y del buscador, en orden (no pegada abajo tapándolos); COBRAR sí queda fijo abajo.
      'body.ec-on #pzCajaOv .pz-cart{position:static!important;max-height:none!important}body.ec-on #pzCajaOv .pz-pie{position:sticky;bottom:0;z-index:3;background:var(--surface)}}' +
    'body.ec-on #pzCajaOv [data-scan]{background:#16a34a!important;color:#fff!important;border-color:#16a34a!important}';
  document.head.appendChild(css);
  window.ventoEscanerCaja = { prender, apagar, alternar, activo, libre, celular };
})();
