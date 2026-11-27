// 📦 1.99.65 · Las ventas de una CUENTA (mesa) se guardaban sin el id del producto ni su tamaño (solo el nombre): anular,
// corregir o devolver devolvía el inventario al PRIMER producto con ese nombre (Purina 1 kg en vez de Purina 5 kg), y
// «lo más vendido» juntaba los tamaños. Revisa:
//  1. Cerrar una cuenta con Purina 5 kg → la venta guarda el id y «5 kg».
//  2. Anular esa venta → el inventario vuelve a la de 5 kg.
//  3. «Lo más vendido» (Estadísticas, asistente, Laya y resumen del cierre) separa Purina 1 kg y Purina 5 kg.
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
    { const m = new Date(); m.setHours(12, 0, 0, 0); await p.clock.install({ time: m }); await p.clock.resume(); }   // las ventas «de hace un rato» siempre de hoy, corra a la hora que corra la prueba
    await p.goto(BASE); await p.waitForTimeout(1000);
    const r = await p.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); window.speakVoice = () => {};
      data.products = [{ id: 'pa1', name: 'Purina', size: '1 kg', price: 8000, cost: 6000, stock: 10 }, { id: 'pa5', name: 'Purina', size: '5 kg', price: 35000, cost: 28000, stock: 10 }];
      data.history = []; data.closures = []; data.tables = data.tables || {};
      data.tables[1] = { items: [{ productId: 'pa5', name: 'Purina', price: 35000, size: '5 kg', qty: 2, personId: null, history: [] }], payments: [{ method: 'efectivo', amount: 70000, note: '' }], people: [] };
      currentTable = 1; const recibo = buildReceiptText(currentTableReceiptData());
      const e = closeTableToHistory(1);
      const guardado = e && e.items[0]; window.__recibo = recibo; window.__reciboHist = buildReceiptText(histReceiptData(e)); window.__busca = histTextoBusca(e).includes('purina 5 kg');
      return { id: guardado && guardado.productId, size: guardado && guardado.size, hid: e && e.id, recibo: window.__recibo, reciboHist: window.__reciboHist, busca: window.__busca };
    });
    chk('1. La venta de la cuenta guarda el id del producto y «5 kg»', r.id === 'pa5' && r.size === '5 kg', r);
    chk('1. En el Historial, buscar «purina 5 kg» la encuentra', r.busca === true, r.busca);
    chk('1. El recibo de la cuenta y el del Historial dicen «Purina (5 kg)»', /2 x Purina \(5 kg\)/.test(r.recibo || '') && /2 x Purina \(5 kg\)/.test(r.reciboHist || ''), { a: r.recibo, b: r.reciboHist });
    await p.evaluate(id => { window.ventoVentaFix('borrar', id); }, r.hid); await p.waitForSelector('#vfMotivo', { timeout: 5000 }); await p.click('#vfSi'); await p.waitForTimeout(300);
    const st = await p.evaluate(() => ({ pa1: data.products.find(x => x.id === 'pa1').stock, pa5: data.products.find(x => x.id === 'pa5').stock }));
    chk('2. Anularla devuelve a la Purina 5 kg (10 → 12), la de 1 kg igual', st.pa5 === 12 && st.pa1 === 10, st);
    // Liberar una venta de cuenta: vuelve a la cuenta con el MISMO producto y su tamaño
    const lib = await p.evaluate(async () => { window.showConfirm = async () => true;
      data.tables[1] = { items: [{ productId: 'pa5', name: 'Purina', price: 35000, size: '5 kg', qty: 1, personId: null, history: [] }], payments: [{ method: 'efectivo', amount: 35000, note: '' }], people: [] };
      const e = closeTableToHistory(1); await window.ventoVentaFix('liberar', e.id); await new Promise(r2 => setTimeout(r2, 200));
      const it = (data.tables[1].items || [])[0]; return it ? { id: it.productId, size: it.size } : null; });
    chk('Liberar: vuelve a la cuenta como Purina 5 kg (su id y tamaño)', lib && lib.id === 'pa5' && lib.size === '5 kg', lib);
    const t = await p.evaluate(async () => {
      const v = (id, pid, n, q, pr) => ({ id, invoiceNo: 'FV-' + id, date: new Date(Date.now() - 600e3).toISOString(), table: 2, total: q * pr, debt: 0, items: [{ productId: pid, name: n, price: pr, qty: q, cost: pid === 'pa1' ? 6000 : 28000 }], payments: [{ method: 'efectivo', amount: q * pr }] });
      data.history = [v('a', 'pa1', 'Purina', 2, 8000), v('b', 'pa5', 'Purina', 3, 35000), { id: 'c', invoiceNo: 'FV-c', date: new Date(Date.now() - 500e3).toISOString(), table: 3, total: 8000, debt: 0, items: [{ name: 'Purina', size: '1 kg', price: 8000, qty: 1 }], payments: [{ method: 'efectivo', amount: 8000 }] }];
      await saveData();
      try{ stPer = 'hoy'; }catch(e){} renderStats(); const st2 = document.getElementById('statsBody').innerText;
      const top = asisSales().top.map(x => x.producto + '=' + x.unidades);
      const laya = (await window.Laya.responder('qué es lo más vendido hoy') || {}).text || '';
      const cierre = { from: new Date(Date.now() - 3600e3).toISOString(), date: new Date().toISOString() };
      const rd = window.ventoResumenDia && window.ventoResumenDia.calcular ? window.ventoResumenDia.calcular(cierre) : null;
      return { st2: /Purina 1 kg/.test(st2) && /Purina 5 kg/.test(st2), top, laya, rd: rd && JSON.stringify(rd.top || rd) };
    });
    chk('3. Estadísticas: «Purina 1 kg» y «Purina 5 kg» por separado', t.st2, t);
    chk('3. Asistente: 3 de Purina 5 kg y 3 de Purina 1 kg (una venta vieja sin id pero con tamaño)', t.top.includes('Purina 5 kg=3') && t.top.includes('Purina 1 kg=3'), t.top);
    chk('3. Laya «lo más vendido»: separa los tamaños', /Purina 5 kg/.test(t.laya) && /Purina 1 kg/.test(t.laya), t.laya);
    if(t.rd) chk('3. Resumen del cierre: separa los tamaños', /Purina 5 kg/.test(t.rd) && /Purina 1 kg/.test(t.rd), t.rd);
    // 1.99.74: el detalle de la venta en el Historial dice el tamaño, y un nombre raro se muestra como texto (no como código)
    const hd = await p.evaluate(async () => { window.__xss = 0;
      data.history = [{ id: 'x1', invoiceNo: 'FV-x1', date: new Date().toISOString(), table: 2, total: 70000, debt: 0, items: [{ productId: 'pa5', name: 'Purina', size: '5 kg', price: 35000, qty: 2 }, { name: '<img src=x onerror="window.__xss=1">', price: 0, qty: 1 }], payments: [{ method: 'efectivo', amount: 70000 }],
        descuento: { valor: 1000, tipo: '$', v: 1000, por: '<b>jefe</b>' } }];
      document.querySelectorAll('#histFilter button').forEach(x => x.classList.toggle('on', x.dataset.f === 'todos'));
      renderHistorial(); await new Promise(r2 => setTimeout(r2, 300));
      const row = document.querySelector('#histList .hist-row'); return { txt: row ? row.textContent.replace(/\s+/g, ' ') : '', xss: window.__xss, imgs: row ? row.querySelectorAll('img[src="x"]').length : -1, b: row ? row.querySelectorAll('.hist-detail b').length : -1 }; });
    chk('Historial: el detalle dice «Purina 5 kg ×2»', /Purina 5 kg ×2/.test(hd.txt), hd.txt.slice(0, 300));
    chk('Historial: un nombre con código se muestra como texto (no se ejecuta ni pinta)', hd.xss === 0 && hd.imgs === 0 && /<img src=x/.test(hd.txt) && /<b>jefe<\/b>/.test(hd.txt), hd);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
