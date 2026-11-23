// 🗂️ 1.99.47 · «Que se vea más organizado» (pedido del dueño con los pantallazos del Historial, 23/11). En un celular de
// 412 px, con 6 cierres de caja y 36 ventas, revisa:
//  1. Las herramientas de la caja en una fila de 3 (💵 Caja · 📊 Gráficas · 📗 Cierres Z) y siguen funcionando.
//  2. Resumen general: el total vendido completo en una línea («$10.490.222», antes se partía).
//  3. Cierres de caja: se ven los 3 últimos y «Ver los 6 cierres ▾» muestra todos.
//  4. El cierre que junta varios días lo dice («⚠️ junta 2 días») y su fecha es corta.
//  5. «Todos · Pagaron · Deben» quedó encima del buscador de «Cuentas cerradas» y filtra como siempre.
//  6. La página no se mueve de lado.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 500) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, timezoneId: 'America/Bogota' });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-guia-tour', '1'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE); await p.waitForTimeout(1000);
    await p.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      const H = []; let n = 0; for(let d = 12; d <= 23; d++){ for(let k = 0; k < 3; k++){ n++; const deb = n % 5 === 0, m = n === 1 ? 9300222 : 15000 + n * 1000; H.push({ id: 'h' + n, invoiceNo: 'FV-' + n, date: new Date(2026, 10, d, 10 + k * 3).toISOString(), table: 1, total: m, debt: deb ? m : 0, items: [{ name: 'Concentrado', price: m, qty: 1 }], payments: [{ method: deb ? 'debe' : 'efectivo', amount: m, note: deb ? 'Tania' : '' }] }); } }
      data.history = H;
      const cie = (f, t, c) => ({ id: 'c' + t, date: new Date(2026, 10, t, 23, 30).toISOString(), from: new Date(2026, 10, f, 23, 30).toISOString(), ticketCount: c, totalSold: c * 30000, totalEfectivo: c * 30000, totalTransferencia: 0, hourly: [] });
      data.closures = [cie(20, 22, 11), cie(19, 20, 9), cie(14, 19, 8), cie(13, 14, 13), cie(12, 13, 9), cie(11, 12, 1)];
      await saveData(); document.querySelector('[data-view="historial"]').click(); });
    await p.waitForTimeout(1800);
    const herr = await p.evaluate(() => { const h = document.getElementById('hoHerr'); const bs = [...h.children].filter(x => x.getClientRects().length); return { ids: bs.map(x => x.id), tops: new Set(bs.map(x => Math.round(x.getBoundingClientRect().top))).size, alto: bs.map(x => Math.round(x.getBoundingClientRect().height)) }; });
    chk('1. Herramientas en una fila de 3: Caja · Gráficas · Cierres Z', herr.ids.join() === 'vtCajaBtn,chartsToggle,cmCierresBtn' && herr.tops === 1 && herr.alto.every(h => h >= 44), herr);
    await p.click('#chartsToggle'); await p.waitForTimeout(300);
    chk('1. … «Gráficas» sigue abriendo las gráficas', await p.evaluate(() => !document.getElementById('chartsPanel').hidden));
    await p.click('#chartsToggle'); await p.waitForTimeout(200);
    const tot = await p.evaluate(() => { const n = document.querySelectorAll('#histSummary .hist-stat .n')[1]; return { t: n.textContent, cabe: n.scrollWidth <= n.clientWidth + 1, alto: n.getBoundingClientRect().height }; });
    chk('2. El total vendido completo en una línea (' + tot.t + ')', tot.cabe && tot.alto < 40 && /\$10\.\d{3}\.\d{3}/.test(tot.t), tot);
    const vis = () => p.evaluate(() => [...document.querySelectorAll('#closuresList > .hist-row')].filter(r => r.getClientRects().length).length);
    chk('3. Cierres: se ven los 3 últimos', (await vis()) === 3 && /Ver los 6 cierres/.test(await p.textContent('#hoCierresMas')));
    await p.click('#hoCierresMas'); await p.waitForTimeout(200);
    chk('3. … «Ver los 6 cierres» muestra todos', (await vis()) === 6);
    const f0 = await p.evaluate(() => document.querySelector('#closuresList .hist-row .hist-date').textContent);
    chk('4. El cierre que junta días lo dice, con la fecha corta', /junta 2 días/.test(f0) && !/2026/.test(f0) && f0.length < 90, f0);
    const fl = await p.evaluate(() => { const f = document.getElementById('histFilter'); return { antesDelBuscador: f.nextElementSibling && f.nextElementSibling.id === 'histBuscarCaja' }; });
    await p.click('#histFilter [data-f="deben"]'); await p.waitForTimeout(300);
    const deben = await p.evaluate(() => [...document.querySelectorAll('#histList .hist-row')].filter(r => r.getClientRects().length).every(r => /DEBE/.test(r.textContent)));
    chk('5. «Todos · Pagaron · Deben» encima del buscador, y «Deben» filtra', fl.antesDelBuscador && deben, fl);
    chk('6. La página no se mueve de lado', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
