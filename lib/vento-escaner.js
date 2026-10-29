/* =====================================================================
   ORDEVA 1.65.0 · 📱 Escanear con otro celular (escáner remoto) + reconocer productos por su código
   • «📱 Escanear con otro celular» muestra un QR. El otro celular lo lee con su cámara, se abre escaner.html (sin
     iniciar sesión) y cada código que lee llega AQUÍ al instante por el canal en vivo de ORDEVA (canal nuevo y privado
     cada vez). Lo leído se manda en orden y se reintenta solo si se cae la señal: no se pierde ninguno.
   • 🛒 Vender: el producto va a la cuenta abierta o, si no hay una abierta, a la caja.
     📥 Llegó mercancía: pregunta cuántas llegaron (y el costo) y suma al inventario, con su anotación en el kárdex.
   • Código que no está en tus productos: se abre la ficha del producto nuevo YA LLENA, buscando su nombre en:
       1) lo que ORDEVA ya aprendió de otros negocios (catálogo compartido: solo nombre, marca, tamaño y categoría);
       2) las bases libres Open Food Facts / Open Products Facts / Open Beauty Facts;
       3) con la IA del negocio, buscándolo en internet por su código (solo si encuentra una página con ESE código);
       4) si nada lo conoce: el celular pide una foto del producto y la IA lo reconoce.
     El precio y el costo los pones tú (ORDEVA nunca inventa precios). Al guardar, el código queda enlazado y ORDEVA
     lo aprende para la próxima vez (y para los demás negocios).
   ===================================================================== */
(function(){
  'use strict';
  if(window.ventoEscaner) return;
  var $ = function(id){ return document.getElementById(id); };
  var esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var plata = function(n){ try{ return fmt(n); }catch(e){ return '$' + Math.round(+n || 0).toLocaleString('es-CO'); } };
  var toast = function(t, ms){ try{ showToast(t, ms || 5000); }catch(e){} };
  var D = function(){ return typeof data !== 'undefined' && data ? data : null; };
  var guardar = function(){ try{ saveData(); }catch(e){} };
  var puede = function(p){ try{ return !window.ventoRoles || window.ventoRoles.puede(p); }catch(e){ return true; } };
  var URL_APP = 'https://cristhianlujan45-blip.github.io/ORDEVA/';

  // ================= Reconocer un producto por su código =================
  var cache = {};
  function nube(){ var n = window.ventoNube; return n && n.cliente && n.negocio && n.negocio() ? n : null; }
  function deCatalogo(cod){
    var n = nube(); if(!n) return Promise.resolve(null);
    return n.cliente().then(function(c){ return c.rpc('catalogo_buscar', { p_codigo: cod }); })
      .then(function(r){ var j = r && r.data; return j && j.nombre ? { nombre: j.nombre, marca: j.marca || '', tamano: j.tamano || '', categoria: j.categoria || '', fuente: '📚 ORDEVA ya lo conoce' + (j.veces > 1 ? ' (' + j.veces + ' negocios)' : '') } : null; })
      .catch(function(){ return null; });
  }
  // Las bases libres: comida (Open Food Facts), aseo y hogar (Open Products Facts), belleza (Open Beauty Facts).
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
    return Promise.all(BASES.map(una)).then(function(l){ return l.filter(Boolean)[0] || null; });
  }
  // Con la IA del negocio, buscándolo en internet por su código. Solo vale si encontró una página con ESE código.
  function deIA(cod){
    if(typeof hasAIKey !== 'function' || !hasAIKey() || typeof aiText !== 'function' || navigator.onLine === false || !/^\d{8,14}$/.test(cod)) return Promise.resolve(null);
    var prompt = 'Busca en internet el producto cuyo código de barras (EAN/GTIN) es exactamente "' + cod + '".' +
      (/^770/.test(cod) ? ' Los códigos que empiezan por 770 son de productos de Colombia: busca en supermercados y tiendas colombianas (Éxito, Olímpica, Jumbo, D1, Ara, Carulla, Makro, Rappi) y en el fabricante.' : '') +
      ' Devuelve SOLO este JSON: {"encontrado": true o false, "nombre": nombre del producto como se vende en Colombia, "marca": marca, "tamano": contenido (ej. 400 ml, 500 g), "categoria": categoría corta (ej. Bebidas, Granos, Aseo), "fuente": dirección de la página donde aparece ESE código}.' +
      ' Si no encuentras una página que muestre exactamente ese código, devuelve {"encontrado": false}. No inventes nada.';
    var t = setTimeout(function(){}, 0);
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
  // Lo que se sabe de un código, de la fuente más confiable a la menos. avance(texto) cuenta en qué va.
  function buscar(cod, avance){
    cod = String(cod || '').trim(); if(!cod) return Promise.resolve(null);
    if(cache[cod] !== undefined) return Promise.resolve(cache[cod]);
    var paso = function(t){ try{ avance && avance(t); }catch(e){} };
    paso('🔎 Buscando qué producto es…');
    return deCatalogo(cod).then(function(r){
      if(r) return r;
      paso('🌐 Buscando en las bases de productos…');
      return deBaseLibre(cod).then(function(r2){
        if(r2) return r2;
        if(typeof hasAIKey === 'function' && hasAIKey()) paso('🤖 La IA lo está buscando en internet por su código…');
        return deIA(cod);
      });
    }).then(function(r){ if(r) cache[cod] = r; return r; });
  }
  // ORDEVA aprende el código (solo nombre, marca, tamaño y categoría) para la próxima vez y para los demás negocios.
  function aportar(cod, p, extra){
    var n = nube(); cod = String(cod || '').trim();
    if(!n || !p || !/^[0-9A-Za-z-]{6,40}$/.test(cod) || /^\d{4}$/.test(cod)) return;
    var cat = ''; try{ var c = (D().categories || []).find(function(x){ return x.id === p.categoryId; }); cat = c ? c.name : ''; }catch(e){}
    n.cliente().then(function(c){ return c.rpc('catalogo_aportar', { p_codigo: cod, p_nombre: String(p.name || '').slice(0, 120), p_marca: (extra && extra.marca) || null, p_tamano: p.size || (extra && extra.tamano) || null, p_categoria: cat || (extra && extra.categoria) || null }); }).catch(function(){});
    cache[cod] = { nombre: p.name, marca: (extra && extra.marca) || '', tamano: p.size || '', categoria: cat, fuente: '📚 ORDEVA ya lo conoce' };
  }
  window.ventoCodigos = { buscar: buscar, aportar: aportar, deCatalogo: deCatalogo, deBaseLibre: deBaseLibre, deIA: deIA };

  // ================= Sesión del escáner remoto =================
  var S = null;   // { canal, es, modo, vistos, n, preguntar, cola[], ocupado, fichas{} }
  function token(){ var a = new Uint8Array(18); (window.crypto || window.msCrypto).getRandomValues(a); return Array.from(a, function(b){ return ('0' + b.toString(36)).slice(-2); }).join('').slice(0, 28); }
  // La misma carpeta de esta página (GitHub Pages o el APK, que abre la misma dirección); si no es una página web, la de siempre.
  function base(){ return /^https?:$/.test(location.protocol) ? location.origin + location.pathname.replace(/[^/]*$/, '') : URL_APP; }
  function link(){ return base() + 'escaner.html#c=' + S.canal + '&m=' + S.modo + '&n=' + encodeURIComponent((D() && D().businessName) || 'ORDEVA'); }
  function responder(r, o){ if(!S) return; try{ fetch('https://canal.vento.local/' + S.canal, { method: 'POST', body: JSON.stringify(Object.assign({ k: 'ack', r: r }, o)) }).catch(function(){}); }catch(e){} }

  function abrir(modo){
    if(S){ S.modo = modo || S.modo; panel(); return; }
    S = { canal: 'esc-' + token(), modo: modo === 'inventario' ? 'inventario' : 'vender', vistos: {}, n: 0, preguntar: true, cola: [], ocupado: false, fichas: {}, ult: [] };
    try{
      S.es = new EventSource('https://canal.vento.local/' + S.canal + '/sse?rapido=1&since=' + Math.floor(Date.now() / 1000 - 5));
      S.es.onmessage = function(e){ var m = null; try{ m = JSON.parse(JSON.parse(e.data).message); }catch(x){ return; } recibir(m); };
    }catch(e){ toast('No se pudo abrir el canal en vivo: revisa el internet.'); }
    panel();
  }
  function terminar(){
    if(!S) return;
    responder('*', { fin: true });
    try{ S.es && S.es.close(); }catch(e){}
    S = null; var ov = $('escRemOv'); if(ov) ov.classList.remove('show'); pastilla();
    toast('📱 Escáner del otro celular desconectado.');
  }
  function recibir(m){
    if(!S || !m || !m.id || S.vistos[m.id]) return;
    if(m.k === 'cod' && m.c){ S.vistos[m.id] = 1; S.n++; S.cola.push(m); pastilla(); siguiente(); }
    else if(m.k === 'foto' && m.r && m.img){ S.vistos[m.id] = 1; var f = S.fichas[m.r]; if(f && f.foto) f.foto(m.img); }
  }
  // De a uno: si se abre una ficha o la pregunta de cuántas llegaron, lo siguiente espera su turno.
  function siguiente(){
    if(!S || S.ocupado || !S.cola.length) return;
    S.ocupado = true;
    var m = S.cola.shift();
    Promise.resolve().then(function(){ return procesar(m); }).catch(function(e){ responder(m.id, { ok: false, txt: 'No se pudo: ' + (e && e.message || e) }); })
      .then(function(){ if(S){ S.ocupado = false; pintarLista(); siguiente(); } });
  }
  function anotarLista(txt){ if(!S) return; S.ult.unshift(txt); S.ult = S.ult.slice(0, 8); pintarLista(); }

  function porCodigo(cod){
    var p = null;
    try{ p = window.ventoInventario ? window.ventoInventario.buscar(cod) : null; }catch(e){}
    if(!p) try{ p = typeof findProductByScannedCode === 'function' ? findProductByScannedCode(cod) : null; }catch(e){}
    return p;
  }
  async function procesar(m){
    var cod = String(m.c).trim(), q = Math.max(1, Math.min(99, parseInt(m.q, 10) || 1)), modo = m.m === 'inventario' ? 'inventario' : 'vender';
    var p = porCodigo(cod);
    if(modo === 'vender'){
      if(!p){
        if(!puede('productos')){ responder(m.id, { ok: false, txt: 'Ese código no está en los productos. Pídele al administrador que lo cree.' }); anotarLista('⚠️ ' + cod + ': no está en los productos'); return; }
        p = await ficha(m, cod, q, 'vender'); if(!p) return;
      }
      var donde = vender(p, q);
      responder(m.id, { ok: !!donde, nombre: p.name, txt: donde ? (q > 1 ? q + ' × ' : '') + plata(p.price) + ' · ' + donde : 'Abre una cuenta o la caja en ORDEVA' });
      anotarLista((donde ? '🛒 ' : '⚠️ ') + (q > 1 ? q + ' × ' : '') + p.name + (donde ? ' → ' + donde : ''));
      return;
    }
    // 📥 Llegó mercancía
    if(!puede('inventario')){ responder(m.id, { ok: false, txt: 'Tu usuario no tiene permiso para el inventario.' }); return; }
    if(!p){
      if(!puede('productos')){ responder(m.id, { ok: false, txt: 'Ese código no está en los productos. Pídele al administrador que lo cree.' }); return; }
      p = await ficha(m, cod, q, 'inventario'); if(!p) return;
      responder(m.id, { ok: true, nombre: p.name, txt: '🆕 Creado' + (p.stock != null ? ' · hay ' + p.stock : '') });
      anotarLista('🆕 ' + p.name + (p.stock != null ? ' · hay ' + p.stock : ''));
      return;
    }
    var r = S.preguntar ? await llego(m, p, q) : { n: q };
    if(!r){ responder(m.id, { ok: false, nombre: p.name, txt: 'No se sumó (lo cancelaron en la caja)' }); return; }
    sumar(p, r.n, r.costo, r.precio);
    responder(m.id, { ok: true, nombre: p.name, txt: '+' + r.n + ' · ahora hay ' + p.stock });
    anotarLista('📥 +' + r.n + ' ' + p.name + ' · hay ' + p.stock);
  }
  // ¿A dónde va lo vendido? A la cuenta abierta (si hay una), si no a la caja.
  function vender(p, q){
    var ov = $('overlay');
    if(ov && ov.classList.contains('show') && typeof currentTable !== 'undefined' && currentTable != null && typeof addFavoriteToTable === 'function'){
      for(var i = 0; i < q; i++) addFavoriteToTable(p.id);
      try{ return tableLabel(currentTable); }catch(e){ return 'la cuenta'; }
    }
    var P = window.ventoPOS;
    if(P && P.agregar){
      try{ var co = $('pzCajaOv'); if(!(co && co.classList.contains('show')) && !(($('posPanel') || {}).offsetParent)) P.abrirCaja(); }catch(e){}
      return P.agregar(p.id, q) ? 'la caja' : null;
    }
    return null;
  }
  function sumar(p, n, costo, precio){
    p.stock = (p.stock == null ? 0 : +p.stock) + n;
    if(costo > 0) p.cost = costo;
    if(precio > 0) p.price = precio;
    try{ window.ventoInventario && window.ventoInventario.anotar(p, 'entrada', n, 'Llegó (escáner del otro celular)', costo > 0 ? costo : null); }catch(e){}
    try{ window.ventoAuditar && window.ventoAuditar('llegó mercancía', p.name + ': +' + n); }catch(e){}
    guardar(); refrescar();
  }
  function refrescar(){
    try{ renderInventario(); }catch(e){} try{ renderProductos(); }catch(e){} try{ refreshProductSelect(); }catch(e){} try{ invBadge(); }catch(e){}
  }

  // ================= Ventanas =================
  function hoja(id){
    var ov = $(id);
    if(!ov){ ov = document.createElement('div'); ov.id = id; ov.className = 'overlay'; ov.setAttribute('data-novocab', ''); ov.style.zIndex = '10040'; }
    document.body.appendChild(ov);
    return ov;
  }
  // 📥 ¿Cuántas llegaron?
  function llego(m, p, q){
    return new Promise(function(ok){
      var ov = hoja('escLlegoOv');
      ov.innerHTML = '<div class="modal" style="max-width:400px;width:100%"><h2>📥 Llegó: ' + esc(p.name) + '</h2>' +
        '<div class="modal-sub">Hay ' + esc(p.stock == null ? 'sin contar' : p.stock) + ' · código ' + esc(m.c) + '</div>' +
        '<label class="esc-l">¿Cuántas llegaron?<input type="number" id="escN" min="1" step="1" inputmode="numeric" value="' + q + '"></label>' +
        '<label class="esc-l">Costo de cada una (si cambió)<input type="number" id="escC" min="0" step="50" inputmode="numeric" placeholder="' + esc(p.cost || '') + '"></label>' +
        '<label class="esc-l">Precio de venta<input type="number" id="escP" min="0" step="50" inputmode="numeric" placeholder="' + esc(p.price || '') + '"></label>' +
        '<label style="display:flex;gap:8px;align-items:center;margin-top:8px"><input type="checkbox" id="escPreg" style="width:auto"' + (S && S.preguntar ? ' checked' : '') + '> Preguntar cada vez (si lo quitas, cada lectura suma lo que diga el celular)</label>' +
        '<div class="modal-actions"><button type="button" class="btn-close" data-x>No sumar</button><button type="button" class="btn-primary" data-ok>Sumar al inventario</button></div></div>';
      ov.classList.add('show');
      var n = ov.querySelector('#escN'); setTimeout(function(){ try{ n.focus(); n.select(); }catch(e){} }, 50);
      var fin = function(v){ if(S) S.preguntar = ov.querySelector('#escPreg').checked; ov.classList.remove('show'); ok(v); };
      ov.querySelector('[data-x]').onclick = function(){ fin(null); };
      ov.querySelector('[data-ok]').onclick = function(){
        var v = parseInt(n.value, 10); if(!(v > 0)){ toast('Escribe cuántas llegaron.'); return; }
        fin({ n: v, costo: Math.round(+ov.querySelector('#escC').value || 0), precio: Math.round(+ov.querySelector('#escP').value || 0) });
      };
      n.onkeydown = function(e){ if(e.key === 'Enter') ov.querySelector('[data-ok]').click(); };
    });
  }
  // 🆕 Ficha del producto nuevo, llena sola con lo que se encuentre de su código.
  function ficha(m, cod, q, modo){
    return new Promise(function(ok){
      var ov = hoja('escFichaOv'), d = D(), cats = (d && d.categories) || [];
      var colombiano = /^770\d{10}$/.test(cod);
      ov.innerHTML = '<div class="modal" style="max-width:440px;width:100%"><h2>🆕 Producto nuevo</h2>' +
        '<div class="modal-sub">Código ' + esc(cod) + (colombiano ? ' · 🇨🇴 producto colombiano' : '') + '</div>' +
        '<div class="esc-est" id="escEst" style="margin:8px 0;font-weight:700">🔎 Buscando qué producto es…</div>' +
        '<label class="esc-l">Nombre<input id="escNom" autocomplete="off" placeholder="Ej. Gaseosa Colombiana 400 ml"></label>' +
        '<label class="esc-l">Tamaño / presentación<input id="escTam" autocomplete="off" placeholder="Ej. 400 ml"></label>' +
        '<label class="esc-l">Categoría<select id="escCat"><option value="">Sin categoría</option>' + cats.map(function(c){ return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>'; }).join('') + '</select></label>' +
        '<label class="esc-l">Precio de venta<input type="number" id="escPre" min="0" step="50" inputmode="numeric" placeholder="¿A cuánto lo vendes?"></label>' +
        '<label class="esc-l">Costo (lo que te cuesta)<input type="number" id="escCos" min="0" step="50" inputmode="numeric" placeholder="Opcional"></label>' +
        '<label class="esc-l">' + (modo === 'inventario' ? '¿Cuántas llegaron?' : 'Cuántas hay en el inventario (opcional)') + '<input type="number" id="escCan" min="0" step="1" inputmode="numeric" value="' + (modo === 'inventario' ? q : '') + '"></label>' +
        '<div class="modal-actions"><button type="button" class="btn-close" data-x>Ahora no</button><button type="button" class="btn-primary" data-ok>' + (modo === 'vender' ? 'Guardar y vender' : 'Guardar') + '</button></div></div>';
      ov.classList.add('show');
      var est = ov.querySelector('#escEst'), nom = ov.querySelector('#escNom'), tam = ov.querySelector('#escTam'), cat = ov.querySelector('#escCat');
      var abierto = true, extra = {};
      var llenar = function(info){
        if(!info || !abierto) return;
        var nombre = [info.marca && String(info.nombre).toLowerCase().indexOf(String(info.marca).toLowerCase()) < 0 ? info.marca : '', info.nombre].filter(Boolean).join(' ').trim();
        if(!nom.value.trim() && nombre) nom.value = nombre;
        if(!tam.value.trim() && info.tamano) tam.value = info.tamano;
        if(!cat.value && info.categoria){ var c = cats.find(function(x){ return String(x.name).toLowerCase() === String(info.categoria).toLowerCase(); }); if(c) cat.value = c.id; }
        extra = { marca: info.marca || '', tamano: info.tamano || '', categoria: info.categoria || '' };
        est.textContent = '✅ ' + (info.fuente || 'Encontrado') + '. Revisa y pon el precio.';
        if(nombre) setTimeout(function(){ try{ ov.querySelector('#escPre').focus(); }catch(e){} }, 50);
      };
      buscar(cod, function(t){ if(abierto) est.textContent = t; }).then(function(info){
        if(!abierto) return;
        if(info){ llenar(info); responder(m.id, { ok: true, nuevo: true, nombre: info.nombre, txt: 'Producto nuevo: completa el precio en la caja' }); }
        else {
          var ia = typeof hasAIKey === 'function' && hasAIKey();
          est.textContent = ia ? '📷 No lo encontré por el código. Tómale una foto desde el otro celular (botón «📷 Foto del producto») y la IA lo reconoce, o escríbelo.' : 'No lo encontré por el código: escribe el nombre. (Con la IA configurada, una foto lo reconoce sola.)';
          responder(m.id, { ok: true, nuevo: true, pideFoto: ia, txt: ia ? 'Producto nuevo: toma una foto para que la IA lo reconozca' : 'Producto nuevo: escríbelo en la caja' });
          try{ nom.focus(); }catch(e){}
        }
      });
      // 📷 La foto que manda el otro celular: la IA la reconoce.
      S.fichas[m.id] = { foto: function(img){
        if(!abierto) return;
        if(typeof recognizeProductWithAI !== 'function' || typeof hasAIKey !== 'function' || !hasAIKey()){ est.textContent = 'Llegó la foto, pero la IA no está configurada (Productos → ⚙️ Configurar IA).'; return; }
        est.textContent = '🤖 La IA está mirando la foto…';
        recognizeProductWithAI(img, function(t){ if(abierto) est.textContent = '🤖 ' + t; }).then(function(info){
          if(!info || !(info.name || info.brand)){ est.textContent = 'La IA no lo reconoció: acércate a la etiqueta con buena luz, o escríbelo.'; return; }
          llenar({ nombre: info.name || '', marca: info.brand || '', tamano: info.size ? (info.size + (info.unit ? ' ' + info.unit : '')) : '', categoria: info.category || '', fuente: '🤖 Reconocido en la foto por la IA — revísalo' });
          responder(m.id, { ok: true, nuevo: true, nombre: nom.value, txt: 'La IA lo reconoció: completa el precio en la caja' });
        }).catch(function(e){ est.textContent = 'La IA no pudo leer la foto (' + (e && e.message || e) + '). Escríbelo.'; });
      } };
      var cerrar = function(p){ abierto = false; delete S.fichas[m.id]; ov.classList.remove('show'); ok(p); };
      ov.querySelector('[data-x]').onclick = function(){ responder(m.id, { ok: false, txt: 'No se creó (lo dejaron para después)' }); cerrar(null); };
      ov.querySelector('[data-ok]').onclick = function(){
        var nombre = nom.value.trim().replace(/\s+/g, ' '), precio = Math.round(+ov.querySelector('#escPre').value || 0);
        if(nombre.length < 2){ toast('Escribe el nombre del producto.'); nom.focus(); return; }
        if(!(precio > 0)){ toast('Escribe el precio de venta.'); ov.querySelector('#escPre').focus(); return; }
        var dd = D(); if(!dd) return;
        var ya = porCodigo(cod); if(ya){ cerrar(ya); return; }
        var can = ov.querySelector('#escCan').value, costo = Math.round(+ov.querySelector('#escCos').value || 0);
        var p = { id: Date.now().toString() + Math.random().toString(36).slice(2, 5), name: nombre, price: precio, categoryId: cat.value || null, size: tam.value.trim(),
          specifications: 'Código: ' + cod, stock: can === '' ? null : Math.max(0, parseInt(can, 10) || 0), cost: costo > 0 ? costo : null, barcodes: [cod], codigo: cod };
        dd.products.push(p);
        try{ if(p.stock) window.ventoInventario && window.ventoInventario.anotar(p, 'entrada', p.stock, 'Producto nuevo (escáner)', p.cost); }catch(e){}
        try{ window.ventoAuditar && window.ventoAuditar('producto creado (escáner)', nombre + ' · ' + cod); }catch(e){}
        guardar(); refrescar(); aportar(cod, p, extra);
        toast('✅ ' + nombre + ' quedó en tus productos con su código.');
        cerrar(p);
      };
    });
  }

  // ================= El panel con el QR y la pastilla de «escáner conectado» =================
  function panel(){
    if(!S) return;
    var ov = hoja('escRemOv');
    ov.innerHTML = '<div class="modal" style="max-width:440px;width:100%"><h2>📱 Escanear con otro celular</h2>' +
      '<div class="modal-sub">Abre la cámara del otro celular y lee este QR. Lo que escanee llega aquí al instante.</div>' +
      '<div class="esc-modos" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0">' +
        '<button type="button" class="btn-ghost' + (S.modo === 'vender' ? ' on' : '') + '" data-m="vender" style="min-height:52px;font-weight:800' + (S.modo === 'vender' ? ';border-color:var(--amber)' : '') + '">🛒 Vender</button>' +
        '<button type="button" class="btn-ghost' + (S.modo === 'inventario' ? ' on' : '') + '" data-m="inventario" style="min-height:52px;font-weight:800' + (S.modo === 'inventario' ? ';border-color:var(--amber)' : '') + '">📥 Llegó mercancía</button></div>' +
      '<div id="escQR" style="display:grid;place-items:center;background:#fff;border-radius:14px;padding:12px;margin:0 auto;width:max-content"></div>' +
      '<div class="modal-sub" style="text-align:center;margin-top:8px">El modo también se cambia en el otro celular.</div>' +
      '<div id="escLista" style="margin-top:10px"></div>' +
      '<div class="modal-actions"><button type="button" class="btn-ghost" data-copiar>📋 Copiar link</button><button type="button" class="btn-close" data-ocultar>Seguir trabajando</button><button type="button" class="btn-danger-outline" data-fin>Terminar</button></div></div>';
    ov.classList.add('show');
    var q = ov.querySelector('#escQR');
    try{ new QRCode(q, { text: link(), width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M }); }catch(e){ q.textContent = link(); }
    ov.querySelectorAll('[data-m]').forEach(function(b){ b.onclick = function(){ S.modo = b.dataset.m; panel(); }; });
    ov.querySelector('[data-ocultar]').onclick = function(){ ov.classList.remove('show'); pastilla(); };
    ov.querySelector('[data-fin]').onclick = terminar;
    ov.querySelector('[data-copiar]').onclick = function(){ var u = link(); (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(function(){ toast('📋 Link copiado: mándalo al otro celular.'); }, function(){ prompt('Copia este link:', u); }); };
    ov.onclick = function(e){ if(e.target === ov){ ov.classList.remove('show'); pastilla(); } };
    pintarLista(); pastilla();
  }
  function pintarLista(){
    var l = $('escLista'); if(!l || !S) return;
    l.innerHTML = S.ult.length ? '<b>Lo último que llegó (' + S.n + ')</b>' + S.ult.map(function(t){ return '<div style="padding:6px 0;border-top:1px solid var(--line)">' + esc(t) + '</div>'; }).join('') : '<div class="modal-sub" style="text-align:center">Esperando el primer código…</div>';
  }
  function pastilla(){
    var b = $('escRemPill');
    if(!S){ if(b) b.remove(); return; }
    if(!b){
      b = document.createElement('button'); b.type = 'button'; b.id = 'escRemPill';
      b.style.cssText = 'position:fixed;left:12px;bottom:calc(92px + env(safe-area-inset-bottom));z-index:10030;border-radius:999px;padding:10px 14px;border:1px solid var(--line);background:var(--paper,var(--surface));color:var(--ink);font-weight:800;box-shadow:0 6px 20px rgba(0,0,0,.3)';
      b.onclick = panel; document.body.appendChild(b);
    }
    b.textContent = '📱 Escáner conectado · ' + S.n + (S.modo === 'inventario' ? ' · 📥' : ' · 🛒');
  }

  // ================= Botones «📱 Escanear con otro celular» =================
  function boton(clase){
    var b = document.createElement('button'); b.type = 'button'; b.className = clase || 'btn-ghost'; b.setAttribute('data-esc-remoto', '');
    b.textContent = '📱 Escanear con otro celular';
    return b;
  }
  function montar(){
    // En la ventana del escáner de siempre (vender desde la cuenta o buscar un producto)
    var acts = document.querySelector('#scanOverlay .modal-actions');
    if(acts && !acts.querySelector('[data-esc-remoto]')){
      var b = boton('btn-ghost'); b.style.flex = '1 1 100%';
      b.onclick = function(){
        var enCuenta = $('overlay') && $('overlay').classList.contains('show');
        try{ closeScanOverlay(); }catch(e){}
        abrir(enCuenta ? 'vender' : (S ? S.modo : 'vender'));
      };
      acts.style.flexWrap = 'wrap'; acts.insertBefore(b, acts.firstChild);
    }
    // En Inventario (junto a «Código de barras»): para la mercancía que llega
    var grid = document.querySelector('#prodAddPanel .cam-grid');
    if(grid && !grid.querySelector('[data-esc-remoto]')){
      var c = document.createElement('button'); c.type = 'button'; c.className = 'btn-camera cam-big'; c.setAttribute('data-esc-remoto', '');
      c.innerHTML = '<span class="cam-ic">📱</span><span class="cam-tx"><strong>Con otro celular</strong><small>Escanea con otro celular: llega aquí al instante y se llena solo.</small></span>';
      c.onclick = function(){ abrir('inventario'); };
      grid.appendChild(c);
    }
  }
  var css = document.createElement('style');
  css.textContent = '.esc-l{display:block;margin-top:8px;font-weight:700;font-size:14px}.esc-l input,.esc-l select{display:block;width:100%;margin-top:4px}';
  document.head.appendChild(css);
  window.ventoEscaner = { abrir: abrir, terminar: terminar, sesion: function(){ return S ? { canal: S.canal, modo: S.modo, n: S.n, link: link() } : null; }, _recibir: recibir, montar: montar };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();
  setTimeout(montar, 1500);
})();
