/* ORDEVA · app/20-contabilidad-recibos-adjuntos.js — antes estaba dentro de index.html (línea 31556). Se carga en el mismo lugar y orden. */
/* ================= Contabilidad: recibos adjuntos y servicios públicos con recordatorio =================
   • Cada gasto o ingreso puede llevar la foto (o el PDF) del recibo o factura. Se guarda en el propio
     celular, en una base aparte (IndexedDB), para no llenar la memoria de la app.
   • Servicios públicos y pagos fijos (luz, agua, gas, internet, arriendo…): se anota cada cuánto se
     pagan y la próxima fecha. ORDEVA avisa unos días antes (y el día que vence), con voz. Al tocar
     «Pagar» queda como gasto en Contabilidad, con su recibo, y la fecha salta al siguiente periodo. */
(function(){
  const $s = id => document.getElementById(id);
  const esc3 = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plata = n => fmt(Math.round(n || 0));
  const hoyStr = () => ctDia(Date.now());
  const diasHasta = f => Math.round((new Date(f + 'T00:00') - new Date(hoyStr() + 'T00:00')) / 864e5);
  const fechaBonita = f => new Date(f + 'T12:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });

  // ---------- Recibos (IndexedDB aparte) ----------
  let dbP = null;
  const db = () => dbP || (dbP = new Promise((res, rej) => { const r = indexedDB.open('vento-recibos', 1); r.onupgradeneeded = () => r.result.createObjectStore('recibos'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
  const tx = async (modo, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction('recibos', modo), rq = fn(t.objectStore('recibos')); t.oncomplete = () => res(rq && rq.result); t.onerror = () => rej(t.error); }); };
  // También en la nube (clave «rec/<id>»): facturas escaneadas, sus fotos originales y los recibos de gastos se ven
  // en todos los equipos de la cuenta. El texto detectado («-ocr») no se sube: cada equipo lo saca si lo necesita.
  const nubeRec = id => !/-(ocr|o)$/.test(String(id)) && window.ventoNube && window.ventoNube.enNube && window.ventoNube.enNube() && window.ventoNube.archivos;
  window.ctReciboGuardar = (id, url) => { const n = nubeRec(id); if(n) n.subir('rec/' + id, url); return tx('readwrite', st => st.put(url, id)).catch(() => showToast('⚠️ No se pudo guardar el recibo en este celular.')); };
  window.ctReciboBorrar = id => { const n = nubeRec(id); if(n) n.borrar('rec/' + id); return tx('readwrite', st => st.delete(id)).catch(() => {}); };
  const leerAqui = id => tx('readonly', st => st.get(id));
  const leer = async id => {
    let v = null; try{ v = await leerAqui(id); }catch(e){}
    if(v) return v;
    const n = nubeRec(id); if(!n) return v;
    const u = await n.bajar('rec/' + id);
    if(u){ try{ await tx('readwrite', st => st.put(u, id)); }catch(e){} }
    return u || v;
  };
  window.ctReciboLeer = leer;
  // Foto o PDF → imagen liviana (la primera página del PDF)
  async function aImagen(f){
    let file = f;
    const esPdf = (window.VitoOfflineOCR && window.VitoOfflineOCR.isPdfFile && window.VitoOfflineOCR.isPdfFile(f)) || /\.pdf$/i.test(f.name || '');
    if(esPdf){
      if(!(window.VitoOfflineOCR && window.VitoOfflineOCR.expandFilesWithPdfPages)) throw new Error('pdf');
      const pags = await window.VitoOfflineOCR.expandFilesWithPdfPages([f]); if(!pags.length) throw new Error('pdf'); file = pags[0];
    }
    return scalePhotoForAI(file, 1200, 0.6);
  }
  window.ctVerRecibo = async (id, titulo) => {
    let url = null; try{ url = await leer(id); }catch(e){}
    if(!url){ showToast('No encontré el recibo en este celular (se guarda solo en el equipo donde lo adjuntaste).'); return; }
    let ov = $s('ctRecOv');
    if(!ov){ ov = document.createElement('div'); ov.id = 'ctRecOv'; ov.className = 'overlay'; ov.innerHTML = '<div class="modal" style="max-width:520px"><h2 id="ctRecT"></h2><img id="ctRecImg" alt="Recibo" style="width:100%;border-radius:10px;background:#fff"><div class="modal-actions"><a class="btn-ghost" id="ctRecDl" download="recibo.jpg" style="text-align:center;text-decoration:none">⬇️ Descargar</a><button class="btn-primary" type="button" id="ctRecX">Cerrar</button></div></div>'; document.body.appendChild(ov); $s('ctRecX').onclick = () => ov.classList.remove('show'); ov.addEventListener('click', e => { if(e.target === ov) ov.classList.remove('show'); }); }
    $s('ctRecT').textContent = '📎 ' + (titulo || 'Recibo'); $s('ctRecImg').src = url; $s('ctRecDl').href = url;
    ov.classList.add('show');
  };
  function engancharAdjunto(btnId, inputId, alListo){
    const b = $s(btnId), inp = $s(inputId); if(!b || !inp) return;
    b.onclick = () => inp.click();
    inp.onchange = async e => {
      const f = e.target.files[0]; e.target.value = ''; if(!f) return;
      const txt = b.textContent; b.textContent = '⏳ Leyendo…'; b.disabled = true;
      try{ const url = await aImagen(f); alListo(url); b.textContent = '✅ Recibo listo (toca para cambiar)'; }
      catch(err){ b.textContent = txt; showToast('⚠️ No pude leer ese archivo. Sube una foto o un PDF.'); }
      b.disabled = false;
    };
  }

  // ---------- Servicios públicos y pagos fijos ----------
  const TIPOS = [
    ['luz', '💡', 'Luz', 'servicios'], ['agua', '💧', 'Agua', 'servicios'], ['gas', '🔥', 'Gas', 'servicios'], ['internet', '🌐', 'Internet / TV', 'servicios'],
    ['celular', '📱', 'Celular', 'servicios'], ['arriendo', '🏠', 'Arriendo', 'arriendo'], ['admin', '🏢', 'Administración', 'arriendo'],
    ['seguridad', '🩺', 'Salud, pensión y ARL', 'seguridad_social'], ['impuesto', '🏛️', 'Impuesto / Industria y comercio', 'impuestos'], ['otro', '🧾', 'Otro pago fijo', 'otros']
  ];
  const SRV = () => (data.servicios = Array.isArray(data.servicios) ? data.servicios : []);
  const sumarMeses = (f, n) => { const d = new Date(f + 'T12:00'), dia = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(dia, fin)); return ctDia(d); };
  const estado = s => { const d = diasHasta(s.proximo); return d < 0 ? { c: 'venc', t: 'Venció hace ' + (-d) + (d === -1 ? ' día' : ' días') } : d === 0 ? { c: 'hoy', t: 'Vence HOY' } : d === 1 ? { c: 'pronto', t: 'Vence mañana' } : d <= (s.aviso || 3) ? { c: 'pronto', t: 'Vence en ' + d + ' días' } : { c: 'ok', t: 'Vence en ' + d + ' días' }; };

  function crearUI(){
    const vista = $s('view-contabilidad'); if(!vista || $s('srvGrupo')) return;
    const ref = vista.querySelector('.settings-group');
    const g = document.createElement('div'); g.className = 'settings-group'; g.id = 'srvGrupo';
    g.innerHTML = '<h2>🔔 Servicios públicos y pagos fijos</h2><div class="settings-desc">Anota cuándo vence cada recibo y ORDEVA te avisa antes (y el mismo día). Al pagarlo, toca <b>Pagar</b>: queda como gasto con la foto del recibo y la fecha pasa sola al próximo mes.</div>' +
      '<div class="srv-chips" id="srvChips">' + TIPOS.map(t => '<button type="button" class="srv-chip" data-t="' + t[0] + '">' + t[1] + ' ' + t[2] + '</button>').join('') + '</div>' +
      '<div id="srvLista"></div>' +
      '<button type="button" class="btn-ghost" id="srvNotif" style="margin-top:8px">🔔 Avisarme también con notificación del celular</button>';
    ref.parentNode.insertBefore(g, ref.nextSibling);
    $s('srvChips').onclick = e => { const b = e.target.closest('[data-t]'); if(b) editar(null, b.dataset.t); };
    $s('srvNotif').onclick = async () => {
      if(!('Notification' in window)){ showToast('Este navegador no permite notificaciones. Igual te aviso aquí adentro, con voz.'); return; }
      const r = await Notification.requestPermission();
      showToast(r === 'granted' ? '✅ Listo: te llega una notificación cuando un recibo esté por vencer.' : 'No diste permiso. Igual te aviso aquí adentro, con voz.');
    };
    pintar();
    engancharAdjunto('ctAdjBtn', 'ctAdj', url => { window.ctAdjPendiente = url; });
  }
  function pintar(){
    const L = $s('srvLista'); if(!L) return;
    const l = SRV().slice().sort((a, b) => a.proximo.localeCompare(b.proximo));
    L.innerHTML = l.length ? l.map(s => { const e = estado(s); return '<div class="srv-fila ' + e.c + '"><span class="srv-ic">' + s.icono + '</span><span class="srv-tx"><b>' + esc3(s.nombre) + (s.empresa ? ' · ' + esc3(s.empresa) : '') + '</b><small>' + e.t + ' · ' + fechaBonita(s.proximo) + (s.valor ? ' · aprox. ' + plata(s.valor) : '') + (s.ultimoPago ? ' · último: ' + plata(s.ultimoPago.monto) : '') + '</small></span><span class="srv-bt"><button type="button" class="btn-primary" data-pagar="' + s.id + '">Pagar</button><button type="button" class="btn-ghost" data-edit="' + s.id + '" title="Editar">✏️</button></span></div>'; }).join('')
      : '<div class="empty-note">Toca un servicio de arriba para agregarlo (ej. 💡 Luz) con su fecha de pago.</div>';
    L.onclick = e => { const p = e.target.closest('[data-pagar]'), ed = e.target.closest('[data-edit]'); if(p) pagar(p.dataset.pagar); else if(ed) editar(ed.dataset.edit); };
  }
  function modal(id, html){
    let ov = $s(id);
    if(!ov){ ov = document.createElement('div'); ov.id = id; ov.className = 'overlay'; document.body.appendChild(ov); ov.addEventListener('click', e => { if(e.target === ov) ov.classList.remove('show'); }); }
    ov.innerHTML = '<div class="modal" style="max-width:420px">' + html + '</div>'; ov.classList.add('show'); return ov;
  }
  function editar(id, tipo){
    const s = id ? SRV().find(x => x.id === id) : null, t = TIPOS.find(x => x[0] === (s ? s.tipo : tipo)) || TIPOS[TIPOS.length - 1];
    const ov = modal('srvEdOv', '<h2>' + t[1] + ' ' + (s ? 'Editar ' : '') + esc3(s ? s.nombre : t[2]) + '</h2>' +
      '<label>Nombre</label><input id="srvNom" class="mz-in" style="width:100%" maxlength="40" value="' + esc3(s ? s.nombre : t[2]) + '">' +
      '<label>Empresa (opcional)</label><input id="srvEmp" class="mz-in" style="width:100%" maxlength="40" placeholder="Ej. Enel, EPM, Vanti, Claro" value="' + esc3(s ? s.empresa || '' : '') + '">' +
      '<label>Valor aproximado (opcional)</label><input id="srvVal" class="mz-in" style="width:100%" type="number" inputmode="numeric" min="0" step="100" value="' + (s && s.valor ? s.valor : '') + '">' +
      '<label>Próxima fecha de pago</label><input id="srvFec" class="mz-in" style="width:100%" type="date" value="' + (s ? s.proximo : sumarMeses(hoyStr(), 0)) + '">' +
      '<label>Se paga cada</label><select id="srvCada" class="mz-in" style="width:100%">' + [[1, 'Mes'], [2, '2 meses'], [3, '3 meses'], [6, '6 meses'], [12, 'Año']].map(o => '<option value="' + o[0] + '"' + ((s ? s.cada : 1) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>' +
      '<label>Avisarme</label><select id="srvAviso" class="mz-in" style="width:100%">' + [[1, '1 día antes'], [3, '3 días antes'], [5, '5 días antes'], [7, '1 semana antes']].map(o => '<option value="' + o[0] + '"' + ((s ? s.aviso : 3) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>' +
      '<div class="modal-actions">' + (s ? '<button class="btn-close" type="button" id="srvDel">🗑 Quitar</button>' : '<button class="btn-close" type="button" id="srvNo">Cancelar</button>') + '<button class="btn-primary" type="button" id="srvOk">Guardar</button></div>');
    if($s('srvNo')) $s('srvNo').onclick = () => ov.classList.remove('show');
    if($s('srvDel')) $s('srvDel').onclick = async () => { const ok = await showConfirm({ title: '¿Quitar ' + s.nombre + '?', message: 'Ya no te recordaré este pago. Los pagos que ya anotaste quedan en Contabilidad.', confirmText: 'Sí, quitar', icon: '🗑️' }); if(!ok) return; data.servicios = SRV().filter(x => x.id !== s.id); saveData(); ov.classList.remove('show'); pintar(); };
    $s('srvOk').onclick = () => {
      const nombre = $s('srvNom').value.trim(), fecha = $s('srvFec').value;
      if(!nombre || !fecha){ showToast('⚠️ Escribe el nombre y la fecha de pago.'); return; }
      const x = s || { id: 'srv' + Date.now().toString(36), tipo: t[0], icono: t[1], cat: t[3] };
      Object.assign(x, { nombre, empresa: $s('srvEmp').value.trim(), valor: Math.round(Number($s('srvVal').value) || 0) || null, proximo: fecha, cada: Number($s('srvCada').value) || 1, aviso: Number($s('srvAviso').value) || 3 });
      if(!s) SRV().push(x);
      saveData(); ov.classList.remove('show'); pintar(); revisar(true);
      showToast('✅ ' + nombre + ': te aviso ' + (x.aviso === 1 ? 'un día' : x.aviso + ' días') + ' antes del ' + fechaBonita(x.proximo) + '.');
    };
  }
  function pagar(id){
    const s = SRV().find(x => x.id === id); if(!s) return;
    let adj = null;
    const ov = modal('srvPagOv', '<h2>✅ Pagar ' + s.icono + ' ' + esc3(s.nombre) + '</h2><div class="modal-sub">Periodo que vencía el ' + fechaBonita(s.proximo) + '.</div>' +
      '<label>Valor pagado</label><input id="srvPVal" class="mz-in" style="width:100%" type="number" inputmode="numeric" min="0" step="100" value="' + ((s.ultimoPago && s.ultimoPago.monto) || s.valor || '') + '">' +
      '<label>Fecha del pago</label><input id="srvPFec" class="mz-in" style="width:100%" type="date" value="' + hoyStr() + '">' +
      '<label>Cómo lo pagaste</label><select id="srvPMet" class="mz-in" style="width:100%">' + Object.keys(CT_METODOS).filter(k => k !== 'debe' && k !== 'otro').map(k => '<option value="' + k + '">' + CT_METODOS[k] + '</option>').join('') + '</select>' +
      '<button type="button" class="btn-ghost" id="srvPAdjBtn" style="width:100%;margin-top:10px">📎 Adjuntar el recibo pagado (foto o PDF)</button><input type="file" id="srvPAdj" accept="image/*,application/pdf" hidden>' +
      '<div class="modal-actions"><button class="btn-close" type="button" id="srvPNo">Cancelar</button><button class="btn-primary" type="button" id="srvPOk">Guardar pago</button></div>');
    engancharAdjunto('srvPAdjBtn', 'srvPAdj', url => { adj = url; });
    $s('srvPNo').onclick = () => ov.classList.remove('show');
    $s('srvPOk').onclick = () => {
      const monto = Math.round(Number($s('srvPVal').value));
      if(!(monto > 0)){ showToast('⚠️ Escribe cuánto pagaste.'); return; }
      const fecha = $s('srvPFec').value || hoyStr(), gid = 'ct' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      data.contab = Array.isArray(data.contab) ? data.contab : [];
      data.contab.unshift({ id: gid, adj: !!adj, tipo: 'gasto', cat: s.cat, monto, fecha, metodo: $s('srvPMet').value, nota: 'Recibo de ' + s.nombre + (s.empresa ? ' (' + s.empresa + ')' : '') + ' · vencía ' + fechaBonita(s.proximo), srv: s.id });
      if(adj) window.ctReciboGuardar(gid, adj);
      s.ultimoPago = { fecha, monto }; s.proximo = sumarMeses(s.proximo, s.cada || 1);
      saveData(); ov.classList.remove('show'); pintar(); try{ renderConta(); }catch(e){}
      showToast('✅ Pago de ' + s.nombre + ' por ' + plata(monto) + ' guardado en Contabilidad. Próximo: ' + fechaBonita(s.proximo) + '.', 7000);
    };
  }

  // ---------- Recordatorios ----------
  function revisar(silencioso){
    if(typeof data === 'undefined' || !data) return;
    const hoy = hoyStr(), pend = SRV().filter(s => diasHasta(s.proximo) <= (s.aviso || 3));
    let avisados = {}; try{ avisados = JSON.parse(localStorage.getItem('vento_srv_avisos') || '{}'); }catch(e){}
    const nuevos = pend.filter(s => avisados[s.id] !== hoy);
    if(!nuevos.length || silencioso) return;
    nuevos.forEach(s => { avisados[s.id] = hoy; });
    try{ localStorage.setItem('vento_srv_avisos', JSON.stringify(avisados)); }catch(e){}
    const frase = nuevos.map(s => s.nombre + ': ' + estado(s).t.toLowerCase() + (s.valor ? ' (aprox. ' + plata(s.valor) + ')' : '')).join(' · ');
    try{ showToast('🔔 Recordatorio de pagos · ' + frase, 12000); }catch(e){}
    try{ speakVoice('Recuerda pagar: ' + nuevos.map(s => s.nombre + ', ' + estado(s).t.toLowerCase()).join('. ')); }catch(e){}
    try{ if('Notification' in window && Notification.permission === 'granted') new Notification('🔔 Pagos por vencer', { body: frase, tag: 'vento-servicios' }); }catch(e){}
  }
  window.ventoServiciosRevisar = revisar;

  const st = document.createElement('style');
  st.textContent = '.srv-chips{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}.srv-chip{border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:999px;padding:7px 12px;font:inherit;font-size:13.5px;cursor:pointer}.srv-chip:hover{border-color:var(--amber)}' +
    '.srv-fila{display:flex;align-items:center;gap:10px;padding:10px;border:1px solid var(--line);border-left-width:5px;border-radius:12px;margin:8px 0;background:var(--surface)}.srv-fila.venc,.srv-fila.hoy{border-left-color:#e5484d}.srv-fila.pronto{border-left-color:#f5a524}.srv-fila.ok{border-left-color:#30a46c}' +
    '.srv-ic{font-size:24px}.srv-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.srv-tx small{color:var(--ink-soft);font-size:12.5px;overflow-wrap:anywhere}.srv-fila.venc small,.srv-fila.hoy small{color:#e5484d;font-weight:700}.srv-bt{display:flex;gap:6px;flex-shrink:0}.srv-bt .btn-primary{padding:8px 14px}';
  document.head.appendChild(st);
  const arr = setInterval(() => { if(typeof data !== 'undefined' && data && $s('view-contabilidad')){ clearInterval(arr); crearUI(); setTimeout(() => revisar(false), 8000); } }, 700);
  setInterval(() => revisar(false), 60 * 6e4);
  document.addEventListener('visibilitychange', () => { if(!document.hidden) revisar(false); });
  const nb = document.querySelector('nav button[data-view="contabilidad"]'); if(nb) nb.addEventListener('click', pintar);
  document.addEventListener('click', e => { if(e.target.closest('[data-go="contabilidad"]')) setTimeout(pintar, 50); });
})();
