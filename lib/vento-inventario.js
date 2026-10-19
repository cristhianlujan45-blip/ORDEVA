/* =====================================================================
   Vento · Inventario por código (como los sistemas POS)
   Inventario → «🔢 Inventario por código»:
   • Cada producto con su CÓDIGO: el de barras de fábrica o uno interno de 4 dígitos (tipo PLU) que Vento le pone
     a los que no tienen. Ese código sirve en la caja, con el lector USB/Bluetooth, la cámara y las etiquetas.
   • 🔎 Consultar: escaneas o escribes el código → nombre, precio, costo, existencias y su kárdex.
   • 📥 Entrada de mercancía: escaneas lo que llegó (cada lectura suma 1, o escribes la cantidad), con el costo si
     cambió → «Aplicar»: suben las existencias y queda anotado de qué proveedor / factura.
   • 📋 Toma de inventario (conteo físico): escaneas todo lo que hay → Vento compara con lo que dice el sistema y
     muestra lo que sobra o falta (en unidades y en plata) → «Aplicar ajustes». El conteo no se pierde si cierras.
   • 📒 Kárdex de cada producto: ventas, entradas, ajustes del conteo y devoluciones, con fecha, quién y el saldo.
   • ↩️ Devoluciones desde el historial: lo devuelto vuelve al inventario, la venta baja, el efectivo devuelto sale
     de la caja y, con facturación electrónica, sale la nota crédito.
   ===================================================================== */
(function(){
  'use strict';
  if(window.ventoInventario) return;
  const D = () => { try{ return typeof data !== 'undefined' ? data : window.data; }catch(e){ return window.data; } };
  const plata = n => { try{ return typeof fmt === 'function' ? fmt(n) : '$' + Math.round(+n || 0).toLocaleString('es-CO'); }catch(e){ return '$' + Math.round(+n || 0); } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const toast = (t, ms) => { try{ window.showToast && window.showToast(t, ms || 5000); }catch(e){} };
  const guardar = () => { try{ (window.saveData || saveData)(); }catch(e){} };
  const quien = () => { try{ return (typeof authUser !== 'undefined' && authUser) || ''; }catch(e){ return ''; } };
  const auditar = (a, d) => { try{ window.ventoAuditar && window.ventoAuditar(a, d); }catch(e){} };
  const $i = id => document.getElementById(id);
  const neg = () => { try{ const n = window.ventoNube && window.ventoNube.negocio(); return n ? n.id : 'local'; }catch(e){ return 'local'; } };
  const K_CONTEO = 'vento_conteo:', K_ENTRADA = 'vento_entrada:';
  const lsGet = (k, d) => { try{ const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; }catch(e){ return d; } };
  const lsSet = (k, v) => { try{ v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };

  // ---------- Códigos ----------
  const prods = () => (D() && D().products || []).filter(p => !p.combo);
  const codigoDe = p => String(p.codigo || (p.barcodes || [])[0] || p.sku || '').trim();
  function buscar(raw){
    const c = String(raw || '').trim(); if(!c) return null;
    const up = c.toUpperCase();
    let p = prods().find(x => String(x.codigo || '').toUpperCase() === up || (x.barcodes || []).map(String).includes(c) || String(x.sku || '').toUpperCase() === up);
    if(!p){ try{ p = typeof findProductByScannedCode === 'function' ? findProductByScannedCode(c) : null; }catch(e){} }
    return p && !p.combo ? p : null;
  }
  function usados(){ const s = new Set(); prods().forEach(p => { if(p.codigo) s.add(String(p.codigo).toUpperCase()); (p.barcodes || []).forEach(b => s.add(String(b).toUpperCase())); }); return s; }
  // Código interno de 4 dígitos (1001, 1002…) para los productos que no tienen: fácil de escribir en la caja.
  function darCodigos(){
    const u = usados(); let n = 1001, k = 0;
    prods().forEach(p => {
      if(codigoDe(p)) return;
      while(u.has(String(n))) n++;
      p.codigo = String(n); p.barcodes = (p.barcodes || []).concat(String(n)); u.add(String(n)); n++; k++;
    });
    if(k){ guardar(); auditar('códigos de producto', k + ' productos recibieron su código interno'); }
    return k;
  }
  function ponerCodigo(p, cod){
    cod = String(cod || '').trim().slice(0, 40); if(!p || !cod) return false;
    const otro = buscar(cod); if(otro && otro !== p) return false;
    p.codigo = cod; p.barcodes = Array.from(new Set((p.barcodes || []).concat(cod))); guardar(); return true;
  }

  // ---------- 💲 Precio por cantidad (mayorista): «desde 12 unidades, a $2.500 cada una» ----------
  function escalas(p){ return (Array.isArray(p && p.escalas) ? p.escalas : []).filter(e => +e.desde > 1 && +e.precio > 0).sort((a, b) => b.desde - a.desde); }
  function precioCantidad(p, qty){
    const base = Number(p && p.price) || 0, e = escalas(p).find(x => (+qty || 0) >= +x.desde);
    return e ? Math.round(+e.precio) : base;
  }
  window.ventoPrecioCantidad = precioCantidad;

  // ---------- Kárdex: ventas (stockLog de la app) + lo que se hace aquí (data.kardex) ----------
  function anotar(p, tipo, q, nota, costo){
    const d = D(); if(!d || !p) return;
    d.kardex = d.kardex || [];
    d.kardex.push({ p: p.id, t: Date.now(), tipo, q, saldo: p.stock == null ? null : +p.stock, por: quien(), nota: String(nota || '').slice(0, 120), costo: costo != null ? +costo : undefined });
    if(d.kardex.length > 6000) d.kardex = d.kardex.slice(-5000);
  }
  function kardex(p, max){
    const d = D(); if(!d || !p) return [];
    const L = (d.kardex || []).filter(k => k.p === p.id).map(k => Object.assign({}, k));
    (d.stockLog || []).filter(s => s.p === p.id).forEach(s => L.push({ p: p.id, t: s.at, tipo: s.q > 0 ? 'venta' : 'quitado', q: -s.q, saldo: null }));
    L.sort((a, b) => b.t - a.t);
    // Saldo hacia atrás desde las existencias de hoy (los movimientos de la app no guardan su saldo).
    let saldo = p.stock == null ? null : +p.stock;
    L.forEach(k => { if(k.saldo == null) k.saldo = saldo; saldo = k.saldo == null ? null : k.saldo - k.q; });
    return L.slice(0, max || 200);
  }
  const TIPO = { venta: '🛒 Venta', quitado: '↩ Quitado de una cuenta', entrada: '📥 Entrada', conteo: '📋 Ajuste por conteo', devolucion: '↩️ Devolución', ajuste: '✏️ Ajuste' };

  // ---------- Panel ----------
  const st = { modo: 'consultar', sel: null };
  function css(){
    if($i('viCss')) return;
    const s = document.createElement('style'); s.id = 'viCss';
    s.textContent = '.vi-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.vi-tabs button{flex:1;min-width:110px}.vi-tabs button.on{outline:2px solid var(--accent,#7c5cff)}' +
      '.vi-scan{display:flex;gap:6px}.vi-scan input{flex:1;font-size:17px}.vi-card{border:1px solid var(--line,#3333);border-radius:12px;padding:10px;margin:8px 0}.vi-card h3{margin:0 0 4px}' +
      '.vi-row{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--line,#3333);font-size:14px}.vi-row input{width:70px;text-align:center}' +
      '.vi-mas{color:#16a34a;font-weight:700}.vi-menos{color:#dc2626;font-weight:700}.vi-k{font-size:12.5px}.vi-k small{opacity:.7}.vi-tot{font-weight:800;margin-top:8px}';
    document.head.appendChild(s);
  }
  function montar(){
    const v = $i('view-inventario'); if(!v || $i('viPanel')) return;
    css();
    const det = document.createElement('details'); det.className = 'pr-panel'; det.id = 'viPanel';
    det.innerHTML = '<summary><span>🔢</span><b>Inventario por código</b><small>Consultar, entrada de mercancía, toma de inventario y kárdex</small></summary><div class="pr-panel-body" id="viCuerpo"></div>';
    const ref = $i('prodAddPanel') || $i('invAvisos');
    if(ref) ref.insertAdjacentElement('afterend', det); else v.appendChild(det);
    det.addEventListener('toggle', () => { if(det.open) pintar(); });
  }
  function pintar(){
    const c = $i('viCuerpo'); if(!c) return;
    const sin = prods().filter(p => !codigoDe(p)).length;
    const conteo = lsGet(K_CONTEO + neg(), null), entrada = lsGet(K_ENTRADA + neg(), null);
    c.innerHTML = (sin ? '<div class="settings-desc">⚠️ <b>' + sin + '</b> producto' + (sin === 1 ? '' : 's') + ' sin código. <button type="button" class="btn-ghost" id="viDar">🔢 Darles código interno</button></div>' : '<div class="settings-desc">✅ Todos los productos tienen código.</div>') +
      '<div class="vi-tabs"><button type="button" class="btn-ghost' + (st.modo === 'consultar' ? ' on' : '') + '" data-vm="consultar">🔎 Consultar</button>' +
        '<button type="button" class="btn-ghost' + (st.modo === 'entrada' ? ' on' : '') + '" data-vm="entrada">📥 Entrada de mercancía' + (entrada && entrada.items.length ? ' (' + entrada.items.length + ')' : '') + '</button>' +
        '<button type="button" class="btn-ghost' + (st.modo === 'conteo' ? ' on' : '') + '" data-vm="conteo">📋 Toma de inventario' + (conteo ? ' (en curso)' : '') + '</button></div>' +
      '<div class="vi-scan"><input id="viCod" class="mz-in" placeholder="Escanea o escribe el código" autocomplete="off" autocapitalize="characters" enterkeyhint="go">' +
        '<button type="button" class="btn-ghost" id="viCam" title="Escanear con la cámara">📷</button></div>' +
      '<div class="settings-desc" style="font-size:12px">Con lector de código de barras: apunta y dispara (escribe el código y Enter solo). «3*7702…» = 3 unidades.</div>' +
      '<div id="viZona"></div>' +
      '<div class="mz-actions" style="margin-top:10px"><button type="button" class="btn-ghost" id="viCsv">⬇️ Inventario con códigos (Excel)</button></div>';
    c.querySelectorAll('[data-vm]').forEach(b => b.onclick = () => { st.modo = b.dataset.vm; pintar(); setTimeout(() => $i('viCod') && $i('viCod').focus(), 30); });
    if($i('viDar')) $i('viDar').onclick = () => { const k = darCodigos(); toast('🔢 ' + k + ' producto' + (k === 1 ? '' : 's') + ' con código nuevo.'); try{ typeof renderInventario === 'function' && renderInventario(); }catch(e){} pintar(); };
    const inp = $i('viCod');
    inp.onkeydown = e => { if(e.key === 'Enter'){ e.preventDefault(); leer(inp.value); inp.value = ''; } };
    $i('viCam').onclick = () => { try{ openScanOverlay(raw => { leer(raw); }, { hint: st.modo === 'consultar' ? 'Apunta al código del producto.' : 'Escanea los productos uno por uno: cada lectura suma 1.' }); }catch(e){ toast('No se pudo abrir la cámara.'); } };
    $i('viCsv').onclick = csv;
    zona();
  }
  function cantidadYCodigo(v){ const m = String(v || '').trim().match(/^(\d{1,4})\s*[x×*]\s*(\S.*)$/i); return m ? { n: +m[1], cod: m[2].trim() } : { n: 1, cod: String(v || '').trim() }; }
  function leer(raw){
    const { n, cod } = cantidadYCodigo(raw); if(!cod) return;
    const p = buscar(cod);
    if(!p) return desconocido(cod, n);
    try{ window.ventoSonidos ? window.ventoSonidos.tocar && window.ventoSonidos.tocar('add') : null; }catch(e){}
    if(st.modo === 'consultar'){ st.sel = p.id; zona(); return; }
    const k = st.modo === 'conteo' ? K_CONTEO : K_ENTRADA, c = lsGet(k + neg(), null) || { desde: Date.now(), items: [] };
    const it = c.items.find(x => x.p === p.id);
    if(it) it.q += n; else c.items.unshift({ p: p.id, q: n });
    lsSet(k + neg(), c);
    toast((st.modo === 'conteo' ? '📋 ' : '📥 ') + p.name + ': ' + (it ? it.q : n), 1500);
    zona(p.id);
  }
  function desconocido(cod, n){
    if(!confirm('No hay ningún producto con el código ' + cod + '. ¿Crearlo ahora?')) return;
    const nombre = prompt('Nombre del producto con código ' + cod + ':'); if(!nombre) return;
    const precio = Math.round(Number(String(prompt('Precio de venta:') || '').replace(/[^\d]/g, '')) || 0);
    const d = D(); const p = { id: 'p' + Date.now().toString(36), name: nombre.trim().slice(0, 80), price: precio, cost: 0, stock: 0, codigo: cod, barcodes: [cod] };
    d.products.push(p); guardar(); auditar('producto creado', p.name + ' · código ' + cod);
    try{ typeof renderInventario === 'function' && renderInventario(); }catch(e){}
    toast('✅ ' + p.name + ' creado con el código ' + cod + '.'); leer((n > 1 ? n + '*' : '') + cod);
  }
  const prod = id => prods().find(p => p.id === id);
  function zona(ultimo){
    const z = $i('viZona'); if(!z) return;
    if(st.modo === 'consultar'){
      const p = st.sel && prod(st.sel);
      if(!p){ z.innerHTML = '<div class="settings-desc" style="margin-top:8px">Escanea un producto para ver su información y su kárdex.</div>'; return; }
      const k = kardex(p, 40);
      z.innerHTML = '<div class="vi-card"><h3>' + esc(p.name) + '</h3>' +
        '<div class="vi-row"><span>Código</span><b>' + esc(codigoDe(p) || '—') + ' <button type="button" class="btn-ghost" id="viCambiaCod" style="padding:2px 8px">✏️</button></b></div>' +
        '<div class="vi-row"><span>Precio</span><b>' + plata(p.price) + '</b></div><div class="vi-row"><span>Costo</span><b>' + (p.cost ? plata(p.cost) : '—') + '</b></div>' +
        '<div class="vi-row"><span>Existencias</span><b>' + (p.stock == null ? 'sin control' : esc(p.stock)) + '</b></div>' +
        '<div class="hist-detail-title" style="margin-top:8px">💲 Precio por cantidad (mayorista)</div>' +
        (escalas(p).slice().reverse().map(e => '<div class="vi-row"><span>Desde ' + esc(e.desde) + ' unidades</span><b>' + plata(e.precio) + ' c/u <button type="button" class="btn-ghost" data-esq="' + esc(e.desde) + '" style="padding:2px 8px">✕</button></b></div>').join('') || '<div class="settings-desc" style="font-size:12.5px">En la caja, al llevar varias unidades, se cobra el precio por cantidad.</div>') +
        '<div style="display:flex;gap:6px;margin-top:6px"><input id="viEsDesde" class="mz-in" type="number" min="2" placeholder="Desde (unid.)" style="flex:1"><input id="viEsPrecio" class="mz-in" type="number" min="1" placeholder="Precio c/u" style="flex:1"><button type="button" class="btn-ghost" id="viEsAdd">➕</button></div>' +
        '<div class="hist-detail-title" style="margin-top:8px">📒 Kárdex</div>' +
        (k.length ? k.map(x => '<div class="vi-row vi-k"><span>' + esc(TIPO[x.tipo] || x.tipo) + (x.nota ? ' · ' + esc(x.nota) : '') + '<br><small>' + esc(new Date(x.t).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' }) + (x.por ? ' · ' + x.por : '')) + '</small></span>' +
          '<span><b class="' + (x.q > 0 ? 'vi-mas' : 'vi-menos') + '">' + (x.q > 0 ? '+' : '') + esc(Math.round(x.q * 1000) / 1000) + '</b>' + (x.saldo != null ? '<br><small>saldo ' + esc(Math.round(x.saldo * 1000) / 1000) + '</small>' : '') + '</span></div>').join('') : '<div class="settings-desc">Sin movimientos todavía.</div>') + '</div>';
      $i('viEsAdd').onclick = () => {
        const d = Math.round(+$i('viEsDesde').value || 0), pr = Math.round(+$i('viEsPrecio').value || 0);
        if(!(d > 1) || !(pr > 0)){ toast('Escribe desde cuántas unidades (2 o más) y el precio de cada una.'); return; }
        if(pr >= (+p.price || 0) && !confirm('Ese precio no es menor que el normal (' + plata(p.price) + '). ¿Guardarlo igual?')) return;
        p.escalas = escalas(p).filter(e => +e.desde !== d).concat({ desde: d, precio: pr }); guardar();
        auditar('precio por cantidad', p.name + ': desde ' + d + ' a ' + plata(pr)); toast('💲 ' + p.name + ': desde ' + d + ' unidades a ' + plata(pr) + ' c/u.'); zona();
      };
      z.querySelectorAll('[data-esq]').forEach(b => b.onclick = () => { p.escalas = escalas(p).filter(e => String(e.desde) !== b.dataset.esq); guardar(); zona(); });
      $i('viCambiaCod').onclick = () => { const c = prompt('Código de ' + p.name + ' (el de barras o uno tuyo):', codigoDe(p)); if(c == null) return; if(ponerCodigo(p, c)){ toast('✅ Código guardado.'); zona(); } else toast('⚠️ Ese código ya lo tiene otro producto.'); };
      return;
    }
    const k = st.modo === 'conteo' ? K_CONTEO : K_ENTRADA, c = lsGet(k + neg(), null);
    const items = (c && c.items || []).filter(x => prod(x.p));
    if(st.modo === 'entrada'){
      const tot = items.reduce((s, x) => s + x.q * (x.costo != null ? x.costo : (prod(x.p).cost || 0)), 0);
      z.innerHTML = '<div class="vi-card">' + (items.length ? items.map(x => { const p = prod(x.p); return '<div class="vi-row' + (x.p === ultimo ? '" style="background:rgba(124,92,255,.08)' : '') + '"><span>' + esc(p.name) + '<br><small>' + esc(codigoDe(p)) + ' · hay ' + (p.stock == null ? '—' : esc(p.stock)) + '</small></span>' +
          '<span>+<input type="number" min="0" step="1" data-eq="' + esc(x.p) + '" value="' + esc(x.q) + '"> costo <input type="number" min="0" step="50" data-ec="' + esc(x.p) + '" value="' + esc(x.costo != null ? x.costo : (p.cost || '')) + '" style="width:90px"></span></div>'; }).join('') +
          '<input id="viProv" class="mz-in" maxlength="80" placeholder="Proveedor o número de factura (opcional)" style="width:100%;margin-top:8px" value="' + esc(c.nota || '') + '">' +
          '<div class="vi-tot">' + items.reduce((s, x) => s + x.q, 0) + ' unidades · costo ' + plata(tot) + '</div>' +
          '<div class="mz-actions" style="display:flex;gap:8px;margin-top:8px"><button type="button" class="btn-ghost" id="viBorrar">🗑️ Vaciar</button><button type="button" class="btn-primary" id="viAplicar">✅ Aplicar entrada</button></div>'
        : '<div class="settings-desc">Escanea lo que llegó: cada lectura suma 1 (o escribe «12*código»).</div>') + '</div>';
    } else {
      const filas = items.map(x => { const p = prod(x.p), sis = p.stock == null ? 0 : +p.stock, dif = x.q - sis; return { p, x, sis, dif }; });
      const valor = filas.reduce((s, f) => s + f.dif * (f.p.cost || f.p.price || 0), 0);
      z.innerHTML = '<div class="vi-card">' + (filas.length ? '<div class="settings-desc">Contados: <b>' + filas.length + '</b> productos. Escanea todo lo que hay en el local.</div>' +
          filas.map(f => '<div class="vi-row' + (f.p.id === ultimo ? '" style="background:rgba(124,92,255,.08)' : '') + '"><span>' + esc(f.p.name) + '<br><small>' + esc(codigoDe(f.p)) + ' · sistema ' + esc(f.sis) + '</small></span>' +
            '<span>contado <input type="number" min="0" step="1" data-cq="' + esc(f.p.id) + '" value="' + esc(f.x.q) + '"> <b class="' + (f.dif > 0 ? 'vi-mas' : f.dif < 0 ? 'vi-menos' : '') + '">' + (f.dif === 0 ? '✓' : (f.dif > 0 ? '+' : '') + f.dif) + '</b></span></div>').join('') +
          '<div class="vi-tot">Diferencia: ' + (valor === 0 ? 'cuadra ✓' : (valor > 0 ? 'sobran ' : 'faltan ') + plata(Math.abs(valor))) + '</div>' +
          '<div class="mz-actions" style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap"><button type="button" class="btn-ghost" id="viBorrar">🗑️ Cancelar conteo</button><button type="button" class="btn-primary" id="viAplicar">✅ Aplicar ajustes</button></div>'
        : '<div class="settings-desc">Toma de inventario: escanea cada producto que hay (cada lectura suma 1). Al final Vento te muestra lo que sobra o falta. El conteo se guarda aunque cierres la app.</div>') + '</div>';
    }
    // Cambiar una cantidad o un costo NO vuelve a dibujar la lista (si no, el botón que se toca justo después
    // desaparece bajo el dedo): solo se guardan y se actualizan los totales.
    z.querySelectorAll('[data-eq],[data-ec],[data-cq]').forEach(i => i.oninput = i.onchange = () => {
      const c2 = lsGet(k + neg(), null); if(!c2) return;
      const it = c2.items.find(x => x.p === (i.dataset.eq || i.dataset.ec || i.dataset.cq)); if(!it) return;
      if(i.dataset.ec != null) it.costo = i.value === '' ? null : Math.max(0, Math.round(+i.value || 0)); else it.q = Math.max(0, +i.value || 0);
      lsSet(k + neg(), c2); totales(z, c2);
    });
    if($i('viProv')) $i('viProv').onchange = () => { const c2 = lsGet(k + neg(), null); if(c2){ c2.nota = $i('viProv').value.trim(); lsSet(k + neg(), c2); } };
    if($i('viBorrar')) $i('viBorrar').onclick = () => { if(confirm(st.modo === 'conteo' ? '¿Cancelar el conteo? Se borra lo contado.' : '¿Vaciar la entrada?')){ lsSet(k + neg(), null); pintar(); } };
    if($i('viAplicar')) $i('viAplicar').onclick = () => st.modo === 'conteo' ? aplicarConteo() : aplicarEntrada();
  }
  function totales(z, c){
    const t = z.querySelector('.vi-tot'); if(!t) return;
    const items = (c.items || []).filter(x => prod(x.p));
    if(st.modo === 'entrada'){
      const tot = items.reduce((s2, x) => s2 + x.q * (x.costo != null ? x.costo : (prod(x.p).cost || 0)), 0);
      t.textContent = items.reduce((s2, x) => s2 + x.q, 0) + ' unidades · costo ' + plata(tot);
    } else {
      let valor = 0;
      items.forEach(x => { const p = prod(x.p), dif = x.q - (p.stock == null ? 0 : +p.stock); valor += dif * (p.cost || p.price || 0);
        const inp = z.querySelector('[data-cq="' + x.p + '"]'), bd = inp && inp.nextElementSibling;
        if(bd){ bd.className = dif > 0 ? 'vi-mas' : dif < 0 ? 'vi-menos' : ''; bd.textContent = dif === 0 ? '✓' : (dif > 0 ? '+' : '') + dif; } });
      t.textContent = 'Diferencia: ' + (valor === 0 ? 'cuadra ✓' : (valor > 0 ? 'sobran ' : 'faltan ') + plata(Math.abs(valor)));
    }
  }
  function aplicarEntrada(){
    const c = lsGet(K_ENTRADA + neg(), null); if(!c || !c.items.length) return;
    let u = 0;
    c.items.forEach(x => { const p = prod(x.p); if(!p || !(x.q > 0)) return;
      p.stock = (p.stock == null ? 0 : +p.stock) + x.q; u += x.q;
      if(x.costo != null && x.costo > 0) p.cost = x.costo;
      anotar(p, 'entrada', x.q, c.nota || 'Entrada de mercancía', x.costo);
    });
    lsSet(K_ENTRADA + neg(), null); guardar();
    auditar('entrada de mercancía', u + ' unidades de ' + c.items.length + ' productos' + (c.nota ? ' · ' + c.nota : ''));
    try{ typeof renderInventario === 'function' && renderInventario(); typeof invBadge === 'function' && invBadge(); }catch(e){}
    toast('📥 Entrada aplicada: ' + u + ' unidades.'); pintar();
  }
  function aplicarConteo(){
    const c = lsGet(K_CONTEO + neg(), null); if(!c || !c.items.length) return;
    const cambios = c.items.map(x => ({ p: prod(x.p), q: x.q })).filter(x => x.p && x.q !== (x.p.stock == null ? 0 : +x.p.stock));
    if(!confirm('Se ajustan ' + cambios.length + ' productos a lo contado. Los que no contaste quedan igual. ¿Aplicar?')) return;
    cambios.forEach(x => { const antes = x.p.stock == null ? 0 : +x.p.stock; x.p.stock = x.q; anotar(x.p, 'conteo', x.q - antes, 'Toma de inventario'); });
    lsSet(K_CONTEO + neg(), null); guardar();
    auditar('toma de inventario', c.items.length + ' productos contados, ' + cambios.length + ' ajustados');
    try{ typeof renderInventario === 'function' && renderInventario(); typeof invBadge === 'function' && invBadge(); }catch(e){}
    toast('📋 Inventario ajustado: ' + cambios.length + ' productos.'); pintar();
  }
  function csv(){
    const f = x => '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"';
    const L = [['Código', 'Producto', 'Existencias', 'Costo', 'Precio', 'Valor al costo'].map(f).join(';')].concat(prods().map(p => [codigoDe(p), p.name, p.stock == null ? '' : p.stock, p.cost || 0, p.price || 0, (p.stock || 0) * (p.cost || 0)].map(f).join(';')));
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + L.join('\r\n')], { type: 'text/csv' })); a.download = 'inventario-codigos.csv'; document.body.appendChild(a); a.click(); a.remove();
  }

  // ---------- ↩️ Devoluciones (desde el historial) ----------
  function devolucion(h){
    if(!h || !(h.items || []).length) return;
    const its = h.items.map(it => Object.assign({}, it));
    const ov = document.createElement('div'); ov.className = 'overlay show'; ov.style.zIndex = '9600'; ov.setAttribute('data-novocab', '');
    const efectivo = (h.payments || []).some(p => p.method === 'efectivo');
    ov.innerHTML = '<div class="modal" role="dialog" aria-modal="true" style="max-width:440px"><h2 style="margin:0 0 6px">↩️ Devolución</h2><div class="settings-desc">¿Qué devuelve el cliente? Vuelve al inventario y la venta baja.</div>' +
      its.map((it, i) => '<div class="vi-row"><span>' + esc(it.name) + '<br><small>vendido ' + esc(it.qty) + ' × ' + plata(it.price) + '</small></span><input type="number" min="0" max="' + esc(it.qty) + '" step="1" value="0" data-dv="' + i + '"></div>').join('') +
      '<input id="viDvMot" class="mz-in" maxlength="120" placeholder="Motivo (ej: producto dañado)" style="width:100%;margin-top:8px">' +
      (efectivo ? '<label style="display:flex;gap:6px;align-items:center;margin-top:8px;font-size:14px"><input type="checkbox" id="viDvEf" checked> Le devuelvo el dinero en efectivo (sale de la caja)</label>' : '') +
      '<div class="vi-tot" id="viDvTot">Devolver: $0</div>' +
      '<div class="modal-actions"><button type="button" class="btn-ghost" data-x>Cancelar</button><button type="button" class="btn-primary" id="viDvOk">Hacer la devolución</button></div></div>';
    document.body.appendChild(ov);
    const cant = () => its.map((it, i) => Math.min(+it.qty || 0, Math.max(0, +ov.querySelector('[data-dv="' + i + '"]').value || 0)));
    const total = () => cant().reduce((s, q, i) => s + q * its[i].price, 0);
    ov.addEventListener('input', () => { ov.querySelector('#viDvTot').textContent = 'Devolver: ' + plata(total()); });
    ov.querySelector('[data-x]').onclick = () => ov.remove();
    ov.querySelector('#viDvOk').onclick = () => {
      const q = cant(), tot = total(); if(!tot) return;
      const motivo = ov.querySelector('#viDvMot').value.trim(), ef = ov.querySelector('#viDvEf') && ov.querySelector('#viDvEf').checked;
      const dev = its.map((it, i) => ({ name: it.name, qty: q[i], price: it.price, unidad: it.unidad, productId: it.productId })).filter(x => x.qty > 0);
      // Inventario de vuelta + kárdex
      dev.forEach(x => { const p = prods().find(pp => (x.productId && pp.id === x.productId) || pp.name === x.name);
        if(p){ if(p.stock != null) p.stock = +p.stock + x.qty; anotar(p, 'devolucion', x.qty, motivo || 'Devolución'); } });
      // La venta baja (como «corregir»), con la devolución anotada
      h.items.forEach((it, i) => { it.qty = (+it.qty || 0) - q[i]; });
      h.items = h.items.filter(it => it.qty > 0);
      h.total = Math.max(0, (+h.total || 0) - tot);
      const pagos = h.payments || [];
      let falta = tot; for(let i = pagos.length - 1; i >= 0 && falta > 0; i--){ const m = Math.min(+pagos[i].amount || 0, falta); pagos[i].amount = (+pagos[i].amount || 0) - m; falta -= m; }
      h.payments = pagos.filter(p => p.amount > 0);
      h.debt = h.payments.filter(p => p.method === 'debe').reduce((s, p) => s + (+p.amount || 0), 0);
      (h.devoluciones = h.devoluciones || []).push({ t: Date.now(), items: dev.map(x => ({ name: x.name, qty: x.qty, price: x.price })), total: tot, motivo, por: quien() });
      if(ef && window.ventoTurno) window.ventoTurno.movimiento('salida', tot, 'Devolución' + (motivo ? ': ' + motivo : ''));
      try{ window.ventoDian && window.ventoDian.devolver && window.ventoDian.devolver(h, dev, motivo); }catch(e){}
      guardar(); auditar('devolución', plata(tot) + ' · ' + dev.map(x => x.qty + ' ' + x.name).join(', ') + (motivo ? ' · ' + motivo : ''));
      ov.remove();
      try{ renderHistorial(); }catch(e){} try{ typeof renderInventario === 'function' && renderInventario(); }catch(e){}
      toast('↩️ Devolución de ' + plata(tot) + ' hecha. Lo devuelto volvió al inventario.', 6000);
    };
  }

  // ---------- Arranque ----------
  function iniciar(){
    montar();
    // Cuando un producto entra por la caja o por factura con un código nuevo, ya queda buscable aquí (usa barcodes).
    document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('nav button[data-view="inventario"]'); if(b) setTimeout(montar, 50); });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
  window.ventoInventario = { precioCantidad, escalas, buscar, darCodigos, ponerCodigo, codigoDe, kardex, anotar, devolucion, pintar, aplicarEntrada, aplicarConteo, leer, modo: m => { st.modo = m; pintar(); } };
})();
