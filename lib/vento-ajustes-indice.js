/* 🧭 ORDEVA 1.99.4 · Ajustes › Negocio y facturación, más corto (auditoría de diseño, hallazgo 5).
   Antes era una sola página de ~10.000 px en el celular (11 pantallas). Ahora:
   1. Arriba, un índice «En esta sección» que lleva directo a cada parte (Plan, Mi negocio, Tipo y funciones, Usuarios y
      seguridad, Caja y personal, Más opciones, Facturación). Nada se esconde: solo se salta.
   2. Las dos listas más largas quedan plegadas con su botón para abrirlas:
      - el buscador de tipo de negocio (se ve el tipo actual y «Cambiar tipo de negocio»),
      - las 🧩 Funciones de este negocio (se ve cuántas están prendidas y «Ver y cambiar funciones»).
   Si el 🔎 buscador de Ajustes lleva a algo plegado, se despliega solo. Las pantallas de bienvenida no cambian. */
(function(){
  'use strict';
  var $ = function(id){ return document.getElementById(id); };
  var grupos = function(){ return [].slice.call(document.querySelectorAll('#view-ajustes .settings-group[data-cat="negocio"]')); };
  var visible = function(el){ return !!(el && el.offsetParent); };
  var sinEmoji = function(t){ return String(t || '').replace(/^[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9]+/, '').trim(); };
  var grupoDe = function(re){ var g = grupos().filter(function(x){ return re.test((x.querySelector('h2') || {}).textContent || ''); }); return g[0] || null; };
  var filaDe = function(re){ var r = null; grupos().some(function(g){ return [].slice.call(g.querySelectorAll('.settings-row > .settings-row-text > strong')).some(function(s){ if(re.test(s.textContent)){ r = s.closest('.settings-row'); return true; } return false; }); }); return r; };

  // 1 · Índice
  var DESTINOS = [
    ['Plan', function(){ return $('subGrupo'); }],
    ['Mi negocio', function(){ return grupoDe(/Cuenta y negocio/); }],
    ['Tipo y funciones', function(){ var p = $('accTypePick'); return p && p.closest('.settings-row'); }],
    ['Usuarios y seguridad', function(){ return filaDe(/Usuarios/); }],
    ['Caja y personal', function(){ return $('cierreClaveBox') || $('arqueoCiegoBox') || $('comisionesBox'); }],
    ['Más opciones', function(){ return grupoDe(/Sedes o negocios/) || grupoDe(/Propina/); }],
    ['Facturación', function(){ return grupoDe(/Factura de venta/) || $('dianGrupo'); }]
  ];
  function pintarIndice(){
    var vis = grupos().filter(function(g){ return !g.hidden && g.dataset.off !== '1'; });
    var box = $('ajNegIndice');
    if(!vis.length){ if(box) box.remove(); return; }
    if(!box){
      box = document.createElement('nav'); box.id = 'ajNegIndice'; box.className = 'aj-indice'; box.setAttribute('aria-label', 'En esta sección');
      box.addEventListener('click', function(e){
        var b = e.target.closest('[data-ir]'); if(!b) return;
        var d = DESTINOS[+b.dataset.ir], el = d && d[1]();
        if(el){ var y = el.getBoundingClientRect().top + window.pageYOffset - 70; window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' }); el.classList.add('aj-flash'); setTimeout(function(){ el.classList.remove('aj-flash'); }, 1600); }
      });
    }
    var primero = vis[0];
    if(box.parentNode !== primero || primero.firstElementChild !== box) primero.insertBefore(box, primero.firstChild);
    var html = '<strong class="aj-indice-t">En esta sección</strong><div class="aj-indice-l">';
    DESTINOS.forEach(function(d, i){ var el = d[1](); if(el && visible(el)) html += '<button type="button" class="aj-chip" data-ir="' + i + '">' + d[0] + '</button>'; });
    html += '</div>';
    if(box.innerHTML !== html) box.innerHTML = html;
  }

  // 2 · Plegables. El botón (y su resumen) van FUERA de lo que se repinta, justo después de «ancla», para que no se borren
  //     cuando la otra parte vuelve a pintar su contenido; la clase «aj-plegado» va en «caja» (que no se vuelve a crear).
  function plegable(id, caja, ancla, resumen, abrirTxt, cerrarTxt){
    var btn = $(id);
    if(!btn){
      caja.classList.add('aj-plegado');
      btn = document.createElement('button'); btn.type = 'button'; btn.id = id; btn.className = 'btn-ghost aj-pleg-btn';
      btn.addEventListener('click', function(){ btn._caja.classList.toggle('aj-plegado'); btn._pintar(); });
    }
    btn._caja = caja;
    btn._pintar = function(){ var p = btn._caja.classList.contains('aj-plegado'); btn.textContent = p ? abrirTxt : cerrarTxt; btn.setAttribute('aria-expanded', p ? 'false' : 'true'); };
    if(ancla.nextSibling !== btn && !(resumen && ancla.nextSibling && ancla.nextSibling.id === id + 'Res' && ancla.nextSibling.nextSibling === btn)) ancla.parentNode.insertBefore(btn, ancla.nextSibling);
    var r = $(id + 'Res');
    if(resumen){ if(!r){ r = document.createElement('div'); r.id = id + 'Res'; r.className = 'settings-desc aj-pleg-res'; } if(r.nextSibling !== btn) btn.parentNode.insertBefore(r, btn); if(r.textContent !== resumen) r.textContent = resumen; }
    else if(r) r.remove();
    btn._pintar();
  }
  function quitar(id){ [id, id + 'Res'].forEach(function(x){ var e = $(x); if(e) e.remove(); }); }
  function pintarPlegables(){
    var p = $('accTypePick'), filaTipo = p && p.closest('.settings-row');
    if(filaTipo){ filaTipo.classList.add('aj-pleg-tipo'); }
    if(filaTipo) plegable('ajPlegTipo', filaTipo, $('accTipoEstado') || p, '', '🔁 Cambiar tipo de negocio', '▲ Listo, plegar');
    var m = $('modulosBox');
    if(m){
      var sw = m.querySelectorAll('[data-modulo]'), on = m.querySelectorAll('[data-modulo]:checked').length;
      plegable('ajPlegMod', m, m, sw.length ? on + ' de ' + sw.length + ' funciones prendidas.' : '', '🧩 Ver y cambiar funciones', '▲ Listo, plegar');
    } else quitar('ajPlegMod');
  }
  function pintar(){ try{ pintarPlegables(); }catch(e){} try{ pintarIndice(); }catch(e){} }

  // Si el 🔎 buscador (o cualquier atajo) resalta algo que está plegado, se despliega.
  function vigilar(){
    var v = $('view-ajustes'); if(!v || !window.MutationObserver) return;
    new MutationObserver(function(ms){
      ms.forEach(function(m){
        var el = m.target; if(!el.classList || !el.classList.contains('aj-flash')) return;
        var f = el.closest('.aj-plegado');
        if(f && f !== el && !el.matches('.aj-pleg-btn') && !visible(el)){ f.classList.remove('aj-plegado'); ['ajPlegTipo', 'ajPlegMod'].forEach(function(id){ var b = $(id); if(b && b._pintar) b._pintar(); }); setTimeout(function(){ try{ el.scrollIntoView({ block: 'center' }); }catch(e){} }, 30); }
      });
    }).observe(v, { attributes: true, attributeFilter: ['class'], subtree: true });
  }

  function iniciar(){
    vigilar(); pintar();
    // Otras partes pintan sus renglones de Negocio entre 60 y 120 ms después de abrir; se vuelve a mirar después de ellas.
    document.addEventListener('click', function(e){
      if(e.target.closest && e.target.closest('.ajustes-cat, nav button[data-view="ajustes"], .more-tile[data-go], #ajustesBackBtn, #ajBuscarRes')){ setTimeout(pintar, 200); setTimeout(pintar, 700); }
      else if(e.target.closest && e.target.closest('#modulosBox [data-modulo], #modulosTipo')) setTimeout(pintar, 120);
    }, true);
    document.addEventListener('change', function(e){ if(e.target.closest && e.target.closest('#modulosBox')) setTimeout(pintar, 120); }, true);
  }
  window.ventoAjNegocio = { pintar: pintar };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(iniciar, 0); }); else setTimeout(iniciar, 0);
})();
