// ⚡ ORDEVA 1.72.6 · Cobro con QR: la confirmación del banco llega rápido. Contra el «Supabase local» REAL.
// Mientras el cliente paga el QR frente a la caja, ORDEVA le pide al servidor que consulte al banco cada 2 s durante los
// primeros 3 minutos (antes cada 10 s; el aviso del banco —webhook— sigue siendo lo primero). Después, cada 10 s.
//  1. Cobro QR recién creado: en 10 s se consulta al banco al menos 4 veces (antes 1).
//  2. Cobro de hace más de 3 minutos: como antes (como mucho 2 en 10 s).
//  3. Con la pantalla escondida no consulta (no gasta datos ni batería).
//  4. Sin cobros esperando, no consulta.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('fs');
const { spawnSync } = require('child_process');
function hayPostgres(){ if(process.env.VENTO_PG_URL || fs.existsSync('/usr/lib/postgresql')) return true; return spawnSync('bash', ['-c', 'command -v psql || command -v pg_ctl'], { stdio: 'ignore' }).status === 0; }
if(!process.env.VENTO_LOGS) for(const k of ['log', 'warn', 'error']){ const o = console[k].bind(console); console[k] = (...a) => { if(typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; o(...a); }; }
(async () => {
  if(!hayPostgres()){ console.log('RESULTADO 0 bien 0 mal (sin PostgreSQL: se omitió)'); process.exit(0); }
  const { iniciar, enrutar } = require('./servidor/supabase-local');
  const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
  let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 500) : '')); } };
  const sb = await iniciar(); const b = await chromium.launch();
  const pausa = ms => new Promise(r => setTimeout(r, ms));
  try{
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.route('**/*', rt => { const u = new URL(rt.request().url()); return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') ? rt.continue() : rt.abort(); });
    await enrutar(ctx, sb);
    await ctx.addInitScript(() => { try{ localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-hola', '0'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    let consultas = 0; p.on('request', r => { if(/\/functions\/v1\/vento-pagos\/sync/.test(r.url())) consultas++; });
    await p.goto(BASE + '/index.html');
    await p.waitForFunction(() => window.ventoNube && window.ventoNube.crearCuenta, null, { timeout: 15000 });
    await p.fill('#authBiz', 'Tienda QR'); await p.fill('#authUser', 'dueno@qrrapido.co'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn');
    await p.waitForFunction(() => document.getElementById('authOverlay').hidden && !!window.ventoNube.negocio(), null, { timeout: 20000 });
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    const listo = await p.waitForFunction(() => window.ventoPagos && window.ventoPagos.estado().servidor, null, { timeout: 20000 }).then(() => true, () => false);
    chk('0. El servidor de pagos responde', listo);
    const poner = (hace) => p.evaluate(h => { const c = window.ventoPagos._cache; Object.keys(c).forEach(k => delete c[k]); if(h != null) c['qr-prueba'] = { id: 'qr-prueba', estado: 'pendiente', monto: 12000, metodo: 'NEQUI', creado_en: new Date(Date.now() - h).toISOString() }; }, hace);
    const contar = async ms => { const a = consultas; await pausa(ms); return consultas - a; };
    // ===== 4 =====
    await poner(null); await pausa(1500);
    let n = await contar(6000);
    chk('4. Sin cobros esperando: no consulta al banco (' + n + ')', n === 0, n);
    // ===== 1 =====
    await poner(5000);
    n = await contar(10000);
    chk('1. Cobro QR recién creado: consulta al banco cada ~2 s (' + n + ' veces en 10 s; antes 1)', n >= 4, n);
    // ===== 2 =====
    await poner(5 * 60e3); await pausa(2500);
    n = await contar(10000);
    chk('2. Cobro de hace más de 3 min: como antes, cada 10 s (' + n + ' en 10 s)', n <= 2, n);
    // ===== 3 =====
    await poner(5000);
    await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); });
    await pausa(2500);
    n = await contar(6000);
    chk('3. Con la pantalla escondida no consulta (' + n + ')', n === 0, n);
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ Excepción: ' + (e && e.stack || e)); }
  await b.close(); await sb.cerrar().catch(() => {});
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
