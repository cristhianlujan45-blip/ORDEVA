/* ORDEVA · app/22-primeros-pasos-tarjeta.js — antes estaba dentro de index.html (línea 31870). Se carga en el mismo lugar y orden. */
/* ---------- Primeros pasos ----------
   Tarjeta arriba de las mesas/cuentas para el negocio que recién empieza: cada paso se marca solo cuando se
   hace (configurar, revisar productos, abrir una cuenta, cobrar, probar la voz). Se oculta con la ✕ o sola
   cuando todo está hecho. Solo la ve el administrador. No cambia ningún dato del negocio. */
(function(){
  const K_OCULTA = 'vento-pp-oculta', K_HECHO = 'vento-pp-';
  const ls = { get: k => { try{ return localStorage.getItem(k); }catch(e){ return null; } }, set: (k, v) => { try{ localStorage.setItem(k, v); }catch(e){} } };
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const marcar = k => { if(ls.get(K_HECHO + k) !== '1'){ ls.set(K_HECHO + k, '1'); pintar(); } };
  const sg = () => { try{ return espacio()[0].toLowerCase(); }catch(e){ return 'cuenta'; } };
  const fem = () => { try{ return espacio()[3] !== 'm'; }catch(e){ return true; } };
  function hayVentas(){ try{ return (data.history || []).length > 0; }catch(e){ return false; } }
  function hayAbierta(){ try{ return Object.keys(data.tables || {}).some(id => (data.tables[id].items || []).length); }catch(e){ return false; } }
  // Modo tienda (lib/vento-pos.js): se vende en la caja, no abriendo cuentas.
  function enCaja(){ try{ return !!window.ventoPOS && window.ventoPOS.modo() === 'tienda'; }catch(e){ return false; } }
  function pasos(){
    return [
      { k: 'config', ic: '🧭', t: 'Configura tu negocio', d: 'Nombre, tipo y lo que vas a usar.', ok: () => { try{ return !!data.onboarding; }catch(e){ return false; } }, ir: () => window.ventoBienvenida && window.ventoBienvenida(false) },
      { k: 'productos', ic: '📦', t: 'Revisa tus productos y precios', d: 'Agrega los tuyos o cárgalos con la foto de una factura.', ok: () => ls.get(K_HECHO + 'productos') === '1', ir: () => { const b = document.querySelector('nav button[data-view="productos"]'); if(b) b.click(); } },
      { k: 'abrir', ic: '📝', t: enCaja() ? 'Vende tu primer producto' : 'Abre ' + (fem() ? 'tu primera ' : 'tu primer ') + sg(), d: enCaja() ? 'Toca un producto en la caja: se suma a la venta.' : 'Tócala y agrega lo que piden.', ok: () => hayAbierta() || hayVentas(), ir: () => { if(enCaja()) return window.ventoPOS.enfocar(); const t = document.querySelector('#tableGrid .ticket'); if(t){ t.scrollIntoView({ block: 'center', behavior: 'smooth' }); t.classList.add('pp-pulso'); setTimeout(() => t.classList.remove('pp-pulso'), 2400); } } },
      { k: 'cobrar', ic: '💵', t: 'Cobra tu primera venta', d: 'Efectivo, transferencia o queda debiendo.', ok: hayVentas, ir: () => { if(enCaja()) return window.ventoPOS.enfocar(); const t = [...document.querySelectorAll('#tableGrid .ticket.open')][0] || document.querySelector('#tableGrid .ticket'); if(t) t.click(); } },
      { k: 'voz', ic: '🎙️', t: 'Prueba la voz', d: 'Di «Hola ORDEVA, ' + sg() + ' 1, dos gaseosas».', ok: () => ls.get(K_HECHO + 'voz') === '1', ir: () => { if(typeof startVoiceCommand === 'function') startVoiceCommand(false); } }
    ];
  }
  function puedeVer(){
    try{ if(typeof authUser !== 'undefined' && authUser && typeof authIsAdmin === 'function' && !authIsAdmin()) return false; }catch(e){}
    return ls.get(K_OCULTA) !== '1';
  }
  function activa(){ if(ls.get('vento-pp-eval') !== '1' && hayVentas()) return false; if(!puedeVer()) return false; return pasos().some(p => !p.ok()); }
  function pintar(){
    const el = document.getElementById('primerosPasos'); if(!el) return;
    // Solo con sesión iniciada. La primera vez que se evalúa: si el negocio ya tiene ventas, no es nuevo → no se muestra.
    try{ if(typeof authUser === 'undefined' || !authUser){ el.hidden = true; return; } }catch(e){ el.hidden = true; return; }
    if(ls.get('vento-pp-eval') !== '1'){ ls.set('vento-pp-eval', '1'); if(hayVentas() && ls.get(K_OCULTA) == null) ls.set(K_OCULTA, '1'); }
    if(!puedeVer()){ el.hidden = true; return; }
    const ps = pasos(), hechos = ps.filter(p => p.ok()).length;
    if(hechos === ps.length){
      if(ls.get('vento-pp-fin') === '1'){ el.hidden = true; return; }
      el.hidden = false;
      el.innerHTML = '<div class="pp-card pp-fin"><b>🎉 ¡ORDEVA quedó listo!</b><span>Ya sabes lo esencial. Si necesitas ayuda, di «Hola ORDEVA, comandos» o escríbenos por WhatsApp desde Ajustes.</span><button type="button" class="pp-x" aria-label="Cerrar">✕</button></div>';
      el.querySelector('.pp-x').onclick = () => { ls.set('vento-pp-fin', '1'); el.hidden = true; };
      return;
    }
    el.hidden = false;
    el.innerHTML = '<div class="pp-card"><div class="pp-head"><div><b>🚀 Primeros pasos</b><span>' + hechos + ' de ' + ps.length + ' listos</span></div>' +
      '<button type="button" class="pp-x" aria-label="Ocultar" title="Ocultar">✕</button></div>' +
      '<div class="pp-barra"><i style="width:' + Math.round(hechos / ps.length * 100) + '%"></i></div>' +
      '<div class="pp-lista">' + ps.map((p, i) => '<button type="button" class="pp-paso' + (p.ok() ? ' ok' : '') + '" data-i="' + i + '"><span class="pp-ic">' + (p.ok() ? '✅' : p.ic) + '</span><span class="pp-tx"><b>' + esc(p.t) + '</b><small>' + esc(p.d) + '</small></span>' + (p.ok() ? '' : '<span class="pp-ir">›</span>') + '</button>').join('') + '</div>' +
      '<button type="button" class="pp-como">¿Cómo funciona ORDEVA? Ver el recorrido</button></div>';
    el.querySelector('.pp-x').onclick = () => { ls.set(K_OCULTA, '1'); el.hidden = true; showToast('Listo. Vuelve a verla en Ajustes → «Primeros pasos».', 4000); };
    el.querySelectorAll('.pp-paso').forEach(b => b.onclick = () => { const p = ps[+b.dataset.i]; if(!p.ok()) try{ p.ir(); }catch(e){} });
    el.querySelector('.pp-como').onclick = () => { try{ localStorage.removeItem('cm-tutorial-seen'); }catch(e){} try{ maybeShowTutorial(true); }catch(e){} };
  }
  // Marcas automáticas
  document.addEventListener('click', ev => { const b = ev.target && ev.target.closest && ev.target.closest('nav button[data-view="productos"]'); if(b) marcar('productos'); }, true);
  if(typeof handleVoiceTranscript === 'function'){
    const orig = handleVoiceTranscript;
    handleVoiceTranscript = async function(t){ marcar('voz'); return orig.apply(this, arguments); };
  }
  // Repintar cuando cambian las mesas o se guarda
  if(typeof renderMesasSummary === 'function'){
    const o = renderMesasSummary;
    renderMesasSummary = function(){ const r = o.apply(this, arguments); try{ pintar(); }catch(e){} return r; };
  }
  window.ventoPasos = { pintar, activa, mostrar: () => { ls.set(K_OCULTA, '0'); ls.set('vento-pp-fin', '0'); pintar(); const v = document.querySelector('nav button[data-view="mesas"]'); if(v) v.click(); } };
  const css = document.createElement('style');
  css.textContent = '#primerosPasos{margin:0 0 14px}.pp-card{position:relative;border:1px solid color-mix(in srgb,var(--amber,#8b5cf6) 45%,var(--line));background:linear-gradient(135deg,color-mix(in srgb,var(--amber,#8b5cf6) 14%,var(--surface,#16151f)),var(--surface,#16151f));border-radius:18px;padding:14px 14px 10px}' +
    '.pp-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}.pp-head b{display:block;font-size:16px}.pp-head span{font-size:12.5px;color:var(--ink-soft)}' +
    '.pp-x{border:0;background:transparent;color:var(--ink-soft);font-size:16px;cursor:pointer;padding:4px 8px;border-radius:8px}.pp-fin .pp-x{position:absolute;top:8px;right:8px}' +
    '.pp-barra{height:6px;border-radius:6px;background:var(--line);margin:10px 0 8px;overflow:hidden}.pp-barra i{display:block;height:100%;background:#34d399;border-radius:6px;transition:width .4s}' +
    '.pp-lista{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(230px,100%),1fr));gap:8px}' +
    '.pp-paso{display:flex;align-items:center;gap:10px;text-align:left;padding:10px 12px;border-radius:12px;border:1px solid var(--line);background:var(--paper-2,rgba(255,255,255,.03));color:var(--ink);cursor:pointer;font:inherit}' +
    '.pp-paso.ok{opacity:.6;cursor:default}.pp-paso.ok b{text-decoration:line-through}.pp-ic{font-size:20px}.pp-tx{flex:1;min-width:0}.pp-tx b{display:block;font-size:14px}.pp-tx small{display:block;font-size:12px;color:var(--ink-soft);margin-top:2px}.pp-ir{font-size:22px;color:var(--amber,#8b5cf6)}' +
    '.pp-como{margin-top:8px;border:0;background:transparent;color:var(--amber,#a78bfa);font:inherit;font-size:13px;text-decoration:underline;cursor:pointer;padding:4px 0}' +
    '.pp-fin{display:flex;flex-direction:column;gap:4px;padding-right:40px}.pp-fin span{font-size:13px;color:var(--ink-soft)}' +
    '.ticket.pp-pulso{animation:ppPulso 1.2s ease 2}@keyframes ppPulso{0%,100%{box-shadow:0 0 0 0 rgba(52,211,153,0)}50%{box-shadow:0 0 0 6px rgba(52,211,153,.55)}}' +
    'body.modo-mesero #primerosPasos{display:none!important}';
  document.head.appendChild(css);
  setTimeout(pintar, 800);
})();
