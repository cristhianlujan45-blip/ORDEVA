// 🩺 ORDEVA 1.72.4 · «Cada vez que inicio la app, Laya dice que hay un error y que recargue». Sin internet.
// El registro local de errores (el que muestra «Algo falló · Toca y lo arreglo» y el que lee Laya) anotaba como error el
// sonido bloqueado hasta tocar la pantalla y los cortes de red al abrir: en un celular real pasaba casi en cada arranque.
//  1. Sonido bloqueado (NotAllowedError) y cortes de red («Failed to fetch», «Load failed»): no se anotan, no sale
//     «Algo falló» y Laya saluda normal.
//  2. Lo que quedó anotado con versiones anteriores y es ruido: al abrir, ni «Algo falló» ni Laya lo cuentan.
//  3. Un error de verdad sí se anota, sale «Algo falló» y Laya lo dice.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0;
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  const pausa = ms => new Promise(r => setTimeout(r, ms));
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage();
    await p.goto(BASE + '/index.html'); await pausa(1000);
    await p.fill('#authBiz', 'Bar Arranque'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await pausa(1500);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    const estado = () => p.evaluate(() => ({
      log: (JSON.parse(localStorage.getItem('vito_errlog') || '[]') || []).filter(x => x.tipo !== 'recurso').map(x => x.msg),
      cuenta: mesoraErrores().filter(x => !x.visto && x.tipo !== 'recurso').length,
      pill: !!(document.getElementById('mesoraFixPill') || {}).classList && document.getElementById('mesoraFixPill').classList.contains('show'),
      laya: asisSaludo().text }));
    // ===== 1 =====
    await p.evaluate(() => {
      Promise.reject(new DOMException("play() failed because the user didn't interact with the document first.", 'NotAllowedError'));
      Promise.reject(new TypeError('Failed to fetch'));
      Promise.reject(new TypeError('Load failed'));
    });
    await pausa(700);
    let v = await estado();
    chk('1. Sonido bloqueado y cortes de red: no se anotan como error', !v.log.length && !v.cuenta, v);
    chk('1. No sale «Algo falló» y Laya saluda normal (sin «vi un error»)', !v.pill && !/error/i.test(v.laya), v);
    // ===== 2 =====
    await p.evaluate(() => { localStorage.setItem('vito_errlog', JSON.stringify([
      { cod: 'E-AAAA', tipo: 'promesa', msg: "NotAllowedError: play() failed because the user didn't interact with the document first.", t: Date.now() - 6e4, n: 7 },
      { cod: 'E-BBBB', tipo: 'promesa', msg: 'TypeError: Failed to fetch', t: Date.now() - 6e4, n: 3 }])); });
    await p.reload(); await pausa(4500);
    v = await estado();
    chk('2. Lo anotado antes que es ruido: al abrir no sale «Algo falló» y Laya no habla de errores', !v.pill && !v.cuenta && !/error/i.test(v.laya), v);
    // ===== 3 =====
    await p.evaluate(() => { setTimeout(() => { null.algo(); }, 0); });
    await pausa(800);
    v = await estado();
    chk('3. Un error de verdad sí se anota, sale «Algo falló» y Laya lo dice', v.cuenta === 1 && v.pill && /Vi un error/.test(v.laya), v);
  }catch(e){ mal++; console.log('❌ Excepción: ' + (e && e.stack || e)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
