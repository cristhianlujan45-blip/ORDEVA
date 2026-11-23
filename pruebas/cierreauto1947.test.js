// 🔒 1.99.47 · «Cierres de caja» del dueño (23/11): el sábado 21 no tuvo cierre; el del domingo fue «20 nov 11:30 p. m. —
// 22 nov 11:30 p. m.» (juntó dos días). El cierre automático solo se hacía si ORDEVA estaba despierta entre las 11:30 p. m. y
// la medianoche. Revisa (con el reloj de la página puesto a mano, hora de Colombia):
//  1. Domingo 8:00 a. m., el cierre del sábado a las 11:30 p. m. no se hizo: al despertar se hace, CORTADO a las 11:30 p. m.
//     del sábado (las 2 ventas del sábado; la del domingo 7:00 a. m. queda para el cierre del domingo).
//  2. Otra revisión no lo repite.
//  3. Si ya se cerró a mano después de las 11:30 p. m., no se hace otro.
//  4. A tiempo (domingo 11:31 p. m.): se cierra el domingo, con la venta del domingo.
//  5. Recién prendido el cierre automático: no se hacen cierres de antes de prenderlo.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';
const T = s => new Date(s + '-05:00');
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 500) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, timezoneId: 'America/Bogota' });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-guia-tour', '1'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.clock.setFixedTime(T('2026-11-22T08:00:00'));
    await p.goto(BASE); await p.waitForTimeout(1000);
    const preparar = (cfg, cierres) => p.evaluate(([cfg, cierres]) => {
      const v = (id, iso, m) => ({ id, invoiceNo: 'FV-' + id, date: new Date(iso).toISOString(), table: 1, total: m, items: [{ name: 'Concentrado', price: m, qty: 1 }], payments: [{ method: 'efectivo', amount: m }] });
      data.history = [v('s1', '2026-11-21T14:00:00-05:00', 30000), v('s2', '2026-11-21T18:00:00-05:00', 20000), v('d1', '2026-11-22T07:00:00-05:00', 5000)];
      data.closures = cierres.map((iso, i) => ({ id: 'c' + i, date: new Date(iso).toISOString(), from: null, ticketCount: 1, totalSold: 1 }));
      localStorage.setItem(window.ventoClave('vito_auto'), JSON.stringify(cfg)); saveData(); }, [cfg, cierres]);
    await p.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); });
    const cierres = () => p.evaluate(() => data.closures.map(c => ({ hasta: new Date(c.date).toLocaleString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', hour: 'numeric', minute: '2-digit' }), n: c.ticketCount, total: c.totalSold })));
    // ===== 1 =====
    await preparar({ on: true, times: ['23:30'], last: { '23:30': '2026-11-20' }, open: 'saltar' }, ['2026-11-20T23:30:00-05:00']);
    await p.evaluate(() => window.ventoAcTick()); await p.waitForTimeout(300);
    let c = await cierres();
    chk('1. Domingo 8 a. m.: se hace el cierre del sábado, cortado a las 11:30 p. m. (2 ventas, $50.000)', c.length === 2 && /21/.test(c[0].hasta) && /11:30/.test(c[0].hasta) && c[0].n === 2 && c[0].total === 50000, c);
    // ===== 2 =====
    await p.evaluate(() => window.ventoAcTick()); await p.waitForTimeout(200);
    chk('2. Otra revisión no lo repite', (await cierres()).length === 2, await cierres());
    // ===== 3 =====
    await preparar({ on: true, times: ['23:30'], last: { '23:30': '2026-11-20' }, open: 'saltar' }, ['2026-11-21T23:50:00-05:00', '2026-11-20T23:30:00-05:00']);
    await p.evaluate(() => window.ventoAcTick()); await p.waitForTimeout(200);
    chk('3. Ya se cerró a mano a las 11:50 p. m.: no se hace otro', (await cierres()).length === 2, await cierres());
    // ===== 4 =====
    await preparar({ on: true, times: ['23:30'], last: { '23:30': '2026-11-21' }, open: 'saltar' }, ['2026-11-21T23:30:00-05:00']);
    await p.clock.setFixedTime(T('2026-11-22T23:31:00'));
    await p.evaluate(() => window.ventoAcTick()); await p.waitForTimeout(200);
    c = await cierres();
    chk('4. A tiempo (domingo 11:31 p. m.): se cierra el domingo con su venta ($5.000)', c.length === 2 && /22/.test(c[0].hasta) && c[0].n === 1 && c[0].total === 5000, c);
    // ===== 5 =====
    await p.clock.setFixedTime(T('2026-11-22T08:00:00'));
    await preparar({ on: true, times: ['23:30'], last: {}, open: 'saltar', desde: T('2026-11-22T07:55:00').getTime() }, ['2026-11-20T23:30:00-05:00']);
    await p.evaluate(() => window.ventoAcTick()); await p.waitForTimeout(200);
    chk('5. Recién prendido (7:55 a. m.): no hace el cierre de anoche', (await cierres()).length === 1, await cierres());
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
