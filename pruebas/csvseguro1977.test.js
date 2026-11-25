// 📊 1.99.77 · Descargas a Excel (.csv): un nombre que llegue de un pedido por QR como «=HYPERLINK(...)» Excel lo
// ejecutaría como fórmula. Revisa:
//  1. csvEscape (ventas a Excel) pone ' delante de = + - @, pero no toca números negativos ni texto normal.
//  2. El libro de facturas: el cliente «=HYPERLINK…» sale como texto y el producto trae su tamaño (Purina 5 kg).
//  3. Ventas a Excel: el producto con su tamaño y el cliente peligroso como texto.
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
      data.products = (data.products || []).concat([{ id: 'pa1', name: 'Purina', size: '1 kg', price: 8000, cost: 6000, stock: 5 }, { id: 'pa5', name: 'Purina', size: '5 kg', price: 35000, cost: 28000, stock: 3 }]);
      data.history = [{ id: 'h1', invoiceNo: 'FV-1', date: new Date().toISOString(), table: null, tableName: '=HYPERLINK("http://x.y","clic")', total: 35000, debt: 0, items: [{ productId: 'pa5', name: 'Purina', size: '5 kg', price: 35000, qty: 1 }], payments: [{ method: 'efectivo', amount: 35000 }] }];
      await saveData(); });
    const e = await p.evaluate(() => [csvEscape('=1+1'), csvEscape('+57300'), csvEscape('@x'), csvEscape(-5000), csvEscape('-5000'), csvEscape('Ana'), csvEscape('a;b')]);
    chk('1. csvEscape protege fórmulas y deja números', e[0] === "'=1+1" && e[1] === "'+57300" && e[2] === "'@x" && e[3] === '-5000' && e[4] === '-5000' && e[5] === 'Ana' && e[6] === '"a;b"', e);
    const libro = await p.evaluate(() => histLibroCsv(data.history));
    chk('2a. libro: el cliente sale como texto', libro.indexOf('"\'=HYPERLINK') >= 0 && libro.indexOf(';"=HYPERLINK') < 0, libro.slice(0, 400));
    chk('2b. libro: producto con tamaño', /Purina 5 kg ×1/.test(libro), libro.slice(0, 400));
    const ventas = await p.evaluate(async () => { let txt = ''; const o = URL.createObjectURL; URL.createObjectURL = bl => { window.__bl = bl; return 'blob:x'; };
      const ck = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function(){};
      const d = new Date(); exportSalesRange(new Date(d.getFullYear(), d.getMonth(), d.getDate()), new Date(d.getTime() + 60000), 'hoy');
      URL.createObjectURL = o; HTMLAnchorElement.prototype.click = ck; return window.__bl ? await window.__bl.text() : ''; });
    chk('3a. ventas a Excel: producto con tamaño', /;Purina 5 kg;/.test(ventas), ventas.slice(0, 400));
    chk('3b. ventas a Excel: cliente como texto', ventas.indexOf(";\"'=HYPERLINK") >= 0 || ventas.indexOf(";'=HYPERLINK") >= 0, ventas.slice(0, 400));
    chk('4. sin errores de página', errs.length === 0, errs);
  }catch(e){ mal++; console.log('❌ excepción: ' + e.message); }
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
