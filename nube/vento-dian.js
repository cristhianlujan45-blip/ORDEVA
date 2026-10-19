/* =====================================================================
   Vento · Facturación electrónica DIAN (lado de la app)

   Con «🧾 Facturación electrónica DIAN» prendida (Ajustes → Negocio), CADA venta cobrada sale sola como
   «Documento equivalente electrónico P.O.S.» (o «Factura electrónica de venta» si el cliente la pide con su cédula o
   NIT y su correo). La valida la DIAN por medio de MATIAS (proveedor tecnológico autorizado) desde el Servidor Vento:
   la app nunca tiene claves de nadie.
   • Cola en este equipo: si la conexión falla, la venta queda «enviando» y se manda sola apenas vuelve (el servidor
     no repite números aunque el mismo documento se mande dos veces o desde dos celulares).
   • Deshacer un cobro, borrar, liberar o corregir una venta ya validada → nota crédito (anulación) y, al corregir,
     el documento nuevo. «🧾 Factura a nombre de…» en el historial: anula el P.O.S. y saca la factura del cliente.
   • El recibo (pantalla, WhatsApp, impresora del navegador y la impresora térmica) lleva el número DIAN, la
     resolución, el CUDE y el código QR de la DIAN.
   Sin Vento Nube o con la facturación apagada no hace nada: Vento funciona como siempre.
   ===================================================================== */
(function(){
  'use strict';
  var K_CFG = 'vento_dian_cfg:', K_COLA = 'vento_dian_cola:';
  var plata = function(n){ return '$' + Math.round(n || 0).toLocaleString('es-CO'); };
  var esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function lsGet(k, d){ try{ var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; }catch(e){ return d; } }
  function lsSet(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
  function toast(t, ms){ try{ window.showToast && window.showToast(t, ms || 6000); }catch(e){} }
  function nube(){ return window.ventoNube || null; }
  function negocio(){ var n = nube(); try{ return n && n.configurada && n.configurada() && n.negocio ? n.negocio() : null; }catch(e){ return null; } }
  function D(){ try{ return typeof data !== 'undefined' ? data : window.data; }catch(e){ return window.data; } }
  function guardar(){ try{ (window.saveData || saveData)(); }catch(e){} }
  var $d = function(id){ return document.getElementById(id); };
  // Dígito de verificación del NIT (algoritmo oficial de la DIAN, módulo 11 con los pesos 3, 7, 13, 17…).
  function nitDv(nit){
    var d = String(nit || '').replace(/\D/g, ''); if(!d) return null;
    var pesos = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71], suma = 0;
    for(var i = 0; i < d.length && i < pesos.length; i++) suma += Number(d[d.length - 1 - i]) * pesos[i];
    var r = suma % 11; return r > 1 ? 11 - r : r;
  }

  // ---------- Servidor ----------
  function base(){ var c = nube().config(); return c.url.replace(/\/+$/, '') + '/functions/v1/vento-pagos'; }
  function api(ruta, cuerpo){
    return nube().cliente().then(function(c){ return c.auth.getSession(); }).then(function(r){
      var tok = r && r.data && r.data.session ? r.data.session.access_token : null;
      if(!tok) throw Object.assign(new Error('Entra a Vento Nube para la facturación electrónica.'), { codigo: 'sin_sesion' });
      var ctrl = window.AbortController ? new AbortController() : null, t = setTimeout(function(){ ctrl && ctrl.abort(); }, 70000);
      return fetch(base() + '/' + ruta, { method: 'POST', signal: ctrl ? ctrl.signal : undefined, headers: { 'Content-Type': 'application/json', apikey: nube().config().key, Authorization: 'Bearer ' + tok }, body: JSON.stringify(cuerpo || {}) })
        .then(function(x){ clearTimeout(t); return x; }, function(e){ clearTimeout(t); throw Object.assign(new Error('Sin conexión con el servidor'), { codigo: 'red' }); });
    }).then(function(r){
      return r.json().catch(function(){ return {}; }).then(function(j){
        if(!r.ok) throw Object.assign(new Error(j.mensaje || ('El servidor respondió ' + r.status)), { codigo: j.error || ('http_' + r.status), status: r.status });
        return j;
      });
    });
  }

  // ---------- Configuración (copia en este equipo para saber al instante si está prendida) ----------
  var st = { cfg: null, ambiente: null, servidor: null, prueba: null, cargado: 0 };
  function cfg(){
    var n = negocio(); if(!n) return null;
    if(st.cfg && st.cfg._neg === n.id) return st.cfg;
    var c = lsGet(K_CFG + n.id, null); if(c){ c._neg = n.id; st.cfg = c; }
    return c;
  }
  function activo(){ var c = cfg(); return !!(c && c.activo); }
  function cargar(){
    var n = negocio(); if(!n) return Promise.resolve(null);
    return api('dian/config', { negocio: n.id, accion: 'ver' }).then(function(j){ return ponerCfg(n, j); }).catch(function(){ return cfg(); });
  }
  function ponerCfg(n, j, forzar){
    var c = Object.assign({}, j.config || {}, { _neg: n.id, _ambiente: j.ambiente, _servidor: j.servidor });
    st.cfg = c; st.ambiente = j.ambiente; st.servidor = j.servidor; st.cargado = Date.now();
    lsSet(K_CFG + n.id, c);
    try{ pintarAjustes(forzar); }catch(e){}
    return c;
  }

  // ---------- De una venta de Vento a lo que se manda ----------
  function prod(it){ var d = D(); if(!d || !d.products) return null; return d.products.find(function(p){ return (it.productId && p.id === it.productId) || p.name === it.name; }) || null; }
  function ventaDe(h, id){
    return {
      id: id || h.id, fecha: h.date, total: h.total, cajero: h.by || null,
      mesa: h.tableName || (h.table != null ? String(h.table) : null),
      items: (h.items || []).filter(function(it){ return +it.qty > 0; }).map(function(it){
        var p = prod(it), tar = p && p.iva != null && p.iva !== '' && isFinite(+p.iva) ? +p.iva : null;
        return { name: it.name + (it.size ? ' (' + it.size + ')' : ''), qty: +it.qty, price: +it.price, unidad: it.unidad || null,
          codigo: (p && (p.codigo || (p.barcodes || [])[0])) || null, tarifa: tar };
      }),
      payments: (h.payments || []).map(function(p){ return { method: p.method, amount: +p.amount || 0 }; }),
      cliente: h.dianCliente || null, factura: !!h.dianFactura
    };
  }

  // ---------- Cola (sobrevive a cerrar la app) ----------
  function colaK(){ var n = negocio(); return n ? K_COLA + n.id : null; }
  function cola(){ var k = colaK(); return k ? lsGet(k, []) : []; }
  function ponerCola(c){ var k = colaK(); if(k) lsSet(k, c.slice(-500)); }
  function encolar(x){
    var c = cola();
    if(c.some(function(y){ return y.accion === x.accion && y.venta_id === x.venta_id && (y.nota_id || '') === (x.nota_id || ''); })) return;
    c.push(Object.assign({ intentos: 0, prox: 0, t: Date.now() }, x)); ponerCola(c); programar(50);
  }
  function quitar(x){ ponerCola(cola().filter(function(y){ return !(y.accion === x.accion && y.venta_id === x.venta_id && (y.nota_id || '') === (x.nota_id || '')); })); }
  function reprogramar(x, espera){ var c = cola(); c.forEach(function(y){ if(y.accion === x.accion && y.venta_id === x.venta_id && (y.nota_id || '') === (x.nota_id || '')){ y.intentos = (y.intentos || 0) + 1; y.prox = Date.now() + espera; } }); ponerCola(c); }
  var tCola = null, enCurso = null;
  function programar(ms){ clearTimeout(tCola); tCola = setTimeout(procesar, ms == null ? 1000 : ms); }

  // La venta cuyo documento ACTUAL es ese (una corregida o cambiada por factura ya tiene otro: lo viejo no la toca).
  function entradaDe(ventaId){
    var d = D(); if(!d || !d.history) return null;
    return d.history.find(function(h){ return h.dian ? h.dian.venta === ventaId : String(h.id) === String(ventaId); }) || null;
  }
  // Lo que respondió el servidor queda en la venta (se sincroniza con los demás equipos).
  function aplicar(ventaId, doc, extra){
    var h = entradaDe(ventaId);
    if(h){
      if(doc && doc.tipo === 'nota'){
        var total = String(doc.venta_id || '').indexOf(':') < 0;   // «venta:dev…» = devolución parcial
        h.dian = Object.assign({}, h.dian || {}, { nota: resumir(doc) }, doc.estado === 'aceptado' && total ? { estado: 'anulado' } : {});
      }
      else if(doc){ h.dian = Object.assign({ venta: ventaId }, resumir(doc), extra || {}); }
      else if(extra){ h.dian = Object.assign({ venta: ventaId }, h.dian || {}, extra); }
      guardar();
      try{ var lst = $d('histList'); if(lst && lst.offsetParent && typeof renderHistorial === 'function') renderHistorial(); }catch(e){}
    }
    try{ window.dispatchEvent(new CustomEvent('vento-dian', { detail: { venta: ventaId, doc: doc || null } })); }catch(e){}
    return h;
  }
  function resumir(d){
    return { venta: d.venta_id, id: d.id, tipo: d.tipo, estado: d.estado, documento: d.documento, prefijo: d.prefijo, numero: d.numero, resolucion: d.resolucion,
      cude: d.cude || null, qr: d.qr || null, pdf: d.pdf || null, mensaje: d.mensaje || null, errores: (d.errores || []).slice(0, 6),
      impuestos: d.impuestos || [], totales: d.totales || null, aceptado_en: d.aceptado_en || null };
  }

  var avisado = {};
  function avisarUnaVez(k, t){ if(avisado[k] && Date.now() - avisado[k] < 10 * 60e3) return; avisado[k] = Date.now(); toast(t, 9000); }
  function procesar(){
    var n = negocio(); if(!n || enCurso || !navigator.onLine) return;
    var ahora = Date.now(), c = cola().filter(function(x){ return !x.prox || x.prox <= ahora; });
    if(!c.length){ revisarPendientes(); return; }
    var x = c[0]; enCurso = x;
    var pedido = x.accion === 'emitir' ? api('dian/emitir', { negocio: n.id, venta: x.v })
      : api('dian/anular', { negocio: n.id, venta_id: x.venta_id, items: x.items || undefined, nota_id: x.nota_id || undefined, motivo: x.motivo || undefined, cajero: x.cajero || undefined });
    pedido.then(function(j){
      var doc = j.documento;
      quitar(x);
      if(x.accion === 'emitir'){
        aplicar(x.venta_id, doc);
        if(j.aviso) avisarUnaVez('rango', '🧾 ' + j.aviso);
        if(doc && doc.estado === 'rechazado') avisarUnaVez('rech-' + x.venta_id, '🧾 La DIAN rechazó ' + doc.documento + ': ' + ((doc.errores || [])[0] || doc.mensaje || '') + '. Revísalo en el historial.');
        if(x.anularLuego) encolar({ accion: 'anular', venta_id: x.venta_id, motivo: x.motivoAnular || 'Venta deshecha' });
        if(x.luego) encolar(x.luego);
      } else {
        aplicar(x.venta_id, doc);
        if(doc && doc.estado === 'aceptado') toast('🧾 Nota crédito ' + doc.documento + ' validada por la DIAN.', 5000);
        else if(doc && doc.tipo !== 'nota' && doc.estado === 'anulado') toast('🧾 Documento ' + doc.documento + ' anulado.', 5000);
      }
    }).catch(function(e){
      var cod = e.codigo || '';
      if(cod === 'red' || !e.status || e.status >= 500 || e.status === 401 || cod === 'sin_sesion') { reprogramar(x, Math.min(30 * 60e3, 15000 * Math.pow(2, Math.min(x.intentos || 0, 7)))); return; }
      if(cod === 'dian_espera'){ reprogramar(x, 60e3); return; }
      // Algo que hay que arreglar en Ajustes (apagada, sin resolución, rango agotado…): la venta queda marcada.
      quitar(x);
      if(x.accion === 'emitir') aplicar(x.venta_id, null, { estado: 'error', mensaje: e.message, codigo: cod });
      avisarUnaVez(cod, '🧾 Facturación electrónica: ' + e.message);
    }).then(function(){ enCurso = null; if(cola().length) programar(800); });
  }
  // Documentos que el servidor tiene «pendiente» / «en proceso»: se pregunta cada minuto (el servidor reintenta).
  var tRev = 0;
  function revisarPendientes(){
    var n = negocio(), d = D(); if(!n || !d || !d.history || Date.now() - tRev < 55e3) return;
    var ids = d.history.slice(0, 400).filter(function(h){ return h.dian && (h.dian.estado === 'pendiente' || h.dian.estado === 'en_proceso' || (h.dian.estado === 'enviando' && h.dian.t && Date.now() - h.dian.t > 5 * 60e3)); }).map(function(h){ return h.dian.venta; });
    if(!ids.length) return;
    tRev = Date.now();
    api('dian/estado', { negocio: n.id, ventas: ids }).then(function(j){
      (j.documentos || []).forEach(function(doc){ if(doc.tipo !== 'nota'){ var h = entradaDe(doc.venta_id); if(h && h.dian && h.dian.estado !== doc.estado) aplicar(doc.venta_id, doc); } });
    }).catch(function(){});
  }

  // ---------- Ganchos de la app ----------
  function alVender(h){
    if(!h || !activo() || h.dian) return;
    var id = String(h.id);
    h.dian = { venta: id, estado: 'enviando', tipo: h.dianFactura ? 'factura' : 'pos', t: Date.now() };
    encolar({ accion: 'emitir', venta_id: id, v: ventaDe(h, id) });
  }
  // Deshacer / borrar / liberar: si todavía no salió, no sale; si ya salió, nota crédito.
  function anularVenta(h, motivo){
    if(!h || !h.dian) return false;
    var id = h.dian.venta || String(h.id), c = cola();
    var emision = c.find(function(x){ return x.accion === 'emitir' && x.venta_id === id; });
    if(emision && enCurso !== emision && !(enCurso && enCurso.venta_id === id)){ quitar(emision); return true; }   // nunca salió
    if(enCurso && enCurso.accion === 'emitir' && enCurso.venta_id === id){ enCurso.anularLuego = true; enCurso.motivoAnular = motivo; return true; }
    if(h.dian.estado === 'error') return true;
    encolar({ accion: 'anular', venta_id: id, motivo: motivo || 'Venta anulada', cajero: (typeof authUser !== 'undefined' && authUser) || null });
    return true;
  }
  function alCorregir(h){
    if(!h || !h.dian || !activo()) return;
    var viejo = h.dian.venta || String(h.id);
    anularVenta(h, 'Venta corregida');
    if(!(h.items || []).length){ h.dian = Object.assign({}, h.dian, { estado: 'anulando' }); return; }
    var nuevo = String(h.id).split('~')[0] + '~c' + Date.now().toString(36);
    h.dian = { venta: nuevo, estado: 'enviando', tipo: h.dianFactura ? 'factura' : 'pos', t: Date.now(), reemplaza: viejo };
    encolar({ accion: 'emitir', venta_id: nuevo, v: ventaDe(h, nuevo) });
  }
  // El cliente pide factura con sus datos después de cobrar: se anula el P.O.S. y sale la factura a su nombre.
  function facturaA(h, cli){
    if(!h || !activo()) return;
    h.dianCliente = cli; h.dianFactura = true;
    if(h.dian && h.dian.estado !== 'error') anularVenta(h, 'Se cambia por factura electrónica a nombre de ' + (cli.nombre || cli.numero));
    var nuevo = String(h.id).split('~')[0] + '~f' + Date.now().toString(36);
    h.dian = { venta: nuevo, estado: 'enviando', tipo: 'factura', t: Date.now() };
    encolar({ accion: 'emitir', venta_id: nuevo, v: ventaDe(h, nuevo) });
    guardar();
  }
  // Para imprimir con el CUDE: espera la respuesta de la DIAN (máx. ms).
  function esperar(h, ms){
    return new Promise(function(res){
      if(!h || !h.dian || !(h.dian.estado === 'enviando')) return res(h && h.dian);
      var fin = setTimeout(function(){ window.removeEventListener('vento-dian', oir); res(h.dian); }, ms || 12000);
      function oir(ev){ if(ev.detail && h.dian && ev.detail.venta === h.dian.venta && h.dian.estado !== 'enviando'){ clearTimeout(fin); window.removeEventListener('vento-dian', oir); res(h.dian); } }
      window.addEventListener('vento-dian', oir);
    });
  }

  // ---------- Recibo: número DIAN, resolución, CUDE y QR ----------
  var NOMBRE = { pos: 'Documento equivalente electrónico P.O.S.', factura: 'Factura electrónica de venta', nota: 'Nota crédito electrónica' };
  var ESTADO = { enviando: '⏳ Enviando a la DIAN…', pendiente: '⏳ En cola para la DIAN (se envía solo)', en_proceso: '⏳ La DIAN lo está validando', aceptado: '✅ Validado por la DIAN',
    rechazado: '❌ Rechazado por la DIAN', anulado: '↩️ Anulado (nota crédito)', error: '⚠️ No se envió', anulando: '↩️ Anulando…' };
  function qrDataUrl(texto, px){
    try{
      if(typeof QRCode === 'undefined' || !texto) return null;
      var div = document.createElement('div'); div.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(div);
      new QRCode(div, { text: texto, width: px || 160, height: px || 160, correctLevel: QRCode.CorrectLevel.M });
      var cv = div.querySelector('canvas'), url = cv ? cv.toDataURL('image/png') : ((div.querySelector('img') || {}).src || null);
      div.remove(); return url;
    }catch(e){ return null; }
  }
  function lineasRecibo(dn){
    if(!dn) return null;
    var c = cfg() || {}, tipo = dn.tipo || 'pos', out = [];
    out.push((NOMBRE[tipo] || NOMBRE.pos) + (dn.documento ? ' N.º ' + dn.documento : ''));
    var res = tipo === 'factura' ? c.fe_resolucion : c.pos_resolucion, pre = tipo === 'factura' ? c.fe_prefijo : c.pos_prefijo;
    var desde = tipo === 'factura' ? c.fe_desde : c.pos_desde, hasta = tipo === 'factura' ? c.fe_hasta : c.pos_hasta, vence = tipo === 'factura' ? c.fe_vence : c.pos_vence;
    if(res) out.push('Resolución DIAN N.º ' + res + (desde && hasta ? ' · del ' + (pre || '') + desde + ' al ' + (pre || '') + hasta : '') + (vence ? ' · vigente hasta ' + vence : ''));
    (dn.impuestos || []).forEach(function(t){ out.push((String(t.tax_id) === '4' ? 'INC' : 'IVA') + ' ' + t.percent + '%: base ' + plata(t.taxable_amount) + ' · impuesto ' + plata(t.tax_amount)); });
    out.push(ESTADO[dn.estado] || dn.estado);
    if(dn.cude) out.push('CUDE: ' + dn.cude);
    if(dn.nota && dn.nota.documento) out.push('Anulado con ' + dn.nota.documento + (dn.nota.estado === 'aceptado' ? ' (validada)' : ''));
    if((c._ambiente || st.ambiente) === 'pruebas') out.push('AMBIENTE DE PRUEBAS · sin validez fiscal');
    out.push('Software: Vento POS');
    return out;
  }
  function reciboTexto(dn){ var l = lineasRecibo(dn); return l ? l.join('\n') : ''; }
  function reciboHTML(dn, px){
    var l = lineasRecibo(dn); if(!l) return '';
    var qr = dn.qr ? qrDataUrl(dn.qr, px || 150) : null;
    return '<div class="r-dian" style="margin-top:12px;padding-top:8px;border-top:1px dashed #999;text-align:center;font-size:12px;line-height:1.35">' +
      '<div style="font-weight:800">' + esc(l[0]) + '</div>' +
      l.slice(1).map(function(t){ return '<div style="' + (/^CUDE/.test(t) ? 'word-break:break-all;font-size:10px' : '') + '">' + esc(t) + '</div>'; }).join('') +
      (qr ? '<img src="' + qr + '" alt="QR DIAN" style="width:' + (px || 150) + 'px;height:auto;margin-top:6px;image-rendering:pixelated">' : '') + '</div>';
  }

  // ---------- Ajustes → 🧾 Facturación electrónica DIAN ----------
  function campo(id, et, v, extra){ return '<label class="vd-c"><span>' + et + '</span><input id="' + id + '" class="mz-in" value="' + esc(v == null ? '' : v) + '" ' + (extra || '') + '></label>'; }
  function estilos(){
    if($d('vdCss')) return;
    var s = document.createElement('style'); s.id = 'vdCss';
    s.textContent = '.vd-c{display:flex;flex-direction:column;gap:3px;font-size:13px;margin:6px 0}.vd-c input,.vd-c select{width:100%;box-sizing:border-box}.vd-g{display:grid;grid-template-columns:1fr 1fr;gap:0 10px}' +
      '.vd-est{border-radius:12px;padding:10px;margin:8px 0;font-size:13.5px;background:rgba(124,92,255,.08);border:1px solid rgba(124,92,255,.25)}.vd-est.ok{background:rgba(34,197,94,.1);border-color:rgba(34,197,94,.35)}.vd-est.mal{background:rgba(245,165,36,.1);border-color:rgba(245,165,36,.4)}' +
      '.vd-docs{margin-top:8px;font-size:13px}.vd-docs div{display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px solid var(--line, #3333)}' +
      '.hist-dian{margin-top:8px;padding:8px;border-radius:10px;border:1px solid rgba(124,92,255,.3);font-size:12.5px}.hist-dian .cude{word-break:break-all;opacity:.75;font-size:11px}.hist-dian button,.hist-dian a{margin:6px 6px 0 0}';
    document.head.appendChild(s);
  }
  // forzar: volver a dibujar aunque haya cambios sin guardar (después de guardar). Sin forzar, si la persona está
  // escribiendo, solo se actualiza el recuadro del estado: nunca se le borra lo que lleva.
  function pintarAjustes(forzar){
    var caja = $d('dianCaja'); if(!caja) return;
    estilos();
    var n = negocio();
    if(!n){ caja.innerHTML = '<div class="settings-desc">Para la facturación electrónica entra a <b>Vento Nube</b> con la cuenta del negocio (Ajustes → 👥 Mi cuenta y mi equipo).</div>'; return; }
    var c = cfg() || {}, puede = c.rol === 'dueno' || c.rol === 'admin' || n.rol === 'dueno' || n.rol === 'admin';
    var amb = c._ambiente || st.ambiente;
    var estado = !c._servidor && st.servidor === false ? '<div class="vd-est mal">⚠️ El Servidor Vento todavía no tiene la cuenta del proveedor de facturación (MATIAS). Cuando el proveedor de Vento la agregue, esto se prende solo.</div>'
      : c.activo ? '<div class="vd-est ok">✅ <b>Prendida.</b> Cada venta sale como documento electrónico P.O.S.' + (c.fe_resolucion ? ' (o factura electrónica si el cliente la pide)' : '') + '.' +
          (amb === 'pruebas' ? '<br>🧪 <b>Ambiente de pruebas</b>: los documentos NO tienen validez ante la DIAN todavía.' : '') +
          (c.conectado ? '' : '<br>ℹ️ Falta que Vento Admin conecte tu empresa (NIT) en el proveedor.') +
          '<br>Validados: <b>' + (c.aceptados || 0) + '</b> · por enviar: <b>' + (c.pendientes || 0) + '</b>' + (c.rechazados ? ' · ❌ rechazados: <b>' + c.rechazados + '</b>' : '') + '</div>'
      : '<div class="vd-est">Apagada: las ventas salen con el recibo de siempre (no es factura electrónica).</div>';
    var imp = c.impuesto === 'iva' ? 'iva' + (c.tarifa || 19) : c.impuesto === 'inc' ? 'inc8' : 'ninguno';
    var dis = puede ? '' : ' disabled';
    estado = '<div id="vdEstado">' + estado + '</div>';
    if(!forzar && caja.dataset.sucio === '1' && $d('vdEstado')){ $d('vdEstado').outerHTML = estado; return; }
    caja.dataset.sucio = '';
    caja.innerHTML = estado +
      '<details' + (c.activo ? '' : ' open') + '><summary style="cursor:pointer;font-weight:700;margin:6px 0">📋 Cómo prenderla (una sola vez)</summary><ol class="settings-desc" style="padding-left:18px;margin:6px 0">' +
        '<li>En la DIAN (MUISCA) <b>habilítate como facturador electrónico</b> y escoge «proveedor tecnológico».</li>' +
        '<li>Pide la <b>resolución de numeración</b> para «documento equivalente electrónico P.O.S.» (y, si quieres, otra para factura electrónica). Te dan número, prefijo y rango.</li>' +
        '<li>Escríbele al proveedor de Vento (Ajustes → 📖 Guía y soporte) para que conecte tu NIT en la facturación.</li>' +
        '<li>Llena estos datos, toca <b>Guardar</b> y luego prende el interruptor.</li></ol></details>' +
      '<div class="settings-row"><div class="settings-row-text"><strong>Prender facturación electrónica</strong><span>Cada venta cobrada sale sola a la DIAN.</span></div><label class="switch"><input type="checkbox" id="vdOn"' + (c.activo ? ' checked' : '') + dis + '><span class="switch-slider"></span></label></div>' +
      '<div class="settings-desc" style="margin-top:8px"><b>Tu negocio (como está en el RUT)</b></div>' +
      campo('vdRazon', 'Razón social o nombre', c.razon_social, 'maxlength="120"' + dis) +
      '<div class="vd-g">' + campo('vdNit', 'NIT (sin DV)', c.nit, 'inputmode="numeric" maxlength="15"' + dis) + campo('vdDv', 'DV', c.dv, 'inputmode="numeric" maxlength="1"' + dis) + '</div>' +
      campo('vdDir', 'Dirección del local', c.direccion, 'maxlength="160"' + dis) +
      '<div class="vd-g">' + campo('vdCorreo', 'Correo', c.correo, 'type="email" maxlength="120"' + dis) + campo('vdCaja', 'Nombre de la caja', c.caja || 'CAJA 1', 'maxlength="30"' + dis) + '</div>' +
      '<label class="vd-c"><span>Impuesto de tus ventas</span><select id="vdImp" class="mz-in"' + dis + '>' +
        [['ninguno', 'No responsable de IVA (sin impuesto)'], ['iva19', 'IVA 19 %'], ['iva5', 'IVA 5 %'], ['iva0', 'IVA 0 % (exento)'], ['inc8', 'Impuesto al consumo 8 % (restaurantes, bares)']]
          .map(function(o){ return '<option value="' + o[0] + '"' + (o[0] === imp ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
      '<div class="settings-desc" style="font-size:12px">Los precios de Vento traen el impuesto por dentro: Vento separa la base y el impuesto. Si un producto tiene su propio IVA (en el producto), se usa ese.</div>' +
      '<div class="settings-desc" style="margin-top:10px"><b>Resolución P.O.S. electrónico</b></div>' +
      '<div class="vd-g">' + campo('vdPosRes', 'Número de resolución', c.pos_resolucion, 'inputmode="numeric" maxlength="20"' + dis) + campo('vdPosPre', 'Prefijo', c.pos_prefijo, 'maxlength="4" style="text-transform:uppercase"' + dis) +
        campo('vdPosDesde', 'Desde', c.pos_desde, 'inputmode="numeric"' + dis) + campo('vdPosHasta', 'Hasta', c.pos_hasta, 'inputmode="numeric"' + dis) +
        campo('vdPosSig', 'Siguiente número', c.pos_siguiente, 'inputmode="numeric"' + dis) + campo('vdPosVence', 'Vigente hasta', c.pos_vence, 'type="date"' + dis) + '</div>' +
      '<details' + (c.fe_resolucion ? ' open' : '') + '><summary style="cursor:pointer;font-weight:700;margin:8px 0">🧾 Factura electrónica (opcional: cuando el cliente la pide)</summary>' +
        '<div class="vd-g">' + campo('vdFeRes', 'Número de resolución', c.fe_resolucion, 'inputmode="numeric" maxlength="20"' + dis) + campo('vdFePre', 'Prefijo', c.fe_prefijo, 'maxlength="4" style="text-transform:uppercase"' + dis) +
          campo('vdFeDesde', 'Desde', c.fe_desde, 'inputmode="numeric"' + dis) + campo('vdFeHasta', 'Hasta', c.fe_hasta, 'inputmode="numeric"' + dis) +
          campo('vdFeSig', 'Siguiente número', c.fe_siguiente, 'inputmode="numeric"' + dis) + campo('vdFeVence', 'Vigente hasta', c.fe_vence, 'type="date"' + dis) + '</div></details>' +
      (puede ? '<div class="mz-actions" style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn-primary" id="vdGuardar">💾 Guardar</button><button type="button" class="btn-ghost" id="vdProbar">🔌 Probar conexión</button><button type="button" class="btn-ghost" id="vdDocs">📄 Últimos documentos</button></div>'
        : '<div class="settings-desc">Solo el dueño o el administrador cambian estos datos.</div><div class="mz-actions"><button type="button" class="btn-ghost" id="vdDocs">📄 Últimos documentos</button></div>') +
      '<div id="vdMsg" class="settings-desc" style="margin-top:6px"></div><div id="vdLista" class="vd-docs"></div>';
    caja.oninput = caja.onchange = function(e){ if(e.target && e.target.id !== 'vdOn') caja.dataset.sucio = '1'; };
    var nitIn = $d('vdNit');
    if(nitIn) nitIn.addEventListener('input', function(){ try{ var dv = nitDv(nitIn.value); if(dv != null && $d('vdDv') && !$d('vdDv').dataset.tocado) $d('vdDv').value = dv; }catch(e){} });
    if($d('vdDv')) $d('vdDv').addEventListener('input', function(){ this.dataset.tocado = '1'; });
    if($d('vdGuardar')) $d('vdGuardar').onclick = function(){ guardarCfg(null); };
    if($d('vdOn')) $d('vdOn').onchange = function(){ guardarCfg(this.checked); };
    if($d('vdProbar')) $d('vdProbar').onclick = probarCfg;
    if($d('vdDocs')) $d('vdDocs').onclick = listarDocs;
  }
  function leerForm(){
    var v = function(id){ var e = $d(id); return e ? e.value.trim() : ''; };
    var imp = v('vdImp');
    return { razon_social: v('vdRazon'), nit: v('vdNit'), dv: v('vdDv'), direccion: v('vdDir'), correo: v('vdCorreo'), caja: v('vdCaja'),
      impuesto: imp.indexOf('iva') === 0 ? 'iva' : imp === 'inc8' ? 'inc' : 'ninguno', tarifa: imp.indexOf('iva') === 0 ? Number(imp.slice(3)) : imp === 'inc8' ? 8 : 0,
      pos_resolucion: v('vdPosRes'), pos_prefijo: v('vdPosPre').toUpperCase(), pos_desde: v('vdPosDesde'), pos_hasta: v('vdPosHasta'), pos_siguiente: v('vdPosSig'), pos_vence: v('vdPosVence'),
      fe_resolucion: v('vdFeRes'), fe_prefijo: v('vdFePre').toUpperCase(), fe_desde: v('vdFeDesde'), fe_hasta: v('vdFeHasta'), fe_siguiente: v('vdFeSig'), fe_vence: v('vdFeVence') };
  }
  function msg(t, mal){ var m = $d('vdMsg'); if(m){ m.innerHTML = t; m.style.color = mal ? '#f59e0b' : ''; } }
  function guardarCfg(prender){
    var n = negocio(); if(!n) return;
    var c = leerForm(); if(prender != null) c.activo = !!prender;
    msg('Guardando…');
    return api('dian/config', { negocio: n.id, accion: 'guardar', config: c }).then(function(j){
      ponerCfg(n, j, true);
      msg(j.config.activo ? '✅ Guardado. La facturación electrónica está prendida.' : '✅ Guardado.');
      toast(j.config.activo ? '🧾 Facturación electrónica prendida: cada venta sale a la DIAN.' : '🧾 Datos de facturación guardados.', 5000);
      if(j.config.activo) programar(200);
    }).catch(function(e){ if($d('vdOn') && prender) $d('vdOn').checked = false; msg('⚠️ ' + esc(e.message), true); });
  }
  function probarCfg(){
    var n = negocio(); if(!n) return;
    msg('Probando la conexión con la DIAN (MATIAS)…');
    api('dian/config', { negocio: n.id, accion: 'probar' }).then(function(j){
      ponerCfg(n, j);
      var p = j.prueba || {};
      msg((p.ok ? '✅ ' : '⚠️ ') + esc(p.mensaje || '') + (p.empresa ? '<br>Empresa en el proveedor: <b>' + esc(p.empresa.nombre) + '</b> · NIT ' + esc(p.empresa.nit) + (p.coincide === false ? ' — ⚠️ no coincide con el NIT de aquí' : '') : '') +
        (j.ambiente === 'pruebas' ? '<br>🧪 Ambiente de pruebas.' : ''), !p.ok);
    }).catch(function(e){ msg('⚠️ ' + esc(e.message), true); });
  }
  function listarDocs(){
    var n = negocio(), box = $d('vdLista'); if(!n || !box) return;
    box.textContent = 'Cargando…';
    api('dian/estado', { negocio: n.id, ventas: null, reintentar: true }).then(function(j){
      var l = (j.documentos || []).slice(0, 30);
      box.innerHTML = l.length ? l.map(function(d){ return '<div><span><b>' + esc(d.documento) + '</b> · ' + esc(NOMBRE[d.tipo] ? d.tipo.toUpperCase() : d.tipo) + ' · ' + plata(d.total) + '<br><small>' + esc(ESTADO[d.estado] || d.estado) + (d.errores && d.errores.length ? ' — ' + esc(d.errores[0]) : '') + '</small></span>' +
        (d.pdf ? '<a href="' + esc(d.pdf) + '" target="_blank" rel="noopener">PDF</a>' : '') + '</div>'; }).join('') : '<div class="settings-desc">Todavía no hay documentos.</div>';
    }).catch(function(e){ box.textContent = '⚠️ ' + e.message; });
  }

  // ---------- Historial: el documento de cada venta ----------
  function bloqueHistorial(h){
    if(!h || !h.dian) return '';
    estilos();
    var dn = h.dian, id = esc(String(h.id));
    var errs = dn.estado === 'rechazado' && dn.errores && dn.errores.length ? '<div style="color:#f59e0b">' + esc(dn.errores.slice(0, 3).join(' · ')) + '</div>' : (dn.estado === 'error' && dn.mensaje ? '<div style="color:#f59e0b">' + esc(dn.mensaje) + '</div>' : '');
    return '<div class="hist-dian"><b>🧾 ' + esc(NOMBRE[dn.tipo] || NOMBRE.pos) + (dn.documento ? ' ' + esc(dn.documento) : '') + '</b><br>' + esc(ESTADO[dn.estado] || dn.estado) + errs +
      (dn.cude ? '<div class="cude">CUDE: ' + esc(dn.cude) + '</div>' : '') +
      (dn.nota && dn.nota.documento ? '<div>↩️ Nota crédito ' + esc(dn.nota.documento) + ' · ' + esc(ESTADO[dn.nota.estado] || dn.nota.estado) + '</div>' : '') +
      '<div>' + (dn.pdf ? '<a class="btn-ghost" href="' + esc(dn.pdf) + '" target="_blank" rel="noopener">📄 PDF DIAN</a>' : '') +
      (dn.estado === 'rechazado' || dn.estado === 'error' || dn.estado === 'pendiente' ? '<button type="button" class="btn-ghost" data-dian="reintentar" data-id="' + id + '">🔁 Reintentar</button>' : '') +
      (dn.estado === 'aceptado' && dn.tipo === 'pos' ? '<button type="button" class="btn-ghost" data-dian="factura" data-id="' + id + '">🧾 Factura a nombre de…</button>' : '') +
      (dn.estado === 'aceptado' ? '<button type="button" class="btn-ghost" data-dian="anular" data-id="' + id + '">↩️ Anular (nota crédito)</button>' : '') + '</div></div>';
  }
  function pedirCliente(titulo, factura){
    return new Promise(function(res){
      var ov = document.createElement('div'); ov.className = 'overlay show vd-cli-ov'; ov.style.zIndex = '2147483000'; ov.setAttribute('data-novocab', '');   // encima de «¿Cómo pagó?»
      ov.innerHTML = '<div class="modal" role="dialog" aria-modal="true" style="max-width:420px"><h2 style="margin:0 0 6px">🧾 ' + esc(titulo || 'Datos del cliente') + '</h2>' +
        '<div class="settings-desc">' + (factura ? 'La factura electrónica le llega al correo del cliente.' : 'Para que el documento salga a su nombre (opcional).') + '</div>' +
        '<label class="vd-c"><span>Tipo de documento</span><select id="vdcTipo" class="mz-in"><option value="CC">Cédula de ciudadanía</option><option value="NIT">NIT (empresa)</option><option value="CE">Cédula de extranjería</option><option value="PP">Pasaporte</option><option value="PEP">PEP</option></select></label>' +
        '<div class="vd-g">' + campo('vdcNum', 'Número', '', 'inputmode="numeric" maxlength="15"') + campo('vdcDv', 'DV (si es NIT)', '', 'inputmode="numeric" maxlength="1"') + '</div>' +
        campo('vdcNom', 'Nombre o razón social', '', 'maxlength="120"') + campo('vdcCorreo', 'Correo', '', 'type="email" maxlength="120"') + campo('vdcTel', 'Celular (opcional)', '', 'inputmode="tel" maxlength="15"') +
        '<div id="vdcErr" style="color:#f59e0b;font-size:13px;min-height:1em"></div>' +
        '<div class="modal-actions"><button type="button" class="btn-ghost" id="vdcNo">Cancelar</button><button type="button" class="btn-primary" id="vdcSi">' + (factura ? 'Sacar factura' : 'Listo') + '</button></div></div>';
      document.body.appendChild(ov);
      var fin = function(v){ ov.remove(); res(v); };
      ov.querySelector('#vdcNo').onclick = function(){ fin(null); };
      ov.addEventListener('click', function(e){ if(e.target === ov) fin(null); });
      ov.querySelector('#vdcNum').addEventListener('input', function(){ if(ov.querySelector('#vdcTipo').value === 'NIT'){ try{ var dv = nitDv(this.value); if(dv != null) ov.querySelector('#vdcDv').value = dv; }catch(e){} } });
      ov.querySelector('#vdcSi').onclick = function(){
        var g = function(id){ return ov.querySelector(id).value.trim(); };
        var c = { tipo: g('#vdcTipo'), numero: g('#vdcNum').replace(/\D/g, ''), dv: g('#vdcDv'), nombre: g('#vdcNom'), correo: g('#vdcCorreo'), telefono: g('#vdcTel') };
        var err = c.numero.length < 5 ? 'Escribe el número del documento.' : !c.nombre ? 'Escribe el nombre.' : factura && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.correo) ? 'Escribe un correo válido.' : '';
        if(err){ ov.querySelector('#vdcErr').textContent = err; return; }
        fin(c);
      };
      setTimeout(function(){ try{ ov.querySelector('#vdcNum').focus(); }catch(e){} }, 50);
    });
  }
  document.addEventListener('click', function(e){
    var b = e.target.closest && e.target.closest('[data-dian]'); if(!b) return;
    e.stopPropagation();
    var d = D(), h = d && d.history && d.history.find(function(x){ return String(x.id) === String(b.dataset.id); }); if(!h) return;
    var a = b.dataset.dian;
    if(a === 'reintentar'){
      var id = h.dian.venta || String(h.id);
      if(h.dian.estado === 'rechazado' || h.dian.estado === 'error' || h.dian.estado === 'pendiente'){ h.dian.estado = 'enviando'; h.dian.t = Date.now(); encolar({ accion: 'emitir', venta_id: id, v: ventaDe(h, id) }); }
      toast('🔁 Enviando otra vez a la DIAN…', 3000); guardar(); return;
    }
    if(a === 'factura'){ pedirCliente('Factura electrónica a nombre de…', true).then(function(c){ if(c){ facturaA(h, c); toast('🧾 Se anula el documento P.O.S. y sale la factura a nombre de ' + c.nombre + '.', 6000); } }); return; }
    if(a === 'anular'){
      var conf = window.showConfirm ? window.showConfirm({ title: '¿Anular ante la DIAN?', message: 'Sale una nota crédito por ' + plata(h.total) + ' que anula ' + (h.dian.documento || 'el documento') + '. La venta queda en el historial marcada como anulada.', confirmText: 'Sí, anular', icon: '↩️' }) : Promise.resolve(confirm('¿Anular ante la DIAN?'));
      conf.then(function(ok){ if(!ok) return; anularVenta(h, 'Anulación desde el historial'); h.dian.estado = h.dian.estado === 'aceptado' ? 'anulando' : h.dian.estado; guardar(); try{ renderHistorial(); }catch(x){} });
    }
  }, true);

  // ---------- Arranque ----------
  function iniciar(){
    var intentos = 0;
    (function esperarNube(){
      var n = negocio();
      if(!n){ if(++intentos < 120) setTimeout(esperarNube, 1000); return; }
      cargar().then(function(){ programar(1500); });
    })();
    window.addEventListener('online', function(){ programar(500); });
    setInterval(function(){ if(negocio()){ programar(0); if(Date.now() - st.cargado > 10 * 60e3) cargar(); } }, 60e3);
    document.addEventListener('click', function(e){ var c = e.target.closest && e.target.closest('.ajustes-cat[data-cat="negocio"]'); if(c) setTimeout(function(){ pintarAjustes(); cargar(); }, 50); });
  }
  window.ventoDian = { activo: activo, cfg: cfg, cargar: cargar, alVender: alVender, alDeshacer: function(h){ return anularVenta(h, 'Cobro deshecho'); }, alBorrar: function(h){ return anularVenta(h, 'Venta borrada'); },
    alLiberar: function(h){ return anularVenta(h, 'Venta devuelta a la cuenta'); }, alCorregir: alCorregir, facturaA: facturaA, pedirCliente: pedirCliente, esperar: esperar,
    reciboHTML: reciboHTML, reciboTexto: reciboTexto, lineasRecibo: lineasRecibo, bloqueHistorial: bloqueHistorial, pintarAjustes: pintarAjustes, procesar: procesar, cola: cola, _ventaDe: ventaDe };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
