// ⏱ ORDEVA 1.76.0 · Tiempo en cocina (lib/vento-cocina-tiempo.js). Sin internet.
//  1. Pantalla de Cocina: «⏱ Hoy: N pedidos · promedio X min hasta «Listo»» con los pedidos de hoy.
//  2. Un pedido que lleva más de 20 min sin estar listo: se resalta y avisa UNA vez (aviso y voz); la mesa lo muestra.
//  3. «Avisar a los [30] min» cambia el límite. Los pedidos listos o las anulaciones no avisan. Sin errores.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  const pausa = ms => new Promise(r => setTimeout(r, ms));
  async function abrir(tipo, nombre){
    const ctx = await b.newContext({ viewport: { width: 1366, height: 800 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { window.__voz = []; window.speakVoice = t => window.__voz.push(String(t)); try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
    await p.goto(BASE + '/index.html'); await pausa(1000);
    await p.evaluate(t => { const s = document.getElementById('authType'); if(s){ s.value = t; s.dispatchEvent(new Event('change')); } }, tipo);
    await p.fill('#authBiz', nombre); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn');
    await p.waitForFunction(() => document.getElementById('authOverlay').hidden, null, { timeout: 15000 });
    await p.click('#onbSaltar', { timeout: 4000 }).catch(() => {});
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.products = [{ id: 'bj', name: 'Bandeja paisa', price: 28000 }, { id: 'li', name: 'Limonada', price: 6000 }, { id: 'aj', name: 'Ajiaco', price: 22000 }]; saveData(); });
    await p.waitForFunction(() => !!window.ventoComanda && !!window.vitoPedidos && !!window.ventoCocinaTiempo, null, { timeout: 10000 });
    await pausa(500);
    return { ctx, p };
  }
  const caja = p => p.evaluate(() => { const h = document.getElementById('ckCocina'); return { vis: !!h && !h.hidden && h.offsetParent !== null, t: h ? h.innerText.replace(/\s+/g, ' ') : '' }; });
  const cocina = p => p.evaluate(() => window.vitoPedidos.lista().filter(x => x.mesa === 1 && x.estado !== 'cancelado').map(x => x.estado + ':' + x.items.map(i => i.qty + ' ' + i.name).join('+')));
  const cuenta = p => p.evaluate(() => (data.tables[1].items || []).map(i => i.qty + ' ' + i.name).join(', '));
  try{
    const { p } = await abrir('restaurante', 'Restaurante La Fonda');
    await p.evaluate(() => {
      window.__voz = []; window.speakVoice = t => window.__voz.push(String(t));
      const E = window.vitoPedidos, L = E.lista(), ahora = Date.now();
      const mk = (id, mesa, hace, estado, listoTras) => { const at = ahora - hace * 6e4; const x = { id, mesa, mesaNombre: 'Mesa ' + mesa, items: [{ name: 'Bandeja paisa', qty: 2, ok: true }], at, recibidoEn: at, estado, origen: 'mesero:Ana', aplicado: true, hist: [{ e: 'recibido', at }] }; if(listoTras != null) x.hist.push({ e: 'listo', at: at + listoTras * 6e4 }); L.push(x); };
      mk('k1', 1, 60, 'entregado', 10); mk('k2', 2, 50, 'entregado', 14);   // listos en 10 y 14 min → promedio 12
      mk('k3', 3, 25, 'preparacion');                                       // lleva 25 min: demorado
      mk('k4', 4, 5, 'recibido');                                           // recién llegado
      L.push({ id: 'kx', mesa: 5, items: [{ name: '❌ ANULAR Limonada', qty: 1, ok: true }], at: ahora - 40 * 6e4, recibidoEn: ahora - 40 * 6e4, estado: 'recibido', anula: true, aplicado: true, hist: [] });
      for(const m of [3, 4]) data.tables[m] = { items: [{ productId: 'bj', name: 'Bandeja paisa', price: 28000, qty: 2, history: [{ qty: 2, at: ahora - 30 * 6e4 }] }], payments: [], people: [] };
      E.guardar(); window.ventoCocinaTiempo.revisar();
      document.querySelector('nav button[data-view="cocina"]') && document.querySelector('nav button[data-view="cocina"]').click();
      renderCocina();
    });
    await p.waitForTimeout(500);
    let v = await p.evaluate(() => ({ barra: ((document.getElementById('ktBarra') || {}).innerText || '').replace(/\s+/g, ' '), muy: [...document.querySelectorAll('#kdsTickets .kds-ticket.kt-muy')].map(t => t.dataset.pid), voz: window.__voz.slice(), toast: (document.getElementById('toast') || {}).textContent || '' }));
    chk('1. Cocina: «⏱ Hoy: 4 pedidos · promedio 12 min» (no cuenta la anulación)', /Hoy: 4 pedidos/.test(v.barra) && /promedio 12 min/.test(v.barra), v.barra);
    chk('1. … y «1 pasaron de 20 min»', /1 pasaron de 20 min/.test(v.barra), v.barra);
    chk('2. El pedido de la mesa 3 (25 min) se resalta; el de 5 min y la anulación no', v.muy.length === 1 && v.muy[0] === 'k3', v.muy);
    chk('2. Avisa: «⏰ Mesa 3 lleva 25 min esperando: 2 Bandeja paisa» y con voz', /Mesa 3 lleva 2[5-6] min esperando: 2 Bandeja paisa/.test(v.toast) && v.voz.some(t => /Mesa 3 lleva 2[5-6] minutos/.test(t)), v);
    v = await p.evaluate(() => { const n = window.ventoCocinaTiempo.revisar().length; return { n, voz: window.__voz.filter(t => /Mesa 3/.test(t)).length }; });
    chk('2. No vuelve a avisar el mismo pedido', v.n === 0 && v.voz === 1, v);
    v = await p.evaluate(() => { document.querySelector('nav button[data-view="mesas"]') && document.querySelector('nav button[data-view="mesas"]').click(); renderMesas(); const c = document.querySelector('#tableGrid .ticket[data-id="3"]'); return c ? c.innerText.replace(/\s+/g, ' ') : ''; });
    chk('2. La tarjeta de la mesa 3 dice «⏰ Pedido hace 25 min en cocina»', /Pedido hace 2[5-6] min en cocina/.test(v), v);
    await p.evaluate(() => { document.querySelector('nav button[data-view="cocina"]') && document.querySelector('nav button[data-view="cocina"]').click(); renderCocina(); });
    await p.waitForTimeout(300);
    await p.selectOption('#ktLim', '30'); await p.waitForTimeout(300);
    v = await p.evaluate(() => ({ lim: data.prep.alertaMin, muy: document.querySelectorAll('#kdsTickets .kds-ticket.kt-muy').length, barra: document.getElementById('ktBarra').innerText }));
    chk('3. «Avisar a los 30 min»: queda guardado y la mesa 3 (25 min) ya no se resalta', v.lim === 30 && v.muy === 0 && !/pasaron/.test(v.barra), v);
    chk('3. Sin errores en la página', errs.length === 0, errs);
  }catch(e){ mal++; console.log('❌ Error: ' + (e.stack || e)); }
  await b.close();
  console.log('\nRESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
