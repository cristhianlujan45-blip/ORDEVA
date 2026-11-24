// 📒 1.99.66 · Fiados de productos con tamaño en la libreta, por voz. Antes:
//  «José me debe 2 purinas» → $16.000 (la Purina 1 kg, sin preguntar, aunque fueran las de 5 kg).
//  «José me debe 2 purinas de 5 kilos» → a «José 2 Kilos», 5 × Purina 1 kg = $40.000 (el tamaño se tomaba como cantidad y nombre).
//  «José me debe una purina de 1 kg» → a «José Kg».
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
    const r = await p.evaluate(async () => { await enterApp('test', null); data.history = [];
      data.products = [{ id: 'pa1', name: 'Purina', size: '1 kg', price: 8000 }, { id: 'pa5', name: 'Purina', size: '5 kg', price: 35000 }, { id: 'v', name: 'Vasija', price: 5000 }, { id: 'mz', name: 'Maíz', price: 2000, unidad: 'kg' }];
      const una = async f => { data.libreta = { movs: [] }; const x = await window.libretaEntender(f); const m = data.libreta.movs[0]; return { t: x && x.texto, p: m && m.persona, monto: m && m.monto, nota: m && m.nota }; };
      return { a: await una('José me debe 2 purinas'), b: await una('José me debe 2 purinas de 5 kilos'), c: await una('José me debe una purina de 1 kg'),
        d: await una('José me debe 3 vasijas'), e: await una('Ana me debe 20 mil'), f: await una('Pedro me debe 5 kilos de maíz') }; });
    chk('Sin tamaño y con dos Purina: pregunta cuál y no anota nada', /¿Cuál Purina\? 1 kg \(\$\s?8\.000\) o 5 kg \(\$\s?35\.000\)/.test(r.a.t) && !r.a.monto && /«José me debe 2 Purina de/.test(r.a.t), r.a);
    chk('«2 purinas de 5 kilos»: José, 2 × Purina 5 kg = $70.000', r.b.p === 'José' && r.b.monto === 70000 && r.b.nota === '2 × Purina 5 kg', r.b);
    chk('«una purina de 1 kg»: José, 1 × Purina 1 kg = $8.000', r.c.p === 'José' && r.c.monto === 8000 && r.c.nota === '1 × Purina 1 kg', r.c);
    chk('Un producto sin tamaños repetidos sigue igual (3 vasijas = $15.000)', r.d.p === 'José' && r.d.monto === 15000, r.d);
    chk('Plata sin producto sigue igual (Ana $20.000)', r.e.p === 'Ana' && r.e.monto === 20000, r.e);
    chk('«5 kilos de maíz» (por kilo): Pedro (no «Pedro Kilos»), 5 kg × $2.000 = $10.000', r.f.p === 'Pedro' && r.f.monto === 10000, r.f);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
