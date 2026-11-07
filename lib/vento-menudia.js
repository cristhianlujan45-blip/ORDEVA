/* ORDEVA · lib/vento-menudia.js — 1.91.0: 🍲 MENÚ DEL DÍA (restaurantes, corrientazos, comida casera).
   • Arriba de las mesas: «🍲 Menú del día» con lo de hoy (o «Ponlo para hoy» si no se ha puesto). Un toque lo edita.
   • Se pone: precio, porciones (opcional), sopa, principio, proteínas (pollo, cerdo, res…), bebida y postre.
     «Igual que ayer» lo llena con el último.
   • Queda como el producto «🍲 Menú del día»: sale en la caja, en las mesas y en la carta del QR con lo que trae
     (sopa, principio, bebida…). Con varias proteínas, en la caja se elige cuál (las variantes de siempre).
   • Con porciones, se descuentan al vender y cuando se acaban sale «Agotado» (el inventario de siempre).
   • Cada día empieza sin porciones: hasta que se pone el de hoy no se vende el de ayer por error. */
(function(){
  'use strict';
  if(window.ventoMenuDia) return;
  const D = () => (typeof data !== 'undefined' ? data : null);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plata = n => { try{ return fmt(Math.round(n || 0)); }catch(e){ return '$' + Math.round(n || 0).toLocaleString('es-CO'); } };
  const toast = (t, ms) => { try{ showToast(t, ms || 5000); }catch(e){} };
  const hoy = () => { const x = new Date(); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  const ID = 'menu-dia';
  function activo(){ try{ const t = typeof tipoNegocio === 'function' ? tipoNegocio() : null; return !!(t && t.fam === 'comida'); }catch(e){ return false; } }
  const menu = () => { const d = D(); return (d && d.menuDia) || null; };
  const deHoy = () => { const m = menu(); return !!(m && m.fecha === hoy()); };
  const producto = () => { const d = D(); return d && Array.isArray(d.products) ? d.products.find(p => p.id === ID) || null : null; };
  function resumen(m){
    if(!m) return '';
    return [m.sopa ? 'Sopa: ' + m.sopa : '', m.principio ? 'Principio: ' + m.principio : '', (m.proteinas || []).length ? 'Proteína: ' + m.proteinas.join(', ') : '', m.bebida ? 'Bebida: ' + m.bebida : '', m.postre ? 'Postre: ' + m.postre : ''].filter(Boolean).join(' · ');
  }
  // Guarda el menú de hoy y lo deja como producto (caja, mesas y carta del QR).
  function poner(m){
    const d = D(); if(!d) return null;
    const precio = Math.max(0, Math.round(Number(m.precio) || 0)); if(!(precio > 0)) return null;
    const prot = (Array.isArray(m.proteinas) ? m.proteinas : String(m.proteinas || '').split(',')).map(x => String(x).trim().slice(0, 30)).filter(Boolean).slice(0, 8);
    const porc = m.porciones === '' || m.porciones == null ? null : Math.max(0, Math.round(Number(m.porciones) || 0));
    const nuevo = { fecha: hoy(), precio, porciones: porc, sopa: String(m.sopa || '').trim().slice(0, 60), principio: String(m.principio || '').trim().slice(0, 80), proteinas: prot,
      bebida: String(m.bebida || '').trim().slice(0, 40), postre: String(m.postre || '').trim().slice(0, 40), at: Date.now() };
    d.menuDia = nuevo;
    d.products = Array.isArray(d.products) ? d.products : [];
    let p = producto();
    if(!p){
      d.categories = Array.isArray(d.categories) ? d.categories : [];
      let cat = d.categories.find(c => /plato|almuerzo|men[uú]/i.test(c.name || '')); if(!cat && d.categories.length) cat = d.categories[0];
      p = { id: ID, name: '🍲 Menú del día', price: precio, categoryId: cat ? cat.id : undefined };
      d.products.unshift(p);
    }
    p.price = precio; p.det = Object.assign({}, p.det, { ingre: resumen(nuevo) });
    if(porc != null) p.stock = porc; else delete p.stock;
    if(prot.length > 1) p.variantes = prot.map(n => ({ n, stock: null, cod: '', precio: 0 })); else delete p.variantes;
    try{ saveData(); }catch(e){}
    try{ renderMesas(); }catch(e){} try{ window.renderProductos && window.renderProductos(); }catch(e){}
    pintar();
    return nuevo;
  }
  // Un día nuevo: el menú de ayer deja de venderse (porciones en 0) hasta que se pone el de hoy.
  function revisarDia(){
    const p = producto(), m = menu(); if(!p || !m || m.fecha === hoy()) return;
    if(p.stock !== 0){ p.stock = 0; try{ saveData(); }catch(e){} }
  }

  // ---------- La tarjeta arriba de las mesas ----------
  function pintar(){
    const v = document.getElementById('view-mesas'); if(!v) return;
    let c = document.getElementById('menuDiaCard');
    if(!activo()){ if(c) c.remove(); return; }
    if(!c){ c = document.createElement('button'); c.type = 'button'; c.id = 'menuDiaCard'; c.className = 'btn-ghost';
      c.style.cssText = 'display:flex;gap:10px;align-items:center;width:100%;text-align:left;margin:0 0 10px;padding:10px 12px;border-radius:14px';
      c.onclick = () => abrir(); v.insertBefore(c, v.firstChild); }
    const m = menu(), p = producto(), ok = deHoy();
    const quedan = ok && p && p.stock != null ? (p.stock > 0 ? ' · quedan ' + p.stock : ' · ⛔ agotado') : '';
    const html = '<span style="font-size:24px">🍲</span><span style="flex:1;min-width:0"><b>Menú del día' + (ok ? ' · ' + esc(plata(m.precio)) + esc(quedan) : '') + '</b><br><small style="opacity:.8">' +
      (ok ? esc(resumen(m)).slice(0, 140) || 'Toca para ponerle lo que trae' : 'Ponlo para hoy: sopa, principio, proteína…') + '</small></span><span>' + (ok ? '✏️' : '➕') + '</span>';
    if(c._h !== html){ c._h = html; c.innerHTML = html; }
  }
  function abrir(){
    const m = menu() || {}, ok = deHoy();
    const ov = document.createElement('div'); ov.className = 'overlay show cm-ov md-ov'; ov.setAttribute('data-novocab', '');
    const campo = (k, l, v, ph) => '<label style="display:block;margin:6px 0 2px;font-size:14px">' + l + '</label><input class="mz-in" data-md="' + k + '" value="' + esc(v == null ? '' : v) + '" placeholder="' + esc(ph || '') + '" style="width:100%">';
    const val = k => ok ? m[k] : '';
    ov.innerHTML = '<div class="modal cm" role="dialog" aria-modal="true"><h2 style="margin:0 0 4px">🍲 Menú del día</h2><div class="modal-sub">Sale en la caja, en las mesas y en la carta del QR.</div>' +
      (!ok && m.fecha ? '<button type="button" class="btn-ghost" data-md-igual="1" style="width:100%;margin:4px 0">↺ Igual que el último (' + esc(m.fecha) + ')</button>' : '') +
      '<div style="display:flex;gap:8px"><div style="flex:1">' + campo('precio', 'Precio', val('precio'), 'Ej. 15000') + '</div><div style="flex:1">' + campo('porciones', 'Porciones (opcional)', val('porciones'), 'Ej. 40') + '</div></div>' +
      campo('sopa', 'Sopa', val('sopa'), 'Ej. Sopa de pasta') + campo('principio', 'Principio y acompañamientos', val('principio'), 'Ej. Arroz, frijoles, maduro y ensalada') +
      campo('proteinas', 'Proteínas (separadas por coma)', (val('proteinas') || []).join ? (val('proteinas') || []).join(', ') : '', 'Ej. Pollo, Cerdo, Res') +
      campo('bebida', 'Bebida', val('bebida'), 'Ej. Jugo de mora') + campo('postre', 'Postre (opcional)', val('postre'), 'Ej. Gelatina') +
      '<div class="modal-actions"><button type="button" class="btn-ghost" data-md-no="1">Cancelar</button><button type="button" class="btn-primary" data-md-si="1">✅ Publicar el menú de hoy</button></div></div>';
    document.body.appendChild(ov);
    const set = (k, v) => { const i = ov.querySelector('[data-md="' + k + '"]'); if(i) i.value = Array.isArray(v) ? v.join(', ') : (v == null ? '' : v); };
    ov.addEventListener('click', e => {
      if(e.target === ov || e.target.closest('[data-md-no]')) return ov.remove();
      if(e.target.closest('[data-md-igual]')){ ['precio', 'porciones', 'sopa', 'principio', 'proteinas', 'bebida', 'postre'].forEach(k => set(k, m[k])); return; }
      if(e.target.closest('[data-md-si]')){
        const g = k => (ov.querySelector('[data-md="' + k + '"]') || {}).value || '';
        const r = poner({ precio: g('precio').replace(/[^\d]/g, ''), porciones: g('porciones').replace(/[^\d]/g, ''), sopa: g('sopa'), principio: g('principio'), proteinas: g('proteinas'), bebida: g('bebida'), postre: g('postre') });
        if(!r) return toast('Escribe el precio del menú.');
        ov.remove(); toast('🍲 Menú de hoy publicado: ' + plata(r.precio) + (r.porciones != null ? ' · ' + r.porciones + ' porciones' : '') + '.');
      }
    });
  }

  setTimeout(() => { try{ revisarDia(); pintar(); }catch(e){} }, 2000);
  setInterval(() => { try{ revisarDia(); pintar(); }catch(e){} }, 30000);
  window.addEventListener('vento-datos-remotos', () => { try{ pintar(); }catch(e){} });
  document.addEventListener('click', ev => { if(ev.target.closest && ev.target.closest('nav button[data-view="mesas"]')) setTimeout(pintar, 50); }, true);

  window.ventoMenuDia = { activo, menu, deHoy, poner, resumen, revisarDia, pintar, abrir, producto };
})();
