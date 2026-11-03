/* ORDEVA · lib/vento-resumen-dia.js — 1.76.0: 📊 Resumen del día al cerrar la caja, para el dueño.
   Al cerrar la caja (en cualquier equipo del negocio), el dueño o el administrador recibe:
     «📊 Cierre: $1.250.000 en 48 cuentas (+12% que el cierre anterior) · ganancia ~$410.000 · lo más vendido: Bandeja
      paisa (22) · se está acabando: Gaseosa 400, Arroz · faltaron $5.000 en la caja»
   • En el equipo donde se cierra: el resumen sale en el informe del cierre, con «📲 Enviar por WhatsApp».
   • En los equipos del dueño / administrador (el cierre viaja con los datos del negocio): notificación en Android (o del
     navegador) y aviso, una sola vez por cierre. Los empleados no la reciben.
   La ganancia es estimada: solo cuenta los productos con costo registrado. */
(function(){
  'use strict';
  if(window.ventoResumenDia) return;
  const D = () => (typeof data !== 'undefined' ? data : null);
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plata = n => { try{ return fmt(Math.round(n || 0)); }catch(e){ return '$' + Math.round(n || 0).toLocaleString('es-CO'); } };
  const jefe = () => { try{ if(document.body.classList.contains('modo-mesero')) return false; return !window.ventoRoles || window.ventoRoles.esJefe(); }catch(e){ return true; } };

  function calcular(c){
    const d = D(); if(!d || !c) return null;
    const desde = c.from ? new Date(c.from).getTime() : 0, hasta = new Date(c.date).getTime();
    const T = (d.history || []).filter(h => { const t = new Date(h.date).getTime(); return t > desde && t <= hasta; });
    const prod = {}; let ganancia = 0, conCosto = 0, venta = 0;
    T.forEach(h => (h.items || []).forEach(it => {
      const q = Number(it.qty) || 0, nom = it.name || 'Producto'; if(!q || /propina/i.test(nom)) return;
      prod[nom] = (prod[nom] || 0) + q;
      venta += q * (Number(it.price) || 0);
      if(it.cost != null && it.cost !== ''){ ganancia += q * ((Number(it.price) || 0) - (Number(it.cost) || 0)); conCosto += q * (Number(it.price) || 0); }
    }));
    const top = Object.entries(prod).sort((a, b) => b[1] - a[1]).slice(0, 3);
    let acaba = [];
    try{ acaba = (d.products || []).filter(p => !p.combo && typeof invStatus === 'function' && ['out', 'low'].includes(invStatus(p))).sort((a, b) => (a.stock || 0) - (b.stock || 0)).slice(0, 4).map(p => p.name); }catch(e){}
    const ant = (d.closures || []).find(x => x.id !== c.id && new Date(x.date).getTime() < hasta);
    const cambio = ant && ant.totalSold > 0 ? Math.round((c.totalSold - ant.totalSold) / ant.totalSold * 100) : null;
    const dif = c.caja && c.caja.diferencia != null ? Number(c.caja.diferencia) : null;
    return { total: Number(c.totalSold) || 0, cuentas: Number(c.ticketCount) || T.length, efectivo: c.totalEfectivo || 0, transf: c.totalTransferencia || 0, debe: c.totalDebe || 0,
      ganancia: conCosto ? Math.round(ganancia) : null, gananciaParcial: conCosto && conCosto < venta * 0.95, top, acaba, cambio, dif };
  }
  function texto(c){
    const r = calcular(c); if(!r) return '';
    const L = ['📊 Cierre de caja · ' + ((D() || {}).businessName || 'ORDEVA'), new Date(c.date).toLocaleString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }), '',
      '💰 Vendido: ' + plata(r.total) + ' en ' + r.cuentas + (r.cuentas === 1 ? ' cuenta' : ' cuentas') + (r.cambio != null ? ' (' + (r.cambio >= 0 ? '+' : '') + r.cambio + '% que el cierre anterior)' : ''),
      '💵 Efectivo ' + plata(r.efectivo) + ' · 📲 Transferencias ' + plata(r.transf) + (r.debe ? ' · 📒 Fiado ' + plata(r.debe) : '')];
    if(r.ganancia != null) L.push('📈 Ganancia ' + (r.gananciaParcial ? 'aprox. (de los productos con costo) ' : '~') + plata(r.ganancia));
    if(r.top.length) L.push('🏆 Lo más vendido: ' + r.top.map(x => x[0] + ' (' + x[1] + ')').join(', '));
    if(r.acaba.length) L.push('⚠️ Se está acabando: ' + r.acaba.join(', '));
    if(r.dif != null && Math.abs(r.dif) >= 1) L.push(r.dif < 0 ? '🔴 Faltaron ' + plata(-r.dif) + ' en la caja' : '🟡 Sobraron ' + plata(r.dif) + ' en la caja');
    else if(r.dif === 0) L.push('✅ La caja cuadró exacto');
    return L.join('\n');
  }
  const corto = c => { const r = calcular(c); if(!r) return ''; return plata(r.total) + ' en ' + r.cuentas + (r.cuentas === 1 ? ' cuenta' : ' cuentas') + (r.cambio != null ? ' (' + (r.cambio >= 0 ? '+' : '') + r.cambio + '%)' : '') + (r.ganancia != null ? ' · ganancia ~' + plata(r.ganancia) : '') + (r.top[0] ? ' · más vendido: ' + r.top[0][0] : '') + (r.dif != null && r.dif < 0 ? ' · faltaron ' + plata(-r.dif) : ''); };

  // ---------- En el informe del cierre ----------
  function envolverInforme(){
    const orig = window.openClosureReport; if(typeof orig !== 'function' || orig._rd) return;
    const nuevo = function(c){
      const r = orig.apply(this, arguments);
      try{
        const body = $('closureReportBody'); if(!body || !c) return r;
        const t = texto(c), x = calcular(c);
        const box = document.createElement('div'); box.className = 'rd-box';
        box.innerHTML = '<div class="hist-detail-title">📊 Resumen para el dueño</div>' +
          (x.ganancia != null ? '<div class="hist-detail-line"><span>📈 Ganancia ' + (x.gananciaParcial ? 'aprox.' : 'estimada') + '</span><span>' + esc(plata(x.ganancia)) + '</span></div>' : '') +
          (x.cambio != null ? '<div class="hist-detail-line"><span>Frente al cierre anterior</span><span>' + (x.cambio >= 0 ? '▲ +' : '▼ ') + x.cambio + '%</span></div>' : '') +
          (x.top.length ? '<div class="hist-detail-line"><span>🏆 Lo más vendido</span><span>' + esc(x.top.map(y => y[0] + ' (' + y[1] + ')').join(', ')) + '</span></div>' : '') +
          (x.acaba.length ? '<div class="hist-detail-line"><span>⚠️ Se está acabando</span><span>' + esc(x.acaba.join(', ')) + '</span></div>' : '') +
          '<button type="button" class="btn-primary rd-wa" data-rd="wa">📲 Enviar resumen por WhatsApp</button>';
        body.appendChild(box);
        box.querySelector('[data-rd="wa"]').onclick = () => {
          const d = D(), tel = String((d && (d.duenoWhatsapp || d.bizWhatsapp)) || '').replace(/\D/g, '');
          window.open('https://wa.me/' + (tel.length === 10 && tel[0] === '3' ? '57' + tel : tel) + '?text=' + encodeURIComponent(t), '_blank');
        };
      }catch(e){}
      return r;
    };
    nuevo._rd = true; window.openClosureReport = nuevo;
  }

  // ---------- Aviso al dueño (una vez por cierre, en sus equipos) ----------
  const K = 'vento_rd_vistos';
  function revisar(){
    const d = D(); if(!d || !jefe()) return null;
    let auth = ''; try{ auth = String(authUser || ''); }catch(e){} if(!auth) return null;
    const c = (d.closures || [])[0]; if(!c || !c.id) return null;
    let vistos = []; try{ vistos = JSON.parse(localStorage.getItem(K)) || null; }catch(e){}
    if(vistos === null){ try{ localStorage.setItem(K, JSON.stringify((d.closures || []).map(x => x.id).slice(0, 50))); }catch(e){} return null; }   // primera vez en este equipo: no se avisa lo de antes
    if(vistos.includes(c.id) || Date.now() - new Date(c.date).getTime() > 36 * 36e5) return null;
    try{ localStorage.setItem(K, JSON.stringify([c.id].concat(vistos).slice(0, 50))); }catch(e){}
    const msg = corto(c);
    try{ const A = window.VentoAndroid; if(A && A.notificar) A.notificar('📊 Cierre de caja', msg, 'resumen', true); else if('Notification' in window && Notification.permission === 'granted') new Notification('📊 Cierre de caja', { body: msg }); }catch(e){}
    try{ showToast('📊 Cierre de caja: ' + msg, 12000); }catch(e){}
    return msg;
  }
  envolverInforme();
  setInterval(() => { try{ envolverInforme(); revisar(); }catch(e){} }, 15000);
  setTimeout(() => { try{ envolverInforme(); revisar(); }catch(e){} }, 2500);

  const css = document.createElement('style');
  css.textContent = '.rd-box{margin-top:10px}.rd-wa{width:100%;margin-top:8px}';
  document.head.appendChild(css);

  window.ventoResumenDia = { calcular, texto, corto, revisar };
})();
