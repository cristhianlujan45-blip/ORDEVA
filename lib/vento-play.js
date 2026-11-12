/* ORDEVA · lib/vento-play.js — 1.97.0: 🎮 ORDEVA PLAY, el panel del negocio.
   «Más → 🎮 ORDEVA Play» (dueño o administrador): prenderlo o apagarlo, qué juegos ofrece, qué retos (siempre sin alcohol y
   con «pasar»), y las partidas, los jugadores y la clasificación de hoy. Prenderlo hace que el QR de las mesas muestre la
   pestaña «Play» (la carta lleva pl:1). Necesita la cuenta de ORDEVA en la nube (el servidor es el árbitro de los juegos).
   «Contra otras mesas» viene apagado: el negocio lo prende aparte. Al abrir el panel, la pestaña del QR se pone igual a lo
   que dice el servidor (si alguien lo cambió desde otro equipo).
   1.98.0: 🏆 Torneo entre mesas. El dueño o el administrador lo empiezan (30, 60, 90 o 120 minutos) y lo terminan; todo el
   equipo ve la tabla de mesas, que se refresca sola mientras el panel está abierto. La regla y la tabla las calcula el
   servidor. */
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
      '<div class="hist-detail-title" style="margin-top:14px">🏆 Torneo entre mesas</div><div class="pla-torneo" aria-live="polite">Cargando…</div>' +
      '<div class="hist-detail-title" style="margin-top:14px">Hoy</div><div>' + (hoy.partidas || 0) + ' partidas · ' + (hoy.jugadores || 0) + ' jugadores · ' + (hoy.mesas || 0) + ' mesas</div>' +
      ((rk.mesas || []).length ? '<div class="hist-detail-title" style="margin-top:10px">🏆 Mesas de hoy</div>' + rk.mesas.slice(0, 5).map((m, i) => '<div>' + (i + 1) + '. Mesa ' + esc(m.mesa) + ' · <b>' + m.puntos + '</b></div>').join('') : '') +
      ((rk.jugadores || []).length ? '<div class="hist-detail-title" style="margin-top:10px">🏅 Jugadores de hoy</div>' + rk.jugadores.slice(0, 5).map((j, i) => '<div>' + (i + 1) + '. ' + esc(j.avatar) + ' ' + esc(j.alias) + ' (Mesa ' + esc(j.mesa) + ') · <b>' + j.puntos + '</b></div>').join('') : '');
    torneo(ov, ed);
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
  // ---------- 🏆 Torneo entre mesas ----------
  const ERR_T = { sin_permiso: '🔒 Solo el dueño o el administrador empiezan o terminan un torneo.', play_no_disponible: 'Primero activa ORDEVA Play y guarda.', play_torneo_abierto: 'Ya hay un torneo abierto.' };
  const errT = e => { const m = (e && e.message) || '', k = Object.keys(ERR_T).find(x => m.indexOf(x) >= 0); return k ? ERR_T[k] : '⚠️ No se pudo (revisa el internet).'; };
  function tablaT(t, grande){
    const ms = t.mesas || [];
    if(!ms.length) return '<div class="modal-sub">' + (t.abierto ? 'Todavía ninguna mesa suma.' : 'Nadie jugó en este torneo.') + '</div>';
    return ms.slice(0, 10).map((m, i) => '<div style="display:flex;justify-content:space-between;gap:8px;padding:4px 0' + (grande && i === 0 ? ';font-size:18px;font-weight:800' : '') + '"><span>' + (i === 0 ? '👑' : (i + 1) + '.') + ' Mesa ' + esc(m.mesa) +
      ((m.jugadores || []).length ? ' <small style="opacity:.75">' + m.jugadores.map(esc).join(', ') + '</small>' : '') + '</span><b>' + (+m.puntos || 0) + '</b></div>').join('');
  }
  function torneo(ov, ed){
    const box = ov.querySelector('.pla-torneo'); if(!box) return;
    let ultimo = '';
    const pintarT = r => {
      const t = r.torneo, marca = JSON.stringify([t && t.id, t && t.v, t && t.abierto, t && Math.ceil((t.fin - t.ahora) / 60000), r.activo, r.local]);
      if(marca === ultimo) return; ultimo = marca;   // sin cambios: no se repinta (no se pierde lo que el dueño está eligiendo)
      const regla = '<div class="modal-sub">Cada partida le da a la mesa hasta 100 puntos (los de su mejor jugador). Cuentan las 5 mejores partidas de la mesa. La Ruleta no suma.</div>';
      if(t && t.abierto){
        const min = Math.max(0, Math.ceil((t.fin - t.ahora) / 60000));
        box.innerHTML = '<div style="font-weight:800;font-size:16px" class="pla-t-estado">🏆 Torneo en curso · ' + (min > 0 ? 'faltan ' + min + ' min' : 'terminando…') + '</div>' +
          (r.activo ? '' : '<div class="modal-sub">⚠️ ORDEVA Play está apagado: el torneo no suma mientras tanto.</div>') + regla + '<div class="pla-t-tabla">' + tablaT(t) + '</div>' +
          (ed ? '<button type="button" class="btn-ghost pla-t-fin" style="width:100%;margin-top:8px">Terminar ahora</button>' : '');
      } else {
        const g = t && (t.mesas || [])[0];
        box.innerHTML = (t ? '<div class="pla-t-res" style="margin-bottom:8px"><div style="font-weight:800;font-size:17px">🏆 Último torneo: ' +
            (g ? ((t.mesas || []).length === 1 ? 'solo jugó la Mesa ' : 'ganó la Mesa ') + esc(g.mesa) + ((g.jugadores || []).length ? ' · ' + g.jugadores.map(esc).join(', ') : '') : 'nadie jugó') + '</div>' + (g ? tablaT(t, true) : '') + '</div>' : '') +
          regla + (!ed ? '<div class="modal-sub">🔒 Solo el dueño o el administrador empiezan un torneo.</div>'
            : !r.activo ? '<div class="modal-sub">Activa ORDEVA Play y guarda para empezar un torneo.</div>'
            : '<div style="display:flex;gap:8px;align-items:center;margin-top:6px"><select class="pla-t-min" aria-label="Duración del torneo"><option value="30">30 minutos</option><option value="60" selected>1 hora</option><option value="90">1 hora y media</option><option value="120">2 horas</option></select>' +
              '<button type="button" class="btn-primary pla-t-ini" style="flex:1">🏆 Empezar torneo</button></div>' +
              (r.local ? '' : '<div class="modal-sub">Con «jugar contra otras mesas» apagado, una persona sola en su mesa no puede jugar (hacen falta 2).</div>'));
      }
      const ini = box.querySelector('.pla-t-ini'), fin = box.querySelector('.pla-t-fin');
      if(ini) ini.onclick = async () => { ini.disabled = true; try{ ultimo = ''; pintarT(await rpc('play_torneo_crear', { p_negocio: neg().id, p_minutos: +box.querySelector('.pla-t-min').value || 60 })); toast('🏆 Torneo empezado: tus clientes lo ven en la pestaña «Play».', 6000); }catch(e){ toast(errT(e), 7000); ini.disabled = false; } };
      if(fin) fin.onclick = async () => {
        if(!confirm('¿Terminar el torneo ahora? Las partidas que no hayan terminado no suman.')) return;
        fin.disabled = true; try{ ultimo = ''; pintarT(await rpc('play_torneo_cerrar', { p_negocio: neg().id })); }catch(e){ toast(errT(e), 7000); fin.disabled = false; }
      };
    };
    const pedir = async () => { try{ pintarT(await rpc('play_torneo_ver', { p_negocio: neg().id })); }catch(e){ if(!ultimo) box.textContent = '⚠️ No se pudo cargar el torneo.'; } };
    pedir();
    const iv = setInterval(() => { if(!ov.isConnected){ clearInterval(iv); return; } if(!document.hidden) pedir(); }, 10000);
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
