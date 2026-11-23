/* ORDEVA · lib/vento-historial-orden.js — 1.99.47: 🗂️ El Historial más ordenado (pedido del dueño: «que se vea más
   organizado», con sus pantallazos del 23/11). No cambia lo que hace ningún botón; solo dónde está y cómo se ve:
   • Arriba: «🔒 Cerrar caja del día» y, debajo, sus herramientas en una sola fila de 3 cuadros: 💵 Caja (base, entradas y
     salidas) · 📊 Gráficas · 📗 Cierres Z (Excel). Antes eran 4 botones largos uno debajo del otro.
   • El «Resumen general» (cuentas cerradas, total vendido, total en deudas) en 3 cuadros de una fila, antes de los cierres.
   • «Cierres de caja»: se ven los 3 últimos y «Ver los N cierres ▾» (antes la lista entera empujaba las ventas muy abajo).
   • «Todos · ✅ Pagaron · ⏳ Deben» pasa junto a la lista que filtra: en «Cuentas cerradas», encima del buscador.
   • El buscador y el mes con los colores del tema (en el tema oscuro eran blancos). */
(function(){
  'use strict';
  if(window.ventoHistorialOrden) return;
  const $ = id => document.getElementById(id);
  function ordenar(){
    const v = $('view-historial'), cd = v && v.querySelector('.close-day-row'); if(!v || !cd) return;
    // 1. Herramientas de la caja en una fila
    let h = $('hoHerr');
    if(!h){ h = document.createElement('div'); h.id = 'hoHerr'; h.className = 'ho-herr'; cd.insertAdjacentElement('afterend', h); }
    ['vtCajaBtn', 'chartsToggle', 'cmCierresBtn'].forEach(id => { const b = $(id); if(b && b.parentNode !== h){ b.style.width = ''; b.style.marginTop = ''; h.appendChild(b); } });
    const orden = ['vtCajaBtn', 'chartsToggle', 'cmCierresBtn'].map($).filter(b => b && b.parentNode === h);   // siempre en este orden
    if(orden.some((b, i) => h.children[i] !== b)) orden.forEach(b => h.appendChild(b));
    const cp = $('chartsPanel'); if(cp && cp.previousElementSibling !== h && h.parentNode) h.insertAdjacentElement('afterend', cp);
    const vt = $('vtCajaBtn'); if(vt && !vt.dataset.ho){ vt.dataset.ho = '1'; vt.innerHTML = '💵 <span>Caja: base, entradas y salidas</span>'; }
    const cz = $('cmCierresBtn'); if(cz && !cz.dataset.ho){ cz.dataset.ho = '1'; cz.innerHTML = '📗 <span>Cierres Z (Excel)</span>'; cz.title = 'Cierres Z en Excel (para el contador)'; }
    // 2. Resumen general antes de los cierres
    const st = $('histSummaryTitle'), sm = $('histSummary'), ct = $('closuresTitle');
    if(st && sm && ct && st.nextElementSibling === sm && sm.nextElementSibling !== ct){ ct.insertAdjacentElement('beforebegin', st); st.insertAdjacentElement('afterend', sm); }
    // 3. Cierres: los 3 últimos y «Ver los N cierres»
    const cl = $('closuresList');
    if(cl){
      const n = cl.querySelectorAll(':scope > .hist-row').length;
      let mas = $('hoCierresMas');
      if(!mas){ mas = document.createElement('button'); mas.type = 'button'; mas.id = 'hoCierresMas'; mas.className = 'btn-ghost ho-mas';
        mas.onclick = () => { cl.classList.toggle('ho-todos'); ordenar(); }; cl.insertAdjacentElement('afterend', mas); }
      mas.hidden = n <= 3;
      const t = cl.classList.contains('ho-todos') ? 'Ver solo los últimos ▴' : 'Ver los ' + n + ' cierres ▾';
      if(mas.textContent !== t) mas.textContent = t;
    }
    // 4. Filtro de pagaron / deben junto a la lista
    const f = $('histFilter'), bus = $('histBuscarCaja');
    if(f && bus && f.nextElementSibling !== bus) bus.insertAdjacentElement('beforebegin', f);
  }
  setInterval(() => { try{ ordenar(); }catch(e){} }, 1000);
  document.addEventListener('click', ev => { if(ev.target.closest && ev.target.closest('nav button[data-view="historial"], .more-tile')) setTimeout(() => { try{ ordenar(); }catch(e){} }, 60); }, true);
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ordenar); else ordenar();

  const css = document.createElement('style');
  css.textContent =
    '#view-historial .close-day-row{margin-bottom:8px}#view-historial .close-day-row .close-day-hint{font-size:12px;margin-top:4px}' +
    '.ho-herr{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0 0 14px}' +
    '.ho-herr>.btn-ghost{display:flex!important;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-height:64px;padding:8px 6px!important;margin:0!important;width:auto!important;' +
      'font-size:12.5px!important;line-height:1.2;text-align:center;border-radius:14px!important;white-space:normal}' +
    '.ho-herr>.btn-ghost[hidden]{display:none!important}' +
    // Resumen en 3 cuadros
    // (el total vendido arriba, ancho: «$10.280.222» no cabía en un tercio y se partía)
    '#view-historial .hist-summary{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:14px}' +
    '#view-historial .hist-stat{border:1px solid var(--line);border-radius:14px;padding:10px 12px;background:var(--surface);min-width:0}' +
    '#view-historial .hist-summary>.hist-stat:nth-child(2){grid-column:1/-1;order:-1}' +
    '#view-historial .hist-stat .n{font-size:22px;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#view-historial .hist-stat .l{font-size:12px;line-height:1.2}' +
    '#view-historial .hist-summary>.hist-stat:nth-child(2) .n{font-size:26px}' +
    // Cierres: solo los 3 últimos
    '#closuresList:not(.ho-todos)>.hist-row:nth-child(n+4){display:none}' +
    '.ho-mas{width:100%;min-height:44px;margin:2px 0 14px}.ho-mas[hidden]{display:none}' +
    // Filtro junto a la lista
    '#view-historial #histFilter{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 8px}#view-historial #histFilter>.btn-ghost{flex:1 1 0;min-height:44px;margin:0;white-space:nowrap}' +
    // Buscador y mes con el tema
    '#view-historial .hist-buscar input,#view-historial .hist-buscar select{background:var(--surface)!important;color:var(--ink)!important;border:1px solid var(--line)!important;border-radius:12px!important;padding:0 12px}';
  document.head.appendChild(css);
  window.ventoHistorialOrden = { ordenar };
})();
