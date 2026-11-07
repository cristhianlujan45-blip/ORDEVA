/* =====================================================================
   ORDEVA · 🏨 Hoteles: tarifas por temporada y comisión de Booking / Airbnb (1.87.0)
   TARIFAS (las mismas reglas que usa el servidor, supabase/migrations/20261129000000_tarifas_temporada.sql):
     • En «📅 Reservas → 🤖 Reservas en línea»: temporadas (nombre, desde, hasta, ± %) y fin de semana (+ % las noches de
       viernes y sábado). Cada noche vale precio × (1 + (temporada + fin de semana) / 100), redondeado a cientos.
     • El agente en línea muestra y cobra el total de cada noche (lo calcula el servidor). Las reservas que se hacen en la
       app quedan con el mismo valor.
   PLATAFORMAS:
     • En la cuenta de la habitación: «🌐 Viene de: Directo / Booking / Airbnb / Expedia / Otra». Al tocar «✅ Llegó» en una
       reserva que entró por el calendario de Booking o Airbnb, se pone sola.
     • Al cobrar, la venta guarda la plataforma, el % y la comisión, y la comisión queda como gasto «Comisión de
       plataformas» en Contabilidad: la ganancia del mes ya la descuenta. Si la venta se deshace, el gasto se quita.
     • El % de cada plataforma se pone en Ajustes → Negocio (Booking 15 %, Airbnb 3 %, Expedia 18 % de entrada).
   ===================================================================== */
(function(){
  'use strict';
  if(window.ventoTarifas) return;
  const D = () => (typeof data !== 'undefined' ? data : null);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plata = n => { try{ return fmt(Math.round(n || 0)); }catch(e){ return '$' + Math.round(n || 0).toLocaleString('es-CO'); } };
  const toast = (t, ms) => { try{ showToast(t, ms || 5000); }catch(e){} };
  const guardar = () => { try{ saveData(); }catch(e){} };
  const TIPOS = ['hotel', 'hostal', 'apartamentos'];
  const activo = () => { const d = D(); return !!(d && TIPOS.includes(d.businessType)); };
  const jefe = () => { try{ return !window.ventoRoles || window.ventoRoles.esJefe(); }catch(e){ return true; } };
  const num = v => { const n = Number(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) ? n : NaN; };
  const MD = /^\d\d-\d\d$/;
  const md = x => String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');

  // ---------- Tarifas (igual que srv_tarifa_noche / srv_tarifa_total) ----------
  function noche(rg, precio, dia){
    if(precio == null || !(Number(precio) >= 0)) return null;
    rg = rg || {}; const m = md(dia); let pt = 0, pf = 0;
    for(const t of (Array.isArray(rg.temporadas) ? rg.temporadas : []).slice(0, 20)){
      if(!t || !MD.test(t.desde || '') || !MD.test(t.hasta || '') || !isFinite(num(t.pct))) continue;
      if((t.desde <= t.hasta && m >= t.desde && m <= t.hasta) || (t.desde > t.hasta && (m >= t.desde || m <= t.hasta))){ pt = num(t.pct); break; }
    }
    if(rg.finde && isFinite(num(rg.finde.pct))){ const dias = Array.isArray(rg.finde.dias) ? rg.finde.dias : [5, 6]; if(dias.includes(dia.getDay())) pf = num(rg.finde.pct); }
    return Math.max(0, Math.round(Number(precio) * (1 + Math.max(-90, Math.min(300, pt + pf)) / 100) / 100) * 100);
  }
  function total(rg, precio, desde, hasta){
    if(precio == null) return null;
    const a = new Date(desde); a.setHours(0, 0, 0, 0); const b = new Date(hasta); b.setHours(0, 0, 0, 0);
    const n = Math.max(1, Math.round((b - a) / 864e5)); let s = 0;
    for(let i = 0; i < n && i < 62; i++){ const x = new Date(a); x.setDate(a.getDate() + i); s += noche(rg, precio, x); }
    return s;
  }
  // El editor de «Reservas en línea» (solo hoteles).
  function htmlCfg(rg){
    rg = rg || {}; const ts = Array.isArray(rg.temporadas) ? rg.temporadas : [];
    const fila = t => '<div class="tf-t" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:4px 0"><input data-tf="n" maxlength="30" placeholder="Nombre (ej. Alta)" value="' + esc(t.n || '') + '" style="flex:2;min-width:100px">' +
      '<label style="font-size:13px">del <input data-tf="desde" placeholder="15-12" title="día-mes" value="' + esc(t.desde ? t.desde.split('-').reverse().join('-') : '') + '" style="width:64px;text-align:center"></label>' +
      '<label style="font-size:13px">al <input data-tf="hasta" placeholder="15-01" title="día-mes" value="' + esc(t.hasta ? t.hasta.split('-').reverse().join('-') : '') + '" style="width:64px;text-align:center"></label>' +
      '<label style="font-size:13px"><input data-tf="pct" inputmode="decimal" placeholder="+30" value="' + esc(t.pct != null ? t.pct : '') + '" style="width:56px;text-align:center"> %</label>' +
      '<button type="button" class="btn-ghost" data-tf="quitar" aria-label="Quitar">✕</button></div>';
    return '<h3 class="rs-h">🗓️ Tarifas por temporada</h3><p class="modal-sub" style="margin:0 0 6px">El precio de cada noche sube (o baja, con un % negativo) en esas fechas. Día-mes, ej. del 15-12 al 15-01. El agente cobra lo que da cada noche.</p>' +
      '<div class="tf-lista">' + ts.map(fila).join('') + '</div><button type="button" class="btn-ghost" data-tf="mas">➕ Temporada</button>' +
      '<label style="display:flex;gap:8px;align-items:center;margin-top:8px">Fin de semana (noches de viernes y sábado) <input id="tfFinde" inputmode="decimal" placeholder="+0" value="' + esc(rg.finde && rg.finde.pct != null ? rg.finde.pct : '') + '" style="width:64px;text-align:center"> %</label>';
  }
  const aMD = v => { const m = String(v || '').trim().match(/^(\d{1,2})[-/.](\d{1,2})$/); if(!m) return ''; const d = +m[1], mo = +m[2]; return d >= 1 && d <= 31 && mo >= 1 && mo <= 12 ? String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0') : ''; };
  function leer(){
    const out = { temporadas: [] };
    document.querySelectorAll('#rsOv .tf-t').forEach(f => {
      const g = k => (f.querySelector('[data-tf="' + k + '"]') || {}).value || '';
      const t = { n: g('n').trim().slice(0, 30), desde: aMD(g('desde')), hasta: aMD(g('hasta')), pct: Math.max(-90, Math.min(300, Math.round(num(g('pct')) * 10) / 10)) };
      if(t.desde && t.hasta && isFinite(t.pct) && t.pct) out.temporadas.push(t);
    });
    const f = num((document.getElementById('tfFinde') || {}).value);
    out.finde = isFinite(f) && f ? { pct: Math.max(-90, Math.min(300, f)), dias: [5, 6] } : null;
    if(!out.finde) delete out.finde;
    return out;
  }
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('#rsOv [data-tf="mas"], #rsOv [data-tf="quitar"]'); if(!b) return;
    if(b.dataset.tf === 'quitar'){ b.closest('.tf-t').remove(); return; }
    const l = b.parentNode.querySelector('.tf-lista'); if(!l) return;
    const tmp = document.createElement('div'); tmp.innerHTML = htmlCfg({ temporadas: [{}] }); const f = tmp.querySelector('.tf-t'); if(f) l.appendChild(f);
  });

  // ---------- Plataformas (Booking, Airbnb…) ----------
  const PLAT = ['Booking', 'Airbnb', 'Expedia', 'Otra'];
  const DEF = { Booking: 15, Airbnb: 3, Expedia: 18, Otra: 0 };
  const pctDe = p => { const d = D() || {}, c = d.plataformasPct || {}; if(c[p] == null || c[p] === '') return DEF[p] || 0; const v = num(c[p]); return isFinite(v) ? Math.max(0, Math.min(50, v)) : (DEF[p] || 0); };
  // La reserva que entró por el calendario de la plataforma (nota «ical:Booking:…», cliente «🔗 Booking»).
  function plataformaDe(r){
    if(!r) return '';
    const m = /^ical:([^:]+):/.exec(r.nota || '') || /^🔗\s*(\S+)/.exec(r.cliente || '');
    if(!m) return '';
    const f = PLAT.find(p => p.toLowerCase() === String(m[1]).toLowerCase()); return f || 'Otra';
  }
  function pintarCuenta(){
    const ov = document.getElementById('overlay'), box0 = document.getElementById('pfBox');
    const id = typeof currentTable !== 'undefined' ? currentTable : null, d = D(), t = id != null && d && d.tables ? d.tables[id] : null;
    const ver = activo() && ov && ov.classList.contains('show') && t && (t.items || []).length;
    if(!ver){ if(box0) box0.hidden = true; return; }
    const cont = document.getElementById('itemsContainer'); if(!cont || !cont.parentNode) return;
    let box = box0;
    if(!box){ box = document.createElement('div'); box.id = 'pfBox'; box.className = 'ht-noches'; box.style.flexDirection = 'row'; box.style.alignItems = 'center'; box.style.gap = '8px';
      box.addEventListener('change', ev => { const s = ev.target.closest('select'); if(!s) return; const tt = D().tables[currentTable]; if(!tt) return; if(s.value) tt.plataforma = s.value; else delete tt.plataforma; guardar(); box._k = ''; pintarCuenta(); }); }
    const ref = document.getElementById('htNoches');
    if(box.parentNode !== cont.parentNode){ cont.parentNode.insertBefore(box, ref && ref.parentNode === cont.parentNode ? ref.nextSibling : cont); }
    const p = t.plataforma || '';
    const k = id + '|' + p + '|' + pctDe(p);
    if(box._k !== k){ box._k = k;
      box.innerHTML = '<span>🌐 Viene de</span><select class="mz-in" aria-label="De dónde viene la reserva"><option value="">Directo (sin comisión)</option>' + PLAT.map(x => '<option value="' + x + '"' + (x === p ? ' selected' : '') + '>' + x + ' (' + pctDe(x) + ' %)</option>').join('') + '</select>' +
        (p ? '<small style="opacity:.8">Al cobrar, la comisión de ' + esc(p) + ' queda como gasto.</small>' : ''); }
    box.hidden = false;
  }
  // Al cobrar: la venta guarda la comisión y queda el gasto en Contabilidad.
  function envolverCierre(){
    const orig = window.closeTableToHistory; if(typeof orig !== 'function' || orig._pf) return;
    const nuevo = function(id){
      const d = D(), t = d && d.tables && d.tables[id], p = activo() && t ? (t.plataforma || '') : '';
      const r = orig.apply(this, arguments);
      if(r && p){
        const base = Math.max(0, (Number(r.total) || 0) - (window.propinaDe ? window.propinaDe(r) : 0)), pct = pctDe(p), com = Math.round(base * pct / 100);
        r.plataforma = p; r.plataformaPct = pct; r.comisionPlataforma = com;
        if(com > 0){
          d.contab = Array.isArray(d.contab) ? d.contab : [];
          const hoy = new Date(); let nom = String(id); try{ nom = tableLabel(id); }catch(x){}
          d.contab.unshift({ id: 'ctpf' + r.id, tipo: 'gasto', cat: 'plataformas', monto: com, metodo: 'transferencia', origen: 'plataforma', ref: r.id, nota: 'Comisión ' + p + ' (' + pct + ' %) · ' + nom + (r.tableName ? ' · ' + r.tableName : ''),
            by: (typeof authUser !== 'undefined' && authUser) || '', at: Date.now(), fecha: hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-' + String(hoy.getDate()).padStart(2, '0') });
          setTimeout(() => toast('🌐 ' + p + ': comisión de ' + plata(com) + ' (' + pct + ' %) anotada como gasto. Te queda ' + plata(base - com) + '.', 7000), 600);
        }
      }
      if(t && 'plataforma' in t) delete t.plataforma;
      return r;
    };
    for(const k in orig) if(k.charAt(0) === '_') nuevo[k] = orig[k];   // las marcas de los demás (1.85.0)
    nuevo._pf = true; window.closeTableToHistory = nuevo;
  }
  // Si la venta se deshizo, su gasto de comisión se quita (solo los automáticos de la última semana).
  function limpiar(){
    const d = D(); if(!d || !Array.isArray(d.contab) || !Array.isArray(d.history)) return;
    const ids = new Set(d.history.map(h => h && h.id)), lim = Date.now() - 7 * 864e5, antes = d.contab.length;
    d.contab = d.contab.filter(g => !(g && g.origen === 'plataforma' && g.ref && !ids.has(g.ref) && Number(g.at) > lim));
    if(d.contab.length !== antes) guardar();
  }
  // ---------- Ajustes → Negocio ----------
  function pintarAjustes(){
    const g = document.querySelector('#view-ajustes .settings-group[data-cat="negocio"]'); if(!g) return;
    let box = document.getElementById('plataformasBox');
    if(!activo() || !jefe()){ if(box) box.remove(); return; }
    if(!box){ box = document.createElement('div'); box.id = 'plataformasBox'; box.className = 'settings-row'; box.style.cssText = 'flex-direction:column;align-items:stretch;gap:8px'; g.appendChild(box); }
    box.innerHTML = '<div class="settings-row-text"><strong>🌐 Comisión de las plataformas</strong><span>Lo que cobra cada una por reserva. Al cobrar una habitación que viene de una plataforma, la comisión queda como gasto y la ganancia ya la descuenta.</span></div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap">' + PLAT.map(p => '<label style="font-size:14px">' + p + ' <input class="mz-in" data-pfp="' + p + '" inputmode="decimal" value="' + pctDe(p) + '" style="width:56px;text-align:center"> %</label>').join('') + '</div>';
    box.querySelectorAll('[data-pfp]').forEach(i => { i.onchange = () => { const d = D(); if(!d) return; d.plataformasPct = Object.assign({}, d.plataformasPct || {}); const v = num(i.value); d.plataformasPct[i.dataset.pfp] = isFinite(v) ? Math.max(0, Math.min(50, v)) : 0; guardar(); toast('✅ ' + i.dataset.pfp + ': ' + d.plataformasPct[i.dataset.pfp] + ' %'); }; });
  }
  document.addEventListener('click', ev => { if(ev.target.closest && ev.target.closest('.ajustes-cat[data-cat="negocio"], nav button[data-view="ajustes"], .more-tile[data-go]')) setTimeout(pintarAjustes, 100); }, true);

  envolverCierre();
  setInterval(() => { try{ envolverCierre(); if(activo()) pintarCuenta(); }catch(e){} }, 800);
  setInterval(() => { try{ limpiar(); }catch(e){} }, 15000);
  window.addEventListener('vento-datos-remotos', () => { try{ limpiar(); }catch(e){} });

  window.ventoTarifas = { noche, total, htmlCfg, leer, plataformaDe, pctDe, pintarCuenta, pintarAjustes, limpiar, activo };
})();
