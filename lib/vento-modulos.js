/* ORDEVA · lib/vento-modulos.js — 1.64.0: «🧩 Funciones de este negocio» (Ajustes → Negocio, solo dueño o administrador).
   Cada negocio trae de su tipo las funciones que usa (catálogo A–Z: letras k p w d q v n b r). Aquí el administrador
   prende o apaga cada una para ESTE negocio (data.modulos, en los datos del negocio: los otros negocios de la misma
   cuenta no cambian). Apagar una función solo la esconde: nunca borra insumos, recetas, ventas ni nada.
   La pantalla de preparación (k) sigue con su propio interruptor (Ajustes → Pedidos), que aquí se usa tal cual. */
(function(){
  if(window.ventoModulos) return;
  var MODS = [
    ['r', '🧂', 'Insumos y recetas', 'Lo que usas para preparar (harina, queso, carne, licor para cócteles…) y las recetas que lo descuentan al vender, con el costo de cada plato.'],
    ['k', '🖥️', 'Pantalla de preparación', 'Los pedidos llegan a la cocina, la barra o producción.'],
    ['w', '🧑‍🍳', 'App de meseros', 'Los meseros toman pedidos desde su celular.'],
    ['q', '📱', 'Pedidos por QR', 'El cliente pide desde el QR de su mesa o puesto.'],
    ['p', '🗺️', 'Mapa del local', 'Ubicar las mesas como están en el local.'],
    ['d', '👥', 'Dividir la cuenta', 'Cada persona de la mesa con su cuenta aparte.'],
    ['n', '🧾', 'Cuenta a nombre del cliente', 'Cada cuenta lleva el nombre de quien la abre.'],
    ['v', '⚡', 'Venta de mostrador primero', 'La venta rápida queda de primera.'],
    ['b', '🏷️', 'Código de barras', 'Vender e inventariar con el lector.']
  ];
  var $ = function(id){ return document.getElementById(id); };
  var esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function D(){ return typeof data !== 'undefined' && data ? data : null; }
  function jefe(){ try{ return !window.ventoRoles || window.ventoRoles.esJefe(); }catch(e){ return true; } }
  function on(c){ try{ return usaMod(c); }catch(e){ return false; } }
  // Lo que trae el tipo de negocio (sin lo que eligió el administrador)
  function deFabrica(c){
    var d = D(); if(!d) return false;
    try{ var t = tipoNegocio(); var m = d.modoCompleto ? MOD_TODO : (t ? t.mod : MOD_TODO); return String(m).indexOf(c) >= 0; }catch(e){ return false; }
  }
  function cuantas(){
    var d = D() || {}, ins = Array.isArray(d.insumos) ? d.insumos.length : 0;
    var rec = Array.isArray(d.products) ? d.products.filter(function(p){ return p && Array.isArray(p.receta) && p.receta.length; }).length : 0;
    return { ins: ins, rec: rec };
  }
  function refrescar(){
    try{ aplicarModulos(); }catch(e){}
    try{ window.ventoRecetas && window.ventoRecetas.pintarPanel(); }catch(e){}
    try{ aplicarVocabulario(); }catch(e){}
  }
  async function poner(c, si){
    var d = D(); if(!d) return;
    if(!jefe()){ try{ showToast('🔒 Solo el dueño o el administrador cambian las funciones del negocio.'); }catch(e){} pintar(); return; }
    if(c === 'k'){   // la pantalla de preparación tiene su interruptor propio (con su link y su canal)
      var p = $('prepOn');
      if(p){ p.checked = si; p.dispatchEvent(new Event('change')); }
      else { d.prep = Object.assign({}, d.prep, { on: si }); try{ saveData(); }catch(e){} refrescar(); }
      pintar(); return;
    }
    if(c === 'r' && !si){
      var n = cuantas();
      if(n.ins || n.rec){
        var ok = true;
        try{ ok = await showConfirm({ icon: '🧂', title: '¿Apagar insumos y recetas?', confirmText: 'Sí, apagar', cancelText: 'No',
          message: 'Tienes ' + n.ins + ' insumo' + (n.ins === 1 ? '' : 's') + ' y ' + n.rec + ' producto' + (n.rec === 1 ? '' : 's') + ' con receta. No se borra nada: queda guardado y vuelve igual cuando lo prendas. Mientras esté apagado, al vender NO se descuentan ingredientes.' }); }catch(e){}
        if(!ok){ pintar(); return; }
      }
    }
    d.modulos = Object.assign({}, d.modulos);
    d.modulos[c] = !!si;
    try{ window.ventoAuditar && window.ventoAuditar('función ' + (si ? 'prendida' : 'apagada'), (MODS.filter(function(x){ return x[0] === c; })[0] || [c, '', c])[2]); }catch(e){}
    try{ saveData(); }catch(e){}
    refrescar(); pintar();
    var nom = (MODS.filter(function(x){ return x[0] === c; })[0] || [c, '', c])[2];
    try{ showToast((si ? '✅ ' : '🙈 ') + nom + (si ? ': prendido en este negocio.' : ': escondido en este negocio (no se borró nada).')); }catch(e){}
  }
  async function deTipo(){
    var d = D(); if(!d) return;
    if(!jefe()) return;
    delete d.modulos;
    try{ saveData(); }catch(e){}
    refrescar(); pintar();
    try{ showToast('↺ Funciones como las trae tu tipo de negocio.'); }catch(e){}
  }
  function pintar(){
    var mc = $('modoCompletoToggle'), fila = mc && mc.closest('.settings-row');
    var box = $('modulosBox');
    if(!fila || !D()) return;
    if(!jefe()){ if(box) box.remove(); return; }
    if(!box){
      box = document.createElement('div'); box.id = 'modulosBox'; box.className = 'settings-row'; box.setAttribute('data-novocab', '');
      box.style.cssText = 'flex-direction:column;align-items:stretch;gap:6px';
      fila.parentNode.insertBefore(box, fila.nextSibling);
      box.addEventListener('change', function(e){ var x = e.target.closest('[data-modulo]'); if(x) poner(x.dataset.modulo, x.checked); });
      box.addEventListener('click', function(e){ if(e.target.closest('#modulosTipo')) deTipo(); });
    }
    var d = D(), propio = d.modulos && Object.keys(d.modulos).length, n = cuantas();
    box.innerHTML = '<div class="settings-row-text"><strong>🧩 Funciones de este negocio</strong><span>Prende solo lo que tu negocio usa. Vale para <b>este negocio</b> (tus otros negocios no cambian). Apagar una función la esconde de todas las pantallas, pero no borra nada.</span></div>' +
      MODS.map(function(x){
        var si = on(x[0]), fab = deFabrica(x[0]);
        var extra = x[0] === 'r' && (n.ins || n.rec) ? ' · tienes ' + n.ins + ' insumo' + (n.ins === 1 ? '' : 's') + ' y ' + n.rec + ' receta' + (n.rec === 1 ? '' : 's') : '';
        return '<label class="settings-row" style="padding:8px 0;gap:10px"><span class="settings-row-text"><strong>' + x[1] + ' ' + esc(x[2]) + '</strong><span>' + esc(x[3]) + ' <i style="opacity:.75">(' + (fab ? 'viene con tu tipo de negocio' : 'no viene con tu tipo de negocio') + esc(extra) + ')</i></span></span>' +
          '<span class="switch"><input type="checkbox" data-modulo="' + x[0] + '"' + (si ? ' checked' : '') + '><span class="switch-slider"></span></span></label>';
      }).join('') +
      (propio ? '<button type="button" class="btn-ghost" id="modulosTipo" style="align-self:flex-start">↺ Volver a las de mi tipo de negocio</button>' : '');
  }
  function iniciar(){
    pintar();
    document.addEventListener('click', function(e){ if(e.target.closest && e.target.closest('.ajustes-cat[data-cat="negocio"], nav button[data-view="ajustes"], #authBtn')) setTimeout(pintar, 120); }, true);
  }
  window.ventoModulos = { pintar: pintar, poner: poner, MODS: MODS };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
