// ↻ Facturas que se giran solas (como CamScanner) y a mano.
//  1. Foto de la factura de lado (90° / 270°) o al revés (180°): el escaneo la deja derecha sola, con texto normal
//     (mayúsculas y minúsculas), solo MAYÚSCULAS y tirilla POS.
//  2. Foto derecha: no se gira.
//  3. «📷 Revisa la foto» avisa «Estaba al revés: la giré» y tiene «↻ Girar» (un cuarto de vuelta cada vez).
//  4. El escaneo HD que se guarda sale derecho, recuerda el giro y en «Facturas anteriores» se puede girar una página.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';

(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1500);
    await p.fill('#authBiz', 'Bar G'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1200);
    await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    await p.evaluate(() => {
      const TXT = {
        normal: ['Distribuidora La Esperanza S.A.S.', 'NIT 900.123.456-7  Factura de venta No. 4521', 'Fecha: 14/10/2026   Vendedor: Pedro Gómez', 'Cant  Descripción            Vr. Unit    Total', '24   Cerveza Poker lata 330 ml   2.500   60.000', '12   Gaseosa Coca-Cola 1.5 L     4.200   50.400', '6    Aguardiente Antioqueño     38.000  228.000', '30   Agua Cristal 600 ml         1.100   33.000', '10   Papas Margarita pollo       1.900   19.000', 'Subtotal                               390.400', 'IVA 19%                                 74.176', 'Total a pagar                          464.576'],
        mayus: ['DISTRIBUIDORA LA ESPERANZA S.A.S.', 'NIT 900.123.456-7 FACTURA DE VENTA No. 4521', 'FECHA: 14/10/2026 VENDEDOR: PEDRO GOMEZ', 'CANT DESCRIPCION VR. UNIT TOTAL', '24 CERVEZA POKER LATA 330ML 2.500 60.000', '12 GASEOSA COCA-COLA 1.5L 4.200 50.400', '6 AGUARDIENTE ANTIOQUEÑO 750 38.000 228.000', '30 AGUA CRISTAL 600ML 1.100 33.000', '10 PAPAS MARGARITA POLLO 1.900 19.000', 'SUBTOTAL 390.400', 'IVA 19% 74.176', 'TOTAL A PAGAR 464.576'],
        tirilla: ['SUPERTIENDA OLIMPICA', 'NIT 890.107.487-3', 'FACTURA POS 0012345', '1 POKER LATA X6       15.900', '2 LECHE ALQUERIA 1L    7.800', '1 PAN TAJADO BIMBO     6.450', '3 HUEVOS AA X30        42.000', 'TOTAL                  72.150', 'EFECTIVO               80.000', 'CAMBIO                  7.850']
      };
      // Foto: la hoja sobre una mesa oscura, un poco torcida (3°), girada «rot» grados.
      window.__foto = async (tipo, rot, nombre) => {
        const lin = TXT[tipo], PW = tipo === 'tirilla' ? 640 : 900, PH = tipo === 'tirilla' ? 1000 : 1150;   // la tirilla de cerca (como se le toma la foto)
        const hoja = document.createElement('canvas'); hoja.width = PW; hoja.height = PH; const hx = hoja.getContext('2d');
        hx.fillStyle = '#f3f0e8'; hx.fillRect(0, 0, PW, PH); hx.fillStyle = '#151515'; hx.font = (tipo === 'tirilla' ? '26px monospace' : '24px Arial');
        lin.forEach((l, i) => hx.fillText(l, 36, 80 + i * (tipo === 'tirilla' ? 60 : 42)));
        const W = 1600, H = 1600, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
        x.fillStyle = '#3a2b1d'; x.fillRect(0, 0, W, H); x.translate(W / 2, H / 2); x.rotate((rot + 3) * Math.PI / 180); x.drawImage(hoja, -PW / 2, -PH / 2);
        return new File([await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9))], nombre || 'factura.jpg', { type: 'image/jpeg' });
      };
      // ¿Hacia dónde está el texto de una imagen ya escaneada? (0 = derecha)
      window.__orient = async file => { const im = await fiCargarImagen(file), k = document.createElement('canvas'); k.width = im.width; k.height = im.height; const g = k.getContext('2d'); g.drawImage(im, 0, 0);
        const d = g.getImageData(0, 0, im.width, im.height).data, gr = new Uint8ClampedArray(im.width * im.height); for(let i = 0, q = 0; q < gr.length; i += 4, q++) gr[q] = d[i];
        const r = fiOrientacion(gr, im.width, im.height); return { giro: r.giro, seguro: r.seguro, w: im.width, h: im.height }; };
    });
    // 1 y 2. Cada tipo de factura en las 4 posiciones
    for(const tipo of ['normal', 'mayus', 'tirilla']){
      for(const rot of [0, 90, 180, 270]){
        const r = await p.evaluate(async ([tipo, rot]) => { const t0 = performance.now(); const m = await fiMejorarFoto(await window.__foto(tipo, rot)); const ms = performance.now() - t0; const o = await window.__orient(m.file); return { giro: m.giro, auto: m.giroAuto, o, ms: Math.round(ms) }; }, [tipo, rot]);
        const esperado = (360 - rot) % 360;
        if(rot === 0) chk('2. ' + tipo + ' derecha: no se gira y queda derecha', r.giro === 0 && r.o.giro === 0 && r.o.h > r.o.w, r);
        else chk('1. ' + tipo + ' girada ' + rot + '°: se gira ' + esperado + '° sola y el texto queda derecho (vertical)', r.giro === esperado && r.auto && r.o.giro === 0 && r.o.seguro && r.o.h > r.o.w, r);
      }
    }
    // 3. Revisión: al revés → aviso; «↻ Girar»
    await p.evaluate(async () => { window.__f180 = await window.__foto('normal', 180, 'alreves.jpg'); window.__rev = fiRevisarFoto(window.__f180, f => { window.__leida = f; }); });
    await p.waitForFunction(() => /la giré/.test(document.getElementById('fiFotoSub').textContent), null, { timeout: 20000 });
    chk('3. «Revisa la foto» avisa «Estaba al revés: la giré»', /Estaba al revés: la giré/.test(await p.textContent('#fiFotoSub')));
    chk('3. Tiene el botón «↻ Girar»', await p.isVisible('#fiFotoGirar'));
    const dimsDe = () => p.evaluate(async () => { const u = document.getElementById('fiFotoImg').src; const f = new File([await (await fetch(u)).blob()], 'x.jpg'); return window.__orient(f); });
    const d0 = await dimsDe();
    await p.click('#fiFotoGirar');
    await p.waitForFunction(() => /Girada/.test(document.getElementById('fiFotoSub').textContent), null, { timeout: 20000 });
    const d1 = await dimsDe();
    chk('3. «↻ Girar» da un cuarto de vuelta (ancho y alto cambian)', d1.w === d0.h && d1.h === d0.w, { d0, d1 });
    chk('3. El giro queda en la foto (90°+180° = 270°)', await p.evaluate(() => window.__f180.__giro === 270));
    chk('3. La foto girada se manda a leer otra vez', await p.evaluate(() => window.__leida && window.__leida.name !== 'alreves.jpg' && /mejorada/.test(window.__leida.name)));
    for(let i = 0; i < 3; i++){ await p.click('#fiFotoGirar'); await p.waitForFunction(() => !document.getElementById('fiFotoGirar').disabled, null, { timeout: 20000 }); }
    const d4 = await dimsDe();
    chk('3. Cuatro giros: vuelve a quedar derecha', d4.giro === 0 && d4.h > d4.w && await p.evaluate(() => window.__f180.__giro === 180), d4);
    await p.click('#fiFotoOk');
    const usada = await p.evaluate(async () => { const r = await window.__rev; return { orig: r.original.__giro, o: await window.__orient(r.usar) }; });
    chk('3. «Usar esta foto» entrega la foto derecha', usada.o.giro === 0 && usada.o.h > usada.o.w, usada);
    // 4. Escaneo HD guardado: derecho y con su giro; girar una página guardada
    const g = await p.evaluate(async () => {
      const f = await window.__foto('mayus', 90, 'lado.jpg');
      const pags = await fiGuardarEscaneos([f], 'fact-giro');
      const url = await window.ctReciboLeer(pags[0].id), hd = await fiDataUrlAFile(url, 'hd.jpg');
      const o = await window.__orient(hd), pag = Object.assign({}, pags[0]);
      const compra = { id: 'c-giro', escaneos: pags, items: [] }; data.purchases = (data.purchases || []).concat([compra]);
      const ok = await fiGirarEscaneo(compra, 0, () => {});
      const hd2 = await fiDataUrlAFile(await window.ctReciboLeer(pags[0].id), 'hd2.jpg'), o2 = await window.__orient(hd2);
      return { pag, o, ok, o2, e: compra.escaneos[0] };
    });
    chk('4. El escaneo HD de una foto de lado se guarda derecho y en Full HD', g.o.giro === 0 && g.o.seguro && g.o.h >= 1920 && g.o.h > g.o.w, g);
    chk('4. La página guardada recuerda el giro (270°)', g.pag.giro === 270, g.pag);
    chk('4. «↻ Girar la página» la gira un cuarto de vuelta y la guarda', g.ok && g.o2.w === g.o.h && g.o2.h === g.o.w && g.e.giro === 0 && g.e.w === g.o2.w, g);
    // Botón en Facturas anteriores
    const btn = await p.evaluate(() => { const c = (data.purchases || []).find(x => x.id === 'c-giro'); c.supplier = 'Prueba giro'; c.at = Date.now(); saveData(); return !!c; });
    await p.evaluate(() => window.fiAbrirHistorialFacturas());
    await p.waitForSelector('#fiHistOv.show .fi-hrow[data-id="c-giro"]', { timeout: 8000 }).catch(() => {});
    if(await p.$('#fiHistOv.show .fi-hrow[data-id="c-giro"]')){
      await p.click('#fiHistOv.show .fi-hrow[data-id="c-giro"]');
      await p.waitForSelector('#fiDetOv.show .fi-girar-btn', { timeout: 8000 }).catch(() => {});
      chk('4. «📚 Facturas anteriores» tiene «↻ Girar la página»', btn && await p.isVisible('#fiDetOv.show .fi-girar-btn'));
    } else chk('4. «📚 Facturas anteriores» tiene «↻ Girar la página»', false, 'no apareció la factura en la lista');
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ Error: ' + (e && e.stack || e)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
