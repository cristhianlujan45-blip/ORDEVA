// 🔊 1.99.46 · Auditoría de los pagos con el celular bloqueado (pedido del dueño, 23/11). El registro de los avisos de
// pago (lo que ORDEVA manda a 🐞 Errores, sin nombres ni valores) volvía a mandar los MISMOS apuntes cada vez que se
// recargaba la página: «378 veces volvió a conectar» sin saber cuántas fueron de verdad. Revisa:
//  1. Un pago que el banco mandó 468 s tarde se reporta una vez, diciendo si esa app del banco tenía ahorro de batería
//     («🔋 Nequi CON ahorro de batería»), y la reconexión de la lectura también.
//  2. Al recargar la página (el mismo registro del celular) NO se vuelven a mandar.
//  3. Un apunte nuevo sí se manda.
//  5. 1.99.49: un pago que el celular le pasó TARDE a la página (Android se lo dio 10 min después) se dice con «Es de hace
//     10 minutos» y la notificación lo muestra; uno de ahora, normal.
//  4. Lo mismo con los cierres de la app Android («cerró la página por falta de memoria»): uno solo, aunque se recargue.
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
      window.__cola = []; window.__dicho = []; window.__notif = [];
      window.VentoAndroid = { pagosAvisos: () => {}, pagosAvisosEstado: () => JSON.stringify({ on: true, permiso: true }), pagosAvisosTomar: () => { const s = JSON.stringify(window.__cola); window.__cola = []; return s; }, pagosLectura: () => 1,
        pagosDecir: f => window.__dicho.push(f), notificarPago: (t, f) => { window.__notif.push(t + ' | ' + f); return true; }, pagoNotificar: (t, f) => { window.__notif.push(t + ' | ' + f); return true; },
        pagosAvisosDiag: () => JSON.stringify({ ultimo: Date.now(), lista: [], traza: window.__traza, vivo: true }),
        bancosBateria: () => JSON.stringify([{ pkg: 'com.nequi.MobileApp', nombre: 'Nequi', sinRestriccion: false }]), bancoAjustes: () => {}, notificar: () => true, permisos: () => '{}',
        erroresNativos: () => JSON.stringify([{ tipo: 'pagina', mensaje: 'Android cerró la página de ORDEVA por falta de memoria', t: t0, app: '1.0.99', android: 36, modelo: 'Xiaomi 2409' }]) };
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
    const veces = () => p.evaluate(() => { window.ventoErrores._nativos(); return window.ventoErrores.pendientes().filter(x => /falta de memoria/.test(x.mensaje)).reduce((a, x) => a + (x.veces || 1), 0); });
    const v1 = await veces();
    await cargar(); await p.waitForTimeout(6500);
    const v2 = await veces();
    chk('4. El cierre por falta de memoria cuenta 1 vez aunque se recargue la página (antes 1 por cada recarga)', v1 === 1 && v2 === 1, { v1, v2 });
    await p.evaluate(() => { data.pagos = Object.assign({}, data.pagos || {}, { on: true }); window.__cola.push({ id: 'k9:1', txt: 'Nequi | Nequi | LUIS PEREZ te envió $1.400', t: Date.now(), voz: false, crudo: true, hace: 10 }); window.ventoAvisosNativos(); });
    await p.waitForTimeout(500);
    const d5 = await p.evaluate(() => ({ dicho: window.__dicho.slice(), notif: window.__notif.slice() }));
    chk('5. Pago que llegó tarde: «Llegaron 1400 pesos por Nequi. Es de hace 10 minutos»', d5.dicho.some(f => /Llegaron 1400 pesos por Nequi\. Es de hace 10 minutos/.test(f)), d5);
    await p.evaluate(() => { window.__dicho = []; window.__cola.push({ id: 'k9:2', txt: 'Nequi | Nequi | ANA RUIZ te envió $3.500', t: Date.now(), voz: false, crudo: true }); window.ventoAvisosNativos(); });
    await p.waitForTimeout(500);
    const d6 = await p.evaluate(() => window.__dicho.slice());
    chk('5. … y uno de ahora, normal (sin «Es de hace»)', d6.some(f => /Llegaron 3500 pesos por Nequi/.test(f)) && !d6.some(f => /Es de hace/.test(f)), d6);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
