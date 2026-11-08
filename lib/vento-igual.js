/* ORDEVA · lib/vento-igual.js — 1.88.0: 📱 ORDEVA se ve igual en todos los celulares.
   Pedido del dueño: «hay celulares que le aumentan el zoom y cuando se abre la app se ve diferente; que esa configuración
   no afecte ORDEVA».
     • La LETRA grande del celular («tamaño de fuente»): la app de Android ya no la sigue (WebView.setTextZoom(100)) y las
       páginas tienen text-size-adjust: 100 %.
     • El ZOOM de la pantalla del celular: en la 1.88 la página pedía el ancho que tendría con el tamaño normal. 🚑 1.95.3:
       se quitó (en algunos celulares el menú de abajo quedaba por fuera de la pantalla). Solo se anota la escala.
   Va en el <head>, antes de pintar, para que no salte. Fuera de la app (en el navegador) no cambia nada. */
(function(){
  'use strict';
  var A = window.VentoAndroid;
  if(!A || typeof A.escalaPantalla !== 'function') return;
  function ajustar(){
    try{
      var e = Number(A.escalaPantalla());
      var m = document.querySelector('meta[name="viewport"]');
      if(!m) return;
      if(!m.dataset.original) m.dataset.original = m.getAttribute('content') || '';
      // Solo si el celular tiene la pantalla agrandada o achicada (más de 3 %), y con un ancho razonable.
      var w = Math.round((window.screen.width || 0) * e);
      if(!(e > 1.03 || e < 0.97) || !(w >= 300 && w <= 1600)){ if(m.getAttribute('content') !== m.dataset.original) m.setAttribute('content', m.dataset.original); return; }
      // 🚑 1.95.3: YA NO se cambia el ancho de la página. En algunos celulares el WebView no la volvía a ajustar a la
      // pantalla después del cambio: quedaba más ancha que la pantalla y el menú de abajo perdía Productos, Inventario y
      // «Más» → Ajustes (reporte del dueño). Solo se anota la escala, para revisarla si hace falta. La letra del celular
      // sigue sin afectar a ORDEVA (setTextZoom(100) en la app y text-size-adjust en las páginas).
      if(m.getAttribute('content') !== m.dataset.original) m.setAttribute('content', m.dataset.original);
      document.documentElement.setAttribute('data-escala', String(Math.round(e * 100) / 100));
    }catch(x){}
  }
  ajustar();
  window.addEventListener('orientationchange', function(){ setTimeout(ajustar, 250); });
  window.addEventListener('resize', function(){ clearTimeout(ajustar._t); ajustar._t = setTimeout(ajustar, 300); });
  window.ventoIgual = { ajustar: ajustar };
})();
