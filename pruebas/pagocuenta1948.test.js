// 💳 1.99.48 · «En la libreta de fiados, que pueda seleccionar cuál cuenta me paga el cliente: no que me pague todo de una
// vez, sino cuentas individualmente» (pedido del dueño, 23/11). Tania debe 3 cuentas (FV-1 $10.000, FV-2 $20.000, FV-3
// $30.000). Revisa:
//  1. Al abrir a Tania en «Me deben»: sus 3 cuentas, cada una con su número, su día, lo que debe, «💵 Pagó esta» y
//     «📱 Transferencia».
//  2. «📱 Transferencia» en FV-2 pregunta antes («¿Tania pagó la cuenta FV-2 de $20.000?») y salda SOLO esa: FV-1 y FV-3
//     siguen debiendo ($40.000). Contabilidad lo cuenta por transferencia; no entra a la caja del efectivo.
//  3. «💵 Pagó esta» en FV-3 con la caja abierta: salda solo esa y entra a la caja ($30.000).
//  4. «Me equivoqué» deshace el último: FV-3 vuelve a deber y sale de la caja.
//  5. Si dice «No», no se anota nada.
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
      window.__resp = true; window.__preg = []; window.showConfirm = async o => { window.__preg.push(o.title); return window.__resp; };
      const f = (id, d, m) => ({ id, invoiceNo: id, date: new Date(2026, 10, d, 15).toISOString(), table: 1, total: m, debt: m, items: [{ name: 'Concentrado', price: m, qty: 1 }], payments: [{ method: 'debe', amount: m, note: 'Tania' }] });
      data.history = [f('FV-1', 18, 10000), f('FV-2', 20, 20000), f('FV-3', 21, 30000)]; data.libreta = { movs: [] }; data.turno = null; saveData();
      ventoTurno.abrir(50000); window.libretaAbrir(); });
    await p.waitForTimeout(300);
    await p.evaluate(() => document.querySelector('#lbDeben .lb-deudor[data-persona="Tania"]').click()); await p.waitForTimeout(300);
    const c1 = await p.evaluate(() => [...document.querySelectorAll('.lb-cta')].map(r => ({ t: r.innerText.replace(/\s+/g, ' '), b: r.querySelectorAll('[data-pagacta]').length })));
    chk('1. Sus 3 cuentas con número, día, valor, «💵 Pagó esta» y «📱 Transferencia»', c1.length === 3 && /FV-1.*\$10\.000/.test(c1[0].t) && /FV-3.*\$30\.000/.test(c1[2].t) && c1.every(x => x.b === 2 && /Pagó esta/.test(x.t) && /Transferencia/.test(x.t)), c1);
    const estado = () => p.evaluate(() => { const d0 = new Date(); d0.setHours(0, 0, 0, 0);
      return { deudas: data.history.map(h => h.id + ':' + h.debt).join(), tania: window.libretaSaldo('Tania'), caja: ventoTurno.resumen().esperado,
        conta: ctMovimientos({ ini: d0.getTime(), fin: Date.now() + 1000 }).mov.filter(m => /Fiado cobrado/.test(m.desc || '')).map(m => m.monto + ':' + m.metodo).join() }; });
    // 5. Dice «No»
    await p.evaluate(() => { window.__resp = false; document.querySelector('[data-pagacta="FV-2"][data-metodo="transferencia"]').click(); }); await p.waitForTimeout(300);
    let e = await estado();
    chk('5. Si dice «No», no se anota nada', e.deudas === 'FV-1:10000,FV-2:20000,FV-3:30000' && e.tania === 60000, e);
    // 2. Transferencia en FV-2
    await p.evaluate(() => { window.__resp = true; document.querySelector('[data-pagacta="FV-2"][data-metodo="transferencia"]').click(); }); await p.waitForTimeout(400);
    e = await estado();
    const preg = await p.evaluate(() => window.__preg.pop());
    chk('2. Pregunta antes: «¿Tania pagó la cuenta FV-2 de $20.000?»', /Tania pagó la cuenta FV-2 de \$20\.000/.test(preg), preg);
    chk('2. Salda SOLO FV-2; FV-1 y FV-3 siguen debiendo ($40.000)', e.deudas === 'FV-1:10000,FV-2:0,FV-3:30000' && e.tania === 40000, e);
    chk('2. Contabilidad: $20.000 por transferencia; la caja del efectivo no cambia ($50.000)', e.conta === '20000:transferencia' && e.caja === 50000, e);
    // 3. Efectivo en FV-3
    await p.evaluate(() => { const t = document.querySelector('.lb-deudor[data-persona="Tania"]'); if(!document.querySelector('.lb-cta')) t.click(); }); await p.waitForTimeout(300);
    await p.evaluate(() => document.querySelector('[data-pagacta="FV-3"][data-metodo="efectivo"]').click()); await p.waitForTimeout(400);
    e = await estado();
    chk('3. «💵 Pagó esta» en FV-3: salda solo esa ($10.000 queda) y entra a la caja ($80.000)', e.deudas === 'FV-1:10000,FV-2:0,FV-3:0' && e.tania === 10000 && e.caja === 80000, e);
    // 4. Me equivoqué
    await p.evaluate(() => window.libretaEntender('me equivoqué')); await p.waitForTimeout(300);
    e = await estado();
    chk('4. «Me equivoqué»: FV-3 vuelve a deber y sale de la caja', e.deudas === 'FV-1:10000,FV-2:0,FV-3:30000' && e.tania === 40000 && e.caja === 50000, e);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
