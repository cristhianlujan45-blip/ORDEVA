// 📌 ORDEVA 1.81.3 · «Ya no me deja subir los QR que ya están impresos». Sin internet (como el programa de PC en Windows).
// El lector del navegador no existe en Chrome de Windows ni en el programa de PC, y el de internet no carga sin internet:
// salía «No pude leer ningún código QR». Ahora se usa el lector propio de ORDEVA (ZXing, sin internet).
//  1. Ajustes → Pedidos: «📌 Fijar mis QR impresos» a la vista.
//  2. Subir la FOTO de un QR impreso (link viejo …/cuentas/pedido.html?mesa=3&c=…&v=…): se lee y queda el mismo link.
//  3. «Fijar»: ORDEVA usa el canal y el código de esa mesa de los QR impresos (no se generan QR nuevos).
//  4. «📷 Escanear con la cámara el QR pegado en la mesa»: cada QR leído se agrega a la lista, sin repetir.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
  const pausa = ms => new Promise(r => setTimeout(r, ms));
  const LINK3 = 'https://cristhianlujan45-blip.github.io/cuentas/pedido.html?mesa=3&w=573001234567&c=vitoqrimpreso01&v=k9x8y7w6';
  const LINK5 = 'https://cristhianlujan45-blip.github.io/cuentas/pedido.html?mesa=5&w=573001234567&c=vitoqrimpreso01&v=m5n4b3v2';
  try{
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());   // sin internet
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} delete window.BarcodeDetector; });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await pausa(1000);
    await p.evaluate(() => { const s = document.getElementById('authType'); s.value = 'bar'; s.dispatchEvent(new Event('change')); });
    await p.fill('#authBiz', 'Bar QR Impresos'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await pausa(1500);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    // La «foto» del QR impreso: una imagen PNG con el QR de la mesa 3 (con margen blanco, como una foto recortada).
    const png = await p.evaluate(link => new Promise(r => { const d = document.createElement('div'); new QRCode(d, { text: link, width: 360, height: 360, correctLevel: QRCode.CorrectLevel.M });
      setTimeout(() => { const src = d.querySelector('canvas') || d.querySelector('img'); const c = document.createElement('canvas'); c.width = c.height = 480; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 480, 480); x.drawImage(src, 60, 60, 360, 360); r(c.toDataURL('image/png').split(',')[1]); }, 300); }), LINK3);
    // ===== 1 =====
    await p.evaluate(() => { document.querySelector('nav button[data-view="ajustes"]').click(); const c = document.querySelector('.ajustes-cat[data-cat="pedidos"]'); if(c) c.click(); });
    await pausa(400);
    chk('1. Ajustes → Pedidos: «📌 Fijar mis QR impresos» a la vista', await p.evaluate(() => { const b = document.getElementById('qrFijoBtn'); return !!b && b.offsetParent !== null; }));
    await p.click('#qrFijoBtn'); await pausa(300);
    // ===== 2 =====
    await p.setInputFiles('#qrFijoFoto', { name: 'qr-mesa-3.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
    const leyo = await p.waitForFunction(() => /leído|No pude/.test(document.getElementById('qrFijoFotoMsg').textContent), null, { timeout: 30000 }).then(() => true, () => false);
    let v = await p.evaluate(() => ({ msg: document.getElementById('qrFijoFotoMsg').textContent, txt: document.getElementById('qrFijoTxt').value }));
    chk('2. Sin internet y sin el lector del navegador: la foto del QR impreso se lee', leyo && /1 de 1/.test(v.msg) && !/No pude/.test(v.msg), v);
    chk('2. … y queda exactamente el mismo link (no uno nuevo)', v.txt.trim() === LINK3, v.txt);
    // ===== 4 =====
    await p.click('#qrFijoCamBtn'); await pausa(300);
    v = await p.evaluate(([l3, l5]) => { scanLeido(l5); scanLeido(l3); const so = document.getElementById('scanOverlay'), fo = document.getElementById('qrFijoOverlay');
      const enFrente = !!(so.compareDocumentPosition(fo) & Node.DOCUMENT_POSITION_PRECEDING);
      closeScanOverlay(); return { txt: document.getElementById('qrFijoTxt').value, msg: document.getElementById('qrFijoFotoMsg').textContent, enFrente }; }, [LINK3, LINK5]);
    chk('4. Con la cámara: la cámara queda delante de la ventana', v.enFrente, v);
    chk('4. … el QR de la mesa 5 se agrega y el de la 3 (ya estaba) no se repite', v.txt.split('\n').length === 2 && v.txt.includes(LINK5) && /2 mesas leídas/.test(v.msg), v);
    // ===== 3 =====
    await p.click('#qrFijoOk'); await pausa(500);
    await p.click('#confirmOkBtn', { timeout: 2000 }).catch(() => {}); await pausa(500);
    v = await p.evaluate(() => { const c = JSON.parse(localStorage.getItem(window.ventoClave ? window.ventoClave('vito_qr') : 'vito_qr') || '{}'); return { topic: c.topic, fijo: !!c.fijo, v3: c.v && c.v[3], v5: c.v && c.v[5], impreso: c.urlImpreso || c.url, datos: data.qrFijo && data.qrFijo.topic }; });
    chk('3. «Fijar»: usa el canal y los códigos de las mesas de los QR impresos', v.topic === 'vitoqrimpreso01' && v.fijo && v.v3 === 'k9x8y7w6' && v.v5 === 'm5n4b3v2', v);
    chk('3. … guardado también en los datos del negocio (sirve en otros equipos)', v.datos === 'vitoqrimpreso01', v);
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ Excepción: ' + (e && e.stack || e)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
