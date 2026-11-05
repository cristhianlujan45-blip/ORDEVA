// 🍽️ ORDEVA 1.82.0 · Impuesto al consumo (INC 8 %) para restaurantes y bares. Antes ORDEVA solo manejaba IVA.
//  1. Ajustes → «🍽️ Impuesto al consumo (INC 8 %)»: se prende y apaga el IVA (no van juntos); prender el IVA apaga el INC.
//  2. Cuenta de $35.500 cobrada: el recibo dice «Subtotal (sin INC) $32.870» e «INC 8 % $2.630», no «No responsable de IVA».
//  3. La propina no lleva INC.
//  4. Contabilidad: «🍽️ INC 8 % por pagar» con lo de esas ventas.
//  5. Sin INC (como antes): el recibo sigue igual.
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
    await p.fill('#authBiz', 'Restaurante INC'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await pausa(1500);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); data.products = [{ id: 'a', name: 'Águila', price: 3500 }, { id: 'k', name: 'Picada', price: 25000 }]; data.history = []; data.ivaResponsable = true; saveData(); });
    // ===== 1 =====
    await p.evaluate(() => { document.querySelector('nav button[data-view="ajustes"]').click(); });
    await pausa(500);
    const sw = await p.evaluate(() => !!document.getElementById('incOnToggle'));
    chk('1. Ajustes: está «🍽️ Impuesto al consumo (INC 8 %)»', sw);
    await p.evaluate(() => { const t = document.getElementById('incOnToggle'); t.checked = true; t.dispatchEvent(new Event('change')); });
    let v = await p.evaluate(() => ({ inc: !!data.impuestoConsumo, tasa: data.incRate, iva: !!data.ivaResponsable, ivaSw: document.getElementById('ivaOnToggle').checked }));
    chk('1. Prender el INC: queda al 8 % y se apaga el IVA (no van juntos)', v.inc && v.tasa === 8 && !v.iva && !v.ivaSw, v);
    // ===== 2 / 3 =====
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); openTableModal(4); addFavoriteToTable('a'); addFavoriteToTable('a'); addFavoriteToTable('a'); addFavoriteToTable('k');
      data.tables[4].items.push({ productId: null, name: '🙏 Propina', price: 3550, size: '', qty: 1, personId: null, history: [] }); closeTableToHistory(4); });
    await pausa(400);
    v = await p.evaluate(() => { const h = data.history[0]; const rd = histReceiptData(h); return { inc: h.inc, txt: buildReceiptText(rd), html: buildReceiptHTML(rd) }; });
    chk('2. La venta queda con INC 8 %', v.inc === 8, v.inc);
    chk('2. Recibo: «Subtotal (sin INC) $32.870» e «INC 8 % $2.630»', /Subtotal \(sin INC\): \$\s?32\.870/.test(v.txt) && /INC 8 % \(impuesto al consumo\): \$\s?2\.630/.test(v.txt), v.txt);
    chk('2. Ya no dice «No responsable de IVA»', !/No responsable de IVA/.test(v.txt) && !/No responsable de IVA/.test(v.html), v.txt);
    chk('3. La propina ($3.550) no lleva INC (el INC sale de $35.500, no de $39.050)', /2\.630/.test(v.txt) && !/2\.893/.test(v.txt), v.txt);
    // ===== 4 =====
    v = await p.evaluate(() => { try{ document.querySelector('[data-view="contabilidad"]').click(); }catch(e){} return new Promise(r => setTimeout(() => r((document.getElementById('ctIva') || {}).textContent || ''), 800)); });
    chk('4. Contabilidad: «🍽️ INC 8 % por pagar» $2.630', /INC 8 %.*por pagar/.test(v) && /2\.630/.test(v), v.slice(0, 400));
    // ===== 1 (vuelta) =====
    await p.evaluate(() => { document.querySelector('nav button[data-view="ajustes"]').click(); });
    await pausa(400);
    await p.evaluate(() => { const t = document.getElementById('ivaOnToggle'); t.checked = true; t.dispatchEvent(new Event('change')); });
    v = await p.evaluate(() => ({ inc: !!data.impuestoConsumo, iva: !!data.ivaResponsable, incSw: document.getElementById('incOnToggle').checked }));
    chk('1. Prender el IVA apaga el INC', !v.inc && v.iva && !v.incSw, v);
    // ===== 5 =====
    await p.evaluate(() => { data.ivaResponsable = false; data.impuestoConsumo = false; saveData(); openTableModal(2); addFavoriteToTable("a"); closeTableToHistory(2); });
    v = await p.evaluate(() => buildReceiptText(histReceiptData(data.history[0])));
    chk('5. Sin INC ni IVA, el recibo sigue como antes («No responsable de IVA»)', /No responsable de IVA/.test(v) && !/INC \d/.test(v), v);
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ Excepción: ' + (e && e.stack || e)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
