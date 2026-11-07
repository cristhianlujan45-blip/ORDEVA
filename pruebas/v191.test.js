// 🍲 ORDEVA 1.91.0 · Menú del día (lib/vento-menudia.js).
//  1. Restaurante: arriba de las mesas «Menú del día · Ponlo para hoy»; en una tienda no sale.
//  2. Se publica (precio, porciones, sopa, principio, proteínas, bebida): queda el producto con lo que trae (sale en la
//     carta del QR), las proteínas como variantes y las porciones como existencias.
//  3. Al vender se descuentan las porciones («quedan 38»).
//  4. Al otro día no se vende el de ayer (porciones en 0) y «Igual que el último» lo llena.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
  const pausa = ms => new Promise(r => setTimeout(r, ms));
  try{
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await pausa(1000);
    await p.evaluate(() => { const s = document.getElementById('authType'); s.value = 'restaurante'; s.dispatchEvent(new Event('change')); });
    await p.fill('#authBiz', 'Corrientazo 191'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await pausa(1500);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); data.history = []; delete data.menuDia; data.products = (data.products || []).filter(x => x.id !== 'menu-dia'); saveData(); window.ventoMenuDia.pintar(); });
    await pausa(300);
    let v = await p.evaluate(() => { const c = document.getElementById('menuDiaCard'); return c ? c.innerText : null; });
    chk('1. Restaurante: arriba de las mesas «Menú del día · Ponlo para hoy»', v && /Menú del día/.test(v) && /Ponlo para hoy/.test(v), v);
    await p.click('#menuDiaCard'); await pausa(200);
    await p.fill('.md-ov [data-md="precio"]', '15000'); await p.fill('.md-ov [data-md="porciones"]', '40'); await p.fill('.md-ov [data-md="sopa"]', 'Sopa de pasta');
    await p.fill('.md-ov [data-md="principio"]', 'Arroz, frijoles y maduro'); await p.fill('.md-ov [data-md="proteinas"]', 'Pollo, Cerdo, Res'); await p.fill('.md-ov [data-md="bebida"]', 'Jugo de mora');
    await p.click('.md-ov [data-md-si]'); await pausa(300);
    v = await p.evaluate(() => { const x = data.products.find(y => y.id === 'menu-dia'); return x && { precio: x.price, stock: x.stock, ingre: x.det && x.det.ingre, vars: (x.variantes || []).map(y => y.n), resumen: typeof detResumen === 'function' ? detResumen(x) : '' }; });
    chk('2. Queda el producto «Menú del día» a $15.000 con 40 porciones', v && v.precio === 15000 && v.stock === 40, v);
    chk('2. … con lo que trae (lo ve el cliente en la carta del QR) y las 3 proteínas para elegir', v && /Sopa: Sopa de pasta/.test(v.ingre) && /Principio: Arroz/.test(v.ingre) && /Bebida: Jugo de mora/.test(v.ingre) && v.vars.join() === 'Pollo,Cerdo,Res' && /Sopa de pasta/.test(v.resumen), v);
    v = await p.evaluate(() => { window.qsRegistrarVenta([{ productId: 'menu-dia', name: '🍲 Menú del día', price: 15000, qty: 2, variante: 'Pollo' }], { method: 'efectivo' }); window.ventoMenuDia.pintar(); return { stock: data.products.find(y => y.id === 'menu-dia').stock, card: document.getElementById('menuDiaCard').innerText }; });
    chk('3. Al vender 2, quedan 38 porciones y la tarjeta lo dice', v.stock === 38 && /quedan 38/.test(v.card), v);
    v = await p.evaluate(() => { const ay = new Date(Date.now() - 864e5); data.menuDia.fecha = ay.getFullYear() + '-' + String(ay.getMonth() + 1).padStart(2, '0') + '-' + String(ay.getDate()).padStart(2, '0'); window.ventoMenuDia.revisarDia(); window.ventoMenuDia.pintar(); return { stock: data.products.find(y => y.id === 'menu-dia').stock, card: document.getElementById('menuDiaCard').innerText }; });
    chk('4. Al otro día no se vende el de ayer (0 porciones) y pide ponerlo para hoy', v.stock === 0 && /Ponlo para hoy/.test(v.card), v);
    await p.click('#menuDiaCard'); await pausa(200); await p.click('.md-ov [data-md-igual]'); await pausa(100);
    v = await p.evaluate(() => ({ precio: document.querySelector('.md-ov [data-md="precio"]').value, prot: document.querySelector('.md-ov [data-md="proteinas"]').value }));
    chk('4. «Igual que el último» lo llena (precio y proteínas)', v.precio === '15000' && v.prot === 'Pollo, Cerdo, Res', v);
    await p.click('.md-ov [data-md-si]'); await pausa(200);
    v = await p.evaluate(() => ({ stock: data.products.find(y => y.id === 'menu-dia').stock, hoy: window.ventoMenuDia.deHoy() }));
    chk('4. … y al publicarlo vuelve a tener sus 40 porciones', v.stock === 40 && v.hoy, v);
    v = await p.evaluate(() => { data.businessType = 'tienda'; window.ventoMenuDia.pintar(); const r = !!document.getElementById('menuDiaCard'); data.businessType = 'restaurante'; return r; });
    chk('1. En una tienda no sale', v === false, v);
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.message)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
