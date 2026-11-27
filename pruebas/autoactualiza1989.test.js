// 🔄 1.99.89 · La versión nueva de ORDEVA no se quedaba trabada en un celular que pasa todo el día en pantalla. Revisa:
//  1. De día con una ventana abierta: espera (como siempre).
//  2. De madrugada (3-5 a. m.), sin tocar ORDEVA 30 min y con una ventana abierta SIN nada escrito: ya no espera.
//  3. … pero si en la ventana hay algo escrito: espera (no se pierde nada).
//  4. Si el aviso quedó en «Toca Actualizar ahora» (el intento anterior llegó antes que la versión) y pasaron los 10 min:
//     se vuelve a poner el aviso que se actualiza solo.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 500) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-guia-tour', '1'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(900);
    await p.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); });
    const r = await p.evaluate(() => {
      const gh = Date.prototype.getHours, hora = h => { Date.prototype.getHours = function(){ return h; }; };
      const ov = document.createElement('div'); ov.className = 'overlay show'; ov.innerHTML = '<div class="modal"><input id="tstEscrito" value=""></div>'; document.body.appendChild(ov);
      document.activeElement && document.activeElement.blur && document.activeElement.blur();
      mesoraUltimoUso = Date.now() - 31 * 60000;
      hora(15); const dia = mesoraOcupado();
      hora(3); const noche = mesoraOcupado();
      document.getElementById('tstEscrito').value = 'Juan Pér'; const nocheEscrito = mesoraOcupado();
      Date.prototype.getHours = gh; ov.remove();
      return { dia, noche, nocheEscrito };
    });
    chk('1. de día con una ventana abierta: espera', r.dia === true, r);
    chk('2. 3 a. m., 30 min sin tocar, ventana sin nada escrito: no espera', r.noche === false, r);
    chk('3. … con algo escrito en la ventana: espera', r.nocheEscrito === true, r);
    const a = await p.evaluate(() => {
      const nueva = '2099-01-01 · v9.9.9';
      sessionStorage.setItem('vento-actualizando', JSON.stringify({ v: nueva, t: Date.now() }));
      mesoraAvisoVersionNueva(nueva); const b1 = document.getElementById('mesoraNuevaVersion'); const antes = b1 && b1.dataset.auto;
      sessionStorage.setItem('vento-actualizando', JSON.stringify({ v: nueva, t: Date.now() - 11 * 60000 }));
      mesoraUltimoUso = Date.now();   // en uso: que no recargue durante la prueba
      mesoraAvisoVersionNueva(nueva); const b2 = document.getElementById('mesoraNuevaVersion');
      const r = { antes, despues: b2 && b2.dataset.auto, txt: b2 && b2.textContent };
      try{ window.mesoraActualizacion && window.mesoraActualizacion.parar(); }catch(e){} if(b2) b2.remove();
      return r; });
    chk('4. «Toca Actualizar ahora» → a los 10 min vuelve a actualizarse solo', a.antes === '0' && a.despues === '1', a);
    chk('5. sin errores de página', errs.length === 0, errs);
  }catch(e){ mal++; console.log('❌ excepción: ' + e.message); }
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
