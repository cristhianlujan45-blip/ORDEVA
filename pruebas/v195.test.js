// 🍾 ORDEVA 1.95.0 · Consumo mínimo por mesa (lib/vento-minimo.js), en una discoteca.
//  1. Ajustes → Negocio → «🍾 Consumo mínimo por mesa»: «1-3, 10» → $300.000. «Quitar» lo quita. Solo en bares y restaurantes.
//  2. En la cuenta: «🍾 Consumo mínimo $300.000 · lleva $215.000 · faltan $85.000» (la propina no cuenta) y «✅ ya cumplió».
//  3. Al cobrar sin llegar: «Cobrar el mínimo (sumar $85.000)» → la venta lleva la diferencia y guarda el mínimo.
//  4. «Cobrar solo lo consumido»: cobra lo consumido y la venta queda anotada (perdonado). Cancelar: no cobra.
//  5. Una diferencia de un cobro cancelado no se cobra dos veces. Con el consumo cumplido no pregunta nada.
//  6. El mínimo de una cuenta (sin «siempre») se va al cobrarla; el de la mesa queda. Un mesero no lo cambia.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  const pausa = ms => new Promise(r => setTimeout(r, ms));
  const EF = { pago: { method: 'efectivo', metodo: 'efectivo', nota: 'Efectivo' } };
  try{
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await pausa(1000);
    await p.evaluate(() => { const s = document.getElementById('authType'); s.value = 'bar'; s.dispatchEvent(new Event('change')); });
    await p.fill('#authBiz', 'Disco 195'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await pausa(1500);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.businessType = 'discoteca'; delete data.minimoMesas;
      data.products = [{ id: 'bt', name: 'Botella de aguardiente', price: 90000 }, { id: 'cv', name: 'Cerveza', price: 7000 }, { id: 'cc', name: 'Coctel', price: 25000 }];
      data.history = []; Object.keys(data.tables || {}).forEach(k => { data.tables[k] = { items: [], payments: [], people: [] }; }); data.tableCount = Math.max(12, data.tableCount || 0); saveData();
      window.mk = (id, its) => { data.tables[id] = { payments: [], people: [], items: its.map(([pid, q]) => { const pr = data.products.find(x => x.id === pid); return { productId: pid, name: pr.name, price: pr.price, qty: q, personId: null, history: [{ qty: q, at: Date.now() }] }; }) }; saveData(); };
    });

    // ===== 1 =====
    await p.evaluate(() => document.querySelector('nav button[data-view="ajustes"]').click()); await pausa(400);
    await p.evaluate(() => { const c = document.querySelector('.ajustes-cat[data-cat="negocio"]'); if(c) c.click(); window.ventoMinimo.pintarAjustes(); }); await pausa(300);
    chk('1. Ajustes → Negocio: «🍾 Consumo mínimo por mesa»', await p.evaluate(() => !!document.getElementById('minAjustes') && /Consumo mínimo por mesa/.test(document.getElementById('minAjustes').innerText)));
    await p.fill('#mnMesas', '1-3, 10'); await p.fill('#mnMonto', '300.000'); await p.click('#mnPoner'); await pausa(200);
    let v = await p.evaluate(() => ({ m: data.minimoMesas, txt: document.getElementById('minAjustes').innerText }));
    chk('1. «1-3, 10» → $300.000 en las mesas 1, 2, 3 y 10', JSON.stringify(v.m) === JSON.stringify({ 1: 300000, 2: 300000, 3: 300000, 10: 300000 }) && /300\.000/.test(v.txt), v);
    await p.evaluate(() => document.querySelector('#minAjustes [data-mnq="10"]').click()); await pausa(200);
    v = await p.evaluate(() => Object.keys(data.minimoMesas));
    chk('1. «Quitar» la mesa 10', v.join() === '1,2,3', v);
    v = await p.evaluate(() => { data.businessType = 'ferreteria'; const a = window.ventoMinimo.activo(); data.businessType = 'restaurante'; const r = window.ventoMinimo.activo(); data.businessType = 'discoteca'; return { a, r }; });
    chk('1. Solo en bares, discotecas y restaurantes (en una ferretería no)', v.a === false && v.r === true, v);

    // ===== 2 =====
    await p.evaluate(() => { mk(1, [['bt', 2], ['cc', 1]]); data.tables[1].items.push({ productId: null, name: '🙏 Propina', price: 20000, size: '', qty: 1, personId: null, history: [] }); saveData(); openTableModal(1); }); await pausa(900);
    v = await p.evaluate(() => { const x = document.getElementById('minBox'); return x && !x.hidden ? x.innerText : null; });
    chk('2. En la cuenta: «🍾 Consumo mínimo $300.000 · lleva $205.000 · faltan $95.000» (la propina no cuenta)', v && /300\.000/.test(v) && /lleva \$\s?205\.000/.test(v) && /faltan \$\s?95\.000/.test(v), v);
    await p.evaluate(() => { data.tables[1].items.push({ productId: 'cc', name: 'Coctel', price: 25000, qty: 4, personId: null, history: [] }); saveData(); }); await pausa(700);
    v = await p.evaluate(() => document.getElementById('minBox').innerText);
    chk('2. Con 4 cocteles más ($305.000): «✅ ya cumplió»', /ya cumplió/.test(v), v);
    v = await p.evaluate(() => window.ventoMinimo.antesDeCobrar(1));
    chk('5. Con el consumo cumplido no pregunta nada (true al tiro)', v === true, v);
    await p.evaluate(() => { document.getElementById('overlay').classList.remove('show'); currentTable = null; });

    // ===== 3 =====
    await p.evaluate(ef => { mk(2, [['bt', 2], ['cv', 5]]); window._c = window.ventoPOS.cobrarMesa(2, ef); }, EF); await pausa(300);
    v = await p.evaluate(() => { const o = document.querySelector('.mn-ov'); return o ? o.innerText : null; });
    chk('3. Al cobrar $215.000 en la mesa 2: «No llegó al consumo mínimo … faltan $85.000»', v && /No llegó al consumo mínimo/.test(v) && /215\.000/.test(v) && /85\.000/.test(v), v);
    await p.click('.mn-ov [data-r="si"]');
    v = await p.evaluate(async () => { const e = await window._c; return e && { total: e.total, dif: (e.items.find(i => /Consumo mínimo/.test(i.name)) || {}).price, minimo: e.minimo, libre: !(data.tables[2].items || []).length, queda: data.minimoMesas[2] }; });
    chk('3. «Cobrar el mínimo»: la venta es $300.000 con la diferencia de $85.000 y guarda el mínimo', v && v.total === 300000 && v.dif === 85000 && v.minimo && v.minimo.minimo === 300000 && v.minimo.consumo === 215000 && v.minimo.diferencia === 85000 && !v.minimo.perdonado && v.libre, v);
    chk('6. El mínimo de la mesa 2 queda para el siguiente', v && v.queda === 300000, v);

    // ===== 4 =====
    await p.evaluate(ef => { mk(3, [['cv', 10]]); window._c = window.ventoPOS.cobrarMesa(3, ef); }, EF); await pausa(300);
    await p.click('.mn-ov [data-r="no"]');
    v = await p.evaluate(async () => { const e = await window._c; return e && { total: e.total, dif: e.items.some(i => /Consumo mínimo/.test(i.name)), minimo: e.minimo }; });
    chk('4. «Cobrar solo lo consumido»: $70.000, sin diferencia, y la venta queda anotada (perdonado)', v && v.total === 70000 && !v.dif && v.minimo && v.minimo.perdonado === true && v.minimo.consumo === 70000, v);
    await p.evaluate(ef => { mk(3, [['cv', 10]]); window._c = window.ventoPOS.cobrarMesa(3, ef); }, EF); await pausa(300);
    await p.click('.mn-ov [data-r="x"]');
    v = await p.evaluate(async () => ({ e: await window._c, items: data.tables[3].items.length }));
    chk('4. «Cancelar»: no cobra y la cuenta sigue igual', v.e === null && v.items === 1, v);

    // ===== 5 =====
    await p.evaluate(() => { window._c = window.ventoMinimo.antesDeCobrar(3); }); await pausa(200);
    await p.click('.mn-ov [data-r="si"]'); await p.evaluate(() => window._c);
    v = await p.evaluate(() => data.tables[3].items.filter(i => /Consumo mínimo/.test(i.name)).map(i => i.price));
    chk('5. (se sumó la diferencia de $230.000 y luego se canceló el pago)', v.join() === '230000', v);
    await p.evaluate(() => { data.tables[3].items.push({ productId: 'bt', name: 'Botella de aguardiente', price: 90000, qty: 1, personId: null, history: [] }); saveData(); });
    await p.evaluate(ef => { window._c = window.ventoPOS.cobrarMesa(3, ef); }, EF); await pausa(300);
    v = await p.evaluate(() => ({ q: document.querySelector('.mn-ov') ? document.querySelector('.mn-ov').innerText : null }));
    chk('5. Al volver a cobrar con una botella más: la diferencia se recalcula ($140.000), no se suma dos veces', v.q && /140\.000/.test(v.q) && !/230\.000/.test(v.q), v);
    await p.click('.mn-ov [data-r="si"]');
    v = await p.evaluate(async () => { const e = await window._c; return e && { total: e.total, difs: e.items.filter(i => /Consumo mínimo/.test(i.name)).map(i => i.price) }; });
    chk('5. … la venta es $300.000 con una sola diferencia de $140.000', v && v.total === 300000 && v.difs.join() === '140000', v);

    // ===== 6 =====
    await p.evaluate(() => { mk(5, [['cv', 2]]); openTableModal(5); }); await pausa(900);
    v = await p.evaluate(() => { const x = document.getElementById('minBox'); return x && !x.hidden ? x.innerText : null; });
    chk('6. Una mesa sin mínimo: el dueño ve «🍾 Consumo mínimo» para ponerlo', v && /Consumo mínimo/.test(v) && !/faltan/.test(v), v);
    await p.click('#minBox [data-mn]'); await pausa(200);
    await p.fill('.mn-ov .mn-monto', '150000'); await p.click('.mn-ov [data-r="ok"]'); await pausa(700);
    v = await p.evaluate(() => ({ t: data.tables[5].minimo, mesa: (data.minimoMesas || {})[5], box: document.getElementById('minBox').innerText }));
    chk('6. Solo para esta cuenta: $150.000 (la mesa 5 no queda con mínimo) y la cuenta dice «faltan $136.000»', v.t === 150000 && !v.mesa && /faltan \$\s?136\.000/.test(v.box), v);
    await p.evaluate(() => { document.getElementById('overlay').classList.remove('show'); currentTable = null; });
    await p.evaluate(ef => { window._c = window.ventoPOS.cobrarMesa(5, ef); }, EF); await pausa(300);
    await p.click('.mn-ov [data-r="si"]');
    v = await p.evaluate(async () => { const e = await window._c; return { total: e && e.total, min: data.tables[5].minimo, est: window.ventoMinimo.estado(5) }; });
    chk('6. Al cobrarla ($150.000) el mínimo de la cuenta se va: la próxima cuenta de la mesa 5 no tiene mínimo', v.total === 150000 && v.min === undefined && v.est === null, v);
    v = await p.evaluate(() => { const orig = window.ventoRoles && window.ventoRoles.esJefe; if(!window.ventoRoles) window.ventoRoles = {}; window.ventoRoles.esJefe = () => false;
      mk(6, [['cv', 1]]); window.ventoMinimo.abrirCuenta(6); const abierto = !!document.querySelector('.mn-ov'); window.ventoRoles.esJefe = orig; return abierto; });
    chk('6. Un mesero no puede poner ni cambiar el consumo mínimo', v === false, v);
    // ===== 7. Desde el botón «Cobrar» de la cuenta =====
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); mk(1, [['cv', 4]]); openTableModal(1);
      window._vecesMn = 0; new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if(n.classList && n.classList.contains('mn-ov')) window._vecesMn++; }))).observe(document.body, { childList: true }); }); await pausa(900);
    await p.evaluate(() => { const b = [document.getElementById('vsCobrarBtn'), document.getElementById('chargeBtn')].find(x => x && x.offsetParent); b.click(); }); await pausa(500);
    chk('7. Botón «Cobrar» de la cuenta: pregunta por el consumo mínimo (faltan $272.000)', await p.evaluate(() => { const o = document.querySelector('.mn-ov'); return !!o && /272\.000/.test(o.innerText); }));
    await p.click('.mn-ov [data-r="si"]'); await pausa(900);
    v = await p.evaluate(() => ({ veces: window._vecesMn, dif: data.tables[1].items.filter(i => /Consumo mínimo/.test(i.name)).length, pago: !!document.querySelector('.pz-pago-ov, .overlay.show .pz-pago, [class*="pz-"]') }));
    chk('7. … luego abre el pago y no vuelve a preguntar (una sola vez, una sola diferencia)', v.veces === 1 && v.dif === 1 && v.pago, v);
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
