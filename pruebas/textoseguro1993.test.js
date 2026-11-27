// 🛡️ ORDEVA 1.99.94 · Textos protegidos en todos lados y el voucher con la fecha de Colombia.
//  1. Ningún «protector de textos» (el que cambia < > & " por su código) se queda sin proteger la comilla simple '
//     (un nombre como «O'Brien» o «Rock'n'Roll» no puede romper un botón ni meter código).
//  2. El número del voucher de la agencia usa la fecha de Colombia: a las 8:30 p. m. NO sale la fecha de mañana.
'use strict';
const fs = require('fs'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
const RAIZ = path.join(__dirname, '..');
(async () => {
  let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  // ===== 1 =====
  const archivos = [];
  for(const dir of ['app', 'lib', 'pedido']) for(const f of fs.readdirSync(path.join(RAIZ, dir))) if(/\.js$/.test(f) && !/^vento-(pdf|ocr|xlsx)\.js$/.test(f)) archivos.push(dir + '/' + f);
  const flojos = [];
  for(const f of archivos){
    const s = fs.readFileSync(path.join(RAIZ, f), 'utf8');
    s.split('\n').forEach((l, i) => { if(/\.replace\(\/\[&<>"\]\/g, *(\w+ *=>|function)/.test(l) && /&quot;/.test(l)) flojos.push(f + ':' + (i + 1)); });
  }
  chk('1. Todos los protectores de texto (' + archivos.length + ' archivos) protegen también la comilla simple', flojos.length === 0, flojos);
  // ===== 2 =====
  const b = await chromium.launch();
  try{
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'America/Bogota' });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '', off: true })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.clock.install({ time: new Date('2026-03-10T20:30:00-05:00') }); await p.clock.resume();
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1000);
    await p.evaluate(() => { const s = document.getElementById('authType'); if(s){ s.value = 'agencia_viajes'; s.dispatchEvent(new Event('change')); } });
    await p.fill('#authBiz', 'Viajes Noche'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn');
    await p.waitForFunction(() => document.getElementById('authOverlay').hidden, null, { timeout: 15000 });
    await p.click('#onbSaltar', { timeout: 4000 }).catch(() => {});
    await p.waitForFunction(() => !!window.ventoAgencia, null, { timeout: 10000 });
    const n = await p.evaluate(() => window.ventoAgencia.datosVoucher(1).n);
    chk('2. A las 8:30 p. m. del 10 de marzo el voucher dice 260310 (no 260311)', /-260310$/.test(n), n);
    await ctx.close();
  }catch(e){ mal++; console.log('❌ Error: ' + e.message); }
  chk('Sin errores de página', errs.length === 0, errs);
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
