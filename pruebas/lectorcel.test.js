// 📱 El celular como lector de códigos del computador (1.65.0), con cámaras de mentira que muestran códigos de verdad:
//  1. Computador SIN lector propio de códigos (Chrome de Linux, como el programa de PC en Windows): su cámara (o el celular
//     conectado por cable como cámara web) lee un código de barras EAN-13 con ZXing.
//  2. «📱 Usar el celular como lector»: sale el QR con el enlace a lector.html (y queda guardado el emparejamiento).
//  3. lector.html en el celular: «El computador está esperando códigos»; lo que lee su cámara (un QR) llega al
//     computador y el celular muestra «✅ recibido». Escribir el código a mano también llega.
//  4. Con «Escanear» cerrado en el computador, el celular avisa «no está escaneando» y nada se suma después.
//  5. «🔄 Desconectar celulares»: el celular viejo ya no manda códigos a este computador.
//  6. El QR de emparejar leído con ORDEVA de un celular abre ahí el lector.
// El servidor de canales se simula aquí mismo (canal_publicar / canal_leer en memoria, como en Supabase).
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('fs'), os = require('os'), path = require('path');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
const EAN = '7702535011119', QR_TXT = 'PROD-QR-4471';

(async () => {
  let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 500) : '')); } };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lectorcel-'));
  const navs = [];
  try{ await pruebas(); }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  for(const b of navs) await b.close().catch(() => {});
  chk('Sin errores de página', !errs.length, errs);
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);

  async function pruebas(){
    // ---------- Las imágenes de las cámaras: un EAN-13 (JsBarcode) y un QR (QRCode), dibujados con la misma app ----------
    const b0 = await chromium.launch(); navs.push(b0);
    const g = await b0.newPage();
    await g.goto(BASE + '/404.html');
    await g.addScriptTag({ path: path.join(__dirname, '..', 'app', '07-qrcode-this-mode.js') });
    await g.addScriptTag({ path: path.join(__dirname, '..', 'app', '08-jsbarcode-return-exports.js') });
    const cuadro = async (tipo, txt) => g.evaluate(async ({ tipo, txt }) => {
      const W = 640, H = 480, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
      let img;
      if(tipo === 'ean'){ img = document.createElement('canvas'); JsBarcode(img, txt, { format: 'EAN13', width: 3, height: 140, displayValue: false, margin: 10 }); }
      else{ const d = document.createElement('div'); new QRCode(d, { text: txt, width: 300, height: 300, correctLevel: QRCode.CorrectLevel.M }); img = d.querySelector('canvas'); }
      x.drawImage(img, (W - img.width) / 2, (H - img.height) / 2);
      return Array.from(x.getImageData(0, 0, W, H).data);
    }, { tipo, txt });
    // Video .y4m (lo que Chrome muestra como cámara de mentira): RGBA → YUV 4:2:0.
    const y4m = (rgba, archivo) => {
      const W = 640, H = 480, Y = Buffer.alloc(W * H), U = Buffer.alloc(W * H / 4), V = Buffer.alloc(W * H / 4);
      for(let i = 0; i < W * H; i++){ const r = rgba[i * 4], gg = rgba[i * 4 + 1], bb = rgba[i * 4 + 2]; Y[i] = Math.max(0, Math.min(255, Math.round(0.299 * r + 0.587 * gg + 0.114 * bb))); }
      for(let y = 0; y < H / 2; y++) for(let x = 0; x < W / 2; x++){ U[y * W / 2 + x] = 128; V[y * W / 2 + x] = 128; }
      const fr = Buffer.concat([Buffer.from('FRAME\n'), Y, U, V]);
      fs.writeFileSync(archivo, Buffer.concat([Buffer.from('YUV4MPEG2 W640 H480 F10:1 Ip A1:1 C420jpeg\n'), fr, fr]));
      return archivo;
    };
    const camPC = y4m(await cuadro('ean', EAN), path.join(tmp, 'pc.y4m'));
    const camCel = y4m(await cuadro('qr', QR_TXT), path.join(tmp, 'cel.y4m'));
    await b0.close();

    // ---------- Servidor de canales de mentira (lo mismo que canal_publicar / canal_leer de Supabase) ----------
    const msgs = []; let nid = 0;
    const servidor = async ctx => {
      await ctx.route('**/*', r => { const u = new URL(r.request().url()); return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') ? r.continue() : r.abort(); });
      await ctx.route(/\/rest\/v1\/rpc\/canal_(publicar|leer)$/, r => {
        const fn = /canal_publicar$/.test(r.request().url()) ? 'publicar' : 'leer', a = JSON.parse(r.request().postData() || '{}');
        const pub = m => ({ id: String(m.id), time: Math.floor(m.t / 1000), event: 'message', topic: m.canal, message: m.cuerpo });
        if(fn === 'publicar'){ const m = { id: ++nid, canal: a.p_canal, cuerpo: a.p_cuerpo, t: Date.now() }; msgs.push(m); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pub(m)) }); }
        const l = msgs.filter(m => a.p_canales.includes(m.canal) && (a.p_desde_id == null || m.id > a.p_desde_id) && (a.p_desde == null || m.t >= a.p_desde * 1000));
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(l.slice(-300).map(pub)) });
      });
    };
    const camara = archivo => ({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-video-capture=' + archivo] });
    const esperar = (p, fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 15000, polling: 200 }).then(() => true, () => false);

    // ---------- El computador ----------
    const bPC = await chromium.launch(camara(camPC)); navs.push(bPC);
    const cPC = await bPC.newContext({ viewport: { width: 1280, height: 820 } });
    await servidor(cPC);
    await cPC.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('vento-guia-tour', '1'); }catch(e){} });
    const pc = await cPC.newPage(); pc.on('pageerror', e => errs.push('pc: ' + e.message));
    await pc.goto(BASE + '/index.html', { waitUntil: 'load' }); await pc.waitForTimeout(1500);
    await pc.evaluate(async () => {
      await enterApp('test', null); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-pp-oculta', '1');
      document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.businessName = 'Tienda Lector'; await saveData();
    });
    const nativo = await pc.evaluate(() => typeof window.BarcodeDetector === 'function');
    console.log('   (este Chrome ' + (nativo ? 'SÍ' : 'no') + ' trae lector propio de códigos' + (nativo ? '' : ': se usa ZXing') + ')');
    await pc.evaluate(() => { window.__leidos = []; openScanOverlay(raw => window.__leidos.push(raw), { hint: 'Escanea para vender' }); });
    chk('1. La cámara del computador lee el código de barras EAN-13 (' + (nativo ? 'lector del equipo' : 'ZXing') + ')',
      await esperar(pc, ean => window.__leidos.includes(ean), EAN, 20000), await pc.evaluate(() => ({ l: window.__leidos, st: document.getElementById('scanStatus').textContent })));
    chk('1. … una sola vez aunque siga en cámara', await pc.waitForTimeout(1500).then(() => pc.evaluate(ean => window.__leidos.filter(x => x === ean).length === 1, EAN)));

    // 2. Emparejar
    const r2a = await pc.evaluate(() => { const b = document.querySelector('#scanCelBox [data-lcel="ver"]'); return b ? b.textContent : null; });
    chk('2. En «Escanear código» sale «📱 Usar el celular como lector»', /Usar el celular como lector/.test(r2a || ''), r2a);
    await pc.click('#scanCelBox [data-lcel="ver"]');
    const r2 = await pc.evaluate(() => ({ qr: !!document.querySelector('#lcelQr canvas, #lcelQr img'), txt: document.getElementById('scanCelBox').textContent, link: window.ventoLectorCel.enlace(), ls: localStorage.getItem('vento_lector_cel') }));
    chk('2. … muestra el QR para emparejar, cómo hacerlo inalámbrico y por cable USB', r2.qr && /Inalámbrico/.test(r2.txt) && /Por cable USB/.test(r2.txt) && /Cámara web/.test(r2.txt), r2);
    chk('2. … el enlace es lector.html#c=<canal secreto> y queda guardado en el equipo', /\/lector\.html#c=lc[A-Za-z0-9]{22}$/.test(r2.link) && JSON.parse(r2.ls).c === r2.link.split('#c=')[1], r2);

    // 3. El celular
    const bCel = await chromium.launch(camara(camCel)); navs.push(bCel);
    const cCel = await bCel.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await servidor(cCel);
    const cel = await cCel.newPage(); cel.on('pageerror', e => errs.push('cel: ' + e.message));
    await cel.goto(r2.link);
    chk('3. lector.html en el celular: «El computador está esperando códigos» con lo que pide el computador y el negocio',
      await esperar(cel, () => /esperando códigos/.test(document.getElementById('estTit').textContent) && /Escanea para vender/.test(document.getElementById('estSub').textContent) && /Tienda Lector/.test(document.getElementById('neg').textContent)),
      await cel.evaluate(() => document.getElementById('estado').textContent + ' | ' + document.getElementById('neg').textContent));
    chk('3. El QR que lee la cámara del celular llega al computador', await esperar(pc, q => window.__leidos.includes(q), QR_TXT, 20000), await pc.evaluate(() => window.__leidos));
    chk('3. … y el celular muestra «✅ recibido»', await esperar(cel, q => [...document.querySelectorAll('#lista li.ok')].some(li => li.textContent.includes(q)), QR_TXT));
    chk('3. … el computador dice «celular conectado»', await esperar(pc, () => /conectado/.test(document.getElementById('scanCelBox').textContent), null, 8000) || await pc.evaluate(() => document.getElementById('scanCelBox').textContent.includes('conectado')),
      await pc.evaluate(() => document.getElementById('scanCelBox').textContent));
    await cel.fill('#manoTxt', '12345'); await cel.click('#mano button[type=submit]');
    chk('3. Escribir el código a mano en el celular también llega', await esperar(pc, () => window.__leidos.includes('12345')));
    const n3 = await pc.evaluate(q => window.__leidos.filter(x => x === q).length, QR_TXT);
    chk('3. El QR quieto frente al celular se manda una sola vez', n3 === 1, await pc.evaluate(() => window.__leidos));

    // 4. «Escanear» cerrado en el computador
    await pc.evaluate(() => closeScanOverlay());
    chk('4. Con «Escanear» cerrado, el celular dice «El computador no está escaneando»', await esperar(cel, () => /no está escaneando/.test(document.getElementById('estTit').textContent)));
    await cel.fill('#manoTxt', '99999'); await cel.click('#mano button[type=submit]');
    const r4 = await cel.evaluate(() => document.querySelector('#lista li').textContent);
    chk('4. … lo que se lee entonces queda «⚠️ no se envió»', /99999/.test(r4) && /no se envió/.test(r4) && /no está escaneando/.test(await cel.evaluate(() => document.getElementById('estTit').textContent)), r4);
    await pc.evaluate(() => { window.__leidos = []; openScanOverlay(raw => window.__leidos.push(raw), { hint: 'Otra vez' }); });
    await esperar(cel, () => /Otra vez/.test(document.getElementById('estSub').textContent));
    await pc.waitForTimeout(3500);
    chk('4. … y al volver a abrir «Escanear» no se suma lo viejo', await pc.evaluate(() => !window.__leidos.includes('99999') && !window.__leidos.includes('12345')), await pc.evaluate(() => window.__leidos));

    // 5. Desconectar celulares
    pc.once('dialog', d => d.accept());
    await pc.click('#scanCelBox [data-lcel="ver"]');
    await pc.click('#scanCelBox [data-lcel="nuevo"]');
    const nuevo = await pc.evaluate(() => window.ventoLectorCel.enlace());
    chk('5. «🔄 Desconectar celulares» cambia el código de emparejar', nuevo !== r2.link && /#c=lc/.test(nuevo), [r2.link, nuevo]);
    await pc.evaluate(() => { window.__leidos = []; });
    await cel.evaluate(() => { document.getElementById('manoTxt').value = '55555'; document.getElementById('mano').requestSubmit(); });
    await pc.waitForTimeout(4000);
    chk('5. … y el celular viejo ya no le manda códigos', await pc.evaluate(() => !window.__leidos.includes('55555')), await pc.evaluate(() => window.__leidos));

    // 6. ORDEVA en un celular lee el QR de emparejar: abre el lector ahí mismo
    const app = await cCel.newPage(); app.on('pageerror', e => errs.push('app: ' + e.message));
    await app.goto(BASE + '/index.html'); await app.waitForTimeout(1200);
    await app.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); });
    await app.evaluate(() => { openScanOverlay(() => {}); });
    await app.evaluate(link => scanLeido(link), nuevo);
    chk('6. ORDEVA en el celular lee el QR de emparejar y abre lector.html con ese equipo', await app.waitForURL(/lector\.html#c=lc/, { timeout: 8000 }).then(() => true, () => false), app.url());
    await cCel.close(); await cPC.close();
  }
})();
