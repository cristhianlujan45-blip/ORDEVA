/* ORDEVA · lib/vento-opciones.js — 1.76.0: 🧩 Opciones del producto (término de la carne, «sin cebolla», adiciones con precio).
   • En el producto (Productos → editar → «🧩 Opciones al vender»), una línea por grupo:
        Término: Roja, Medio, Tres cuartos, Bien asada        ← elige UNA (obligatorio)
        Sin: cebolla, tomate, salsas                          ← «Sin…» y «Adiciones» se pueden elegir VARIAS
        Adiciones: Queso extra 3000, Tocineta 4000            ← el número es lo que suma al precio
        Acompañante: Papa, Yuca, Ensalada                      ← elige una
     Un grupo con «(varias)» o «(opcional)» en el nombre se puede marcar varias o dejar sin marcar.
   • Al anotar ese producto en la cuenta (botón, buscador, favorito, lector), sale «¿Cómo lo quiere?» con los grupos; el
     plato queda «Hamburguesa · Término medio · Sin cebolla · +Queso extra» con su precio, en su propia línea (otra
     combinación = otra línea) y así llega a la cocina.
   • Editar el producto no borra lo que ya se eligió en las cuentas abiertas (vuelve a calcular el precio con lo elegido). */
(function(){
  'use strict';
  if(window.ventoOpciones) return;
  const D = () => (typeof data !== 'undefined' ? data : null);
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plata = n => { try{ return fmt(n); }catch(e){ return '$' + Math.round(n || 0).toLocaleString('es-CO'); } };
  const toast = (t, ms) => { try{ showToast(t, ms || 3000); }catch(e){} };
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

  // ---------- Texto ↔ grupos ----------
  function leer(txt){
    const grupos = [];
    String(txt || '').split(/\n+/).map(l => l.trim()).filter(Boolean).forEach(l => {
      const i = l.indexOf(':'); if(i <= 0) return;
      let g = l.slice(0, i).trim(); const resto = l.slice(i + 1);
      const ng = norm(g);
      const varias = /\((varias|opcional)\)/.test(ng) || /^(sin|adicion|adiciones|extra|extras|agregados?|toppings?|acompanamientos? extra)\b/.test(ng);
      g = g.replace(/\s*\((varias|opcional|una)\)\s*/i, '').trim();
      const ops = resto.split(',').map(o => o.trim()).filter(Boolean).map(o => {
        const m = /^(.*?)\s*\+?\s*\$?\s*([\d.]+)\s*$/.exec(o);
        if(m && m[1] && /\d/.test(m[2])){ const p = Number(m[2].replace(/\./g, '')); if(isFinite(p) && p >= 100) return { n: m[1].replace(/[+\s]+$/, '').trim(), p }; }   // «Talla 38» no es un precio
        return { n: o.replace(/^\+\s*/, ''), p: 0 };
      }).filter(o => o.n).slice(0, 20);
      if(ops.length) grupos.push({ g, varias, ops });
    });
    return grupos.slice(0, 8);
  }
  const de = p => (p && Array.isArray(p.opciones) && p.opciones.length) ? p.opciones : null;
  // Lo elegido → texto del plato y lo que suma. sel = [[índices], …] por grupo.
  function armar(grupos, sel){
    const partes = []; let extra = 0;
    grupos.forEach((G, gi) => {
      const els = (sel[gi] || []).map(i => G.ops[i]).filter(Boolean);
      if(!els.length) return;
      els.forEach(o => { extra += Number(o.p) || 0; });
      const ng = norm(G.g);
      if(/^sin\b/.test(ng)) partes.push('Sin ' + els.map(o => o.n.replace(/^sin\s+/i, '')).join(', '));
      else if(G.varias) els.forEach(o => partes.push('+' + o.n));
      else partes.push(G.g + ' ' + els[0].n.charAt(0).toLowerCase() + els[0].n.slice(1));
    });
    return { txt: partes.join(' · '), extra };
  }

  // ---------- Agregar a la cuenta con opciones ----------
  // Un pedido del QR trae «Hamburguesa (Término medio · +Queso extra)»: se reconoce lo elegido con las opciones DEL NEGOCIO y
  // el precio sale de aquí (no del celular del cliente). Lo que no es una opción del producto no suma nada.
  function desdeTexto(product, txt){
    const G = de(product); if(!G) return null;
    const t = norm(txt); let extra = 0;
    G.forEach(g => g.ops.forEach(o => { if((Number(o.p) || 0) > 0 && t.includes(norm(o.n))) extra += Number(o.p) || 0; }));
    return { txt: String(txt || '').trim().slice(0, 160), extra };
  }
  function partirNombre(nombre){
    const m = /^(.+?)\s*\((.+)\)\s*$/.exec(String(nombre || '')); if(!m) return null;
    const p = ((D() || {}).products || []).find(x => norm(x.name) === norm(m[1]));
    return p && de(p) ? { product: p, opc: desdeTexto(p, m[2]) } : null;
  }
  function agregar(tableId, product, opc, qty, callado){
    const d = D(), t = d && d.tables && d.tables[tableId]; if(!t || !product) return;
    qty = Math.max(1, Number(qty) || 1);
    const size = [product.size || '', opc.txt].filter(Boolean).join(' · ');
    let it = (t.items || []).find(x => x.productId === product.id && !x.personId && x.opc && x.opc.txt === opc.txt);
    if(it){ it.qty += qty; recordItemHistory(it, qty); }
    else {
      it = { productId: product.id, name: product.name, price: (Number(product.price) || 0) + opc.extra, size, qty, personId: null, history: [], opc: { txt: opc.txt, extra: opc.extra } };
      recordItemHistory(it, qty);
      t.items.push(it);
    }
    if(!callado){ try{ noteManualChange(tableId, product.name + (opc.txt ? ' (' + opc.txt + ')' : ''), qty); }catch(e){} try{ sonidoPos('add'); }catch(e){} }
    saveData();
    try{ renderModalItems(); renderPeople(); }catch(e){}
    if(!callado) toast('✅ ' + product.name + (opc.txt ? ' · ' + opc.txt : '') + ' agregado.');
  }

  // ---------- «¿Cómo lo quiere?» ----------
  let pendiente = null;
  function elegir(product, qty, alListo){
    const G = de(product); if(!G) return false;
    pendiente = { product, qty: Math.max(1, Number(qty) || 1), alListo, sel: G.map((g, i) => []) };
    let ov = $('opOv');
    if(!ov){ ov = document.createElement('div'); ov.id = 'opOv'; ov.className = 'overlay op-ov'; ov.setAttribute('data-novocab', ''); document.body.appendChild(ov); }
    ov.innerHTML = '<div class="modal op-modal"><div class="modal-title-row"><h2>🧩 ' + esc(product.name) + '</h2><button class="rename-table-btn" data-op="cerrar" title="Cerrar">✕</button></div>' +
      '<p class="settings-desc" style="margin:0 0 8px">¿Cómo lo quiere?' + (pendiente.qty > 1 ? ' (' + pendiente.qty + ' iguales)' : '') + '</p>' +
      G.map((g, gi) => '<div class="op-g"><b>' + esc(g.g) + (g.varias ? ' <small>(puede elegir varias)</small>' : ' <small>(elija una)</small>') + '</b><div class="op-ops">' +
        g.ops.map((o, oi) => '<button type="button" class="op-o" data-op="o" data-g="' + gi + '" data-i="' + oi + '">' + esc(o.n) + (o.p ? ' <i>+' + esc(plata(o.p)) + '</i>' : '') + '</button>').join('') + '</div></div>').join('') +
      '<div class="op-msg" id="opMsg"></div><div class="modal-actions"><button type="button" class="btn-close" data-op="cerrar">Cancelar</button><button type="button" class="btn-primary" data-op="ok" id="opOk"></button></div></div>';
    pintarOk();
    ov.classList.add('show');
    return true;
  }
  function pintarOk(){
    const p = pendiente; if(!p) return;
    const G = de(p.product), a = armar(G, p.sel);
    const b = $('opOk'); if(b) b.textContent = 'Agregar ' + (p.qty > 1 ? p.qty + ' × ' : '') + plata((Number(p.product.price) || 0) + a.extra);
    document.querySelectorAll('#opOv .op-o').forEach(x => x.classList.toggle('on', (p.sel[+x.dataset.g] || []).includes(+x.dataset.i)));
  }
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('#opOv [data-op]'); if(!b) return;
    e.stopPropagation();
    const ov = $('opOv'), p = pendiente, a = b.dataset.op;
    if(a === 'cerrar'){ ov.classList.remove('show'); pendiente = null; return; }
    if(!p) return;
    const G = de(p.product);
    if(a === 'o'){
      const gi = +b.dataset.g, oi = +b.dataset.i, s = p.sel[gi];
      if(G[gi].varias){ const k = s.indexOf(oi); if(k >= 0) s.splice(k, 1); else s.push(oi); }
      else p.sel[gi] = s[0] === oi ? [] : [oi];
      $('opMsg').textContent = '';
      pintarOk(); return;
    }
    if(a === 'ok'){
      const falta = G.findIndex((g, gi) => !g.varias && !(p.sel[gi] || []).length);
      if(falta >= 0){ $('opMsg').textContent = '⚠️ Elige ' + G[falta].g.toLowerCase() + '.'; return; }
      ov.classList.remove('show');
      const opc = armar(G, p.sel); pendiente = null;
      p.alListo(opc, p.qty);
    }
  }, true);

  // ---------- Los caminos para anotar en la cuenta ----------
  const prodDe = id => ((D() || {}).products || []).find(p => p.id === id);
  function envolverFavorito(){
    const orig = window.addFavoriteToTable; if(typeof orig !== 'function' || orig._op) return;
    const nuevo = function(productId){
      const p = prodDe(productId), mesa = typeof currentTable !== 'undefined' ? currentTable : null;
      if(de(p) && mesa != null && elegir(p, 1, (opc, q) => agregar(mesa, p, opc, q))) return;
      return orig.apply(this, arguments);
    };
    // 1.85.0: lleva las marcas de los demás módulos (si no, se envolvían uno al otro sin fin: miles de capas y, a la
    // media hora de tener ORDEVA abierto, «Maximum call stack size exceeded» al cerrar una cuenta).
    for(const k in orig) if(k.charAt(0) === '_') nuevo[k] = orig[k];
    nuevo._op = true; window.addFavoriteToTable = nuevo;
  }
  // Botón «Agregar» de la cuenta (buscador + cantidad): con opciones, primero se elige.
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('#addItemBtn'); if(!b || b._opPasa) return;
    const d = D(); if(!d) return;
    let p = prodDe(($('addProductId') || {}).value);
    if(!p){ const typed = String(($('addProductSearch') || {}).value || '').trim().toLowerCase(); p = (d.products || []).find(x => x.name.toLowerCase() === typed); }
    if(!de(p)) return;
    const q = Math.max(0, parseInt(($('addQty') || {}).value, 10) || 0); if(q <= 0) return;
    e.stopImmediatePropagation(); e.preventDefault();
    const mesa = currentTable;
    elegir(p, q, (opc, n) => {
      agregar(mesa, p, opc, n);
      try{ $('addQty').value = 0; $('addProductSearch').value = ''; $('addProductId').value = ''; hideProductSuggestions(); }catch(x){}
    });
  }, true);

  // ---------- Editor en el producto ----------
  const EJEMPLO = 'Término: Roja, Medio, Tres cuartos, Bien asada\nSin: cebolla, tomate, salsas\nAdiciones: Queso extra 3000, Tocineta 4000';
  function montarEditor(){
    const save = $('editProdSaveBtn'); if(!save || $('editProdOpcWrap')) return;
    const acts = save.closest('.modal-actions'); if(!acts) return;
    const w = document.createElement('details'); w.id = 'editProdOpcWrap'; w.className = 'iv-rawtext-wrap';
    w.innerHTML = '<summary>🧩 Opciones al vender (término, «sin…», adiciones)</summary>' +
      '<div class="modal-sub" style="margin:4px 0 6px">Una línea por grupo: <b>Grupo: opción, opción</b>. El número suma al precio (Queso extra 3000). «Sin…» y «Adiciones» se pueden elegir varias; las demás, una.</div>' +
      '<textarea id="editProdOpc" rows="4" placeholder="' + esc(EJEMPLO) + '" style="width:100%;font:inherit;padding:8px;border-radius:10px;border:1px solid var(--line);background:var(--surface-2,#fff);color:var(--ink)"></textarea>' +
      '<div class="op-chips"><button type="button" class="btn-ghost" data-opx="Término: Roja, Medio, Tres cuartos, Bien asada">+ Término</button><button type="button" class="btn-ghost" data-opx="Sin: cebolla, tomate, salsas">+ Sin…</button><button type="button" class="btn-ghost" data-opx="Adiciones: Queso extra 3000, Tocineta 4000">+ Adiciones</button><button type="button" class="btn-ghost" data-opx="Acompañante: Papa, Yuca, Ensalada">+ Acompañante</button></div>' +
      '<div class="modal-sub" id="editProdOpcVer"></div>';
    acts.parentNode.insertBefore(w, acts);
    const ta = $('editProdOpc'), ver = () => { const g = leer(ta.value); $('editProdOpcVer').textContent = g.length ? '✓ ' + g.map(x => x.g + ' (' + x.ops.length + (x.varias ? ', varias' : ', una') + ')').join(' · ') : ''; };
    ta.addEventListener('input', ver);
    w.addEventListener('click', e => { const c = e.target.closest('[data-opx]'); if(!c) return; ta.value = (ta.value.trim() ? ta.value.trim() + '\n' : '') + c.dataset.opx; ver(); ta.focus(); });
  }
  function envolverEditar(){
    const orig = window.openEditProductModal; if(typeof orig !== 'function' || orig._op) return;
    const nuevo = function(productId){
      const r = orig.apply(this, arguments);
      try{ montarEditor(); const p = prodDe(productId), ta = $('editProdOpc'), w = $('editProdOpcWrap'); if(ta){ ta.value = (p && p.opcionesTxt) || ''; ta.dispatchEvent(new Event('input')); } if(w) w.open = !!(p && de(p)); }catch(e){}
      return r;
    };
    nuevo._op = true; window.openEditProductModal = nuevo;
  }
  // Al guardar el producto (antes que el guardado de siempre): las opciones quedan en el producto.
  document.addEventListener('click', e => {
    if(!(e.target.closest && e.target.closest('#editProdSaveBtn'))) return;
    let id = null; try{ id = editingProductId; }catch(x){}
    const p = prodDe(id), ta = $('editProdOpc'); if(!p || !ta) return;
    const txt = ta.value.trim(), g = leer(txt);
    if(g.length){ p.opciones = g; p.opcionesTxt = txt; } else { delete p.opciones; delete p.opcionesTxt; }
  }, true);

  envolverFavorito(); envolverEditar();
  setInterval(() => { try{ envolverFavorito(); envolverEditar(); }catch(e){} }, 1000);

  const css = document.createElement('style');
  css.textContent = '.op-modal{max-width:560px;width:min(560px,96vw);max-height:92vh;overflow:auto}.op-g{margin:8px 0 12px}.op-g b small{font-weight:500;color:var(--ink-soft)}' +
    '.op-ops{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}.op-o{min-height:44px;padding:8px 14px;border-radius:12px;border:2px solid var(--line);background:var(--surface);color:var(--ink);font:700 15px/1.2 var(--font-main,inherit);cursor:pointer}' +
    '.op-o i{font-style:normal;font-weight:600;color:var(--ink-soft);font-size:13px}.op-o.on{border-color:var(--amber);background:color-mix(in srgb,var(--amber) 20%,var(--surface))}' +
    '.op-msg{min-height:18px;font-weight:700;color:#dc2626}.op-chips{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}.op-chips .btn-ghost{padding:5px 10px;font-size:12.5px}';
  document.head.appendChild(css);

  // Para la carta del QR: las opciones de cada producto, cortas.
  function paraCarta(){
    const o = {};
    ((D() || {}).products || []).forEach(p => { const G = de(p); if(G) o[String(p.name).slice(0, 40)] = G.map(g => [String(g.g).slice(0, 24), g.varias ? 1 : 0, g.ops.slice(0, 12).map(x => [String(x.n).slice(0, 24), Math.round(Number(x.p) || 0)])]); });
    return Object.keys(o).length ? o : null;
  }
  window.ventoOpciones = { leer, armar, agregar, elegir, de, desdeTexto, partirNombre, paraCarta };
})();
