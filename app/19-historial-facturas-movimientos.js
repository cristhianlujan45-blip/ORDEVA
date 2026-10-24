/* ORDEVA · app/19-historial-facturas-movimientos.js — antes estaba dentro de index.html (línea 31441). Se carga en el mismo lugar y orden. */
/* ================= Historial de facturas, movimientos de inventario y ORDEVA IA (Ajustes) =================
   Usa lo que ya existe: cada factura aplicada queda en data.purchases (con su encabezado, sus renglones,
   quién la confirmó, qué se cambió y la foto original guardada en el celular con ctReciboGuardar), y cada
   entrada al inventario en data.inventarioMov. Aquí solo se consultan. */
(function(){
  const $h = id => document.getElementById(id);
  const e = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fecha = f => { if(!f) return '—'; const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(f) ? f + 'T12:00' : f); return isNaN(d) ? String(f) : d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }); };
  function ventana(id, titulo, html){
    let ov = $h(id);
    if(!ov){ ov = document.createElement('div'); ov.id = id; ov.className = 'overlay'; ov.innerHTML = '<div class="modal fi-hist"><h2></h2><div class="fi-hist-c"></div><div class="modal-actions"><button type="button" class="btn-close">Cerrar</button></div></div>';
      document.body.appendChild(ov); ov.querySelector('.btn-close').onclick = () => ov.classList.remove('show'); ov.addEventListener('click', ev => { if(ev.target === ov) ov.classList.remove('show'); }); }
    ov.querySelector('h2').textContent = titulo; ov.querySelector('.fi-hist-c').innerHTML = html; ov.classList.add('show');
    return ov;
  }
  function lista(q){
    const t = String(q || '').toLowerCase();
    const ps = (data.purchases || []).filter(p => !t || [p.supplier, p.invoiceNumber, p.date].concat((p.items || []).map(i => i.name + ' ' + (i.originalDescription || ''))).join(' ').toLowerCase().includes(t));
    return ps.length ? ps.map(p => '<button type="button" class="fi-hrow" data-id="' + e(p.id) + '"><span><b>' + e(p.supplier || 'Proveedor sin nombre') + '</b>' +
      '<small>' + (p.invoiceNumber ? 'Factura ' + e(p.invoiceNumber) + ' · ' : '') + fecha(p.date || p.at) + ' · ' + (p.items || []).length + ' producto(s)' + ((p.archivoId || (p.escaneos || []).length) ? ' · 📎' : '') + '</small></span><b>' + fmt(Math.round(p.total || 0)) + '</b></button>').join('')
      : '<div class="empty-state">' + (t ? 'Ninguna factura coincide.' : 'Todavía no hay facturas aplicadas.') + '</div>';
  }
  function abrirHist(){
    const ov = ventana('fiHistOv', '📚 Facturas anteriores', '<input type="search" class="fi-hbus" placeholder="🔎 Proveedor, número o producto" autocomplete="off"><div class="fi-hlista">' + lista('') + '</div>');
    const bus = ov.querySelector('.fi-hbus'), cont = ov.querySelector('.fi-hlista');
    let tt = null; bus.oninput = () => { clearTimeout(tt); tt = setTimeout(() => { cont.innerHTML = lista(bus.value); }, 200); };
    cont.onclick = ev => { const b = ev.target.closest('.fi-hrow'); if(b) detalle(b.dataset.id); };
  }
  function detalle(id){
    const p = (data.purchases || []).find(x => x.id === id); if(!p) return;
    const h = p.header || {};
    const filas = (typeof FI_CAMPOS !== 'undefined' ? FI_CAMPOS : []).filter(([k]) => (k === 'supplier' ? p.supplier : h[k]) != null && (k === 'supplier' ? p.supplier : h[k]) !== '')
      .map(([k, lab]) => '<div><span>' + lab + '</span><b>' + e(k === 'supplier' ? p.supplier : (typeof h[k] === 'number' ? fmt(h[k]) : h[k])) + '</b></div>').join('');
    const items = (p.items || []).map(i => '<tr><td>' + e(i.name) + (i.originalDescription && i.originalDescription !== i.name ? '<small>🧾 ' + e(i.originalDescription) + '</small>' : '') +
      (i.presentation ? '<small>' + e(i.presentation) + '</small>' : '') + (i.modificado ? '<small>✏️ corregido a mano</small>' : '') + '</td><td>' + i.qty + '</td><td>' + (i.costoUnitSinIva != null ? fmt(Math.round(i.costoUnitSinIva)) : '—') + '</td><td>' + (i.ivaUnit != null ? fmt(Math.round(i.ivaUnit)) : '—') + '</td><td>' + fmt(Math.round(i.cost || 0)) + '</td><td>' + fmt(Math.round(i.total || (i.qty || 0) * (i.cost || 0))) + '</td></tr>').join('');
    const ov = ventana('fiDetOv', '🧾 ' + (p.supplier || 'Factura') + (p.invoiceNumber ? ' · ' + p.invoiceNumber : ''),
      '<div class="fi-dgrid">' + filas + '<div><span>Procesada</span><b>' + e(new Date(p.procesadaEn || p.at).toLocaleString('es-CO')) + '</b></div>' +
      (p.usuario ? '<div><span>Confirmó</span><b>' + e(p.usuario) + '</b></div>' : '') + '<div><span>Leída con</span><b>' + (p.fuente === 'ocr' ? 'lector sin internet' : 'IA') + '</b></div></div>' +
      (p.avisos && p.avisos.length ? '<div class="iv-avisos"><b>Avisos al guardarla</b><ul>' + p.avisos.map(a => '<li>' + e(a) + '</li>').join('') + '</ul></div>' : '') +
      '<div class="margin-table-wrap"><table class="margin-table"><thead><tr><th>Producto</th><th>Cant.</th><th>Sin IVA/u</th><th>IVA/u</th><th>Con IVA/u</th><th>Total</th></tr></thead><tbody>' + items + '</tbody></table></div>' +
      '<div class="fi-dtot">' + (p.subtotal ? 'Subtotal ' + fmt(Math.round(p.subtotal)) + ' · IVA ' + fmt(Math.round(p.ivaTotal || 0)) + ' · ' : '') + 'Total: <b>' + fmt(Math.round(p.total || 0)) + '</b></div>' +
      ((p.archivoId || (p.escaneos || []).length)
        ? '<div class="fi-desc"><div class="fi-desc-prev"><img class="fi-desc-img" alt="Factura escaneada"><span class="fi-desc-msg">Cargando la factura escaneada…</span></div>' +
          '<button type="button" class="btn-primary fi-dl-pdf">📄 Descargar escaneada (PDF HD con el texto)</button>' +
          '<button type="button" class="btn-ghost fi-dl-jpg">🖼️ Descargar imagen HD (JPG)</button>' +
          '<button type="button" class="btn-ghost fi-esq-btn">✂️ Corregir el recorte (esquinas)</button><div class="fi-esq-pags" hidden></div>' +
          '<button type="button" class="btn-ghost fi-girar-btn">↻ Girar la página</button><div class="fi-girar-pags" hidden></div>' +
          (p.archivoId ? '<button type="button" class="btn-ghost fi-verorig">📎 Ver la foto original</button>' : '') +
          '<div class="settings-desc">Escaneada como en un escáner: recortada, enderezada, con el texto alineado y en Full HD. El PDF trae el texto de la factura (se puede buscar y copiar) y una hoja con los datos leídos.</div></div>'
        : '<div class="settings-desc">La foto de esta factura no quedó guardada en este equipo (se guarda en el celular donde se escaneó). Igual puedes descargar sus datos.</div><button type="button" class="btn-ghost fi-dl-pdf">📄 Descargar los datos (PDF)</button>'));
    const b = ov.querySelector('.fi-verorig'); if(b) b.onclick = () => window.ctVerRecibo && window.ctVerRecibo(p.archivoId, 'Factura ' + (p.invoiceNumber || p.supplier || ''));
    const msg = ov.querySelector('.fi-desc-msg'), avisar = t => { if(msg){ msg.textContent = t; msg.hidden = false; } showToast(t, 4000); };
    const boton = (sel, tipo) => { const x = ov.querySelector(sel); if(!x) return; x.onclick = async () => {
      if(x.disabled) return; const lbl = x.textContent; x.disabled = true; x.textContent = '⏳ Preparando…';
      try{ await fiDescargarFactura(p, tipo, avisar); }catch(err){ showToast('⚠️ No se pudo preparar la descarga: ' + (err && err.message ? err.message : 'error') + '.'); }
      finally{ x.disabled = false; x.textContent = lbl; if(msg) msg.hidden = true; }
    }; };
    boton('.fi-dl-pdf', 'pdf'); boton('.fi-dl-jpg', 'jpg');
    const eb = ov.querySelector('.fi-esq-btn'), ep = ov.querySelector('.fi-esq-pags');
    const corregir = async n => { const ok = await fiCorregirEscaneo(p, n, avisar); if(ok){ const pg = await fiEscaneosDe(p); const im = ov.querySelector('.fi-desc-img'); if(im && pg[0]) im.src = pg[0].url; } if(msg) msg.hidden = true; ep.hidden = true; };
    if(eb) eb.onclick = async () => {
      await fiEscaneosDe(p, avisar);
      const n = (p.escaneos || []).length;
      if(n <= 1) return corregir(0);
      ep.innerHTML = '<small>¿Cuál página?</small>' + p.escaneos.map((x, i) => '<button type="button" class="btn-ghost" data-pag="' + i + '">Página ' + (i + 1) + '</button>').join('');
      ep.hidden = false; ep.onclick = ev => { const b = ev.target.closest('[data-pag]'); if(b) corregir(+b.dataset.pag); };
    };
    // ↻ Girar una página ya guardada (un cuarto de vuelta a la derecha): se gira la imagen HD y se vuelve a detectar el texto.
    const gb = ov.querySelector('.fi-girar-btn'), gp = ov.querySelector('.fi-girar-pags');
    const girar = async n => { gp.hidden = true; const ok = await fiGirarEscaneo(p, n, avisar); if(ok){ const pg = await fiEscaneosDe(p); const im = ov.querySelector('.fi-desc-img'); if(im && pg[n]) im.src = pg[n].url; } if(msg) msg.hidden = true; };
    if(gb) gb.onclick = async () => {
      await fiEscaneosDe(p, avisar);
      const n = (p.escaneos || []).length;
      if(n <= 1) return girar(0);
      gp.innerHTML = '<small>¿Cuál página?</small>' + p.escaneos.map((x, i) => '<button type="button" class="btn-ghost" data-pag="' + i + '">Página ' + (i + 1) + '</button>').join('');
      gp.hidden = false; gp.onclick = ev => { const b = ev.target.closest('[data-pag]'); if(b) girar(+b.dataset.pag); };
    };
    // Vista previa de la página 1 ya escaneada (las facturas de antes se escanean en HD al abrirlas)
    const im = ov.querySelector('.fi-desc-img');
    if(im) fiEscaneosDe(p, t => { if(msg) msg.textContent = t; }).then(pg => { if(!ov.classList.contains('show')) return; if(pg[0]){ im.src = pg[0].url; if(msg) msg.hidden = true; } else if(msg) msg.textContent = 'La foto no está en este equipo.'; }).catch(() => { if(msg) msg.textContent = 'No pude abrir la foto.'; });
  }
  function abrirMov(){
    const ms = (data.inventarioMov || []).slice().reverse().slice(0, 300);
    ventana('fiMovOv', '🔁 Movimientos de inventario', ms.length ? '<div class="margin-table-wrap"><table class="margin-table"><thead><tr><th>Fecha</th><th>Producto</th><th>Movimiento</th><th>Cant.</th><th>Costo</th><th>Proveedor / factura</th></tr></thead><tbody>' +
      ms.map(m => '<tr><td>' + new Date(m.at).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) + '</td><td>' + e(m.name) + '</td><td>' + e(m.tipo) + '</td><td>' + (m.qty > 0 ? '+' : '') + m.qty + '</td><td>' + (m.costo ? fmt(m.costo) : '—') + '</td><td>' + e([m.proveedor, m.factura].filter(Boolean).join(' · ') || '—') + '</td></tr>').join('') +
      '</tbody></table></div>' : '<div class="empty-state">Todavía no hay movimientos. Se anotan solos al aplicar una factura o al registrar una entrada o un conteo.</div>');
  }
  const hb = $h('fiHistBtn'), mb = $h('fiMovBtn');
  if(hb) hb.onclick = abrirHist; if(mb) mb.onclick = abrirMov;
  window.fiAbrirHistorialFacturas = abrirHist;

  // ---------- Motor de decisiones ORDEVA (puente) en Ajustes → ORDEVA IA ----------
  function panelLaya(){
    const g = $h('layaGrupo'); if(!g || $h('layaCard')) return;
    const c = document.createElement('div'); c.className = 'jm-card'; c.id = 'layaCard';
    c.innerHTML = '<b>🧩 Motor de decisiones ORDEVA (opcional)</b><div class="settings-desc">Cuando un renglón de una factura se parece a varios productos de tu inventario, ORDEVA IA ayuda a elegir el correcto. ' +
      'Solo se consulta en esos casos (lo seguro lo resuelve ORDEVA sola) y nunca cambia el inventario: propone y tú confirmas. ' +
      'Por seguridad, la clave de ORDEVA no se guarda aquí: va en tu puente (archivo <code>puente/laya-worker.js</code>, se publica gratis en Cloudflare). Aquí solo va la dirección del puente.</div>' +
      '<input type="url" id="layaUrl" class="mz-in" placeholder="https://laya-puente.tu-usuario.workers.dev" autocomplete="off" autocapitalize="none" spellcheck="false">' +
      '<div class="mz-actions" style="margin-top:8px"><button type="button" class="btn-ghost" id="layaProbar">Probar conexión</button><button type="button" class="btn-ghost" id="layaQuitar">Quitar</button></div>' +
      '<div class="settings-desc" id="layaEstado"></div>';
    g.appendChild(c);
    const inp = $h('layaUrl'), est = $h('layaEstado');
    const pintar = () => { const u = (data.laya || {}).url || ''; inp.value = u; est.textContent = u ? '✅ Puente guardado. Se usará solo en los productos dudosos.' : 'Sin conectar: las facturas igual funcionan con la lectura, las reglas y lo que ya aprendiste.'; };
    inp.onchange = () => { const v = inp.value.trim(); if(v && !/^https:\/\/[^\s/]+\.[^\s]+$/.test(v)){ est.textContent = '⚠️ La dirección debe empezar por https://'; return; }
      data.laya = Object.assign({}, data.laya, { url: v }); if(!v) delete data.laya.url; LayaIA.reset(); saveData(); pintar(); };
    $h('layaQuitar').onclick = () => { data.laya = {}; saveData(); pintar(); };
    $h('layaProbar').onclick = async () => { inp.onchange(); if(!(data.laya || {}).url) return; est.textContent = 'Probando…'; LayaIA.reset();
      try{ est.textContent = (await LayaIA.probar()) ? '✅ ORDEVA IA responde.' : '⚠️ El puente respondió, pero no como ORDEVA.'; }catch(err){ est.textContent = '⚠️ IA temporalmente no disponible: ' + (err && err.message ? err.message : 'sin respuesta') + '.'; } };
    pintar();
  }
  document.addEventListener('click', ev => { if(ev.target.closest('.ajustes-cat[data-cat="laya"]')) setTimeout(panelLaya, 60); });
})();
