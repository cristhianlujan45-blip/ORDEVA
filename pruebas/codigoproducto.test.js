// 🏷️ Producto reconocido por su código (ORDEVA 1.65.9, lib/vento-producto-codigo.js).
//  1. Entrada de mercancía con un código que no está: sale la ficha llena (Open Food Facts de mentira), con
//     «🇨🇴 producto colombiano» para los 770…, sin precio puesto (no se inventa) y pidiendo cuántas llegaron.
//  2. Sin precio no se guarda. Con precio queda el producto con su código y la entrada suma lo que llegó.
//  3. Ese mismo código otra vez: pregunta «¿Cuántas llegaron?»; lo que se escanea mientras tanto del mismo código suma
//     a esa cantidad, y otro código queda en fila (no se pierde). El costo nuevo queda en la entrada.
//  4. «Preguntar cada vez» apagado: cada lectura suma 1 sin preguntar.
//  5. Un código que no está en ninguna parte: la ficha sale vacía (nada inventado) y «Ahora no» no crea nada.
//  6. En la venta: «Es un producto nuevo» abre la ficha y, al guardar, el producto pasa a la venta.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
const COD = '7702004003300', COD2 = '7709999999999', COD3 = '7701234567897', OTRO = '7705555555555';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [], pedidos = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => {
      const u = new URL(r.request().url());
      if(u.hostname === 'localhost') return r.continue();
      if(/open(food|products|beauty)facts\.org$/.test(u.hostname)){
        pedidos.push(u.hostname + u.pathname);
        if(u.hostname === 'world.openfoodfacts.org' && u.pathname.includes(COD))
          return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 1, product: { product_name: 'Gaseosa Colombiana', brands: 'Postobón', quantity: '400 ml', categories: 'Bebidas' } }) });
        return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 0 }) });
      }
      return r.abort();
    });
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1200);
    await p.fill('#authBiz', 'Tienda Código'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1500);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    const esperar = async (f, ms) => { const t = Date.now() + (ms || 8000); while(Date.now() < t){ if(await p.evaluate(f).catch(() => false)) return true; await p.waitForTimeout(120); } return false; };
    const entrada = () => p.evaluate(() => { const k = Object.keys(localStorage).find(x => x.startsWith('vento_entrada:')); return k ? JSON.parse(localStorage.getItem(k)) : null; });
    const leer = c => p.evaluate(c => { const i = document.getElementById('viCod'); i.value = c; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); }, c);
    // El celular lector manda por el destino del inventario (lo mismo que hace lib/vento-lector-cel.js).
    const delCelular = c => p.evaluate(c => { const d = window.ventoLectorDestinos.find(x => x.nombre === 'inventario'); if(!d.activo()) return 'inactivo'; d.leer(c); return 'ok'; }, c);
    await p.evaluate(() => {
      document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.products = data.products || []; saveData();
      const b = document.querySelector('nav [data-view="inventario"]'); if(b) b.click();
      const d = document.getElementById('viPanel'); d.open = true; d.dispatchEvent(new Event('toggle'));
      document.querySelector('#viPanel [data-vm="entrada"]').click();
    });
    await p.waitForTimeout(200);

    // 1. Código nuevo en la entrada de mercancía
    await leer(COD);
    chk('1. Código que no está → sale la ficha «🆕 Producto nuevo»', await esperar(() => document.getElementById('pcFichaOv') && document.getElementById('pcFichaOv').classList.contains('show')));
    chk('1. … dice «🇨🇴 producto colombiano» (código 770)', await p.evaluate(() => /colombiano/.test(document.querySelector('#pcFichaOv .modal-sub').textContent)));
    chk('1. … y se llena sola: nombre con la marca y el tamaño', await esperar(() => /Gaseosa Colombiana/.test(document.getElementById('pcNom').value)) &&
      await p.evaluate(() => /Postobón/.test(document.getElementById('pcNom').value) && document.getElementById('pcTam').value === '400 ml'),
      await p.evaluate(() => [document.getElementById('pcNom').value, document.getElementById('pcTam').value, document.getElementById('pcEst').textContent]));
    let v = await p.evaluate(() => ({ pre: document.getElementById('pcPre').value, can: document.getElementById('pcCan') && document.getElementById('pcCan').value, est: document.getElementById('pcEst').textContent }));
    chk('1. … el precio NO se inventa (vacío) y pregunta «¿Cuántas llegaron?»', v.pre === '' && v.can === '1' && /Open Food Facts/.test(v.est), v);
    chk('1. … el celular lector sigue mandando con la ficha abierta (queda en fila)', await delCelular(OTRO) === 'ok');

    // 2. Sin precio no guarda; con precio sí
    await p.click('#pcFichaOv [data-ok]'); await p.waitForTimeout(200);
    chk('2. Sin precio no se guarda', await p.evaluate(c => document.getElementById('pcFichaOv').classList.contains('show') && !data.products.some(x => (x.barcodes || []).includes(c)), COD));
    await p.fill('#pcPre', '2500'); await p.fill('#pcCos', '1700'); await p.fill('#pcCan', '6');
    await p.click('#pcFichaOv [data-ok]'); await p.waitForTimeout(300);
    v = await p.evaluate(c => { const x = data.products.find(y => (y.barcodes || []).includes(c)); return x && { name: x.name, price: x.price, cost: x.cost, size: x.size, stock: x.stock, codigo: x.codigo }; }, COD);
    chk('2. Con precio: el producto queda con su código, precio y costo (existencias aún en 0)', !!v && v.price === 2500 && v.cost === 1700 && v.size === '400 ml' && v.stock === 0 && v.codigo === COD, v);
    let e = await entrada();
    const idG = await p.evaluate(c => data.products.find(y => (y.barcodes || []).includes(c)).id, COD);
    chk('2. … y la entrada suma las 6 que llegaron', !!e && e.items.some(i => i.p === idG && i.q === 6), e);
    chk('2. … el código que llegó mientras tanto sigue en fila: ahora sale su ficha', await esperar(() => document.getElementById('pcFichaOv').classList.contains('show')) &&
      await p.evaluate(o => document.querySelector('#pcFichaOv .modal-sub').textContent.includes(o), OTRO));
    await esperar(() => !/Buscando/.test(document.getElementById('pcEst').textContent));
    v = await p.evaluate(() => ({ nom: document.getElementById('pcNom').value, tam: document.getElementById('pcTam').value, est: document.getElementById('pcEst').textContent }));
    chk('5. Código que no está en ninguna parte: la ficha sale vacía (nada inventado) y lo dice', v.nom === '' && v.tam === '' && /No lo encontré/.test(v.est), v);
    await p.click('#pcFichaOv [data-x]'); await p.waitForTimeout(200);
    chk('5. … «Ahora no» no crea nada', await p.evaluate(o => !data.products.some(x => (x.barcodes || []).includes(o)), OTRO));

    // 3. El mismo código otra vez: «¿Cuántas llegaron?»
    await leer(COD);
    chk('3. Código conocido en la entrada → «📥 ¿Cuántas llegaron?»', await esperar(() => document.getElementById('pcLlegoOv') && document.getElementById('pcLlegoOv').classList.contains('show')));
    chk('3. … el celular sigue mandando: el mismo código suma a la cantidad (1 → 2)', await delCelular(COD) === 'ok' && await esperar(() => document.getElementById('pcN').value === '2'));
    await p.fill('#pcN', '12'); await p.fill('#pcC', '1800');
    await p.click('#pcLlegoOv [data-ok]'); await p.waitForTimeout(200);
    e = await entrada();
    chk('3. … suma 12 más (6 + 12 = 18) con el costo nuevo', !!e && e.items.some(i => i.p === idG && i.q === 18 && i.costo === 1800), e);

    // 4. Preguntar apagado
    await leer(COD);
    await esperar(() => document.getElementById('pcLlegoOv').classList.contains('show'));
    await p.evaluate(() => { document.getElementById('pcPreg').checked = false; });
    await p.click('#pcLlegoOv [data-x]'); await p.waitForTimeout(150);
    e = await entrada();
    chk('4. «No sumar» no suma (sigue en 18)', e.items.some(i => i.p === idG && i.q === 18), e);
    await leer(COD); await leer(COD); await p.waitForTimeout(200);
    e = await entrada();
    chk('4. «Preguntar cada vez» apagado: cada lectura suma 1 sin preguntar (18 → 20)', e.items.some(i => i.p === idG && i.q === 20) && !(await p.evaluate(() => document.getElementById('pcLlegoOv').classList.contains('show'))), e);
    await p.evaluate(() => window.ventoProductoCodigo.preguntar(true));
    await leer('3*' + COD); await p.waitForTimeout(200);
    e = await entrada();
    chk('4. «3*código» (cantidad escrita) suma 3 sin preguntar, aunque esté prendido', e.items.some(i => i.p === idG && i.q === 23) && !(await p.evaluate(() => document.getElementById('pcLlegoOv').classList.contains('show'))), e);

    // 6. En la venta
    await p.evaluate(c => { window.__vendido = null; handleUnknownScannedCode(c, prod => { window.__vendido = prod.name; }, { canCreate: true }); }, COD3);
    await esperar(() => document.getElementById('linkCodeOverlay').classList.contains('show'));
    await p.click('#lcCreateBtn');
    chk('6. Venta: «Es un producto nuevo» abre la ficha (sin «¿Cuántas llegaron?»)', await esperar(() => document.getElementById('pcFichaOv').classList.contains('show')) && !(await p.evaluate(() => document.getElementById('pcCan'))));
    await p.fill('#pcNom', 'Arroz Prueba 500 g'); await p.fill('#pcPre', '3200');
    await p.click('#pcFichaOv [data-ok]'); await p.waitForTimeout(200);
    v = await p.evaluate(c => ({ vendido: window.__vendido, p: !!data.products.find(y => (y.barcodes || []).includes(c)) }), COD3);
    chk('6. … al guardar, el producto queda con su código y pasa a la venta', v.vendido === 'Arroz Prueba 500 g' && v.p, v);
    // 7. Sin permiso de «Crear y editar productos» (empleado), la ficha no se abre ni crea nada
    v = await p.evaluate(async () => { const r = window.ventoRoles, antes = r.puede; r.puede = () => false;
      try{ const x = await window.ventoProductoCodigo.ficha('7703333333333', {}); return { x, abierta: document.getElementById('pcFichaOv').classList.contains('show') }; } finally { r.puede = antes; } });
    chk('7. Sin permiso de crear productos: no se abre la ficha ni se crea nada', v.x === null && !v.abierta && await p.evaluate(() => !data.products.some(x => (x.barcodes || []).includes('7703333333333'))), v);
    chk('Las bases libres solo se consultan por el código', pedidos.every(x => /\/api\/v2\/product\/\d+\.json$/.test(x)), pedidos);
    await ctx.close();
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ Error: ' + (e && e.stack || e)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
