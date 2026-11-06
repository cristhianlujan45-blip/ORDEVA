/* =====================================================================
   ORDEVA · ✂️ Comisiones del personal (1.84.0)
   Para barberías, salones, uñas, lavaderos… (lo que el catálogo de negocios ya prometía).
     • El dueño pone en Ajustes → Negocio las personas que cobran comisión, con su % de los SERVICIOS (lo que no
       lleva inventario) y, si quiere, un % de los PRODUCTOS que venden (ceras, champús…).
     • Al cobrar (caja, cuenta de la silla / mesa, cuenta de una persona) se elige «¿Quién atendió?» con un toque.
       Con una sola persona no se pregunta. En el carrito, cada renglón muestra «✂️ Juan» y se puede cambiar.
     • La venta guarda en CADA renglón la persona, su % y el valor de la comisión de ese momento (quienId, quien,
       comPct, com): cambiar el % después no cambia lo que ya se ganó.
     • El informe del período por persona (servicios, vendido, comisión) y lo que falta por pagar. «Pagar» queda en una
       lista de pagos (data.comisionPagos) y como gasto «Comisiones» en Contabilidad; si se paga en efectivo de la caja,
       como salida de la caja (cuadra el arqueo).
     • Deshacer la venta quita su comisión (se calcula del historial). Una devolución descuenta la comisión de lo
       devuelto.
   Datos (se sincronizan con los demás equipos, listas por id):
     data.comisionesOn, data.comisionistas = [{ id, nombre, pct, pctProd, baja }], data.comisionPagos = [{ id, quienId,
     quien, valor, metodo, at, by, ct }]
   ===================================================================== */
(function(){
  'use strict';
  if(window.ventoComisiones) return;
  const D = () => { try{ return typeof data !== 'undefined' ? data : window.data; }catch(e){ return window.data; } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const plata = n => { try{ return fmt(Math.round(Number(n) || 0)); }catch(e){ return '$' + Math.round(Number(n) || 0).toLocaleString('es-CO'); } };
  const aviso = (t, ms) => { try{ showToast(t, ms || 4000); }catch(e){} };
  const guardar = () => { try{ saveData(); }catch(e){} };
  const quien = () => { try{ return (typeof authUser !== 'undefined' && authUser) || ''; }catch(e){ return ''; } };
  const auditar = (a, d) => { try{ window.ventoAuditar && window.ventoAuditar(a, d || ''); }catch(e){} };
  const jefe = () => { try{ return !window.ventoRoles || window.ventoRoles.esJefe(); }catch(e){ return true; } };
  const pctN = v => { const n = Number(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) ? Math.max(0, Math.min(100, Math.round(n * 10) / 10)) : 0; };
  const nuevoId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const ULT = 'vento_com_ult';

  // ---------- Personas ----------
  function lista(){ const d = D(); if(!d) return []; if(!Array.isArray(d.comisionistas)) d.comisionistas = []; return d.comisionistas; }
  const activas = () => lista().filter(p => p && !p.baja && p.nombre);
  const on = () => { const d = D(); return !!(d && d.comisionesOn) && activas().length > 0; };
  const persona = id => lista().find(p => p && p.id === id) || null;
  const producto = id => { const d = D(); return id && d && Array.isArray(d.products) ? d.products.find(p => p.id === id) || null : null; };
  const esLibre = id => String(id || '').indexOf('libre:') === 0;
  // El id del producto de un renglón: los de la mesa traen productId; los del carrito de la caja, id («libre:…» no es producto).
  const pidDe = l => !l ? null : l.productId !== undefined ? l.productId : (esLibre(l.id) ? null : (l.varDe || l.id));
  // Servicio = lo que no lleva inventario (sin existencias), o un valor libre. Producto = lo que tiene existencias.
  const esServicio = pid => { const p = producto(pid); return !p || p.stock == null; };
  const pctDe = (per, pid) => esServicio(pid) ? pctN(per.pct) : pctN(per.pctProd);
  const nombreDe = id => { const p = persona(id); return p ? p.nombre : ''; };
  // Los renglones que pueden llevar comisión: los servicios, y los productos si alguien tiene % de productos.
  const conProd = () => activas().some(p => pctN(p.pctProd) > 0);
  const aplica = l => !!l && !/propina/i.test(l.name || '') && (esServicio(pidDe(l)) || conProd());

  // Pone en el renglón del historial (out) la persona y la comisión de ESTE momento, desde el renglón vendido (src).
  function marcar(src, out){
    if(!src || !out || !src.quienId) return out;
    const per = persona(src.quienId); if(!per) return out;
    const pct = pctDe(per, pidDe(src));
    out.quienId = per.id; out.quien = String(per.nombre).slice(0, 40); out.comPct = pct;
    out.com = Math.round((Number(out.price) || 0) * (Number(out.qty) || 0) * pct / 100);
    return out;
  }

  // ---------- «¿Quién atendió?» ----------
  function modal(html, montar){
    const ov = document.createElement('div');
    ov.className = 'overlay show cm-ov com-ov'; ov.setAttribute('data-novocab', '');
    ov.style.zIndex = '9700';
    ov.innerHTML = '<div class="modal cm" role="dialog" aria-modal="true">' + html + '</div>';
    document.body.appendChild(ov);
    const cerrar = () => ov.remove();
    try{ montar && montar(ov, cerrar); }catch(e){ console.error(e); }
    return ov;
  }
  const ultimo = () => { try{ return localStorage.getItem(ULT) || ''; }catch(e){ return ''; } };
  const recordar = id => { try{ localStorage.setItem(ULT, id); }catch(e){} };
  const ordenadas = () => { const u = ultimo(), l = activas().slice(); l.sort((a, b) => (b.id === u) - (a.id === u)); return l; };
  const chips = (attr, sel) => ordenadas().map(p => '<button type="button" class="btn-ghost com-chip' + (p.id === sel ? ' sel' : '') + '" ' + attr + '="' + esc(p.id) + '" style="font-size:17px;padding:12px 14px;margin:4px">✂️ ' + esc(p.nombre) + '</button>').join('');

  // Pregunta quién atendió los renglones que no lo tienen. Pone quienId en esos mismos objetos.
  // true = seguir con el cobro (también «Sin comisión»); false = canceló.
  function preguntar(lineas){
    if(!on() || !Array.isArray(lineas)) return Promise.resolve(true);
    const faltan = lineas.filter(l => l && !l.quienId && aplica(l));
    if(!faltan.length) return Promise.resolve(true);
    const ps = activas();
    if(ps.length === 1){ faltan.forEach(l => { l.quienId = ps[0].id; }); return Promise.resolve(true); }
    return new Promise(res => {
      modal('<h2 style="margin:0 0 4px">✂️ ¿Quién atendió?</h2><div class="modal-sub">Para su comisión. ' + (faltan.length > 1 ? 'Toca un nombre para todos, o elige uno por servicio.' : esc(faltan[0].name)) + '</div>' +
        '<div class="com-todos" style="display:flex;flex-wrap:wrap;justify-content:center;margin:8px 0">' + chips('data-todos') + '</div>' +
        (faltan.length > 1 ? '<details class="com-uno"><summary style="cursor:pointer;padding:6px 0">Uno distinto por servicio</summary>' +
          faltan.map((l, i) => '<div class="settings-row" style="gap:8px"><span style="flex:1;min-width:0">' + esc(l.name) + (Number(l.qty) > 1 ? ' × ' + esc(l.qty) : '') + '</span><select class="mz-in com-sel" data-i="' + i + '" style="max-width:55%"><option value="">— Sin comisión —</option>' +
            ordenadas().map(p => '<option value="' + esc(p.id) + '">' + esc(p.nombre) + '</option>').join('') + '</select></div>').join('') +
          '<button type="button" class="btn-primary com-listo" style="width:100%;margin-top:8px">Listo</button></details>' : '') +
        '<div class="modal-actions"><button type="button" class="btn-ghost" data-no="1">Cancelar</button><button type="button" class="btn-ghost" data-sin="1">Sin comisión</button></div>', (ov, cerrar) => {
        let listo = false; const fin = v => { if(listo) return; listo = true; cerrar(); res(v); };
        ov.addEventListener('click', e => {
          if(e.target === ov) return fin(false);
          const t = e.target.closest('button'); if(!t) return;
          if(t.dataset.todos){ faltan.forEach(l => { l.quienId = t.dataset.todos; }); recordar(t.dataset.todos); return fin(true); }
          if(t.dataset.no) return fin(false);
          if(t.dataset.sin) return fin(true);
          if(t.classList.contains('com-listo')){
            ov.querySelectorAll('.com-sel').forEach(s => { const l = faltan[Number(s.dataset.i)]; if(l && s.value){ l.quienId = s.value; recordar(s.value); } });
            return fin(true);
          }
        });
      });
    });
  }
  // Cambiar quién hizo UN renglón (el «✂️ Juan» del carrito). Promise<true> si cambió.
  function elegir(linea){
    if(!linea || !activas().length) return Promise.resolve(false);
    return new Promise(res => {
      modal('<h2 style="margin:0 0 4px">✂️ ¿Quién hizo este servicio?</h2><div class="modal-sub">' + esc(linea.name || '') + '</div>' +
        '<div style="display:flex;flex-wrap:wrap;justify-content:center;margin:8px 0">' + chips('data-p', linea.quienId) + '</div>' +
        '<div class="modal-actions"><button type="button" class="btn-ghost" data-no="1">Cancelar</button>' + (linea.quienId ? '<button type="button" class="btn-ghost" data-sin="1">Sin comisión</button>' : '') + '</div>', (ov, cerrar) => {
        let listo = false; const fin = v => { if(listo) return; listo = true; cerrar(); res(v); };
        ov.addEventListener('click', e => {
          if(e.target === ov) return fin(false);
          const t = e.target.closest('button'); if(!t) return;
          if(t.dataset.p){ linea.quienId = t.dataset.p; recordar(t.dataset.p); return fin(true); }
          if(t.dataset.sin){ delete linea.quienId; return fin(true); }
          if(t.dataset.no) return fin(false);
        });
      });
    });
  }
  // El botón del renglón en el carrito (vacío si no aplica).
  function chipLinea(l, k){
    if(!on() || !l || !aplica(l)) return '';
    const n = l.quienId ? nombreDe(l.quienId) : '';
    return '<button type="button" class="pz-quien' + (n ? '' : ' falta') + '" data-quien="' + esc(k) + '" aria-label="Quién hizo ' + esc(l.name || '') + '" style="display:inline-block;margin-top:2px;font-size:13px;padding:2px 8px;border-radius:999px;border:1px solid var(--line,#ccc);background:transparent;color:inherit">✂️ ' + (n ? esc(n) : '¿Quién?') + '</button>';
  }

  // ---------- Informe y pagos ----------
  function pagos(){ const d = D(); if(!d) return []; if(!Array.isArray(d.comisionPagos)) d.comisionPagos = []; return d.comisionPagos; }
  const t0 = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
  function rango(k){
    const h = new Date(), hoy = t0(h), fin = hoy + 86400000;
    if(k === 'hoy') return { desde: hoy, hasta: fin, titulo: 'Hoy' };
    if(k === 'semana'){ const dw = (h.getDay() + 6) % 7; return { desde: hoy - dw * 86400000, hasta: fin, titulo: 'Esta semana' }; }
    if(k === 'quincena'){ const d1 = h.getDate() <= 15 ? 1 : 16; return { desde: new Date(h.getFullYear(), h.getMonth(), d1).getTime(), hasta: fin, titulo: 'Esta quincena' }; }
    if(k === 'pasado') return { desde: new Date(h.getFullYear(), h.getMonth() - 1, 1).getTime(), hasta: new Date(h.getFullYear(), h.getMonth(), 1).getTime(), titulo: 'Mes pasado' };
    return { desde: new Date(h.getFullYear(), h.getMonth(), 1).getTime(), hasta: fin, titulo: 'Este mes' };
  }
  // Lo devuelto de un renglón (las devoluciones guardan nombre, cantidad y precio).
  function devueltoDe(h, it){
    let q = 0; (h.devoluciones || []).forEach(dv => (dv.items || []).forEach(x => { if(x.name === it.name && Number(x.price) === Number(it.price)) q += Number(x.qty) || 0; }));
    return Math.min(Number(it.qty) || 0, q);
  }
  // Renglones con persona: [{ h, it, quienId, quien, q, vendido, com, t }] (lo devuelto ya descontado).
  function renglones(desde, hasta){
    const d = D(), out = []; if(!d || !Array.isArray(d.history)) return out;
    d.history.forEach(h => {
      const t = Date.parse(h && h.date); if(!h || !isFinite(t) || (desde != null && t < desde) || (hasta != null && t >= hasta)) return;
      (h.items || []).forEach(it => {
        if(!it || !it.quienId) return;
        const q = Number(it.qty) || 0, dev = devueltoDe(h, it), f = q > 0 ? (q - dev) / q : 0;
        if(f <= 0) return;
        out.push({ h, it, quienId: it.quienId, quien: it.quien || nombreDe(it.quienId), q: q - dev, vendido: Math.round((Number(it.price) || 0) * (q - dev)), com: Math.round((Number(it.com) || 0) * f), t });
      });
    });
    return out;
  }
  function resumen(k){
    const r = typeof k === 'object' && k ? k : rango(k), por = {};
    const fila = (id, n) => por[id] || (por[id] = { id, nombre: nombreDe(id) || n || '—', servicios: 0, vendido: 0, com: 0, ganado: 0, pagado: 0, lineas: [] });
    renglones(r.desde, r.hasta).forEach(x => { const f = fila(x.quienId, x.quien); f.servicios += x.q; f.vendido += x.vendido; f.com += x.com; f.lineas.push(x); });
    // Lo que falta por pagar es de SIEMPRE (todo lo ganado − todo lo pagado), no solo del período.
    renglones(null, null).forEach(x => { fila(x.quienId, x.quien).ganado += x.com; });
    pagos().forEach(p => { if(p && p.quienId && !p.anulado) fila(p.quienId, p.quien).pagado += Number(p.valor) || 0; });
    activas().forEach(p => fila(p.id, p.nombre));
    const filas = Object.values(por).map(f => Object.assign(f, { debe: Math.max(0, Math.round(f.ganado - f.pagado)) })).filter(f => persona(f.id) && !persona(f.id).baja || f.com || f.debe);
    filas.sort((a, b) => b.com - a.com || a.nombre.localeCompare(b.nombre));
    return { rango: r, filas, total: filas.reduce((s, f) => s + f.com, 0), vendido: filas.reduce((s, f) => s + f.vendido, 0) };
  }
  // Registra un pago de comisión. metodo 'caja' = efectivo de la caja (salida del turno, cuadra el arqueo).
  function pagar(id, valor, metodo){
    const per = persona(id), v = Math.round(Number(valor) || 0); if(!per || !(v > 0)) return null;
    const d = D(); if(!d) return null;
    const p = { id: nuevoId('cp'), quienId: per.id, quien: per.nombre, valor: v, metodo: metodo || 'efectivo', at: Date.now(), by: quien() };
    const nota = 'Comisión de ' + per.nombre;
    if(metodo === 'caja' && window.ventoTurno && window.ventoTurno.movimiento){
      const mv = window.ventoTurno.movimiento('salida', v, nota);
      const ct = mv && mv.ct && (d.contab || []).find(g => g.id === mv.ct);
      if(ct){ ct.cat = 'comisiones'; ct.origen = 'comision'; ct.nota = nota; }
      p.ct = mv && mv.ct || ''; p.mov = mv && mv.id || '';
    } else {
      d.contab = Array.isArray(d.contab) ? d.contab : [];
      const hoy = new Date(), ctId = nuevoId('ct');
      d.contab.unshift({ id: ctId, tipo: 'gasto', cat: 'comisiones', monto: v, metodo: metodo === 'caja' ? 'efectivo' : (metodo || 'efectivo'), origen: 'comision', ref: p.id, nota, by: quien(), at: Date.now(),
        fecha: hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-' + String(hoy.getDate()).padStart(2, '0') });
      p.ct = ctId;
    }
    pagos().unshift(p); guardar(); auditar('comisión pagada', per.nombre + ' · ' + plata(v));
    return p;
  }

  function informe(k0){
    if(!jefe()){ aviso('🔒 Las comisiones las ve el dueño o el administrador.'); return; }
    let k = k0 || 'quincena', abierto = '';
    const PER = [['hoy', 'Hoy'], ['semana', 'Semana'], ['quincena', 'Quincena'], ['mes', 'Mes'], ['pasado', 'Mes pasado']];
    const fch = t => new Date(t).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) + ' ' + new Date(t).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
    modal('<h2 style="margin:0 0 4px">✂️ Comisiones</h2><div class="com-cuerpo"></div><div class="modal-actions"><button type="button" class="btn-ghost" data-cerrar="1">Cerrar</button></div>', (ov, cerrar) => {
      const cuerpo = ov.querySelector('.com-cuerpo');
      const pintar = () => {
        const r = resumen(k);
        cuerpo.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:4px;margin:4px 0 8px">' + PER.map(p => '<button type="button" class="btn-ghost' + (p[0] === k ? ' btn-primary' : '') + '" data-per="' + p[0] + '" style="padding:6px 10px">' + p[1] + '</button>').join('') + '</div>' +
          '<div class="modal-sub com-tot">' + esc(r.rango.titulo) + ': vendido con persona ' + plata(r.vendido) + ' · comisiones <b>' + plata(r.total) + '</b></div>' +
          (r.filas.length ? r.filas.map(f => '<div class="com-fila" data-fila="' + esc(f.id) + '" style="border:1px solid var(--line,#ddd);border-radius:12px;padding:10px;margin:6px 0">' +
            '<div style="display:flex;gap:8px;align-items:center"><b style="flex:1">✂️ ' + esc(f.nombre) + '</b><span class="com-ganado" style="font-size:18px"><b>' + plata(f.com) + '</b></span></div>' +
            '<div style="font-size:14px;opacity:.85">' + esc(f.servicios) + (f.servicios === 1 ? ' servicio' : ' servicios') + ' · vendido ' + plata(f.vendido) + ' · <span class="com-debe">' + (f.debe ? 'por pagar <b>' + plata(f.debe) + '</b>' : '✅ al día') + '</span></div>' +
            '<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap"><button type="button" class="btn-ghost" data-ver="' + esc(f.id) + '">' + (abierto === f.id ? '▲ Ocultar' : '📋 Ver detalle') + '</button>' + (f.debe ? '<button type="button" class="btn-primary" data-pagar="' + esc(f.id) + '">💵 Pagar</button>' : '') + '</div>' +
            (abierto === f.id ? '<div style="font-size:13px;margin-top:6px">' + (f.lineas.length ? f.lineas.slice(0, 200).map(x => '<div style="display:flex;gap:6px;border-top:1px dashed var(--line,#ddd);padding:3px 0"><span style="flex:1">' + esc(fch(x.t)) + ' · ' + esc(x.it.name) + (x.q !== 1 ? ' × ' + esc(x.q) : '') + ' (' + esc(x.it.comPct) + ' %)</span><span>' + plata(x.vendido) + ' → <b>' + plata(x.com) + '</b></span></div>').join('') : '<div style="opacity:.7">Sin servicios en este período.</div>') +
              (pagos().filter(p => p.quienId === f.id).length ? '<div style="margin-top:6px"><b>Pagos</b>' + pagos().filter(p => p.quienId === f.id).slice(0, 20).map(p => '<div style="display:flex;gap:6px;padding:2px 0"><span style="flex:1">' + esc(fch(p.at)) + ' · ' + esc(p.metodo === 'caja' ? 'efectivo de la caja' : p.metodo) + (p.by ? ' · ' + esc(p.by) : '') + '</span><b>' + plata(p.valor) + '</b></div>').join('') + '</div>' : '') + '</div>' : '') +
            '</div>').join('') : '<div class="modal-sub">Aún no hay personas. Agrégalas en Ajustes → Negocio → «✂️ Comisiones del personal».</div>');
      };
      cuerpo.addEventListener('click', e => {
        const t = e.target.closest('button'); if(!t) return;
        if(t.dataset.per){ k = t.dataset.per; pintar(); return; }
        if(t.dataset.ver){ abierto = abierto === t.dataset.ver ? '' : t.dataset.ver; pintar(); return; }
        if(t.dataset.pagar){ pedirPago(t.dataset.pagar, pintar); return; }
      });
      ov.addEventListener('click', e => { if(e.target === ov || e.target.closest('[data-cerrar]')) cerrar(); });
      pintar();
    });
  }
  function pedirPago(id, despues){
    const f = resumen('mes').filas.find(x => x.id === id), per = persona(id); if(!f || !per) return;
    modal('<h2 style="margin:0 0 4px">💵 Pagar comisión</h2><div class="modal-sub">' + esc(per.nombre) + ' · por pagar ' + plata(f.debe) + '</div>' +
      '<input class="mz-in com-valor" inputmode="numeric" value="' + f.debe + '" style="width:100%;font-size:22px;text-align:center">' +
      '<select class="mz-in com-metodo" style="width:100%;margin-top:8px"><option value="caja">💵 Efectivo de la caja (sale de la caja)</option><option value="efectivo">💵 Efectivo (no de la caja)</option><option value="transferencia">🏦 Transferencia</option><option value="nequi">📲 Nequi / DaviPlata</option></select>' +
      '<div class="modal-actions"><button type="button" class="btn-ghost" data-no="1">Cancelar</button><button type="button" class="btn-primary" data-si="1">Pagar</button></div>', (ov, cerrar) => {
      ov.addEventListener('click', e => {
        if(e.target === ov || e.target.closest('[data-no]')) return cerrar();
        if(!e.target.closest('[data-si]')) return;
        const v = Math.round(Number(String(ov.querySelector('.com-valor').value).replace(/[^\d]/g, '')) || 0);
        if(!(v > 0)) return aviso('Escribe cuánto le pagas.');
        const conf = () => { pagar(id, v, ov.querySelector('.com-metodo').value); cerrar(); aviso('✅ Pago de ' + plata(v) + ' a ' + per.nombre + ' guardado (también en Contabilidad).'); despues && despues(); };
        if(v > f.debe && typeof showConfirm === 'function') showConfirm({ title: '¿Pagar más de lo ganado?', message: 'Le pagas ' + plata(v) + ' y por pagar tiene ' + plata(f.debe) + '. La diferencia queda como adelanto.', confirmText: 'Sí, pagar', icon: '💵' }).then(ok => ok && conf());
        else conf();
      });
    });
  }

  // ---------- Ajustes → Negocio (solo dueño o administrador) ----------
  function pintarAjustes(){
    const g = document.querySelector('#view-ajustes .settings-group[data-cat="negocio"]'); if(!g) return;
    let box = document.getElementById('comisionesBox');
    if(!jefe()){ if(box) box.remove(); return; }
    if(!box){ box = document.createElement('div'); box.id = 'comisionesBox'; box.className = 'settings-row'; box.style.cssText = 'flex-direction:column;align-items:stretch;gap:8px'; g.appendChild(box); }
    const d = D() || {}, ps = activas();
    box.innerHTML = '<div style="display:flex;gap:10px;align-items:center"><div class="settings-row-text" style="flex:1"><strong>✂️ Comisiones del personal</strong><span>Barberos, estilistas, manicuristas, lavadores… Al cobrar se elige quién atendió y la venta guarda su comisión. Servicio = lo que no lleva inventario.</span></div>' +
        '<label class="switch"><input type="checkbox" id="comOn"' + (d.comisionesOn ? ' checked' : '') + '><span class="switch-slider"></span></label></div>' +
      (ps.length ? '<div class="com-personas">' + ps.map(p => '<div class="com-p" data-id="' + esc(p.id) + '" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">' +
          '<b style="flex:1;min-width:90px">' + esc(p.nombre) + '</b>' +
          '<label style="font-size:13px">Servicios <input class="mz-in com-pct" data-k="pct" inputmode="decimal" value="' + esc(pctN(p.pct)) + '" style="width:56px;text-align:center"> %</label>' +
          '<label style="font-size:13px">Productos <input class="mz-in com-pct" data-k="pctProd" inputmode="decimal" value="' + esc(pctN(p.pctProd)) + '" style="width:56px;text-align:center"> %</label>' +
          '<button type="button" class="btn-ghost" data-baja="' + esc(p.id) + '" aria-label="Quitar a ' + esc(p.nombre) + '">✕</button></div>').join('') + '</div>' : '') +
      '<div style="display:flex;gap:6px;flex-wrap:wrap"><input class="mz-in" id="comNombre" maxlength="40" placeholder="Nombre (ej. Juan)" style="flex:2;min-width:120px"><input class="mz-in" id="comPct" inputmode="decimal" placeholder="% servicios" style="flex:1;min-width:80px"><button type="button" class="btn-ghost" id="comAdd">➕ Agregar</button></div>' +
      '<button type="button" class="btn-ghost" id="comVer">📊 Ver comisiones y pagar</button>' +
      '<small style="opacity:.85">' + (on() ? '✅ Activas: al cobrar se pregunta quién atendió' + (ps.length === 1 ? ' (con una sola persona, se pone sola)' : '') + '.' : d.comisionesOn ? 'Agrega al menos una persona.' : 'Apagadas: no se pregunta quién atendió.') + '</small>';
    box.querySelector('#comOn').onchange = ev => { d.comisionesOn = !!ev.target.checked; guardar(); auditar(d.comisionesOn ? 'comisiones prendidas' : 'comisiones apagadas'); pintarAjustes(); };
    box.querySelector('#comAdd').onclick = () => {
      const n = box.querySelector('#comNombre').value.trim().slice(0, 40); if(!n) return aviso('Escribe el nombre.');
      if(activas().some(p => p.nombre.toLowerCase() === n.toLowerCase())) return aviso('Ya está ' + n + '.');
      lista().push({ id: nuevoId('cm'), nombre: n, pct: pctN(box.querySelector('#comPct').value || 40), pctProd: 0, at: Date.now() });
      d.comisionesOn = true; guardar(); auditar('comisión: persona agregada', n); pintarAjustes();
    };
    box.querySelector('#comVer').onclick = () => informe();
    box.querySelectorAll('.com-pct').forEach(inp => { inp.onchange = () => {
      const p = persona(inp.closest('.com-p').dataset.id); if(!p) return;
      const v = pctN(inp.value); if(p[inp.dataset.k] === v) return;
      p[inp.dataset.k] = v; p.at = Date.now(); guardar(); auditar('comisión cambiada', p.nombre + ' · ' + (inp.dataset.k === 'pct' ? 'servicios ' : 'productos ') + v + ' %');
      aviso('✅ ' + p.nombre + ': ' + v + ' % de ' + (inp.dataset.k === 'pct' ? 'servicios' : 'productos') + ' desde ahora (lo ya vendido no cambia).');
    }; });
    box.querySelectorAll('[data-baja]').forEach(b => { b.onclick = async () => {
      const p = persona(b.dataset.baja); if(!p) return;
      const ok = typeof showConfirm === 'function' ? await showConfirm({ title: '¿Quitar a ' + p.nombre + '?', message: 'Ya no saldrá al cobrar. Sus comisiones y pagos anteriores se quedan en el informe.', confirmText: 'Sí, quitar', icon: '✂️' }) : true;
      if(!ok) return;
      p.baja = true; p.at = Date.now(); guardar(); auditar('comisión: persona quitada', p.nombre); pintarAjustes();
    }; });
  }
  document.addEventListener('click', ev => { if(ev.target.closest && ev.target.closest('.ajustes-cat[data-cat="negocio"], nav button[data-view="ajustes"], .more-tile[data-go]')) setTimeout(pintarAjustes, 90); }, true);
  window.addEventListener('vento-datos-remotos', () => { if(document.getElementById('comisionesBox')) setTimeout(pintarAjustes, 50); });
  setTimeout(pintarAjustes, 1600);

  window.ventoComisiones = { on, activas, lista, persona, esServicio, aplica, marcar, preguntar, elegir, chipLinea, rango, renglones, resumen, pagos, pagar, informe, pintarAjustes };
})();
