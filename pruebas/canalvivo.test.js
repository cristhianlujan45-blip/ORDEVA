// Canales en vivo por el SERVIDOR DE VENTO (ya no ntfy.sh), contra el «Supabase local» REAL:
//  1. Ninguna página habla con ntfy.sh.
//  2. QR de la mesa: la carta llega al cliente; el pedido llega a Vento; el estado («Recibido») vuelve al cliente.
//  3. Canción pedida por QR: llega a la cola de música.
//  4. App de meseros: recibe las mesas del celular principal y su pedido entra a la mesa.
//  5. Pantalla de preparación: recibe el pedido y al marcarlo «listo» cambia en Vento.
//  6. TV de la música: recibe la cola.
//  7. Avisos de pagos por MacroDroid y puente de WhatsApp: la dirección es la del servidor de Vento y funciona.
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
  let ok = 0, mal = 0; const errs = [], ntfy = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 500) : '')); } };
  const sb = await iniciar(); const b = await chromium.launch();
  try{ await pruebas(); } catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('1. Ninguna página se conectó a ntfy.sh', !ntfy.length, ntfy.slice(0, 5));
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close().catch(() => {}); await sb.cerrar().catch(() => {});
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);

  async function pruebas(){
    const esperar = (p, fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 15000, polling: 250 }).then(() => true, () => false);
    async function pagina(nombre, url, ancho){
      const ctx = await b.newContext({ viewport: { width: ancho || 390, height: 844 } });
      await ctx.route('**/*', rt => { const u = new URL(rt.request().url()); if(u.hostname === 'ntfy.sh') ntfy.push(nombre + ': ' + u.href); return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') ? rt.continue() : rt.abort(); });
      await enrutar(ctx, sb);
      await ctx.addInitScript(() => { try{ localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-hola', '0'); }catch(e){} });
      const p = await ctx.newPage(); p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
      await p.goto(url);
      return { ctx, p };
    }
    // ===== El negocio (restaurante, sin cuenta en la nube: los canales no la necesitan) =====
    const A = await pagina('negocio', BASE + '/index.html');
    await A.p.waitForSelector('#authOverlay:not([hidden])');
    await A.p.evaluate(() => { const s = document.getElementById('authType'); if(s){ s.value = 'restaurante'; s.dispatchEvent(new Event('change')); } });
    await A.p.fill('#authBiz', 'Restaurante Canal'); await A.p.fill('#authUser', 'ana'); await A.p.fill('#authPass', 'clave123'); await A.p.click('#authBtn');
    await A.p.waitForFunction(() => document.getElementById('authOverlay').hidden, null, { timeout: 15000 });
    await A.p.click('#onbSaltar', { timeout: 4000 }).catch(() => {});
    await A.p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    await A.p.evaluate(base => {
      data.products.push({ id: 'p-aguila', name: 'Águila', price: 3500, stock: 50, categoryId: (data.categories && data.categories[0] && data.categories[0].id) || undefined });
      saveData();
      const M = window.vitoMod, c = M.qCfg(); c.url = base + '/pedido.html'; c.live = true; M.SS('vito_qr', c);
      M.reconectarPedidos();
    }, BASE);
    const info = await A.p.evaluate(() => { const M = window.vitoMod, c = M.qCfg(); return { topic: c.topic, link: M.linkMesa(c, 1) }; });
    chk('El link del QR de la mesa no menciona ntfy', /pedido\.html\?mesa=1/.test(info.link) && !/ntfy/.test(info.link), info.link);
    await A.p.evaluate(() => typeof publicarCatalogo === 'function' && publicarCatalogo(true));

    // ===== 2. Cliente por QR =====
    const C = await pagina('cliente', info.link);
    chk('2. La carta del negocio le llega al cliente', await esperar(C.p, () => typeof cat !== 'undefined' && cat && Array.isArray(cat.p) && cat.p.some(r => r[0] === 'Águila'), null, 20000));
    await C.p.fill('#p', '2 Águila'); await C.p.click('#b');
    chk('2. El pedido llega a Vento (mesa 1, 2 Águila)', await esperar(A.p, () => (data.pedidos || []).some(p => p.mesa === 1 && p.items.some(i => i.name === 'Águila' && i.qty === 2)), null, 15000));
    const ped = await A.p.evaluate(() => (data.pedidos || []).find(p => p.mesa === 1));
    if(ped.estado === 'nuevo') await A.p.evaluate(id => pedidoCambiar(id, 'recibido'), ped.id);
    chk('2. El estado «Recibido» vuelve al celular del cliente', await esperar(C.p, () => jget(MISK, []).some(x => x.e === 'recibido' || x.e === 'preparacion' || x.e === 'listo'), null, 15000), await C.p.evaluate(() => jget(MISK, [])));
    const r = await sb.sql("select count(*)::int n from canal_mensajes where canal = $1", [info.topic]);
    chk('2. Los mensajes pasan por el servidor de Vento (tabla canal_mensajes)', r[0].n >= 1, r);

    // ===== 3. Canción =====
    await C.p.click('#tc'); await C.p.fill('#s', 'Karol G - Provenza'); await C.p.click('#b');
    chk('3. La canción pedida por QR llega a la cola de música', await esperar(A.p, () => { try{ return JSON.stringify(window.vitoMod.cola()).includes('Provenza'); }catch(e){ return false; } }, null, 15000));

    // ===== 4. App de meseros =====
    await A.p.evaluate(() => { const s = document.getElementById('mesOn'); if(s && !s.checked){ s.checked = true; s.dispatchEvent(new Event('change')); } window.vitoMod.reconectarPedidos(); });
    const mUrl = await A.p.evaluate(() => window.vitoMod.mUrl());
    chk('4. Link de la app de meseros', /mesero\.html#/.test(mUrl), mUrl);
    const M = await pagina('mesero', mUrl);
    if(await M.p.$('#nom')){ await M.p.fill('#nom', 'Luis'); await M.p.click('#nomOk'); }
    await A.p.evaluate(() => { try{ window.vitoMod.mPublicar(true); }catch(e){} });
    chk('4. El mesero recibe las mesas del celular principal', await esperar(M.p, () => document.querySelectorAll('#mesas button').length > 0, null, 20000));
    const [T, code] = mUrl.split('#')[1].split('.');
    await M.p.evaluate(([T, code]) => fetch('https://canal.vento.local/' + T + 'm' + code, { method: 'POST', body: JSON.stringify({ k: 'voz', texto: 'mesa 2 una águila', mesero: 'Luis', id: 'mx1' }) }), [T, code]);
    chk('4. El pedido del mesero entra a la mesa 2', await esperar(A.p, () => ((data.tables[2] || {}).items || []).some(i => /Águila/.test(i.name)), null, 15000));

    // ===== 5. Pantalla de preparación =====
    const pUrl = await A.p.evaluate(() => { const s = document.getElementById('prepOn'); if(s && !s.checked){ s.checked = true; s.dispatchEvent(new Event('change')); } window.vitoMod.reconectarPedidos(); return window.vitoMod.prepUrl(); });
    if(pUrl){
      const P = await pagina('preparación', pUrl, 1280);
      await C.p.click('#tp'); await C.p.fill('#p', '1 Águila'); await C.p.click('#b');
      await esperar(A.p, () => (data.pedidos || []).filter(p => p.mesa === 1).length >= 2, null, 15000);
      await A.p.evaluate(() => { (data.pedidos || []).filter(p => p.estado === 'nuevo').forEach(p => pedidoCambiar(p.id, 'recibido')); window.vitoMod.prepPublicar(true); });
      chk('5. La pantalla de preparación recibe el pedido', await esperar(P.p, () => document.querySelectorAll('#tablero button[data-id]').length > 0, null, 25000));
      const idPrep = await P.p.evaluate(() => { const b = document.querySelector('#tablero button[data-id]'); const id = b.getAttribute('data-id'); b.click(); return id; });
      chk('5. Al tocarlo en la pantalla, cambia en Vento', await esperar(A.p, id => { const p = (data.pedidos || []).find(x => x.id === id); return p && p.estado !== 'recibido'; }, idPrep, 15000));
    }else chk('5. Pantalla de preparación disponible', false, 'sin prepUrl');

    // ===== 6. TV =====
    const tvUrl = await A.p.evaluate(() => window.vitoMod.tvUrl ? window.vitoMod.tvUrl() : '');
    if(tvUrl){
      const TV = await pagina('tv', tvUrl, 1280);
      const tvc = tvUrl.split('#')[1];
      await A.p.evaluate(c => fetch('https://canal.vento.local/mesoratv' + c, { method: 'POST', body: JSON.stringify({ q: [{ i: 'x1', v: 'dQw4w9WgXcQ', s: 'Provenza', a: 'Karol G', m: 'Mesa 1' }, { i: 'x2', v: 'kJQP7kiw5Fk', s: 'Despacito', a: 'Luis Fonsi', m: 'Mesa 2' }], b: 'Restaurante Canal', t: Date.now() }) }), tvc);
      chk('6. El TV recibe la cola de canciones', await esperar(TV.p, () => /Despacito/.test(document.body.textContent) || /Provenza/.test(document.body.textContent), null, 20000));
    }else chk('6. Link del TV', false);

    // ===== 7. MacroDroid y WhatsApp =====
    const ext = await A.p.evaluate(() => window.ventoCanal.url('mesorapagoPRUEBA123'));
    chk('7. La dirección para MacroDroid y WhatsApp es la del servidor de Vento', /\/functions\/v1\/vento-pagos\/canal\/mesorapagoPRUEBA123$/.test(ext) && !/ntfy/.test(ext), ext);
    const rr = await fetch(sb.url + '/functions/v1/vento-pagos/canal/mesorapagoPRUEBA123', { method: 'POST', body: 'Nequi | ¡Te llegó plata! | PRUEBA te envió $1.000' });
    const jj = await rr.json();
    const leido = await A.p.evaluate(() => fetch('https://canal.vento.local/mesorapagoPRUEBA123/json?poll=1&since=5m').then(r => r.text()));
    chk('7. Publicar desde afuera (MacroDroid / puente) y leerlo en Vento', rr.status === 200 && jj.message && /PRUEBA te envió/.test(leido), { st: rr.status, jj, leido });
    const wsrc = await A.p.evaluate(() => document.getElementById('waWorkerSrc').textContent);
    chk('7. El puente de WhatsApp manda al canal de Vento (VENTO_CANAL), no a ntfy', /env\.VENTO_CANAL/.test(wsrc) && !/ntfy/i.test(wsrc));
  }
})();
