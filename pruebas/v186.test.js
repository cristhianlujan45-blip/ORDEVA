// 🛵 ORDEVA 1.86.0 · Domicilios con estados (lib/vento-domicilios.js + app/04e).
//  1. Los domicilios por facturar viven en los datos del negocio (todos los equipos); los que estaban en el celular se pasan.
//  2. El que llega por el link tiene el id del mensaje del canal: si llega dos veces (o a dos equipos), queda uno.
//  3. Al facturarlo queda «🍳 Preparando» en la venta, y sale de «por facturar». Si otro equipo ya lo facturó, no se factura otra vez.
//  4. El tablero: «🛵 Salió» (con quién lo lleva) → «✅ Entregado»; «📲 Avisar» abre el WhatsApp del cliente con el mensaje.
//  5. Deshacer la venta devuelve el domicilio a «por facturar». Descartar.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  const pausa = ms => new Promise(r => setTimeout(r, ms));
  try{
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    p.on('popup', pp => pp.close().catch(() => {}));
    await p.goto(BASE + '/index.html'); await pausa(1000);
    await p.evaluate(() => { const s = document.getElementById('authType'); s.value = 'restaurante'; s.dispatchEvent(new Event('change')); });
    await p.fill('#authBiz', 'Comidas 186'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await pausa(1500);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.domiciliosOn = true; data.products = [{ id: 'ham', name: 'Hamburguesa', price: 18000 }, { id: 'gas', name: 'Gaseosa', price: 4000 }]; data.history = []; data.domicilios = []; saveData(); try{ aplicarDomicilios(); }catch(e){} });

    // ===== 1 =====
    let v = await p.evaluate(() => { localStorage.setItem(window.ventoClave('vito_domis'), JSON.stringify([{ id: 'viejo1', ts: Date.now() - 6e5, nombre: 'Rosa', tel: '3001234567', dir: 'Cra 5 # 10-20', texto: '1 hamburguesa' }]));
      const l = domisPend(); return { ids: l.map(x => x.id), enDatos: data.domicilios.map(x => x.id + ':' + x.estado), queda: localStorage.getItem(window.ventoClave('vito_domis')) }; });
    chk('1. El domicilio que estaba guardado solo en este celular pasa a los datos del negocio (y se quita del celular)', v.ids.join() === 'viejo1' && v.enDatos.join() === 'viejo1:pendiente' && v.queda === null, v);

    // ===== 2 =====
    v = await p.evaluate(() => { const o = document.querySelectorAll('.overlay.show'); o.forEach(x => x.classList.remove('show'));
      window.__canalMsgId = 'MSG77'; domRecibir('Luis Pérez | 3109876543 | Calle 8 # 4-12 | 2 hamburguesa, 1 gaseosa'); document.querySelectorAll('.overlay.show').forEach(x => x.classList.remove('show'));
      domRecibir('Luis Pérez | 3109876543 | Calle 8 # 4-12 | 2 hamburguesa, 1 gaseosa'); window.__canalMsgId = '';
      document.querySelectorAll('.overlay.show').forEach(x => x.classList.remove('show'));
      return { ids: data.domicilios.map(x => x.id), boton: document.getElementById('domicilioBtn').textContent }; });
    chk('2. El mismo mensaje del canal dos veces (o en dos equipos): queda un solo domicilio «dmMSG77»', v.ids.join() === 'viejo1,dmMSG77', v);
    chk('2. El botón dice «🛵 Domicilio (2)»', /Domicilio \(2\)/.test(v.boton), v.boton);

    // ===== 3 =====
    await p.evaluate(() => { domAbrir('dmMSG77'); }); await pausa(300);
    v = await p.evaluate(() => ({ cli: document.getElementById('qsCliente').value, n: quickSaleCart.length }));
    chk('3. «Facturar» abre la factura del domicilio con el cliente y los productos', v.cli === 'Luis Pérez' && v.n === 2, v);
    await p.evaluate(() => { document.getElementById('qsEnvio').value = '3000'; document.getElementById('qsEnvio').dispatchEvent(new Event('input')); document.getElementById('qsMethod').value = 'debe'; document.getElementById('qsMethod').dispatchEvent(new Event('change')); document.getElementById('qsChargeBtn').click(); }); await pausa(300);
    await p.click('#confirmOkBtn'); await pausa(400);
    v = await p.evaluate(() => { const h = data.history[0], x = data.domicilios.find(y => y.id === 'dmMSG77'); return { estado: h.delivery && h.delivery.estado, tot: h.total, debe: h.debt, rec: x.estado + ':' + (x.ventaId === h.id), pend: domisPend().map(y => y.id) }; });
    chk('3. Al facturar, la venta queda «preparando» ($43.000, paga al recibir) y el domicilio sale de «por facturar»', v.estado === 'preparando' && v.tot === 43000 && v.debe === 43000 && v.rec === 'facturado:true' && v.pend.join() === 'viejo1', v);
    v = await p.evaluate(async () => { const x = data.domicilios.find(y => y.id === 'viejo1'); domAbrir('viejo1'); x.estado = 'facturado'; x.at = Date.now();   // otro equipo lo facturó mientras tanto
      const n = data.history.length; document.getElementById('qsChargeBtn').click(); await new Promise(r => setTimeout(r, 200)); document.getElementById('confirmOkBtn').click(); await new Promise(r => setTimeout(r, 300));
      const r = { n0: n, n1: data.history.length }; x.estado = 'pendiente'; delete x.at; document.getElementById('quickSaleOverlay').classList.remove('show'); quickSaleCart = []; return r; });
    chk('3. Si otro equipo ya lo facturó, este no lo factura otra vez', v.n0 === v.n1, v);

    // ===== 4 =====
    await p.click('#domicilioBtn'); await pausa(300);
    v = await p.evaluate(() => { const o = document.querySelector('.dm-ov'); return o ? o.innerText : null; });
    chk('4. El tablero: «Por facturar (1)» con Rosa y «Preparando (1)» con Luis', v && /Por facturar \(1\)/i.test(v) && /Rosa/.test(v) && /Preparando \(1\)/i.test(v) && /Luis Pérez/.test(v) && /Paga al recibir/.test(v), v);
    v = await p.evaluate(() => { const a = document.querySelector('.dm-ov [data-dm="wa"]'); return a ? decodeURIComponent(a.href) : null; });
    chk('4. «📲 Avisar» va al WhatsApp del cliente (+57 310…) con «lo estamos preparando»', v && /wa\.me\/573109876543/.test(v) && /preparando/.test(v), v);
    p.once('dialog', d => d.accept('Carlos'));
    await p.click('.dm-ov [data-dm="sig"]'); await pausa(300);
    v = await p.evaluate(() => { const h = data.history[0], a = document.querySelector('.dm-ov [data-dm="wa"]'); return { e: h.delivery.estado, rep: h.delivery.repartidor, hist: h.delivery.hist.map(x => x.e).join('>'), wa: a ? decodeURIComponent(a.href) : '', txt: document.querySelector('.dm-ov').innerText }; });
    chk('4. «🛵 Salió» (lo lleva Carlos): queda «En camino» con su historial', v.e === 'en_camino' && v.rep === 'Carlos' && v.hist === 'preparando>en_camino' && /En camino \(1\)/i.test(v.txt), v);
    chk('4. … y el WhatsApp dice «va en camino con Carlos» y «se paga al recibir»', /va en camino/.test(v.wa) && /con Carlos/.test(v.wa) && /se paga al recibir/.test(v.wa), v.wa);
    await p.click('.dm-ov [data-dm="sig"]'); await pausa(300);
    v = await p.evaluate(() => ({ e: data.history[0].delivery.estado, txt: document.querySelector('.dm-ov').innerText, act: window.ventoDomicilios.activos().length }));
    chk('4. «✅ Entregado»: sale de los activos y queda en «Entregado» de hoy', v.e === 'entregado' && v.act === 0 && /Entregado \(1\)/i.test(v.txt), v);

    // ===== 5 =====
    v = await p.evaluate(async () => { document.querySelectorAll('.dm-ov').forEach(o => o.remove());
      domAbrir('viejo1'); document.getElementById('qsChargeBtn').click(); await new Promise(r => setTimeout(r, 200)); document.getElementById('confirmOkBtn').click(); await new Promise(r => setTimeout(r, 300));
      const h = data.history[0], antes = domisPend().length; qsDeshacerVenta(h); const x = data.domicilios.find(y => y.id === 'viejo1'); return { antes, despues: domisPend().map(y => y.id), estado: x.estado, venta: data.history.some(y => y.id === h.id) }; });
    chk('5. Deshacer la venta del domicilio de Rosa: vuelve a «por facturar»', v.antes === 0 && v.despues.join() === 'viejo1' && v.estado === 'pendiente' && !v.venta, v);
    await p.click('#domicilioBtn'); await pausa(300);
    await p.click('.dm-ov [data-dm="descartar"]'); await pausa(200); await p.click('#confirmOkBtn'); await pausa(300);
    v = await p.evaluate(() => ({ pend: domisPend().length, est: data.domicilios.find(y => y.id === 'viejo1').estado, boton: document.getElementById('domicilioBtn').textContent }));
    chk('5. «✕ Descartar»: ya no está por facturar y el botón vuelve a «🛵 Domicilio»', v.pend === 0 && v.est === 'descartado' && /^🛵 Domicilio$/.test(v.boton.trim()), v);
    v = await p.evaluate(() => { data.domicilios.forEach(x => { if(x.estado !== 'pendiente') x.at = Date.now() - 3 * 864e5; }); window.ventoDomicilios.limpiar(); return data.domicilios.length; });
    chk('5. Los facturados y descartados de hace más de 2 días se limpian solos (la venta guarda los datos)', v === 0, v);

    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.message)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
