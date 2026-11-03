// 📦 ORDEVA 1.78.1 · Productos / Tarifas simples y elegantes (lib/vento-inventario-simple.js). Sin internet.
//  1. Hotel: el título es «Tarifas y consumos» (no «… e disponibilidad»); sin «Precio y margen con foto», sin stock, sin
//     inventario por código, sin etiquetas ni pedido a proveedores; queda «Agregar tarifa» y «Factura del proveedor».
//  2. Restaurante: arriba solo una fila de herramientas («📸 Precio con foto», «🧩 Unir repetidos»); lo demás en una lista
//     de una línea (Inventario por código, Factura, Etiquetas, Insumos y recetas); el buscador no se monta con el contador.
//  3. Tienda: «🛒 Pedido a proveedores» está en las herramientas y funciona; sin stock en nada, no salen los contadores en 0.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  async function abrir(tipo, nombre){
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1000);
    await p.evaluate(t => { const s = document.getElementById('authType'); if(s){ s.value = t; s.dispatchEvent(new Event('change')); } }, tipo);
    await p.fill('#authBiz', nombre); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn');
    await p.waitForFunction(() => document.getElementById('authOverlay').hidden, null, { timeout: 15000 });
    await p.click('#onbSaltar', { timeout: 4000 }).catch(() => {});
    await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    await p.waitForFunction(() => !!window.ventoInventarioSimple, null, { timeout: 10000 });
    await p.evaluate(() => { const b = document.querySelector('nav button[data-view="mesas"]'); if(b) b.click(); });
    await p.waitForTimeout(500);
    await p.evaluate(() => { const b = document.querySelector('nav button[data-view="inventario"]'); if(b) b.click(); }); await p.waitForTimeout(1500);
    return { ctx, p };
  }
  const vis = (p, s) => p.evaluate(s => { const e = document.querySelector(s); return !!e && e.offsetParent !== null && getComputedStyle(e).display !== 'none'; }, s);
  try{
    // 1. Hotel
    const H = await abrir('hotel', 'Hotel Las Palmas'); const h = H.p;
    let v = await h.evaluate(() => ({ t: document.querySelector('#view-inventario .inv-head h2').textContent, grupo: [...document.querySelectorAll('#invGrupo > details')].filter(d => getComputedStyle(d).display !== 'none').map(d => d.id) }));
    chk('1. Hotel: el título dice «🛏️ Tarifas y consumos»', v.t === '🛏️ Tarifas y consumos', v.t);
    chk('1. Hotel: sin «Precio y margen con foto», sin contadores ni avisos de stock', !(await vis(h, '#invPriceBtn')) && !(await vis(h, '#isFoto')) && !(await vis(h, '#invSummary')) && !(await vis(h, '#invAvisos')));
    chk('1. Hotel: en la lista solo «Factura del proveedor» (sin inventario por código ni etiquetas)', JSON.stringify(v.grupo) === '["invFacturaPanel"]', v.grupo);
    chk('1. Hotel: sin «Pedido a proveedores» ni «Unir repetidos»', !(await vis(h, '#llBtn')) && !(await vis(h, '#invDup')));
    chk('1. Hotel: «Agregar tarifa» sigue', await vis(h, '#prodAddPanel') && /Agregar tarifa/.test(await h.textContent('#prodAddTitulo')));
    await H.ctx.close();
    // 2. Restaurante
    const R = await abrir('restaurante', 'Restaurante El Fogón'); const r = R.p;
    v = await r.evaluate(() => ({ t: document.querySelector('#view-inventario .inv-head h2').textContent, herr: [...document.querySelectorAll('#invHerr > *')].filter(x => !x.hidden).map(x => x.id), grupo: [...document.querySelectorAll('#invGrupo > details')].map(d => d.id), small: [...document.querySelectorAll('#invGrupo summary small')].some(s => getComputedStyle(s).display !== 'none') }));
    chk('2. Restaurante: «Productos e inventario» y una fila de herramientas (precio con foto, unir repetidos)', /Productos e inventario/.test(v.t) && v.herr.includes('isFoto') && v.herr.includes('invDup'), v);
    chk('2. Restaurante: la tarjeta grande de precio con foto ya no se ve', !(await vis(r, '#invPriceBtn')));
    chk('2. Restaurante: lo demás en una lista de una línea (código, factura, etiquetas, insumos y recetas)', ['viPanel', 'invFacturaPanel', 'invEtiquetasPanel', 'insumosPanel'].every(i => v.grupo.includes(i)) && !v.small, v);
    v = await r.evaluate(() => { const q = document.getElementById('prodBuscar'), n = document.getElementById('prodBuscarN'); const a = q.getBoundingClientRect(), c = n.getBoundingClientRect(); return { ph: q.placeholder, pr: parseFloat(getComputedStyle(q).paddingRight), anchoN: c.width }; });
    chk('2. El buscador: texto corto y espacio para el contador (no se montan)', /^🔎 Buscar \w+$/.test(v.ph) && v.pr >= v.anchoN, v);
    await r.evaluate(() => document.querySelector('#invGrupo #invFacturaPanel > summary').click()); await r.waitForTimeout(200);
    chk('2. Tocar «Factura del proveedor» la abre', await r.evaluate(() => document.getElementById('invFacturaPanel').open));
    await R.ctx.close();
    // 3. Tienda
    const T = await abrir('minimercado', 'Minimercado La 14'); const t = T.p;
    v = await t.evaluate(() => ({ ll: !!document.querySelector('#invHerr #llBtn'), cero: document.getElementById('invSummary').classList.contains('is-cero') }));
    chk('3. Tienda: «🛒 Pedido a proveedores» en las herramientas', v.ll, v);
    chk('3. Tienda sin stock en nada: no salen los contadores en 0', v.cero && !(await vis(t, '#invSummary')), v);
    await t.evaluate(() => document.getElementById('llBtn').click()); await t.waitForTimeout(300);
    chk('3. «🛒 Pedido a proveedores» abre la lista', await t.evaluate(() => document.getElementById('layaListaOv') && document.getElementById('layaListaOv').classList.contains('show')));
    await T.ctx.close();
    chk('3. Sin errores en la página', errs.length === 0, errs);
  }catch(e){ mal++; console.log('❌ Error: ' + (e.stack || e)); }
  await b.close();
  console.log('\nRESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
