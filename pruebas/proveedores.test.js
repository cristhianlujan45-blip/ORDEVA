// 🛒 ORDEVA 1.76.0 · Pedido a cada proveedor por WhatsApp (app/23-cerebro-app-ventas.js). Sin internet.
//  1. La lista de compras agrupa por proveedor lo que se está acabando.
//  2. «📲 Enviar» sin el WhatsApp del proveedor lo pide; con él abre WhatsApp a ESE número con SU parte del pedido.
//  3. El número queda guardado y el pedido queda «📦 por llegar»; «✅ Llegó» suma lo pedido al inventario.
//  4. En 📦 Inventario está «🛒 Pedido a proveedores». Sin errores.
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
    await p.waitForFunction(() => !!window.Laya && !!window.Laya.abrirLista, null, { timeout: 10000 });
    await p.evaluate(() => { const b = document.querySelector('nav button[data-view="mesas"]'); if(b) b.click(); });
    await p.waitForTimeout(500);
    return { ctx, p };
  }
  try{
    const { p } = await abrir('minimercado', 'Minimercado La 14');
    await p.evaluate(() => {
      window.__abiertos = []; window.open = u => { window.__abiertos.push(String(u)); return null; };
      data.products = [{ id: 'g1', name: 'Gaseosa Postobón 400', price: 2500, stock: 1, minStock: 6 }, { id: 'g2', name: 'Agua Cristal', price: 1500, stock: 0, minStock: 5 },
        { id: 'a1', name: 'Arroz Diana 500 g', price: 3200, stock: 2, minStock: 8 }, { id: 'ok', name: 'Sal', price: 1000, stock: 40, minStock: 5 }];
      data.purchases = [{ supplier: 'Postobón', items: [{ productId: 'g1' }, { productId: 'g2' }] }, { supplier: 'Distribuidora Diana', items: [{ productId: 'a1' }] }];
      saveData(); window.Laya.abrirLista();
    });
    await p.waitForTimeout(400);
    let v = await p.evaluate(() => [...document.querySelectorAll('#layaListaOv .ll-prov')].map(g => g.querySelector('.ll-ph b').textContent + ':' + g.querySelectorAll('.ll-fila').length));
    chk('1. Agrupado por proveedor: Postobón (2) y Distribuidora Diana (1); la sal (con stock) no está', v.length === 2 && v.includes('Postobón:2') && v.includes('Distribuidora Diana:1'), v);
    await p.click('#layaListaOv [data-ll="wa1"][data-prov="Postobón"]'); await p.waitForTimeout(200);
    v = await p.evaluate(() => ({ ab: window.__abiertos.length, t: (document.getElementById('toast') || {}).textContent || '' }));
    chk('2. Sin el WhatsApp del proveedor: lo pide y no abre nada', v.ab === 0 && /WhatsApp de Postobón/.test(v.t), v);
    await p.fill('#layaListaOv [data-tel="Postobón"]', '300 111 2233');
    await p.click('#layaListaOv [data-ll="wa1"][data-prov="Postobón"]'); await p.waitForTimeout(400);
    v = await p.evaluate(() => ({ u: decodeURIComponent(window.__abiertos[0] || ''), tel: (data.proveedoresTel || {})['Postobón'], pend: (data.pedidosProv || []).filter(x => !x.llego).map(x => x.prov + ':' + x.items.map(i => i.q + ' ' + i.n).join('+')) }));
    chk('2. Abre WhatsApp al 573001112233 con SU parte: gaseosas y agua (no el arroz)', /^https:\/\/wa\.me\/573001112233\?text=/.test(v.u) && /Gaseosa Postobón 400/.test(v.u) && /Agua Cristal/.test(v.u) && !/Arroz/.test(v.u) && /Minimercado La 14/.test(v.u), v.u);
    chk('3. El WhatsApp queda guardado y el pedido queda por llegar', v.tel === '300 111 2233' && v.pend.length === 1 && /^Postobón:/.test(v.pend[0]), v);
    v = await p.evaluate(() => ({ t: document.getElementById('layaListaOv').innerText.replace(/\s+/g, ' '), tel: document.querySelector('#layaListaOv [data-tel="Postobón"]').value }));
    chk('3. La lista muestra «📦 Pedidos por llegar» y «Ya le pediste…»; el número ya viene puesto', /Pedidos por llegar/.test(v.t) && /Ya le pediste/.test(v.t) && v.tel === '300 111 2233', v);
    const antes = await p.evaluate(() => ({ g1: data.products.find(x => x.id === 'g1').stock, g2: data.products.find(x => x.id === 'g2').stock, pd: data.pedidosProv[0].items }));
    await p.click('#layaListaOv [data-ll="llego"]'); await p.waitForTimeout(400);
    v = await p.evaluate(() => ({ g1: data.products.find(x => x.id === 'g1').stock, g2: data.products.find(x => x.id === 'g2').stock, a1: data.products.find(x => x.id === 'a1').stock, llego: !!data.pedidosProv[0].llego }));
    const q1 = antes.pd.find(i => i.id === 'g1').q, q2 = antes.pd.find(i => i.id === 'g2').q;
    chk('3. «✅ Llegó»: suma lo pedido al inventario (gaseosa y agua; el arroz no)', v.g1 === antes.g1 + q1 && v.g2 === antes.g2 + q2 && v.a1 === 2 && v.llego, { v, antes });
    v = await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); const b = document.querySelector('nav button[data-view="inventario"]'); if(b) b.click(); return new Promise(r => setTimeout(() => r(!!document.getElementById('llBtn')), 1800)); });
    chk('4. En 📦 Inventario está «🛒 Pedido a proveedores»', v);
    chk('4. Sin errores en la página', errs.length === 0, errs);
  }catch(e){ mal++; console.log('❌ Error: ' + (e.stack || e)); }
  await b.close();
  console.log('\nRESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
