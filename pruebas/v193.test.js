// 🎁 ORDEVA 1.93.0 · Bonos y tarjetas de regalo, de punta a punta contra el Servidor ORDEVA de pruebas (PostgreSQL real).
//  1. «Más → 🎁 Bonos de regalo»: vender un bono de $30.000 en efectivo → sale el código y entra a la caja (no es venta).
//  2. Pagar $20.000 con el bono: le quedan $10.000 en el servidor; la venta queda pagada con «bono».
//  3. Una compra de $25.000: el bono paga $10.000 y el resto en efectivo.
//  4. Deshacer esa venta: el saldo vuelve al bono ($10.000).
'use strict';
(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
  const { iniciar, enrutar } = require('./servidor/supabase-local');
  const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
  let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
  const sb = await iniciar(); const b = await chromium.launch();
  const pausa = ms => new Promise(r => setTimeout(r, ms));
  const esperar = (p, fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 20000, polling: 300 }).then(() => true, () => false);
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', rt => { const u = new URL(rt.request().url()); if(u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') return rt.abort(); return rt.continue(); });
    await enrutar(ctx, sb);
    await ctx.addInitScript(() => { try{ localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-hola', '0'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html');
    await p.waitForFunction(() => window.ventoNube && window.ventoNube.crearCuenta, null, { timeout: 15000 });
    await p.fill('#authBiz', 'Tienda Bonos'); await p.fill('#authUser', 'dueno@bonos.co'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn');
    chk('0. Se crea la cuenta en la nube', await esperar(p, () => document.getElementById('authOverlay').hidden));
    await p.click('#onbSaltar', { timeout: 4000 }).catch(() => {});
    await esperar(p, () => !!window.ventoNube.negocio());
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); data.products = [{ id: 'a', name: 'Perfume', price: 20000 }, { id: 'b', name: 'Crema', price: 25000 }]; data.history = []; saveData(); window.ventoTurno.abrir(0); });
    const saldo = cod => p.evaluate(async c => { const cl = await window.ventoNube.cliente(); const r = await cl.rpc('bono_ver', { p_negocio: window.ventoNube.negocio().id, p_codigo: c }); return r.data && r.data.bono && Number(r.data.bono.saldo); }, cod);

    // ===== 1 =====
    await p.click('#navMoreBtn'); await pausa(300);
    await p.click('#navMoreSheet .more-tile[data-go="bonos"]'); await pausa(500);
    await p.fill('.bn-ov .bn-valor', '30000'); await p.fill('.bn-ov .bn-cli', 'Para Ana'); await p.click('.bn-ov .bn-crear');
    await esperar(p, () => /[A-Z0-9]{8}/.test((document.querySelector('.bn-ov .bn-hecho') || {}).innerText || ''));
    const COD = await p.evaluate(() => (document.querySelector('.bn-ov .bn-hecho').innerText.match(/[A-Z0-9]{8}/) || [])[0]);
    let v = await p.evaluate(() => ({ ventas: data.history.length, entrada: window.ventoTurno.turno().movs.filter(m => m.tipo === 'entrada').map(m => m.monto), wa: !!document.querySelector('.bn-ov .bn-hecho a[href*="wa.me"]') }));
    chk('1. Bono de $30.000 creado: código de 8, para enviar por WhatsApp', /^[A-Z0-9]{8}$/.test(COD || '') && v.wa, { COD, v });
    chk('1. … entra a la caja como entrada de $30.000 y NO es una venta', v.ventas === 0 && v.entrada.join() === '30000', v);
    chk('1. … y en el servidor tiene $30.000', await saldo(COD) === 30000);
    await p.evaluate(() => document.querySelectorAll('.bn-ov').forEach(o => o.remove()));

    // ===== 2 =====
    await p.evaluate(() => { window.ventoPOS.abrirCaja(); window.ventoPOS.vaciar && window.ventoPOS.vaciar(); window.ventoPOS.agregar('a', 1); window._c = window.ventoPOS.cobrar(); }); await pausa(400);
    await p.click('.pz-pago-ov .pz-bono-btn'); await p.fill('.pz-bono-cod', COD); await p.click('.pz-bono-ver');
    await esperar(p, () => !!document.querySelector('.pz-bono-ok'));
    await p.click('.pz-bono-ok');
    v = await p.evaluate(async () => { const e = await window._c; const pb = e.payments.find(x => x.method === 'bono'); return { tot: e.total, pb }; });
    chk('2. Pagar $20.000 con el bono: la venta queda pagada con «bono» (con su referencia)', v.tot === 20000 && v.pb && v.pb.amount === 20000 && !!v.pb.bonoRef, v);
    chk('2. … y al bono le quedan $10.000', await saldo(COD) === 10000);

    // ===== 3 =====
    await pausa(300);
    await p.evaluate(() => { window.ventoPOS.agregar('b', 1); window._c = window.ventoPOS.cobrar(); }); await pausa(400);
    await p.click('.pz-pago-ov .pz-bono-btn'); await p.fill('.pz-bono-cod', COD); await p.click('.pz-bono-ver');
    await esperar(p, () => !!document.querySelector('.pz-bono-box [data-bresto="efectivo"]'));
    v = await p.evaluate(() => document.querySelector('.pz-bono-info').innerText);
    chk('3. Compra de $25.000: «El bono paga $10.000. Faltan $15.000»', /10\.000/.test(v) && /Faltan/.test(v) && /15\.000/.test(v), v);
    await p.click('.pz-bono-box [data-bresto="efectivo"]');
    v = await p.evaluate(async () => { const e = await window._c; window._e2 = e; return e.payments.map(x => x.method + ':' + x.amount); });
    chk('3. … queda bono $10.000 + efectivo $15.000, y el bono en $0', v.join() === 'bono:10000,efectivo:15000' && await saldo(COD) === 0, v);

    // ===== 4 =====
    await p.evaluate(() => { qsDeshacerVenta(window._e2); });
    const okDev = await esperar(p, async () => true, null, 1000); void okDev; await pausa(1500);
    chk('4. Deshacer esa venta: el saldo vuelve al bono ($10.000)', await saldo(COD) === 10000);
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  await b.close(); await sb.cerrar().catch(() => {});
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
