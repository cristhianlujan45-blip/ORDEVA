/* =====================================================================
   ORDEVA · cuenta, soporte y licencias (lado del negocio)
   • Cada equipo avisa al servidor que existe (también sin cuenta en la nube): así el administrador de ORDEVA ve a
     todos los usuarios y en cuántos equipos usa cada uno su cuenta. Sin contraseñas ni datos del negocio.
   • 🎧 Soporte dentro de la app (Ajustes → Guía y soporte): se escribe al soporte de ORDEVA y la respuesta llega
     aquí mismo (con aviso). Funciona con o sin cuenta.
   • Recuperar la contraseña por MENSAJE DE TEXTO: se pide al soporte con el celular; el soporte comprueba que es
     el dueño y le manda una contraseña temporal por SMS. Al entrar con ella, ORDEVA pide poner una propia.
   • 📱 Celular de la cuenta (para recuperarla) en Ajustes → Negocio.
   • El correo del administrador de ORDEVA no se usa como cuenta de cliente: la cuenta de cliente es otra, con
     OTRA contraseña (ej. tucorreo+cliente@gmail.com, que llega al mismo correo). Si ya tenía su negocio con el
     correo de administrador, lo pasa a la cuenta de cliente sin perder nada.
   • Licencias del proveedor: link «#lic=VENTO-XXXX-XXXX-XXXX» o código en «💳 Mi plan».
   Necesita nube/vento-nube.js (ventoNube) y nube/vento-suscripcion.js (ventoSuscripcion).
   ===================================================================== */
(function(){
  'use strict';
  var ADMIN_CORREOS = ['cristhianwkh@gmail.com'];
  var K_CASOS = 'vento-soporte-casos', K_VISTOS = 'vento-soporte-avisados', K_EQ = 'vento-equipo-reg', K_LIC = 'vento-lic-pendiente';
  var $ = function(id){ return document.getElementById(id); };
  var esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var lsG = function(k, d){ try{ var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; }catch(e){ return d; } };
  var lsS = function(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
  var toast = function(t, ms){ try{ window.showToast && window.showToast(t, ms || 5000); }catch(e){} };
  var correoOk = function(e){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim()); };
  var hora = function(t){ try{ return new Date(t).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }); }catch(e){ return ''; } };

  // ---------- Nube ----------
  function nb(){ return window.ventoNube || null; }
  function nubeLista(){ try{ var n = nb(); if(!n || !n.configurada || !n.configurada()) return null; var c = n.config(); return c && c.url && c.key ? c : null; }catch(e){ return null; } }
  function conCuenta(){ try{ return !!(nb() && nb().correo && nb().correo()); }catch(e){ return false; } }
  function token(){
    if(!conCuenta()) return Promise.resolve(null);
    return nb().cliente().then(function(c){ return c.auth.getSession(); }).then(function(r){ return r && r.data && r.data.session ? r.data.session.access_token : null; }).catch(function(){ return null; });
  }
  function pedir(ruta, cuerpo, tok, metodo){
    var c = nubeLista(); if(!c) return Promise.reject(new Error('ORDEVA Nube no está disponible en este equipo.'));
    return fetch(c.url.replace(/\/+$/, '') + ruta, { method: metodo || 'POST', headers: { apikey: c.key, 'Content-Type': 'application/json', Authorization: 'Bearer ' + (tok || c.key) }, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) })
      .then(function(r){ return r.text().then(function(t){ var j = null; try{ j = t ? JSON.parse(t) : null; }catch(e){}
        if(!r.ok) throw Object.assign(new Error(mensaje((j && (j.message || j.msg || j.error_description || j.error)) || ('Error ' + r.status))), { status: r.status, j: j });
        return j; }); }, function(){ throw new Error('Sin conexión. Revisa el internet e intenta otra vez.'); });
  }
  function rpc(fn, args, tok){ return pedir('/rest/v1/rpc/' + fn, args || {}, tok); }
  function rpcSesion(fn, args){ return token().then(function(t){ return rpc(fn, args, t); }); }
  function mensaje(m){
    m = String(m || '');
    if(/mensaje_invalido/.test(m)) return 'Escribe el mensaje (máximo 2.000 letras).';
    if(/demasiados/.test(m)) return 'Enviaste muchos mensajes seguidos. Espera un rato.';
    if(/telefono_invalido/.test(m)) return 'Escribe el celular solo con números (ej. 3001234567).';
    if(/sin_permiso/.test(m)) return 'No tienes permiso para eso.';
    if(/invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos.';
    if(/already registered|already exists/i.test(m)) return 'Ese correo ya tiene una cuenta.';
    return m;
  }
  function g(nombre){ try{ return (0, eval)('typeof ' + nombre + ' !== "undefined" ? ' + nombre + ' : undefined'); }catch(e){ return undefined; } }   // globales «let» de index.html (data, authUser…)

  // ---------- 1. Este equipo avisa que existe ----------
  function equipo(){
    var c = ''; try{ c = localStorage.getItem('mesora-equipo') || ''; }catch(e){}
    if(!c && typeof window.codigoEquipo === 'function') try{ c = window.codigoEquipo(); }catch(e){}
    return /^[A-Za-z0-9_-]{6,64}$/.test(c) ? c : '';
  }
  function registrarEquipo(forzar){
    if(!nubeLista()) return Promise.resolve(false);
    var eq = equipo(), d = g('data'), u = g('authUser'); if(!eq || !u) return Promise.resolve(false);
    var neg = null; try{ neg = nb().negocio(); }catch(e){}
    var v = String(g('MESORA_VERSION') || '').replace(/^.*v/, '');
    var firma = [u, neg && neg.id, v, d && d.businessName].join('|'), antes = lsG(K_EQ, {});
    if(!forzar && antes.f === firma && Date.now() - (antes.t || 0) < 6 * 3600e3) return Promise.resolve(false);
    var p = { equipo: eq, negocio: (d && d.businessName) || '', usuario: u, correo: correoOk(u) ? u : null, negocio_id: neg ? neg.id : null, version: v,
      plataforma: window.VentoAndroid ? 'apk' : 'web', modelo: String(navigator.userAgent || '').replace(/^Mozilla\/5\.0 /, '').slice(0, 110) };
    return rpcSesion('registrar_instalacion', { p: p }).then(function(){ lsS(K_EQ, { f: firma, t: Date.now() }); return true; }, function(){ return false; });
  }

  // ---------- 2. Soporte ----------
  var TIPOS = { ayuda: '🙋 Necesito ayuda', error: '🐞 Algo no funciona', pago: '💳 Un pago o mi plan', licencia: '🔑 Mi licencia', clave: '🔑 No puedo entrar', otro: '💡 Idea u otra cosa' };
  var EST = { abierto: ['Enviado', ''], respondido: ['💬 Te respondieron', 'vc-pill-on'], cerrado: ['✅ Resuelto', 'vc-pill-ok'] };
  function misClaves(){ return lsG(K_CASOS, []).filter(function(x){ return x && x.id && x.clave; }); }
  function guardarClave(id, clave){ var l = misClaves().filter(function(x){ return x.id !== id; }); l.unshift({ id: id, clave: clave }); lsS(K_CASOS, l.slice(0, 40)); }
  function claveDe(id){ var x = misClaves().filter(function(c){ return c.id === id; })[0]; return x ? x.clave : null; }
  var casos = [];
  function cargarCasos(){
    if(!nubeLista() || (!conCuenta() && !misClaves().length)) { casos = []; return Promise.resolve(casos); }
    return rpcSesion('soporte_mis_casos', { p_claves: misClaves() }).then(function(l){ casos = Array.isArray(l) ? l : []; return casos; });
  }
  /* Diagnóstico del equipo para el administrador de ORDEVA: los códigos de error que registró la app (E-XXXX), qué pasó,
     dónde y cuántas veces, la versión y el equipo. Va pegado al reporte SIN mostrárselo al cliente (solo el
     administrador lo ve en ORDEVA Admin → Soporte). Nunca ventas, productos, clientes ni contraseñas. */
  function diagnostico(){
    var l = [];
    try{ l = JSON.parse(localStorage.getItem('vito_errlog') || '[]') || []; }catch(e){ l = window.__mesoraErrMem || []; }
    var errores = l.slice(-12).reverse().map(function(x){ return { cod: x.cod, tipo: x.tipo, msg: String(x.msg || '').slice(0, 300), donde: String(x.donde || '').slice(0, 160), n: x.n || 1, t: x.t || 0 }; });
    try{ var pend = window.ventoErrores && window.ventoErrores.pendientes ? window.ventoErrores.pendientes() : [];
      pend.slice(-3).forEach(function(x){ errores.push({ cod: (x.detalle && x.detalle.codigo) || '', tipo: x.tipo, msg: String(x.mensaje || '').slice(0, 300), donde: x.pagina || '', n: x.veces || 1, t: x.t || 0 }); }); }catch(e){}
    var v = g('MESORA_VERSION'), act = document.querySelector('nav button.active');
    return { errores: errores.slice(0, 15), version: v ? String(v).replace(/^.*v/, '') : '', plataforma: window.VentoAndroid ? 'apk' : (/Android/.test(navigator.userAgent) ? 'android' : 'web'),
      pagina: (location.pathname.split('/').pop() || 'index.html'), modelo: String(navigator.userAgent || '').replace(/^Mozilla\/5\.0 /, '').slice(0, 110), vista: act ? act.dataset.view || '' : '' };
  }
  window.ventoDiagnostico = diagnostico;
  function crearCaso(o){
    var d = g('data'), u = g('authUser');
    var p = { tipo: o.tipo || 'ayuda', asunto: o.asunto || '', mensaje: o.mensaje || '', telefono: o.telefono || '', email: o.email || (correoOk(u) ? u : ''),
      nombre: o.nombre || u || '', negocio: o.negocio || (d && d.businessName) || '', equipo: equipo(), diagnostico: diagnostico() };
    try{ var n = nb() && nb().negocio(); if(n) p.negocio_id = n.id; }catch(e){}
    return rpcSesion('soporte_crear', { p: p }).then(function(r){ guardarClave(r.id, r.clave); return r; });
  }
  /* Fotos y pantallazos para soporte: se achican aquí (máx. 1600 px, JPEG) y los sube el SERVIDOR de ORDEVA a un
     almacenamiento privado; solo el administrador las ve. Después de cada mensaje se avisa al administrador. */
  var FN = '/functions/v1/vento-suscripciones/';
  function achicar(file){
    return new Promise(function(ok, mal){
      if(!file || !/^image\//.test(file.type || '')) return mal(new Error('Elige una foto o un pantallazo.'));
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function(){
        try{
          var k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
          var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
          var d = c.toDataURL('image/jpeg', 0.82); URL.revokeObjectURL(url);
          if(d.length > 4.1e6) return mal(new Error('La imagen es muy pesada. Recórtala e inténtalo otra vez.'));
          ok(d);
        }catch(e){ mal(new Error('No se pudo leer la imagen.')); }
      };
      img.onerror = function(){ URL.revokeObjectURL(url); mal(new Error('No se pudo leer la imagen.')); };
      img.src = url;
    });
  }
  function enviarImagenes(caso, clave, files){
    var l = Array.prototype.slice.call(files || [], 0, 3), r = Promise.resolve(null);
    l.forEach(function(f){ r = r.then(function(){ return achicar(f); }).then(function(b64){
      return token().then(function(t){ return pedir(FN + 'soporte-adjunto', { caso: caso, clave: clave, imagen: { base64: b64 } }, t); }); }); });
    return r;
  }
  function avisarAdmin(caso, clave){ return token().then(function(t){ return pedir(FN + 'soporte-avisar', { caso: caso, clave: clave }, t); }).catch(function(){}); }
  function noLeidos(){ return casos.reduce(function(a, c){ return a + (c.sin_leer || 0); }, 0); }
  // Revisa si el soporte respondió: aviso (y notificación del celular) una sola vez por respuesta.
  function revisarRespuestas(){
    return cargarCasos().then(function(){
      pintarSoporte();
      var vistos = lsG(K_VISTOS, {}), nuevos = [];
      casos.forEach(function(c){ var ult = (c.mensajes || []).filter(function(m){ return m.autor === 'admin'; }).slice(-1)[0]; if(ult && c.sin_leer && vistos[c.id] !== ult.id){ nuevos.push({ c: c, m: ult }); vistos[c.id] = ult.id; } });
      if(nuevos.length){
        lsS(K_VISTOS, vistos);
        if(window.ventoAvisoOn && !window.ventoAvisoOn('soporte')) return nuevos.length;   // apagado en Ajustes → Notificaciones
        var x = nuevos[0];
        toast('🎧 El soporte de ORDEVA te respondió: «' + String(x.m.texto).slice(0, 90) + (x.m.texto.length > 90 ? '…' : '') + '». Míralo en Ajustes → Guía y soporte.', 10000);
        try{ if(typeof window.ventoAvisoCel === 'function') window.ventoAvisoCel('🎧 Soporte de ORDEVA', String(x.m.texto).slice(0, 140), 'avisos'); }catch(e){}
      }
      return nuevos.length;
    }).catch(function(){ return 0; });
  }
  function pintarSoporte(){
    var box = $('vcCasos'); if(!box) return;
    var n = noLeidos(), b = $('vcBadge'); if(b){ b.textContent = n ? String(n) : ''; b.hidden = !n; }
    if(!casos.length){ box.innerHTML = ''; return; }
    box.innerHTML = '<div class="vc-tit">Tus conversaciones con soporte</div>' + casos.slice(0, 10).map(function(c){
      var e = EST[c.estado] || [c.estado, ''], ult = (c.mensajes || []).slice(-1)[0] || {};
      return '<button type="button" class="vc-caso" data-vccaso="' + esc(c.id) + '"><span class="vc-caso-t"><b>' + esc(c.asunto) + '</b><small>' + esc((ult.autor === 'admin' ? 'Soporte: ' : 'Tú: ') + String(ult.texto || '').slice(0, 80)) + '</small></span>' +
        (c.sin_leer ? '<span class="vc-pill vc-pill-on">' + c.sin_leer + ' nueva' + (c.sin_leer === 1 ? '' : 's') + '</span>' : '<span class="vc-pill ' + e[1] + '">' + esc(e[0]) + '</span>') + '</button>';
    }).join('');
  }
  function montarSoporte(){
    if($('vcSoporte')) return;
    var grupo = document.querySelector('#view-ajustes .settings-group[data-cat="ayuda"]'); if(!grupo) return;
    var fila = grupo.querySelector('.settings-row');
    var div = document.createElement('div');
    div.className = 'settings-row'; div.id = 'vcSoporte'; div.style.cssText = 'flex-direction:column;align-items:stretch;gap:8px;margin-top:6px';
    div.innerHTML = '<div class="settings-row-text"><strong>🎧 Soporte de ORDEVA <span class="vc-pill vc-pill-on" id="vcBadge" hidden></span></strong><span>Escríbenos aquí mismo: la respuesta te llega en la app (con aviso). Atiende el equipo de ORDEVA, el único distribuidor autorizado.</span></div>' +
      '<div id="vcCasos"></div>' +
      '<button class="btn-primary" id="vcNuevo" type="button">✍️ Escribir a soporte</button>' +
      '<button class="btn-ghost" id="vcReportar" type="button">🐞 Reportar un problema</button>' +
      '<div id="vcForm" hidden style="display:flex;flex-direction:column;gap:8px">' +
        '<select id="vcTipo" class="mz-in">' + Object.keys(TIPOS).filter(function(k){ return k !== 'clave'; }).map(function(k){ return '<option value="' + k + '">' + TIPOS[k] + '</option>'; }).join('') + '</select>' +
        '<input id="vcAsunto" class="mz-in" maxlength="120" placeholder="Asunto (ej: no me sale la factura)">' +
        '<textarea id="vcMsg" class="mz-in" rows="4" maxlength="2000" style="width:100%;resize:vertical;box-sizing:border-box" placeholder="Cuéntanos qué pasa"></textarea>' +
        '<input id="vcTel" class="mz-in" inputmode="tel" maxlength="20" placeholder="Tu celular (opcional, por si hay que llamarte)">' +
        '<label class="btn-ghost" style="text-align:center;cursor:pointer">📎 Agregar fotos o pantallazos (hasta 3)<input id="vcFotos" type="file" accept="image/*" multiple hidden></label><div class="settings-desc" id="vcFotosTxt"></div>' +
        '<button class="btn-primary" id="vcEnviar" type="button">📨 Enviar</button><div class="settings-desc" id="vcEstado"></div></div>';
    if(fila) grupo.insertBefore(div, fila); else grupo.appendChild(div);
    var st = document.createElement('style');
    st.textContent = '.vc-tit{font-weight:700;font-size:13px;color:var(--ink-soft);margin:2px 0}.vc-caso{display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:var(--card,transparent);color:inherit;font:inherit;cursor:pointer;margin-bottom:6px}' +
      '.vc-caso-t{flex:1;min-width:0}.vc-caso-t b,.vc-caso-t small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.vc-caso-t small{color:var(--ink-soft)}' +
      '.vc-pill{font-size:11.5px;font-weight:700;padding:3px 9px;border-radius:999px;border:1px solid var(--line);white-space:nowrap}.vc-pill-on{background:var(--accent,#7c3aed);color:#fff;border-color:transparent}.vc-pill-ok{color:#16a34a;border-color:#16a34a}' +
      '.vc-hilo{display:flex;flex-direction:column;gap:8px;max-height:52vh;overflow:auto;margin:10px 0;text-align:left}.vc-m{max-width:85%;padding:9px 12px;border-radius:14px;border:1px solid var(--line);white-space:pre-wrap;overflow-wrap:anywhere}' +
      '.vc-m.adm{align-self:flex-start;background:color-mix(in srgb,var(--accent,#7c3aed) 16%,transparent)}.vc-m.yo{align-self:flex-end}.vc-m small{display:block;font-size:11px;color:var(--ink-soft);margin-top:3px}';
    document.head.appendChild(st);
    $('vcReportar').onclick = function(){ reportarProblema(); };
    $('vcNuevo').onclick = function(){ var f = $('vcForm'); f.hidden = !f.hidden; f.style.display = f.hidden ? 'none' : 'flex'; if(!f.hidden) $('vcMsg').focus(); };
    $('vcForm').style.display = 'none';
    $('vcEnviar').onclick = function(){
      var msg = $('vcMsg').value.trim(), est = $('vcEstado'), btn = $('vcEnviar');
      if(msg.length < 2){ est.textContent = 'Escribe qué pasa.'; $('vcMsg').focus(); return; }
      if(!nubeLista()){ est.textContent = 'Este equipo no tiene conexión con el servidor de ORDEVA. Escríbenos por WhatsApp (abajo).'; return; }
      btn.disabled = true; est.textContent = '⏳ Enviando…';
      var fotos = $('vcFotos').files;
      crearCaso({ tipo: $('vcTipo').value, asunto: $('vcAsunto').value.trim(), mensaje: msg, telefono: $('vcTel').value.trim() })
        .then(function(r){
          var conFotos = fotos && fotos.length;
          if(conFotos) est.textContent = '⏳ Subiendo ' + Math.min(3, fotos.length) + ' imagen' + (fotos.length > 1 ? 'es' : '') + '…';
          return (conFotos ? enviarImagenes(r.id, r.clave, fotos) : avisarAdmin(r.id, r.clave)).then(function(){ return ''; }, function(e){ return ' (' + e.message + ')'; });
        })
        .then(function(nota){ $('vcMsg').value = ''; $('vcAsunto').value = ''; $('vcFotos').value = ''; $('vcFotosTxt').textContent = '';
          est.textContent = nota ? '✅ Mensaje enviado, pero una imagen no se pudo subir' + nota + '.' : '✅ Enviado. Te avisamos aquí cuando te respondan.';
          toast('📨 Mensaje enviado al soporte de ORDEVA.'); return cargarCasos().then(pintarSoporte); },
          function(e){ est.textContent = '⚠️ ' + e.message; })
        .then(function(){ btn.disabled = false; });
    };
    $('vcFotos').onchange = function(){ var n = this.files ? this.files.length : 0; $('vcFotosTxt').textContent = n ? '📎 ' + Math.min(3, n) + ' imagen' + (n > 1 ? 'es' : '') + ' lista' + (n > 1 ? 's' : '') + (n > 3 ? ' (solo se envían 3)' : '') : ''; };
    $('vcCasos').addEventListener('click', function(e){ var b = e.target.closest('[data-vccaso]'); if(b) abrirCaso(b.dataset.vccaso); });
    cargarCasos().then(pintarSoporte).catch(function(){});
  }
  function abrirCaso(id){
    var c = casos.filter(function(x){ return x.id === id; })[0]; if(!c) return;
    var ov = $('vcCasoOv');
    if(!ov){
      ov = document.createElement('div'); ov.id = 'vcCasoOv'; ov.className = 'overlay';
      ov.innerHTML = '<div class="modal" style="max-width:520px"><h2 id="vcCasoTit"></h2><div class="vc-hilo" id="vcHilo"></div>' +
        '<textarea id="vcResp" class="mz-in" rows="3" maxlength="2000" style="width:100%;box-sizing:border-box" placeholder="Escribe tu respuesta"></textarea>' +
        '<div class="modal-actions"><button class="btn-primary" id="vcResponder" type="button">📨 Responder</button>' +
        '<label class="btn-ghost" style="cursor:pointer">📎 Foto<input id="vcRespFoto" type="file" accept="image/*" multiple hidden></label>' +
        '<button class="btn-close" id="vcCerrarCaso" type="button">Cerrar</button></div><div class="settings-desc" id="vcRespEst"></div></div>';
      document.body.appendChild(ov);
      $('vcCerrarCaso').onclick = function(){ ov.classList.remove('show'); };
      ov.addEventListener('click', function(e){ if(e.target === ov) ov.classList.remove('show'); });
    }
    var pintar = function(){
      $('vcCasoTit').textContent = '🎧 ' + c.asunto;
      $('vcHilo').innerHTML = (c.mensajes || []).map(function(m){ return '<div class="vc-m ' + (m.autor === 'admin' ? 'adm' : 'yo') + '">' + esc(m.texto) + '<small>' + (m.autor === 'admin' ? 'Soporte de ORDEVA · ' : 'Tú · ') + esc(hora(m.creado_en)) + '</small></div>'; }).join('');
      setTimeout(function(){ var h = $('vcHilo'); if(h) h.scrollTop = 1e6; }, 30);
    };
    pintar(); ov.classList.add('show');
    $('vcRespFoto').value = '';
    $('vcRespFoto').onchange = function(){
      var f = this.files; if(!f || !f.length) return;
      var est = $('vcRespEst'); est.textContent = '⏳ Subiendo ' + Math.min(3, f.length) + ' imagen' + (f.length > 1 ? 'es' : '') + '…';
      enviarImagenes(c.id, claveDe(c.id), f).then(function(){ est.textContent = '✅ Imagen enviada.'; return cargarCasos().then(function(){ var n = casos.filter(function(x){ return x.id === c.id; })[0]; if(n) Object.assign(c, n); pintar(); pintarSoporte(); }); },
        function(e){ est.textContent = '⚠️ ' + e.message; }).then(function(){ $('vcRespFoto').value = ''; });
    };
    if(c.sin_leer) rpcSesion('soporte_visto', { p_caso: c.id, p_clave: claveDe(c.id) }).then(function(){ c.sin_leer = 0; pintarSoporte(); }).catch(function(){});
    $('vcResponder').onclick = function(){
      var t = $('vcResp').value.trim(); if(!t){ $('vcResp').focus(); return; }
      $('vcResponder').disabled = true;
      rpcSesion('soporte_escribir', { p_caso: c.id, p_clave: claveDe(c.id), p_texto: t }).then(function(r){ $('vcResp').value = ''; Object.assign(c, r); pintar(); pintarSoporte(); avisarAdmin(c.id, claveDe(c.id));
          rpcSesion('soporte_diagnostico', { p_caso: c.id, p_clave: claveDe(c.id), p: diagnostico() }).catch(function(){}); },
        function(e){ toast('⚠️ ' + e.message, 6000); }).then(function(){ $('vcResponder').disabled = false; });
    };
  }

  // ---------- 3. Recuperar la contraseña por mensaje de texto ----------
  function montarRecuperarSms(){
    var rf = $('recForm'); if(!rf || $('vcSmsBox')) return;
    var box = document.createElement('div'); box.className = 'auth-hint'; box.id = 'vcSmsBox';
    box.innerHTML = '📱 <b>Por mensaje de texto</b>: ¿no tienes los códigos ni acceso al correo? Escribe tu celular y el soporte de ORDEVA, después de comprobar que eres el dueño de la cuenta, te manda una <b>contraseña temporal por SMS</b>.' +
      '<input id="vcSmsTel" class="mz-in" inputmode="tel" maxlength="20" placeholder="Tu celular (ej. 3001234567)" style="width:100%;box-sizing:border-box;margin-top:6px">' +
      '<button type="button" class="btn-ghost" id="vcSmsBtn" style="margin-top:6px;width:100%">📱 Pedir una contraseña por mensaje de texto</button><div id="vcSmsTxt" style="margin-top:6px"></div>';
    var otras = $('recOtras'), ref = $('recMailBox');
    if(otras) otras.appendChild(box); else if(ref && ref.nextSibling) rf.insertBefore(box, ref.nextSibling); else rf.appendChild(box);
    $('vcSmsBtn').onclick = function(){
      var tel = $('vcSmsTel').value.replace(/[^\d+]/g, ''), user = String(($('recUser') || {}).value || '').trim().toLowerCase(), t = $('vcSmsTxt');
      if(tel.replace(/\D/g, '').length < 7){ t.textContent = '⚠️ Escribe tu número de celular.'; return; }
      if(!user){ t.textContent = '⚠️ Escribe arriba tu correo o usuario.'; return; }
      if(!nubeLista()){ t.textContent = '⚠️ Sin conexión con el servidor de ORDEVA. Escríbenos por WhatsApp.'; return; }
      var b = $('vcSmsBtn'); b.disabled = true; t.textContent = '⏳ Enviando…';
      crearCaso({ tipo: 'clave', asunto: 'Recuperar contraseña por mensaje de texto', telefono: tel, email: correoOk(user) ? user : '', nombre: user,
        mensaje: 'Olvidé mi contraseña. Pido una contraseña temporal por mensaje de texto (SMS).\nCuenta: ' + user + '\nCelular: ' + tel })
        .then(function(){ t.innerHTML = '✅ Listo. El soporte de ORDEVA comprueba que el celular <b>' + esc(tel) + '</b> sea el de la cuenta y te manda la contraseña temporal por mensaje de texto. Después entra con <b>' + esc(user) + '</b> y esa contraseña: ORDEVA te pide poner una nueva.'; },
          function(e){ t.textContent = '⚠️ ' + e.message; })
        .then(function(){ b.disabled = false; });
    };
  }

  // ---------- 4. Celular de la cuenta y contraseña temporal ----------
  var perfil = null, perfilDe = '';
  function cargarPerfil(){
    var c = conCuenta() ? nb().correo() : '';
    if(!c){ perfil = null; perfilDe = ''; return Promise.resolve(null); }
    return rpcSesion('perfil_yo', {}).then(function(p){ perfil = p || {}; perfilDe = c; pintarPerfil(); return perfil; }, function(){ return null; });
  }
  function montarPerfil(){
    if($('vcPerfil')) return;
    var ref = $('accMailBtn'); var fila = ref && ref.closest('.settings-row'); if(!fila) return;
    var div = document.createElement('div'); div.className = 'settings-row'; div.id = 'vcPerfil'; div.hidden = true;
    div.innerHTML = '<div class="settings-row-text"><strong>📱 Celular de la cuenta</strong><span>Para recuperar la cuenta por mensaje de texto si olvidas la contraseña (el soporte de ORDEVA comprueba que sea este número).</span>' +
      '<span style="display:flex;gap:6px;margin-top:6px"><input id="vcPerfilTel" class="mz-in" inputmode="tel" maxlength="20" placeholder="3001234567" style="flex:1;min-width:0"><button class="btn-ghost" id="vcPerfilOk" type="button">Guardar</button></span>' +
      '<span id="vcCelBox" hidden style="display:block;margin-top:8px"><button class="btn-ghost" id="vcCelUnir" type="button" style="width:100%">📲 Usar este celular para entrar con un código</button>' +
      '<span id="vcCelPaso" hidden style="display:flex;gap:6px;margin-top:6px"><input id="vcCelCod" class="mz-in" inputmode="numeric" maxlength="8" autocomplete="one-time-code" placeholder="Código del SMS" style="flex:1;min-width:0"><button class="btn-primary" id="vcCelOk" type="button">Unir</button></span>' +
      '<span id="vcCelTxt" style="display:block;margin-top:4px;font-size:12px"></span></span></div>';
    fila.parentNode.insertBefore(div, fila.nextSibling);
    // Entrar con un mensaje de texto: el celular se une a la cuenta con un código (solo si ORDEVA manda SMS).
    $('vcCelUnir').onclick = function(){
      var tel = $('vcPerfilTel').value, t = $('vcCelTxt'), b = $('vcCelUnir');
      if(String(tel).replace(/\D/g, '').length < 10){ t.textContent = '⚠️ Escribe tu celular arriba (ej. 3001234567).'; return; }
      b.disabled = true; t.textContent = '⏳ Enviando el código…';
      nb().celularUnir(tel).then(function(){ t.textContent = '✅ Te mandamos un código por mensaje de texto. Escríbelo aquí:'; $('vcCelPaso').hidden = false; $('vcCelCod').focus(); },
        function(e){ t.textContent = '⚠️ ' + nb().msgError(e); }).then(function(){ b.disabled = false; });
    };
    $('vcCelOk').onclick = function(){
      var tel = $('vcPerfilTel').value, t = $('vcCelTxt'), b = $('vcCelOk');
      b.disabled = true;
      nb().celularConfirmar(tel, $('vcCelCod').value).then(function(){
        $('vcCelPaso').hidden = true; $('vcCelCod').value = '';
        t.textContent = '✅ Listo: ahora también entras con un código que te llega a ' + nb().celularE164(tel) + ' («📲 Entrar fácil con un código» → «📱 Al celular»).';
        rpcSesion('perfil_guardar', { p: { telefono: tel } }).then(function(p){ perfil = p; }, function(){});
      }, function(e){ t.textContent = '⚠️ ' + nb().msgError(e); }).then(function(){ b.disabled = false; });
    };
    $('vcPerfilOk').onclick = function(){
      var b = $('vcPerfilOk'); b.disabled = true;
      rpcSesion('perfil_guardar', { p: { telefono: $('vcPerfilTel').value } }).then(function(p){ perfil = p; pintarPerfil(); toast('✅ Celular guardado: con él puedes recuperar tu cuenta por mensaje de texto.'); },
        function(e){ toast('⚠️ ' + e.message, 6000); }).then(function(){ b.disabled = false; });
    };
  }
  function pintarPerfil(){
    var d = $('vcPerfil'); if(!d) return; d.hidden = !perfil; if(perfil && document.activeElement !== $('vcPerfilTel')) $('vcPerfilTel').value = perfil.telefono || '';
    // «Usar este celular para entrar»: solo se ve si el servidor de ORDEVA manda mensajes de texto.
    var n = nb(); if(!perfil || !n || !n.celularDisponible || !$('vcCelBox')) return;
    n.celularDisponible().then(function(ok){
      $('vcCelBox').hidden = !ok; if(!ok) return;
      n.celularDeCuenta().then(function(c){ if(c && !$('vcCelTxt').textContent) $('vcCelTxt').textContent = '✅ Ya entras con un código al ' + c + '.'; });
    });
  }
  // Entró con una contraseña temporal que le dio el soporte: se le pide poner una propia.
  function pedirClaveNueva(){
    if(!perfil || !perfil.cambiar_clave || $('vcClaveOv')) return;
    var correo = nb().correo();
    var ov = document.createElement('div'); ov.id = 'vcClaveOv'; ov.className = 'overlay show'; ov.style.zIndex = '10050';
    ov.innerHTML = '<div class="modal" style="max-width:420px"><h2>🔑 Pon tu propia contraseña</h2><div class="modal-sub">Entraste con una contraseña temporal del soporte de ORDEVA. Escribe una nueva (mínimo 8 caracteres) para <b>' + esc(correo) + '</b>.</div>' +
      '<input id="vcCl1" type="password" class="mz-in" autocomplete="new-password" placeholder="Contraseña nueva" style="width:100%;box-sizing:border-box;margin-top:8px">' +
      '<input id="vcCl2" type="password" class="mz-in" autocomplete="new-password" placeholder="Repítela" style="width:100%;box-sizing:border-box;margin-top:8px">' +
      '<div class="auth-err" id="vcClErr"></div><div class="modal-actions"><button class="btn-primary" id="vcClOk" type="button">Guardar contraseña</button></div></div>';
    document.body.appendChild(ov);
    $('vcClOk').onclick = function(){
      var a = $('vcCl1').value, b = $('vcCl2').value, er = $('vcClErr');
      if(a.length < 8){ er.textContent = 'Mínimo 8 caracteres.'; return; }
      if(a !== b){ er.textContent = 'Las dos no son iguales.'; return; }
      $('vcClOk').disabled = true;
      nb().nuevaClave(a).then(function(){
        try{ if(typeof window.authPonerClaveLocal === 'function') return window.authPonerClaveLocal(correo, a); }catch(e){}
      }).then(function(){ return rpcSesion('perfil_guardar', { p: { clave_cambiada: true } }); })
        .then(function(p){ perfil = p; ov.remove(); toast('✅ Contraseña nueva guardada.'); }, function(e){ er.textContent = '⚠️ ' + mensaje(e && e.message); $('vcClOk').disabled = false; });
    };
  }

  // ---------- 4b. Le cambiaron la contraseña a la cuenta (ORDEVA Admin u otro equipo) ----------
  // 1.60.0: el equipo que estaba adentro con esa cuenta cierra la sesión y pide la contraseña nueva. Se compara la
  // hora en que se puso la contraseña (la del servidor, no el reloj del celular) con la que se vio al entrar.
  // Solo sale quien entró CON esa cuenta: el empleado que usa este celular sigue en lo suyo.
  var revisandoClave = false, claveRevisada = 0;
  function revisarClavePuesta(ya){
    var n = nb(), c = conCuenta() ? n.correo() : '';
    if(!c || !n.claveVista || revisandoClave || n.cambiandoClave() || g('authUser') !== c || navigator.onLine === false) return Promise.resolve(false);
    if(!ya && Date.now() - claveRevisada < 30e3) return Promise.resolve(false);
    revisandoClave = true; claveRevisada = Date.now();
    return rpcSesion('perfil_yo', {}).then(function(p){
      if(!p || n.cambiandoClave() || g('authUser') !== c || n.correo() !== c) return false;
      perfil = p; perfilDe = c;
      var ahora = n.claveMarca ? n.claveMarca(p) : (p.clave_puesta_en || ''), antes = n.claveVista(c);
      if(antes === undefined || antes === null){ n.claveVista(c, ahora); return false; }   // primera vez en este equipo
      if(antes === ahora) return false;
      // ¿Qué cambió? La contraseña, o «cerrar sesión en todos los equipos» (lo que va después de «|»).
      var motivo = String(antes).split('|')[0] === String(ahora).split('|')[0] ? 'sesiones' : 'clave';
      if(typeof window.ventoSalirPorClave === 'function'){ window.ventoSalirPorClave(c, motivo); return true; }
      return false;
    }, function(){ return false; }).then(function(r){ revisandoClave = false; return r; });
  }

  // 1.61.0: Ajustes → Cuenta: «🚪 Cerrar sesión en mis otros equipos» (si perdió o le robaron un celular). Este sigue
  // adentro; la contraseña no cambia. Solo con la cuenta de ORDEVA abierta en este equipo.
  function montarCerrarOtros(){
    var ref = $('accLogoutBtn'), fila = ref && ref.closest('.settings-row'); if(!fila) return;
    var c = conCuenta() ? nb().correo() : '', mostrar = !!c && g('authUser') === c && !!nb().cerrarOtrasSesiones;
    var div = $('vcOtros');
    if(!div){
      if(!mostrar) return;
      div = document.createElement('div'); div.className = 'settings-row'; div.id = 'vcOtros';
      div.innerHTML = '<div class="settings-row-text"><strong>🚪 Cerrar sesión en mis otros equipos</strong><span>Si perdiste o te robaron un celular: en los demás equipos donde entraste con tu cuenta se cierra la sesión. Tu contraseña es la misma; este equipo sigue adentro.</span></div>' +
        '<button class="btn-danger-outline" id="vcOtrosBtn" type="button">Cerrar</button>';
      fila.parentNode.insertBefore(div, fila);
      $('vcOtrosBtn').onclick = function(){
        var b = $('vcOtrosBtn'), sigue = function(ok){
          if(!ok) return;
          b.disabled = true;
          nb().cerrarOtrasSesiones().then(function(){ toast('🚪 Listo: en tus otros equipos se cierra la sesión (al instante con internet, o apenas se conecten).', 7000); },
            function(e){ toast('⚠️ No se pudo: ' + (nb().msgError ? nb().msgError(e) : (e && e.message)), 6000); }).then(function(){ b.disabled = false; });
        };
        var q = { title: '¿Cerrar sesión en tus otros equipos?', message: 'En cada equipo donde entraste con ' + c + ' te va a pedir entrar otra vez (con internet). Este equipo sigue adentro y tu contraseña no cambia.', confirmText: 'Sí, cerrar', icon: '🚪' };
        if(typeof window.showConfirm === 'function') window.showConfirm(q).then(sigue); else sigue(window.confirm(q.message));
      };
    }
    div.hidden = !mostrar;
  }

  // ---------- 5. El correo del administrador de ORDEVA no es cuenta de cliente ----------
  function base(e){ var m = /^([^+@\s]+)(\+[^@\s]*)?@(.+)$/.exec(String(e || '').trim().toLowerCase()); return m ? m[1] + '@' + m[3] : String(e || '').trim().toLowerCase(); }
  function esAdmin(e){ return ADMIN_CORREOS.indexOf(String(e || '').trim().toLowerCase()) >= 0; }
  function aliasCliente(e){ var m = /^([^+@\s]+)@(.+)$/.exec(base(e)); return m ? m[1] + '+cliente@' + m[2] : ''; }
  function entrarRaw(email, clave){ return pedir('/auth/v1/token?grant_type=password', { email: email, password: clave }); }
  // Devuelve true si se ocupó (no sigue el inicio de sesión normal).
  function guardia(user, pass, nueva){
    user = String(user || '').trim().toLowerCase();
    var err = $('authErr');
    if(esAdmin(user)){ dialogoAdmin(user, pass); return Promise.resolve(true); }
    // Cuenta de cliente del administrador (ej. +cliente): la contraseña tiene que ser OTRA.
    if(nueva && esAdmin(base(user)) && nubeLista() && pass){
      return entrarRaw(base(user), pass).then(function(){ if(err) err.textContent = 'La contraseña de tu cuenta de cliente tiene que ser DIFERENTE a la de administrador.'; return true; }, function(){ return false; });
    }
    return Promise.resolve(false);
  }
  function dialogoAdmin(user, pass){
    var ov = $('vcAdmOv');
    if(!ov){ ov = document.createElement('div'); ov.id = 'vcAdmOv'; ov.className = 'overlay'; ov.style.zIndex = '10050'; document.body.appendChild(ov); }   // encima de la pantalla de entrar
    var alias = aliasCliente(user);
    ov.innerHTML = '<div class="modal" style="max-width:440px"><h2>👑 Ese es el correo de administrador</h2>' +
      '<div class="modal-sub">El correo <b>' + esc(user) + '</b> es para entrar a <b>ORDEVA Admin</b>. Para usar ORDEVA en tu negocio usa tu <b>cuenta de cliente</b>, con <b>otra contraseña</b>. Por ejemplo <b>' + esc(alias) + '</b> (te llega al mismo correo).</div>' +
      '<div class="modal-actions" style="flex-direction:column;gap:8px">' +
        '<button class="btn-primary" id="vcAdmCli" type="button" style="width:100%">👤 Entrar con mi cuenta de cliente</button>' +
        (nubeLista() ? '<button class="btn-ghost" id="vcAdmPasar" type="button" style="width:100%">🔀 Ya tenía mi negocio con este correo: pasarlo a mi cuenta de cliente</button>' : '') +
        '<a class="btn-ghost" href="admin.html" style="width:100%;text-align:center;box-sizing:border-box">👑 Abrir ORDEVA Admin</a>' +
        '<button class="btn-close" id="vcAdmNo" type="button">Cancelar</button></div>' +
      '<div id="vcPasarBox" hidden style="margin-top:10px;display:flex;flex-direction:column;gap:8px;text-align:left">' +
        '<label>Contraseña de administrador<input id="vcPaAdm" type="password" class="mz-in" autocomplete="current-password" style="width:100%;box-sizing:border-box"></label>' +
        '<label>Correo de tu cuenta de cliente<input id="vcPaCli" class="mz-in" inputmode="email" autocapitalize="none" spellcheck="false" style="width:100%;box-sizing:border-box"></label>' +
        '<label>Contraseña de cliente (otra, mínimo 8)<input id="vcPaCl1" type="password" class="mz-in" autocomplete="new-password" style="width:100%;box-sizing:border-box"></label>' +
        '<label>Repítela<input id="vcPaCl2" type="password" class="mz-in" autocomplete="new-password" style="width:100%;box-sizing:border-box"></label>' +
        '<div class="auth-err" id="vcPaErr"></div><button class="btn-primary" id="vcPaGo" type="button">🔀 Pasar mi negocio y entrar</button></div></div>';
    ov.classList.add('show');
    var cerrar = function(){ ov.classList.remove('show'); };
    $('vcAdmNo').onclick = cerrar;
    $('vcAdmCli').onclick = function(){ cerrar(); var u = $('authUser'), p = $('authPass'); if(u){ u.value = alias; } if(p){ p.value = ''; p.focus(); } var e = $('authErr'); if(e) e.textContent = 'Escribe la contraseña de tu cuenta de cliente (si todavía no la tienes, toca «➕ Crear cuenta nueva»).'; };
    var bp = $('vcAdmPasar'); if(bp) bp.onclick = function(){ var bx = $('vcPasarBox'); bx.hidden = false; bx.style.display = 'flex'; $('vcPaAdm').value = pass || ''; $('vcPaCli').value = alias; $('vcPaCl1').focus(); };
    $('vcPasarBox').style.display = 'none';
    $('vcPaGo') && ($('vcPaGo').onclick = function(){ pasarNegocio(user); });
  }
  function pasarNegocio(adminEmail){
    var er = $('vcPaErr'), b = $('vcPaGo');
    var claveAdm = $('vcPaAdm').value, cli = $('vcPaCli').value.trim().toLowerCase(), c1 = $('vcPaCl1').value, c2 = $('vcPaCl2').value;
    if(!correoOk(cli) || esAdmin(cli)){ er.textContent = 'Escribe el correo de tu cuenta de cliente (no el de administrador).'; return; }
    if(c1.length < 8){ er.textContent = 'La contraseña de cliente debe tener al menos 8 caracteres.'; return; }
    if(c1 !== c2){ er.textContent = 'Las dos contraseñas de cliente no son iguales.'; return; }
    if(c1 === claveAdm){ er.textContent = 'La contraseña de cliente tiene que ser DIFERENTE a la de administrador.'; return; }
    b.disabled = true; er.textContent = '⏳ Revisando…';
    var tokAdm = null, negocios = [];
    entrarRaw(adminEmail, claveAdm).then(function(s){ tokAdm = s.access_token; return rpc('mis_negocios', {}, tokAdm); }, function(){ throw new Error('La contraseña de administrador no es correcta.'); })
      .then(function(l){
        negocios = (l || []).filter(function(n){ return n.rol === 'dueno'; });
        // La cuenta de cliente: se crea, o si ya existe se comprueba su contraseña.
        return pedir('/auth/v1/signup', { email: cli, password: c1 }).then(function(){ return true; }, function(e){
          if(!/ya tiene una cuenta/.test(e.message)) throw e;
          return entrarRaw(cli, c1).then(function(){ return true; }, function(){ throw new Error('El correo ' + cli + ' ya tiene cuenta con otra contraseña. Escribe esa contraseña.'); });
        });
      })
      .then(function(){ return negocios.reduce(function(p, n){ return p.then(function(){ return rpc('pasar_negocio_a', { p_negocio: n.id, p_email: cli }, tokAdm); }); }, Promise.resolve()); })
      .then(function(){
        pedir('/auth/v1/logout?scope=local', {}, tokAdm).catch(function(){});
        $('vcAdmOv').classList.remove('show');
        toast(negocios.length ? '✅ Tu negocio pasó a ' + cli + '. Entrando…' : '✅ Cuenta de cliente lista. Entrando…', 6000);
        var u = $('authUser'), p = $('authPass'), f = $('authForm');
        if(u) u.value = cli; if(p) p.value = c1;
        if(f) setTimeout(function(){ if(f.requestSubmit) f.requestSubmit(); else f.dispatchEvent(new Event('submit', { cancelable: true })); }, 50);
      }, function(e){ er.textContent = '⚠️ ' + mensaje(e && e.message); })
      .then(function(){ b.disabled = false; });
  }

  // ---------- 6. Licencia por link: index.html#lic=VENTO-XXXX-XXXX-XXXX ----------
  function licDelLink(){
    var m = /[#&]lic=(VENTO-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4})/i.exec(location.hash || '');
    if(!m) return;
    lsS(K_LIC, m[1].toUpperCase());
    try{ history.replaceState(null, '', location.pathname + location.search); }catch(e){}
  }
  function licPendiente(){
    var cod = lsG(K_LIC, ''); if(!cod) return;
    var vs = window.ventoSuscripcion, n = null; try{ n = nb() && nb().negocio(); }catch(e){}
    if(!vs || !vs.canjear || !n){ if(g('authUser') && !n && !licPendiente.avisado){ licPendiente.avisado = 1; toast('🔑 Para activar la licencia ' + cod + ' entra con tu cuenta de ORDEVA Nube (correo y contraseña).', 9000); } return; }
    lsS(K_LIC, '');
    vs.canjear(cod).then(function(r){ toast('🎉 Licencia ' + cod + ' activada: plan ' + String(r.plan_id || '').toUpperCase() + ' hasta el ' + new Date(r.hasta).toLocaleDateString('es-CO') + '.', 9000); },
      function(e){ toast('⚠️ Licencia ' + cod + ': ' + ((e && e.message) || 'no se pudo activar'), 9000); });
  }

  // ---------- 7. Licencia de uso (distribuidor autorizado) ----------
  var TERMINOS = 'ORDEVA es un programa con licencia de uso: se usa en tu negocio, no se vende. Solo el distribuidor autorizado de ORDEVA puede vender o dar licencias y suscripciones. ' +
    'No se permite revender, alquilar, sublicenciar, copiar ni pasar la app o las licencias a otras personas. Cada licencia queda a nombre de la cuenta (correo) a la que se dio. ' +
    'Si se detecta un uso no autorizado, la cuenta y sus licencias se pueden suspender. Tus datos son tuyos: puedes descargarlos cuando quieras.';
  function montarTerminos(){
    var s = $('authSetup'); if(s && !$('vcTerm')){ var d = document.createElement('div'); d.id = 'vcTerm'; d.className = 'auth-hint'; d.style.fontSize = '12px';
      d.innerHTML = '📜 Al crear tu cuenta aceptas la <a href="#" id="vcTermLink">licencia de uso de ORDEVA</a>: se usa en tu negocio, no se revende ni se pasa a otros. Único distribuidor autorizado: ORDEVA.'; s.appendChild(d);
      $('vcTermLink').onclick = function(e){ e.preventDefault(); verTerminos(); }; }
    var g2 = $('subGrupo') || document.querySelector('#view-ajustes .settings-group[data-cat="ayuda"]');
    if(g2 && !$('vcTermAj')){ var p = document.createElement('div'); p.id = 'vcTermAj'; p.className = 'settings-desc'; p.style.marginTop = '8px';
      p.innerHTML = '📜 <a href="#" id="vcTermLink2">Licencia de uso</a> · Único distribuidor autorizado: ORDEVA. Las licencias y suscripciones solo las da ORDEVA (no se revenden).'; g2.appendChild(p);
      $('vcTermLink2').onclick = function(e){ e.preventDefault(); verTerminos(); }; }
  }
  function verTerminos(){
    var ov = $('vcTermOv');
    if(!ov){ ov = document.createElement('div'); ov.id = 'vcTermOv'; ov.className = 'overlay'; ov.style.zIndex = '10050'; ov.innerHTML = '<div class="modal" style="max-width:480px"><h2>📜 Licencia de uso de ORDEVA</h2><div class="modal-sub" style="text-align:left">' + esc(TERMINOS) + '</div><div class="modal-actions"><button class="btn-primary" type="button" id="vcTermOk">Entendido</button></div></div>'; document.body.appendChild(ov); $('vcTermOk').onclick = function(){ ov.classList.remove('show'); }; }
    ov.classList.add('show');
  }

  // ---------- 🐞 Reportar un problema (Más → 🐞, y Ajustes → Guía y soporte) ----------
  // Lo que la persona escribe le llega a ORDEVA Admin → 🐞 Errores («📝 Reportado por el cliente»), con los códigos de
  // los errores que tuvo este equipo justo antes, la versión y el equipo. Si hay conexión con el soporte, además queda
  // como caso de soporte (con el pantallazo) y la respuesta le llega en la app. Nunca ventas, productos ni clientes.
  function reportarProblema(){
    var ov = $('vcRepOv');
    if(!ov){
      ov = document.createElement('div'); ov.id = 'vcRepOv'; ov.className = 'overlay'; ov.style.zIndex = '10050';
      ov.innerHTML = '<div class="modal" style="max-width:440px;display:flex;flex-direction:column;gap:10px"><h2>🐞 Reportar un problema</h2>' +
        '<div class="modal-sub">Cuéntanos qué pasó y qué estabas haciendo. Le llega al equipo de ORDEVA con los datos técnicos de este equipo para arreglarlo.</div>' +
        '<textarea id="vcRepMsg" class="mz-in" rows="4" maxlength="1500" style="width:100%;resize:vertical;box-sizing:border-box" placeholder="Ej: al cobrar la mesa 3 se quedó pegado"></textarea>' +
        '<div id="vcRepAutoBox" hidden style="display:flex;gap:10px;align-items:center"><img id="vcRepAutoImg" alt="Lo que se veía en la pantalla" style="width:84px;max-height:150px;object-fit:cover;object-position:top;border-radius:8px;border:1px solid var(--line,#333)">' +
          '<label style="display:flex;gap:8px;align-items:flex-start;font-size:13px;line-height:1.35"><input type="checkbox" id="vcRepAuto" checked style="width:auto;margin-top:2px"> <span>📷 Enviar también lo que se veía en la pantalla. Solo lo ve el soporte de ORDEVA; quítalo si muestra algo que no quieres mandar.</span></label></div>' +
        '<div class="settings-desc" id="vcRepAutoTxt"></div>' +
        '<label class="btn-ghost" style="text-align:center;cursor:pointer">📸 Agregar un pantallazo (opcional)<input id="vcRepFotos" type="file" accept="image/*" multiple hidden></label><div class="settings-desc" id="vcRepFotosTxt"></div>' +
        '<div class="settings-desc" id="vcRepEstado"></div>' +
        '<div class="modal-actions"><button class="btn-ghost" type="button" id="vcRepNo">Cancelar</button><button class="btn-primary" type="button" id="vcRepSi">📨 Enviar</button></div></div>';
      document.body.appendChild(ov);
      ov.addEventListener('click', function(e){ if(e.target === ov) ov.classList.remove('show'); });
      $('vcRepNo').onclick = function(){ ov.classList.remove('show'); };
      $('vcRepFotos').onchange = function(){ var n = this.files ? this.files.length : 0; $('vcRepFotosTxt').textContent = n ? '📎 ' + Math.min(3, n) + ' imagen' + (n > 1 ? 'es' : '') + ' lista' + (n > 1 ? 's' : '') : ''; };
      $('vcRepSi').onclick = function(){
        var msg = $('vcRepMsg').value.replace(/\s+/g, ' ').trim(), est = $('vcRepEstado'), btn = $('vcRepSi'), propias = Array.prototype.slice.call($('vcRepFotos').files || []);
        // 1.62.0: primero el pantallazo automático (si quedó marcado), luego las fotos que eligió (máximo 3 en total)
        var fotos = (repAuto && $('vcRepAuto').checked ? [repAuto] : []).concat(propias).slice(0, 3);
        if(msg.length < 3){ est.textContent = 'Escribe qué pasó.'; $('vcRepMsg').focus(); return; }
        var d = diagnostico(), cods = d.errores.map(function(x){ return x.cod; }).filter(Boolean).filter(function(c, i, a){ return a.indexOf(c) === i; }).slice(0, 8);
        var fueError = false;
        try{ fueError = !!(window.ventoError && window.ventoError('otro', 'Reporte: ' + msg.slice(0, 300), { reporte: true, texto: msg.slice(0, 800), codigos: cods, vista: d.vista, fotos: fotos ? Math.min(3, fotos.length) : 0 }, 'reporte|' + Date.now().toString(36))); }catch(e){}
        btn.disabled = true; est.textContent = '⏳ Enviando…';
        var listo = function(extra){
          btn.disabled = false; $('vcRepMsg').value = ''; $('vcRepFotos').value = ''; $('vcRepFotosTxt').textContent = ''; ov.classList.remove('show'); soltarAuto();
          toast('✅ Gracias. El equipo de ORDEVA ya lo tiene' + (extra || '') + '.', 7000);
        };
        if(!nubeLista()){ if(fueError) listo(navigator.onLine === false ? ' (se envía apenas vuelva el internet)' : ''); else { btn.disabled = false; est.textContent = '⚠️ Este equipo no tiene conexión con ORDEVA. Escríbenos por WhatsApp (Ajustes → Guía y soporte).'; } return; }
        crearCaso({ tipo: 'error', asunto: '🐞 ' + msg.slice(0, 90), mensaje: msg })
          .then(function(r){ return (fotos && fotos.length ? enviarImagenes(r.id, r.clave, fotos) : avisarAdmin(r.id, r.clave)).catch(function(){}); })
          .then(function(){ cargarCasos().then(pintarSoporte).catch(function(){}); listo('. La respuesta te llega en Ajustes → Guía y soporte'); },
            function(e){ if(fueError) listo(''); else { btn.disabled = false; est.textContent = '⚠️ ' + e.message; } });
      };
    }
    $('vcRepEstado').textContent = '';
    ov.classList.add('show');
    setTimeout(function(){ try{ $('vcRepMsg').focus(); }catch(e){} }, 60);
    // Pantallazo de lo que se veía (sin esta ventana): se toma solo, mientras la persona escribe.
    soltarAuto(); $('vcRepAutoTxt').textContent = window.html2canvas ? '⏳ Tomando el pantallazo de lo que se veía…' : '';
    var vez = ++repVez;
    tomarPantallazo().then(function(b){
      if(vez !== repVez) return;
      $('vcRepAutoTxt').textContent = '';
      if(!b) return;
      try{ repAuto = new File([b], 'pantalla.jpg', { type: 'image/jpeg' }); }catch(e){ b.name = 'pantalla.jpg'; repAuto = b; }
      repUrl = URL.createObjectURL(b); $('vcRepAutoImg').src = repUrl; $('vcRepAuto').checked = true; $('vcRepAutoBox').hidden = false;
    });
  }
  // 1.62.0 · Pantallazo automático para «🐞 Reportar un problema» (html2canvas, el mismo del recibo). Sin la ventana del
  // reporte ni los avisos encima. Hasta 1280 px, JPEG. Si no se puede (sin internet la primera vez, equipo lento): nada.
  var repAuto = null, repUrl = '', repVez = 0;
  function soltarAuto(){ repAuto = null; if(repUrl){ try{ URL.revokeObjectURL(repUrl); }catch(e){} repUrl = ''; } var bx = $('vcRepAutoBox'); if(bx) bx.hidden = true; }
  function tomarPantallazo(){
    if(typeof window.html2canvas !== 'function') return Promise.resolve(null);
    var w = window.innerWidth, h = window.innerHeight, k = Math.min(1, 1280 / Math.max(w, h, 1));
    var espera = new Promise(function(r){ setTimeout(function(){ requestAnimationFrame(function(){ requestAnimationFrame(r); }); }, 250); });   // que se cierre el menú «Más»
    var foto = espera.then(function(){
      return window.html2canvas(document.body, { x: window.scrollX, y: window.scrollY, width: w, height: h, scale: k, logging: false, useCORS: true,
        backgroundColor: getComputedStyle(document.body).backgroundColor || '#000',
        ignoreElements: function(el){ return el.id === 'vcRepOv' || el.id === 'toast' || (el.classList && el.classList.contains('toast')); },
        // html2canvas no entiende color-mix(): en la copia, esos colores van ya calculados (lib/vento-colormix.js)
        onclone: function(doc){ try{ var css = window.ventoColorMix && window.ventoColorMix.css(); if(css){ var st = doc.createElement('style'); st.textContent = css; (doc.body || doc.head).appendChild(st); } }catch(e){} } });   // al final: gana sobre los estilos de la página
    }).then(function(c){ return new Promise(function(r){ try{ c.toBlob(function(b){ r(b && b.size > 2000 ? b : null); }, 'image/jpeg', 0.8); }catch(e){ r(null); } }); });
    return Promise.race([foto, new Promise(function(r){ setTimeout(function(){ r(null); }, 9000); })]).catch(function(){ return null; });
  }
  window.ventoReportarProblema = reportarProblema;

  // ---------- Arranque ----------
  var correoAntes = '';
  function tic(){
    montarSoporte(); montarRecuperarSms(); montarPerfil(); montarTerminos(); montarCerrarOtros();
    var c = conCuenta() ? nb().correo() : '';
    if(c !== correoAntes){
      correoAntes = c;
      if(c){
        cargarPerfil().then(function(p){ if(p){ pedirClaveNueva(); if(!p.acepto_licencia) rpcSesion('perfil_guardar', { p: { acepto_licencia: true } }).catch(function(){}); } });
        registrarEquipo(true); cargarCasos().then(pintarSoporte).catch(function(){});
      }else{ perfil = null; pintarPerfil(); }
    }
    registrarEquipo(false);
    licPendiente();
  }
  licDelLink();
  function iniciar(){
    tic();
    setInterval(tic, 5000);
    setTimeout(revisarRespuestas, 15000);
    setInterval(function(){ if(!document.hidden) revisarRespuestas(); }, 10 * 60e3);
    setTimeout(function(){ revisarClavePuesta(true); }, 4000);
    setInterval(function(){ if(!document.hidden) revisarClavePuesta(true); }, 3 * 60e3);
    window.addEventListener('vento-aviso-vivo', function(){ setTimeout(function(){ revisarClavePuesta(true); }, 400); });
    document.addEventListener('visibilitychange', function(){ if(!document.hidden) revisarClavePuesta(false); });
    document.addEventListener('click', function(e){ var b = e.target.closest && e.target.closest('.ajustes-cat[data-cat="ayuda"]'); if(b) revisarRespuestas(); }, true);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(iniciar, 1500); }); else setTimeout(iniciar, 1500);

  window.ventoCuenta = { guardia: guardia, esAdmin: esAdmin, aliasCliente: aliasCliente, registrarEquipo: registrarEquipo, soporte: { cargar: cargarCasos, crear: crearCaso, revisar: revisarRespuestas, abrir: abrirCaso },
    perfil: function(){ return perfil; }, terminos: verTerminos, revisarClave: revisarClavePuesta };
})();
