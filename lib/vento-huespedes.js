/* ORDEVA · lib/vento-huespedes.js — 1.76.0: 🪪 Registro de huéspedes (hoteles, hostales, apartamentos y moteles).
   En Colombia cada alojamiento lleva la Tarjeta de Registro Hotelero de cada huésped. Ahora ORDEVA la pide al hacer el
   check-in, en la misma cuenta de la habitación:
   • «🪪 Registrar huésped»: nombre, documento, nacionalidad, residencia, procedencia, destino, motivo del viaje, celular,
     correo y acompañantes. Si la habitación tiene cuenta y no tiene registro, lo avisa.
   • Si llegó por una reserva (📅 «✅ Llegó»), el nombre, el celular y las personas ya vienen puestos.
   • Al cobrar, el registro queda guardado con la venta (llegada, salida, noches y valor).
   • «🪪 Huéspedes» (en Cuentas): todos los registros del mes, buscar, y «⬇️ Excel» con las columnas de la tarjeta.
   Los datos son del negocio (viajan con sus datos y su nube); no se mandan a ningún otro lado. */
(function(){
  'use strict';
  if(window.ventoHuespedes) return;
  const TIPOS = ['hotel', 'hostal', 'apartamentos', 'motel'];
  const D = () => (typeof data !== 'undefined' ? data : null);
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (t, ms) => { try{ showToast(t, ms || 5000); }catch(e){} };
  const activo = () => { const d = D(); return !!(d && TIPOS.includes(d.businessType)); };
  const etiqueta = id => { try{ return tableLabel(id); }catch(e){ return 'Habitación ' + id; } };
  const DOCS = [['CC', 'Cédula de ciudadanía'], ['CE', 'Cédula de extranjería'], ['PA', 'Pasaporte'], ['TI', 'Tarjeta de identidad'], ['PPT', 'PPT / PEP'], ['RC', 'Registro civil'], ['OT', 'Otro']];
  const MOTIVOS = ['Turismo', 'Negocios / trabajo', 'Salud', 'Eventos / congresos', 'Visita a familiares', 'Estudios', 'Tránsito', 'Otro'];
  const CAMPOS = [
    ['nombre', 'Nombres y apellidos *', 'text', 'Ej. Ana María Ruiz Gómez'],
    ['doc', 'Número de documento *', 'text', 'Ej. 1020304050'],
    ['nacionalidad', 'Nacionalidad', 'text', 'Colombia'],
    ['nacimiento', 'Fecha de nacimiento', 'date', ''],
    ['residencia', 'Ciudad y país donde vive', 'text', 'Ej. Medellín, Colombia'],
    ['procedencia', 'Viene de', 'text', 'Ej. Bogotá'],
    ['destino', 'Va para (destino siguiente)', 'text', 'Ej. Cartagena'],
    ['telefono', 'Celular', 'tel', 'Ej. 300 123 4567'],
    ['correo', 'Correo', 'email', 'Ej. ana@correo.com'],
    ['placa', 'Placa del vehículo', 'text', 'Si trae carro o moto']
  ];

  // ---------- En la cuenta de la habitación ----------
  function cuarto(){ const id = typeof currentTable !== 'undefined' ? currentTable : null, d = D(); return id != null && d && d.tables ? [id, d.tables[id]] : [null, null]; }
  function resumen(h){
    const n = 1 + ((h.acomp || []).filter(a => a && a.nombre).length);
    return esc(h.nombre) + ' · ' + esc((h.tipoDoc || 'CC') + ' ' + (h.doc || '')) + (h.nacionalidad && !/^colombia/i.test(h.nacionalidad) ? ' · ' + esc(h.nacionalidad) : '') + ' · ' + n + (n === 1 ? ' persona' : ' personas');
  }
  function pintar(){
    const ov = $('overlay'), cont = $('itemsContainer'); let box = $('hpBox');
    const [id, t] = cuarto();
    if(!activo() || !ov || !ov.classList.contains('show') || !t){ if(box) box.hidden = true; return; }
    if(!cont || !cont.parentNode) return;
    if(!box){ box = document.createElement('div'); box.id = 'hpBox'; box.className = 'hp-box'; }
    if(box.parentNode !== cont.parentNode){ const ck = $('ckCocina'); cont.parentNode.insertBefore(box, ck && ck.parentNode === cont.parentNode ? ck : cont); }
    const h = t.huesped, abierta = (t.items || []).length > 0;
    const html = h && h.nombre
      ? '<span>🪪 <b>' + resumen(h) + '</b></span><button type="button" class="hp-mini" data-hp="editar">✏️ Ver / cambiar</button>'
      : '<span>' + (abierta ? '⚠️ <b>Falta el registro del huésped</b> (Tarjeta de Registro Hotelero)' : '🪪 ¿Llega un huésped? Regístralo al hacer el check-in') + '</span><button type="button" class="btn-primary hp-btn" data-hp="editar">🪪 Registrar huésped</button>';
    box.classList.toggle('hp-falta', !h && abierta);
    const k = html + id;
    if(box._k !== k){ box._k = k; box.innerHTML = html; }
    box.hidden = false;
  }

  // ---------- Formulario ----------
  function abrirForm(id){
    const d = D(), t = d && d.tables && d.tables[id]; if(!t) return;
    const pre = t.huespedPre || {};
    const h = Object.assign({ tipoDoc: 'CC', nacionalidad: 'Colombia', motivo: 'Turismo', acomp: [] }, t.huesped || { nombre: pre.nombre || '', telefono: pre.telefono || '' });
    if(!t.huesped && pre.personas > 1 && !h.acomp.length) h.acomp = Array.from({ length: Math.min(9, pre.personas - 1) }, () => ({ nombre: '', doc: '' }));
    let ov = $('hpOv');
    if(!ov){ ov = document.createElement('div'); ov.id = 'hpOv'; ov.className = 'overlay hp-ov'; ov.setAttribute('data-novocab', ''); document.body.appendChild(ov); }
    const campo = c => '<label class="' + (c[0] === 'nombre' ? 'hp-ancho' : '') + '">' + esc(c[1]) + '<input data-k="' + c[0] + '" type="' + c[2] + '" placeholder="' + esc(c[3]) + '" value="' + esc(h[c[0]] || '') + '"' + (c[0] === 'doc' ? ' inputmode="text" autocomplete="off"' : '') + '></label>';
    ov.innerHTML = '<div class="modal hp-modal"><div class="modal-title-row"><h2>🪪 Huésped · ' + esc(etiqueta(id)) + '</h2><button class="rename-table-btn" data-hp="cerrar" title="Cerrar">✕</button></div>' +
      '<p class="settings-desc" style="margin:0 0 8px">Los datos de la Tarjeta de Registro Hotelero. Lo que tiene * es obligatorio.</p>' +
      '<div class="hp-form">' + campo(CAMPOS[0]) +
      '<label>Tipo de documento *<select data-k="tipoDoc">' + DOCS.map(o => '<option value="' + o[0] + '"' + (h.tipoDoc === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select></label>' +
      CAMPOS.slice(1).map(campo).join('') +
      '<label>Motivo del viaje<select data-k="motivo">' + MOTIVOS.map(m => '<option' + (h.motivo === m ? ' selected' : '') + '>' + esc(m) + '</option>').join('') + '</select></label>' +
      '</div><h3 class="hp-h">👥 Acompañantes</h3><div class="hp-acomp">' + (h.acomp || []).map(filaAcomp).join('') + '</div>' +
      '<button type="button" class="btn-ghost" data-hp="mas">➕ Agregar acompañante</button>' +
      '<div class="hp-msg" id="hpMsg"></div>' +
      '<div class="modal-actions"><button type="button" class="btn-close" data-hp="cerrar">Cancelar</button><button type="button" class="btn-primary" data-hp="guardar">💾 Guardar registro</button></div></div>';
    ov.dataset.id = id;
    ov.classList.add('show');
    setTimeout(() => { const n = ov.querySelector('[data-k="' + (h.nombre ? 'doc' : 'nombre') + '"]'); if(n) try{ n.focus(); }catch(e){} }, 60);
  }
  function filaAcomp(a){
    a = a || {};
    return '<div class="hp-a"><input data-a="nombre" placeholder="Nombre" value="' + esc(a.nombre || '') + '"><input data-a="doc" placeholder="Documento" value="' + esc(a.doc || '') + '"><input data-a="parentesco" placeholder="Parentesco (ej. hijo)" value="' + esc(a.parentesco || '') + '"><button type="button" class="hp-mini" data-hp="quitar" title="Quitar">✕</button></div>';
  }
  function leerForm(ov){
    const h = {};
    ov.querySelectorAll('[data-k]').forEach(i => { h[i.dataset.k] = String(i.value || '').trim(); });
    h.acomp = [...ov.querySelectorAll('.hp-a')].map(f => ({ nombre: f.querySelector('[data-a="nombre"]').value.trim(), doc: f.querySelector('[data-a="doc"]').value.trim(), parentesco: f.querySelector('[data-a="parentesco"]').value.trim() })).filter(a => a.nombre || a.doc);
    return h;
  }
  function guardarForm(ov){
    const id = isNaN(+ov.dataset.id) ? ov.dataset.id : +ov.dataset.id, d = D(), t = d && d.tables && d.tables[id]; if(!t) return;
    const h = leerForm(ov), msg = $('hpMsg');
    if(h.nombre.split(/\s+/).filter(Boolean).length < 2){ msg.textContent = '⚠️ Escribe el nombre completo (nombres y apellidos).'; return; }
    if(!/^[A-Za-z0-9.\-]{3,20}$/.test(h.doc.replace(/\s/g, ''))){ msg.textContent = '⚠️ Escribe el número de documento (solo números y letras).'; return; }
    h.doc = h.doc.replace(/[\s.]/g, '');
    h.registro = (t.huesped && t.huesped.registro) || Date.now();
    let quien = ''; try{ quien = String(authUser || ''); }catch(e){}
    h.por = (t.huesped && t.huesped.por) || quien;
    t.huesped = h; delete t.huespedPre;
    try{ saveData(); }catch(e){}
    try{ window.ventoAuditar && window.ventoAuditar('huésped registrado', etiqueta(id) + ': ' + h.nombre, [id]); }catch(e){}
    ov.classList.remove('show');
    pintar();
    toast('🪪 ' + h.nombre + ' registrado en ' + etiqueta(id) + '.' + ((t.items || []).length ? '' : ' Agrega la tarifa de la noche para abrir la cuenta.'), 6000);
  }
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-hp]'); if(!b) return;
    const a = b.dataset.hp, ov = $('hpOv');
    if(a === 'editar'){ e.stopPropagation(); const [id] = cuarto(); if(id != null) abrirForm(id); return; }
    if(!ov || !ov.contains(b)) return;
    e.stopPropagation();
    if(a === 'cerrar') ov.classList.remove('show');
    else if(a === 'mas') ov.querySelector('.hp-acomp').insertAdjacentHTML('beforeend', filaAcomp());
    else if(a === 'quitar') b.closest('.hp-a').remove();
    else if(a === 'guardar') guardarForm(ov);
  }, true);

  // ---------- Al cobrar: el registro queda con la venta ----------
  function envolverCierre(){
    const orig = window.closeTableToHistory; if(typeof orig !== 'function' || orig._hp) return;
    const nuevo = function(id){
      const d = D(), t = d && d.tables && d.tables[id], h = t && t.huesped ? JSON.parse(JSON.stringify(t.huesped)) : null;
      const r = orig.apply(this, arguments);
      if(r && h){ r.huesped = h; try{ saveData(); }catch(e){} }
      if(r && t){ delete t.huesped; delete t.huespedPre; }
      return r;
    };
    // 1.85.0: lleva las marcas de los demás módulos (si no, se envolvían uno al otro sin fin: miles de capas y, a la
    // media hora de tener ORDEVA abierto, «Maximum call stack size exceeded» al cerrar una cuenta).
    for(const k in orig) if(k.charAt(0) === '_') nuevo[k] = orig[k];
    nuevo._hp = true; window.closeTableToHistory = nuevo;
  }

  // ---------- 🪪 Huéspedes: lista y Excel ----------
  function registros(){
    const d = D(); if(!d) return [];
    const L = [];
    (d.history || []).forEach(e => { if(e && e.huesped) L.push({ h: e.huesped, hab: e.tableName || etiqueta(e.table), entrada: e.entrada ? new Date(e.entrada).getTime() : e.huesped.registro, salida: new Date(e.date).getTime() || null, noches: e.noches || null, valor: e.total || 0, abierta: false }); });
    Object.keys(d.tables || {}).forEach(id => { const t = d.tables[id]; if(t && t.huesped) L.push({ h: t.huesped, hab: etiqueta(id), entrada: (window.ventoHotel && window.ventoHotel.entrada(t)) || t.huesped.registro, salida: null, noches: null, valor: 0, abierta: true }); });
    return L.sort((a, b) => (b.entrada || 0) - (a.entrada || 0));
  }
  const fecha = t => t ? new Date(t).toLocaleString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
  const mesDe = t => { const x = new Date(t || Date.now()); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'); };
  function abrirLista(mes){
    let ov = $('hpLista');
    if(!ov){ ov = document.createElement('div'); ov.id = 'hpLista'; ov.className = 'overlay hp-ov'; ov.setAttribute('data-novocab', ''); document.body.appendChild(ov); }
    mes = mes || mesDe();
    const todos = registros(), meses = [...new Set([mesDe()].concat(todos.map(r => mesDe(r.entrada))))].sort().reverse();
    const L = todos.filter(r => mesDe(r.entrada) === mes);
    ov.innerHTML = '<div class="modal hp-modal"><div class="modal-title-row"><h2>🪪 Huéspedes</h2><button class="rename-table-btn" data-hl="cerrar" title="Cerrar">✕</button></div>' +
      '<div class="hp-bar"><select data-hl="mes">' + meses.map(m => '<option value="' + m + '"' + (m === mes ? ' selected' : '') + '>' + esc(new Date(m + '-15').toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })) + '</option>').join('') + '</select>' +
      '<input type="search" data-hl="buscar" placeholder="Buscar nombre o documento"><button type="button" class="btn-primary" data-hl="excel"' + (L.length ? '' : ' disabled') + '>⬇️ Excel</button></div>' +
      '<p class="settings-desc" style="margin:4px 0 8px">' + L.length + (L.length === 1 ? ' registro' : ' registros') + ' · ' + L.reduce((s, r) => s + 1 + (r.h.acomp || []).length, 0) + ' personas</p>' +
      '<div class="hp-filas">' + (L.length ? L.map(r => '<div class="hp-fila" data-txt="' + esc((r.h.nombre + ' ' + r.h.doc).toLowerCase()) + '"><b>' + esc(r.h.nombre) + '</b><span>' + esc((r.h.tipoDoc || '') + ' ' + (r.h.doc || '')) + (r.h.nacionalidad ? ' · ' + esc(r.h.nacionalidad) : '') + '</span>' +
        '<small>' + esc(r.hab) + ' · ' + esc(fecha(r.entrada)) + (r.abierta ? ' · <b class="hp-aqui">hospedado ahora</b>' : r.salida ? ' → ' + esc(fecha(r.salida)) : '') + ((r.h.acomp || []).length ? ' · 👥 +' + r.h.acomp.length : '') + (r.h.procedencia ? ' · de ' + esc(r.h.procedencia) : '') + '</small></div>').join('') : '<p class="settings-desc">Todavía no hay huéspedes registrados este mes.</p>') + '</div></div>';
    ov.dataset.mes = mes;
    ov.classList.add('show');
  }
  function excel(mes){
    const L = registros().filter(r => mesDe(r.entrada) === mes);
    const cab = ['Llegada', 'Salida', 'Habitación', 'Noches', 'Nombres y apellidos', 'Tipo de documento', 'Número de documento', 'Nacionalidad', 'Fecha de nacimiento', 'Residencia', 'Procedencia', 'Destino', 'Motivo del viaje', 'Acompañantes', 'Nombres de acompañantes', 'Celular', 'Correo', 'Placa', 'Valor cobrado', 'Registró'];
    const filas = L.map(r => [fecha(r.entrada), r.abierta ? 'Hospedado' : fecha(r.salida), r.hab, r.noches || '', r.h.nombre, r.h.tipoDoc || '', r.h.doc || '', r.h.nacionalidad || '', r.h.nacimiento || '', r.h.residencia || '', r.h.procedencia || '', r.h.destino || '', r.h.motivo || '',
      (r.h.acomp || []).length, (r.h.acomp || []).map(a => a.nombre + (a.doc ? ' (' + a.doc + ')' : '') + (a.parentesco ? ' - ' + a.parentesco : '')).join('; '), r.h.telefono || '', r.h.correo || '', r.h.placa || '', r.valor || 0, r.h.por || '']);
    const nombre = 'Huespedes-' + (String((D() || {}).businessName || 'hotel').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'hotel') + '-' + mes + '.xlsx';
    if(window.ventoXlsx) window.ventoXlsx.descargar(nombre, [{ nombre: 'Huéspedes', filas: [cab].concat(filas) }]);
    return { nombre, filas: filas.length };
  }
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('#hpLista [data-hl], [data-hl="abrir"]'); if(!b) return;
    e.stopPropagation();
    const a = b.dataset.hl, ov = $('hpLista');
    if(a === 'abrir') abrirLista();
    else if(a === 'cerrar') ov.classList.remove('show');
    else if(a === 'excel'){ const r = excel(ov.dataset.mes); toast('⬇️ ' + r.filas + (r.filas === 1 ? ' registro' : ' registros') + ' en ' + r.nombre); }
  }, true);
  document.addEventListener('change', e => { const s = e.target.closest && e.target.closest('#hpLista [data-hl="mes"]'); if(s) abrirLista(s.value); }, true);
  document.addEventListener('input', e => {
    const s = e.target.closest && e.target.closest('#hpLista [data-hl="buscar"]'); if(!s) return;
    const q = s.value.trim().toLowerCase();
    document.querySelectorAll('#hpLista .hp-fila').forEach(f => { f.hidden = !!q && !f.dataset.txt.includes(q); });
  }, true);
  // Botón en Cuentas
  function pintarBoton(){
    const fila = document.querySelector('#view-mesas .config-row:not(#tableCountRow)'); if(!fila) return;
    let b = $('hpBtn');
    if(!activo()){ if(b) b.remove(); return; }
    if(!b){ b = document.createElement('button'); b.type = 'button'; b.id = 'hpBtn'; b.className = 'btn-ghost'; b.dataset.hl = 'abrir'; b.title = 'Registro de huéspedes (Tarjeta de Registro Hotelero) y Excel'; b.textContent = '🪪 Huéspedes'; fila.insertBefore(b, fila.firstChild); }
  }

  envolverCierre();
  setInterval(() => { try{ envolverCierre(); pintar(); pintarBoton(); }catch(e){} }, 500);

  const css = document.createElement('style');
  css.textContent = '.hp-box{margin:6px 0 10px;padding:9px 12px;border-radius:12px;border:1px solid var(--line);background:var(--surface-2,var(--surface));font-size:14px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}.hp-box[hidden]{display:none}' +
    '.hp-box.hp-falta{border-color:#f59e0b;background:color-mix(in srgb,#f59e0b 14%,var(--surface))}.hp-btn{padding:7px 12px;font-size:13.5px}' +
    '.hp-mini{border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:999px;padding:4px 10px;font:600 12.5px/1.2 var(--font-main,inherit);cursor:pointer}' +
    '.hp-modal{max-width:760px;width:min(760px,96vw);max-height:92vh;overflow:auto}.hp-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px}' +
    '.hp-form label{display:flex;flex-direction:column;gap:3px;font-size:12.5px;font-weight:600}.hp-form input,.hp-form select,.hp-a input,.hp-bar input,.hp-bar select{padding:8px 10px;border-radius:9px;border:1px solid var(--line);background:var(--surface-2,#fff);color:var(--ink);font:inherit;min-width:0}' +
    '.hp-ancho{grid-column:1/-1}.hp-h{margin:14px 0 6px;font-size:15px}.hp-acomp{display:flex;flex-direction:column;gap:6px;margin-bottom:6px}.hp-a{display:grid;grid-template-columns:2fr 1.3fr 1.3fr 32px;gap:6px;align-items:center}' +
    '.hp-msg{min-height:18px;margin:8px 0 0;font-weight:700;color:#dc2626}.hp-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.hp-bar input{flex:1;min-width:160px}' +
    '.hp-filas{display:flex;flex-direction:column;gap:6px}.hp-fila{display:flex;flex-direction:column;gap:2px;padding:9px 11px;border:1px solid var(--line);border-radius:12px;background:var(--surface)}.hp-fila[hidden]{display:none}.hp-fila span{font-size:13px}.hp-fila small{font-size:12px;color:var(--ink-soft)}.hp-aqui{color:#16a34a}' +
    '@media (max-width:640px){.hp-a{grid-template-columns:1fr 1fr 32px}.hp-a [data-a="parentesco"]{grid-column:1/3}}';
  document.head.appendChild(css);

  window.ventoHuespedes = { activo, abrirForm, abrirLista, registros, excel, pintar };
})();
