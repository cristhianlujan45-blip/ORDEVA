// 📲 Caja del modo fácil con QR: «Venta rápida (caja)» también en un restaurante (con mesas), el botón grande «📷 Leer
// código» (la cámara lee el código de barras o QR del producto y lo agrega), y al cobrar «Pagar con QR»: el QR de pago del
// negocio en grande con el total; si llega un pago por ese valor exacto se cobra solo («✅ ¡Llegó!»), si no, «✅ Ya pagó».
// Un pago de OTRO valor no se toma (sigue a las mesas como siempre). Sin QR de pago guardado, el botón no sale.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';
const QR = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 500) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('vento-guia-tour', '1'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(1800);
    await p.evaluate(async () => {
      await enterApp('test', null); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-pp-oculta', '1');
      document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); window.speakVoice = () => {};
      data.businessName = 'Restaurante Prueba';
      data.products = [{ id: 'p1', name: 'Almuerzo', price: 15000, barcodes: ['7701234567890'] }, { id: 'p2', name: 'Gaseosa', price: 3000 }];
      data.tables = {}; for(let k = 1; k <= 4; k++) data.tables[k] = { items: [], people: [], payments: [] };
      data.tableCount = 4; data.history = []; data.easyMode = false; delete data.modoOperacion; delete data.qrPago;
      await saveData(); renderAll();
      const c = document.getElementById('easyModeToggle'); c.checked = true; c.dispatchEvent(new Event('change'));
    });
    await p.waitForTimeout(400);
    // 1. Venta rápida (caja) en un restaurante
    const r1 = await p.evaluate(() => { const b = document.querySelector('#facilApp .fz-rapida'); return b ? b.textContent : null; });
    chk('1. Restaurante en modo fácil: sale «🛍️ Venta rápida (caja)» arriba de las mesas', /Venta rápida \(caja\)/.test(r1 || '') && /código o QR/.test(r1 || ''), r1);
    await p.evaluate(() => document.querySelector('#facilApp .fz-rapida').click()); await p.waitForTimeout(200);
    const r2 = await p.evaluate(() => ({ tit: (document.querySelector('#facilApp .fz-titulo') || {}).textContent, scan: !!document.querySelector('#facilApp .fz-scan'), tiles: document.querySelectorAll('#facilApp .pz-tile').length }));
    chk('2. La caja grande abre con sus productos y el botón «📷 Leer código»', /Venta rápida/.test(r2.tit || '') && r2.scan && r2.tiles === 2, r2);
    // 3. Leer código con la cámara (se simula la lectura)
    await p.evaluate(() => { window.openScanOverlay = (fn) => setTimeout(() => fn('7701234567890'), 10); document.querySelector('#facilApp .fz-scan').click(); });
    await p.waitForTimeout(300);
    const r3 = await p.evaluate(() => ({ lin: [...document.querySelectorAll('#facilApp .pz-linea')].map(l => l.textContent), tot: document.querySelector('#facilApp .pz-total b').textContent }));
    chk('3. «📷 Leer código» agrega el producto de ese código (Almuerzo $15.000)', r3.lin.length === 1 && /Almuerzo/.test(r3.lin[0]) && r3.tot === '$15.000', r3);
    // 4. Sin QR de pago: el botón no sale
    await p.evaluate(() => document.querySelector('#facilApp .pz-cobrar').click()); await p.waitForTimeout(200);
    chk('4. Sin QR de pago guardado, «¿Cómo pagó?» no muestra «Pagar con QR»', await p.evaluate(() => !!document.querySelector('.pz-pago-ov') && !document.querySelector('.pz-qr-btn')));
    await p.evaluate(() => document.querySelector('.pz-pago-ov .pz-cancel').click()); await p.waitForTimeout(150);
    // 5. Con QR: «Pagar con QR» → QR grande con el total
    await p.evaluate(qr => { data.qrPago = { img: qr, orig: qr, tipo: 'Bre-B', llave: '@negocio' }; }, QR);
    await p.evaluate(() => document.querySelector('#facilApp .pz-cobrar').click()); await p.waitForTimeout(200);
    chk('5. Con QR de pago: «📲 Pagar con QR» grande en «¿Cómo pagó?»', await p.evaluate(() => /Pagar con QR/.test((document.querySelector('.pz-pago-ov .pz-qr-btn') || {}).textContent || '')));
    await p.evaluate(() => document.querySelector('.pz-qr-btn').click()); await p.waitForTimeout(200);
    const r5 = await p.evaluate(() => { const o = document.getElementById('pzQrOv'); if(!o) return null; const im = o.querySelector('.pz-qr-img'), r = im.getBoundingClientRect(); return { tot: o.querySelector('.pz-qr-tot b').textContent, src: im.getAttribute('src').slice(0, 22), w: r.width, txt: o.textContent, dentro: r.right <= innerWidth && r.left >= 0 }; });
    chk('5. … el QR del negocio en grande con «$15.000», la llave y «Esperando el pago…»', r5 && r5.tot === '$15.000' && r5.src === 'data:image/png;base64,' && r5.w >= 200 && r5.dentro && /@negocio/.test(r5.txt) && /Esperando el pago/.test(r5.txt), r5);
    // 6. Llega un pago de OTRO valor: no se toma aquí
    const r6 = await p.evaluate(() => { return new Promise(res => {
      const x = { id: 'x6', monto: 9000, metodo: 'NEQUI', estado: 'app' }; window.pagoLlego(x); setTimeout(() => res({ sigue: !!document.getElementById('pzQrOv'), tomado: !!x.aplicado }), 200); }); });
    chk('6. Un pago de $9.000 (otro valor) no cobra esta venta: el QR sigue esperando', r6.sigue && !r6.tomado, r6);
    // 7. Llega el pago exacto: se cobra solo
    await p.evaluate(() => window.pagoLlego({ id: 'x7', monto: 15000, metodo: 'NEQUI', estado: 'app' }));
    await p.waitForTimeout(300);
    const r7a = await p.evaluate(() => (document.querySelector('#pzQrOv .pz-qr-est') || {}).textContent || '');
    chk('7. Llega $15.000 por Nequi mientras está el QR: «✅ ¡Llegó! $15.000 por Nequi»', /Llegó! \$15\.000 por Nequi/.test(r7a), r7a);
    await p.waitForTimeout(1500);
    const r7 = await p.evaluate(() => ({ qr: !!document.getElementById('pzQrOv'), pago: !!document.querySelector('.pz-pago-ov'), h: data.history.length, m: data.history[0] && data.history[0].payments[0], tot: data.history[0] && data.history[0].total, lsLlego: typeof window.pagoLlego === 'function' && !/espera/.test(String(window.pagoLlego.name)) }));
    chk('7. … y la venta queda cobrada sola ($15.000, transferencia «Nequi (QR)»), sin ventanas abiertas', !r7.qr && !r7.pago && r7.h === 1 && r7.tot === 15000 && r7.m.method === 'transferencia' && /Nequi \(QR\)/.test(r7.m.note), r7);
    // 8. «Ya pagó» a mano
    await p.evaluate(() => { const t = [...document.querySelectorAll('#facilApp .pz-tile')].find(x => /Gaseosa/.test(x.textContent)); t.click(); });
    await p.waitForTimeout(500);
    await p.evaluate(() => document.querySelector('#facilApp .pz-cobrar').click()); await p.waitForTimeout(200);
    await p.evaluate(() => document.querySelector('.pz-qr-btn').click()); await p.waitForTimeout(150);
    await p.evaluate(() => document.querySelector('#pzQrOv .pz-qr-ok').click()); await p.waitForTimeout(300);
    const r8 = await p.evaluate(() => ({ h: data.history.length, m: data.history[0].payments[0], tot: data.history[0].total }));
    chk('8. «✅ Ya pagó»: la venta de $3.000 queda cobrada como transferencia «Bre-B (QR)»', r8.h === 2 && r8.tot === 3000 && r8.m.method === 'transferencia' && /Bre-B \(QR\)/.test(r8.m.note), r8);
    // 9. Después del QR, los pagos vuelven a las mesas como siempre
    const r9 = await p.evaluate(() => { const x = { id: 'x9', monto: 3000, metodo: 'NEQUI', estado: 'app' }; window.pagoLlego(x); return { aplicado: !!x.aplicado, caja: !!x.caja }; });
    chk('9. Cerrado el QR, un pago de $3.000 ya no se toma como venta de la caja (vuelve al flujo de siempre)', !r9.caja, r9);
    // 10. Volver: el QR se cierra sin cobrar (después del cobro, la caja no toma un toque en 0,45 s: doble toque)
    await p.waitForTimeout(600);
    await p.evaluate(() => { const t = [...document.querySelectorAll('#facilApp .pz-tile')].find(x => /Gaseosa/.test(x.textContent)); t.click(); });
    await p.waitForTimeout(500);
    await p.evaluate(() => document.querySelector('#facilApp .pz-cobrar').click()); await p.waitForTimeout(200);
    await p.evaluate(() => document.querySelector('.pz-qr-btn').click()); await p.waitForTimeout(150);
    await p.evaluate(() => document.querySelector('#pzQrOv .pz-qr-no').click()); await p.waitForTimeout(150);
    chk('10. «← Volver» cierra el QR sin cobrar (sigue «¿Cómo pagó?»)', await p.evaluate(() => !document.getElementById('pzQrOv') && !!document.querySelector('.pz-pago-ov') && data.history.length === 2));
    await ctx.close();
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
