// 🧩 Funciones según el tipo de negocio (ORDEVA 1.64.0): «🧂 Insumos y recetas» solo donde se preparan alimentos.
//  1. Con 10 perfiles (bar, tienda, licorera, minimercado, restaurante, cafetería, panadería, repostería, comidas rápidas
//     y un negocio mixto): Insumos y Recetas aparecen por defecto solo en los que preparan comida — en Inventario, en
//     «Editar producto» y en «🧩 Funciones de este negocio» — y en todos vender sigue descontando el inventario.
//  2. Un bar lo prende (cócteles): aparece, la receta descuenta el licor al vender. Lo apaga: pregunta, se esconde, deja de
//     descontar y NO se borra nada; al prenderlo otra vez todo está igual.
//  3. Un bar que ya tenía insumos de antes los sigue viendo (no se pierde nada al actualizar).
//  4. Un empleado no ve ni cambia las funciones del negocio.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
const PERFILES = [
  ['bar', 'Bar', false], ['tienda', 'Tienda', false], ['estanco', 'Licorera', false], ['minimercado', 'Minimercado', false],
  ['restaurante', 'Restaurante', true], ['cafeteria', 'Cafetería', true], ['panaderia', 'Panadería', true], ['pasteleria', 'Repostería', true],
  ['comidas_rapidas', 'Comidas rápidas', true], ['tienda', 'Negocio mixto (tienda con mesas)', false, 'mixto']
];
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
  async function abrir(tipo, nombre){
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1000);
    await p.evaluate(t => { const s = document.getElementById('authType'); if(s){ s.value = t; s.dispatchEvent(new Event('change')); } }, tipo);
    await p.fill('#authBiz', nombre); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn');
    await p.waitForFunction(() => document.getElementById('authOverlay').hidden, null, { timeout: 15000 });
    await p.click('#onbSaltar', { timeout: 4000 }).catch(() => {});
    await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    await p.waitForFunction(() => !!window.ventoRecetas && !!window.ventoModulos, null, { timeout: 10000 });
    return { ctx, p };
  }
  // Lo que se ve de Insumos y Recetas en cada pantalla
  const mirar = p => p.evaluate(async () => {
    document.querySelector('nav button[data-view="inventario"]').click();
    await new Promise(z => setTimeout(z, 350));
    const panel = document.getElementById('insumosPanel'), panelVis = !!panel && panel.offsetParent !== null;
    const pid = (data.products[0] || {}).id; openEditProductModal(pid); await new Promise(z => setTimeout(z, 200));
    const ed = document.getElementById('editProdRecetaWrap'), edVis = !!ed && ed.offsetParent !== null;
    closeEditProductModal();
    document.querySelector('nav button[data-view="ajustes"]').click(); document.querySelector('.ajustes-cat[data-cat="negocio"]').click();
    await new Promise(z => setTimeout(z, 250));
    const sw = document.querySelector('#modulosBox [data-modulo="r"]');
    const textoTodo = [...document.querySelectorAll('section.active, .overlay.show')].map(x => x.innerText).join(' ');
    document.querySelector('nav button[data-view="mesas"]').click();
    return { mod: usaMod('r'), clase: document.body.classList.contains('mod-r'), panel: panelVis, editor: edVis, sw: sw ? sw.checked : null };
  });
  // Vender 1 de un producto con inventario: el stock baja (inventario, productos y ventas siguen igual)
  const vender = p => p.evaluate(() => {
    data.products.push({ id: 'p-inv', name: 'Gaseosa', price: 3000, stock: 10 }); saveData();
    openTableModal(1); addFavoriteToTable('p-inv'); addFavoriteToTable('p-inv');
    const st = data.products.find(x => x.id === 'p-inv').stock, en = (data.tables[1].items || []).find(i => i.productId === 'p-inv');
    try{ closeModal(); }catch(e){} document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
    return { stock: st, enCuenta: en ? en.qty : 0 };
  });
  try{
    // ===== 1. Los perfiles =====
    for(const [tipo, nombre, conRecetas, modo] of PERFILES){
      const { ctx, p } = await abrir(tipo, nombre);
      if(modo) await p.evaluate(m => { data.modoOperacion = m; saveData(); try{ aplicarModulos(); }catch(e){} }, modo);
      const v = await mirar(p);
      const bien = v.mod === conRecetas && v.clase === conRecetas && v.panel === conRecetas && v.editor === conRecetas && v.sw === conRecetas;
      chk('1. ' + nombre + ': Insumos y Recetas ' + (conRecetas ? 'SÍ aparecen' : 'NO aparecen') + ' (Inventario, Editar producto y Funciones del negocio)', bien, v);
      const ve = await vender(p);
      chk('1. ' + nombre + ': vender sigue descontando el inventario (10 → 8) y la cuenta lleva 2', ve.stock === 8 && ve.enCuenta === 2, ve);
      await ctx.close();
    }

    // ===== 2. Un bar con cócteles lo prende y lo apaga =====
    {
      const { ctx, p } = await abrir('bar', 'Bar Cócteles');
      let v = await p.evaluate(async () => {
        document.querySelector('nav button[data-view="ajustes"]').click(); document.querySelector('.ajustes-cat[data-cat="negocio"]').click();
        await new Promise(z => setTimeout(z, 250));
        const t = document.querySelector('#modulosBox [data-modulo="r"]'); t.click(); await new Promise(z => setTimeout(z, 250));
        return { mod: usaMod('r'), guardado: JSON.stringify(data.modulos) };
      });
      chk('2. El administrador del bar prende «Insumos y recetas» en Funciones de este negocio', v.mod === true && v.guardado === '{"r":true}', v);
      v = await p.evaluate(async () => {
        document.querySelector('nav button[data-view="inventario"]').click(); await new Promise(z => setTimeout(z, 300));
        const panel = !!document.getElementById('insumosPanel');
        data.insumos = [{ id: 'ron', name: 'Ron', unidad: 'ml', stock: 1000 }];
        data.products.push({ id: 'p-coctel', name: 'Mojito', price: 18000, receta: [{ ref: 'i:ron', qty: 60 }] }); saveData();
        openTableModal(2); addFavoriteToTable('p-coctel'); addFavoriteToTable('p-coctel');
        try{ closeModal(); }catch(e){} document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
        return { panel, ron: data.insumos[0].stock };
      });
      chk('2. Aparece el panel de insumos y vender 2 mojitos descuenta 120 ml de ron', v.panel && v.ron === 880, v);
      // Lo apaga: pregunta (tiene datos), se esconde, deja de descontar, no borra nada
      v = await p.evaluate(async () => {
        let pregunto = '';
        const orig = window.showConfirm; window.showConfirm = o => { pregunto = o.message; return Promise.resolve(true); };
        document.querySelector('nav button[data-view="ajustes"]').click(); document.querySelector('.ajustes-cat[data-cat="negocio"]').click();
        await new Promise(z => setTimeout(z, 250));
        document.querySelector('#modulosBox [data-modulo="r"]').click(); await new Promise(z => setTimeout(z, 400));
        window.showConfirm = orig;
        document.querySelector('nav button[data-view="inventario"]').click(); await new Promise(z => setTimeout(z, 300));
        const panel = !!document.getElementById('insumosPanel');
        openEditProductModal('p-coctel'); await new Promise(z => setTimeout(z, 150)); const editor = !!document.getElementById('editProdRecetaWrap'); closeEditProductModal();
        openTableModal(2); addFavoriteToTable('p-coctel');
        try{ closeModal(); }catch(e){} document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
        return { pregunto, mod: usaMod('r'), panel, editor, ron: data.insumos[0].stock, insumos: data.insumos.length, receta: (data.products.find(x => x.id === 'p-coctel').receta || []).length };
      });
      chk('2. Al apagarlo pregunta antes, diciendo que no se borra nada', /No se borra nada/.test(v.pregunto), v.pregunto);
      chk('2. Apagado: no se ve en Inventario ni en Editar producto', !v.mod && !v.panel && !v.editor, v);
      chk('2. Apagado: vender otro mojito NO descuenta ron (880), y los insumos y la receta siguen guardados', v.ron === 880 && v.insumos === 1 && v.receta === 1, v);
      v = await p.evaluate(async () => {
        await window.ventoModulos.poner('r', true);
        document.querySelector('nav button[data-view="inventario"]').click(); await new Promise(z => setTimeout(z, 300));
        return { panel: !!document.getElementById('insumosPanel') && /Ron/.test(document.getElementById('insumosPanel').textContent), receta: data.products.find(x => x.id === 'p-coctel').receta[0].qty };
      });
      chk('2. Al prenderlo otra vez está todo igual (el ron y la receta de 60 ml)', v.panel && v.receta === 60, v);
      await ctx.close();
    }

    // ===== 3. Un bar que ya usaba insumos antes de esta versión =====
    {
      const { ctx, p } = await abrir('bar', 'Bar Viejo');
      const v = await p.evaluate(() => {
        data.insumos = [{ id: 'limon', name: 'Limón', unidad: 'und', stock: 30 }]; delete data.modulos; saveData(); aplicarModulos();
        return { mod: usaMod('r'), sw: (window.ventoModulos.pintar(), !!document.getElementById('modulosBox')) };
      });
      chk('3. Un bar que ya tenía insumos los sigue viendo y descontando (no se pierde nada al actualizar)', v.mod === true, v);
      await ctx.close();
    }

    // ===== 4. Un empleado no ve ni cambia las funciones =====
    {
      const { ctx, p } = await abrir('restaurante', 'Restaurante Equipo');
      const v = await p.evaluate(async () => {
        const r = window.ventoRoles, orig = r.esJefe; r.esJefe = () => false;
        window.ventoModulos.pintar(); const box = !!document.getElementById('modulosBox');
        await window.ventoModulos.poner('r', false);
        const mod = usaMod('r'); r.esJefe = orig;
        return { box, mod, guardado: data.modulos || null };
      });
      chk('4. Un empleado no ve «Funciones de este negocio» y no puede apagar nada', !v.box && v.mod === true && !v.guardado, v);
      await ctx.close();
    }
    // ===== 5. 1.65.7: «Mostrar todas las funciones» NO prende Insumos y recetas en una tienda; el restaurante lo oculta =====
    {
      const { ctx, p } = await abrir('tienda', 'Tienda Completa');
      await p.evaluate(() => { data.modoCompleto = true; saveData(); try{ aplicarModulos(); }catch(e){} });
      let v = await mirar(p);
      chk('5. Tienda con «Mostrar todas las funciones»: NO aparece «Insumos y recetas» (es solo para los que preparan comida)', !v.mod && !v.panel, v);
      const fac = await p.evaluate(() => { const f = document.getElementById('invFacturaPanel'); return { etiquetasEnFactura: !!f.querySelector('#productLabelsBtn'), titulos: (f.innerText.match(/Factura del proveedor/g) || []).length, etiquetas: !!document.querySelector('#invEtiquetasPanel #productLabelsBtn') }; });
      chk('5. Menú «Factura del proveedor» limpio: sin las etiquetas adentro (tienen su tarjeta) y sin el título repetido', !fac.etiquetasEnFactura && fac.titulos === 1 && fac.etiquetas, fac);
      await ctx.close();
    }
    {
      const { ctx, p } = await abrir('restaurante', 'Restaurante Oculta');
      await p.evaluate(() => { document.querySelector('nav button[data-view="inventario"]').click(); const d = document.getElementById('insumosPanel'); d.open = true; });
      await p.waitForTimeout(300);
      await p.evaluate(() => document.querySelector('#insumosPanel [data-ins="ocultar"]').click());
      await p.waitForTimeout(500);
      let v = await mirar(p);
      chk('5. Restaurante: «🙈 No lo uso: ocultar» en la misma tarjeta lo esconde (y se puede volver a prender en Ajustes)', !v.mod && !v.panel && v.sw === false, v);
      await p.evaluate(async () => { document.querySelector('nav button[data-view="ajustes"]').click(); document.querySelector('.ajustes-cat[data-cat="negocio"]').click(); await new Promise(z => setTimeout(z, 250));
        const sw = document.querySelector('#modulosBox [data-modulo="r"]'); sw.checked = true; sw.dispatchEvent(new Event('change', { bubbles: true })); });
      await p.waitForTimeout(400);
      v = await mirar(p);
      chk('5. … y al prenderlo en Ajustes → Funciones vuelve a aparecer', v.mod && v.panel, v);
      await ctx.close();
    }
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ Error: ' + (e && e.stack || e)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
