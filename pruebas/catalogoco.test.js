// 🇨🇴 ORDEVA 1.67.1 · Catálogo de productos colombianos por código de barras (sin internet) + varios códigos a la vez.
//  1. lib/catalogo-co.json: más de 5.000 productos, con la fuente citada (ODbL), solo códigos de 8 a 14 cifras.
//  2. Sin internet (las bases de afuera bloqueadas): «Kola Román» se reconoce al instante por su código, con marca,
//     contenido (1,75 L) y categoría.
//  3. Un código leído como UPC-A (12 cifras) encuentra el EAN-13 con 0 adelante.
//  4. Ficha del producto nuevo: se llena sola (nombre con la marca, contenido, presentación, categoría); la categoría
//     que no existe sale «🆕 … (nueva)» y se crea al guardar; el producto queda con su código, contenido y marca.
//  5. Un código que no está en ninguna parte: «No lo encontré» (nada inventado).
//  6. Cámara con DOS productos juntos: se leen los dos códigos, cada uno una vez.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('fs'), os = require('os'), path = require('path');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';

function ean13(base12){
  const L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
  const G = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
  const R = ['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];
  const P = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];
  const s = [...base12].reduce((a, d, i) => a + (+d) * (i % 2 ? 3 : 1), 0), code = base12 + ((10 - s % 10) % 10);
  let bits = '101';
  [...code.slice(1, 7)].forEach((d, i) => { bits += (P[+code[0]][i] === 'L' ? L : G)[+d]; });
  bits += '01010'; [...code.slice(7)].forEach(d => { bits += R[+d]; }); bits += '101';
  return { code, bits };
}
// Un cuadro con dos códigos, uno arriba del otro (dos productos frente a la cámara).
function videoDos(b1, b2){
  const W = 640, H = 480, m = 4, x0 = Math.floor((W - b1.length * m) / 2);
  const y = Buffer.alloc(W * H, 235), uv = Buffer.alloc(W * H / 2, 128);
  const pintar = (bits, r0, r1) => { for(let r = r0; r < r1; r++) for(let i = 0; i < bits.length; i++) if(bits[i] === '1') y.fill(16, r * W + x0 + i * m, r * W + x0 + i * m + m); };
  pintar(b1, 30, 190); pintar(b2, 290, 450);
  const cuadro = Buffer.concat([Buffer.from('FRAME\n'), y, uv]);
  return Buffer.concat([Buffer.from(`YUV4MPEG2 W${W} H${H} F10:1 Ip A1:1 C420jpeg\n`), cuadro, cuadro]);
}

(async () => {
  let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  // ===== 1. El archivo =====
  const cat = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'lib', 'catalogo-co.json'), 'utf8'));
  const codigos = Object.keys(cat.p);
  chk('1. El catálogo trae más de 5.000 productos y cita la fuente (ODbL)', codigos.length > 5000 && cat.n === codigos.length && /Open Food Facts/.test(cat.fuente) && /ODbL/.test(cat.fuente), { n: codigos.length, f: cat.fuente });
  chk('1. Solo códigos de 8 a 14 cifras y todos con nombre', codigos.every(c => /^\d{8,14}$/.test(c)) && codigos.every(c => cat.p[c][0] && cat.p[c][0].length >= 2), codigos.find(c => !/^\d{8,14}$/.test(c)));
  const conCero = codigos.find(c => c.length === 13 && c[0] === '0');

  const A = ean13('770111222333'), B = ean13('770444555666');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ordeva-cam2-')), cam = path.join(dir, 'dos.y4m');
  fs.writeFileSync(cam, videoDos(A.bits, B.bits));
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-video-capture=' + cam] });
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['camera'] });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());   // sin internet
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1200);
    await p.fill('#authBiz', 'Tienda Catálogo'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1500);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); data.categories = [{ id: 'k1', name: 'Lácteos' }]; data.products = []; saveData(); });

    // ===== 2-3. Búsqueda =====
    let v = await p.evaluate(async () => { const t0 = performance.now(); const r = await window.ventoProductoCodigo.local('7702609009752'); return { r, ms: Math.round(performance.now() - t0) }; });
    chk('2. Sin internet: «Kola Román» por su código, con marca Postobón, 1,75 L y categoría Gaseosas', v.r && /Kola Rom/.test(v.r.nombre) && /Postob/.test(v.r.marca) && /1,75 L/.test(v.r.tamano) && v.r.categoria === 'Gaseosas', v);
    v = await p.evaluate(async c => { const r = await window.ventoProductoCodigo.local(c.slice(1)); return r && r.nombre; }, conCero);
    chk('3. Leído como UPC-A (12 cifras) encuentra el EAN-13 con 0 adelante', !!v, { conCero, v });

    // ===== 4. Ficha =====
    await p.evaluate(() => { window.__ficha = window.ventoProductoCodigo.ficha('7702609009752', { conCantidad: true, cantidad: 12 }); });
    await p.waitForFunction(() => /Catálogo de productos colombianos/.test((document.getElementById('pcEst') || {}).textContent || ''), null, { timeout: 5000 }).catch(() => {});
    v = await p.evaluate(() => ({ est: document.getElementById('pcEst').textContent, nom: document.getElementById('pcNom').value, tam: document.getElementById('pcTam').value, pres: document.getElementById('pcPres').value,
      cat: document.getElementById('pcCat').value, catTxt: document.getElementById('pcCat').selectedOptions[0].textContent, can: (document.getElementById('pcCan') || {}).value }));
    chk('4. La ficha se llena sola: «Postobón Kola Román», 1,75 L, y dice de dónde salió', /Postob[oó]n Kola Rom/.test(v.nom) && /1,75 L/.test(v.tam) && /Catálogo de productos colombianos/.test(v.est), v);
    chk('4. La categoría que no existe sale «🆕 Gaseosas (nueva…)» y queda elegida; «¿Cuántas llegaron?» = 12', v.cat === 'nueva:Gaseosas' && /🆕 Gaseosas/.test(v.catTxt) && v.can === '12', v);
    await p.fill('#pcPre', '4500'); await p.click('#pcFichaOv [data-ok]');
    v = await p.evaluate(async () => { const r = await window.__ficha; const pr = r && r.p; const c = data.categories.find(x => x.id === (pr && pr.categoryId)); return { r: !!r, cant: r && r.cantidad, name: pr && pr.name, size: pr && pr.size, marca: pr && pr.marca, cat: c && c.name, cod: pr && pr.barcodes, cats: data.categories.map(x => x.name) }; });
    chk('4. Al guardar: el producto queda con su código, contenido, marca y la categoría «Gaseosas» creada una vez', v.r && v.cant === 12 && /1,75 L/.test(v.size) && /Postob/.test(v.marca) && v.cat === 'Gaseosas' && v.cod[0] === '7702609009752' && v.cats.filter(x => x === 'Gaseosas').length === 1, v);
    v = await p.evaluate(() => { const pr = findProductByScannedCode('7702609009752'); return pr && pr.name; });
    chk('4. La próxima vez el código ya es de ese producto (se encuentra al escanear)', /Kola Rom/.test(v || ''), v);

    // ===== 5. Desconocido =====
    v = await p.evaluate(async () => { const r = await window.ventoProductoCodigo.buscar('7709999999994'); return r; });
    chk('5. Un código que no está en ninguna parte (sin internet): no se inventa nada', v === null, v);

    // ===== 6. Dos códigos a la vez en la cámara =====
    await p.evaluate(() => { window.__leidos = []; openScanOverlay(raw => { window.__leidos.push(raw); }, { hint: 'prueba' }); });
    await p.waitForFunction(() => window.__leidos.length >= 2, null, { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(1500);
    v = await p.evaluate(() => window.__leidos.slice());
    chk('6. Con dos productos juntos frente a la cámara se leen LOS DOS códigos', v.includes(A.code) && v.includes(B.code), { leidos: v, esperaba: [A.code, B.code] });
    chk('6. … y cada uno una sola vez mientras sigue en cámara', v.filter(x => x === A.code).length === 1 && v.filter(x => x === B.code).length === 1, v);
    await p.evaluate(() => { try{ closeScanOverlay(); }catch(e){} });
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
