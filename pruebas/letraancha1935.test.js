// 🔠 1.99.35 · «Continúa con la auditoría y los arreglos» (22/11). Con letras anchas (DejaVu Sans: la de muchos Android y la
// de GitHub) se cortaban textos que con la letra angosta sí cabían. Esta prueba no depende de la letra: revisa que el
// texto quepa en su caja, así que en GitHub revisa con la letra ancha. Revisa:
//  1. Barra de abajo en celulares de 412, 390, 375, 360 y 320 px (con la vista sencilla, que viene prendida): ninguna
//     palabra cortada («Produ…», «Caja P…»). Antes «Productos» se cortaba en 360 px aun con la letra angosta.
//  2. Cobrar: los montos rápidos («+$100.000») no pierden números en 360 y 320 px.
//  3. Cuenta de la mesa (360 px): «Personas» con su número y «Cliente» con el nombre caben en sus botones.
//  4. Contabilidad (320 px): la descripción de los movimientos («Ventas cobradas del día») no se corta.
//  5. Música (360 px): la frase bajo el título se lee completa (hasta dos líneas).
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
  const abrir = async ancho => {
    const ctx = await b.newContext({ viewport: { width: ancho, height: 760 }, hasTouch: true, isMobile: true });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('vento-guia-tour', '1'); localStorage.setItem('cm-tutorial-seen', '1'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(ancho + ': ' + e.message));
    await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(900);
    await p.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.products = [{ id: 'p0', name: 'Bandeja paisa', price: 28000, stock: 12 }];
      data.history = [{ id: 'h1', date: new Date().toISOString(), table: 1, items: [{ name: 'X', qty: 1, price: 50000 }], payments: [{ method: 'efectivo', amount: 50000 }], total: 50000, debt: 0 }];
      data.tables = { 1: { name: 'Jaime Andrés', items: [{ productId: 'p0', name: 'Bandeja paisa', price: 28000, qty: 3, history: [] }], payments: [], people: [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Beto' }] } };
      await saveData(); try{ renderAll(); }catch(e){} });
    await p.waitForTimeout(400);
    return { ctx, p };
  };
  const cortados = (p, sel) => p.evaluate(sel => [...document.querySelectorAll(sel)].filter(e => e.getBoundingClientRect().width && e.textContent.trim()).filter(e => e.scrollWidth > e.clientWidth + 0.5).map(e => e.textContent.trim().slice(0, 20) + ' ' + e.scrollWidth + '/' + e.clientWidth), sel);
  try{
    for(const w of [412, 390, 375, 360, 320]){
      const { ctx, p } = await abrir(w);
      // ===== 1 =====
      const nav = await cortados(p, 'nav button .nav-lbl, .nav-more .nav-lbl');
      const n = await p.evaluate(() => [...document.querySelectorAll('nav button .nav-lbl, .nav-more .nav-lbl')].filter(e => e.getBoundingClientRect().width).length);
      chk(w + ' px · 1. Barra de abajo: ninguna palabra cortada', n >= 5 && !nav.length, { n, nav });
      if(w === 360 || w === 320){
        // ===== 2 =====
        await p.evaluate(() => { openTableModal(1); setTimeout(() => document.getElementById('vsCobrarBtn').click(), 300); }); await p.waitForTimeout(1100);
        const bil = await cortados(p, '.pz-pago .pz-billetes button');
        const nb = await p.evaluate(() => [...document.querySelectorAll('.pz-pago .pz-billetes button')].filter(e => e.getBoundingClientRect().width).length);
        chk(w + ' px · 2. Cobrar: los montos rápidos («+$100.000») no pierden números', nb >= 6 && !bil.length, { nb, bil });
        await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
      }
      if(w === 360){
        // ===== 3 =====
        await p.evaluate(() => openTableModal(1)); await p.waitForTimeout(600);
        const pl = await p.evaluate(() => [...document.querySelectorAll('#overlay .mesa-pleg-btn')].filter(e => e.getBoundingClientRect().width).map(e => ({ id: e.id, sw: e.scrollWidth, cw: e.clientWidth })));
        chk(w + ' px · 3. Cuenta de la mesa: «Personas» y «Cliente» caben en sus botones', pl.length >= 2 && pl.every(x => x.sw <= x.cw + 1), pl);
        await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
        // ===== 5 =====
        await p.evaluate(() => document.querySelector('[data-view="musica"]').click()); await p.waitForTimeout(900);
        const mf = await p.evaluate(() => { const e = document.getElementById('mfSigue'); if(!e || !e.getBoundingClientRect().width) return null; return { t: e.textContent.trim().slice(0, 40), sh: e.scrollHeight, ch: e.clientHeight, sw: e.scrollWidth, cw: e.clientWidth }; });
        chk(w + ' px · 5. Música: la frase bajo el título se lee completa', mf && mf.sh <= mf.ch + 1 && mf.sw <= mf.cw + 1, mf);
      }
      if(w === 320){
        // ===== 4 =====
        await p.evaluate(() => document.querySelector('[data-view="contabilidad"]').click()); await p.waitForTimeout(1100);
        const ct = await p.evaluate(() => [...document.querySelectorAll('.ct-mov .tx b')].filter(e => e.getBoundingClientRect().width).map(e => ({ t: e.textContent.trim().slice(0, 30), sw: e.scrollWidth, cw: e.clientWidth, sh: e.scrollHeight, ch: e.clientHeight })));
        chk(w + ' px · 4. Contabilidad: la descripción de los movimientos no se corta', ct.length >= 1 && ct.every(x => x.sw <= x.cw + 1 && x.sh <= x.ch + 1), ct);
      }
      await ctx.close();
    }
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
