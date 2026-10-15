/* =====================================================================
   Vento · Puerta: la app solo funciona conectada a la base de datos de Vento
   • Sin cuenta/negocio de Vento Nube en este equipo → pantalla «Conecta Vento a tu cuenta».
   • Con cuenta, mientras llega el estado FIRMADO del servidor (plan, vencimiento) → «Conectando con Vento…».
   • Sin internet se sigue con el último estado firmado hasta su vencimiento (72 h); pasado eso y sin poder
     renovarlo → «Sin conexión con Vento» hasta que vuelva la conexión.
   El plan lo sigue decidiendo el servidor (nube/vento-suscripcion.js); esto solo tapa la app mientras no hay
   una base de datos que lo respalde. El equipo del proveedor (licencia «proveedor») no se bloquea.
   En localhost / archivo local (desarrollo y pruebas) no se activa, salvo con ?puerta=1 en la dirección.
   ===================================================================== */
(function(){
  'use strict';
  if(window.ventoPuerta) return;
  var local = /^(localhost|127\.0\.0\.1|\[::1\]|)$/.test(location.hostname) || location.protocol === 'file:';
  var forzar = /[?&]puerta=1(&|$)/.test(location.search);
  if(local && !forzar) return;

  var ov = null, ultimo = '', desde = Date.now(), visto = 0;
  var esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  function proveedor(){ try{ return !!(window.ventoPlan && window.ventoPlan().k === 'proveedor'); }catch(e){ return false; } }
  function estado(){
    var s = window.ventoSuscripcion;
    if(!s || !s.puerta) return { ok: false, motivo: window.ventoNube ? 'espera' : 'cuenta' };
    try{ return s.puerta(); }catch(e){ return { ok: false, motivo: 'espera' }; }
  }
  function crear(){
    if(ov || !document.body) return;
    ov = document.createElement('div'); ov.id = 'vpOv'; ov.setAttribute('role', 'alertdialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('data-novocab', '');
    ov.style.cssText = 'position:fixed;inset:0;z-index:10040;background:var(--bg,#0b0b0b);color:var(--ink,#fff);display:flex;align-items:center;justify-content:center;padding:20px;overflow:auto;font-family:var(--font-main,system-ui,sans-serif)';
    ov.addEventListener('click', function(e){
      var b = e.target.closest && e.target.closest('[data-vp]'); if(!b) return;
      var a = b.dataset.vp;
      if(a === 'cuenta'){ try{ window.ventoNube.abrir(); }catch(x){} }
      else if(a === 'reintentar'){ b.disabled = true; b.textContent = 'Conectando…'; try{ window.ventoSuscripcion.refrescar(true); }catch(x){} setTimeout(revisar, 1500); }
    });
    document.body.appendChild(ov);
  }
  function pantalla(r){
    var t, p, btn = '';
    if(r.motivo === 'cuenta'){
      t = '🔐 Conecta Vento a tu cuenta';
      if(r.sinServidor){ p = 'Esta copia de Vento no tiene la dirección de la base de datos, por eso no puede abrirse. Instala o abre la versión oficial de Vento.'; }
      else{
        p = 'Vento funciona conectado a su base de datos: tu negocio, tu plan y tus equipos se manejan desde tu cuenta, y así todo se actualiza al instante en todos tus celulares.';
        btn = '<button type="button" class="btn-primary" data-vp="cuenta">☁️ Entrar o crear mi cuenta</button>';
      }
    }else if(r.motivo === 'sinconexion'){
      t = '📡 Sin conexión con Vento';
      p = 'Pasaron más de 72 horas sin poder confirmar tu plan con la base de datos. Conéctate a internet y Vento vuelve solo. Tus datos están a salvo en este equipo.';
      btn = '<button type="button" class="btn-primary" data-vp="reintentar">🔄 Reintentar</button><button type="button" class="btn-ghost" data-vp="cuenta">☁️ Mi cuenta</button>';
    }else{
      var sinNet = r.error === 'red';
      t = sinNet ? '📡 Sin conexión con Vento' : '⏳ Conectando con Vento…';
      p = sinNet ? 'No hay conexión con la base de datos de Vento. Revisa el internet; apenas vuelva, Vento sigue solo.' :
        (r.error ? 'No se pudo confirmar tu plan con la base de datos (' + esc(r.error) + '). Puedes reintentar o entrar con otra cuenta.' : 'Un momento, confirmando tu plan con la base de datos.');
      btn = '<button type="button" class="btn-primary" data-vp="reintentar">🔄 Reintentar</button><button type="button" class="btn-ghost" data-vp="cuenta">☁️ Mi cuenta</button>';
    }
    return '<div style="width:100%;max-width:380px;display:flex;flex-direction:column;gap:14px;text-align:center;background:var(--surface,#161616);border:1px solid var(--line,#333);border-radius:18px;padding:24px 20px">' +
      '<b style="font-size:20px;line-height:1.3">' + t + '</b><div style="font-size:14.5px;line-height:1.5;opacity:.85">' + p + '</div>' +
      (btn ? '<div style="display:flex;flex-direction:column;gap:8px">' + btn + '</div>' : '') + '</div>';
  }
  function revisar(){
    var r = proveedor() ? { ok: true } : estado();
    if(r.ok){
      if(ov){ ov.remove(); ov = null; ultimo = ''; }
      visto = Date.now();
      try{ document.documentElement.removeAttribute('data-vento-puerta'); }catch(e){}
      return;
    }
    // «Conectando…» no se muestra en el primer instante: con el estado guardado casi nunca llega a verse.
    if(r.motivo === 'espera' && !r.error && !ov && Date.now() - desde < 700) return;
    crear(); if(!ov) return;
    try{ document.documentElement.setAttribute('data-vento-puerta', r.motivo); }catch(e){}
    var clave = r.motivo + '|' + (r.error || '') + '|' + (r.sinServidor ? 1 : 0);
    if(clave !== ultimo){ ultimo = clave; ov.innerHTML = pantalla(r); }
  }
  window.ventoPuerta = { revisar: revisar, estado: estado };
  window.addEventListener('vento-suscripcion', revisar);
  window.addEventListener('online', revisar);
  window.addEventListener('offline', revisar);
  document.addEventListener('visibilitychange', function(){ if(!document.hidden) revisar(); });
  setInterval(revisar, 1500);
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', revisar); else revisar();
})();
