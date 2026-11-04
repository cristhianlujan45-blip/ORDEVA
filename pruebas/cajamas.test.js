// 🧾 ORDEVA 1.80.0 · Caja POS con lo de las cajas profesionales (lib/vento-caja-mas.js). Sin internet.
//  1. Teclas rápidas: «🛍️ Bolsa $200» de un toque; «📱 Recarga» con el valor escrito antes en el teclado o preguntándolo.
//  2. Clientes: crear uno mayorista; el precio mayorista del producto y el % del cliente bajan el precio en la venta.
//  3. Cotización: se guarda (COT-0001), la caja queda libre; WhatsApp/PDF con el total; «Pasar a venta» con los precios
//     cotizados aunque el producto haya subido; al cobrarla queda «Vendida».
//  4. Puntos: al cobrar con cliente gana 1 por cada $1.000; con 100 o más se canjean como descuento.
//  5. Devolución desde la caja con 💳 saldo a favor; en la siguiente compra el saldo paga (medio «saldo», no descuento).
//  6. Corte X (no cierra la caja) y 🔁 cambio de turno (arqueo; la caja sigue con el que llega y su base es lo contado).
//  7. IVA por tarifa en el recibo: 19 %, 5 % y exento por separado.
//  8. 📺 Pantalla del cliente en otra ventana: lo que se registra, el total y «¡Gracias!».
//  9. 1.81.0: 🔒 vender sin existencias pide confirmar (dueño) / la clave (equipo), si se prendió en Ajustes.
// 10. 🎉 Promoción por horario (hora feliz): el precio baja sola en esa hora y se ve en la venta.
// 11. 💳 Datáfono: con tarjeta espera el aviso del pago por ese valor y la venta se cobra sola.
// 12. 🧾 Recibos de cualquier día desde la caja.
// 13. 🔒 Cierre Z numerado con TODOS los medios (Nequi, tarjeta…) y el Excel de cierres del mes.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';

(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  const pausa = ms => new Promise(r => setTimeout(r, ms));
  try{
    const ctx = await b.newContext({ viewport: { width: 1366, height: 820 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await pausa(1100);
    await p.fill('#authBiz', 'Tienda Completa'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await pausa(1400);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await p.evaluate(() => {
      document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.products = [{ id: 'a', name: 'Arroz', price: 5000, stock: 50, precioMayor: 4200 }, { id: 'c', name: 'Cerveza', price: 3000, stock: 50 }, { id: 'l', name: 'Leche', price: 4000, stock: 50 }];
      data.history = []; data.clientesFrecuentes = []; data.cotizaciones = []; data.teclasCaja = [];
      saveData(); window.ventoPOS.vaciar();
    });
    await pausa(1200);
    await p.evaluate(() => window.ventoPOS.abrirCaja()); await pausa(500);
    const R = '#pzCajaOv .pz-caja-root';
    const lin = () => p.evaluate(() => window.ventoPOS.carrito().map(x => (x.libre ? x.name + ':' + x.price : x.id + ':' + x.price) + '×' + x.qty).join(','));
    const btn = async k => { await p.click(R + ' [data-cm="' + k + '"]'); await pausa(200); };

    // ===== 0. Botones =====
    let v = await p.evaluate(R => [...document.querySelectorAll(R + ' .pz-herr2 [data-cm]')].map(x => x.dataset.cm), R);
    chk('0. Con la venta vacía: «📄 Cotizaciones», «↩️ Devolución», «📺 Pantalla cliente» y «⚡ Teclas rápidas»', ['cotizaciones', 'devolucion', 'pantalla', 'teclas'].every(k => v.includes(k)), v);

    // ===== 1. Teclas rápidas =====
    await btn('teclas');
    await p.click('.cm-ov [data-s*="Recarga"]'); await p.click('.cm-ov [data-s*="Bolsa"]'); await pausa(100);
    await p.click('.cm-ov .cm-ok'); await pausa(300);
    v = await p.evaluate(R => [...document.querySelectorAll(R + ' .pz-teclas .pz-tecla[data-cm="tecla"]')].map(x => x.textContent.trim()), R);
    chk('1. Las teclas rápidas quedan en la caja («📱 Recarga», «🛍️ Bolsa $200»)', v.length === 2 && /Recarga/.test(v[0]) && /Bolsa/.test(v[1]) && /200/.test(v[1]), v);
    await p.click(R + ' .pz-tecla[data-i="1"]'); await pausa(150);
    await p.click(R + ' .pz-tec-k [data-tk="5"]'); await p.click(R + ' .pz-tec-k [data-tk="000"]'); await p.click(R + ' .pz-tecla[data-i="0"]'); await pausa(150);
    await p.click(R + ' .pz-tecla[data-i="0"]'); await pausa(200);
    await p.fill('.cm-ov .cm-tv', '3000'); await p.click('.cm-ov .cm-ok'); await pausa(200);
    v = await lin();
    chk('1. «Bolsa» de un toque; 5000 + «Recarga»; «Recarga» sola pregunta el valor (3000)', v === 'Bolsa:200×1,Recarga:5000×1,Recarga:3000×1', v);
    await p.evaluate(() => window.ventoPOS.vaciar());

    // ===== 2. Clientes con precios =====
    await p.evaluate(() => { window.ventoPOS.agregar('a', 2); window.ventoPOS.agregar('c', 1); }); await pausa(150);
    await btn('cliente');
    await p.fill('.cm-ov .cm-nn', 'Distribuidora Sol'); await p.fill('.cm-ov .cm-nt', '3001112233');
    await p.selectOption('.cm-ov .cm-nl', 'mayorista'); await p.fill('.cm-ov .cm-np', '10'); await p.click('.cm-ov .cm-ok'); await pausa(250);
    v = await p.evaluate(() => ({ l: window.ventoPOS.carrito().map(x => x.id + ':' + x.price), t: window.ventoPOS.resumen().total, cli: window.ventoPOS.meta().cli, c: data.clientesFrecuentes[0] }));
    chk('2. Cliente mayorista: Arroz a su precio mayorista ($4.200) y Cerveza 10 % menos ($2.700)', v.l.join() === 'a:4200,c:2700' && v.t === 4200 * 2 + 2700 && v.cli.tel === '3001112233' && v.c.lista === 'mayorista', v);

    // ===== 3. Cotización =====
    await btn('cotizar');
    v = await p.evaluate(() => ({ n: document.querySelector('.cm-ov .cm-cn').value, t: document.querySelector('.cm-ov .cm-ct').value }));
    chk('3. La cotización trae el cliente de la venta', v.n === 'Distribuidora Sol' && v.t === '3001112233', v);
    await p.fill('.cm-ov .cm-cno', 'Entrega el lunes'); await p.click('.cm-ov .cm-ok'); await pausa(300);
    v = await p.evaluate(() => { const q = data.cotizaciones[0]; return { n: q && q.n, total: q && q.total, l: q && q.lineas.length, cart: window.ventoPOS.carrito().length, titulo: (document.querySelector('.cm-ov h2') || {}).textContent, txt: window.ventoCajaMas.textoCot(q), html: window.ventoCajaMas.htmlCot(q) }; });
    chk('3. Se guarda COT-0001 ($11.100) y la caja queda libre', v.n === 1 && v.total === 11100 && v.l === 2 && v.cart === 0 && /COT-0001/.test(v.titulo), v);
    chk('3. WhatsApp y PDF con los productos, el TOTAL, la validez y la nota', /TOTAL: \$\s?11\.100/.test(v.txt) && /Válida hasta/.test(v.txt) && /Entrega el lunes/.test(v.txt) && /COTIZACIÓN/.test(v.html) && /Arroz/.test(v.html) && /no es una factura/.test(v.html), v.txt);
    await p.evaluate(() => { data.products.find(x => x.id === 'c').price = 3500; saveData(); });
    await p.click('.cm-ov [data-x="venta"]'); await pausa(300);
    v = await p.evaluate(() => ({ l: window.ventoPOS.carrito().map(x => x.id + ':' + x.price + '×' + x.qty), t: window.ventoPOS.resumen().total, m: window.ventoPOS.meta() }));
    chk('3. «Pasar a venta»: vuelve a la caja con los precios cotizados (Cerveza a $2.700 aunque ya vale $3.500)', v.l.join() === 'a:4200×2,c:2700×1' && v.t === 11100 && v.m.cot && /COT-0001/.test(v.m.nota), v);

    // ===== 4. Puntos =====
    const e1 = await p.evaluate(async () => { const en = await window.ventoPOS.cobrar({ pago: { method: 'efectivo', metodo: 'efectivo' } }); await new Promise(r => setTimeout(r, 100)); const c = data.clientesFrecuentes[0]; return { total: en.total, pts: c.puntos, vis: c.visitas, cot: data.cotizaciones[0].estado, cli: en.cliente }; });
    chk('3. Al cobrarla, la cotización queda «Vendida»', e1.cot === 'vendida', e1);
    chk('4. El cliente ganó 11 puntos ($11.100) y una visita; la venta dice de quién es', e1.pts === 11 && e1.vis === 1 && e1.cli && e1.cli.nombre === 'Distribuidora Sol', e1);
    await pausa(9800);
    await p.evaluate(() => { data.clientesFrecuentes[0].puntos = 150; saveData(); window.ventoPOS.agregar('l', 1); const m = window.ventoPOS.meta(); m.cli = { nombre: 'Distribuidora Sol', tel: '3001112233' }; window.ventoPOS.ponerMeta(m); }); await pausa(200);
    v = await p.evaluate(R => !!document.querySelector(R + ' [data-cm="puntos"]'), R);
    chk('4. Con 150 puntos sale «⭐ Canjear 150 pts»', v);
    await btn('puntos');
    v = await p.evaluate(() => ({ t: window.ventoPOS.resumen(), d: window.ventoPOS.meta().desc }));
    chk('4. Canjear: la Leche mayorista (−10 % → $3.600) queda en $2.100 (150 pts × $10)', v.d && v.d.puntos === 150 && v.t.total === 3600 - 1500, v);
    await p.evaluate(async () => { await window.ventoPOS.cobrar({ pago: { method: 'efectivo', metodo: 'efectivo' } }); });
    v = await p.evaluate(() => data.clientesFrecuentes[0].puntos);
    chk('4. Al cobrar se descuentan los 150 y gana los de esta compra (2)', v === 2, v);
    await pausa(9800);

    // ===== 5. Devolución con saldo a favor =====
    await btn('devolucion');
    v = await p.evaluate(() => document.querySelectorAll('.cm-ov .cm-it').length);
    chk('5. «↩️ Devolución» lista las ventas para buscar', v === 2, v);
    await p.fill('.cm-ov .cm-q', 'arroz'); await pausa(150);
    await p.click('.cm-ov .cm-it'); await pausa(300);
    await p.fill('[data-dv="0"]', '1'); await p.dispatchEvent('[data-dv="0"]', 'input');
    await p.check('#viDvSal'); await pausa(100);
    v = await p.evaluate(() => ({ ef: !!document.getElementById('viDvEf') && document.getElementById('viDvEf').checked, n: document.getElementById('viDvCn').value }));
    chk('5. «💳 Saldo a favor» quita «en efectivo» y trae el cliente de la venta', !v.ef && v.n === 'Distribuidora Sol', v);
    await p.click('#viDvOk'); await pausa(300);
    v = await p.evaluate(() => ({ saldo: data.clientesFrecuentes[0].saldo, stock: data.products.find(x => x.id === 'a').stock, hist: data.history[1].total }));
    chk('5. El cliente queda con $4.200 de saldo a favor; el Arroz vuelve al inventario y la venta baja', v.saldo === 4200 && v.stock === 49 && v.hist === 11100 - 4200, v);
    await p.evaluate(() => { window.ventoPOS.agregar('a', 2); const m = window.ventoPOS.meta(); m.cli = { nombre: 'Distribuidora Sol', tel: '3001112233' }; window.ventoPOS.ponerMeta(m); }); await pausa(200);
    await btn('saldo');
    const e5 = await p.evaluate(async () => { const en = await window.ventoPOS.cobrar({ pago: { method: 'efectivo', metodo: 'efectivo', nota: 'Efectivo' } }); return { total: en.total, pagos: en.payments.map(x => x.method + ':' + x.amount), saldo: data.clientesFrecuentes[0].saldo }; });
    chk('5. Siguiente compra ($8.400): $4.200 con el saldo a favor y $4.200 en efectivo; el saldo queda en $0', e5.total === 8400 && e5.pagos.join() === 'saldo:4200,efectivo:4200' && e5.saldo === 0, e5);
    await pausa(9800);

    // ===== 6. Corte X y cambio de turno =====
    await p.evaluate(() => { window.ventoTurno.abrir(50000); window.ventoPOS.agregar('c', 2); }); await pausa(200);
    await p.evaluate(async () => { await window.ventoPOS.cobrar({ pago: { method: 'efectivo', metodo: 'efectivo' } }); }); await pausa(200);
    await p.evaluate(() => { window.ventoPOS.agregar('l', 1); }); await p.evaluate(async () => { await window.ventoPOS.cobrar({ pago: { method: 'nequi', metodo: 'nequi', nota: 'Nequi' } }); }); await pausa(400);
    await p.evaluate(() => { const b = document.querySelector('#pzCajaOv [data-turno="corte"]'); b.click(); }); await pausa(300);
    v = await p.evaluate(() => ({ txt: document.querySelector('.cm-ov').innerText, abierta: !!(data.turno && data.turno.abierto_en) }));
    chk('6. «📄 Corte X»: 2 ventas desde que se abrió, por medio de pago y el efectivo que debe haber; NO cierra la caja', /Ventas\s*2/.test(v.txt) && /Efectivo/.test(v.txt) && /Nequi/.test(v.txt) && /Debe haber\s*\$\s?57\.000/.test(v.txt) && /No cierra la caja/.test(v.txt) && v.abierta, v.txt);
    await p.click('.cm-ov [data-x="turno"]'); await pausa(200);
    await p.fill('.cm-ov .cm-tn', 'pedro'); await p.click('.cm-ov .cm-ok'); await pausa(300);
    await p.fill('#vtTotal', '56000'); await p.click('.vt-ov [data-si]'); await pausa(400);
    v = await p.evaluate(() => ({ t: data.turno, h: data.turnosHist && data.turnosHist[0], txt: (document.querySelector('.cm-ov') || {}).innerText }));
    chk('6. Cambio de turno: queda el corte de ana (faltan $1.000) y la caja sigue abierta con pedro, base $56.000', v.t && v.t.por === 'pedro' && v.t.base === 56000 && v.h && v.h.de === 'ana' && v.h.diferencia === -1000 && /Turno entregado/.test(v.txt || ''), v);
    await p.evaluate(() => document.querySelectorAll('.cm-ov').forEach(o => o.remove()));

    // ===== 7. IVA por tarifa =====
    v = await p.evaluate(() => {
      data.products.push({ id: 'g', name: 'Gaseosa IVA', price: 1190, iva: 19 }, { id: 'h', name: 'Huevos', price: 1050, iva: 5 }, { id: 'x', name: 'Libro', price: 1000, ivaTipo: 'exento' });
      const its = [{ productId: 'g', name: 'Gaseosa IVA', qty: 1, price: 1190 }, { productId: 'h', name: 'Huevos', qty: 1, price: 1050 }, { productId: 'x', name: 'Libro', qty: 1, price: 1000 }];
      return { varias: ivaLineas(its, 3240, 19), una: ivaLineas([its[0]], 1190, 19) };
    });
    const t = Object.fromEntries(v.varias);
    chk('7. Recibo con varias tarifas: base e IVA del 19 % y del 5 %, y lo exento aparte', t['Base 19 %'] === 1000 && t['IVA 19 %'] === 190 && t['Base 5 %'] === 1000 && t['IVA 5 %'] === 50 && t['Exento (0 %)'] === 1000, v.varias);
    chk('7. Con una sola tarifa sale como siempre («Subtotal» e «IVA (19%)»)', v.una[0][0] === 'Subtotal' && v.una[1][0] === 'IVA (19%)' && v.una[1][1] === 190, v.una);

    // ===== 8. Pantalla del cliente =====
    await p.evaluate(() => window.ventoCajaMas.canalP(true));
    const pan = await ctx.newPage(); pan.on('pageerror', e => errs.push('pantalla: ' + e.message));
    await pan.goto(BASE + '/pantalla.html'); await pausa(600);
    await p.evaluate(() => { window.ventoPOS.agregar('a', 1); window.ventoPOS.agregar('l', 2); }); await pausa(1500);
    v = await pan.evaluate(() => ({ items: document.querySelectorAll('#lista .it').length, total: document.getElementById('total').textContent, neg: document.getElementById('neg').textContent }));
    chk('8. La pantalla del cliente muestra lo que se registra y el total ($13.000)', v.items === 2 && /13\.000/.test(v.total) && /Tienda Completa/.test(v.neg), v);
    await p.evaluate(async () => { await window.ventoPOS.cobrar({ pago: { method: 'efectivo', metodo: 'efectivo', recibido: 20000, vueltas: 7000 } }); }); await pausa(1500);
    v = await pan.evaluate(() => ({ g: !document.getElementById('gracias').hidden, vu: document.getElementById('graVu').textContent }));
    chk('8. Al cobrar: «¡Gracias por su compra!» con el cambio ($7.000)', v.g && /7\.000/.test(v.vu), v);
    await pan.close();
    await pausa(9500);

    // ===== 9. Sin existencias =====
    await p.evaluate(() => { data.cajaCfg = { claveAgotado: true }; data.products.push({ id: 'z', name: 'Atún', price: 6000, stock: 1 }); saveData(); window.ventoPOS.vaciar(); });
    await p.evaluate(() => { window.ventoPOS.agregar('z', 1); }); await pausa(200);
    await p.evaluate(() => { window.ventoPOS.agregar('z', 1); }); await pausa(300);
    v = await p.evaluate(() => ({ conf: document.getElementById('confirmOverlay') && document.getElementById('confirmOverlay').classList.contains('show') && document.getElementById('confirmOverlay').innerText, l: window.ventoPOS.carrito().map(x => x.id + '×' + x.qty).join() }));
    chk('9. El 2.º Atún (solo queda 1): pregunta «Sin existencias» y todavía no lo suma', /existencias/i.test(v.conf || '') && v.l === 'z×1', v);
    await p.click('#confirmOkBtn'); await pausa(300);
    v = await p.evaluate(() => window.ventoPOS.carrito().map(x => x.id + '×' + x.qty).join());
    chk('9. Con «Sí, vender» se suma', v === 'z×2', v);
    await p.evaluate(() => { data.cajaCfg = {}; saveData(); window.ventoPOS.vaciar(); });

    // ===== 10. Hora feliz =====
    await p.evaluate(() => { const h = new Date(), a = new Date(h.getTime() - 36e5), b = new Date(h.getTime() + 36e5), hm = d => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      data.categories = [{ id: 'cv', name: 'Cervezas' }]; data.products.find(x => x.id === 'c').categoryId = 'cv';
      data.promosHora = [{ n: 'Hora feliz', desde: hm(a), hasta: hm(b) > hm(a) ? hm(b) : '23:59', pct: 20, dias: [], cats: ['cv'], on: true }]; saveData();
      window.ventoPOS.agregar('c', 1); window.ventoPOS.agregar('l', 1); }); await pausa(300);
    v = await p.evaluate(R => ({ l: window.ventoPOS.carrito().map(x => x.id + ':' + x.price).join(), chip: (document.querySelector(R + ' .cm-promo-v') || {}).textContent || '' }), R);
    chk('10. Hora feliz −20 % en Cervezas: la cerveza baja ($3.500 → $2.800), la leche no; y se ve en la venta', v.l === 'c:2800,l:4000' && /Hora feliz/.test(v.chip) && /20 %/.test(v.chip), v);
    await p.evaluate(() => { data.promosHora = []; saveData(); });

    // ===== 11. Datáfono =====
    await p.evaluate(() => { data.cajaCfg = { datafono: true }; saveData(); window.ventoPOS.vaciar(); window.ventoPOS.agregar('l', 2); window.__cob = window.ventoPOS.cobrar(); }); await pausa(500);
    await p.click('.pz-pago-ov .pz-met[data-m="tarjeta"]'); await pausa(300);
    v = await p.evaluate(() => ({ df: !!document.getElementById('pzDfOv'), txt: (document.getElementById('pzDfOv') || {}).innerText || '', n: data.history.length }));
    chk('11. Con tarjeta: «Pase la tarjeta en el datáfono por $8.000» y espera (todavía no se cobra)', v.df && /8\.000/.test(v.txt) && /Esperando/.test(v.txt), v);
    const n11 = v.n;
    await p.evaluate(() => { window.pagoLlego && window.pagoLlego({ monto: 8000, metodo: 'BOLD', estado: 'ok' }); }); await pausa(1800);
    v = await p.evaluate(n => { const h = data.history[0]; return { n: data.history.length, pago: h && h.payments.map(x => x.method + ':' + x.note + ':' + x.amount), df: !!document.getElementById('pzDfOv') }; }, n11);
    chk('11. Llega el aviso de Bold por $8.000: la venta se cobra sola como «Tarjeta»', v.n === n11 + 1 && /Tarjeta/.test(v.pago.join()) && !v.df, v);
    await p.evaluate(() => { data.cajaCfg = {}; saveData(); });
    await pausa(9500);

    // ===== 12. Recibos =====
    await p.evaluate(() => { const h = data.history[data.history.length - 1]; h.date = new Date(Date.now() - 5 * 864e5).toISOString(); saveData(); window.ventoPOS.ponerMeta(window.ventoPOS.meta()); }); await pausa(200);
    await btn('recibos');
    v = await p.evaluate(() => document.querySelectorAll('.cm-ov .cm-it').length);
    const nh = await p.evaluate(() => data.history.length);
    chk('12. «🧾 Recibos» lista las ventas de todos los días (también la de hace 5 días)', v === nh, { v, nh });
    await p.evaluate(() => document.querySelectorAll('.cm-ov').forEach(o => o.remove()));

    // ===== 13. Cierre Z =====
    await p.evaluate(() => { window.ventoPOS.agregar('a', 1); }); await p.evaluate(async () => { await window.ventoPOS.cobrar({ pago: { method: 'transferencia', metodo: 'nequi', nota: 'Nequi' } }); }); await pausa(300);
    await p.evaluate(async () => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); await closeCashRegister({ auto: true }); }); await pausa(600);
    v = await p.evaluate(() => { const c = data.closures[0]; return { z: c.z, medios: c.medios, txt: buildClosureText(c), csv: window.ventoCajaMas.cierresCsv(0, Date.now() + 864e5).csv }; });
    chk('13. Cierre Z N.º 0001 con cada medio aparte (Efectivo, Nequi, Tarjeta, Saldo a favor)', v.z === 1 && v.medios.nequi > 0 && v.medios.tarjeta === 8000 && v.medios.efectivo > 0 && v.medios.saldo === 4200 && /Cierre Z N\.º 0001/.test(v.txt) && /Nequi/.test(v.txt) && /Tarjeta/.test(v.txt), v);
    chk('13. El Excel de cierres trae el número, las columnas de cada medio y el arqueo', /"Cierre Z"/.test(v.csv) && /"0001"/.test(v.csv) && /"Nequi"/.test(v.csv) && /"Tarjeta"/.test(v.csv) && /Efectivo contado/.test(v.csv), v.csv.slice(0, 400));
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
