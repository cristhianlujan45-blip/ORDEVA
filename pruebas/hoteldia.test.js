// 🏨 ORDEVA 1.82.0 · El día del hotel: ocupación, tarifa promedio (ADR), RevPAR y «🧳 Salen hoy» con su saldo. Sin internet.
//  1. Arriba de las habitaciones: «🏨 Hoy: 1 de N ocupadas» y «🧳 Salen hoy: 1 · $180.000 por cobrar» (de las reservas).
//  2. Al tocarla: la habitación que sale hoy, con quién y lo que debe, y «💰 Cobrar» abre su cuenta.
//  3. Indicadores del mes (con el día 20 como «hoy»): noches vendidas de las cuentas cobradas y de la habitación ocupada,
//     solo lo de las noches (sin minibar); ADR = lo de las noches ÷ noches; RevPAR y ocupación sobre habitaciones × días.
//  4. Una venta del mes pasado no cuenta. Una estadía que empezó el mes pasado solo cuenta las noches de este mes.
//  5. En un restaurante no aparece.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  const pausa = ms => new Promise(r => setTimeout(r, ms));
  async function abrir(tipo, nombre){
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
    await p.goto(BASE + '/index.html'); await pausa(1000);
    await p.evaluate(t => { const s = document.getElementById('authType'); if(s){ s.value = t; s.dispatchEvent(new Event('change')); } }, tipo);
    await p.fill('#authBiz', nombre); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn');
    await p.waitForFunction(() => document.getElementById('authOverlay').hidden, null, { timeout: 15000 });
    await p.click('#onbSaltar', { timeout: 4000 }).catch(() => {});
    await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    return p;
  }
  try{
    const p = await abrir('hotel', 'Hotel El Prado');
    await p.waitForFunction(() => !!window.ventoHotelDia && !!window.ventoHotel, null, { timeout: 10000 });
    const N = await p.evaluate(() => {
      const D = 864e5, ahora = Date.now();
      data.products = [{ id: 'hd', name: 'Habitación doble', price: 90000 }, { id: 'mb', name: 'Minibar', price: 20000 }];
      Object.keys(data.tables).forEach(k => { data.tables[k].items = []; delete data.tables[k].entrada; });
      // Habitación 2 ocupada desde antier: 2 noches de $90.000 (ocupada AHORA)
      data.tables[2].items = [{ productId: 'hd', name: 'Habitación doble', price: 90000, qty: 2, history: [{ qty: 2, at: ahora - 2 * D }] }];
      data.tables[2].entrada = ahora - 2 * D;
      data.history = []; saveData();
      // Reservas (el servidor): la habitación 2 sale hoy (Ana Pérez)
      const hoy = new Date(); hoy.setHours(12, 0, 0, 0);
      window.ventoReservas.estado = () => ({ lista: [{ id: 'r1', recurso: '2', recurso_nombre: 'Habitación 2', desde: new Date(ahora - 2 * D).toISOString(), hasta: hoy.toISOString(), estado: 'llego', cliente: 'Ana Pérez' }], ocupadas: {} });
      return Object.keys(data.tables).length; });
    // ===== 1 =====
    await p.evaluate(() => { document.querySelector('nav button[data-view="mesas"]') && document.querySelector('nav button[data-view="mesas"]').click(); window.ventoHotelDia.tarjeta(); });
    await pausa(400);
    let v = await p.evaluate(() => { const c = document.getElementById('hdCard'); return c ? c.textContent.replace(/\s+/g, ' ') : ''; });
    chk('1. Arriba: «🏨 Hoy: 1 de ' + N + ' ocupadas»', new RegExp('Hoy: 1 de ' + N + ' ocupadas').test(v), v);
    chk('1. … y «🧳 Salen hoy: 1 · $180.000 por cobrar»', /Salen hoy: 1/.test(v) && /180\.000 por cobrar/.test(v), v);
    // ===== 2 =====
    await p.click('#hdCard'); await pausa(400);
    v = await p.evaluate(() => { const o = document.getElementById('hdOv'); return o && o.classList.contains('show') ? o.textContent.replace(/\s+/g, ' ') : ''; });
    chk('2. La ventana: «Habitación 2 · Ana Pérez · Debe $180.000» con «💰 Cobrar»', /Habitación 2/.test(v) && /Ana Pérez/.test(v) && /Debe \$\s?180\.000/.test(v) && /Cobrar/.test(v), v.slice(0, 400));
    await p.click('#hdOv [data-hdcobrar="2"]'); await pausa(500);
    chk('2. «💰 Cobrar» abre la cuenta de la habitación 2', await p.evaluate(() => document.getElementById('overlay').classList.contains('show') && String(currentTable) === '2'));
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); currentTable = null; });
    // ===== 3 / 4 =====
    v = await p.evaluate(() => {
      const D = 864e5, base = new Date(); base.setDate(20); base.setHours(12, 0, 0, 0); const B = base.getTime();
      const venta = (lleg, sale, noches, items) => ({ id: 'v' + Math.random(), table: 5, total: items.reduce((s, i) => s + i.price * i.qty, 0), payments: [], debt: 0, date: new Date(sale).toISOString(), entrada: new Date(lleg).toISOString(), noches, items });
      data.history = [
        venta(B - 3 * D, B - 3600e3, 3, [{ name: 'Habitación doble', qty: 3, price: 100000 }, { name: 'Minibar', qty: 1, price: 20000 }]),   // 3 noches, $300.000 (sin minibar)
        venta(B - 1 * D, B - 7200e3, 1, [{ name: 'Habitación sencilla', qty: 1, price: 80000 }]),                                            // 1 noche, $80.000
        venta(B - 45 * D, B - 40 * D, 2, [{ name: 'Habitación doble', qty: 2, price: 100000 }]) ];                                         // mes pasado: no cuenta
      // La habitación 2 (ocupada) llegó el 18: 2 noches de $90.000 = $180.000
      data.tables[2].entrada = B - 2 * D; data.tables[2].items[0].history = [{ qty: 2, at: B - 2 * D }];
      // Una estadía que empezó el mes pasado (llegó el último día del mes pasado, salió el 2): solo 1 noche de este mes
      const ini = new Date(B); ini.setDate(1); ini.setHours(0, 0, 0, 0);
      data.history.push(venta(ini.getTime() - 12 * 3600e3, ini.getTime() + D + 10 * 3600e3, 2, [{ name: 'Habitación doble', qty: 2, price: 100000 }]));
      return window.ventoHotelDia.mes(B); });
    // Noches: 3 + 1 + 2 (ocupada) + 1 (la que empezó el mes pasado) = 7; valor: 300.000 + 80.000 + 180.000 + 100.000 = 660.000
    chk('3. Noches vendidas del mes: 7 (3 + 1 + 2 de la ocupada + 1 de la que empezó el mes pasado)', v.noches === 7, v);
    chk('3. Lo de las noches: $660.000 (sin el minibar)', v.valor === 660000, v);
    chk('3. ADR = $660.000 ÷ 7 = $94.286', Math.round(v.adr) === 94286, v);
    chk('3. Ocupación y RevPAR sobre ' + N + ' habitaciones × 20 días', v.dias === 20 && v.disponibles === N * 20 && Math.abs(v.ocupacion - 7 / (N * 20)) < 1e-9 && Math.round(v.revpar) === Math.round(660000 / (N * 20)), v);
    chk('4. La venta del mes pasado no cuenta (si contara serían 9 noches)', v.noches !== 9, v);
    // ===== 5 =====
    const r = await abrir('restaurante', 'Restaurante Sin Hotel');
    await pausa(3500);
    chk('5. En un restaurante no aparece', await r.evaluate(() => !document.getElementById('hdCard')));
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ Excepción: ' + (e && e.stack || e)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
