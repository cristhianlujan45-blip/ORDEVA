// 🪪 ORDEVA 1.76.0 · Registro de huéspedes (lib/vento-huespedes.js). Sin internet.
//  1. Habitación vacía: «🪪 Registrar huésped» (check-in). Con cuenta y sin registro: «⚠️ Falta el registro del huésped».
//  2. El formulario pide nombre completo y documento; con datos buenos guarda, con acompañantes, y la cuenta lo muestra.
//  3. Al cobrar, el registro queda con la venta (llegada, salida, noches) y la habitación queda sin huésped.
//  4. «🪪 Huéspedes»: el registro del mes, buscar, y «⬇️ Excel» con las columnas de la tarjeta.
//  5. Llegó por una reserva: el formulario arranca con nombre, celular y una fila por cada acompañante.
//  6. En un restaurante no aparece nada de esto. Sin errores.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  async function abrir(tipo, nombre){
    const ctx = await b.newContext({ viewport: { width: 1366, height: 800 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1000);
    await p.evaluate(t => { const s = document.getElementById('authType'); if(s){ s.value = t; s.dispatchEvent(new Event('change')); } }, tipo);
    await p.fill('#authBiz', nombre); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn');
    await p.waitForFunction(() => document.getElementById('authOverlay').hidden, null, { timeout: 15000 });
    await p.click('#onbSaltar', { timeout: 4000 }).catch(() => {});
    await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    await p.waitForFunction(() => !!window.ventoMapa && !!window.ventoHuespedes, null, { timeout: 10000 });
    await p.evaluate(() => { const b = document.querySelector('nav button[data-view="mesas"]'); if(b) b.click(); });
    await p.waitForTimeout(500);
    return { ctx, p };
  }
  try{
    const { p, ctx } = await abrir('hotel', 'Hotel Las Palmas');
    await p.evaluate(() => { window.__xlsx = []; const o = window.ventoXlsx.descargar; window.ventoXlsx.descargar = (n, h) => { window.__xlsx.push({ n, h }); }; openTableModal(1); });
    await p.waitForTimeout(800);
    const caja = () => p.evaluate(() => { const b = document.getElementById('hpBox'); return { vis: !!b && !b.hidden && b.offsetParent !== null, t: b ? b.innerText.replace(/\s+/g, ' ') : '', falta: !!b && b.classList.contains('hp-falta') }; });
    let v = await caja();
    chk('1. Habitación vacía: «🪪 Registrar huésped» para el check-in', v.vis && /Registrar huésped/.test(v.t) && !v.falta, v);
    await p.evaluate(() => { const pr = data.products.find(x => /habitaci/i.test(x.name)) || data.products[0]; addFavoriteToTable(pr.id); });
    await p.waitForTimeout(800);
    v = await caja();
    chk('1. Con cuenta y sin registro: «⚠️ Falta el registro del huésped»', v.vis && /Falta el registro del huésped/.test(v.t) && v.falta, v);
    await p.click('#hpBox [data-hp="editar"]'); await p.waitForTimeout(300);
    await p.fill('#hpOv [data-k="nombre"]', 'Ana'); await p.fill('#hpOv [data-k="doc"]', '1020304050');
    await p.click('#hpOv [data-hp="guardar"]'); await p.waitForTimeout(200);
    v = await p.evaluate(() => ({ msg: document.getElementById('hpMsg').textContent, abierto: document.getElementById('hpOv').classList.contains('show'), h: data.tables[1].huesped }));
    chk('2. Sin el nombre completo no guarda y lo dice', /nombre completo/.test(v.msg) && v.abierto && !v.h, v);
    await p.fill('#hpOv [data-k="nombre"]', 'Ana María Ruiz'); await p.fill('#hpOv [data-k="doc"]', '1.020.304.050');
    await p.fill('#hpOv [data-k="procedencia"]', 'Bogotá'); await p.selectOption('#hpOv [data-k="motivo"]', 'Negocios / trabajo');
    await p.click('#hpOv [data-hp="mas"]'); await p.fill('#hpOv .hp-a [data-a="nombre"]', 'Luis Ruiz'); await p.fill('#hpOv .hp-a [data-a="doc"]', '99887766');
    await p.click('#hpOv [data-hp="guardar"]'); await p.waitForTimeout(800);
    v = await p.evaluate(() => ({ h: data.tables[1].huesped, abierto: document.getElementById('hpOv').classList.contains('show') }));
    chk('2. Guardado: nombre, documento sin puntos, procedencia, motivo y 1 acompañante', !v.abierto && v.h && v.h.nombre === 'Ana María Ruiz' && v.h.doc === '1020304050' && v.h.tipoDoc === 'CC' && v.h.procedencia === 'Bogotá' && v.h.motivo === 'Negocios / trabajo' && v.h.acomp.length === 1 && v.h.acomp[0].nombre === 'Luis Ruiz', v);
    v = await caja();
    chk('2. La cuenta muestra «🪪 Ana María Ruiz · CC 1020304050 · 2 personas»', /Ana María Ruiz · CC 1020304050 · 2 personas/.test(v.t) && !v.falta, v);
    // 3. Cobrar
    await p.evaluate(() => { const b = [document.getElementById('vsCobrarBtn'), document.getElementById('chargeBtn')].find(x => x && x.offsetParent); b.click(); }); await p.waitForTimeout(500);
    await p.evaluate(() => { const b = [...document.querySelectorAll('button[data-m="efectivo"]')].find(x => x.offsetParent); b && b.click(); }); await p.waitForTimeout(800);
    v = await p.evaluate(() => { const e = data.history[0] || {}; return { h: e.huesped && e.huesped.nombre, entrada: !!e.entrada, noches: e.noches, mesa: data.tables[1].huesped }; });
    chk('3. Al cobrar, el registro queda con la venta (con llegada y noches) y la habitación queda sin huésped', v.h === 'Ana María Ruiz' && v.entrada && v.noches === 1 && !v.mesa, v);
    // 4. Lista y Excel
    await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    await p.waitForSelector('#hpBtn', { timeout: 4000 });
    await p.click('#hpBtn'); await p.waitForTimeout(300);
    v = await p.evaluate(() => document.getElementById('hpLista').innerText.replace(/\s+/g, ' '));
    chk('4. «🪪 Huéspedes»: el registro del mes con su habitación', /1 registro · 2 personas/.test(v) && /Ana María Ruiz/.test(v) && /CC 1020304050/.test(v) && /de Bogotá/.test(v), v.slice(0, 400));
    await p.fill('#hpLista [data-hl="buscar"]', 'pedro'); await p.waitForTimeout(150);
    v = await p.evaluate(() => [...document.querySelectorAll('#hpLista .hp-fila')].filter(f => !f.hidden).length);
    chk('4. Buscar «pedro» no muestra a Ana', v === 0, v);
    await p.click('#hpLista [data-hl="excel"]'); await p.waitForTimeout(300);
    v = await p.evaluate(() => { const x = window.__xlsx[0]; return x ? { n: x.n, cab: x.h[0].filas[0], fila: x.h[0].filas[1] } : null; });
    chk('4. «⬇️ Excel»: Huespedes-…xlsx con las columnas de la tarjeta y los datos', v && /^Huespedes-Hotel-Las-Palmas-\d{4}-\d{2}\.xlsx$/.test(v.n) && v.cab.includes('Número de documento') && v.cab.includes('Motivo del viaje') && v.fila.includes('Ana María Ruiz') && v.fila.includes('1020304050') && v.fila.includes('Luis Ruiz (99887766)') && v.fila.includes(1), v);
    // 5. Desde una reserva
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); data.tables[2].huespedPre = { nombre: 'Carlos Pérez', telefono: '3001234567', personas: 3 }; openTableModal(2); });
    await p.waitForTimeout(700);
    await p.click('#hpBox [data-hp="editar"]'); await p.waitForTimeout(300);
    v = await p.evaluate(() => ({ n: document.querySelector('#hpOv [data-k="nombre"]').value, t: document.querySelector('#hpOv [data-k="telefono"]').value, a: document.querySelectorAll('#hpOv .hp-a').length }));
    chk('5. Llegó por reserva: nombre y celular puestos, y 2 filas de acompañantes (3 personas)', v.n === 'Carlos Pérez' && v.t === '3001234567' && v.a === 2, v);
    await ctx.close();
    // 6. Restaurante
    const R = await abrir('restaurante', 'Restaurante El Fogón');
    await R.p.evaluate(() => openTableModal(1)); await R.p.waitForTimeout(700);
    v = await R.p.evaluate(() => ({ box: !!document.getElementById('hpBox') && !document.getElementById('hpBox').hidden, btn: !!document.getElementById('hpBtn') }));
    chk('6. En un restaurante no aparece el registro de huéspedes', !v.box && !v.btn, v);
    chk('6. Sin errores en la página', errs.length === 0, errs);
  }catch(e){ mal++; console.log('❌ Error: ' + (e.stack || e)); }
  await b.close();
  console.log('\nRESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
