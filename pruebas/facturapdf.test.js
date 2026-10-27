// 🧾 Cargar una FACTURA EN PDF (ORDEVA 1.65.7): el dueño la subía por «🖼️ Galería o PDF» y salía «The PDF file is empty».
//  1. Un PDF digital de verdad (con su texto) por «Galería o PDF», CON la IA: la IA recibe el texto del PDF y salen los
//     productos, las cantidades y los costos para revisar.
//  2. El mismo PDF SIN internet (sin IA): se lee igual (lector sin internet) y salen los productos.
//  3. Un PDF que llega VACÍO (0 bytes, lo que pasaba en la app Android con WhatsApp/Drive): mensaje claro en español de qué
//     hacer, no un error en inglés.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';

// Un PDF de una página con texto (Helvetica), como el que manda un proveedor por correo.
function pdfFactura(lineas){
  const esc = t => t.replace(/[\\()]/g, m => '\\' + m);
  const contenido = 'BT /F1 11 Tf 50 780 Td 14 TL ' + lineas.map(l => '(' + esc(l) + ") '").join(' ') + ' ET';
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Length ' + Buffer.byteLength(contenido, 'latin1') + ' >>\nstream\n' + contenido + '\nendstream'];
  let s = '%PDF-1.4\n'; const pos = [];
  objs.forEach((o, i) => { pos.push(Buffer.byteLength(s, 'latin1')); s += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
  const x = Buffer.byteLength(s, 'latin1');
  s += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + pos.map(p => String(p).padStart(10, '0') + ' 00000 n \n').join('') +
    'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + x + '\n%%EOF\n';
  return Buffer.from(s, 'latin1');
}
const FACTURA = ['DISTRIBUIDORA EL PROVEEDOR S.A.S.', 'NIT 900.123.456-7', 'FACTURA DE VENTA No. FE-1234', 'Fecha: 2026-10-27', '',
  'CANT  DESCRIPCION                      V.UNIT      TOTAL', '24    CERVEZA AGUILA LATA 330ML        2.100      50.400',
  '12    GASEOSA COLA 400ML               1.500      18.000', '6     PAPAS FRITAS 45G                 1.200       7.200', '',
  'SUBTOTAL 75.600', 'TOTAL A PAGAR 75.600'];

(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  const pdf = pdfFactura(FACTURA);
  async function pagina(conIA){
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    const ia = { pedidos: [] };
    await ctx.route('**/*', r => {
      const u = new URL(r.request().url());
      if(conIA && u.hostname === 'generativelanguage.googleapis.com'){
        const cuerpo = r.request().postData() || ''; ia.pedidos.push(cuerpo);
        const resp = { p: 'Distribuidora El Proveedor', f: '2026-10-27', h: { n: 'FE-1234', t: 75600, st: 75600 },
          i: [['CERVEZA AGUILA LATA 330ML', 'Cerveza Águila lata 330 ml', 24, 'und', 2100, 50400], ['GASEOSA COLA 400ML', 'Gaseosa cola 400 ml', 12, 'und', 1500, 18000], ['PAPAS FRITAS 45G', 'Papas fritas 45 g', 6, 'und', 1200, 7200]] };
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(resp) }] }, finishReason: 'STOP' }] }) });
      }
      return u.hostname === 'localhost' ? r.continue() : r.abort();
    });
    await ctx.addInitScript(conIA => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' }));
      if(conIA) localStorage.setItem('bar-gemini-api-key', 'AIzaPrueba_0123456789abcdefghijklmnop'); localStorage.setItem('vento-ia-ofrecida', new Date().toDateString()); }catch(e){} }, conIA);
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1200);
    await p.fill('#authBiz', 'Tienda Facturas'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1500);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); if(!navigator.onLine) Object.defineProperty(navigator, 'onLine', { get: () => true }); });
    return { ctx, p, ia };
  }
  const filas = p => p.evaluate(() => ({ abierta: document.getElementById('invoiceOverlay').classList.contains('show'), txt: (document.getElementById('invoiceBody') || {}).innerText || '',
    sub: (document.getElementById('invoiceSub') || {}).textContent || '', toast: (document.getElementById('toast') || {}).textContent || '' }));
  try{
    // ===== 1. Con la IA =====
    let { ctx, p, ia } = await pagina(true);
    await p.setInputFiles('#invoiceGalInput', { name: 'factura-proveedor.pdf', mimeType: 'application/pdf', buffer: pdf });
    const ok1 = await p.waitForFunction(() => /guila/i.test((document.getElementById('invoiceBody') || {}).innerText || ''), null, { timeout: 45000 }).then(() => true, () => false);
    let f = await filas(p);
    chk('1. PDF de factura por «Galería o PDF» con la IA: salen los productos para revisar', ok1 && /Gaseosa/i.test(f.txt) && /Papas/i.test(f.txt), f);
    chk('1. … la IA recibió el TEXTO del PDF (no una foto): más rápido y exacto', ia.pedidos.some(x => /CERVEZA AGUILA LATA/.test(x)), ia.pedidos.map(x => x.slice(0, 120)));
    chk('1. … con cantidades y costos (24 × $2.100)', /24/.test(f.txt) && /2[.,]?100/.test(f.txt), f.txt.slice(0, 400));
    await ctx.close();

    // ===== 2. Sin internet =====
    ({ ctx, p } = await pagina(false));
    await p.setInputFiles('#invoiceGalInput', { name: 'factura-proveedor.pdf', mimeType: 'application/pdf', buffer: pdf });
    const ok2 = await p.waitForFunction(() => /guila/i.test((document.getElementById('invoiceBody') || {}).innerText || ''), null, { timeout: 90000 }).then(() => true, () => false);
    f = await filas(p);
    chk('2. El mismo PDF sin IA (lector sin internet): también salen los productos', ok2 && /gaseosa/i.test(f.txt), f);

    // ===== 3. PDF vacío =====
    await p.evaluate(() => { try{ invoiceClose(); }catch(e){} document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); });
    await p.setInputFiles('#invoiceGalInput', { name: 'factura-whatsapp.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(0) });
    await p.waitForTimeout(1200);
    f = await filas(p);
    chk('3. Un PDF que llega vacío (0 bytes): mensaje claro en español y sin el error en inglés', /llegó vacío/.test(f.toast) && !/zero bytes|is empty/i.test(f.toast) && !f.abierta, f);
    await ctx.close();
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
