/* ORDEVA · lib/vento-igual.js — 1.88.0: 📱 ORDEVA se ve igual en todos los celulares.
   Pedido del dueño: «hay celulares que le aumentan el zoom y cuando se abre la app se ve diferente; que esa configuración
   no afecte ORDEVA».
     • La LETRA grande del celular («tamaño de fuente»): la app de Android ya no la sigue (WebView.setTextZoom(100)) y las
       páginas tienen text-size-adjust: 100 %.
     • El ZOOM de la pantalla del celular («tamaño de pantalla» / «zoom de pantalla»): hace que la página quede más angosta
       (como un celular más pequeño) y todo se ve más grande y apretado. Dentro de la app de Android, esta página pide el
       ancho que tendría con el tamaño normal, y Android la ajusta a la pantalla: se ve igual que en cualquier otro celular.
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
      var c = 'width=' + w + ', viewport-fit=cover';
      if(m.getAttribute('content') !== c) m.setAttribute('content', c);
      document.documentElement.setAttribute('data-escala', String(Math.round(e * 100) / 100));
    }catch(x){}
  }
  ajustar();
  window.addEventListener('orientationchange', function(){ setTimeout(ajustar, 250); });
  window.addEventListener('resize', function(){ clearTimeout(ajustar._t); ajustar._t = setTimeout(ajustar, 300); });
  window.ventoIgual = { ajustar: ajustar };
})();
