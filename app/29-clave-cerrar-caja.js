/* ORDEVA · app/29-clave-cerrar-caja.js — antes estaba dentro de index.html (línea 33321). Se carga en el mismo lugar y orden. */
/* ================= 🔒 Clave para cerrar la caja (1.55.0) =================
   Opcional, lo elige el dueño o el administrador en Ajustes → Negocio → «🔒 Clave para cerrar la caja»:
     • Sin clave (como siempre).
     • La contraseña de quien está usando ORDEVA (la misma con la que entra en este celular).
     • Una clave solo para cerrar la caja (se guarda solo su huella, como la clave de autorización).
   Se pide a TODOS (también al dueño) al tocar «Cerrar caja del día», después de la pregunta. El cierre automático
   programado no la pide. Vive en los permisos del equipo: el servidor no deja que el equipo la cambie ni la quite.
   5 claves malas seguidas → espera 5 minutos. Cada clave mala y cada cambio quedan en la actividad del equipo. */
(function(){
  'use strict';
  const e = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const R = () => window.ventoRoles;
  const P = () => (R() && R().permisos) ? R().permisos() : {};
  const jefe = () => { try{ return !R() || R().esJefe(); }catch(x){ return true; } };
  const cfg = () => { const c = P().cierre; return c && (c.modo === 'usuario' || (c.modo === 'propia' && c.h)) ? c : null; };
  const auditar = (a, d) => { try{ window.ventoAuditar && window.ventoAuditar(a, d || ''); }catch(x){} };
  const guardar = () => { try{ saveData(); }catch(x){} };
  const BLOQ = 'vento-clave-cierre-bloqueo';
  const bloqueo = () => { try{ return JSON.parse(localStorage.getItem(BLOQ) || '{}'); }catch(x){ return {}; } };
  const usuarioLocal = () => { try{ return typeof authUser !== 'undefined' && authUser ? authUsers().find(x => x.user === authUser) || null : null; }catch(x){ return null; } };
  async function correcta(c, v){
    if(c.modo === 'propia') return (await window.ventoVentaFix.derivar(v, c.s)) === c.h;
    const u = usuarioLocal();
    return !!u && await authClaveOk(u, v);
  }
  // true = puede cerrar (sin clave puesta, o clave correcta); false = canceló o se equivocó 5 veces.
  function pedir(){
    const c = cfg(); if(!c) return Promise.resolve(true);
    if(c.modo === 'usuario' && !usuarioLocal()){ showToast('🔑 Este celular no tiene contraseña de usuario. El dueño puede poner una clave para cerrar la caja en Ajustes → Negocio.', 7000); return Promise.resolve(false); }
    const bl = bloqueo();
    if(bl.hasta && bl.hasta > Date.now()){ showToast('⏳ Demasiadas claves malas. Espera ' + Math.ceil((bl.hasta - Date.now()) / 60000) + ' min para cerrar la caja.', 5000); return Promise.resolve(false); }
    const texto = c.modo === 'propia' ? 'Escriba la clave para cerrar la caja.' : 'Escriba su contraseña de ORDEVA (la misma con la que entra' + (typeof authUser !== 'undefined' && authUser ? ', usuario <b>' + e(authUser) + '</b>' : '') + ').';
    return new Promise(res => {
      window.ventoVentaFix.ventana('<h2 style="margin:0 0 6px">🔑 Clave para cerrar la caja</h2><p style="margin:0 0 10px;font-size:15px;line-height:1.45">' + texto + '</p>' +
        '<input id="ccClave" type="password" autocomplete="off"' + (c.modo === 'propia' ? ' inputmode="numeric"' : '') + ' style="width:100%;box-sizing:border-box;font-size:20px;text-align:center;letter-spacing:3px">' +
        '<div id="ccErr" style="color:var(--brick);font-size:14px;min-height:18px;margin-top:6px"></div>' +
        '<div class="modal-actions"><button type="button" class="btn-ghost" id="ccNo">Cancelar</button><button type="button" class="btn-primary" id="ccSi">🔒 Cerrar caja</button></div>', (ov, cerrar) => {
        let listo = false; const fin = v => { if(listo) return; listo = true; cerrar(); res(v); };
        const inp = ov.querySelector('#ccClave'); setTimeout(() => inp.focus(), 50);
        ov.querySelector('#ccNo').onclick = () => fin(false);
        const ir = async () => {
          const b = ov.querySelector('#ccSi'); b.disabled = true;
          try{
            if(await correcta(c, inp.value)){ try{ localStorage.removeItem(BLOQ); }catch(x){} return fin(true); }
            const n = (bloqueo().n || 0) + 1;
            try{ localStorage.setItem(BLOQ, JSON.stringify(n >= 5 ? { n: 0, hasta: Date.now() + 5 * 60000 } : { n })); }catch(x){}
            auditar('clave para cerrar caja equivocada', '');
            if(n >= 5){ showToast('⏳ 5 claves malas: espera 5 minutos para cerrar la caja.', 5000); return fin(false); }
            ov.querySelector('#ccErr').textContent = 'Clave equivocada (' + (5 - n) + ' intento' + (5 - n === 1 ? '' : 's') + ' más).'; inp.value = ''; inp.focus();
          }finally{ b.disabled = false; }
        };
        ov.querySelector('#ccSi').onclick = ir;
        inp.onkeydown = ev => { if(ev.key === 'Enter') ir(); };
        ov.onclick = ev => { if(ev.target === ov) fin(false); };
      });
    });
  }
  // Ajustes → Negocio (solo dueño o administrador).
  function pintar(){
    const g = document.querySelector('#view-ajustes .settings-group[data-cat="negocio"]'); if(!g) return;
    let box = document.getElementById('cierreClaveBox');
    if(!jefe()){ if(box) box.remove(); return; }
    if(!box){ box = document.createElement('div'); box.id = 'cierreClaveBox'; box.className = 'settings-row'; box.style.cssText = 'flex-direction:column;align-items:stretch;gap:8px'; g.appendChild(box); }
    const c = P().cierre || {}, modo = cfg() ? c.modo : 'no';
    const op = (v, t) => '<label style="display:flex;gap:10px;align-items:center;padding:4px 2px"><input type="radio" name="ccModo" value="' + v + '"' + (modo === v ? ' checked' : '') + ' style="width:auto"> ' + t + '</label>';
    box.innerHTML = '<div class="settings-row-text"><strong>🔒 Clave para cerrar la caja</strong><span>Al tocar «Cerrar caja del día» se pide esta clave a todos (también a ti), después de la pregunta. El cierre automático programado no la pide.</span></div>' +
      op('no', 'Sin clave (como siempre)') + op('usuario', 'La contraseña de quien está usando ORDEVA (la misma con la que entra)') + op('propia', 'Una clave solo para cerrar la caja') +
      '<div id="ccPropia" style="display:' + (modo === 'propia' || c.modo === 'propia' ? 'flex' : 'none') + ';gap:8px"><input id="ccIn" type="password" inputmode="numeric" autocomplete="new-password" placeholder="' + (modo === 'propia' ? 'Nueva clave' : 'Clave (mínimo 4)') + '" style="flex:1;min-width:0"><button type="button" class="btn-ghost" id="ccGo">' + (modo === 'propia' ? 'Cambiar' : 'Guardar') + '</button></div>' +
      '<small style="opacity:.85">' + (modo === 'propia' ? '✅ Activa: se pide la clave para cerrar la caja.' : modo === 'usuario' ? '✅ Activa: se pide la contraseña de quien está usando ORDEVA.' : 'Sin clave: cualquiera que vea el botón puede cerrar la caja (con la pregunta).') + '</small>';
    box.onchange = ev => {
      const r = ev.target.closest('input[name="ccModo"]'); if(!r) return;
      if(r.value === 'propia'){ box.querySelector('#ccPropia').style.display = 'flex'; box.querySelector('#ccIn').focus(); return; }
      if(r.value === 'no'){ delete P().cierre; auditar('clave para cerrar caja quitada'); showToast('Listo: cerrar la caja ya no pide clave.'); }
      else { P().cierre = { modo: 'usuario', t: Date.now() }; auditar('clave para cerrar caja: la contraseña del usuario'); showToast('🔑 Para cerrar la caja se pedirá la contraseña de quien está usando ORDEVA.'); }
      guardar(); pintar();
    };
    box.querySelector('#ccGo').onclick = async () => {
      const v = box.querySelector('#ccIn').value.trim();
      if(v.length < 4) return showToast('La clave debe tener al menos 4 caracteres.');
      const b = box.querySelector('#ccGo'); b.disabled = true;
      try{
        const sal = [...crypto.getRandomValues(new Uint8Array(12))].map(x => x.toString(16).padStart(2, '0')).join('');
        P().cierre = { modo: 'propia', s: sal, h: await window.ventoVentaFix.derivar(v, sal), t: Date.now() };
        auditar('clave para cerrar caja puesta'); guardar(); showToast('🔑 Clave para cerrar la caja guardada.'); pintar();
      }finally{ b.disabled = false; }
    };
  }
  document.addEventListener('click', ev => { if(ev.target.closest && ev.target.closest('.ajustes-cat[data-cat="negocio"], nav button[data-view="ajustes"], .more-tile[data-go]')) setTimeout(pintar, 80); }, true);
  setTimeout(pintar, 1500);
  window.ventoCierreClave = { pedir, pintar, modo: () => { const c = cfg(); return c ? c.modo : 'no'; } };
})();
