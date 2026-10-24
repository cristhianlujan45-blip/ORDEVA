/* ORDEVA · app/17-unidades-combinadas-reinicio.js — antes estaba dentro de index.html (línea 30721). Se carga en el mismo lugar y orden. */
/* ================= Unidades combinadas, reinicio seguro y auditoría =================
   COMBINAR (mesas, sillas, cabinas… según el negocio): un grupo tiene una unidad principal y unidades
   vinculadas ({id, principal, miembros}). NO se mueve nada: cada unidad conserva sus productos, sus
   pedidos y su origen; el grupo solo se muestra y se suma junto («Mesa 4 + 5 + 6», total = suma real).
   Así separar nunca pierde ni duplica nada. Al «Cobrar el grupo» los productos pasan a la principal
   marcados con su origen (it.origen) y se cobra con el flujo de siempre; el inventario no se toca
   (esos productos ya se habían descontado al pedirlos).
   REINICIAR: vacía el estado operativo de las unidades elegidas (productos, cantidades, abonos,
   nombres, pedidos activos) sin tocar inventario, catálogo, facturas, proveedores, historial,
   configuración, usuarios ni QR. Solo el administrador. Lo que se descartó queda en la auditoría
   (no se registra como venta, cobro ni devolución).
   AUDITORÍA: data.auditoria guarda quién, cuándo, qué acción y qué unidades. */
(function(){
  const esc4 = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const listo = () => typeof data !== 'undefined' && data && data.tables;
  const U = () => getServiceUnitName(), UP = () => getServiceUnitNamePlural();
  const art = () => espacio()[3] === 'm' ? 'el' : 'la', arts = () => espacio()[3] === 'm' ? 'los' : 'las';
  // ---------- Auditoría ----------
  function auditar(accion, detalle, unidades, extra){
    if(!listo()) return;
    data.auditoria = Array.isArray(data.auditoria) ? data.auditoria : [];
    data.auditoria.push(Object.assign({ t: Date.now(), usuario: (typeof authUser !== 'undefined' && authUser) || '—', accion, detalle: String(detalle || '').slice(0, 300), unidades: (unidades || []).slice(0, 60) }, extra || {}));
    if(data.auditoria.length > 1500) data.auditoria = data.auditoria.slice(-1200);
  }
  window.ventoAuditar = (a, d, u, x) => { auditar(a, d, u, x); try{ saveData(); }catch(e){} };
  const esAdmin = () => { try{ return typeof authIsAdmin !== 'function' || authIsAdmin(); }catch(e){ return true; } };
  // ---------- Grupos ----------
  const grupos = () => { if(!Array.isArray(data.grupos)) data.grupos = []; data.grupos = data.grupos.filter(g => g && Array.isArray(g.miembros) && g.miembros.filter(id => data.tables[id]).length >= 2); return data.grupos; };
  const grupoDe = id => grupos().find(g => g.miembros.includes(+id)) || null;
  const num = id => { const t = data.tables[id]; return t && t.name && t.name.trim() ? t.name.trim() : String(id); };
  function etiqueta(g){ const o = [g.principal].concat(g.miembros.filter(x => x !== g.principal)); return U() + ' ' + o.map(num).join(' + '); }
  const etiquetaDe = id => { const g = grupoDe(id); return g ? etiqueta(g) : tableLabel(id); };
  const totalGrupo = g => g.miembros.reduce((s, id) => s + tableTotal(id), 0);
  const saldoGrupo = g => g.miembros.reduce((s, id) => s + tableBalance(id), 0);
  function combinar(ids, principal){
    ids = [...new Set((ids || []).map(Number).filter(id => id > 0))];
    if(ids.length < 2) return { error: 'Elige al menos dos ' + UP().toLowerCase() + '.' };
    const faltan = ids.filter(id => !data.tables[id]); if(faltan.length) return { error: 'No existe: ' + faltan.map(id => U() + ' ' + id).join(', ') + '.' };
    // Si alguna ya está en un grupo, se suman a ese grupo (no se crean grupos que se pisen).
    const previos = [...new Set(ids.map(grupoDe).filter(Boolean))];
    let g = previos[0];
    const todos = [...new Set(ids.concat(...previos.map(x => x.miembros)))];
    if(g){ data.grupos = grupos().filter(x => !previos.includes(x) || x === g); g.miembros = todos; }
    else { g = { id: 'g' + Date.now().toString(36), principal: principal || ids[0], miembros: todos, at: Date.now(), usuario: (typeof authUser !== 'undefined' && authUser) || '' }; grupos().push(g); }
    if(principal && todos.includes(+principal)) g.principal = +principal;
    auditar('combinar', 'Se combinaron: ' + etiqueta(g) + ' (total ' + fmt(totalGrupo(g)) + ')', g.miembros);
    saveData(); try{ renderMesas(); renderCocina(); window.prepPublicar && window.prepPublicar(true); }catch(e){}
    return { grupo: g, etiqueta: etiqueta(g) };
  }
  function separar(id){
    const g = grupoDe(id); if(!g) return { error: tableLabel(id) + ' no está combinada.' };
    const et = etiqueta(g);
    data.grupos = grupos().filter(x => x !== g);
    auditar('separar', 'Se separó ' + et + '. Cada ' + U().toLowerCase() + ' conserva sus productos y pedidos.', g.miembros);
    saveData(); try{ renderMesas(); renderCocina(); window.prepPublicar && window.prepPublicar(true); }catch(e){}
    return { etiqueta: et, miembros: g.miembros };
  }
  // Cobrar el grupo: todo pasa a la principal, línea por línea y con su origen (sin sumar líneas de
  // distintas unidades), y se abre la cuenta para cobrar con el flujo normal.
  function cobrar(id){
    const g = grupoDe(id); if(!g) return null;
    const p = data.tables[g.principal]; p.items = p.items || []; p.people = p.people || []; p.payments = p.payments || [];
    p.items.forEach(it => { if(it.origen == null) it.origen = g.principal; });
    g.miembros.filter(x => x !== g.principal).forEach(mid => {
      const o = data.tables[mid]; if(!o) return;
      const mapa = {};
      (o.people || []).forEach(pe => { const n = Object.assign({}, pe, { id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: pe.name + ' (' + num(mid) + ')' }); mapa[pe.id] = n.id; p.people.push(n); });
      (o.items || []).forEach(it => p.items.push(Object.assign({}, it, { origen: it.origen != null ? it.origen : mid, personId: it.personId != null ? (mapa[it.personId] || null) : null })));
      (o.payments || []).forEach(pg => p.payments.push(Object.assign({}, pg, { personId: pg.personId != null ? (mapa[pg.personId] || null) : pg.personId, origen: mid })));
      o.items = []; o.payments = []; o.people = []; delete o.ultimaRonda;
    });
    const et = etiqueta(g);
    p.grupoCobro = { etiqueta: et, miembros: g.miembros.slice(), at: Date.now() };
    data.grupos = grupos().filter(x => x !== g);
    auditar('cobrar grupo', 'Se juntó la cuenta de ' + et + ' en ' + tableLabel(g.principal) + ' para cobrar (total ' + fmt(tableTotal(g.principal)) + '). Cada producto conserva su origen.', g.miembros);
    saveData(); try{ renderMesas(); }catch(e){}
    return g.principal;
  }
  window.vitoGrupos = { lista: grupos, de: grupoDe, etiqueta, etiquetaDe, total: totalGrupo, saldo: saldoGrupo, combinar, separar, cobrar };

  // ---------- Ventana: combinar con otras unidades ----------
  function dialogoCombinar(id){
    let ov = document.getElementById('grupoOv');
    if(!ov){ ov = document.createElement('div'); ov.id = 'grupoOv'; ov.className = 'overlay'; ov.setAttribute('data-novocab', ''); document.body.appendChild(ov); ov.addEventListener('click', e => { if(e.target === ov) ov.classList.remove('show'); }); }
    const ids = Object.keys(data.tables).map(Number).sort((a, b) => a - b).filter(x => x !== id);
    const g = grupoDe(id);
    ov.innerHTML = '<div class="modal" style="max-width:440px;max-height:90vh;overflow:auto"><h2>🔗 Combinar ' + esc4(UP().toLowerCase()) + '</h2>' +
      '<div class="modal-sub">' + esc4(tableLabel(id)) + ' será la principal. Elige con cuáles se combina: sus pedidos y cuentas se muestran como una operación conjunta, pero cada ' + esc4(U().toLowerCase()) + ' conserva lo suyo y se puede separar sin perder nada.</div>' +
      '<div class="grp-list">' + ids.map(x => { const gx = grupoDe(x), oc = (data.tables[x].items || []).length;
        return '<label><input type="checkbox" value="' + x + '"' + (g && g.miembros.includes(x) ? ' checked' : '') + '> <b>' + esc4(tableLabel(x)) + '</b> <small>' + (oc ? fmt(tableBalance(x)) : 'libre') + (gx && !(g && gx === g) ? ' · en ' + esc4(etiqueta(gx)) : '') + '</small></label>'; }).join('') + '</div>' +
      '<div class="modal-actions"><button type="button" class="btn-close" id="grpNo">Cancelar</button><button type="button" class="btn-primary" id="grpOk">Confirmar</button></div></div>';
    ov.classList.add('show');
    ov.querySelector('#grpNo').onclick = () => ov.classList.remove('show');
    ov.querySelector('#grpOk').onclick = async () => {
      const sel = [...ov.querySelectorAll('input:checked')].map(i => +i.value);
      if(!sel.length) return showToast('Elige al menos un' + (espacio()[3] === 'm' ? 'o' : 'a') + ' ' + U().toLowerCase() + '.');
      const todos = [id].concat(sel), activas = todos.filter(x => (data.tables[x].items || []).length);
      if(activas.length && !(await showConfirm({ title: 'Combinar ' + UP().toLowerCase(), message: '¿Quieres combinar ' + arts() + ' ' + UP().toLowerCase() + ' ' + todos.map(num).join(', ') + '? Sus pedidos y cuentas se mostrarán como una operación conjunta.', confirmText: 'Confirmar', cancelText: 'Cancelar', icon: '🔗' }))) return;
      const r = combinar(todos, id); ov.classList.remove('show');
      if(r.error) return showToast('⚠️ ' + r.error);
      showToast('🔗 ' + r.etiqueta + ' combinadas. Total: ' + fmt(totalGrupo(r.grupo)) + '.'); pintarBarra(id);
    };
  }
  // ---------- Barra del grupo y reinicio individual dentro de la cuenta ----------
  function pintarBarra(id){
    const box = document.getElementById('grupoBar'); if(!box) return;
    const g = grupoDe(id);
    // Combinar y reiniciar son iconos pequeños del encabezado de la mesa (antes eran botones grandes aquí).
    const bc = document.getElementById('combinarMesaBtn'), br = document.getElementById('reiniciarMesaBtn');
    if(bc){
      const tc = g ? 'Cambiar el grupo de ' + UP().toLowerCase() + ' combinad' + (espacio()[3] === 'm' ? 'os' : 'as') : 'Combinar con otr' + (espacio()[3] === 'm' ? 'os' : 'as') + ' ' + UP().toLowerCase();
      bc.title = tc; bc.setAttribute('aria-label', tc); bc.classList.toggle('on', !!g);
      bc.onclick = () => { if(currentTable != null) dialogoCombinar(currentTable); };
    }
    if(br){
      const tr = 'Reiniciar est' + (espacio()[3] === 'm' ? 'e ' : 'a ') + U().toLowerCase();
      br.title = tr; br.setAttribute('aria-label', tr); br.hidden = !esAdmin();   // solo un administrador puede reiniciar
      br.onclick = () => { if(currentTable != null) dialogoReinicio([currentTable]); };
    }
    box.innerHTML = g ? '<div class="grp-info">🔗 <b>' + esc4(etiqueta(g)) + '</b> · total ' + fmt(totalGrupo(g)) + ' · falta ' + fmt(saldoGrupo(g)) +
        '<small>' + g.miembros.map(m => esc4(num(m)) + ': ' + fmt(tableTotal(m))).join(' · ') + '</small></div>' +
      '<div class="grp-acts"><button type="button" class="btn-ghost" data-g="cobrar">💵 Cobrar el grupo</button><button type="button" class="btn-ghost" data-g="separar">✂️ Separar</button></div>' : '';
    box.onclick = async e => {
      const b = e.target.closest('[data-g]'); if(!b) return; const a = b.dataset.g;
      if(a === 'combinar') dialogoCombinar(id);
      if(a === 'separar'){ const r = separar(id); showToast(r.error ? '⚠️ ' + r.error : '✂️ Separé ' + r.etiqueta + '. Cada ' + U().toLowerCase() + ' conserva sus productos y pedidos.'); pintarBarra(id); }
      if(a === 'cobrar'){ const g2 = grupoDe(id); if(!(await showConfirm({ title: 'Cobrar el grupo', message: 'Se junta la cuenta de ' + etiqueta(g2) + ' (' + fmt(saldoGrupo(g2)) + ' por pagar) en ' + tableLabel(g2.principal) + ' para cobrarla. Cada producto conserva de qué ' + U().toLowerCase() + ' vino. No se cobra nada todavía.', confirmText: 'Juntar y cobrar', icon: '💵' }))) return;
        const pid = cobrar(id); if(pid != null){ openTableModal(pid); showToast('💵 Cuenta del grupo lista en ' + tableLabel(pid) + ': cóbrala como siempre.'); } }
      if(a === 'reiniciar') dialogoReinicio([id]);
    };
  }
  window.grupoBarPintar = pintarBarra;

  // ---------- Reinicio seguro ----------
  function estadoUnidad(id){
    const t = data.tables[id] || {}, its = t.items || [];
    const P = window.vitoPedidos ? window.vitoPedidos.lista().filter(p => p.mesa === id && ['nuevo', 'recibido', 'preparacion', 'listo'].includes(p.estado)) : [];
    return { items: its.length, total: tableTotal(id), saldo: tableBalance(id), abonado: tablePaid(id), pedidos: P.filter(p => p.estado === 'nuevo' || p.estado === 'recibido').length, prep: P.filter(p => p.estado === 'preparacion' || p.estado === 'listo').length, grupo: grupoDe(id), nombre: t.name };
  }
  function reiniciar(ids){
    if(!esAdmin()) return { error: 'Solo un administrador puede reiniciar ' + UP().toLowerCase() + '.' };
    const snap = [];
    ids.forEach(id => {
      const t = data.tables[id]; if(!t) return;
      const e = estadoUnidad(id);
      snap.push({ id, nombre: t.name || null, items: (t.items || []).map(i => ({ n: i.name, q: i.qty, p: i.price })), total: e.total, abonado: e.abonado, saldo: e.saldo });
      t.items = []; t.people = []; t.payments = []; t.name = null; delete t.ultimaRonda; delete t.grupoCobro;
      if(window.vitoPedidos) window.vitoPedidos.lista().filter(p => p.mesa === id && ['nuevo', 'recibido', 'preparacion', 'listo'].includes(p.estado)).forEach(p => { p.estado = 'cancelado'; p.hist.push({ e: 'cancelado', at: Date.now(), nota: 'reinicio' }); });
      const g = grupoDe(id); if(g){ g.miembros = g.miembros.filter(x => x !== id); if(g.principal === id) g.principal = g.miembros[0]; }
    });
    grupos();
    try{ const ack = JSON.parse(localStorage.getItem('vito_kds_ack') || '{}'); ids.forEach(id => delete ack[id]); localStorage.setItem('vito_kds_ack', JSON.stringify(ack)); }catch(e){}
    auditar('reiniciar', 'Reinicio de ' + (ids.length === Object.keys(data.tables).length ? 'todas ' + arts() + ' ' + UP().toLowerCase() : ids.map(id => U() + ' ' + id).join(', ')) + '. Se descartó: ' + (snap.filter(x => x.items.length).map(x => U() + ' ' + x.id + ' (' + fmt(x.total) + ')').join(', ') || 'nada'), ids, { descartado: snap.filter(x => x.items.length || x.nombre) });
    saveData(); try{ renderMesas(); renderCocina(); window.prepPublicar && window.prepPublicar(true); if(window.vitoCheckNotif) window.vitoCheckNotif(); }catch(e){}
    return { ok: true, n: ids.length };
  }
  async function dialogoReinicio(pre){
    if(!esAdmin()){ showToast('🔒 Solo un administrador puede reiniciar ' + UP().toLowerCase() + '.'); auditar('reinicio denegado', 'Intento sin permiso', pre || []); saveData(); return; }
    let ov = document.getElementById('reinicioOv');
    if(!ov){ ov = document.createElement('div'); ov.id = 'reinicioOv'; ov.className = 'overlay'; ov.setAttribute('data-novocab', ''); document.body.appendChild(ov); ov.addEventListener('click', e => { if(e.target === ov) ov.classList.remove('show'); }); }
    const ids = Object.keys(data.tables).map(Number).sort((a, b) => a - b), sel = new Set(pre && pre.length ? pre : ids);
    const pintar = () => {
      ov.innerHTML = '<div class="modal" style="max-width:460px;max-height:92vh;overflow:auto"><h2>♻️ Reiniciar ' + esc4(UP().toLowerCase()) + '</h2>' +
        '<div class="mov-modo"><button type="button" data-s="todas">Todas</button><button type="button" data-s="ninguna">Ninguna</button></div>' +
        '<div class="grp-list">' + ids.map(id => { const e = estadoUnidad(id);
          return '<label><input type="checkbox" value="' + id + '"' + (sel.has(id) ? ' checked' : '') + '> <b>' + esc4(tableLabel(id)) + '</b> <small>' + (e.items ? fmt(e.saldo) + ' por cobrar' : 'libre') + (e.pedidos ? ' · ' + e.pedidos + ' pedido(s) pendiente(s)' : '') + (e.prep ? ' · ' + e.prep + ' en preparación' : '') + (e.grupo ? ' · 🔗 ' + esc4(etiqueta(e.grupo)) : '') + '</small></label>'; }).join('') + '</div>' +
        '<div class="rst-info"><b>Se borra del estado actual:</b> pedidos activos, productos anotados, cantidades, totales, abonos, nombres puestos y combinaciones de ' + esc4(arts() + ' ' + UP().toLowerCase()) + ' elegid' + (espacio()[3] === 'm' ? 'os' : 'as') + '.<br><b>NO se borra:</b> inventario, productos, proveedores, facturas, historial y contabilidad, configuración, usuarios ni los QR. No se registra como venta, cobro ni devolución; lo descartado queda en la auditoría.</div>' +
        '<div class="modal-actions"><button type="button" class="btn-close" id="rstNo">Cancelar</button><button type="button" class="btn-danger-outline" id="rstOk">Sí, reiniciar</button></div></div>';
      ov.querySelectorAll('input[type=checkbox]').forEach(i => i.onchange = () => { if(i.checked) sel.add(+i.value); else sel.delete(+i.value); });
      ov.querySelector('[data-s="todas"]').onclick = () => { ids.forEach(i => sel.add(i)); pintar(); };
      ov.querySelector('[data-s="ninguna"]').onclick = () => { sel.clear(); pintar(); };
      ov.querySelector('#rstNo').onclick = () => { ov.classList.remove('show'); };
      ov.querySelector('#rstOk').onclick = async () => {
        const el = [...sel]; if(!el.length) return showToast('Elige al menos un' + (espacio()[3] === 'm' ? 'o' : 'a') + ' ' + U().toLowerCase() + '.');
        const av = [];
        el.forEach(id => { const e = estadoUnidad(id); if(e.saldo > 0) av.push(tableLabel(id) + ': ' + fmt(e.saldo) + ' sin pagar'); if(e.abonado > 0) av.push(tableLabel(id) + ': ya abonó ' + fmt(e.abonado)); if(e.pedidos) av.push(tableLabel(id) + ': ' + e.pedidos + ' pedido(s) pendiente(s)'); if(e.prep) av.push(tableLabel(id) + ': ' + e.prep + ' pedido(s) en ' + prepNombre()); });
        ov.classList.remove('show');
        if(av.length && !(await showConfirm({ title: '⚠️ Hay operaciones activas', message: 'Si reinicias, esto se descarta (no se cobra ni se registra como venta):\n• ' + av.slice(0, 10).join('\n• ') + (av.length > 10 ? '\n• …y ' + (av.length - 10) + ' más' : '') + '\n\n¿Reiniciar de todas formas?', confirmText: 'Sí, reiniciar', cancelText: 'Cancelar', icon: '♻️' }))) { auditar('reinicio cancelado', 'Se canceló al ver operaciones activas', el); saveData(); return; }
        const r = reiniciar(el);
        showToast(r.error ? '🔒 ' + r.error : '♻️ Listo: ' + r.n + ' ' + (r.n === 1 ? U() : UP()).toLowerCase() + ' reiniciad' + (espacio()[3] === 'm' ? 'o' : 'a') + (r.n === 1 ? '' : 's') + '. Inventario, facturas e historial intactos.');
      };
    };
    pintar(); ov.classList.add('show');
  }
  window.vitoReinicio = { abrir: dialogoReinicio, reiniciar, estado: estadoUnidad };

  // ---------- Botón «Reiniciar [unidades]» en la pantalla principal ----------
  function botonInicio(){
    let b = document.getElementById('resetUnitsBtn');
    const fila = document.getElementById('tableCountToggle'); if(!fila) return;
    if(!b){ b = document.createElement('button'); b.type = 'button'; b.className = 'btn-ghost'; b.id = 'resetUnitsBtn'; b.setAttribute('data-novocab', ''); fila.parentNode.insertBefore(b, fila.nextSibling); b.onclick = () => dialogoReinicio(); }
    b.textContent = '♻️ Reiniciar ' + UP().toLowerCase();
  }
  window.vitoReinicioBoton = botonInicio;
  setTimeout(botonInicio, 1500); setInterval(botonInicio, 10000);
  const st = document.createElement('style');
  st.textContent = '.grp-list{display:flex;flex-direction:column;gap:6px;margin:10px 0}.grp-list label{display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:10px;padding:8px 10px;min-width:0}.grp-list small{color:var(--ink-soft);margin-left:auto;text-align:right}' +
    '#grupoBar{margin:4px 0 8px}.grp-info{border:1px solid var(--amber);border-radius:10px;padding:8px 10px;margin-bottom:6px;font-size:14px}.grp-info small{display:block;color:var(--ink-soft);font-size:12px;margin-top:3px}.grp-acts{display:flex;flex-wrap:wrap;gap:6px}.grp-acts button{padding:7px 10px;font-size:13px}' +
    '.rst-info{font-size:13px;line-height:1.45;border:1px solid var(--line);border-radius:10px;padding:10px;margin:8px 0;background:var(--surface)}.ticket .grp-tag{font-size:11.5px;color:var(--amber);font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}';
  document.head.appendChild(st);
})();
