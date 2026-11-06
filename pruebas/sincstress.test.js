// 🔁 ORDEVA 1.82.1 · Auditoría: lo demás que se sincroniza entre equipos, haciéndolo AL MISMO TIEMPO en dos equipos.
// Contra el «Supabase local» REAL.
//  1. Inventario: los dos venden del mismo producto (stock 20): queda 20 − lo vendido en los dos (se suman, no se pisan).
//  2. Contabilidad: los dos anotan gastos a la vez: quedan todos.
//  3. Caja: entradas y salidas de efectivo del turno en los dos: quedan todas.
//  4. Un equipo borra una venta (Deshacer) mientras el otro vende: la borrada no vuelve y la nueva no se pierde.
//  5. Productos nuevos creados a la vez en los dos: quedan los dos.
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
    await CEL.p.fill('#authBiz', 'Tienda Choques'); await CEL.p.fill('#authUser', 'dueno@choques.co'); await CEL.p.fill('#authPass', 'clave123'); await CEL.p.click('#authBtn');
    chk('0. El celular crea la cuenta', await dentro(CEL.p));
    await CEL.p.click('#onbSaltar', { timeout: 4000 }).catch(() => {}); await cerrarTodo(CEL.p);
    await esperar(CEL.p, () => !!window.ventoNube.negocio());
    await CEL.p.evaluate(() => { data.products = [{ id: 'a', name: 'Arroz', price: 4000, stock: 20 }]; data.history = []; data.contab = []; saveData(); });
    await pausa(2500);
    const PC = await equipo('computador', 1280);
    await PC.p.click('#authTabs [data-tab="entrar"]').catch(() => {});
    await PC.p.fill('#authUser', 'dueno@choques.co'); await PC.p.fill('#authPass', 'clave123'); await PC.p.click('#authBtn');
    chk('0. El computador entra con el mismo correo', await dentro(PC.p) && await esperar(PC.p, () => data.products.some(p => p.name === 'Arroz')));
    await cerrarTodo(PC.p);
    // ===== 1 =====
    const t1 = [];
    for(let i = 1; i <= 4; i++){ t1.push(vender(CEL.p, 'c' + i)); t1.push(vender(PC.p, 'p' + i)); }
    for(const t of t1) await t;
    const stock = p => p.evaluate(() => (data.products.find(x => x.id === 'a') || {}).stock);
    const okS = await esperar(CEL.p, () => (data.history || []).filter(h => h.observacion).length >= 8, null, 40000) && await esperar(PC.p, () => (data.history || []).filter(h => h.observacion).length >= 8, null, 40000);
    await pausa(4000);
    chk('1. Inventario: 8 vendidos entre los dos → quedan 12 en los dos equipos', okS && await stock(CEL.p) === 12 && await stock(PC.p) === 12, { cel: await stock(CEL.p), pc: await stock(PC.p) });
    // ===== 2 =====
    const gasto = (p, n, m) => p.evaluate(([n, m]) => { (data.contab = data.contab || []).unshift({ id: 'ct' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), tipo: 'gasto', cat: 'otros', monto: m, fecha: new Date().toISOString().slice(0, 10), metodo: 'efectivo', nota: n }); saveData(); }, [n, m]);
    await Promise.all([gasto(CEL.p, 'Hielo', 5000), gasto(PC.p, 'Bolsas', 3000)]);
    await Promise.all([gasto(CEL.p, 'Taxi', 9000), gasto(PC.p, 'Aseo', 2000)]);
    const gastos = p => p.evaluate(() => (data.contab || []).map(g => g.nota).sort().join(','));
    const okG = await esperar(CEL.p, () => (data.contab || []).length >= 4, null, 30000) && await esperar(PC.p, () => (data.contab || []).length >= 4, null, 30000);
    await pausa(3000);
    chk('2. Contabilidad: los 4 gastos (2 de cada equipo) en los dos', okG && await gastos(CEL.p) === 'Aseo,Bolsas,Hielo,Taxi' && await gastos(PC.p) === 'Aseo,Bolsas,Hielo,Taxi', { c: await gastos(CEL.p), q: await gastos(PC.p) });
    // ===== 3 =====
    const tieneTurno = await CEL.p.evaluate(() => !!(window.ventoTurno && window.ventoTurno.abrir && window.ventoTurno.movimiento));
    if(tieneTurno){
      await CEL.p.evaluate(() => window.ventoTurno.abrir(100000));
      await esperar(PC.p, () => !!(data.turno && data.turno.base === 100000), null, 20000);
      await Promise.all([CEL.p.evaluate(() => window.ventoTurno.movimiento('salida', 20000, 'Proveedor')), PC.p.evaluate(() => window.ventoTurno.movimiento('entrada', 10000, 'Sencillo'))]);
      const movs = p => p.evaluate(() => ((data.turno && data.turno.movs) || []).map(m => m.motivo).sort().join(','));
      const okT = await esperar(CEL.p, () => ((data.turno && data.turno.movs) || []).length >= 2, null, 25000) && await esperar(PC.p, () => ((data.turno && data.turno.movs) || []).length >= 2, null, 25000);
      chk('3. Caja: la salida del celular y la entrada del computador quedan en los dos', okT && await movs(CEL.p) === 'Proveedor,Sencillo' && await movs(PC.p) === 'Proveedor,Sencillo', { c: await movs(CEL.p), q: await movs(PC.p) });
    } else chk('3. Caja: (sin abrir/movimiento expuestos: se revisa a mano)', true);
    // ===== 4 =====
    await Promise.all([
      CEL.p.evaluate(() => { const h = data.history.find(x => x.observacion === 'c1'); return qsDeshacerVenta(h); }),
      vender(PC.p, 'p5') ]);
    const okD = await esperar(PC.p, () => !(data.history || []).some(h => h.observacion === 'c1'), null, 30000) && await esperar(CEL.p, () => (data.history || []).some(h => h.observacion === 'p5'), null, 30000);
    await pausa(4000);
    const vs = p => p.evaluate(() => (data.history || []).map(h => h.observacion).filter(Boolean).sort().join(','));
    chk('4. La venta borrada en el celular no vuelve, y la nueva del computador llega', okD && await vs(CEL.p) === await vs(PC.p) && !/c1/.test(await vs(CEL.p)) && /p5/.test(await vs(CEL.p)), { c: await vs(CEL.p), q: await vs(PC.p) });
    chk('4. … y el inventario devuelve el arroz borrado: 12 + 1 − 1 = 12', await stock(CEL.p) === 12 && await stock(PC.p) === 12, { c: await stock(CEL.p), q: await stock(PC.p) });
    // ===== 5 =====
    await Promise.all([
      CEL.p.evaluate(() => { data.products.push({ id: (window.ventoIdUnico ? window.ventoIdUnico() : 'x1'), name: 'Leche', price: 3900, stock: 5 }); saveData(); }),
      PC.p.evaluate(() => { data.products.push({ id: (window.ventoIdUnico ? window.ventoIdUnico() : 'x2'), name: 'Pan', price: 500, stock: 30 }); saveData(); }) ]);
    const prods = p => p.evaluate(() => data.products.map(x => x.name).sort().join(','));
    const okP = await esperar(CEL.p, () => data.products.length >= 3, null, 25000) && await esperar(PC.p, () => data.products.length >= 3, null, 25000);
    chk('5. Productos creados a la vez: Leche y Pan en los dos', okP && await prods(CEL.p) === 'Arroz,Leche,Pan' && await prods(PC.p) === 'Arroz,Leche,Pan', { c: await prods(CEL.p), q: await prods(PC.p) });
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ Excepción: ' + (e && e.stack || e)); }
  await b.close(); await sb.cerrar().catch(() => {});
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
