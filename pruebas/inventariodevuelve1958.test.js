// 📦 1.99.58 · Anular, corregir o devolver una venta devuelve el inventario al MISMO producto que se vendió.
// Antes se buscaba por nombre: con dos productos del mismo nombre (Purina 1 kg y Purina 5 kg) volvía al primero; si el
// producto se renombró no volvía a ninguno; y un combo no devolvía sus productos. Revisa:
//  1. Anular una venta de 2 × Purina 5 kg → Purina 5 kg +2 (Purina 1 kg igual).
//  2. Anular un Kit (combo: 2 × Purina 1 kg + 1 Vasija) → Purina 1 kg +2 y Vasija +1.
//  3. Anular una venta de «Melaza» que ahora se llama «Melaza nueva» → vuelve a ella.
//  4. Corregir 3 × Purina 5 kg a 1 → Purina 5 kg +2.
//  5. Devolver 1 de 2 × Purina 5 kg → Purina 5 kg +1 (antes la devolución también se iba a la Purina 1 kg).
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
    await p.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); window.speakVoice = () => {};
      data.products = [{ id: 'pa1', name: 'Purina', size: '1 kg', price: 8000, stock: 10 }, { id: 'pa5', name: 'Purina', size: '5 kg', price: 35000, stock: 10 },
        { id: 'pz', name: 'Vasija', price: 5000, stock: 5 }, { id: 'cb', name: 'Kit', price: 20000, combo: [{ id: 'pa1', qty: 2 }, { id: 'pz', qty: 1 }] }, { id: 'pr', name: 'Melaza nueva', price: 4000, stock: 3 }];
      const t = m => new Date(Date.now() - m * 60e3).toISOString();
      const v = (id, items) => ({ id, invoiceNo: 'FV-' + id, date: t(30), table: null, tableName: 'Mostrador', total: items.reduce((s, i) => s + i.price * i.qty, 0), debt: 0, items, payments: [{ method: 'efectivo', amount: items.reduce((s, i) => s + i.price * i.qty, 0) }] });
      data.history = [v('s1', [{ productId: 'pa5', name: 'Purina', price: 35000, qty: 2 }]), v('s2', [{ productId: 'cb', name: 'Kit', price: 20000, qty: 1 }]),
        v('s3', [{ productId: 'pr', name: 'Melaza', price: 4000, qty: 2 }]), v('s4', [{ productId: 'pa5', name: 'Purina', price: 35000, qty: 3 }]), v('s5', [{ productId: 'pa5', name: 'Purina', price: 35000, qty: 2 }])];
      await saveData(); });
    const st = () => p.evaluate(() => Object.fromEntries(data.products.filter(x => x.stock != null).map(x => [x.id, x.stock])));
    const anular = async id => { await p.evaluate(id => { window.ventoVentaFix('borrar', id); }, id); await p.waitForSelector('#vfMotivo', { timeout: 5000 }); await p.click('#vfSi'); await p.waitForTimeout(300); };
    await anular('s1'); let s = await st();
    chk('1. Anular 2 × Purina 5 kg → vuelve a la de 5 kg (10 → 12), la de 1 kg igual', s.pa5 === 12 && s.pa1 === 10, s);
    await anular('s2'); s = await st();
    chk('2. Anular un Kit (combo) → Purina 1 kg +2 y Vasija +1', s.pa1 === 12 && s.pz === 6, s);
    await anular('s3'); s = await st();
    chk('3. Anular «Melaza» (ahora «Melaza nueva») → vuelve a ella (3 → 5)', s.pr === 5, s);
    await p.evaluate(() => { window.ventoVentaFix('corregir', 's4'); }); await p.waitForSelector('[data-q="0"]', { timeout: 5000 });
    await p.fill('[data-q="0"]', '1'); await p.click('#vfSi'); await p.waitForTimeout(300); s = await st();
    chk('4. Corregir 3 × Purina 5 kg a 1 → la de 5 kg +2 (12 → 14), la de 1 kg igual', s.pa5 === 14 && s.pa1 === 12, s);
    await p.evaluate(() => { window.ventoVentaFix('devolver', 's5'); }); await p.waitForSelector('[data-dv="0"]', { timeout: 5000 });
    await p.fill('[data-dv="0"]', '1'); await p.click('#viDvOk'); await p.waitForTimeout(300); s = await st();
    chk('5. Devolver 1 de 2 × Purina 5 kg → la de 5 kg +1 (14 → 15), la de 1 kg igual', s.pa5 === 15 && s.pa1 === 12, s);
    const ventas = await p.evaluate(() => data.history.map(h => h.id + ':' + h.items.map(i => i.qty).join(',') + ':' + h.total));
    chk('Las ventas quedan bien (s4 con 1, s5 con 1; s1-s3 anuladas)', JSON.stringify(ventas) === JSON.stringify(['s4:1:35000', 's5:1:35000']), ventas);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
