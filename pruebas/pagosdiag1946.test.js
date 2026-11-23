// 🔊 1.99.46 · Auditoría de los pagos con el celular bloqueado (pedido del dueño, 23/11). El registro de los avisos de
// pago (lo que ORDEVA manda a 🐞 Errores, sin nombres ni valores) volvía a mandar los MISMOS apuntes cada vez que se
// recargaba la página: «378 veces volvió a conectar» sin saber cuántas fueron de verdad. Revisa:
//  1. Un pago que el banco mandó 468 s tarde se reporta una vez, diciendo si esa app del banco tenía ahorro de batería
//     («🔋 Nequi CON ahorro de batería»), y la reconexión de la lectura también.
//  2. Al recargar la página (el mismo registro del celular) NO se vuelven a mandar.
//  3. Un apunte nuevo sí se manda.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 500) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => {
      try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-guia-tour', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '', off: true })); }catch(e){}
      let t0 = +sessionStorage.getItem('t0'); if(!t0){ t0 = Date.now() - 60000; sessionStorage.setItem('t0', String(t0)); }   // el mismo registro del celular al recargar
      window.__traza = [{ t: t0, app: 'Nequi', txt: 'Nequi | Te enviaron plata', r: '🔊 Recibiste pesos por Nequi · ⏱ el banco lo mandó 468 s tarde · pantalla apagada hace 9 min' },
        { t: t0 + 1000, app: 'Vento', txt: '', r: '🔌 Android volvió a conectar la lectura de avisos · celular bloqueado' }];
      window.VentoAndroid = { pagosAvisos: () => {}, pagosAvisosEstado: () => JSON.stringify({ on: true, permiso: true }), pagosAvisosTomar: () => '[]', pagosLectura: () => 1,
        pagosAvisosDiag: () => JSON.stringify({ ultimo: Date.now(), lista: [], traza: window.__traza, vivo: true }),
        bancosBateria: () => JSON.stringify([{ pkg: 'com.nequi.MobileApp', nombre: 'Nequi', sinRestriccion: false }]), bancoAjustes: () => {}, notificar: () => true, permisos: () => '{}' };
    });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    const cargar = async () => { await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(900);
      await p.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); window.__rep = []; window.ventoError = (tipo, msg) => window.__rep.push(msg); }); };
    await cargar();
    await p.evaluate(() => window.pagosDiagReportar());
    let rep = await p.evaluate(() => window.__rep);
    chk('1. El pago avisado tarde se reporta, con «🔋 Nequi CON ahorro de batería»', rep.filter(m => /468 s tarde/.test(m)).length === 1 && rep.some(m => /468 s tarde · 🔋 Nequi CON ahorro de batería/.test(m)), rep);
    chk('1. … y la reconexión de la lectura, una vez', rep.filter(m => /volvió a conectar/.test(m)).length === 1, rep);
    await p.evaluate(() => window.pagosDiagReportar());
    chk('1. Otra revisión en la misma página no repite', (await p.evaluate(() => window.__rep.length)) === rep.length);
    await p.waitForTimeout(500);
    await cargar();
    await p.evaluate(() => window.pagosDiagReportar());
    rep = await p.evaluate(() => window.__rep);
    chk('2. Al recargar la página NO se vuelven a mandar (antes sí: conteos inflados)', rep.length === 0, rep);
    await p.evaluate(() => { window.__traza.push({ t: Date.now(), app: 'Vento', txt: '', r: '🔌 Android volvió a conectar la lectura de avisos · celular en uso' }); window.pagosDiagReportar(); });
    rep = await p.evaluate(() => window.__rep);
    chk('3. Un apunte nuevo sí se manda', rep.length === 1 && /celular en uso/.test(rep[0]), rep);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
