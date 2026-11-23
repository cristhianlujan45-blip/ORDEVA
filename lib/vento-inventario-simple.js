/* ORDEVA · lib/vento-inventario-simple.js — 1.78.1: 📦 Productos / Tarifas: simple y elegante.
   El dueño (con la pantalla de Tarifas de su hotel): «Precio y margen con foto quítalo, no me gusta dónde está; que los
   menús se vean simples pero con un diseño elegante». Ahora:
   • Arriba solo el título y una fila de HERRAMIENTAS pequeñas: «📸 Precio con foto · IA», «🧩 Unir repetidos»,
     «🛒 Pedido a proveedores» (antes «Precio y margen con foto» era una tarjeta enorme lo primero de la pantalla).
   • «➕ Agregar …» queda como lo principal; lo demás (🔢 Inventario por código, 🧂 Insumos y recetas, 🧾 Factura del
     proveedor, 🏷️ Etiquetas con código) va junto en UNA lista de una línea cada uno, como los ajustes de un celular.
   • Hoteles, hostales, apartamentos y moteles: sus tarifas no son mercancía. Sin stock (ni «agotados», ni «sin control de
     stock»), sin inventario por código, sin etiquetas, sin pedido a proveedores y sin precio con foto.
   No cambia lo que hace cada cosa: solo dónde está y cómo se ve. */
(function(){
  'use strict';
  if(window.ventoInventarioSimple) return;
  const D = () => (typeof data !== 'undefined' ? data : null);
  const $ = id => document.getElementById(id);
  const HOSP = ['hotel', 'hostal', 'apartamentos', 'motel'];
  const hospedaje = () => { const d = D(); return !!(d && HOSP.includes(d.businessType)); };
  const ORDEN = ['viPanel', 'insumosPanel', 'invFacturaPanel', 'invEtiquetasPanel'];
  const SIN_EN_HOTEL = ['viPanel', 'invEtiquetasPanel', 'insumosPanel'];

  function montar(){
    const v = $('view-inventario'), head = v && v.querySelector('.inv-head'); if(!head) return;
    const hotel = hospedaje();
    v.classList.toggle('is-hosp', hotel);
    // Herramientas
    let h = $('invHerr');
    if(!h){ h = document.createElement('div'); h.id = 'invHerr'; h.className = 'is-herr'; h.setAttribute('aria-label', 'Herramientas'); head.insertAdjacentElement('afterend', h); }
    if(!$('isFoto')){ const b = document.createElement('button'); b.type = 'button'; b.id = 'isFoto'; b.className = 'is-chip'; b.innerHTML = '📸 Precio con foto <em>IA</em>'; b.title = 'Foto de la etiqueta o del producto: te dice el costo y a cuánto venderlo'; b.onclick = () => { const x = $('invPriceBtn'); if(x) x.click(); }; h.appendChild(b); }
    ['invDup', 'llBtn'].forEach(id => { const b = $(id); if(b && b.parentNode !== h){ b.classList.add('is-chip'); b.classList.remove('btn-ghost'); h.appendChild(b); } });
    $('isFoto').hidden = hotel;
    [$('invDup'), $('llBtn')].forEach(b => { if(b) b.hidden = hotel; });
    h.hidden = ![...h.children].some(c => !c.hidden);
    // Lista de «más»
    const add = $('prodAddPanel');
    let g = $('invGrupo');
    if(!g && add){ g = document.createElement('div'); g.id = 'invGrupo'; g.className = 'is-grupo'; add.insertAdjacentElement('afterend', g); }
    if(g) ORDEN.forEach(id => { const p = $(id); if(p && p.parentNode !== g) g.appendChild(p); });
    if(g){
      ORDEN.forEach(id => { const p = $(id); if(p) p.classList.toggle('is-oculto', hotel && SIN_EN_HOTEL.includes(id)); });
      g.hidden = ![...g.children].some(c => !c.classList.contains('is-oculto') && !c.hidden && getComputedStyle(c).display !== 'none');
    }
    // Contadores de stock: solo si algún producto lleva stock (todo en 0 no dice nada).
    const sum = $('invSummary');
    if(sum){ const nums = (sum.innerText.match(/\d+/g) || []).map(Number); sum.classList.toggle('is-cero', nums.length > 0 && nums.every(n => n === 0)); }
    // «N producto(s) sin control de stock»: es un consejo, no un error.
    const av = $('invAvisos');
    if(av) [...av.children].forEach(c => c.classList.toggle('is-suave', /sin control de stock/i.test(c.textContent || '')));
    // 1.99.42 · Categorías: en UNA fila que se desliza de lado (antes 10 renglones de píldoras que empujaban los productos
    // muy abajo), con «Ver todas» para verlas juntas.
    const bar = $('categoryBar');
    if(bar){
      let cab = $('catCab');
      if(!cab){ cab = document.createElement('div'); cab.id = 'catCab'; cab.className = 'cat-cab';
        cab.innerHTML = '<span id="catCabN"></span><button type="button" id="catTodasBtn" class="cat-todas-b" aria-expanded="false">Ver todas ▾</button>';
        bar.insertAdjacentElement('beforebegin', cab);
        $('catTodasBtn').onclick = () => { const on = !bar.classList.contains('cat-todas'); bar.classList.toggle('cat-todas', on); $('catTodasBtn').textContent = on ? 'Ver menos ▴' : 'Ver todas ▾'; $('catTodasBtn').setAttribute('aria-expanded', on ? 'true' : 'false'); }; }
      const nc = ((D() || {}).categories || []).length;
      cab.hidden = nc < 4; $('catCabN').textContent = '🗂️ Categorías · ' + nc;
      if(cab.hidden) bar.classList.remove('cat-todas');
    }
    // Buscador: texto corto (antes se montaba con «3 tarifas y consumos»)
    const q = $('prodBuscar');
    if(q && !q._is){ q._is = 1; q.placeholder = '🔎 Buscar producto'; try{ if(typeof aplicarVocabulario === 'function') aplicarVocabulario(); }catch(e){} }
  }
  setInterval(() => { try{ montar(); }catch(e){} }, 1000);
  setTimeout(() => { try{ montar(); }catch(e){} }, 300);

  const css = document.createElement('style');
  css.textContent =
    // La tarjeta grande de «Precio y margen con foto» ya no se ve: su botón está en las herramientas.
    '#view-inventario #invPriceBtn{display:none!important}#view-inventario .inv-head{margin-bottom:6px}' +
    '.is-herr{display:flex;gap:8px;overflow-x:auto;padding:2px 0 12px;scrollbar-width:none}.is-herr::-webkit-scrollbar{display:none}.is-herr[hidden]{display:none}' +
    '.is-chip{flex:none;display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line)!important;background:var(--surface)!important;color:var(--ink)!important;border-radius:999px!important;padding:9px 14px!important;font:600 13.5px/1 var(--font-main,inherit)!important;cursor:pointer;box-shadow:none!important;min-height:0!important;width:auto!important;margin:0!important}' +
    '.is-chip[hidden]{display:none!important}.is-chip em{font-style:normal;font-size:10.5px;font-weight:800;padding:2px 6px;border-radius:999px;background:var(--ink);color:var(--paper,#fff)}' +
    '.is-grupo{border:1px solid var(--line);border-radius:18px;background:var(--surface);overflow:hidden;margin:10px 0 14px}.is-grupo[hidden]{display:none}' +
    '.is-grupo>details.pr-panel{border:0!important;border-radius:0!important;margin:0!important;box-shadow:none!important;background:transparent!important}' +
    '.is-grupo>details.pr-panel+details.pr-panel{border-top:1px solid var(--line)!important}.is-grupo>details.is-oculto{display:none!important}' +
    '.is-grupo>details.pr-panel>summary{padding:14px 16px!important;flex-wrap:nowrap!important;font-size:15px}.is-grupo>details.pr-panel>summary small{display:none!important}' +
    '.is-grupo>details.pr-panel>summary::after{content:"›";margin-left:auto;font-size:22px;line-height:1;color:var(--ink-soft);transition:transform .2s}.is-grupo>details.pr-panel[open]>summary::after{transform:rotate(90deg)}' +
    '#view-inventario.is-hosp #invSummary,#view-inventario.is-hosp #invAvisos{display:none!important}' +
    '#view-inventario #invSummary.is-cero{display:none!important}' +
    '#invAvisos>.is-suave{border:1px solid var(--line)!important;background:var(--surface)!important;box-shadow:none!important;border-radius:14px!important;padding:8px 12px!important;display:flex!important;align-items:center;gap:10px;flex-wrap:wrap;font-size:13.5px;color:var(--ink-soft)}' +
    '#invAvisos>.is-suave button{padding:6px 12px!important;font-size:13px!important;min-height:0!important;border-radius:999px!important}' +
    '#view-inventario #catLive{background:none!important;border:0!important;padding:2px 4px 8px!important;font-size:12.5px;color:var(--ink-soft);box-shadow:none!important}' +
    '#view-inventario .prod-buscar{position:relative}#view-inventario #prodBuscar{padding-right:118px}#view-inventario #prodBuscarN{position:absolute;right:14px;top:50%;transform:translateY(-50%);pointer-events:none;white-space:nowrap;max-width:110px;overflow:hidden;text-overflow:ellipsis}';
  // 1.99.42 · Productos más ordenado (pedido del dueño: «organiza estos menús para que se vean más organizados y fácil de usar»).
  css.textContent +=
    // Contadores de stock: 3 cuadros iguales en una fila, el número grande.
    '#view-inventario #invSummary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:6px 0 10px}' +
    '#view-inventario #invSummary .inv-chip{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:10px 12px;border-radius:14px;white-space:normal;min-width:0;background:color-mix(in srgb,currentColor 8%,transparent)}' +
    '#view-inventario #invSummary .inv-chip b{font-size:22px;line-height:1.1;font-weight:800}#view-inventario #invSummary .inv-chip small{font-size:12px;line-height:1.2;color:var(--ink-soft);overflow-wrap:anywhere}' +
    // «N producto(s) sin control de stock» en una línea, con el botón a la derecha.
    '#invAvisos>.inv-aviso{flex-wrap:nowrap!important}#invAvisos>.inv-aviso>.btn-ghost{flex:none;white-space:nowrap}' +
    // Categorías en una fila que se desliza.
    '.cat-cab{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:4px 0 2px;font-size:13px;font-weight:700;color:var(--ink-soft)}.cat-cab[hidden]{display:none}' +
    '.cat-todas-b{background:none;border:0;color:var(--amber,var(--ink));font:700 13px/1 var(--font-main,inherit);min-height:44px;padding:0 4px;cursor:pointer}' +
    '#view-inventario #categoryBar{flex-wrap:nowrap;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:none;padding:2px 0 6px;margin-bottom:12px;-webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 24px),transparent);mask-image:linear-gradient(90deg,#000 calc(100% - 24px),transparent)}' +
    '#view-inventario #categoryBar::-webkit-scrollbar{display:none}#view-inventario #categoryBar>.chip{flex:none;white-space:nowrap}' +
    '#view-inventario #categoryBar.cat-todas{flex-wrap:wrap;overflow:visible;-webkit-mask-image:none;mask-image:none}#view-inventario #categoryBar.cat-todas>.chip{white-space:normal}' +
    // La ✕ de borrar la categoría solo en la escogida.
    '#categoryBar .chip:not(.active) .chip-del{display:none}#categoryBar .chip.active .chip-del{display:inline-flex;align-items:center;justify-content:center;min-width:24px;min-height:24px;margin-left:2px;opacity:.85}';
  document.head.appendChild(css);

  window.ventoInventarioSimple = { montar, hospedaje };
})();
