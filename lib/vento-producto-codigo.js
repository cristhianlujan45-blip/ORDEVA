/* =====================================================================
   ORDEVA 1.65.9 · 🇨🇴 Reconocer un producto por su código de barras + ficha llena + «¿cuántas llegaron?»
   Funciona con cualquier lector: la cámara de este equipo, el celular como lector (lector.html), un lector USB o
   Bluetooth. Lo usan «Es un producto nuevo» (código desconocido) y 🔢 Inventario por código → 📥 Entrada de mercancía.
   • ¿Qué producto es? De la fuente más confiable a la menos:
       1) lo que ORDEVA ya aprendió de otros negocios (catálogo compartido: solo nombre, marca, tamaño y categoría;
          así ORDEVA va conociendo la canasta colombiana, códigos 770…, que las bases mundiales casi no tienen);
       2) las bases libres Open Food Facts (comida), Open Products Facts (aseo y hogar), Open Beauty Facts (belleza);
       3) con la IA del negocio, buscándolo en internet por su código (solo vale si encuentra una página con ESE código);
       4) si nadie lo conoce: «📷 Foto con IA» y la IA lo reconoce en la foto.
   • El precio y el costo los pone el dueño: ORDEVA nunca inventa precios. Al guardar, el código queda enlazado y ORDEVA
     lo aprende (para la próxima vez y para los demás negocios).
   • 📥 «¿Cuántas llegaron?»: al escanear en la entrada de mercancía pregunta la cantidad y el costo (se puede apagar).
   (No es window.ventoCodigos: ese es el lector de códigos de la cámara, lib/vento-codigos.js.)
   ===================================================================== */
(function(){
  'use strict';
  if(window.ventoProductoCodigo) return;
  var $ = function(id){ return document.getElementById(id); };
  var esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var toast = function(t, ms){ try{ showToast(t, ms || 5000); }catch(e){} };
  var D = function(){ return typeof data !== 'undefined' && data ? data : null; };
  var guardar = function(){ try{ saveData(); }catch(e){} };
  var conIA = function(){ return typeof hasAIKey === 'function' && hasAIKey() && typeof aiText === 'function'; };

  // ================= ¿Qué producto es? =================
  var cache = {};
  /* 🇨🇴 1.67.1: catálogo de productos colombianos DENTRO de ORDEVA (lib/catalogo-co.json, de Open Food Facts, Open Beauty
     Facts y Open Products Facts, licencia ODbL; se regenera con puente/catalogo-co/generar.py). Se baja una sola vez,
     cuando hace falta (no al abrir la app), y queda guardado para usarlo sin internet: el producto sale al instante. */
  var catCO = null;
  function catalogoCO(){
    if(!catCO){
      var v = ''; try{ v = String(MESORA_VERSION).split('·').pop().trim(); }catch(e){}
      catCO = fetch('lib/catalogo-co.json' + (v ? '?v=' + encodeURIComponent(v) : ''))
        .then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ catCO = null; return null; });
    }
    return catCO;
  }
  // Se deja listo en segundo plano (para que funcione sin internet desde el primer escaneo), salvo con «ahorro de datos».
  setTimeout(function(){
    try{ if(navigator.connection && navigator.connection.saveData) return; }catch(e){}
    var ir = function(){ catalogoCO(); };
    if(window.requestIdleCallback) requestIdleCallback(ir, { timeout: 30000 }); else ir();
  }, 20000);
  // El mismo producto puede leerse como UPC-A (12 cifras) o como EAN-13 con un 0 adelante (y GTIN-14 con 0).
  function variantes(cod){
    var l = [cod];
    if(cod.length === 12) l.push('0' + cod);
    if(cod.length === 13 && cod.charAt(0) === '0') l.push(cod.slice(1));
    if(cod.length === 14 && cod.charAt(0) === '0') l.push(cod.slice(1), cod.slice(2));
    return l;
  }
  function deLocal(cod){
    if(!/^\d{8,14}$/.test(cod)) return Promise.resolve(null);
    return catalogoCO().then(function(c){
      if(!c || !c.p) return null;
      var vs = variantes(cod);
      for(var i = 0; i < vs.length; i++){
        var f = c.p[vs[i]];
        if(f) return { nombre: f[0], marca: f[1] || '', tamano: f[2] || '', categoria: f[3] || '', presentacion: f[4] || '', fuente: '🇨🇴 Catálogo de productos colombianos de ORDEVA' };
      }
      return null;
    });
  }
  function nube(){ var n = window.ventoNube; return n && n.cliente && n.negocio && n.negocio() ? n : null; }
  function deCatalogo(cod){
    var n = nube(); if(!n) return Promise.resolve(null);
    return n.cliente().then(function(c){ return c.rpc('catalogo_buscar', { p_codigo: cod }); })
      .then(function(r){ var j = r && r.data; return j && j.nombre ? { nombre: j.nombre, marca: j.marca || '', tamano: j.tamano || '', categoria: j.categoria || '', fuente: '📚 ORDEVA ya lo conoce' + (j.veces > 1 ? ' (' + j.veces + ' negocios)' : '') } : null; })
      .catch(function(){ return null; });
  }
  function deBaseLibre(cod){
    if(!/^\d{8,14}$/.test(cod) || navigator.onLine === false) return Promise.resolve(null);
    var BASES = [['world.openfoodfacts.org', 'Open Food Facts'], ['world.openproductsfacts.org', 'Open Products Facts'], ['world.openbeautyfacts.org', 'Open Beauty Facts']];
    var una = function(b){
      var ctrl = window.AbortController ? new AbortController() : null, t = setTimeout(function(){ ctrl && ctrl.abort(); }, 6000);
      return fetch('https://' + b[0] + '/api/v2/product/' + encodeURIComponent(cod) + '.json?fields=product_name,product_name_es,brands,quantity,categories', ctrl ? { signal: ctrl.signal } : {})
        .then(function(r){ clearTimeout(t); return r.ok ? r.json() : null; })
        .then(function(j){
          var p = j && j.status === 1 && j.product; if(!p) return null;
          var nom = String(p.product_name_es || p.product_name || '').trim(); if(!nom) return null;
          return { nombre: nom, marca: String(p.brands || '').split(',')[0].trim(), tamano: String(p.quantity || '').trim(), categoria: String(p.categories || '').split(',').pop().trim().slice(0, 40), fuente: '🌐 ' + b[1] };
        }).catch(function(){ clearTimeout(t); return null; });
    };
    // La primera base que lo tenga responde; no se espera a las otras (null solo cuando ninguna lo tiene).
    return new Promise(function(ok){ var faltan = BASES.length; BASES.forEach(function(b){ una(b).then(function(r){ faltan--; if(r) ok(r); else if(!faltan) ok(null); }); }); });
  }
  function deIA(cod){
    if(!conIA() || navigator.onLine === false || !/^\d{8,14}$/.test(cod)) return Promise.resolve(null);
    var prompt = 'Busca en internet el producto cuyo código de barras (EAN/GTIN) es exactamente "' + cod + '".' +
      (/^770/.test(cod) ? ' Los códigos que empiezan por 770 son de productos de Colombia: busca en supermercados y tiendas colombianas (Éxito, Olímpica, Jumbo, D1, Ara, Carulla, Makro, Rappi) y en el fabricante.' : '') +
      ' Devuelve SOLO este JSON: {"encontrado": true o false, "nombre": nombre del producto como se vende en Colombia, "marca": marca, "tamano": contenido (ej. 400 ml, 500 g), "categoria": categoría corta (ej. Bebidas, Granos, Aseo), "fuente": dirección de la página donde aparece ESE código}.' +
      ' Si no encuentras una página que muestre exactamente ese código, devuelve {"encontrado": false}. No inventes nada.';
    var t = null;
    return Promise.race([
      aiText({ prompt: prompt, json: true, web: true, strictWeb: true, timeoutMs: 22000, retries: 0, oneModel: true, maxOutputTokens: 300 }),
      new Promise(function(_, no){ t = setTimeout(function(){ no(new Error('tarde')); }, 25000); })
    ]).then(function(txt){
      clearTimeout(t);
      var j = typeof cleanAiJsonText === 'function' ? cleanAiJsonText(txt) : JSON.parse(txt);
      if(!j || j.encontrado !== true || !String(j.nombre || '').trim() || !/^https?:\/\//i.test(String(j.fuente || ''))) return null;
      return { nombre: String(j.nombre).trim().slice(0, 100), marca: String(j.marca || '').trim().slice(0, 50), tamano: String(j.tamano || '').trim().slice(0, 30), categoria: String(j.categoria || '').trim().slice(0, 40), fuente: '🤖 IA (encontrado en internet) — revísalo', url: String(j.fuente) };
    }).catch(function(){ clearTimeout(t); return null; });
  }
  function buscar(cod, avance){
    cod = String(cod || '').trim(); if(!cod) return Promise.resolve(null);
    if(cache[cod] !== undefined) return Promise.resolve(cache[cod]);
    var paso = function(t){ try{ avance && avance(t); }catch(e){} };
    paso('🔎 Buscando qué producto es…');
    return deLocal(cod).then(function(r0){
      if(r0) return r0;
      return deCatalogo(cod);
    }).then(function(r){
      if(r) return r;
      paso('🌐 Buscando en las bases de productos…');
      return deBaseLibre(cod).then(function(r2){
        if(r2) return r2;
        if(conIA()) paso('🤖 La IA lo está buscando en internet por su código…');
        return deIA(cod);
      });
    }).then(function(r){ if(r) cache[cod] = r; return r; });
  }
  // ORDEVA aprende el código: solo nombre, marca, tamaño y categoría (nunca precios ni existencias).
  function aportar(cod, p, extra){
    var n = nube(); cod = String(cod || '').trim();
    if(!n || !p || !/^[0-9A-Za-z-]{6,40}$/.test(cod)) return;
    var cat = ''; try{ var c = ((D() || {}).categories || []).find(function(x){ return x.id === p.categoryId; }); cat = c ? c.name : ''; }catch(e){}
    n.cliente().then(function(c){ return c.rpc('catalogo_aportar', { p_codigo: cod, p_nombre: String(p.name || '').slice(0, 120), p_marca: (extra && extra.marca) || null, p_tamano: p.size || (extra && extra.tamano) || null, p_categoria: cat || (extra && extra.categoria) || null }); }).catch(function(){});
    cache[cod] = { nombre: p.name, marca: (extra && extra.marca) || '', tamano: p.size || '', categoria: cat, fuente: '📚 ORDEVA ya lo conoce' };
  }

  // ================= Ventanas =================
  function hoja(id){
    var ov = $(id);
    if(!ov){ ov = document.createElement('div'); ov.id = id; ov.className = 'overlay'; ov.setAttribute('data-novocab', ''); ov.style.zIndex = '10040'; }
    document.body.appendChild(ov);
    return ov;
  }
  function refrescar(){ try{ renderInventario(); }catch(e){} try{ renderProductos(); }catch(e){} try{ refreshProductSelect(); }catch(e){} try{ invBadge(); }catch(e){} }

  /* 🆕 Ficha del producto nuevo, llena sola. o = { nombre (lo que ya se escribió), cantidad (si es entrada de mercancía),
     conCantidad (mostrar «¿Cuántas llegaron?») }. Devuelve { p, cantidad } o null. */
  function ficha(cod, o){
    o = o || {};
    // Crear productos (y ponerles precio) es del dueño o de quien tenga ese permiso (Ajustes → Equipo).
    try{ if(window.ventoRoles && !window.ventoRoles.puede('productos')){ toast('Crear productos lo hace el dueño (o quien tenga ese permiso).'); return Promise.resolve(null); } }catch(e){}
    return new Promise(function(ok){
      var ov = hoja('pcFichaOv'), d = D(), cats = (d && d.categories) || [];
      var colombiano = /^770\d{10}$/.test(cod);
      ov.innerHTML = '<div class="modal" style="max-width:440px;width:100%"><h2>🆕 Producto nuevo</h2>' +
        '<div class="modal-sub">Código ' + esc(cod) + (colombiano ? ' · 🇨🇴 producto colombiano' : '') + '</div>' +
        '<div id="pcEst" style="margin:8px 0;font-weight:700">🔎 Buscando qué producto es…</div>' +
        '<label class="pc-l">Nombre<input id="pcNom" autocomplete="off" placeholder="Ej. Gaseosa Colombiana 400 ml" value="' + esc(o.nombre || '') + '"></label>' +
        '<div class="pc-dos"><label class="pc-l">Contenido<input id="pcTam" autocomplete="off" placeholder="Ej. 400 ml, 500 g"></label>' +
        '<label class="pc-l">Presentación<input id="pcPres" autocomplete="off" placeholder="Ej. Botella, Bolsa, Lata"></label></div>' +
        '<label class="pc-l">Categoría<select id="pcCat"><option value="">Sin categoría</option>' + cats.map(function(c){ return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>'; }).join('') + '</select></label>' +
        '<label class="pc-l">Precio de venta<input type="number" id="pcPre" min="0" step="50" inputmode="numeric" placeholder="¿A cuánto lo vendes?"></label>' +
        '<label class="pc-l">Costo (lo que te cuesta)<input type="number" id="pcCos" min="0" step="50" inputmode="numeric" placeholder="Opcional"></label>' +
        (o.conCantidad ? '<label class="pc-l">¿Cuántas llegaron?<input type="number" id="pcCan" min="0" step="1" inputmode="numeric" value="' + esc(o.cantidad || 1) + '"></label>' : '') +
        '<button type="button" class="btn-ghost" id="pcFoto" style="width:100%;margin-top:10px">📷 Foto con IA (para que lo reconozca)</button><input type="file" id="pcFotoIn" accept="image/*" capture="environment" hidden>' +
        '<div class="modal-actions"><button type="button" class="btn-close" data-x>Ahora no</button><button type="button" class="btn-primary" data-ok>Guardar</button></div></div>';
      ov.classList.add('show');
      var est = ov.querySelector('#pcEst'), nom = ov.querySelector('#pcNom'), tam = ov.querySelector('#pcTam'), cat = ov.querySelector('#pcCat'), pres = ov.querySelector('#pcPres');
      var abierto = true, extra = {};
      var llenar = function(info){
        if(!info || !abierto) return;
        var nombre = [info.marca && String(info.nombre).toLowerCase().indexOf(String(info.marca).toLowerCase()) < 0 ? info.marca : '', info.nombre].filter(Boolean).join(' ').trim();
        if(!nom.value.trim() && nombre) nom.value = nombre;
        if(!tam.value.trim() && info.tamano) tam.value = info.tamano;
        if(!pres.value.trim() && info.presentacion) pres.value = info.presentacion;
        if(!cat.value && info.categoria){
          var sinT = function(x){ return String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim(); };
          var c = cats.find(function(x){ return sinT(x.name) === sinT(info.categoria); });
          if(c) cat.value = c.id;
          else {   // 🆕 la categoría del producto todavía no existe en el negocio: se propone y se crea al guardar
            var op = document.createElement('option'); op.value = 'nueva:' + String(info.categoria).slice(0, 40); op.textContent = '🆕 ' + String(info.categoria).slice(0, 40) + ' (nueva, se crea al guardar)';
            cat.appendChild(op); cat.value = op.value;
          }
        }
        extra = { marca: info.marca || '', tamano: info.tamano || '', categoria: info.categoria || '' };
        est.textContent = '✅ ' + (info.fuente || 'Encontrado') + '. Revisa y pon el precio.';
        setTimeout(function(){ try{ ov.querySelector('#pcPre').focus(); }catch(e){} }, 50);
      };
      ov.querySelector('#pcFoto').hidden = !conIA();
      buscar(cod, function(t){ if(abierto) est.textContent = t; }).then(function(info){
        if(!abierto) return;
        if(info) llenar(info);
        else { est.textContent = conIA() ? '📷 No lo encontré por el código: tómale una foto («📷 Foto con IA») o escríbelo.' : 'No lo encontré por el código: escribe el nombre. (Con la IA configurada, una foto lo reconoce sola.)'; try{ nom.focus(); }catch(e){} }
      });
      ov.querySelector('#pcFoto').onclick = function(){ ov.querySelector('#pcFotoIn').click(); };
      ov.querySelector('#pcFotoIn').onchange = function(){
        var f = this.files && this.files[0]; this.value = ''; if(!f || typeof recognizeProductWithAI !== 'function') return;
        est.textContent = '🤖 La IA está mirando la foto…';
        Promise.resolve(typeof scalePhotoForAI === 'function' ? scalePhotoForAI(f, 640, 0.7) : null).then(function(url){
          if(!url) throw new Error('foto');
          return recognizeProductWithAI(url, function(t){ if(abierto) est.textContent = '🤖 ' + t; });
        }).then(function(info){
          if(!info || !(info.name || info.brand)){ est.textContent = 'La IA no lo reconoció: acércate a la etiqueta con buena luz, o escríbelo.'; return; }
          llenar({ nombre: info.name || '', marca: info.brand || '', tamano: info.size ? (info.size + (info.unit ? ' ' + info.unit : '')) : '', categoria: info.category || '', fuente: '🤖 Reconocido en la foto por la IA — revísalo' });
        }).catch(function(e){ est.textContent = 'La IA no pudo leer la foto (' + (e && e.message || e) + '). Escríbelo.'; });
      };
      var cerrar = function(r){ abierto = false; ov.classList.remove('show'); ok(r); };
      ov.querySelector('[data-x]').onclick = function(){ cerrar(null); };
      ov.querySelector('[data-ok]').onclick = function(){
        var nombre = nom.value.trim().replace(/\s+/g, ' '), precio = Math.round(+ov.querySelector('#pcPre').value || 0);
        if(nombre.length < 2){ toast('Escribe el nombre del producto.'); nom.focus(); return; }
        if(!(precio > 0)){ toast('Escribe el precio de venta.'); ov.querySelector('#pcPre').focus(); return; }
        var dd = D(); if(!dd) return;
        var costo = Math.round(+ov.querySelector('#pcCos').value || 0), cn = ov.querySelector('#pcCan');
        var catId = cat.value || null;
        if(catId && catId.indexOf('nueva:') === 0){
          var nc = catId.slice(6).trim(); catId = null;
          if(nc){ try{ catId = typeof fiCrearCategoria === 'function' ? fiCrearCategoria(nc) : null; }catch(e){ catId = null; }
            if(!catId){ dd.categories = dd.categories || []; catId = Date.now().toString(36) + Math.random().toString(36).slice(2, 5); dd.categories.push({ id: catId, name: nc }); } }
        }
        var p = { id: Date.now().toString() + Math.random().toString(36).slice(2, 5), name: nombre, price: precio, categoryId: catId, size: tam.value.trim(),
          specifications: 'Código: ' + cod, stock: 0, cost: costo > 0 ? costo : null, barcodes: [cod], codigo: cod };
        if(pres.value.trim()) p.presentacion = pres.value.trim().slice(0, 40);
        if(extra.marca) p.marca = String(extra.marca).slice(0, 50);
        dd.products.push(p);
        try{ window.ventoAuditar && window.ventoAuditar('producto creado', nombre + ' · código ' + cod); }catch(e){}
        guardar(); refrescar(); aportar(cod, p, extra);
        toast('✅ ' + nombre + ' quedó en tus productos con su código.');
        cerrar({ p: p, cantidad: cn ? Math.max(0, parseInt(cn.value, 10) || 0) : null });
      };
    });
  }

  /* 📥 ¿Cuántas llegaron? Devuelve { n, costo } o null. */
  function llego(p, n){
    return new Promise(function(ok){
      var ov = hoja('pcLlegoOv');
      ov.innerHTML = '<div class="modal" style="max-width:400px;width:100%"><h2>📥 Llegó: ' + esc(p.name) + '</h2>' +
        '<div class="modal-sub">Hay ' + esc(p.stock == null ? 'sin contar' : p.stock) + (p.cost ? ' · costo ' + esc(Math.round(p.cost).toLocaleString('es-CO')) : '') + '</div>' +
        '<label class="pc-l">¿Cuántas llegaron?<input type="number" id="pcN" min="1" step="1" inputmode="numeric" value="' + (n || 1) + '"></label>' +
        '<label class="pc-l">Costo de cada una (si cambió)<input type="number" id="pcC" min="0" step="50" inputmode="numeric" placeholder="' + esc(p.cost || '') + '"></label>' +
        '<label style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" id="pcPreg" style="width:auto"' + (preguntar() ? ' checked' : '') + '> Preguntar cada vez (si lo quitas, cada lectura suma 1)</label>' +
        '<div class="modal-actions"><button type="button" class="btn-close" data-x>No sumar</button><button type="button" class="btn-primary" data-ok>Sumar a la entrada</button></div></div>';
      ov.classList.add('show');
      var i = ov.querySelector('#pcN'); setTimeout(function(){ try{ i.focus(); i.select(); }catch(e){} }, 50);
      var fin = function(v){ preguntar(ov.querySelector('#pcPreg').checked); ov.classList.remove('show'); ok(v); };
      ov.querySelector('[data-x]').onclick = function(){ fin(null); };
      ov.querySelector('[data-ok]').onclick = function(){
        var v = parseInt(i.value, 10); if(!(v > 0)){ toast('Escribe cuántas llegaron.'); return; }
        var c = Math.round(+ov.querySelector('#pcC').value || 0);
        fin({ n: v, costo: c > 0 ? c : null });
      };
      i.onkeydown = function(e){ if(e.key === 'Enter') ov.querySelector('[data-ok]').click(); };
    });
  }
  function preguntar(v){
    if(v === undefined){ try{ return localStorage.getItem('vento_entrada_preguntar') !== '0'; }catch(e){ return true; } }
    try{ localStorage.setItem('vento_entrada_preguntar', v ? '1' : '0'); }catch(e){}
    return !!v;
  }
  var css = document.createElement('style');
  css.textContent = '.pc-l{display:block;margin-top:8px;font-weight:700;font-size:14px}.pc-l input,.pc-l select{display:block;width:100%;margin-top:4px}.pc-dos{display:grid;grid-template-columns:1fr 1fr;gap:8px}';
  document.head.appendChild(css);
  window.ventoProductoCodigo = { local: deLocal, catalogo: catalogoCO, buscar: buscar, aportar: aportar, ficha: ficha, llego: llego, preguntar: preguntar, deCatalogo: deCatalogo, deBaseLibre: deBaseLibre, deIA: deIA };
})();
