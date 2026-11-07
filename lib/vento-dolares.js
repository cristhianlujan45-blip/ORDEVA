/* ORDEVA · lib/vento-dolares.js — 1.90.0: 💵 Cobrar en DÓLARES (turistas: hoteles, bares, restaurantes, agencias).
   • Ajustes → Pagos → «💵 Dólares»: se prende y se pone la tasa del día (cuántos pesos vale un dólar).
   • En la ventana de cobro sale «💵 Dólares»: el total en dólares, cuántos entrega el cliente (con billetes de 1, 5, 10,
     20, 50 y 100) y las VUELTAS EN PESOS.
   • La venta queda en pesos (lo que vale), con el pago «usd» que guarda los dólares, la tasa y las vueltas en pesos.
     El arqueo de la caja resta esas vueltas (salieron del efectivo en pesos) y los dólares salen aparte en el cierre. */
(function(){
  'use strict';
  if(window.ventoDolares) return;
  const D = () => (typeof data !== 'undefined' ? data : null);
  const plata = n => { try{ return fmt(Math.round(n || 0)); }catch(e){ return '$' + Math.round(n || 0).toLocaleString('es-CO'); } };
  const usdTxt = n => 'US$ ' + (Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
  const cfg = () => { const d = D() || {}, c = d.usdCfg || {}; return { on: !!c.on, tasa: Math.max(0, Math.round(Number(c.tasa) || 0)), at: c.at || 0 }; };
  const activo = () => { const c = cfg(); return c.on && c.tasa >= 100; };
  // El total en dólares, redondeado hacia arriba al medio dólar (que no se pierda plata por el redondeo).
  const usdDe = cop => { const t = cfg().tasa; return t ? Math.ceil(cop / t * 2) / 2 : 0; };

  // ---------- En la ventana de cobro (lib/vento-pos.js → elegirPago) ----------
  function boton(){ return activo() ? '<button type="button" class="btn-ghost pz-usd-btn">💵 Cobrar en dólares <small>(1 US$ = ' + plata(cfg().tasa) + ')</small></button><div class="pz-usd-box" hidden></div>' : ''; }
  function abrir(ov, total, fin){
    const bx = ov.querySelector('.pz-usd-box'); if(!bx) return;
    const t = cfg().tasa, aPagar = usdDe(total);
    let usd = 0;
    bx.innerHTML = '<div class="pz-usd-tot">Total en dólares: <b>' + usdTxt(aPagar) + '</b> <small>(' + plata(total) + ')</small></div>' +
      '<label class="pz-vu-l">¿CUÁNTOS DÓLARES ENTREGA?</label><input class="mz-in pz-usd-in" type="number" inputmode="decimal" min="0" step="1" placeholder="0" style="width:100%;font-size:20px;text-align:center">' +
      '<div class="pz-billetes">' + [1, 5, 10, 20, 50, 100].map(b => '<button type="button" data-usd="' + b + '">+' + b + '</button>').join('') + '<button type="button" data-usd="0" aria-label="Borrar">↺</button></div>' +
      '<div class="pz-usd-vu"></div><button type="button" class="btn-primary pz-usd-ok" disabled style="width:100%">✅ Cobrar en dólares</button>';
    bx.hidden = false;
    const inp = bx.querySelector('.pz-usd-in'), vu = bx.querySelector('.pz-usd-vu'), ok = bx.querySelector('.pz-usd-ok');
    const pintar = () => {
      const cop = Math.round(usd * t), falta = total - cop;
      ok.disabled = !(usd > 0) || falta > 0;
      vu.innerHTML = !usd ? '<small>Escribe o toca los billetes en dólares que entrega.</small>'
        : falta > 0 ? '⚠️ Faltan <b>' + plata(falta) + '</b> (' + usdTxt(falta / t) + ')'
        : (cop - total ? 'Vueltas EN PESOS: <b>' + plata(cop - total) + '</b>' : '<b>✅ Pago exacto</b>');
    };
    inp.oninput = () => { usd = Math.max(0, Math.round((Number(inp.value) || 0) * 100) / 100); pintar(); };
    bx.addEventListener('click', e => {
      const b = e.target.closest('[data-usd]'); if(b){ usd = b.dataset.usd === '0' ? 0 : usd + Number(b.dataset.usd); inp.value = usd || ''; pintar(); return; }
      if(e.target.closest('.pz-usd-ok') && !ok.disabled){
        const cop = Math.round(usd * t), vueltas = Math.max(0, cop - total);
        fin({ method: 'usd', metodo: 'usd', nota: usdTxt(usd) + ' · tasa ' + plata(t), usd, tasa: t, vueltasCop: vueltas, vueltas, recibido: cop });
      }
    });
    pintar(); setTimeout(() => { try{ inp.focus(); }catch(x){} }, 50);
  }
  // Después de registrar la venta: el pago en dólares guarda los dólares, la tasa y las vueltas en pesos.
  function marcarVenta(entry, pago){
    if(!entry || !pago || pago.method !== 'usd') return;
    const p = (entry.payments || []).find(x => x.method === 'usd'); if(!p) return;
    p.usd = pago.usd; p.tasa = pago.tasa; p.vueltasCop = pago.vueltasCop || 0;
    entry.usd = { usd: pago.usd, tasa: pago.tasa, vueltas: pago.vueltasCop || 0 };
    try{ saveData(); }catch(e){}
  }
  // Los dólares que entraron desde una fecha (para el cierre y «Caja de hoy»).
  function recibidos(desde){
    const d = D(), t0 = desde ? new Date(desde).getTime() : 0; let usd = 0, vueltas = 0;
    ((d && d.history) || []).forEach(h => { if(new Date(h.date).getTime() > t0) (h.payments || []).forEach(p => { if(p.method === 'usd'){ usd += Number(p.usd) || 0; vueltas += Number(p.vueltasCop) || 0; } }); });
    return { usd: Math.round(usd * 100) / 100, vueltas };
  }

  // ---------- Ajustes → Pagos ----------
  function pintarAjustes(){
    const g = document.querySelector('#view-ajustes .settings-group[data-cat="pagos"]'); if(!g) return;
    let box = document.getElementById('usdBox');
    let jefe = true; try{ jefe = !window.ventoRoles || window.ventoRoles.esJefe(); }catch(e){}
    if(!jefe){ if(box) box.remove(); return; }
    if(!box){ box = document.createElement('div'); box.id = 'usdBox'; box.className = 'settings-row'; box.style.cssText = 'flex-direction:column;align-items:stretch;gap:8px'; g.insertBefore(box, g.children[1] || null); }
    const c = cfg();
    box.innerHTML = '<div style="display:flex;gap:10px;align-items:center"><div class="settings-row-text" style="flex:1"><strong>💵 Cobrar en dólares</strong><span>Para turistas: en la ventana de cobro sale el total en dólares y las vueltas en pesos. El arqueo cuadra solo.</span></div>' +
      '<label class="switch"><input type="checkbox" id="usdOn"' + (c.on ? ' checked' : '') + '><span class="switch-slider"></span></label></div>' +
      '<label style="display:flex;gap:8px;align-items:center">Tasa de hoy: 1 dólar = $ <input class="mz-in" id="usdTasa" inputmode="numeric" value="' + (c.tasa || '') + '" placeholder="4000" style="width:110px;text-align:center"></label>' +
      (c.at ? '<small style="opacity:.8">Tasa puesta el ' + new Date(c.at).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) + '. Cámbiala cuando cambie el dólar.</small>' : '');
    const guardar = () => { const d = D(); if(!d) return; const t = Math.round(Number(String(box.querySelector('#usdTasa').value).replace(/[^\d]/g, '')) || 0);
      d.usdCfg = { on: box.querySelector('#usdOn').checked, tasa: t, at: Date.now() };
      if(d.usdCfg.on && t < 100){ try{ showToast('Escribe la tasa del dólar (cuántos pesos vale un dólar).'); }catch(e){} }
      try{ saveData(); }catch(e){} pintarAjustes(); };
    box.querySelector('#usdOn').onchange = guardar; box.querySelector('#usdTasa').onchange = guardar;
  }
  document.addEventListener('click', ev => { if(ev.target.closest && ev.target.closest('.ajustes-cat[data-cat="pagos"], nav button[data-view="ajustes"]')) setTimeout(pintarAjustes, 110); }, true);

  window.ventoDolares = { cfg, activo, usdDe, usdTxt, boton, abrir, marcarVenta, recibidos, pintarAjustes };
})();
