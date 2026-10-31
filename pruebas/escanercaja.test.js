// 📷 ORDEVA 1.72.4 · Modo escáner en la Caja POS (celular): la cámara queda prendida dentro de la caja. Sin internet.
// Cámara falsa de Chromium y un lector simulado (los códigos que «ve» la cámara los pone la prueba).
//  1. 📷 en la Caja POS prende la cámara DENTRO de la caja; se esconde el menú de abajo y los botones de productos; la
//     venta y COBRAR quedan a la vista.
//  2. Los productos se agregan solos al pasarlos. El mismo código quieto frente a la cámara no se suma dos veces; si se
//     retira y se vuelve a pasar, sí.
//  3. Con el cobro abierto no lee nada; después de cobrar sigue prendida y la siguiente venta empieza escaneando.
//  4. Al cerrar la caja se suelta la cámara y vuelve el menú. Al volver a abrir la Caja POS, la cámara prende sola.
//  5. «✕ Apagar cámara»: se apaga y la próxima vez ya no prende sola.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] }); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  const pausa = ms => new Promise(r => setTimeout(r, ms));
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, permissions: ['camera'] });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){}
      // Lector simulado: lo que «está frente a la cámara» lo decide la prueba (window.__enCamara).
      window.__enCamara = [];
      const poner = () => { if(window.ventoCodigos && !window.ventoCodigos.__sim){ window.ventoCodigos.__sim = true; window.ventoCodigos.detector = () => Promise.resolve({ detect: async () => (window.__enCamara || []).map(r => ({ rawValue: r, format: 'ean_13' })), zxing: true }); } else if(!window.ventoCodigos) setTimeout(poner, 50); };
      poner(); });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await pausa(1000);
    await p.fill('#authBiz', 'Minimercado Escáner'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await pausa(1500);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.products = [{ id: 'a', name: 'Arroz', price: 4500, barcodes: ['7701111111111'] }, { id: 'l', name: 'Leche', price: 3900, barcodes: ['7702222222222'] }, { id: 'c', name: 'Café', price: 9800, barcodes: ['7703333333333'] }];
      data.history = []; saveData(); window.ventoPOS.vaciar(); });
    await pausa(3300);
    const ver = () => p.evaluate(() => { const vis = s => { const e = document.querySelector(s); if(!e || getComputedStyle(e).display === 'none' || getComputedStyle(e).visibility === 'hidden') return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const v = document.getElementById('ecVideo'), s = v && v.srcObject;
      return { panel: vis('#ecPanel'), vivo: !!(s && s.getVideoTracks().some(t => t.readyState === 'live')), menu: vis('.tabbar'), grid: vis('#pzCajaOv .pz-grid'), venta: vis('#pzCajaOv .pz-cart'), cobrar: vis('#pzCajaOv .pz-cobrar'),
        carrito: window.ventoPOS.carrito().map(x => x.id + '×' + x.qty).join(','), estado: (document.getElementById('ecEstado') || {}).textContent || '' }; });
    const camara = (codigos, ms) => p.evaluate(c => { window.__enCamara = c; }, codigos).then(() => pausa(ms || 500));
    // ===== 1 =====
    await p.click('#posNav'); await pausa(500);
    await p.click('#pzCajaOv [data-scan]'); await pausa(1800);
    let v = await ver();
    chk('1. 📷 prende la cámara DENTRO de la caja (no una ventana encima)', v.panel && v.vivo && !(await p.evaluate(() => document.getElementById('scanOverlay').classList.contains('show'))), v);
    chk('1. Se esconden el menú de abajo y los botones de productos; la venta y COBRAR quedan a la vista', !v.menu && !v.grid && v.venta && v.cobrar, v);
    chk('1. Dice «Listo: pasa los productos»', /Listo/.test(v.estado), v.estado);
    // ===== 2 =====
    await camara(['7701111111111'], 600);
    v = await ver();
    chk('2. Pasa el arroz: se agrega solo', v.carrito === 'a×1', v);
    await camara(['7701111111111'], 900);
    chk('2. El arroz quieto frente a la cámara no se suma otra vez', (await ver()).carrito === 'a×1', await ver());
    await camara([], 1000); await camara(['7701111111111'], 600);
    chk('2. Se retira y se vuelve a pasar: 2 arroz', (await ver()).carrito === 'a×2', await ver());
    await camara(['7702222222222', '7703333333333'], 600); await camara([], 300);
    v = await ver();
    chk('2. Leche y café juntos frente a la cámara: se agregan los dos', v.carrito === 'a×2,l×1,c×1', v);
    // ===== 3 =====
    await p.click('#pzCajaOv .pz-cobrar'); await pausa(700);
    await camara(['7702222222222'], 700); await camara([], 200);
    chk('3. Con el cobro abierto no lee nada', (await ver()).carrito === 'a×2,l×1,c×1', await ver());
    await p.click('.pz-pago-ov .pz-met[data-m="efectivo"]'); await pausa(900);
    v = await ver();
    chk('3. Cobrado: la venta queda guardada y la cámara sigue prendida', v.carrito === '' && v.vivo && v.panel && await p.evaluate(() => data.history.length === 1 && data.history[0].total === 22700), v);
    await camara(['7702222222222'], 600); await camara([], 200);
    chk('3. El siguiente cliente: se escanea de una (sin abrir la cámara otra vez)', (await ver()).carrito === 'l×1', await ver());
    // ===== 4 =====
    await p.click('#pzCajaOv [data-pzx]'); await pausa(800);
    v = await p.evaluate(() => ({ libre: !document.getElementById('ecPanel'), menu: (() => { const e = document.querySelector('.tabbar'); if(!e || getComputedStyle(e).display === 'none') return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; })(), ec: document.body.classList.contains('ec-on') }));
    chk('4. Al cerrar la caja se suelta la cámara y vuelve el menú', v.libre && v.menu && !v.ec, v);
    await p.click('#posNav'); await pausa(2000);
    v = await ver();
    chk('4. Al volver a abrir la Caja POS, la cámara prende sola', v.panel && v.vivo, v);
    // ===== 5 =====
    await p.click('#ecApagar'); await pausa(400);
    v = await p.evaluate(() => ({ panel: !!document.getElementById('ecPanel'), ec: document.body.classList.contains('ec-on') }));
    chk('5. «✕ Apagar cámara» la apaga', !v.panel && !v.ec, v);
    await p.click('#pzCajaOv [data-pzx]'); await pausa(500); await p.click('#posNav'); await pausa(1500);
    chk('5. …y la próxima vez ya no prende sola', !(await p.evaluate(() => !!document.getElementById('ecPanel'))));
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ Excepción: ' + (e && e.stack || e)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
