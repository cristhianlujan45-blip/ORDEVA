// 🏷️ Factura del proveedor con categorías solas (1.66.1). Gemini simulado, sin internet.
//  1. La IA dice la categoría de cada renglón: si el negocio ya la tiene («Cervezas»), se usa esa.
//  2. Si no existe («Lácteos»), sale propuesta como «🆕 Lácteos (nueva…)» y se crea al aplicar la factura.
//  3. Sin categoría de la IA, se reconoce por el producto (Jabón Rey → «Aseo», nueva).
//  4. Lo que no se reconoce queda «Sin categoría» (nada inventado).
//  5. Al aplicar: los productos quedan con su categoría y cada categoría nueva se crea UNA vez.
//  6. Si se cancela la factura, no se crea ninguna categoría.
//  7. A la IA se le pasan las categorías que ya tiene el negocio.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
const fila = (orig, nom, qty, precio, cat) => [orig, nom, qty, 'UND', precio, qty * precio, 19, null, null, null, null, 1, qty, cat];
const factura = JSON.stringify({ p: 'Distribuidora Prueba', f: '2026-10-30', h: { n: 'FE-9', t: 100000 }, i: [
  fila('AG LIGH LAT 330', 'Cerveza Águila Light lata 330 ml', 24, 2500, 'Cervezas'),
  fila('LCH ALPINA 1L', 'Leche Alpina entera 1 L', 6, 4200, 'Lácteos'),
  fila('JABON REY 300G', 'Jabón Rey 300 g', 3, 2800, null),
  fila('ZX-991 PIEZA', 'Pieza ZX-991', 2, 1500, null)
] });
const respuesta = txt => JSON.stringify({ candidates: [{ content: { parts: [{ text: txt }] }, finishReason: 'STOP' }], usageMetadata: {} });

(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [], prompts = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', async r => {
      const u = new URL(r.request().url());
      if(u.hostname === 'localhost') return r.continue();
      if(u.hostname === 'generativelanguage.googleapis.com' && /:generateContent/.test(u.pathname)){
        try{ prompts.push(JSON.stringify(r.request().postDataJSON())); }catch(e){}
        return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: respuesta(factura) });
      }
      return r.abort();
    });
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('bar-ai-provider', 'gemini'); localStorage.setItem('bar-gemini-api-key', 'AIzaPruebaPruebaPruebaPruebaPrueba12345'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1500);
    await p.fill('#authBiz', 'Tienda F'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1200);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); data.categories = [{ id: 'cv', name: 'Cervezas' }]; data.products = []; saveData(); });
    const abrir = () => p.evaluate(async () => { const info = await recognizeInvoiceWithAI('data:image/jpeg;base64,/9j/AAAA'); invoiceOpen(info); });
    const cats = () => p.evaluate(() => [...document.querySelectorAll('#invoiceOverlay .iv-item')].map(r => { const s = r.querySelector('.iv-cat'); return { nombre: (r.querySelector('.iv-name') || {}).value || '', valor: s ? s.value : null, texto: s && s.selectedOptions[0] ? s.selectedOptions[0].textContent : '' }; }));

    // 6 primero: se abre y se cancela → no se crea nada
    await abrir(); await p.waitForTimeout(600);
    let c = await cats();
    chk('Se abre la revisión con los 4 renglones', c.length === 4, c);
    await p.click('#invoiceCancelBtn').catch(() => {}); await p.waitForTimeout(300);
    await p.evaluate(() => { const o = document.getElementById('confirmOverlay'); if(o && o.classList.contains('show')) document.getElementById('confirmOkBtn').click(); });
    await p.waitForTimeout(300);
    chk('6. Al cancelar no se crea ninguna categoría nueva', await p.evaluate(() => data.categories.map(x => x.name).join('|') === 'Cervezas'), await p.evaluate(() => data.categories.map(x => x.name)));
    chk('7. A la IA se le pasan las categorías del negocio («Cervezas») y se le pide la categoría', prompts.some(t => /EXACTAMENTE ese nombre: Cervezas/.test(t) && /categoria = la categor/.test(t)), prompts.length);

    // 1-4: lo que propone la revisión
    await abrir(); await p.waitForTimeout(600);
    c = await cats();
    chk('1. Águila → la categoría que ya existe «Cervezas»', c[0] && c[0].valor === 'cv', c[0]);
    chk('2. Leche Alpina → «🆕 Lácteos (nueva, se crea al aplicar)»', c[1] && c[1].valor === 'nueva:Lácteos' && /🆕 Lácteos/.test(c[1].texto), c[1]);
    chk('3. Jabón Rey (sin categoría de la IA) → «🆕 Aseo» por el producto', c[2] && c[2].valor === 'nueva:Aseo', c[2]);
    chk('4. Lo que no se reconoce queda «Sin categoría»', c[3] && c[3].valor === '', c[3]);

    // 5. Aplicar
    await p.click('#invoiceApplyBtn'); await p.waitForTimeout(400);
    for(let k = 0; k < 4; k++){ await p.evaluate(() => { const o = document.getElementById('confirmOverlay'); if(o && o.classList.contains('show')) document.getElementById('confirmOkBtn').click(); }); await p.waitForTimeout(300); }
    await p.waitForTimeout(500);
    const r = await p.evaluate(() => { const cn = id => (data.categories.find(k => k.id === id) || {}).name || ''; return { cats: data.categories.map(x => x.name), prods: data.products.map(x => [x.name, cn(x.categoryId)]) }; });
    const de = n => (r.prods.find(x => new RegExp(n, 'i').test(x[0])) || [])[1];
    chk('5. Los productos quedan con su categoría (Águila → Cervezas, Leche → Lácteos, Jabón → Aseo, Pieza → sin)', de('guila') === 'Cervezas' && de('Leche') === 'Lácteos' && de('Jab') === 'Aseo' && de('Pieza') === '', r.prods);
    chk('5. Cada categoría nueva se creó UNA vez (Cervezas, Lácteos, Aseo)', r.cats.length === 3 && ['Cervezas', 'Lácteos', 'Aseo'].every(n => r.cats.filter(x => x === n).length === 1), r.cats);
    // Una segunda factura igual no repite categorías
    await abrir(); await p.waitForTimeout(600);
    c = await cats();
    chk('5. En la siguiente factura, Leche y Jabón ya usan las categorías creadas (no «nueva»)', c[1] && !/^nueva:/.test(c[1].valor) && c[1].valor && c[2] && !/^nueva:/.test(c[2].valor) && c[2].valor, c);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
