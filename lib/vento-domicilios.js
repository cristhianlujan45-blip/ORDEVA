/* =====================================================================
   ORDEVA · 🛵 Domicilios con estados (1.86.0) — tienda de barrio, restaurante, bar…
   Antes: el domicilio que llegaba por el link quedaba guardado solo en el celular que lo recibió, y una vez facturado
   no se sabía si ya salió ni si llegó.
     • «🛵 Domicilios» (el mismo botón de siempre) abre el tablero, con lo mismo en todos los equipos:
         📥 Por facturar (llegaron por el link o la IA) → 🍳 Preparando → 🛵 En camino → ✅ Entregado
       Cada uno con el cliente, la dirección, el total, cómo paga y hace cuánto entró.
     • Un toque lo pasa al siguiente estado («🛵 Salió» pide, si se quiere, quién lo lleva).
     • «📲 Avisar» abre el WhatsApp del cliente con el mensaje del estado («va en camino», «¿te llegó bien?»…).
     • El estado queda en la venta (h.delivery.estado y su historial): no hay otra lista que crezca.
     • Deshacer la venta devuelve el domicilio del link a «Por facturar».
   ===================================================================== */
(function(){
  'use strict';
  if(window.ventoDomicilios) return;
  const D = () => (typeof data !== 'undefined' ? data : null);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plata = n => { try{ return fmt(Math.round(n || 0)); }catch(e){ return '$' + Math.round(n || 0).toLocaleString('es-CO'); } };
  const toast = (t, ms) => { try{ showToast(t, ms || 5000); }catch(e){} };
  const guardar = () => { try{ saveData(); }catch(e){} };
  const quien = () => { try{ return (typeof authUser !== 'undefined' && authUser) || ''; }catch(e){ return ''; } };
  const hace = t => { const m = Math.max(0, Math.round((Date.now() - t) / 6e4)); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min'; };
  const ESTADOS = [['preparando', '🍳 Preparando'], ['en_camino', '🛵 En camino'], ['entregado', '✅ Entregado']];
  const SIG = { preparando: 'en_camino', en_camino: 'entregado' };
  const BOTON = { preparando: '🛵 Salió', en_camino: '✅ Entregado' };
  const DIAS = 2;   // el tablero muestra los domicilios de los últimos 2 días que no se han entregado (y los entregados de hoy)

  // Las ventas con domicilio y estado (las de antes de la 1.86 no tienen estado: no salen).
  function ventas(){
    const d = D(); if(!d || !Array.isArray(d.history)) return [];
    const desde = Date.now() - DIAS * 864e5;
    return d.history.filter(h => h && h.delivery && h.delivery.estado && Date.parse(h.date) >= desde);
  }
  const hoy0 = () => { const x = new Date(); x.setHours(0, 0, 0, 0); return x.getTime(); };
  const activos = () => ventas().filter(h => h.delivery.estado !== 'entregado' && h.delivery.estado !== 'cancelado');
  const porFacturar = () => { const d = D(); return d && Array.isArray(d.domicilios) ? d.domicilios.filter(x => x && (x.estado || 'pendiente') === 'pendiente') : []; };

  function cambiar(h, estado, extra){
    if(!h || !h.delivery) return false;
    h.delivery.estado = estado;
    (h.delivery.hist = h.delivery.hist || []).push(Object.assign({ e: estado, at: Date.now(), por: quien() }, extra || {}));
    if(extra && extra.repartidor) h.delivery.repartidor = String(extra.repartidor).slice(0, 40);
    guardar(); try{ domisBadge(); }catch(e){}
    return true;
  }
  // El WhatsApp del cliente con el mensaje del estado (10 cifras colombianas → +57).
  function telWa(t){ let n = String(t || '').replace(/\D/g, ''); if(n.length === 10 && n[0] === '3') n = '57' + n; return n.length >= 10 ? n : ''; }
  function mensaje(h){
    const d = D() || {}, x = h.delivery, neg = d.businessName || 'nosotros', cli = x.cliente ? ' ' + x.cliente.split(' ')[0] : '';
    const debe = Number(h.debt) > 0;
    if(x.estado === 'en_camino') return 'Hola' + cli + ' 👋 Tu pedido de ' + neg + ' ya va en camino 🛵' + (x.repartidor ? ' con ' + x.repartidor : '') + '. Total: ' + plata(h.total) + (debe ? ' (se paga al recibir)' : ' (ya está pago)') + '. ¡Gracias!';
    if(x.estado === 'entregado') return 'Hola' + cli + ', ¿te llegó bien tu pedido de ' + neg + '? Gracias por tu compra 🙌';
    return 'Hola' + cli + ' 👋 Recibimos tu pedido en ' + neg + ' y lo estamos preparando 🍳. Total: ' + plata(h.total) + '. Te avisamos cuando salga.';
  }
  function waUrl(h){ const n = telWa(h && h.delivery && h.delivery.telefono); return n ? 'https://wa.me/' + n + '?text=' + encodeURIComponent(mensaje(h)) : ''; }

  // ---------- El tablero ----------
  function panel(){
    document.querySelectorAll('.dm-ov').forEach(o => o.remove());
    const ov = document.createElement('div'); ov.className = 'overlay show cm-ov dm-ov'; ov.setAttribute('data-novocab', '');
    ov.innerHTML = '<div class="modal cm" role="dialog" aria-modal="true" style="max-width:560px"><h2 style="margin:0 0 4px">🛵 Domicilios</h2><div class="dm-cuerpo"></div>' +
      '<div class="modal-actions"><button type="button" class="btn-ghost" data-dm="cerrar">Cerrar</button><button type="button" class="btn-primary" data-dm="nuevo">➕ Nuevo domicilio</button></div></div>';
    document.body.appendChild(ov);
    const cuerpo = ov.querySelector('.dm-cuerpo');
    const tarjeta = h => {
      const x = h.delivery, et = (ESTADOS.find(e => e[0] === x.estado) || ['', x.estado])[1], desde = (x.hist && x.hist[0] && x.hist[0].at) || Date.parse(h.date);
      const como = Number(h.debt) > 0 ? '💵 Paga al recibir' : '✅ Pagado';
      return '<div class="dm-t" data-id="' + esc(h.id) + '" style="border:1px solid var(--line,#ddd);border-radius:12px;padding:10px;margin:6px 0">' +
        '<div style="display:flex;gap:8px;align-items:center"><b style="flex:1">' + esc(x.cliente || 'Cliente') + '</b><span>' + esc(et) + '</span></div>' +
        '<div style="font-size:14px;opacity:.9">' + (x.direccion ? '📍 ' + esc(x.direccion) + ' · ' : '') + plata(h.total) + ' · ' + como + ' · hace ' + esc(hace(desde)) + (x.repartidor ? ' · 🛵 ' + esc(x.repartidor) : '') + '</div>' +
        '<div style="font-size:13px;opacity:.75">' + esc((h.items || []).filter(i => !/domicilio/i.test(i.name || '')).map(i => i.qty + ' ' + i.name).join(', ').slice(0, 140)) + '</div>' +
        '<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">' + (SIG[x.estado] ? '<button type="button" class="btn-primary" data-dm="sig" data-id="' + esc(h.id) + '">' + BOTON[x.estado] + '</button>' : '') +
          (waUrl(h) ? '<a class="btn-ghost" target="_blank" rel="noopener" href="' + esc(waUrl(h)) + '" data-dm="wa" style="text-decoration:none;padding:8px 12px">📲 Avisar</a>' : '') +
          (x.estado !== 'entregado' && x.estado !== 'preparando' ? '<button type="button" class="btn-ghost" data-dm="atras" data-id="' + esc(h.id) + '">↩</button>' : '') + '</div></div>';
    };
    const pintar = () => {
      const pf = porFacturar(), vs = ventas(), t0 = hoy0();
      const col = (k, l) => { const ls = vs.filter(h => h.delivery.estado === k && (k !== 'entregado' || Date.parse(h.date) >= t0)); return ls.length ? '<div class="hist-detail-title" style="margin-top:10px">' + l + ' (' + ls.length + ')</div>' + ls.map(tarjeta).join('') : ''; };
      cuerpo.innerHTML = (pf.length ? '<div class="hist-detail-title">📥 Por facturar (' + pf.length + ')</div>' + pf.map(d => '<div class="dm-pf" style="border:1px dashed var(--line,#ccc);border-radius:12px;padding:10px;margin:6px 0">' +
          '<div style="display:flex;gap:8px;align-items:center"><b style="flex:1">' + esc(d.nombre || 'Cliente') + '</b><span style="font-size:13px">hace ' + esc(hace(d.ts || Date.now())) + '</span></div>' +
          '<div style="font-size:14px;opacity:.9">' + (d.dir ? '📍 ' + esc(d.dir) + ' · ' : '') + esc(String(d.texto || '').slice(0, 140)) + '</div>' +
          '<div style="display:flex;gap:6px;margin-top:6px"><button type="button" class="btn-primary" data-dm="facturar" data-id="' + esc(d.id) + '">🧾 Facturar</button><button type="button" class="btn-ghost" data-dm="descartar" data-id="' + esc(d.id) + '">✕ Descartar</button></div></div>').join('') : '') +
        ESTADOS.map(e => col(e[0], e[1])).join('') ||
        '<div class="modal-sub">No hay domicilios activos. Con «➕ Nuevo domicilio» registras uno.</div>';
    };
    ov.addEventListener('click', async ev => {
      if(ev.target === ov) return ov.remove();
      const b = ev.target.closest('[data-dm]'); if(!b) return;
      const a = b.dataset.dm, d = D();
      if(a === 'cerrar') return ov.remove();
      if(a === 'wa') return;   // el enlace abre WhatsApp
      if(a === 'nuevo'){ ov.remove(); try{ domActual = null; qsOpen('domicilio'); }catch(e){} return; }
      if(a === 'facturar'){ ov.remove(); try{ domAbrir(b.dataset.id); }catch(e){} return; }
      if(a === 'descartar'){
        const x = (d.domicilios || []).find(y => y.id === b.dataset.id); if(!x) return;
        const ok = typeof showConfirm === 'function' ? await showConfirm({ title: '¿Descartar este domicilio?', message: (x.nombre || 'El pedido') + ' no se va a facturar.', confirmText: 'Sí, descartar', icon: '🛵' }) : true;
        if(!ok) return;
        x.estado = 'descartado'; x.at = Date.now(); x.por = quien(); guardar(); try{ domisBadge(); }catch(e){} return pintar();
      }
      const h = (d.history || []).find(y => y.id === b.dataset.id); if(!h) return;
      if(a === 'sig'){
        const sig = SIG[h.delivery.estado]; if(!sig) return;
        let extra = null;
        if(sig === 'en_camino'){ const rep = (h.delivery.repartidor || ''); const r = window.prompt('¿Quién lo lleva? (opcional)', rep); if(r === null) return; if(r.trim()) extra = { repartidor: r.trim() }; }
        cambiar(h, sig, extra); toast(sig === 'en_camino' ? '🛵 Salió el domicilio de ' + (h.delivery.cliente || 'el cliente') + '.' : '✅ Entregado.');
        return pintar();
      }
      if(a === 'atras'){ const ant = { en_camino: 'preparando' }[h.delivery.estado]; if(ant){ cambiar(h, ant); pintar(); } }
    });
    pintar();
    return ov;
  }

  // Deshacer una venta con domicilio: el que llegó por el link vuelve a «Por facturar».
  function alDeshacer(entry){
    const d = D(); if(!d || !entry || !Array.isArray(d.domicilios)) return;
    const x = d.domicilios.find(y => y.ventaId && y.ventaId === entry.id);
    if(x){ x.estado = 'pendiente'; x.ventaId = ''; x.at = Date.now(); }
    try{ domisBadge(); }catch(e){}
  }
  // Los ya facturados o descartados de hace más de 2 días se quitan de la lista (la venta guarda el cliente y la dirección).
  function limpiar(){
    const d = D(); if(!d || !Array.isArray(d.domicilios)) return;
    const lim = Date.now() - DIAS * 864e5, antes = d.domicilios.length;
    d.domicilios = d.domicilios.filter(x => x && ((x.estado || 'pendiente') === 'pendiente' || !(Number(x.at) > 0) || x.at > lim));
    if(d.domicilios.length !== antes) guardar();
  }
  setTimeout(() => { try{ limpiar(); domisBadge(); }catch(e){} }, 4000);
  setInterval(() => { try{ domisBadge(); }catch(e){} }, 20000);
  window.addEventListener('vento-datos-remotos', () => { try{ domisBadge(); const o = document.querySelector('.dm-ov'); if(o){ o.remove(); panel(); } }catch(e){} });

  window.ventoDomicilios = { panel, activos, porFacturar, ventas, cambiar, waUrl, mensaje, telWa, alDeshacer, limpiar };
})();
