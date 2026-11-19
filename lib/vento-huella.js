/* 👆 ORDEVA 1.99.17 · Entrar con la huella (o la cara) del celular.
   Pedido del dueño (19/11): «que se pueda loguear uno con huella también».
   • En la app de Android: la ventana de Android «Pon tu huella» (android/…/Huella.java, VentoAndroid.huellaPedir).
   • En el navegador (Chrome, Safari, ORDEVA instalada como app web): la huella o la cara del equipo con WebAuthn,
     exigiendo que el equipo VERIFIQUE a la persona (userVerification «required», y se revisa la marca UV de la respuesta).
   Es la misma puerta que la contraseña de este equipo (la contraseña también se revisa aquí, en el celular): la huella
   solo reemplaza escribirla. No se guarda ninguna huella (eso lo guarda el celular) ni ninguna contraseña.
   • Se activa por usuario y por equipo: Ajustes → Cuenta → 👆 Entrar con huella (pide la contraseña), o al entrar con la
     contraseña ORDEVA lo ofrece una vez.
   • Si la contraseña del usuario cambia (él mismo, el administrador, el soporte o en otro equipo), la huella se apaga sola
     para ese usuario: se entra una vez con la contraseña nueva y se vuelve a activar.
   • Sirve en la entrada (botón «👆 Entrar con huella») y en la pantalla de bloqueo. */
(function(){
  'use strict';
  var K = 'vento-huella', K_ULTIMO = 'vento-huella-ultimo', K_NO = 'vento-huella-no';
  var lsGet = function(k, d){ try{ var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; }catch(e){ return d; } };
  var lsSet = function(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
  var toast = function(t, ms){ try{ window.showToast && window.showToast(t, ms || 5000); }catch(e){} };
  var usuarios = function(){ try{ return typeof authUsers === 'function' ? authUsers() : []; }catch(e){ return []; } };
  var usuario = function(u){ return usuarios().find(function(x){ return x.user === u; }) || null; };
  var actual = function(){ try{ return typeof authUser !== 'undefined' ? authUser : null; }catch(e){ return null; } };
  // La huella queda atada a la contraseña de ese momento: si cambia, ya no sirve.
  var marca = function(u){ return u && u.hash ? String(u.hash).slice(-16) : ''; };
  var android = function(){ var A = window.VentoAndroid; return A && typeof A.huellaEstado === 'function' && typeof A.huellaPedir === 'function' ? A : null; };
  var b64 = function(buf){ var s = '', a = new Uint8Array(buf); for(var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  var deB64 = function(t){ t = String(t).replace(/-/g, '+').replace(/_/g, '/'); while(t.length % 4) t += '='; var s = atob(t), a = new Uint8Array(s.length); for(var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; };
  var azar = function(n){ var a = new Uint8Array(n); crypto.getRandomValues(a); return a; };

  // ---------- ¿Este equipo tiene huella? 'ok' | 'sin-huella' | 'no' ----------
  var dispCache = null;
  function disponible(){
    var A = android();
    if(A){ try{ var e = String(A.huellaEstado()); return Promise.resolve(e === 'ok' ? 'ok' : e === 'sin-huella' ? 'sin-huella' : 'no'); }catch(x){ return Promise.resolve('no'); } }
    if(dispCache) return dispCache;
    dispCache = (window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable && window.isSecureContext !== false)
      ? PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then(function(v){ return v ? 'ok' : 'no'; }, function(){ return 'no'; })
      : Promise.resolve('no');
    return dispCache;
  }

  // ---------- Lo activado en este equipo: { usuario: { t: 'android'|'web', id, m, at } } ----------
  function registro(user){
    var r = lsGet(K, {})[user], u = usuario(user);
    if(!r || !u || r.m !== marca(u)) return null;                       // usuario borrado o contraseña cambiada
    if(r.t === 'android' ? !android() : android()) return null;          // se activó en la otra forma (app ↔ navegador)
    return r;
  }
  function tiene(user){ return !!(user && registro(user)); }
  function conHuella(){ return usuarios().filter(function(u){ return tiene(u.user); }).map(function(u){ return u.user; }); }
  function quitar(user){ var t = lsGet(K, {}); delete t[user]; lsSet(K, t); if(lsGet(K_ULTIMO, '') === user) try{ localStorage.removeItem(K_ULTIMO); }catch(e){} }

  // ---------- Pedir la huella ----------
  var pendientes = {}, nId = 0;
  window.__ventoHuellaRespuesta = function(id, ok, motivo){
    var p = pendientes[id]; if(!p) return;                               // ya contestó (o se agotó el tiempo)
    delete pendientes[id]; clearTimeout(p.t); p.fin({ ok: !!ok, motivo: String(motivo || '') });
  };
  function pedirAndroid(titulo, sub){
    var A = android(); if(!A) return Promise.resolve({ ok: false, motivo: 'no-soporta' });
    return new Promise(function(fin){
      var id = 'h' + Date.now().toString(36) + (++nId);
      pendientes[id] = { fin: fin, t: setTimeout(function(){ window.__ventoHuellaRespuesta(id, false, 'tiempo'); }, 120000) };
      try{ A.huellaPedir(id, titulo || 'Entrar a ORDEVA', sub || ''); }catch(e){ window.__ventoHuellaRespuesta(id, false, 'error'); }
    });
  }
  // WebAuthn: la respuesta tiene que decir que el equipo VERIFICÓ a la persona (bit UV de authenticatorData).
  var verifico = function(authData){ try{ var a = new Uint8Array(authData); return a.length > 32 && (a[32] & 0x04) === 0x04; }catch(e){ return false; } };
  var motivoWeb = function(e){ var n = e && e.name; return n === 'NotAllowedError' || n === 'AbortError' ? 'cancelado' : n === 'InvalidStateError' ? 'ya-existe' : 'error'; };
  function crearWeb(user){
    return navigator.credentials.create({ publicKey: {
      rp: { name: 'ORDEVA' },
      user: { id: azar(16), name: user, displayName: user },
      challenge: azar(32),
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged', requireResidentKey: false },
      attestation: 'none', timeout: 60000
    } }).then(function(c){
      if(!c || !c.rawId) return { ok: false, motivo: 'error' };
      var ad = c.response && c.response.getAuthenticatorData ? c.response.getAuthenticatorData() : null;
      if(ad && !verifico(ad)) return { ok: false, motivo: 'sin-verificar' };
      return { ok: true, id: b64(c.rawId) };
    }, function(e){ return { ok: false, motivo: motivoWeb(e) }; });
  }
  function pedirWeb(r){
    return navigator.credentials.get({ publicKey: {
      challenge: azar(32), timeout: 60000, userVerification: 'required',
      allowCredentials: [{ type: 'public-key', id: deB64(r.id), transports: ['internal'] }]
    } }).then(function(c){
      if(!c || b64(c.rawId) !== r.id) return { ok: false, motivo: 'error' };
      return verifico(c.response.authenticatorData) ? { ok: true } : { ok: false, motivo: 'sin-verificar' };
    }, function(e){ return { ok: false, motivo: motivoWeb(e) }; });
  }
  // Pide la huella para entrar como «user» (tiene que estar activada para él en este equipo).
  var pidiendo = false;
  function pedir(user, titulo){
    var r = registro(user); if(!r) return Promise.resolve({ ok: false, motivo: 'no-activada' });
    if(pidiendo) return Promise.resolve({ ok: false, motivo: 'ocupado' });
    pidiendo = true;
    var p = r.t === 'android' ? pedirAndroid(titulo || 'Entrar a ORDEVA', user) : pedirWeb(r);
    return p.then(function(x){ pidiendo = false; if(x.ok) lsSet(K_ULTIMO, user); return x; }, function(){ pidiendo = false; return { ok: false, motivo: 'error' }; });
  }

  // ---------- Activar (con la contraseña ya comprobada) ----------
  function activarYa(user){
    var u = usuario(user); if(!u) return Promise.resolve({ ok: false, motivo: 'sin-usuario' });
    return disponible().then(function(d){
      if(d === 'sin-huella') return { ok: false, motivo: 'sin-huella' };
      if(d !== 'ok') return { ok: false, motivo: 'no-soporta' };
      var p = android() ? pedirAndroid('Activar la huella en ORDEVA', user).then(function(x){ return x.ok ? { ok: true, t: 'android' } : x; })
                        : crearWeb(user).then(function(x){ return x.ok ? { ok: true, t: 'web', id: x.id } : x; });
      return p.then(function(x){
        if(!x.ok) return x;
        var u2 = usuario(user); if(!u2) return { ok: false, motivo: 'sin-usuario' };
        var t = lsGet(K, {}); t[user] = { t: x.t, id: x.id || null, m: marca(u2), at: Date.now() }; lsSet(K, t);
        lsSet(K_ULTIMO, user);
        var no = lsGet(K_NO, {}); delete no[user]; lsSet(K_NO, no);
        return { ok: true };
      });
    });
  }
  var MSG = {
    'sin-huella': 'Este celular no tiene ninguna huella (ni cara) guardada. Agrégala en los Ajustes del celular (Seguridad → Huella) y vuelve a intentar.',
    'no-soporta': 'Este equipo no permite entrar con huella. Sigue entrando con tu contraseña.',
    'cancelado': 'No se activó: se canceló la huella.',
    'bloqueado': 'El celular bloqueó la huella por muchos intentos. Desbloquéalo con su PIN y vuelve a intentar.'
  };
  var aviso = function(x){ return MSG[x && x.motivo] || 'No se pudo activar la huella. Intenta otra vez.'; };
  // Activar desde Ajustes: pide la contraseña de ESE usuario primero.
  function activarConClave(user){
    var u = usuario(user); if(!u){ toast('⚠️ Este usuario no está guardado en este equipo.'); return Promise.resolve(false); }
    return disponible().then(function(d){
      if(d !== 'ok'){ toast('👆 ' + MSG[d === 'sin-huella' ? 'sin-huella' : 'no-soporta'], 8000); return false; }
      return window.showPrompt({ icon: '👆', title: 'Activar la huella', message: 'Escribe la contraseña de ' + user + ' para activar la huella en este equipo.\n\nOjo: cualquier huella (o cara) guardada en este celular podrá entrar como ' + user + '.', type: 'password', autocomplete: 'current-password', confirmText: 'Seguir' })
        .then(function(pass){
          if(!pass) return false;
          return authClaveOk(usuario(user), pass).then(function(ok){
            if(!ok){ toast('❌ Contraseña incorrecta.'); return false; }
            return activarYa(user).then(function(x){ toast(x.ok ? '👆 Listo: la próxima vez entras con tu huella.' : '⚠️ ' + aviso(x), x.ok ? 5000 : 8000); return x.ok; });
          });
        });
    });
  }
  // Después de entrar con la contraseña: se ofrece UNA vez por usuario y equipo.
  function ofrecer(user){
    if(!user || tiene(user) || lsGet(K_NO, {})[user] || !usuario(user)) return;
    disponible().then(function(d){
      if(d !== 'ok' || typeof window.showConfirm !== 'function') return;
      setTimeout(function(){
        if(actual() !== user || tiene(user)) return;
        window.showConfirm({ icon: '👆', title: '¿Entrar con tu huella?', message: 'La próxima vez entras a ORDEVA poniendo tu huella (o tu cara), sin escribir la contraseña. Ojo: cualquier huella guardada en este celular podrá entrar como ' + user + '. Lo puedes quitar en Ajustes → Cuenta.', confirmText: '👆 Sí, activar', cancelText: 'Ahora no' })
          .then(function(si){
            var no = lsGet(K_NO, {}); no[user] = Date.now(); lsSet(K_NO, no);   // no se vuelve a preguntar (se activa en Ajustes)
            if(!si) return;
            return activarYa(user).then(function(x){ toast(x.ok ? '👆 Listo: la próxima vez entras con tu huella.' : '⚠️ ' + aviso(x), x.ok ? 5000 : 8000); pintarAjustes(); });
          });
      }, 1200);
    });
  }

  // ---------- La entrada: «👆 Entrar con huella» ----------
  var esc = function(t){ return String(t == null ? '' : t).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function quienEntrada(){
    var inp = document.getElementById('authUser');
    var escrito = inp ? String(inp.value || '').trim().toLowerCase() : '';
    if(escrito) return tiene(escrito) ? escrito : null;                    // escribió otro usuario: no se ofrece el de otro
    var lista = conHuella(), ult = lsGet(K_ULTIMO, '');
    if(ult && lista.indexOf(ult) >= 0) return ult;
    return lista.length === 1 ? lista[0] : null;
  }
  var autoHecho = false;
  function pintarEntrada(){
    var ov = document.getElementById('authOverlay'), form = document.getElementById('authForm');
    if(!ov || !form) return;
    var setup = document.getElementById('authSetup');
    var visible = !ov.hidden && !form.hidden && !(setup && !setup.hidden);
    var quien = visible ? quienEntrada() : null;
    var b = document.getElementById('authHuellaBtn');
    // (solo se toca «hidden» si cambia: el observador de abajo mira ese atributo y si no, se llamaría sin fin)
    if(!quien){ if(b && !b.hidden) b.hidden = true; return; }
    if(!b){
      b = document.createElement('button'); b.type = 'button'; b.id = 'authHuellaBtn'; b.className = 'btn-ghost auth-huella';
      var ref = document.getElementById('authUsers') || (document.getElementById('authUser') && document.getElementById('authUser').closest('label'));
      if(ref && ref.parentNode) ref.parentNode.insertBefore(b, ref); else form.insertBefore(b, form.firstChild);
      b.addEventListener('click', function(){ entrarConHuella(b.dataset.u); });
    }
    if(b.hidden) b.hidden = false;
    if(b.dataset.u !== quien) b.dataset.u = quien;
    var h = '👆 Entrar con huella <small>' + esc(quien) + '</small>';
    if(b.innerHTML !== h) b.innerHTML = h;
    // En la app de Android se pide sola al abrir (no después de «Cerrar sesión», que es para que entre otra persona).
    if(!autoHecho && android()){
      autoHecho = true;
      var salio = false; try{ salio = sessionStorage.getItem('vento-salio') === '1'; sessionStorage.removeItem('vento-salio'); }catch(e){}
      if(!salio && lsGet(K_ULTIMO, '') === quien) setTimeout(function(){ if(!ov.hidden) entrarConHuella(quien); }, 500);
    }
  }
  function entrarConHuella(user){
    var err = document.getElementById('authErr');
    if(!user || !tiene(user)){ pintarEntrada(); return; }
    pedir(user, 'Entrar a ORDEVA').then(function(x){
      if(!x.ok){
        if(err && x.motivo !== 'cancelado' && x.motivo !== 'ocupado') err.textContent = x.motivo === 'bloqueado' ? '🔒 El celular bloqueó la huella por muchos intentos: entra con tu contraseña.' : '👆 No se pudo con la huella: entra con tu contraseña.';
        var p = document.getElementById('authPass'); if(p && x.motivo === 'cancelado'){ var u = document.getElementById('authUser'); if(u && !u.value) u.value = user; try{ p.focus(); }catch(e){} }
        return;
      }
      if(!tiene(user)) return;                       // mientras ponía la huella se quitó el usuario o cambió la contraseña
      if(err) err.textContent = '';
      try{ authLoginClear(user); }catch(e){}
      return enterApp(user, null);
    });
  }

  // ---------- La pantalla de bloqueo ----------
  function pintarBloqueo(){
    var ov = document.getElementById('lockOv'), user = actual();
    if(!ov || !user || !tiene(user) || ov.querySelector('#lockHuella')) return;
    var f = ov.querySelector('form'), ok = f && f.querySelector('button[type=submit]'); if(!ok) return;
    var b = document.createElement('button'); b.type = 'button'; b.id = 'lockHuella'; b.className = 'btn-ghost auth-huella'; b.textContent = '👆 Desbloquear con huella';
    ok.parentNode.insertBefore(b, ok.nextSibling);
    var ir = function(){
      pedir(user, 'Desbloquear ORDEVA').then(function(x){
        if(x.ok && tiene(user)){ try{ authLoginClear(user); }catch(e){} ov.remove(); return; }
        var er = ov.querySelector('#lockErr'); if(er && x.motivo !== 'cancelado' && x.motivo !== 'ocupado') er.textContent = '👆 No se pudo con la huella: escribe la contraseña.';
      });
    };
    b.addEventListener('click', ir);
    if(android()) setTimeout(ir, 400);
  }

  // ---------- Ajustes → Cuenta ----------
  function pintarAjustes(){
    var fila = document.getElementById('accHuellaRow'), user = actual();
    if(!fila) return;
    var txt = document.getElementById('accHuellaTxt'), btn = document.getElementById('accHuellaBtn');
    if(!user || !usuario(user)){ if(!fila.hidden) fila.hidden = true; return; }
    disponible().then(function(d){
      var on = tiene(user);
      var esc0 = d === 'no' && !on; if(fila.hidden !== esc0) fila.hidden = esc0;
      if(txt) txt.textContent = on ? '✅ Activada para ' + user + ' en este equipo.' : d === 'sin-huella' ? 'Este celular no tiene huellas guardadas (agrégalas en los Ajustes del celular).' : '';
      if(btn){ btn.textContent = on ? 'Quitar' : '👆 Activar'; btn.className = on ? 'btn-danger-outline' : 'btn-ghost'; }
    });
  }
  function tocarAjustes(){
    var user = actual(); if(!user) return;
    if(tiene(user)){
      var q = { icon: '👆', title: '¿Quitar la huella?', message: 'Para entrar como ' + user + ' en este equipo te va a pedir la contraseña.', confirmText: 'Sí, quitar' };
      return (window.showConfirm ? window.showConfirm(q) : Promise.resolve(window.confirm(q.message))).then(function(si){ if(si){ quitar(user); toast('👆 Huella quitada en este equipo.'); } pintarAjustes(); });
    }
    return activarConClave(user).then(pintarAjustes);
  }

  function estilos(){
    if(document.getElementById('huellaCss')) return;
    var s = document.createElement('style'); s.id = 'huellaCss';
    s.textContent = '.auth-huella{width:100%;min-height:52px;font-size:16px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap}' +
      '.auth-huella small{font-weight:500;opacity:.75;font-size:13px}';
    document.head.appendChild(s);
  }
  function iniciar(){
    estilos(); pintarEntrada(); pintarAjustes();
    var ov = document.getElementById('authOverlay');
    if(ov && window.MutationObserver) new MutationObserver(pintarEntrada).observe(ov, { attributes: true, subtree: true, attributeFilter: ['hidden'] });
    document.addEventListener('input', function(e){ if(e.target && e.target.id === 'authUser') pintarEntrada(); });
    document.addEventListener('click', function(e){
      if(e.target.closest && e.target.closest('#authOverlay')) setTimeout(pintarEntrada, 0);
      if(e.target.closest && e.target.closest('#accHuellaBtn')){ tocarAjustes(); return; }
      setTimeout(pintarAjustes, 300);
    }, true);
    if(window.MutationObserver) new MutationObserver(function(){ if(document.getElementById('lockOv')) pintarBloqueo(); }).observe(document.body, { childList: true });
  }
  window.ventoHuella = { disponible: disponible, tiene: tiene, conHuella: conHuella, pedir: pedir, activar: activarYa, activarConClave: activarConClave, quitar: quitar, ofrecer: ofrecer, entrar: entrarConHuella, pintar: function(){ pintarEntrada(); pintarAjustes(); } };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
