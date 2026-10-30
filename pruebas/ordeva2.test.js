// ◐ ORDEVA 2.0 · diseño y 🏠 Inicio (lib/ordeva2.js, lib/ordeva2.css).
//  1. Un negocio nuevo abre con la apariencia «◐ ORDEVA 2.0» (body.o2) y, en el computador, la navegación lateral con
//     todas las secciones (aunque la Vista sencilla esté prendida). En el celular sigue la barra de abajo de 4.
//  2. 🏠 Inicio con datos REALES: ventas de hoy = suma del historial de hoy; por cobrar = saldo de las cuentas abiertas;
//     gastos = los de Contabilidad; utilidad = vendido − costo − gastos; más vendidos y alerta de existencias bajas.
//  3. Sin ventas: todo en $ 0 y «Todavía no hay ventas»; nada inventado.
//  4. Período «7 días» suma también las ventas de días anteriores; el cambio % compara con el período anterior.
//  5. Un empleado sin el permiso de estadísticas no ve Inicio (ni en la barra ni en «Más»).
//  6. Quien tenía «Noche violeta» de fábrica pasa una vez a ORDEVA 2.0; otro diseño elegido se respeta.
//  7. «Navegación lateral» se puede apagar en Ajustes → Apariencia (vuelve la barra de siempre).
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  const abrir = async (ancho, alto, extra) => {
    const ctx = await b.newContext({ viewport: { width: ancho, height: alto } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(x => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); if(x) Object.entries(x).forEach(([k, v]) => localStorage.setItem(k, v)); }catch(e){} }, extra || null);
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1200);
    await p.fill('#authBiz', 'Bar Dos'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1500);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    return { ctx, p };
  };
  const visibles = p => p.evaluate(() => [...document.querySelectorAll('.tabbar nav > button, .nav-more')].filter(x => x.offsetParent !== null && getComputedStyle(x).display !== 'none').map(x => x.dataset.view || x.id || 'mas'));
  try{
    // ===== 1. Computador =====
    let { ctx, p } = await abrir(1280, 800);
    let v = await p.evaluate(() => ({ tema: data.theme, o2: document.body.classList.contains('o2'), lado: document.body.classList.contains('o2-lado'), vs: document.body.classList.contains('vs-on'),
      tb: (r => ({ x: r.left, w: Math.round(r.width), h: Math.round(r.height) }))(document.querySelector('.tabbar').getBoundingClientRect()), pos: getComputedStyle(document.querySelector('.tabbar')).position, marca: !!document.getElementById('o2Marca') && document.getElementById('o2Marca').offsetParent !== null }));
    chk('1. Negocio nuevo: apariencia «◐ ORDEVA 2.0» (body.o2)', v.tema === 'ordeva2' && v.o2, v);
    chk('1. Computador: navegación lateral fija a la izquierda, con la marca ORDEVA', v.lado && v.pos === 'fixed' && v.tb.x === 0 && v.tb.w === 248 && v.tb.h === 800 && v.marca, v);
    let vis = await visibles(p);
    chk('1. … con todas las secciones aunque la Vista sencilla esté prendida (Inicio primero)', v.vs && vis[0] === 'inicio' && !vis.includes('navMoreBtn') && ['mesas', 'inventario', 'contabilidad', 'estadisticas', 'historial', 'ajustes'].every(x => vis.includes(x)), vis);

    // ===== 3. Sin ventas =====
    await p.click('nav button[data-view="inicio"]'); await p.waitForTimeout(300);
    v = await p.evaluate(() => ({ activa: document.getElementById('view-inicio').classList.contains('active'), ventas: document.querySelector('#o2KVentas strong').textContent, txt: document.getElementById('o2Inicio').innerText }));
    chk('3. Sin ventas: Inicio abre con $ 0 y «Todavía no hay ventas» (nada inventado)', v.activa && /\$\s?0$/.test(v.ventas.trim()) && /Todavía no hay ventas/.test(v.txt) && /Aún no hay ventas/.test(v.txt), v);

    // ===== 2. Con datos =====
    await p.evaluate(() => {
      const ini = new Date(); ini.setHours(0, 0, 0, 0); const ya = Date.now() - ini.getTime();   // horas de hoy que YA pasaron (la prueba sirve a cualquier hora)
      const hoy = new Date(ini.getTime() + ya / 3), ayer = new Date(ini.getTime() - 12 * 36e5), antes = new Date(ini.getTime() - 60 * 36e5);
      data.products = [{ id: 'cv', name: 'Cerveza', price: 5000, cost: 2500, stock: 3, minStock: 5 }, { id: 'ag', name: 'Agua', price: 3000, cost: 1000, stock: 40, minStock: 5 }];
      data.history = [
        { id: 'a', date: hoy.toISOString(), total: 13000, table: 1, items: [{ productId: 'cv', name: 'Cerveza', price: 5000, cost: 2500, qty: 2 }, { productId: 'ag', name: 'Agua', price: 3000, cost: 1000, qty: 1 }], payments: [{ method: 'efectivo', amount: 13000 }] },
        { id: 'b', date: new Date(ini.getTime() + 2 * ya / 3).toISOString(), total: 15000, table: null, items: [{ productId: 'cv', name: 'Cerveza', price: 5000, cost: 2500, qty: 3 }], payments: [{ method: 'transferencia', amount: 15000 }] },
        { id: 'c', date: ayer.toISOString(), total: 20000, table: 2, items: [{ productId: 'ag', name: 'Agua', price: 3000, cost: 1000, qty: 5 }, { productId: 'cv', name: 'Cerveza', price: 5000, cost: 2500, qty: 1 }], payments: [{ method: 'efectivo', amount: 20000 }] },
        { id: 'd', date: antes.toISOString(), total: 9000, table: 3, items: [{ productId: 'ag', name: 'Agua', price: 3000, cost: 1000, qty: 3 }], payments: [{ method: 'efectivo', amount: 9000 }] }];
      data.contab = [{ id: 'g', tipo: 'gasto', cat: 'servicios', monto: 4000, fecha: (d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'))(new Date()), metodo: 'efectivo', nota: 'Luz' }];
      data.tables[4] = { items: [{ productId: 'cv', name: 'Cerveza', price: 5000, qty: 2 }], payments: [{ method: 'efectivo', amount: 3000 }], people: [] };
      saveData(); window.ordeva2.pintar();
    });
    const num = s => +String(s).replace(/[^\d−-]/g, '').replace('−', '-');
    v = await p.evaluate(() => ({ ventas: document.querySelector('#o2KVentas strong').textContent, kv: document.querySelector('#o2KVentas').innerText, pend: document.querySelector('#o2KPend strong').textContent, kp: document.querySelector('#o2KPend').innerText,
      gastos: document.querySelector('#o2KGastos strong').textContent, res: [...document.querySelectorAll('#o2Res b')].map(x => x.textContent), top: [...document.querySelectorAll('#o2Top li .o2-nom')].map(x => x.textContent), al: document.getElementById('o2Alertas') && document.getElementById('o2Alertas').innerText }));
    chk('2. Ventas de hoy = suma del historial de hoy ($ 28.000, 2 ventas) y ▲ contra ayer ($ 20.000 → +40%)', num(v.ventas) === 28000 && /2 ventas/.test(v.kv) && /▲ 40%/.test(v.kv), v);
    chk('2. Por cobrar = saldo de las cuentas abiertas ($ 10.000 − $ 3.000 abonado = $ 7.000, 1 cuenta)', num(v.pend) === 7000 && /1 cuenta abierta/.test(v.kp), v);
    chk('2. Gastos = los de Contabilidad ($ 4.000)', num(v.gastos) === 4000, v);
    // vendido 28.000; costo 2×2.500 + 1×1.000 + 3×2.500 = 13.500; utilidad = 28.000 − 13.500 − 4.000 = 10.500
    chk('2. Resultado: vendido 28.000 · cobrado 28.000 · costo 13.500 · gastos 4.000 · utilidad 10.500', JSON.stringify(v.res.map(num)) === JSON.stringify([28000, 28000, 13500, 4000, 10500]), v.res);
    chk('2. Más vendidos de hoy: Cerveza primero (5 unidades, $ 25.000), luego Agua', v.top[0] === 'Cerveza' && v.top[1] === 'Agua', v.top);
    chk('2. Alerta: existencias bajas de Cerveza (3, mínimo 5)', /Existencias bajas \(1\)/.test(v.al || '') && /Cerveza \(3\)/.test(v.al || ''), v.al);
    v = await p.evaluate(() => { const c = window.ordeva2.calc('hoy'), d = data.history.filter(h => new Date(h.date).toDateString() === new Date().toDateString()).reduce((s, h) => s + h.total, 0);
      const s = computeClosureStats(null, new Date().toISOString()); return { calc: c.ventas.total, d, caja: c.caja && c.caja.v, efectivo: s.totalEfectivo }; });
    chk('2. Las cifras salen de las mismas fuentes que el cierre de caja (efectivo $ 42.000 sin cierre aún)', v.calc === v.d && v.caja === v.efectivo && v.caja === 42000, v);

    // ===== 4. Período =====
    await p.click('[data-o2p="7d"]'); await p.waitForTimeout(200);
    v = await p.evaluate(() => ({ ventas: document.querySelector('#o2KVentas strong').textContent, kv: document.querySelector('#o2KVentas').innerText, puntos: document.querySelectorAll('.o2-graf circle').length }));
    chk('4. «7 días»: suma también ayer y hace 3 días ($ 57.000, 4 ventas) y la gráfica tiene 7 días', num(v.ventas) === 57000 && /4 ventas/.test(v.kv) && v.puntos === 7, v);
    await p.click('[data-o2ir="inventario"]').catch(() => {});
    await p.click('nav button[data-view="inicio"]'); await p.click('#o2Alertas button'); await p.waitForTimeout(200);
    chk('2. «Ver» en la alerta lleva a Productos / inventario', await p.evaluate(() => document.getElementById('view-inventario').classList.contains('active')));

    // ===== 8. Productos como tabla en el computador =====
    await p.evaluate(() => document.querySelector('nav button[data-view="inventario"]').click()); await p.waitForTimeout(400);
    v = await p.evaluate(() => { const h = document.querySelector('#productList > .o2-tabla-h'), r = document.querySelector('#productList > .product-row'); return { cab: h ? getComputedStyle(h).display : null, txt: h ? h.textContent : '', costo: r ? (r.querySelector('.o2-c-costo') || {}).textContent : '', vis: r ? getComputedStyle(r.querySelector('.o2-c-costo')).display : '', grid: r ? getComputedStyle(r.querySelector('.pr-sum')).display : '' }; });
    chk('8. Productos en el computador: tabla con Producto · Existencias · Costo · Precio · Margen', v.cab === 'grid' && /Producto.*Existencias.*Costo.*Precio.*Margen/.test(v.txt) && v.grid === 'grid' && v.vis === 'block' && /\$\s?2\.500/.test(v.costo), v);

    // ===== 5. Empleado sin permiso =====
    await p.evaluate(() => { document.body.classList.add('rol-equipo', 'no-estadisticas'); });
    vis = await visibles(p);
    v = await p.evaluate(() => getComputedStyle(document.querySelector('.more-tile[data-go="inicio"]')).display);
    chk('5. Sin permiso de estadísticas: Inicio no se ve (barra ni «Más»)', !vis.includes('inicio') && v === 'none', { vis, v });
    await p.evaluate(() => document.body.classList.remove('rol-equipo', 'no-estadisticas'));

    // ===== 7. Apagar la navegación lateral =====
    await p.evaluate(() => { document.querySelector('nav button[data-view="ajustes"]').click(); document.querySelector('.ajustes-cat[data-cat="apariencia"]').click(); });
    await p.waitForTimeout(250);
    v = await p.evaluate(() => { const g = document.getElementById('o2Ajuste'); return { visible: !!g && g.offsetParent !== null, on: document.getElementById('o2LadoOn').checked, tarjeta: !!document.querySelector('#paletteGrid .palette-card[data-key="ordeva2"].selected') }; });
    chk('7. Ajustes → Apariencia: «◐ ORDEVA 2.0» con «Navegación lateral» prendida y la apariencia marcada', v.visible && v.on && v.tarjeta, v);
    await p.click('#o2LadoOn + .switch-slider'); await p.waitForTimeout(250);
    v = await p.evaluate(() => ({ lado: document.body.classList.contains('o2-lado'), pos: getComputedStyle(document.querySelector('.tabbar')).position, guardado: localStorage.getItem('vento_o2_lado') }));
    vis = await visibles(p);
    chk('7. Apagada: vuelve la barra de siempre (sin lateral; con la Vista sencilla, 4 botones)', !v.lado && v.pos !== 'fixed' && v.guardado === '0' && vis.length === 4, { v, vis });
    await ctx.close();

    // ===== 1. Celular =====
    ({ ctx, p } = await abrir(390, 844));
    v = await p.evaluate(() => ({ lado: document.body.classList.contains('o2-lado'), pos: getComputedStyle(document.querySelector('.tabbar')).position, abajo: Math.round(document.querySelector('.tabbar').getBoundingClientRect().bottom), marca: getComputedStyle(document.getElementById('o2Marca')).display }));
    vis = await visibles(p);
    chk('1. Celular: la barra de abajo de siempre (4 con la Vista sencilla), sin la lateral', v.pos === 'fixed' && v.abajo === 844 && v.marca === 'none' && vis.length === 4 && vis.includes('navMoreBtn'), { v, vis });
    await p.click('.nav-more'); await p.waitForTimeout(250); await p.click('.more-tile[data-go="inicio"]'); await p.waitForTimeout(300);
    v = await p.evaluate(() => ({ activa: document.getElementById('view-inicio').classList.contains('active'), ancho: document.documentElement.scrollWidth }));
    chk('1. Celular: «Más» → 🏠 Inicio abre el resumen, sin desbordar a lo ancho', v.activa && v.ancho <= 390, v);
    await p.evaluate(() => { data.products = [{ id: 'x', name: 'Agua', price: 3000, cost: 1000, stock: 4 }]; saveData(); document.querySelector('nav button[data-view="inventario"]').click(); }); await p.waitForTimeout(400);
    v = await p.evaluate(() => { const h = document.querySelector('#productList > .o2-tabla-h'), c = document.querySelector('#productList .o2-c-costo'); return { cab: h ? getComputedStyle(h).display : null, col: c ? getComputedStyle(c).display : null }; });
    chk('8. En el celular la lista de productos sigue como siempre (sin columnas de tabla)', v.cab === 'none' && v.col === 'none', v);
    await ctx.close();

    // ===== 6. Diseños de antes =====
    for(const [tema, espera] of [['noche', 'ordeva2'], ['menta', 'menta']]){
      ({ ctx, p } = await abrir(1280, 800));
      v = await p.evaluate(async t => { data.theme = t; delete data.o2Tema; await saveData(); return true; }, tema);
      await p.reload(); await p.waitForTimeout(1800);
      await p.fill('#authUser', 'ana').catch(() => {}); await p.fill('#authPass', 'clave123').catch(() => {}); await p.click('#authBtn').catch(() => {}); await p.waitForTimeout(1200);
      v = await p.evaluate(() => ({ tema: data.theme, marca: data.o2Tema, o2: document.body.classList.contains('o2') }));
      chk('6. Tenía «' + tema + '» → queda «' + espera + '» (una sola vez)', v.tema === espera && v.marca === 1 && v.o2 === (espera === 'ordeva2'), v);
      await ctx.close();
    }
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
