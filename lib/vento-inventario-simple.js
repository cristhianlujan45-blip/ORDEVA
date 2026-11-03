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
  document.head.appendChild(css);

  window.ventoInventarioSimple = { montar, hospedaje };
})();
