// 🧠 1.99.40 · «Android cerró la página de ORDEVA por falta de memoria» (diagnóstico de producción). Con 300 productos, la
// lista de Productos tenía ~15.300 elementos aunque nadie abriera un producto (el detalle de cada uno venía dibujado), y la
// lluvia del tema Matrix despertaba el celular 22 veces por segundo aunque no se viera. Revisa:
//  1. Con 300 productos, la lista tiene menos de 6.000 elementos y el detalle está vacío hasta que se abre.
//  2. Al abrir un producto aparecen sus cuentas y botones, y cada botón hace lo de siempre: «Contar» (inventario),
//     «☆ Rápido» (favorito), «Editar», «Etiqueta» y «Eliminar» (con confirmación).
//  3. Con la lluvia escondida, se revisa 1 vez por segundo, no cada 45 ms.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 500) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('vento-guia-tour', '1'); localStorage.setItem('cm-tutorial-seen', '1'); }catch(e){}
      window.__t45 = 0; const st = window.setTimeout; window.setTimeout = function(fn, ms){ if(ms === 45) window.__t45++; return st.apply(this, arguments); };
      window.__iv45 = 0; const si = window.setInterval; window.setInterval = function(fn, ms){ if(ms === 45) window.__iv45++; return si.apply(this, arguments); }; });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(900);
    await p.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      const P = []; for(let i = 0; i < 300; i++) P.push({ id: 'p' + i, name: 'Producto ' + i, price: 1000 + i * 100, stock: 10 + i % 40, cost: 500 });
      data.products = P; await saveData(); renderProductos(); document.querySelector('[data-view="productos"]').click(); });
    await p.waitForTimeout(800);
    // ===== 1 =====
    const r1 = await p.evaluate(() => { const l = document.getElementById('productList'); const rows = l.querySelectorAll('.product-row'); return { filas: rows.length, nodos: l.getElementsByTagName('*').length, vacios: [...rows].every(r => !r.querySelector('.pr-body').children.length) }; });
    chk('1. Con 300 productos la lista tiene menos de 6.000 elementos (antes ~15.300)', r1.filas === 300 && r1.nodos < 6000, r1);
    chk('1. … y el detalle de cada producto está vacío hasta que se abre', r1.vacios, r1);
    // ===== 2 =====
    await p.evaluate(() => { window.__inv = []; window.invAsk = (id, act) => window.__inv.push(id + ':' + act); window.__etq = []; window.printProductLabels = l => window.__etq.push(l.map(x => x.id).join()); window.showConfirm = async () => true; });
    await p.click('#productList .product-row[data-id="p5"] summary'); await p.waitForTimeout(300);
    const r2 = await p.evaluate(() => { const r = document.querySelector('#productList .product-row[data-id="p5"]'); return { open: r.open, cuentas: r.querySelectorAll('.pr-num').length, botones: [...r.querySelectorAll('.pr-body button')].map(b => b.textContent.trim().slice(0, 10)) }; });
    chk('2. Al abrir un producto aparecen sus cuentas y botones', r2.open && r2.cuentas >= 4 && r2.botones.length >= 7, r2);
    await p.click('#productList .product-row[data-id="p5"] [data-act="count"]'); await p.waitForTimeout(150);
    chk('2. «Contar» abre el conteo de ese producto', await p.evaluate(() => window.__inv.join() === 'p5:count'), await p.evaluate(() => window.__inv));
    await p.click('#productList .product-row[data-id="p5"] .p-label'); await p.waitForTimeout(150);
    chk('2. «Etiqueta» imprime la de ese producto', await p.evaluate(() => window.__etq.join() === 'p5'), await p.evaluate(() => window.__etq));
    await p.click('#productList .product-row[data-id="p5"] .p-fav'); await p.waitForTimeout(400);
    chk('2. «☆ Rápido» lo marca como favorito', await p.evaluate(() => data.products.find(x => x.id === 'p5').favorite === true));
    await p.click('#productList .product-row[data-id="p7"] summary'); await p.waitForTimeout(250);
    await p.click('#productList .product-row[data-id="p7"] .p-edit'); await p.waitForTimeout(500);
    chk('2. «Editar» abre la ventana de editar ese producto', await p.evaluate(() => document.getElementById('editProductOverlay').classList.contains('show') && /Producto 7/.test(document.getElementById('editProdName').value)));
    await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    await p.click('#productList .product-row[data-id="p9"] summary'); await p.waitForTimeout(250);
    await p.click('#productList .product-row[data-id="p9"] .p-del'); await p.waitForTimeout(500);
    chk('2. «Eliminar» (con confirmación) lo borra, y solo ese', await p.evaluate(() => !data.products.some(x => x.id === 'p9') && data.products.length === 299));
    // ===== 3 =====
    await p.evaluate(() => { document.querySelector('[data-view="mesas"]').click(); window.__t45 = 0; });
    await p.waitForTimeout(3000);
    const r3 = await p.evaluate(() => { const c = document.getElementById('matrixRain'); return { visible: !!(c && c.getClientRects().length), t45: window.__t45, iv45: window.__iv45 }; });
    chk('3. Lluvia escondida: no hay reloj de 45 ms (en 3 s se programó ' + r3.t45 + ' vez/veces a 45 ms)', !r3.visible && r3.iv45 === 0 && r3.t45 <= 1, r3);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
