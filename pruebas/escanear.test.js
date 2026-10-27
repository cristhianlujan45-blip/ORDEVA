// 📷 Auditoría del lector de códigos (ORDEVA 1.65.7), con una cámara de prueba que muestra un código de barras EAN-13 de
// verdad (lo dibuja esta prueba) y el MISMO lector de ORDEVA (el del equipo o ZXing):
//  1. Un toque en «📷» de la caja: la cámara abre de una y el código leído se suma a la venta.
//  2. Tocar el botón 5 veces seguidas: abre UNA sola cámara y funciona (antes cada toque cerraba la apertura en curso y
//     muchos celulares terminaban en «No se pudo abrir la cámara»).
//  3. Permiso lento (el celular pregunta y la persona tarda): tocar varias veces mientras tanto no rompe nada.
//  4. Cámara ocupada un momento (NotReadableError): se reintenta sola y abre.
//  5. Sin permiso: lo dice claro y sale «🔄 Reintentar», que vuelve a abrir.
//  6. Un solo botón para escanear en la caja, la venta rápida y el inventario (sin «📱 Celular» aparte).
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('fs'), os = require('os'), path = require('path');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';

// ---------- Un video de cámara (y4m) con un EAN-13 ----------
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
function videoY4m(bits){
  const W = 640, H = 360, m = 4, x0 = Math.floor((W - bits.length * m) / 2);
  const y = Buffer.alloc(W * H, 235), uv = Buffer.alloc(W * H / 2, 128);
  for(let r = 80; r < 280; r++) for(let i = 0; i < bits.length; i++) if(bits[i] === '1') y.fill(16, r * W + x0 + i * m, r * W + x0 + i * m + m);
  const cuadro = Buffer.concat([Buffer.from('FRAME\n'), y, uv]);
  return Buffer.concat([Buffer.from(`YUV4MPEG2 W${W} H${H} F10:1 Ip A1:1 C420jpeg\n`), cuadro, cuadro]);
}

(async () => {
  const { code, bits } = ean13('770123456789');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ordeva-cam-')), cam = path.join(dir, 'codigo.y4m');
  fs.writeFileSync(cam, videoY4m(bits));
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-video-capture=' + cam] });
  let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['camera'] });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => {
      try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){}
      // Se cuentan las cámaras abiertas (y las que siguen prendidas) y se puede simular un celular lento, ocupado o sin permiso.
      window.__cam = { pedidas: 0, vivas: () => (window.__cam.tracks || []).filter(t => t.readyState === 'live').length, tracks: [], espera: 0, fallar: [] };
      const md = navigator.mediaDevices, orig = md.getUserMedia.bind(md);
      md.getUserMedia = async c => {
        const C = window.__cam; C.pedidas++;
        if(C.espera) await new Promise(r => setTimeout(r, C.espera));
        const f = C.fallar.shift(); if(f) throw new DOMException('simulado', f);
        const s = await orig(c); C.tracks.push(...s.getVideoTracks()); return s;
      };
    });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1200);
    await p.fill('#authBiz', 'Tienda Lector'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1500);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await p.evaluate(c => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.products = [{ id: 'gs', name: 'Gaseosa del lector', price: 2500, stock: 20, barcodes: [c] }, { id: 'pn', name: 'Pan', price: 800, stock: 20 }];
      saveData(); window.ventoPOS.vaciar(); window.ventoPOS.abrirCaja(); }, code);
    await p.waitForSelector('#pzCajaOv [data-scan]', { timeout: 8000 });
    const esperar = (fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 10000, polling: 100 }).then(() => true, () => false);
    const estado = () => p.evaluate(() => ({ abierta: document.getElementById('scanOverlay').classList.contains('show'), video: document.getElementById('scanVideo').videoWidth,
      txt: document.getElementById('scanStatus').textContent, reintentar: !document.getElementById('scanRetryBtn').hidden, pedidas: window.__cam.pedidas, vivas: window.__cam.vivas(),
      venta: window.ventoPOS.carrito().map(l => l.name + '×' + (l.qty || l.cantidad || 1)) }));
    const cerrar = () => p.evaluate(() => closeScanOverlay());

    // La cámara se ve ENCIMA de la caja (antes se abría detrás y no se veía).
    const visible = () => p.evaluate(() => { const v = document.getElementById('scanVideo').getBoundingClientRect(), el = document.elementFromPoint(v.left + v.width / 2, v.top + v.height / 2); return !!el && !!el.closest('#scanOverlay'); });

    // ===== 1. Un toque =====
    const t0 = Date.now();
    await p.click('#pzCajaOv [data-scan]');
    const abrio = await esperar(() => document.getElementById('scanVideo').videoWidth > 0, null, 8000), tAbrir = Date.now() - t0;
    chk('1. Un toque en «📷»: la cámara abre de una (' + tAbrir + ' ms)', abrio && tAbrir < 4000, await estado());
    chk('1. … y se VE encima de la caja (antes quedaba escondida detrás)', await visible());
    chk('1. El código EAN-13 que se ve en la cámara se lee y la «Gaseosa del lector» se suma a la venta', await esperar(() => window.ventoPOS.carrito().some(l => /Gaseosa del lector/.test(l.name)), null, 12000), await estado());
    await cerrar();
    chk('1. Al cerrar, la cámara se apaga (no queda prendida)', await esperar(() => window.__cam.vivas() === 0, null, 3000), await estado());

    // ===== 2. Cinco toques seguidos =====
    await p.evaluate(() => { window.ventoPOS.vaciar(); window.__cam.pedidas = 0; window.__cam.espera = 600; });   // un celular normal tarda un poco en abrir
    for(let i = 0; i < 5; i++){ await p.click('#pzCajaOv [data-scan]', { force: true }).catch(() => p.evaluate(() => document.querySelector('#pzCajaOv [data-scan]').click())); await p.waitForTimeout(80); }
    await esperar(() => document.getElementById('scanVideo').videoWidth > 0, null, 8000);
    await p.waitForTimeout(800);
    let e = await estado();
    chk('2. Cinco toques seguidos: abre UNA sola cámara, sin error', e.abierta && e.video > 0 && e.pedidas === 1 && e.vivas === 1 && !/No se pudo/.test(e.txt), e);
    chk('2. … y lee igual', await esperar(() => window.ventoPOS.carrito().some(l => /Gaseosa del lector/.test(l.name)), null, 12000), await estado());
    await cerrar();

    // ===== 3. Permiso lento =====
    await p.evaluate(() => { window.ventoPOS.vaciar(); window.__cam.pedidas = 0; window.__cam.espera = 2500; });
    await p.evaluate(() => document.querySelector('#pzCajaOv [data-scan]').click());
    for(let i = 0; i < 3; i++){ await p.waitForTimeout(400); await p.evaluate(() => document.querySelector('#pzCajaOv [data-scan]').click()); }
    chk('3. El celular tarda en dar el permiso y se toca varias veces: abre igual, una sola vez', await esperar(() => document.getElementById('scanVideo').videoWidth > 0 && window.__cam.vivas() === 1, null, 8000) &&
      await p.evaluate(() => window.__cam.pedidas === 1 && window.__cam.vivas() === 1), await estado());
    await cerrar();

    // ===== 4. Cámara ocupada un momento =====
    await p.evaluate(() => { window.__cam.pedidas = 0; window.__cam.espera = 0; window.__cam.fallar = ['NotReadableError', 'NotReadableError']; });
    await p.evaluate(() => document.querySelector('#pzCajaOv [data-scan]').click());
    chk('4. Cámara ocupada (NotReadableError dos veces): se reintenta sola y abre', await esperar(() => document.getElementById('scanVideo').videoWidth > 0, null, 8000), await estado());
    await cerrar();

    // ===== 5. Sin permiso =====
    await p.evaluate(() => { window.__cam.fallar = ['NotAllowedError']; });
    await p.evaluate(() => document.querySelector('#pzCajaOv [data-scan]').click());
    await esperar(() => !document.getElementById('scanRetryBtn').hidden, null, 6000);
    e = await estado();
    chk('5. Sin permiso: lo dice claro (cómo permitir la cámara) y sale «🔄 Reintentar»', e.reintentar && /permi/i.test(e.txt) && !/^No se pudo abrir la cámara\. Revisa/.test(e.txt), e);
    await p.click('#scanRetryBtn');
    chk('5. «Reintentar» (ya con permiso) abre la cámara', await esperar(() => document.getElementById('scanVideo').videoWidth > 0 && document.getElementById('scanRetryBtn').hidden, null, 8000), await estado());
    await cerrar();

    // ===== 6. Un solo botón =====
    const botones = await p.evaluate(() => ({ caja: document.querySelectorAll('#pzCajaOv [data-scan]').length, celCaja: document.querySelectorAll('#pzCajaOv [data-lcel-abrir]').length,
      ventaRapida: document.querySelectorAll('#qsScanBtn').length, celVenta: !!(document.getElementById('qsScanBtn') && document.getElementById('qsScanBtn').parentNode.querySelector('[data-lcel-abrir]')) }));
    chk('6. Un solo botón para escanear en la caja y en la venta rápida (el celular como lector está dentro de la cámara)', botones.caja >= 1 && !botones.celCaja && botones.ventaRapida === 1 && !botones.celVenta, botones);
    await p.evaluate(() => { window.ventoPOS.cerrarCaja(); document.getElementById('qsScanBtn').click(); });
    chk('6. «📷 Escanear» de la venta rápida abre la cámara y ofrece el celular como lector adentro', await esperar(() => document.getElementById('scanVideo').videoWidth > 0 && !!document.querySelector('#scanCelBox [data-lcel="ver"]'), null, 8000), await estado());
    await cerrar();
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close(); try{ fs.rmSync(dir, { recursive: true, force: true }); }catch(e){}
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
