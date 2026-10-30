// Facturas: categoría y código de cada producto, y facturas guardadas escaneadas en HD (como CamScanner) para descargar.
//  1. En la revisión cada producto trae su categoría sugerida (Cervezas, Gaseosas…) y se puede cambiar una por una,
//     crear una nueva («➕ Nueva categoría…») o poner la misma a todos; cada uno lleva su código (escrito o escaneado).
//  2. Al aplicar: cada producto queda en SU categoría y con su código (se reconoce al escanearlo para vender, sale en
//     «Editar producto» y en el buscador).
//  3. Escáner: una foto torcida (hoja girada sobre una mesa) sale recortada, enderezada y en Full HD (lado ≥ 1920 px);
//     si la hoja ocupa toda la foto pero el texto está inclinado, el texto se alinea.
//  4. Se guardan TODAS las páginas (2 fotos → 2 páginas escaneadas).
//  5. «📚 Facturas anteriores» → «📄 Descargar escaneada»: PDF válido con las páginas en HD, el texto detectado (se puede
//     buscar) y la hoja de datos (con categoría y código). «🖼️ Imagen HD»: JPG de 1920 px o más.
//  6. Una factura guardada ANTES (solo con la foto original) también se descarga mejorada en HD.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const { execFileSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';

(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 900) : '')); } };
  const tmp = process.env.VENTO_PDF_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'vento-fs-'));
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1500);
    await p.fill('#authBiz', 'Bar S'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1200);
    await p.evaluate(() => {
      document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.categories = [{ id: 'c-cer', name: 'Cervezas' }, { id: 'c-gas', name: 'Gaseosas' }, { id: 'c-lic', name: 'Licores' }];
      data.products = [{ id: 'pk', name: 'Cerveza Póker lata', price: 3500, cost: 2500, stock: 10, categoryId: 'c-cer' }];
      saveData();
      // Foto de prueba: hoja blanca con renglones de factura, girada «ang» grados sobre una mesa oscura (o llenando toda la foto).
      window.__foto = async (ang, llena, titulo) => {
        const W = 1600, H = 1200, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
        x.fillStyle = llena ? '#fff' : '#3b2a1c'; x.fillRect(0, 0, W, H);
        x.save(); x.translate(W / 2, H / 2); x.rotate(ang * Math.PI / 180);
        const pw = llena ? 1500 : 820, ph = llena ? 1100 : 1080;
        if(!llena){ x.fillStyle = '#f4f1ea'; x.fillRect(-pw / 2, -ph / 2, pw, ph); }
        x.fillStyle = '#111'; x.font = 'bold 34px Arial'; x.fillText(titulo || 'DISTRIBUIDORA PRUEBA SAS', -pw / 2 + 40, -ph / 2 + 70);
        x.font = '26px Arial';
        const rs = ['CERVEZA AGUILA LATA 330 ML   24   60.000', 'GASEOSA COCA COLA 400 ML   12   18.000', 'AGUARDIENTE ANTIOQUENO 750   6   210.000', 'PAPAS MARGARITA POLLO 25G   10   15.000', 'AGUA CRISTAL 600 ML   24   21.600', 'SUBTOTAL   324.600', 'IVA   61.674', 'TOTAL A PAGAR   386.274'];
        rs.forEach((t, i) => x.fillText(t, -pw / 2 + 40, -ph / 2 + 150 + i * 62));
        x.restore();
        const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92));
        return new File([blob], 'factura.jpg', { type: 'image/jpeg' });
      };
      window.__dims = f => new Promise(res => { const im = new Image(); im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight }); im.src = URL.createObjectURL(f); });
    });

    // ---------- 1. Revisión: categoría y código por producto ----------
    await p.evaluate(() => invoiceOpen({ supplier: 'Distribuidora Prueba', items: [
      { original: 'CERVEZA AGUILA LATA 330', name: 'Cerveza Águila lata', qty: 24, unit_cost: 2500, line_total: 60000, barcode: '7702004003508' },
      { original: 'GASEOSA COCA COLA 400', name: 'Gaseosa Coca Cola 400 ml', qty: 12, unit_cost: 1500, line_total: 18000 },
      { original: 'AGUARDIENTE ANTIOQUENO 750', name: 'Aguardiente Antioqueño 750', qty: 6, unit_cost: 35000, line_total: 210000 },
      { original: 'PAPAS MARGARITA POLLO 25G', name: 'Papas Margarita pollo', qty: 10, unit_cost: 1500, line_total: 15000 }
    ] }));
    await p.waitForSelector('#invoiceBody .iv-item');
    const sug = await p.evaluate(() => [...document.querySelectorAll('#invoiceBody .iv-item')].map(r => ({ cat: r.querySelector('.iv-cat').value, cod: r.querySelector('.iv-code').value })));
    chk('1. Categoría sugerida por producto: Águila → Cervezas, Coca Cola → Gaseosas, Aguardiente → Licores, Papas → «🆕 Snacks» (1.66.1: se propone nueva si no existe)', sug[0].cat === 'c-cer' && sug[1].cat === 'c-gas' && sug[2].cat === 'c-lic' && sug[3].cat === 'nueva:Snacks', sug);
    chk('1. El código de barras que trae la factura ya aparece en «Código»', sug[0].cod === '7702004003508', sug);
    chk('1. Cada producto tiene su selector de categoría (con «➕ Nueva categoría…») y su botón 📷 para escanear el código', await p.evaluate(() => [...document.querySelectorAll('#invoiceBody .iv-item')].every(r => r.querySelector('.iv-cat option[value="__nueva"]') && r.querySelector('.iv-code-scan'))));
    // «Poner a todos la categoría» y luego cambiar uno por uno
    await p.selectOption('#ivCatTodosSel', 'c-cer'); await p.click('#ivCatTodosBtn');
    let cats = await p.evaluate(() => invoiceDraft.items.map(i => i.categoryId));
    chk('1. «Poner a todos la categoría» → todos en Cervezas', cats.every(c => c === 'c-cer'), cats);
    await p.selectOption('#invoiceBody .iv-item[data-i="1"] .iv-cat', 'c-gas');
    await p.selectOption('#invoiceBody .iv-item[data-i="2"] .iv-cat', 'c-lic');
    // Crear una categoría nueva desde un renglón
    await p.selectOption('#invoiceBody .iv-item[data-i="3"] .iv-cat', '__nueva');
    chk('1. «➕ Nueva categoría…» abre el cuadro para escribirla', await p.isVisible('#invoiceBody .iv-item[data-i="3"] .iv-catnew'));
    await p.fill('#invoiceBody .iv-item[data-i="3"] .iv-catnew-in', 'Mecato'); await p.click('#invoiceBody .iv-item[data-i="3"] .iv-catnew-ok');
    const mec = await p.evaluate(() => (data.categories.find(c => c.name === 'Mecato') || {}).id);
    cats = await p.evaluate(() => invoiceDraft.items.map(i => i.categoryId));
    chk('1. Cada producto en una categoría DIFERENTE (Cervezas, Gaseosas, Licores y la nueva «Mecato»)', mec && cats[0] === 'c-cer' && cats[1] === 'c-gas' && cats[2] === 'c-lic' && cats[3] === mec, { cats, mec });
    // Códigos: escrito a mano y «escaneado» con la cámara (el lector se simula)
    await p.fill('#invoiceBody .iv-item[data-i="1"] .iv-code', 'GAS-400');
    await p.evaluate(() => { window.openScanOverlay = (cb) => setTimeout(() => cb('7702535011119'), 50); window.closeScanOverlay = () => {}; });
    await p.click('#invoiceBody .iv-item[data-i="2"] .iv-code-scan'); await p.waitForTimeout(200);
    const cods = await p.evaluate(() => [...document.querySelectorAll('#invoiceBody .iv-item .iv-code')].map(i => i.value));
    chk('1. Código escrito a mano (GAS-400) y escaneado con la cámara (7702535011119)', cods[1] === 'GAS-400' && cods[2] === '7702535011119', cods);
    // Cambiar algo de la cantidad no borra la categoría ni el código
    await p.click('#invoiceBody .iv-item[data-i="1"] .iv-qty', { clickCount: 3 }); await p.keyboard.type('12');
    cats = await p.evaluate(() => invoiceDraft.items.map(i => [i.categoryId, i.codigo]));
    chk('1. Editar la cantidad no cambia la categoría ni el código elegidos', cats[1][0] === 'c-gas' && cats[1][1] === 'GAS-400', cats);

    // ---------- 2. Aplicar ----------
    await p.evaluate(async () => { window.showConfirm = async () => true; window.__fiArchivos = [await __foto(5, false)]; window.__fiArchivo = window.__fiArchivos[0]; invoiceDraft.archivos = window.__fiArchivos; invoiceDraft.archivo = window.__fiArchivo; });
    await p.click('#invoiceApplyBtn'); await p.waitForTimeout(800);
    const prods = await p.evaluate(() => data.products.filter(x => x.id !== 'pk').map(x => ({ n: x.name, cat: x.categoryId, cod: x.codigo || null, bc: x.barcodes || [] })));
    const sinT = x => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const por = n => prods.find(x => sinT(x.n).includes(sinT(n))) || {};
    chk('2. Cada producto quedó en SU categoría', por('Águila').cat === 'c-cer' && por('Coca').cat === 'c-gas' && por('Aguardiente').cat === 'c-lic' && por('Papas').cat === mec, prods);
    chk('2. … y con su código', por('Águila').cod === '7702004003508' && por('Coca').cod === 'GAS-400' && por('Aguardiente').cod === '7702535011119' && por('Papas').cod === null, prods);
    chk('2. Escanear el código para vender encuentra el producto (GAS-400 → Coca Cola)', await p.evaluate(() => { const x = findProductByScannedCode('GAS-400'); return !!x && /Coca/.test(x.name); }));
    // Buscador y Editar producto
    await p.evaluate(() => { showSection && showSection('productos'); }).catch(() => {});
    await p.evaluate(() => { const q = document.getElementById('prodBuscar'); q.value = '7702535011119'; renderProductos(); });
    const enc = await p.evaluate(() => [...document.querySelectorAll('#productList .product-row .p-name')].map(x => x.textContent));
    chk('2. El buscador de productos encuentra por código', enc.length === 1 && /Aguardiente/.test(enc[0]), enc);
    chk('2. La lista de productos muestra el código (🔢)', await p.evaluate(() => /🔢 7702535011119/.test(document.getElementById('productList').textContent)));
    const editCod = await p.evaluate(() => { const x = data.products.find(y => /Coca/.test(y.name)); openEditProductModal(x.id); const v = document.getElementById('editProdCodigo').value; document.getElementById('editProdCodigo').value = 'GAS-401'; saveEditedProduct(); const y = data.products.find(z => z.id === x.id); return { v, nuevo: y.codigo, bc: y.barcodes, viejo: !!findProductByScannedCode('GAS-400') }; });
    chk('2. «Editar producto» muestra el código y se puede cambiar (el viejo deja de reconocerse)', editCod.v === 'GAS-400' && editCod.nuevo === 'GAS-401' && editCod.bc.includes('GAS-401') && !editCod.viejo, editCod);
    await p.evaluate(() => { document.getElementById('prodBuscar').value = ''; renderProductos(); });

    // ---------- 3. Escáner HD ----------
    const esc = await p.evaluate(async () => {
      const r = await fiMejorarFoto(await __foto(5, false), FI_HD);
      const d = await __dims(r.file);
      // ¿quedó derecho? se mide la inclinación del texto en el resultado
      const c = document.createElement('canvas'), im = await fiCargarImagen(r.file); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
      const px = x.getImageData(0, 0, c.width, c.height).data, g = new Uint8Array(c.width * c.height); for(let i = 0, q = 0; q < g.length; i += 4, q++) g[q] = px[i];
      return { enderezada: r.enderezada, w: d.w, h: d.h, resto: fiAnguloTexto(g, c.width, c.height), kb: Math.round(r.file.size / 1024) };
    });
    chk('3. Foto con la hoja girada 5° sobre la mesa → recortada y enderezada', esc.enderezada && Math.abs(esc.resto) <= 0.6, esc);
    chk('3. … en Full HD (lado largo ≥ 1920 px)', Math.max(esc.w, esc.h) >= 1920 && esc.h > esc.w, esc);
    const alin = await p.evaluate(async () => {
      const f = await __foto(4, true);
      const r = await fiMejorarFoto(f, FI_HD);
      const c = document.createElement('canvas'), im = await fiCargarImagen(r.file); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
      const px = x.getImageData(0, 0, c.width, c.height).data, g = new Uint8Array(c.width * c.height); for(let i = 0, q = 0; q < g.length; i += 4, q++) g[q] = px[i];
      return { angulo: r.angulo, resto: fiAnguloTexto(g, c.width, c.height) };
    });
    chk('3. Hoja que ocupa toda la foto con el texto inclinado 4° → el texto se alinea (queda derecho)', Math.abs(Math.abs(alin.angulo) - 4) <= 0.6 && Math.abs(alin.resto) <= 0.6, alin);
    const derecha = await p.evaluate(async () => (await fiMejorarFoto(await __foto(0, true), FI_HD)).angulo);
    chk('3. Una factura que ya está derecha no se gira', derecha === 0, derecha);

    // ---------- 4. Todas las páginas guardadas ----------
    await p.waitForFunction(() => { const x = (data.purchases || [])[0]; return x && (x.escaneos || []).length; }, null, { timeout: 30000 });
    const g1 = await p.evaluate(() => data.purchases[0].escaneos);
    chk('4. La factura aplicada quedó guardada escaneada en HD en el celular', g1.length === 1 && Math.max(g1[0].w, g1[0].h) >= 1920, g1);
    // Factura de 2 páginas
    await p.evaluate(async () => { invoiceOpen({ supplier: 'Licorera Dos Hojas', items: [{ original: 'RON MEDELLIN 750', name: 'Ron Medellín 750', qty: 3, unit_cost: 40000, line_total: 120000 }] }); window.__fiArchivos = null;
      invoiceDraft.archivos = [await __foto(-3, false, 'LICORERA DOS HOJAS PAG 1'), await __foto(2, false, 'LICORERA DOS HOJAS PAG 2')]; invoiceDraft.archivo = invoiceDraft.archivos[0]; });
    await p.click('#invoiceApplyBtn');
    await p.waitForFunction(() => { const x = (data.purchases || [])[0]; return x && x.supplier === 'Licorera Dos Hojas' && (x.escaneos || []).length === 2; }, null, { timeout: 30000 }).catch(() => {});
    const g2 = await p.evaluate(() => (data.purchases[0].escaneos || []).length);
    chk('4. Factura de 2 fotos → se guardan LAS 2 páginas (antes solo la primera)', g2 === 2, g2);
    chk('4. El nuevo producto de esa factura quedó en Licores (por el tipo de producto)', await p.evaluate(() => (data.products.find(x => /Ron Medell/.test(x.name)) || {}).categoryId === 'c-lic'));

    // ---------- 5. Descargar desde «Facturas anteriores» ----------
    await p.evaluate(() => window.fiAbrirHistorialFacturas());
    await p.waitForSelector('#fiHistOv.show .fi-hrow');
    const filas = await p.evaluate(() => [...document.querySelectorAll('#fiHistOv .fi-hrow')].map(x => x.textContent));
    chk('5. «📚 Facturas anteriores» muestra las 2 facturas con 📎', filas.length === 2 && filas.every(t => /📎/.test(t)), filas);
    await p.click('#fiHistOv .fi-hrow:nth-child(2)');          // la de Distribuidora Prueba (la más vieja)
    await p.waitForSelector('#fiDetOv.show .fi-dl-pdf');
    await p.waitForFunction(() => { const im = document.querySelector('#fiDetOv .fi-desc-img'); return im && im.getAttribute('src'); }, null, { timeout: 15000 });
    chk('5. Se ve la vista previa de la factura escaneada', true);
    let [dl] = await Promise.all([p.waitForEvent('download', { timeout: 180000 }), p.click('#fiDetOv .fi-dl-pdf')]);
    const pdf1 = path.join(tmp, 'f1.pdf'); await dl.saveAs(pdf1);
    const info1 = execFileSync('pdfinfo', [pdf1]).toString(), txt1 = execFileSync('pdftotext', ['-layout', pdf1, '-']).toString();
    chk('5. El PDF se descarga con nombre claro (proveedor y fecha)', /^Factura Distribuidora Prueba.*\.pdf$/.test(dl.suggestedFilename()), dl.suggestedFilename());
    chk('5. PDF válido: página escaneada + hoja de datos (2 páginas)', /Pages:\s+2/.test(info1), info1);
    const img1 = execFileSync('pdfimages', ['-list', pdf1]).toString();
    const anchoImg = Math.max(...img1.split('\n').slice(2).filter(Boolean).map(l => { const c = l.trim().split(/\s+/); return Math.max(+c[3], +c[4]); }));
    chk('5. La página escaneada va en HD (≥ 1920 px)', anchoImg >= 1920, img1);
    chk('5. El texto de la factura está DETECTADO en el PDF (se puede buscar: AGUILA, COCA COLA, TOTAL)', /AGUILA/i.test(txt1) && /COCA/i.test(txt1) && /TOTAL/i.test(txt1), txt1.slice(0, 600));
    chk('5. La hoja de datos trae cada producto con su categoría y código', /Datos de la factura/.test(txt1) && /Mecato/.test(txt1) && /7702535011119/.test(txt1) && /Licores/.test(txt1), txt1.slice(-1500));
    [dl] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.click('#fiDetOv .fi-dl-jpg')]);
    const jpg1 = path.join(tmp, 'f1.jpg'); await dl.saveAs(jpg1);
    const jb = fs.readFileSync(jpg1);
    const jdim = await p.evaluate(async b64 => { const im = new Image(); im.src = 'data:image/jpeg;base64,' + b64; await im.decode(); return { w: im.naturalWidth, h: im.naturalHeight }; }, jb.toString('base64'));
    chk('5. «🖼️ Imagen HD» descarga un JPG de 1920 px o más', jb[0] === 0xFF && jb[1] === 0xD8 && Math.max(jdim.w, jdim.h) >= 1920, jdim);
    await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    // la de 2 páginas
    await p.evaluate(() => window.fiAbrirHistorialFacturas()); await p.click('#fiHistOv .fi-hrow:nth-child(1)'); await p.waitForSelector('#fiDetOv.show .fi-dl-pdf');
    [dl] = await Promise.all([p.waitForEvent('download', { timeout: 240000 }), p.click('#fiDetOv .fi-dl-pdf')]);
    const pdf2 = path.join(tmp, 'f2.pdf'); await dl.saveAs(pdf2);
    const info2 = execFileSync('pdfinfo', [pdf2]).toString(), txt2 = execFileSync('pdftotext', [pdf2, '-']).toString();
    const hojas = txt2.split('\f');
    chk('5. Factura de 2 páginas → PDF con las 2 páginas escaneadas (cada una con su texto) + la hoja de datos', /Pages:\s+3/.test(info2) && /LICORERA/.test(hojas[0]) && /\b1\b/.test(hojas[0]) && /LICORERA/.test(hojas[1]) && /\b2\b/.test(hojas[1]) && /Datos de la factura/.test(hojas[2]), hojas.map(h => h.slice(0, 120)));
    await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));

    // ---------- 6. Factura guardada antes (solo foto original, sin escaneo) ----------
    await p.evaluate(async () => {
      const f = await __foto(6, false, 'FACTURA VIEJA SAS'); const url = await scalePhotoForAI(f, 1600, 0.7);
      await window.ctReciboGuardar('fact-vieja', url);
      data.purchases.push({ id: 'vieja1', supplier: 'Factura Vieja SAS', date: '2026-05-02', items: [{ name: 'Cerveza Póker lata', qty: 24, cost: 2500, total: 60000 }], total: 60000, archivoId: 'fact-vieja', at: '2026-05-02T10:00:00Z' });
      saveData(); window.fiAbrirHistorialFacturas();
    });
    await p.click('#fiHistOv .fi-hrow:nth-child(3)'); await p.waitForSelector('#fiDetOv.show .fi-dl-jpg');
    [dl] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.click('#fiDetOv .fi-dl-jpg')]);
    const jpg2 = path.join(tmp, 'v.jpg'); await dl.saveAs(jpg2);
    const vd = await p.evaluate(async b64 => { const im = new Image(); im.src = 'data:image/jpeg;base64,' + b64; await im.decode(); return { w: im.naturalWidth, h: im.naturalHeight }; }, fs.readFileSync(jpg2).toString('base64'));
    chk('6. Factura guardada antes (foto original de 1600 px) → se descarga MEJORADA en HD (≥ 1920 px, recortada: vertical)', Math.max(vd.w, vd.h) >= 1920 && vd.h > vd.w, vd);
    chk('6. … y ese escaneo queda guardado para la próxima vez', await p.evaluate(() => (data.purchases.find(x => x.id === 'vieja1').escaneos || []).length === 1));
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
