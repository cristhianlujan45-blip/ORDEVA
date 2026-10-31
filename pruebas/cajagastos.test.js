// 🗂️📊💵 ORDEVA 1.69.0 · Caja y gastos. Sin internet.
//  1. Tipos de gasto: directo (mercancía, insumos), operativo, administrativo (nómina, impuestos), financiero (bancos).
//  2. Contabilidad: «📊 Frente al período anterior» (este mes vs el mismo tramo del mes pasado) y «🗂️ Gastos por tipo».
//  3. Cierre de caja: lo que entregaron los clientes en efectivo y las vueltas, en el arqueo y en el cierre guardado.
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
    await p.fill('#authBiz', 'Tienda Gastos'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1500);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});

    // ===== 1. Tipos =====
    let v = await p.evaluate(() => { const F = window.ventoFinanzas; return { t: ['proveedores', 'insumos', 'arriendo', 'servicios', 'nomina', 'impuestos', 'bancos', 'publicidad', 'fletes', 'otros', 'inventada'].map(c => F.tipoGasto(c)),
      pt: F.gastosPorTipo([{ cat: 'proveedores', monto: 100 }, { cat: 'arriendo', monto: 50 }, { cat: 'nomina', monto: 30 }, { cat: 'bancos', monto: 5 }, { tipo: 'ingreso', cat: 'otros', monto: 999 }]), var: [F.variacion(150, 100), F.variacion(50, 100), F.variacion(10, 0)] }; });
    chk('1. Tipos de gasto: mercancía/insumos = directo, arriendo/servicios = operativo, nómina/impuestos = administrativo, bancos = financiero', JSON.stringify(v.t) === JSON.stringify(['directo', 'directo', 'operativo', 'operativo', 'administrativo', 'administrativo', 'financiero', 'operativo', 'directo', 'operativo', 'operativo']), v.t);
    chk('1. Suma por tipo (los ingresos no cuentan)', JSON.stringify(v.pt) === JSON.stringify({ directo: 100, operativo: 50, administrativo: 30, financiero: 5 }), v.pt);
    chk('1. Variación: +50 %, −50 %, y sin dato si antes era 0', JSON.stringify(v.var) === JSON.stringify([50, -50, null]), v.var);

    // ===== 2. Contabilidad =====
    await p.evaluate(() => {
      const hoy = new Date(), ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      const mesPasado = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      data.contab = [
        { id: 'g1', tipo: 'gasto', cat: 'arriendo', monto: 400000, fecha: ymd(new Date(hoy.getFullYear(), hoy.getMonth(), 1)) },
        { id: 'g2', tipo: 'gasto', cat: 'nomina', monto: 300000, fecha: ymd(hoy) },
        { id: 'g3', tipo: 'gasto', cat: 'bancos', monto: 20000, fecha: ymd(hoy) },
        { id: 'g0', tipo: 'gasto', cat: 'arriendo', monto: 400000, fecha: ymd(mesPasado) }
      ];
      data.history = [{ id: 'h1', date: hoy.toISOString(), total: 50000, items: [{ name: 'X', price: 50000, qty: 1 }], payments: [{ method: 'efectivo', amount: 50000 }] },
        { id: 'h0', date: new Date(mesPasado.getTime() + 3600e3).toISOString(), total: 40000, items: [{ name: 'X', price: 40000, qty: 1 }], payments: [{ method: 'efectivo', amount: 40000 }] }];
      saveData();
      document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      const bt = document.querySelector('nav button[data-view="contabilidad"]') || document.querySelector('[data-go="contabilidad"]'); if(bt) bt.click();
      ctPeriodo = 'mes'; renderConta();
    });
    await p.waitForTimeout(300);
    v = await p.evaluate(() => ({ comp: (document.getElementById('ctComp') || {}).innerText || '', tipos: (document.getElementById('ctTipos') || {}).innerText || '' }));
    chk('2. «Frente al período anterior»: compara con el mismo tramo del mes pasado (cobrado $50.000, antes $40.000, ▲ 25 %)', /mismo tramo del mes pasado/.test(v.comp) && /50\.000/.test(v.comp) && /40\.000/.test(v.comp) && /▲ 25 %/.test(v.comp), v.comp);
    chk('2. Gastos: $720.000, antes $400.000 (▲ 80 %)', /720\.000/.test(v.comp) && /▲ 80 %/.test(v.comp), v.comp);
    chk('2. «Gastos por tipo»: operativos $400.000, administrativos $300.000, financieros $20.000', /Operativos/.test(v.tipos) && /400\.000/.test(v.tipos) && /Administrativos/.test(v.tipos) && /300\.000/.test(v.tipos) && /Financieros/.test(v.tipos) && /20\.000/.test(v.tipos), v.tipos);

    // ===== 3. Vueltas en el cierre =====
    await p.evaluate(async () => {
      data.history = []; data.closures = []; data.contab = []; data.products = [{ id: 'a', name: 'Almuerzo', price: 10500 }]; saveData();
      document.querySelector('nav button[data-view="mesas"]').click();
      window.ventoTurno.abrir(100000);
      window.ventoPOS.vaciar(); window.ventoPOS.agregar('a', 1);
      await window.ventoPOS.cobrar({ pago: { method: 'efectivo', nota: 'Efectivo', metodo: 'efectivo', recibido: 50000, vueltas: 39500 } });
    });
    await p.waitForTimeout(300);
    v = await p.evaluate(() => { const s = computeClosureStats(null, new Date(Date.now() + 1000).toISOString()); return { ef: s.totalEfectivo, rec: s.totalRecibido, vu: s.totalVueltas }; });
    chk('3. Cálculo del cierre: efectivo cobrado $10.500, entregaron $50.000, vueltas $39.500', v.ef === 10500 && v.rec === 50000 && v.vu === 39500, v);
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); closeCashRegister(); }); await p.waitForSelector('#confirmOverlay.show', { timeout: 4000 }); await p.click('#confirmOkBtn');
    await p.waitForSelector('.vt-dif', { timeout: 5000 });
    v = await p.evaluate(() => document.querySelector('.vt-dif').closest('.modal, .vt-box, div').parentElement.innerText);
    chk('3. El arqueo dice lo que entregaron y las vueltas, y el efectivo que debe haber es base + lo cobrado ($110.500)', /entregaron \$\s?50\.000/.test(v) && /39\.500 de vueltas/.test(v) && /110\.500/.test(v), v);
    await p.evaluate(() => { const b = [...document.querySelectorAll('button[data-sin]')].pop(); b.click(); });
    await p.waitForTimeout(500);
    v = await p.evaluate(() => ({ c: data.closures[0] && { rec: data.closures[0].totalRecibido, vu: data.closures[0].totalVueltas }, txt: (document.getElementById('closureReportBody') || document.body).innerText }));
    chk('3. El cierre guardado y su resumen traen lo recibido y las vueltas', v.c && v.c.rec === 50000 && v.c.vu === 39500 && /vueltas entregadas/i.test(v.txt), v);

    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ Excepción: ' + (e && e.stack || e)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
