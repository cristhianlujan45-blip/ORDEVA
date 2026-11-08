/* ORDEVA · lib/vento-bonos.js — 1.93.0: 🎁 BONOS Y TARJETAS DE REGALO.
   El saldo vive en el Servidor ORDEVA (supabase/migrations/20261201000000_bonos.sql): dos cajas no pueden gastar el mismo
   bono a la vez y cada venta lo descuenta una sola vez aunque se toque dos veces. Necesita la cuenta en la nube e internet.
     • «Más → 🎁 Bonos de regalo»: vender un bono (valor, para quién, cuántos meses dura). Sale el código para entregarlo
       o mandarlo por WhatsApp. Si se paga en efectivo, entra a la caja como «entrada» (NO es venta todavía: es plata que
       se le debe al cliente hasta que lo use). La lista con el saldo de cada uno.
     • Al cobrar: «🎁 Pagar con bono» → el código → paga todo o lo que alcance; el resto con otro medio.
     • Si la venta se deshace, el saldo vuelve al bono. */
(function(){
  'use strict';
  if(window.ventoBonos) return;
  const D = () => (typeof data !== 'undefined' ? data : null);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plata = n => { try{ return fmt(Math.round(n || 0)); }catch(e){ return '$' + Math.round(n || 0).toLocaleString('es-CO'); } };
  const toast = (t, ms) => { try{ showToast(t, ms || 5000); }catch(e){} };
  const nb = () => window.ventoNube || null;
  const neg = () => { try{ return nb() && nb().negocio ? nb().negocio() : null; }catch(e){ return null; } };
  const activo = () => !!neg();
  async function rpc(fn, args){ const c = await nb().cliente(); const r = await c.rpc(fn, args || {}); if(r.error) throw r.error; return r.data; }
  // 1.95.4: si el servidor no responde en 15 s se toma como «sin conexión» (antes «Cancelar» quedaba bloqueado para siempre).
  const conTope = (pr, ms) => Promise.race([pr, new Promise((_, no) => setTimeout(() => no(new Error('tiempo')), ms || 15000))]);
  const ERR = { no_existe: 'Ese código no existe.', sin_saldo: 'Ese bono ya no tiene saldo.', vencido: 'Ese bono está vencido.', anulado: 'Ese bono está anulado.' };
  const nuevaRef = () => 'bn' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  // ---------- En la ventana de cobro ----------
  function boton(){ return activo() ? '<button type="button" class="btn-ghost pz-bono-btn">🎁 Pagar con bono de regalo</button><div class="pz-bono-box" hidden></div>' : ''; }
  function abrir(ov, total, fin){
    const bx = ov.querySelector('.pz-bono-box'); if(!bx) return;
    bx.hidden = false;
    bx.innerHTML = '<div style="display:flex;gap:6px"><input class="mz-in pz-bono-cod" maxlength="12" placeholder="Código del bono" autocapitalize="characters" style="flex:1;text-transform:uppercase"><button type="button" class="btn-ghost pz-bono-ver">Buscar</button></div><div class="pz-bono-info"></div>';
    const info = bx.querySelector('.pz-bono-info'), inp = bx.querySelector('.pz-bono-cod');
    let bono = null, ocupado = false;
    /* 1.95.4 (auditoría M3): una sola referencia por bono en esta ventana de cobro. Si se cae la conexión y se vuelve a
       tocar, el servidor reconoce la misma referencia y no descuenta dos veces. Mientras se usa el bono, «Cancelar» espera
       (ov._ocupado), y si la ventana ya no está cuando responde el servidor, el saldo vuelve al bono. */
    const refs = ov._bonoRefs || (ov._bonoRefs = {});
    const pagar = async (resto) => {
      if(ocupado || !bono) return; ocupado = true; ov._ocupado = true;
      const ref = refs[bono.codigo] || (refs[bono.codigo] = nuevaRef());
      try{
        const r = await conTope(rpc('bono_redimir', { p_negocio: neg().id, p_codigo: bono.codigo, p_monto: total, p_ref: ref }));
        ov._ocupado = false;
        if(!r || !r.ok){ info.innerHTML = '⚠️ ' + esc(ERR[r && r.error] || 'No se pudo usar el bono.'); ocupado = false; return; }
        if(!ov.isConnected){ devolverSinVenta({ bono: { ref } }); return; }
        const usado = Number(r.usado) || 0, falta = Math.max(0, total - usado), b = { codigo: bono.codigo, ref, usado, saldo: Number(r.bono.saldo) || 0 };
        if(falta <= 0) return fin({ method: 'bono', metodo: 'bono', nota: 'Bono ' + bono.codigo, vueltas: 0, bono: b });
        const m = resto || 'efectivo';
        fin({ method: 'bono', metodo: 'mixto', nota: 'Pago mixto', vueltas: 0, bono: b,
          pagos: [{ method: 'bono', amount: usado, note: 'Bono ' + bono.codigo }, { method: m === 'efectivo' ? 'efectivo' : 'transferencia', amount: falta, note: { efectivo: 'Efectivo', nequi: 'Nequi', daviplata: 'DaviPlata', tarjeta: 'Tarjeta', transferencia: 'Transferencia' }[m] }] });
      }catch(e){ ov._ocupado = false; info.innerHTML = '⚠️ Sin conexión con el servidor: el bono necesita internet. Vuelve a tocar el botón cuando haya conexión.'; ocupado = false; }
    };
    const buscar = async () => {
      const c = inp.value.trim().toUpperCase(); if(c.length < 6){ info.textContent = 'Escribe el código completo.'; return; }
      info.textContent = 'Buscando…';
      try{
        const r = await rpc('bono_ver', { p_negocio: neg().id, p_codigo: c });
        if(!r || !r.ok){ bono = null; info.innerHTML = '⚠️ ' + esc(ERR[r && r.error] || 'No se encontró.'); return; }
        bono = r.bono; const s = Number(bono.saldo) || 0;
        if(bono.estado !== 'activo' || bono.vencido || !(s > 0)){ info.innerHTML = '⚠️ ' + esc(bono.vencido ? ERR.vencido : bono.estado !== 'activo' ? ERR.anulado : ERR.sin_saldo); bono = null; return; }
        info.innerHTML = '<div style="margin:6px 0">🎁 ' + esc(bono.codigo) + (bono.cliente ? ' · ' + esc(bono.cliente) : '') + ' · saldo <b>' + plata(s) + '</b></div>' +
          (s >= total ? '<button type="button" class="btn-primary pz-bono-ok" style="width:100%">✅ Pagar ' + plata(total) + ' con el bono (le quedan ' + plata(s - total) + ')</button>'
            : '<div>El bono paga ' + plata(s) + '. Faltan <b>' + plata(total - s) + '</b>: ¿cómo paga el resto?</div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">' +
              [['efectivo', '💵 Efectivo'], ['nequi', '💜 Nequi'], ['daviplata', '🔴 DaviPlata'], ['tarjeta', '💳 Tarjeta']].map(x => '<button type="button" class="btn-ghost" data-bresto="' + x[0] + '">' + x[1] + '</button>').join('') + '</div>');
      }catch(e){ info.textContent = '⚠️ Sin conexión con el servidor: el bono necesita internet.'; }
    };
    bx.addEventListener('click', e => {
      if(e.target.closest('.pz-bono-ver')) return buscar();
      if(e.target.closest('.pz-bono-ok')) return pagar();
      const r = e.target.closest('[data-bresto]'); if(r) return pagar(r.dataset.bresto);
    });
    inp.addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); buscar(); } });
    setTimeout(() => { try{ inp.focus(); }catch(x){} }, 50);
  }
  // Después de registrar la venta: el pago con bono guarda el código y la referencia (para devolver el saldo si se deshace).
  function marcarVenta(entry, pago){
    if(!entry || !pago || !pago.bono) return;
    const p = (entry.payments || []).find(x => x.method === 'bono'); if(!p) return;
    p.bonoRef = pago.bono.ref; p.bonoCod = pago.bono.codigo;
    try{ saveData(); }catch(e){}
  }
  // 1.95.4 (M3): el bono se descontó pero la venta no se registró (la cuenta cambió o ya no estaba): el saldo vuelve.
  // Si no hay conexión, la devolución queda guardada en este equipo y se reintenta sola (cada minuto y al volver internet).
  const PEND = 'vento_bonos_devolver';
  const pendientes = () => { try{ const l = JSON.parse(localStorage.getItem(PEND) || '[]'); return Array.isArray(l) ? l : []; }catch(e){ return []; } };
  const guardarPend = l => { try{ localStorage.setItem(PEND, JSON.stringify(l.slice(-50))); }catch(e){} };
  async function devolverRef(ref, callado){
    if(!ref || !activo()) return false;
    try{ const r = await conTope(rpc('bono_devolver', { p_negocio: neg().id, p_ref: ref })); guardarPend(pendientes().filter(x => x.ref !== ref));
      if(!callado || (r && r.devueltos > 0)) toast('🎁 No se cobró: el saldo volvió al bono.'); return true; }
    catch(e){ const l = pendientes(); if(!l.some(x => x.ref === ref)) l.push({ ref, n: neg().id, at: Date.now() }); guardarPend(l);
      toast('⚠️ No se pudo devolver el saldo del bono ahora (sin conexión). ORDEVA lo reintenta solo cuando vuelva internet.', 8000); return false; }
  }
  async function reintentar(){ const n = neg(); if(!n || navigator.onLine === false) return; for(const x of pendientes()) if(x.n === n.id && Date.now() - x.at < 30 * 864e5) await devolverRef(x.ref, true); }
  setInterval(() => { try{ reintentar(); }catch(e){} }, 60000);
  window.addEventListener('online', () => { try{ reintentar(); }catch(e){} });
  function devolverSinVenta(pago){ return devolverRef(pago && pago.bono && pago.bono.ref, false); }
  // Al cerrarse la ventana de cobro: cada bono que se intentó y NO quedó en la venta se devuelve (el servidor no hace nada
  // si de verdad no se descontó). Cubre el caso de «se descontó pero la respuesta se perdió» y luego se pagó con otra cosa.
  function alCerrarCobro(ov, r){ const refs = (ov && ov._bonoRefs) || {}, usado = r && r.bono && r.bono.ref; Object.keys(refs).forEach(k => { if(refs[k] !== usado) devolverRef(refs[k], true); }); }
  // Se deshizo una venta: los bonos que pagó vuelven a tener su saldo.
  async function alDeshacer(entry){
    const refs = [...new Set(((entry && entry.payments) || []).filter(p => p.method === 'bono' && p.bonoRef).map(p => p.bonoRef))];
    for(const ref of refs){ if(await devolverRef(ref, true)) toast('🎁 El saldo volvió al bono.'); }
  }

  // ---------- Vender bonos y verlos ----------
  async function panel(){
    if(!activo()){ toast('🎁 Los bonos necesitan la cuenta de ORDEVA en la nube (Ajustes → Mi cuenta y mi equipo).', 7000); return; }
    document.querySelectorAll('.bn-ov').forEach(o => o.remove());
    const ov = document.createElement('div'); ov.className = 'overlay show cm-ov bn-ov'; ov.setAttribute('data-novocab', '');
    ov.innerHTML = '<div class="modal cm" role="dialog" aria-modal="true"><h2 style="margin:0 0 4px">🎁 Bonos de regalo</h2>' +
      '<div class="modal-sub">Vender un bono no es una venta todavía: es plata del cliente hasta que lo use. Cuando lo use, ahí sí es venta.</div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap"><input class="mz-in bn-valor" inputmode="numeric" placeholder="Valor (ej. 50000)" style="flex:1;min-width:120px"><input class="mz-in bn-cli" maxlength="60" placeholder="Para quién (opcional)" style="flex:1;min-width:120px"></div>' +
      '<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;align-items:center"><select class="mz-in bn-meses"><option value="6">Vence en 6 meses</option><option value="12">Vence en 1 año</option><option value="3">Vence en 3 meses</option><option value="0">No vence</option></select>' +
      '<select class="mz-in bn-pago"><option value="efectivo">Paga en efectivo (entra a la caja)</option><option value="otro">Paga con Nequi, tarjeta…</option></select></div>' +
      '<button type="button" class="btn-primary bn-crear" style="width:100%;margin-top:8px">🎁 Crear el bono</button><div class="bn-hecho"></div>' +
      '<div class="hist-detail-title" style="margin-top:12px">Bonos</div><div class="bn-lista">Cargando…</div>' +
      '<div class="modal-actions"><button type="button" class="btn-ghost" data-bn="cerrar">Cerrar</button></div></div>';
    document.body.appendChild(ov);
    const lista = async () => {
      try{
        const l = await rpc('bono_lista', { p_negocio: neg().id }) || [];
        ov.querySelector('.bn-lista').innerHTML = l.length ? l.slice(0, 100).map(b => '<div style="display:flex;gap:8px;border-top:1px solid var(--line,#ddd);padding:5px 0"><b style="font-family:monospace">' + esc(b.codigo) + '</b><span style="flex:1">' + esc(b.cliente || '') + (b.vencido ? ' · vencido' : '') + '</span><span>' + plata(b.saldo) + ' de ' + plata(b.valor) + '</span></div>').join('') : '<div class="modal-sub">Todavía no hay bonos.</div>';
      }catch(e){ ov.querySelector('.bn-lista').textContent = '⚠️ Sin conexión con el servidor.'; }
    };
    ov.addEventListener('click', async ev => {
      if(ev.target === ov || ev.target.closest('[data-bn="cerrar"]')) return ov.remove();
      if(!ev.target.closest('.bn-crear')) return;
      const v = Math.round(Number(String(ov.querySelector('.bn-valor').value).replace(/[^\d]/g, '')) || 0);
      if(!(v >= 1000)) return toast('Escribe el valor del bono.');
      const btn = ov.querySelector('.bn-crear'); btn.disabled = true;
      try{
        const b = await rpc('bono_crear', { p_negocio: neg().id, p_valor: v, p_cliente: ov.querySelector('.bn-cli').value.trim() || null, p_meses: Number(ov.querySelector('.bn-meses').value) || 0 });
        if(ov.querySelector('.bn-pago').value === 'efectivo' && window.ventoTurno) window.ventoTurno.movimiento('entrada', v, 'Venta de bono de regalo ' + b.codigo);
        try{ window.ventoAuditar && window.ventoAuditar('bono vendido', b.codigo + ' · ' + plata(v)); }catch(x){}
        const d = D() || {}, msg = '🎁 Bono de regalo de ' + (d.businessName || 'nuestro negocio') + (b.cliente ? ' para ' + b.cliente : '') + ': ' + plata(v) + '. Código: ' + b.codigo + (b.vence ? ' (válido hasta ' + b.vence + ')' : '') + '.';
        ov.querySelector('.bn-hecho').innerHTML = '<div style="text-align:center;margin:10px 0"><div style="font-size:13px">Código del bono</div><div style="font:800 30px/1.2 monospace;letter-spacing:3px">' + esc(b.codigo) + '</div>' +
          '<a class="btn-ghost" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(msg) + '" style="text-decoration:none;display:inline-block;margin-top:6px">📲 Enviar por WhatsApp</a></div>';
        ov.querySelector('.bn-valor').value = ''; ov.querySelector('.bn-cli').value = '';
        lista();
      }catch(e){ toast('⚠️ No se pudo crear el bono (revisa el internet).'); }
      finally{ btn.disabled = false; }
    });
    lista();
  }
  function casilla(){
    const g = document.querySelector('#navMoreSheet .more-grid'); if(!g || g.querySelector('[data-go="bonos"]')) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'more-tile'; b.dataset.go = 'bonos';
    b.innerHTML = '<span class="more-ic">🎁</span><strong>Bonos de regalo</strong><small>Vender y ver tarjetas de regalo</small>';
    const ref = g.querySelector('[data-go="calculadora"]'); g.insertBefore(b, ref || null);
    b.addEventListener('click', ev => { ev.stopPropagation(); const o = document.getElementById('navMoreSheet'); if(o) o.classList.remove('show'); panel(); }, true);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', casilla); else casilla();
  setTimeout(casilla, 1600);

  window.ventoBonos = { devolverSinVenta, alCerrarCobro, pendientes, activo, boton, abrir, marcarVenta, alDeshacer, panel };
})();
