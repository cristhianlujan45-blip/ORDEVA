/* ORDEVA · app/25-vitrina-pagina-pedidos.js — antes estaba dentro de index.html (línea 32571). Se carga en el mismo lugar y orden. */
/* ==================== 🎉 Vitrina de la página de pedidos (ocasiones, mensajes y promociones) ====================
   El dueño elige una OCASIÓN (Navidad, cumpleaños, Año nuevo, partido, aniversario…), escribe un MENSAJE y arma
   hasta 6 PROMOCIONES (emoji o foto del producto, título, texto, precio, hasta qué fecha y botón «Pedir»).
   Todo viaja por un canal aparte (topic + 'a') para no quitarle espacio a la carta, y pedido.html lo muestra
   con animaciones: banner de la ocasión, carrusel de promociones, saludo al abrir y adornos que caen. */
(function(){
  const OCASIONES = [['', 'Ninguna'], ['navidad', '🎄 Navidad'], ['anonuevo', '🎆 Año nuevo'], ['cumple', '🎂 Cumpleaños'], ['sanvalentin', '💘 Amor y amistad'],
    ['halloween', '🎃 Halloween'], ['madre', '💐 Día de la madre'], ['padre', '👔 Día del padre'], ['futbol', '⚽ Partido de fútbol'], ['aniversario', '🥳 Aniversario del local'],
    ['happyhour', '🍻 Happy hour'], ['patrias', '🇨🇴 Fiestas patrias'], ['amor', '💑 Noche romántica']];
  const V = () => { if(!data.vitrina) data.vitrina = { ocasion: '', nombre: '', mensaje: '', saludo: true, promos: [] }; return data.vitrina; };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let hash = '', hashT = 0;
  async function publicar(forzar){
    if(typeof data === 'undefined' || !data || !window.vitoQCfg) return;
    if(!data.vitrina && !forzar) return;   // nunca configurada: no gastar mensajes de más
    const c = window.vitoQCfg(); if(!c || !c.topic) return;
    const v = V(), hoy = new Date().toISOString().slice(0, 10);
    const pr = (v.promos || []).filter(x => !x.hasta || x.hasta >= hoy).slice(0, 6).map(x => [x.e || '', String(x.t || '').slice(0, 40), String(x.d || '').slice(0, 90), Math.round(+x.p || 0), String(x.prod || '').slice(0, 60)]);
    const m = { v: 1, oc: v.ocasion || '', nom: String(v.nombre || '').slice(0, 30), msg: String(v.mensaje || '').slice(0, 140), sal: v.saludo !== false ? 1 : 0, pr };
    const s = JSON.stringify(m);
    if(!forzar && s === hash && Date.now() - hashT < 6 * 36e5) return;
    try{ const r = await fetch('https://canal.vento.local/' + c.topic + 'a', { method: 'POST', body: s }); if(r.ok){ hash = s; hashT = Date.now(); } }catch(e){}
  }
  window.vitrinaPublicar = publicar;
  setInterval(() => publicar(false), 10 * 60000); setTimeout(() => publicar(false), 8000);

  function crearUI(){
    if(document.getElementById('vitGrupo')) return;
    const ref = document.querySelector('.settings-group[data-cat="pedidos"]'); if(!ref) return;
    const g = document.createElement('div'); g.className = 'settings-group'; g.id = 'vitGrupo'; g.hidden = true; g.dataset.cat = 'pedidos'; g.setAttribute('data-novocab', '');
    g.innerHTML = '<h2>🎉 Página de pedidos: ocasión, mensajes y promociones</h2>' +
      '<div class="settings-desc">Lo que ven tus clientes al escanear el QR: una ocasión especial con su decoración y saludo, tu mensaje y un carrusel de promociones con botón para pedirlas.</div>' +
      '<div class="settings-row" style="flex-direction:column;align-items:stretch;gap:8px"><div class="settings-row-text"><strong>Ocasión</strong><span>Cambia colores, adornos que caen, banner y saludo.</span></div>' +
      '<select id="vitOc" class="mz-in">' + OCASIONES.map(([k, l]) => '<option value="' + k + '">' + l + '</option>').join('') + '</select>' +
      '<input id="vitNom" class="mz-in" maxlength="30" placeholder="Nombre (ej. «Ana» para el cumpleaños, «5 años» para el aniversario)"></div>' +
      '<div class="settings-row" style="flex-direction:column;align-items:stretch;gap:6px"><div class="settings-row-text"><strong>Mensaje de la ocasión</strong><span>Sale en el banner, grande y animado.</span></div>' +
      '<input id="vitMsg" class="mz-in" maxlength="140" placeholder="Ej. ¡Hoy 2x1 en cócteles hasta las 10 pm!"></div>' +
      '<div class="settings-row"><div class="settings-row-text"><strong>Saludo animado al abrir</strong><span>Una tarjeta de bienvenida con celebración, una vez por visita.</span></div><label class="switch"><input type="checkbox" id="vitSal"><span class="switch-slider"></span></label></div>' +
      '<div class="settings-row" style="flex-direction:column;align-items:stretch;gap:8px"><div class="settings-row-text"><strong>📣 Promociones (publicidad)</strong><span>Hasta 6. Si la vinculas a un producto, el cliente la pide con un toque (y sale su foto si tiene).</span></div>' +
      '<div id="vitPromos"></div><div class="mz-actions" style="flex-wrap:wrap"><button type="button" class="btn-primary" id="vitAdd">➕ Agregar promoción</button><button type="button" class="btn-ghost" id="vitCombos">🎁 Traer mis combos</button></div></div>' +
      '<div class="mz-actions"><button type="button" class="btn-ghost" id="vitVer">👀 Ver cómo lo ven los clientes</button></div>';
    g.hidden = ref.hidden;   // si la categoría ya está abierta, se ve de una vez
    ref.parentNode.insertBefore(g, ref);
    const guardar = () => { saveData(); publicar(true); };
    const oc = g.querySelector('#vitOc'), nom = g.querySelector('#vitNom'), msg = g.querySelector('#vitMsg'), sal = g.querySelector('#vitSal');
    oc.onchange = () => { V().ocasion = oc.value; guardar(); pintar(); showToast(oc.value ? '🎉 Ocasión «' + oc.options[oc.selectedIndex].text + '» publicada en la página de pedidos.' : 'Ocasión quitada.'); };
    nom.onchange = () => { V().nombre = nom.value.replace(/[<>]/g, '').trim(); guardar(); };
    msg.onchange = () => { V().mensaje = msg.value.replace(/[<>]/g, '').trim(); guardar(); showToast('✅ Mensaje publicado.'); };
    sal.onchange = () => { V().saludo = sal.checked; guardar(); };
    g.querySelector('#vitAdd').onclick = () => editar(null);
    g.querySelector('#vitCombos').onclick = () => {
      const combos = data.products.filter(p => p.combo || p.categoryId === 'cat-promos' || /promo|combo/i.test(((data.categories || []).find(c => c.id === p.categoryId) || {}).name || ''));
      if(!combos.length) return showToast('No tienes combos ni promociones creados en Productos.');
      const v = V(); combos.slice(0, 6 - v.promos.length).forEach(p => v.promos.push({ id: 'pr' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), e: '🎁', t: p.name, d: '', p: p.price, prod: p.name }));
      guardar(); pintar(); showToast('🎁 Agregué ' + Math.min(combos.length, 6) + ' combo(s) a las promociones.');
    };
    g.querySelector('#vitVer').onclick = () => { try{ const c = window.vitoQCfg(); window.open(window.vitoMod.linkMesa(c, 1), '_blank'); }catch(e){ showToast('Primero configura los QR de las mesas.'); } };
    g.querySelector('#vitPromos').addEventListener('click', e => {
      const b = e.target.closest('[data-pr]'); if(!b) return;
      const v = V(), i = v.promos.findIndex(x => x.id === b.dataset.pr); if(i < 0) return;
      if(b.dataset.a === 'del'){ if(!confirm('¿Quitar esta promoción?')) return; v.promos.splice(i, 1); guardar(); pintar(); }
      else if(b.dataset.a === 'up' && i > 0){ [v.promos[i - 1], v.promos[i]] = [v.promos[i], v.promos[i - 1]]; guardar(); pintar(); }
      else if(b.dataset.a === 'ed') editar(v.promos[i]);
    });
    pintar();
  }
  function pintar(){
    const g = document.getElementById('vitGrupo'); if(!g || typeof data === 'undefined' || !data) return; const v = data.vitrina || { ocasion: '', nombre: '', mensaje: '', saludo: true, promos: [] };
    g.querySelector('#vitOc').value = v.ocasion || ''; g.querySelector('#vitNom').value = v.nombre || ''; g.querySelector('#vitMsg').value = v.mensaje || ''; g.querySelector('#vitSal').checked = v.saludo !== false;
    g.querySelector('#vitNom').hidden = !['cumple', 'aniversario', 'madre', 'padre'].includes(v.ocasion);
    const hoy = new Date().toISOString().slice(0, 10);
    g.querySelector('#vitPromos').innerHTML = (v.promos || []).length ? v.promos.map((x, i) => '<div class="vit-li' + (x.hasta && x.hasta < hoy ? ' vit-venc' : '') + '"><span class="vit-e">' + esc(x.e || '📣') + '</span><span class="vit-tx"><b>' + esc(x.t) + '</b>' + (x.p ? ' · ' + esc(fmt(x.p)) : '') + '<small>' + esc(x.d || '') + (x.prod ? ' · pide: ' + esc(x.prod) : '') + (x.hasta ? ' · hasta ' + esc(x.hasta) + (x.hasta < hoy ? ' (vencida)' : '') : '') + '</small></span>' +
      (i ? '<button type="button" class="btn-ghost" data-pr="' + x.id + '" data-a="up" title="Subir">↑</button>' : '') + '<button type="button" class="btn-ghost" data-pr="' + x.id + '" data-a="ed">✏️</button><button type="button" class="btn-ghost" data-pr="' + x.id + '" data-a="del">🗑</button></div>').join('') : '<div class="settings-desc">Todavía no hay promociones.</div>';
    g.querySelector('#vitAdd').disabled = (v.promos || []).length >= 6;
  }
  function editar(x){
    const v = V(), nuevo = !x; x = x || { id: 'pr' + Date.now().toString(36), e: '🔥', t: '', d: '', p: '', prod: '', hasta: '' };
    let ov = document.getElementById('vitEdOv'); if(!ov){ ov = document.createElement('div'); ov.id = 'vitEdOv'; ov.className = 'overlay'; document.body.appendChild(ov); }
    const prods = data.products.filter(p => !p.oculto).slice().sort((a, b) => a.name.localeCompare(b.name));
    const EMO = ['🔥', '🎁', '🍻', '🍺', '🍹', '🍔', '🍕', '🌮', '🍰', '☕', '🎉', '⭐', '💥', '🆕', '❤️', '⚽'];
    ov.innerHTML = '<div class="modal" style="max-width:440px"><h2>' + (nuevo ? '➕ Nueva promoción' : '✏️ Editar promoción') + '</h2>' +
      '<div class="vit-emos">' + EMO.map(e => '<button type="button" data-e="' + e + '"' + (e === x.e ? ' class="on"' : '') + '>' + e + '</button>').join('') + '</div>' +
      '<input id="vpT" class="mz-in" maxlength="40" placeholder="Título (ej. 2x1 en Águila)" value="' + esc(x.t) + '">' +
      '<input id="vpD" class="mz-in" maxlength="90" placeholder="Texto corto (ej. Solo hoy, de 6 a 9 pm)" value="' + esc(x.d) + '">' +
      '<input id="vpP" class="mz-in" type="number" inputmode="numeric" min="0" placeholder="Precio (opcional)" value="' + esc(x.p || '') + '">' +
      '<select id="vpProd" class="mz-in"><option value="">Sin botón «Pedir» (solo anuncio)</option>' + prods.map(p => '<option' + (p.name === x.prod ? ' selected' : '') + '>' + esc(p.name) + '</option>').join('') + '</select>' +
      '<label style="font-size:13px;display:flex;flex-direction:column;gap:4px">Mostrar hasta (opcional)<input id="vpH" class="mz-in" type="date" value="' + esc(x.hasta || '') + '"></label>' +
      '<div class="modal-actions"><button type="button" class="btn-close" id="vpNo">Cancelar</button><button type="button" class="btn-primary" id="vpSi">Guardar</button></div></div>';
    let emo = x.e;
    ov.querySelectorAll('[data-e]').forEach(b => b.onclick = () => { emo = b.dataset.e; ov.querySelectorAll('[data-e]').forEach(y => y.classList.toggle('on', y === b)); });
    ov.querySelector('#vpProd').onchange = e => { const p = data.products.find(y => y.name === e.target.value); const t = ov.querySelector('#vpT'), pr = ov.querySelector('#vpP'); if(p){ if(!t.value) t.value = p.name; if(!pr.value) pr.value = p.price; } };
    ov.querySelector('#vpNo').onclick = () => ov.classList.remove('show');
    ov.querySelector('#vpSi').onclick = () => {
      const t = ov.querySelector('#vpT').value.replace(/[<>]/g, '').trim(); if(!t) return showToast('Ponle un título.');
      Object.assign(x, { e: emo, t, d: ov.querySelector('#vpD').value.replace(/[<>]/g, '').trim(), p: Math.max(0, parseInt(ov.querySelector('#vpP').value, 10) || 0), prod: ov.querySelector('#vpProd').value, hasta: ov.querySelector('#vpH').value });
      if(nuevo) v.promos.push(x);
      saveData(); publicar(true); pintar(); ov.classList.remove('show'); showToast('📣 Promoción publicada en la página de pedidos.');
    };
    ov.classList.add('show');
  }
  document.addEventListener('click', e => { if(e.target.closest && e.target.closest('.ajustes-cat[data-cat="pedidos"]')) setTimeout(() => { crearUI(); pintar(); }, 60); });
  setTimeout(crearUI, 3000);
  const st = document.createElement('style');
  st.textContent = '.vit-li{display:flex;gap:8px;align-items:center;border:1px solid var(--line);border-radius:12px;padding:8px;margin-bottom:6px}.vit-li .btn-ghost{padding:6px 9px}.vit-venc{opacity:.55}' +
    '.vit-e{font-size:24px}.vit-tx{flex:1;min-width:0;font-size:14px;overflow-wrap:anywhere}.vit-tx small{display:block;color:var(--ink-soft);font-size:12px}' +
    '#vitEdOv .modal{display:flex;flex-direction:column;gap:10px}.vit-emos{display:flex;flex-wrap:wrap;gap:6px}.vit-emos button{font-size:22px;width:42px;height:42px;border-radius:10px;border:1px solid var(--line);background:transparent;cursor:pointer}.vit-emos button.on{border-color:var(--amber,#f59e0b);background:color-mix(in srgb,var(--amber,#f59e0b) 18%,transparent)}';
  document.head.appendChild(st);
})();
