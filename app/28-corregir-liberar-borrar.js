/* ORDEVA · app/28-corregir-liberar-borrar.js — antes estaba dentro de index.html (línea 33173). Se carga en el mismo lugar y orden. */
/* ================= Corregir, liberar o borrar una venta (Historial) =================
   • Dueño y administrador: directo (con confirmación).
   • Equipo (empleado, cajero, mesero): solo con la CLAVE DE AUTORIZACIÓN que pone el dueño en Ajustes → Negocio →
     «👥 Permisos del equipo». Se pide en el celular del empleado en el momento. Sin clave puesta, no puede.
     5 claves malas seguidas → espera 5 minutos.
   • Corregir: cambiar cantidades, quitar productos o cambiar el medio de pago (el total y el inventario se ajustan).
   • Liberar: la venta vuelve a su mesa/cuenta para cobrarla bien (el inventario no cambia: ya estaba descontado).
   • Borrar: la venta sale del historial y lo vendido vuelve al inventario.
   Todo queda en la actividad del equipo (quién, qué y que fue autorizado con la clave). */
(function(){
  'use strict';
  const e = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const jefe = () => { try{ return !window.ventoRoles || window.ventoRoles.esJefe(); }catch(x){ return true; } };
  const P = () => (window.ventoRoles && window.ventoRoles.permisos) ? window.ventoRoles.permisos() : {};
  const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  async function derivar(clave, sal){
    const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(clave)), 'PBKDF2', false, ['deriveBits']);
    return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(sal), iterations: 150000, hash: 'SHA-256' }, k, 256));
  }
  async function ponerClave(v){
    const sal = hex(crypto.getRandomValues(new Uint8Array(12)));
    P().clave = { s: sal, h: await derivar(v, sal), t: Date.now() };
    try{ window.ventoAuditar && window.ventoAuditar('clave de autorización puesta', ''); }catch(x){}
    try{ saveData(); }catch(x){}
  }
  const BLOQ = 'vento-clave-aut-bloqueo';
  function bloqueo(){ try{ return JSON.parse(localStorage.getItem(BLOQ) || '{}'); }catch(x){ return {}; } }
  // Ventanita propia (por encima de todo) para pedir la clave o para corregir.
  function ventana(html, alAbrir){
    let ov = document.getElementById('vfOv');
    if(!ov){ ov = document.createElement('div'); ov.id = 'vfOv'; ov.className = 'overlay'; ov.setAttribute('data-novocab', ''); ov.style.zIndex = '10055'; document.body.appendChild(ov); }
    ov.innerHTML = '<div class="modal" role="dialog" aria-modal="true" style="max-width:420px;width:100%;max-height:calc(100vh - 32px);overflow:auto">' + html + '</div>';
    ov.classList.add('show');
    const cerrar = () => ov.classList.remove('show');
    ov.onclick = ev => { if(ev.target === ov) cerrar(); };
    alAbrir(ov, cerrar);
  }
  // Autorización: el jefe pasa directo; el equipo escribe la clave del dueño.
  function autorizar(que){
    if(jefe()) return Promise.resolve('jefe');
    const c = P().clave;
    if(!c || !c.h){ showToast('🔑 Para ' + que + ' necesitas la clave de autorización del dueño, y todavía no la ha puesto (Ajustes → Negocio → Permisos del equipo).', 7000); return Promise.resolve(null); }
    const bl = bloqueo();
    if(bl.hasta && bl.hasta > Date.now()){ showToast('⏳ Demasiadas claves malas. Espera ' + Math.ceil((bl.hasta - Date.now()) / 60000) + ' min.', 5000); return Promise.resolve(null); }
    return new Promise(res => {
      ventana('<h2 style="margin:0 0 6px">🔑 Clave de autorización</h2><p style="margin:0 0 10px;font-size:14px;line-height:1.45">Para ' + e(que) + ' pídele al dueño o al administrador que escriba su clave aquí.</p>' +
        '<input id="vfClave" type="password" inputmode="numeric" autocomplete="off" style="width:100%;box-sizing:border-box;font-size:18px;text-align:center;letter-spacing:3px"><div id="vfErr" style="color:var(--brick);font-size:13px;min-height:18px;margin-top:6px"></div>' +
        '<div class="modal-actions"><button type="button" class="btn-ghost" id="vfNo">Cancelar</button><button type="button" class="btn-primary" id="vfSi">Autorizar</button></div>', (ov, cerrar) => {
        let listo = false; const fin = v => { if(listo) return; listo = true; cerrar(); res(v); };
        const inp = ov.querySelector('#vfClave'); setTimeout(() => inp.focus(), 50);
        ov.querySelector('#vfNo').onclick = () => fin(null);
        const ir = async () => {
          const b = ov.querySelector('#vfSi'); b.disabled = true;
          try{
            const ok = (await derivar(inp.value, c.s)) === c.h;
            if(ok){ try{ localStorage.removeItem(BLOQ); }catch(x){} return fin('clave'); }
            const n = (bloqueo().n || 0) + 1;
            try{ localStorage.setItem(BLOQ, JSON.stringify(n >= 5 ? { n: 0, hasta: Date.now() + 5 * 60000 } : { n })); }catch(x){}
            try{ window.ventoAuditar && window.ventoAuditar('clave de autorización equivocada', 'Al intentar ' + que); }catch(x){}
            if(n >= 5){ showToast('⏳ 5 claves malas: espera 5 minutos.', 5000); return fin(null); }
            ov.querySelector('#vfErr').textContent = 'Clave equivocada (' + (5 - n) + ' intento' + (5 - n === 1 ? '' : 's') + ' más).'; inp.value = ''; inp.focus();
          }finally{ b.disabled = false; }
        };
        ov.querySelector('#vfSi').onclick = ir;
        inp.onkeydown = ev => { if(ev.key === 'Enter') ir(); };
        ov.onclick = ev => { if(ev.target === ov) fin(null); };
      });
    });
  }
  const venta = id => (data.history || []).find(h => String(h.id) === String(id));
  const nombreVenta = h => (h.tableName || (h.table != null ? ((typeof espacioN === 'function' ? espacioN() : 'Mesa') + ' ' + h.table) : 'Venta')) + ' · ' + fmt(h.total);
  const quien = como => (typeof authUser !== 'undefined' && authUser ? authUser : '—') + (como === 'clave' ? ' (autorizado con la clave del dueño)' : '');
  function stock(nombre, d){
    if(!d) return;
    const p = (data.products || []).find(x => x.name === nombre);
    if(p && p.stock != null && p.stock !== '' && isFinite(+p.stock)) p.stock = +p.stock + d;
  }
  function refrescar(){ try{ renderHistorial(); }catch(x){} try{ typeof renderTables === 'function' && renderTables(); }catch(x){} }
  async function borrar(h){
    const como = await autorizar('borrar la venta ' + nombreVenta(h)); if(!como) return;
    if(!await showConfirm({ title: '¿Borrar esta venta?', message: nombreVenta(h) + '\nSale del historial y lo vendido vuelve al inventario. Queda anotado en la actividad del equipo.', confirmText: 'Sí, borrar', icon: '🗑️' })) return;
    data.history = data.history.filter(x => x !== h);
    try{ window.ventoDian && window.ventoDian.alBorrar(h); }catch(x){}   // 🧾 nota crédito si ya estaba en la DIAN
    (h.items || []).forEach(it => stock(it.name, +it.qty || 0));
    try{ window.ventoAuditar && window.ventoAuditar('venta borrada a mano', nombreVenta(h) + ' · ' + (h.items || []).map(i => i.qty + ' ' + i.name).join(', ') + ' · por ' + quien(como)); }catch(x){ saveData(); }
    refrescar(); showToast('🗑️ Venta borrada.');
  }
  async function liberar(h){
    const t = data.tables && data.tables[h.table];
    if(!t){ showToast('Esa venta no tiene una mesa o cuenta a donde volver.'); return; }
    if((t.items || []).length){ showToast('⚠️ ' + (typeof tableLabel === 'function' ? tableLabel(h.table) : 'La mesa') + ' tiene una cuenta abierta: cóbrala o vacíala antes de liberar esta venta.', 7000); return; }
    const como = await autorizar('liberar la venta ' + nombreVenta(h)); if(!como) return;
    if(!await showConfirm({ title: '¿Liberar esta venta?', message: nombreVenta(h) + '\nVuelve a ' + (typeof tableLabel === 'function' ? tableLabel(h.table) : 'su mesa') + ' para cobrarla bien. El inventario no cambia.', confirmText: 'Sí, liberar', icon: '🔓' })) return;
    t.items = (h.items || []).map(it => { const p = (data.products || []).find(x => x.name === it.name); return { productId: p ? p.id : null, name: it.name, price: it.price, size: '', qty: it.qty, personId: null, history: [] }; });
    t.payments = []; if(h.tableName && !t.name) t.name = h.tableName;
    data.history = data.history.filter(x => x !== h);
    try{ window.ventoDian && window.ventoDian.alLiberar(h); }catch(x){}   // 🧾 al cobrarla de nuevo sale otro documento
    try{ window.ventoAuditar && window.ventoAuditar('venta liberada', nombreVenta(h) + ' volvió a la cuenta · por ' + quien(como), [h.table]); }catch(x){ saveData(); }
    refrescar(); showToast('🔓 La venta volvió a su cuenta: cóbrala de nuevo.');
  }
  async function corregir(h){
    const como = await autorizar('corregir la venta ' + nombreVenta(h)); if(!como) return;
    const its = (h.items || []).map(it => Object.assign({}, it));
    const pagos = h.payments || [], unPago = pagos.length === 1;
    const metodos = Object.assign({}, typeof methodLabelHist === 'object' ? methodLabelHist : { efectivo: 'Efectivo', debe: 'Debe' });
    if(unPago && pagos[0].method && !metodos[pagos[0].method]) metodos[pagos[0].method] = pagos[0].method;
    ventana('<h2 style="margin:0 0 4px">✏️ Corregir venta</h2><p style="margin:0 0 10px;font-size:13.5px;opacity:.85">' + e(nombreVenta(h)) + '. Cambia las cantidades (0 = quitar).</p>' +
      its.map((it, i) => '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--line)"><span style="flex:1;min-width:0">' + e(it.name) + ' <small style="opacity:.7">' + fmt(it.price) + '</small></span><input data-q="' + i + '" type="number" min="0" step="1" value="' + (+it.qty || 0) + '" style="width:72px;text-align:center"></div>').join('') +
      (unPago ? '<label style="display:flex;flex-direction:column;gap:4px;margin-top:10px;font-size:13px">Medio de pago<select id="vfMetodo">' + Object.keys(metodos).map(k => '<option value="' + e(k) + '"' + (k === pagos[0].method ? ' selected' : '') + '>' + e(metodos[k]) + '</option>').join('') + '</select></label>' : '') +
      '<div id="vfTotal" style="font-weight:800;font-size:17px;margin:12px 0 4px"></div>' +
      '<div class="modal-actions"><button type="button" class="btn-ghost" id="vfNo">Cancelar</button><button type="button" class="btn-primary" id="vfSi">Guardar corrección</button></div>', (ov, cerrar) => {
      const qs = () => its.map((it, i) => Math.max(0, Math.round(+ov.querySelector('[data-q="' + i + '"]').value || 0)));
      const total = () => qs().reduce((s, q, i) => s + q * its[i].price, 0);
      const pinta = () => { ov.querySelector('#vfTotal').textContent = 'Total: ' + fmt(h.total) + ' → ' + fmt(total()); };
      ov.addEventListener('input', pinta); pinta();
      ov.querySelector('#vfNo').onclick = cerrar;
      ov.querySelector('#vfSi').onclick = () => {
        const q = qs(), antes = (h.items || []).map(i => i.qty + ' ' + i.name).join(', '), totAntes = h.total, nuevo = total();
        const metodoAntes = unPago ? pagos[0].method : null, metodo = unPago ? ov.querySelector('#vfMetodo').value : null;
        its.forEach((it, i) => stock(it.name, (+it.qty || 0) - q[i]));
        h.items = its.map((it, i) => Object.assign(it, { qty: q[i] })).filter(it => it.qty > 0);
        h.total = nuevo;
        if(unPago){ pagos[0].amount = nuevo; pagos[0].method = metodo; }
        else if(pagos.length){ const dif = nuevo - totAntes, last = pagos[pagos.length - 1]; last.amount = Math.max(0, (+last.amount || 0) + dif); }
        h.debt = pagos.filter(p => p.method === 'debe').reduce((s, p) => s + (+p.amount || 0), 0);
        h.corregida = { t: Date.now(), por: typeof authUser !== 'undefined' ? authUser : null };
        try{ window.ventoDian && window.ventoDian.alCorregir(h); }catch(x){}   // 🧾 nota crédito del documento viejo + el nuevo
        if(!h.items.length){ data.history = data.history.filter(x => x !== h); }
        cerrar();
        try{ window.ventoAuditar && window.ventoAuditar('venta corregida', (h.tableName || 'Venta') + ': ' + antes + ' (' + fmt(totAntes) + ') → ' + (h.items.map(i => i.qty + ' ' + i.name).join(', ') || 'nada') + ' (' + fmt(nuevo) + ')' + (metodo && metodo !== metodoAntes ? ' · pago ' + metodoAntes + ' → ' + metodo : '') + ' · por ' + quien(como)); }catch(x){ saveData(); }
        refrescar(); showToast('✅ Venta corregida.');
      };
    });
  }
  window.ventoVentaFix = function(accion, id){
    const h = venta(id); if(!h){ showToast('No encontré esa venta.'); return; }
    if(accion === 'borrar') return borrar(h);
    if(accion === 'liberar') return liberar(h);
    if(accion === 'devolver'){ return autorizar('hacer una devolución de ' + nombreVenta(h)).then(como => { if(como && window.ventoInventario) window.ventoInventario.devolucion(h); }); }
    return corregir(h);
  };
  window.ventoVentaFix.ponerClave = ponerClave;
  window.ventoVentaFix.autorizar = autorizar;
  window.ventoVentaFix.derivar = derivar;
  window.ventoVentaFix.ventana = ventana;
})();
