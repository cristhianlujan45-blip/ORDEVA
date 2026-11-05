/* ORDEVA · lib/vento-hotel-dia.js — 1.82.0: 🏨 El día del hotel (hotel, hostal y apartamentos).
   • Arriba de las habitaciones: «🏨 Hoy: 6 de 10 ocupadas (60 %) · 🧳 Salen hoy: 2 · $245.000 por cobrar».
   • Al tocarla: quién sale hoy (las reservas que terminan hoy y las habitaciones que el servidor tiene ocupadas hasta hoy),
     con el saldo de cada una y «💰 Cobrar» (abre la cuenta), para cobrar antes de que se vayan.
   • Indicadores del mes (desde el día 1 hasta hoy):
       ocupación % = noches vendidas ÷ (habitaciones × días),
       tarifa promedio (ADR) = lo de las noches ÷ noches vendidas,
       RevPAR = lo de las noches ÷ (habitaciones × días).
     Las noches vendidas salen de las cuentas cobradas (la venta guarda llegada y noches, lib/vento-hotel.js) y de las
     habitaciones ocupadas ahora. Lo de las noches = los renglones de habitación/noche (no el minibar ni el desayuno).
     Las habitaciones «🔧 Fuera de servicio» no cuentan como disponibles hoy. Nada se inventa: sin datos dice «—». */
(function(){
  'use strict';
  if(window.ventoHotelDia) return;
  const TIPOS = ['hotel', 'hostal', 'apartamentos'];
  const D = () => (typeof data !== 'undefined' ? data : null);
  const H = () => window.ventoHotel || null;
  const activo = () => { const d = D(); return !!(d && TIPOS.includes(d.businessType)); };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plata = n => { try{ return fmt(Math.round(n || 0)); }catch(e){ return '$' + Math.round(n || 0).toLocaleString('es-CO'); } };
  const pct = x => isFinite(x) ? Math.round(x * 100) + ' %' : '—';
  const dia = t => { const x = new Date(t); x.setHours(0, 0, 0, 0); return x.getTime(); };
  const etiqueta = id => { try{ return tableLabel(id); }catch(e){ return 'Habitación ' + id; } };
  const saldo = id => { try{ return Math.max(0, tableBalance(id)); }catch(e){ return 0; } };
  const habitaciones = () => { const d = D(); return Object.keys((d && d.tables) || {}); };
  const ocupada = id => { const t = D().tables[id]; return !!(t && (t.items || []).length); };
  const esNoche = it => { const h = H(); return h && h.esNoche ? h.esNoche(it) : /habitaci|noche/i.test(it.name || ''); };
  const valorNoches = items => (items || []).reduce((s, it) => s + (esNoche(it) ? (Number(it.price) || 0) * (Number(it.qty) || 0) : 0), 0);
  function reservas(){ try{ return (window.ventoReservas && window.ventoReservas.estado()) || {}; }catch(e){ return {}; } }
  const bloqueada = id => { const R = reservas(), hoy = dia(Date.now()); return (R.lista || []).some(r => String(r.recurso) === String(id) && window.ventoReservas.esBloqueo && window.ventoReservas.esBloqueo(r) && r.estado !== 'cancelada' && dia(r.desde) <= hoy && new Date(r.hasta).getTime() > Date.now()); };
  // 🧳 Salen hoy: reservas que terminan hoy (no canceladas ni «no llegó») y habitaciones ocupadas en el servidor hasta hoy.
  function salenHoy(){
    const R = reservas(), hoy = dia(Date.now()), m = {};
    (R.lista || []).forEach(r => {
      if(!r || ['cancelada', 'no_llego', 'nollego'].includes(r.estado) || (window.ventoReservas.esBloqueo && window.ventoReservas.esBloqueo(r))) return;
      if(dia(new Date(r.hasta).getTime()) === hoy && dia(new Date(r.desde).getTime()) < hoy) m[String(r.recurso)] = { quien: r.cliente || '' };
    });
    Object.keys(R.ocupadas || {}).forEach(id => { const x = R.ocupadas[id]; if(x && x.hasta && dia(new Date(x.hasta).getTime()) === hoy && !m[id]) m[id] = { quien: '' }; });
    return Object.keys(m).filter(id => habitaciones().includes(id)).map(id => ({ id, nombre: etiqueta(id), quien: m[id].quien, saldo: saldo(id), ocupada: ocupada(id) }));
  }
  function hoy(){
    const L = habitaciones(), fuera = L.filter(bloqueada).length, total = L.length - fuera, n = L.filter(ocupada).length;
    const s = salenHoy();
    return { total, fuera, ocupadas: n, ocupacion: total ? n / total : NaN, salen: s, porCobrar: s.reduce((a, x) => a + x.saldo, 0) };
  }
  // Indicadores desde el día 1 del mes hasta hoy.
  function mes(ahora){
    ahora = ahora || Date.now();
    const d = D(), ini = new Date(ahora); ini.setDate(1); ini.setHours(0, 0, 0, 0);
    const dias = Math.max(1, Math.round((dia(ahora) - ini.getTime()) / 864e5) + 1), hab = habitaciones().length;
    let noches = 0, valor = 0;
    (d.history || []).forEach(e => {
      if(!e || !(Number(e.noches) > 0)) return;
      const salida = new Date(e.date).getTime(); if(!(salida >= ini.getTime() && salida <= ahora + 1000)) return;
      // Solo las noches que caen en este mes (una estadía que empezó el mes pasado cuenta lo de este mes).
      const llegada = e.entrada ? new Date(e.entrada).getTime() : salida - e.noches * 864e5;
      let nMes = Math.round((dia(salida) - Math.max(dia(llegada), ini.getTime())) / 864e5);
      if(dia(llegada) >= ini.getTime()) nMes = Math.max(1, nMes);   // llegó y salió el mismo día: 1 noche (como en lib/vento-hotel.js)
      nMes = Math.max(0, Math.min(Number(e.noches), nMes));
      const v = valorNoches(e.items);
      noches += nMes; valor += Number(e.noches) > 0 ? v * nMes / Number(e.noches) : 0;
    });
    habitaciones().forEach(id => {
      const t = d.tables[id]; if(!ocupada(id) || !H()) return;
      const ent = H().entrada(t); if(!ent) return;
      const n = Math.max(1, Math.round((dia(ahora) - Math.max(dia(ent), ini.getTime())) / 864e5)), tot = H().noches(ent, ahora);
      const v = valorNoches(t.items);
      noches += Math.min(n, tot); valor += tot > 0 ? v * Math.min(n, tot) / tot : 0;
    });
    const disp = hab * dias;
    return { dias, habitaciones: hab, disponibles: disp, noches, valor: Math.round(valor), ocupacion: disp ? noches / disp : NaN, adr: noches ? valor / noches : NaN, revpar: disp ? valor / disp : NaN };
  }
  // ---------- Pantalla ----------
  function estilos(){
    if(document.getElementById('hdCss')) return;
    const s = document.createElement('style'); s.id = 'hdCss';
    s.textContent = '#hdCard{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;margin:8px 0 10px;padding:10px 14px;border:1px solid var(--line);border-radius:14px;background:var(--surface);color:var(--ink);font:600 14px/1.3 var(--font-main,inherit);cursor:pointer;width:100%;text-align:left}' +
      '#hdCard b{font-weight:800}#hdCard .hd-sal{color:var(--warn,#b45309)}' +
      '.hd-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin:8px 0}.hd-kpi{border:1px solid var(--line);border-radius:12px;padding:10px}.hd-kpi small{display:block;opacity:.75}.hd-kpi b{font-size:20px}' +
      '.hd-sale{display:flex;gap:8px;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);padding:8px 0}.hd-sale span{flex:1;min-width:0}';
    document.head.appendChild(s);
  }
  function tarjeta(){
    const v = document.getElementById('view-mesas'); if(!v) return;
    let c = document.getElementById('hdCard');
    if(!activo()){ if(c) c.remove(); return; }
    estilos();
    if(!c){ c = document.createElement('button'); c.type = 'button'; c.id = 'hdCard'; c.setAttribute('data-novocab', ''); c.onclick = abrir; v.insertBefore(c, v.firstChild); }
    const x = hoy();
    const html = '<span>🏨 Hoy: <b>' + x.ocupadas + ' de ' + x.total + '</b> ocupadas (' + pct(x.ocupacion) + ')</span>' +
      (x.salen.length ? '<span class="hd-sal">🧳 Salen hoy: <b>' + x.salen.length + '</b>' + (x.porCobrar > 0 ? ' · <b>' + plata(x.porCobrar) + '</b> por cobrar' : '') + '</span>' : '<span>🧳 Hoy no sale nadie (según las reservas)</span>') +
      '<span style="opacity:.7">Ver indicadores ›</span>';
    if(c.innerHTML !== html) c.innerHTML = html;
  }
  function abrir(){
    let ov = document.getElementById('hdOv');
    if(!ov){ ov = document.createElement('div'); ov.className = 'overlay'; ov.id = 'hdOv'; ov.setAttribute('data-novocab', ''); document.body.appendChild(ov);
      ov.addEventListener('click', e => { if(e.target === ov || e.target.closest('[data-hdx]')) ov.classList.remove('show');
        const b = e.target.closest('[data-hdcobrar]'); if(b){ ov.classList.remove('show'); try{ openTableModal(b.dataset.hdcobrar); }catch(x){} } }); }
    const x = hoy(), m = mes(), k = (t, v, s) => '<div class="hd-kpi"><small>' + t + '</small><b>' + v + '</b>' + (s ? '<small>' + s + '</small>' : '') + '</div>';
    ov.innerHTML = '<div class="modal" style="max-width:520px"><div class="modal-title-row"><h2>🏨 El día del hotel</h2><button class="rename-table-btn" type="button" data-hdx>✕</button></div>' +
      '<div class="hd-kpis">' + k('Ocupadas ahora', x.ocupadas + ' de ' + x.total, pct(x.ocupacion) + (x.fuera ? ' · ' + x.fuera + ' fuera de servicio' : '')) + k('🧳 Salen hoy', String(x.salen.length), x.porCobrar > 0 ? plata(x.porCobrar) + ' por cobrar' : '') + '</div>' +
      (x.salen.length ? '<h3 style="margin:10px 0 4px">🧳 Salen hoy</h3>' + x.salen.map(s => '<div class="hd-sale"><span><b>' + esc(s.nombre) + '</b>' + (s.quien ? ' · ' + esc(s.quien) : '') + '<br><small>' + (s.ocupada ? (s.saldo > 0 ? 'Debe ' + plata(s.saldo) : '✅ Sin saldo') : 'Sin cuenta abierta') + '</small></span>' +
        (s.ocupada && s.saldo > 0 ? '<button type="button" class="btn-primary" data-hdcobrar="' + esc(s.id) + '">💰 Cobrar</button>' : '') + '</div>').join('') : '') +
      '<h3 style="margin:14px 0 4px">📈 Este mes (' + m.dias + (m.dias === 1 ? ' día' : ' días') + ')</h3>' +
      '<div class="hd-kpis">' + k('Ocupación', pct(m.ocupacion), m.noches + ' de ' + m.disponibles + ' noches') + k('Tarifa promedio (ADR)', isFinite(m.adr) ? plata(m.adr) : '—', 'por noche vendida') +
        k('RevPAR', isFinite(m.revpar) ? plata(m.revpar) : '—', 'por habitación disponible') + k('Lo de las noches', plata(m.valor), 'sin minibar ni otros') + '</div>' +
      '<div class="empty-note">Sale de las cuentas cobradas (llegada y noches) y de las habitaciones ocupadas ahora. «Salen hoy» sale de las 📅 Reservas.</div></div>';
    ov.classList.add('show');
  }
  setInterval(() => { try{ tarjeta(); }catch(e){} }, 3000);
  setTimeout(() => { try{ tarjeta(); }catch(e){} }, 800);
  window.ventoHotelDia = { activo, hoy, mes, salenHoy, abrir, tarjeta };
})();
