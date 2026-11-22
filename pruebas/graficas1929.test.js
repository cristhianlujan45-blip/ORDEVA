// 📈 1.99.29 · «Continúa con lo de las gráficas y el globito de ayuda» (pedido del dueño, 22/11). Lo que quedaba de la
// auditoría de diseño: letras de 8 a 11 px en los ejes de las gráficas y el «?» de la ayuda de voz de 24 px. Revisa, en un
// celular de 390 px y en uno de 320 px, con 90 días de ventas:
//  1. Inicio, Tablero (Estadísticas) e Historial › gráficas: la letra de los ejes se ve de 12 px o más (antes 7,9 a 11).
//  2. Las etiquetas no se enciman ni se salen de la gráfica.
//  3. Historial › «90 días»: todas las barras quedan dentro (antes la mitad, los días más recientes, no se veía).
//  4. El «?» de la ayuda de voz: se ve de 28 px, se toca en 44 × 44, no le quita toques al micrófono y abre la ayuda.
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
        for(let d = 0; d < 90; d++) for(const h of [9, 12, 13, 19, 21]){ const t = new Date(ahora); t.setDate(t.getDate() - d); t.setHours(h, 10, 0, 0); if(t > ahora) continue; const tot = 1000 * (5 + ((d * 7 + h) % 40)) * (h === 13 ? 30 : 1);
          H.push({ id: 'h' + (n++), date: t.toISOString(), table: 1 + (n % 5), tableName: 'Mesa ' + (1 + n % 5), items: [{ name: 'Águila', qty: 2, price: tot / 2 }], payments: [{ method: n % 3 ? 'efectivo' : 'transferencia', amount: tot, note: 'Pagó' }], total: tot, debt: 0 }); }
        data.history = H.sort((a, c) => Date.parse(c.date) - Date.parse(a.date)); await saveData(); try{ renderAll(); }catch(e){} });
      await p.waitForTimeout(400);
      const medir = sel => p.evaluate(sel => [...document.querySelectorAll(sel)].map(svg => { const r = svg.getBoundingClientRect(); if(!r.width || !svg.viewBox.baseVal || !svg.viewBox.baseVal.width) return null;
        const esc = r.width / svg.viewBox.baseVal.width; const T = [...svg.querySelectorAll('text')].filter(t => !/tb-dona-n/.test(t.getAttribute('class') || '')).map(t => ({ t: t.textContent, r: t.getBoundingClientRect(), fs: parseFloat(getComputedStyle(t).fontSize) * esc }));
        let cruces = [], fuera = 0;
        for(let i = 0; i < T.length; i++){ const a = T[i].r; if(a.left < r.left - 1 || a.right > r.right + 1) fuera++; for(let j = i + 1; j < T.length; j++){ const c = T[j].r; if(a.left < c.right - 0.5 && c.left < a.right - 0.5 && a.top < c.bottom - 0.5 && c.top < a.bottom - 0.5) cruces.push(T[i].t + '×' + T[j].t); } }
        const vb = svg.viewBox.baseVal.width, barras = [...svg.querySelectorAll('rect[width]')].filter(x => x.getAttribute('fill') !== 'transparent');
        return { g: svg.getAttribute('aria-label'), n: T.length, min: T.length ? Math.min(...T.map(x => x.fs)) : 99, cruces, fuera, barras: barras.length, barFuera: barras.filter(x => +x.getAttribute('x') + +x.getAttribute('width') > vb + 0.5).length };
      }).filter(Boolean), sel);
      const revisar = (nom, L, nBarras) => {
        chk(ANCHO + ' px · ' + nom + ': hay gráfica con etiquetas', L.length > 0 && L.every(x => x.n >= 2), L);
        chk(ANCHO + ' px · ' + nom + ': la letra de los ejes se ve de 12 px o más', L.every(x => x.min >= 11.9), L.map(x => [x.g, x.min.toFixed(1)]));
        chk(ANCHO + ' px · ' + nom + ': las etiquetas no se enciman ni se salen', L.every(x => !x.cruces.length && !x.fuera), L.map(x => [x.g, x.cruces, x.fuera]));
        if(nBarras) chk(ANCHO + ' px · ' + nom + ': las ' + nBarras + ' barras de «Ventas por día» quedan dentro de la gráfica', L[0] && L[0].barras === nBarras && L[0].barFuera === 0, L.map(x => [x.g, x.barras, x.barFuera]));
      };
      // ===== Inicio =====
      await p.evaluate(() => document.querySelector('[data-view="inicio"]').click()); await p.waitForTimeout(500);
      await p.evaluate(() => { const b = [...document.querySelectorAll('.o2-chips button')].find(x => /Mes/.test(x.textContent)); b && b.click(); }); await p.waitForTimeout(900);
      revisar('Inicio (mes)', await medir('.o2-graf svg'));
      // ===== Tablero =====
      await p.evaluate(() => document.querySelector('[data-view="estadisticas"]').click()); await p.waitForTimeout(1200);
      revisar('Tablero', await medir('#tableroVento svg.tb-svg'));
      // ===== Historial =====
      for(const r of [7, 30, 90]){
        await p.evaluate(r => { document.querySelector('[data-view="historial"]').click(); document.body.classList.remove('hist-hoy'); const pn = document.getElementById('chartsPanel'); if(pn.hidden) document.getElementById('chartsToggle').click(); const b = pn.querySelector('#rg button[data-r="' + r + '"]'); b && b.click(); }, r);
        await p.waitForTimeout(600);
        revisar('Historial ' + r + ' días', await medir('#chartsPanel svg'), r);
      }
      // ===== El «?» de la ayuda de voz =====
      await p.evaluate(() => document.querySelector('[data-view="inicio"]').click()); await p.waitForTimeout(500);
      const q = await p.evaluate(() => { const h = document.getElementById('voiceFabHelp'), m = document.getElementById('voiceFab'); const r = h.getBoundingClientRect(), mr = m.getBoundingClientRect();
        const en = (x, y) => { const e = document.elementFromPoint(x, y); return e === h || (e && h.contains(e)) ? 'ayuda' : e === m || (e && m.contains(e)) ? 'micro' : (e && (e.id || e.className)) || null; };
        // Las esquinas de la zona de 44 × 44: el cuadro del «?» más 16 px hacia arriba y hacia afuera
        const zona = { izq: r.left - 16 + 2, arr: r.top - 16 + 2 };
        return { w: r.width, h: r.height, arribaIzq: en(zona.izq, zona.arr), centro: en(r.left + r.width / 2, r.top + r.height / 2),
          micCentro: en(mr.left + mr.width / 2, mr.top + mr.height / 2), micDebajo: en(r.right + 4, r.bottom + 4), zonaAncho: r.width + 16, zonaAlto: r.height + 16 }; });
      chk(ANCHO + ' px · El «?» se ve de 28 px (antes 24)', Math.round(q.w) === 28 && Math.round(q.h) === 28, q);
      chk(ANCHO + ' px · … y se toca en 44 × 44 (también en la esquina de arriba)', q.zonaAncho >= 44 && q.zonaAlto >= 44 && q.arribaIzq === 'ayuda' && q.centro === 'ayuda', q);
      chk(ANCHO + ' px · … sin quitarle toques al micrófono (el centro y junto al «?» siguen siendo el micrófono)', q.micCentro === 'micro' && q.micDebajo === 'micro', q);
      await p.click('#voiceFabHelp'); await p.waitForTimeout(500);
      chk(ANCHO + ' px · … y tocarlo abre la ayuda de los comandos de voz', await p.evaluate(() => [...document.querySelectorAll('.overlay.show, [role=dialog]')].some(o => o.offsetParent !== null || getComputedStyle(o).display !== 'none') && /voz|di |dile|comando/i.test([...document.querySelectorAll('.overlay.show')].map(o => o.textContent).join(' '))));
      await ctx.close();
    }
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
