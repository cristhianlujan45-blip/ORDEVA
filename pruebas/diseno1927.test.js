// 🎨 1.99.27 · Auditoría de diseño del 22/11 (medida con un programa en 390 y 320 px). Revisa lo que se arregló:
//  1. Botones de 44 px en el celular: Inicio (Hoy/7 días/Mes/Fechas y «Contabilidad ›»), Música, Estadísticas (Exportar),
//     Carta (Imprimir) y la ✕ de «Producto nuevo».
//  2. Letra de 12 px como mínimo en las tarjetas de Inicio y Contabilidad y en «vs. 7 días antes» de Estadísticas.
//  3. Contabilidad › IVA: «IVA generado» y su valor separados (antes «IVA generado$0»).
//  4. Libreta en un celular de 320 px: los botones no se salen de la pantalla.
//  5. En 320 px el nombre del negocio y «Caja POS» / «Productos» de la barra de abajo se leen completos.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 500) : '')); } };
  const abrir = async ancho => {
    const ctx = await b.newContext({ viewport: { width: ancho, height: 800 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-guia-tour', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '', off: true })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE); await p.waitForTimeout(1200);
    await p.fill('#authBiz', 'Fonda Auditoría'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1500);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await p.evaluate(async () => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.history = [{ id: 'h1', date: new Date().toISOString(), table: 1, items: [{ name: 'X', qty: 1, price: 5000 }], payments: [{ method: 'efectivo', amount: 5000 }], total: 5000, debt: 0 }]; await saveData(); try{ renderAll(); }catch(e){} });
    return p;
  };
  const ir = (p, v) => p.evaluate(v => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); document.querySelector('[data-view="' + v + '"]').click(); }, v).then(() => p.waitForTimeout(600));
  const alto = (p, sel) => p.evaluate(sel => [...document.querySelectorAll(sel)].filter(e => e.offsetParent).map(e => Math.round(e.getBoundingClientRect().height)), sel);
  try{
    const p = await abrir(390);
    await ir(p, 'inicio');
    let h = await alto(p, '.o2-rango .o2-chips > button');
    chk('1. Inicio: Hoy / 7 días / Mes / Fechas de 44 px', h.length >= 3 && h.every(x => x >= 44), h);
    h = await alto(p, '.o2-card > h2 > button');
    chk('1. Inicio: «Contabilidad ›», «Historial ›»… de 44 px', h.length >= 1 && h.every(x => x >= 44), h);
    const em = await p.evaluate(() => [...document.querySelectorAll('.o2-kpi em')].filter(e => e.offsetParent).map(e => parseFloat(getComputedStyle(e).fontSize)));
    chk('2. Inicio: el texto de las tarjetas a 12 px como mínimo', em.length >= 1 && em.every(x => x >= 12), em);
    await ir(p, 'musica');
    h = await alto(p, '#mzClear, #mzHistBtn, #mzScBtn, #lngCopy, #lngTest');
    chk('1. Música: los botones de 44 px', h.length >= 2 && h.every(x => x >= 44), h);
    await ir(p, 'estadisticas');
    h = await alto(p, '#exportSalesExcelBtn');
    chk('1. Estadísticas: «Exportar ventas» de 44 px', h.length === 1 && h[0] >= 44, h);
    const vs = await p.evaluate(() => [...document.querySelectorAll('.tb-kpi-pie small')].filter(e => e.offsetParent).map(e => parseFloat(getComputedStyle(e).fontSize)));
    chk('2. Estadísticas: «vs. 7 días antes» a 12 px (antes 10)', vs.length >= 1 && vs.every(x => x >= 12), vs);
    await ir(p, 'carta');
    h = await alto(p, '#cartaPrint');
    chk('1. Carta: «Imprimir» de 44 px', !h.length || h.every(x => x >= 44), h);
    await ir(p, 'contabilidad');
    const ct = await p.evaluate(() => [...document.querySelectorAll('#ctKpis .ct-kpi > span')].filter(e => e.offsetParent).map(e => parseFloat(getComputedStyle(e).fontSize)));
    chk('2. Contabilidad: el texto de las tarjetas a 12 px', ct.length >= 1 && ct.every(x => x >= 12), ct);
    const iva = await p.evaluate(() => { const l = [...document.querySelectorAll('#ctIva .vt-l')].find(x => /IVA generado/.test(x.textContent)); if(!l) return null; const a = l.querySelector('span').getBoundingClientRect(), v = l.querySelector('b').getBoundingClientRect(); return { hueco: Math.round(v.left - a.right), display: getComputedStyle(l).display }; });
    chk('3. Contabilidad › IVA: «IVA generado» y su valor separados (no «IVA generado$0»)', iva && iva.display === 'flex' && iva.hueco >= 8, iva);
    await p.evaluate(() => { data.tables[1] = data.tables[1] || { items: [], people: [] }; currentTable = 1; openQuickProductOverlay('X'); });
    await p.waitForTimeout(600);   // la ventana entra con una animación que la agranda
    const x = await p.evaluate(() => { const r = document.getElementById('qpCloseBtn').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
    chk('1. «Producto nuevo»: la ✕ de 44 × 44', x[0] >= 44 && x[1] >= 44, x);
    // ===== 320 px =====
    const q = await abrir(320);
    await q.evaluate(() => window.libretaAbrir()); await q.waitForTimeout(500);
    const lb = await q.evaluate(() => { const ov = document.querySelector('#libretaOverlay .modal, #libretaOverlay > div'); const lim = ov.getBoundingClientRect().right; return [...document.querySelectorAll('#libretaOverlay .lb-b')].map(e => Math.round(e.getBoundingClientRect().right - lim)).filter(d => d > 1); });
    chk('4. Libreta en 320 px: ningún botón se sale de la ventana', lb.length === 0, lb);
    await q.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    const cortes = await q.evaluate(() => { const n = document.getElementById('brandName'); const lbl = [...document.querySelectorAll('nav button .nav-lbl')].filter(e => e.offsetParent).map(e => ({ t: e.textContent, corta: e.scrollWidth > e.clientWidth + 1 })); return { nombre: n.scrollWidth > n.clientWidth + 1, lbl }; });
    chk('5. 320 px: el nombre del negocio se lee completo', !cortes.nombre, cortes);
    chk('5. 320 px: «Caja POS» y «Productos» se leen completos en la barra de abajo', cortes.lbl.filter(l => /Caja POS|Productos/.test(l.t)).every(l => !l.corta), cortes.lbl);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
