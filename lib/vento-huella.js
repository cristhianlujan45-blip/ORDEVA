/* 👆 ORDEVA 1.99.17 · Entrar con la huella del celular.
   Pedido del dueño (19/11): «que se pueda loguear uno con huella también».
   • En la app de Android: la ventana de Android «Pon tu huella» (android/…/Huella.java). No basta con que Android diga
     «sí»: ORDEVA tiene una llave en el Keystore de Android que solo se abre con una huella FUERTE y solo en ESE celular
     (no viaja en respaldos ni a otro celular). Si alguien agrega otra huella en los Ajustes del celular, la llave se borra
     sola y la huella de ORDEVA se apaga (hay que volver a activarla con la contraseña).
   • En el navegador (Chrome, Safari, ORDEVA instalada como app web): WebAuthn exigiendo que el equipo VERIFIQUE a la
     persona (userVerification «required», y se revisa la marca UV de la respuesta). Ojo: según el equipo eso puede ser la
     huella, la cara o el PIN del equipo (Windows Hello, Mac): se avisa al activarla.
   Es la misma puerta que la contraseña de este equipo (la contraseña también se revisa aquí, en el celular): la huella solo
   reemplaza escribirla. No se guarda ninguna huella ni ninguna contraseña.
   • Se activa por usuario y por equipo: Ajustes → Cuenta → 👆 Entrar con huella (pide la contraseña), o ORDEVA lo ofrece
     después de entrar con la CONTRASEÑA (no con el PIN).
   • Si la contraseña o el PIN del usuario cambian (él mismo, el administrador, el soporte o en otro equipo), la huella se
     apaga sola para ese usuario.
   • Lo activado no va en los respaldos (Ajustes → Transferir): restaurar un respaldo en otro celular no trae la huella.
   • Sirve en la entrada (botón «👆 Entrar con huella», se toca) y en la pantalla de bloqueo (en Android se pide sola). */
(function(){
  'use strict';
  var K = 'vento-huella', K_ULTIMO = 'vento-huella-ultimo', K_NO = 'vento-huella-no';
  var lsGet = function(k, d){ try{ var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; }catch(e){ return d; } };
  var lsSet = function(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
  var toast = function(t, ms){ try{ window.showToast && window.showToast(t, ms || 5000); }catch(e){} };
  var usuarios = function(){ try{ return typeof authUsers === 'function' ? authUsers() : []; }catch(e){ return []; } };
  var usuario = function(u){ return usuarios().find(function(x){ return x.user === u; }) || null; };
  var actual = function(){ try{ return typeof authUser !== 'undefined' ? authUser : null; }catch(e){ return null; } };
  var demo = function(){ try{ return document.body.classList.contains('demo') || /[?&]demo=/.test(location.search); }catch(e){ return false; } };
  // La huella queda atada a la contraseña y al PIN de ese momento: si cambia cualquiera, ya no sirve.
  var marca = function(u){ return u && u.hash ? String(u.hash).slice(-16) + (u.pin && u.pin.h ? ':' + String(u.pin.h).slice(-8) : '') : ''; };
  var android = function(){ var A = window.VentoAndroid; return A && typeof A.huellaEstado === 'function' && typeof A.huellaPedir === 'function' && typeof A.huellaActivar === 'function' && typeof A.huellaLista === 'function' ? A : null; };
  var b64 = function(buf){ var s = '', a = new Uint8Array(buf); for(var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  var deB64 = function(t){ t = String(t).replace(/-/g, '+').replace(/_/g, '/'); while(t.length % 4) t += '='; var s = atob(t), a = new Uint8Array(s.length); for(var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; };
  var azar = function(n){ var a = new Uint8Array(n); crypto.getRandomValues(a); return a; };

  // ---------- ¿Este equipo tiene huella? 'ok' | 'sin-huella' | 'no' ----------
  var dispCache = null, dispAnd = null;
  function disponible(){
    if(demo()) return Promise.resolve('no');
    var A = android();
    if(A){
      if(dispAnd && Date.now() - dispAnd.t < 30000) return Promise.resolve(dispAnd.v);
      var v = 'no'; try{ var e = String(A.huellaEstado()); v = e === 'ok' ? 'ok' : e === 'sin-huella' ? 'sin-huella' : 'no'; }catch(x){}
      dispAnd = { t: Date.now(), v: v }; return Promise.resolve(v);
    }
    if(dispCache) return dispCache;
    dispCache = (window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable && window.isSecureContext !== false)
      ? PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then(function(v){ return v ? 'ok' : 'no'; }, function(){ return 'no'; })
      : Promise.resolve('no');
    return dispCache;
  }
  // Android: ¿la llave de ORDEVA sigue en este celular? (si no: es otro celular o se agregó otra huella)
  var llaveCache = null;
  function llaveOk(){
    var A = android(); if(!A) return false;
    if(llaveCache && Date.now() - llaveCache.t < 5000) return llaveCache.v;
    var v = false; try{ v = String(A.huellaLista()) === 'ok'; }catch(e){}
    llaveCache = { t: Date.now(), v: v }; return v;
  }

  // ---------- Lo activado en este equipo: { usuario: { t: 'android'|'web', id, m, at } } ----------
  function registro(user){
    var r = lsGet(K, {})[user], u = usuario(user);
    if(!r || !u || r.m !== marca(u)) return null;                       // usuario borrado, contraseña o PIN cambiados
    if(r.t === 'android' ? !android() : android()) return null;          // se activó en la otra forma (app ↔ navegador)
    if(r.t === 'android' && !llaveOk()) return null;                     // otro celular, o se agregó otra huella al celular
    if(r.t === 'web' && !r.id) return null;
    return r;
  }
  function tiene(user){ return !!(user && !demo() && registro(user)); }
  function conHuella(){ return usuarios().filter(function(u){ return tiene(u.user); }).map(function(u){ return u.user; }); }
  function quitar(user){ var t = lsGet(K, {}); delete t[user]; lsSet(K, t); if(lsGet(K_ULTIMO, '') === user) try{ localStorage.removeItem(K_ULTIMO); }catch(e){} }

  // ---------- Pedir la huella ----------
  var pendientes = {}, nId = 0;
  window.__ventoHuellaRespuesta = function(id, ok, motivo){
    var p = pendientes[id]; if(!p) return;                               // ya contestó (o se agotó el tiempo)
    delete pendientes[id]; clearTimeout(p.t); llaveCache = null; p.fin({ ok: !!ok, motivo: String(motivo || '') });
  };
  function pedirAndroid(titulo, sub, activar){
    var A = android(); if(!A) return Promise.resolve({ ok: false, motivo: 'no-soporta' });
    return new Promise(function(fin){
      var id = 'h' + Date.now().toString(36) + (++nId);
      pendientes[id] = { fin: fin, t: setTimeout(function(){ try{ A.huellaCancelar && A.huellaCancelar(); }catch(e){} window.__ventoHuellaRespuesta(id, false, 'tiempo'); }, 90000) };
      try{ if(activar) A.huellaActivar(id, titulo || 'Activar la huella en ORDEVA', sub || ''); else A.huellaPedir(id, titulo || 'Entrar a ORDEVA', sub || ''); }
      catch(e){ window.__ventoHuellaRespuesta(id, false, 'error'); }
    });
  }
  // WebAuthn: la respuesta tiene que decir que el equipo VERIFICÓ a la persona (bit UV de authenticatorData).
  var verifico = function(authData){ try{ var a = new Uint8Array(authData); return a.length > 32 && (a[32] & 0x04) === 0x04; }catch(e){ return false; } };
  var motivoWeb = function(e){ var n = e && e.name; return n === 'NotAllowedError' || n === 'AbortError' ? 'cancelado' : n === 'InvalidStateError' ? 'ya-existe' : 'error'; };
  function crearWeb(user, viejo){
    return navigator.credentials.create({ publicKey: {
      rp: { name: 'ORDEVA' },
      user: { id: azar(16), name: user, displayName: user },
      challenge: azar(32),
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged', requireResidentKey: false },
      excludeCredentials: viejo ? [{ type: 'public-key', id: deB64(viejo), transports: ['internal'] }] : [],
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
    var p = r.t === 'android' ? pedirAndroid(titulo || 'Entrar a ORDEVA', user, false) : pedirWeb(r);
    return p.then(function(x){
      pidiendo = false;
      if(x.ok) lsSet(K_ULTIMO, user);
      else if(x.motivo === 'sin-llave' || x.motivo === 'invalidada'){ quitar(user); x.apagada = true; }
      return x;
    }, function(){ pidiendo = false; return { ok: false, motivo: 'error' }; });
  }

  // ---------- Activar (con la contraseña ya comprobada) ----------
  function activarYa(user){
    var u = usuario(user); if(!u || user !== actual()) return Promise.resolve({ ok: false, motivo: 'sin-usuario' });
    return disponible().then(function(d){
      if(d === 'sin-huella') return { ok: false, motivo: 'sin-huella' };
      if(d !== 'ok') return { ok: false, motivo: 'no-soporta' };
      var viejo = (lsGet(K, {})[user] || {}).id || null;
      var p = android() ? pedirAndroid('Activar la huella en ORDEVA', user, true).then(function(x){ return x.ok ? { ok: true, t: 'android' } : x; })
                        : crearWeb(user, viejo).then(function(x){ return x.ok ? { ok: true, t: 'web', id: x.id } : x; });
      return p.then(function(x){
        if(!x.ok) return x;
        var u2 = usuario(user); if(!u2) return { ok: false, motivo: 'sin-usuario' };
        var t = lsGet(K, {}); t[user] = { t: x.t, id: x.id || null, m: marca(u2), at: Date.now() }; lsSet(K, t);
        lsSet(K_ULTIMO, user); llaveCache = null;
        var no = lsGet(K_NO, {}); delete no[user]; lsSet(K_NO, no);
        return { ok: true };
      });
    });
  }
  var MSG = {
    'sin-huella': 'Este celular no tiene ninguna huella guardada. Agrégala en los Ajustes del celular (Seguridad → Huella) y vuelve a intentar.',
    'no-soporta': 'Este equipo no permite entrar con huella. Sigue entrando con tu contraseña.',
    'cancelado': 'No se activó: se canceló la huella.',
    'bloqueado': 'El celular bloqueó la huella por muchos intentos. Desbloquéalo con su PIN y vuelve a intentar.'
  };
  var aviso = function(x){ return MSG[x && x.motivo] || 'No se pudo activar la huella. Intenta otra vez.'; };
  var OJO = function(user){ return android()
    ? 'Ojo: cualquier huella guardada en este celular podrá entrar como ' + user + '. Si alguien agrega otra huella en el celular, ORDEVA la apaga sola.'
    : 'Ojo: según el equipo, también sirve el PIN o la clave del equipo (Windows Hello, Mac). Cualquiera que pueda desbloquear este equipo podrá entrar como ' + user + '.'; };
  // ¿Es la contraseña de este usuario? La de este equipo, o (cuentas con correo que entraron con un código) la de la cuenta.
  function claveDe(user, pass){
    return authClaveOk(usuario(user), pass).then(function(ok){
      if(ok) return true;
      var N = window.ventoNube;
      if(!/@/.test(user) || !N || !N.verificarClave || !N.correo || N.correo() !== user) return false;
      return N.verificarClave(user, pass).then(function(v){
        if(v !== true) return false;
        return Promise.resolve(typeof authPonerClaveLocal === 'function' ? authPonerClaveLocal(user, pass) : null).then(function(){ return true; });
      }, function(){ return false; });
    });
  }
  // Activar desde Ajustes: pide la contraseña de ESE usuario primero.
  function activarConClave(user){
    var u = usuario(user); if(!u || user !== actual()){ toast('⚠️ Este usuario no está guardado en este equipo.'); return Promise.resolve(false); }
    return disponible().then(function(d){
      if(d !== 'ok'){ toast('👆 ' + MSG[d === 'sin-huella' ? 'sin-huella' : 'no-soporta'], 8000); return false; }
      return window.showPrompt({ icon: '👆', title: 'Activar la huella', message: 'Escribe la contraseña de ' + user + ' para activar la huella en este equipo.\n\n' + OJO(user), type: 'password', autocomplete: 'current-password', confirmText: 'Seguir' })
        .then(function(pass){
          if(!pass) return false;
          return claveDe(user, pass).then(function(ok){
            if(!ok){ toast('❌ Contraseña incorrecta.'); return false; }
            return activarYa(user).then(function(x){ toast(x.ok ? '👆 Listo: la próxima vez entras con tu huella.' : '⚠️ ' + aviso(x), x.ok ? 5000 : 8000); return x.ok; });
          });
        });
    });
  }
  // Después de entrar con la CONTRASEÑA: se ofrece (como mucho dos veces por usuario y equipo).
  function ofrecer(user){
    var no = lsGet(K_NO, {})[user];
    if(!user || tiene(user) || (no && (no.n || 1) >= 2) || !usuario(user)) return;
    disponible().then(function(d){
      if(d !== 'ok' || typeof window.showConfirm !== 'function') return;
      setTimeout(function(){
        if(actual() !== user || tiene(user)) return;
        if(document.querySelector('#confirmOverlay.show, #promptOverlay.show')) return;     // hay otra pregunta abierta: otro día
        var t0 = lsGet(K_NO, {}); t0[user] = { n: ((t0[user] && t0[user].n) || 0) + 1, at: Date.now() }; lsSet(K_NO, t0);
        window.showConfirm({ icon: '👆', title: '¿Entrar con tu huella?', message: 'La próxima vez entras a ORDEVA poniendo tu huella, sin escribir la contraseña. ' + OJO(user) + ' Lo puedes quitar en Ajustes → Cuenta.', confirmText: '👆 Sí, activar', cancelText: 'Ahora no' })
          .then(function(si){
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
  var entradaVisible = function(){
    var ov = document.getElementById('authOverlay'), form = document.getElementById('authForm'), setup = document.getElementById('authSetup');
    return !!(ov && form && !ov.hidden && !form.hidden && !(setup && !setup.hidden));
  };
  function pintarEntrada(){
    var form = document.getElementById('authForm'); if(!form) return;
    var quien = entradaVisible() ? quienEntrada() : null;
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
    // (no se pide sola en la entrada: a la entrada se llega para que entre OTRA persona —«Cerrar sesión», «Cambiar de
    //  usuario»—; quien quiere entrar con su huella toca el botón)
  }
  function entrarConHuella(user){
    var err = document.getElementById('authErr');
    if(!user || !tiene(user) || !entradaVisible()){ pintarEntrada(); return; }
    pedir(user, 'Entrar a ORDEVA').then(function(x){
      if(!x.ok){
        if(err && x.motivo !== 'cancelado' && x.motivo !== 'ocupado') err.textContent = x.apagada ? '👆 La huella se apagó en este celular (se agregó otra huella o es otro celular): entra con tu contraseña y vuelve a activarla.'
          : x.motivo === 'bloqueado' ? '🔒 El celular bloqueó la huella por muchos intentos: entra con tu contraseña.' : '👆 No se pudo con la huella: entra con tu contraseña.';
        var p = document.getElementById('authPass'); if(p && x.motivo === 'cancelado'){ var u = document.getElementById('authUser'); if(u && !u.value) u.value = user; try{ p.focus(); }catch(e){} }
        pintarEntrada();
        return;
      }
      // Mientras ponía la huella: se quitó el usuario, cambió la contraseña, o ya entró alguien (otra ventana) → nada.
      if(!tiene(user) || !entradaVisible()) return;
      if(err) err.textContent = '';
      try{ authLoginClear(user); }catch(e){}
      return enterApp(user, null);
    });
  }

  // ---------- La pantalla de bloqueo ----------
  var alFrente = function(){ return document.visibilityState === 'visible' && window.__ventoAlFrente !== false; };
  function pintarBloqueo(){
    var ov = document.getElementById('lockOv'), user = actual();
    if(!ov || !user || !tiene(user) || ov.querySelector('#lockHuella')) return;
    var f = ov.querySelector('form'), ok = f && f.querySelector('button[type=submit]'); if(!ok) return;
    var b = document.createElement('button'); b.type = 'button'; b.id = 'lockHuella'; b.className = 'btn-ghost auth-huella'; b.textContent = '👆 Desbloquear con huella';
    ok.parentNode.insertBefore(b, ok.nextSibling);
    var ir = function(){
      if(!document.getElementById('lockOv')) return;
      pedir(user, 'Desbloquear ORDEVA').then(function(x){
        if(x.ok && tiene(user) && actual() === user){ try{ authLoginClear(user); }catch(e){} ov.remove(); return; }
        if(x.apagada) b.remove();
        var er = ov.querySelector('#lockErr'); if(er && x.motivo !== 'cancelado' && x.motivo !== 'ocupado' && x.motivo !== 'tiempo') er.textContent = '👆 No se pudo con la huella: escribe la contraseña.';
      });
    };
    b.addEventListener('click', ir);
    // En Android se pide sola (es la misma persona que sigue), pero solo con ORDEVA a la vista; si no, al volver a ella.
    if(android()){
      if(alFrente()) setTimeout(ir, 400);
      else { var vis = function(){ if(!alFrente()) return; document.removeEventListener('visibilitychange', vis); setTimeout(ir, 400); }; document.addEventListener('visibilitychange', vis); }
    }
  }

  // ---------- Ajustes → Cuenta ----------
  function pintarAjustes(){
    var fila = document.getElementById('accHuellaRow'), user = actual();
    if(!fila) return;
    var txt = document.getElementById('accHuellaTxt'), btn = document.getElementById('accHuellaBtn');
    if(!user || !usuario(user)){ if(!fila.hidden) fila.hidden = true; return; }
    disponible().then(function(d){
      var on = tiene(user), ocultar = d === 'no' && !on;
      if(fila.hidden !== ocultar) fila.hidden = ocultar;
      var t = on ? '✅ Activada para ' + user + ' en este equipo.' : d === 'sin-huella' ? 'Este celular no tiene huellas guardadas (agrégalas en los Ajustes del celular).' : '';
      if(txt && txt.textContent !== t) txt.textContent = t;
      var bt = on ? 'Quitar' : '👆 Activar', bc = on ? 'btn-danger-outline' : 'btn-ghost';
      if(btn && btn.textContent !== bt) btn.textContent = bt;
      if(btn && btn.className !== bc) btn.className = bc;
    });
  }
  var ajustesVisible = function(){ var f = document.getElementById('accHuellaRow'); return !!(f && f.closest('.settings-group') && f.closest('.settings-group').offsetParent); };
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
      '.auth-huella small{font-weight:500;opacity:.75;font-size:13px}' +
      // «hidden» tiene que esconder de verdad (display:flex de estas clases le ganaba a lo del navegador)
      '.auth-huella[hidden],#accHuellaRow[hidden]{display:none!important}';
    document.head.appendChild(s);
  }
  function iniciar(){
    estilos(); pintarEntrada(); pintarAjustes();
    var ov = document.getElementById('authOverlay');
    if(ov && window.MutationObserver) new MutationObserver(pintarEntrada).observe(ov, { attributes: true, subtree: true, attributeFilter: ['hidden'] });
    document.addEventListener('input', function(e){ if(e.target && e.target.id === 'authUser') pintarEntrada(); });
    document.addEventListener('click', function(e){
      var t = e.target; if(!t || !t.closest) return;
      if(t.closest('#authOverlay')) setTimeout(pintarEntrada, 0);
      if(t.closest('#accHuellaBtn')){ tocarAjustes(); return; }
      setTimeout(function(){ if(ajustesVisible()) pintarAjustes(); }, 300);   // solo con Ajustes a la vista
    }, true);
    if(window.MutationObserver) new MutationObserver(function(){ if(document.getElementById('lockOv')) pintarBloqueo(); }).observe(document.body, { childList: true });
  }
  window.ventoHuella = { disponible: disponible, tiene: tiene, conHuella: conHuella, pedir: pedir, activarConClave: activarConClave, quitar: quitar, ofrecer: ofrecer, entrar: entrarConHuella, pintar: function(){ pintarEntrada(); pintarAjustes(); } };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
