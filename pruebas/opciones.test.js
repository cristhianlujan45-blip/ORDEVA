// 🧩 ORDEVA 1.76.0 · Opciones del producto (lib/vento-opciones.js). Sin internet.
//  1. Productos → editar → «🧩 Opciones al vender»: «Término: …», «Sin: …», «Adiciones: Queso extra 3000…» quedan en el producto.
//  2. Al anotarlo: «¿Cómo lo quiere?»; el término es obligatorio; «Sin…» y adiciones varias; el botón dice el precio con lo que suma.
//  3. En la cuenta: «Hamburguesa · Término medio · Sin cebolla · +Queso extra» con su precio; otra combinación = otra línea;
//     la misma combinación suma en la misma línea. Con el buscador y 2 unidades: «(2 iguales)».
//  4. A la cocina llega cada plato con lo elegido, y no se manda dos veces.
//  5. Cambiar el precio del producto no borra lo elegido en la cuenta abierta (precio nuevo + adiciones).
//  6. Un producto sin opciones se agrega directo (sin preguntar). Sin errores.
//  7. QR: la carta lleva las opciones; el cliente elige (el término es obligatorio) y el pedido va con lo elegido.
//  8. La app recibe ese pedido: entra con las opciones y el precio del negocio (no el que mande el celular).
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  const pausa = ms => new Promise(r => setTimeout(r, ms));
  async function abrir(tipo, nombre){
    const ctx = await b.newContext({ viewport: { width: 1366, height: 800 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
    await p.goto(BASE + '/index.html'); await pausa(1000);
    await p.evaluate(t => { const s = document.getElementById('authType'); if(s){ s.value = t; s.dispatchEvent(new Event('change')); } }, tipo);
    await p.fill('#authBiz', nombre); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn');
    await p.waitForFunction(() => document.getElementById('authOverlay').hidden, null, { timeout: 15000 });
    await p.click('#onbSaltar', { timeout: 4000 }).catch(() => {});
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.products = [{ id: 'hb', name: 'Hamburguesa', price: 20000 }, { id: 'li', name: 'Limonada', price: 6000 }]; saveData(); });
    await p.waitForFunction(() => !!window.ventoComanda && !!window.vitoPedidos && !!window.ventoOpciones, null, { timeout: 10000 });
    await pausa(500);
    return { ctx, p };
  }
  const caja = p => p.evaluate(() => { const h = document.getElementById('ckCocina'); return { vis: !!h && !h.hidden && h.offsetParent !== null, t: h ? h.innerText.replace(/\s+/g, ' ') : '' }; });
  const cocina = p => p.evaluate(() => window.vitoPedidos.lista().filter(x => x.mesa === 1 && x.estado !== 'cancelado').map(x => x.estado + ':' + x.items.map(i => i.qty + ' ' + i.name).join('+')));
  const cuenta = p => p.evaluate(() => (data.tables[1].items || []).map(i => i.qty + ' ' + i.name).join(', '));
  try{
    const { p } = await abrir('restaurante', 'Restaurante La Fonda');
    // 1. Editor
    await p.evaluate(() => { openEditProductModal('hb'); });
    await p.waitForTimeout(300);
    let v = await p.evaluate(() => !!document.getElementById('editProdOpc'));
    chk('1. Al editar el producto está «🧩 Opciones al vender»', v);
    await p.evaluate(() => { document.getElementById('editProdOpcWrap').open = true; });
    await p.fill('#editProdOpc', 'Término: Roja, Medio, Bien asada\nSin: cebolla, tomate\nAdiciones: Queso extra 3000, Tocineta 4000');
    await p.click('#editProdSaveBtn'); await p.waitForTimeout(400);
    v = await p.evaluate(() => data.products.find(x => x.id === 'hb').opciones);
    chk('1. Guardado: 3 grupos (término: una; sin y adiciones: varias, con precio)', v && v.length === 3 && !v[0].varias && v[1].varias && v[2].varias && v[2].ops[0].p === 3000 && v[2].ops[1].p === 4000 && v[0].ops.length === 3, v);
    // 2. Elegir
    await p.evaluate(() => { openTableModal(1); addFavoriteToTable('hb'); }); await p.waitForTimeout(400);
    v = await p.evaluate(() => ({ ov: document.getElementById('opOv') && document.getElementById('opOv').classList.contains('show'), t: (document.getElementById('opOv') || {}).innerText || '', items: data.tables[1].items.length }));
    chk('2. Sale «¿Cómo lo quiere?» y todavía no se anota nada', v.ov && /Cómo lo quiere/.test(v.t) && v.items === 0, v);
    await p.click('#opOk'); await p.waitForTimeout(150);
    v = await p.evaluate(() => document.getElementById('opMsg').textContent);
    chk('2. Sin elegir el término no deja: «Elige término»', /Elige término/.test(v), v);
    const op = (g, i) => p.click('#opOv .op-o[data-g="' + g + '"][data-i="' + i + '"]');
    await op(0, 1); await op(1, 0); await op(2, 0);
    v = await p.evaluate(() => document.getElementById('opOk').textContent);
    chk('2. El botón dice el precio con la adición: «Agregar $23.000»', /Agregar \$\s?23\.000/.test(v), v);
    await p.click('#opOk'); await p.waitForTimeout(500);
    v = await p.evaluate(() => data.tables[1].items.map(i => ({ n: i.name, s: i.size, p: i.price, q: i.qty })));
    chk('3. En la cuenta: «Término medio · Sin cebolla · +Queso extra» a $23.000', v.length === 1 && v[0].n === 'Hamburguesa' && v[0].s === 'Término medio · Sin cebolla · +Queso extra' && v[0].p === 23000 && v[0].q === 1, v);
    await p.evaluate(() => addFavoriteToTable('hb')); await p.waitForTimeout(300);
    await op(0, 2); await p.click('#opOk'); await p.waitForTimeout(400);
    await p.evaluate(() => addFavoriteToTable('hb')); await p.waitForTimeout(300);
    await op(0, 1); await op(1, 0); await op(2, 0); await p.click('#opOk'); await p.waitForTimeout(400);
    v = await p.evaluate(() => data.tables[1].items.map(i => i.qty + '×' + i.size + '=' + i.price));
    chk('3. Otra combinación (bien asada) va en otra línea; la misma combinación suma (2×)', v.length === 2 && v.includes('2×Término medio · Sin cebolla · +Queso extra=23000') && v.includes('1×Término bien asada=20000'), v);
    // Buscador con 2 unidades
    await p.evaluate(() => { document.getElementById('addProductId').value = 'hb'; document.getElementById('addProductSearch').value = 'Hamburguesa'; document.getElementById('addQty').value = 2; });
    await p.click('#addItemBtn'); await p.waitForTimeout(300);
    v = await p.evaluate(() => (document.getElementById('opOv') || {}).innerText || '');
    chk('3. Con el buscador y 2 unidades: «(2 iguales)»', /2 iguales/.test(v), v.slice(0, 200));
    await op(0, 0); await op(2, 1); await p.click('#opOk'); await p.waitForTimeout(400);
    v = await p.evaluate(() => data.tables[1].items.map(i => i.qty + '×' + i.size + '=' + i.price));
    chk('3. … quedan 2 «Término roja · +Tocineta» a $24.000', v.includes('2×Término roja · +Tocineta=24000'), v);
    // 6. Sin opciones
    await p.evaluate(() => addFavoriteToTable('li')); await p.waitForTimeout(300);
    v = await p.evaluate(() => ({ ov: document.getElementById('opOv').classList.contains('show'), li: data.tables[1].items.some(i => i.name === 'Limonada') }));
    chk('6. La limonada (sin opciones) se agrega directo', !v.ov && v.li, v);
    // 4. Cocina
    await p.waitForTimeout(600);
    v = await caja(p);
    chk('4. «Enviar a Cocina · 6 nuevos» con cada plato y lo elegido', /6 nuevos/.test(v.t) && /Hamburguesa \(Término medio · Sin cebolla · \+Queso extra\)/.test(v.t), v);
    await p.click('#ckCocina [data-ck="enviar"]'); await p.waitForTimeout(700);
    v = await p.evaluate(() => { renderCocina(); return { k: document.getElementById('kdsTickets').innerText, caja: (document.getElementById('ckCocina') || {}).innerText || '' }; });
    chk('4. La cocina recibe «2× Hamburguesa (Término medio · …)», «1× Hamburguesa (Término bien asada)» y «2× … roja · +Tocineta»', /2× Hamburguesa \(Término medio · Sin cebolla · \+Queso extra\)/.test(v.k) && /1× Hamburguesa \(Término bien asada\)/.test(v.k) && /2× Hamburguesa \(Término roja · \+Tocineta\)/.test(v.k), v.k.slice(0, 500));
    chk('4. … y queda «✅ Todo está en Cocina» (no se manda dos veces)', /Todo está en Cocina/.test(v.caja), v.caja);
    // 5. Cambiar el precio
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); openEditProductModal('hb'); document.getElementById('editProdPrice').value = 22000; });
    await p.click('#editProdSaveBtn'); await p.waitForTimeout(400);
    v = await p.evaluate(() => data.tables[1].items.filter(i => i.productId === 'hb').map(i => i.size + '=' + i.price));
    chk('5. Precio nuevo $22.000: lo elegido sigue y las adiciones suman (25.000, 22.000, 26.000)', v.includes('Término medio · Sin cebolla · +Queso extra=25000') && v.includes('Término bien asada=22000') && v.includes('Término roja · +Tocineta=26000'), v);
    // 7. QR (cliente): la carta trae las opciones; elige y el pedido va con lo elegido
    const carta = await p.evaluate(() => window.ventoOpciones.paraCarta());
    chk('7. La carta del QR lleva las opciones de la hamburguesa', carta && carta.Hamburguesa && carta.Hamburguesa.length === 3 && carta.Hamburguesa[2][2][0][1] === 3000, carta);
    const C = 'PRUEBAqrOPCION01', pub = [];
    const qctx = await b.newContext({ viewport: { width: 390, height: 760 }, isMobile: true, hasTouch: true, locale: 'es-CO' });
    await qctx.route('**/*', r => { const u = r.request().url();
      if(/rpc\/canal_leer/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      if(/rpc\/canal_publicar/.test(u)){ try{ pub.push(JSON.parse(r.request().postData() || '{}')); }catch(e){} return r.fulfill({ status: 200, contentType: 'application/json', body: '{"id":"1","time":1,"event":"message"}' }); }
      return new URL(u).hostname === 'localhost' ? r.continue() : r.abort(); });
    await qctx.addInitScript(([c, carta]) => { try{ localStorage.setItem('cat_' + c, JSON.stringify(carta)); }catch(e){} }, [C, { y: 'restaurante', t: 'Menú', n: 'La Fonda', p: [['Hamburguesa', 22000, 'Platos', 0], ['Limonada', 6000, 'Bebidas', 0]], op: carta }]);
    const q = await qctx.newPage(); q.on('pageerror', e => errs.push('qr: ' + e.message));
    await q.goto(BASE + '/pedido.html?mesa=3&c=' + C, { waitUntil: 'load' }); await q.waitForTimeout(1500);
    await q.evaluate(() => document.getElementById('catBtn').click()); await q.waitForTimeout(400);
    await q.evaluate(() => [...document.querySelectorAll('#cat .padd')].find(x => /Hamburguesa/.test(x.getAttribute('aria-label'))).click()); await q.waitForTimeout(300);
    v = await q.evaluate(() => { const o = document.getElementById('opPed'); return o && !o.hidden ? o.innerText.replace(/\s+/g, ' ') : ''; });
    chk('7. QR: al pedir la hamburguesa sale «¿Cómo lo quiere?» con «Queso extra +$3.000»', /Cómo lo quiere/.test(v) && /Queso extra \+\$\s?3\.000/.test(v), v);
    await q.click('#opPed .op-ok'); await q.waitForTimeout(150);
    v = await q.evaluate(() => document.getElementById('opPedMsg').textContent);
    chk('7. QR: sin el término no deja', /Elige término/.test(v), v);
    await q.click('#opPed .op-o[data-g="0"][data-i="1"]'); await q.click('#opPed .op-o[data-g="2"][data-i="0"]'); await q.click('#opPed .op-ok'); await q.waitForTimeout(300);
    await q.evaluate(() => { const b = document.getElementById('catBack'); if(b && b.offsetParent) b.click(); }); await q.waitForTimeout(300);
    await q.evaluate(() => document.getElementById('b').click()); await q.waitForTimeout(1500);
    const ped = pub.map(x => { try{ return JSON.parse(x.p_msg || x.msg || x.p_mensaje || x.mensaje || x.body || '{}'); }catch(e){ return x; } }).find(x => x && x.t === 'pedido') || pub.find(x => /pedido/.test(JSON.stringify(x)));
    const pedTxt = JSON.stringify(ped || pub);
    chk('7. QR: el pedido va con «Hamburguesa (Término medio · +Queso extra)» a $25.000', /Hamburguesa \(Término medio · \+Queso extra\)/.test(pedTxt) && /25000/.test(pedTxt), pedTxt.slice(0, 400));
    await qctx.close();
    // 8. La app recibe el pedido del QR: entra con las opciones y el precio del NEGOCIO (aunque el celular mande otro)
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); const E = window.vitoPedidos; E.entrante({ id: 'qr-op-1', mesa: 3, items: [{ n: 'Hamburguesa (Término medio · +Queso extra)', q: 1, p: 1000 }] }, 'qr'); E.cambiar('qr-op-1', 'recibido'); });
    await p.waitForTimeout(600);
    v = await p.evaluate(() => (data.tables[3].items || []).map(i => i.qty + '×' + i.name + '|' + i.size + '=' + i.price));
    chk('8. La cuenta de la mesa 3: 1 × Hamburguesa «Término medio · +Queso extra» a $25.000 (precio del negocio, no el del celular)', v.length === 1 && v[0] === '1×Hamburguesa|Término medio · +Queso extra=25000', v);
    chk('6. Sin errores en la página', errs.length === 0, errs);
  }catch(e){ mal++; console.log('❌ Error: ' + (e.stack || e)); }
  await b.close();
  console.log('\nRESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
