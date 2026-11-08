/* ORDEVA · lib/vento-agencia.js — 1.82.0: ✈️ Agencias de viajes y turismo.
   • Cupos reales: si un plan tiene «Cupos disponibles» (Productos → el plan → Detalles), al agregarlo a una cuenta se
     revisa cuántos quedan (los vendidos + los que están en cuentas abiertas). No deja pasarse: «ya no hay cupos».
   • «🎫 Voucher y viajeros» en la cuenta del cliente: los viajeros (nombre, documento, nacimiento, contacto de emergencia)
     y el voucher para el cliente (imprimir o guardar en PDF, o por WhatsApp) con el plan (destino, fechas, incluye, no
     incluye), los viajeros, el total, lo pagado, el saldo y el RNT (obligatorio en Colombia, Ajustes → Facturación).
   • Los viajeros quedan guardados con la venta al cobrar.
   • 🤖 1.94.0: el agente (agente.html) muestra los planes con destino, salida, duración, precio y los cupos que quedan
     (paraCarta, viaja con la carta) y toma la solicitud del cliente («PLAN: nombre | celular | plan | personas | fecha |
     nota» por el canal del negocio). Llega a «✈️ Solicitudes del agente» (data.solicitudesPlan, el mismo id en todos los
     equipos): WhatsApp al cliente, «Crear la cuenta» (la cuenta del cliente con el plan, que aparta los cupos) o
     descartar. El agente nunca confirma ni cobra: el cupo queda apartado cuando la agencia crea la cuenta. */
(function(){
  'use strict';
  if(window.ventoAgencia) return;
  const D = () => (typeof data !== 'undefined' ? data : null);
  const activo = () => { const d = D(); return !!(d && d.businessType === 'agencia_viajes'); };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plata = n => { try{ return fmt(Math.round(n || 0)); }catch(e){ return '$' + Math.round(n || 0).toLocaleString('es-CO'); } };
  const toast = (t, ms) => { try{ showToast(t, ms || 6000); }catch(e){} };
  const nrm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  // ---------- Cupos ----------
  function cupos(p){
    if(!p || !p.det) return null;
    const n = parseInt(String(p.det.cupos || '').replace(/\D/g, ''), 10); if(!(n > 0)) return null;
    const d = D(); let vendidos = 0, abiertos = 0;
    (d.history || []).forEach(h => (h.items || []).forEach(it => { if(nrm(it.name) === nrm(p.name)) vendidos += Number(it.qty) || 0; }));
    Object.keys(d.tables || {}).forEach(k => (d.tables[k].items || []).forEach(it => { if(it.productId === p.id) abiertos += Number(it.qty) || 0; }));
    return { total: n, vendidos, abiertos, quedan: n - vendidos - abiertos };
  }
  function envolverAgregar(){
    const f = window.addFavoriteToTable; if(typeof f !== 'function' || f._ag) return;
    const g = function(pid){
      if(activo()){
        const d = D(), p = (d.products || []).find(x => x.id === pid), c = cupos(p);
        if(c && c.quedan <= 0){ toast('🚫 «' + p.name + '» ya no tiene cupos: ' + c.total + ' de ' + c.total + ' vendidos o apartados' + (p.det.salida ? ' (salida ' + p.det.salida + ')' : '') + '.', 8000); return; }
        const r = f.apply(this, arguments);
        const c2 = cupos(p); if(c2 && c2.quedan <= 3) toast('✈️ «' + p.name + '»: ' + (c2.quedan > 0 ? 'quedan ' + c2.quedan + (c2.quedan === 1 ? ' cupo' : ' cupos') : 'era el último cupo') + '.', 5000);
        return r;
      }
      return f.apply(this, arguments);
    };
    // 1.85.0: lleva las marcas de los demás módulos (si no, se envolvían uno al otro sin fin: miles de capas y, a la
    // media hora de tener ORDEVA abierto, «Maximum call stack size exceeded» al cerrar una cuenta).
    for(const k in f) if(k.charAt(0) === '_') g[k] = f[k];
    g._ag = true; window.addFavoriteToTable = g;
  }
  // ---------- Viajeros y voucher ----------
  const CAMPOS = [['nombre', 'Nombre completo'], ['doc', 'Documento (CC, pasaporte…)'], ['nacimiento', 'Nacimiento (dd/mm/aaaa)'], ['emergencia', 'Contacto de emergencia (nombre y teléfono)']];
  function planes(t){
    const d = D(), ps = d.products || [];
    return (t.items || []).map(it => ({ it, p: ps.find(x => x.id === it.productId) || ps.find(x => nrm(x.name) === nrm(it.name)) || null })).filter(x => x.p && x.p.det && Object.keys(x.p.det).some(k => x.p.det[k]));
  }
  function datosVoucher(id){
    const d = D(), t = d.tables[id] || {}, total = (t.items || []).reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 0), 0);
    let saldo = total; try{ saldo = tableBalance(id); }catch(e){}
    let cliente = ''; try{ cliente = tableLabel(id); }catch(e){ cliente = 'Cliente ' + id; }
    return { negocio: d.businessName || '', nit: d.nit || '', rnt: d.rnt || '', dir: d.bizAddress || '', tel: d.bizWhatsapp || '', cliente, n: 'V-' + String(id) + '-' + new Date().toISOString().slice(2, 10).replace(/-/g, ''),
      fecha: new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }), items: (t.items || []).map(it => ({ qty: it.qty, name: it.name, v: (Number(it.price) || 0) * (Number(it.qty) || 0) })),
      planes: planes(t).map(x => ({ name: x.p.name, det: x.p.det })), viajeros: (t.viajeros || []).filter(v => v && v.nombre), total, pagado: Math.max(0, total - saldo), saldo };
  }
  const ETQ = { destino: 'Destino', dias: 'Duración', salida: 'Salida', incluye: 'Incluye', noincluye: 'No incluye', personas: 'Precio por' };
  function voucherTexto(v){
    const L = ['*🎫 Voucher ' + v.n + ' — ' + v.negocio + '*'];
    if(v.nit) L.push('NIT: ' + v.nit); if(v.rnt) L.push('RNT: ' + v.rnt);
    L.push('Cliente: ' + v.cliente, 'Fecha: ' + v.fecha, '');
    v.planes.forEach(pl => { L.push('*' + pl.name + '*'); Object.keys(ETQ).forEach(k => { if(pl.det[k]) L.push(ETQ[k] + ': ' + pl.det[k] + (k === 'personas' ? ' personas' : '')); }); L.push(''); });
    if(v.viajeros.length){ L.push('*Viajeros:*'); v.viajeros.forEach((x, i) => L.push((i + 1) + '. ' + x.nombre + (x.doc ? ' · ' + x.doc : '') + (x.nacimiento ? ' · nac. ' + x.nacimiento : '') + (x.emergencia ? ' · emergencia: ' + x.emergencia : ''))); L.push(''); }
    L.push('Total: ' + plata(v.total), 'Pagado: ' + plata(v.pagado)); if(v.saldo > 0) L.push('*Saldo por pagar: ' + plata(v.saldo) + '*');
    if(!v.rnt) L.push('', '(Falta el RNT de la agencia: Ajustes → Facturación)');
    return L.join('\n');
  }
  function voucherHtml(v){
    return '<!doctype html><meta charset="utf-8"><title>Voucher ' + esc(v.n) + '</title><body style="font-family:Arial,sans-serif;max-width:720px;margin:20px auto;color:#111">' +
      '<h1 style="margin:0">🎫 Voucher ' + esc(v.n) + '</h1><h2 style="margin:4px 0">' + esc(v.negocio) + '</h2>' +
      '<div>' + [v.nit ? 'NIT ' + esc(v.nit) : '', v.rnt ? '<b>RNT ' + esc(v.rnt) + '</b>' : '<span style="color:#b00">Falta el RNT</span>', esc(v.dir), esc(v.tel)].filter(Boolean).join(' · ') + '</div><hr>' +
      '<p><b>Cliente:</b> ' + esc(v.cliente) + ' · <b>Fecha:</b> ' + esc(v.fecha) + '</p>' +
      v.planes.map(pl => '<h3 style="margin:12px 0 4px">' + esc(pl.name) + '</h3><table style="border-collapse:collapse">' + Object.keys(ETQ).filter(k => pl.det[k]).map(k => '<tr><td style="padding:2px 12px 2px 0;color:#555">' + ETQ[k] + '</td><td>' + esc(pl.det[k]) + (k === 'personas' ? ' personas' : '') + '</td></tr>').join('') + '</table>').join('') +
      (v.viajeros.length ? '<h3>Viajeros</h3><table style="border-collapse:collapse;width:100%" border="1" cellpadding="6"><tr><th>#</th><th>Nombre</th><th>Documento</th><th>Nacimiento</th><th>Emergencia</th></tr>' + v.viajeros.map((x, i) => '<tr><td>' + (i + 1) + '</td><td>' + esc(x.nombre) + '</td><td>' + esc(x.doc || '') + '</td><td>' + esc(x.nacimiento || '') + '</td><td>' + esc(x.emergencia || '') + '</td></tr>').join('') + '</table>' : '') +
      '<h3>Valor</h3><div>Total: <b>' + plata(v.total) + '</b> · Pagado: ' + plata(v.pagado) + (v.saldo > 0 ? ' · <b>Saldo por pagar: ' + plata(v.saldo) + '</b>' : ' · ✅ Pagado') + '</div>' +
      '<p style="color:#555;font-size:12px;margin-top:24px">Presente este voucher al prestador del servicio.</p></body>';
  }
  function abrir(id){
    const d = D(), t = d && d.tables[id]; if(!t) return;
    if(!Array.isArray(t.viajeros)) t.viajeros = [];
    if(!t.viajeros.length) t.viajeros.push({});
    let ov = document.getElementById('agOv');
    if(!ov){ ov = document.createElement('div'); ov.className = 'overlay'; ov.id = 'agOv'; ov.setAttribute('data-novocab', ''); document.body.appendChild(ov); }
    const fila = (v, i) => '<div class="ag-v" data-i="' + i + '" style="border:1px solid var(--line);border-radius:12px;padding:8px;margin:6px 0"><b>Viajero ' + (i + 1) + '</b>' +
      CAMPOS.map(([k, l]) => '<input class="mz-in" data-k="' + k + '" placeholder="' + esc(l) + '" value="' + esc(v[k] || '') + '" style="width:100%;margin-top:4px;box-sizing:border-box">').join('') +
      (i > 0 ? '<button type="button" class="btn-ghost" data-ag="quitar" data-i="' + i + '" style="margin-top:4px">Quitar</button>' : '') + '</div>';
    ov.innerHTML = '<div class="modal" style="max-width:520px"><div class="modal-title-row"><h2>🎫 Voucher y viajeros</h2><button class="rename-table-btn" type="button" data-ag="x">✕</button></div>' +
      (d.rnt ? '' : '<div class="empty-note" style="color:var(--warn,#b45309)">⚠️ Falta el RNT de la agencia (obligatorio en el voucher): Ajustes → Facturación.</div>') +
      '<div id="agViajeros">' + t.viajeros.map(fila).join('') + '</div>' +
      '<button type="button" class="btn-ghost" data-ag="mas" style="width:100%">➕ Otro viajero</button>' +
      '<div class="modal-actions"><button type="button" class="btn-ghost" data-ag="wa">📲 WhatsApp</button><button type="button" class="btn-primary" data-ag="imprimir">🖨️ Imprimir o PDF</button></div></div>';
    const leer = () => { const L = []; ov.querySelectorAll('.ag-v').forEach(el => { const v = {}; el.querySelectorAll('[data-k]').forEach(i => { const x = i.value.trim().slice(0, 120); if(x) v[i.dataset.k] = x; }); L.push(v); }); t.viajeros = L; try{ saveData(); }catch(e){} };
    ov.oninput = () => leer();
    ov.onclick = e => {
      const b = e.target.closest('[data-ag]'); if(!b && e.target !== ov) return;
      const a = b ? b.dataset.ag : 'x';
      if(a === 'x'){ leer(); ov.classList.remove('show'); return; }
      leer();
      if(a === 'mas'){ t.viajeros.push({}); abrir(id); return; }
      if(a === 'quitar'){ t.viajeros.splice(Number(b.dataset.i), 1); abrir(id); return; }
      const v = datosVoucher(id);
      if(a === 'wa'){ try{ whatsappShareText(voucherTexto(v)); }catch(x){ window.open('https://wa.me/?text=' + encodeURIComponent(voucherTexto(v)), '_blank'); } return; }
      if(a === 'imprimir'){ const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;width:0;height:0;border:0'; document.body.appendChild(f); const w = f.contentDocument; w.open(); w.write(voucherHtml(v)); w.close(); window.__ultimoVoucher = voucherHtml(v);
        setTimeout(() => { try{ f.contentWindow.print(); }catch(x){} setTimeout(() => f.remove(), 60000); }, 300); }
    };
    ov.classList.add('show');
  }
  // Botón en la cuenta del cliente (solo agencias)
  function pintar(){
    const ov = document.getElementById('overlay'), id = typeof currentTable !== 'undefined' ? currentTable : null;
    let b = document.getElementById('agVoucherBtn');
    if(!activo() || !ov || !ov.classList.contains('show') || id == null){ if(b) b.hidden = true; return; }
    if(!b){
      const ref = document.getElementById('grupoBar') || ov.querySelector('.mesa-buscar'); if(!ref) return;
      b = document.createElement('button'); b.type = 'button'; b.id = 'agVoucherBtn'; b.className = 'btn-ghost'; b.setAttribute('data-novocab', '');
      b.style.cssText = 'width:100%;margin:6px 0'; b.onclick = () => abrir(currentTable);
      ref.parentNode.insertBefore(b, ref.nextSibling);
    }
    const t = D().tables[id] || {}, n = (t.viajeros || []).filter(v => v && v.nombre).length;
    const txt = '🎫 Voucher y viajeros' + (n ? ' · ' + n + (n === 1 ? ' viajero' : ' viajeros') : '');
    if(b.textContent !== txt) b.textContent = txt;
    b.hidden = !(t.items || []).length;
  }
  // Los viajeros quedan con la venta al cobrar.
  function envolverCerrar(){
    const f = window.closeTableToHistory; if(typeof f !== 'function' || f._ag) return;
    const g = function(id){ const d = D(), t = d && d.tables[id], v = t && Array.isArray(t.viajeros) ? t.viajeros.filter(x => x && x.nombre) : null, n0 = (d.history || []).length;
      const r = f.apply(this, arguments);
      try{ if(v && v.length && d.history.length > n0) d.history[0].viajeros = v; if(t) delete t.viajeros; saveData(); }catch(e){}
      return r; };
    // 1.85.0: lleva las marcas de los demás módulos (si no, se envolvían uno al otro sin fin: miles de capas y, a la
    // media hora de tener ORDEVA abierto, «Maximum call stack size exceeded» al cerrar una cuenta).
    for(const k in f) if(k.charAt(0) === '_') g[k] = f[k];
    g._ag = true; window.closeTableToHistory = g;
  }
  // ---------- 🤖 1.94.0: el agente de planes ----------
  const recorte = (x, n) => String(x == null ? '' : x).replace(/\s+/g, ' ').trim().slice(0, n);
  // Lo que viaja con la carta para el agente: { "Nombre del plan": [destino, salida, duración, quedan (-1 = sin tope), incluye, por cuántas personas] }
  function paraCarta(){
    const d = D(); if(!activo() || !d) return null;
    const out = {};
    (d.products || []).forEach(p => {
      if(!p || p.oculto || !p.det || !(p.det.destino || p.det.salida || p.det.dias)) return;
      const c = cupos(p), por = parseInt(String(p.det.personas || '').replace(/\D/g, ''), 10);
      out[String(p.name).slice(0, 40)] = [recorte(p.det.destino, 30), recorte(p.det.salida, 30), recorte(p.det.dias, 30), c ? Math.max(0, c.quedan) : -1, recorte(p.det.incluye, 70), por > 1 ? por : 1];
    });
    return Object.keys(out).length ? out : null;
  }
  const lista = () => { const d = D(); if(!d) return []; if(!Array.isArray(d.solicitudesPlan)) d.solicitudesPlan = []; return d.solicitudesPlan; };
  const pendientes = () => lista().filter(x => x && x.estado === 'nueva');
  const guardar = () => { try{ saveData(); }catch(e){} };
  function recibir(cuerpo){
    const d = D(); if(!d) return null;
    const p = String(cuerpo || '').split('|').map(x => x.trim());
    // El id es el del mensaje del canal (el mismo en todos los equipos): la solicitud no queda repetida.
    const id = window.__canalMsgId ? 'sp' + String(window.__canalMsgId).replace(/[^\w-]/g, '').slice(0, 40) : 'sp' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    if(lista().some(x => x && x.id === id)) return null;
    // 1.95.4 (auditoría S4): como mucho 50 solicitudes nuevas sin atender (el link del agente es público).
    if(lista().filter(x => x && x.estado === 'nueva').length >= 50) return null;
    const s = { id, at: Date.now(), estado: 'nueva', nombre: recorte(p[0], 40), tel: String(p[1] || '').replace(/[^\d+ ]/g, '').slice(0, 15), plan: recorte(p[2], 40),
      personas: Math.min(99, Math.max(1, parseInt(p[3], 10) || 1)), fecha: recorte(p[4], 40), nota: recorte(p.slice(5).join(' ').replace(/·\s*🤖\s*agente\s*$/, ''), 160) };
    if(!s.plan) return null;
    lista().unshift(s); if(lista().length > 200) d.solicitudesPlan = lista().slice(0, 200);
    guardar();
    if(!window.ventoAvisoOn || window.ventoAvisoOn('pedidos')){
      const txt = s.nombre + ' quiere «' + s.plan + '» para ' + s.personas + (s.personas === 1 ? ' persona' : ' personas') + (s.fecha ? ' · ' + s.fecha : '');
      toast('✈️ Solicitud nueva del agente: ' + txt, 10000);
      try{ ventoAvisoCel('✈️ Solicitud de plan', txt, 'pedidos'); }catch(e){}
      try{ if(window.vitoDecir) window.vitoDecir('Nueva solicitud de plan de ' + s.nombre); }catch(e){}
      if(navigator.vibrate) navigator.vibrate([200, 100, 200]);
    }
    try{ pintarBarra(); }catch(e){}
    return s;
  }
  function productoDe(nombre){ const d = D(); return (d.products || []).find(x => !x.oculto && nrm(x.name) === nrm(nombre)) || (d.products || []).find(x => nrm(x.name) === nrm(nombre)) || null; }
  function cantidadDe(p, personas){ const por = parseInt(String((p && p.det && p.det.personas) || '').replace(/\D/g, ''), 10); return por > 1 ? Math.ceil(personas / por) : personas; }
  // La cuenta del cliente con el plan: los cupos quedan apartados (cuentan como «en cuentas abiertas»).
  function crearCuenta(id){
    const d = D(), s = lista().find(x => x && x.id === id); if(!d || !s || s.estado !== 'nueva') return null;
    const p = productoDe(s.plan); if(!p){ toast('No encuentro el plan «' + s.plan + '» en tus productos.'); return null; }
    const q = cantidadDe(p, s.personas), c = cupos(p);
    if(c && c.quedan < q){ toast('🚫 «' + p.name + '» no tiene cupos para ' + s.personas + (c.quedan > 0 ? ': quedan ' + c.quedan + '.' : ': ya no quedan.'), 8000); return null; }
    let n = 1; while(d.tables[n] && ((d.tables[n].items || []).length || (d.tables[n].name || '').trim())) n++;
    if(n > 500 || (typeof asegurarMesa === 'function' && !asegurarMesa(n))) { toast('No hay espacio para otra cuenta.'); return null; }
    if(!d.tables[n]) d.tables[n] = { items: [], people: [] };
    if((d.tableCount || 0) < n) d.tableCount = n;
    const t = d.tables[n];
    t.name = (s.nombre || 'Cliente') + (s.tel ? ' · ' + s.tel : '');
    const it = { productId: p.id, name: p.name, price: p.price, size: p.size || '', qty: q, personId: null, history: [] };
    try{ recordItemHistory(it, q); }catch(e){}
    t.items.push(it);
    t.viajeros = [{ nombre: s.nombre }].concat(Array.from({ length: Math.max(0, s.personas - 1) }, () => ({})));
    if(s.nota || s.fecha) t.nota = [s.fecha ? 'Fecha: ' + s.fecha : '', s.nota].filter(Boolean).join(' · ');
    s.estado = 'cuenta'; s.cuenta = n; s.por = (() => { try{ return window.ventoRoles && window.ventoRoles.yo ? (window.ventoRoles.yo() || {}).nombre || '' : ''; }catch(e){ return ''; } })();
    guardar();
    try{ renderMesas(); }catch(e){}
    try{ if(window.vitoPublicarCatalogo) window.vitoPublicarCatalogo(true); }catch(e){}   // los cupos que quedan, al agente
    toast('✅ Cuenta creada: ' + t.name + ' con ' + q + ' × ' + p.name + '. Los cupos quedan apartados.', 7000);
    return n;
  }
  function descartar(id){ const s = lista().find(x => x && x.id === id); if(!s || s.estado !== 'nueva') return false; s.estado = 'descartada'; guardar(); return true; }
  function waUrl(s){
    const d = D() || {}, n0 = String(s.tel || '').replace(/\D/g, ''), n = n0.length === 10 ? '57' + n0 : n0;
    const msg = 'Hola ' + (s.nombre || '') + ', te escribimos de ' + (d.businessName || 'la agencia') + ' por tu solicitud del plan «' + s.plan + '» para ' + s.personas + (s.personas === 1 ? ' persona' : ' personas') + (s.fecha ? ' (' + s.fecha + ')' : '') + '. ¿Seguimos con la reserva?';
    return 'https://wa.me/' + n + '?text=' + encodeURIComponent(msg);
  }
  function panel(){
    let ov = document.getElementById('spOv');
    if(!ov){ ov = document.createElement('div'); ov.className = 'overlay sp-ov'; ov.id = 'spOv'; ov.setAttribute('data-novocab', ''); document.body.appendChild(ov); }
    const fecha = t => { try{ return new Date(t).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }catch(e){ return ''; } };
    const pend = pendientes(), viejas = lista().filter(x => x && x.estado !== 'nueva').slice(0, 10);
    const fila = s => {
      const p = productoDe(s.plan), c = p ? cupos(p) : null;
      return '<div class="sp-s" data-id="' + esc(s.id) + '" style="border:1px solid var(--line);border-radius:12px;padding:10px;margin:8px 0">' +
        '<b>' + esc(s.nombre || 'Sin nombre') + '</b>' + (s.tel ? ' · ' + esc(s.tel) : '') + '<div>✈️ ' + esc(s.plan) + ' · ' + s.personas + (s.personas === 1 ? ' persona' : ' personas') + (p ? ' · ' + plata(p.price * cantidadDe(p, s.personas)) : '') + '</div>' +
        (s.fecha ? '<div>📅 ' + esc(s.fecha) + '</div>' : '') + (s.nota ? '<div>📝 ' + esc(s.nota) + '</div>' : '') +
        '<small style="color:var(--ink2)">' + esc(fecha(s.at)) + (c ? ' · quedan ' + c.quedan + ' cupos' : '') + (p ? '' : ' · ⚠️ ese plan ya no está en tus productos') + '</small>' +
        (s.estado === 'nueva' ? '<div class="modal-actions" style="flex-wrap:wrap">' + (s.tel ? '<a class="btn-ghost sp-wa" target="_blank" rel="noopener" href="' + esc(waUrl(s)) + '">📲 WhatsApp</a>' : '') +
          '<button type="button" class="btn-ghost" data-sp="descartar">Descartar</button><button type="button" class="btn-primary" data-sp="cuenta">✅ Crear la cuenta</button></div>'
          : '<div><small>' + (s.estado === 'cuenta' ? '✅ Cuenta creada' : 'Descartada') + '</small></div>') + '</div>';
    };
    ov.innerHTML = '<div class="modal" style="max-width:520px"><div class="modal-title-row"><h2>✈️ Solicitudes del agente</h2><button class="rename-table-btn" type="button" data-sp="x">✕</button></div>' +
      '<p class="modal-sub">Clientes que pidieron un plan en el link del agente. El agente no confirma ni cobra: escríbeles y, al crear la cuenta, sus cupos quedan apartados.</p>' +
      (pend.length ? pend.map(fila).join('') : '<div class="empty-note">No hay solicitudes nuevas.</div>') +
      (viejas.length ? '<h3 style="margin:14px 0 4px">Anteriores</h3>' + viejas.map(fila).join('') : '') + '</div>';
    ov.onclick = e => {
      const b = e.target.closest('[data-sp]'); if(!b){ if(e.target === ov) ov.classList.remove('show'); return; }
      if(b.dataset.sp === 'x'){ ov.classList.remove('show'); return; }
      const id = b.closest('[data-id]') && b.closest('[data-id]').dataset.id;
      if(b.dataset.sp === 'descartar'){ if(confirm('¿Descartar esta solicitud?')){ descartar(id); panel(); pintarBarra(); } return; }
      if(b.dataset.sp === 'cuenta'){ const n = crearCuenta(id); if(n){ ov.classList.remove('show'); pintarBarra(); try{ openTableModal(n); }catch(x){} } return; }
    };
    ov.classList.add('show');
  }
  // Aviso arriba de las cuentas cuando hay solicitudes nuevas.
  function pintarBarra(){
    const v = document.getElementById('view-mesas'), grid = document.getElementById('tableGrid'); if(!v || !grid) return;
    let b = document.getElementById('spBarra'); const n = activo() ? pendientes().length : 0;
    if(!n){ if(b) b.remove(); return; }
    if(!b){ b = document.createElement('button'); b.type = 'button'; b.id = 'spBarra'; b.className = 'rs-barra sp-barra'; b.setAttribute('data-novocab', ''); b.onclick = () => panel(); grid.parentNode.insertBefore(b, grid); }
    const txt = '✈️ ' + n + (n === 1 ? ' solicitud nueva' : ' solicitudes nuevas') + ' del agente · Ver';
    if(b.textContent !== txt) b.textContent = txt;
  }
  window.addEventListener('vento-datos-remotos', () => { try{ pintarBarra(); if(document.getElementById('spOv') && document.getElementById('spOv').classList.contains('show')) panel(); }catch(e){} });
  setTimeout(() => { envolverAgregar(); envolverCerrar(); }, 0);
  setInterval(() => { try{ envolverAgregar(); envolverCerrar(); pintar(); pintarBarra(); }catch(e){} }, 500);
  window.ventoAgencia = { activo, cupos, abrir, datosVoucher, voucherTexto, voucherHtml, paraCarta, recibir, pendientes, crearCuenta, descartar, panel, waUrl };
})();
