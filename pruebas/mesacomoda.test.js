// 🍽️ ORDEVA 1.71.0 · La cuenta de una mesa se ve completa, sin desplazarse, en computador y tableta; cómoda en el celular.
// Pedido del dueño: «cuando abro una mesa, que sea fácil ver todos los datos sin estar desplazándome arriba y abajo».
//  1. Computador (1366×768) y tableta (820×1180 y 1180×820), mesa con 7 productos y un abono: la ventana cabe en la
//     pantalla, va en dos columnas y TODO se ve sin desplazar (lo pedido, total, pagos, saldo, registrar pago, Cobrar,
//     compartir, Cerrar / Cobrar todo). Lo que se toca (encima de todo, no tapado).
//  2. Sigue funcionando igual: «+» de un producto suma, registrar un abono lo guarda, el saldo baja.
//  3. La cuenta de una persona dentro de la mesa: también en dos columnas y sin desplazar en el computador.
//  4. Celular (390×844): una columna, el título con «Opciones» fijo arriba y «Cobrar» fijo abajo al desplazarse.
//  5. Los − / + de cada producto se leen (en ORDEVA 2.0 eran cuadros negros).
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  const abrir = async (w, h, tactil) => {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: !!tactil });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(w + ': ' + e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1100);
    await p.fill('#authBiz', 'Bar Cómodo'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1400);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await p.evaluate(() => {
      document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.products = [['a', 'Águila', 3500], ['k', 'Póker', 3300], ['c', 'Club Colombia', 4500], ['e', 'Empanada', 2000], ['h', 'Hamburguesa', 15000], ['s', 'Salchipapa', 12000], ['g', 'Gaseosa', 2500]].map(x => ({ id: x[0], name: x[1], price: x[2] }));
      const it = (id, q, per) => { const p = data.products.find(x => x.id === id); return { productId: id, name: p.name, price: p.price, qty: q, personId: per || null, history: [] }; };
      data.tables[1] = { items: [it('a', 6), it('k', 4), it('c', 2), it('e', 3), it('h', 2), it('s', 1), it('g', 3)], payments: [{ note: 'Abono', amount: 10000, method: 'efectivo', at: Date.now() }], people: [] };
      data.tables[2] = { items: [it('a', 2, 'pa'), it('e', 1, 'pa')], payments: [], people: [{ id: 'pa', name: 'Ana' }] };
      saveData(); renderMesas();
    });
    return { ctx, p };
  };
  // ¿Se ve sin desplazar? (dentro de la pantalla y encima de todo: el centro del elemento es el elemento)
  const seVen = (p, sels) => p.evaluate(sels => sels.map(s => { const e = document.querySelector(s); if(!e) return s + ': no existe';
    const r = e.getBoundingClientRect(); if(!r.width || !r.height) return s + ': oculto';
    if(r.top < 0 || r.bottom > innerHeight + 1 || r.left < 0 || r.right > innerWidth + 1) return s + ': fuera (' + Math.round(r.top) + '..' + Math.round(r.bottom) + ')';
    const x = r.left + r.width / 2, y = r.top + Math.min(r.height / 2, 12), t = document.elementFromPoint(x, y);
    return t && (t === e || e.contains(t) || t.contains(e)) ? '' : s + ': tapado por ' + (t ? (t.id || t.className || t.tagName) : '¿?'); }).filter(Boolean), sels);
  const MESA = ['#modalTitle', '#addProductSearch', '#itemsContainer .line-item-wrap:last-of-type .line-item', '#mesaTotal', '#paymentsContainer', '#modalConsumo', '#modalTotal', '#csAbono', '#vsCobrarBtn', '#printReceiptBtn', '#closeModalBtn'];   // 1.72.5: un solo «Cobrar»; abonos plegados
  try{
    for(const [w, h, n] of [[1366, 768, 'computador 1366×768'], [820, 1180, 'tableta vertical 820×1180'], [1180, 820, 'tableta horizontal 1180×820']]){
      const { ctx, p } = await abrir(w, h, n !== 'computador 1366×768');
      await p.evaluate(() => openTableModal(1)); await p.waitForTimeout(500);
      const v = await p.evaluate(() => { const m = document.querySelector('#overlay .mesa-modal'), r = m.getBoundingClientRect(), a = m.querySelector('.mc-a').getBoundingClientRect(), b = m.querySelector('.mc-b').getBoundingClientRect();
        return { cabe: r.top >= 0 && r.bottom <= innerHeight, ancho: Math.round(r.width), vw: innerWidth, lado: b.left >= a.right - 2 && Math.abs(a.top - b.top) < 4, scroll: m.scrollHeight - m.clientHeight }; });
      chk('1. ' + n + ': la cuenta cabe en la pantalla, en dos columnas (lo pedido | pagos y cobro)', v.cabe && v.lado && v.ancho > v.vw * 0.6 && v.scroll <= 2, v);
      const no = await seVen(p, MESA);
      chk('1. ' + n + ': se ve TODO sin desplazar (pedido, total, pagos, saldo, abono, Cobrar, recibo, Cerrar)', !no.length, no);
      if(n === 'computador 1366×768'){
        // 2. Funciona igual
        const q0 = await p.evaluate(() => data.tables[1].items[0].qty);
        await p.click('#itemsContainer .li-qty-plus[data-idx="0"]'); await p.waitForTimeout(150);
        chk('2. «+» de Águila suma (6 → 7) con la ventana en dos columnas', (await p.evaluate(() => data.tables[1].items[0].qty)) === q0 + 1);
        await p.click('#csAbono'); await p.waitForTimeout(200);   // «➕ Abono o dividir la cuenta»
        await p.fill('#paymentAmount', '20000'); await p.click('#addPaymentBtn'); await p.waitForTimeout(400);
        const pg = await p.evaluate(() => ({ n: data.tables[1].payments.length, saldo: tableBalance(1), txt: document.getElementById('modalTotal').textContent }));
        chk('2. Registrar un abono de $20.000 lo guarda y el saldo baja ($102.200 − $30.000 = $72.200)', pg.n === 2 && pg.saldo === 72200 && /72\.200/.test(pg.txt), pg);
        const vu = await p.evaluate(() => (document.getElementById('vsFalta') || {}).textContent || '');
        chk('2. «Falta por pagar» abajo dice lo mismo ($72.200)', /72\.200/.test(vu), vu);
        // 5. − / + legibles
        const c = await p.evaluate(() => { const e = document.querySelector('#itemsContainer .li-qty-plus'), s = getComputedStyle(e); return { fg: s.color, bg: s.backgroundColor }; });
        chk('5. Los − / + de cada producto se leen (no son cuadros negros)', c.fg !== c.bg && !/rgb\(1[0-9], 1[0-9], 1[0-9]\)|rgb\(0, 0, 0\)/.test(c.bg), c);
        // 3. Cuenta de una persona
        await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); openTableModal(2); openPersonModal('pa'); }); await p.waitForTimeout(500);
        const vp = await p.evaluate(() => { const m = document.querySelector('#personOverlay > .modal'), r = m.getBoundingClientRect(), a = m.querySelector('.mc-a').getBoundingClientRect(), b = m.querySelector('.mc-b').getBoundingClientRect(); return { cabe: r.bottom <= innerHeight, lado: b.left >= a.right - 2 }; });
        const nop = await seVen(p, ['#personModalTitle', '#personAddProductSearch', '#personItemsContainer .line-item-wrap:last-of-type .line-item', '#personModalTotal', '#personPaymentAmount', '#personAddPaymentBtn', '#personCloseModalBtn']);
        chk('3. La cuenta de Ana (persona) en dos columnas y todo a la vista sin desplazar', vp.cabe && vp.lado && !nop.length, { vp, nop });
      }
      await ctx.close();
    }
    // ===== 4. Celular =====
    const { ctx, p } = await abrir(390, 844, true);
    await p.evaluate(() => openTableModal(1)); await p.waitForTimeout(600);
    let v = await p.evaluate(() => { const m = document.querySelector('#overlay .mesa-modal'); return { w: Math.round(m.getBoundingClientRect().width), una: getComputedStyle(m.querySelector('.mc-a')).display === 'contents', sx: document.documentElement.scrollWidth, vw: innerWidth }; });
    chk('4. Celular: una sola columna a lo ancho, sin barra horizontal', v.una && v.w >= v.vw - 40 && v.sx <= v.vw + 1, v);
    let no = await seVen(p, ['#modalTitle', '#addProductSearch', '#vsCobrarBtn']);
    chk('4. Celular: al abrir se ven el título, el buscador y «Cobrar»', !no.length, no);
    await p.evaluate(() => { const m = document.querySelector('#overlay .mesa-modal'); m.scrollTop = 500; }); await p.waitForTimeout(250);
    no = await seVen(p, ['#modalTitle', '#vsCobrarBtn']);
    chk('4. Celular: al bajar, el título (con Opciones) sigue arriba y «Cobrar» sigue abajo', !no.length, no);
    await p.evaluate(() => { const m = document.querySelector('#overlay .mesa-modal'); m.scrollTop = m.scrollHeight; }); await p.waitForTimeout(250);
    no = await seVen(p, ['#modalTitle', '#vsCobrarBtn', '#closeModalBtn']);
    chk('4. Celular: al final, Cerrar y Cobrar, con el título arriba', !no.length, no);
    await ctx.close();
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ Excepción: ' + (e && e.stack || e)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
