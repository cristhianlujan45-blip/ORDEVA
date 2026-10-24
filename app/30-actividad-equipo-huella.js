/* ORDEVA · app/30-actividad-equipo-huella.js — antes estaba dentro de index.html (línea 33414). Se carga en el mismo lugar y orden. */
/* ================= Actividad del equipo (huella de cada persona) =================
   Cada venta, venta borrada o cambiada, producto creado/borrado, cambio de precio, de nombre o de inventario, lo que
   se agrega o se quita de una cuenta, y todo lo que ya anotaba la auditoría de ORDEVA (reinicios, permisos, grupos…),
   se manda al servidor con la cuenta y el rol de quien lo hizo (actividad_registrar). Allí nadie lo puede cambiar ni
   borrar —ni el segundo administrador— y SOLO EL DUEÑO lo ve: Ajustes → Negocio → «📜 Actividad del equipo».
   Lo que llega de otro celular no se anota aquí (lo anota el celular donde se hizo). Sin internet queda en cola. */
(function(){
  'use strict';
  const COLA = 'vento-actividad-cola', MAX_COLA = 3000;
  const N = () => window.ventoNube, neg = () => { try{ return N() && N().negocio(); }catch(e){ return null; } };
  const quien = () => (typeof authUser !== 'undefined' && authUser) || '';
  const $ = n => { try{ return typeof fmt === 'function' ? fmt(n) : '$' + Math.round(+n || 0).toLocaleString('es-CO'); }catch(e){ return String(n); } };
  const lee = () => { try{ const c = JSON.parse(localStorage.getItem(COLA) || '[]'); return Array.isArray(c) ? c : []; }catch(e){ return []; } };
  const guarda = c => { try{ localStorage.setItem(COLA, JSON.stringify(c.slice(-MAX_COLA))); }catch(e){} };
  // 1.58.1: durante una comparación lo anotado se junta (lote) y la cola se lee y se escribe UNA vez, no una por anotación.
  let lote = null;
  function anotar(a, d, m){
    if(!a) return;
    const e = { a: String(a).slice(0, 60), d: String(d || '').slice(0, 300), m: typeof m === 'number' && isFinite(m) ? Math.round(m) : undefined, u: quien(), t: Date.now(), n: (neg() || {}).id || '' };
    if(lote){ lote.push(e); return; }
    const c = lee(); c.push(e); guarda(c); programar();
  }
  // ---------- Diferencias entre lo que había y lo que hay ----------
  const mesaNom = (id, t) => { try{ return typeof tableLabel === 'function' ? tableLabel(id) : ((t && t.name) || ('Mesa ' + id)); }catch(e){ return 'Mesa ' + id; } };
  function foto(){
    if(typeof data === 'undefined' || !data) return null;
    const h = {}, p = {}, m = {};
    // 1.58.1: de cada venta solo el total y la venta misma; el texto de sus productos se arma solo para la que se anota
    // (antes se armaba el de TODAS las ventas en cada toque y con meses de ventas se sentía en el dedo).
    (data.history || []).forEach(x => { if(x && x.id != null) h[x.id] = { total: +x.total || 0, x, mesa: x.tableName || x.table || '' }; });
    (data.products || []).forEach(x => { if(x && x.id != null) p[x.id] = { name: x.name, price: +x.price || 0, cost: x.cost, stock: x.stock }; });
    Object.keys(data.tables || {}).forEach(id => { const t = data.tables[id], q = {}; ((t && t.items) || []).forEach(i => { q[i.name] = (q[i.name] || 0) + (+i.qty || 1); }); m[id] = { q, nom: mesaNom(id, t) }; });
    const au = data.auditoria || [];
    return { ref: data, h, p, m, aud: au.length ? (+au[au.length - 1].t || 0) : 0 };
  }
  let antes = null;
  const prods = v => ((v && v.x && v.x.items) || []).map(i => (i.qty || 1) + ' ' + i.name).join(', ').slice(0, 160);
  function comparar(){
    const ahora = foto(); if(!ahora) return;
    if(!antes || antes.ref !== ahora.ref || window.__nubeAplicando){ antes = ahora; return; }   // datos nuevos (otro negocio, otro celular): no se anotan aquí
    lote = [];
    try{ compararCon(antes, ahora); }
    finally{ const l = lote; lote = null; if(l.length){ const c = lee(); c.push.apply(c, l); guarda(c); programar(); } }
  }
  function compararCon(A, ahora){
    antes = ahora;
    Object.keys(ahora.h).forEach(id => { if(!A.h[id]){ const v = ahora.h[id]; anotar('venta', (v.mesa ? 'Mesa ' + v.mesa + ' · ' : '') + prods(v) + ' · ' + $(v.total), v.total); }
      else if(A.h[id].total !== ahora.h[id].total) anotar('venta cambiada', 'De ' + $(A.h[id].total) + ' a ' + $(ahora.h[id].total) + ' · ' + prods(ahora.h[id]), ahora.h[id].total - A.h[id].total); });
    Object.keys(A.h).forEach(id => { if(!ahora.h[id]){ const v = A.h[id]; anotar('venta borrada', (v.mesa ? 'Mesa ' + v.mesa + ' · ' : '') + prods(v) + ' · ' + $(v.total), -v.total); } });
    Object.keys(ahora.p).forEach(id => { const n = ahora.p[id], o = A.p[id];
      if(!o) return anotar('producto creado', n.name + ' · ' + $(n.price), n.price);
      if(o.name !== n.name) anotar('producto renombrado', o.name + ' → ' + n.name);
      if(o.price !== n.price) anotar('precio cambiado', n.name + ': ' + $(o.price) + ' → ' + $(n.price), n.price - o.price);
      if(o.cost !== n.cost && (o.cost != null || n.cost != null)) anotar('costo cambiado', n.name + ': ' + (o.cost == null ? '—' : $(o.cost)) + ' → ' + (n.cost == null ? '—' : $(n.cost)));
      if(o.stock !== n.stock && (o.stock != null || n.stock != null)) anotar('inventario', n.name + ': ' + (o.stock == null ? '—' : o.stock) + ' → ' + (n.stock == null ? '—' : n.stock), (+n.stock || 0) - (+o.stock || 0)); });
    Object.keys(A.p).forEach(id => { if(!ahora.p[id]) anotar('producto borrado', A.p[id].name + ' · ' + $(A.p[id].price)); });
    // Lo que se agrega o se quita de una cuenta abierta (al cobrarla se vacía: eso ya es la «venta»).
    const vendidas = Object.keys(ahora.h).filter(id => !A.h[id]).length > 0;
    Object.keys(ahora.m).forEach(id => { const o = (A.m[id] || {}).q || {}, n = ahora.m[id].q;
      const mas = [], menos = [];
      Object.keys(n).forEach(k => { const d = n[k] - (o[k] || 0); if(d > 0) mas.push(d + ' ' + k); });
      Object.keys(o).forEach(k => { const d = o[k] - (n[k] || 0); if(d > 0) menos.push(d + ' ' + k); });
      if(mas.length){ anotar('pedido', ahora.m[id].nom + ': ' + mas.join(', ')); try{ window.ventoAtiende && window.ventoAtiende.marcar(id, 'pedido'); }catch(e){} }
      if(menos.length && !vendidas) anotar('quitado de la cuenta', ahora.m[id].nom + ': ' + menos.join(', ')); });
    // Lo que ya anota la auditoría de ORDEVA (reiniciar, combinar, permisos…)
    if(ahora.aud > A.aud) (data.auditoria || []).filter(x => (+x.t || 0) > A.aud).forEach(x => anotar(x.accion, x.detalle));
  }
  window.addEventListener('vento-datos-remotos', () => { antes = foto(); });
  // Después de cada guardado (lo hace la persona en este celular) se compara.
  let tCmp = null;
  const orig = window.saveData;
  if(typeof orig === 'function'){
    window.saveData = function(){ const r = orig.apply(this, arguments); if(!window.__nubeAplicando){ clearTimeout(tCmp); tCmp = setTimeout(comparar, 300); } else antes = null; return r; };
    try{ saveData = window.saveData; }catch(e){}
  }
  setTimeout(() => { antes = foto(); }, 1500);
  setInterval(() => { if(!antes) antes = foto(); }, 5000);
  // ---------- Envío al servidor ----------
  let tEnv = null, enviando = false;
  function programar(){ clearTimeout(tEnv); tEnv = setTimeout(enviar, 2500); }
  async function enviar(){
    if(enviando) return; const n = neg(); if(!n || !navigator.onLine) return;
    let c = lee(); const mios = c.filter(x => !x.n || x.n === n.id).slice(0, 100); if(!mios.length) return;
    enviando = true;
    try{
      const cl = await N().cliente();
      const r = await cl.rpc('actividad_registrar', { p_negocio: n.id, p_eventos: mios.map(x => ({ a: x.a, d: x.d, m: x.m, u: x.u, t: x.t })) });
      if(r.error){ if(/sin_permiso|actividad_invalida/.test(r.error.message || '')){ c = lee().filter(x => mios.indexOf(x) < 0 && !mios.some(y => y.t === x.t && y.a === x.a && y.d === x.d)); guarda(c); } return; }
      c = lee().filter(x => !mios.some(y => y.t === x.t && y.a === x.a && y.d === x.d && y.u === x.u)); guarda(c);
      if(c.some(x => !x.n || x.n === n.id)) programar();
    }catch(e){} finally{ enviando = false; }
  }
  setInterval(enviar, 20000);
  window.addEventListener('online', programar);
  window.ventoActividad = { anotar, enviar, cola: lee, _comparar: comparar };

  // ---------- Vista del dueño: «📜 Actividad del equipo» ----------
  const esDueno = () => { try{ return !!neg() && neg().rol === 'dueno'; }catch(e){ return false; } };
  const e = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ICON = { venta: '💰', 'venta borrada': '🗑️', 'venta cambiada': '✏️', 'producto creado': '🆕', 'producto borrado': '❌', 'precio cambiado': '🏷️', 'costo cambiado': '🏷️', 'producto renombrado': '✏️', inventario: '📦', pedido: '🧾', 'quitado de la cuenta': '➖' };
  function boton(){
    const g = document.querySelector('#view-ajustes .settings-group[data-cat="negocio"]'); if(!g) return;
    let b = document.getElementById('actividadEquipo');
    if(!esDueno()){ if(b) b.remove(); return; }
    if(b) return;
    b = document.createElement('div'); b.id = 'actividadEquipo'; b.className = 'settings-row';
    b.innerHTML = '<div class="settings-row-text"><strong>📜 Actividad del equipo</strong><span>Cada venta, venta borrada, cambio de precio, de producto o de inventario de cada persona (también del segundo administrador). Solo tú la ves y nadie la puede borrar.</span></div><button type="button" class="btn-ghost">Ver</button>';
    b.querySelector('button').onclick = abrir;
    g.appendChild(b);
  }
  let ov = null, filtro = '', ultimoId = null, lista = [];
  async function cargar(mas){
    const n = neg(); if(!n) return;
    const cuerpo = ov.querySelector('#actLista'), info = ov.querySelector('#actInfo');
    info.textContent = 'Cargando…';
    try{
      await enviar();
      const cl = await N().cliente();
      const r = await cl.rpc('actividad_ver', { p_negocio: n.id, p_usuario: filtro || null, p_antes: mas ? ultimoId : null, p_limite: 200 });
      if(r.error) throw r.error;
      const j = r.data || {}, ev = j.eventos || [];
      const sel = ov.querySelector('#actPersona');
      if(sel && !sel.dataset.listo){ sel.dataset.listo = '1'; sel.innerHTML = '<option value="">Todas las personas</option>' + (j.personas || []).map(p => '<option value="' + e(p.usuario_id) + '">' + e(p.nombre || p.email) + ' · ' + e((window.ventoRolNombre ? window.ventoRolNombre(p.rol) : p.rol)) + '</option>').join(''); sel.value = filtro; }
      lista = mas ? lista.concat(ev) : ev;
      ultimoId = lista.length ? lista[lista.length - 1].id : null;
      cuerpo.innerHTML = lista.length ? lista.map(x => {
        const ac = String(x.accion || '').replace(/^app:/, ''), d = x.detalle || {}, f = new Date(x.creado_en);
        const rol = window.ventoRolNombre ? window.ventoRolNombre(x.rol) : x.rol;
        return '<div style="display:flex;gap:10px;padding:9px 2px;border-bottom:1px solid var(--line)"><span style="font-size:20px">' + (ICON[ac] || '•') + '</span><div style="flex:1;min-width:0"><b>' + e(ac.charAt(0).toUpperCase() + ac.slice(1)) + '</b>' +
          (d.d ? '<div style="font-size:13.5px;line-height:1.4;word-break:break-word">' + e(d.d) + '</div>' : (x.detalle && !d.d ? '<div style="font-size:12.5px;opacity:.75;word-break:break-word">' + e(JSON.stringify(x.detalle).slice(0, 200)) + '</div>' : '')) +
          '<small style="opacity:.75">' + e(x.nombre || x.email || '—') + ' · ' + e(rol || '') + (d.u && d.u !== x.email ? ' (' + e(d.u) + ')' : '') + ' · ' + f.toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) + '</small></div></div>';
      }).join('') : '<p style="opacity:.8">Todavía no hay actividad.</p>';
      info.textContent = lista.length + ' registro' + (lista.length === 1 ? '' : 's');
      ov.querySelector('#actMas').hidden = ev.length < 200;
    }catch(x){ info.textContent = '⚠️ No se pudo cargar la actividad' + (navigator.onLine ? '' : ' (sin internet)') + '.'; }
  }
  function abrir(){
    if(!ov){
      ov = document.createElement('div'); ov.id = 'actOv'; ov.className = 'overlay'; ov.setAttribute('data-novocab', ''); ov.style.zIndex = '10050';
      ov.innerHTML = '<div class="modal" role="dialog" aria-label="Actividad del equipo" style="max-width:560px;width:100%;max-height:calc(100vh - 32px);display:flex;flex-direction:column"><div style="display:flex;align-items:center;gap:8px"><h2 style="flex:1;margin:0">📜 Actividad del equipo</h2><button type="button" class="btn-ghost" data-act="cerrar">Cerrar</button></div>' +
        '<select id="actPersona" style="margin:10px 0"></select><small id="actInfo" style="opacity:.8"></small><div id="actLista" style="overflow:auto;flex:1;margin-top:6px"></div><button type="button" class="btn-ghost" id="actMas" hidden style="margin-top:8px">Ver más antiguos</button></div>';
      document.body.appendChild(ov);
      ov.addEventListener('click', ev => { if(ev.target === ov || (ev.target.closest && ev.target.closest('[data-act="cerrar"]'))) ov.classList.remove('show'); });
      ov.querySelector('#actPersona').onchange = ev => { filtro = ev.target.value; cargar(false); };
      ov.querySelector('#actMas').onclick = () => cargar(true);
    }
    ov.classList.add('show'); cargar(false);
  }
  window.ventoActividad.abrir = abrir;
  setInterval(boton, 2000); setTimeout(boton, 800);
})();
