// 🔁 Auditoría 1.99.90 · TIENDA con DOS equipos: el pedido del QR espera a que lo acepten y los DOS tocan «✅ Aceptar»
// casi a la vez (el mismo pedido). Revisa:
//  1. El pedido llega «por aceptar» a los dos equipos.
//  2. Aceptado en los dos a la vez: la cuenta queda con 2 (no 4) en los dos equipos.
//  3. El inventario baja 2 (no 4).
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('fs');
const { spawnSync } = require('child_process');
function hayPostgres(){ if(process.env.VENTO_PG_URL || fs.existsSync('/usr/lib/postgresql')) return true; return spawnSync('bash', ['-c', 'command -v psql || command -v pg_ctl'], { stdio: 'ignore' }).status === 0; }
if(!process.env.VENTO_LOGS) for(const k of ['log', 'warn', 'error']){ const orig = console[k].bind(console); console[k] = (...a) => { if(typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; orig(...a); }; }
(async () => {
  if(!hayPostgres()){ console.log('RESULTADO 0 bien 0 mal (sin PostgreSQL: se omitió)'); process.exit(0); }
  const { iniciar, enrutar } = require('./servidor/supabase-local');
  const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
  let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
  const sb = await iniciar(); const b = await chromium.launch();
  const esperar = (p, fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 15000, polling: 200 }).then(() => true, () => false);
  const pausa = ms => new Promise(r => setTimeout(r, ms));
  try{
    async function equipo(nombre){
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
      await ctx.route('**/*', rt => { const u = new URL(rt.request().url()); return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') ? rt.continue() : rt.abort(); });
      await enrutar(ctx, sb, { enVivo: true });
      await ctx.addInitScript(() => { try{ localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-hola', '0'); }catch(e){} });
      const p = await ctx.newPage(); p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
      await p.goto(BASE + '/index.html'); await p.waitForFunction(() => window.ventoNube && window.ventoNube.crearCuenta, null, { timeout: 15000 });
      return p;
    }
    const A = await equipo('A');
    await A.evaluate(() => { const s = document.getElementById('authType'); if(s){ s.value = 'tienda'; s.dispatchEvent(new Event('change')); } });
    await A.fill('#authBiz', 'Tienda Dos Equipos'); await A.fill('#authUser', 'dueno@dosac.co'); await A.fill('#authPass', 'clave123'); await A.click('#authBtn');
    await esperar(A, () => document.getElementById('authOverlay').hidden && !!window.ventoNube.negocio(), null, 20000);
    await A.click('#onbSaltar', { timeout: 4000 }).catch(() => {});
    const cfg = await A.evaluate(base => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.products = [{ id: 'cv', name: 'Cerveza', price: 5000, stock: 50 }]; Object.keys(data.tables).forEach(k => { data.tables[k] = { items: [], payments: [], people: [] }; }); saveData();
      const M = window.vitoMod, c = M.qCfg(); c.url = base + '/pedido.html'; c.live = true; M.SS('vito_qr', c); M.reconectarPedidos();
      return { topic: M.qCfg().topic, v: window.vitoCanalPrueba.vTopic(1) }; }, BASE);
    await pausa(3000);
    const B = await equipo('B');
    await B.click('#authTabs [data-tab="entrar"]').catch(() => {});
    await B.fill('#authUser', 'dueno@dosac.co'); await B.fill('#authPass', 'clave123'); await B.click('#authBtn');
    await esperar(B, () => document.getElementById('authOverlay').hidden, null, 20000);
    await B.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    await esperar(B, () => (data.products || []).some(p => p.id === 'cv') && (data.qrCodigos || data.qrCanales), null, 20000);
    await B.evaluate(base => { const M = window.vitoMod, c = M.qCfg(); c.url = base + '/pedido.html'; c.live = true; M.SS('vito_qr', c); M.reconectarPedidos(); }, BASE);
    const tB = await B.evaluate(() => window.vitoMod.qCfg().topic);
    chk('0. Los dos equipos escuchan el mismo canal de pedidos', tB === cfg.topic, { a: cfg.topic, b: tB });
    await pausa(3000);
    // El cliente pide 2 cervezas por el QR de la Mesa 1 (con el código de su QR)
    await A.evaluate(([c, v]) => fetch('https://canal.vento.local/' + c, { method: 'POST', body: JSON.stringify({ t: 'pedido', v: 2, id: 'pdos1', mesa: 1, vm: v, items: [{ n: 'Cerveza', q: 2, p: 5000 }], total: 10000, at: Date.now() }) }), [cfg.topic, cfg.v]);
    const llego = async p => esperar(p, () => (data.pedidos || []).some(x => x.id === 'pdos1' && x.estado === 'nuevo'), null, 20000);
    const [la, lb] = [await llego(A), await llego(B)];
    chk('1. El pedido llega «por aceptar» a los dos equipos', la && lb, { la, lb });
    // Los dos tocan «✅ Aceptar» casi a la vez
    await Promise.all([A.evaluate(() => window.ventoPedidosTienda.aceptar('pdos1')), B.evaluate(() => window.ventoPedidosTienda.aceptar('pdos1'))]);
    await pausa(15000);
    const q = p => p.evaluate(() => ({ cuentas: Object.keys(data.tables).map(k => ((data.tables[k] || {}).items || []).filter(i => i.productId === 'cv').reduce((s, i) => s + i.qty, 0)).filter(Boolean), stock: (data.products.find(x => x.id === 'cv') || {}).stock, estado: ((data.pedidos || []).find(x => x.id === 'pdos1') || {}).estado }));
    const [a, bb] = [await q(A), await q(B)];
    chk('2. Aceptado en los dos a la vez: la cuenta con 2 (no 4) en los dos equipos', JSON.stringify(a.cuentas) === '[2]' && JSON.stringify(bb.cuentas) === '[2]', { A: a, B: bb });
    chk('3. El inventario baja 2: quedan 48 (no 46)', a.stock === 48 && bb.stock === 48, { A: a, B: bb });
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  await b.close(); await sb.cerrar().catch(() => {});
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal'); process.exit(mal ? 1 : 0);
})();
