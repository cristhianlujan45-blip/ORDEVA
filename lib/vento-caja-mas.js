/* =====================================================================
   ORDEVA · 🧾 Caja POS: lo que tienen las cajas profesionales (1.80.0)
   Pedido del dueño: «agrega lo que le falta a la caja». Todo sobre la MISMA caja (lib/vento-pos.js), sin otro motor
   de ventas: el carrito, el cobro (qsRegistrarVenta), el inventario, el historial, la DIAN y el recibo de siempre.
     📄 Cotizaciones      armar la venta y mandarla por WhatsApp o en PDF sin cobrarla; con un toque pasa a la caja
                          con los precios cotizados. Numeradas (COT-0001) y con fecha de vencimiento.
     ↩️ Devolución        desde la caja: se busca la venta y se devuelve (la misma devolución del historial, con nota
                          crédito si tenía factura DIAN); el dinero en efectivo o como 💳 saldo a favor del cliente.
     📄 Corte X           lo vendido desde que se abrió la caja, por medio de pago y por cajero, SIN cerrarla.
     🔁 Cambio de turno   el que entrega cuenta el efectivo (arqueo), queda su corte, y la caja sigue con el que llega
                          (base = lo contado).
     ⚡ Teclas rápidas     «Recarga», «Bolsa $200», «Fotocopia»…: un toque; con valor fijo o el que se escriba.
     👥 Clientes          buscar o crear con su celular; lista de precios Normal / Mayorista / Especial (% menos).
                          El precio mayorista de cada producto se pone en Inventario por código (o el % del cliente).
     ⭐ Puntos            1 punto por cada $1.000 (configurable) al cobrar con cliente; se canjean como descuento.
     💳 Saldo a favor     de una devolución: se usa como medio de pago en la próxima compra (no es descuento: la venta
                          vale lo mismo, solo que no entra efectivo).
     📺 Pantalla cliente  otra ventana (segundo monitor) o una tablet: lo que se registra, el total, el QR para pagar y
                          «¡Gracias!». Se conecta con un QR, como el celular lector.
   ===================================================================== */
(function(){
  'use strict';
  if(window.ventoCajaMas) return;
  const $ = id => document.getElementById(id);
  const D = () => { try{ return typeof data !== 'undefined' ? data : window.data; }catch(e){ return window.data; } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const plata = n => { try{ return fmt(Math.round(Number(n) || 0)); }catch(e){ return '$' + Math.round(Number(n) || 0).toLocaleString('es-CO'); } };
  const aviso = (t, ms) => { try{ showToast(t, ms || 4000); }catch(e){} };
  const guardar = () => { try{ saveData(); }catch(e){} };
  const quien = () => { try{ return (typeof authUser !== 'undefined' && authUser) || ''; }catch(e){ return ''; } };
  const auditar = (a, d) => { try{ window.ventoAuditar && window.ventoAuditar(a, d); }catch(e){} };
  const P = () => window.ventoPOS || null;
  const num = v => Math.max(0, Math.round(Number(String(v == null ? '' : v).replace(/[^\d]/g, '')) || 0));
  const tel = v => String(v || '').replace(/\D/g, '').slice(-10);
  const sinT = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const jefe = () => { try{ return !window.ventoRoles || window.ventoRoles.esJefe(); }catch(e){ return true; } };
  const puedeProd = () => { try{ return jefe() || window.ventoRoles.puede('productos'); }catch(e){ return true; } };
  const fecha = t => new Date(t).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  const hora = t => new Date(t).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });

  function modal(html, montar, clase){
    const ov = document.createElement('div');
    ov.className = 'overlay show cm-ov' + (clase ? ' ' + clase : ''); ov.setAttribute('data-novocab', '');
    ov.innerHTML = '<div class="modal cm" role="dialog" aria-modal="true">' + html + '</div>';
    document.body.appendChild(ov);
    const cerrar = () => ov.remove();
    ov.addEventListener('click', e => { if(e.target === ov || e.target.closest('[data-cerrar]')) cerrar(); });
    try{ montar && montar(ov, cerrar); }catch(e){ console.error(e); }
    return ov;
  }
  const refrescarCaja = () => { try{ P() && P().ponerMeta(P().meta()); }catch(e){} };   // vuelve a pintar la caja

  // ======================================================================
  // 👥 CLIENTES (en data.clientesFrecuentes, los mismos de «Clientes frecuentes»)
  // ======================================================================
  const clientes = () => { const d = D(); if(!d) return []; if(!Array.isArray(d.clientesFrecuentes)) d.clientesFrecuentes = []; return d.clientesFrecuentes; };
  const clienteDe = cli => { if(!cli) return null; const t = tel(cli.tel || cli.telefono); return (t && clientes().find(c => tel(c.telefono) === t)) || (cli.nombre && clientes().find(c => !c.telefono && sinT(c.nombre) === sinT(cli.nombre))) || null; };
  const LISTAS = [['normal', 'Normal'], ['mayorista', 'Mayorista'], ['especial', 'Especial']];
  function precioCliente(p, qty, lista, cli){
    const c = clienteDe(cli); if(!c || !c.lista || c.lista === 'normal') return 0;
    if(c.lista === 'mayorista' && Number(p.precioMayor) > 0) return Number(p.precioMayor);
    const pct = Math.max(0, Math.min(90, Number(c.descPct) || 0));
    return pct ? Math.round(lista * (1 - pct / 100)) : 0;
  }
  const ptsCfg = () => { const d = D() || {}; return Object.assign({ on: true, cada: 1000, valor: 10, minimo: 100 }, d.puntosCfg || {}); };
  function etiquetas(c){
    const l = [];
    if(c.lista === 'mayorista') l.push('📦 Mayorista'); else if(c.lista === 'especial') l.push('✨ Especial' + (c.descPct ? ' −' + c.descPct + ' %' : ''));
    if(ptsCfg().on && c.puntos > 0) l.push('⭐ ' + Math.floor(c.puntos) + ' pts');
    if(c.saldo > 0) l.push('💳 ' + plata(c.saldo));
    return l;
  }
  function elegirCliente(root){
    const m = P() ? P().meta() : {};
    modal('<h2>👤 Cliente de la venta</h2><div class="modal-sub">Búscalo por nombre o celular, o créalo. Con cliente: sus precios, sus ⭐ puntos y su 💳 saldo a favor.</div>' +
      '<input class="mz-in cm-q" placeholder="🔎 Nombre o celular" autocomplete="off" style="width:100%">' +
      '<div class="cm-lista cm-cli-l"></div>' +
      '<details class="cm-nuevo"' + (clientes().length ? '' : ' open') + '><summary>➕ Cliente nuevo</summary>' +
        '<input class="mz-in cm-nn" maxlength="40" placeholder="Nombre" style="width:100%">' +
        '<input class="mz-in cm-nt" inputmode="tel" maxlength="15" placeholder="Celular (para puntos y saldo)" style="width:100%">' +
        '<div class="cm-fila"><select class="mz-in cm-nl">' + LISTAS.map(x => '<option value="' + x[0] + '">Precios: ' + x[1] + '</option>').join('') + '</select><input class="mz-in cm-np" type="number" min="0" max="90" placeholder="% menos" style="width:110px" hidden></div>' +
        '<button type="button" class="btn-primary cm-ok" style="width:100%">Guardar y usar</button></details>' +
      '<div class="modal-actions">' + (m.cli ? '<button type="button" class="btn-ghost" data-sin>Quitar cliente</button>' : '') + '<button type="button" class="btn-close" data-cerrar>Cerrar</button></div>', (ov, cerrar) => {
      const q = ov.querySelector('.cm-q'), lis = ov.querySelector('.cm-cli-l');
      const pintarL = () => {
        const s = sinT(q.value), t = tel(q.value);
        const l = clientes().filter(c => !s || sinT(c.nombre).includes(s) || (t.length >= 3 && tel(c.telefono).includes(t))).sort((a, b) => (b.ultimaVisita || 0) - (a.ultimaVisita || 0)).slice(0, 30);
        lis.innerHTML = l.length ? l.map((c, i) => '<button type="button" class="cm-it" data-i="' + clientes().indexOf(c) + '"><b>' + esc(c.nombre || 'Sin nombre') + '</b><small>' + esc([c.telefono ? '📱 ' + c.telefono : '', c.visitas ? c.visitas + ' visitas' : ''].filter(Boolean).join(' · ')) + '</small>' +
          (etiquetas(c).length ? '<span class="cm-tags">' + etiquetas(c).map(x => '<i>' + esc(x) + '</i>').join('') + '</span>' : '') + '</button>').join('') : '<div class="cm-vacio">' + (q.value ? 'No hay clientes con «' + esc(q.value) + '».' : 'Todavía no hay clientes.') + '</div>';
      };
      q.addEventListener('input', () => { pintarL(); const n = ov.querySelector('.cm-nn'), tt = ov.querySelector('.cm-nt'); if(/\d{3}/.test(q.value)) tt.value = q.value; else n.value = q.value; });
      pintarL(); setTimeout(() => { try{ q.focus(); }catch(e){} }, 40);
      const usar = c => { const mm = P().meta(); mm.cli = Object.assign({}, mm.cli && mm.cli.dian ? mm.cli : {}, { nombre: c.nombre || c.telefono, tel: c.telefono || '' }); delete mm.saldo; if(mm.desc && mm.desc.puntos) delete mm.desc; P().ponerMeta(mm); cerrar(); aviso('👤 ' + (c.nombre || c.telefono) + (etiquetas(c).length ? ' · ' + etiquetas(c).join(' · ') : '')); };
      lis.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if(b) usar(clientes()[+b.dataset.i]); });
      const sel = ov.querySelector('.cm-nl'), pct = ov.querySelector('.cm-np');
      sel.onchange = () => { pct.hidden = sel.value !== 'especial' && sel.value !== 'mayorista'; pct.placeholder = sel.value === 'mayorista' ? '% menos (si el producto no tiene precio mayorista)' : '% menos'; };
      ov.querySelector('.cm-ok').onclick = () => {
        const n = ov.querySelector('.cm-nn').value.trim().slice(0, 40), t = tel(ov.querySelector('.cm-nt').value);
        if(!n && !t){ ov.querySelector('.cm-nn').focus(); return; }
        if(sel.value !== 'normal' && !jefe()){ aviso('🔒 La lista de precios de un cliente la pone el dueño o el administrador.'); return; }
        let c = t ? clientes().find(x => tel(x.telefono) === t) : null;
        if(!c){ c = { telefono: t, nombre: n, visitas: 0, totalGastado: 0, ultimaVisita: Date.now() }; clientes().push(c); }
        if(n) c.nombre = n;
        c.lista = sel.value; if(!pct.hidden && num(pct.value)) c.descPct = Math.min(90, num(pct.value)); else delete c.descPct;
        guardar(); auditar('cliente', (c.nombre || c.telefono) + ' · precios ' + c.lista);
        usar(c);
      };
      const sb = ov.querySelector('[data-sin]'); if(sb) sb.onclick = () => { const mm = P().meta(); delete mm.cli; delete mm.saldo; if(mm.desc && mm.desc.puntos) delete mm.desc; P().ponerMeta(mm); cerrar(); };
    });
  }
  // ⭐ Puntos / 💳 saldo del cliente de la venta
  function canjear(){
    const m = P().meta(), c = clienteDe(m.cli), cfg = ptsCfg(); if(!c) return;
    const total = P().resumen().bruto, pts = Math.floor(c.puntos || 0);
    const usa = Math.min(pts, Math.floor(total / cfg.valor)); if(usa < 1) return;
    m.desc = { tipo: '$', v: usa * cfg.valor, por: '⭐ ' + usa + ' puntos', puntos: usa };
    P().ponerMeta(m); aviso('⭐ ' + usa + ' puntos = ' + plata(usa * cfg.valor) + ' de descuento.');
  }
  function usarSaldo(){
    const m = P().meta(), c = clienteDe(m.cli); if(!c || !(c.saldo > 0)) return;
    m.saldo = Math.min(Math.round(c.saldo), P().resumen().total + (m.saldo || 0)); P().ponerMeta(m);
    aviso('💳 Se usan ' + plata(m.saldo) + ' del saldo a favor de ' + (c.nombre || c.telefono) + '.');
  }
  function sumarSaldo(cli, valor, motivo){
    const t = tel(cli && (cli.tel || cli.telefono)), n = (cli && cli.nombre || '').trim();
    if(!t && !n) return null;
    let c = clienteDe({ tel: t, nombre: n });
    if(!c){ c = { telefono: t, nombre: n, visitas: 0, totalGastado: 0, ultimaVisita: Date.now() }; clientes().push(c); }
    c.saldo = Math.round((Number(c.saldo) || 0) + valor);
    (c.movSaldo = c.movSaldo || []).push({ t: Date.now(), v: Math.round(valor), motivo: String(motivo || '').slice(0, 80), por: quien() }); c.movSaldo = c.movSaldo.slice(-40);
    guardar(); auditar('saldo a favor', (c.nombre || c.telefono) + ' ' + (valor >= 0 ? '+' : '') + plata(valor) + (motivo ? ' · ' + motivo : ''));
    return c;
  }
  // Al cobrar: puntos ganados / canjeados, saldo usado, visita, y la cotización queda vendida.
  window.addEventListener('vento-pos-cobro', e => {
    const x = e.detail || {}, m = x.meta || {}, en = x.entry; if(!en) return;
    if(m.cot){ const q = cotizaciones().find(k => k.id === m.cot); if(q){ q.estado = 'vendida'; q.venta = en.id; q.vendidaAt = Date.now(); } en.cotizacion = m.cotN || ''; }
    const c = clienteDe(m.cli);
    if(c){
      const cfg = ptsCfg(), fiado = (en.payments || []).some(p => p.method === 'debe');
      en.cliente = { nombre: c.nombre || '', tel: c.telefono || '' };
      if(m.desc && m.desc.puntos) c.puntos = Math.max(0, (Number(c.puntos) || 0) - m.desc.puntos);
      if(x.saldo > 0) c.saldo = Math.max(0, Math.round((Number(c.saldo) || 0) - x.saldo));
      let gana = 0;
      if(cfg.on && !fiado){ gana = Math.floor((en.total - (x.saldo || 0)) / Math.max(1, cfg.cada)); c.puntos = (Number(c.puntos) || 0) + gana; en.puntos = gana; }
      c.visitas = (c.visitas || 0) + 1; c.totalGastado = (c.totalGastado || 0) + (en.total || 0); c.ultimaVisita = Date.now();
      if(gana > 0) setTimeout(() => aviso('⭐ ' + (c.nombre || 'El cliente') + ' ganó ' + gana + ' puntos (lleva ' + Math.floor(c.puntos) + ').', 4500), 1800);
    }
    guardar();
  });

  // ======================================================================
  // 📄 COTIZACIONES (data.cotizaciones)
  // ======================================================================
  const cotizaciones = () => { const d = D(); if(!d) return []; if(!Array.isArray(d.cotizaciones)) d.cotizaciones = []; return d.cotizaciones; };
  const nCot = n => 'COT-' + String(n).padStart(4, '0');
  function cotizar(){
    const r = P().resumen(); if(!r.lineas.length){ aviso('Agrega los productos a la venta y luego toca 📄 Cotizar.'); return; }
    const m = P().meta(), c = clienteDe(m.cli);
    modal('<h2>📄 Cotización</h2><div class="modal-sub">' + r.lineas.length + (r.lineas.length === 1 ? ' producto' : ' productos') + ' · total <b>' + plata(r.total) + '</b>. No se cobra ni descuenta inventario.</div>' +
      '<input class="mz-in cm-cn" maxlength="60" placeholder="Para (nombre o empresa)" value="' + esc((m.cli && m.cli.nombre) || '') + '" style="width:100%">' +
      '<input class="mz-in cm-ct" inputmode="tel" maxlength="15" placeholder="Celular (para mandarla por WhatsApp)" value="' + esc((c && c.telefono) || (m.cli && m.cli.tel) || '') + '" style="width:100%">' +
      '<div class="cm-fila"><label class="cm-lab">Válida por <input class="mz-in cm-cv" type="number" min="1" max="90" value="15" style="width:70px"> días</label></div>' +
      '<textarea class="mz-in cm-cno" maxlength="200" rows="2" placeholder="Nota (ej. tiempo de entrega, forma de pago)" style="width:100%">' + esc(m.nota || '') + '</textarea>' +
      '<div class="modal-actions"><button type="button" class="btn-close" data-cerrar>Cancelar</button><button type="button" class="btn-primary cm-ok">💾 Guardar cotización</button></div>', (ov, cerrar) => {
      ov.querySelector('.cm-ok').onclick = () => {
        const lista = cotizaciones(), n = lista.reduce((a, k) => Math.max(a, k.n || 0), 0) + 1, dias = Math.max(1, Math.min(90, num(ov.querySelector('.cm-cv').value) || 15));
        const q = { id: 'cot' + Date.now().toString(36), n, t: Date.now(), vence: Date.now() + dias * 864e5, por: quien(), estado: 'abierta',
          cliente: { nombre: ov.querySelector('.cm-cn').value.trim().slice(0, 60), tel: tel(ov.querySelector('.cm-ct').value) },
          lineas: P().lineasRaw().map(x => { const l = r.lineas.find(y => y.id === x.id) || {}; return { id: x.id, name: x.name, price: l.price != null ? l.price : x.price, qty: x.qty, libre: !!x.libre }; }),
          bruto: r.bruto, desc: r.descuento, total: r.total, nota: ov.querySelector('.cm-cno').value.trim().slice(0, 200) };
        lista.unshift(q); d0().cotizaciones = lista.slice(0, 300); guardar(); auditar('cotización', nCot(n) + ' · ' + plata(q.total) + (q.cliente.nombre ? ' · ' + q.cliente.nombre : ''));
        P().vaciar(); const mm = P().meta(); delete mm.desc; delete mm.nota; delete mm.cli; P().ponerMeta(mm);
        cerrar(); verCotizacion(q, true);
      };
    });
  }
  const d0 = () => D() || {};
  function textoCot(q){
    const d = d0(), l = ['*' + (d.businessName || 'Cotización') + '*', '📄 Cotización ' + nCot(q.n) + ' · ' + fecha(q.t), q.cliente.nombre ? 'Para: ' + q.cliente.nombre : '', ''];
    q.lineas.forEach(x => l.push(x.qty + ' × ' + x.name + ' — ' + plata(x.price * x.qty)));
    l.push('');
    if(q.desc) l.push('Subtotal: ' + plata(q.bruto), 'Descuento: −' + plata(q.desc));
    l.push('*TOTAL: ' + plata(q.total) + '*', 'Válida hasta el ' + fecha(q.vence) + '.');
    if(q.nota) l.push('', q.nota);
    return l.filter((x, i) => x !== '' || i > 2).join('\n');
  }
  function htmlCot(q){
    const d = d0(), fila = x => '<tr><td>' + esc(x.qty) + '</td><td>' + esc(x.name) + '</td><td class="n">' + plata(x.price) + '</td><td class="n">' + plata(x.price * x.qty) + '</td></tr>';
    return '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>' + esc(nCot(q.n)) + ' · ' + esc(d.businessName || '') + '</title><style>' +
      'body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111;margin:32px auto;max-width:720px;padding:0 20px}h1{margin:0;font-size:26px}.sub{color:#555;font-size:13px;margin-top:2px}' +
      '.cab{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;border-bottom:3px solid #111;padding-bottom:14px;margin-bottom:18px}.doc{text-align:right}.doc b{font-size:20px;display:block}' +
      '.para{background:#f4f4f5;border-radius:10px;padding:10px 14px;margin-bottom:16px;font-size:14px}table{width:100%;border-collapse:collapse;font-size:14px}th{text-align:left;border-bottom:1px solid #bbb;padding:8px 6px;font-size:12px;text-transform:uppercase;color:#555}' +
      'td{padding:8px 6px;border-bottom:1px solid #eee}.n{text-align:right;white-space:nowrap}.tot{margin-top:14px;margin-left:auto;width:280px;font-size:14px}.tot div{display:flex;justify-content:space-between;padding:4px 0}.tot .g{font-size:20px;font-weight:800;border-top:2px solid #111;margin-top:4px;padding-top:8px}' +
      '.nota{margin-top:20px;font-size:13px;color:#333;white-space:pre-wrap}.pie{margin-top:28px;font-size:12px;color:#666;border-top:1px solid #ddd;padding-top:10px}@media print{body{margin:0 auto}}</style></head><body>' +
      '<div class="cab"><div><h1>' + esc(d.businessName || '') + '</h1><div class="sub">' + esc([d.nit ? 'NIT/CC ' + d.nit : '', d.bizAddress || ''].filter(Boolean).join(' · ')) + '</div></div>' +
      '<div class="doc"><b>COTIZACIÓN</b>' + esc(nCot(q.n)) + '<div class="sub">' + esc(fecha(q.t)) + '<br>Válida hasta ' + esc(fecha(q.vence)) + '</div></div></div>' +
      (q.cliente.nombre || q.cliente.tel ? '<div class="para"><b>Para:</b> ' + esc(q.cliente.nombre || '') + (q.cliente.tel ? ' · 📱 ' + esc(q.cliente.tel) : '') + '</div>' : '') +
      '<table><thead><tr><th>Cant.</th><th>Descripción</th><th class="n">Precio</th><th class="n">Total</th></tr></thead><tbody>' + q.lineas.map(fila).join('') + '</tbody></table>' +
      '<div class="tot">' + (q.desc ? '<div><span>Subtotal</span><span>' + plata(q.bruto) + '</span></div><div><span>Descuento</span><span>−' + plata(q.desc) + '</span></div>' : '') + '<div class="g"><span>TOTAL</span><span>' + plata(q.total) + '</span></div></div>' +
      (q.nota ? '<div class="nota">' + esc(q.nota) + '</div>' : '') +
      '<div class="pie">Precios en pesos colombianos' + (d.ivaResponsable ? ', con IVA incluido' : '') + '. Esta cotización no es una factura.' + (q.por ? ' Atendió: ' + esc(q.por) + '.' : '') + '</div></body></html>';
  }
  function pdfCot(q){
    // En el computador sale la ventana de imprimir (allí: «Guardar como PDF»). Con la app ORDEVA del celular, la de Android.
    const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(f);
    const doc = f.contentDocument; doc.open(); doc.write(htmlCot(q)); doc.close();
    setTimeout(() => { try{ f.contentWindow.focus(); f.contentWindow.print(); }catch(e){ const w = window.open('', '_blank'); if(w){ w.document.write(htmlCot(q)); w.document.close(); } } setTimeout(() => f.remove(), 60000); }, 300);
  }
  function waCot(q){ const t = tel(q.cliente.tel); window.open('https://wa.me/' + (t ? (t.length === 10 ? '57' + t : t) : '') + '?text=' + encodeURIComponent(textoCot(q)), '_blank'); }
  function pasarAVenta(q){
    const r = P().resumen();
    const ok = () => {
      const items = q.lineas.map(x => { const p = (d0().products || []).find(y => y.id === x.id); return x.libre || !p ? { id: x.libre ? x.id : 'libre:' + x.id, name: x.name, price: x.price, qty: x.qty, libre: true } : Object.assign({ id: p.id, name: p.name, price: x.price, qty: x.qty }, Number(p.price) !== x.price ? { pf: x.price } : {}); });
      const m = { cot: q.id, cotN: nCot(q.n), nota: [nCot(q.n), q.nota].filter(Boolean).join(' · ').slice(0, 140) };
      if(q.cliente.nombre) m.cli = { nombre: q.cliente.nombre, tel: q.cliente.tel };
      if(q.desc) m.desc = { tipo: '$', v: q.desc, por: 'Cotización ' + nCot(q.n) };
      P().cargar(items, m);
      document.querySelectorAll('.cm-ov').forEach(o => o.remove());
      try{ if(!document.getElementById('pzCajaOv') || !document.getElementById('pzCajaOv').classList.contains('show')) P().abrirCaja(); }catch(e){}
      aviso('🛒 ' + nCot(q.n) + ' pasó a la caja con los precios cotizados: cóbrala.');
    };
    if(r.lineas.length){ Promise.resolve(typeof showConfirm === 'function' ? showConfirm({ title: 'Hay una venta en la caja', message: 'Si pasas la cotización, la venta de ahora se reemplaza (puedes ⏸️ suspenderla antes).', confirmText: 'Reemplazar', cancelText: 'No', icon: '📄' }) : confirm('¿Reemplazar la venta de la caja?')).then(s => { if(s) ok(); }); }
    else ok();
  }
  function verCotizacion(q, nueva){
    const vencida = q.estado === 'abierta' && Date.now() > q.vence;
    modal('<h2>📄 ' + esc(nCot(q.n)) + (nueva ? ' guardada' : '') + '</h2><div class="modal-sub">' + esc(fecha(q.t)) + (q.cliente.nombre ? ' · ' + esc(q.cliente.nombre) : '') + ' · ' + (q.estado === 'vendida' ? '✅ Vendida' : vencida ? '⌛ Vencida el ' + esc(fecha(q.vence)) : 'Válida hasta ' + esc(fecha(q.vence))) + '</div>' +
      '<div class="cm-lineas">' + q.lineas.map(x => '<div><span>' + esc(x.qty) + ' × ' + esc(x.name) + '</span><b>' + plata(x.price * x.qty) + '</b></div>').join('') + '</div>' +
      (q.desc ? '<div class="cm-tl"><span>Descuento</span><b>−' + plata(q.desc) + '</b></div>' : '') + '<div class="cm-tl cm-tg"><span>TOTAL</span><b>' + plata(q.total) + '</b></div>' +
      '<div class="cm-acc"><button type="button" class="btn-primary" data-x="venta">🛒 Pasar a venta</button><button type="button" class="btn-ghost" data-x="wa">📲 WhatsApp</button><button type="button" class="btn-ghost" data-x="pdf">🖨️ PDF / imprimir</button>' +
      (q.estado !== 'vendida' ? '<button type="button" class="btn-ghost" data-x="borrar">🗑️ Borrar</button>' : '') + '</div>' +
      '<div class="modal-actions"><button type="button" class="btn-close" data-cerrar>Listo</button></div>', (ov, cerrar) => {
      ov.querySelector('.cm-acc').addEventListener('click', e => {
        const b = e.target.closest('[data-x]'); if(!b) return;
        if(b.dataset.x === 'venta') pasarAVenta(q);
        else if(b.dataset.x === 'wa') waCot(q);
        else if(b.dataset.x === 'pdf') pdfCot(q);
        else if(b.dataset.x === 'borrar'){ const l = cotizaciones(), i = l.indexOf(q); if(i >= 0 && confirm('¿Borrar la cotización ' + nCot(q.n) + '?')){ l.splice(i, 1); guardar(); cerrar(); refrescarCaja(); } }
      });
    });
  }
  function listaCotizaciones(){
    const pintarL = (ov, f) => {
      const s = sinT(f || ''), l = cotizaciones().filter(q => !s || sinT(nCot(q.n) + ' ' + q.cliente.nombre + ' ' + q.cliente.tel + ' ' + q.lineas.map(x => x.name).join(' ')).includes(s));
      ov.querySelector('.cm-lista').innerHTML = l.length ? l.slice(0, 80).map(q => { const venc = q.estado === 'abierta' && Date.now() > q.vence;
        return '<button type="button" class="cm-it" data-id="' + esc(q.id) + '"><b>' + esc(nCot(q.n)) + ' · ' + plata(q.total) + '</b><small>' + esc(fecha(q.t) + (q.cliente.nombre ? ' · ' + q.cliente.nombre : '') + ' · ' + q.lineas.length + ' productos') + '</small>' +
          '<span class="cm-tags"><i class="' + (q.estado === 'vendida' ? 'ok' : venc ? 'mal' : '') + '">' + (q.estado === 'vendida' ? '✅ Vendida' : venc ? '⌛ Vencida' : '🕒 Abierta') + '</i></span></button>'; }).join('') : '<div class="cm-vacio">' + (f ? 'Nada con «' + esc(f) + '».' : 'Todavía no hay cotizaciones. Arma la venta y toca «📄 Cotizar».') + '</div>';
    };
    modal('<h2>📄 Cotizaciones</h2><input class="mz-in cm-q" placeholder="🔎 Número, cliente o producto" style="width:100%"><div class="cm-lista"></div><div class="modal-actions"><button type="button" class="btn-close" data-cerrar>Cerrar</button></div>', (ov) => {
      const q = ov.querySelector('.cm-q'); q.addEventListener('input', () => pintarL(ov, q.value)); pintarL(ov, '');
      ov.querySelector('.cm-lista').addEventListener('click', e => { const b = e.target.closest('[data-id]'); if(!b) return; const k = cotizaciones().find(x => x.id === b.dataset.id); if(k) verCotizacion(k); });
    });
  }

  // ======================================================================
  // ↩️ DEVOLUCIÓN desde la caja
  // ======================================================================
  function devolucion(){
    if(!window.ventoInventario || !window.ventoInventario.devolucion){ aviso('La devolución no está disponible en este equipo.'); return; }
    const ventas = () => (d0().history || []).filter(h => (h.items || []).length && h.total > 0).slice(0, 400);
    const pintarL = (ov, f) => {
      const s = sinT(f || ''), n = num(f);
      const l = ventas().filter(h => !s || sinT((h.tableName || '') + ' ' + (h.invoiceNo || '') + ' ' + ((h.dian && h.dian.documento) || '') + ' ' + ((h.cliente && h.cliente.nombre) || '') + ' ' + (h.person || '') + ' ' + h.items.map(i => i.name).join(' ')).includes(s) || (n && Math.round(h.total) === n));
      ov.querySelector('.cm-lista').innerHTML = l.length ? l.slice(0, 60).map(h => '<button type="button" class="cm-it" data-id="' + esc(h.id) + '"><b>' + plata(h.total) + ' · ' + esc(h.tableName || 'Venta') + '</b><small>' + esc(new Date(h.date).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) + ' · ' + h.items.slice(0, 3).map(i => i.qty + ' ' + i.name).join(', ') + (h.items.length > 3 ? '…' : '')) + '</small>' +
        ((h.dian && h.dian.documento) || h.devoluciones ? '<span class="cm-tags">' + (h.dian && h.dian.documento ? '<i>🧾 ' + esc(h.dian.documento) + '</i>' : '') + (h.devoluciones ? '<i class="mal">↩️ ya tuvo devolución</i>' : '') + '</span>' : '') + '</button>').join('') : '<div class="cm-vacio">No encontré esa venta.</div>';
    };
    modal('<h2>↩️ Devolución</h2><div class="modal-sub">Busca la venta (producto, valor, cliente o número de factura). Lo devuelto vuelve al inventario; si tenía factura electrónica sale la nota crédito.</div>' +
      '<input class="mz-in cm-q" placeholder="🔎 Producto, valor, cliente o factura" style="width:100%"><div class="cm-lista"></div><div class="modal-actions"><button type="button" class="btn-close" data-cerrar>Cancelar</button></div>', (ov, cerrar) => {
      const q = ov.querySelector('.cm-q'); q.addEventListener('input', () => pintarL(ov, q.value)); pintarL(ov, ''); setTimeout(() => { try{ q.focus(); }catch(e){} }, 40);
      ov.querySelector('.cm-lista').addEventListener('click', e => {
        const b = e.target.closest('[data-id]'); if(!b) return;
        const h = (d0().history || []).find(x => String(x.id) === b.dataset.id); if(!h) return;
        const hacer = () => { cerrar(); window.ventoInventario.devolucion(h, { saldoCliente: h.cliente || (h.person ? { nombre: h.person } : null) }); };
        if(!jefe() && window.ventoVentaFix && window.ventoVentaFix.autorizar) window.ventoVentaFix.autorizar('hacer una devolución de ' + plata(h.total)).then(r => { if(r) hacer(); else aviso('🔒 La devolución necesita la autorización del dueño.'); });
        else hacer();
      });
    });
  }

  // ======================================================================
  // 📄 CORTE X y 🔁 CAMBIO DE TURNO (lib/vento-turno.js)
  // ======================================================================
  const NOMBRE_M = { efectivo: '💵 Efectivo', transferencia: '🏦 Transferencia', nequi: '📱 Nequi', daviplata: '📱 DaviPlata', tarjeta: '💳 Tarjeta', debe: '📝 Fiado', saldo: '💳 Saldo a favor', breb: '🔑 Bre-B', qr: '📲 QR' };
  function corte(desde){
    const t0 = desde ? new Date(desde).getTime() : (() => { const x = new Date(); x.setHours(0, 0, 0, 0); return x.getTime(); })();
    const T0 = window.ventoTurno, multi = T0 && T0.variasCajas && T0.variasCajas(), cn = multi ? T0.cajaNombre() : '';
    const vs = (d0().history || []).filter(h => new Date(h.date).getTime() >= t0 && (!multi || (h.caja || '') === cn));
    const medio = {}, cajero = {}; let total = 0, desc = 0, dev = 0, n = 0;
    vs.forEach(h => {
      n++; total += Number(h.total) || 0; if(h.descuento) desc += Number(h.descuento.valor) || 0;
      (h.payments || []).forEach(p => { const k = typeof window.medioDePago === 'function' ? window.medioDePago(p) : (p.method || 'otro'); medio[k] = (medio[k] || 0) + (Number(p.amount) || 0); });
      const c = h.by || 'Sin usuario'; const x = cajero[c] || (cajero[c] = { n: 0, total: 0 }); x.n++; x.total += Number(h.total) || 0;
      (h.devoluciones || []).forEach(d => { if(d.t >= t0) dev += Number(d.total) || 0; });
    });
    const T = window.ventoTurno, r = T ? T.resumen() : null;
    return { desde: t0, n, total: Math.round(total), desc: Math.round(desc), dev: Math.round(dev), medio, cajero, caja: r && r.abierta ? r : null };
  }
  function textoCorte(c, titulo){
    const l = ['*' + (d0().businessName || '') + '*', '*' + (titulo || '📄 Corte X') + '* · ' + new Date().toLocaleString('es-CO'), 'Desde ' + new Date(c.desde).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }), '',
      'Ventas: ' + c.n + ' · ' + plata(c.total)];
    Object.keys(c.medio).forEach(k => l.push('  ' + (NOMBRE_M[k] || k) + ': ' + plata(c.medio[k])));
    if(c.desc) l.push('Descuentos: ' + plata(c.desc)); if(c.dev) l.push('Devoluciones: ' + plata(c.dev));
    if(Object.keys(c.cajero).length > 1 || !c.cajero['Sin usuario']) { l.push('', 'Por cajero:'); Object.keys(c.cajero).forEach(k => l.push('  ' + k + ': ' + c.cajero[k].n + ' · ' + plata(c.cajero[k].total))); }
    if(c.caja) l.push('', 'Efectivo que debe haber: ' + plata(c.caja.esperado) + ' (base ' + plata(c.caja.base) + (c.caja.entradas ? ' +' + plata(c.caja.entradas) : '') + (c.caja.salidas ? ' −' + plata(c.caja.salidas) : '') + ')');
    l.push('', 'La caja sigue abierta (esto no la cierra).');
    return l.join('\n');
  }
  function htmlCorte(c){
    const L = (a, b, x) => '<div class="cm-tl' + (x ? ' ' + x : '') + '"><span>' + a + '</span><b>' + b + '</b></div>';
    return L('Ventas', c.n + ' · ' + plata(c.total), 'cm-tg') + Object.keys(c.medio).map(k => L(esc(NOMBRE_M[k] || k), plata(c.medio[k]))).join('') +
      (c.desc ? L('🏷️ Descuentos', plata(c.desc)) : '') + (c.dev ? L('↩️ Devoluciones', plata(c.dev)) : '') +
      (Object.keys(c.cajero).length ? '<div class="hist-detail-title" style="margin-top:10px">👤 Por cajero</div>' + Object.keys(c.cajero).map(k => L(esc(k), c.cajero[k].n + ' · ' + plata(c.cajero[k].total))).join('') : '') +
      (c.caja ? '<div class="hist-detail-title" style="margin-top:10px">💵 Efectivo</div>' + L('Base', plata(c.caja.base)) + L('Ventas en efectivo', plata(c.caja.ventas)) + (c.caja.entradas ? L('➕ Entradas', plata(c.caja.entradas)) : '') + (c.caja.salidas ? L('➖ Salidas', '−' + plata(c.caja.salidas)) : '') + L('Debe haber', plata(c.caja.esperado), 'cm-tg') : '');
  }
  function imprimirTexto(titulo, texto){
    const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;width:0;height:0;border:0'; document.body.appendChild(f);
    const d = f.contentDocument; d.open(); d.write('<title>' + esc(titulo) + '</title><body style="font-family:monospace;max-width:320px;margin:16px auto;font-size:13px;white-space:pre-wrap">' + esc(texto.replace(/\*/g, '')) + '</body>'); d.close();
    setTimeout(() => { try{ f.contentWindow.print(); }catch(e){} setTimeout(() => f.remove(), 60000); }, 250);
  }
  function corteX(){
    const T = window.ventoTurno, r = T ? T.resumen() : null, c = corte(r && r.abierta ? r.abierto_en : null);
    modal('<h2>📄 Corte X</h2><div class="modal-sub">Lo vendido desde ' + (r && r.abierta ? 'que se abrió la caja (' + esc(hora(r.abierto_en)) + (r.por ? ', ' + esc(r.por) : '') + ')' : 'el comienzo del día') + '. <b>No cierra la caja.</b></div>' + htmlCorte(c) +
      '<div class="cm-acc"><button type="button" class="btn-ghost" data-x="imp">🖨️ Imprimir</button><button type="button" class="btn-ghost" data-x="wa">📲 WhatsApp</button>' + (r && r.abierta ? '<button type="button" class="btn-ghost" data-x="turno">🔁 Cambio de turno</button>' : '') + '</div>' +
      '<div class="modal-actions"><button type="button" class="btn-close" data-cerrar>Listo</button></div>', (ov, cerrar) => {
      ov.querySelector('.cm-acc').addEventListener('click', e => { const b = e.target.closest('[data-x]'); if(!b) return;
        if(b.dataset.x === 'imp') imprimirTexto('Corte X', textoCorte(c)); else if(b.dataset.x === 'wa') window.open('https://wa.me/?text=' + encodeURIComponent(textoCorte(c)), '_blank'); else { cerrar(); cambioTurno(); } });
    });
    auditar('corte X', c.n + ' ventas · ' + plata(c.total));
  }
  function cambioTurno(){
    const T = window.ventoTurno, r = T && T.resumen(); if(!r || !r.abierta){ aviso('Primero abre la caja con su base.'); return; }
    modal('<h2>🔁 Cambio de turno</h2><div class="modal-sub">Entrega <b>' + esc(r.por || 'quien abrió') + '</b>. Se cuenta el efectivo (arqueo), queda su corte, y la caja sigue abierta con quien llega: su base es lo contado.</div>' +
      '<input class="mz-in cm-tn" maxlength="40" placeholder="¿Quién recibe la caja?" style="width:100%">' +
      '<div class="modal-actions"><button type="button" class="btn-close" data-cerrar>Cancelar</button><button type="button" class="btn-primary cm-ok">🧮 Contar y entregar</button></div>', (ov, cerrar) => {
      const nn = ov.querySelector('.cm-tn'); setTimeout(() => { try{ nn.focus(); }catch(e){} }, 40);
      ov.querySelector('.cm-ok').onclick = async () => {
        const nuevo = nn.value.trim().slice(0, 40); if(!nuevo){ nn.focus(); return; }
        cerrar();
        const a = await T.arqueo(); if(!a) return;
        const d = d0(), c = corte(r.abierto_en), base = a.contado != null ? a.contado : a.esperado;
        (d.turnosHist = d.turnosHist || []).unshift({ caja: T.cajaNombre ? T.cajaNombre() : '', de: r.por || '', a: nuevo, abierto_en: r.abierto_en, cerrado: new Date().toISOString(), base: r.base, esperado: a.esperado, contado: a.contado, diferencia: a.diferencia, ventas: c.total, n: c.n, medio: c.medio, movs: a.movs });
        d.turnosHist = d.turnosHist.slice(0, 200);
        T.ponerTurno({ abierto_en: new Date().toISOString(), base: Math.round(base), por: nuevo, movs: [] });
        guardar(); auditar('cambio de turno', (r.por || '') + ' → ' + nuevo + ' · contado ' + plata(a.contado != null ? a.contado : 0) + (a.diferencia ? (a.diferencia < 0 ? ' · faltan ' + plata(-a.diferencia) : ' · sobran ' + plata(a.diferencia)) : ''));
        try{ window.dispatchEvent(new Event('vento-turno')); }catch(e){}
        const txt = textoCorte(c, '🔁 Cambio de turno: ' + (r.por || '') + ' → ' + nuevo) + (a.contado != null ? '\nContado: ' + plata(a.contado) + (a.diferencia ? (a.diferencia < 0 ? ' · faltan ' + plata(-a.diferencia) : ' · sobran ' + plata(a.diferencia)) : ' · ✅ cuadra') : '');
        modal('<h2>✅ Turno entregado</h2><div class="modal-sub">La caja sigue abierta con <b>' + esc(nuevo) + '</b> y una base de <b>' + plata(base) + '</b>.</div>' + htmlCorte(c) +
          '<div class="cm-acc"><button type="button" class="btn-ghost" data-x="imp">🖨️ Imprimir</button><button type="button" class="btn-ghost" data-x="wa">📲 WhatsApp al dueño</button></div><div class="modal-actions"><button type="button" class="btn-primary" data-cerrar>Listo</button></div>', ov2 => {
          ov2.querySelector('.cm-acc').addEventListener('click', e => { const b = e.target.closest('[data-x]'); if(!b) return; if(b.dataset.x === 'imp') imprimirTexto('Cambio de turno', txt); else window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank'); });
        });
        refrescarCaja();
      };
    });
  }

  // ======================================================================
  // ⚡ TECLAS RÁPIDAS (data.teclasCaja)
  // ======================================================================
  const teclas = () => (Array.isArray(d0().teclasCaja) ? d0().teclasCaja : []).filter(x => x && x.n);
  function tecla(root, i){
    const k = teclas()[i]; if(!k) return;
    const T = root && root._pz && root._pz.tec, escrito = T ? (+T.num || 0) : 0, mult = T ? (T.mult || 0) : 0;
    const limpiar = () => { if(T){ T.num = ''; T.mult = 0; } };
    if(k.v > 0){ const n = mult || (escrito > 0 && escrito <= 999 ? escrito : 1); limpiar(); P().libre(k.v, n, k.n); aviso('⚡ ' + (n > 1 ? n + ' × ' : '') + k.n + ' · ' + plata(k.v * n)); return; }
    if(escrito > 0){ const n = mult || 1; limpiar(); P().libre(escrito, n, k.n); aviso('⚡ ' + k.n + ' · ' + plata(escrito * n)); return; }
    modal('<h2>' + esc(k.e || '⚡') + ' ' + esc(k.n) + '</h2><div class="modal-sub">¿Cuánto es?</div><input class="mz-in cm-tv" inputmode="numeric" placeholder="Valor" style="width:100%;font-size:22px;font-weight:800">' +
      '<div class="modal-actions"><button type="button" class="btn-close" data-cerrar>Cancelar</button><button type="button" class="btn-primary cm-ok">➕ Agregar</button></div>', (ov, cerrar) => {
      const v = ov.querySelector('.cm-tv'); setTimeout(() => { try{ v.focus(); }catch(e){} }, 40);
      const ok = () => { const x = num(v.value); if(!x){ v.focus(); return; } cerrar(); P().libre(x, 1, k.n); };
      ov.querySelector('.cm-ok').onclick = ok; v.addEventListener('keydown', e => { if(e.key === 'Enter') ok(); });
    });
  }
  function configTeclas(){
    if(!puedeProd()){ aviso('🔒 Las teclas rápidas las configura el dueño o quien puede editar productos.'); return; }
    const sug = [['📱', 'Recarga', 0], ['🛍️', 'Bolsa', 200], ['📄', 'Fotocopia', 200], ['🧊', 'Hielo', 0], ['🛵', 'Domicilio', 0]];
    const filas = l => l.map((k, i) => '<div class="cm-tk" data-i="' + i + '"><input class="mz-in cm-te" maxlength="2" value="' + esc(k.e || '⚡') + '" aria-label="Icono"><input class="mz-in cm-tnm" maxlength="24" value="' + esc(k.n) + '" placeholder="Nombre"><input class="mz-in cm-tvl" inputmode="numeric" value="' + esc(k.v || '') + '" placeholder="Valor (vacío = se escribe)"><button type="button" class="btn-ghost" data-q="' + i + '" aria-label="Quitar">✕</button></div>').join('');
    let L = teclas().map(x => Object.assign({}, x));
    modal('<h2>⚡ Teclas rápidas</h2><div class="modal-sub">Botones de un toque en la caja para lo que no es un producto: recargas, bolsas, fotocopias… Con valor fijo, o vacío para escribirlo (o escribirlo antes en el teclado).</div>' +
      '<div class="cm-tks"></div><div class="cm-sug">' + sug.map(x => '<button type="button" class="btn-ghost" data-s="' + esc(JSON.stringify(x)) + '">' + x[0] + ' ' + x[1] + (x[2] ? ' ' + plata(x[2]) : '') + '</button>').join('') + '<button type="button" class="btn-ghost" data-s="[&quot;⚡&quot;,&quot;&quot;,0]">➕ Otra</button></div>' +
      '<div class="modal-actions"><button type="button" class="btn-close" data-cerrar>Cancelar</button><button type="button" class="btn-primary cm-ok">Guardar</button></div>', (ov, cerrar) => {
      const box = ov.querySelector('.cm-tks');
      const leer = () => { L = [...box.querySelectorAll('.cm-tk')].map(f => ({ e: f.querySelector('.cm-te').value.trim() || '⚡', n: f.querySelector('.cm-tnm').value.trim().slice(0, 24), v: num(f.querySelector('.cm-tvl').value) })); };
      const pintarT = () => { box.innerHTML = L.length ? filas(L) : '<div class="cm-vacio">Toca una de abajo para agregarla.</div>'; };
      pintarT();
      ov.addEventListener('click', e => {
        const s = e.target.closest('[data-s]'), q = e.target.closest('[data-q]');
        if(s){ leer(); const x = JSON.parse(s.dataset.s); if(L.length >= 12) return; L.push({ e: x[0], n: x[1], v: x[2] }); pintarT(); const u = box.querySelector('.cm-tk:last-child .cm-tnm'); if(u && !x[1]) u.focus(); }
        if(q){ leer(); L.splice(+q.dataset.q, 1); pintarT(); }
      });
      ov.querySelector('.cm-ok').onclick = () => { leer(); d0().teclasCaja = L.filter(x => x.n); guardar(); auditar('teclas rápidas', d0().teclasCaja.map(x => x.n).join(', ')); cerrar(); refrescarCaja(); aviso('⚡ Teclas rápidas guardadas.'); };
    });
  }
  function pintarTeclas(root){
    const box = root.querySelector('.pz-teclas'); if(!box) return;
    const l = teclas(), esCaja = root._pz && root._pz.src && root._pz.src.tipo === 'caja';
    const html = !esCaja || !l.length ? '' : '<span class="pz-favs-t">⚡</span>' + l.map((k, i) => '<button type="button" class="pz-tecla" data-cm="tecla" data-i="' + i + '" title="' + esc(k.v ? k.n + ' ' + plata(k.v) : k.n + ' (se escribe el valor)') + '">' + esc(k.e || '⚡') + ' ' + esc(k.n) + (k.v ? ' <small>' + plata(k.v) + '</small>' : '') + '</button>').join('') +
      (puedeProd() ? '<button type="button" class="pz-tecla pz-tecla-ed" data-cm="teclas" aria-label="Editar teclas rápidas">✏️</button>' : '');
    box.hidden = !html;
    if(box._h !== html){ box._h = html; box.innerHTML = html; }
  }

  // ======================================================================
  // Botones de la caja (junto a Descuento / Nota / Suspender)
  // ======================================================================
  function botones(n, m){
    const c = clienteDe(m && m.cli), cfg = ptsCfg(), b = [];
    if(n){
      b.push('<button type="button" data-cm="cliente">👤 ' + (m && m.cli ? esc(String(m.cli.nombre || '').split(' ')[0] || 'Cliente') : 'Cliente') + '</button>');
      b.push('<button type="button" data-cm="cotizar">📄 Cotizar</button>');
      if(c && cfg.on && Math.floor(c.puntos || 0) >= cfg.minimo && !(m.desc && m.desc.puntos)) b.push('<button type="button" data-cm="puntos" class="cm-b-pts">⭐ Canjear ' + Math.floor(c.puntos) + ' pts</button>');
      if(m && m.desc && m.desc.puntos) b.push('<button type="button" data-cm="sinpuntos" class="cm-b-pts on">⭐ −' + plata(m.desc.v) + ' ✕</button>');
      if(c && c.saldo > 0 && !(m.saldo > 0)) b.push('<button type="button" data-cm="saldo" class="cm-b-sal">💳 Usar saldo ' + plata(c.saldo) + '</button>');
      if(m && m.saldo > 0) b.push('<button type="button" data-cm="sinsaldo" class="cm-b-sal on">💳 Saldo −' + plata(m.saldo) + ' ✕</button>');
    } else {
      const ab = cotizaciones().filter(q => q.estado === 'abierta' && Date.now() <= q.vence).length;
      b.push('<button type="button" data-cm="cotizaciones">📄 Cotizaciones' + (ab ? ' (' + ab + ')' : '') + '</button>', '<button type="button" data-cm="devolucion">↩️ Devolución</button>', '<button type="button" data-cm="recibos">🧾 Recibos</button>', '<button type="button" data-cm="creditos"' + (vencidos().length ? ' class="cm-b-venc"' : '') + '>📅 Créditos' + (vencidos().length ? ' (' + vencidos().length + ' vencidos)' : creditos().length ? ' (' + creditos().length + ')' : '') + '</button>', '<button type="button" data-cm="pantalla">📺 Pantalla cliente</button>');
      if(!teclas().length && puedeProd()) b.push('<button type="button" data-cm="teclas">⚡ Teclas rápidas</button>');
    }
    return b.join('');
  }
  function accion(k, root, el){
    if(k === 'cliente') return elegirCliente(root);
    if(k === 'cotizar') return cotizar();
    if(k === 'cotizaciones') return listaCotizaciones();
    if(k === 'devolucion') return devolucion();
    if(k === 'tecla') return tecla(root, +el.dataset.i);
    if(k === 'teclas') return configTeclas();
    if(k === 'puntos') return canjear();
    if(k === 'sinpuntos'){ const m = P().meta(); delete m.desc; P().ponerMeta(m); return; }
    if(k === 'saldo') return usarSaldo();
    if(k === 'sinsaldo'){ const m = P().meta(); delete m.saldo; P().ponerMeta(m); return; }
    if(k === 'pantalla') return pantalla();
    if(k === 'recibos') return recibos();
    if(k === 'creditos') return verCreditos();
  }

  // ======================================================================
  // 📺 PANTALLA DEL CLIENTE (pantalla.html): otra ventana (BroadcastChannel) o una tablet (canal del servidor)
  // ======================================================================
  const LSP = 'vento_pantalla_cli', CANAL = 'https://canal.vento.local/';
  let bc = null; try{ bc = new BroadcastChannel('ordeva-pantalla'); }catch(e){}
  const azar = n => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'; let r = ''; const b = new Uint8Array(n); try{ crypto.getRandomValues(b); }catch(e){ for(let j = 0; j < n; j++) b[j] = Math.floor(Math.random() * 256); } for(let i = 0; i < n; i++) r += a[b[i] % a.length]; return r; };
  const canalP = crear => { let c = ''; try{ c = localStorage.getItem(LSP) || ''; }catch(e){} if(!/^pt[A-Za-z0-9]{20,40}$/.test(c) && crear){ c = 'pt' + azar(22); try{ localStorage.setItem(LSP, c); }catch(e){} } return /^pt[A-Za-z0-9]{20,40}$/.test(c) ? c : ''; };
  const enlaceP = c => new URL('pantalla.html', location.href).href.split('#')[0] + '#c=' + c;
  let ultimoEnv = '', faseHasta = 0, gracias = null, tPub = 0;
  function estadoP(){
    const r = P() ? P().resumen() : { lineas: [], total: 0, descuento: 0 }, d = d0(), q = d.qrPago;
    const pago = document.querySelector('.pz-pago-ov');
    const f = gracias && Date.now() < faseHasta ? 'gracias' : pago ? 'cobro' : r.lineas.length ? 'venta' : 'espera';
    return { t: 'pantalla', n: String(d.businessName || '').slice(0, 60), f, l: r.lineas.slice(-40).map(x => [String(x.name).slice(0, 40), x.qty, Math.round(x.price * x.qty)]), total: f === 'gracias' ? gracias.total : r.total, desc: r.descuento || 0,
      vu: f === 'gracias' ? gracias.vueltas || 0 : 0, qr: f === 'cobro' && q && (q.img || q.orig) && String(q.img || q.orig).length < 24000 ? String(q.img || q.orig) : '', llave: f === 'cobro' && q && q.llave ? String(q.llave).slice(0, 60) : '' };
  }
  function publicarP(forzar){
    const c = canalP(false), hay = c || bc; if(!hay) return;
    const e = estadoP(), k = JSON.stringify(e); if(!forzar && k === ultimoEnv) return;
    ultimoEnv = k; e.ts = Date.now();
    try{ bc && bc.postMessage(e); }catch(x){}
    try{ localStorage.setItem('vento_pantalla_ultimo', JSON.stringify(e)); }catch(x){}
    if(c){ const ahora = Date.now(); if(ahora - tPub < 600 && !forzar){ clearTimeout(publicarP._t); publicarP._t = setTimeout(() => publicarP(true), 650); return; } tPub = ahora; fetch(CANAL + c, { method: 'POST', body: JSON.stringify(e) }).catch(() => {}); }
  }
  window.addEventListener('vento-pos-cobro', e => { const x = e.detail || {}; gracias = { total: x.entry ? x.entry.total : 0, vueltas: x.pago && x.pago.vueltas || 0 }; faseHasta = Date.now() + 8000; setTimeout(() => publicarP(), 50); });
  if(bc) bc.onmessage = ev => { if(ev.data && ev.data.t === 'hola') publicarP(true); };
  setInterval(() => { try{ publicarP(); }catch(e){} }, 700);
  function pantalla(){
    const c = canalP(true), url = enlaceP(c);
    modal('<h2>📺 Pantalla del cliente</h2><div class="modal-sub">El cliente ve lo que se registra, el total, el QR para pagar y «¡Gracias!».</div>' +
      '<div class="cm-acc"><button type="button" class="btn-primary" data-x="abrir">🖥️ Abrir en otra ventana (segundo monitor)</button></div>' +
      '<div class="cm-pqr"><div class="cm-qr"></div><div><b>📱 En una tablet o celular</b><ol><li>Escanea este código con la cámara de la tablet.</li><li>Déjala mirando al cliente: se actualiza sola.</li></ol><button type="button" class="btn-ghost" data-x="copiar">🔗 Copiar enlace</button></div></div>' +
      '<div class="modal-actions"><button type="button" class="btn-close" data-cerrar>Listo</button></div>', ov => {
      const q = ov.querySelector('.cm-qr'); try{ new QRCode(q, { text: url, width: 150, height: 150, correctLevel: QRCode.CorrectLevel.M }); }catch(e){ q.textContent = url; }
      ov.querySelector('.cm-acc').onclick = () => { const w = window.open(url, 'ordevaPantalla', 'width=1024,height=700'); if(!w) location.href = url; setTimeout(() => publicarP(true), 800); };
      ov.querySelector('[data-x="copiar"]').onclick = () => { try{ navigator.clipboard.writeText(url).then(() => aviso('🔗 Enlace copiado.')); }catch(e){ prompt('Enlace de la pantalla:', url); } };
    });
    setTimeout(() => publicarP(true), 300);
  }

  // 🧾 1.81.0 · Varias cajas: cada venta queda marcada con la caja que la cobró (la de la caja POS y la de las mesas)
  const cajaN = () => { try{ return window.ventoTurno && window.ventoTurno.cajaNombre ? window.ventoTurno.cajaNombre() : ''; }catch(e){ return ''; } };
  window.addEventListener('vento-pos-cobro', e => { const en = e.detail && e.detail.entry, n = cajaN(); if(en && n){ en.caja = n; guardar(); } });
  (function envolverMesa(){
    const f = window.closeTableToHistory; if(typeof f !== 'function' || f._caja){ if(typeof f !== 'function') setTimeout(envolverMesa, 1000); return; }
    const w = function(){ const antes = (d0().history || [])[0]; const r = f.apply(this, arguments); try{ const h = (d0().history || [])[0], n = cajaN(); if(n && h && h !== antes && !h.caja){ h.caja = n; guardar(); } }catch(e){} return r; };
    w._caja = true; window.closeTableToHistory = w;
  })();

  // ======================================================================
  // 🎨 1.81.0 · VARIANTES del producto (talla, color, sabor): cada una con su stock, su código y su precio (opcional)
  // ======================================================================
  const varStock = v => v.stock == null || v.stock === '' ? null : Number(v.stock);
  function elegirVariante(p, n){
    n = Math.max(1, Number(n) || 1);
    modal('<h2>🎨 ' + esc(p.name) + '</h2><div class="modal-sub">¿Cuál lleva?' + (n > 1 ? ' (' + n + ')' : '') + '</div><div class="cm-vars">' +
      p.variantes.map((v, i) => { const st = varStock(v); return '<button type="button" class="cm-var' + (st != null && st <= 0 ? ' ago' : '') + '" data-i="' + i + '"><b>' + esc(v.n) + '</b><small>' + plata(Number(v.precio) || p.price) + (st != null ? ' · ' + (st > 0 ? 'quedan ' + st : 'agotada') : '') + '</small></button>'; }).join('') +
      '</div><div class="modal-actions"><button type="button" class="btn-close" data-cerrar>Cancelar</button></div>', (ov, cerrar) => {
      ov.querySelector('.cm-vars').addEventListener('click', e => { const b = e.target.closest('[data-i]'); if(!b) return; cerrar(); P().variante(p, +b.dataset.i, n); });
    });
  }
  function varianteDeCodigo(raw){
    const c = String(raw || '').trim(); if(!c) return null;
    for(const p of d0().products || []){ const i = (p.variantes || []).findIndex(v => v.cod && String(v.cod).trim() === c); if(i >= 0) return { p, i }; }
    return null;
  }
  window.addEventListener('vento-pos-cobro', e => {
    const en = e.detail && e.detail.entry; if(!en) return; let cambio = false;
    (en.items || []).forEach(it => { if(!it.variante) return; const p = (d0().products || []).find(x => x.id === it.productId); const v = p && (p.variantes || []).find(x => x.n === it.variante);
      if(v && varStock(v) != null){ v.stock = Math.round((varStock(v) - (Number(it.qty) || 0)) * 1000) / 1000; cambio = true; } });
    if(cambio) guardar();
  });
  // Editor en Inventario por código → consultar (junto al precio mayorista)
  function variantesUI(){
    const z = $('viZona'); if(!z || z.querySelector('.cm-pvar')) return;
    const nom = z.querySelector('.vi-card h3'), p = nom && (d0().products || []).find(x => x.name === nom.textContent); if(!p) return;
    const ancla = z.querySelector('.cm-pmay') || [...z.querySelectorAll('.hist-detail-title')].find(x => /Precio por cantidad/.test(x.textContent)); if(!ancla) return;
    const div = document.createElement('div'); div.className = 'cm-pvar';
    const pintarV = () => {
      div.innerHTML = '<div class="hist-detail-title" style="margin-top:8px">🎨 Variantes (talla, color, sabor)</div>' +
        ((p.variantes || []).map((v, i) => '<div class="cm-vrow" data-i="' + i + '"><input class="mz-in" data-k="n" value="' + esc(v.n) + '" placeholder="Ej. Roja M"><input class="mz-in" data-k="stock" type="number" value="' + esc(v.stock == null ? '' : v.stock) + '" placeholder="Stock"><input class="mz-in" data-k="cod" value="' + esc(v.cod || '') + '" placeholder="Código"><input class="mz-in" data-k="precio" type="number" value="' + esc(v.precio || '') + '" placeholder="Precio (si cambia)"><button type="button" class="btn-ghost" data-q="' + i + '">✕</button></div>').join('') || '<div class="settings-desc" style="font-size:12.5px">En la caja, al tocar el producto se elige la variante; cada una lleva su stock.</div>') +
        '<div style="display:flex;gap:6px;margin-top:6px"><button type="button" class="btn-ghost" data-add="1">➕ Variante</button><button type="button" class="btn-ghost" data-save="1">💾 Guardar</button></div>';
    };
    pintarV(); ancla.parentNode.insertBefore(div, ancla);
    const leer = () => { p.variantes = [...div.querySelectorAll('.cm-vrow')].map(f => { const g = k => f.querySelector('[data-k="' + k + '"]').value.trim(); return { n: g('n').slice(0, 30), stock: g('stock') === '' ? null : Number(g('stock')), cod: g('cod').slice(0, 40), precio: num(g('precio')) || 0 }; }).filter(v => v.n); };
    div.addEventListener('click', e => {
      const b = e.target.closest('button'); if(!b) return;
      if(!puedeProd()){ aviso('🔒 Solo el dueño o quien edita productos.'); return; }
      if(b.dataset.add){ leer(); (p.variantes = p.variantes || []).push({ n: '', stock: null, cod: '', precio: 0 }); pintarV(); const u = div.querySelector('.cm-vrow:last-of-type [data-k="n"]'); if(u) u.focus(); return; }
      if(b.dataset.q != null){ leer(); p.variantes.splice(+b.dataset.q, 1); if(!p.variantes.length) delete p.variantes; guardar(); pintarV(); return; }
      if(b.dataset.save){ leer(); if(!p.variantes.length) delete p.variantes; guardar(); auditar('variantes', p.name + ': ' + (p.variantes || []).map(v => v.n).join(', ')); aviso('🎨 ' + p.name + ': ' + ((p.variantes || []).length || 'sin') + ' variantes guardadas.'); pintarV(); }
    });
  }
  setInterval(() => { try{ variantesUI(); }catch(e){} }, 900);

  // ======================================================================
  // 📅 1.81.0 · CRÉDITO con cuotas y fechas (la venta fiada con plan de pagos)
  // ======================================================================
  const sumarDias = (t, dias) => { const d = new Date(t); if(dias === 30) d.setMonth(d.getMonth() + 1); else d.setDate(d.getDate() + dias); return d.getTime(); };
  window.addEventListener('vento-pos-cobro', e => {
    const x = e.detail || {}, en = x.entry, cr = x.pago && x.pago.credito; if(!en || !cr || x.pago.method !== 'debe') return;
    const n = Math.max(1, Math.min(24, cr.n || 1)), total = Math.round(en.debt || en.total), base = Math.floor(total / n);
    let t = Date.now(); const cuotas = [];
    for(let i = 0; i < n; i++){ t = sumarDias(t, cr.cada || 30); cuotas.push({ n: i + 1, fecha: t, valor: i === n - 1 ? total - base * (n - 1) : base, pagado: 0 }); }
    en.credito = { tel: tel(cr.tel), cada: cr.cada || 30, cuotas, desde: Date.now() };
    if(cr.tel){ const c = clienteDe({ tel: cr.tel, nombre: x.pago.deudor }) || (clientes().push({ telefono: tel(cr.tel), nombre: x.pago.deudor || '', visitas: 0, totalGastado: 0, ultimaVisita: Date.now() }), clientes()[clientes().length - 1]); if(c && !c.nombre) c.nombre = x.pago.deudor || ''; }
    guardar();
    setTimeout(() => aviso('📅 Crédito de ' + plata(total) + ' a ' + (x.pago.deudor || 'el cliente') + ': ' + n + (n === 1 ? ' pago' : ' cuotas') + ', la primera el ' + fecha(cuotas[0].fecha) + '.', 6000), 1500);
  });
  const creditos = () => (d0().history || []).filter(h => h.credito && (Number(h.debt) || 0) > 0);
  const pendiente = h => (h.credito.cuotas || []).find(c => c.pagado < c.valor) || null;
  const vencidos = () => creditos().filter(h => { const c = pendiente(h); return c && c.fecha < Date.now(); });
  function abonar(h, valor, metodo){
    valor = Math.min(Math.round(valor), Math.round(Number(h.debt) || 0)); if(!(valor > 0)) return false;
    const ps = h.payments || []; let falta = valor;
    for(let i = ps.length - 1; i >= 0 && falta > 0; i--){ if(ps[i].method !== 'debe') continue; const m = Math.min(Number(ps[i].amount) || 0, falta); ps[i].amount -= m; falta -= m; }
    h.payments = ps.filter(p => p.method !== 'debe' || p.amount > 0);
    const nom = { efectivo: 'Efectivo', nequi: 'Nequi', daviplata: 'DaviPlata', transferencia: 'Transferencia', tarjeta: 'Tarjeta' }[metodo] || 'Efectivo';
    h.payments.push({ method: metodo === 'efectivo' ? 'efectivo' : 'transferencia', note: nom + ' · abono de crédito', amount: valor, at: Date.now(), abono: true, by: quien() });
    h.debt = Math.max(0, Math.round((Number(h.debt) || 0) - valor));
    let r = valor; (h.credito.cuotas || []).forEach(c => { const f = c.valor - c.pagado; if(r > 0 && f > 0){ const m = Math.min(f, r); c.pagado += m; r -= m; if(c.pagado >= c.valor) c.pagadaAt = Date.now(); } });
    if(!h.debt) h.paidLater = new Date().toISOString();
    if(metodo === 'efectivo' && window.ventoTurno && window.ventoTurno.turno()) try{ window.ventoTurno.movimiento('entrada', valor, 'Abono de crédito · ' + (h.person || h.tableName || '')); }catch(e){}
    guardar(); auditar('abono de crédito', (h.person || '') + ' ' + plata(valor) + ' · ' + nom + ' · queda ' + plata(h.debt));
    try{ window.libretaPintar && window.libretaPintar(); }catch(e){}
    return true;
  }
  function textoCuota(h){
    const c = pendiente(h), d = d0(); if(!c) return '';
    return 'Hola ' + (h.person || '') + ', te saluda ' + (d.businessName || 'la tienda') + '. Te recordamos la cuota ' + c.n + ' de ' + h.credito.cuotas.length + ' por ' + plata(c.valor - c.pagado) +
      (c.fecha < Date.now() ? ', que venció el ' : ', que vence el ') + fecha(c.fecha) + '. Saldo total: ' + plata(h.debt) + '. ¡Gracias!';
  }
  function verCreditos(){
    const pintarL = ov => {
      const l = creditos().sort((a, b) => (pendiente(a) || {}).fecha - (pendiente(b) || {}).fecha);
      ov.querySelector('.cm-lista').innerHTML = l.length ? l.map(h => { const c = pendiente(h), venc = c && c.fecha < Date.now(), pag = h.credito.cuotas.filter(q => q.pagado >= q.valor).length;
        return '<div class="cm-cred' + (venc ? ' venc' : '') + '" data-id="' + esc(h.id) + '"><div><b>' + esc(h.person || 'Cliente') + ' · debe ' + plata(h.debt) + '</b><small>' + esc((c ? 'Cuota ' + c.n + '/' + h.credito.cuotas.length + ': ' + plata(c.valor - c.pagado) + (venc ? ' · ⚠️ venció el ' : ' · vence el ') + fecha(c.fecha) : '') + ' · ' + pag + ' pagadas') + '</small></div>' +
          '<div class="cm-cred-b"><button type="button" class="btn-primary" data-x="abonar">💵 Abonar</button>' + (h.credito.tel ? '<button type="button" class="btn-ghost" data-x="wa">📲 Recordar</button>' : '') + '</div></div>'; }).join('') : '<div class="cm-vacio">No hay créditos pendientes. Al fiar en la caja, elige un plan de cuotas.</div>';
    };
    modal('<h2>📅 Créditos</h2><div class="modal-sub">Ventas fiadas con plan de pagos: lo que debe cada cliente y la próxima cuota. Las vencidas salen primero, en rojo.</div><div class="cm-lista"></div><div class="modal-actions"><button type="button" class="btn-close" data-cerrar>Cerrar</button></div>', ov => {
      pintarL(ov);
      ov.querySelector('.cm-lista').addEventListener('click', e => {
        const b = e.target.closest('[data-x]'), f = e.target.closest('[data-id]'); if(!b || !f) return;
        const h = (d0().history || []).find(x => String(x.id) === f.dataset.id); if(!h) return;
        if(b.dataset.x === 'wa'){ const t = tel(h.credito.tel); window.open('https://wa.me/' + (t.length === 10 ? '57' + t : t) + '?text=' + encodeURIComponent(textoCuota(h)), '_blank'); return; }
        const c = pendiente(h);
        modal('<h2>💵 Abono de ' + esc(h.person || 'cliente') + '</h2><div class="modal-sub">Debe ' + plata(h.debt) + (c ? ' · cuota ' + c.n + ': ' + plata(c.valor - c.pagado) : '') + '</div>' +
          '<input class="mz-in cm-av" inputmode="numeric" value="' + (c ? c.valor - c.pagado : h.debt) + '" style="width:100%;font-size:22px;font-weight:800">' +
          '<select class="mz-in cm-am" style="width:100%"><option value="efectivo">💵 Efectivo</option><option value="nequi">📱 Nequi</option><option value="daviplata">📱 DaviPlata</option><option value="transferencia">🏦 Transferencia</option><option value="tarjeta">💳 Tarjeta</option></select>' +
          '<div class="modal-actions"><button type="button" class="btn-close" data-cerrar>Cancelar</button><button type="button" class="btn-primary cm-ok">Guardar abono</button></div>', (o2, c2) => {
          o2.querySelector('.cm-ok').onclick = () => { const v = num(o2.querySelector('.cm-av').value); if(!v) return; if(abonar(h, v, o2.querySelector('.cm-am').value)){ c2(); pintarL(ov); refrescarCaja(); aviso('💵 Abono de ' + plata(v) + '. ' + (h.debt ? 'Queda debiendo ' + plata(h.debt) + '.' : '✅ Quedó a paz y salvo.'), 5000); } };
        });
      });
    });
  }

  // ======================================================================
  // 🔒 1.81.0 · Vender sin existencias pide la clave del dueño (Ajustes → Pedidos, QR y caja)
  // ======================================================================
  const cfgCaja = () => Object.assign({ claveAgotado: false, datafono: false }, d0().cajaCfg || {});
  function sinStock(p, quiere){ return !!(cfgCaja().claveAgotado && p && p.stock != null && p.stock !== '' && Number(p.stock) < quiere); }
  let preguntando = false;
  async function pedirSinStock(p, n, seguir){
    if(preguntando) return; preguntando = true;
    try{
      const hay = Math.max(0, Number(p.stock) || 0), txt = p.name + (hay ? ': solo quedan ' + hay : ': está agotado');
      if(jefe()){
        const ok = typeof showConfirm === 'function' ? await showConfirm({ title: '⚠️ Sin existencias', message: txt + ' en el inventario. ¿Venderlo igual?', confirmText: 'Sí, vender', cancelText: 'No', icon: '📦' }) : confirm(txt + '. ¿Venderlo igual?');
        if(ok){ auditar('venta sin existencias', p.name); seguir(); }
        return;
      }
      const A = window.ventoVentaFix, r = A && A.autorizar ? await A.autorizar('vender ' + p.name + ' sin existencias') : null;
      if(r){ auditar('venta sin existencias', p.name + ' (autorizado con clave)'); seguir(); }
      else aviso('🔒 ' + txt + '. Para venderlo se necesita la clave del dueño.', 5000);
    } finally { preguntando = false; }
  }

  // ======================================================================
  // 🎉 1.81.0 · Promociones por horario («hora feliz»): días, horas, % y a qué aplica
  // ======================================================================
  const promos = () => (Array.isArray(d0().promosHora) ? d0().promosHora : []).filter(x => x && x.on !== false && x.pct > 0);
  const minutos = t => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '')); return m ? +m[1] * 60 + +m[2] : null; };
  function promoActiva(p, ahora){
    ahora = ahora || new Date();
    const dia = ahora.getDay(), min = ahora.getHours() * 60 + ahora.getMinutes();
    return promos().find(x => {
      if(Array.isArray(x.dias) && x.dias.length && !x.dias.includes(dia)) return false;
      const a = minutos(x.desde), b = minutos(x.hasta); if(a == null || b == null) return false;
      const dentro = a <= b ? (min >= a && min < b) : (min >= a || min < b);   // también la que pasa de medianoche (22:00 a 02:00)
      if(!dentro) return false;
      if(!p) return true;
      if(Array.isArray(x.cats) && x.cats.length) return x.cats.includes(p.categoryId);
      return true;
    }) || null;
  }
  function precioPromo(p, lista){ const x = promoActiva(p); return x ? Math.round(lista * (1 - Math.min(90, x.pct) / 100)) : 0; }
  const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  function textoPromo(x){
    const cats = (d0().categories || []).filter(c => (x.cats || []).includes(c.id)).map(c => c.name);
    return '−' + x.pct + ' % ' + (cats.length ? 'en ' + cats.join(', ') : 'en todo') + ' · ' + ((x.dias || []).length && x.dias.length < 7 ? x.dias.map(d => DIAS[d]).join(' ') : 'todos los días') + ' ' + x.desde + '–' + x.hasta;
  }

  // ======================================================================
  // 🧾 1.81.0 · Recibos de cualquier día desde la caja (imprimir / WhatsApp / imagen)
  // ======================================================================
  function recibos(){
    const ventas = () => (d0().history || []).filter(h => (h.items || []).length).slice(0, 800);
    const pintarL = (ov, f) => {
      const s = sinT(f || ''), n = num(f);
      const l = ventas().filter(h => !s || sinT((h.tableName || '') + ' ' + (h.invoiceNo || '') + ' ' + ((h.dian && h.dian.documento) || '') + ' ' + ((h.cliente && h.cliente.nombre) || '') + ' ' + (h.person || '') + ' ' + new Date(h.date).toLocaleDateString('es-CO') + ' ' + h.items.map(i => i.name).join(' ')).includes(s) || (n && Math.round(h.total) === n));
      ov.querySelector('.cm-lista').innerHTML = l.length ? l.slice(0, 60).map(h => '<button type="button" class="cm-it" data-id="' + esc(h.id) + '"><b>' + plata(h.total) + ' · ' + esc(h.tableName || 'Venta') + '</b><small>' + esc(new Date(h.date).toLocaleString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) + ' · ' + h.items.slice(0, 3).map(i => i.qty + ' ' + i.name).join(', ') + (h.items.length > 3 ? '…' : '')) + '</small>' +
        '<span class="cm-tags"><i>🧾</i></span></button>').join('') : '<div class="cm-vacio">No encontré esa venta.</div>';
    };
    modal('<h2>🧾 Recibos</h2><div class="modal-sub">De cualquier día: busca por producto, valor, cliente, fecha (ej. 3/11/2026) o número de factura.</div>' +
      '<input class="mz-in cm-q" placeholder="🔎 Producto, valor, cliente, fecha o factura" style="width:100%"><div class="cm-lista"></div><div class="modal-actions"><button type="button" class="btn-close" data-cerrar>Cerrar</button></div>', (ov) => {
      const q = ov.querySelector('.cm-q'); q.addEventListener('input', () => pintarL(ov, q.value)); pintarL(ov, ''); setTimeout(() => { try{ q.focus(); }catch(e){} }, 40);
      ov.querySelector('.cm-lista').addEventListener('click', e => { const b = e.target.closest('[data-id]'); if(!b) return; const h = (d0().history || []).find(x => String(x.id) === b.dataset.id); if(h) try{ P().recibo(h); }catch(x){ console.error(x); } });
    });
  }

  // ======================================================================
  // 📊 1.81.0 · Cierres Z del mes en Excel (para el contador)
  // ======================================================================
  function cierresCsv(desde, hasta){
    const d = d0(), l = (d.closures || []).filter(c => { const t = new Date(c.date).getTime(); return t >= desde && t < hasta; }).slice().reverse();
    const medios = [...new Set([].concat(...l.map(c => Object.keys(c.medios || { efectivo: 1, transferencia: 1 }))))].filter(k => k !== 'debe');
    const NM = { efectivo: 'Efectivo', transferencia: 'Transferencia', nequi: 'Nequi', daviplata: 'DaviPlata', tarjeta: 'Tarjeta', saldo: 'Saldo a favor', breb: 'Bre-B', qr: 'QR', otro: 'Otro' };
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const filas = [['Cierre Z', 'Fecha', 'Desde', 'Cerró', 'Cuentas', 'Total vendido'].concat(medios.map(k => NM[k] || k), ['Fiado', 'Descuentos', 'Devoluciones', 'Efectivo que debía haber', 'Efectivo contado', 'Diferencia'])];
    l.forEach(c => {
      const m = c.medios || { efectivo: c.totalEfectivo, transferencia: c.totalTransferencia };
      filas.push([c.z ? String(c.z).padStart(4, '0') : '', new Date(c.date).toLocaleString('es-CO'), c.from ? new Date(c.from).toLocaleString('es-CO') : '', c.by || '', c.ticketCount, Math.round(c.totalSold || 0)]
        .concat(medios.map(k => Math.round(m[k] || 0)), [Math.round(c.totalDebe || 0), Math.round(c.descuentos || 0), Math.round(c.devoluciones || 0),
          c.caja ? Math.round(c.caja.esperado || 0) : '', c.caja && c.caja.contado != null ? Math.round(c.caja.contado) : '', c.caja && c.caja.diferencia != null ? Math.round(c.caja.diferencia) : '']));
    });
    return { n: l.length, csv: '﻿' + filas.map(f => f.map(q).join(';')).join('\r\n') };
  }
  function cierresExcel(){
    const h = new Date(), ini = new Date(h.getFullYear(), h.getMonth(), 1), ant = new Date(h.getFullYear(), h.getMonth() - 1, 1);
    const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const bajar = (a, b, nombre) => { const x = cierresCsv(a.getTime(), b.getTime()); if(!x.n){ aviso('No hay cierres en ' + nombre + '.'); return; } const el = document.createElement('a'); el.href = URL.createObjectURL(new Blob([x.csv], { type: 'text/csv' })); el.download = 'cierres-' + nombre.replace(/\s+/g, '-') + '.csv'; document.body.appendChild(el); el.click(); el.remove(); aviso('📊 ' + x.n + ' cierres de ' + nombre + ' descargados (se abre en Excel).'); };
    modal('<h2>📊 Cierres en Excel</h2><div class="modal-sub">Cada cierre Z con su número, fecha, quién cerró, ventas por medio de pago, fiado, descuentos, devoluciones y el arqueo. Para el contador.</div>' +
      '<div class="cm-acc"><button type="button" class="btn-primary" data-x="este">📅 ' + MES[h.getMonth()] + '</button><button type="button" class="btn-ghost" data-x="ant">📅 ' + MES[ant.getMonth()] + '</button></div>' +
      '<div class="modal-actions"><button type="button" class="btn-close" data-cerrar>Cerrar</button></div>', ov => {
      ov.querySelector('.cm-acc').addEventListener('click', e => { const b = e.target.closest('[data-x]'); if(!b) return;
        if(b.dataset.x === 'este') bajar(ini, new Date(h.getFullYear(), h.getMonth() + 1, 1), MES[h.getMonth()] + ' ' + h.getFullYear());
        else bajar(ant, ini, MES[ant.getMonth()] + ' ' + ant.getFullYear()); });
    });
  }
  function botonCierres(){
    const ref = $('vtCajaBtn') || $('closeDayBtn'); if(!ref || $('cmCierresBtn')) return;
    const b = document.createElement('button'); b.type = 'button'; b.id = 'cmCierresBtn'; b.className = 'btn-ghost'; b.style.cssText = 'width:100%;margin-top:8px';
    b.textContent = '📊 Cierres Z en Excel (para el contador)'; b.onclick = cierresExcel;
    ref.insertAdjacentElement('afterend', b);
  }

  // ======================================================================
  // ⚙️ 1.81.0 · Ajustes → Pedidos, QR y caja: agotados con clave, ⭐ puntos y 🎉 promociones por horario
  // ======================================================================
  function ajustes(){
    const clave = () => JSON.stringify([d0().cajaCfg || {}, d0().puntosCfg || {}, d0().promosHora || [], (d0().categories || []).length, cajaN()]);
    const ya = $('cmAjustes'); if(ya){ if(ya._k !== clave() && !ya.contains(document.activeElement)){ ya._k = clave(); ya._pintar(); } return; }
    const gs = [...document.querySelectorAll('#view-ajustes .settings-group[data-cat="pedidos"]')]; if(!gs.length) return;
    // Su propio grupo «🧾 Caja POS», al final de «Pedidos, QR y caja»
    const g = document.createElement('div'); g.className = 'settings-group'; g.dataset.cat = 'pedidos'; g.id = 'cmAjustesG';
    gs[gs.length - 1].insertAdjacentElement('afterend', g);
    const box = document.createElement('div'); box.id = 'cmAjustes'; box.style.cssText = 'display:flex;flex-direction:column;align-items:stretch;gap:10px';
    g.appendChild(box);
    const pintarA = () => {
      const c = cfgCaja(), pc = ptsCfg(), pr = Array.isArray(d0().promosHora) ? d0().promosHora : [];
      box.innerHTML = '<h2 style="margin:0">🧾 Caja POS</h2><div class="settings-desc" style="margin:0">Cajas, datáfono, existencias, puntos y promociones por horario.</div>' +
        '<label class="cm-op">🧾 Nombre de la caja de este equipo (para tener varias cajas, cada una con su turno y su arqueo): <input class="mz-in" data-a="cajanom" maxlength="30" placeholder="Ej. Caja 2 (vacío = la caja principal)" value="' + esc(cajaN()) + '" style="max-width:240px;margin:0"></label>' +
        '<label class="cm-op"><input type="checkbox" data-a="agotado"' + (c.claveAgotado ? ' checked' : '') + '> 🔒 Pedir la clave del dueño para vender un producto sin existencias</label>' +
        '<label class="cm-op"><input type="checkbox" data-a="datafono"' + (c.datafono ? ' checked' : '') + '> 💳 Datáfono (Bold u otro): al cobrar con tarjeta, esperar el aviso del pago y cobrar solo <small style="opacity:.75">(el datáfono debe avisar a este celular: Ajustes → Pagos)</small></label>' +
        '<label class="cm-op"><input type="checkbox" data-a="ptson"' + (pc.on ? ' checked' : '') + '> ⭐ Puntos para los clientes: 1 punto por cada <input class="mz-in" type="number" min="100" step="100" data-a="cada" value="' + pc.cada + '" style="width:90px;margin:0"> · cada punto vale <input class="mz-in" type="number" min="1" data-a="valor" value="' + pc.valor + '" style="width:70px;margin:0"> · se canjean desde <input class="mz-in" type="number" min="1" data-a="minimo" value="' + pc.minimo + '" style="width:70px;margin:0"></label>' +
        '<div><b style="font-size:14px">🎉 Promociones por horario</b><div class="settings-desc" style="font-size:12.5px">«Hora feliz» y descuentos por día: la caja los pone sola en esa hora.</div>' +
        (pr.length ? pr.map((x, i) => '<div class="cm-promo"><label><input type="checkbox" data-p="' + i + '"' + (x.on !== false ? ' checked' : '') + '> <b>' + esc(x.n || 'Promoción') + '</b> ' + esc(textoPromo(x)) + '</label><button type="button" class="btn-ghost" data-pq="' + i + '">✕</button></div>').join('') : '') +
        '<details class="cm-nuevo"><summary>➕ Nueva promoción</summary>' +
          '<input class="mz-in" data-n="n" maxlength="30" placeholder="Nombre (ej. Hora feliz)" style="width:100%">' +
          '<div class="cm-fila"><input class="mz-in" data-n="desde" type="time" value="17:00"><input class="mz-in" data-n="hasta" type="time" value="19:00"><input class="mz-in" data-n="pct" type="number" min="1" max="90" placeholder="% menos" style="max-width:100px"></div>' +
          '<div class="cm-dias">' + DIAS.map((d, i) => '<label><input type="checkbox" data-dia="' + i + '" checked> ' + d + '</label>').join('') + '</div>' +
          '<select class="mz-in" data-n="cat" style="width:100%"><option value="">En todos los productos</option>' + (d0().categories || []).map(cc => '<option value="' + esc(cc.id) + '">Solo en ' + esc(cc.name) + '</option>').join('') + '</select>' +
          '<button type="button" class="btn-primary" data-a="addpromo" style="width:100%">Guardar promoción</button></details></div>';
    };
    box._pintar = pintarA; box._k = clave();
    pintarA();
    box.addEventListener('change', e => {
      const t = e.target, d = d0();
      if(t.dataset.a === 'cajanom'){ const T = window.ventoTurno; if(T && T.turno() && !confirm('Esta caja tiene un turno abierto. Si le cambias el nombre, el turno queda en la caja anterior. ¿Seguir?')){ pintarA(); return; } T && T.ponerCajaNombre(t.value); aviso(t.value.trim() ? '🧾 Este equipo es «' + t.value.trim() + '»: su propio turno y arqueo.' : '🧾 Este equipo es la caja principal.'); refrescarCaja(); return; }
      if(!jefe()){ aviso('🔒 Esto lo cambia el dueño o el administrador.'); pintarA(); return; }
      if(t.dataset.a === 'datafono'){ d.cajaCfg = Object.assign({}, d.cajaCfg || {}, { datafono: t.checked }); guardar(); aviso(t.checked ? '💳 Con tarjeta, la caja esperará el aviso del datáfono.' : 'Listo: la tarjeta se confirma a mano.'); }
      else if(t.dataset.a === 'agotado'){ d.cajaCfg = Object.assign({}, d.cajaCfg || {}, { claveAgotado: t.checked }); guardar(); aviso(t.checked ? '🔒 Vender sin existencias pedirá la clave del dueño.' : 'Listo: se puede vender sin existencias.'); }
      else if(['ptson', 'cada', 'valor', 'minimo'].includes(t.dataset.a)){ const pc = ptsCfg(); if(t.dataset.a === 'ptson') pc.on = t.checked; else pc[t.dataset.a] = Math.max(1, num(t.value) || pc[t.dataset.a]); d.puntosCfg = pc; guardar(); }
      else if(t.dataset.p != null){ const x = (d.promosHora || [])[+t.dataset.p]; if(x){ x.on = t.checked; guardar(); refrescarCaja(); } }
    });
    box.addEventListener('click', e => {
      const t = e.target.closest('button'); if(!t) return; const d = d0();
      if(t.dataset.pq != null){ if(!jefe()) return; (d.promosHora || []).splice(+t.dataset.pq, 1); guardar(); pintarA(); refrescarCaja(); return; }
      if(t.dataset.a === 'addpromo'){
        if(!jefe()){ aviso('🔒 Las promociones las pone el dueño o el administrador.'); return; }
        const v = k => box.querySelector('[data-n="' + k + '"]').value;
        const x = { n: v('n').trim().slice(0, 30) || 'Promoción', desde: v('desde'), hasta: v('hasta'), pct: Math.min(90, num(v('pct'))), dias: [...box.querySelectorAll('[data-dia]:checked')].map(i => +i.dataset.dia), cats: v('cat') ? [v('cat')] : [], on: true };
        if(!x.pct || minutos(x.desde) == null || minutos(x.hasta) == null){ aviso('Escribe las horas y el % de descuento.'); return; }
        (d.promosHora = d.promosHora || []).push(x); guardar(); auditar('promoción por horario', x.n + ' ' + textoPromo(x)); pintarA(); refrescarCaja(); aviso('🎉 ' + x.n + ' guardada: ' + textoPromo(x));
      }
    });
  }
  setInterval(() => { try{ botonCierres(); ajustes(); }catch(e){} }, 1500);

  function pintar(root){
    pintarTeclas(root);
    // 🧾 El nombre de esta caja arriba («Caja POS · Caja 2»)
    try{ const tb = root.closest('#pzCajaOv') && document.querySelector('#pzCajaOv .pz-caja-top > b'); const n = cajaN(); if(tb){ const t = '🧾 Caja POS' + (n ? ' · ' + n : ''); if(tb.textContent !== t) tb.textContent = t; } }catch(e){}
    // 🎉 La promoción que está corriendo, a la vista en la venta
    const ex = root.querySelector('.pz-extra'); if(!ex) return;
    let b = ex.querySelector('.cm-promo-v'); const x = root._pz && root._pz.src && root._pz.src.tipo === 'caja' ? promoActiva(null) : null;
    if(!x){ if(b) b.remove(); return; }
    if(!b){ b = document.createElement('div'); b.className = 'pz-notav cm-promo-v'; ex.appendChild(b); }
    const t = '🎉 ' + (x.n || 'Promoción') + ': ' + textoPromo(x); if(b.textContent !== t) b.textContent = t;
  }

  // 📦 Precio mayorista del producto (Inventario por código → consultar)
  function precioMayorUI(){
    const z = $('viZona'); if(!z || z.querySelector('.cm-pmay')) return;
    const titulo = [...z.querySelectorAll('.hist-detail-title')].find(x => /Precio por cantidad/.test(x.textContent)); if(!titulo) return;
    const nom = z.querySelector('.vi-card h3'); const p = nom && (d0().products || []).find(x => x.name === nom.textContent); if(!p) return;
    const div = document.createElement('div'); div.className = 'cm-pmay';
    div.innerHTML = '<div class="hist-detail-title" style="margin-top:8px">📦 Precio mayorista (clientes mayoristas)</div><div style="display:flex;gap:6px"><input class="mz-in" type="number" min="0" placeholder="Precio para mayoristas" value="' + esc(p.precioMayor || '') + '" style="flex:1"><button type="button" class="btn-ghost">💾</button></div>';
    titulo.parentNode.insertBefore(div, titulo);
    div.querySelector('button').onclick = () => { if(!puedeProd()){ aviso('🔒 Solo el dueño o quien edita productos.'); return; } const v = num(div.querySelector('input').value); if(v) p.precioMayor = v; else delete p.precioMayor; guardar(); auditar('precio mayorista', p.name + ': ' + (v ? plata(v) : 'quitado')); aviso('📦 ' + p.name + ': ' + (v ? 'mayoristas a ' + plata(v) : 'sin precio mayorista') + '.'); };
  }
  setInterval(() => { try{ precioMayorUI(); }catch(e){} }, 800);

  const css = document.createElement('style'); css.id = 'cmCss';
  css.textContent =
    '.cm-ov{z-index:9550}.cm{max-width:480px;width:calc(100% - 24px)}.cm h2{margin:0 0 4px}.cm .modal-sub{margin-bottom:10px}.cm .mz-in{margin-top:8px}' +
    '.cm-lista{max-height:46vh;overflow:auto;margin-top:8px;display:flex;flex-direction:column;gap:6px}' +
    '.cm-it{display:grid;grid-template-columns:1fr auto;gap:2px 10px;text-align:left;border:1px solid var(--line);border-radius:12px;background:var(--surface);color:var(--ink);padding:9px 12px;font:inherit;cursor:pointer}.cm-it b{font-size:14.5px}.cm-it small{grid-column:1;color:var(--ink-soft);font-size:12.5px}' +
    '.cm-tags{grid-column:2;grid-row:1/span 2;display:flex;flex-direction:column;gap:3px;align-items:flex-end;justify-content:center}.cm-tags i{font-style:normal;font-size:11.5px;font-weight:800;padding:2px 8px;border-radius:999px;background:color-mix(in srgb,var(--ink) 8%,transparent);white-space:nowrap}.cm-tags i.ok{background:rgba(22,163,74,.15);color:#15803d}.cm-tags i.mal{background:rgba(220,38,38,.12);color:#b91c1c}' +
    '.cm-vacio{color:var(--ink-soft);font-size:13.5px;padding:10px 2px}.cm-fila{display:flex;gap:8px;align-items:center}.cm-fila .mz-in{flex:1}.cm-lab{display:flex;align-items:center;gap:6px;font-size:14px;margin-top:8px}' +
    '.cm-nuevo{margin-top:10px;border:1px dashed var(--line);border-radius:12px;padding:8px 10px}.cm-nuevo summary{cursor:pointer;font-weight:800}.cm-nuevo .btn-primary{margin-top:10px}' +
    '.cm-lineas{max-height:34vh;overflow:auto;border:1px solid var(--line);border-radius:12px;padding:4px 10px;margin:6px 0}.cm-lineas div,.cm-tl{display:flex;justify-content:space-between;gap:10px;padding:5px 0;font-size:14px;border-bottom:1px solid var(--line)}.cm-lineas div:last-child{border:0}' +
    '.cm-tg{font-size:17px;font-weight:900;border-bottom:0}.cm-acc{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.cm-acc>*{flex:1 1 auto;width:auto!important;margin:0!important}' +
    '.cm-tks{display:flex;flex-direction:column;gap:6px;margin-top:6px}.cm-tk{display:grid;grid-template-columns:46px minmax(0,1fr) 120px auto;gap:6px;align-items:center}.cm-tk .mz-in{margin:0;min-width:0}.cm-te{text-align:center}' +
    '.cm-sug{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.cm-sug .btn-ghost{width:auto;margin:0;padding:6px 10px;font-size:13px}' +
    '.cm-pqr{display:flex;gap:14px;align-items:flex-start;margin-top:12px;font-size:13.5px}.cm-pqr ol{margin:6px 0 8px;padding-left:18px}.cm-qr{background:#fff;padding:8px;border-radius:10px;line-height:0;flex:none}.cm-qr img,.cm-qr canvas{width:150px;height:150px}' +
    // Teclas rápidas en la caja
    '.pz-teclas{display:flex;gap:6px;overflow-x:auto;padding:2px 0 8px;scrollbar-width:thin;align-items:center}.pz-teclas[hidden]{display:none}' +
    '.pz .pz-tecla{flex:none;border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:12px;padding:8px 12px;font:inherit;font-size:13.5px;font-weight:800;cursor:pointer;white-space:nowrap}.pz .pz-tecla small{font-weight:600;color:var(--ink-soft)}.pz .pz-tecla-ed{padding:8px 10px;background:none;border-style:dashed}' +
    '.pz-herr2 .cm-b-pts,.pz-herr2 .cm-b-sal{border-color:#f59e0b!important}.pz-herr2 .cm-b-pts.on,.pz-herr2 .cm-b-sal.on{background:color-mix(in srgb,#f59e0b 16%,var(--surface))!important}' +
    '.cm-op{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:14px;line-height:1.6}.cm-promo{display:flex;align-items:center;gap:8px;justify-content:space-between;font-size:13.5px;padding:4px 0}.cm-promo .btn-ghost{width:auto;margin:0;padding:4px 10px}' +
    '.cm-vars{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px}.cm-var{border:1px solid var(--line);border-radius:12px;background:var(--surface);color:var(--ink);padding:12px;font:inherit;cursor:pointer;text-align:left}.cm-var b{display:block;font-size:15px}.cm-var small{color:var(--ink-soft)}.cm-var.ago{opacity:.55}' +
    '.cm-vrow{display:grid;grid-template-columns:minmax(0,1.4fr) 70px minmax(0,1fr) 90px auto;gap:5px;margin-top:5px}.cm-vrow .mz-in{margin:0;min-width:0}.cm-vrow .btn-ghost{width:auto;margin:0;padding:4px 8px}' +
    '.cm-cred{display:flex;align-items:center;gap:10px;justify-content:space-between;border:1px solid var(--line);border-radius:12px;padding:9px 12px;background:var(--surface)}.cm-cred.venc{border-color:#dc2626;background:color-mix(in srgb,#dc2626 7%,var(--surface))}' +
    '.cm-cred b{display:block;font-size:14.5px}.cm-cred small{color:var(--ink-soft);font-size:12.5px}.cm-cred.venc small{color:#b91c1c;font-weight:700}.cm-cred-b{display:flex;gap:6px;flex:none}.cm-cred-b>*{width:auto!important;margin:0!important;padding:7px 10px!important;font-size:13px!important}' +
    '.pz-herr2 .cm-b-venc{border-color:#dc2626!important;color:#b91c1c!important;font-weight:800}' +
    '.cm-dias{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;font-size:13.5px}.cm-promo-v{color:#b45309;font-weight:800}' +
    '@media (max-width:520px){.cm-tk{grid-template-columns:40px minmax(0,1fr) 92px auto}.cm-pqr{flex-direction:column}}';
  document.head.appendChild(css);

  window.ventoCajaMas = { botones, accion, pintar, precioCliente, clienteDe, elegirCliente, cotizar, cotizaciones, listaCotizaciones, verCotizacion, pasarAVenta, textoCot, htmlCot,
    devolucion, sumarSaldo, elegirVariante, varianteDeCodigo, creditos, vencidos, abonar, verCreditos, textoCuota, corte, corteX, cambioTurno, sinStock, pedirSinStock, precioPromo, promoActiva, recibos, cierresCsv, cierresExcel, textoCorte, teclas, configTeclas, tecla, pantalla, estadoP, publicarP, canalP, enlaceP, ptsCfg, canjear, usarSaldo };
})();
