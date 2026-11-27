// ⚖️🧾 1.99.90 · Balanza e impresora de facturas (lib/vento-equipos.js). Revisa:
//  1. Lo que mandan las balanzas: «0.750 kg», «ST,GS,+0000.750kg» (estable), Toledo «\x02 00750\x03», «US…» (moviéndose).
//  2. Pesar a mano: 750 gramos de tomate a $4.000/kg = $3.000; «$2.000 de tomate» = exactamente $2.000.
//  3. «1,5» con «gramos» elegido: sale «¿Son kilos?» y «Cambiar a kilos» deja 1,5 kg = $6.000.
//  4. Etiqueta de la balanza (EAN-13 que empieza por 2): PLU 123 con 0,750 kg → tomate 0,75 kg.
//  5. El ticket de la impresora térmica trae el renglón por peso («750 g x $4.000/kg … $3.000») y el TOTAL.
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
      data.products = (data.products || []).concat([{ id: 'tom', name: 'Tomate', price: 4000, porPeso: 'kg', plu: 123 }]); await saveData(); });
    const t = await p.evaluate(() => { const T = window.ventoEquipos._trama; return [T('  0.750 kg'), T('ST,GS,+0000.750kg'), T('\x02 00750\x03'), T('US,GS,+0001.234kg')]; });
    chk('1. balanzas: 0,750 kg en los tres formatos; ST = estable, US = moviéndose', t[0].kg === 0.75 && t[1].kg === 0.75 && t[1].quieto && t[2].kg === 0.75 && t[3].mueve, t);
    const pesar = async (accion) => { await p.evaluate(() => { window.__q = null; window.ventoEquipos.pesar(data.products.find(x => x.id === 'tom')).then(v => { window.__q = v; }); }); await p.waitForTimeout(200); await accion(); await p.waitForTimeout(150); return p.evaluate(() => window.__q); };
    const q1 = await pesar(async () => { await p.fill('#vqPesar [data-q="peso"]', '750'); await p.click('#vqPesar [data-q="ok"]'); });
    chk('2a. 750 gramos → 0,75 kg ($3.000)', q1 === 0.75 && Math.round(q1 * 4000) === 3000, q1);
    const q2 = await pesar(async () => { await p.fill('#vqPesar [data-q="plata"]', '2000'); await p.click('#vqPesar [data-q="ok"]'); });
    chk('2b. «$2.000 de tomate» = exactamente $2.000', Math.round(q2 * 4000) === 2000, q2);
    const q3 = await pesar(async () => {
      await p.fill('#vqPesar [data-q="peso"]', '1.5');
      const ojo = await p.evaluate(() => !document.querySelector('#vqPesar [data-q="ojo"]').hidden);
      chk('3a. «1,5» en gramos: sale «¿Son kilos?»', ojo);
      await p.click('#vqPesar [data-q="akg"]'); await p.click('#vqPesar [data-q="ok"]'); });
    chk('3b. «Cambiar a kilos» → 1,5 kg = $6.000', q3 === 1.5, q3);
    const e = await p.evaluate(() => { const base = '2' + '0' + '00123' + '00750'; let s = 0; for(let i = 0; i < 12; i++) s += Number(base[i]) * (i % 2 ? 3 : 1); const cod = base + ((10 - s % 10) % 10); const r = window.ventoEquipos.etiqueta(cod); return r ? { id: r.p.id, qty: r.qty } : null; });
    chk('4. etiqueta de la balanza PLU 123 · 0,750 kg → tomate 0,75 kg', e && e.id === 'tom' && e.qty === 0.75, e);
    const tk = await p.evaluate(() => { const E = window.ventoEquipos;
      const rd = { businessName: 'Agro Prueba', items: [{ name: 'Tomate', qty: 0.75, price: 4000, unidad: 'kg' }, { name: '🛵 Domicilio', qty: 1, price: 2000 }], payments: [{ method: 'efectivo', amount: 5000 }], total: 5000, debt: 0, dateStr: 'hoy' };
      const by = E._recibo(rd, { ancho: 32, tildes: false }); return Array.from(by).map(c => c >= 32 && c < 127 || c === 10 ? String.fromCharCode(c) : '').join(''); });
    chk('5a. ticket: «750 g x $4.000/kg» con su valor $3.000', /750 g x \$\s?4\.000\/kg\s+\$\s?3\.000/.test(tk), tk);
    chk('5b. ticket: el domicilio sin el emoji y el TOTAL $5.000', /Domicilio/.test(tk) && !/🛵/.test(tk) && /TOTAL\s+\$\s?5\.000/.test(tk), tk);
    chk('6. sin errores de página', errs.length === 0, errs);
  }catch(e){ mal++; console.log('❌ excepción: ' + e.message); }
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
