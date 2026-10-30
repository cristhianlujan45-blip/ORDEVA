// 🏷️📝⏸️🔁 ORDEVA 1.67.5 · Fase 4: descuento autorizado, nota, ventas suspendidas y repetir una venta (Caja). Sin internet.
//  1. Descuento 10 % (dueño, directo): $26.000 → $23.400; se reparte en el precio de cada producto (sin líneas
//     negativas) y queda el precio de lista; el cierre cuenta $23.400.
//  2. Descuento en pesos con redondeo: el total queda exacto.
//  3. Empleado: sin clave del dueño puesta, no hay descuento; con clave equivocada, tampoco; con la clave, sí
//     (y queda «autorizado con clave» en la venta).
//  4. Nota de la venta: queda en la venta y se ve en el historial (con el descuento).
//  5. Suspender: la caja queda libre y sale «📂 Pendientes (1)»; no se recupera encima de otra venta; al recuperar vuelven
//     los productos con su descuento y nota.
//  6. Borrar una pendiente pide confirmación (y la confirmación queda ENCIMA, se puede tocar).
//  7. 🔁 Repetir desde «Caja de hoy»: los productos pasan a la caja con el precio de hoy.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';

(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1200);
    await p.fill('#authBiz', 'Tienda Extra'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1500);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await p.evaluate(() => {
      document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.products = [{ id: 'a', name: 'Almuerzo', price: 20000, cost: 12000 }, { id: 'g', name: 'Gaseosa', price: 3000, cost: 1500 }, { id: 'x', name: 'Arepa', price: 3333 }, { id: 'u', name: 'Dulce', price: 1000 }];
      data.history = []; saveData(); window.ventoPOS.abrirCaja();
    });
    await p.waitForTimeout(400);
    const R = '#pzCajaOv .pz-caja-root';
    const llenar = l => p.evaluate(l => { window.ventoPOS.vaciar(); l.forEach(([id, n]) => window.ventoPOS.agregar(id, n)); }, l);
    const cobrarEfectivo = async () => { await p.click(R + ' .pz-cobrar'); await p.waitForSelector('.pz-pago-ov.show'); await p.click('.pz-pago-ov .pz-met[data-m="efectivo"]'); await p.waitForTimeout(400); };
    const descuento = async (tipo, v) => { await p.click(R + ' [data-desc]'); await p.waitForSelector('.pz-mini-ov'); await p.click('.pz-mini-ov [data-t="' + tipo + '"]'); await p.fill('.pz-mini-ov .pz-dv', String(v)); await p.click('.pz-mini-ov [data-ok]'); await p.waitForTimeout(400); };

    // ===== 1. 10 % =====
    await llenar([['a', 1], ['g', 2]]); await p.waitForTimeout(200);
    await descuento('%', 10);
    let v = await p.evaluate(R => ({ total: document.querySelector(R + ' .pz-total b').textContent, desc: (document.querySelector(R + ' .pz-desc') || {}).textContent || '' }), R);
    chk('1. Descuento 10 % del dueño: el carrito dice −$2.600 y el total $23.400', /2\.600/.test(v.desc) && /23\.400/.test(v.total), v);
    await cobrarEfectivo();
    v = await p.evaluate(() => { const h = data.history[0]; const s = computeClosureStats(null, new Date(Date.now() + 1000).toISOString()); return { total: h.total, items: h.items.map(i => [i.name, i.price, i.precioLista, i.qty]), d: h.descuento, ef: s.totalEfectivo }; });
    chk('1. Venta por $23.400 con el descuento repartido: Almuerzo $18.000 (antes $20.000), Gaseosa $2.700 (antes $3.000)', v.total === 23400 && JSON.stringify(v.items) === JSON.stringify([['Almuerzo', 18000, 20000, 1], ['Gaseosa', 2700, 3000, 2]]), v);
    chk('1. La venta guarda el descuento ($2.600 de $26.000, 10 %) y el cierre cuenta $23.400', v.d && v.d.valor === 2600 && v.d.bruto === 26000 && v.d.tipo === '%' && v.d.v === 10 && v.ef === 23400, v);

    // ===== 2. $ con redondeo =====
    await llenar([['x', 1], ['u', 3]]); await p.waitForTimeout(200);
    await descuento('$', 1000);
    await cobrarEfectivo();
    v = await p.evaluate(() => { const h = data.history[0]; return { total: h.total, suma: h.items.reduce((s, i) => s + i.price * i.qty, 0), d: h.descuento && h.descuento.valor }; });
    chk('2. Descuento de $1.000 sobre $6.333: total exacto $5.333 (y los renglones suman lo mismo)', v.total === 5333 && v.suma === 5333 && v.d === 1000, v);

    // ===== 3. Empleado =====
    await p.evaluate(() => { window.__jefe = window.ventoRoles.esJefe; window.ventoRoles.esJefe = () => false; });
    await llenar([['g', 1]]); await p.waitForTimeout(200);
    await descuento('%', 50);
    v = await p.evaluate(R => ({ desc: !!document.querySelector(R + ' .pz-desc'), toast: (document.getElementById('toast') || {}).textContent || '' }), R);
    chk('3. Empleado sin clave del dueño puesta: no hay descuento', !v.desc, v);
    await p.evaluate(async () => { document.querySelectorAll('.pz-mini-ov').forEach(o => o.remove()); window.ventoRoles.esJefe = window.__jefe; await window.ventoVentaFix.ponerClave('2468'); window.ventoRoles.esJefe = () => false; });
    await descuento('%', 50);
    await p.waitForSelector('#vfOv.show #vfClave', { timeout: 4000 });
    await p.fill('#vfClave', '1111'); await p.click('#vfSi'); await p.waitForTimeout(1500);
    v = await p.evaluate(R => !!document.querySelector(R + ' .pz-desc'), R);
    chk('3. Con clave equivocada: tampoco', !v, v);
    await p.evaluate(() => { const o = document.getElementById('vfOv'); if(o) o.classList.remove('show'); document.querySelectorAll('.pz-mini-ov').forEach(x => x.remove()); });
    await descuento('%', 50);
    await p.waitForSelector('#vfOv.show #vfClave', { timeout: 4000 });
    await p.fill('#vfClave', '2468'); await p.click('#vfSi'); await p.waitForTimeout(1500);
    v = await p.evaluate(R => ({ desc: (document.querySelector(R + ' .pz-desc') || {}).textContent || '', total: document.querySelector(R + ' .pz-total b').textContent }), R);
    chk('3. Con la clave del dueño: descuento de $1.500 «autorizado con clave»', /1\.500/.test(v.desc) && /autorizado con clave/.test(v.desc) && /1\.500/.test(v.total), v);
    await p.evaluate(() => { window.ventoRoles.esJefe = window.__jefe; });

    // ===== 4. Nota =====
    await p.click(R + ' [data-nota]'); await p.waitForSelector('.pz-mini-ov .pz-nv');
    await p.fill('.pz-mini-ov .pz-nv', 'Para llevar, sin hielo'); await p.click('.pz-mini-ov [data-ok]'); await p.waitForTimeout(300);
    await cobrarEfectivo();
    v = await p.evaluate(() => { const h = data.history[0]; renderHistorial(); const row = document.querySelector('.hist-row[data-idx="0"]'); return { obs: h.observacion, d: h.descuento && h.descuento.por, txt: row ? row.innerText : '' }; });
    chk('4. La nota queda en la venta y el historial muestra la nota y el descuento', v.obs === 'Para llevar, sin hielo' && v.d === 'autorizado con clave' && /Para llevar, sin hielo/.test(v.txt) && /Descuento 50 %/.test(v.txt), v);

    // ===== 5. Suspender / recuperar =====
    await llenar([['a', 2]]); await p.waitForTimeout(200);
    await descuento('%', 5);
    await p.click(R + ' [data-susp]'); await p.waitForSelector('.pz-mini-ov .pz-sn');
    await p.fill('.pz-mini-ov .pz-sn', 'Pedido de Juan'); await p.click('.pz-mini-ov [data-ok]'); await p.waitForTimeout(400);
    v = await p.evaluate(R => ({ lineas: window.ventoPOS.carrito().length, pend: (document.querySelector(R + ' [data-pend]') || {}).textContent || '', desc: !!document.querySelector(R + ' .pz-desc'), ventas: data.history.length }), R);
    chk('5. Suspender: la caja queda libre (sin descuento) y sale «📂 Pendientes (1)»; no se registró venta', v.lineas === 0 && /Pendientes \(1\)/.test(v.pend) && !v.desc && v.ventas === 3, v);
    await llenar([['g', 1]]); await p.waitForTimeout(200);
    await p.click(R + ' [data-pend]'); await p.waitForSelector('.pz-mini-ov .pz-pf');
    await p.click('.pz-mini-ov [data-rec]'); await p.waitForTimeout(300);
    v = await p.evaluate(() => ({ lineas: window.ventoPOS.carrito().map(x => x.id), pend: window.ventoPOS.pendientes().length }));
    chk('5. No se recupera encima de otra venta (la de la caja sigue y la pendiente también)', JSON.stringify(v.lineas) === '["g"]' && v.pend === 1, v);
    await p.evaluate(() => { document.querySelectorAll('.pz-mini-ov').forEach(o => o.remove()); window.ventoPOS.vaciar(); });
    await p.waitForTimeout(200);
    await p.click(R + ' [data-pend]'); await p.waitForSelector('.pz-mini-ov .pz-pf');
    await p.click('.pz-mini-ov [data-rec]'); await p.waitForTimeout(300);
    v = await p.evaluate(R => ({ lineas: window.ventoPOS.carrito().map(x => [x.id, x.qty]), pend: window.ventoPOS.pendientes().length, total: document.querySelector(R + ' .pz-total b').textContent }), R);
    chk('5. Recuperar: vuelven 2 Almuerzos con su 5 % ($38.000)', JSON.stringify(v.lineas) === '[["a",2]]' && v.pend === 0 && /38\.000/.test(v.total), v);

    // ===== 6. Borrar pendiente =====
    await p.click(R + ' [data-susp]'); await p.waitForSelector('.pz-mini-ov .pz-sn'); await p.click('.pz-mini-ov [data-ok]'); await p.waitForTimeout(300);
    await p.click(R + ' [data-pend]'); await p.waitForSelector('.pz-mini-ov .pz-pf');
    await p.click('.pz-mini-ov [data-del]'); await p.waitForTimeout(300);
    const pidio = await p.evaluate(() => document.getElementById('confirmOverlay').classList.contains('show'));
    await p.click('#confirmOkBtn'); await p.waitForTimeout(300);
    v = await p.evaluate(() => window.ventoPOS.pendientes().length);
    chk('6. Borrar una venta pendiente pide confirmación y la quita', pidio && v === 0, { pidio, v });
    await p.evaluate(() => document.querySelectorAll('.pz-mini-ov').forEach(o => o.remove()));

    // ===== 7. Repetir =====
    await p.evaluate(() => { data.products.find(x => x.id === 'a').price = 21000; saveData(); window.ventoPOS.vaciar(); window.ventoPOS.cajaDeHoy(); });
    await p.waitForSelector('.pz-hoy-ov [data-rep]');
    const idx = await p.evaluate(() => { const l = [...document.querySelectorAll('.pz-hoy-ov .pz-hoy-v')]; return l.findIndex(x => /23\.400/.test(x.textContent)); });
    await p.click('.pz-hoy-ov .pz-hoy-v:nth-child(' + (idx + 1) + ') [data-rep]'); await p.waitForTimeout(300);
    v = await p.evaluate(() => window.ventoPOS.carrito().map(x => [x.id, x.qty, x.price]));
    chk('7. 🔁 Repetir la venta de $23.400: 1 Almuerzo (al precio de hoy, $21.000) y 2 Gaseosas', JSON.stringify(v) === JSON.stringify([['a', 1, 21000], ['g', 2, 3000]]), v);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
