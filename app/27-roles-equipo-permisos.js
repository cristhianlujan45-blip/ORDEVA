/* ORDEVA · app/27-roles-equipo-permisos.js — antes estaba dentro de index.html (línea 32958). Se carga en el mismo lugar y orden. */
/* ================= Roles del equipo y permisos =================
   • Dueño y administrador (segundo administrador, lo asigna solo el dueño): todo. Lo que hace cada uno queda en la
     actividad del equipo (solo el dueño la ve: «📜 Actividad del equipo»).
   • Cajero, empleado y mesero: lo de su trabajo (vender, mesas, pedidos, música, carta). NO ven estadísticas,
     contabilidad, historial ni ajustes, ni cambian productos, precios o inventario, salvo lo que el dueño o el
     administrador les permitan en «👥 Permisos del equipo» (por rol).
   • El «empleado» se llama según el negocio: vendedor, asesor de ventas, médico, barbero, estilista, técnico… */
(function(){
  'use strict';
  const EMP_TIPO = { barberia: 'Barbero', salon_belleza: 'Estilista', estetica: 'Esteticista', manicure: 'Manicurista', gimnasio: 'Entrenador',
    tatuajes: 'Tatuador', peluqueria_canina: 'Peluquero', consultorio: 'Médico', odontologia: 'Odontólogo', psicologia: 'Psicólogo',
    fisioterapia: 'Fisioterapeuta', veterinaria: 'Veterinario', optica: 'Optómetra', laboratorio: 'Bacteriólogo', mecanico: 'Mecánico',
    montallantas: 'Montallantero', servicio_tecnico: 'Técnico', lavadero: 'Lavador', abogado: 'Asesor', fotografia: 'Fotógrafo', sastreria: 'Modista',
    zapateria: 'Zapatero', cerrajeria: 'Cerrajero', imprenta: 'Diseñador', ropa: 'Asesor de ventas', ropa_segunda: 'Asesor de ventas', cosmeticos: 'Asesor de ventas',
    joyeria: 'Asesor de ventas', drogueria: 'Auxiliar de droguería', academia: 'Profesor', escuela_conduccion: 'Instructor', yoga: 'Instructor',
    guarderia: 'Profesor', hotel: 'Recepcionista', hostal: 'Recepcionista', motel: 'Recepcionista', apartamentos: 'Anfitrión', salon_eventos: 'Coordinador',
    distribuidora: 'Vendedor de ruta', discoteca: 'Bartender', karaoke: 'Bartender', bar: 'Mesero', parqueadero: 'Operador', cancha: 'Encargado' };
  const EMP_FAM = { comida: 'Mesero', bar: 'Mesero', tienda: 'Vendedor', servicio: 'Estilista', orden: 'Técnico', salud: 'Profesional', aloja: 'Recepcionista',
    ocio: 'Encargado', educa: 'Profesor', otro: 'Empleado' };
  const plural = t => { const w = String(t).split(' '); w[0] = /[aeiouáéíóú]$/i.test(w[0]) ? w[0] + 's' : w[0] + 'es'; return w.join(' ').replace(/ónes\b/, 'ones'); };
  function tipoActual(){ try{ return (typeof tipoNegocio === 'function' && tipoNegocio()) || null; }catch(e){ return null; } }
  function empleadoNombre(pl){
    const t = tipoActual(), k = t ? t.k : (typeof data !== 'undefined' && data && data.businessType) || '';
    const n = EMP_TIPO[k] || (t && EMP_FAM[t.fam]) || 'Empleado';
    return pl ? plural(n) : n;
  }
  function rolNombre(r, pl){
    const m = { dueno: ['Dueño', 'Dueños'], admin: ['Administrador', 'Administradores'], cajero: ['Cajero', 'Cajeros'], mesero: ['Mesero', 'Meseros'] };
    if(r === 'empleado') return empleadoNombre(pl);
    return (m[r] || [r, r])[pl ? 1 : 0];
  }
  // Rol de quien usa este equipo: el de su cuenta de ORDEVA (si entró con ella) o el del usuario local.
  function rol(){
    try{ if(window.ventoNube && typeof authUser !== 'undefined' && authUser && window.ventoNube.correo() === authUser) return window.ventoNube.rolActivo() || 'dueno'; }catch(e){}
    try{ const u = authUsers().find(x => x.user === authUser); if(!u || u.role === 'admin') return 'dueno'; return u.role === 'empleado' ? 'empleado' : u.role === 'cajero' ? 'cajero' : 'mesero'; }catch(e){ return 'dueno'; }
  }
  const esJefe = () => { const r = rol(); return r === 'dueno' || r === 'admin'; };
  const PERMISOS = [
    ['historial', '📜', 'Ver el historial completo (todos los días y los totales)'],
    ['productos', '✏️', 'Crear y editar productos y precios'],
    ['inventario', '📦', 'Ver y ajustar el inventario'],
    ['estadisticas', '📊', 'Ver las estadísticas del negocio'],
    ['contabilidad', '📒', 'Ver la contabilidad y los gastos']
  ];
  const ROLES_EQUIPO = ['cajero', 'empleado', 'mesero'];
  function permisos(){ if(typeof data === 'undefined' || !data) return {}; if(!data.permisosEquipo || typeof data.permisosEquipo !== 'object') data.permisosEquipo = {}; return data.permisosEquipo; }
  function puede(p){ if(esJefe()) return true; const r = rol(); return !!((permisos()[r] || {})[p]); }
  let ultimo = '';
  function aplicar(){
    if(typeof data === 'undefined' || !data || typeof authUser === 'undefined' || !authUser) return;
    const equipo = !esJefe(), b = document.body;
    const clave = rol() + '|' + PERMISOS.map(x => puede(x[0]) ? 1 : 0).join('') + '|' + ((permisos().clave || {}).h ? 1 : 0);
    b.classList.toggle('rol-equipo', equipo);
    // El historial lo ve todo el equipo, pero sin permiso solo las ventas de HOY y sin totales («hist-hoy»).
    PERMISOS.forEach(x => b.classList.toggle('no-' + x[0], equipo && x[0] !== 'historial' && !puede(x[0])));
    const hh = equipo && !puede('historial');
    if(b.classList.contains('hist-hoy') !== hh){ b.classList.toggle('hist-hoy', hh); try{ const v = document.getElementById('view-historial'); if(v && v.classList.contains('active') && typeof renderHistorial === 'function') renderHistorial(); }catch(e){} }
    if(equipo){
      const act = document.querySelector('nav button.active'), v = act && act.dataset.view;
      if(v && (v === 'ajustes' || (v !== 'historial' && PERMISOS.some(x => x[0] === v) && !puede(v)))){ const m = document.querySelector('nav button[data-view="mesas"]'); if(m) m.click(); }
    }
    if(clave !== ultimo){ ultimo = clave; pintarPanel(); }
  }
  // Panel del dueño / administrador: Ajustes → Negocio → «👥 Permisos del equipo»
  function pintarPanel(){
    const g = document.querySelector('#view-ajustes .settings-group[data-cat="negocio"]'); if(!g) return;
    let box = document.getElementById('permisosEquipo');
    if(!esJefe()){ if(box) box.remove(); return; }
    if(!box){ box = document.createElement('div'); box.id = 'permisosEquipo'; box.className = 'settings-row'; box.style.cssText = 'flex-direction:column;align-items:stretch;gap:8px'; g.appendChild(box); }
    const P = permisos(), e = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    box.innerHTML = '<div class="settings-row-text"><strong>👥 Permisos del equipo</strong><span>Tu equipo (' + e(rolNombre('cajero', true).toLowerCase()) + ', ' + e(rolNombre('empleado', true).toLowerCase()) + ' y ' +
      e(rolNombre('mesero', true).toLowerCase()) + ') vende y atiende y ve las ventas de HOY (sin totales), pero NO ve las estadísticas, la contabilidad, el historial completo ni los ajustes, ni cambia productos o inventario. Aquí decides qué más puede hacer cada uno. Para corregir, liberar o borrar una venta necesita tu <b>clave de autorización</b>. Todo lo que hagan queda en la actividad del equipo.</span></div>' +
      '<div id="claveAutBox" style="display:flex;flex-direction:column;gap:6px;padding:8px 0"><b>🔑 Clave de autorización</b><small style="opacity:.8">' + (P.clave && P.clave.h ? '✅ Activa. Tu equipo la necesita para corregir, liberar o borrar una venta.' : 'Sin clave: tu equipo no puede corregir ni borrar ventas.') + '</small>' +
      '<div style="display:flex;gap:8px"><input id="claveAutIn" type="password" inputmode="numeric" autocomplete="new-password" placeholder="' + (P.clave && P.clave.h ? 'Nueva clave' : 'Clave (mínimo 4)') + '" style="flex:1;min-width:0"><button type="button" class="btn-ghost" id="claveAutGo">' + (P.clave && P.clave.h ? 'Cambiar' : 'Guardar') + '</button>' + (P.clave && P.clave.h ? '<button type="button" class="btn-ghost" id="claveAutQuitar">Quitar</button>' : '') + '</div></div>' +
      ROLES_EQUIPO.map(r => '<details' + (r === 'empleado' ? ' open' : '') + '><summary style="font-weight:700;cursor:pointer;padding:6px 0">' + e(rolNombre(r, true)) + '</summary>' +
        PERMISOS.map(x => '<label style="display:flex;gap:10px;align-items:center;padding:6px 2px"><input type="checkbox" data-perm="' + r + '.' + x[0] + '"' + ((P[r] || {})[x[0]] ? ' checked' : '') + ' style="width:auto"> ' + x[1] + ' ' + e(x[2]) + '</label>').join('') + '</details>').join('');
    const cg = box.querySelector('#claveAutGo');
    if(cg) cg.onclick = async () => {
      const v = box.querySelector('#claveAutIn').value.trim();
      if(v.length < 4) return showToast('La clave debe tener al menos 4 caracteres.');
      cg.disabled = true;
      try{ await window.ventoVentaFix.ponerClave(v); showToast('🔑 Clave de autorización guardada.'); ultimo = ''; aplicar(); }finally{ cg.disabled = false; }
    };
    const cq = box.querySelector('#claveAutQuitar');
    if(cq) cq.onclick = () => { delete permisos().clave; try{ window.ventoAuditar && window.ventoAuditar('clave de autorización quitada', ''); }catch(x){} try{ saveData(); }catch(x){} showToast('Clave quitada: el equipo ya no puede corregir ni borrar ventas.'); ultimo = ''; aplicar(); };
    box.onchange = ev => {
      const c = ev.target.closest('[data-perm]'); if(!c) return;
      const [r, p] = c.dataset.perm.split('.');
      const P2 = permisos(); P2[r] = P2[r] || {}; P2[r][p] = c.checked;
      try{ window.ventoAuditar && window.ventoAuditar('permiso ' + (c.checked ? 'dado' : 'quitado'), rolNombre(r, true) + ': ' + (PERMISOS.find(x => x[0] === p) || [p, '', p])[2]); }catch(x){}
      try{ saveData(); }catch(x){}
      showToast((c.checked ? '✅ ' : '🚫 ') + rolNombre(r, true) + ': ' + (PERMISOS.find(x => x[0] === p) || [p, '', p])[2].toLowerCase());
    };
  }
  const soloHoy = () => { try{ return typeof authUser !== 'undefined' && !!authUser && !esJefe() && !puede('historial'); }catch(e){ return false; } };
  window.ventoRoles = { rol, esJefe, puede, aplicar, rolNombre, empleadoNombre, PERMISOS, soloHoy, permisos };
  window.ventoRolNombre = rolNombre;
  setInterval(aplicar, 2000);
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('nav button[data-view], .more-tile[data-go]'); if(b) setTimeout(aplicar, 50); }, true);
})();
