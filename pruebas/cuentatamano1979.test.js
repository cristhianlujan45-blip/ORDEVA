// 🧾 1.99.79 · La cuenta de la mesa y «pagar por productos» con productos del mismo nombre en dos tamaños (Purina 1 kg
// y Purina 5 kg): antes salían los dos como «Purina». Revisa:
//  1. El resumen de la cuenta muestra «Purina 1 kg» y «Purina 5 kg».
//  2. «Pagar por productos» también, y un nombre con HTML se muestra como texto (no se ejecuta).
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
    await p.goto(BASE); await p.waitForTimeout(900);
    await p.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.products = (data.products || []).concat([{ id: 'pa1', name: 'Purina', size: '1 kg', price: 8000 }, { id: 'pa5', name: 'Purina', size: '5 kg', price: 35000 }, { id: 'px', name: '<img src=x onerror="window.__xss=1">Sal', price: 1000 }]);
      data.tables = data.tables || {}; data.tables['77'] = { items: [{ productId: 'pa1', name: 'Purina', size: '1 kg', price: 8000, qty: 1 }, { productId: 'pa5', name: 'Purina', size: '5 kg', price: 35000, qty: 1 }, { productId: 'px', name: '<img src=x onerror="window.__xss=1">Sal', price: 1000, qty: 1 }], payments: [] };
      await saveData(); });
    const r1 = await p.evaluate(() => { openBillSummary('77'); return [...document.querySelectorAll('#billSummaryItems .bill-summary-item-row')].map(x => x.textContent); });
    chk('1. resumen de la cuenta con tamaños', r1.some(t => /Purina 1 kg/.test(t)) && r1.some(t => /Purina 5 kg/.test(t)), r1);
    const r2 = await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); currentTable = '77'; openPaySelect('mesa'); return [...document.querySelectorAll('#paySelList .li-name')].map(x => x.textContent); });
    chk('2a. pagar por productos con tamaños', r2.includes('Purina 1 kg') && r2.includes('Purina 5 kg'), r2);
    await p.waitForTimeout(300);
    const x = await p.evaluate(() => ({ xss: !!window.__xss, img: document.querySelectorAll('#paySelList img, #billSummaryItems img').length }));
    chk('2b. el nombre con HTML sale como texto', !x.xss && x.img === 0 && r2.some(t => t.indexOf('<img') === 0), { x, r2 });
    chk('3. sin errores de página', errs.length === 0, errs);
  }catch(e){ mal++; console.log('❌ excepción: ' + e.message); }
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
