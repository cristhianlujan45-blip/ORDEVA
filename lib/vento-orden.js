/* ORDEVA · lib/vento-orden.js — 1.89.0: 🧭 los menús en el orden en que se usan.
   Pedido del dueño: «mira cómo mejoras el orden de los menús, la estructura del software, para que sea fácil de usar».
   Ajustes: primero lo del negocio y el día a día (negocio, equipo, pedidos y caja, pagos, impresora), después cómo se ve y
   suena, y al final lo avanzado (IA, datos, guía y la zona de riesgo). Antes empezaba por «ORDEVA IA» y «Modo fácil».
   Las categorías que agregan otros módulos (IA, balanza e impresora…) también se acomodan solas. */
(function(){
  'use strict';
  var ORDEN = ['negocio', 'nube', 'pedidos', 'pagos', 'equipos', 'avisos', 'facil', 'apariencia', 'voz', 'sonidos', 'laya', 'datos', 'ayuda', 'peligro'];
  var rango = function(b, i){ var k = ORDEN.indexOf(b.dataset.cat); return k < 0 ? 10.5 + i / 1000 : k; };   // las nuevas, antes de «Datos»
  function ordenar(){
    var c = document.getElementById('ajustesCats'); if(!c) return;
    var bs = Array.prototype.slice.call(c.querySelectorAll(':scope > .ajustes-cat'));
    var orden = bs.map(function(b, i){ return { b: b, r: rango(b, i) }; }).sort(function(x, y){ return x.r - y.r; }).map(function(x){ return x.b; });
    if(orden.every(function(b, i){ return b === bs[i]; })) return;   // ya está: no se toca (no se repinta de gusto)
    orden.forEach(function(b){ c.appendChild(b); });
  }
  function iniciar(){
    ordenar();
    var c = document.getElementById('ajustesCats');
    if(c && window.MutationObserver) new MutationObserver(function(){ ordenar(); }).observe(c, { childList: true });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
  window.ventoOrden = { ordenar: ordenar, ORDEN: ORDEN };
})();
