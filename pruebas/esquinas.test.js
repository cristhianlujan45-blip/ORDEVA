// ✂️ Ajustar las esquinas de la factura a mano, como CamScanner.
//  1. «📷 Revisa la foto» tiene «✂️ Ajustar esquinas»: abre la foto original con las 4 esquinas que detectó ORDEVA.
//  2. Se arrastran las esquinas con el dedo (sale una lupa mientras se arrastra) y los bordes (mueven 2 esquinas).
//  3. «⬜ Toda la foto», «🔍 Detectar otra vez» y «↻ Girar».
//  4. «✅ Listo»: la foto se recorta con ESAS esquinas (queda solo la hoja, sin la mesa) y se ve en la revisión.
//  5. Al aplicar la factura, el escaneo HD guardado usa esas esquinas; queda la original para corregir después.
//  6. «📚 Facturas anteriores» → «✂️ Corregir el recorte»: abre con las esquinas guardadas, se corrigen y se reemplaza la página.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
const W = 1600, H = 1200, ANG = 8 * Math.PI / 180, PW = 820, PH = 1080;
// Esquinas reales de la hoja en la foto (arriba-izq, arriba-der, abajo-der, abajo-izq)
const REAL = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => { const x = sx * PW / 2, y = sy * PH / 2; return [W / 2 + x * Math.cos(ANG) - y * Math.sin(ANG), H / 2 + x * Math.sin(ANG) + y * Math.cos(ANG)]; });

(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 500) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1500);
    await p.fill('#authBiz', 'Bar E'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1200);
    await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    // Foto: hoja girada 8° sobre una mesa oscura; la parte de arriba de la hoja tiene una franja NEGRA gruesa (para saber si el recorte la incluye).
    await p.evaluate(async ([W, H, ANG, PW, PH]) => {
      const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
      x.fillStyle = '#3b2a1c'; x.fillRect(0, 0, W, H); x.save(); x.translate(W / 2, H / 2); x.rotate(ANG);
      x.fillStyle = '#f4f1ea'; x.fillRect(-PW / 2, -PH / 2, PW, PH); x.fillStyle = '#111'; x.font = 'bold 40px Arial'; x.fillText('FACTURA ESQUINAS SAS', -PW / 2 + 40, -PH / 2 + 80);
      x.font = '28px Arial'; for(let i = 0; i < 8; i++) x.fillText('PRODUCTO ' + (i + 1) + '      12      24.000', -PW / 2 + 40, -PH / 2 + 180 + i * 70); x.restore();
      window.__foto = new File([await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92))], 'factura.jpg', { type: 'image/jpeg' });
      window.__brillo = async (file, fx, fy) => { const im = await fiCargarImagen(file), k = document.createElement('canvas'); k.width = im.width; k.height = im.height; const g = k.getContext('2d'); g.drawImage(im, 0, 0); const d = g.getImageData(Math.round(im.width * fx), Math.round(im.height * fy), 1, 1).data; return { v: d[0], w: im.width, h: im.height }; };
      window.__rev = fiRevisarFoto(window.__foto, () => {});
    }, [W, H, ANG, PW, PH]);
    await p.waitForSelector('#fiFotoOv.show #fiFotoEsq');
    chk('1. «📷 Revisa la foto» tiene «✂️ Ajustar esquinas»', await p.isVisible('#fiFotoEsq'));
    await p.click('#fiFotoEsq');
    await p.waitForFunction(() => { const o = document.getElementById('fiEsqOv'); return o && o.classList.contains('show') && o._prueba && o._prueba.foto(); });
    const det = await p.evaluate(() => document.getElementById('fiEsqOv')._prueba.esquinas());
    const err = (a, b2) => Math.max(...a.map((q, i) => Math.hypot(q[0] - b2[i][0], q[1] - b2[i][1])));
    chk('1. Abre la foto con las 4 esquinas que detectó ORDEVA (cerca de las de verdad)', err(det, REAL) < 40, { det, REAL });
    // 3. Toda la foto
    await p.click('#fiEsqOv [data-e="todo"]');
    let q = await p.evaluate(() => document.getElementById('fiEsqOv')._prueba.esquinas());
    chk('3. «⬜ Toda la foto» pone las esquinas en los bordes de la foto', JSON.stringify(q) === JSON.stringify([[0, 0], [W, 0], [W, H], [0, H]]), q);
    // 2. Arrastrar cada esquina a la esquina real de la hoja (como con el dedo)
    const pant = pt => p.evaluate(x => { const o = document.getElementById('fiEsqOv'), r = o.querySelector('.fi-esq-c').getBoundingClientRect(), s = o._prueba.pantalla(x); return [r.left + s[0], r.top + s[1]]; }, pt);
    let lupa = false;
    for(let i = 0; i < 4; i++){
      const desde = await pant(q[i]), hasta = await pant(REAL[i]);
      await p.mouse.move(desde[0], desde[1]); await p.mouse.down(); await p.mouse.move((desde[0] + hasta[0]) / 2, (desde[1] + hasta[1]) / 2, { steps: 4 });
      if(i === 0) lupa = await p.evaluate(() => !document.querySelector('#fiEsqOv .fi-esq-lupa').hidden);
      await p.mouse.move(hasta[0], hasta[1], { steps: 4 }); await p.mouse.up();
    }
    chk('2. Mientras se arrastra sale la lupa', lupa);
    chk('2. La lupa se esconde al soltar', await p.evaluate(() => document.querySelector('#fiEsqOv .fi-esq-lupa').hidden));
    q = await p.evaluate(() => document.getElementById('fiEsqOv')._prueba.esquinas());
    chk('2. Las 4 esquinas quedaron donde se soltaron (en la hoja)', err(q, REAL) < 12, { q, REAL });
    // Borde: arrastrar el punto del medio de arriba 30 px de pantalla hacia abajo y devolverlo
    const medio = await pant([(q[0][0] + q[1][0]) / 2, (q[0][1] + q[1][1]) / 2]);
    await p.mouse.move(medio[0], medio[1]); await p.mouse.down(); await p.mouse.move(medio[0], medio[1] + 30, { steps: 3 }); await p.mouse.up();
    const q2 = await p.evaluate(() => document.getElementById('fiEsqOv')._prueba.esquinas());
    chk('2. Arrastrar el borde de arriba mueve sus 2 esquinas juntas', q2[0][1] > q[0][1] + 20 && q2[1][1] > q[1][1] + 20 && Math.abs(q2[2][1] - q[2][1]) < 1, { q, q2 });
    await p.mouse.move(medio[0], medio[1] + 30); await p.mouse.down(); await p.mouse.move(medio[0], medio[1], { steps: 3 }); await p.mouse.up();
    // Esquinas cruzadas se ordenan solas
    q = await p.evaluate(() => document.getElementById('fiEsqOv')._prueba.esquinas());
    chk('2. Las esquinas quedan en orden (arriba-izq, arriba-der, abajo-der, abajo-izq)', q[0][0] < q[1][0] && q[3][0] < q[2][0] && q[0][1] < q[3][1] && q[1][1] < q[2][1], q);
    // 3. Detectar otra vez y girar
    await p.click('#fiEsqOv [data-e="auto"]');
    chk('3. «🔍 Detectar otra vez» vuelve a las esquinas de ORDEVA', err(await p.evaluate(() => document.getElementById('fiEsqOv')._prueba.esquinas()), det) < 1);
    await p.click('#fiEsqOv [data-e="girar"]'); await p.waitForTimeout(600);
    chk('3. «↻ Girar» gira la foto (ancho y alto cambian)', JSON.stringify(await p.evaluate(() => document.getElementById('fiEsqOv')._prueba.foto())) === JSON.stringify({ w: H, h: W }));
    await p.click('#fiEsqOv [data-e="no"]'); await p.waitForTimeout(200);
    chk('3. «Cancelar» deja la foto como estaba', await p.isVisible('#fiFotoOv.show') && !(await p.isVisible('#fiEsqOv.show')));
    // 4. Otra vez: «Toda la foto» (incluye la mesa) vs. esquinas puestas en la hoja
    await p.click('#fiFotoEsq'); await p.waitForFunction(() => document.getElementById('fiEsqOv').classList.contains('show'));
    await p.click('#fiEsqOv [data-e="todo"]'); await p.click('#fiEsqOv [data-e="ok"]');
    await p.waitForFunction(() => /Recortada con tus esquinas/.test(document.getElementById('fiFotoSub').textContent), null, { timeout: 15000 });
    const conMesa = await p.evaluate(async () => { const u = document.getElementById('fiFotoImg').src; const f = new File([await (await fetch(u)).blob()], 'x.jpg'); return window.__brillo(f, 0.01, 0.01); });
    await p.click('#fiFotoEsq'); await p.waitForFunction(() => document.getElementById('fiEsqOv').classList.contains('show'));
    await p.click('#fiEsqOv [data-e="todo"]');
    q = await p.evaluate(() => document.getElementById('fiEsqOv')._prueba.esquinas());
    for(let i = 0; i < 4; i++){ const d0 = await pant(q[i]), d1 = await pant(REAL[i]); await p.mouse.move(d0[0], d0[1]); await p.mouse.down(); await p.mouse.move(d1[0], d1[1], { steps: 6 }); await p.mouse.up(); }
    await p.click('#fiEsqOv [data-e="ok"]');
    await p.waitForFunction(() => /Recortada con tus esquinas/.test(document.getElementById('fiFotoSub').textContent), null, { timeout: 15000 }).catch(() => {});
    chk('4. «✅ Listo» → «Recortada con tus esquinas»', /Recortada con tus esquinas/.test(await p.textContent('#fiFotoSub')));
    const hoja = await p.evaluate(async () => { const u = document.getElementById('fiFotoImg').src; const f = new File([await (await fetch(u)).blob()], 'x.jpg'); return { esquina: await window.__brillo(f, 0.012, 0.012), titulo: await window.__brillo(f, 0.08, 0.075) }; });
    // La hoja mide 820 × 1080 (alto/ancho = 1,32); la foto entera 1600 × 1200 (0,75).
    chk('4. Con «Toda la foto» sale la foto entera (horizontal, con la mesa)', Math.abs(conMesa.h / conMesa.w - 0.75) < 0.03, conMesa);
    chk('4. Con tus esquinas sale SOLO la hoja: vertical y con la forma de la hoja (1,32)', Math.abs(hoja.esquina.h / hoja.esquina.w - PH / PW) < 0.04, hoja);
    // 5. Aplicar → el escaneo HD usa esas esquinas
    await p.click('#fiFotoOk');
    const res = await p.evaluate(async () => { const r = await window.__rev; return { tieneEsq: !!(r.original && r.original.__esquinas) }; });
    chk('5. La foto que se usa lleva tus esquinas', res.tieneEsq, res);
    await p.evaluate(async () => {
      const r = await window.__rev; window.showConfirm = async () => true;
      invoiceOpen({ supplier: 'Factura Esquinas SAS', items: [{ original: 'PRODUCTO 1', name: 'Producto Uno', qty: 12, unit_cost: 2000, line_total: 24000 }] });
      invoiceDraft.archivos = [r.original]; invoiceDraft.archivo = r.original;
      document.getElementById('invoiceApplyBtn').click();
    });
    await p.waitForFunction(() => { const x = (data.purchases || [])[0]; return x && (x.escaneos || []).length; }, null, { timeout: 30000 });
    const g = await p.evaluate(async () => { const e = data.purchases[0].escaneos[0]; const u = await window.ctReciboLeer(e.id), o = await window.ctReciboLeer(e.id + '-o'); const f = new File([await (await fetch(u)).blob()], 'x.jpg'); return { esq: e.esq, orig: !!o, b: await window.__brillo(f, 0.01, 0.01) }; });
    chk('5. El escaneo HD guardado está recortado con tus esquinas (forma de la hoja) y en HD', Math.abs(g.b.h / g.b.w - PH / PW) < 0.04 && Math.max(g.b.w, g.b.h) >= 1920, g.b);
    chk('5. Quedan guardadas las esquinas y la foto original (para corregir después)', g.orig && g.esq && g.esq.length === 4 && g.esq.every(x => x[0] >= 0 && x[0] <= 1), g);
    // 6. Corregir desde Facturas anteriores
    await p.evaluate(() => window.fiAbrirHistorialFacturas()); await p.click('#fiHistOv .fi-hrow'); await p.waitForSelector('#fiDetOv.show .fi-esq-btn');
    await p.click('#fiDetOv .fi-esq-btn');
    await p.waitForFunction(() => { const o = document.getElementById('fiEsqOv'); return o && o.classList.contains('show') && o._prueba.foto(); }, null, { timeout: 10000 });
    const q6 = await p.evaluate(() => { const o = document.getElementById('fiEsqOv'); return { q: o._prueba.esquinas(), f: o._prueba.foto() }; });
    const esc = (W2) => REAL.map(([x, y]) => [x * q6.f.w / W, y * q6.f.h / H]);
    chk('6. «✂️ Corregir el recorte» abre la original con las esquinas que se pusieron', err(q6.q, esc()) < 15, q6);
    await p.click('#fiEsqOv [data-e="todo"]'); await p.click('#fiEsqOv [data-e="ok"]');
    await p.waitForFunction(() => (data.purchases[0].escaneos[0] || {}).corregida, null, { timeout: 15000 }).catch(() => {});
    const g6 = await p.evaluate(async () => { const e = data.purchases[0].escaneos[0]; const u = await window.ctReciboLeer(e.id); const f = new File([await (await fetch(u)).blob()], 'x.jpg'); return { c: !!e.corregida, b: await window.__brillo(f, 0.01, 0.01), ocr: await window.ctReciboLeer(e.id + '-ocr') }; });
    chk('6. La página guardada se reemplazó con el recorte nuevo (toda la foto: horizontal)', g6.c && Math.abs(g6.b.h / g6.b.w - 0.75) < 0.03 && Math.max(g6.b.w, g6.b.h) >= 1920, g6);
    chk('6. … y el texto se vuelve a detectar (se borró el viejo)', !g6.ocr);
    chk('Sin desbordar la pantalla del celular', await p.evaluate(() => document.documentElement.scrollWidth <= 392));
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
