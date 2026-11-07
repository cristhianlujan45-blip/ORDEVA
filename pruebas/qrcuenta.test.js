// 🔄 ORDEVA 1.95.1 · El QR de la mesa sincronizado con su cuenta, de punta a punta (PostgreSQL REAL + Servidor ORDEVA de
// pruebas, la app de verdad y pedido.html de verdad). El QR pegado en la mesa lo imprimió OTRO equipo del negocio: su código
// no es el de este equipo, pero está en los datos del negocio (data.qrCodigos).
//  1. El mesero anota 2 cervezas en la mesa 3. El cliente abre el QR y SIN pedir nada ve su cuenta (antes: «sin consumo»
//     hasta su primer pedido, y nunca si el QR lo imprimió otro equipo).
//  2. El cliente pide por el QR: el pedido entra solo a la cuenta (no «por aceptar») y el cliente lo ve en su cuenta.
//  3. El mesero agrega otra cosa: le llega al cliente.
//  4. Un QR con un código que nadie conoce: no se le publica la cuenta y el dueño recibe el aviso.
//  5. Un código que solo tenía guardado este equipo (QR viejos) se comparte en los datos del negocio.
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
    await A.fill('#authBiz', 'Bar La Esquina'); await A.fill('#authUser', 'dueno@esquina.co'); await A.fill('#authPass', 'clave123'); await A.click('#authBtn');
    chk('0. El bar crea su cuenta en la nube', await esperar(A, () => document.getElementById('authOverlay').hidden && !!window.ventoNube.negocio(), null, 20000));
    await A.click('#onbSaltar', { timeout: 4000 }).catch(() => {});
    const OTRO = 'vbqrdeotroequipo3x', FALSO = 'vbqrquenadieconoce9';
    const cfg = await A.evaluate(([base, otro]) => {
      document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.products = [{ id: 'cv', name: 'Cerveza Águila', price: 4000 }, { id: 'pk', name: 'Picada', price: 30000 }, { id: 'ag', name: 'Agua', price: 2500 }];
      Object.keys(data.tables).forEach(k => { data.tables[k] = { items: [], payments: [], people: [] }; });
      data.qrCodigos = Object.assign({}, data.qrCodigos || {}, { 3: [otro] });          // el código del QR que imprimió el otro equipo
      saveData();
      const M = window.vitoMod, c = M.qCfg(); c.url = base + '/pedido.html'; c.live = true;
      c.v = Object.assign({}, c.v || {}, { 3: 'vbcodigodeesteequipo3' });              // este equipo tiene SU propio código para la mesa 3
      M.SS('vito_qr', c); M.reconectarPedidos();
      return { topic: M.qCfg().topic, propio: (M.qCfg().v || {})[3] || null };
    }, [BASE, OTRO]);
    chk('0. Este equipo tiene otro código para la mesa 3 (el QR pegado lo imprimió otro equipo)', cfg.topic && cfg.propio === 'vbcodigodeesteequipo3', cfg);
    // El mesero anota 2 cervezas (sin ningún mensaje del QR todavía)
    await A.evaluate(() => { data.tables[3].items.push({ productId: 'cv', name: 'Cerveza Águila', price: 4000, qty: 2, personId: null, history: [{ qty: 2, at: Date.now() }] }); saveData(); });
    await A.waitForTimeout(3500);

    // ===== 1 =====
    const url = (v, mesa) => BASE + '/pedido.html?mesa=' + (mesa || 3) + '&c=' + cfg.topic + '&v=' + v;
    const { p: C } = await pagina('cliente', url(OTRO));
    chk('1. El cliente abre el QR y SIN pedir nada ve su cuenta: 2 × Cerveza Águila, $8.000', await esperar(C, () => /2 × Cerveza Águila/.test(document.getElementById('cs').innerText) && /8\.000/.test(document.getElementById('cs').innerText), null, 25000),
      await C.evaluate(() => document.getElementById('cs').innerText));
    const holas = (await sb.sql("select count(*)::int n from canal_mensajes where canal = $1 and cuerpo like '%\"t\":\"hola\"%'", [cfg.topic]))[0].n;
    chk('1. … la página avisó al negocio una sola vez («hola» con el código de su QR)', holas === 1, holas);

    // ===== 2 =====
    await C.evaluate(([c, v]) => fetch('https://canal.vento.local/' + c, { method: 'POST', body: JSON.stringify({ t: 'pedido', v: 2, id: 'pq' + Date.now().toString(36), mesa: 3, vm: v, items: [{ n: 'Picada', q: 1, p: 30000 }], total: 30000, at: Date.now() }) }), [cfg.topic, OTRO]);
    chk('2. El pedido del QR (código del otro equipo) entra SOLO a la cuenta de la mesa 3, no «por aceptar»', await esperar(A, () => (data.tables[3].items || []).some(i => i.name === 'Picada') && (data.pedidos || []).some(p => p.mesa === 3 && p.estado !== 'nuevo' && !p.sinCodigo), null, 20000),
      await A.evaluate(() => ({ items: data.tables[3].items.map(i => i.name), pedidos: (data.pedidos || []).map(p => [p.estado, p.sinCodigo]) })));
    chk('2. … y el cliente lo ve en su cuenta: $38.000', await esperar(C, () => /Picada/.test(document.getElementById('cs').innerText) && /38\.000/.test(document.getElementById('cs').innerText), null, 20000), await C.evaluate(() => document.getElementById('cs').innerText));

    // ===== 3 =====
    await A.evaluate(() => { data.tables[3].items.push({ productId: 'ag', name: 'Agua', price: 2500, qty: 1, personId: null, history: [{ qty: 1, at: Date.now() }] }); saveData(); });
    chk('3. El mesero agrega un agua: al cliente le llega ($40.500)', await esperar(C, () => /Agua/.test(document.getElementById('cs').innerText) && /40\.500/.test(document.getElementById('cs').innerText), null, 20000), await C.evaluate(() => document.getElementById('cs').innerText));

    // ===== 4 =====
    await A.evaluate(() => { window.__toasts = []; const o = window.showToast; window.showToast = function(t){ window.__toasts.push(String(t)); return o.apply(this, arguments); }; });
    const { p: F } = await pagina('falso', url(FALSO));
    chk('4. Un QR con un código que nadie conoce: el dueño recibe el aviso «el QR de Mesa 3 tiene un código que este equipo no conoce»', await esperar(A, () => (window.__toasts || []).some(t => /código que este equipo no conoce/.test(t) && /Fijar mis QR impresos/.test(t)), null, 20000), await A.evaluate(() => window.__toasts));
    await F.waitForTimeout(2500);
    const aFalso = (await sb.sql('select count(*)::int n from canal_mensajes where canal = $1', [FALSO]))[0].n;
    chk('4. … y a ese código no se le publica la cuenta de la mesa 3', aFalso === 0 && !/Cerveza/.test(await F.evaluate(() => document.getElementById('cs').innerText)), aFalso);

    // ===== 5 =====
    v5 = await A.evaluate(() => { const M = window.vitoMod, c = M.qCfg(); c.v = Object.assign({}, c.v || {}, { 7: 'vbsolodeesteequipo7' }); M.SS('vito_qr', c); window.dispatchEvent(new Event('vento-datos-remotos')); return true; });
    chk('5. Un código que solo tenía este equipo (QR viejos) queda en los datos del negocio, para los demás equipos', await esperar(A, () => (((data.qrCodigos || {})[7]) || []).indexOf('vbsolodeesteequipo7') >= 0, null, 10000), await A.evaluate(() => data.qrCodigos));
    const enNube = await A.evaluate(async () => { await saveData(); return true; }) && await (async () => { for(let i = 0; i < 40; i++){ const r = await sb.sql("select datos->'qrCodigos'->'7' x from datos_negocio limit 1"); if(r[0] && JSON.stringify(r[0].x || '').includes('vbsolodeesteequipo7')) return true; await new Promise(z => setTimeout(z, 500)); } return false; })();
    chk('5. … y sube a la nube (lo ven los otros equipos)', enNube);
  }
  var v5;
})();
