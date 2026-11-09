/* ORDEVA · lib/vento-play.js — 1.97.0: 🎮 ORDEVA PLAY, el panel del negocio.
   «Más → 🎮 ORDEVA Play» (dueño o administrador): prenderlo o apagarlo, qué juegos ofrece, qué retos (siempre sin alcohol y
   con «pasar»), y las partidas, los jugadores y la clasificación de hoy. Prenderlo hace que el QR de las mesas muestre la
   pestaña «Play» (la carta lleva pl:1). Necesita la cuenta de ORDEVA en la nube (el servidor es el árbitro de los juegos).
   «Contra otras mesas» viene apagado: el negocio lo prende aparte. Al abrir el panel, la pestaña del QR se pone igual a lo
   que dice el servidor (si alguien lo cambió desde otro equipo). */
(function(){
  'use strict';
  if(window.ventoPlay) return;
  const D = () => (typeof data !== 'undefined' ? data : null);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (t, ms) => { try{ showToast(t, ms || 5000); }catch(e){} };
  const nb = () => window.ventoNube || null;
  const neg = () => { try{ return nb() && nb().negocio ? nb().negocio() : null; }catch(e){ return null; } };
  const rol = () => { try{ return nb() && nb().rolActivo ? nb().rolActivo() : null; }catch(e){ return null; } };
  const puede = () => ['dueno', 'admin'].includes(rol());
  async function rpc(fn, args){ const c = await nb().cliente(); const r = await c.rpc(fn, args || {}); if(r.error) throw r.error; return r.data; }
  const JUEGOS = [['show', '🎤', 'El Show de la Mesa', 'Preguntas rápidas'], ['bomba', '💣', 'La Bomba', 'Responde y pasa la bomba'], ['impostor', '🕵️', 'El Impostor', 'Pistas y votación (3+)'],
    ['ruleta', '🎡', 'Ruleta del Caos', 'Retos divertidos'], ['sobreviviente', '🏆', 'Último Sobreviviente', 'Gana el último en pie']];
  const RETOS = [['divertido', '😄 Divertidos'], ['musica', '🎵 Música'], ['talento', '✨ Talento'], ['preguntas', '💬 Preguntas para conocerse']];

  async function panel(){
    if(!neg()){ toast('🎮 ORDEVA PLAY necesita la cuenta de ORDEVA en la nube (Ajustes → Mi cuenta y mi equipo).', 7000); return; }
    document.querySelectorAll('.pla-ov').forEach(o => o.remove());
    const ov = document.createElement('div'); ov.className = 'overlay show cm-ov pla-ov'; ov.setAttribute('data-novocab', '');
    ov.innerHTML = '<div class="modal cm" role="dialog" aria-modal="true"><h2 style="margin:0 0 4px">🎮 ORDEVA Play</h2><div class="modal-sub">Juegos para tus clientes desde el QR de la mesa: con su mesa o contra las otras mesas. Sin registrarse y sin instalar nada. Los retos nunca son de beber y siempre se pueden pasar.</div><div class="pla-cuerpo">Cargando…</div>' +
      '<div class="modal-actions"><button type="button" class="btn-ghost" data-pla="cerrar">Cerrar</button></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if(e.target === ov || e.target.closest('[data-pla="cerrar"]')) ov.remove(); });
    let cfg = null;
    try{ cfg = await rpc('play_config_ver', { p_negocio: neg().id }); }catch(e){ ov.querySelector('.pla-cuerpo').textContent = '⚠️ Sin conexión con el servidor de ORDEVA.'; return; }
    const ed = puede(), dis = ed ? '' : ' disabled', hoy = cfg.hoy || {}, rk = cfg.ranking || {};
    // La pestaña «Play» del QR sigue lo que dice el servidor.
    try{ const d = D(); if(ed && d && !!d.playOn !== !!cfg.activo){ d.playOn = !!cfg.activo; try{ saveData(); }catch(e){} try{ window.vitoPublicarCatalogo && window.vitoPublicarCatalogo(true); }catch(e){} } }catch(e){}
    ov.querySelector('.pla-cuerpo').innerHTML =
      '<label style="display:flex;gap:10px;align-items:center;font-weight:800;font-size:16px;margin:8px 0"><input type="checkbox" class="pla-on"' + (cfg.activo ? ' checked' : '') + dis + '> Activar ORDEVA Play en el QR de las mesas</label>' +
      (ed ? '' : '<div class="modal-sub">🔒 Solo el dueño o el administrador cambian esto.</div>') +
      '<label style="display:flex;gap:10px;align-items:center;margin:6px 0"><input type="checkbox" class="pla-local"' + (cfg.local ? ' checked' : '') + dis + '> ⚔️ Permitir jugar contra otras mesas (todo el local)</label>' +
      '<div class="hist-detail-title" style="margin-top:10px">Juegos</div>' + JUEGOS.map(j => '<label style="display:flex;gap:8px;align-items:center;margin:6px 0"><input type="checkbox" class="pla-j" value="' + j[0] + '"' + ((cfg.juegos || []).includes(j[0]) ? ' checked' : '') + dis + '> <span style="font-size:20px">' + j[1] + '</span> <b>' + esc(j[2]) + '</b> <small style="opacity:.75">' + esc(j[3]) + '</small></label>').join('') +
      '<div class="hist-detail-title" style="margin-top:10px">Retos (siempre se pueden pasar)</div>' + RETOS.map(r => '<label style="display:inline-flex;gap:6px;align-items:center;margin:4px 12px 4px 0"><input type="checkbox" class="pla-r" value="' + r[0] + '"' + ((cfg.retos || []).includes(r[0]) ? ' checked' : '') + dis + '> ' + esc(r[1]) + '</label>').join('') +
      (ed ? '<button type="button" class="btn-primary pla-guardar" style="width:100%;margin-top:10px">Guardar</button>' : '') +
      '<div class="hist-detail-title" style="margin-top:14px">Hoy</div><div>' + (hoy.partidas || 0) + ' partidas · ' + (hoy.jugadores || 0) + ' jugadores · ' + (hoy.mesas || 0) + ' mesas</div>' +
      ((rk.mesas || []).length ? '<div class="hist-detail-title" style="margin-top:10px">🏆 Mesas de hoy</div>' + rk.mesas.slice(0, 5).map((m, i) => '<div>' + (i + 1) + '. Mesa ' + esc(m.mesa) + ' · <b>' + m.puntos + '</b></div>').join('') : '') +
      ((rk.jugadores || []).length ? '<div class="hist-detail-title" style="margin-top:10px">🏅 Jugadores de hoy</div>' + rk.jugadores.slice(0, 5).map((j, i) => '<div>' + (i + 1) + '. ' + esc(j.avatar) + ' ' + esc(j.alias) + ' (Mesa ' + esc(j.mesa) + ') · <b>' + j.puntos + '</b></div>').join('') : '');
    const g = ov.querySelector('.pla-guardar');
    if(g) g.onclick = async () => {
      g.disabled = true;
      const activo = ov.querySelector('.pla-on').checked, local = ov.querySelector('.pla-local').checked, juegos = [...ov.querySelectorAll('.pla-j:checked')].map(x => x.value), retos = [...ov.querySelectorAll('.pla-r:checked')].map(x => x.value);
      if(activo && !juegos.length){ toast('Elige al menos un juego.'); g.disabled = false; return; }
      try{
        await rpc('play_config_guardar', { p_negocio: neg().id, p_activo: activo, p_juegos: juegos, p_retos: retos, p_local: local });
        const d = D(); if(d){ d.playOn = activo; try{ saveData(); }catch(e){} }
        try{ window.vitoPublicarCatalogo && window.vitoPublicarCatalogo(true); }catch(e){}   // la pestaña «Play» del QR
        toast(activo ? '🎮 ORDEVA Play activo: tus clientes lo ven en el QR de la mesa («Play»).' : '🎮 ORDEVA Play apagado.', 6000);
        ov.remove();
      }catch(e){ toast(/sin_permiso/.test((e && e.message) || '') ? '🔒 Solo el dueño o el administrador cambian ORDEVA Play.' : '⚠️ No se pudo guardar (revisa el internet).', 7000); g.disabled = false; }
    };
  }
  function casilla(){
    const gr = document.querySelector('#navMoreSheet .more-grid'); if(!gr) return;
    if(gr.querySelector('[data-go="play"]')) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'more-tile'; b.dataset.go = 'play';
    b.innerHTML = '<span class="more-ic">🎮</span><strong>ORDEVA Play</strong><small>Juegos para tus clientes desde el QR</small>';
    const ref = gr.querySelector('[data-go="calculadora"]'); gr.insertBefore(b, ref || null);
    b.addEventListener('click', ev => { ev.stopPropagation(); const o = document.getElementById('navMoreSheet'); if(o) o.classList.remove('show'); panel(); }, true);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', casilla); else casilla();
  setTimeout(casilla, 1800);
  window.ventoPlay = { panel, JUEGOS, RETOS };
})();
