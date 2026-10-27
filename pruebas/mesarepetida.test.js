// 🍺 El mismo producto repetido en la mesa (ORDEVA 1.64.0). Lo que mandó el dueño: Mesa 2 con «Poker ×4», «Poker ×1» y
// «Poker ×3» en renglones separados. Venía de la mezcla entre celulares: los productos de una mesa no tienen id y se
// comparaban por TODO su contenido, así que si dos celulares agregaban Poker casi al tiempo quedaban dos renglones.
//  A–F. La mezcla de tres vías (nube/vento-nube.js): mismo producto = un renglón y se suman las dos ventas; si un celular
//       cerró la cuenta mientras el otro agregaba, lo agregado después se queda; personas y precios distintos siguen
//       aparte; los repetidos de antes se juntan sin contar de más; el stock de los productos se mezcla como siempre.
//  G.   Al abrir una mesa que ya quedó con repetidos, se juntan en uno: misma cantidad total y mismo valor de la cuenta.
//  H.   El botón «⋯ Opciones» de la vista sencilla no sale si la vista sencilla está apagada (salía en la 1.63.0).
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); localStorage.setItem('vento_vista_sencilla', '0'); }catch(e){} });   // la vista completa (la sencilla viene prendida desde 1.65.6)
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1000);
    await p.evaluate(() => { const s = document.getElementById('authType'); if(s){ s.value = 'bar'; s.dispatchEvent(new Event('change')); } });
    await p.fill('#authBiz', 'Bar Repetidos'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn');
    await p.waitForFunction(() => document.getElementById('authOverlay').hidden, null, { timeout: 15000 });
    await p.click('#onbSaltar', { timeout: 4000 }).catch(() => {});
    await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    await p.waitForFunction(() => !!(window.ventoNube && window.ventoNube._fusionar), null, { timeout: 10000 });

    const v = await p.evaluate(() => {
      const F = window.ventoNube._fusionar;
      const it = (pid, qty, extra) => Object.assign({ productId: pid, name: pid === 'poker' ? 'Poker' : pid, price: 3500, size: '', qty, personId: null, history: [] }, extra || {});
      const h = (d, t) => ({ delta: d, at: t });
      const mesa = items => ({ tables: { 2: { items, payments: [], people: [] } } });
      const lineas = d => d.tables[2].items.map(x => x.name + '×' + x.qty + (x.personId ? '@' + x.personId : '') + (x.price !== 3500 ? '$' + x.price : ''));
      const out = {};
      // A. Los dos celulares agregan Poker a la vez (la mesa estaba vacía)
      out.A = lineas(F(mesa([]), mesa([it('poker', 2, { history: [h(1, 1), h(1, 2)] })]), mesa([it('poker', 1, { history: [h(1, 3)] })])));
      // B. Ya había 1 Poker: aquí agregan 2, allá agregan 1
      const b1 = it('poker', 1, { history: [h(1, 1)] });
      out.B = lineas(F(mesa([b1]), mesa([it('poker', 3, { history: [h(1, 1), h(2, 5)] })]), mesa([it('poker', 2, { history: [h(1, 1), h(1, 6)] })])));
      // C. Aquí cerraron la cuenta (Poker ×1) y allá agregaron 2 más: quedan esos 2 en la mesa
      out.C = lineas(F(mesa([b1]), mesa([]), mesa([it('poker', 3, { history: [h(1, 1), h(2, 7)] })])));
      // C2. Allá cerraron la cuenta y aquí agregaron 1 más: queda ese 1
      out.C2 = lineas(F(mesa([b1]), mesa([it('poker', 2, { history: [h(1, 1), h(1, 8)] })]), mesa([])));
      // D. Allá cerraron y aquí no se tocó: la mesa queda vacía
      out.D = lineas(F(mesa([b1]), mesa([b1]), mesa([])));
      // E. Personas distintas y precios distintos siguen aparte
      out.E = lineas(F(mesa([]), mesa([it('poker', 1, { personId: 'ana' })]), mesa([it('poker', 1, { personId: 'juan' }), it('poker', 1, { price: 4000 })])));
      // F. Los repetidos de antes: base y nube con ×4, ×1, ×3; este celular ya los juntó en ×8 → ×8 (sin contar de más)
      const tres = () => [it('poker', 4, { history: [h(4, 1)] }), it('poker', 1, { history: [h(1, 2)] }), it('poker', 3, { history: [h(3, 3)] })];
      out.F = lineas(F(mesa(tres()), mesa([it('poker', 8, { history: [h(4, 1), h(1, 2), h(3, 3)] })]), mesa(tres())));
      out.F2 = lineas(F(mesa(tres()), mesa(tres()), mesa(tres().concat([it('aguila', 1)]))));
      // Otras listas: el stock de un producto con id sigue sumando las dos ventas (20 → aquí 18, allá 17 → 15)
      const pr = s => ({ products: [{ id: 'poker', name: 'Poker', stock: s }] });
      out.stock = F(pr(20), pr(18), pr(17)).products[0].stock;
      return out;
    });
    chk('A. Dos celulares agregan Poker a la vez: UN renglón con los dos (×3)', JSON.stringify(v.A) === '["Poker×3"]', v.A);
    chk('B. Había 1, aquí agregan 2 y allá 1: UN renglón ×4', JSON.stringify(v.B) === '["Poker×4"]', v.B);
    chk('C. Aquí se cerró la cuenta y allá agregaron 2 después: esos 2 se quedan en la mesa', JSON.stringify(v.C) === '["Poker×2"]', v.C);
    chk('C. Allá se cerró la cuenta y aquí agregaron 1 después: ese 1 se queda', JSON.stringify(v.C2) === '["Poker×1"]', v.C2);
    chk('D. Allá se cerró la cuenta y aquí no se tocó: la mesa queda vacía', JSON.stringify(v.D) === '[]', v.D);
    chk('E. Personas distintas y precios distintos siguen en renglones aparte', v.E.length === 3 && v.E.includes('Poker×1@ana') && v.E.includes('Poker×1@juan') && v.E.includes('Poker×1$4000'), v.E);
    const suma = l => l.filter(x => /^Poker×/.test(x)).reduce((s, x) => s + Number(x.split('×')[1]), 0);
    chk('F. Los repetidos de antes no cuentan de más al mezclar (×4 + ×1 + ×3 = 8 Poker, y la Águila nueva llega)', JSON.stringify(v.F) === '["Poker×8"]' && suma(v.F2) === 8 && v.F2.includes('aguila×1'), { F: v.F, F2: v.F2 });
    chk('El stock de los productos se sigue mezclando como siempre (20 → 18 aquí, 17 allá → 15)', v.stock === 15, v.stock);

    // G. La Mesa 2 del pantallazo
    const g = await p.evaluate(() => {
      const it = (pid, name, price, qty) => ({ productId: pid, name, price, size: '', qty, personId: null, history: [{ delta: qty, at: 1 }] });
      data.tables[2] = { items: [it('poker', 'Poker', 3500, 4), it('aguila', 'Aguila', 3500, 4), it('light', 'Aguila light', 3500, 3), it('poker', 'Poker', 3500, 1), it('poker', 'Poker', 3500, 3), it('club', 'Club Colombia', 4000, 1)], payments: [], people: [] };
      saveData();
      const antes = tableTotal(2);
      openTableModal(2);
      const filas = data.tables[2].items.map(x => x.name + '×' + x.qty);
      const pantalla = [...document.querySelectorAll('#itemsContainer .li-name, #itemsContainer .item-name')].map(x => x.textContent.trim()).filter(t => /Poker/.test(t)).length;
      return { antes, despues: tableTotal(2), filas, pantalla, guardado: JSON.parse(localStorage.getItem('bar-data') || '{}').tables ? true : true };
    });
    chk('G. Mesa 2 (Poker ×4, ×1 y ×3): al abrirla queda UN renglón «Poker ×8»', g.filas.filter(f => /^Poker/.test(f)).join() === 'Poker×8' && g.filas.length === 4, g.filas);
    chk('G. El valor de la cuenta no cambia ($56.500)', g.antes === 56500 && g.despues === 56500, g);

    // H. «⋯ Opciones» con la vista sencilla apagada
    const hBtn = await p.evaluate(() => { const b = document.getElementById('vsOpcBtn'); return { hay: !!b, visible: !!b && b.offsetParent !== null && getComputedStyle(b).display !== 'none', vs: document.body.classList.contains('vs-on') }; });
    chk('H. Con la vista sencilla apagada no sale «⋯ Opciones» en la cuenta (salía en la 1.63.0)', hBtn.hay && !hBtn.visible && !hBtn.vs, hBtn);
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ Error: ' + (e && e.stack || e)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
