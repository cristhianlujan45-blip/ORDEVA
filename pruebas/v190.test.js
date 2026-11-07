// 💵 ORDEVA 1.90.0 · Cobrar en dólares (lib/vento-dolares.js).
//  1. Ajustes → Pagos: prender y poner la tasa del día.
//  2. Ventana de cobro: «Cobrar en dólares» con el total en dólares; si no alcanza no deja; las vueltas salen en pesos.
//  3. La venta queda en pesos con el pago en dólares (US$, tasa, vueltas en pesos).
//  4. El arqueo y el cierre restan las vueltas en pesos (salieron de la caja). En la cuenta de una mesa también.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
  const pausa = ms => new Promise(r => setTimeout(r, ms));
  try{
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await pausa(1000);
    await p.evaluate(() => { const s = document.getElementById('authType'); s.value = 'bar'; s.dispatchEvent(new Event('change')); });
    await p.fill('#authBiz', 'Bar Turistas'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await pausa(1500);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.products = [{ id: 'mc', name: 'Michelada', price: 23000 }]; data.history = []; data.closures = []; saveData(); });

    // ===== 1 =====
    await p.click('nav button[data-view="ajustes"]'); await pausa(200);
    await p.click('.ajustes-cat[data-cat="pagos"]').catch(() => {}); await pausa(400);
    let v = await p.evaluate(() => { const b = document.getElementById('usdBox'); if(!b) return null; b.querySelector('#usdTasa').value = '4000'; const s = b.querySelector('#usdOn'); s.checked = true; s.dispatchEvent(new Event('change')); return data.usdCfg; });
    chk('1. Ajustes → Pagos: «Cobrar en dólares» prendido con la tasa de 4.000', v && v.on === true && v.tasa === 4000, v);

    // ===== 2 =====
    await p.evaluate(() => { window.ventoTurno.abrir(100000); window.ventoPOS.abrirCaja(); }); await pausa(500);
    await p.evaluate(() => { window.ventoPOS.agregar('mc', 2); }); await pausa(200);
    await p.evaluate(() => { window._c = window.ventoPOS.cobrar(); }); await pausa(400);
    await p.click('.pz-pago-ov .pz-usd-btn'); await pausa(200);
    v = await p.evaluate(() => document.querySelector('.pz-usd-tot').innerText);
    chk('2. Total $46.000 = US$ 11.5 (a 4.000)', /US\$ 11\.5/.test(v) && /46\.000/.test(v), v);
    await p.fill('.pz-usd-in', '10'); await pausa(100);
    v = await p.evaluate(() => ({ dis: document.querySelector('.pz-usd-ok').disabled, t: document.querySelector('.pz-usd-vu').innerText }));
    chk('2. Con 10 dólares no alcanza: dice cuánto falta y no deja cobrar', v.dis && /Faltan/.test(v.t) && /6\.000/.test(v.t), v);
    await p.fill('.pz-usd-in', ''); await p.click('.pz-usd-box [data-usd="20"]'); await pausa(100);
    v = await p.evaluate(() => ({ dis: document.querySelector('.pz-usd-ok').disabled, t: document.querySelector('.pz-usd-vu').innerText }));
    chk('2. Con un billete de 20 dólares: vueltas EN PESOS $34.000', !v.dis && /PESOS/.test(v.t) && /34\.000/.test(v.t), v);
    await p.click('.pz-usd-ok');
    v = await p.evaluate(async () => { const e = await window._c; const pu = e.payments.find(x => x.method === 'usd'); return { tot: e.total, pu, usd: e.usd }; });
    chk('3. La venta queda por $46.000 con el pago en dólares: US$ 20, tasa 4.000, vueltas $34.000', v.tot === 46000 && v.pu && v.pu.amount === 46000 && v.pu.usd === 20 && v.pu.tasa === 4000 && v.pu.vueltasCop === 34000 && v.usd && v.usd.usd === 20, v);

    // ===== 4 =====
    v = await p.evaluate(() => ({ esperado: window.ventoTurno.resumen().esperado, ef: computeClosureStats(null, new Date().toISOString()).totalEfectivo, medios: computeClosureStats(null, new Date().toISOString()).medios, rec: window.ventoDolares.recibidos() }));
    chk('4. El arqueo resta las vueltas en pesos: debía haber $66.000 (base 100.000 − 34.000)', v.esperado === 66000 && v.ef === -34000, v);
    chk('4. … el cierre muestra los dólares aparte (en pesos) y cuántos dólares entraron (US$ 20)', v.medios.usd === 46000 && v.rec.usd === 20 && v.rec.vueltas === 34000, v);
    v = await p.evaluate(async () => { data.tables[3] = { items: [{ productId: 'mc', name: 'Michelada', price: 23000, qty: 1, personId: null, history: [] }], payments: [], people: [] };
      const e = await window.ventoPOS.cobrarMesa(3, { pago: { method: 'usd', metodo: 'usd', nota: 'US$ 10 · tasa $4.000', usd: 10, tasa: 4000, vueltasCop: 17000, vueltas: 17000, recibido: 40000 } });
      const pu = e.payments.find(x => x.method === 'usd'); return { tot: e.total, pu, esperado: window.ventoTurno.resumen().esperado }; });
    chk('4. En la cuenta de una mesa también: US$ 10, vueltas $17.000, y la caja baja a $49.000', v.tot === 23000 && v.pu && v.pu.usd === 10 && v.pu.vueltasCop === 17000 && v.esperado === 49000, v);
    v = await p.evaluate(() => { data.usdCfg.on = false; window.ventoPOS.agregar('mc', 1); window._c2 = window.ventoPOS.cobrar(); return new Promise(r => setTimeout(() => { const x = !!document.querySelector('.pz-pago-ov .pz-usd-btn'); document.querySelector('.pz-pago-ov .pz-cancel').click(); r(x); }, 300)); });
    chk('4. Apagado, no sale «Cobrar en dólares»', v === false, v);
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.message)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
