/* ORDEVA · lib/vento-pedidos-tienda.js — 1.95.2: 🛍️ Pedidos del QR en las tiendas (y en los negocios sin pantalla de cocina
   que no son de comida ni bar: minimercados, droguerías, ferreterías…).
   • Llega un pedido → aparece abajo «🛒 Pedido nuevo · Cuenta 2» con lo que pidió, el total y dos botones grandes:
     «✅ Aceptar» (entra a la cuenta y queda «Aceptado: lo estamos alistando») y «❌ Rechazar» (pregunta antes). «Después» lo
     esconde hasta que llegue otro.
   • «🛍️ Pedidos» (desde la campana, el aviso de abajo o el Inicio): por aceptar, aceptados por entregar («📦 Entregado» o
     cancelar) y los de hoy.
   • El cliente ve en su celular cada paso: «Esperando que lo acepten», «Aceptado: lo estamos alistando», «Entregado» o
     «Rechazado». Nada pasa por la cocina. */
(function(){
  'use strict';
  if(window.ventoPedidosTienda) return;
  const P = () => window.vitoPedidos || null;
  const simple = () => { try{ return !!(P() && P().simple && P().simple()); }catch(e){ return false; } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plata = n => { try{ return fmt(Math.round(n || 0)); }catch(e){ return '$' + Math.round(n || 0).toLocaleString('es-CO'); } };
  const toast = (t, ms) => { try{ showToast(t, ms || 5000); }catch(e){} };
  const nombre = p => { try{ return tableLabel(p.mesa); }catch(e){ return p.mesaNombre || ('Cuenta ' + p.mesa); } };
  const hace = p => { const m = Math.max(0, Math.round((Date.now() - (p.recibidoEn || p.at || Date.now())) / 6e4)); return m ? 'hace ' + m + ' min' : 'ahora'; };
  const lista = () => { try{ return P() ? P().lista() : []; }catch(e){ return []; } };
  const nuevos = () => lista().filter(p => p.estado === 'nuevo').sort((a, b) => (a.recibidoEn || a.at) - (b.recibidoEn || b.at));
  const aceptados = () => lista().filter(p => ['recibido', 'preparacion', 'listo'].includes(p.estado)).sort((a, b) => (a.recibidoEn || a.at) - (b.recibidoEn || b.at));
  const itemsHtml = p => (p.items || []).map(i => '<div class="pt-it"><span>' + i.qty + ' × ' + esc(i.name) + (i.ok === false ? ' ⚠️' : '') + '</span><b>' + (i.price ? plata(i.price * i.qty) : '') + '</b></div>').join('');
  const total = p => (p.items || []).reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 0), 0);

  async function confirmar(titulo, mensaje, si){
    try{ if(typeof showConfirm === 'function') return await showConfirm({ title: titulo, message: mensaje, confirmText: si, cancelText: 'No', icon: '❌' }); }catch(e){}
    return confirm(mensaje);
  }
  function aceptar(id){
    const x = P() && P().cambiar(id, 'recibido'); if(!x) return null;
    toast('✅ Pedido aceptado: quedó en ' + nombre(x) + '. El cliente ya lo ve «Aceptado».', 5000);
    pintarTodo(); return x;
  }
  async function rechazar(id, sinPreguntar){
    const p = lista().find(x => x.id === id); if(!p) return null;
    if(!sinPreguntar && !(await confirmar('Rechazar el pedido', '¿Rechazar el pedido de ' + nombre(p) + '? Al cliente le sale «Rechazado».' + (p.aplicado ? ' Lo que ya estaba en la cuenta se descuenta.' : ''), 'Sí, rechazar'))) return null;
    const x = P().cambiar(id, 'cancelado'); toast('❌ Pedido rechazado.', 3500); pintarTodo(); return x;
  }
  function entregado(id){ const x = P() && P().cambiar(id, 'entregado'); if(x) toast('📦 Entregado: ' + nombre(x) + '.', 3500); pintarTodo(); return x; }

  // ---------- Aviso de abajo (pedidos nuevos) ----------
  const despues = {};
  function pintarHoja(){
    let h = document.getElementById('ptHoja');
    const l = simple() ? nuevos().filter(p => !despues[p.id]) : [];
    document.body.classList.toggle('pt-hoja-on', !!l.length);   // el micrófono y el asistente flotantes no tapan los botones
    if(!l.length){ if(h) h.remove(); return; }
    if(!h){
      h = document.createElement('div'); h.id = 'ptHoja'; h.className = 'pt-hoja'; h.setAttribute('role', 'region'); h.setAttribute('aria-label', 'Pedidos nuevos'); h.setAttribute('data-novocab', '');
      document.body.appendChild(h);
      h.addEventListener('click', ev => {
        const b = ev.target.closest('[data-pt]'); if(!b) return;
        const id = b.closest('[data-id]') ? b.closest('[data-id]').dataset.id : null;
        if(b.dataset.pt === 'ok') aceptar(id);
        else if(b.dataset.pt === 'no') rechazar(id);
        else if(b.dataset.pt === 'luego'){ nuevos().forEach(p => { despues[p.id] = 1; }); pintarHoja(); }
        else if(b.dataset.pt === 'todos') panel();
      });
    }
    const p = l[0], firma = l.map(x => x.id).join(',') + '|' + hace(p);
    if(h.dataset.f === firma) return; h.dataset.f = firma;
    h.innerHTML = '<div class="pt-card" data-id="' + esc(p.id) + '">' +
      '<div class="pt-h"><b>🛒 Pedido nuevo · ' + esc(nombre(p)) + '</b><small>' + (p.origen === 'qr' ? '📱 QR · ' : '') + esc(hace(p)) + '</small></div>' +
      (p.sinCodigo ? '<div class="pt-ojo">⚠️ Este pedido no trae el código del QR de esa cuenta: confírmalo con el cliente antes de aceptarlo.</div>' : '') +
      '<div class="pt-its">' + itemsHtml(p) + '</div>' + (p.nota ? '<div class="pt-nota">📝 ' + esc(p.nota) + '</div>' : '') +
      '<div class="pt-tot"><span>Total</span><b>' + plata(total(p)) + '</b></div>' +
      '<div class="pt-acts"><button type="button" class="pt-no" data-pt="no">❌ Rechazar</button><button type="button" class="pt-ok" data-pt="ok">✅ Aceptar</button></div>' +
      '<div class="pt-pie">' + (l.length > 1 ? '<button type="button" data-pt="todos">Ver los ' + l.length + ' pedidos</button>' : '<button type="button" data-pt="todos">🛍️ Pedidos</button>') + '<button type="button" data-pt="luego">Después</button></div></div>';
  }

  // ---------- Panel «🛍️ Pedidos» ----------
  function panel(){
    let ov = document.getElementById('ptOv');
    if(!ov){
      ov = document.createElement('div'); ov.className = 'overlay pt-ov'; ov.id = 'ptOv'; ov.setAttribute('data-novocab', ''); document.body.appendChild(ov);
      ov.addEventListener('click', async ev => {
        if(ev.target === ov){ ov.classList.remove('show'); return; }
        const b = ev.target.closest('[data-pt]'); if(!b) return;
        const id = b.closest('[data-id]') ? b.closest('[data-id]').dataset.id : null;
        if(b.dataset.pt === 'x'){ ov.classList.remove('show'); return; }
        if(b.dataset.pt === 'ok') aceptar(id);
        else if(b.dataset.pt === 'no') await rechazar(id);
        else if(b.dataset.pt === 'ent') entregado(id);
        else if(b.dataset.pt === 'cuenta'){ const p = lista().find(x => x.id === id); ov.classList.remove('show'); try{ openTableModal(p.mesa); }catch(e){} return; }
        pintarPanel();
      });
    }
    pintarPanel(); ov.classList.add('show');
  }
  function pintarPanel(){
    const ov = document.getElementById('ptOv'); if(!ov) return;
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const hechos = lista().filter(p => ['entregado', 'cancelado'].includes(p.estado) && (p.recibidoEn || p.at) >= hoy.getTime()).slice(-15).reverse();
    const est = p => { try{ return P().estNombre(p.estado); }catch(e){ return p.estado; } };
    const tarjeta = (p, acts) => '<div class="pt-card pt-fila" data-id="' + esc(p.id) + '"><div class="pt-h"><b>' + esc(nombre(p)) + '</b><small>' + esc(hace(p)) + ' · ' + esc(est(p)) + '</small></div>' +
      (p.sinCodigo && p.estado === 'nuevo' ? '<div class="pt-ojo">⚠️ Sin el código del QR: confírmalo con el cliente.</div>' : '') +
      '<div class="pt-its">' + itemsHtml(p) + '</div>' + (p.nota ? '<div class="pt-nota">📝 ' + esc(p.nota) + '</div>' : '') +
      '<div class="pt-tot"><span>Total</span><b>' + plata(total(p)) + '</b></div>' + (acts ? '<div class="pt-acts">' + acts + '</div>' : '') + '</div>';
    const n = nuevos(), a = aceptados();
    ov.innerHTML = '<div class="modal" style="max-width:520px"><div class="modal-title-row"><h2>🛍️ Pedidos</h2><button class="rename-table-btn" type="button" data-pt="x">✕</button></div>' +
      '<h3 class="pt-sec">🆕 Por aceptar (' + n.length + ')</h3>' + (n.length ? n.map(p => tarjeta(p, '<button type="button" class="pt-no" data-pt="no">❌ Rechazar</button><button type="button" class="pt-ok" data-pt="ok">✅ Aceptar</button>')).join('') : '<div class="empty-note">No hay pedidos por aceptar.</div>') +
      '<h3 class="pt-sec">✅ Aceptados, por entregar (' + a.length + ')</h3>' + (a.length ? a.map(p => tarjeta(p, '<button type="button" class="pt-no" data-pt="no">Cancelar</button><button type="button" class="pt-ghost" data-pt="cuenta">Ver la cuenta</button><button type="button" class="pt-ok" data-pt="ent">📦 Entregado</button>')).join('') : '<div class="empty-note">Nada por entregar.</div>') +
      (hechos.length ? '<details class="pt-hoy"><summary>Hoy (' + hechos.length + ')</summary>' + hechos.map(p => tarjeta(p, '')).join('') + '</details>' : '') + '</div>';
  }
  function pintarTodo(){ try{ pintarHoja(); }catch(e){} try{ if(document.getElementById('ptOv') && document.getElementById('ptOv').classList.contains('show')) pintarPanel(); }catch(e){} try{ window.vitoCheckNotif && window.vitoCheckNotif(); }catch(e){} }

  const css = document.createElement('style');
  css.textContent = '.pt-hoja{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0px) + 84px);width:min(440px,calc(100vw - 20px));z-index:46;filter:drop-shadow(0 10px 28px rgba(0,0,0,.28))}' +
    '.pt-card{background:var(--card,#fff);color:var(--ink,#111);border:1px solid var(--line,#e5e5e5);border-radius:18px;padding:12px 14px;margin:8px 0}' +
    '.pt-hoja .pt-card{border:2px solid var(--brand,#111);margin:0}' +
    '.pt-h{display:flex;justify-content:space-between;gap:8px;align-items:baseline}.pt-h b{font-size:16px}.pt-h small{color:var(--ink2,#666);white-space:nowrap}' +
    '.pt-its{margin:8px 0;max-height:150px;overflow:auto}.pt-it{display:flex;justify-content:space-between;gap:8px;padding:2px 0}' +
    '.pt-tot{display:flex;justify-content:space-between;font-size:17px;border-top:1px dashed var(--line,#ddd);padding-top:6px}' +
    '.pt-nota{margin:4px 0;color:var(--ink2,#555)}.pt-ojo{margin:6px 0;padding:6px 8px;border-radius:10px;background:#fff7e6;color:#8a5200;font-size:13px}' +
    '.pt-acts{display:flex;gap:8px;margin-top:10px}.pt-acts button{flex:1;min-height:48px;border-radius:14px;font-size:16px;font-weight:700;border:0;cursor:pointer}' +
    '.pt-ok{background:#16a34a;color:#fff}.pt-no{background:#fde8e8;color:#b42318}.pt-ghost{background:transparent;border:1px solid var(--line,#ddd)!important;color:inherit}' +
    '.pt-pie{display:flex;justify-content:space-between;margin-top:6px}.pt-pie button{background:none;border:0;color:var(--ink2,#555);text-decoration:underline;padding:6px 2px;cursor:pointer}' +
    'body.pt-hoja-on #voiceFabWrap,body.pt-hoja-on #voiceFab,body.pt-hoja-on #voiceFabHelp,body.pt-hoja-on #ypMini{visibility:hidden!important;pointer-events:none!important}' +
    '.pt-sec{margin:14px 0 4px;font-size:15px}.pt-hoy summary{cursor:pointer;margin-top:12px;font-weight:700}';
  document.head.appendChild(css);

  let firmaVista = '';
  setInterval(() => {
    try{
      const l = lista(), f = l.filter(p => ['nuevo', 'recibido', 'preparacion', 'listo'].includes(p.estado)).map(p => p.id + p.estado).join(',');
      if(f !== firmaVista){ firmaVista = f; pintarTodo(); } else pintarHoja();
    }catch(e){}
  }, 1000);
  window.ventoPedidosTienda = { simple, panel, aceptar, rechazar, entregado, nuevos, aceptados, pintarHoja };
})();
