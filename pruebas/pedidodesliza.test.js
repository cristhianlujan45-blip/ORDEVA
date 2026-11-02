// 📜 El deslizamiento en la página de pedidos de los clientes (pedido.html, ORDEVA 1.72.6). El dueño: «cuando bajo vuelve
// a subir y se carga». La carta se volvía a pintar entera con cada venta del negocio (la carta se publica sola) y al volver a
// la página: se devolvía arriba y las fotos se cargaban otra vez.
//  1. Con la carta abierta y deslizada hacia abajo, volver a la página (cambiar de app y regresar) NO la mueve ni la
//     vuelve a pintar si nada cambió.
//  2. Llega la MISMA carta otra vez: no se toca.
//  3. Llega una carta con un cambio (un precio): se actualiza y el cliente sigue en el mismo punto.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const C = 'PRUEBAqrDESLIZA1';
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/pedido.html?mesa=4&c=' + C;
const CARTA = { y: 'restaurante', t: 'Menú', n: 'Restaurante Prueba', p: Array.from({ length: 40 }, (_, i) => ['Plato número ' + (i + 1), 10000 + i * 500, 'Platos fuertes', 0, 0, 'Arroz, papa y ensalada'] ) };
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 400) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 760 }, isMobile: true, hasTouch: true, locale: 'es-CO' });
    await ctx.route('**/*', r => {
      const u = r.request().url();
      if(/rpc\/canal_leer/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      if(/rpc\/canal_publicar/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"id":"1","time":1,"event":"message"}' });
      return new URL(u).hostname === 'localhost' ? r.continue() : r.abort();
    });
    await ctx.addInitScript(([c, carta]) => { try{ localStorage.setItem('cat_' + c, JSON.stringify(carta)); }catch(e){} }, [C, CARTA]);
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(1500);
    await p.evaluate(() => document.getElementById('catBtn').click()); await p.waitForTimeout(400);
    const estado = () => p.evaluate(() => { const car = document.getElementById('carta'), primera = document.querySelector('#cat .cardgrid > *');
      return { abierta: !car.hidden, scroll: Math.round(car.scrollTop), alto: car.scrollHeight, tarjetas: document.querySelectorAll('#cat .cardgrid > *').length, mismo: primera === window.__primera, texto: (document.getElementById('cat').innerText.match(/\$\s?10\.000|\$\s?11\.000/) || [''])[0] }; });
    await p.evaluate(() => { const car = document.getElementById('carta'); car.scrollTop = 900; window.__primera = document.querySelector('#cat .cardgrid > *'); });
    await p.waitForTimeout(200);
    let e0 = await estado();
    chk('Se abre la carta con 40 platos y se desliza hacia abajo', e0.abierta && e0.tarjetas === 40 && e0.scroll >= 800, e0);

    // 1. Volver a la página
    await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
    await p.waitForTimeout(1500);
    let e1 = await estado();
    chk('1. Volver a la página: la carta sigue en el mismo punto y no se vuelve a pintar', Math.abs(e1.scroll - e0.scroll) <= 2 && e1.mismo, { e0, e1 });

    // 2. La misma carta otra vez
    await p.evaluate(() => repintarCat()); await p.waitForTimeout(300);
    let e2 = await estado();
    chk('2. Llega la MISMA carta: no se toca nada', Math.abs(e2.scroll - e0.scroll) <= 2 && e2.mismo, e2);

    // 3. Una carta con un cambio
    await p.evaluate(() => { cat = JSON.parse(JSON.stringify(cat)); cat.p[0][1] = 11000; repintarCat(); });
    await p.waitForTimeout(400);
    let e3 = await estado();
    chk('3. Llega un cambio de precio: se actualiza y el cliente sigue en el mismo punto (no vuelve arriba)', Math.abs(e3.scroll - e0.scroll) <= 2 && !e3.mismo && /11\.000/.test(await p.evaluate(() => document.getElementById('cat').innerText)), e3);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
