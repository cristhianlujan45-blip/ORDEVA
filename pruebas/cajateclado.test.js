// ⌨️ ORDEVA 1.72.2 · La caja POS con su propia entrada en el menú y manejada con el teclado (casi sin mouse). Sin internet.
// Pedido del dueño: «que la caja POS tenga su sección aparte y se vea clara; al cobrar, solo digitar con el teclado (la
// cantidad, con cuánto me pagaron) o moverme con las flechitas».
//  1. «Caja POS» en el menú abre la caja en pantalla completa; el cuadre del día del dueño se llama «Cuadre».
//  2. Buscar + Enter agrega; «3» + Enter = cantidad del último; «+» / «−» le suman / restan; Supr lo quita.
//  3. ↓ pasa a los productos; las flechas se mueven entre ellos; Enter agrega; una letra vuelve al buscador.
//  4. F2: el cursor queda en «¿Con cuánto paga?»; un Enter inmediato no cobra; se escribe 50000 + Enter → efectivo con vuelto.
//  5. F2 + ↓ y → elige otro medio (DaviPlata) y Enter cobra.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  const pausa = ms => new Promise(r => setTimeout(r, ms));
  try{
    const ctx = await b.newContext({ viewport: { width: 1366, height: 800 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await pausa(1100);
    await p.fill('#authBiz', 'Tienda Teclado'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await pausa(1400);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await p.evaluate(() => {
      document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.products = [{ id: 'a', name: 'Águila', price: 3500, favorite: true }, { id: 'k', name: 'Póker', price: 3300 }, { id: 'e', name: 'Empanada', price: 2000 }, { id: 'g', name: 'Gaseosa', price: 2500 }];
      data.history = []; saveData(); window.ventoPOS.vaciar();
    });
    await pausa(3200);
    const R = '#pzCajaOv .pz-caja-root';
    const lineas = () => p.evaluate(() => window.ventoPOS.carrito().map(x => x.id + '×' + x.qty).join(','));
    // ===== 1 =====
    let v = await p.evaluate(() => { const b = document.getElementById('posNav'), c = document.getElementById('vsCajaNav'); return { pos: !!b && !b.hidden && b.offsetParent !== null && /Caja POS/.test(b.textContent), cuadre: c ? c.textContent.trim() : '(sin vista sencilla)' }; });
    chk('1. «Caja POS» tiene su propia entrada en el menú', v.pos, v);
    chk('1. El cuadre del día del dueño se llama «Cuadre» (no se confunde con la caja)', !/^Caja$/.test(v.cuadre), v);
    await p.click('#posNav'); await pausa(400);
    chk('1. «Caja POS» abre la caja en pantalla completa, con el cursor en el buscador', await p.evaluate(() => document.getElementById('pzCajaOv').classList.contains('show') && document.activeElement && document.activeElement.classList.contains('pz-q')));
    // ===== 2 =====
    await p.keyboard.type('poker'); await p.keyboard.press('Enter'); await pausa(150);
    chk('2. Escribir «poker» + Enter agrega el Póker', (await lineas()) === 'k×1', await lineas());
    await p.keyboard.type('3'); await p.keyboard.press('Enter'); await pausa(150);
    chk('2. «3» + Enter = 3 Póker (la cantidad del último)', (await lineas()) === 'k×3', await lineas());
    await p.keyboard.press('+'); await pausa(80); await p.keyboard.press('+'); await pausa(80); await p.keyboard.press('-'); await pausa(120);
    chk('2. «+» «+» «−» → 4 Póker', (await lineas()) === 'k×4', await lineas());
    chk('2. El último producto se resalta en la venta', await p.evaluate(R => /Póker/.test((document.querySelector(R + ' .pz-linea.pz-ult') || {}).textContent || ''), R));
    // ===== 3 =====
    await p.keyboard.press('ArrowDown'); await pausa(100);
    let foco = await p.evaluate(() => { const a = document.activeElement; return a && (a.dataset.add || a.className); });
    chk('3. ↓ pasa a los productos (el primero: el favorito Águila)', foco === 'a', foco);
    await p.keyboard.press('ArrowDown'); await pausa(80); await p.keyboard.press('ArrowRight'); await pausa(80);
    foco = await p.evaluate(() => { const a = document.activeElement; return a && a.dataset.add; });
    await p.keyboard.press('Enter'); await pausa(150);
    chk('3. Con las flechas se mueve entre los productos y Enter agrega el que tiene el foco (' + foco + ')', !!foco && new RegExp(foco + '×1').test(await lineas()), { foco, l: await lineas() });
    await p.keyboard.press('e'); await pausa(100);
    v = await p.evaluate(R => ({ foco: document.activeElement && document.activeElement.classList.contains('pz-q'), q: document.querySelector(R + ' .pz-q').value }), R);
    chk('3. Una letra vuelve al buscador y se escribe ahí', v.foco && v.q === 'e', v);
    await p.fill(R + ' .pz-q', ''); await p.keyboard.press('Delete'); await pausa(150);
    chk('3. Con el buscador vacío, Supr quita el último producto (' + foco + ')', !new RegExp(foco + '×').test(await lineas()) && (await lineas()) === 'k×4', await lineas());
    // ===== 4 =====
    await p.keyboard.press('F2'); await pausa(80);
    await p.keyboard.press('Enter'); await pausa(250);
    v = await p.evaluate(() => ({ ov: !!document.querySelector('.pz-pago-ov.show'), foco: document.activeElement && document.activeElement.id, n: data.history.length }));
    chk('4. F2 abre el cobro con el cursor en «¿Con cuánto paga?» y un Enter inmediato NO cobra', v.ov && v.foco === 'pzPagaCon' && v.n === 0, v);
    chk('4. La ventana dice cómo se maneja con el teclado', await p.evaluate(() => /Enter.*efectivo/.test((document.querySelector('.pz-pago-ov .pz-kb-ayuda') || {}).textContent || '')));
    await p.keyboard.type('50000'); await p.keyboard.press('Enter'); await pausa(400);
    v = await p.evaluate(() => { const h = data.history[0] || {}; return { n: data.history.length, total: h.total, pago: h.payments && h.payments[0] }; });
    chk('4. «50000» + Enter → cobrado en efectivo $13.200 con vuelto $36.800 (sin tocar el mouse)', v.n === 1 && v.total === 13200 && v.pago.method === 'efectivo' && v.pago.vueltas === 36800, v);
    // ===== 5 =====
    await p.evaluate(() => { const q = document.querySelector('#pzCajaOv .pz-q'); q.focus(); });
    await p.keyboard.type('gaseosa'); await p.keyboard.press('Enter'); await pausa(150);
    await p.keyboard.press('F2'); await pausa(700);
    await p.keyboard.press('ArrowDown'); await pausa(80);
    let m1 = await p.evaluate(() => document.activeElement && document.activeElement.dataset.m);
    await p.keyboard.press('ArrowDown'); await pausa(80);
    let m2 = await p.evaluate(() => document.activeElement && document.activeElement.dataset.m);
    await p.keyboard.press('ArrowRight'); await pausa(80);
    let m3 = await p.evaluate(() => document.activeElement && document.activeElement.dataset.m);
    chk('5. ↓ efectivo, ↓ Nequi, → DaviPlata', m1 === 'efectivo' && m2 === 'nequi' && m3 === 'daviplata', [m1, m2, m3]);
    await p.keyboard.press('Enter'); await pausa(400);
    v = await p.evaluate(() => { const h = data.history[0] || {}; return { n: data.history.length, total: h.total, nota: h.payments && h.payments[0].note }; });
    chk('5. Enter cobra con DaviPlata ($2.500)', v.n === 2 && v.total === 2500 && /DaviPlata/.test(v.nota), v);
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ Excepción: ' + (e && e.stack || e)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
