// 🧮 ORDEVA 1.79.0 · Caja POS: VALOR LIBRE y CANTIDAD, como una calculadora o una registradora. Sin internet.
// Pedido del dueño: «si quiero poner 5000, por simplemente ir sumando ahí, no me deja. Que yo vaya diciendo 5000 como una
// calculadora normal, y que pueda poner también la cantidad, no simplemente el producto».
//  1. El teclado de la caja se ve (16 teclas) y dice qué hacer.
//  2. «5000 ➕» agrega «Varios $5.000»; «3000 ➕» lo va sumando (total $8.000), como una calculadora.
//  3. «3 × 1500 ➕» = 3 de $1.500. «2» y tocar un producto lleva 2; «4 ×» y tocar otro lleva 4.
//  4. ⌫ y C borran.
//  5. En el buscador: «5000+2000» + Enter, «$1.500» + Enter y «120000» + Enter son valores; «3» + Enter sigue siendo la
//     cantidad del último; un código de barras largo no se vuelve un valor.
//  6. La cantidad de «Varios» se puede escribir; al cobrar, la venta queda con «Varios» sin producto (no toca inventario).
//  7. El teclado se puede esconder y queda así.
//  8. ✏️ Precio solo en esta venta: Águila a $3.000 (el producto sigue en $3.500; la venta guarda el precio normal);
//     «Volver al precio normal»; a «Varios» se le pone qué es («Recarga»).
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';

(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  const pausa = ms => new Promise(r => setTimeout(r, ms));
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await pausa(1100);
    await p.fill('#authBiz', 'Tienda Libre'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await pausa(1400);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await p.evaluate(() => {
      document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.products = [{ id: 'a', name: 'Águila', price: 3500, stock: 20 }, { id: 'k', name: 'Póker', price: 3300, stock: 20 }, { id: 'e', name: 'Empanada', price: 2000 }];
      data.history = []; saveData(); window.ventoPOS.vaciar();
    });
    await pausa(1500);
    await p.evaluate(() => window.ventoPOS.abrirCaja()); await pausa(500);
    const R = '#pzCajaOv .pz-caja-root';
    const tk = async (...ks) => { for(const k of ks){ await p.click(R + ' .pz-tec-k [data-tk="' + k + '"]'); await pausa(40); } await pausa(80); };
    const est = () => p.evaluate(R => ({ num: (document.querySelector(R + ' .pz-tec-num') || {}).textContent || '', ay: (document.querySelector(R + ' .pz-tec-ay') || {}).textContent || '',
      total: window.ventoPOS.resumen().total, l: window.ventoPOS.carrito().map(x => (x.libre ? 'V' + x.price : x.id) + '×' + x.qty).join(',') }), R);

    // ===== 1 =====
    let v = await p.evaluate(R => { const w = document.querySelector(R + ' .pz-tecw'); return { ver: !!w && !w.hidden && w.offsetParent !== null, n: document.querySelectorAll(R + ' .pz-tec-k button').length, ay: (document.querySelector(R + ' .pz-tec-ay') || {}).textContent }; }, R);
    chk('1. El teclado de la caja se ve con sus 16 teclas y dice qué hacer', v.ver && v.n === 16 && /calculadora/.test(v.ay), v);
    // ===== 2 =====
    await tk('5', '000');
    v = await est();
    chk('2. Al escribir 5 000 se ve «$5.000»', /5\.000/.test(v.num) && v.l === '', v);
    await tk('+');
    v = await est();
    chk('2. ➕ Agregar: queda «Varios $5.000» en la venta', v.l === 'V5000×1' && v.total === 5000 && /\$0/.test(v.num), v);
    await tk('3', '000', '+');
    v = await est();
    chk('2. 3000 ➕ lo va sumando: total $8.000', v.l === 'V5000×1,V3000×1' && v.total === 8000, v);
    v = await p.evaluate(R => [...document.querySelectorAll(R + ' .pz-linea')].map(x => x.innerText.replace(/\s+/g, ' ')), R);
    chk('2. En la venta se lee «Varios»', v.length === 2 && v.every(t => /Varios/.test(t)), v);
    // ===== 3 =====
    await tk('3', '×');
    v = await est();
    chk('3. «3 ×» queda esperando: «Toca el producto (lleva 3)…»', /^3 ×/.test(v.num) && /lleva 3/.test(v.ay), v);
    await tk('1', '5', '00', '+');
    v = await est();
    chk('3. «3 × 1500 ➕» = 3 de $1.500 (total $12.500)', /V1500×3/.test(v.l) && v.total === 12500, v);
    await tk('2'); await p.click(R + ' .pz-grid [data-add="a"]'); await pausa(150);
    v = await est();
    chk('3. «2» y tocar Águila → 2 Águila', /a×2/.test(v.l) && v.total === 12500 + 7000 && /\$0/.test(v.num), v);
    await tk('4', '×'); await p.click(R + ' .pz-grid [data-add="k"]'); await pausa(150);
    v = await est();
    chk('3. «4 ×» y tocar Póker → 4 Póker', /k×4/.test(v.l), v);
    await p.click(R + ' .pz-grid [data-add="e"]'); await pausa(150);
    v = await est();
    chk('3. Sin nada escrito, tocar un producto lleva 1 (como siempre)', /e×1/.test(v.l), v);
    // ===== 4 =====
    await tk('7', '8', '9', '⌫');
    v = await est();
    chk('4. ⌫ borra la última cifra (789 → 78)', /\$78$/.test(v.num.trim()), v);
    await tk('C');
    v = await est();
    chk('4. C borra todo', /\$0/.test(v.num) && !/×/.test(v.num), v);
    // ===== 5 =====
    await p.evaluate(() => window.ventoPOS.vaciar()); await pausa(100);
    const escribir = async t => { await p.fill(R + ' .pz-q', t); await p.press(R + ' .pz-q', 'Enter'); await pausa(200); };
    await escribir('5000+2000');
    v = await est();
    chk('5. «5000+2000» + Enter en el buscador → dos valores (total $7.000)', v.l === 'V5000×1,V2000×1' && v.total === 7000, v);
    await escribir('$1.500');
    await escribir('120000');
    v = await est();
    chk('5. «$1.500» y «120000» + Enter también son valores', /V1500×1/.test(v.l) && /V120000×1/.test(v.l) && v.total === 128500, v);
    await escribir('3');
    v = await est();
    chk('5. «3» + Enter sigue siendo la cantidad del último (3 × $120.000)', /V120000×3/.test(v.l), v);
    await escribir('2*2500');
    v = await est();
    chk('5. «2*2500» + Enter → 2 de $2.500', /V2500×2/.test(v.l), v);
    await p.evaluate(() => window.handleUnknownScannedCode = () => {});
    await escribir('7702004003508');
    v = await est();
    chk('5. Un código de barras largo NO se vuelve un valor', !/V7702004003508/.test(v.l), v);
    // ===== 5b. Por voz =====
    await p.evaluate(() => window.ventoPOS.vaciar()); await pausa(100);
    v = await p.evaluate(() => { const V = window.ventoCajaVoz; const r = ['cinco mil', 'más tres mil', 'tres por mil quinientos'].map(t => { const x = V.procesar(t); return x && x.intent; });
      return { r, l: window.ventoPOS.carrito().map(x => (x.libre ? 'V' + x.price : x.id) + '×' + x.qty).join(','), total: window.ventoPOS.resumen().total }; });
    chk('5. Por voz: «cinco mil», «más tres mil», «tres por mil quinientos» → $12.500', v.r.every(x => x === 'libre') && v.l === 'V5000×1,V3000×1,V1500×3' && v.total === 12500, v);
    v = await p.evaluate(() => { const x = window.ventoCajaVoz.procesar('dos empanadas'); return { i: x && x.intent, l: window.ventoPOS.carrito().map(x => x.id + '×' + x.qty).join(',') }; });
    chk('5. Por voz los productos siguen igual («dos empanadas»)', v.i === 'agregar' && /e×2/.test(v.l), v);
    // ===== 6 =====
    const k1 = await p.evaluate(() => window.ventoPOS.carrito().find(x => x.libre && x.price === 5000).id);
    await p.click(R + ' .pz-qn[data-qn="' + k1 + '"]'); await pausa(100);
    await p.fill(R + ' .pz-qin', '2'); await p.press(R + ' .pz-qin', 'Enter'); await pausa(200);
    v = await est();
    chk('6. La cantidad de «Varios» se puede escribir (2 × $5.000)', /V5000×2/.test(v.l), v);
    await p.evaluate(() => window.ventoPOS.vaciar()); await pausa(100);
    await tk('8', '000', '+'); await p.click(R + ' .pz-grid [data-add="a"]'); await pausa(150);
    const e = await p.evaluate(async () => { const en = await window.ventoPOS.cobrar({ pago: { method: 'efectivo' } }); return { total: en && en.total, items: en && en.items.map(i => ({ n: i.name, pid: i.productId || null, q: i.qty, p: i.price })), stockA: data.products.find(x => x.id === 'a').stock, hist: data.history.length }; });
    chk('6. Al cobrar: venta de $11.500 con «Varios» (sin producto) y Águila', e.total === 11500 && e.items.some(i => i.n === 'Varios' && !i.pid && i.p === 8000) && e.items.some(i => i.pid === 'a'), e);
    chk('6. El inventario solo baja lo que es producto (Águila 20 → 19)', e.stockA === 19, e);
    // ===== 8. Precio en esta venta =====
    await p.evaluate(() => window.ventoPOS.vaciar()); await pausa(100);
    await p.click(R + ' .pz-grid [data-add="a"]'); await pausa(150);
    await p.click(R + ' .pz-pre-ed[data-precio="a"]'); await pausa(150);
    await p.fill('.pz-mini .pz-pval', '3000'); await p.click('.pz-mini [data-ok]'); await pausa(250);
    v = await p.evaluate(R => ({ total: window.ventoPOS.resumen().total, prod: data.products.find(x => x.id === 'a').price, txt: (document.querySelector(R + ' .pz-pre-ed[data-precio="a"]') || {}).textContent || '' }), R);
    chk('8. ✏️ Águila a $3.000 solo en esta venta (el producto sigue en $3.500) y se ve «antes $3.500»', v.total === 3000 && v.prod === 3500 && /antes \$\s?3\.500/.test(v.txt), v);
    await p.click(R + ' .pz-pre-ed[data-precio="a"]'); await pausa(150);
    await p.click('.pz-mini [data-normal]'); await pausa(200);
    v = await p.evaluate(() => window.ventoPOS.resumen().total);
    chk('8. «Volver al precio normal» → $3.500', v === 3500, v);
    await p.click(R + ' .pz-pre-ed[data-precio="a"]'); await pausa(150);
    await p.fill('.pz-mini .pz-pval', '3200'); await p.press('.pz-mini .pz-pval', 'Enter'); await pausa(250);
    await tk('2', '000', '+');
    const kl = await p.evaluate(() => window.ventoPOS.carrito().find(x => x.libre).id);
    await p.click(R + ' .pz-pre-ed[data-precio="' + kl + '"]'); await pausa(150);
    await p.fill('.pz-mini .pz-pnom', 'Recarga'); await p.fill('.pz-mini .pz-pval', '10000'); await p.click('.pz-mini [data-ok]'); await pausa(250);
    const e8 = await p.evaluate(async () => { const en = await window.ventoPOS.cobrar({ pago: { method: 'efectivo' } }); return en && { total: en.total, items: en.items.map(i => ({ n: i.name, p: i.price, l: i.precioLista || null, pid: i.productId || null })) }; });
    chk('8. A «Varios» se le pone qué es: la venta queda con «Recarga» $10.000 y Águila $3.200 (normal $3.500)', e8 && e8.total === 13200 && e8.items.some(i => i.n === 'Recarga' && i.p === 10000 && !i.pid) && e8.items.some(i => i.pid === 'a' && i.p === 3200 && i.l === 3500), e8);
    // Pantalla
    await p.evaluate(() => window.ventoPOS.vaciar()); await tk('5', '000', '+', '3', '×', '1', '2', '00'); await pausa(4500);
    await p.evaluate(R => { const ov = document.getElementById('pzCajaOv'); [ov, ...ov.querySelectorAll('*')].forEach(x => { if(x.scrollTop) x.scrollTop = 0; }); }, R); await pausa(150);
    await p.screenshot({ path: process.env.VENTO_FOTO || '/tmp/cajalibre.png' });
    // ===== 7 =====
    await p.click(R + ' .pz-tec-t'); await pausa(150);
    v = await p.evaluate(R => ({ cerrado: getComputedStyle(document.querySelector(R + ' .pz-tec')).display === 'none', ls: localStorage.getItem('vento_pos_teclado') }), R);
    chk('7. El teclado se puede esconder (y queda guardado así)', v.cerrado && v.ls === '0', v);
    await p.click(R + ' .pz-tec-t'); await pausa(150);
    v = await p.evaluate(R => getComputedStyle(document.querySelector(R + ' .pz-tec')).display !== 'none', R);
    chk('7. … y volver a mostrar', v);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
