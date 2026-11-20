// 💜 1.99.23: un cambio que se guarda justo después de otro (menos de 120 ms, antes de que el primero se escribiera)
// también se le avisa a la nube. Antes ese segundo guardado se juntaba con el primero sin avisar: si la nube ya estaba
// subiendo lo primero, lo segundo quedaba como «ya subido» y la siguiente bajada de otro equipo lo borraba (pasó con un
// pago registrado en la Mesa 4 en pagosequipos, 2 de cada 4 veces con el equipo lento).
//  1. Dos guardados seguidos → dos avisos a la nube.
//  2. Los dos cambios quedan guardados en el equipo.
//  3. Mientras se ponen los datos de otro equipo, el segundo guardado también queda anotado para subirse después.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 500) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('vento-guia-tour', '1'); localStorage.setItem('cm-tutorial-seen', '1'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(800);
    await p.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); });
    await p.waitForTimeout(800);
    const r = await p.evaluate(async () => {
      const avisos = []; window.ventoNube = Object.assign({}, window.ventoNube || {}, { cambio: () => avisos.push(Date.now()) });
      await guardadoAhora();
      data.pagos = data.pagos || {}; data.pagos.prueba = 1; saveData();          // 1.º: lo de pagos
      data.tables[1] = data.tables[1] || { items: [], people: [] };
      data.tables[1].payments = [{ amount: 27300, method: 'transferencia', note: 'prueba' }]; saveData();   // 2.º, enseguida: el pago en la mesa
      const n = avisos.length;
      await guardadoAhora();
      const g = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      // 3. mientras se ponen los datos de otro equipo
      window.__nubeCambioEnAplicar = false; window.__nubeAplicando = true;
      data.pagos.prueba = 2; saveData(); data.pagos.prueba = 3; saveData();
      const anotado = window.__nubeCambioEnAplicar === true; window.__nubeAplicando = false; window.__nubeCambioEnAplicar = false;
      await guardadoAhora();
      return { n, guardado: !!(g && g.pagos && g.pagos.prueba === 1 && g.tables[1].payments.length === 1), anotado, avisos3: avisos.length };
    });
    chk('1. Dos guardados seguidos le avisan dos veces a la nube (el segundo no se pierde)', r.n === 2, r);
    chk('2. Los dos cambios quedan guardados en el equipo', r.guardado, r);
    chk('3. Mientras llegan datos de otro equipo, el cambio queda anotado para subirse (sin avisar en medio)', r.anotado && r.avisos3 === 2, r);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
