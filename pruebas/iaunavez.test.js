// IA para leer facturas, configurada UNA sola vez (Gemini simulado, sin internet):
//  1. Sin IA configurada, al escanear una factura se ofrece «⚡ Leer facturas con IA» → «Configurar IA» abre la ventana.
//  2. La ventana explica los 2 pasos y trae «🔑 Sacar mi clave gratis» (aistudio.google.com/apikey).
//  3. Pegar la clave y «Guardar» = guardar Y comprobar: «✅ Listo…». Desde la 1.53.0 la clave NO va en los datos del
//     negocio (se comparten con todos los equipos y van a los respaldos): sin la nube queda solo en este equipo, y con
//     Vento Nube queda cifrada en el servidor (lo prueba iaclave.test.js).
//  4. El mismo día no se vuelve a preguntar.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
const CLAVE = 'AIzaPruebaUnaVez0000000000000000000000';

(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    let llamadas = 0;
    await ctx.route('**/*', async r => {
      const u = new URL(r.request().url());
      if(u.hostname === 'localhost') return r.continue();
      if(u.hostname === 'generativelanguage.googleapis.com'){
        llamadas++;
        const k = r.request().headers()['x-goog-api-key'];
        if(k !== CLAVE) return r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: { code: 400, message: 'API key not valid.', status: 'INVALID_ARGUMENT' } }) });
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: 'OK' }] } }] }) });
      }
      return r.abort();
    });
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1500);
    await p.fill('#authBiz', 'Bar IA'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1200);
    await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));

    // Escanear (dos fotos: sin la vista previa de una sola foto)
    const escanear = () => p.evaluate(() => {
      window.VitoOfflineOCR = { scanInvoiceFiles: async () => { window.__offline = (window.__offline || 0) + 1; return { supplier: '', date: '', items: [] }; } };
      const png = () => new File([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), c => c.charCodeAt(0))], 'f.png', { type: 'image/png' });
      leerFactura([png(), png()], document.getElementById('invInvoiceGalBtn'), document.getElementById('invoiceGalInput'));
    });
    await escanear();
    const ofrece = await p.waitForFunction(() => document.getElementById('confirmOverlay').classList.contains('show') && /Leer facturas con IA/.test(document.getElementById('confirmTitle').textContent), null, { timeout: 6000 }).then(() => true, () => false);
    chk('1. Sin IA, al escanear se ofrece «⚡ Leer facturas con IA» (una sola vez para todo el negocio)', ofrece && /UNA sola vez/.test(await p.textContent('#confirmMessage')), await p.textContent('#confirmMessage').catch(() => ''));
    await p.click('#confirmOkBtn');
    chk('1. «Configurar IA» abre la ventana de la IA', await p.waitForSelector('#aiCfgOverlay', { timeout: 4000 }).then(() => true, () => false));
    const help = await p.textContent('#aiCfgHelp');
    chk('2. Explica los pasos y trae «🔑 Sacar mi clave gratis» (aistudio.google.com/apikey)', /una sola vez/.test(help) && await p.getAttribute('#aiCfgHelp a', 'href') === 'https://aistudio.google.com/apikey', help);
    await p.fill('#aiCfgKey', 'AIzaClaveMalaMalaMala000000000000000000');
    await p.click('#aiCfgSave');
    const malo = await p.waitForFunction(() => /no funcionó/.test(document.getElementById('aiCfgStatus').textContent), null, { timeout: 15000 }).then(() => true, () => false);
    chk('3. Clave mala: «Guardar» avisa que no funcionó (y por qué)', malo && /no es válida/.test(await p.textContent('#aiCfgStatus')), await p.textContent('#aiCfgStatus'));
    await p.fill('#aiCfgKey', CLAVE);
    await p.click('#aiCfgSave');
    const listo = await p.waitForFunction(() => /✅ Listo/.test(document.getElementById('aiCfgStatus').textContent), null, { timeout: 15000 }).then(() => true, () => false);
    chk('3. «Guardar» guarda y comprueba de una vez: «✅ Listo: la IA quedó configurada…»', listo, await p.textContent('#aiCfgStatus'));
    chk('3. La clave queda en este equipo y NO en los datos del negocio (que se comparten y van a los respaldos)', await p.evaluate(k => localStorage.getItem('bar-gemini-api-key') === k && !('iaClave' in data) && hasAIKey() && !JSON.stringify(data).includes(k), CLAVE));
    await p.click('#aiCfgClose');

    // 4. Sin IA otra vez (otro celular sin la clave): el mismo día no se vuelve a preguntar
    await p.evaluate(() => { localStorage.removeItem('bar-gemini-api-key'); delete data.iaClave; });
    await escanear();
    await p.waitForTimeout(800);
    chk('4. El mismo día no se vuelve a preguntar (se lee sin internet)', !(await p.evaluate(() => document.getElementById('confirmOverlay').classList.contains('show'))) && await p.evaluate(() => window.__offline >= 1));
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
