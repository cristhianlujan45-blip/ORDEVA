// 🔒 ORDEVA 1.82.2 · Auditoría: el cierre de caja hecho AL MISMO TIEMPO en dos equipos (una sola caja). Contra el
// «Supabase local» REAL.
//  1. Los dos venden y los dos cierran la caja casi a la vez: queda UN cierre con todas las ventas (no dos que suman
//     lo mismo dos veces), con su número Z, en los dos equipos y en la nube.
//  2. Después de ese cierre, una venta nueva y otro cierre: el segundo cierre trae solo la venta nueva.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('fs');
const { spawnSync } = require('child_process');
function hayPostgres(){ if(process.env.VENTO_PG_URL || fs.existsSync('/usr/lib/postgresql')) return true; return spawnSync('bash', ['-c', 'command -v psql || command -v pg_ctl'], { stdio: 'ignore' }).status === 0; }
if(!process.env.VENTO_LOGS) for(const k of ['log', 'warn', 'error']){ const o = console[k].bind(console); console[k] = (...a) => { if(typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; o(...a); }; }
(async () => {
  if(!hayPostgres()){ console.log('RESULTADO 0 bien 0 mal (sin PostgreSQL: se omitió)'); process.exit(0); }
  const { iniciar, enrutar } = require('./servidor/supabase-local');
  const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
  let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
  const sb = await iniciar(); const b = await chromium.launch();
  const pausa = ms => new Promise(r => setTimeout(r, ms));
  const esperar = (p, fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 20000, polling: 300 }).then(() => true, () => false);
  async function equipo(nombre, ancho){
    const ctx = await b.newContext({ viewport: { width: ancho || 390, height: 844 } });
    const eq = { nombre, ctx, sinRed: false };
    await ctx.route('**/*', rt => { const u = new URL(rt.request().url()); if(u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') return rt.abort(); return rt.continue(); });
    await enrutar(ctx, sb);
    // «Sin internet»: se cae todo lo que va al servidor (no la página)
    await ctx.route(/\/(rest|auth|functions|realtime)\/v1\//, (rt) => eq.sinRed ? rt.abort('internetdisconnected') : rt.fallback());
    await ctx.addInitScript(() => { try{ localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-hola', '0'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(nombre + ': ' + e.message)); eq.p = p;
    await p.goto(BASE + '/index.html');
    await p.waitForFunction(() => window.ventoNube && window.ventoNube.crearCuenta, null, { timeout: 15000 });
    return eq;
  }
  const dentro = p => esperar(p, () => document.getElementById('authOverlay').hidden, null, 20000);
  const cerrarTodo = p => p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
  // Una venta por la caja (efectivo) o un fiado a nombre de alguien
  const vender = (p, etiqueta, deudor) => p.evaluate(async ([e, d]) => {
    window.ventoPOS.vaciar(); window.ventoPOS.agregar('a', 1);
    const h = await window.ventoPOS.cobrar({ pago: d ? { method: 'debe', metodo: 'debe', deudor: d, nota: d } : { method: 'efectivo', metodo: 'efectivo' } });
    const id = h && (h.id || (h.entry && h.entry.id)); const x = (id && data.history.find(y => y.id === id)) || null; if(x) x.observacion = e; else (window.__sinEtiqueta = (window.__sinEtiqueta || [])).push(e); saveData(); return !!x; }, [etiqueta, deudor || null]);
  const estado = p => p.evaluate(() => ({ ventas: (data.history || []).map(h => h.observacion).filter(Boolean).sort(),
    fiados: (data.history || []).filter(h => Number(h.debt) > 0).map(h => (h.person || (h.payments || []).map(x => x.note).join('')) + ':' + h.debt).sort() }));
  try{
    const CEL = await equipo('celular');
    await CEL.p.fill('#authBiz', 'Bar Dos Cierres'); await CEL.p.fill('#authUser', 'dueno@doscierres.co'); await CEL.p.fill('#authPass', 'clave123'); await CEL.p.click('#authBtn');
    chk('0. El celular crea la cuenta', await dentro(CEL.p));
    await CEL.p.click('#onbSaltar', { timeout: 4000 }).catch(() => {}); await cerrarTodo(CEL.p);
    await esperar(CEL.p, () => !!window.ventoNube.negocio());
    await CEL.p.evaluate(() => { data.products = [{ id: 'a', name: 'Arroz', price: 4000 }]; data.history = []; data.closures = []; saveData(); });
    await pausa(2500);
    const PC = await equipo('computador', 1280);
    await PC.p.click('#authTabs [data-tab="entrar"]').catch(() => {});
    await PC.p.fill('#authUser', 'dueno@doscierres.co'); await PC.p.fill('#authPass', 'clave123'); await PC.p.click('#authBtn');
    chk('0. El computador entra', await dentro(PC.p) && await esperar(PC.p, () => data.products.some(p => p.name === 'Arroz')));
    await cerrarTodo(PC.p);
    // ===== 1 =====
    for(let i = 1; i <= 3; i++){ await vender(CEL.p, 'c' + i); await vender(PC.p, 'p' + i); }
    await esperar(CEL.p, () => (data.history || []).filter(h => h.observacion).length >= 6, null, 30000);
    await esperar(PC.p, () => (data.history || []).filter(h => h.observacion).length >= 6, null, 30000);
    await pausa(2000);
    const cerrar = p => p.evaluate(async () => { await closeCashRegister({ auto: true }); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); });
    await Promise.all([cerrar(CEL.p), cerrar(PC.p)]);
    await pausa(9000);
    const cierres = p => p.evaluate(() => (data.closures || []).map(c => ({ z: c.z, n: c.ticketCount, v: c.totalSold })));
    let c = await cierres(CEL.p), q = await cierres(PC.p);
    const vendidoTotal = cs => cs.reduce((a, x) => a + (x.v || 0), 0);
    chk('1. Los dos cerraron a la vez: lo vendido en los cierres suma $24.000 (no el doble)', vendidoTotal(c) === 24000 && vendidoTotal(q) === 24000, { c, q });
    chk('1. … un solo cierre (o cierres que no repiten ventas) y los mismos en los dos equipos', JSON.stringify(c) === JSON.stringify(q) && c.reduce((a, x) => a + x.n, 0) === 6, { c, q });
    chk('1. … sin dos cierres con el mismo número Z', new Set(c.map(x => x.z)).size === c.length, c);
    // ===== 2 =====
    await vender(PC.p, 'p4');
    await esperar(CEL.p, () => (data.history || []).some(h => h.observacion === 'p4'), null, 30000); await pausa(1500);
    await cerrar(CEL.p); await pausa(6000);
    c = await cierres(CEL.p); q = await cierres(PC.p);
    chk('2. El siguiente cierre trae solo la venta nueva ($4.000)', c[0] && c[0].n === 1 && c[0].v === 4000 && JSON.stringify(c) === JSON.stringify(q), { c, q });
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ Excepción: ' + (e && e.stack || e)); }
  await b.close(); await sb.cerrar().catch(() => {});
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
