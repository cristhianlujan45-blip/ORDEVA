// 🔳 ORDEVA 1.81.5 · Auditoría del código de barras: el celular como lector de una caja POS, y en las MESAS. Sin internet.
// Pedido del dueño: «escanear el código de barras con el celular para agregar los productos… también en las mesas…
// productos que no estén inventariados, déjame agregarlos con el código de barras… que funcione como un lector normal».
// Cámara falsa de Chromium y un lector simulado: lo que «ve» la cámara lo pone la prueba (window.__enCamara).
// CELULAR (táctil, cámara):
//  1. Cuenta de una mesa → «🔳 Escanear»: el código se suma a la cuenta. Quieto frente a la cámara no se repite; se
//     retira y se vuelve a pasar, sí. La cámara sigue prendida para el siguiente.
//  2. Un código que no está en la lista, en la mesa: «🔳 Código nuevo» → «Es un producto nuevo» → ficha → con precio
//     queda en Productos con su código y en la cuenta. Después la cámara vuelve sola para seguir escaneando.
//  3. Un producto que ya existe pero sin código (no inventariado por código): se elige de la lista una vez, queda con
//     ese código y la próxima vez se reconoce solo.
//  4. Lo escaneado en la mesa queda en la cuenta con su precio y se cobra igual.
// COMPUTADOR con lector USB o Bluetooth (escribe el código muy rápido + Enter, como un teclado):
//  5. Con la cuenta de una mesa abierta (sin tocar el buscador): el código se suma a la cuenta.
//  6. Con el cursor en el buscador de la mesa: el código también se suma (no se queda escrito en el buscador).
//  7. Un código que no está: sale «🔳 Código nuevo» para crearlo o elegirlo.
//  8. En la Caja POS: el código se suma a la venta.
//  9. Escribir a mano en el buscador (despacio, o rápido una palabra + Enter) sigue buscando normal: no se toma como código.
// 10. El celular como lector del computador: con la mesa abierta, lo que manda el celular va a esa cuenta.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
const ARROZ = '7701111111111', LECHE = '7702222222222', NUEVO = '7709999999991', EMPA = '7708888888883', NUEVO2 = '7707777777775';
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] }); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  const pausa = ms => new Promise(r => setTimeout(r, ms));
  async function equipo(movil){
    const ctx = await b.newContext(movil ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, permissions: ['camera'] } : { viewport: { width: 1280, height: 800 }, permissions: ['camera'] });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());   // sin internet
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){}
      window.__enCamara = [];
      const poner = () => { if(window.ventoCodigos && !window.ventoCodigos.__sim){ window.ventoCodigos.__sim = true; window.ventoCodigos.detector = () => Promise.resolve({ detect: async () => (window.__enCamara || []).map(r => ({ rawValue: r, format: 'ean_13' })) }); } };
      document.addEventListener('DOMContentLoaded', poner); setInterval(poner, 50); });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push((movil ? 'celular: ' : 'pc: ') + e.message));
    await p.goto(BASE + '/index.html'); await pausa(1000);
    await p.evaluate(() => { const s = document.getElementById('authType'); if(s){ s.value = 'bar'; s.dispatchEvent(new Event('change')); } });
    await p.fill('#authBiz', 'Bar Lector'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await pausa(1500);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await p.evaluate(([a, l]) => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.products = [{ id: 'a', name: 'Arroz', price: 4500, barcodes: [a] }, { id: 'l', name: 'Leche', price: 3900, barcodes: [l] }, { id: 'e', name: 'Empanada', price: 2500 }];
      Object.keys(data.tables).forEach(k => { data.tables[k].items = []; }); data.history = []; saveData(); }, [ARROZ, LECHE]);
    await pausa(800);
    return { ctx, p };
  }
  const cuenta = (p, m) => p.evaluate(m => (data.tables[m].items || []).map(i => (i.productId || i.id) + '×' + (i.qty || 1)).join(','), m);
  const camara = async (p, codigos, ms) => { await p.evaluate(c => { window.__enCamara = c; }, codigos); await pausa(ms || 600); };
  const abierto = (p, id) => p.evaluate(id => { const o = document.getElementById(id); return !!o && o.classList.contains('show'); }, id);
  const camaraViva = p => p.evaluate(() => { const v = document.getElementById('scanVideo'), s = v && v.srcObject; return document.getElementById('scanOverlay').classList.contains('show') && !!(s && s.getVideoTracks().some(t => t.readyState === 'live')); });
  try{
    // ======================= CELULAR =======================
    const { p } = await equipo(true);
    await p.evaluate(() => openTableModal(1)); await pausa(500);
    // ===== 1 =====
    await p.click('#scanSellBtn'); await pausa(1800);
    chk('1. «🔳 Escanear» en la mesa prende la cámara', await camaraViva(p));
    await camara(p, [ARROZ]);
    chk('1. Pasa el arroz: se suma a la cuenta de la mesa', await cuenta(p, 1) === 'a×1', await cuenta(p, 1));
    await camara(p, [ARROZ], 1000);
    chk('1. Quieto frente a la cámara no se repite', await cuenta(p, 1) === 'a×1', await cuenta(p, 1));
    await camara(p, [], 1000); await camara(p, [ARROZ]); await camara(p, [LECHE]); await camara(p, [], 300);
    chk('1. Se retira y se vuelve a pasar (2 arroz) y luego la leche', await cuenta(p, 1) === 'a×2,l×1', await cuenta(p, 1));
    chk('1. La cámara sigue prendida para el siguiente', await camaraViva(p));
    // ===== 2 =====
    await camara(p, [NUEVO], 900); await camara(p, [], 200);
    chk('2. Código que no está: sale «🔳 Código nuevo»', await abierto(p, 'linkCodeOverlay'));
    await p.click('#lcCreateBtn'); await pausa(900);
    const fichaVe = await p.evaluate(() => !!document.querySelector('#pcPre'));
    chk('2. «Es un producto nuevo» abre la ficha (pide el precio)', fichaVe);
    await p.fill('#pcNom', 'Gaseosa Mesa 400 ml'); await p.fill('#pcPre', '3000');
    await p.click('.overlay.show [data-ok]'); await pausa(1200);
    let v = await p.evaluate(c => { const pr = data.products.find(x => (x.barcodes || []).includes(c)); return { pr: pr && { name: pr.name, price: pr.price, id: pr.id }, items: (data.tables[1].items || []).map(i => i.productId + '×' + i.qty) }; }, NUEVO);
    chk('2. Queda en Productos con su código y su precio', v.pr && v.pr.name === 'Gaseosa Mesa 400 ml' && v.pr.price === 3000, v);
    chk('2. … y se suma a la cuenta de la mesa', v.pr && v.items.includes(v.pr.id + '×1'), v);
    await pausa(1500);
    chk('2. La cámara vuelve sola para seguir escaneando', await camaraViva(p));
    await camara(p, [NUEVO]); await camara(p, [], 300);
    v = await p.evaluate(c => { const pr = data.products.find(x => (x.barcodes || []).includes(c)); return (data.tables[1].items || []).find(i => i.productId === (pr && pr.id)); }, NUEVO);
    chk('2. Escanearlo otra vez ya lo reconoce: 2 en la cuenta', v && v.qty === 2, v);
    // ===== 3 =====
    await camara(p, [EMPA], 900); await camara(p, [], 200);
    chk('3. Código de un producto que existe sin código: «🔳 Código nuevo»', await abierto(p, 'linkCodeOverlay'));
    await p.fill('#lcSearch', 'empan'); await p.evaluate(() => document.getElementById('lcSearch').dispatchEvent(new Event('input', { bubbles: true }))); await pausa(300);
    await p.click('#lcList button[data-id="e"]'); await pausa(900);
    v = await p.evaluate(c => ({ cod: (data.products.find(x => x.id === 'e').barcodes || []).includes(c), items: (data.tables[1].items || []).map(i => i.productId + '×' + i.qty).join(',') }), EMPA);
    chk('3. Se elige «Empanada» una vez: queda con ese código y en la cuenta', v.cod && /e×1/.test(v.items), v);
    await pausa(1500);
    await camara(p, [EMPA]); await camara(p, [], 300);
    chk('3. La próxima vez se reconoce sola (2 empanadas)', /e×2/.test(await cuenta(p, 1)), await cuenta(p, 1));
    // ===== 4 =====
    v = await p.evaluate(() => { closeScanOverlay(); return { saldo: tableBalance(1) }; });
    chk('4. La cuenta suma bien: 2 arroz + leche + 2 gaseosas + 2 empanadas = $26.900', v.saldo === 2 * 4500 + 3900 + 2 * 3000 + 2 * 2500, v);

    // ======================= COMPUTADOR con lector USB =======================
    const { p: pc } = await equipo(false);
    const lector = async (cod, ms) => { await pc.keyboard.type(cod, { delay: 8 }); await pc.keyboard.press('Enter'); await pausa(ms || 500); };
    await pc.evaluate(() => openTableModal(2)); await pausa(500);
    // ===== 5 =====
    await pc.evaluate(() => { document.activeElement && document.activeElement.blur && document.activeElement.blur(); });
    await lector(ARROZ);
    chk('5. Lector USB con la mesa abierta: el arroz se suma a la cuenta', await cuenta(pc, 2) === 'a×1', await cuenta(pc, 2));
    await lector(ARROZ);
    chk('5. Otra vez: 2 arroz (el lector sí repite)', await cuenta(pc, 2) === 'a×2', await cuenta(pc, 2));
    // ===== 6 =====
    await pc.click('#addProductSearch'); await pausa(200);
    await lector(LECHE);
    v = { cuenta: await cuenta(pc, 2), buscador: await pc.inputValue('#addProductSearch') };
    chk('6. Con el cursor en el buscador: la leche se suma y el buscador queda limpio', v.cuenta === 'a×2,l×1' && v.buscador === '', v);
    // ===== 7 =====
    await pc.evaluate(() => { document.activeElement && document.activeElement.blur && document.activeElement.blur(); });
    await lector(NUEVO2, 800);
    chk('7. Código que no está: sale «🔳 Código nuevo» para crearlo o elegirlo', await abierto(pc, 'linkCodeOverlay'));
    await pc.evaluate(() => document.getElementById('lcCancelBtn').click()); await pausa(300);
    // ===== 9 =====
    await pc.click('#addProductSearch'); await pc.keyboard.type('lech', { delay: 160 }); await pausa(500);
    v = { buscador: await pc.inputValue('#addProductSearch'), sug: await pc.evaluate(() => (document.getElementById('addProductSuggestions').textContent || '').trim().slice(0, 80)) };
    chk('9. Escribir a mano en el buscador sigue buscando normal', v.buscador === 'lech' && /Leche/.test(v.sug), v);
    await pc.fill('#addProductSearch', '');
    await pc.click('#addProductSearch'); await pc.keyboard.type('leche', { delay: 20 }); await pc.keyboard.press('Enter'); await pausa(500);
    v = { abierto: await abierto(pc, 'linkCodeOverlay'), cuenta: await cuenta(pc, 2) };
    chk('9. Escribir rápido «leche» + Enter en el buscador no se toma como un código', !v.abierto, v);
    await pc.evaluate(() => { document.querySelectorAll('#linkCodeOverlay.show').forEach(o => o.classList.remove('show')); });
    await pc.fill('#addProductSearch', '');
    const antes10 = await cuenta(pc, 2);
    // ===== 10 =====
    v = await pc.evaluate(c => { const d = (window.ventoLectorDestinos || []).filter(x => { try{ return x.activo(); }catch(e){ return false; } }).sort((a, b) => (b.prioridad || 0) - (a.prioridad || 0))[0]; if(!d) return { d: null }; d.leer(c); return { d: d.nombre }; }, ARROZ);
    await pausa(500);
    chk('10. El celular como lector: con la mesa abierta, lo que manda va a esa cuenta', v.d === 'mesa' && (await cuenta(pc, 2)).split(',').some(x => x.startsWith('a×') && +x.split('×')[1] === +antes10.split(',').find(y => y.startsWith('a×')).split('×')[1] + 1), { v, cuenta: await cuenta(pc, 2) });
    // ===== 8 =====
    await pc.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); currentTable = null; window.ventoPOS.vaciar(); });
    await pc.click('#posNav'); await pausa(600);
    await pc.evaluate(() => { document.activeElement && document.activeElement.blur && document.activeElement.blur(); });
    await lector(LECHE);
    chk('8. Lector USB en la Caja POS: la leche se suma a la venta', (await pc.evaluate(() => window.ventoPOS.carrito().map(x => x.id + '×' + x.qty).join(','))) === 'l×1', await pc.evaluate(() => window.ventoPOS.carrito()));
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ Excepción: ' + (e && e.stack || e)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
