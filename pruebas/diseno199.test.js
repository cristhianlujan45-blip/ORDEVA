// 🎨 ORDEVA 1.99.2 · Auditoría de diseño (puente/egm/AUDITORIA-1.98-DISENO.md), segundo lote.
//  1. (hallazgo 1) La pantalla de entrar usa los colores de ORDEVA 2.0 (fondo claro, botón negro), no la violeta.
//  2. (hallazgo 10) «Más» tiene una ✕ que cierra, y en la vista sencilla va por grupos: Cada día, Mi negocio, Extras…
//     «Historial» se llama «Facturas».
//  3. (hallazgo 18) En el celular, el Inicio muestra primero las ventas y después el bloque de atajos.
//  4. (hallazgo 14) En la Caja del celular, con la venta vacía, el carrito ya no tapa los productos.
//  5. (hallazgo 15) El verde de «pagado» es más oscuro (se lee sobre blanco).
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  const pausa = ms => new Promise(r => setTimeout(r, ms));
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await pausa(1000);
    let v = await p.evaluate(() => { const o = document.getElementById('authOverlay'), c = o.querySelector('.auth-card'), btn = document.getElementById('authBtn');
      return { fondo: getComputedStyle(o).backgroundColor, tarjeta: getComputedStyle(c).backgroundColor, boton: getComputedStyle(btn).backgroundColor, letraBoton: getComputedStyle(btn).color }; });
    chk('1. Entrar: fondo claro de ORDEVA 2.0, tarjeta blanca y botón negro con letra blanca', v.fondo === 'rgb(244, 245, 247)' && v.tarjeta === 'rgb(255, 255, 255)' && v.boton === 'rgb(17, 18, 20)' && v.letraBoton === 'rgb(255, 255, 255)', v);
    await p.evaluate(() => { const s = document.getElementById('authType'); s.value = 'restaurante'; s.dispatchEvent(new Event('change')); });
    await p.fill('#authBiz', 'Fonda Diseño'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await pausa(1500);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await p.evaluate(async () => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.products = [1, 2, 3, 4, 5, 6].map(i => ({ id: 'p' + i, name: 'Producto ' + i, price: 1000 * i }));
      data.history = [{ id: 'h1', date: new Date().toISOString(), table: 1, items: [{ name: 'Producto 1', qty: 1, price: 1000 }], payments: [{ method: 'efectivo', amount: 1000 }], total: 1000, debt: 0 }];
      await saveData(); try{ renderAll(); }catch(e){} });
    await pausa(300);

    // 2 · Más
    await p.click('#navMoreBtn'); await pausa(300);
    v = await p.evaluate(() => { const g = document.querySelector('#navMoreSheet .more-grid'), vis = [...g.children].filter(x => x.offsetParent);
      vis.sort((a, b2) => (+getComputedStyle(a).order) - (+getComputedStyle(b2).order));
      return { x: !!document.getElementById('navMoreX') && document.getElementById('navMoreX').offsetParent !== null, xTam: Math.round(document.getElementById('navMoreX').getBoundingClientRect().height),
        orden: vis.map(x => x.classList.contains('vs-grp') ? '#' + x.textContent : x.dataset.go), fact: (document.querySelector('#navMoreSheet [data-go="historial"] strong') || {}).textContent, sencilla: document.body.classList.contains('vs-on') }; });
    chk('2. «Más» tiene una ✕ de 44 px', v.x && v.xTam >= 44, v);
    chk('2. «Historial» ahora se llama «Facturas»', v.fact === 'Facturas', v.fact);
    if(v.sencilla){
      const o = v.orden.join(',');
      chk('2. Vista sencilla: primero «Cada día» (Inicio, Facturas, Libreta…), luego «Mi negocio», «Extras», «Ayudantes» y «Mi cuenta»', /^#Cada día,inicio,historial,libreta/.test(o) && o.indexOf('#Mi negocio') < o.indexOf('#Extras') && o.indexOf('#Extras') < o.indexOf('#Ayudantes') && o.indexOf('#Ayudantes') < o.indexOf('#Mi cuenta') && o.indexOf('musica') > o.indexOf('#Extras') && o.indexOf('contabilidad') > o.indexOf('#Mi negocio') && o.indexOf('contabilidad') < o.indexOf('#Extras'), v.orden);
    } else chk('2. (sin vista sencilla: el orden de siempre)', true);
    await p.click('#navMoreX'); await pausa(200);
    chk('2. La ✕ cierra «Más»', await p.evaluate(() => !document.getElementById('navMoreSheet').classList.contains('show')));

    // 3 · Inicio
    await p.evaluate(() => { const b2 = document.querySelector('nav button[data-view="inicio"]') || document.getElementById('o2InicioMas'); b2 && b2.click(); });
    await pausa(500);
    v = await p.evaluate(() => { const k = document.querySelector('.o2-kpis'), m = document.querySelector('.o2-movil'); if(!k || !m) return { k: !!k, m: !!m };
      const rk = k.getBoundingClientRect(), rm = m.getBoundingClientRect(); return { ventasArriba: rk.top < rm.top, ventasVisibles: rk.top < window.innerHeight - 100, movil: getComputedStyle(m).display }; });
    chk('3. Inicio en el celular: las ventas arriba (a la vista) y los atajos debajo', v.ventasArriba && v.ventasVisibles && v.movil !== 'none', v);

    // 4 · Caja
    await p.click('#posNav'); await pausa(800);
    v = await p.evaluate(() => { const c = document.querySelector('.pz-cart'); if(!c) return null; const r = c.getBoundingClientRect(), h = document.querySelector('.pz-herr2');
      return { vacia: c.classList.contains('pz-vacia'), alto: Math.round(r.height), pantalla: window.innerHeight, filaHerr: h && !h.hidden ? getComputedStyle(h).flexWrap : 'sin', ancho: document.documentElement.scrollWidth <= window.innerWidth + 1 }; });
    chk('4. Caja vacía en el celular: el carrito ocupa menos de un tercio de la pantalla y nada se sale de lado', v && v.vacia && v.alto < v.pantalla / 3 && v.ancho && (v.filaHerr === 'nowrap' || v.filaHerr === 'sin'), v);
    await p.locator('.pz-grid .pz-tile:visible').first().click(); await pausa(400);
    chk('4. Al agregar un producto el carrito vuelve a ser el de siempre (deja de estar «vacío»)', await p.evaluate(() => !document.querySelector('.pz-cart').classList.contains('pz-vacia')));

    // 5 · Verde
    v = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--paid').trim());
    chk('5. El verde de «pagado» de ORDEVA 2.0 es el más oscuro (#15803d)', v.toLowerCase() === '#15803d', v);
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.message)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
