// Lectura del texto de las facturas SIN internet (Tesseract dentro de Vento), con fotos simuladas:
//  1. Factura derecha: el texto sale tal cual (renglones, números y espacios) y separa los productos.
//  2. Factura de lado (foto girada 90°): se endereza ANTES de leer → mismo resultado y rápido (sin releer girada).
//  3. Tiempo: cada lectura en pocos segundos.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
const LINEAS = ['DISTRIBUIDORA LA ESPERANZA S.A.S.', 'NIT 900.123.456-7', 'FACTURA DE VENTA No. FE-4521', 'CANT DESCRIPCION VR UNIT TOTAL',
  '24 CERVEZA POKER LATA 330ML 2.500 60.000', '12 GASEOSA COCA COLA 1.5L 4.200 50.400', '6 AGUARDIENTE ANTIOQUENO 750ML 38.000 228.000',
  '30 AGUA CRISTAL 600ML 1.100 33.000', '10 PAPAS MARGARITA POLLO 1.900 19.000', 'SUBTOTAL 390.400', 'IVA 19% 74.176', 'TOTAL A PAGAR 464.576'];
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1200);
    await p.fill('#authBiz', 'Bar OCR'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1200);
    await p.evaluate(LINEAS => {
      window.__factura = async rot => {
        const W = 1240, H = 1754, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
        x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.fillStyle = '#111'; x.font = '34px Arial';
        LINEAS.forEach((l, i) => x.fillText(l, 70, 140 + i * 66));
        const r = document.createElement('canvas'); r.width = rot % 180 ? H : W; r.height = rot % 180 ? W : H;
        const rx = r.getContext('2d'); rx.fillStyle = '#fff'; rx.fillRect(0, 0, r.width, r.height); rx.translate(r.width / 2, r.height / 2); rx.rotate(rot * Math.PI / 180); rx.drawImage(c, -W / 2, -H / 2);
        return new File([await new Promise(z => r.toBlob(z, 'image/jpeg', 0.9))], 'factura.jpg', { type: 'image/jpeg' });
      };
      window.__exactitud = (texto) => {   // % de los caracteres de las líneas originales que salen igual (distancia de edición por línea)
        const lev = (a, b) => { const d = Array.from({ length: b.length + 1 }, (_, i) => i); for(let i = 1; i <= a.length; i++){ let prev = d[0]; d[0] = i; for(let j = 1; j <= b.length; j++){ const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; } } return d[b.length]; };
        const ls = String(texto).split('\n').map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
        let tot = 0, err = 0;
        LINEAS.forEach(L => { const best = Math.min(...ls.map(l => lev(L, l)), L.length); tot += L.length; err += best; });
        return Math.round((1 - err / tot) * 1000) / 10;
      };
    }, LINEAS);
    await p.evaluate(() => window.VitoOfflineOCR.precalentar && window.VitoOfflineOCR.precalentar());
    await p.waitForTimeout(500);
    for(const rot of [0, 90]){
      const r = await p.evaluate(async rot => {
        const f = await window.__factura(rot);
        const t0 = performance.now(); let res = null, err = null;
        try{ res = await window.VitoOfflineOCR.scanInvoiceFiles([f]); }catch(e){ err = e.message; }
        return { ms: Math.round(performance.now() - t0), err, items: res ? res.items.map(i => [i.name, i.qty, i.unit_cost]) : [], exact: res ? window.__exactitud(res.rawText) : 0, raw: res ? res.rawText.slice(0, 400) : '' };
      }, rot);
      console.log('   ℹ️ ' + rot + '°: ' + r.ms + ' ms, exactitud ' + r.exact + ' %, ' + r.items.length + ' productos');
      const nombre = rot ? '2. De lado (90°)' : '1. Derecha';
      chk(nombre + ': el texto sale tal cual (≥ 95 % de los caracteres)', r.exact >= 95, r);
      chk(nombre + ': separa los 5 productos', r.items.length >= 5 && r.items.some(i => /POKER/i.test(i[0])) && r.items.some(i => /PAPAS/i.test(i[0])), r.items);
      chk(nombre + ': rápido (menos de 12 s en este equipo de pruebas)', r.ms < 12000, r.ms);
    }
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ Error: ' + (e && e.stack || e)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
