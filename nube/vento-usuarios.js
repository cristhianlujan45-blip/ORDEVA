/* =====================================================================
   ORDEVA 1.60.0 · Usuarios del equipo (los que el dueño crea solo con un nombre, como «juan») en TODOS los equipos
   Antes vivían solo en el celular donde se crearon. Ahora, en cada equipo conectado con la cuenta del dueño o de un
   administrador, se suben y se bajan solos: el mismo usuario, con la misma contraseña y el mismo rol.
   • Viaja la huella de la contraseña (PBKDF2 con su sal), nunca la contraseña. Solo dueño y administrador la leen.
   • Lo que cambia en un equipo llega a los demás (al instante con el aviso en vivo, o en la próxima revisión).
   • Si un nombre ya existía en los dos equipos con contraseñas distintas, cada uno conserva la suya hasta que se cambie
     (no se le cambia la contraseña a nadie sin que el dueño lo haga).
   • Las cuentas con correo no pasan por aquí: esas ya son las mismas en todos los equipos.
   Necesita nube/vento-nube.js (ventoNube).
   ===================================================================== */
(function(){
  'use strict';
  var K_USERS = 'cm-users', K_SINC = 'vento-usuarios-sinc', K_SEDES = 'bar-sedes-list';
  var lsG = function(k, d){ try{ var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; }catch(e){ return d; } };
  var lsS = function(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
  var esCorreo = function(u){ return String(u || '').indexOf('@') >= 0; };
  // 1.62.0: también el PIN de los empleados (su huella, nunca el PIN)
  var pinDe = function(p){ return p && p.h ? String(p.s || '') + ':' + String(p.h) : ''; };
  var huella = function(u){ return u ? String(u.salt || '') + '|' + String(u.hash || '') + '|' + (u.role || 'staff') + '|' + pinDe(u.pin) : null; };
  function nb(){ return window.ventoNube || null; }
  function g(nombre){ try{ return (0, eval)('typeof ' + nombre + ' !== "undefined" ? ' + nombre + ' : undefined'); }catch(e){ return undefined; } }
  function rpc(fn, args){ return nb().cliente().then(function(c){ return c.rpc(fn, args); }).then(function(r){ if(r.error) throw r.error; return r.data; }); }
  // Negocio conectado y grupo de usuarios de este equipo que le corresponde (cada negocio del equipo tiene los suyos).
  function destino(){
    var n = nb(); if(!n || !n.negocio || !n.sede) return null;
    var neg = n.negocio(); if(!neg || (neg.rol !== 'dueno' && neg.rol !== 'admin')) return null;
    var sid = n.sede(), sede = lsG(K_SEDES, []).find(function(s){ return s && s.id === sid; });
    return { neg: neg, grupo: (sede && sede.cuenta) || 'principal' };
  }
  var enCurso = null, otraVez = false;
  function sincronizar(){
    if(enCurso){ otraVez = true; return enCurso; }
    var d = destino(); if(!d || navigator.onLine === false) return Promise.resolve(null);
    var res = { bajados: 0, subidos: 0, quitados: 0 };
    enCurso = rpc('usuarios_equipo_lista', { p_negocio: d.neg.id }).then(function(filas){
      var todo = lsG(K_SINC, {}), S = todo[d.neg.id] || {}, l = lsG(K_USERS, []), cambio = false, subir = [], yo = g('authUser'), sacar = null;
      var mio = function(u){ return u && (u.cuenta || 'principal') === d.grupo; };
      var srv = {};
      (filas || []).forEach(function(r){ if(r && r.usuario) srv[r.usuario] = r; });
      Object.keys(srv).forEach(function(nom){
        var r = srv[nom], L = l.find(function(u){ return u.user === nom; }), s = S[nom];
        if(L && (!mio(L) || esCorreo(nom))) return;           // ese nombre es de otro negocio de este equipo: no se toca
        var fl = huella(L);
        if(s && s.v === r.version){                           // nadie lo cambió en otro equipo: si aquí cambió, se sube
          if(fl !== s.f) subir.push(L ? { u: L } : { quitar: nom });
          return;
        }
        if(!s && L && !r.borrado){ S[nom] = { v: r.version, f: fl }; return; }   // ya estaba en los dos: cada uno con la suya
        if(r.borrado){
          if(L){ l = l.filter(function(u){ return u !== L; }); cambio = true; res.quitados++; if(nom === yo) sacar = 'quitado'; }
          S[nom] = { v: r.version, f: null };
          return;
        }
        var nuevo = Object.assign({}, L || {}, { user: nom, salt: r.salt, hash: r.hash, role: r.rol || 'staff' });
        if(r.pin && r.pin.h && nuevo.role !== 'admin') nuevo.pin = { s: r.pin.s, h: r.pin.h }; else delete nuevo.pin;
        if(d.grupo !== 'principal') nuevo.cuenta = d.grupo; else delete nuevo.cuenta;
        if(L){ l[l.indexOf(L)] = nuevo; if(nom === yo && !sacar) sacar = L.hash !== nuevo.hash ? 'clave' : (L.role !== nuevo.role ? 'rol' : null); }
        else l.push(nuevo);
        cambio = true; res.bajados++;
        S[nom] = { v: r.version, f: huella(nuevo) };
      });
      // Los de este equipo que el servidor todavía no tiene (nuevos, o de antes de 1.60.0): se suben.
      l.forEach(function(u){ if(mio(u) && !esCorreo(u.user) && u.hash && !srv[u.user]) subir.push({ u: u }); });
      Object.keys(S).forEach(function(nom){ if(!srv[nom] && !l.some(function(u){ return u.user === nom; })) delete S[nom]; });
      if(cambio){ lsS(K_USERS, l); try{ visto = localStorage.getItem(K_USERS) || ''; }catch(e){} }   // lo escrito aquí no cuenta como cambio
      todo[d.neg.id] = S; lsS(K_SINC, todo);
      var p = Promise.resolve();
      subir.forEach(function(x){
        p = p.then(function(){
          var u = x.u, nom = u ? u.user : x.quitar;
          var args = { p_negocio: d.neg.id, p_usuario: nom, p_salt: u ? u.salt : null, p_hash: u ? u.hash : null, p_rol: u ? (u.role || 'staff') : null, p_borrado: !u };
          var pin = u && u.pin && u.pin.h && u.role !== 'admin' ? { s: u.pin.s, h: u.pin.h } : null;
          // Con PIN: la v2 (1.62.0). Si el servidor todavía no la tiene, la de antes (sin el PIN).
          return rpc('usuarios_equipo_guardar_v2', Object.assign({ p_pin: pin }, args)).catch(function(e){
            if(/usuarios_equipo_guardar_v2|PGRST202|does not exist|not find/i.test(String((e && (e.message || e.code)) || ''))) return rpc('usuarios_equipo_guardar', args);
            throw e;
          })
            .then(function(v){ var t = lsG(K_SINC, {}); (t[d.neg.id] = t[d.neg.id] || {})[nom] = { v: v, f: huella(u) }; lsS(K_SINC, t); res.subidos++; }, function(){});
        });
      });
      return p.then(function(){
        if(cambio) try{ window.dispatchEvent(new CustomEvent('vento-usuarios', { detail: res })); }catch(e){}
        if(sacar && typeof window.ventoSacarUsuario === 'function') window.ventoSacarUsuario(yo, sacar);
        return res;
      });
    }).catch(function(){ return null; }).then(function(r){
      enCurso = null;
      if(otraVez){ otraVez = false; setTimeout(sincronizar, 300); }
      return r;
    });
    return enCurso;
  }
  // Se sincroniza al abrir, al volver a la app, cada 5 minutos, con el aviso en vivo del negocio y cuando cambian los usuarios aquí.
  var visto = null, tCambio = null;
  function vigilar(){
    var ahora = ''; try{ ahora = localStorage.getItem(K_USERS) || ''; }catch(e){}
    if(visto !== null && ahora !== visto){ clearTimeout(tCambio); tCambio = setTimeout(sincronizar, 1200); }
    visto = ahora;
  }
  function iniciar(){
    try{ visto = localStorage.getItem(K_USERS) || ''; }catch(e){}
    setTimeout(sincronizar, 2500);
    setInterval(vigilar, 3000);
    setInterval(function(){ if(!document.hidden) sincronizar(); }, 5 * 60e3);
    window.addEventListener('vento-aviso-vivo', function(){ setTimeout(sincronizar, 600); });
    window.addEventListener('online', function(){ setTimeout(sincronizar, 1500); });
    var vuelta = 0;
    document.addEventListener('visibilitychange', function(){ if(!document.hidden && Date.now() - vuelta > 60e3){ vuelta = Date.now(); sincronizar(); } });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
  window.ventoUsuariosEquipo = { sincronizar: sincronizar };
})();
