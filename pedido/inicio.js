/* ORDEVA · pedido/inicio.js — antes estaba dentro de pedido.html (1.99.92: así la lista blanca CSP no deja correr código pegado en la página). Se carga en el mismo lugar y orden. */
/* Pantalla siempre al ancho del celular: si Chrome abre la página como «sitio para computadoras»
   (o el celular la dibuja más ancha que la pantalla), se agranda sola para no tener que hacer zoom. */
(function(){
  function ajustar(){
    try{
      var d = document.documentElement, tactil = window.matchMedia && matchMedia('(pointer:coarse)').matches;
      var ancho = Math.min(screen.width || 0, screen.availWidth || screen.width || 0);
      d.style.zoom = '';
      var vw = window.innerWidth || d.clientWidth, z = 1;
      if(tactil && ancho && ancho < 820 && vw > ancho * 1.25) z = vw / ancho;
      if(z > 1) d.style.zoom = z.toFixed(3);
      medidas(z);
    }catch(e){}
  }
  // Con el zoom, las reglas «si la pantalla mide menos de X» se escalan igual, para que la página
  // use su diseño de celular (menú abajo, columnas angostas) y no el de computador.
  function medidas(z){
    try{
      for(var i = 0; i < document.styleSheets.length; i++){
        var rs; try{ rs = document.styleSheets[i].cssRules; }catch(e){ continue; }
        for(var j = 0; j < rs.length; j++){
          var r = rs[j]; if(!r.media || !r.conditionText && !r.media.mediaText) continue;
          if(r._orig == null) r._orig = r.media.mediaText;
          if(!/width/.test(r._orig)) continue;
          var t = z > 1 ? r._orig.replace(/(width\s*:\s*)(\d+(?:\.\d+)?)px/g, function(m, a, n){ return a + Math.round(n * z) + 'px'; }) : r._orig;
          if(r.media.mediaText !== t) r.media.mediaText = t;
        }
      }
    }catch(e){}
  }
  document.addEventListener('DOMContentLoaded', function(){ ajustar(); });
  ajustar();
  window.addEventListener('resize', ajustar);
  window.addEventListener('orientationchange', function(){ setTimeout(ajustar, 300); });
})();
