// 🗂️ 1.99.42 · «Organiza estos menús para que se vean más organizados, mejor y fácil de usar» (pedido del dueño, 22/11, con
// la pantalla de Productos de su agropecuaria: 16 categorías en 10 renglones de píldoras, cada una con su ✕, y una llamada
// «es:Mercado/Bebidas/Gaseosas y sodas ›»). Revisa en un celular de 412 px:
//  1. Las categorías van en UNA fila que se desliza de lado (antes ~10 renglones); dice cuántas son.
//  2. «Ver todas» las muestra juntas y «Ver menos» las vuelve a la fila.
//  3. La ✕ de borrar solo está en la categoría escogida (y sigue preguntando antes de borrar).
//  4. La categoría «es:Mercado/Bebidas/Gaseosas y sodas ›» se ve «Gaseosas y sodas» (lo guardado no cambia).
//  5. Agotados / por agotarse / con stock: 3 cuadros en una sola fila, con su número.
//  6. Sin moverse de lado la página.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 500) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('vento-guia-tour', '1'); localStorage.setItem('cm-tutorial-seen', '1'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(900);
    await p.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.businessType = 'agropecuaria';
      const N = ['Cervezas', 'Cigarrillos', 'Aguardientes', 'Snacks y fritos', 'Otos', 'Bebidas', 'Aseo', 'Dulces', 'Gaseosas', 'Licores', 'Panadería', 'Carnes y embutidos', 'Granos y abarrotes', 'Lácteos', 'es:Mercado/Bebidas/Gaseosas y sodas ›', 'Bars'];
      data.categories = N.map((n, i) => ({ id: 'c' + i, name: n }));
      const P = []; for(let i = 0; i < 120; i++) P.push({ id: 'p' + i, name: 'Producto ' + i, price: 2000 + i * 50, cost: 1000, categoryId: i % 20 < 16 ? 'c' + (i % 16) : null, stock: i < 16 ? 0 : i < 50 ? 2 : i < 90 ? 30 : null, minStock: 5 });
      data.products = P; await saveData(); document.querySelector('[data-view="productos"]').click(); });
    await p.waitForTimeout(1600);
    const fila = () => p.evaluate(() => { const bar = document.getElementById('categoryBar'), r = bar.getBoundingClientRect(); const ch = [...bar.querySelectorAll('.chip')]; return { alto: Math.round(r.height), desliza: bar.scrollWidth > bar.clientWidth + 1, tops: new Set(ch.map(c => Math.round(c.offsetTop))).size, n: ch.length }; });
    let f = await fila();
    chk('1. Las 16 categorías en UNA fila que se desliza (alto ' + f.alto + ' px)', f.tops === 1 && f.desliza && f.alto < 70, f);
    chk('1. … y dice «Categorías · 16»', await p.evaluate(() => /Categorías · 16/.test(document.getElementById('catCab').textContent) && !document.getElementById('catCab').hidden));
    await p.click('#catTodasBtn'); await p.waitForTimeout(200);
    f = await fila();
    chk('2. «Ver todas» las muestra juntas (varios renglones, sin deslizar)', f.tops > 3 && !f.desliza && /Ver menos/.test(await p.textContent('#catTodasBtn')), f);
    await p.click('#catTodasBtn'); await p.waitForTimeout(200);
    f = await fila();
    chk('2. … y «Ver menos» la vuelve a una fila', f.tops === 1, f);
    const x = () => p.evaluate(() => [...document.querySelectorAll('#categoryBar .chip-del')].filter(e => e.getBoundingClientRect().width > 0).map(e => e.dataset.id));
    chk('3. Sin categoría escogida no hay ninguna ✕ a la vista', (await x()).length === 0, await x());
    await p.evaluate(() => { const c = [...document.querySelectorAll('#categoryBar .chip')].find(e => /Licores/.test(e.textContent)); c.click(); }); await p.waitForTimeout(400);
    const vis = await x();
    chk('3. Al escoger «Licores» sale su ✕ (solo esa), y queda a la vista en la fila', vis.length === 1 && vis[0] === 'c9' && await p.evaluate(() => { const bar = document.getElementById('categoryBar'), a = bar.querySelector('.chip.active').getBoundingClientRect(), r = bar.getBoundingClientRect(); return a.left >= r.left - 1 && a.right <= r.right + 1; }), vis);
    await p.evaluate(() => document.querySelector('#categoryBar .chip.active .chip-del').click()); await p.waitForTimeout(300);
    chk('3. … y borrar pregunta antes (con «Cancelar» sigue)', await p.evaluate(() => document.getElementById('confirmOverlay').classList.contains('show') && /Licores/.test(document.getElementById('confirmTitle').textContent)));
    await p.click('#confirmCancelBtn'); await p.waitForTimeout(200);
    chk('3. … la categoría sigue ahí', await p.evaluate(() => data.categories.some(c => c.id === 'c9')));
    const g = await p.evaluate(() => ({ chip: [...document.querySelectorAll('#categoryBar .chip')].map(c => c.textContent.replace('✕', '').trim()).filter(t => /Gaseosas y sodas|es:/.test(t)), guardado: data.categories.find(c => c.id === 'c14').name }));
    chk('4. «es:Mercado/Bebidas/Gaseosas y sodas ›» se ve «Gaseosas y sodas» (lo guardado no cambia)', g.chip.length === 1 && g.chip[0] === 'Gaseosas y sodas' && /^es:/.test(g.guardado), g);
    const s = await p.evaluate(() => [...document.querySelectorAll('#invSummary .inv-chip')].map(c => { const r = c.getBoundingClientRect(); return { top: Math.round(r.top), n: c.querySelector('b') && c.querySelector('b').textContent, w: Math.round(r.width) }; }));
    chk('5. Agotados / por agotarse / con stock: 3 cuadros en una fila con su número (16 · 34 · 40)', s.length === 3 && new Set(s.map(x => x.top)).size === 1 && s.map(x => x.n).join() === '16,34,40', s);
    chk('6. La página no se mueve de lado', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
