// 🗺️ 1.99.44 · Auditoría del mapa del local (pedido del dueño, 23/11): «mira también la opción de agregarle mesas, para
// bares o tiendas que tienen mesas, cigarrerías, y para hotel serían habitaciones». Revisa en un celular (412 px):
//  1. Cigarrería / licorera (tipo tienda): la plantilla «🏪 Tienda con mesas» pone góndolas, neveras, caja… y 4 MESAS
//     («Mesa 1…4», no «Cuenta 1…4»).
//  2. Tocar una mesa del plano abre su cuenta para venderle.
//  3. Agropecuaria con 10 cuentas: «➕ Mesa» usa una cuenta libre (sin productos ni nombre) y le pone «Mesa 1»; la cuenta
//     con productos y la que tiene nombre («Camila») no se tocan.
//  4. «📤 Quitar del plano» la saca del plano sin borrar la cuenta; «↩ Deshacer» la devuelve.
//  5. Hotel: «➕ Habitación», las habitaciones dicen «Hab. N» completo; ningún nombre del plano queda cortado (ascensor,
//     escaleras) en el hotel ni en el bar («DJ / Tarima»).
//  6. Restaurante: siguen todas sus mesas en el plano (no cambia).
//  8. 1.99.45: en un computador (1440 × 900) el plano cabe entero en la pantalla (antes 840 px de alto).
//  7. 1.99.45: en «Vender» de la cigarrería sale «🗺️ Mesas» (con cuántas están ocupadas) y abre el mapa en un toque.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 500) : '')); } };
  const abrir = async (tipo, nombre) => {
    const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-guia-tour', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '', off: true })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(tipo + ': ' + e.message));
    await p.goto(BASE); await p.waitForTimeout(1200);
    await p.evaluate(t => { const s = document.getElementById('authType'); if(s){ s.value = t; s.dispatchEvent(new Event('change')); } }, tipo);
    await p.fill('#authBiz', nombre); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1500);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); const x = document.querySelector('#primerosPasos .pp-x'); x && x.click(); });
    return { ctx, p };
  };
  const pl = (p, a, v) => p.evaluate(([a, v]) => { const b = document.querySelector('[data-pl="' + a + '"]' + (v ? '[data-v="' + v + '"]' : '')); if(b){ b.click(); return true; } return false; }, [a, v]);
  const cortados = p => p.evaluate(() => [...document.querySelectorAll('#plLienzo .pl-el span, #plLienzo .pl-mesa .ft-name')].filter(s => s.getClientRects().length && getComputedStyle(s).display !== 'none')
    .filter(s => s.scrollWidth > s.clientWidth + 1 || s.scrollHeight > s.clientHeight + 1).map(s => s.textContent));
  const mesas = p => p.evaluate(() => [...document.querySelectorAll('#plLienzo .pl-mesa')].map(m => ({ id: m.dataset.id, n: m.querySelector('.ft-name').textContent })));
  try{
    // ===== 1 y 2. Cigarrería / licorera =====
    const C = await abrir('estanco', 'Cigarreria Pepe'); let p = C.p;
    await p.evaluate(() => ventoPlano.abrir()); await p.waitForTimeout(500);
    chk('1. Cigarrería: la plantilla sugerida es «Tienda con mesas»', await p.evaluate(() => !!document.querySelector('#plHoja [data-pl="plantilla"][data-v="tiendaMesas"].on')));
    await pl(p, 'plantilla', 'tiendaMesas'); await p.waitForTimeout(500);
    await pl(p, 'listo'); await p.waitForTimeout(400);
    let m = await mesas(p);
    const els = await p.evaluate(() => [...document.querySelectorAll('#plLienzo .pl-el')].map(e => e.className.match(/pl-el-(\w+)/)[1]));
    chk('1. … 4 mesas «Mesa 1…4» (no «Cuenta»), con góndolas, neveras y caja', m.length === 4 && m.map(x => x.n).join() === 'Mesa 1,Mesa 2,Mesa 3,Mesa 4' && els.filter(e => e === 'estante').length === 2 && els.includes('nevera') && els.includes('caja'), { m, els });
    chk('1. … sin nombres cortados', !(await cortados(p)).length, await cortados(p));
    await p.click('#plLienzo .pl-mesa[data-id="2"]'); await p.waitForTimeout(600);
    chk('2. Tocar «Mesa 2» en el plano abre su cuenta', await p.evaluate(() => document.getElementById('overlay').classList.contains('show') && /Mesa 2/.test(document.getElementById('overlay').textContent)));
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); data.tables[2].items = [{ productId: 'x', name: 'Cerveza', price: 4000, qty: 2 }]; saveData(); });
    await pl(p, 'vender'); await p.waitForTimeout(1600);
    const bm = await p.evaluate(() => { const b = [...document.querySelectorAll('[data-mesasmapa]')].find(x => x.getClientRects().length); return b ? b.textContent : null; });
    chk('7. En «Vender» sale «🗺️ Mesas · 1 ocupada»', bm === '🗺️ Mesas · 1 ocupada', bm);
    await p.evaluate(() => [...document.querySelectorAll('[data-mesasmapa]')].find(x => x.getClientRects().length).click()); await p.waitForTimeout(600);
    chk('7. … y abre el mapa con las 4 mesas', await p.evaluate(() => document.body.classList.contains('pl-ver') && document.querySelectorAll('#plLienzo .pl-mesa').length === 4 && !!document.getElementById('plLienzo').getClientRects().length));
    await C.ctx.close();

    // ===== 3 y 4. Agropecuaria con 10 cuentas =====
    const A = await abrir('agropecuaria', 'Agro La Finca'); p = A.p;
    await p.evaluate(() => { for(let i = 1; i <= 10; i++) if(!data.tables[i]) data.tables[i] = { items: [], people: [], payments: [] };
      data.tables[1].items = [{ productId: 'x', name: 'Concentrado', price: 50000, qty: 1 }]; data.tables[2].name = 'Camila'; data.tableCount = 10; saveData(); });
    await p.evaluate(() => ventoPlano.abrir()); await p.waitForTimeout(500);
    await pl(p, 'plantilla', 'tienda'); await p.waitForTimeout(500);
    chk('3. Plantilla «Tienda»: sin mesas encima (ninguna cuenta se movió al plano)', (await mesas(p)).length === 0);
    chk('3. El botón dice «➕ Mesa»', await p.evaluate(() => /➕ Mesa$/.test(document.querySelector('[data-pl="mesa+"]').textContent.trim())));
    await pl(p, 'mesa+'); await p.waitForTimeout(400);
    m = await mesas(p);
    const t = await p.evaluate(() => ({ t1: (data.tables[1].items || []).length, t2: data.tables[2].name, t3: data.tables[3].name, plano3: data.tables[3].plano, n: Object.keys(data.tables).length }));
    chk('3. «➕ Mesa» usa la cuenta libre 3 y le pone «Mesa 1»; la 1 (con productos) y la 2 («Camila») no se tocan', m.length === 1 && m[0].id === '3' && m[0].n === 'Mesa 1' && t.t1 === 1 && t.t2 === 'Camila' && t.n === 10, { m, t });
    await pl(p, 'quitar-m'); await p.waitForTimeout(400);
    const q = await p.evaluate(() => ({ en: document.querySelectorAll('#plLienzo .pl-mesa').length, existe: !!data.tables[3], nombre: data.tables[3].name || null }));
    chk('4. «📤 Quitar del plano» la saca, la cuenta 3 sigue (y vuelve a llamarse «Cuenta 3»)', q.en === 0 && q.existe && q.nombre === null, q);
    await pl(p, 'deshacer'); await p.waitForTimeout(400);
    m = await mesas(p);
    chk('4. «↩ Deshacer» la devuelve como «Mesa 1»', m.length === 1 && m[0].n === 'Mesa 1', m);
    await A.ctx.close();

    // ===== 5. Hotel y bar =====
    const H = await abrir('hotel', 'Hotel Sol'); p = H.p;
    await p.evaluate(() => ventoPlano.abrir()); await p.waitForTimeout(500);
    await pl(p, 'plantilla', 'hotel'); await p.waitForTimeout(500);
    chk('5. Hotel: el botón dice «➕ Habitación»', await p.evaluate(() => /Habitación$/.test(document.querySelector('[data-pl="mesa+"]').textContent.trim())));
    await pl(p, 'mesa+'); await p.waitForTimeout(400);
    m = await mesas(p);
    chk('5. … las habitaciones dicen «Hab. N»', m.length >= 2 && m.every(x => /^Hab\. \d+$/.test(x.n)), m);
    chk('5. … ningún nombre cortado (habitaciones, ascensor, escaleras)', !(await cortados(p)).length, await cortados(p));
    await H.ctx.close();
    const B = await abrir('bar', 'Bar La 70'); p = B.p;
    await p.evaluate(() => ventoPlano.abrir()); await p.waitForTimeout(500);
    await pl(p, 'plantilla', 'bar'); await p.waitForTimeout(500);
    chk('5. Bar: «DJ / Tarima» y los demás nombres completos', !(await cortados(p)).length, await cortados(p));
    await B.ctx.close();

    // ===== 6. Restaurante =====
    const R = await abrir('restaurante', 'Restaurante Mapa'); p = R.p;
    await p.evaluate(() => ventoPlano.abrir()); await p.waitForTimeout(500);
    await pl(p, 'plantilla', 'restaurante'); await p.waitForTimeout(500);
    chk('6. Restaurante: todas sus mesas en el plano', await p.evaluate(() => document.querySelectorAll('#plLienzo .pl-mesa').length === Object.keys(data.tables).length && Object.keys(data.tables).length > 0));
    await R.ctx.close();
    // ===== 8. Computador =====
    { const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
      await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
      await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-guia-tour', '1'); }catch(e){} });
      const q = await ctx.newPage(); q.on('pageerror', e => errs.push('pc: ' + e.message));
      await q.goto(BASE); await q.waitForTimeout(900);
      await q.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); ventoPlano.abrir(); });
      await q.waitForTimeout(500); await pl(q, 'plantilla', 'restaurante'); await q.waitForTimeout(400); await pl(q, 'listo'); await q.waitForTimeout(400);
      const r = await q.evaluate(() => { const l = document.getElementById('plLienzo'); l.scrollIntoView({ block: 'start' }); const b = l.getBoundingClientRect(); return { alto: Math.round(b.height), cabe: b.height <= innerHeight - 40 }; });
      chk('8. Computador: el plano cabe entero en la pantalla (' + r.alto + ' px de alto)', r.cabe, r);
      await ctx.close(); }
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
