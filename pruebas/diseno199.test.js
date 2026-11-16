// 🎨 ORDEVA 1.99.2 · Auditoría de diseño (puente/egm/AUDITORIA-1.98-DISENO.md), segundo lote.
//  1. (hallazgo 1) La pantalla de entrar usa los colores de ORDEVA 2.0 (fondo claro, botón negro), no la violeta.
//  2. (hallazgo 10) «Más» tiene una ✕ que cierra, y en la vista sencilla va por grupos: Cada día, Mi negocio, Extras…
//     «Historial» se llama «Facturas».
//  3. (hallazgo 18) En el celular, el Inicio muestra primero las ventas y después el bloque de atajos.
//  4. (hallazgo 14) En la Caja del celular, con la venta vacía, el carrito ya no tapa los productos.
//  5. (hallazgo 15) El verde de «pagado» es más oscuro (se lee sobre blanco).
//  6. (1.99.3, hallazgo 12) Encabezado del celular: sin «Salir» junto a la campana ni reloj; el nombre tiene espacio.
//  7. (hallazgo 13) La versión en Ajustes se lee «ORDEVA 1.99.3 · 15 nov 2026», solo en la lista de categorías.
//  9. (hallazgo 20) Tipos de negocio más comunes primero; la Libreta con 2 ejemplos a la vista y el resto plegado.
// 12. (1.99.10, hallazgo 7) Mesas y Caja: botones de 44 px en el celular; herramientas de la venta en una fila.
// 11. (1.99.7, hallazgo 17) Página del QR: con 🎮 Play las 4 pestañas en una sola fila.
// 10. (1.99.5, hallazgo 19) Ventanas propias para escribir un dato y para avisar; borrar categoría pregunta en la de ORDEVA.
//  8. (1.99.4, hallazgo 5) Ajustes › Negocio: índice arriba, tipo de negocio y funciones plegados, el buscador los despliega.
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
    // 6 · Encabezado (1.99.3, hallazgo 12)
    await p.evaluate(() => { const i = document.getElementById('brandName'); i.value = 'Restaurante La Sazón de la Abuela Marina'; });
    for(const w of [390, 320]){
      await p.setViewportSize({ width: w, height: 760 }); await pausa(250);
      v = await p.evaluate(() => { const n = document.getElementById('brandName'), vis = id => { const e = document.getElementById(id); return !!(e && e.offsetParent); };
        return { nombre: Math.round(n.getBoundingClientRect().width), salir: vis('topSalirBtn'), reloj: vis('liveClock'), ancho: document.documentElement.scrollWidth <= window.innerWidth + 1 }; });
      chk('6. Celular ' + w + ' px: sin «Salir» junto a la campana ni reloj, y el nombre del negocio tiene al menos 45 % del ancho', !v.salir && !v.reloj && v.nombre >= w * 0.45 && v.ancho, v);
    }
    await p.setViewportSize({ width: 1280, height: 800 }); await pausa(300);
    chk('6. En el computador «Salir» y el reloj siguen arriba', await p.evaluate(() => !!document.getElementById('topSalirBtn').offsetParent && !!document.getElementById('liveClock').offsetParent));
    await p.click('#navMoreBtn').catch(() => {}); await pausa(200);
    chk('6. «Cerrar sesión» sigue en Más', await p.evaluate(() => !!document.querySelector('#navMoreSheet [data-go="salir"]')));
    await p.evaluate(() => document.getElementById('navMoreSheet').classList.remove('show'));
    await p.setViewportSize({ width: 390, height: 844 });

    // 7 · Versión en Ajustes (hallazgo 13)
    v = await p.evaluate(() => document.getElementById('appVersionEl').textContent);
    chk('7. Ajustes: «ORDEVA 1.99.x · 15 nov 2026» (sin «versión v» ni fecha técnica)', /^ORDEVA \d+\.\d+\.\d+ · \d{1,2} (ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic) \d{4}$/.test(v), v);
    // 8 · Ajustes › Negocio más corto (1.99.4, hallazgo 5) y la versión solo en la lista (hallazgo 13)
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); document.querySelector('nav button[data-view="ajustes"]').click(); }); await pausa(400);
    chk('8. En la lista de Ajustes se ve la versión', await p.evaluate(() => !!document.getElementById('appVersionEl').offsetParent));
    const alto0 = 9939;   // medido en 1.99.3 con este mismo negocio de ejemplo (restaurante, 390 px)
    await p.click('.ajustes-cat[data-cat="negocio"]'); await pausa(900);
    v = await p.evaluate(() => { const ix = document.getElementById('ajNegIndice'), ch = ix ? [...ix.querySelectorAll('.aj-chip')] : [];
      const vis = s => { const e = document.querySelector(s); return !!(e && e.offsetParent); };
      return { indice: !!(ix && ix.offsetParent), chips: ch.map(c => c.textContent), altoChip: Math.min(...ch.map(c => c.getBoundingClientRect().height)), ver: vis('#appVersionEl'),
        listaTipo: vis('#accTypePick .tp-lista'), tipoActual: vis('#accTypePick .tp-actual'), btnTipo: vis('#ajPlegTipo'), modFilas: vis('#modulosBox > label.settings-row'), modRes: (document.getElementById('ajPlegModRes') || {}).textContent,
        unidadOtro: vis('#unidadOtro'), alto: document.documentElement.scrollHeight, ancho: document.documentElement.scrollWidth <= window.innerWidth + 1 }; });
    chk('8. Negocio: índice «En esta sección» con Plan, Mi negocio, Tipo y funciones, Usuarios y seguridad, Caja y personal, Facturación (botones de 44 px)', v.indice && ['Plan', 'Mi negocio', 'Tipo y funciones', 'Usuarios y seguridad', 'Caja y personal', 'Facturación'].every(x => v.chips.includes(x)) && v.altoChip >= 44, v);
    chk('8. Tipo de negocio plegado: se ve el actual y «Cambiar tipo de negocio», no la lista', !v.listaTipo && v.tipoActual && v.btnTipo, v);
    chk('8. Funciones plegadas con su resumen «N de M funciones prendidas»', !v.modFilas && /^\d+ de \d+ funciones prendidas\.$/.test(v.modRes || ''), v);
    chk('8. Dentro de la sección no sale la versión, ni los campos de «unidad propia» escondidos; nada se sale de lado', !v.ver && !v.unidadOtro && v.ancho, v);
    chk('8. La página es al menos 1.000 px más corta que antes (' + alto0 + ')', v.alto <= alto0 - 1000, v.alto);
    await p.click('.aj-chip:has-text("Caja y personal")'); await pausa(900);
    v = await p.evaluate(() => Math.round(document.getElementById('cierreClaveBox').getBoundingClientRect().top));
    chk('8. «Caja y personal» lleva a la clave para cerrar la caja', v >= 0 && v < 300, v);
    await p.click('#ajPlegTipo'); await pausa(250);
    chk('8. «Cambiar tipo de negocio» abre el buscador con la lista', await p.evaluate(() => !!document.querySelector('#accTypePick .tp-lista').offsetParent && !!document.querySelector('#accTypePick .tp-q').offsetParent));
    await p.click('#ajPlegMod'); await pausa(250);
    chk('8. «Ver y cambiar funciones» muestra los interruptores', await p.evaluate(() => !!document.querySelector('#modulosBox [data-modulo="r"]').closest('label').offsetParent));
    await p.click('#ajPlegMod'); await pausa(150);
    await p.click('#ajustesBackBtn'); await pausa(300);
    await p.fill('#ajBuscar', 'recetas'); await pausa(400);
    const res = p.locator('#ajBuscarRes button', { hasText: 'Insumos y recetas' }).first();
    if(await res.count()){ await res.click(); await pausa(800);
      chk('8. El 🔎 buscador lleva a «Insumos y recetas» y despliega las funciones solo', await p.evaluate(() => { const l = document.querySelector('#modulosBox [data-modulo="r"]').closest('label'), r = l.getBoundingClientRect(); return !!l.offsetParent && r.top >= 0 && r.bottom <= window.innerHeight; }));
    } else chk('8. El 🔎 buscador encuentra «Insumos y recetas»', false, await p.evaluate(() => document.getElementById('ajBuscarRes').innerText));
    // 9 · Hallazgo 20: tipos de negocio comunes primero y la Libreta con los ejemplos plegados
    v = await p.evaluate(() => window.VENTO_NEGOCIOS.buscar('').slice(0, 6).map(t => t.k));
    chk('9. Sin escribir nada, la lista de tipos empieza por Restaurante, Tienda de barrio, Comidas rápidas, Cafetería, Bar y Barbería', v.join() === 'restaurante,tienda,comidas_rapidas,cafeteria,bar,barberia', v);
    v = await p.evaluate(() => { const r = window.VENTO_NEGOCIOS.buscar(''), a = r.slice(6).map(t => t.nombre); return { total: r.length, cat: window.VENTO_NEGOCIOS.CAT.length, unicos: new Set(r.map(t => t.k)).size }; });
    chk('9. …y están todos los tipos, sin repetir', v.total === v.cat && v.unicos === v.cat, v);
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); window.libretaAbrir(); }); await pausa(500);
    v = await p.evaluate(() => { const e = document.querySelector('#libretaOverlay .lb-ej'), d = e && e.querySelector('details'), x = document.getElementById('lbCerrar').getBoundingClientRect();
      return { alto: e ? Math.round(e.getBoundingClientRect().height) : -1, plegado: !!d && !d.open, x: Math.round(Math.min(x.width, x.height)) }; });
    chk('9. Libreta: ejemplos plegados (el bloque mide menos de 120 px) y la ✕ de 44 px', v.plegado && v.alto > 0 && v.alto < 120 && v.x >= 44, v);
    await p.click('#libretaOverlay .lb-ej summary'); await pausa(200);
    chk('9. «Ver más ejemplos» los muestra todos', await p.evaluate(() => /Postobón/.test(document.querySelector('#libretaOverlay .lb-ej').innerText)));
    await p.click('#lbCerrar'); await pausa(200);
    // 10 · Hallazgo 19 (1.99.5): ventanas propias en vez de prompt()/alert()/confirm() del navegador
    const dialogosNav = []; p.on('dialog', d => { dialogosNav.push(d.type() + ': ' + d.message()); d.dismiss().catch(() => {}); });
    await p.evaluate(() => { window.__r = 'nada'; showPrompt({ title: 'Contraseña nueva para juan', message: 'Mínimo 6 caracteres.', type: 'password' }).then(v => { window.__r = v; }); });
    await pausa(200);
    v = await p.evaluate(() => { const o = document.getElementById('promptOverlay'), i = document.getElementById('promptInput'), l = document.getElementById('promptMessage'), b = [document.getElementById('promptOkBtn'), document.getElementById('promptCancelBtn')].map(x => Math.round(x.getBoundingClientRect().height));
      return { show: o.classList.contains('show'), tipo: i.type, etiqueta: l.tagName === 'LABEL' && l.htmlFor === 'promptInput', rol: o.getAttribute('role'), modal: o.getAttribute('aria-modal'), foco: document.activeElement === i, botones: b }; });
    chk('10. «Escribe el dato» es una ventana de ORDEVA: campo de contraseña oculto, con etiqueta, rol de diálogo y botones de 44 px', v.show && v.tipo === 'password' && v.etiqueta && v.rol === 'dialog' && v.modal === 'true' && v.foco && v.botones.every(h => h >= 44), v);
    await p.fill('#promptInput', 'secreta1'); await p.press('#promptInput', 'Enter'); await pausa(150);
    chk('10. Enter acepta y devuelve lo escrito', await p.evaluate(() => window.__r === 'secreta1' && !document.getElementById('promptOverlay').classList.contains('show')));
    await p.evaluate(() => { window.__r = 'nada'; showPrompt({ title: 'PIN' }).then(v => { window.__r = v; }); }); await pausa(150);
    await p.press('#promptInput', 'Escape'); await pausa(150);
    chk('10. Escape cancela (devuelve nada)', await p.evaluate(() => window.__r === null));
    await p.evaluate(() => { window.__r = 'nada'; showAviso({ title: 'Respaldo recibido', message: 'ORDEVA se va a recargar.' }).then(v => { window.__r = v; }); }); await pausa(150);
    v = await p.evaluate(() => ({ campo: !document.getElementById('promptInput').hidden, cancelar: !document.getElementById('promptCancelBtn').hidden, ok: document.getElementById('promptOkBtn').textContent }));
    chk('10. El aviso tiene un solo botón «Entendido» y no pide nada', !v.campo && !v.cancelar && v.ok === 'Entendido', v);
    await p.click('#promptOkBtn'); await pausa(120);
    chk('10. …y se cierra al tocarlo', await p.evaluate(() => window.__r === true));
    // Borrar una categoría pregunta en la ventana propia (antes confirm() del navegador)
    await p.evaluate(async () => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); data.categories = [{ id: 'cx', name: 'Bebidas frías' }]; await saveData(); const b = document.querySelector('nav button[data-view="productos"]'); if(b) b.click(); try{ renderProductos(); }catch(e){} });
    await pausa(500);
    const del = await p.evaluate(() => { const b = document.querySelector('.chip-del[data-id="cx"]'); if(b){ b.click(); return true; } return false; });
    await pausa(300);
    v = await p.evaluate(() => ({ show: document.getElementById('confirmOverlay').classList.contains('show'), t: document.getElementById('confirmTitle').textContent }));
    chk('10. Borrar la categoría «Bebidas frías» pregunta en la ventana de ORDEVA, con su nombre', del && v.show && /Bebidas frías/.test(v.t), { del, v });
    if(v.show) await p.click('#confirmCancelBtn');
    chk('10. Con «Cancelar» la categoría sigue', await p.evaluate(() => data.categories.some(c => c.id === 'cx')));
    // Revisión 1.99.5: la ventana tiene que quedar ENCIMA de la pantalla de entrada y de «Recibir pedido» (z-index 99999)
    v = await p.evaluate(async () => {
      const encima = () => { const b = document.getElementById('promptOkBtn').getBoundingClientRect(), e = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !!(e && e.closest('#promptOverlay')); };
      const au = document.getElementById('authOverlay'), antes = au.hidden; au.hidden = false;
      showAviso({ title: 'Respaldo recibido' }); await new Promise(r => setTimeout(r, 120)); const sobreEntrada = encima(); document.getElementById('promptOkBtn').click(); au.hidden = antes;
      const d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#fff'; document.body.appendChild(d);
      showAviso({ title: 'Pedido recibido' }); await new Promise(r => setTimeout(r, 120)); const sobrePedido = encima(); document.getElementById('promptOkBtn').click(); d.remove();
      return { sobreEntrada, sobrePedido }; });
    chk('10. El aviso se ve y se puede tocar encima de la pantalla de entrada y de «Recibir pedido»', v.sobreEntrada && v.sobrePedido, v);
    await p.evaluate(() => { window.__r = 'nada'; showPrompt({ title: 'Contraseña nueva', type: 'password' }).then(v => { window.__r = v; }); }); await pausa(150);
    await p.fill('#promptInput', 'abc123'); await p.click('#promptVer'); await pausa(80);
    v = await p.evaluate(() => ({ tipo: document.getElementById('promptInput').type, ac: document.getElementById('promptInput').autocomplete, ver: document.getElementById('promptVer').textContent }));
    await p.click('#promptOkBtn'); await pausa(120);
    const tras = await p.evaluate(() => ({ r: window.__r, queda: document.getElementById('promptInput').value }));
    chk('10. Contraseña: «👁 Ver» la muestra, no se guarda en el navegador (new-password) y al cerrar no queda escrita', v.tipo === 'text' && v.ac === 'new-password' && /Ocultar/.test(v.ver) && tras.r === 'abc123' && tras.queda === '', { v, tras });
    v = await p.evaluate(async () => { const a = showConfirm({ title: 'Primera' }); const b2 = showConfirm({ title: 'Segunda' }); const r1 = await Promise.race([a, new Promise(r => setTimeout(() => r('colgada'), 300))]); document.getElementById('confirmCancelBtn').click(); return { r1, r2: await b2 }; });
    chk('10. Si se abre una confirmación encima de otra, la primera cuenta como «Cancelar» (no queda colgada)', v.r1 === false && v.r2 === false, v);
    chk('10. Ninguna ventana del navegador salió en todo esto', !dialogosNav.length, dialogosNav);
    // 12 · Hallazgo 7 (1.99.10): en el celular los botones de uso diario de Mesas y Caja miden al menos 44 px
    await p.setViewportSize({ width: 390, height: 844 });
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); document.querySelector('nav button[data-view="mesas"]').click(); }); await pausa(400);
    const chicos = () => p.evaluate(() => [...document.querySelectorAll('#view-mesas .config-row > button, .pl-seg > button, .pz-caja-top > button, .pz-cats > button, .pz-herr2 > button, .pz-est-btn, .pz-step > button, .pz-linea .pz-x')]
      .filter(b => b.offsetParent).map(b => { const r = b.getBoundingClientRect(); return { t: b.innerText.trim().slice(0, 14), h: Math.round(r.height), w: Math.round(r.width) }; }).filter(x => x.h < 44 || x.w < 44));
    v = await chicos();
    chk('12. Mesas en el celular: «Venta rápida», «Caja (POS)», Lista/Plano… todos de 44 px o más', !v.length, v);
    await p.click('#posNav'); await pausa(800);
    await p.locator('.pz-grid .pz-tile:visible').first().click(); await pausa(400);
    v = await chicos();
    chk('12. Caja en el celular: categorías, + y −, Descuento/Nota/Suspender… todos de 44 px o más', !v.length, v);
    v = await p.evaluate(() => { const h = document.querySelector('.pz-herr2'), bs = h ? [...h.children].filter(x => x.offsetParent) : []; return { filas: new Set(bs.map(b => Math.round(b.getBoundingClientRect().top))).size, ancho: document.documentElement.scrollWidth <= window.innerWidth + 1 }; });
    chk('12. Las herramientas de la venta van en una sola fila (no tapan los productos) y nada se sale de lado', v.filas === 1 && v.ancho, v);
    await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));

    // 11 · Hallazgo 17 (1.99.7): en la página del cliente (QR) las 4 pestañas con 🎮 Play van en una sola fila
    for(const w of [320, 390]){
      const cq = await b.newContext({ viewport: { width: w, height: 700 }, locale: 'es-CO' });
      await cq.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
      const q = await cq.newPage(); await q.goto(BASE + '/pedido.html?m=1', { waitUntil: 'load' }); await pausa(900);
      const tres = await q.evaluate(() => [...document.querySelectorAll('.tabs > .t')].filter(x => x.offsetParent).map(x => Math.round(x.getBoundingClientRect().top)));
      await q.evaluate(() => { const g = document.getElementById('tg'); g.hidden = false; const s = g.querySelector('span'); if(s && !s.textContent) s.textContent = 'Play'; });
      const cuatro = await q.evaluate(() => [...document.querySelectorAll('.tabs > .t')].filter(x => x.offsetParent).map(x => ({ top: Math.round(x.getBoundingClientRect().top), cortado: x.scrollWidth > x.clientWidth + 1 })));
      chk('11. Página del QR a ' + w + ' px: 3 pestañas en una fila y, con Play, las 4 en una sola fila sin cortarse', tres.length === 3 && new Set(tres).size === 1 && cuatro.length === 4 && new Set(cuatro.map(x => x.top)).size === 1 && !cuatro.some(x => x.cortado), { tres, cuatro });
      await cq.close();
    }
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.message)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
