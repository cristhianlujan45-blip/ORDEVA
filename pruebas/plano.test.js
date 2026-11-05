// 🗺️ ORDEVA 1.78.0 · El plano del local (lib/vento-plano.js), en el celular. Sin internet.
//  1. Restaurante con la vista sencilla (de fábrica): «📋 Lista | 🗺️ Plano» a la vista (antes escondido en «Más opciones»).
//  2. «✏️ Editar plano» con el plano vacío ofrece plantillas; «🍽️ Restaurante» pone barra, cocina, baños, caja y entrada.
//  3. Arrastrar una mesa la mueve (en la cuadrícula) y «↩ Deshacer» la devuelve.
//  4. Tocar una mesa: forma, sillas (se dibujan), tamaño; agregar y quitar elementos; zonas nuevas con nombre.
//  5. «✅ Terminar»: tocar una mesa abre su cuenta; el color de la mesa dice su estado.
//  6. Hotel: un piso por pestaña (101, 102 · 201, 202) y la plantilla de hotel con pasillo.
//  7. Bar: la plantilla pone mesas redondas pequeñas, barra y tarima. 8. Tienda en modo caja: no hay plano (no tiene mesas). Sin errores.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  async function abrir(tipo, nombre){
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1000);
    await p.evaluate(t => { const s = document.getElementById('authType'); if(s){ s.value = t; s.dispatchEvent(new Event('change')); } }, tipo);
    await p.fill('#authBiz', nombre); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn');
    await p.waitForFunction(() => document.getElementById('authOverlay').hidden, null, { timeout: 15000 });
    await p.click('#onbSaltar', { timeout: 4000 }).catch(() => {});
    await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    await p.waitForFunction(() => !!window.ventoMapa && !!window.ventoPlano, null, { timeout: 10000 });
    await p.evaluate(() => { const b = document.querySelector('nav button[data-view="mesas"]'); if(b) b.click(); });
    await p.waitForTimeout(500);
    return { ctx, p };
  }
  const n = async (p, sel) => p.evaluate(s => document.querySelectorAll(s).length, sel);
  try{
    // ===== 1 =====
    const { p, ctx } = await abrir('restaurante', 'Restaurante El Fogón');
    await p.waitForFunction(() => !!document.querySelector('#plVista [data-pl="plano"]') && document.querySelector('#plVista').offsetParent !== null, null, { timeout: 10000 }).catch(() => {});
    let v = await p.evaluate(() => ({ vs: document.body.classList.contains('vs-on'), seg: !!document.querySelector('#plVista [data-pl="plano"]') && document.querySelector('#plVista').offsetParent !== null, viejo: getComputedStyle(document.getElementById('mesaViewMapBtn')).display }));
    chk('1. Con la vista sencilla, «📋 Lista | 🗺️ Plano» está a la vista', v.vs && v.seg && v.viejo === 'none', v);
    await p.click('#plVista [data-pl="plano"]'); await p.waitForTimeout(400);
    v = await p.evaluate(() => ({ modo: data.tableViewMode, mesas: document.querySelectorAll('#plLienzo .pl-mesa').length, total: Object.keys(data.tables).length, lista: getComputedStyle(document.getElementById('tableGrid')).display, editar: !!document.querySelector('#plVista [data-pl="editar"]') }));
    chk('1. «🗺️ Plano» muestra todas las mesas en el plano (y esconde la lista)', v.modo === 'map' && v.mesas === v.total && v.mesas > 0 && v.lista === 'none' && v.editar, v);
    // ===== 2 =====
    await p.click('#plVista [data-pl="editar"]'); await p.waitForTimeout(500);
    v = await p.evaluate(() => ({ hoja: (document.getElementById('plHoja') || {}).innerText || '', sug: (document.querySelector('#plHoja .pl-elems .on') || {}).textContent || '' }));
    chk('2. Plano vacío: ofrece plantillas y sugiere «Restaurante»', /Empezamos con una plantilla/.test(v.hoja) && /Restaurante/.test(v.sug), v);
    await p.click('#plHoja [data-pl="plantilla"][data-v="restaurante"]'); await p.waitForTimeout(300);
    await p.click('#confirmOkBtn'); await p.waitForTimeout(500);
    v = await p.evaluate(() => ({ el: data.plano.el.map(e => e.t), dentro: Object.values(data.tables).every(t => t.mapX >= 10 && t.mapX <= 75 && t.mapY >= 25 && t.mapY <= 82), vis: document.querySelectorAll('#plLienzo .pl-el').length }));
    chk('2. Plantilla restaurante: barra, cocina, baños, caja y entrada en el plano; las mesas en el salón', ['barra', 'cocina', 'bano', 'caja', 'entrada'].every(t => v.el.includes(t)) && v.vis === v.el.length && v.dentro, v);
    // ===== 3 =====
    const antes = await p.evaluate(() => ({ x: data.tables[1].mapX, y: data.tables[1].mapY }));
    await p.evaluate(() => document.querySelector('#plLienzo .pl-mesa[data-id="1"]').scrollIntoView({ block: 'center' })); await p.waitForTimeout(200);
    const caja = await p.evaluate(() => { const r = document.querySelector('#plLienzo .pl-mesa[data-id="1"]').getBoundingClientRect(), l = document.getElementById('plLienzo').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: l.width, h: l.height }; });
    await p.mouse.move(caja.x, caja.y); await p.mouse.down(); await p.mouse.move(caja.x + caja.w * 0.1, caja.y + caja.h * 0.1, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(300);
    v = await p.evaluate(() => ({ x: data.tables[1].mapX, y: data.tables[1].mapY }));
    chk('3. Arrastrar la mesa 1: se mueve y queda en la cuadrícula', Math.abs(v.x - antes.x - 10) <= 3 && Math.abs(v.y - antes.y - 10) <= 3 && v.x % 2.5 === 0 && v.y % 2.5 === 0, { antes, v });
    await p.click('[data-pl="deshacer"]'); await p.waitForTimeout(300);
    v = await p.evaluate(() => ({ x: data.tables[1].mapX, y: data.tables[1].mapY }));
    chk('3. «↩ Deshacer»: vuelve a donde estaba', v.x === antes.x && v.y === antes.y, { antes, v });
    // ===== 4 =====
    await p.click('#plLienzo .pl-mesa[data-id="2"]'); await p.waitForTimeout(300);
    v = await p.evaluate(() => (document.getElementById('plPanel') || {}).innerText || '');
    chk('4. Tocar la mesa 2 (editando): sale su panel con forma, sillas y tamaño', /Mesa 2/.test(v) && /Forma/.test(v) && /Sillas/.test(v) && /Tamaño/.test(v), v.slice(0, 200));
    await p.click('#plPanel [data-pl="forma"][data-v="larga"]'); await p.waitForTimeout(200);
    await p.click('#plPanel [data-pl="sillas"][data-v="1"]'); await p.waitForTimeout(200);
    await p.click('#plPanel [data-pl="tam"][data-v="1.3"]'); await p.waitForTimeout(200);
    v = await p.evaluate(() => ({ t: data.tables[2], sillas: document.querySelectorAll('#plLienzo .pl-mesa[data-id="2"] .pl-silla').length, cls: document.querySelector('#plLienzo .pl-mesa[data-id="2"]').className }));
    chk('4. Rectangular con 7 sillas y grande: queda guardado y se dibujan las 7 sillas', v.t.shape === 'larga' && v.t.cap === 7 && v.t.tam === 1.3 && v.sillas === 7 && /pl-f-larga/.test(v.cls), v);
    await p.click('[data-pl="elem"]'); await p.waitForTimeout(200);
    await p.click('#plHoja [data-pl="elem-add"][data-v="planta"]'); await p.waitForTimeout(300);
    const nEl = await p.evaluate(() => data.plano.el.length);
    v = await p.evaluate(() => (document.getElementById('plPanel') || {}).innerText || '');
    chk('4. «🧱 Elemento → Planta»: queda en el plano y se puede editar (texto, ancho, alto, quitar)', /Ancho/.test(v) && /Quitar/.test(v), v.slice(0, 200));
    await p.click('#plPanel [data-pl="borrar"]'); await p.waitForTimeout(300);
    chk('4. «🗑️ Quitar» la quita', (await p.evaluate(() => data.plano.el.length)) === nEl - 1);
    await p.click('[data-pl="zona+"]'); await p.waitForTimeout(250);
    await p.fill('#plPreg', 'Terraza'); await p.click('#plPregSi'); await p.waitForTimeout(400);
    v = await p.evaluate(() => ({ z: data.plano.zonas.map(z => z.n), tabs: [...document.querySelectorAll('.pl-zona:not(.pl-mas)')].map(b => b.textContent.trim()), vacio: (document.querySelector('.pl-vacio') || {}).textContent || '' }));
    chk('4. «➕ Zona» Terraza: nueva pestaña (vacía, con ayuda)', v.z.join() === 'Salón,Terraza' && v.tabs.length === 2 && /Terraza/.test(v.tabs[1]) && /vacía/.test(v.vacio), v);
    await p.click('[data-pl="mesa+"]'); await p.waitForTimeout(300);
    v = await p.evaluate(() => { const ids = Object.keys(data.tables).map(Number), id = Math.max(...ids); return { id, zona: data.tables[id].zona, terraza: data.plano.zonas[1].id, count: data.tableCount }; });
    chk('4. «➕ Mesa» en la Terraza: una mesa nueva en esa zona', v.zona === v.terraza && v.count === v.id, v);
    // ===== 5 =====
    await p.click('[data-pl="listo"]'); await p.waitForTimeout(300);
    await p.click('.pl-zona[data-z="z1"]'); await p.waitForTimeout(300);
    await p.evaluate(() => { const pr = data.products[0]; data.tables[3].items = [{ productId: pr.id, name: pr.name, price: pr.price, qty: 1, history: [{ qty: 1, at: Date.now() - 6e5 }] }]; saveData(); renderMesas(); });
    await p.waitForTimeout(300);
    v = await p.evaluate(() => ({ est: document.querySelector('#plLienzo .pl-mesa[data-id="3"]').dataset.est, ed: window.ventoPlano.estado().editando }));
    chk('5. Fuera de editar, la mesa 3 abierta se ve «ocupada» en el plano', v.est === 'ocupada' && !v.ed, v);
    await p.click('#plLienzo .pl-mesa[data-id="3"]'); await p.waitForTimeout(500);
    v = await p.evaluate(() => ({ ov: document.getElementById('overlay').classList.contains('show'), m: typeof currentTable !== 'undefined' ? currentTable : null }));
    chk('5. Tocar la mesa abre su cuenta', v.ov && v.m === 3, v);
    await p.screenshot({ path: (process.env.CAPTURAS || '/tmp') + '/plano-restaurante.png' }).catch(() => {});
    await ctx.close();
    // ===== 6. Hotel =====
    const H = await abrir('hotel', 'Hotel Las Palmas'); const q = H.p;
    await q.evaluate(() => { Object.keys(data.tables).forEach(k => delete data.tables[k]); ['101', '102', '103', '201', '202'].forEach((n, i) => { data.tables[i + 1] = { name: 'Habitación ' + n, items: [], people: [] }; }); data.tableCount = 5; delete data.plano; saveData(); data.tableViewMode = 'map'; updateMesaViewUI(); });
    await q.waitForTimeout(400);
    v = await q.evaluate(() => ({ tabs: [...document.querySelectorAll('.pl-zona')].map(b => b.textContent.trim()), p1: document.querySelectorAll('#plLienzo .pl-mesa').length, forma: document.querySelector('#plLienzo .pl-mesa').className }));
    chk('6. Hotel: una pestaña por piso («Piso 1 3», «Piso 2 2») con las habitaciones como cama', v.tabs.length === 2 && /Piso 1\s*3/.test(v.tabs[0]) && /Piso 2\s*2/.test(v.tabs[1]) && v.p1 === 3 && /pl-f-cama/.test(v.forma), v);
    await q.evaluate(() => { window.ventoPlano.editar(true); window.ventoPlano.aplicarPlantilla('hotel'); });
    await q.waitForTimeout(300);
    v = await q.evaluate(() => ({ el: data.plano.el.filter(e => e.z === 'p1').map(e => e.t), ys: [1, 2, 3].map(i => data.tables[i].mapY) }));
    chk('6. Plantilla hotel: pasillo, escaleras, ascensor y recepción; habitaciones a lado y lado del pasillo', ['pasillo', 'escalera', 'ascensor', 'recepcion'].every(t => v.el.includes(t)) && v.ys.includes(26) && v.ys.includes(74), v);
    await q.screenshot({ path: (process.env.CAPTURAS || '/tmp') + '/plano-hotel.png' }).catch(() => {});
    await H.ctx.close();
    // ===== 7. Bar =====
    const B = await abrir('bar', 'Bar La Esquina'); const r = B.p;
    await r.evaluate(() => { data.tableViewMode = 'map'; updateMesaViewUI(); window.ventoPlano.editar(true); window.ventoPlano.aplicarPlantilla('bar'); });
    await r.waitForTimeout(300);
    v = await r.evaluate(() => ({ formas: [...new Set(Object.values(data.tables).map(t => t.shape))], el: data.plano.el.map(e => e.txt) }));
    chk('7. Bar: mesas redondas pequeñas, barra y tarima', v.formas.length === 1 && v.formas[0] === 'redonda' && v.el.includes('DJ / Tarima'), v);
    await B.ctx.close();
    // ===== 8. Tienda =====
    const T = await abrir('minimercado', 'Minimercado La 14'); const s = T.p;
    v = await s.evaluate(() => ({ vista: !!document.getElementById('plVista'), disp: window.ventoPlano.disponible() }));
    chk('8. Tienda por cuentas / caja: no muestra el plano de mesas', !v.vista && !v.disp, v);
    await T.ctx.close();
    chk('8. Sin errores en la página', errs.length === 0, errs);
  }catch(e){ mal++; console.log('❌ Error: ' + (e.stack || e)); }
  await b.close();
  console.log('\nRESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
