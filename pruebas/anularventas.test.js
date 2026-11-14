// 🚫 ORDEVA 1.99.1 · Anular en vez de borrar, y guardar el «antes» al corregir (plan: puente/egm/PLAN-ANULAR-VENTAS.md).
//  1. Anular una venta: sale de las ventas, el resumen baja, el inventario vuelve y queda en «🚫 Anuladas» con motivo.
//  2. Las anuladas son de solo lectura (sin Corregir ni Anular) y se pueden buscar y descargar con «Estado = ANULADA».
//  3. Corregir dos veces: dos líneas «antes → ahora» en el detalle. Corregir a cero = anulación «corregida a cero».
//  4. Anular un día: ventas y cierres de caja pasan a «Anuladas»; pregunta el motivo y queda en la actividad del equipo.
//  5. Una venta anulada no vuelve como vendida aunque otro equipo todavía la tuviera.
//  6. Al volver a abrir todo sigue igual; «Restablecer» no deja anuladas.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 800) : '')); } };
  const pausa = ms => new Promise(r => setTimeout(r, ms));
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    await ctx.clock.setSystemTime(new Date(2026, 10, 14, 15, 0, 0));
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await pausa(1000);
    await p.evaluate(() => { const s = document.getElementById('authType'); s.value = 'restaurante'; s.dispatchEvent(new Event('change')); });
    await p.fill('#authBiz', 'Fonda Anula'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await pausa(1500);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    const sembrar = () => p.evaluate(async () => {
      document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      const f = (d, h) => new Date(2026, 10, 14 - d, h, 0, 0).toISOString();
      const v = (id, d, h, mesa, its, extra) => { const total = its.reduce((s, i) => s + i.price * i.qty, 0); return Object.assign({ id, date: f(d, h), table: mesa, tableName: 'Mesa ' + mesa, items: its, payments: [{ method: 'efectivo', amount: total }], total, debt: 0, by: 'ana' }, extra || {}); };
      data.products = [{ id: 'cv', name: 'Cerveza', price: 5000, stock: 10 }, { id: 'bp', name: 'Bandeja', price: 30000 }];
      data.history = [
        v('a1', 0, 13, 1, [{ name: 'Cerveza', qty: 2, price: 5000 }], { invoiceNo: 'F-10' }),
        v('a2', 0, 12, 2, [{ name: 'Bandeja', qty: 3, price: 30000 }, { name: 'Cerveza', qty: 1, price: 5000 }], { invoiceNo: 'F-9' }),
        v('a3', 0, 11, 3, [{ name: 'Bandeja', qty: 1, price: 30000 }], { invoiceNo: 'F-8' }),
        v('b1', 3, 20, 4, [{ name: 'Bandeja', qty: 1, price: 30000 }], { invoiceNo: 'F-5' }),
        v('b2', 3, 19, 5, [{ name: 'Cerveza', qty: 4, price: 5000 }], { invoiceNo: 'F-4' })
      ];
      data.closures = [{ id: 'c-b', date: f(3, 23), totalSold: 50000, count: 2 }];
      data.anuladas = []; await saveData();
      const b = document.querySelector('nav button[data-view="historial"]') || document.querySelector('[data-view="historial"]'); b && b.click(); renderHistorial();
    });
    await sembrar(); await pausa(300);
    const resumen = () => p.evaluate(() => [...document.querySelectorAll('#histSummary .n')].map(x => x.textContent.trim()));
    const filas = () => p.evaluate(() => [...document.querySelectorAll('#histList .hist-row')].map(r => r.innerText.replace(/\s+/g, ' ').trim()));
    chk('0. Empieza con 5 ventas y sin el filtro «🚫 Anuladas» (no hay ninguna)', (await resumen())[0] === '5' && await p.evaluate(() => document.getElementById('histFAnuladas').hidden), await resumen());
    chk('0. El botón de cada venta dice «🚫 Anular»', await p.evaluate(() => /Anular/.test(document.querySelector('#histList .hist-fix.peligro').textContent)));

    // ===== 1 · Anular una venta =====
    p.evaluate(() => window.ventoVentaFix('borrar', 'a1')).catch(() => {});
    await p.waitForSelector('#vfOv.show #vfMotivo', { timeout: 6000 });
    chk('1. Al anular pregunta «¿Por qué? (opcional)» y dice que queda en «Anuladas»', await p.evaluate(() => /¿Anular esta venta\?/.test(document.getElementById('vfOv').innerText) && /Anuladas/.test(document.getElementById('vfOv').innerText)));
    await p.click('#vfOv #vfNo'); await pausa(200);
    chk('1. «Cancelar» no anula nada', await p.evaluate(() => data.history.length === 5 && !(data.anuladas || []).length));
    p.evaluate(() => window.ventoVentaFix('borrar', 'a1')).catch(() => {});
    await p.waitForSelector('#vfOv.show #vfMotivo', { timeout: 6000 }); await p.fill('#vfMotivo', 'Se cobró dos veces'); await p.click('#vfOv #vfSi'); await pausa(500);
    let v = await p.evaluate(() => ({ h: data.history.map(x => x.id), an: (data.anuladas || []).map(a => [a.id, a.tipo, a.ventaId, a.por, a.como, a.motivo, a.venta && a.venta.total, a.venta && a.venta.invoiceNo]), stock: data.products[0].stock, chip: !document.getElementById('histFAnuladas').hidden,
      act: JSON.stringify((data.auditoria || data.actividad || [])).slice(0, 4000) }));
    chk('1. La venta sale de las ventas y queda en data.anuladas con quién, cómo, motivo y su copia completa', v.h.join() === 'a2,a3,b1,b2' && v.an.length === 1 && JSON.stringify(v.an[0]) === JSON.stringify(['an-v-a1', 'venta', 'a1', 'ana', 'jefe', 'Se cobró dos veces', 10000, 'F-10']), v);
    chk('1. Lo vendido vuelve al inventario (Cerveza 10 → 12) y aparece el filtro «🚫 Anuladas»', v.stock === 12 && v.chip, v);
    v = await resumen(); chk('1. El resumen baja: 4 cuentas cerradas y $175.000', v[0] === '4' && /175\.000/.test(v[1]), v);

    // ===== 2 · La lista de anuladas =====
    await p.click('#histFAnuladas'); await pausa(300);
    v = { f: await filas(), res: await p.evaluate(() => document.getElementById('histBuscarRes').textContent), bot: await p.evaluate(() => document.querySelectorAll('#histList .hist-fix, #histList .hist-share-image').length) };
    chk('2. «🚫 Anuladas» muestra la venta con ANULADA, su número, quién, cuándo y el motivo', v.f.length === 1 && /Mesa 1 · ANULADA/.test(v.f[0]) && /N\.º F-10 · Efectivo/.test(v.f[0]) && /Anulada el 14 de nov/.test(v.f[0]) && /por ana/.test(v.f[0]) && /Motivo: Se cobró dos veces/.test(v.f[0]) && /10\.000/.test(v.f[0]), v);
    chk('2. Son de solo lectura (sin Corregir, Anular ni enviar) y dice «1 anulada · $10.000 que ya no cuentan»', v.bot === 0 && /^1 anulada · .*10\.000 que ya no cuentan/.test(v.res), v);
    await p.click('#histList .hist-row .hist-row-top'); await pausa(150);
    chk('2. Al tocarla se abre y muestra sus productos', await p.evaluate(() => { const r = document.querySelector('#histList .hist-row'); return r.classList.contains('expanded') && /Cerveza ×2/.test(r.innerText); }));
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 8000 }), p.click('#histLibro')]);
    const lin = require('fs').readFileSync(await dl.path(), 'utf8').replace(/^﻿/, '').split('\r\n');
    chk('2. El libro baja como «anuladas-…csv» con la columna «Estado» = ANULADA', /^anuladas-Fonda-Anula/.test(dl.suggestedFilename()) && /"Estado"$/.test(lin[0]) && lin.length === 2 && /"F-10".*"ANULADA"$/.test(lin[1]), { n: dl.suggestedFilename(), lin });
    await p.click('#histFilter [data-f="todos"]'); await pausa(200);

    // ===== 3 · Corregir guarda el antes =====
    const corregir = async (id, cantidades) => {
      p.evaluate(id => window.ventoVentaFix('corregir', id), id).catch(() => {});
      await p.waitForSelector('#vfOv.show [data-q="0"]', { timeout: 6000 });
      for(let i = 0; i < cantidades.length; i++) await p.fill('#vfOv [data-q="' + i + '"]', String(cantidades[i]));
      await p.click('#vfOv #vfSi'); await pausa(400);
    };
    await corregir('a2', [2, 1]); await corregir('a2', [2, 0]);
    v = await p.evaluate(() => { const h = data.history.find(x => x.id === 'a2'); return { total: h.total, items: h.items.map(i => i.qty + ' ' + i.name), n: (h.correcciones || []).length, antes: (h.correcciones || []).map(c => [c.antes.total, c.antes.items.map(i => i.qty + ' ' + i.name).join(', '), c.por]), corregida: !!h.corregida, stock: data.products[0].stock }; });
    chk('3. Dos correcciones: la venta queda en 2 Bandeja ($60.000) y guarda los dos «antes» ($95.000 y $65.000)', v.total === 60000 && v.items.join() === '2 Bandeja' && v.n === 2 && v.antes[0][0] === 95000 && /3 Bandeja, 1 Cerveza/.test(v.antes[0][1]) && v.antes[1][0] === 65000 && v.antes[0][2] === 'ana' && v.corregida, v);
    v = await p.evaluate(() => { const r = [...document.querySelectorAll('#histList .hist-row')].find(x => /Mesa 2/.test(x.innerText)); return [...r.querySelectorAll('.hist-antes')].map(x => x.textContent); });
    chk('3. El detalle muestra dos líneas «✏️ Corregida el … por ana: antes … → ahora …»', v.length === 2 && /por ana: antes 3 Bandeja, 1 Cerveza \(\$\s?95\.000\) → ahora 2 Bandeja, 1 Cerveza \(\$\s?65\.000\)/.test(v[0]) && /antes 2 Bandeja, 1 Cerveza \(\$\s?65\.000\) → ahora 2 Bandeja \(\$\s?60\.000\)/.test(v[1]), v);
    await corregir('a3', [0]);
    v = await p.evaluate(() => ({ h: data.history.map(x => x.id), an: data.anuladas.map(a => [a.id, a.motivo, a.venta && a.venta.total, a.venta && a.venta.items.length]) }));
    chk('3. Corregir hasta dejar 0 productos ya no borra sin rastro: queda anulada «corregida a cero» con la venta como estaba', v.h.join() === 'a2,b1,b2' && JSON.stringify(v.an[0]) === JSON.stringify(['an-v-a3', 'corregida a cero', 30000, 1]), v);

    // ===== 4 · Anular un día =====
    await p.click('#deleteHistoryDayBtn'); await pausa(300);
    chk('4. Sigue igual que antes: solo el proveedor de ORDEVA abre «Anular las ventas de un día» (al dueño no se le abre)', await p.evaluate(() => !document.getElementById('deleteHistoryOverlay').classList.contains('show')));
    await p.evaluate(() => openDeleteHistory()); await pausa(300);   // como el proveedor
    v = await p.evaluate(() => document.getElementById('deleteHistoryOverlay').innerText);
    chk('4. La ventana dice «Anular las ventas de un día» y lista los dos días con «🚫 Anular»', /Anular las ventas de un día/.test(v) && (v.match(/🚫 Anular/g) || []).length >= 2, v);
    await p.evaluate(() => { const bs = [...document.querySelectorAll('#deleteHistoryDaysList button[data-key]')]; bs[bs.length - 1].click(); });
    await p.waitForSelector('#vfOv.show #vfMotivo', { timeout: 6000 });
    v = await p.evaluate(() => document.getElementById('vfOv').innerText);
    chk('4. Avisa: 2 cuentas ($50.000), 1 cierre de caja YA HECHO, que quedan en «Anuladas» y que el inventario no se devuelve', /2 cuentas cerradas/.test(v) && /50\.000/.test(v) && /1 cierre de caja YA HECHO/.test(v) && /Anuladas/.test(v) && /inventario no se devuelve/.test(v), v);
    await p.fill('#vfMotivo', 'Día de prueba'); await p.click('#vfOv #vfSi'); await pausa(600);
    v = await p.evaluate(() => ({ h: data.history.map(x => x.id), cl: (data.closures || []).length, an: data.anuladas.map(a => [a.id, a.tipo, a.motivo]), stock: data.products[0].stock, act: JSON.stringify(data).indexOf('día anulado') >= 0 }));
    chk('4. Las 2 ventas y el cierre de ese día pasan a «Anuladas» (motivo «día anulado: Día de prueba»); el inventario no cambia', v.h.join() === 'a2' && v.cl === 0 && v.an.filter(a => a[2] === 'día anulado: Día de prueba').map(a => a[0]).sort().join() === 'an-c-c-b,an-v-b1,an-v-b2' && v.an.length === 5, v);
    await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    await p.click('#histFAnuladas'); await pausa(300);
    v = await filas();
    chk('4. «🚫 Anuladas» muestra las 5 (4 ventas y «🔒 Cierre de caja · ANULADO»)', v.length === 5 && v.filter(x => /Cierre de caja · ANULADO/.test(x)).length === 1 && v.filter(x => /ANULADA/.test(x)).length === 4, v);
    await p.fill('#histBuscar', 'prueba'); await pausa(350);
    chk('4. Se pueden buscar por motivo («prueba» → 3)', (await filas()).length === 3);
    await p.fill('#histBuscar', ''); await pausa(350); await p.click('#histFilter [data-f="todos"]'); await pausa(200);

    // ===== 5 · Una anulada no vuelve como vendida =====
    v = await p.evaluate(() => { const d = JSON.parse(JSON.stringify(data)); d.history.unshift(JSON.parse(JSON.stringify(d.anuladas.find(a => a.id === 'an-v-a1').venta))); const antes = d.history.length; const n = window.ventoQuitarAnuladas(d); return { antes, n, ids: d.history.map(x => x.id) }; });
    chk('5. Si otro equipo todavía traía la venta anulada, se quita al juntar (no queda vendida y anulada a la vez)', v.antes === 2 && v.n === 1 && v.ids.join() === 'a2', v);
    v = await p.evaluate(() => { const d = { history: [{ id: 'x1' }, { id: 'x2' }], anuladas: [{ id: 'an-c-x1', tipo: 'cierre', cierre: { id: 'x1' } }] }; return [window.ventoQuitarAnuladas(d), d.history.length, window.ventoQuitarAnuladas({ history: [{ id: 'x1' }] })]; });
    chk('5. Un cierre anulado con el mismo id no quita ventas; sin lista de anuladas no toca nada', v[0] === 0 && v[1] === 2 && v[2] === 0, v);

    // ===== 6 · Volver a abrir =====
    await p.evaluate(() => saveData()); await pausa(600);
    await p.reload({ waitUntil: 'load' }); await pausa(1200);
    if(await p.evaluate(() => !document.getElementById('authOverlay').hidden)){ await p.fill('#authUser', 'ana').catch(() => {}); await p.fill('#authPass', 'clave123').catch(() => {}); await p.click('#authBtn').catch(() => {}); await pausa(1500); }
    v = await p.evaluate(() => ({ h: (data.history || []).map(x => x.id), an: (data.anuladas || []).length, corr: ((data.history.find(x => x.id === 'a2') || {}).correcciones || []).length }));
    chk('6. Al volver a abrir: 1 venta, 5 anuladas y las 2 correcciones siguen ahí', v.h.join() === 'a2' && v.an === 5 && v.corr === 2, v);
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.message)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
