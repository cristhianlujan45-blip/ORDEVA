// 🎨 ORDEVA 2.0 en las pantallas de trabajo (1.66.4): caja, cuentas, cocina y estadísticas. Sin internet.
//  1. Caja (computador): tarjetas con la foto grande arriba, «+» negro, carrito con la miniatura de cada producto,
//     total y COBRAR negro a todo lo ancho. Tocar una tarjeta sigue sumando al carrito.
//  2. Caja (celular): fotos en cuadrado, sin miniaturas en el carrito (no cabe) y COBRAR a la vista.
//  3. Cuentas: la cuenta abierta dice desde qué hora está abierta (del primer producto anotado); la vacía no dice nada.
//  4. Cocina (computador): las 4 columnas de estados lado a lado, también la vacía; el botón sigue avanzando el pedido.
//  5. Cocina en otra apariencia: igual que antes (las columnas no se ven como cajas).
//  6. Estadísticas: el globo del gráfico escondido no se ve (antes quedaba una píldora blanca vacía) y sin «SALES//01».
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';

(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  const abrir = async (ancho, alto) => {
    const ctx = await b.newContext({ viewport: { width: ancho, height: alto } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1200);
    await p.fill('#authBiz', 'Bar Pantallas'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1500);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await p.evaluate(() => {
      document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      const cv = document.createElement('canvas'); cv.width = cv.height = 40; const g = cv.getContext('2d'); g.fillStyle = '#b45309'; g.fillRect(0, 0, 40, 40);
      data.categories = [{ id: 'k1', name: 'Comidas' }, { id: 'k2', name: 'Bebidas' }];
      data.products = [{ id: 'h', name: 'Hamburguesa', price: 18000, categoryId: 'k1', foto: true }, { id: 'c', name: 'Café', price: 5000, categoryId: 'k2' }, { id: 'a', name: 'Agua', price: 3000, categoryId: 'k2' }];
      fotosCache.h = cv.toDataURL('image/png');
      saveData();
    });
    return { ctx, p };
  };
  const caja = p => p.evaluate(() => {
    const r = document.querySelector('#pzCajaOv .pz-caja-root'), t = r.querySelector('[data-add="h"]'), cara = t.querySelector('.pz-cara'), mas = getComputedStyle(t, '::after');
    const cb = r.querySelector('.pz-cobrar'), rc = cb.getBoundingClientRect(), cart = r.querySelector('.pz-cart').getBoundingClientRect(), mini = r.querySelector('.pz-linea .pz-lmini');
    return { tile: Math.round(t.getBoundingClientRect().width), cara: Math.round(cara.getBoundingClientRect().width), caraH: Math.round(cara.getBoundingClientRect().height), img: !!cara.querySelector('img'),
      mas: mas.content, masBg: mas.backgroundColor, lineas: r.querySelectorAll('.pz-linea').length, total: r.querySelector('.pz-total b').textContent,
      mini: mini ? { vis: getComputedStyle(mini).display !== 'none', img: !!mini.querySelector('img') } : null,
      cobrar: { bg: getComputedStyle(cb).backgroundColor, w: Math.round(rc.width), cartW: Math.round(cart.width), visible: rc.bottom <= innerHeight && rc.top >= 0 } };
  });
  try{
    // ===== 1. Caja en el computador =====
    let { ctx, p } = await abrir(1366, 800);
    await p.evaluate(() => window.ventoPOS.abrirCaja()); await p.waitForTimeout(400);
    await p.evaluate(() => { const r = document.querySelector('#pzCajaOv .pz-caja-root'); r.querySelector('[data-add="h"]').click(); r.querySelector('[data-add="c"]').click(); r.querySelector('[data-add="c"]').click(); });
    await p.waitForTimeout(300);
    let v = await caja(p);
    chk('1. Tocar las tarjetas suma al carrito (Hamburguesa + 2 Café = $ 28.000)', v.lineas === 2 && /28\.000/.test(v.total), v);
    chk('1. La foto ocupa todo el ancho de la tarjeta, arriba (4:3)', v.img && v.cara >= v.tile - 20 && Math.abs(v.caraH - v.cara * 3 / 4) <= 2, v);
    chk('1. Cada tarjeta tiene el «+» negro', v.mas === '"+"' && v.masBg === 'rgb(11, 12, 14)', v);
    chk('1. El carrito muestra la miniatura de cada producto (la foto de la hamburguesa)', v.mini && v.mini.vis && v.mini.img, v.mini);
    chk('1. COBRAR negro y a todo lo ancho del carrito', v.cobrar.bg === 'rgb(11, 12, 14)' && v.cobrar.w >= v.cobrar.cartW - 40, v.cobrar);
    await ctx.close();

    // ===== 2. Caja en el celular =====
    ({ ctx, p } = await abrir(390, 844));
    await p.evaluate(() => window.ventoPOS.abrirCaja()); await p.waitForTimeout(400);
    await p.evaluate(() => document.querySelector('#pzCajaOv [data-add="h"]').click()); await p.waitForTimeout(300);
    v = await caja(p);
    chk('2. Celular: foto cuadrada y sin miniaturas en el carrito', Math.abs(v.cara - v.caraH) <= 2 && v.mini && !v.mini.vis, v);
    chk('2. Celular: COBRAR se ve en la pantalla', v.cobrar.visible, v.cobrar);
    await ctx.close();

    // ===== 3. Cuentas: desde qué hora =====
    ({ ctx, p } = await abrir(1366, 800));
    v = await p.evaluate(() => {
      const at = new Date(); at.setHours(9, 5, 0, 0);
      data.tables[2] = { items: [{ productId: 'c', name: 'Café', price: 5000, qty: 2, history: [{ qty: 2, at: at.getTime() }] }, { productId: 'a', name: 'Agua', price: 3000, qty: 1, history: [{ qty: 1, at: at.getTime() + 36e5 }] }], payments: [], people: [] };
      data.tables[3] = { items: [{ productId: 'a', name: 'Agua', price: 3000, qty: 1 }], payments: [], people: [] };   // sin historial: no se inventa la hora
      saveData(); renderMesas();
      const card = n => [...document.querySelectorAll('#tableGrid .ticket')].find(c => new RegExp('\\b' + n + '$').test(c.querySelector('.num').textContent.trim()));
      const t = n => { const d = card(n) && card(n).querySelector('.tk-desde'); return d ? d.textContent : null; };
      return { c2: t(2), c3: t(3), c1: t(1) };
    });
    chk('3. La cuenta abierta dice «Desde las 9:05» (el primer producto anotado)', /Desde las 9:05/.test(v.c2 || ''), v);
    chk('3. Sin historial o vacía: no dice ninguna hora', v.c3 === null && v.c1 === null, v);

    // ===== 4. Cocina en el computador =====
    await p.evaluate(() => {
      const E = window.vitoPedidos;
      E.entrante({ id: 'k2', mesa: 2, items: [{ n: 'Café', q: 2 }] }, 'mesero:Ana');
      E.entrante({ id: 'k3', mesa: 3, items: [{ n: 'Agua', q: 1 }] }, 'mesero:Ana');
      E.cambiar('k3', 'recibido'); E.cambiar('k3', 'preparacion');
      const b = document.querySelector('nav button[data-view="cocina"]'); b.hidden = false; b.click(); renderCocina();
    });
    await p.waitForTimeout(300);
    const cocina = () => p.evaluate(() => [...document.querySelectorAll('#kdsTickets .kds-tablero > .kds-col')].map(c => { const r = c.getBoundingClientRect(); return { cls: c.className.replace('kds-col ', ''), x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), n: c.querySelectorAll('.kds-ticket').length, vacio: !!c.querySelector('.kds-col-vacio') && getComputedStyle(c.querySelector('.kds-col-vacio')).display !== 'none' }; }));
    v = await cocina();
    const est = v.map(c => c.cls.split(' ')[0]);
    chk('4. Cocina: 4 columnas en orden (por aceptar, recibidos, en preparación, listos)', JSON.stringify(est) === JSON.stringify(['kds-col-nuevo', 'kds-col-recibido', 'kds-col-preparacion', 'kds-col-listo']), est);
    chk('4. … lado a lado, del mismo ancho', v.length === 4 && v.every(c => c.y === v[0].y && Math.abs(c.w - v[0].w) <= 1) && v[0].x < v[1].x && v[1].x < v[2].x && v[2].x < v[3].x, v);
    const r = v.find(c => c.cls.includes('recibido')), pr = v.find(c => c.cls.includes('preparacion')), li = v.find(c => c.cls.includes('listo'));
    chk('4. Cada pedido en la columna de su estado, y la vacía dice «Nada aquí»', r.n === 1 && pr.n === 1 && li.n === 0 && li.vacio, v);
    await p.click('.kds-col-preparacion .kds-act .btn-warn'); await p.waitForTimeout(300);
    v = await cocina();
    chk('4. El botón «🔔 Listo» pasa el pedido a «Listos para entregar»', v.find(c => c.cls.includes('listo')).n === 1 && v.find(c => c.cls.includes('preparacion')).n === 0, v);

    // ===== 6. Estadísticas =====
    await p.evaluate(() => {
      const h = []; for(let d = 0; d < 5; d++) h.push({ id: 's' + d, date: new Date(Date.now() - d * 864e5 - 6e5).toISOString(), total: 10000, table: 1, items: [{ productId: 'c', name: 'Café', price: 5000, qty: 2 }], payments: [{ method: 'efectivo', amount: 10000 }] });
      data.history = h; saveData(); document.querySelector('nav button[data-view="estadisticas"]').click();
    });
    await p.waitForTimeout(800);
    v = await p.evaluate(() => { const t = document.querySelector('#tableroVento .tb-tip'), c = document.querySelector('#tableroVento .tb-cod'); return { hay: !!t, hidden: t && t.hidden, display: t && getComputedStyle(t).display, cod: c ? getComputedStyle(c).display : 'none' }; });
    chk('6. Estadísticas: el globo del gráfico, escondido, no se ve', v.hay && v.hidden && v.display === 'none', v);
    chk('6. Sin los códigos «SALES//01» en ORDEVA 2.0', v.cod === 'none', v);

    // ===== 5. Cocina en otra apariencia: como antes =====
    await p.evaluate(() => { data.theme = 'menta'; applyPalette('menta'); document.querySelector('nav button[data-view="cocina"]').click(); renderCocina(); });
    await p.waitForTimeout(300);
    v = await p.evaluate(() => ({ o2: document.body.classList.contains('o2'), cols: [...document.querySelectorAll('#kdsTickets .kds-col')].map(c => getComputedStyle(c).display), tab: getComputedStyle(document.querySelector('#kdsTickets .kds-tablero')).display,
      vacio: [...document.querySelectorAll('#kdsTickets .kds-col-vacio, #kdsTickets .kds-col-h0')].map(x => getComputedStyle(x).display) }));
    chk('5. Otra apariencia: las columnas no se dibujan como cajas y las vacías no se ven (como antes)', !v.o2 && v.tab === 'contents' && v.cols.every(x => x === 'contents') && v.vacio.every(x => x === 'none'), v);
    await ctx.close();
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
