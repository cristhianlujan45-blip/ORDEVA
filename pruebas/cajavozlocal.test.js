// 🔒 ORDEVA 1.69.0 · Reconocedor de voz EN ESTE EQUIPO (Vosk en WebAssembly) dentro de la Caja, de punta a punta:
// el modelo en español real, un micrófono de verdad para Chromium (se alimenta con un audio generado por espeak-ng) y la
// misma caja. NO está en CI: necesita internet la primera vez (librería ~1 MB + modelo ~34 MB) y espeak-ng.
//   VENTO_BASE=http://localhost:8765 node pruebas/cajavozlocal.test.js
//  1. Con «🔒 Reconocer la voz en este equipo» prendido, el micrófono de la caja usa el reconocedor local (sin el aviso
//     de que la voz va a Google: no sale del equipo).
//  2. Oye «cobrar en efectivo» (voz sintética) → la caja pide la confirmación financiera del cobro.
//  3. Se le pasan las palabras del negocio (productos) para que entienda mejor.
// Lo que NO prueba: qué tan bien entiende una voz humana real en un negocio con ruido (eso se prueba en el equipo).
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const { spawnSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';

(async () => {
  if(spawnSync('bash', ['-c', 'command -v espeak-ng'], { stdio: 'ignore' }).status !== 0){ console.log('RESULTADO 0 bien 0 mal (sin espeak-ng: se omitió)'); process.exit(0); }
  const wav = path.join(os.tmpdir(), 'ordeva-voz-' + process.pid + '.wav');
  spawnSync('espeak-ng', ['-v', 'es', '-s', '130', '-w', wav, 'cobrar en efectivo. . . . . . cobrar en efectivo.']);
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-audio-capture=' + wav, '--autoplay-policy=no-user-gesture-required'] });
  let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
    const permitidos = ['localhost', 'cdn.jsdelivr.net', 'ccoreilly.github.io'];
    await ctx.route('**/*', r => permitidos.includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' }));
      localStorage.setItem('vento_caja_voz', JSON.stringify({ local: true, privacidad: false })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1200);
    await p.fill('#authBiz', 'Tienda Local'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1500);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await p.evaluate(() => {
      document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.products = [{ id: 'a', name: 'Águila', price: 3500 }, { id: 'e', name: 'Empanada', price: 2000 }]; saveData();
      window.ventoPOS.abrirCaja(); window.ventoPOS.agregar('a', 2);
      window.__dicho = []; window.ventoHablar = t => window.__dicho.push(String(t));
    });
    await p.waitForTimeout(300);
    await p.click('#pzCajaOv .pz-caja-root .cv-mic');
    await p.waitForTimeout(300);
    chk('1. Con el reconocedor local NO sale el aviso de que la voz se envía a Google', !(await p.evaluate(() => !!document.querySelector('.cv-priv-ov'))));
    const t0 = Date.now(); let st = null;
    while(Date.now() - t0 < 180000){ st = await p.evaluate(() => window.ventoCajaVoz.estado()); if(st.estado === 'escuchando' || st.estado === 'sin_red' || st.estado === 'sin_permiso') break; await p.waitForTimeout(500); }
    chk('1. El reconocedor del equipo se prepara (modelo en español) y queda escuchando (' + ((Date.now() - t0) / 1000).toFixed(0) + ' s)', st && st.estado === 'escuchando', st);
    const t1 = Date.now(); let conf = null;
    while(Date.now() - t1 < 40000){ st = await p.evaluate(() => window.ventoCajaVoz.estado()); conf = st.confirmar; if(conf) break; await p.waitForTimeout(500); }
    chk('2. Oyó «cobrar en efectivo» → confirmación financiera del cobro de $7.000 (sin registrar todavía)', conf && conf.nivel === 'financiera' && /7\.000/.test(conf.texto) && (await p.evaluate(() => data.history.length)) === 0, st);
    chk('3. Lo que oyó se ve en la barra', /efectivo/.test(st && st.oido || ''), st && st.oido);
    await p.evaluate(() => window.ventoCajaVoz.apagar());
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ Excepción: ' + (e && e.stack || e)); }
  await b.close(); try{ fs.unlinkSync(wav); }catch(e){}
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
