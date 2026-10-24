/* =====================================================================
   ORDEVA 1.61.0 · Abrir al instante: guarda la app en este equipo (sw.js)
   Con internet siempre abre la versión de hoy (la página se pide a internet primero); los archivos con versión salen
   del equipo al instante. Sin internet abre la última copia y sigue la regla de siempre («📡 Sin conexión con
   ORDEVA» hasta que vuelva la conexión). Ver sw.js.
   En pruebas locales (localhost) no se activa, salvo con ?sw=1 en la dirección.
   ===================================================================== */
(function(){
  'use strict';
  if(!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  var local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  if(local && !/[?&]sw=1(&|$)/.test(location.search)) return;
  function lista(){
    var u = [location.href.split('#')[0]];
    Array.prototype.forEach.call(document.querySelectorAll('script[src],link[rel="manifest"][href],link[rel="icon"][href],link[rel="apple-touch-icon"][href]'), function(el){
      var s = el.src || el.href; if(s) u.push(s);
    });
    return u.filter(function(s){ try{ return new URL(s).origin === location.origin; }catch(e){ return false; } });
  }
  function registrar(){
    navigator.serviceWorker.register('sw.js' + (local ? '?cache=1' : '')).then(function(){ return navigator.serviceWorker.ready; })
      .then(function(reg){ var w = reg.active || navigator.serviceWorker.controller; if(w) w.postMessage({ tipo: 'guardar', pagina: location.href.split('#')[0], urls: lista() }); })
      .catch(function(){});
  }
  // Después de abrir (no le quita tiempo al arranque).
  if(document.readyState === 'complete') setTimeout(registrar, 2500); else window.addEventListener('load', function(){ setTimeout(registrar, 2500); });
  window.ventoGuardarApp = registrar;
})();
