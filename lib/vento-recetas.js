/* =====================================================================
   ORDEVA · 🧾 Recetas e insumos (1.55.0)
   ---------------------------------------------------------------------
   «Recetas que descuenten insumos automáticamente» (lo que faltaba para restaurantes, cafeterías, panaderías…):
     • Insumos (data.insumos): lo que se usa para preparar y NO se vende solo — harina, queso, carne, leche, café…
       Con su unidad (kg, g, l, ml, und), cuánto hay, cuándo avisar y lo que cuesta cada unidad. Viven aparte de los
       productos, así nunca salen en la carta, en las mesas, en la caja, en el QR ni en la app de meseros.
       Inventario → «🧂 Insumos»: agregar, «➕ Llegó» (sumar) y ajustar.
     • Receta de un producto (product.receta = [{ ref: 'i:<insumo>' | 'p:<producto>', qty }]): en «Editar producto» →
       «🧾 Receta». Al vender, se descuenta solo de cada insumo (o producto, ej. la botella de un cóctel); al quitar de
       la cuenta, vuelve. El costo del plato sale de la receta (si el producto no tenía costo).
     • «🚫 No vender si faltan ingredientes» (data.recetasBloquear, lo prende el dueño): en las mesas (toques, favoritos,
       voz, escáner, QR, meseros) no deja agregar el plato y dice qué falta. En la venta rápida de caja avisa (no frena
       la venta para no dañar el cobro).
   Usa lo que ya existe: invOnSale (descuento de inventario), recordItemHistory (todo +/− de una cuenta) y el editor de
   productos. No cambia nada para quien no use recetas.
   ===================================================================== */
(function(){
  'use strict';
  if(window.ventoRecetas) return;
  const D = () => (typeof data !== 'undefined' && data) ? data : null;
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plata = n => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');
  const num = v => { const n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) ? n : null; };
  const r3 = n => Math.round(n * 1000) / 1000;
  const UNIDADES = ['kg', 'g', 'l', 'ml', 'und'];
  const toast = (t, ms) => { try{ showToast(t, ms); }catch(e){} };
  const guardar = () => { try{ saveData(); }catch(e){} };

  // ---------- Datos ----------
  function insumos(){ const d = D(); if(!d) return []; if(!Array.isArray(d.insumos)) d.insumos = []; return d.insumos; }
  const insumo = id => insumos().find(x => x.id === id) || null;
  const producto = id => { const d = D(); return d ? (d.products || []).find(x => x.id === id) || null : null; };
  function ref(r){
    const m = /^([ip]):(.+)$/.exec(String(r && r.ref || '')); if(!m) return null;
    const o = m[1] === 'i' ? insumo(m[2]) : producto(m[2]); if(!o) return null;
    return { tipo: m[1], o, nombre: o.name, u: m[1] === 'i' ? (o.unidad || 'und') : 'und', stock: o.stock == null ? null : Number(o.stock), costo: Number(o.cost) || 0 };
  }
  const receta = p => (p && Array.isArray(p.receta)) ? p.receta.filter(r => r && r.ref && Number(r.qty) > 0) : [];
  // 1.64.0: ¿este negocio usa «🧂 Insumos y recetas»? (módulo «r»: lo traen los que preparan comida; el administrador lo
  // prende o apaga en Ajustes → Negocio → «🧩 Funciones de este negocio»). Apagado: no se ve en ninguna pantalla, no
  // descuenta ni frena ventas, y los insumos y las recetas quedan guardados para cuando se vuelva a prender.
  const activo = () => { try{ return typeof usaMod !== 'function' || usaMod('r'); }catch(e){ return true; } };
  const bloquear = () => { const d = D(); return !!(d && d.recetasBloquear) && activo(); };
  function costoReceta(p){
    let total = 0, completo = true;
    receta(p).forEach(r => { const x = ref(r); if(!x || !x.costo) completo = false; else total += x.costo * Number(r.qty); });
    return { total: Math.round(total), completo };
  }
  // ¿Qué falta para preparar «qty» de este producto? (solo lo que tiene control de cantidad)
  function falta(productId, qty){
    const p = producto(productId), out = [];
    receta(p).forEach(r => {
      const x = ref(r); if(!x || x.stock == null) return;
      const nec = r3(Number(r.qty) * qty);
      if(x.stock + 1e-9 < nec) out.push({ nombre: x.nombre, necesita: nec, hay: r3(x.stock), u: x.u });
    });
    return out;
  }
  const textoFalta = (p, l) => 'Falta para «' + (p ? p.name : 'el plato') + '»: ' + l.map(f => f.nombre + ' (necesitas ' + fmtQ(f.necesita, f.u) + ', hay ' + fmtQ(f.hay, f.u) + ')').join(', ');
  const fmtQ = (n, u) => (Math.round(n * 1000) / 1000).toLocaleString('es-CO') + ' ' + u;

  function logInsumo(x, q, tipo){
    const d = D(); if(!d) return;
    d.insumosLog = d.insumosLog || [];
    d.insumosLog.push({ i: x.id, q: r3(q), tipo, at: Date.now() });
    if(d.insumosLog.length > 3000) d.insumosLog = d.insumosLog.slice(-2500);
  }
  // Descuenta (q > 0) o devuelve (q < 0) los ingredientes de «q» unidades vendidas de este producto.
  function descontar(productId, q){
    if(!activo()) return;
    const p = producto(productId); if(!p || !q) return;
    receta(p).forEach(r => {
      const m = /^([ip]):(.+)$/.exec(String(r.ref)); if(!m) return;
      const cant = r3(Number(r.qty) * q);
      if(m[1] === 'i'){
        const x = insumo(m[2]); if(!x) return;
        logInsumo(x, -cant, 'receta');
        if(x.stock == null) return;
        x.stock = r3(cant > 0 ? Math.max(0, Number(x.stock) - cant) : Number(x.stock) - cant);
      } else if(m[2] !== productId){
        try{ origInvOnSale({ productId: m[2] }, cant); }catch(e){}
      }
    });
  }

  // ---------- Enganches (sin cambiar quien llama) ----------
  let origInvOnSale = null, origRecord = null;
  function enganchar(){
    if(typeof window.invOnSale === 'function' && !window.invOnSale.__receta){
      origInvOnSale = window.invOnSale;
      const w = function(item, q){ const r = origInvOnSale.apply(this, arguments); try{ if(item && item.productId) descontar(item.productId, q); }catch(e){} return r; };
      w.__receta = true; window.invOnSale = w;
    }
    if(typeof window.recordItemHistory === 'function' && !window.recordItemHistory.__receta){
      origRecord = window.recordItemHistory;
      const w = function(item, qty){
        if(qty > 0 && bloquear() && item && item.productId){
          const l = falta(item.productId, qty);
          if(l.length){
            item.qty -= qty;                               // quien llamó ya la había sumado: se deshace
            toast('🚫 ' + textoFalta(producto(item.productId), l) + '.', 7000);
            try{ window.ventoSonidos && window.ventoSonidos.error && window.ventoSonidos.error(); }catch(e){}
            setTimeout(limpiarCeros, 0);
            return;
          }
        }
        return origRecord.apply(this, arguments);
      };
      w.__receta = true; window.recordItemHistory = w;
    }
    if(typeof window.qsRegistrarVenta === 'function' && !window.qsRegistrarVenta.__receta){
      const o = window.qsRegistrarVenta;
      const w = function(cart){
        if(activo()) try{
          const l = [];
          (cart || []).forEach(it => { if(it && it.productId) falta(it.productId, Number(it.qty) || 0).forEach(f => l.push(Object.assign({ p: producto(it.productId) }, f))); });
          if(l.length) toast('⚠️ Vendido, pero ' + l.map(f => 'falta ' + f.nombre + ' para «' + (f.p ? f.p.name : '') + '»').join(', ') + '. Revisa los insumos.', 8000);
        }catch(e){}
        return o.apply(this, arguments);
      };
      w.__receta = true; window.qsRegistrarVenta = w;
    }
  }
  // Un plato que no se pudo agregar quedó con 0 en la cuenta: se quita.
  function limpiarCeros(){
    const d = D(); if(!d || !d.tables) return;
    let cambio = false;
    Object.keys(d.tables).forEach(k => { const t = d.tables[k]; if(!t || !Array.isArray(t.items)) return; const n = t.items.length; t.items = t.items.filter(it => !(Number(it.qty) <= 0)); if(t.items.length !== n) cambio = true; });
    if(!cambio) return;
    guardar();
    try{ renderMesas(); }catch(e){}
    try{ if(typeof currentTable !== 'undefined' && currentTable != null && typeof openTableModal === 'function' && document.querySelector('.overlay.show')) openTableModal(currentTable); }catch(e){}
  }

  // ---------- 🧾 Receta en «Editar producto» ----------
  let editando = null;
  function opcionesIng(sel, self){
    const ins = insumos().slice().sort((a, b) => a.name.localeCompare(b.name));
    const prods = ((D() || {}).products || []).filter(p => p.id !== self && !p.combo && !receta(p).length).sort((a, b) => a.name.localeCompare(b.name));
    return '<option value="">Elige un ingrediente…</option>' +
      (ins.length ? '<optgroup label="🧂 Insumos">' + ins.map(x => '<option value="i:' + esc(x.id) + '"' + (sel === 'i:' + x.id ? ' selected' : '') + '>' + esc(x.name) + ' (' + esc(x.unidad || 'und') + ')</option>').join('') + '</optgroup>' : '') +
      (prods.length ? '<optgroup label="📦 Productos">' + prods.map(x => '<option value="p:' + esc(x.id) + '"' + (sel === 'p:' + x.id ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '</optgroup>' : '');
  }
  function filaHtml(r, self){
    const x = r && r.ref ? ref(r) : null;
    return '<div class="rc-fila"><select data-rc="ing">' + opcionesIng(r && r.ref, self) + '</select>' +
      '<input type="number" data-rc="qty" min="0" step="any" inputmode="decimal" placeholder="Cantidad" value="' + (r && r.qty ? esc(r.qty) : '') + '">' +
      '<span data-rc="u">' + esc(x ? x.u : '') + '</span><button type="button" class="btn-ghost" data-rc="del" title="Quitar">🗑️</button></div>';
  }
  function pintarEditor(productId){
    if(!activo()){ const b = document.getElementById('editProdRecetaWrap'); if(b) b.remove(); editando = null; return; }
    const ov = document.getElementById('editProductOverlay'); if(!ov) return;
    const modal = ov.querySelector('.modal'); if(!modal) return;
    let box = document.getElementById('editProdRecetaWrap');
    if(!box){
      box = document.createElement('details'); box.id = 'editProdRecetaWrap'; box.className = 'iv-rawtext-wrap'; box.setAttribute('data-mod', 'r');
      const acc = modal.querySelector('.modal-actions'); modal.insertBefore(box, acc);
    }
    const p = producto(productId); editando = productId;
    const l = receta(p);
    box.open = l.length > 0;
    box.innerHTML = '<summary>🧾 Receta (ingredientes que se descuentan al vender)</summary>' +
      '<div class="modal-sub" style="margin:6px 0">Lo que lleva UNA unidad de este producto. Al venderlo, ORDEVA descuenta cada ingrediente del inventario; si lo quitan de la cuenta, vuelve. Los insumos se crean en Inventario → 🧂 Insumos.</div>' +
      '<div id="rcFilas">' + (l.length ? l : [null]).map(r => filaHtml(r, productId)).join('') + '</div>' +
      '<button type="button" class="btn-ghost" id="rcMas">➕ Otro ingrediente</button><div id="rcCosto" class="margin-breakdown"></div>';
    const filas = box.querySelector('#rcFilas');
    const costo = () => { const r = leer(); const c = costoReceta({ receta: r }); box.querySelector('#rcCosto').textContent = r.length ? '💰 Costo de la receta: ' + plata(c.total) + (c.completo ? '' : ' (a algún insumo le falta el costo)') : ''; };
    box.querySelector('#rcMas').onclick = () => { filas.insertAdjacentHTML('beforeend', filaHtml(null, productId)); };
    box.oninput = box.onchange = ev => {
      const f = ev.target.closest('.rc-fila'); if(f && ev.target.dataset.rc === 'ing'){ const x = ref({ ref: ev.target.value }); f.querySelector('[data-rc="u"]').textContent = x ? x.u : ''; }
      costo();
    };
    box.onclick = ev => { const b = ev.target.closest('[data-rc="del"]'); if(b){ b.closest('.rc-fila').remove(); if(!filas.children.length) filas.insertAdjacentHTML('beforeend', filaHtml(null, productId)); costo(); } };
    costo();
  }
  function leer(){
    const out = [];
    document.querySelectorAll('#rcFilas .rc-fila').forEach(f => {
      const r = f.querySelector('[data-rc="ing"]').value, q = num(f.querySelector('[data-rc="qty"]').value);
      if(r && q && q > 0 && !out.some(x => x.ref === r)) out.push({ ref: r, qty: r3(q) });
    });
    return out;
  }
  function alGuardarProducto(){
    const p = editando ? producto(editando) : null; if(!p || !document.getElementById('rcFilas')) return;
    const r = leer();
    if(r.length) p.receta = r; else delete p.receta;
    // Si el producto no tiene costo, el de la receta va en el campo «Costo» (el guardado normal lo toma de ahí).
    if(r.length){ const c = costoReceta(p); p.costoReceta = c.total; const ci = document.getElementById('editProdCost'); if(ci && !String(ci.value).trim() && c.completo && c.total > 0) ci.value = c.total; }
    else delete p.costoReceta;
  }
  function engancharEditor(){
    if(typeof window.openEditProductModal === 'function' && !window.openEditProductModal.__receta){
      const o = window.openEditProductModal;
      const w = function(id){ const r = o.apply(this, arguments); try{ pintarEditor(id); }catch(e){} return r; };
      w.__receta = true; window.openEditProductModal = w;
    }
    const b = document.getElementById('editProdSaveBtn');
    if(b && !b.__receta){ b.__receta = true; b.addEventListener('click', () => { try{ alGuardarProducto(); }catch(e){} }, true); }   // antes de guardar
  }

  // ---------- 🧂 Insumos en Inventario ----------
  const estadoIns = x => x.stock == null ? '' : Number(x.stock) <= 0 ? 'out' : (x.min != null && Number(x.stock) <= Number(x.min)) ? 'low' : 'ok';
  function pintarPanel(){
    if(!activo()){ const b = document.getElementById('insumosPanel'); if(b) b.remove(); return; }
    const v = document.getElementById('view-inventario'); if(!v || !D()) return;
    let box = document.getElementById('insumosPanel');
    if(!box){
      box = document.createElement('details'); box.className = 'pr-panel'; box.id = 'insumosPanel'; box.setAttribute('data-mod', 'r');
      const ref = document.getElementById('prodAddPanel'); if(ref) ref.parentNode.insertBefore(box, ref); else v.appendChild(box);
      box.addEventListener('click', clicPanel);
      box.addEventListener('change', ev => { if(ev.target.id === 'insBloquear'){ D().recetasBloquear = ev.target.checked; guardar(); toast(ev.target.checked ? '🚫 Listo: no se venden platos si faltan ingredientes.' : 'Se venden aunque falten ingredientes (como antes).'); } });
    }
    const l = insumos().slice().sort((a, b) => a.name.localeCompare(b.name));
    const bajos = l.filter(x => estadoIns(x) === 'out' || estadoIns(x) === 'low');
    const conReceta = ((D().products) || []).filter(p => receta(p).length).length;
    box.innerHTML = '<summary><span>🧂</span><b>Insumos y recetas</b><small>' + (l.length ? l.length + ' insumo' + (l.length === 1 ? '' : 's') + ' · ' + conReceta + ' con receta' + (bajos.length ? ' · ⚠️ ' + bajos.length + ' por acabarse' : '') : 'Lo que usas para preparar (harina, queso, carne…)') + '</small></summary>' +
      '<div class="pr-panel-body">' +
      '<div class="modal-sub">Los insumos no se venden solos: se descuentan al vender un producto que los lleve en su receta (Editar producto → 🧾 Receta).</div>' +
      '<label style="display:flex;gap:10px;align-items:center;margin:8px 0"><input type="checkbox" id="insBloquear" style="width:auto"' + (bloquear() ? ' checked' : '') + '> 🚫 No vender si faltan ingredientes</label>' +
      '<div id="insLista">' + (l.length ? l.map(x => '<div class="inv-row' + (estadoIns(x) === 'out' ? ' inv-out' : estadoIns(x) === 'low' ? ' inv-low' : '') + '"><div><b>' + esc(x.name) + '</b><small>' +
          (x.stock == null ? 'Sin control de cantidad' : 'Hay ' + fmtQ(Number(x.stock), x.unidad || 'und')) + (x.min != null ? ' · avisar con ' + fmtQ(Number(x.min), x.unidad || 'und') : '') + (x.cost ? ' · ' + plata(x.cost) + ' / ' + esc(x.unidad || 'und') : '') + '</small></div>' +
          '<div class="inv-btns"><button type="button" class="btn-ghost" data-ins="sumar" data-id="' + esc(x.id) + '">➕ Llegó</button><button type="button" class="btn-ghost" data-ins="editar" data-id="' + esc(x.id) + '">✏️</button></div></div>').join('') : '<div class="empty-note">Todavía no hay insumos.</div>') + '</div>' +
      '<div id="insForm"></div><button type="button" class="btn-primary" data-ins="nuevo" style="margin-top:8px">➕ Nuevo insumo</button></div>';
  }
  function formHtml(x){
    return '<div class="ins-form" style="display:grid;gap:6px;margin-top:10px;padding:10px;border:1px solid var(--line);border-radius:12px">' +
      '<input type="text" id="insNombre" placeholder="Nombre (ej. Queso mozzarella)" value="' + esc(x ? x.name : '') + '">' +
      '<select id="insUnidad">' + UNIDADES.map(u => '<option' + ((x ? x.unidad : 'kg') === u ? ' selected' : '') + '>' + u + '</option>').join('') + '</select>' +
      '<input type="number" id="insStock" min="0" step="any" inputmode="decimal" placeholder="Cuánto hay (vacío = sin control)" value="' + (x && x.stock != null ? esc(x.stock) : '') + '">' +
      '<input type="number" id="insMin" min="0" step="any" inputmode="decimal" placeholder="Avisar cuando queden…" value="' + (x && x.min != null ? esc(x.min) : '') + '">' +
      '<input type="number" id="insCosto" min="0" step="any" inputmode="decimal" placeholder="Costo por unidad (ej. por kg)" value="' + (x && x.cost ? esc(x.cost) : '') + '">' +
      '<div style="display:flex;gap:8px"><button type="button" class="btn-primary" data-ins="guardar" data-id="' + esc(x ? x.id : '') + '">Guardar</button><button type="button" class="btn-ghost" data-ins="cancelar">Cancelar</button>' +
      (x ? '<button type="button" class="btn-ghost" data-ins="borrar" data-id="' + esc(x.id) + '">🗑️</button>' : '') + '</div></div>';
  }
  async function clicPanel(ev){
    const b = ev.target.closest('[data-ins]'); if(!b) return;
    const a = b.dataset.ins, id = b.dataset.id, f = document.getElementById('insForm');
    if(a === 'nuevo'){ f.innerHTML = formHtml(null); document.getElementById('insNombre').focus(); return; }
    if(a === 'editar'){ f.innerHTML = formHtml(insumo(id)); return; }
    if(a === 'cancelar'){ f.innerHTML = ''; return; }
    if(a === 'guardar'){
      const nombre = document.getElementById('insNombre').value.trim(); if(!nombre){ toast('Escribe el nombre del insumo.'); return; }
      const x = id ? insumo(id) : { id: 'ins-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) };
      if(!id && insumos().some(y => y.name.toLowerCase() === nombre.toLowerCase())){ toast('Ya hay un insumo con ese nombre.'); return; }
      const antes = x.stock;
      x.name = nombre.slice(0, 80); x.unidad = document.getElementById('insUnidad').value;
      const s = num(document.getElementById('insStock').value), m = num(document.getElementById('insMin').value), c = num(document.getElementById('insCosto').value);
      x.stock = s == null ? null : r3(Math.max(0, s)); x.min = m == null ? null : r3(Math.max(0, m)); x.cost = c == null ? null : Math.max(0, c);
      if(!id) insumos().push(x);
      if(antes !== x.stock) logInsumo(x, (Number(x.stock) || 0) - (Number(antes) || 0), id ? 'ajuste' : 'inicial');
      try{ window.ventoAuditar && window.ventoAuditar(id ? 'insumo editado' : 'insumo nuevo', x.name); }catch(e){}
      guardar(); pintarPanel(); toast('✅ ' + x.name + ' guardado.'); return;
    }
    if(a === 'borrar'){
      const x = insumo(id); if(!x) return;
      const usan = ((D().products) || []).filter(p => receta(p).some(r => r.ref === 'i:' + id));
      if(usan.length){ toast('No se puede borrar: lo usan ' + usan.slice(0, 3).map(p => p.name).join(', ') + (usan.length > 3 ? '…' : '') + '. Quítalo de esas recetas primero.', 7000); return; }
      let ok = true; try{ ok = await showConfirm({ title: 'Borrar insumo', message: '¿Borrar «' + x.name + '»?', confirmText: 'Sí, borrar', icon: '🗑️' }); }catch(e){}
      if(!ok) return;
      D().insumos = insumos().filter(y => y.id !== id); guardar(); pintarPanel(); return;
    }
    if(a === 'sumar'){
      const x = insumo(id); if(!x) return;
      f.innerHTML = '<div style="display:flex;gap:8px;align-items:center;margin-top:10px"><span>¿Cuánto llegó de <b>' + esc(x.name) + '</b>?</span>' +
        '<input type="number" id="insLlego" min="0" step="any" inputmode="decimal" placeholder="' + esc(x.unidad || 'und') + '" style="width:110px">' +
        '<button type="button" class="btn-primary" data-ins="sumarOk" data-id="' + esc(x.id) + '">Sumar</button><button type="button" class="btn-ghost" data-ins="cancelar">✕</button></div>';
      document.getElementById('insLlego').focus(); return;
    }
    if(a === 'sumarOk'){
      const x = insumo(id); if(!x) return;
      const n = num(document.getElementById('insLlego').value); if(!n || n <= 0){ toast('Escribe cuánto llegó.'); return; }
      x.stock = r3((Number(x.stock) || 0) + n); logInsumo(x, n, 'entrada');
      try{ window.ventoAuditar && window.ventoAuditar('llegó insumo', x.name + ': +' + fmtQ(n, x.unidad || 'und')); }catch(e){}
      guardar(); pintarPanel(); toast('✅ ' + x.name + ': ahora hay ' + fmtQ(x.stock, x.unidad || 'und') + '.'); return;
    }
  }

  // ---------- Arranque ----------
  function arrancar(){
    enganchar(); engancharEditor();
    const v = document.getElementById('view-inventario');
    // Cada vez que se abre Inventario, con las cantidades de ahora (vender descuenta insumos).
    if(v && 'MutationObserver' in window){ let antes = false; new MutationObserver(() => { const ve = getComputedStyle(v).display !== 'none'; if(ve && !antes) pintarPanel(); antes = ve; }).observe(v, { attributes: true, attributeFilter: ['class', 'style'] }); }
    pintarPanel();
  }
  const listo = setInterval(() => { if(D() && typeof window.invOnSale === 'function' && typeof window.recordItemHistory === 'function'){ clearInterval(listo); arrancar(); } }, 400);
  window.ventoRecetas = { insumos, receta, falta, costoReceta, descontar, pintarPanel, pintarEditor, activo };
})();
