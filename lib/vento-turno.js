/* =====================================================================
   ORDEVA · Caja con base, entradas / salidas y arqueo (como Siigo POS y los demás)
   • «Abrir caja»: con cuánto efectivo empieza (la base, el sencillo).
   • «➕ Entrada» / «➖ Salida» de efectivo que no es venta: meter sencillo, pagarle al proveedor, sacar para un
     domicilio… Cada una con motivo y quién la hizo (queda en la actividad del equipo).
   • Al «🔒 Cerrar caja del día»: el ARQUEO. Se cuentan los billetes y monedas y ORDEVA dice si sobra o falta:
       efectivo esperado = base + ventas en efectivo + entradas − salidas (las devoluciones en efectivo son salidas).
     El resultado queda en el cierre (pantalla, WhatsApp e imagen).
   Se guarda en los datos del negocio (data.turno): todos los equipos ven la misma caja.
   ===================================================================== */
(function(){
  'use strict';
  if(window.ventoTurno) return;
  const BILLETES = [100000, 50000, 20000, 10000, 5000, 2000, 1000], MONEDAS = [1000, 500, 200, 100, 50];
  const D = () => { try{ return typeof data !== 'undefined' ? data : window.data; }catch(e){ return window.data; } };
  const plata = n => { try{ return typeof fmt === 'function' ? fmt(n) : '$' + Math.round(+n || 0).toLocaleString('es-CO'); }catch(e){ return '$' + Math.round(+n || 0); } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const toast = (t, ms) => { try{ window.showToast && window.showToast(t, ms || 5000); }catch(e){} };
  const guardar = () => { try{ (window.saveData || saveData)(); }catch(e){} };
  const quien = () => { try{ return (typeof authUser !== 'undefined' && authUser) || ''; }catch(e){ return ''; } };
  const auditar = (a, d) => { try{ window.ventoAuditar && window.ventoAuditar(a, d); }catch(e){} };
  const num = v => Math.max(0, Math.round(Number(String(v == null ? '' : v).replace(/[^\d]/g, '')) || 0));

  function turno(){ const d = D(); return d && d.turno && d.turno.abierto_en ? d.turno : null; }
  function abrir(base){
    const d = D(); if(!d) return null;
    d.turno = { abierto_en: new Date().toISOString(), base: num(base), por: quien(), movs: [] };
    guardar(); auditar('caja abierta', 'Base ' + plata(d.turno.base));
    return d.turno;
  }
  function movimiento(tipo, monto, motivo){
    const t = turno() || abrir(0);
    const m = num(monto); if(!m) return null;
    const mv = { id: Date.now().toString(36), t: new Date().toISOString(), tipo: tipo === 'entrada' ? 'entrada' : 'salida', monto: m, motivo: String(motivo || '').slice(0, 120), por: quien() };
    t.movs.push(mv); guardar();
    auditar(mv.tipo === 'entrada' ? 'entrada de caja' : 'salida de caja', plata(m) + (mv.motivo ? ' · ' + mv.motivo : ''));
    return mv;
  }
  // Ventas en efectivo desde que se abrió la caja (o desde el último cierre).
  function efectivoVentas(desde){
    const d = D(); if(!d) return 0;
    const t0 = desde ? new Date(desde).getTime() : 0;
    return (d.history || []).filter(h => new Date(h.date).getTime() > t0).reduce((s, h) => s + (h.payments || []).filter(p => p.method === 'efectivo').reduce((x, p) => x + (+p.amount || 0), 0), 0);
  }
  function resumen(efectivo){
    const t = turno();
    const base = t ? t.base : 0, movs = t ? t.movs : [];
    const entradas = movs.filter(m => m.tipo === 'entrada').reduce((s, m) => s + m.monto, 0);
    const salidas = movs.filter(m => m.tipo === 'salida').reduce((s, m) => s + m.monto, 0);
    const ventas = efectivo != null ? efectivo : efectivoVentas(t && t.abierto_en);
    return { abierta: !!t, abierto_en: t && t.abierto_en, por: t && t.por, base, entradas, salidas, ventas, esperado: base + ventas + entradas - salidas, movs };
  }

  // ---------- Ventanas ----------
  function css(){
    if(document.getElementById('vtCss')) return;
    const s = document.createElement('style'); s.id = 'vtCss';
    s.textContent = '.vt-ov{z-index:9500}.vt{max-width:460px}.vt h2{margin:0 0 6px}.vt-l{display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px solid var(--line,#3333);font-size:14px}' +
      '.vt-l b{white-space:nowrap}.vt-tot{font-size:18px;font-weight:800}.vt-den{display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;margin:8px 0}.vt-den label{display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:13.5px}' +
      '.vt-den input{width:70px;text-align:center}.vt-dif{border-radius:12px;padding:10px;margin:10px 0;text-align:center;font-weight:800;font-size:17px}.vt-dif.ok{background:rgba(34,197,94,.14)}.vt-dif.falta{background:rgba(239,68,68,.15)}.vt-dif.sobra{background:rgba(245,165,36,.16)}' +
      '.vt-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.vt-row>*{flex:1}.vt-movs{max-height:220px;overflow:auto;margin-top:6px}';
    document.head.appendChild(s);
  }
  function ventana(html, montar){
    css();
    const ov = document.createElement('div'); ov.className = 'overlay show vt-ov'; ov.setAttribute('data-novocab', '');
    ov.innerHTML = '<div class="modal vt" role="dialog" aria-modal="true">' + html + '</div>';
    document.body.appendChild(ov);
    const cerrar = () => ov.remove();
    ov.addEventListener('click', e => { if(e.target === ov) cerrar(); });
    montar(ov, cerrar);
    return ov;
  }
  function lineas(r){
    return '<div class="vt-l"><span>Base (al abrir)</span><b>' + plata(r.base) + '</b></div>' +
      '<div class="vt-l"><span>Ventas en efectivo</span><b>' + plata(r.ventas) + '</b></div>' +
      (r.entradas ? '<div class="vt-l"><span>➕ Entradas</span><b>' + plata(r.entradas) + '</b></div>' : '') +
      (r.salidas ? '<div class="vt-l"><span>➖ Salidas</span><b>−' + plata(r.salidas) + '</b></div>' : '') +
      '<div class="vt-l vt-tot"><span>Efectivo que debe haber</span><b>' + plata(r.esperado) + '</b></div>' +
      // 💵 1.69.0: lo que entregaron los clientes y las vueltas (informativo: «ventas en efectivo» ya es lo cobrado).
      (r.vueltas > 0 ? '<div class="vt-l" style="opacity:.8"><span>Los clientes entregaron ' + plata(r.recibido) + ' y se dieron ' + plata(r.vueltas) + ' de vueltas</span><b></b></div>' : '');
  }
  // Panel de la caja: abrir con base, entradas / salidas y lo que debe haber.
  function panel(){
    const r = resumen();
    if(!r.abierta){
      return ventana('<h2>💵 Abrir caja</h2><div class="settings-desc">¿Con cuánto efectivo empiezas? (la base o el sencillo)</div>' +
        '<input id="vtBase" class="mz-in" inputmode="numeric" placeholder="Ej: 100000" style="width:100%;margin-top:8px">' +
        '<div class="modal-actions"><button type="button" class="btn-ghost" data-x>Cancelar</button><button type="button" class="btn-primary" id="vtAbrir">Abrir caja</button></div>', (ov, cerrar) => {
        ov.querySelector('[data-x]').onclick = cerrar;
        ov.querySelector('#vtAbrir').onclick = () => { abrir(ov.querySelector('#vtBase').value); cerrar(); toast('💵 Caja abierta con ' + plata(turno().base) + ' de base.'); panel(); };
        setTimeout(() => ov.querySelector('#vtBase').focus(), 50);
      });
    }
    const movs = r.movs.slice().reverse().map(m => '<div class="vt-l"><span>' + (m.tipo === 'entrada' ? '➕ ' : '➖ ') + esc(m.motivo || (m.tipo === 'entrada' ? 'Entrada' : 'Salida')) +
      '<br><small style="opacity:.7">' + esc(new Date(m.t).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) + (m.por ? ' · ' + m.por : '')) + '</small></span><b>' + (m.tipo === 'salida' ? '−' : '') + plata(m.monto) + '</b></div>').join('');
    return ventana('<h2>💵 Caja</h2><div class="settings-desc">Abierta ' + esc(new Date(r.abierto_en).toLocaleString('es-CO', { weekday: 'short', hour: 'numeric', minute: '2-digit' })) + (r.por ? ' por ' + esc(r.por) : '') + '</div>' +
      lineas(r) +
      '<div class="vt-row"><button type="button" class="btn-ghost" data-m="entrada">➕ Entrada de efectivo</button><button type="button" class="btn-ghost" data-m="salida">➖ Salida de efectivo</button></div>' +
      (movs ? '<div class="hist-detail-title" style="margin-top:10px">Movimientos</div><div class="vt-movs">' + movs + '</div>' : '') +
      '<div class="modal-actions"><button type="button" class="btn-primary" data-x>Listo</button></div>', (ov, cerrar) => {
      ov.querySelector('[data-x]').onclick = cerrar;
      ov.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { cerrar(); pedirMovimiento(b.dataset.m); });
    });
  }
  function pedirMovimiento(tipo){
    const ej = tipo === 'entrada' ? ['Sencillo', 'Préstamo', 'Otro'] : ['Pago a proveedor', 'Domicilio', 'Gastos', 'Retiro del dueño', 'Otro'];
    ventana('<h2>' + (tipo === 'entrada' ? '➕ Entrada de efectivo' : '➖ Salida de efectivo') + '</h2>' +
      '<input id="vtMonto" class="mz-in" inputmode="numeric" placeholder="¿Cuánto?" style="width:100%;margin-top:6px">' +
      '<input id="vtMotivo" class="mz-in" maxlength="120" placeholder="Motivo (ej: ' + esc(ej[0]) + ')" style="width:100%;margin-top:8px">' +
      '<div class="chips" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">' + ej.map(x => '<button type="button" class="btn-ghost" data-ej="' + esc(x) + '" style="padding:4px 10px">' + esc(x) + '</button>').join('') + '</div>' +
      '<div class="modal-actions"><button type="button" class="btn-ghost" data-x>Cancelar</button><button type="button" class="btn-primary" id="vtOk">Guardar</button></div>', (ov, cerrar) => {
      ov.querySelector('[data-x]').onclick = cerrar;
      ov.querySelectorAll('[data-ej]').forEach(b => b.onclick = () => { ov.querySelector('#vtMotivo').value = b.dataset.ej; });
      ov.querySelector('#vtOk').onclick = () => {
        const m = num(ov.querySelector('#vtMonto').value);
        if(!m){ ov.querySelector('#vtMonto').focus(); return; }
        if(tipo === 'salida' && m > resumen().esperado && !confirm('La salida es más de lo que debería haber en la caja (' + plata(resumen().esperado) + '). ¿Guardarla igual?')) return;
        movimiento(tipo, m, ov.querySelector('#vtMotivo').value.trim());
        cerrar(); toast((tipo === 'entrada' ? '➕ Entrada de ' : '➖ Salida de ') + plata(m) + ' guardada.'); panel();
      };
      setTimeout(() => ov.querySelector('#vtMonto').focus(), 50);
    });
  }
  // Arqueo al cerrar: contar billetes y monedas. Devuelve lo contado (o null si cancela; {contado:null} si no cuenta).
  function arqueo(efectivoVentasCierre, extra){
    const r = Object.assign(resumen(efectivoVentasCierre), { recibido: (extra && extra.recibido) || 0, vueltas: (extra && extra.vueltas) || 0 });
    return new Promise(res => {
      let listo = false;
      const fin = v => { if(listo) return; listo = true; res(v); };
      const ov = ventana('<h2>🧮 Arqueo de caja</h2><div class="settings-desc">Cuenta el efectivo que hay en la caja: ORDEVA te dice si cuadra.</div>' + lineas(r) +
        '<div class="hist-detail-title" style="margin-top:10px">Billetes</div><div class="vt-den">' + BILLETES.map(v => '<label>' + plata(v) + ' ×<input type="number" min="0" inputmode="numeric" data-b="' + v + '" class="mz-in"></label>').join('') + '</div>' +
        '<div class="hist-detail-title">Monedas</div><div class="vt-den">' + MONEDAS.map(v => '<label>' + plata(v) + ' ×<input type="number" min="0" inputmode="numeric" data-mo="' + v + '" class="mz-in"></label>').join('') + '</div>' +
        '<label style="display:block;font-size:13px;margin-top:6px">O escribe el total contado<input id="vtTotal" class="mz-in" inputmode="numeric" style="width:100%"></label>' +
        '<div class="vt-dif" id="vtDif">Contado: $0</div>' +
        '<div class="modal-actions" style="flex-wrap:wrap"><button type="button" class="btn-ghost" data-no>Cancelar</button><button type="button" class="btn-ghost" data-sin>Cerrar sin contar</button><button type="button" class="btn-primary" data-si>🔒 Cerrar caja</button></div>', (o, cerrar) => {
        const contado = () => {
          const t = o.querySelector('#vtTotal').value.trim();
          if(t) return num(t);
          let s = 0; o.querySelectorAll('[data-b],[data-mo]').forEach(i => { s += (+i.dataset.b || +i.dataset.mo) * num(i.value); }); return s;
        };
        const pintar = () => {
          const c = contado(), d = c - r.esperado, el = o.querySelector('#vtDif');
          el.className = 'vt-dif ' + (d === 0 ? 'ok' : d < 0 ? 'falta' : 'sobra');
          el.textContent = 'Contado: ' + plata(c) + ' · ' + (d === 0 ? '✅ Cuadra exacto' : d < 0 ? '⚠️ Faltan ' + plata(-d) : 'Sobran ' + plata(d));
        };
        o.addEventListener('input', pintar); pintar();
        const detalle = () => { const x = {}; o.querySelectorAll('[data-b],[data-mo]').forEach(i => { const n = num(i.value); if(n) x[i.dataset.b || i.dataset.mo] = n; }); return x; };
        o.querySelector('[data-no]').onclick = () => { cerrar(); fin(null); };
        o.querySelector('[data-sin]').onclick = () => { cerrar(); fin(Object.assign({}, r, { contado: null, diferencia: null, movs: r.movs.slice() })); };
        o.querySelector('[data-si]').onclick = () => { const c = contado(); cerrar(); fin(Object.assign({}, r, { contado: c, diferencia: c - r.esperado, detalle: detalle(), movs: r.movs.slice() })); };
      });
      ov.addEventListener('click', e => { if(e.target === ov) fin(null); });
    });
  }
  // Después del cierre: la caja queda cerrada (la siguiente se abre con su base).
  function cerrar(caja){
    const d = D(); if(!d) return;
    d.turno = null; guardar();
    if(caja && caja.contado != null) auditar('arqueo de caja', 'Debía haber ' + plata(caja.esperado) + ', se contó ' + plata(caja.contado) + (caja.diferencia ? (caja.diferencia < 0 ? ' · faltan ' + plata(-caja.diferencia) : ' · sobran ' + plata(caja.diferencia)) : ' · cuadra'));
  }
  // Para el cierre: texto (WhatsApp) y HTML.
  function texto(c){
    if(!c) return '';
    const l = ['', '*💵 Caja (efectivo):*', 'Base: ' + plata(c.base), 'Ventas en efectivo: ' + plata(c.ventas)];
    if(c.entradas) l.push('Entradas: ' + plata(c.entradas));
    if(c.salidas) l.push('Salidas: −' + plata(c.salidas));
    (c.movs || []).forEach(m => l.push('   ' + (m.tipo === 'entrada' ? '+ ' : '− ') + plata(m.monto) + (m.motivo ? ' ' + m.motivo : '')));
    l.push('Debía haber: ' + plata(c.esperado));
    if(c.contado != null) l.push('Contado: ' + plata(c.contado) + ' → ' + (c.diferencia === 0 ? '✅ cuadra' : c.diferencia < 0 ? '⚠️ faltan ' + plata(-c.diferencia) : 'sobran ' + plata(c.diferencia)));
    return l.join('\n');
  }
  function html(c, clase){
    if(!c) return '';
    const L = (a, b, x) => clase === 'r' ? '<div class="r-line' + (x ? ' ' + x : '') + '"><span>' + esc(a) + '</span><span>' + esc(b) + '</span></div>' : '<div class="hist-detail-line"><span>' + esc(a) + '</span><span>' + esc(b) + '</span></div>';
    return (clase === 'r' ? '<div class="r-section">💵 Caja (efectivo)</div>' : '<div class="hist-detail-title">💵 Caja (efectivo)</div>') +
      L('Base', plata(c.base)) + L('Ventas en efectivo', plata(c.ventas)) + (c.entradas ? L('Entradas', plata(c.entradas)) : '') + (c.salidas ? L('Salidas', '−' + plata(c.salidas)) : '') +
      L('Debía haber', plata(c.esperado)) +
      (c.contado != null ? L('Contado', plata(c.contado)) + L(c.diferencia === 0 ? '✅ Cuadra exacto' : c.diferencia < 0 ? '⚠️ Faltan' : 'Sobran', c.diferencia === 0 ? '' : plata(Math.abs(c.diferencia)), c.diferencia < 0 ? 'r-debt' : '') : L('Arqueo', 'sin contar'));
  }
  // Para «📊 Caja de hoy» de la caja (POS).
  function bloqueHoy(){
    const r = resumen();
    if(!r.abierta) return '<div class="pz-hoy-met" style="margin-top:8px"><div><span>💵 Caja sin abrir</span><b><button type="button" class="btn-ghost" data-vt-panel style="padding:4px 10px">Abrir con base</button></b></div></div>';
    return '<div class="pz-hoy-met" style="margin-top:8px"><div><span>💵 Efectivo que debe haber</span><b>' + plata(r.esperado) + '</b></div><div><span>Base ' + plata(r.base) + (r.entradas ? ' · +' + plata(r.entradas) : '') + (r.salidas ? ' · −' + plata(r.salidas) : '') + '</span><b><button type="button" class="btn-ghost" data-vt-panel style="padding:4px 10px">Entradas / salidas</button></b></div></div>';
  }
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-vt-panel]'); if(b){ e.preventDefault(); const o = b.closest('.overlay'); if(o && o.classList.contains('pz-hoy-ov')) o.remove(); panel(); } });

  // Botón en el historial, junto a «Cerrar caja del día».
  function boton(){
    const fila = document.getElementById('closeDayBtn'); if(!fila || document.getElementById('vtCajaBtn')) return;
    const b = document.createElement('button'); b.type = 'button'; b.id = 'vtCajaBtn'; b.className = 'btn-ghost'; b.style.cssText = 'width:100%;margin-top:8px';
    b.textContent = '💵 Caja: base, entradas y salidas'; b.setAttribute('data-vt-panel', '');
    fila.insertAdjacentElement('afterend', b);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boton); else boton();

  const sinContar = ef => { const r = resumen(ef); return Object.assign({}, r, { contado: null, diferencia: null, movs: r.movs.slice() }); };
  window.ventoTurno = { turno, abrir, movimiento, resumen, panel, arqueo, sinContar, cerrar, texto, html, bloqueHoy, BILLETES, MONEDAS };
})();
