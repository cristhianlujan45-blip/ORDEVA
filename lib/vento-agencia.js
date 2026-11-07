/* ORDEVA · lib/vento-agencia.js — 1.82.0: ✈️ Agencias de viajes y turismo.
   • Cupos reales: si un plan tiene «Cupos disponibles» (Productos → el plan → Detalles), al agregarlo a una cuenta se
     revisa cuántos quedan (los vendidos + los que están en cuentas abiertas). No deja pasarse: «ya no hay cupos».
   • «🎫 Voucher y viajeros» en la cuenta del cliente: los viajeros (nombre, documento, nacimiento, contacto de emergencia)
     y el voucher para el cliente (imprimir o guardar en PDF, o por WhatsApp) con el plan (destino, fechas, incluye, no
     incluye), los viajeros, el total, lo pagado, el saldo y el RNT (obligatorio en Colombia, Ajustes → Facturación).
   • Los viajeros quedan guardados con la venta al cobrar. */
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
    // 1.84.1: lleva las marcas de los demás módulos (si no, se envolvían uno al otro sin fin: miles de capas y, a los
    // 20 minutos de tener ORDEVA abierto, «Maximum call stack size exceeded» al cerrar una cuenta).
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
    // 1.84.1: lleva las marcas de los demás módulos (si no, se envolvían uno al otro sin fin: miles de capas y, a los
    // 20 minutos de tener ORDEVA abierto, «Maximum call stack size exceeded» al cerrar una cuenta).
    for(const k in f) if(k.charAt(0) === '_') g[k] = f[k];
    g._ag = true; window.closeTableToHistory = g;
  }
  setTimeout(() => { envolverAgregar(); envolverCerrar(); }, 0);
  setInterval(() => { try{ envolverAgregar(); envolverCerrar(); pintar(); }catch(e){} }, 500);
  window.ventoAgencia = { activo, cupos, abrir, datosVoucher, voucherTexto, voucherHtml };
})();
