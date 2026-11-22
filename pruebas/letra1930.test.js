// 🔤 1.99.30 · «Continúa con lo siguiente de la auditoría» (pedido del dueño, 22/11). Lo último de letra chica que quedaba
// de la auditoría de diseño: encabezados de la tabla de Productos e Inventario (11 px), fechas de las barras de
// Estadísticas (11 px), días de la gráfica de Contabilidad (10 px) y «Ocupada» en Mesas (11,5 px). Revisa, en 390 y 320 px,
// con 120 días de ventas:
//  1. En 11 pantallas no queda ningún texto de menos de 12 px (fuera de la barra de abajo y de las gráficas dibujadas).
//  2. Las fechas de las barras de Estadísticas (7 días, 30 días, todo) y de Contabilidad no se enciman.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
  try{
    for(const ANCHO of [390, 320]){
      const ctx = await b.newContext({ viewport: { width: ANCHO, height: 800 } });
      await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
      await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('vento-guia-tour', '1'); localStorage.setItem('cm-tutorial-seen', '1'); }catch(e){} });
      const p = await ctx.newPage(); p.on('pageerror', e => errs.push(ANCHO + ': ' + e.message));
      await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(800);
      await p.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
        const H = []; let n = 0; const ahora = new Date();
        for(let d = 0; d < 120; d++) for(const h of [9, 13, 19]){ const t = new Date(ahora); t.setDate(t.getDate() - d); t.setHours(h, 10, 0, 0); if(t > ahora) continue; const tot = 1000 * (5 + ((d * 7 + h) % 40));
          H.push({ id: 'h' + (n++), date: t.toISOString(), table: 1 + (n % 5), tableName: 'Mesa ' + (1 + n % 5), items: [{ name: n % 2 ? 'Águila' : 'Bandeja paisa', qty: 2, price: tot / 2, productId: n % 2 ? 'p1' : 'p0' }], payments: [{ method: n % 3 ? 'efectivo' : 'transferencia', amount: tot, note: 'Pagó' }], total: tot, debt: 0 }); }
        data.products = [['Bandeja paisa', 28000, 12], ['Águila', 4000, 3]].map(([nm, pr, s], i) => ({ id: 'p' + i, name: nm, price: pr, categoryId: null, stock: s, cost: 1000 }));
        data.history = H.sort((a, c) => Date.parse(c.date) - Date.parse(a.date)); data.tables[1] = { items: [{ productId: 'p0', name: 'Bandeja paisa', price: 28000, qty: 1, history: [] }], payments: [], people: [] };
        await saveData(); try{ renderAll(); }catch(e){} });
      const ir = async v => { await p.evaluate(v => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); const b = document.querySelector('[data-view="' + v + '"]'); b && b.click(); }, v); await p.waitForTimeout(1100); };
      // ===== 1 =====
      const chicos = {};
      for(const v of ['inicio', 'mesas', 'productos', 'inventario', 'estadisticas', 'contabilidad', 'historial', 'carta', 'musica', 'ajustes', 'cocina']){
        await ir(v);
        const L = await p.evaluate(() => { const vis = el => { const r = el.getBoundingClientRect(); if(r.width < 1 || r.height < 1) return false; for(let e = el; e; e = e.parentElement){ const c = getComputedStyle(e); if(c.display === 'none' || c.visibility === 'hidden' || +c.opacity < .05) return false; } return true; };
          return [...document.querySelectorAll('body *')].filter(e => !e.closest('svg') && !e.closest('.tabbar,nav') && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1) && parseFloat(getComputedStyle(e).fontSize) < 12 && vis(e))
            .map(e => (e.className || e.tagName) + ' ' + getComputedStyle(e).fontSize + ' «' + e.textContent.trim().slice(0, 20) + '»'); });
        if(L.length) chicos[v] = L.slice(0, 4).concat(L.length > 4 ? ['… ' + L.length] : []);
      }
      chk(ANCHO + ' px · 1. En las 11 pantallas no queda texto de menos de 12 px', !Object.keys(chicos).length, chicos);
      // ===== 2 =====
      const cruces = sel => p.evaluate(sel => { const out = []; document.querySelectorAll(sel).forEach(box => { const L = [...box.querySelectorAll('.st-col > span, .ct-col small')].filter(e => e.textContent.trim() && e.getBoundingClientRect().width).map(e => ({ t: e.textContent.trim(), r: e.getBoundingClientRect() }));
        for(let i = 1; i < L.length; i++) if(L[i].r.left < L[i - 1].r.right - 0.5) out.push(L[i - 1].t + '×' + L[i].t); }); return { n: document.querySelectorAll(sel).length, out }; }, sel);
      await ir('estadisticas');
      for(const per of ['7', '30', 'todo']){
        await p.evaluate(per => { const b = document.querySelector('#stPer button[data-p="' + per + '"]'); b && b.click(); }, per); await p.waitForTimeout(600);
        const c = await cruces('.st-bars');
        chk(ANCHO + ' px · 2. Estadísticas (' + per + '): las fechas de las barras no se enciman', c.n > 0 && !c.out.length, c);
      }
      await ir('contabilidad');
      const c = await cruces('#ctGrafica .ct-chart');
      chk(ANCHO + ' px · 2. Contabilidad: los días de la gráfica no se enciman', c.n > 0 && !c.out.length, c);
      await ctx.close();
    }
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
