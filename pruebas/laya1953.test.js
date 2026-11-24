// 🧠 1.99.53 · Auditoría de Laya con un día de ventas de la agropecuaria («Laya no debe inventar cifras»): caja con base
// $50.000; ventas $10.000 en efectivo, $30.000 mixta ($10.000 efectivo + $20.000 Nequi), $18.000 en efectivo y $15.000 fiada
// a Tania. Revisa:
//  1. «¿Cuánto hay en caja?» es el efectivo del cajón: $88.000 (base 50.000 + 38.000 en efectivo), y aclara que lo de
//     transferencias y lo fiado no está en la caja (antes respondía $73.000, todo lo vendido).
//  2. «¿Cuánto vendí hoy?»: $73.000 en 4 ventas y dice que $15.000 quedó fiado (antes «4 cuentas cobradas»).
//  3. Sin caja abierta: dice el efectivo que entró por ventas y que abra la caja para saber cuánto debe haber.
//  4. «¿Quién me debe?» y «¿Cuánto me debe Tania?»: $15.000.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 500) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 412, height: 915 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-guia-tour', '1'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE); await p.waitForTimeout(1000);
    await p.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); window.speakVoice = () => {}; window.showConfirm = async () => true;
      data.products = [{ id: 'p1', name: 'Semilla maíz', price: 5000, cost: 3000, stock: 50 }, { id: 'p2', name: 'Bulto concentrado', price: 30000, cost: 22000, stock: 10 }, { id: 'p3', name: 'Fumigadora', price: 15000, cost: 9000, stock: 5 }];
      data.history = []; data.libreta = { movs: [] }; data.turno = null; await saveData(); });
    // 3. Sin caja abierta
    await p.evaluate(() => { const v = (m, pagos) => ({ id: 'h' + Math.random(), date: new Date(Date.now() + 100).toISOString(), table: null, tableName: 'Mostrador', total: m, debt: pagos.filter(x => x.method === 'debe').reduce((a, x) => a + x.amount, 0), items: [{ name: 'x', price: m, qty: 1 }], payments: pagos });
      data.history.push(v(10000, [{ method: 'efectivo', amount: 10000 }]), v(30000, [{ method: 'efectivo', amount: 10000 }, { method: 'transferencia', amount: 20000, note: 'Nequi' }]), v(18000, [{ method: 'efectivo', amount: 18000 }]), v(15000, [{ method: 'debe', amount: 15000, note: 'Tania' }])); saveData(); });
    const sin = await p.evaluate(() => window.Laya.responder('cuánto hay en caja').text);
    chk('3. Sin caja abierta: el efectivo que entró ($38.000) y que abra la caja', /\$38\.000 en efectivo/.test(sin) && /abre la caja/.test(sin) && !/\$88\.000/.test(sin), sin);
    // 1
    await p.evaluate(() => { ventoTurno.ponerTurno({ abierto_en: new Date(Date.now() - 3600e3).toISOString(), base: 50000, por: 'ana', movs: [] }); });
    const caja = await p.evaluate(() => window.Laya.responder('¿cuánto hay en caja?').text);
    chk('1. «¿Cuánto hay en caja?» → $88.000 en efectivo (base + efectivo), sin contar transferencias ni fiado', /debe haber \$88\.000 en efectivo/.test(caja) && /\$20\.000 por transferencia/.test(caja) && /\$15\.000 fiado/.test(caja) && /no está en la caja/.test(caja), caja);
    chk('1. … también «¿cuánto efectivo tengo?»', /\$88\.000/.test(await p.evaluate(() => window.Laya.responder('cuánto efectivo tengo').text)));
    // 2
    const vh = await p.evaluate(() => asisLocal('cuánto vendí hoy'));
    chk('2. «¿Cuánto vendí hoy?»: $73.000 en 4 ventas, $15.000 quedó fiado', /\$73\.000 en 4 ventas/.test(vh) && /\$15\.000 quedó fiado/.test(vh) && !/cobradas/.test(vh), vh);
    // 4
    const deben = await p.evaluate(() => [asisLocalMas('quién me debe') || asisLocal('quién me debe') || '', (window.libretaEntender('cuánto me debe Tania') || {}).texto || '']);
    chk('4. Quién me debe / cuánto me debe Tania: $15.000', /\$15\.000/.test(deben[0]) && /Tania/.test(deben[0]) && /Tania te debe \$15\.000/.test(deben[1]), deben);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
