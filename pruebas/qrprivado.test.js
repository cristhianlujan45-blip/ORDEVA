// El QR del cliente ya no deja leer los pedidos del negocio (Vento 1.54.0, D8), en la app contra el «Supabase local»
// REAL y con el canal YA CERRADO (sin los 7 días de gracia):
//  1. El negocio con cuenta de Vento: su canal de pedidos queda anotado en el servidor.
//  2. El cliente del QR: le llega la carta, manda su pedido y un domicilio; el estado vuelve a su celular.
//  3. La app del local (con su sesión) recibe el pedido, el domicilio y la canción.
//  4. Alguien con el QR (la clave pública y el nombre del canal) intenta leer los pedidos: no recibe nada.
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
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 500) : '')); } };
  const sb = await iniciar(); const b = await chromium.launch();
  try{ await pruebas(); } catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close().catch(() => {}); await sb.cerrar().catch(() => {});
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);

  async function pruebas(){
    const uno = async (q, p) => (await sb.sql(q, p))[0];
    const esperar = (p, fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 15000, polling: 250 }).then(() => true, () => false);
    async function pagina(nombre, url){
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
      await ctx.route('**/*', rt => { const u = new URL(rt.request().url()); return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') ? rt.continue() : rt.abort(); });
      await enrutar(ctx, sb);
      await ctx.addInitScript(() => { try{ localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-hola', '0'); }catch(e){} });
      const p = await ctx.newPage(); p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
      await p.goto(url);
      return p;
    }

    // ===== 1. El negocio, con cuenta de Vento =====
    const A = await pagina('negocio', BASE + '/index.html');
    await A.waitForSelector('#authOverlay:not([hidden])');
    await A.waitForFunction(() => window.ventoNube && window.ventoNube.crearCuenta, null, { timeout: 15000 });
    await A.evaluate(() => { const s = document.getElementById('authType'); if(s){ s.value = 'restaurante'; s.dispatchEvent(new Event('change')); } });
    await A.fill('#authBiz', 'Bar Privado'); await A.fill('#authUser', 'dueno@privado.co'); await A.fill('#authPass', 'clave123'); await A.click('#authBtn');
    chk('1. El dueño crea la cuenta y queda en la nube', await esperar(A, () => document.getElementById('authOverlay').hidden && !!window.ventoNube.negocio(), null, 20000));
    await A.click('#onbSaltar', { timeout: 4000 }).catch(() => {});
    await A.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    const NEG = await A.evaluate(() => window.ventoNube.negocio().id);
    await A.evaluate(base => {
      data.products.push({ id: 'p-aguila', name: 'Águila', price: 3500, stock: 50 });
      saveData();
      const M = window.vitoMod, c = M.qCfg(); c.url = base + '/pedido.html'; c.live = true; M.SS('vito_qr', c);
      M.reconectarPedidos();
    }, BASE);
    const info = await A.evaluate(() => { const M = window.vitoMod, c = M.qCfg(); return { topic: c.topic, link: M.linkMesa(c, 1) }; });
    let anot = null;
    for(let i = 0; i < 40 && !anot; i++){ anot = await uno('select negocio_id from canal_privado where canal = $1', [info.topic]); if(!anot) await A.waitForTimeout(300); }
    chk('1. El canal de pedidos del negocio quedó anotado en el servidor a su nombre', anot && anot.negocio_id === NEG, anot);
    // Sin esperar los 7 días de gracia:
    await sb.sql("update canal_privado set cerrar_desde = now() - interval '1 minute'");
    await sb.sql("update servidor_config set valor = jsonb_build_object('t', now() - interval '1 minute') where clave = 'canal_privado_desde'");
    await A.evaluate(() => typeof publicarCatalogo === 'function' && publicarCatalogo(true));

    // ===== 2 y 3. Cliente por QR y la app del local =====
    const C = await pagina('cliente', info.link);
    chk('2. La carta le llega al cliente del QR', await esperar(C, () => typeof cat !== 'undefined' && cat && Array.isArray(cat.p) && cat.p.some(r => r[0] === 'Águila'), null, 20000));
    await C.fill('#p', '2 Águila'); await C.click('#b');
    chk('3. El pedido llega a la app del local (que lee con su sesión)', await esperar(A, () => (data.pedidos || []).some(p => p.mesa === 1 && p.items.some(i => i.name === 'Águila' && i.qty === 2)), null, 15000));
    const ped = await A.evaluate(() => (data.pedidos || []).find(p => p.mesa === 1));
    if(ped && ped.estado === 'nuevo') await A.evaluate(id => pedidoCambiar(id, 'recibido'), ped.id);
    chk('2. El estado «Recibido» vuelve al celular del cliente', await esperar(C, () => jget(MISK, []).some(x => x.e === 'recibido' || x.e === 'preparacion' || x.e === 'listo'), null, 15000));
    await C.click('#tc'); await C.fill('#s', 'Karol G - Provenza'); await C.click('#b');
    chk('3. La canción pedida por QR llega a la cola de música', await esperar(A, () => { try{ return JSON.stringify(window.vitoMod.cola()).includes('Provenza'); }catch(e){ return false; } }, null, 15000));
    await C.evaluate(t => fetch('https://canal.vento.local/' + t, { method: 'POST', body: 'DOMICILIO: Luis Pérez · 3001234567 · Calle 1 # 2-3 · 1 Águila' }), info.topic);
    await A.waitForTimeout(4000);

    // ===== 4. Alguien con el QR intenta leer los pedidos =====
    const espia = await fetch(sb.url + '/rest/v1/rpc/canal_leer', { method: 'POST', headers: { apikey: sb.anonKey, Authorization: 'Bearer ' + sb.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_canales: [info.topic], p_desde: Math.floor(Date.now() / 1000) - 3600 }) }).then(r => r.json());
    const hay = Number((await uno('select count(*) n from canal_mensajes where canal = $1', [info.topic])).n);
    chk('4. Con la clave pública y el nombre del canal (lo que trae el QR) no se lee NADA', Array.isArray(espia) && espia.length === 0 && hay >= 3, { espia, hay });
    const desdeCliente = await C.evaluate(t => fetch('https://canal.vento.local/' + t + '/json?poll=1&since=1h').then(r => r.text()), info.topic);
    chk('4. Ni desde la página del cliente (el domicilio no se ve)', !/3001234567|Águila/.test(desdeCliente), desdeCliente.slice(0, 200));
  }
})();
