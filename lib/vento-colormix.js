/* =====================================================================
   ORDEVA · colores mezclados (color-mix) en iPhone/iPad con iOS 15 y 16.0–16.1
   Esos Safari no entienden «color-mix(…)»: botan esa línea del estilo y se pierden fondos, bordes y resaltados (el
   botón activo, la tarjeta de pago…). Aquí se calcula cada mezcla con los colores del tema actual y se agrega como
   estilo normal. En los navegadores que sí lo entienden (casi todos) no hace NADA.
   ===================================================================== */
(function(){
  'use strict';
  var forzar = !!window.__ventoForzarColorMix;   // solo para las pruebas
  try{ if(!forzar && window.CSS && CSS.supports && CSS.supports('color', 'color-mix(in srgb, red 50%, blue)')) return; }catch(e){ return; }
  var cx = null;
  function rgba(c){
    if(!cx){ var cv = document.createElement('canvas'); cv.width = cv.height = 1; cx = cv.getContext('2d'); }
    c = String(c || '').trim(); if(!c) return null;
    if(/^transparent$/i.test(c)) return [0, 0, 0, 0];
    cx.fillStyle = '#000'; cx.fillStyle = c; var s = String(cx.fillStyle);
    var m = s.match(/^#([0-9a-f]{6})$/i); if(m){ var n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255, 1]; }
    m = s.match(/^rgba?\(([^)]+)\)$/i); if(m){ var p = m[1].split(',').map(parseFloat); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
    return null;
  }
  var vars = null;
  function variable(nombre){
    var v = '';
    try{ v = vars.r.getPropertyValue(nombre).trim() || (vars.b && vars.b.getPropertyValue(nombre).trim()) || ''; }catch(e){}
    return v;
  }
  // var(--a, var(--b, #fff)) → el valor, resolviendo las anidadas.
  function resolver(v, prof){
    if((prof || 0) > 6) return v;
    return String(v).replace(/var\(\s*(--[\w-]+)\s*(?:,\s*((?:[^()]|\((?:[^()]|\([^()]*\))*\))*))?\)/g, function(_, n, resp){ var x = variable(n); return x ? resolver(x, (prof || 0) + 1) : resolver(resp || '', (prof || 0) + 1); });
  }
  // color-mix(in srgb, A p%, B q%) con A y B ya resueltos (también anidados).
  function mezclar(texto){
    var guard = 0;
    while(/color-mix\(/i.test(texto) && guard++ < 20){
      texto = texto.replace(/color-mix\(\s*in\s+[\w-]+\s*,\s*((?:[^(),]|\([^()]*\))+?)\s*(\d+(?:\.\d+)?%)?\s*,\s*((?:[^(),]|\([^()]*\))+?)\s*(\d+(?:\.\d+)?%)?\s*\)/i, function(_, a, pa, b, pb){
        var A = rgba(a), B = rgba(b); if(!A || !B) return a;
        var p = pa ? parseFloat(pa) / 100 : (pb ? 1 - parseFloat(pb) / 100 : 0.5);
        var q = pb ? parseFloat(pb) / 100 : 1 - p, t = p + q || 1; p /= t; q /= t;
        var al = A[3] * p + B[3] * q, ch = function(i){ return al ? Math.round((A[i] * A[3] * p + B[i] * B[3] * q) / al) : 0; };
        return 'rgba(' + ch(0) + ',' + ch(1) + ',' + ch(2) + ',' + Math.round(al * 1000) / 1000 + ')';
      });
    }
    return texto;
  }
  // Recorre el CSS de las etiquetas <style> y se queda con las líneas que tienen color-mix, con su selector (y su @media).
  function reglas(css){
    var out = [], pila = [], sel = '', i = 0, ini = 0;
    css = css.replace(/\/\*[\s\S]*?\*\//g, '');
    for(; i < css.length; i++){
      var c = css[i];
      if(c === '{'){ pila.push(css.slice(ini, i).trim()); ini = i + 1; }
      else if(c === '}'){
        var cuerpo = css.slice(ini, i); ini = i + 1;
        var s2 = pila.pop() || '';
        if(/color-mix\(/i.test(cuerpo) && s2 && s2[0] !== '@'){
          var decl = cuerpo.split(';').filter(function(d){ return /color-mix\(/i.test(d) && d.indexOf(':') > 0; });
          if(decl.length) out.push({ envoltura: pila.filter(function(x){ return x[0] === '@'; }), sel: s2, decl: decl });
        }
      }
    }
    return out;
  }
  var hoja = null, todo = null;
  function aplicar(){
    try{
      vars = { r: getComputedStyle(document.documentElement), b: document.body ? getComputedStyle(document.body) : null };
      if(!todo){ todo = []; Array.prototype.forEach.call(document.querySelectorAll('style'), function(st){ if(st.id !== 'ventoColorMix') todo = todo.concat(reglas(st.textContent || '')); }); }
      var txt = todo.map(function(r){
        var cuerpo = r.decl.map(function(d){ var k = d.indexOf(':'); return d.slice(0, k).trim() + ':' + mezclar(resolver(d.slice(k + 1).trim())); }).join(';');
        var regla = r.sel + '{' + cuerpo + '}';
        r.envoltura.forEach(function(w){ regla = w + '{' + regla + '}'; });
        return regla;
      }).join('\n');
      if(!hoja){ hoja = document.createElement('style'); hoja.id = 'ventoColorMix'; }
      hoja.textContent = txt;
      document.head.appendChild(hoja);   // siempre la última: gana como lo haría la línea original
    }catch(e){}
  }
  window.ventoColorMix = { aplicar: aplicar, _mezclar: function(t){ vars = { r: getComputedStyle(document.documentElement), b: document.body && getComputedStyle(document.body) }; return mezclar(resolver(t)); } };
  var t = null; function pronto(){ clearTimeout(t); t = setTimeout(aplicar, 60); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', aplicar); else aplicar();
  window.addEventListener('load', function(){ todo = null; aplicar(); });   // también los <style> que agregó la página al abrir
  // Al cambiar de tema (o los colores propios) cambian las variables: se vuelve a calcular.
  try{ new MutationObserver(pronto).observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class', 'data-theme'] }); }catch(e){}
  document.addEventListener('DOMContentLoaded', function(){ try{ new MutationObserver(pronto).observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] }); }catch(e){} });
  // Estilos que la página agrega después (ventanas, módulos): se traducen también y lo traducido sigue de último.
  try{ new MutationObserver(function(ms){
    var nuevo = ms.some(function(m){ return Array.prototype.some.call(m.addedNodes, function(n){ return n.tagName === 'STYLE' && n.id !== 'ventoColorMix'; }); });
    if(nuevo){ todo = null; pronto(); }
  }).observe(document.head, { childList: true }); }catch(e){}
})();
