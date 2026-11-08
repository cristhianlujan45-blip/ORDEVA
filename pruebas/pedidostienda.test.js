// 🛍️ ORDEVA 1.95.2 · Pedidos del QR en una TIENDA, de punta a punta (PostgreSQL REAL + Servidor ORDEVA de pruebas, la app
// de verdad y pedido.html de verdad, pidiendo como el cliente).
//  1. Llega un pedido: NO entra solo a la cuenta ni a la cocina; sale abajo «🛒 Pedido nuevo · Cuenta 2» con lo que pidió,
//     el total y «✅ Aceptar / Rechazar». El cliente ve «Esperando que lo acepten».
//  2. «✅ Aceptar»: entra a la cuenta y queda «Aceptado: lo estamos alistando» (no «En preparación»); el cliente lo ve.
//  3. «🛍️ Pedidos» → «📦 Entregado»; el cliente ve «Entregado».
//  4. Otro pedido → «Rechazar» (pregunta antes): no entra a la cuenta y el cliente ve «Rechazado».
//  5. «Después» lo esconde; en «🛍️ Pedidos» sigue por aceptar y se acepta desde ahí. La campana dice «✅ Aceptar», no «Enviar».
//  6. Un restaurante sigue igual (entra solo a la cuenta y va a la cocina); el interruptor de Ajustes manda.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('fs');
const { spawnSync } = require('child_process');
function hayPostgres(){ if(process.env.VENTO_PG_URL || fs.existsSync('/usr/lib/postgresql')) return true; return spawnSync('bash', ['-c', 'command -v psql || command -v pg_ctl'], { stdio: 'ignore' }).status === 0; }
if(!process.env.VENTO_LOGS) for(const k of ['log', 'warn', 'error']){ const orig = console[k].bind(console); console[k] = (...a) => { if(typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; orig(...a); }; }

(async () => {
  if(!hayPostgres()){ console.log('RESULTADO 0 bien 0 mal (sin PostgreSQL: se omitió)'); process.exit(0); }
  const { iniciar, enrutar } = require('./servidor/supabase-local');
  const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
  let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 600) : '')); } };
  const sb = await iniciar(); const b = await chromium.launch();
  const esperar = (p, fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 20000, polling: 300 }).then(() => true, () => false);
  try{ await pruebas(); } catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close().catch(() => {}); await sb.cerrar().catch(() => {});
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);

  async function pagina(nombre, url, vw){
    const ctx = await b.newContext({ viewport: vw || { width: 400, height: 860 }, locale: 'es-CO' });
    await ctx.route('**/*', rt => { const u = new URL(rt.request().url()); return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') ? rt.continue() : rt.abort(); });
    await enrutar(ctx, sb);
    await ctx.addInitScript(() => { try{ localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-hola', '0'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
    await p.goto(url); return p;
  }
  async function pruebas(){
    const A = await pagina('tienda', BASE + '/index.html');
    await A.waitForFunction(() => window.ventoNube && window.ventoNube.crearCuenta, null, { timeout: 15000 });
    await A.evaluate(() => { const s = document.getElementById('authType'); if(s){ s.value = 'tienda'; s.dispatchEvent(new Event('change')); } });
    await A.fill('#authBiz', 'Tienda Doña Rosa'); await A.fill('#authUser', 'rosa@tienda.co'); await A.fill('#authPass', 'clave123'); await A.click('#authBtn');
    chk('0. La tienda crea su cuenta en la nube', await esperar(A, () => document.getElementById('authOverlay').hidden && !!window.ventoNube.negocio(), null, 20000));
    await A.click('#onbSaltar', { timeout: 4000 }).catch(() => {});
    const cfg = await A.evaluate(base => {
      document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.businessType = 'tienda'; delete data.pedidosAuto;
      data.products = [{ id: 'ar', name: 'Arroz Diana 500 g', price: 3200 }, { id: 'ac', name: 'Aceite 1 L', price: 9800 }, { id: 'hu', name: 'Huevos x 12', price: 7500 }];
      Object.keys(data.tables).forEach(k => { data.tables[k] = { items: [], payments: [], people: [] }; }); saveData();
      const M = window.vitoMod, c = M.qCfg(); c.url = base + '/pedido.html'; c.live = true; M.SS('vito_qr', c); M.reconectarPedidos();
      return { topic: M.qCfg().topic, v: window.vitoCanalPrueba.vTopic(2), simple: window.vitoPedidos.simple(), auto: window.vitoPedidos.auto() };
    }, BASE);
    chk('0. En la tienda los pedidos del QR esperan a que los acepten (sin cocina)', cfg.simple === true && cfg.auto === false, cfg);
    await A.waitForTimeout(2500);

    const C = await pagina('cliente', BASE + '/pedido.html?mesa=2&c=' + cfg.topic + '&v=' + cfg.v);
    await C.waitForTimeout(1500);
    const pedir = async txt => { await C.click('#tp').catch(() => {}); await C.fill('#p', txt); await C.click('#b'); };
    const estCli = () => C.evaluate(() => (document.getElementById('estPed') || {}).innerText || '');

    // ===== 1 =====
    await pedir('2 Arroz Diana 500 g');
    chk('1. Llega a la tienda «Por aceptar» y NO entra sola a la cuenta', await esperar(A, () => (data.pedidos || []).some(p => p.estado === 'nuevo') && !(data.tables[2] && (data.tables[2].items || []).length), null, 25000),
      await A.evaluate(() => ({ p: (data.pedidos || []).map(p => p.estado), t2: data.tables[2] })));
    chk('1. Abajo: «🛒 Pedido nuevo · Cuenta 2», 2 × Arroz, total $6.400, «✅ Aceptar» y «Rechazar»', await esperar(A, () => { const h = document.getElementById('ptHoja'); return h && /Pedido nuevo · Cuenta 2/.test(h.innerText) && /2 × Arroz Diana/.test(h.innerText) && /6\.400/.test(h.innerText) && !!h.querySelector('[data-pt="ok"]') && !!h.querySelector('[data-pt="no"]'); }, null, 8000),
      await A.evaluate(() => (document.getElementById('ptHoja') || {}).innerText));
    chk('1. … nada en la cocina: no hay pedidos «Recibido / En preparación»', await A.evaluate(() => !(data.pedidos || []).some(p => ['recibido', 'preparacion'].includes(p.estado))));
    chk('1. El cliente ve «Esperando que lo acepten»', await esperar(C, () => /Esperando que lo acepten/.test((document.getElementById('estPed') || {}).innerText || ''), null, 20000), await estCli());

    // ===== 2 =====
    await A.click('#ptHoja [data-pt="ok"]');
    let v = await A.evaluate(() => ({ est: data.pedidos.map(p => p.estado), items: (data.tables[2].items || []).map(i => i.name + '×' + i.qty), hoja: !!document.getElementById('ptHoja') }));
    chk('2. «✅ Aceptar»: entra a la Cuenta 2 (2 × Arroz) y queda «Aceptado: lo estamos alistando» (listo), sin cocina; el aviso se va', v.est.join() === 'listo' && v.items.join() === 'Arroz Diana 500 g×2' && !v.hoja, v);
    chk('2. El cliente ve «Aceptado: lo estamos alistando»', await esperar(C, () => /Aceptado: lo estamos alistando/.test((document.getElementById('estPed') || {}).innerText || ''), null, 20000), await estCli());

    // ===== 3 =====
    await A.evaluate(() => window.ventoPedidosTienda.panel()); await A.waitForTimeout(300);
    v = await A.evaluate(() => document.getElementById('ptOv').innerText);
    chk('3. «🛍️ Pedidos»: la Cuenta 2 en «Aceptados, por entregar» con «📦 Entregado»', /Aceptados, por entregar \(1\)/.test(v) && /Cuenta 2/.test(v) && /Entregado/.test(v), v);
    await A.click('#ptOv [data-pt="ent"]');
    chk('3. «📦 Entregado»: el pedido queda entregado y el cliente ve «Entregado»', await A.evaluate(() => data.pedidos[0].estado === 'entregado') && await esperar(C, () => /📦 Entregado/.test((document.getElementById('estPed') || {}).innerText || ''), null, 20000), await estCli());
    await A.evaluate(() => document.getElementById('ptOv').classList.remove('show'));

    // ===== 4 =====
    await C.waitForTimeout(800); await pedir('1 Aceite 1 L');
    await esperar(A, () => !!document.querySelector('#ptHoja [data-pt="no"]'), null, 25000);
    await A.click('#ptHoja [data-pt="no"]');
    chk('4. «Rechazar» pregunta antes («¿Rechazar el pedido de Cuenta 2?»)', await esperar(A, () => { const o = document.getElementById('confirmOkBtn'); return o && o.offsetParent && /Rechazar el pedido de Cuenta 2/.test(document.body.innerText); }, null, 5000));
    await A.click('#confirmOkBtn');
    v = await A.evaluate(() => ({ est: data.pedidos.map(p => p.estado), aceite: (data.tables[2].items || []).some(i => /Aceite/.test(i.name)) }));
    chk('4. … rechazado: no entra a la cuenta', v.est.join() === 'entregado,cancelado' && !v.aceite, v);
    chk('4. El cliente ve «Rechazado»', await esperar(C, () => /❌ Rechazado/.test((document.getElementById('estPed') || {}).innerText || ''), null, 20000), await estCli());

    // ===== 5 =====
    await C.waitForTimeout(800); await pedir('1 Huevos x 12');
    await esperar(A, () => !!document.querySelector('#ptHoja [data-pt="luego"]'), null, 25000);
    await A.click('#ptHoja [data-pt="luego"]'); await A.waitForTimeout(1300);
    v = await A.evaluate(() => ({ hoja: !!document.getElementById('ptHoja'), nuevos: window.ventoPedidosTienda.nuevos().length }));
    chk('5. «Después» esconde el aviso; el pedido sigue por aceptar', !v.hoja && v.nuevos === 1, v);
    await A.evaluate(() => window.ventoPedidosTienda.panel()); await A.waitForTimeout(300);
    chk('5. En «🛍️ Pedidos» sale en «Por aceptar (1)»', /Por aceptar \(1\)/.test(await A.evaluate(() => document.getElementById('ptOv').innerText)));
    await A.click('#ptOv [data-pt="ok"]');
    v = await A.evaluate(() => ({ est: data.pedidos[2].estado, items: data.tables[2].items.map(i => i.name) }));
    chk('5. … y se acepta desde ahí: los huevos entran a la cuenta', v.est === 'listo' && v.items.includes('Huevos x 12'), v);
    await A.evaluate(() => document.getElementById('ptOv').classList.remove('show'));
    await C.waitForTimeout(800); await pedir('1 Aceite 1 L');
    await esperar(A, () => window.ventoPedidosTienda.nuevos().length === 1, null, 25000);
    await A.evaluate(() => { const bell = document.querySelector('.vito-campana'); if(bell) bell.click(); }); await A.waitForTimeout(500);
    v = await A.evaluate(() => { const m = document.querySelector('.vito-campana-menu') || document.body; const t = m.innerText; return { aceptar: /✅ Aceptar/.test(t), enviar: /Enviar pedido/.test(t), porAceptar: /Por aceptar \(1\)/i.test(t), entregado: /📦 Entregado/.test(t) }; });
    chk('5. La campana: «Por aceptar (1)» con «✅ Aceptar» (no «Enviar pedido») y «📦 Entregado» en los aceptados', v.aceptar && !v.enviar && v.porAceptar && v.entregado, v);

    // ===== 6 =====
    v = await A.evaluate(() => { data.businessType = 'restaurante'; const r = { simple: window.vitoPedidos.simple(), auto: window.vitoPedidos.auto() }; data.businessType = 'tienda'; data.pedidosAuto = true; r.tiendaAuto = window.vitoPedidos.auto(); delete data.pedidosAuto; return r; });
    chk('6. Un restaurante sigue igual (entra solo a la cuenta, con cocina); si la tienda prende «aceptar solo», manda eso', v.simple === false && v.auto === true && v.tiendaAuto === true, v);
  }
})();
