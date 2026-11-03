// 🍳 ORDEVA 1.72.3 · «Enviar a cocina» desde la cuenta de la mesa (restaurantes, bares con cocina, cafeterías…).
// Auditoría: lo que el cajero anotaba en una mesa NO llegaba a la pantalla de preparación (ni al tablero de la Cocina ni a
// preparacion.html): solo llegaban los pedidos del QR y de la app de meseros. Ahora la cuenta tiene «🍳 Enviar a Cocina»:
//  • Manda solo lo NUEVO: lo que no ha pasado ya por preparación (este botón, el QR o la app de meseros).
//  • Entra como pedido «📥 Recibido» con el mismo camino de los meseros (vitoPedidos.registrarAplicado): NO se vuelve a
//    sumar a la cuenta. Cancelarlo desde la cocina sí lo descuenta, igual que con los meseros.
//  • Solo aparece con la «Pantalla de preparación» prendida (Ajustes → 🧩 Funciones), y usa su nombre (Cocina, Barra…).
(function(){
  'use strict';
  const D = () => (typeof data !== 'undefined' ? data : null);
  const on = () => { try{ return typeof usaMod === 'function' && usaMod('k') && !!window.vitoPedidos; }catch(e){ return false; } };
  const nombre = () => { try{ return typeof prepNombre === 'function' ? prepNombre() : 'Cocina'; }catch(e){ return 'Cocina'; } };
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const clave = it => it.productId ? 'p:' + it.productId : 'n:' + norm(it.name);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Desde cuándo está abierta la cuenta: el primer producto anotado.
  const abierta = t => Math.min(...(t.items || []).map(it => (it.history && it.history[0] && Number(it.history[0].at)) || Infinity));
  // Lo que YA está en preparación: los pedidos de esta mesa desde que se abrió la cuenta, por cualquier camino (QR, app de
  // meseros, este botón), que entraron a la cuenta y no se cancelaron. No se guarda nada aparte: así nada se manda dos veces.
  function enviado(id, t){
    // Margen de 1 min (un pedido del QR se anota justo antes de sumar a la cuenta), pero nunca antes del último cobro de esta
    // mesa: lo de la cuenta anterior no cuenta aunque se vuelva a abrir enseguida.
    let ult = 0; try{ const h = (D().history || []).find(e => String(e.table) === String(id)); if(h) ult = new Date(h.date).getTime() || 0; }catch(e){}
    const ab = abierta(t);
    // 1.75.0: si se quitó TODO de la cuenta (sin cobrarla), igual cuenta lo mandado en las últimas 12 horas.
    const desde = isFinite(ab) ? Math.max(ab - 60e3, ult) : Math.max(ult, Date.now() - 12 * 36e5), env = {};
    if(!isFinite(desde)) return env;
    let L = []; try{ L = window.vitoPedidos.lista() || []; }catch(e){}
    L.forEach(p => { if(String(p.mesa) !== String(id) || !p.aplicado || p.estado === 'cancelado' || (p.recibidoEn || p.at || 0) < desde) return;
      (p.items || []).forEach(i => {
        if(i.ok === false) return;
        // 1.75.0: una anulación ya avisada resta lo que se había mandado (así no se vuelve a pedir anular).
        if(p.anula && i.anulaK){ env[i.anulaK] = (env[i.anulaK] || 0) - (Number(i.qty) || 0); return; }
        const k = clave(i); env[k] = (env[k] || 0) + (Number(i.qty) || 0); if(!env['#' + k]) env['#' + k] = i.name;
      }); });
    return env;
  }
  // 1.75.0 · Lo que se quitó de la cuenta DESPUÉS de mandarlo a preparación: hay que avisar para que no lo preparen.
  function sobrantes(id, t){
    if(!t) return [];
    const env = enviado(id, t), tot = {};
    (t.items || []).forEach(it => { if(!it || !it.name) return; const k = clave(it); tot[k] = (tot[k] || 0) + (Number(it.qty) || 0); });
    return Object.keys(env).filter(k => k[0] !== '#' && env[k] - (tot[k] || 0) > 0).map(k => ({ k, name: env['#' + k] || k.replace(/^[pn]:/, ''), qty: env[k] - (tot[k] || 0) }));
  }
  function anular(id){
    const d = D(), t = d && d.tables && d.tables[id]; if(!t) return null;
    const L = sobrantes(id, t); const P = window.vitoPedidos; if(!L.length || !P || !P.guardar) return null;
    let quien = 'Caja'; try{ if(typeof authUser !== 'undefined' && authUser) quien = String(authUser).slice(0, 20); }catch(e){}
    const ahora = Date.now();
    // Entra como un pedido más (la cocina lo ve y lo marca), pero NO toca la cuenta: pedidoCambiar lo deja quieto (p.anula).
    const p = { id: 'x' + ahora.toString(36) + Math.random().toString(36).slice(2, 5), mesa: parseInt(id, 10), mesaNombre: tableLabel(id),
      items: L.map(x => ({ productId: null, name: '❌ ANULAR ' + x.name, anulaK: x.k, qty: x.qty, price: 0, ok: true })), total: 0,
      at: ahora, recibidoEn: ahora, estado: 'recibido', origen: quien, negocio: (window.vitoQCfg ? (window.vitoQCfg() || {}).topic : undefined),
      aplicado: true, anula: true, nota: '❌ ANULAR: ya no lo preparen (se quitó de la cuenta)', hist: [{ e: 'recibido', at: ahora }] };
    P.lista().push(p);
    P.guardar();
    const txt = L.map(x => x.qty + ' ' + x.name).join(', ');
    try{ showToast('❌ Avisado a ' + nombre() + ': no preparar ' + txt); }catch(e){}
    try{ window.ventoAuditar && window.ventoAuditar('anulado en ' + nombre(), tableLabel(id) + ': ' + txt.slice(0, 200), [id]); }catch(e){}
    pintar(true);
    return p;
  }
  // Lo que falta mandar: cantidad en la cuenta − lo ya enviado, por producto (sin la propina ni renglones sin nombre).
  function pendientes(id, t){
    if(!t || !(t.items || []).length) return [];
    const env = enviado(id, t), tot = {};
    t.items.forEach(it => { if(!it || !it.name || /propina/i.test(it.name)) return; const k = clave(it); tot[k] = tot[k] || { name: it.name, qty: 0 }; tot[k].qty += Number(it.qty) || 0; });
    return Object.keys(tot).map(k => ({ k, name: tot[k].name, qty: tot[k].qty - (env[k] || 0) })).filter(x => x.qty > 0);
  }
  function enviar(id){
    const d = D(), t = d && d.tables && d.tables[id]; if(!t) return null;
    const L = pendientes(id, t); if(!L.length) return null;
    let quien = 'Caja'; try{ if(typeof authUser !== 'undefined' && authUser) quien = String(authUser).slice(0, 20); }catch(e){}
    const p = window.vitoPedidos.registrarAplicado(id, L.map(x => ({ name: x.name, qty: x.qty })), quien);
    if(!p) return null;
    const txt = L.map(x => x.qty + ' ' + x.name).join(', ');
    try{ showToast('🍳 A ' + nombre() + ': ' + txt); }catch(e){}
    try{ window.ventoAuditar && window.ventoAuditar('enviado a ' + nombre(), tableLabel(id) + ': ' + txt.slice(0, 200), [id]); }catch(e){}
    pintar(true);
    return p;
  }
  function pintar(forzar){
    const ov = document.getElementById('overlay'), d = D();
    const id = typeof currentTable !== 'undefined' ? currentTable : null, t = id != null && d && d.tables ? d.tables[id] : null;
    let box = document.getElementById('ckCocina');
    if(!on() || !ov || !ov.classList.contains('show') || !t || (!(t.items || []).length && !sobrantes(id, t).length)){ if(box) box.hidden = true; return; }
    const cont = document.getElementById('itemsContainer'); if(!cont || !cont.parentNode) return;
    if(!box){ box = document.createElement('div'); box.id = 'ckCocina'; box.className = 'ck-cocina'; }
    // Va justo encima de los productos (debajo de las noches del hotel si las hay).
    if(box.parentNode !== cont.parentNode) cont.parentNode.insertBefore(box, cont);
    const L = pendientes(id, t), n = L.reduce((s, x) => s + x.qty, 0), S = sobrantes(id, t);
    const anu = S.length ? '<button type="button" class="ck-btn ck-anu" data-ck="anular">❌ Avisar a ' + esc(nombre()) + ': no preparar</button><small class="ck-que">' + esc('Quitaste ' + S.map(x => x.qty + ' ' + x.name).join(', ').slice(0, 140) + ' que ya estaba en ' + nombre()) + '</small>' : '';
    const html = anu + (L.length
      ? '<button type="button" class="ck-btn" data-ck="enviar">🍳 Enviar a ' + esc(nombre()) + ' <b>' + n + (n === 1 ? ' nuevo' : ' nuevos') + '</b></button><small class="ck-que">' + esc(L.map(x => x.qty + ' ' + x.name).join(', ').slice(0, 140)) + '</small>'
      : (S.length ? '' : '<span class="ck-ok">✅ Todo está en ' + esc(nombre()) + '</span>'));
    if(forzar || box._h !== html){ box._h = html; box.innerHTML = html; }
    box.hidden = false;
  }
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('#ckCocina [data-ck]'); if(!b) return;
    e.stopPropagation();
    if(Date.now() - (b._t || 0) < 1500) return; b._t = Date.now();   // un doble toque no manda dos comandas
    if(b.dataset.ck === 'anular') anular(currentTable); else enviar(currentTable);
  }, true);
  setInterval(() => { try{ pintar(); }catch(e){} }, 500);
  const css = document.createElement('style');
  css.textContent = '.ck-cocina{margin:4px 0 10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}.ck-cocina[hidden]{display:none}' +
    '.ck-btn{border:0;border-radius:12px;padding:10px 14px;background:#ea580c;color:#fff;font:800 14.5px/1.2 var(--font-main,inherit);cursor:pointer;box-shadow:0 2px 0 rgba(0,0,0,.15)}.ck-btn b{margin-left:4px;padding:2px 8px;border-radius:999px;background:rgba(255,255,255,.25)}' +
    '.ck-btn.ck-anu{background:#dc2626}.ck-que{color:var(--ink-soft);font-size:12.5px;flex:1;min-width:160px}.ck-ok{font-size:13px;color:var(--ink-soft)}';
  document.head.appendChild(css);
  window.ventoComanda = { pendientes, enviar, sobrantes, anular, pintar, on };
})();
