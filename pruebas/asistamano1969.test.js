// 🤖 1.99.69 · El asistente (escrito o hablado) con productos del mismo nombre y distinto tamaño. Antes «sube el precio de
// la purina de 5 kilos a 36000» proponía cambiarle el precio a la Purina 1 kg; «llegaron 10 purinas de 5 kilos» las sumaba
// a la de 1 kg. Revisa que el tamaño dicho escoja el producto y que sin tamaño pregunte cuál (sin acción que aplicar).
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
    const r = await p.evaluate(async () => { await enterApp('test', null);
      data.products = [{ id: 'pa1', name: 'Purina', size: '1 kg', price: 8000, stock: 10 }, { id: 'pa5', name: 'Purina', size: '5 kg', price: 35000, stock: 10 }, { id: 'v', name: 'Vasija', price: 5000, stock: 3 }];
      const a = t => { const x = asisLocalAccion(t); return x ? { text: x.text, actions: x.actions || null } : null; };
      return { precio5: a('sube el precio de la purina de 5 kilos a 36000'), llegan5: a('llegaron 10 purinas de 5 kilos'), llegan1: a('llegaron 3 purinas de un kilo'),
        sinTam: a('sube el precio de la purina a 9000'), vasija: a('llegaron 4 vasijas') }; });
    chk('«sube el precio de la purina de 5 kilos a 36000» → Purina 5 kg ($35.000 → $36.000)', r.precio5 && r.precio5.actions && r.precio5.actions[0].id === 'pa5' && r.precio5.actions[0].precio === 36000 && /Purina 5 kg/.test(r.precio5.text), r.precio5);
    chk('«llegaron 10 purinas de 5 kilos» → suma a la de 5 kg', r.llegan5 && r.llegan5.actions && r.llegan5.actions[0].id === 'pa5' && r.llegan5.actions[0].sumarStock === 10, r.llegan5);
    chk('«llegaron 3 purinas de un kilo» → suma a la de 1 kg', r.llegan1 && r.llegan1.actions && r.llegan1.actions[0].id === 'pa1' && r.llegan1.actions[0].sumarStock === 3, r.llegan1);
    chk('Sin tamaño: pregunta cuál y no deja nada para aplicar', r.sinTam && !r.sinTam.actions && /¿Cuál Purina\? 1 kg \(\$\s?8\.000\) o 5 kg \(\$\s?35\.000\)/.test(r.sinTam.text), r.sinTam);
    chk('Un producto sin tamaños repetidos sigue igual (vasijas)', r.vasija && r.vasija.actions && r.vasija.actions[0].id === 'v', r.vasija);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
