// 🔒 ORDEVA 1.96 · Los canales del negocio solo los escribe el negocio, de punta a punta (PostgreSQL REAL + Servidor ORDEVA
// de pruebas, la app de verdad y pedido.html de verdad).
//  1. La app del negocio (con su sesión) publica la carta y el QR de pago: salen firmados.
//  2. Cerrada la gracia, un desconocido que conoce el canal (vio el QR) NO puede poner un QR de pago falso, y el que puso
//     antes ya no le llega al cliente: el cliente ve el QR del negocio.
//  3. Los estados de los pedidos siguen llegando al cliente, y el cliente sigue pidiendo por el QR.
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
    const ctx = await b.newContext({ viewport: vw || { width: 390, height: 844 }, locale: 'es-CO' });
    await ctx.route('**/*', rt => { const u = new URL(rt.request().url()); return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') ? rt.continue() : rt.abort(); });
    await enrutar(ctx, sb);
    await ctx.addInitScript(() => { try{ localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-hola', '0'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
    await p.goto(url); return { ctx, p };
  }
  async function pruebas(){
    const { p: A } = await pagina('negocio', BASE + '/index.html', { width: 1280, height: 800 });
    await A.waitForFunction(() => window.ventoNube && window.ventoNube.crearCuenta, null, { timeout: 15000 });
    await A.evaluate(() => { const s = document.getElementById('authType'); if(s){ s.value = 'bar'; s.dispatchEvent(new Event('change')); } });
    await A.fill('#authBiz', 'Bar Seguro'); await A.fill('#authUser', 'dueno@seguro.co'); await A.fill('#authPass', 'clave123'); await A.click('#authBtn');
    chk('0. El bar crea su cuenta en la nube', await esperar(A, () => document.getElementById('authOverlay').hidden && !!window.ventoNube.negocio(), null, 20000));
    await A.click('#onbSaltar', { timeout: 4000 }).catch(() => {});
    const topic = await A.evaluate(base => {
      document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.products = [{ id: 'cv', name: 'Cerveza', price: 4000 }]; saveData();
      const M = window.vitoMod, c = M.qCfg(); c.url = base + '/pedido.html'; c.live = true; M.SS('vito_qr', c); M.reconectarPedidos();
      return c.topic;
    }, BASE);
    // El canal queda registrado a nombre del bar (al guardar en la nube).
    const registrado = await (async () => { for(let i = 0; i < 40; i++){ await A.evaluate(async () => { try{ await saveData(); }catch(e){} }); const r = await sb.sql('select negocio_id from canal_privado where canal = $1', [topic]); if(r.length) return true; await new Promise(z => setTimeout(z, 500)); } return false; })();
    chk('0. El canal del QR queda registrado a nombre del bar', registrado, topic);

    // Un desconocido pone un QR de pago falso DURANTE la gracia (todavía se puede).
    const falso = await fetch(sb.url + '/rest/v1/rpc/canal_publicar', { method: 'POST', headers: { apikey: sb.anonKey, Authorization: 'Bearer ' + sb.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_canal: topic + 'f', p_cuerpo: JSON.stringify({ n: '__qrpago__', q: 'Nequi', l: '@ladron', i: 'data:image/png;base64,iVBORw0KGgo=' }) }) });
    chk('1. Durante la gracia un desconocido todavía escribe (lo de antes no se rompe de golpe)', falso.ok, falso.status);

    // Se cierra la gracia. El negocio publica la carta y su QR de pago (la llave Bre-B) con su sesión.
    await sb.sql("update servidor_config set valor = jsonb_build_object('t', now() - interval '1 minute') where clave = 'canal_escribir_desde'");
    // El dueño pone su QR de pago como en la app (Ajustes → Mi QR de pago): la app lo publica. Se pide publicar «sin QR» y
    // enseguida el QR (como cuando la app recién abre y el dueño lo cambia): las publicaciones van en fila y gana la última.
    await A.evaluate(async () => {
      window.vitoPublicarCatalogo && window.vitoPublicarCatalogo(true);
      const sinQR = window.qrPagoPublicar(true);
      data.qrPago = { img: 'data:image/png;base64,iVBORw0KGgo=', tipo: 'Bre-B', llave: '@barseguro' }; saveData();
      await Promise.all([sinQR, window.qrPagoPublicar(true)]);
    });
    const firmados = async (s) => (await sb.sql('select count(*)::int n from canal_mensajes where canal = $1 and firmado', [topic + s]))[0].n;
    chk('1. La app del negocio publica el QR de pago con su sesión (queda firmado)', await (async () => { for(let i = 0; i < 30; i++){ if(await firmados('f') > 0) return true; await new Promise(z => setTimeout(z, 500)); } return false; })());
    const ultimo = async () => { const r = await sb.sql("select cuerpo from canal_mensajes where canal = $1 and firmado and cuerpo like '%__qrpago__%' order by id desc limit 1", [topic + 'f']); return r[0] ? JSON.parse(r[0].cuerpo) : null; };
    chk('1. Lo último publicado es el QR del bar, no «sin QR» (las publicaciones van en fila: gana la última)', await (async () => { for(let i = 0; i < 40; i++){ const u = await ultimo(); if(u && u.l === '@barseguro') return true; await new Promise(z => setTimeout(z, 500)); } return false; })(), await ultimo());
    chk('1. … y la carta también', await (async () => { for(let i = 0; i < 30; i++){ if(await firmados('k') > 0) return true; await new Promise(z => setTimeout(z, 500)); } return false; })());

    const otro = await fetch(sb.url + '/rest/v1/rpc/canal_publicar', { method: 'POST', headers: { apikey: sb.anonKey, Authorization: 'Bearer ' + sb.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_canal: topic + 'f', p_cuerpo: JSON.stringify({ n: '__qrpago__', q: 'Nequi', l: '@ladron2', i: '' }) }) });
    chk('2. Cerrada la gracia, un desconocido ya NO puede poner un QR de pago falso', otro.status === 401 || otro.status === 403, otro.status);

    const link = await A.evaluate(() => window.vitoMod.linkMesa(window.vitoMod.qCfg(), 3));
    const { p: C } = await pagina('cliente', link);
    chk('2. El cliente ve la llave del bar (@barseguro) y nunca la del ladrón', await esperar(C, () => typeof qrPago !== 'undefined' && qrPago && qrPago.l === '@barseguro', null, 25000) && await C.evaluate(() => !JSON.stringify(localStorage).includes('@ladron')),
      await C.evaluate(() => typeof qrPago !== 'undefined' ? qrPago : null));

    // 3. El cliente pide; el negocio lo acepta y el estado le llega.
    await C.evaluate(c => fetch('https://canal.vento.local/' + c, { method: 'POST', body: JSON.stringify({ t: 'pedido', v: 2, id: 'pq196' + Date.now().toString(36), mesa: 3, vm: new URL(location.href).searchParams.get('v'), items: [{ n: 'Cerveza', q: 1, p: 4000 }], total: 4000, at: Date.now() }) }), topic);
    chk('3. El pedido del cliente llega a la cuenta de la mesa 3 (el canal de pedidos sigue abierto)', await esperar(A, () => (data.tables[3] && data.tables[3].items || []).some(i => i.name === 'Cerveza'), null, 20000));
    chk('3. … y el estado del pedido le llega al cliente (firmado por el negocio)', await (async () => { for(let i = 0; i < 40; i++){ const r = await sb.sql("select count(*)::int n from canal_mensajes where canal = $1 and firmado and cuerpo like '%\"t\":\"estado\"%'", [topic + 'e']); if(r[0].n > 0) return true; await new Promise(z => setTimeout(z, 500)); } return false; })());
  }
})();
