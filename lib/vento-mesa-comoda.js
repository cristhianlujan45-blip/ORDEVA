/* =====================================================================
   ORDEVA 1.71.0 · La cuenta de una mesa, cómoda en celular, tableta y computador
   Pedido del dueño: «cuando abro una mesa, que se vea todo sin estar desplazándome hacia arriba y hacia abajo».
   • Tableta y computador (desde 760 px de ancho): la ventana usa la pantalla y va en DOS columnas.
     - Izquierda: buscar y agregar, lo pedido (con sus + / −), el total y personas / cliente.
     - Derecha: registrar un pago o abono, los pagos, consumo / pagado / saldo, compartir, y Cobrar.
     Cada columna se desplaza sola solo si hace falta; el título y las opciones quedan arriba.
   • Celular: una columna como siempre, pero más compacta (menos espacio entre partes, el registro de pago más bajo) y
     el título con «⋯ Opciones» fijo arriba; «Cobrar» ya queda fijo abajo (lib/vento-sencilla.js).
   • Los botones − / + de cada producto se ven en todos los diseños (en ORDEVA 2.0 salían como cuadros negros).
   No cambia nada de lo que hace la cuenta: solo mueve las partes (con sus mismos id) a dos columnas.
   ===================================================================== */
(function(){
  'use strict';
  if(window.ventoMesaComoda) return;

  const css = document.createElement('style');
  css.id = 'ventoMesaComodaCss';
  const M = ':is(#overlay .mesa-modal,#personOverlay>.modal)';
  css.textContent =
    // − / + de cada producto: visibles en todos los diseños y más fáciles de tocar
    '.li-qty-btn{background:var(--surface-2,var(--surface))!important;color:var(--ink)!important;border:1px solid var(--line)!important;width:30px!important;height:30px!important;border-radius:9px!important;font-size:17px!important}' +
    '.li-qty-btn:active{background:var(--ink)!important;color:var(--surface,#fff)!important}' +
    '.li-qty-val{color:var(--ink)!important;font-weight:700}' +
    // Las dos columnas son «transparentes» en el celular (todo queda en una columna, como siempre)
    M+'>.mc-a,'+M+'>.mc-b{display:contents}' +
    // ---------- Celular: más compacto, el título fijo arriba ----------
    '@media (max-width:759px){' +
      M+'{padding-top:0}' +
      M+'>:is(.mesa-head,.mc-h){position:sticky;top:0;z-index:7;background:var(--paper,var(--surface));margin:0 -22px 6px;padding:12px 22px 8px;border-bottom:1px solid var(--line)}' +
      M+' .modal-sub{margin-bottom:0}' +
      M+' .section-divider{margin:12px 0 6px}' +
      M+' .pay-card{padding:10px 12px;margin-bottom:8px}' +
      M+' .pay-card-title small{display:none}' +
      M+' .pay-card>*{margin-top:6px!important;margin-bottom:0!important}' +
      M+' .pay-methods{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(0,1fr));gap:6px}' +
      'body '+M+' .pay-methods button{min-height:50px!important;font-size:12.5px!important;padding:4px 2px!important}' +
      M+' .total-row.sub{padding:2px 0}' +
      M+' .share-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(0,1fr));gap:6px}' +
      M+' .share-row .btn-ghost{margin:0;padding:8px 6px;font-size:12.5px}' +
    '}' +
    // ---------- Tableta y computador: dos columnas que llenan la pantalla ----------
    '@media (min-width:760px){' +
      ':is(#overlay,#personOverlay).show{align-items:center}' +
      M+'.mc{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(330px,1fr);grid-template-rows:auto minmax(0,1fr);column-gap:24px;' +
        'width:min(1280px,calc(100vw - 24px));max-width:none!important;height:calc(100dvh - 24px);max-height:none!important;overflow:hidden;padding:18px 22px 14px}' +
      M+'.mc>:is(.mesa-head,.mc-h){grid-column:1/-1;margin-bottom:10px}' +
      M+'.mc>.mc-a,'+M+'.mc>.mc-b{display:block;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:2px 6px 6px 2px}' +
      M+'.mc>.mc-b{border-left:1px solid var(--line);padding-left:20px;display:flex;flex-direction:column}' +
      M+'.mc>.mc-b>*{flex:none}' +
      M+'.mc>.mc-b>.section-divider:first-child{margin-top:0;border-top:0}' +
      // Derecha: primero lo pagado y lo que falta (lo que más se mira), luego registrar un pago; «Cobrar» abajo
      M+'.mc>.mc-b>*{order:3}' +
      M+'.mc>.mc-b>.mc-pagos-t{order:0;margin-top:0;border-top:0}' +
      M+'.mc>.mc-b>:is(#paymentsContainer,#personPaymentsContainer){order:1}' +
      M+'.mc>.mc-b>.total-row{order:2}' +
      M+'.mc>.mc-b>.total-row:not(.sub){margin-bottom:10px}' +
      M+'.mc>.mc-b>#vsCobrar{order:9}' +
      // Izquierda, debajo de lo pedido: compartir y cerrar / cobrar todo
      M+'.mc>.mc-a>.mc-pie{margin-top:14px;padding-top:10px;border-top:1px solid var(--line)}' +
      M+'.mc>.mc-a>.mc-pie .section-divider{display:none}' +
      // Registrar un pago, más bajo: «¿Quién paga?» y «¿Con cuánto paga?» lado a lado; los botones de abajo en una fila
      M+'.mc .pay-card{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);column-gap:8px;align-items:center}' +
      M+'.mc .pay-card>*{grid-column:1/-1}' +
      M+'.mc .pay-card>.pay-in{grid-column:1}'+M+'.mc .pay-card>.pay-amount{grid-column:2}' +
      M+'.mc .pay-card>.pay-extra{grid-column:1;display:flex;gap:6px}'+M+'.mc .pay-card>.pay-extra>button{flex:1;min-width:0;padding-left:4px;padding-right:4px;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      M+'.mc .pay-card>.pay-go{grid-column:2}' +
      M+'.mc>.mc-a>.mc-pie .share-row{display:flex;flex-wrap:wrap;gap:6px}'+M+'.mc>.mc-a>.mc-pie .share-row .btn-ghost{flex:1 1 180px;margin:0}' +
      // «Cobrar» siempre abajo de la columna de la derecha
      M+'.mc>.mc-b>#vsCobrar{position:sticky;bottom:-6px;margin-top:auto}' +
      M+'.mc :is(#itemsContainer,#personItemsContainer){min-height:60px}' +
      M+'.mc .modal-actions{margin-top:8px}' +
    '}' +
    // Computador con poca altura (portátil 768 px): un poco más compacto
    '@media (min-width:760px) and (max-height:820px){' +
      M+'.mc .pay-card-title small{display:none}' +
      M+'.mc .section-divider{margin:10px 0 6px}' +
      M+'.mc .pay-card{padding:10px 12px}' +
      M+'.mc .pay-card>*{margin-top:6px!important;margin-bottom:0!important}' +
      // Buscar / agregar más bajo
      M+'.mc .mesa-buscar{padding:8px 10px!important;margin-bottom:6px}' +
      M+'.mc .mesa-buscar .add-row{gap:8px!important}' +
      M+'.mc .product-search-wrap input[type=text]{height:44px!important}' +
      M+'.mc .mesa-buscar .qty-stepper button,'+M+'.mc :is(#addItemBtn,#personAddItemBtn){min-height:40px!important;height:40px!important}' +
      M+'.mc>:is(.mesa-head,.mc-h){margin-bottom:6px}' +
    '}';
  document.head.appendChild(css);

  // Parte una ventana en dos columnas (una sola vez): lo de pedir (hasta antes de «Dividir cuenta» / «Pagos registrados»)
  // a la izquierda; lo de pagar a la derecha. Lo que otros módulos agreguen después a la ventana va a la derecha.
  // Sirve para la cuenta de la mesa (#overlay) y la cuenta de una persona dentro de la mesa (#personOverlay).
  const ancho = window.matchMedia('(min-width:760px)');
  function partir(m, cfg){
    if(!m) return false;
    if(m.querySelector(':scope > .mc-a')) return true;
    // Encabezado (título y opciones): la cuenta de la mesa ya lo tiene; en la de la persona se arma con lo de arriba.
    let head = m.querySelector(':scope > .mesa-head');
    if(!head){
      head = document.createElement('div'); head.className = 'mc-h';
      const antes = []; for(const k of [...m.children]){ if(k.classList.contains('add-row') || k.classList.contains('mesa-buscar')) break; antes.push(k); }
      if(antes.length){ antes[0].before(head); antes.forEach(k => head.appendChild(k)); } else { m.prepend(head); }
    }
    const a = document.createElement('div'), b = document.createElement('div');
    a.className = 'mc-a'; b.className = 'mc-b';
    a.setAttribute('aria-label', 'Lo pedido'); b.setAttribute('aria-label', 'Pagos y cobro');
    let derecha = false;
    [...m.children].forEach(k => {
      if(k === head) return;
      if(k.classList.contains('section-divider') && /Pagos registrados|Pagos de|Pagos$/i.test(k.textContent.trim())) k.classList.add('mc-pagos-t');
      if(!derecha && k.classList.contains('section-divider')) derecha = true;
      (derecha ? b : a).appendChild(k);
    });
    if(!b.querySelector(':scope > .mc-pagos-t')){ const d = b.querySelector(':scope > .section-divider'); if(d) d.classList.add('mc-pagos-t'); }
    head.after(a); a.after(b);
    m.classList.add('mc');
    // Compartir y cerrar / cobrar todo: en tableta y computador van debajo de lo pedido (izquierda); en el celular se
    // quedan donde siempre (al final). Se mueven con su mismo id: no cambia lo que hacen.
    const pie = document.createElement('div'); pie.className = 'mc-pie';
    const partes = [...b.children].filter(k => k.classList.contains('share-row') || k.classList.contains('modal-actions') || (k.classList.contains('section-divider') && /Compartir/i.test(k.textContent)));
    const marca = document.createComment('mc-pie');
    if(partes.length) partes[0].before(marca);
    // Textos de ayuda más cortos cuando los dos campos van lado a lado (si no, se cortaban).
    const cortos = (cfg.cortos || []).map(x => { const el = document.getElementById(x[0]); return el ? [el, el.placeholder, x[1]] : null; }).filter(Boolean);
    const acomodar = () => {
      if(partes.length){
        if(ancho.matches){ if(pie.parentNode !== a){ partes.forEach(x => pie.appendChild(x)); a.appendChild(pie); } }
        else if(pie.parentNode === a){ partes.forEach(x => marca.parentNode.insertBefore(x, marca)); pie.remove(); }
      }
      cortos.forEach(x => { x[0].placeholder = ancho.matches ? x[2] : x[1]; });
    };
    acomodar();
    try{ ancho.addEventListener('change', acomodar); }catch(e){ try{ ancho.addListener(acomodar); }catch(x){} }
    // Lo que se agregue después directo a la ventana (ej. «Cobrar» de la vista sencilla) va al final de la derecha.
    new MutationObserver(ms => ms.forEach(x => x.addedNodes.forEach(n => {
      if(n.nodeType === 1 && n !== a && n !== b && n !== head && n.parentNode === m) b.appendChild(n);
    }))).observe(m, { childList: true });
    return true;
  }
  function montar(){
    partir(document.querySelector('#overlay .mesa-modal'), { cortos: [['paymentNote', '¿Quién paga? (opcional)'], ['paymentAmount', '¿Con cuánto paga?']] });
    partir(document.querySelector('#personOverlay > .modal'), { cortos: [['personPaymentNote', '¿Quién paga? (opcional)'], ['personPaymentAmount', '¿Con cuánto paga?']] });
    return true;
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();
  // Por si las ventanas se arman más tarde: se intenta otra vez al abrir una cuenta.
  const envolver = nombre => {
    const o = window[nombre]; if(typeof o !== 'function' || o.__mc) return;
    const w = function(){ montar(); return o.apply(this, arguments); }; w.__mc = true; window[nombre] = w;
  };
  const todo = () => { envolver('openTableModal'); envolver('openPersonModal'); };
  todo(); setTimeout(todo, 0);
  window.ventoMesaComoda = { montar };
})();
