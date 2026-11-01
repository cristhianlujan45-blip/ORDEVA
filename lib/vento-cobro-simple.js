// 💰 ORDEVA 1.72.5 · Cobrar una cuenta (mesa, habitación, silla…) en un solo paso. Pedido del dueño: «simplifica el cobro».
// Antes había TRES caminos que se pisaban: «💰 Cobrar todo y liberar mesa» (sin vuelto), el cuadro «Registrar un pago o
// abono» y el «Cobrar» de abajo (que solo llenaba ese cuadro y dejaba la mesa abierta). Ahora:
//  • Un solo botón: «💰 Cobrar $35.500» → la misma ventana de cobro de la Caja POS (¿con cuánto paga? con el vuelto en
//    grande, efectivo, Nequi, DaviPlata, transferencia, tarjeta, pago mixto, fiado con el nombre, y el teclado).
//    Al pagar, la mesa queda cobrada y libre, con «Deshacer». La propina y los clientes frecuentes siguen igual.
//  • El «Cobrar» de abajo (vista sencilla) hace lo mismo; el de la izquierda se esconde ahí para no repetir.
//  • Abonos, pagar por partes o por persona: «➕ Abono o dividir la cuenta» (plegado). No se quitó nada.
//  • Si ya pagaron todo con abonos: «✅ Cerrar la cuenta (ya pagaron)».
(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  const abiertos = new Set();   // cuentas donde se abrió «Abono o dividir» (se queda abierto mientras la cuenta esté abierta)
  const plata = n => { try{ return typeof fmt === 'function' ? fmt(n) : '$' + Math.round(n).toLocaleString('es-CO'); }catch(e){ return '$' + n; } };
  function pintar(){
    const ov = $('overlay'); if(!ov || !ov.classList.contains('show')) return;
    const id = typeof currentTable !== 'undefined' ? currentTable : null; if(id == null || typeof data === 'undefined' || !data.tables[id]) return;
    const t = data.tables[id], hay = !!(t.items && t.items.length);
    let saldo = 0; try{ saldo = tableBalance(id); }catch(e){}
    // El botón principal dice cuánto se cobra.
    const cb = $('chargeBtn');
    if(cb){ const txt = !hay ? '💰 Cobrar' : saldo > 0 ? '💰 Cobrar ' + plata(saldo) : '✅ Cerrar la cuenta (ya pagaron)'; if(cb.textContent !== txt) cb.textContent = txt; }
    // El «Cobrar» de abajo hace lo mismo que el principal (antes solo llenaba el cuadro de abonos).
    const vb = $('vsCobrarBtn');
    if(vb && !vb._simple){ vb._simple = true; vb.onclick = () => { const c = $('chargeBtn'); if(c && !c.disabled) c.click(); }; }
    if(vb){ const txt = saldo > 0 || !hay ? 'Cobrar' : 'Cerrar cuenta'; if(vb.textContent !== txt) vb.textContent = txt; vb.disabled = !hay; }
    // «Registrar un pago o abono»: plegado detrás de «➕ Abono o dividir la cuenta».
    const card = document.querySelector('#overlay .pay-card[data-scope="table"]');
    if(card){
      let tg = $('csAbono');
      if(!tg){
        tg = document.createElement('button'); tg.type = 'button'; tg.id = 'csAbono'; tg.className = 'btn-ghost cs-abono';
        card.parentNode.insertBefore(tg, card);
        tg.onclick = () => { const k = String(currentTable); if(abiertos.has(k)) abiertos.delete(k); else abiertos.add(k); pintar(); if(abiertos.has(k)) try{ card.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }catch(e){} };
      }
      const abierto = abiertos.has(String(id));
      card.classList.toggle('cs-plegado', !abierto);
      const txt = abierto ? '▲ Ocultar abono / dividir' : '➕ Abono o dividir la cuenta';
      if(tg.textContent !== txt) tg.textContent = txt;
      tg.hidden = !hay;
    }
    // Cuenta cobrada y libre: se olvida que estaba abierto el abono.
    Object.keys(data.tables).forEach(k => { if(!(data.tables[k].items || []).length) abiertos.delete(String(k)); });
  }
  setInterval(() => { try{ pintar(); }catch(e){} }, 300);
  const css = document.createElement('style');
  css.textContent = '#overlay .pay-card.cs-plegado{display:none!important}' +
    '.cs-abono{width:100%;margin:6px 0;padding:10px 12px;border-radius:12px;border:1px dashed var(--line);background:transparent;color:var(--ink);font:700 14px/1.2 var(--font-main,inherit);cursor:pointer}' +
    // Con la barra de abajo («Falta por pagar · Cobrar»), el botón de la izquierda sobra.
    'body.vs-on #overlay #chargeBtn{display:none!important}';
  document.head.appendChild(css);
  window.ventoCobroSimple = { pintar };
})();
