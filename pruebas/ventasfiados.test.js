// 🧾 ORDEVA 1.82.0 · Que NO se pierdan ventas ni fiados entre equipos. Contra el «Supabase local» REAL, dos equipos en la
// misma cuenta, vendiendo y fiando AL MISMO TIEMPO (lo que más choca en la nube).
// Pedido del dueño: «no nos está quedando en el historial las ventas ni las personas que me deben… sincronizar todos
// esos datos, que queden guardados».
//  1. Celular y computador venden a la vez (6 ventas cada uno, rápido) y cada uno fía a una persona.
//  2. Al rato: los DOS equipos tienen las 14 ventas y los 2 fiados (con el nombre de quien debe), y la nube también.
//  3. Al volver a abrir los dos: siguen todas.
//  4. El computador sin internet vende 2 y fía 1; al volver el internet se suben y el celular las ve; no se pierde nada.
//  5. Un abono a un fiado desde un equipo llega al otro (el fiado baja).
//  6. 📒 Libreta: los dos equipos anotan fiados a la vez: quedan todos en los dos.
//  7. Una mesa cobrada debiendo en un equipo mientras el otro vende: llegan las dos cosas.
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
    await CEL.p.fill('#authBiz', 'Tienda Sin Perder'); await CEL.p.fill('#authUser', 'dueno@sinperder.co'); await CEL.p.fill('#authPass', 'clave123'); await CEL.p.click('#authBtn');
    chk('0. El celular crea la cuenta', await dentro(CEL.p));
    await CEL.p.click('#onbSaltar', { timeout: 4000 }).catch(() => {}); await cerrarTodo(CEL.p);
    await esperar(CEL.p, () => !!window.ventoNube.negocio());
    const NEG = (await CEL.p.evaluate(() => window.ventoNube.negocio())).id;
    await CEL.p.evaluate(() => { data.products = [{ id: 'a', name: 'Arroz', price: 4000 }]; data.history = []; saveData(); });
    await pausa(2500);
    const PC = await equipo('computador', 1280);
    await PC.p.click('#authTabs [data-tab="entrar"]').catch(() => {});
    await PC.p.fill('#authUser', 'dueno@sinperder.co'); await PC.p.fill('#authPass', 'clave123'); await PC.p.click('#authBtn');
    chk('0. El computador entra con el mismo correo', await dentro(PC.p) && await esperar(PC.p, () => data.products.some(p => p.name === 'Arroz')));
    await cerrarTodo(PC.p);
    // ===== 1 =====
    const tareas = [];
    for(let i = 1; i <= 6; i++){ tareas.push(vender(CEL.p, 'cel-' + i)); tareas.push(vender(PC.p, 'pc-' + i)); }
    tareas.push(vender(CEL.p, 'cel-fiado', 'Carlos')); tareas.push(vender(PC.p, 'pc-fiado', 'Marta'));
    for(const t of tareas) await t;
    // ===== 2 =====
    const todas = ['cel-1', 'cel-2', 'cel-3', 'cel-4', 'cel-5', 'cel-6', 'cel-fiado', 'pc-1', 'pc-2', 'pc-3', 'pc-4', 'pc-5', 'pc-6', 'pc-fiado'].sort();
    const completo = (p) => esperar(p, n => (data.history || []).filter(h => h.observacion).length >= n, todas.length, 40000);
    const okCel = await completo(CEL.p), okPc = await completo(PC.p);
    await pausa(4000);
    let c = await estado(CEL.p), q = await estado(PC.p);
    console.log('✅ (diagnóstico) ventas en el celular: ' + await CEL.p.evaluate(() => data.history.length) + ' · en el computador: ' + await PC.p.evaluate(() => data.history.length) + ' · sin etiqueta: ' + JSON.stringify([await CEL.p.evaluate(() => window.__sinEtiqueta || []), await PC.p.evaluate(() => window.__sinEtiqueta || [])]));
    chk('2. El celular tiene las 14 ventas (las suyas y las del computador)', okCel && JSON.stringify(c.ventas) === JSON.stringify(todas), c.ventas);
    chk('2. El computador tiene las 14 ventas', okPc && JSON.stringify(q.ventas) === JSON.stringify(todas), q.ventas);
    chk('2. Los dos tienen los 2 fiados con el nombre (Carlos y Marta, $4.000 cada uno)', JSON.stringify(c.fiados) === JSON.stringify(['Carlos:4000', 'Marta:4000']) && JSON.stringify(q.fiados) === JSON.stringify(c.fiados), { c: c.fiados, q: q.fiados });
    const nube = async () => { const r = (await sb.sql('select datos from datos_negocio where negocio_id = $1', [NEG]))[0]; return ((r && r.datos && r.datos.history) || []).map(h => h.observacion).filter(Boolean).sort(); };
    chk('2. La nube tiene las 14 ventas', JSON.stringify(await nube()) === JSON.stringify(todas), await nube());
    // ===== 3 =====
    await CEL.p.reload(); await PC.p.reload();
    await esperar(CEL.p, () => typeof data !== 'undefined' && (data.history || []).length > 0, null, 20000);
    await esperar(PC.p, () => typeof data !== 'undefined' && (data.history || []).length > 0, null, 20000);
    await pausa(3000);
    c = await estado(CEL.p); q = await estado(PC.p);
    chk('3. Al volver a abrir, el celular sigue con las 14 ventas y los 2 fiados', JSON.stringify(c.ventas) === JSON.stringify(todas) && c.fiados.length === 2, c);
    chk('3. Al volver a abrir, el computador sigue con las 14 ventas y los 2 fiados', JSON.stringify(q.ventas) === JSON.stringify(todas) && q.fiados.length === 2, q);
    // ===== 4 =====
    PC.sinRed = true;
    await cerrarTodo(PC.p);
    await vender(PC.p, 'pc-offline-1'); await vender(PC.p, 'pc-offline-2'); await vender(PC.p, 'pc-offline-fiado', 'Luis');
    await vender(CEL.p, 'cel-mientras');   // el celular sigue vendiendo con internet
    await pausa(3000);
    PC.sinRed = false;
    await PC.p.evaluate(() => { try{ window.dispatchEvent(new Event('online')); window.ventoNube.cambio(); }catch(e){} });
    const todas2 = todas.concat(['pc-offline-1', 'pc-offline-2', 'pc-offline-fiado', 'cel-mientras']).sort();
    const ok2c = await esperar(CEL.p, n => (data.history || []).filter(h => h.observacion).length >= n, todas2.length, 45000);
    const ok2p = await esperar(PC.p, n => (data.history || []).filter(h => h.observacion).length >= n, todas2.length, 45000);
    await pausa(3000);
    c = await estado(CEL.p); q = await estado(PC.p);
    chk('4. Lo vendido sin internet en el computador llega al celular al volver el internet (18 ventas, 3 fiados)', ok2c && JSON.stringify(c.ventas) === JSON.stringify(todas2) && c.fiados.length === 3, c);
    chk('4. … y el computador también tiene lo que vendió el celular mientras tanto', ok2p && JSON.stringify(q.ventas) === JSON.stringify(todas2) && q.fiados.length === 3, q);
    chk('4. La nube tiene las 18', JSON.stringify(await nube()) === JSON.stringify(todas2), await nube());
    // ===== 5 =====
    await CEL.p.evaluate(() => { const h = data.history.find(x => x.observacion === 'cel-fiado'); h.payments.push({ method: 'efectivo', amount: 1500, note: 'Abono Carlos', abono: true, at: Date.now() }); h.debt = 2500; saveData(); });
    chk('5. Un abono al fiado de Carlos (queda debiendo $2.500) llega al computador', await esperar(PC.p, () => { const h = data.history.find(x => x.observacion === 'cel-fiado'); return h && h.debt === 2500; }, null, 25000));
    // ===== 6 · 📒 Libreta: los dos equipos anotan fiados AL MISMO TIEMPO =====
    const lib = (p, quien, monto) => p.evaluate(([q, m]) => { const L = data.libreta || (data.libreta = { movs: [] }); L.movs = L.movs || [];
      L.movs.push({ id: 'lb-' + q + '-' + Date.now().toString(36), tipo: 'debe', persona: q, monto: m, nota: '', fecha: new Date().toISOString() }); saveData(); }, [quien, monto]);
    await Promise.all([lib(CEL.p, 'Doña Rosa', 12000), lib(PC.p, 'Don Jaime', 8000)]);
    await Promise.all([lib(CEL.p, 'Doña Rosa', 3000), lib(PC.p, 'Pepe', 5000)]);
    const deudores = p => p.evaluate(() => (typeof window.libretaTotales === 'function' ? window.libretaTotales().meDeben : null));
    const okL = await esperar(CEL.p, () => window.libretaTotales && window.libretaTotales().meDeben >= 28000, null, 30000) && await esperar(PC.p, () => window.libretaTotales && window.libretaTotales().meDeben >= 28000, null, 30000);
    await pausa(3000);
    const dc = await deudores(CEL.p), dp = await deudores(PC.p);
    // 28.000 de la libreta (Rosa 15.000, Jaime 8.000, Pepe 5.000) + los fiados de las ventas que van a la libreta
    chk('6. Libreta: lo que anotó cada equipo a la vez queda en los dos (Rosa, Jaime y Pepe)', okL && dc === dp && dc >= 28000, { dc, dp });
    const pers = p => p.evaluate(() => [...new Set(((data.libreta || {}).movs || []).map(m => m.persona))].sort());
    chk('6. … con las mismas personas en los dos equipos', JSON.stringify(await pers(CEL.p)) === JSON.stringify(await pers(PC.p)) && (await pers(CEL.p)).includes('Pepe') && (await pers(CEL.p)).includes('Doña Rosa'), { c: await pers(CEL.p), q: await pers(PC.p) });
    // ===== 7 · Una MESA cobrada fiada en el celular mientras el computador vende =====
    await Promise.all([
      CEL.p.evaluate(() => { const t = data.tables[1]; t.items = [{ productId: 'a', name: 'Arroz', price: 4000, qty: 2, personId: null, history: [] }]; t.payments = []; closeTableToHistory(1); data.history[0].observacion = 'mesa1-fiada'; saveData(); }),
      vender(PC.p, 'pc-mientras-mesa') ]);
    chk('7. La mesa cerrada debiendo ($8.000) llega al computador como fiado, y la venta del computador al celular',
      await esperar(PC.p, () => (data.history || []).some(h => h.observacion === 'mesa1-fiada' && h.debt === 8000), null, 30000) && await esperar(CEL.p, () => (data.history || []).some(h => h.observacion === 'pc-mientras-mesa'), null, 30000));
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ Excepción: ' + (e && e.stack || e)); }
  await b.close(); await sb.cerrar().catch(() => {});
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
