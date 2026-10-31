// 🧮 ORDEVA 1.69.0 · Laya responde preguntas de plata con el motor financiero (las mismas cifras de Estadísticas). Sin internet.
//  1. «¿Qué categoría me deja menos este mes?» / «¿cuál me deja más?» → margen por categoría (con ganancia y ventas).
//  2. «¿Qué producto tiene el menor margen?» → por producto.
//  3. «¿Qué gasto subió este mes?» → frente al mismo tramo del mes pasado.
//  4. «¿Cuánto gané este mes?» → vendido, costo, utilidad bruta, gastos operativos y resultado (sin restar dos veces la mercancía).
//  5. El equipo (no dueño ni administrador) no ve estas cifras. Sin datos, lo dice (no inventa).
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';

(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1200);
    await p.fill('#authBiz', 'Bar Laya'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1500);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    const L = q => p.evaluate(q => { const r = window.Laya.responder(q); return r ? r.text : null; }, q);

    // Sin datos todavía
    let v = await L('laya cuánto gané este mes');
    chk('5. Sin ventas ni gastos: lo dice (no inventa cifras)', /No hay ventas ni gastos/.test(v || ''), v);

    await p.evaluate(() => {
      const hoy = new Date(), ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      const ant = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      data.categories = [{ id: 'cb', name: 'Bebidas' }, { id: 'cc', name: 'Comidas' }];
      data.products = [{ id: 'g', name: 'Gaseosa', price: 3000, cost: 1500, categoryId: 'cb' }, { id: 'h', name: 'Hamburguesa', price: 20000, cost: 16000, categoryId: 'cc' }];
      data.history = [{ id: 'v1', date: hoy.toISOString(), total: 50000, items: [{ productId: 'g', name: 'Gaseosa', price: 3000, cost: 1500, qty: 10 }, { productId: 'h', name: 'Hamburguesa', price: 20000, cost: 16000, qty: 1 }] }];
      data.contab = [
        { id: 'a', tipo: 'gasto', cat: 'servicios', monto: 80000, fecha: ymd(hoy) }, { id: 'b', tipo: 'gasto', cat: 'servicios', monto: 50000, fecha: ymd(ant) },
        { id: 'c', tipo: 'gasto', cat: 'arriendo', monto: 300000, fecha: ymd(new Date(hoy.getFullYear(), hoy.getMonth(), 1)) }, { id: 'd', tipo: 'gasto', cat: 'arriendo', monto: 300000, fecha: ymd(ant) },
        { id: 'e', tipo: 'gasto', cat: 'proveedores', monto: 90000, fecha: ymd(hoy) }
      ];
      saveData();
    });

    v = await L('laya qué categoría me deja menos este mes');
    chk('1. «¿Qué categoría me deja menos?»: Comidas 20 % primero, después Bebidas 50 %', /menos te dejan/.test(v) && v.indexOf('Comidas: margen 20 %') >= 0 && v.indexOf('Comidas') < v.indexOf('Bebidas'), v);
    v = await L('ordeva cuál categoría es la más rentable');
    chk('1. «¿Cuál es la más rentable?»: Bebidas primero (50 %, ganancia $15.000 de $30.000)', /más te dejan/.test(v) && v.indexOf('Bebidas') < v.indexOf('Comidas') && /15\.000 de \$\s?30\.000/.test(v), v);
    v = await L('laya qué producto tiene el margen más bajo');
    chk('2. Por producto: Hamburguesa con el menor margen (20 %)', /Productos/.test(v) && v.indexOf('Hamburguesa') < v.indexOf('Gaseosa'), v);
    v = await L('laya qué gasto subió este mes');
    chk('3. «¿Qué gasto subió?»: Servicios $80.000 (antes $50.000, +60 %); el arriendo igual no sale', /Servicios/.test(v) && /80\.000/.test(v) && /\+60 %/.test(v) && !/Arriendo/.test(v), v);
    v = await L('laya cuánto gané este mes');
    chk('4. «¿Cuánto gané?»: vendido $50.000, utilidad bruta $19.000, gastos operativos $380.000 → pérdida $361.000', /Vendido: \$\s?50\.000/.test(v) && /Utilidad bruta: \$\s?19\.000/.test(v) && /Gastos operativos: \$\s?380\.000/.test(v) && /Pérdida: \$\s?361\.000/.test(v), v);
    chk('4. … y aclara que la mercancía ($90.000) no se resta dos veces', /90\.000, ya están en el costo/.test(v), v);

    await p.evaluate(() => { window.__j = window.ventoRoles.esJefe; window.ventoRoles.esJefe = () => false; });
    v = await L('laya cuánto gané este mes');
    chk('5. El equipo no ve ganancias ni márgenes', /solo los ve el dueño o el administrador/.test(v || ''), v);
    await p.evaluate(() => { window.ventoRoles.esJefe = window.__j; });
    v = await L('laya qué hay en la barra');
    chk('Las demás preguntas de Laya siguen igual (no las toma el motor financiero)', !/margen|Resultado/.test(v || ''), v);

    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ Excepción: ' + (e && e.stack || e)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
