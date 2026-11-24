// 📶 1.99.26 · Con cada producto vendido, la nube sube SOLO el movimiento nuevo del inventario. Antes subía la lista entera
// (data.stockLog, hasta 3.000 renglones) a la nube y a los otros equipos, en cada producto: en un negocio real, ~118 veces
// en una noche. Contra el «Supabase local» REAL:
//  1. Una lista vieja (sin id, de viejo a nuevo) se convierte igual en dos equipos (mismos ids): la nube no la duplica.
//  2. Vendiendo, cada cambio guardado en la nube lleva solo el movimiento nuevo («pre» de 1), no la lista entera.
//  3. El otro equipo recibe los movimientos y el cálculo de «días de inventario» da lo mismo con la lista nueva que con la vieja.
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
  async function equipo(nombre){
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', rt => { const u = new URL(rt.request().url()); if(u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') return rt.abort(); return rt.continue(); });
    await enrutar(ctx, sb);
    await ctx.addInitScript(() => { try{ localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-hola', '0'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
    await p.goto(BASE + '/index.html');
    await p.waitForFunction(() => window.ventoNube && window.ventoNube.crearCuenta, null, { timeout: 15000 });
    return { nombre, ctx, p };
  }
  const dentro = p => esperar(p, () => document.getElementById('authOverlay').hidden, null, 20000);
  const cerrarTodo = p => p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
  try{
    const CEL = await equipo('celular');
    await CEL.p.fill('#authBiz', 'Tienda Movimientos'); await CEL.p.fill('#authUser', 'dueno@movs.co'); await CEL.p.fill('#authPass', 'clave123'); await CEL.p.click('#authBtn');
    chk('0. El celular crea la cuenta', await dentro(CEL.p));
    await CEL.p.click('#onbSaltar', { timeout: 4000 }).catch(() => {}); await cerrarTodo(CEL.p);
    await esperar(CEL.p, () => !!window.ventoNube.negocio());
    const NEG = (await CEL.p.evaluate(() => window.ventoNube.negocio())).id;
    // Una lista vieja: 300 movimientos sin id, de viejo a nuevo (como la guardaban las versiones de antes)
    const rateViejo = await CEL.p.evaluate(() => {
      const t0 = Date.now() - 10 * 864e5, L = [];
      for(let i = 0; i < 300; i++) L.push({ p: i % 3 ? 'a' : 'b', q: 1 + (i % 2), at: t0 + i * 2400000 });
      L.push(Object.assign({}, L[L.length - 1]));   // dos iguales (mismo instante): ids distintos y los mismos en todos los equipos
      data.products = [{ id: 'a', name: 'Arroz', price: 4000, stock: 500 }, { id: 'b', name: 'Bebida', price: 2000, stock: 200 }];
      data.stockLog = L; saveData();
      return { a: invRate('a'), b: invRate('b') };
    });
    await pausa(3000);
    const PC = await equipo('computador');
    await PC.p.click('#authTabs [data-tab="entrar"]').catch(() => {});
    await PC.p.fill('#authUser', 'dueno@movs.co'); await PC.p.fill('#authPass', 'clave123'); await PC.p.click('#authBtn');
    chk('0. El computador entra con el mismo correo y tiene los 301 movimientos', await dentro(PC.p) && await esperar(PC.p, () => (data.stockLog || []).length === 301));
    await cerrarTodo(PC.p);
    // ===== 1. Los dos convierten la lista vieja a la vez (cada uno vende uno) =====
    await Promise.all([CEL.p.evaluate(() => { invOnSale({ productId: 'a' }, 1); saveData(); }), PC.p.evaluate(() => { invOnSale({ productId: 'b' }, 1); saveData(); })]);
    const listo = p => esperar(p, () => (data.stockLog || []).length === 303 && data.stockLog.every(x => x.id), null, 30000);
    chk('1. Los dos equipos terminan con 303 movimientos, todos con id (301 viejos + 1 de cada uno, sin duplicar)', await listo(CEL.p) && await listo(PC.p),
      [await CEL.p.evaluate(() => data.stockLog.length), await PC.p.evaluate(() => data.stockLog.length)]);
    const ids = p => p.evaluate(() => data.stockLog.map(x => x.id).sort().join(','));
    const iC = await ids(CEL.p), iP = await ids(PC.p);
    chk('1. … con los mismos ids en los dos (y sin ids repetidos)', iC === iP && new Set(iC.split(',')).size === 303, [iC.length, iP.length]);
    await pausa(3000);
    const nube = async () => ((await sb.sql('select datos from datos_negocio where negocio_id = $1', [NEG]))[0].datos.stockLog || []);
    chk('1. La nube también tiene 303 (no se duplicó)', (await nube()).length === 303, (await nube()).length);
    // ===== 2. Vendiendo: cada cambio sube solo el movimiento nuevo =====
    const vMax = (await sb.sql('select coalesce(max(version), 0) v from datos_cambios where negocio_id = $1', [NEG]))[0].v;
    for(let i = 0; i < 4; i++){ await CEL.p.evaluate(() => { invOnSale({ productId: 'a' }, 1); saveData(); }); await pausa(1500); }
    await pausa(3000);
    const cambios = await sb.sql("select version, cambios->'stockLog' s from datos_cambios where negocio_id = $1 and version > $2 and cambios ? 'stockLog' order by version", [NEG, vMax]);
    const forma = cambios.map(c => c.s && c.s.l ? 'pre' + (c.s.l.pre || []).length + (c.s.l.set && c.s.l.set.length ? '+set' : '') + (c.s.l.del && c.s.l.del.length ? '+del' : '') : c.s && c.s.v ? 'lista entera (' + c.s.v.length + ')' : JSON.stringify(c.s).slice(0, 40));
    chk('2. Vendiendo 4 veces, la nube guarda solo el movimiento nuevo cada vez (no la lista entera)', cambios.length >= 1 && forma.every(f => /^pre[1-4]$/.test(f)) && forma.reduce((s, f) => s + +f.slice(3), 0) === 4, forma);
    // ===== 3. El otro equipo los recibe; el cálculo da lo mismo =====
    chk('3. El computador recibe los 4 movimientos nuevos (307)', await esperar(PC.p, () => (data.stockLog || []).length === 307, null, 30000), await PC.p.evaluate(() => data.stockLog.length));
    const r3 = await CEL.p.evaluate(() => {
      // Mismos movimientos en el orden viejo (de viejo a nuevo) y en el nuevo (de nuevo a viejo): mismo resultado
      const L = data.stockLog.slice(); const nuevo = { a: invRate('a'), b: invRate('b') };
      data.stockLog = L.slice().sort((x, y) => x.at - y.at); const viejo = { a: invRate('a'), b: invRate('b') };
      data.stockLog = L; return { nuevo, viejo };
    });
    chk('3. «Días de inventario»: el consumo por día da lo mismo con la lista nueva que en el orden de antes', Math.abs(r3.nuevo.a - r3.viejo.a) < 1e-6 * r3.nuevo.a && Math.abs(r3.nuevo.b - r3.viejo.b) < 1e-6 * r3.nuevo.b && r3.nuevo.a > 0, { r3, rateViejo });
    chk('3. … y antes de convertir la lista vieja daba un valor razonable (no se disparaba)', rateViejo.a > 0 && rateViejo.a < 100, rateViejo);
    // ===== 4. Casos de la revisión =====
    // 4c. Un negocio sin ningún movimiento todavía (data.stockLog no existe): la venta descuenta el inventario y anota el movimiento
    const r4c = await CEL.p.evaluate(() => { const g = { id: 'g', name: 'Gaseosa', price: 3000, stock: 25 }; data.products.push(g); const antes = data.stockLog; delete data.stockLog;
      invOnSale({ productId: 'g' }, 2); const r = { stock: g.stock, n: (data.stockLog || []).length }; data.stockLog = antes; return r; });
    chk('4c. Sin movimientos todavía: la venta descuenta el inventario (25 → 23) y anota el movimiento', r4c.stock === 23 && r4c.n === 1, r4c);
    const r4 = await CEL.p.evaluate(() => {
      // 4a. Una mezcla sin copia de referencia juntó la lista vieja (sin id) con la convertida: cada movimiento dos veces
      const t0 = Date.now() - 5 * 864e5, viejos = []; for(let i = 0; i < 10; i++) viejos.push({ p: 'a', q: 1, at: t0 + i * 1000 });
      data.stockLog = viejos.map(x => Object.assign({}, x)); invLogConId();
      const convertida = data.stockLog.map(x => Object.assign({}, x));
      data.stockLog = convertida.concat(viejos.map(x => Object.assign({}, x)));   // 20 renglones: los 10 con id y los mismos 10 sin id
      invOnSale({ productId: 'a' }, 1);
      const L = data.stockLog, unicos = new Set(L.map(x => x.id)).size;
      // 4b. Tope: vendiendo mucho, la lista nunca pasa de 2.600 (las versiones de antes recortan al pasar de 3.000)
      data.stockLog = []; let max = 0; for(let i = 0; i < 3200; i++){ invOnSale({ productId: 'b' }, 1); max = Math.max(max, data.stockLog.length); }
      return { n: L.length, unicos, todos: L.every(x => x.id), max, fin: data.stockLog.length, nuevoPrimero: data.stockLog[0].at >= data.stockLog[data.stockLog.length - 1].at };
    });
    chk('4a. Lista vieja y convertida juntas (mezcla sin copia de referencia): quedan 11 movimientos, uno por id (no 21)', r4.n === 11 && r4.unicos === 11 && r4.todos, r4);
    chk('4b. Vendiendo 3.200 veces la lista nunca pasa de 2.600 (las versiones de antes no llegan a recortar) y lo nuevo va primero', r4.max <= 2600 && r4.fin <= 2600 && r4.fin >= 2400 && r4.nuevoPrimero, r4);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close().catch(() => {}); await sb.cerrar().catch(() => {});
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
