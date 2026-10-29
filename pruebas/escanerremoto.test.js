// 📱 Escanear con otro celular (ORDEVA 1.65.0), de punta a punta: la CAJA (index.html) muestra el QR y el CELULAR
// (escaner.html, sin iniciar sesión) manda lo que lee por el canal en vivo. El canal se simula aquí igual que el de
// verdad (canal_publicar / canal_leer), con fallas de señal a propósito.
//  1. El QR lleva a escaner.html con un canal privado y nuevo.
//  2. 🛒 Vender con una cuenta abierta: cada lectura llega a la cuenta en segundos, con su nombre de vuelta en el celular.
//  3. Diez lecturas seguidas: llegan TODAS, en orden (antes «solo detectó uno y después no mandaba más»).
//  4. Sin señal un rato: el celular reintenta solo y no se pierde ninguna.
//  5. 📥 Llegó mercancía (producto conocido): pregunta cuántas llegaron y el costo, suma al inventario y al kárdex.
//  6. 📥 Código nuevo: la ficha sale LLENA con lo que dicen las bases de productos; con el precio se crea con su código.
//  7. Código que nadie conoce: la ficha pide escribirlo (y el celular avisa); no se inventa nada.
//  8. Sin cuenta abierta, lo vendido va a la caja.  9. «Terminar»: el celular se entera.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  // ---------- El canal en vivo, simulado ----------
  const msgs = []; let fallar = 0;
  const OFF = { '7701234000011': { product_name: 'Arroz Roa 500 g', brands: 'Roa', quantity: '500 g' } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', async r => {
      const u = new URL(r.request().url());
      if(u.hostname === 'localhost') return r.continue();
      if(/\/rest\/v1\/rpc\/canal_publicar$/.test(u.pathname)){
        if(fallar > 0){ fallar--; return r.abort('internetdisconnected'); }
        const a = JSON.parse(r.request().postData() || '{}');
        const m = { id: String(msgs.length + 1), time: Math.floor(Date.now() / 1000), event: 'message', topic: a.p_canal, message: a.p_cuerpo };
        msgs.push(m); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(m) });
      }
      if(/\/rest\/v1\/rpc\/canal_leer$/.test(u.pathname)){
        const a = JSON.parse(r.request().postData() || '{}');
        const l = msgs.filter(m => (a.p_canales || []).includes(m.topic) && (a.p_desde_id == null || +m.id > +a.p_desde_id) && (a.p_desde == null || m.time >= a.p_desde));
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(l) });
      }
      const off = /open(food|products|beauty)facts\.org$/.test(u.hostname) && u.pathname.match(/product\/(\d+)\.json/);
      if(off){ const p = u.hostname.startsWith('world.openfoodfacts') && OFF[off[1]]; return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(p ? { status: 1, product: p } : { status: 0 }) }); }
      return r.abort();
    });
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const caja = await ctx.newPage(); caja.on('pageerror', e => errs.push('caja: ' + e.message));
    await caja.goto(BASE + '/index.html'); await caja.waitForTimeout(1000);
    await caja.evaluate(() => { const s = document.getElementById('authType'); if(s){ s.value = 'tienda'; s.dispatchEvent(new Event('change')); } });
    await caja.fill('#authBiz', 'Tienda Escáner'); await caja.fill('#authUser', 'ana'); await caja.fill('#authPass', 'clave123'); await caja.click('#authBtn');
    await caja.waitForFunction(() => document.getElementById('authOverlay').hidden, null, { timeout: 15000 });
    await caja.click('#onbSaltar', { timeout: 4000 }).catch(() => {});
    await caja.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    await caja.waitForFunction(() => !!window.ventoEscaner && !!window.ventoCodigos, null, { timeout: 10000 });
    await caja.evaluate(() => { data.products.push({ id: 'p-gas', name: 'Gaseosa Colombiana 400 ml', price: 3000, cost: 1800, stock: 20, barcodes: ['7702004003508'], codigo: '7702004003508' }); saveData(); });

    // ===== 1. El QR =====
    await caja.evaluate(() => { openTableModal(1); window.ventoEscaner.abrir('vender'); });
    const s1 = await caja.evaluate(() => ({ s: window.ventoEscaner.sesion(), qr: !!document.querySelector('#escQR canvas, #escQR img'), boton: !!document.querySelector('#scanOverlay [data-esc-remoto]') }));
    chk('1. «📱 Escanear con otro celular» muestra el QR hacia escaner.html con un canal privado y nuevo', s1.qr && /escaner\.html#c=esc-[a-z0-9]{20,}&m=vender/.test(s1.s.link), s1);
    chk('1. El botón está también en la ventana del escáner de siempre', s1.boton);
    await caja.evaluate(() => { document.getElementById('escRemOv').classList.remove('show'); openTableModal(1); });
    const cel = await ctx.newPage(); cel.on('pageerror', e => errs.push('celular: ' + e.message));
    await cel.goto(s1.s.link.replace(/^https?:\/\/[^/]+/, BASE));
    await cel.waitForFunction(() => !!window.ventoEscaner && !!window.ventoEscaner.mandarCodigo, null, { timeout: 8000 });

    // ===== 2. Vender con la cuenta abierta =====
    const t0 = Date.now();
    await cel.evaluate(() => window.ventoEscaner.mandarCodigo('7702004003508'));
    const llego = await caja.waitForFunction(() => ((data.tables[1].items || []).find(i => i.productId === 'p-gas') || {}).qty === 1, null, { timeout: 9000 }).then(() => true, () => false);
    const ms = Date.now() - t0;
    console.log('   ⏱  del celular a la cuenta: ' + ms + ' ms (el escáner revisa cada 0,8 s; con Realtime es al instante)');
    chk('2. Lo que lee el celular llega a la cuenta abierta en segundos', llego && ms < 7000, ms);
    const ack = await cel.waitForFunction(() => /Gaseosa Colombiana/.test(document.getElementById('lista').innerText), null, { timeout: 9000 }).then(() => true, () => false);
    chk('2. El celular muestra el nombre del producto y dónde quedó (✅)', ack, await cel.evaluate(() => document.getElementById('lista').innerText));

    // ===== 3. Diez seguidas =====
    await cel.evaluate(() => { for(let i = 0; i < 10; i++) window.ventoEscaner.mandarCodigo('7702004003508'); });
    const diez = await caja.waitForFunction(() => ((data.tables[1].items || []).find(i => i.productId === 'p-gas') || {}).qty === 11, null, { timeout: 15000 }).then(() => true, () => false);
    chk('3. Diez lecturas seguidas: llegan TODAS (la cuenta queda con 11)', diez, await caja.evaluate(() => (data.tables[1].items || []).map(i => i.name + '×' + i.qty)));

    // ===== 4. Sin señal un rato =====
    fallar = 3;
    await cel.evaluate(() => { window.ventoEscaner.mandarCodigo('7702004003508'); window.ventoEscaner.mandarCodigo('7702004003508'); });
    const sinSenal = await caja.waitForFunction(() => ((data.tables[1].items || []).find(i => i.productId === 'p-gas') || {}).qty === 13, null, { timeout: 20000 }).then(() => true, () => false);
    chk('4. Sin señal: el celular reintenta solo y no se pierde ninguna (13)', sinSenal && fallar === 0, { fallar, items: await caja.evaluate(() => (data.tables[1].items || []).map(i => i.qty)) });

    // ===== 5. Llegó mercancía (producto conocido) =====
    await caja.evaluate(() => { try{ closeModal(); }catch(e){} document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); });
    await cel.evaluate(() => { document.querySelector('[data-m="inventario"]').click(); window.ventoEscaner.mandarCodigo('7702004003508'); });
    const preg = await caja.waitForSelector('#escLlegoOv.show', { timeout: 9000 }).then(() => true, () => false);
    chk('5. Llegó mercancía: la caja pregunta cuántas llegaron', preg);
    const stockAntes = await caja.evaluate(() => data.products.find(p => p.id === 'p-gas').stock);
    await caja.fill('#escN', '24'); await caja.fill('#escC', '1900'); await caja.click('#escLlegoOv [data-ok]');
    const r5 = await caja.evaluate(() => { const p = data.products.find(x => x.id === 'p-gas'); return { stock: p.stock, cost: p.cost, kardex: (data.kardex || []).filter(k => k.p === 'p-gas' && k.tipo === 'entrada').map(k => k.q) }; });
    chk('5. Suma 24 al inventario, actualiza el costo y queda en el kárdex', r5.stock === stockAntes + 24 && r5.cost === 1900 && r5.kardex.includes(24), { antes: stockAntes, r5 });
    const ack5 = await cel.waitForFunction(() => /\+24/.test(document.getElementById('lista').innerText), null, { timeout: 9000 }).then(() => true, () => false);
    chk('5. El celular ve «+24 · ahora hay…»', ack5);

    // ===== 6. Código nuevo: la ficha sale llena =====
    await cel.evaluate(() => window.ventoEscaner.mandarCodigo('7701234000011'));
    await caja.waitForSelector('#escFichaOv.show', { timeout: 9000 });
    const llena = await caja.waitForFunction(() => /Arroz Roa/.test(document.getElementById('escNom').value), null, { timeout: 9000 }).then(() => true, () => false);
    const f6 = await caja.evaluate(() => ({ nom: document.getElementById('escNom').value, tam: document.getElementById('escTam').value, est: document.getElementById('escEst').textContent, sub: document.querySelector('#escFichaOv .modal-sub').textContent, can: document.getElementById('escCan').value, pre: document.getElementById('escPre').value }));
    chk('6. Código nuevo: la ficha sale LLENA (nombre y tamaño) y dice de dónde salió', llena && f6.tam === '500 g' && /Open Food Facts/.test(f6.est), f6);
    chk('6. … reconoce que es colombiano (770…) y no inventa el precio', /colombiano/.test(f6.sub) && f6.pre === '', f6);
    const avisoCel = await cel.waitForFunction(() => /Producto nuevo/.test(document.getElementById('lista').innerText), null, { timeout: 9000 }).then(() => true, () => false);
    chk('6. El celular avisa que es un producto nuevo', avisoCel);
    await caja.fill('#escPre', '3500'); await caja.fill('#escCos', '2600'); await caja.fill('#escCan', '12');
    await caja.click('#escFichaOv [data-ok]');
    const p6 = await caja.evaluate(() => data.products.find(p => (p.barcodes || []).includes('7701234000011')));
    chk('6. Al guardar queda creado con su código, precio, costo y las 12 que llegaron', p6 && p6.name === 'Arroz Roa 500 g' && p6.price === 3500 && p6.cost === 2600 && p6.stock === 12, p6);
    const otraVez = await caja.evaluate(() => !!(window.ventoInventario.buscar('7701234000011')));
    chk('6. Desde ahí ese código se reconoce solo', otraVez);

    // ===== 7. Código que nadie conoce =====
    await cel.evaluate(() => window.ventoEscaner.mandarCodigo('7709999999990'));
    await caja.waitForSelector('#escFichaOv.show', { timeout: 9000 });
    const est7 = await caja.waitForFunction(() => /escribe el nombre|Escríbelo|escríbelo/.test(document.getElementById('escEst').textContent), null, { timeout: 9000 }).then(() => caja.evaluate(() => ({ est: document.getElementById('escEst').textContent, nom: document.getElementById('escNom').value })), () => null);
    chk('7. Código que nadie conoce: pide escribirlo y no inventa nada', est7 && est7.nom === '', est7);
    await caja.click('#escFichaOv [data-x]');

    // ===== 8. Sin cuenta abierta: a la caja =====
    await cel.evaluate(() => { document.querySelector('[data-m="vender"]').click(); window.ventoEscaner.mandarCodigo('7702004003508'); });
    const aCaja = await caja.waitForFunction(() => (window.ventoPOS.carrito() || []).some(l => (l.p ? l.p.id : l.id || l.productId) === 'p-gas' || /Gaseosa/.test(JSON.stringify(l))), null, { timeout: 9000 }).then(() => true, () => false);
    chk('8. Sin una cuenta abierta, lo vendido va a la caja', aCaja, await caja.evaluate(() => window.ventoPOS.carrito()));

    // ===== 9. Terminar =====
    await caja.evaluate(() => window.ventoEscaner.terminar());
    const fin = await cel.waitForFunction(() => /terminó/.test(document.getElementById('est').textContent), null, { timeout: 9000 }).then(() => true, () => false);
    chk('9. «Terminar» en la caja: el celular se entera', fin && await caja.evaluate(() => !window.ventoEscaner.sesion() && !document.getElementById('escRemPill')));

    // ===== El link sin canal =====
    const mal2 = await ctx.newPage(); await mal2.goto(BASE + '/escaner.html');
    chk('Un link sin el canal de la caja explica cómo abrirlo', await mal2.evaluate(() => !document.getElementById('malLink').hidden));
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ Error: ' + (e && e.stack || e)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
