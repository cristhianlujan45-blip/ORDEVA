/* =====================================================================
   ORDEVA 1.72.0 · Música fácil: una sola tarjeta arriba en «Música»
   Pedido del dueño: «que el panel de YouTube sea más cómodo, más elegante y más fácil; quita lo repetido; que sea muy
   fácil de conectar y que no haya límite».
   • Arriba: lo que suena, lo que sigue y cuántas hay en cola, con «➕ Poner una canción» y «⏭ Siguiente».
   • «¿Dónde suena la música?» con tres caminos grandes, todos SIN límite de canciones (no gastan el cupo de Google):
       📺 En el TV            → busca el TV del wifi / transmitir (lo de siempre: #tvTransmitir)
       🔢 Con el código del TV → YouTube del TV → Configuración → «Vincular con código de TV»
       🔊 En este equipo       → el reproductor de ORDEVA (computador o celular conectado al parlante)
     Las canciones de las mesas entran A CONTINUACIÓN de la que suena (no la cortan).
   • Debajo, la cola de siempre (sin los botones repetidos) y «Mis playlists».
   • Lo técnico (reproductor, TV, puente, YouTube Music con cuenta de Google —esa sí tiene límite diario—, diagnóstico)
     queda en «⚙️ Más opciones», plegado. No se quitó ninguna función: solo se reordenó.
   ===================================================================== */
(function(){
  'use strict';
  if(window.ventoMusicaFacil) return;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const M = () => window.vitoMusica || null, MOD = () => window.vitoMod || null;
  const g = (fn, d) => { try{ const v = fn(); return v === undefined ? d : v; }catch(e){ return d; } };

  const css = document.createElement('style');
  css.id = 'ventoMusicaFacilCss';
  css.textContent =
    '#mfCard{padding:16px;border-radius:18px;background:linear-gradient(135deg,#231a3d 0%,#0d0e10 100%);color:#fff;border:0}' +
    '#mfCard *{color:inherit}' +
    '.mf-ahora{display:flex;align-items:center;gap:12px}' +
    '.mf-disco{flex:none;width:58px;height:58px;border-radius:14px;background:rgba(255,255,255,.12);display:grid;place-items:center;font-size:28px;overflow:hidden}' +
    '.mf-disco img{width:100%;height:100%;object-fit:cover}' +
    '.mf-txt{flex:1;min-width:0}.mf-txt small{display:block;font-size:12px;opacity:.75;font-weight:700;letter-spacing:.02em}' +
    '.mf-txt b{display:block;font-size:17px;font-weight:800;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.mf-txt span{display:block;font-size:13px;opacity:.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.mf-ctl{display:flex;gap:8px;margin:14px 0 4px}' +
    '#mfCard .mf-ctl button{min-height:50px;border-radius:14px;font:inherit;font-size:15.5px;font-weight:800;cursor:pointer;border:0}' +
    '#mfCard .mf-ctl .mf-poner{flex:1;background:#fff;color:#0d0e10}#mfCard .mf-ctl .mf-sig{flex:none;padding:0 18px;background:rgba(255,255,255,.14)}' +
    '.mf-donde-t{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin:14px 0 8px;font-size:14px;font-weight:800}.mf-donde-t small{font-size:12px;font-weight:700;opacity:.7}' +
    '.mf-ops{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}' +
    '#mfCard .mf-op{display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-height:96px;padding:10px 10px 12px;border-radius:14px;border:2px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);font:inherit;text-align:left;cursor:pointer}' +
    '#mfCard .mf-op i{font-style:normal;font-size:24px;line-height:1}#mfCard .mf-op b{font-size:14px;font-weight:800;line-height:1.2;margin-top:4px}#mfCard .mf-op small{font-size:11.5px;opacity:.75;line-height:1.3}' +
    '#mfCard .mf-op.on{border-color:#22c55e;background:rgba(34,197,94,.16)}#mfCard .mf-op.on b::after{content:" ✓";color:#22c55e}' +
    '.mf-aviso{margin-top:10px;padding:9px 11px;border-radius:12px;background:rgba(245,158,11,.18);font-size:13px;font-weight:700}.mf-aviso[hidden]{display:none}' +
    '@media (max-width:420px){.mf-ops{grid-template-columns:1fr}#mfCard .mf-op{min-height:0;flex-direction:row;align-items:center;gap:10px}#mfCard .mf-op b{margin:0}#mfCard .mf-op small{flex:1 1 100%}#mfCard .mf-op{flex-wrap:wrap}}' +
    '.mf-mas{margin-top:14px}.mf-mas>summary{cursor:pointer;list-style:none;padding:14px 16px;border-radius:14px;border:1px solid var(--line);background:var(--surface);font-weight:800}' +
    '.mf-mas>summary::-webkit-details-marker{display:none}.mf-mas>summary small{display:block;font-weight:500;font-size:12.5px;color:var(--ink-soft);margin-top:2px}' +
    '.mf-mas[open]>summary{margin-bottom:10px}' +
    // Lo que quedó repetido en la cola (ahora está en la tarjeta de arriba)
    '#view-musica.mf-on [data-yp-abrir]:not(.mf-poner),#view-musica.mf-on #mzNext,#view-musica.mf-on #mzSkip,#view-musica.mf-on #mzAutoGo{display:none!important}';
  document.head.appendChild(css);

  function montar(){
    const v = $('view-musica'); if(!v || $('mfCard')) return !!v;
    const card = document.createElement('div');
    card.className = 'settings-group'; card.id = 'mfCard';
    card.innerHTML =
      '<div class="mf-ahora"><div class="mf-disco" id="mfDisco">🎵</div><div class="mf-txt"><small id="mfDonde">Música del local</small><b id="mfTit">Nada suena todavía</b><span id="mfSigue"></span></div></div>' +
      '<div class="mf-ctl"><button type="button" class="mf-poner" id="mfPoner" data-yp-abrir>➕ Poner una canción</button><button type="button" class="mf-sig" id="mfSig" aria-label="Siguiente canción">⏭ Siguiente</button></div>' +
      '<div class="mf-donde-t"><span>¿Dónde suena la música?</span><small>Sin límite de canciones</small></div>' +
      '<div class="mf-ops">' +
        '<button type="button" class="mf-op" data-mf="tv"><i>📺</i><b>En el TV</b><small>Busca el TV de tu wifi y tócalo</small></button>' +
        '<button type="button" class="mf-op" data-mf="codigo"><i>🔢</i><b>Con el código del TV</b><small>YouTube del TV → Configuración → Vincular con código</small></button>' +
        '<button type="button" class="mf-op" data-mf="equipo"><i>🔊</i><b>En este equipo</b><small>Computador o celular conectado al parlante</small></button>' +
      '</div>' +
      '<div class="mf-aviso" id="mfAviso" hidden></div>';
    // Debajo de la tarjeta: la cola (primer grupo) y las playlists. El resto, en «⚙️ Más opciones».
    const grupos = [...v.children].filter(x => x.classList && x.classList.contains('settings-group'));
    const cola = grupos[0], pl = $('mzPlGrupo');
    const mas = document.createElement('details');
    mas.className = 'mf-mas'; mas.id = 'mfMas';
    mas.innerHTML = '<summary>⚙️ Más opciones<small>Reproductor, TV, YouTube Music con cuenta de Google, diagnóstico</small></summary>';
    grupos.forEach(x => { if(x !== cola && x !== pl) mas.appendChild(x); });
    if(cola) cola.before(card); else v.prepend(card);
    v.appendChild(mas);
    v.classList.add('mf-on');
    card.addEventListener('click', e => {
      const b = e.target.closest('button'); if(!b) return;
      if(b.id === 'mfPoner') return;   // lo abre el manejador de siempre de [data-yp-abrir] (el panel de YouTube)
      if(b.id === 'mfSig'){ const m = M(); if(m && m.actual()) m.saltar(); else { const n = $('mzNext'); if(n) n.click(); } setTimeout(pintar, 400); return; }
      const k = b.dataset.mf; if(!k) return;
      if(k === 'tv'){ mas.open = true; const t = $('tvTransmitir'); if(t){ t.scrollIntoView({ block: 'center', behavior: 'smooth' }); t.click(); } return; }
      if(k === 'codigo'){ mas.open = true; try{ tvSinLista('Escribe los 12 números que muestra el TV en YouTube → Configuración → «Vincular con código de TV». Lo que suena no se corta.'); }catch(x){ const d = $('tvOptCodigo'); if(d){ d.open = true; d.scrollIntoView({ block: 'start', behavior: 'smooth' }); } } setTimeout(() => { const c = $('lngCode'); if(c) try{ c.focus(); }catch(x){} }, 500); return; }
      if(k === 'equipo'){
        const yo = $('mqYo'); if(yo && !yo.hidden && g(() => data.musicaEquipo && data.musicaEquipo.id, null)) yo.click();   // con varios equipos: que suene en este
        const go = $('mzAutoGo'); if(go) go.click();
        setTimeout(pintar, 500); return;
      }
    });
    return true;
  }

  // ¿Dónde suena? (lo que ya sabe ORDEVA, sin preguntar nada nuevo)
  function donde(){
    const tvCod = g(() => typeof lngOn === 'function' && lngOn(), false);
    if(tvCod) return { k: 'codigo', t: '📺 Suena en el TV «' + g(() => lngCfg().nombre || 'TV', 'TV') + '»' };
    const tvNav = g(() => MOD().tvOn(), false);
    if(tvNav) return { k: 'tv', t: '📺 Suena en la pantalla del TV' };
    const eq = g(() => data.musicaEquipo, null), yo = g(() => typeof codigoEquipo === 'function' ? codigoEquipo() : '', '');
    if(eq && eq.id && yo && eq.id !== yo) return { k: 'otro', t: '🔊 Suena en «' + (eq.nombre || 'otro equipo') + '»' };
    if(g(() => MOD().AUTO(), false)) return { k: 'equipo', t: '🔊 Suena en este equipo' };
    return { k: '', t: 'Música del local' };
  }
  let ultimo = '';
  function pintar(){
    if(!$('mfCard')) return;
    const m = M(), d = donde();
    const a = m && g(() => m.actual(), null);
    const q = m ? g(() => (MOD() ? MOD().ordenJusto(m.cola()) : m.cola().filter(x => !x.done)), []) : [];
    const sig = q.find(x => !a || x.id !== a.id);
    const tit = a ? (a.title || a.song || 'Canción') : 'Nada suena todavía';
    const sub = (sig ? 'Sigue: ' + (sig.title || sig.song) + (sig.mesaNombre ? ' · ' + sig.mesaNombre : '') : (a ? 'No hay más canciones en cola' : 'Las canciones que pidan las mesas por el QR salen aquí')) + (q.length > 1 ? ' · ' + q.length + ' en cola' : '');
    const vid = a && a.vid;
    const h = [d.t, tit, sub, vid, d.k].join('|');
    if(h === ultimo) return; ultimo = h;
    $('mfDonde').textContent = d.t; $('mfTit').textContent = tit; $('mfSigue').textContent = sub;
    $('mfDisco').innerHTML = vid ? '<img alt="" src="https://i.ytimg.com/vi/' + esc(vid) + '/mqdefault.jpg">' : '🎵';
    document.querySelectorAll('#mfCard .mf-op').forEach(b => b.classList.toggle('on', b.dataset.mf === d.k));
    const av = $('mfAviso');
    const esperan = q.filter(x => !x.done && x.status !== 'playing').length;
    av.hidden = !!d.k || !esperan;
    av.textContent = '⚠️ Hay ' + esperan + (esperan === 1 ? ' canción esperando' : ' canciones esperando') + ': elige dónde suena la música y empiezan solas.';
  }
  function iniciar(){ if(montar()){ pintar(); setInterval(() => { const v = $('view-musica'); if(v && v.offsetParent) pintar(); }, 1500); } }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else setTimeout(iniciar, 0);
  window.ventoMusicaFacil = { pintar, donde };
})();
