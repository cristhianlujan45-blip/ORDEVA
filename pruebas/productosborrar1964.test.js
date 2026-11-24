// 🗑️ 1.99.64 · Borrar y unir productos. Revisa:
//  1. «¿Eliminar producto?» dice el tamaño («Purina 5 kg», no solo «Purina») y avisa si está dentro de un combo y si está
//     en cuentas abiertas.
//  2. Unir dos productos repetidos: el combo que traía el que se va queda apuntando al que se queda (antes quedaba roto y
//     dejaba de descontar), y pasan su kárdex y sus lotes con vencimiento.
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
    const r = await p.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.products = [{ id: 'pa1', name: 'Purina', size: '1 kg', price: 8000, stock: 10 }, { id: 'pa5', name: 'Purina', size: '5 kg', price: 35000, stock: 10 },
        { id: 'cb', name: 'Kit cría', price: 40000, combo: [{ id: 'pa5', qty: 1 }] }];
      data.tables = data.tables || {}; data.tables[1] = { items: [{ productId: 'pa5', name: 'Purina', price: 35000, qty: 1, history: [] }], payments: [] };
      await saveData(); renderProductos();
      let msg = null; window.showConfirm = async o => { msg = o.message; return false; };   // se lee el mensaje y se cancela
      await new Promise(r2 => setTimeout(r2, 600)); const row = document.querySelector('details.product-row[data-id="pa5"]'); if(row) row.querySelector('summary').click(); await new Promise(r2 => setTimeout(r2, 400));
      const del = document.querySelector('.p-del[data-id="pa5"]'); if(!del) return { sinBoton: true };
      del.click(); await new Promise(r2 => setTimeout(r2, 200));
      const sigue = !!data.products.find(x => x.id === 'pa5');
      // 2. unir: Purina 5 kg (duplicada «pa5b») → se va pa5b; el combo apuntaba a pa5b
      data.products.push({ id: 'pa5b', name: 'Purina', size: '5 kg', price: 35000, stock: 3, lotes: [{ id: 'l1', q: 3, vence: '2027-01-01', t: 1 }] });
      data.products.find(x => x.id === 'cb').combo = [{ id: 'pa5b', qty: 1 }];
      data.kardex = [{ p: 'pa5b', t: 1, tipo: 'entrada', q: 3 }];
      dupMerge(data.products.find(x => x.id === 'pa5'), data.products.find(x => x.id === 'pa5b'));
      const cb = data.products.find(x => x.id === 'cb'), k5 = data.products.find(x => x.id === 'pa5');
      // vender el combo descuenta de la que quedó
      const antes = k5.stock; invOnSale({ productId: 'cb' }, 1);
      return { msg, sigue, combo: cb.combo, kardex: data.kardex.map(x => x.p), lotes: (k5.lotes || []).map(l => l.id), stock: k5.stock, antes, quedan: data.products.map(x => x.id) };
    });
    if(r.sinBoton){ chk('Hay botón de eliminar en la lista de productos', false, r); }
    else {
      chk('1. Dice el tamaño: «Purina 5 kg»', /"Purina 5 kg"/.test(r.msg || ''), r.msg);
      chk('1. Avisa que está dentro del combo «Kit cría»', /combo «Kit cría»/.test(r.msg || ''), r.msg);
      chk('1. Avisa que está en 1 cuenta abierta', /1 cuenta abierta/.test(r.msg || ''), r.msg);
      chk('1. Al cancelar no se borra', r.sigue, r);
    }
    chk('2. Unir: el combo queda apuntando al producto que se queda', JSON.stringify(r.combo) === '[{"id":"pa5","qty":1}]', r);
    chk('2. Unir: el kárdex y el lote pasan al que se queda', JSON.stringify(r.kardex) === '["pa5"]' && r.lotes.includes('l1'), r);
    chk('2. Unir: stock sumado (10 + 3 = 13) y al vender el combo descuenta de él (13 → 12)', r.antes === 13 && r.stock === 12 && !r.quedan.includes('pa5b'), r);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
