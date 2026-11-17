/* ☁️ ORDEVA 1.99.14 · «Este negocio está solo en este equipo».
   Pedido del dueño (17/11): «el usuario ingrese con su cuenta y ya tenga todos sus datos ahí». Revisando su cuenta en la nube
   se vio que el negocio con muchos productos inventariados NUNCA llegó a la nube: un negocio creado en el mismo equipo como
   otra «sede» o con un usuario sin correo se guarda solo en ese equipo, y no había ningún aviso. Cada cuenta de correo
   guarda UN negocio en la nube (el que está vinculado); los demás negocios del equipo quedan solo ahí.
   Ahora, al dueño o al administrador, arriba de Inicio:
     📱 «Este negocio está guardado solo en este equipo (N productos, M ventas)…» con ☁️ Guardarlo en mi cuenta
   y, si la cuenta ya guarda OTRO negocio en la nube, lo dice con su nombre. No cambia ni sube nada solo: el botón abre
   el panel de la cuenta (ORDEVA Nube), donde el dueño decide. Se puede ocultar por hoy. */
(function(){
  'use strict';
  var esc = function(t){ return String(t == null ? '' : t).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var jefe = function(){ try{ return !window.ventoRoles || window.ventoRoles.esJefe(); }catch(e){ return true; } };
  var D = function(){ return typeof data !== 'undefined' ? data : null; };
  var sedeActual = function(){ try{ return localStorage.getItem('bar-current-sede') || 'default'; }catch(e){ return 'default'; } };
  var hoy = function(){ var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  var K_OCULTO = 'vento-solo-local-oculto';

  // Devuelve null si el negocio que se ve SÍ está en la nube (o no aplica); si no, lo que hay que decir.
  function estado(){
    var N = window.ventoNube, d = D();
    if(!N || !N.configurada || !N.configurada() || !d || !jefe()) return null;
    if(document.body.classList.contains('demo') || /[?&]demo=/.test(location.search)) return null;
    var prods = Array.isArray(d.products) ? d.products.length : 0, ventas = Array.isArray(d.history) ? d.history.length : 0;
    if(!prods && !ventas) return null;                       // negocio vacío: no hay nada que perder
    var neg = N.negocio(), sede = N.sede && N.sede();
    if(neg && (!sede || sede === sedeActual())) return null;    // este es el negocio que la cuenta guarda en la nube
    return { prods: prods, ventas: ventas, otro: neg ? neg.nombre : null, nombre: d.businessName || 'este negocio' };
  }
  function pintar(){
    var host = document.getElementById('view-inicio'); if(!host) return;
    var box = document.getElementById('soloLocalAviso'), e = estado(), oculto = false;
    try{ oculto = localStorage.getItem(K_OCULTO) === hoy() + '|' + sedeActual(); }catch(x){}
    if(!e || oculto){ if(box) box.remove(); return; }
    if(!box){
      box = document.createElement('div'); box.id = 'soloLocalAviso'; box.className = 'solo-local'; box.setAttribute('role', 'status');
      box.addEventListener('click', function(ev){
        var b = ev.target.closest('[data-sl]'); if(!b) return;
        if(b.dataset.sl === 'nube'){ try{ window.ventoNube.abrir(); }catch(x){} }
        else if(b.dataset.sl === 'luego'){ try{ localStorage.setItem(K_OCULTO, hoy() + '|' + sedeActual()); }catch(x){} box.remove(); }
      });
    }
    if(host.firstElementChild !== box) host.insertBefore(box, host.firstChild);
    var cifras = e.prods + ' producto' + (e.prods === 1 ? '' : 's') + ' y ' + e.ventas + ' venta' + (e.ventas === 1 ? '' : 's');
    var html = '<b>📱 «' + esc(e.nombre) + '» está guardado solo en este equipo</b>' +
      '<span>Tiene ' + esc(cifras) + '. Si este celular se daña, se cambia o se borran los datos del navegador, se pierde. ' +
      (e.otro ? 'Tu cuenta de ORDEVA guarda en la nube otro negocio («' + esc(e.otro) + '»): cada cuenta guarda un negocio. Para guardar también este, usa otra cuenta de correo.'
              : 'Entra con tu correo para guardarlo en tu cuenta: así, en cualquier celular, entras y tienes todo.') + '</span>' +
      '<div class="solo-local-b"><button type="button" class="btn-primary" data-sl="nube">☁️ ' + (e.otro ? 'Ver mi cuenta' : 'Guardarlo en mi cuenta') + '</button><button type="button" class="btn-ghost" data-sl="luego">Hoy no</button></div>';
    if(box.innerHTML !== html) box.innerHTML = html;
  }
  function estilos(){
    if(document.getElementById('soloLocalCss')) return;
    var s = document.createElement('style'); s.id = 'soloLocalCss';
    s.textContent = '.solo-local{display:flex;flex-direction:column;gap:6px;margin:0 0 14px;padding:14px 16px;border-radius:14px;border:1px solid #f59e0b;background:#fffbeb;color:#78350f;font-size:14px;line-height:1.45}' +
      '.solo-local b{font-size:15px;color:#78350f}.solo-local-b{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px}.solo-local-b button{min-height:44px}';
    document.head.appendChild(s);
  }
  function iniciar(){
    estilos(); pintar();
    document.addEventListener('click', function(e){ if(e.target.closest && e.target.closest('nav button, .more-tile, #o2InicioNav')) setTimeout(pintar, 250); }, true);
    window.addEventListener('vento-datos-remotos', function(){ setTimeout(pintar, 300); });
    setInterval(function(){ if(document.visibilityState === 'visible') pintar(); }, 15000);
  }
  window.ventoSoloLocal = { estado: estado, pintar: pintar };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(iniciar, 600); }); else setTimeout(iniciar, 600);
})();
