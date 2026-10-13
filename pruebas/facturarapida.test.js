// Lectura de facturas con IA, rápida aunque Google esté saturado (Gemini simulado, sin internet):
//  1. El modelo principal responde «saturado» (503) y el siguiente es lento: arranca un tercero en carrera
//     y la factura sale en ~4 s (antes: reintentos con espera, 20-30 s o «tardó demasiado»).
//  2. La siguiente lectura ya no pierde tiempo con el modelo saturado (se recuerda unos minutos).
//  3. La IA agrega basura después del JSON o lo corta (factura larga): se leen igual los renglones completos.
//  4. Clave mala: se avisa de una vez (sin probar otros modelos).
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';

const renglones = n => Array.from({ length: n }, (_, i) => ['COD' + i + ' PRODUCTO ' + i, 'Producto ' + i, 2, 'UND', 1000 + i, 2 * (1000 + i), 19, null, null, null, 'C' + i, 1, 2]);
const factura = n => JSON.stringify({ p: 'Distribuidora Prueba', f: '2026-10-10', h: { n: 'FE-1', t: 99999 }, i: renglones(n) });
const respuesta = txt => JSON.stringify({ candidates: [{ content: { parts: [{ text: txt }] }, finishReason: 'STOP' }], usageMetadata: {} });
const espera = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    // Comportamiento de cada modelo (se cambia en cada caso)
    let plan = {}; const pedidos = [];
    await ctx.route('**/*', async r => {
      const u = new URL(r.request().url());
      if(u.hostname === 'localhost') return r.continue();
      const m = /\/models\/([\w.-]+):generateContent/.exec(u.pathname);
      if(u.hostname !== 'generativelanguage.googleapis.com' || !m) return r.abort();
      pedidos.push(m[1]);
      const p = plan[m[1]] || { st: 503, ms: 200 };
      await espera(p.ms);
      const body = p.st === 200 ? respuesta(p.txt) : JSON.stringify({ error: { code: p.st, message: p.msg || 'This model is currently experiencing high demand.', status: p.st === 503 ? 'UNAVAILABLE' : 'INVALID_ARGUMENT' } });
      return r.fulfill({ status: p.st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body }).catch(() => {});
    });
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('bar-ai-provider', 'gemini'); localStorage.setItem('bar-gemini-api-key', 'AIzaPruebaPruebaPruebaPruebaPrueba12345'); localStorage.setItem('cm-tutorial-seen', '1'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1500);
    await p.fill('#authBiz', 'Bar F'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1200);
    const leer = () => p.evaluate(async () => {
      const t = performance.now();
      try{ const i = await recognizeInvoiceWithAI('data:image/jpeg;base64,/9j/AAAA'); return { ms: Math.round(performance.now() - t), items: i.items.length, prov: i.supplier }; }
      catch(e){ return { ms: Math.round(performance.now() - t), err: e.message }; }
    });

    // 1. Principal saturado + segundo lento → el tercero gana
    plan = { 'gemini-3.5-flash-lite': { st: 503, ms: 300 }, 'gemini-3.5-flash': { st: 200, ms: 9000, txt: factura(5) }, 'gemini-3-flash-preview': { st: 200, ms: 600, txt: factura(18) } };
    pedidos.length = 0;
    let r = await leer();
    chk('1. Principal saturado y el siguiente lento: la factura sale igual (18 renglones)', r.items === 18 && r.prov === 'Distribuidora Prueba', r);
    chk('1. … y rápido (menos de 6 s; antes 20-30 s)', r.ms < 6000, r);
    chk('1. El modelo saturado se probó UNA sola vez (sin esperar reintentos)', pedidos.filter(m => m === 'gemini-3.5-flash-lite').length === 1, pedidos);

    // 2. La siguiente lectura ya no empieza por el modelo saturado
    pedidos.length = 0;
    plan['gemini-3.5-flash'] = { st: 200, ms: 500, txt: factura(7) };
    r = await leer();
    chk('2. La siguiente lectura no empieza por el modelo saturado', pedidos[0] !== 'gemini-3.5-flash-lite' && r.items === 7, { pedidos, r });
    chk('2. … y sale en menos de 2 s', r.ms < 2000, r);

    // 3. Basura después del JSON, y JSON cortado
    await p.evaluate(() => localStorage.removeItem('vento-ia-saturados'));
    plan = { 'gemini-3.5-flash-lite': { st: 200, ms: 300, txt: factura(22) + '\n2]]}\n}' } };
    r = await leer();
    chk('3. Basura después del JSON: se leen los 22 renglones', r.items === 22, r);
    const largo = factura(40);
    plan = { 'gemini-3.5-flash-lite': { st: 200, ms: 300, txt: largo.slice(0, Math.floor(largo.length * 0.7)) } };
    r = await leer();
    chk('3. Respuesta cortada (factura larga): se conservan los renglones completos', r.items >= 25 && r.items < 40, r);

    // 4. Clave mala: se avisa de una vez
    pedidos.length = 0;
    plan = { 'gemini-3.5-flash-lite': { st: 400, ms: 200, msg: 'API key not valid. Please pass a valid API key.' } };
    r = await leer();
    chk('4. Clave mala: mensaje claro, sin probar otros modelos', /API key de Gemini no es válida/.test(r.err || '') && pedidos.length === 1 && r.ms < 2000, { r, pedidos });
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
