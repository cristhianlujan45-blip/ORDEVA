/* ORDEVA · app/21-bienvenida-adapta-cada.js — antes estaba dentro de index.html (línea 31734). Se carga en el mismo lugar y orden. */
/* ================= Bienvenida: ORDEVA se adapta a cada negocio =================
   Sale justo después de «Crear cuenta» (y se puede repetir en Ajustes → Negocio → Configurar mi negocio).
   4 pasos cortos: tipo de negocio, datos básicos, cuántos espacios (mesas, consultorios, habitaciones…)
   y qué funciones va a usar. Con eso ORDEVA prende o apaga música, domicilios, propina, clientes
   frecuentes y cobro por QR, crea los espacios y deja la carta de ejemplo del tipo de negocio. */
(function(){
  const $b = id => document.getElementById(id);
  const escb = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Todo sale del catálogo A–Z: ícono, cuántos espacios suele tener y qué funciones prender (letras m/d/p/f).
  const VNb = window.VENTO_NEGOCIOS, tipoDe = k => VNb.get(k) || VNb.get('otro');
  const ICON = new Proxy({}, { get: (o, k) => tipoDe(k).icono });
  const ESPACIOS_DEF = new Proxy({}, { get: (o, k) => (VNb.get(k) || {}).n });
  const FUNCIONES = [
    ['musica', '🎵', 'Música de los clientes', 'Piden canciones desde el QR y suenan en el TV', 'm'],
    ['domicilios', '🛵', 'Domicilios', 'Pedidos a domicilio por tu link y WhatsApp', 'd'],
    ['propina', '💵', 'Propina al cobrar', 'Ofrece el 10% de servicio', 'p'],
    ['frecuentes', '🎖️', 'Clientes frecuentes', 'Guarda a tus clientes y sus puntos', 'f'],
    ['nequi', '💜', 'Cobrar con QR (Nequi / Bre-B)', 'El cliente ve tu QR y paga desde su celular', '*']
  ];
  const CAMPO = { musica: 'musicOn', domicilios: 'domiciliosOn', propina: 'tipsOn', frecuentes: 'loyaltyOn', nequi: 'nequiOn' };
  let st = null, primera = false;

  const nombreEsp = () => tipoDe(st.tipo).esp;
  const nombreTipo = () => st.tipo === 'otro' && st.tipoNombre ? st.tipoNombre : tipoDe(st.tipo).nombre;
  function paso(){
    const ov = $b('onbOv'), cuerpo = $b('onbCuerpo'), n = st.paso;
    ov.querySelectorAll('.onb-dots i').forEach((d, k) => d.classList.toggle('on', k <= n));
    $b('onbAtras').hidden = n === 0; $b('onbSig').textContent = n === 3 ? '✅ Listo, empezar' : 'Siguiente →';
    if(n === 0){
      cuerpo.innerHTML = '<h2>👋 ¡Bienvenido a ORDEVA!</h2><div class="modal-sub">¿Qué tipo de negocio tienes? <b>Escribe una palabra</b> (ej. lavandería, uñas, pollo, taller) y elígelo. Así ORDEVA usa tus palabras (mesas, sillas, órdenes, habitaciones…) y te deja listo lo que necesitas.</div><div id="onbTipo"></div><div class="tp-guia" id="onbGuia"></div>';
      const guia = () => { $b('onbGuia').innerHTML = '<p><b>' + tipoDe(st.tipo).icono + ' ' + escb(nombreTipo()) + '</b></p><p>🎯 ' + escb(tipoDe(st.tipo).necesita) + '</p>' +
        '<p class="onb-tipo-aviso" style="font-size:12.5px;opacity:.85">' + escb(!primera && typeof tipoFijo === 'function' && tipoFijo() ? '🔒 Tu tipo de negocio está fijo: si eliges otro, se le pide permiso al administrador de ORDEVA.' : TIPO_AVISO) + '</p>'; };
      window.ventoTipoPicker($b('onbTipo'), st.tipo, (k, propio) => { st.tipo = k; st.tipoNombre = propio; st.espacios = ESPACIOS_DEF[k] || 3; st.funciones = defFunciones(k); if(primera && !st.modoElegido) st.modo = modoDe(k); guia(); }, { nombrePropio: st.tipoNombre });
      guia();
    } else if(n === 1){
      cuerpo.innerHTML = '<h2>' + (ICON[st.tipo] || '🏷️') + ' Datos de tu negocio</h2><div class="modal-sub">Salen en tus facturas y en la carta de tus clientes. Solo el nombre es necesario.</div>' +
        '<label>Nombre del negocio</label><input id="onbNom" class="mz-in" maxlength="40" value="' + escb(st.nombre) + '" placeholder="Ej. Café La Esquina">' +
        '<label>Ciudad</label><input id="onbCiu" class="mz-in" maxlength="40" value="' + escb(st.ciudad) + '" placeholder="Ej. Medellín">' +
        '<label>WhatsApp del negocio</label><input id="onbWa" class="mz-in" inputmode="tel" maxlength="16" value="' + escb(st.wa) + '" placeholder="Ej. 3001234567">' +
        '<label>Dirección (opcional)</label><input id="onbDir" class="mz-in" maxlength="80" value="' + escb(st.dir) + '">' +
        '<label>NIT o cédula (opcional, para facturas)</label><input id="onbNit" class="mz-in" maxlength="20" value="' + escb(st.nit) + '">';
    } else if(n === 2){
      const [sg, pl, ic] = nombreEsp();
      cuerpo.innerHTML = '<h2>' + ic + ' ¿' + (nombreEsp()[3] === 'f' ? 'Cuántas' : 'Cuántos') + ' ' + escb(pl.toLowerCase()) + ' tienes?</h2><div class="modal-sub">' + (sg === 'Cuenta' ? 'Son las cuentas que puedes tener abiertas al mismo tiempo (ej. clientes que están comprando). ' : '') + 'Luego puedes agregar o quitar cuando quieras.</div>' +
        '<div class="onb-num"><button type="button" id="onbMenos">−</button><input id="onbEsp" type="number" inputmode="numeric" min="1" max="200" value="' + st.espacios + '"><button type="button" id="onbMas">+</button></div>' +
        '<div class="onb-prev">' + Array.from({ length: Math.min(st.espacios, 12) }, (_, i) => '<span>' + ic + ' ' + escb(sg) + ' ' + (i + 1) + '</span>').join('') + (st.espacios > 12 ? '<span>… y ' + (st.espacios - 12) + ' más</span>' : '') + '</div>';
      const upd = v => { st.espacios = Math.max(1, Math.min(200, v || 1)); paso(); };
      $b('onbMenos').onclick = () => upd(st.espacios - 1); $b('onbMas').onclick = () => upd(st.espacios + 1);
      $b('onbEsp').onchange = e => upd(parseInt(e.target.value, 10));
    } else {
      cuerpo.innerHTML = '<h2>⚙️ ¿Qué vas a usar?</h2><div class="modal-sub">Te dejamos prendido lo típico de tu negocio. Cámbialo si quieres; todo se puede prender o apagar después en Ajustes.</div>' +
        '<div class="tp-guia" data-novocab><p><b>' + tipoDe(st.tipo).icono + ' ORDEVA para tu ' + escb(nombreTipo().toLowerCase()) + '</b></p><p>✅ ' + escb(tipoDe(st.tipo).vento) + '</p><p>🧩 <b>Te prende:</b> ' + modsTexto(tipoDe(st.tipo).mod) + '</p>' + (tipoDe(st.tipo).falta ? '<p>🛠️ <b>Próximamente:</b> ' + escb(tipoDe(st.tipo).falta) + '</p>' : '') + '</div>' +
        // Cómo vende (restaurante / tienda / mixto) y la versión fácil: lib/vento-pos.js los usa.
        '<b class="onb-mt">¿Cómo vas a vender?</b><div class="onb-grid onb-modos">' + MODOS.map(m => '<button type="button" class="onb-tile' + (st.modo === m[0] ? ' on' : '') + '" data-modo="' + m[0] + '"><span>' + m[1] + '</span><b>' + escb(m[0] === 'restaurante' ? 'Con ' + nombreEsp()[1].toLowerCase() : m[2]) + '</b><small>' + escb(m[3]) + '</small></button>').join('') + '</div>' +
        '<label class="onb-fun onb-facil"><span class="onb-fic">🧓</span><span class="onb-ftx"><b>¿Quieres la versión fácil?</b><small>Solo 3 botones grandes: Vender, Hoy y Más. Ideal para empezar o para un empleado nuevo.</small></span><span class="switch"><input type="checkbox" data-facil="1"' + (st.facil ? ' checked' : '') + '><span class="switch-slider"></span></span></label>' +
        FUNCIONES.map(f => '<label class="onb-fun"><span class="onb-fic">' + f[1] + '</span><span class="onb-ftx"><b>' + f[2] + '</b><small>' + f[3] + '</small></span><span class="switch"><input type="checkbox" data-fun="' + f[0] + '"' + (st.funciones[f[0]] ? ' checked' : '') + '><span class="switch-slider"></span></span></label>').join('');
      cuerpo.querySelectorAll('[data-fun]').forEach(c => c.onchange = () => { st.funciones[c.dataset.fun] = c.checked; });
      cuerpo.querySelectorAll('[data-modo]').forEach(b => b.onclick = () => { st.modo = b.dataset.modo; st.modoElegido = true; cuerpo.querySelectorAll('[data-modo]').forEach(x => x.classList.toggle('on', x === b)); });
      const fc = cuerpo.querySelector('[data-facil]'); if(fc) fc.onchange = () => { st.facil = fc.checked; };
    }
    cuerpo.scrollTop = 0; ov.querySelector('.modal').scrollTop = 0;
  }
  function guardarPaso(){
    if(st.paso === 1){
      st.nombre = $b('onbNom').value.trim(); st.ciudad = $b('onbCiu').value.trim(); st.wa = $b('onbWa').value.replace(/[^\d+]/g, '');
      st.dir = $b('onbDir').value.trim(); st.nit = $b('onbNit').value.trim();
      if(!st.nombre){ showToast('⚠️ Escribe el nombre de tu negocio.'); return false; }
    }
    if(st.paso === 2){ const v = parseInt($b('onbEsp').value, 10); if(v > 0) st.espacios = Math.min(200, v); }
    return true;
  }
  function defFunciones(tipo){ const fun = tipoDe(tipo).fun, o = {}; FUNCIONES.forEach(f => { o[f[0]] = f[4] === '*' || fun.includes(f[4]); }); return o; }
  // Modo de trabajo por defecto: las tiendas venden por caja (sin mesas); las que fían por cliente (distribuidora…) usan las dos.
  const MODOS = [['restaurante', '🍽️', 'Con mesas', 'Cada uno tiene su cuenta'], ['tienda', '🏪', 'Caja rápida', 'Buscas, cobras y listo'], ['mixto', '🔀', 'Las dos', 'Caja arriba y cuentas abajo']];
  function modoDe(tipo){ try{ return window.ventoPOS.modoPorTipo(tipo); }catch(e){ const t = tipoDe(tipo); return t.fam !== 'tienda' ? 'restaurante' : (t.esp && t.esp[0] !== 'Cuenta' ? 'mixto' : 'tienda'); } }
  async function aplicar(){
    // Tipo fijo: el asistente no lo cambia; se le pide permiso al administrador de ORDEVA (y lo demás sí se guarda).
    let tipoPedido = null;
    if(!primera && data.businessType && data.businessType !== st.tipo && typeof tipoFijo === 'function' && tipoFijo()){ tipoPedido = { k: st.tipo, propio: st.tipoNombre }; st.tipo = data.businessType; st.tipoNombre = data.businessTypeName || ''; }
    if(tipoPedido) setTimeout(() => { try{ tipoPedirCambio(tipoPedido.k, tipoPedido.propio); }catch(e){} }, 400);
    const cambioTipo = data.businessType !== st.tipo;
    data.businessType = st.tipo; data.businessName = st.nombre;
    if(st.tipo === 'otro' && st.tipoNombre) data.businessTypeName = st.tipoNombre; else if(st.tipo !== 'otro') delete data.businessTypeName; data.ciudad = st.ciudad; data.bizWhatsapp = st.wa;
    if(st.dir) data.bizAddress = st.dir; if(st.nit) data.nit = st.nit;
    Object.keys(CAMPO).forEach(k => { data[CAMPO[k]] = !!st.funciones[k]; });
    data.modoOperacion = st.modo || 'restaurante'; data.easyMode = !!st.facil;
    if(cambioTipo) try{ seedBusinessMenu(st.tipo); }catch(e){}
    // Espacios: se crean los que falten y se quitan solo los vacíos que sobran (nunca una cuenta abierta).
    for(let i = 1; i <= st.espacios; i++) if(!data.tables[i]) data.tables[i] = { items: [], people: [] };
    Object.keys(data.tables).map(Number).filter(id => id > st.espacios && !((data.tables[id].items || []).length)).forEach(id => { delete data.tables[id]; });
    data.tableCount = st.espacios;
    data.onboarding = { t: Date.now(), tipo: st.tipo }; data.tipoFijo = true;
    // El WhatsApp también queda como respaldo de los pedidos por QR.
    try{ if(st.wa && window.vitoMod){ const c = window.vitoMod.qCfg(); if(!c.wa){ c.wa = st.wa.replace(/\D/g, '').replace(/^3/, '573'); window.vitoMod.SS('vito_qr', c); } } }catch(e){}
    await saveData();
    showToast('✅ ¡Listo! ORDEVA quedó configurado para tu ' + nombreTipo().toLowerCase() + '.', 4000);
    setTimeout(() => location.reload(), 900);   // se vuelve a abrir ya con todo adaptado (la sesión sigue abierta)
  }
  window.ventoBienvenida = function(esPrimera){
    primera = !!esPrimera;
    const f = {}; FUNCIONES.forEach(x => { f[x[0]] = !!data[CAMPO[x[0]]]; });
    st = { paso: primera ? 0 : 0, tipo: (VNb.ALIAS[data.businessType] || data.businessType || 'tienda'), tipoNombre: data.businessTypeName || '', nombre: data.businessName || '', ciudad: data.ciudad || '', wa: data.bizWhatsapp || '', dir: data.bizAddress || '', nit: data.nit || '',
      espacios: primera ? (ESPACIOS_DEF[data.businessType] || Object.keys(data.tables || {}).length || 3) : (Object.keys(data.tables || {}).length || data.tableCount || 3), funciones: primera ? defFunciones(data.businessType || 'tienda') : f };
    st.modo = primera ? modoDe(st.tipo) : (['tienda', 'mixto'].includes(data.modoOperacion) ? data.modoOperacion : 'restaurante'); st.facil = !!data.easyMode;
    let ov = $b('onbOv');
    if(!ov){
      ov = document.createElement('div'); ov.id = 'onbOv'; ov.className = 'overlay'; ov.setAttribute('data-novocab', '');
      ov.innerHTML = '<div class="modal onb-modal"><div class="onb-dots"><i></i><i></i><i></i><i></i></div><div id="onbCuerpo"></div>' +
        '<div class="modal-actions"><button type="button" class="btn-close" id="onbAtras">← Atrás</button><button type="button" class="btn-close" id="onbSaltar">Ahora no</button><button type="button" class="btn-primary" id="onbSig">Siguiente →</button></div></div>';
      document.body.appendChild(ov);
      $b('onbAtras').onclick = () => { if(st.paso > 0){ guardarPaso(); st.paso--; paso(); } };
      $b('onbSaltar').onclick = () => { ov.classList.remove('show'); try{ window.ventoPasos && window.ventoPasos.pintar(); }catch(e){} };
      $b('onbSig').onclick = () => { if(!guardarPaso()) return; if(st.paso < 3){ st.paso++; paso(); } else { ov.classList.remove('show'); aplicar(); } };
    }
    paso(); ov.classList.add('show');
  };
  const css = document.createElement('style');
  css.textContent = '.onb-modal{max-width:520px}' +
    /* Cuerpo que se desliza y botones fijos abajo: en cualquier pantalla se ve «Siguiente». */
    '.overlay > .onb-modal{display:flex;flex-direction:column;overflow:hidden}' +
    '#onbCuerpo{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}' +
    '.onb-modal > .onb-dots{flex:none}' +
    '.onb-modal > .modal-actions{flex:none;position:sticky;bottom:0;background:var(--surface,var(--cream));padding-top:10px;margin-top:0}' +
    '@media (min-width:700px){.onb-modal{max-width:600px}}' +
    '.onb-dots{display:flex;gap:6px;justify-content:center;margin-bottom:12px}.onb-dots i{width:34px;height:5px;border-radius:5px;background:var(--line)}.onb-dots i.on{background:var(--amber)}' +
    '.onb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(120px,100%),1fr));gap:8px;margin-top:12px}.onb-tile{display:flex;flex-direction:column;align-items:center;gap:4px;padding:12px 6px;border-radius:14px;border:1px solid var(--line);background:var(--surface);color:var(--ink);font:inherit;cursor:pointer;text-align:center;min-width:0}.onb-tile span{font-size:28px}.onb-tile b{font-size:13px;overflow-wrap:anywhere}.onb-tile.on{border-color:var(--amber);background:color-mix(in srgb,var(--amber) 16%,var(--surface));box-shadow:0 0 0 2px color-mix(in srgb,var(--amber) 45%,transparent)}' +
    '.onb-modal label{display:block;font-size:13px;color:var(--ink-soft);margin:10px 0 4px}.onb-modal input.mz-in{width:100%}' +
    '.onb-num{display:flex;align-items:center;justify-content:center;gap:12px;margin:18px 0}.onb-num button{width:52px;height:52px;border-radius:50%;border:1px solid var(--line);background:var(--surface);color:var(--ink);font-size:26px;cursor:pointer}.onb-num input{width:90px;text-align:center;font-size:28px;font-weight:800;padding:8px;border-radius:12px;border:1px solid var(--line);background:var(--bg);color:var(--ink)}' +
    '.onb-prev{display:flex;flex-wrap:wrap;gap:6px;justify-content:center}.onb-prev span{font-size:12.5px;padding:5px 10px;border-radius:999px;background:var(--surface);border:1px solid var(--line)}' +
    '.onb-fun{display:flex !important;align-items:center;gap:10px;padding:10px;border:1px solid var(--line);border-radius:12px;margin:8px 0 !important;background:var(--surface);color:var(--ink) !important;cursor:pointer}.onb-fic{font-size:24px}.onb-ftx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.onb-ftx b{font-size:14.5px}.onb-ftx small{font-size:12.5px;color:var(--ink-soft)}' +
    '.onb-modal .modal-actions{flex-wrap:wrap}' +
    '.onb-mt{display:block;margin:14px 0 0;font-size:14.5px}.onb-modos{grid-template-columns:repeat(3,minmax(0,1fr));margin-top:8px}.onb-modos small{font-size:11.5px;color:var(--ink-soft);line-height:1.25}.onb-facil{border-color:color-mix(in srgb,var(--amber) 45%,var(--line)) !important}';
  document.head.appendChild(css);
})();
