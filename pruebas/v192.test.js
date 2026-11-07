// 🕒 ORDEVA 1.92.0 · Asistencia del personal (lib/vento-asistencia.js).
//  1. «Más → 🕒 Asistencia» abre la ventana; quien usa ORDEVA marca entrada y salida (no dos entradas seguidas).
//  2. Las horas: un turno de 8:00 a 12:30 = 4 h 30 min; un turno abierto cuenta hasta ahora (🟢 trabajando).
//  3. El dueño marca por alguien sin usuario y ve el resumen de la semana con los días.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
  const pausa = ms => new Promise(r => setTimeout(r, ms));
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    { const m = new Date(); m.setHours(15, 0, 0, 0); await ctx.clock.setSystemTime(m); }
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await pausa(1000);
    await p.evaluate(() => { const s = document.getElementById('authType'); s.value = 'restaurante'; s.dispatchEvent(new Event('change')); });
    await p.fill('#authBiz', 'Fonda 192'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await pausa(1500);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); data.asistencia = []; saveData(); });
    await p.click('#navMoreBtn'); await pausa(400);
    await p.click('#navMoreSheet .more-tile[data-go="asistencia"]'); await pausa(300);
    let v = await p.evaluate(() => { const o = document.querySelector('.as-ov'); return o ? o.innerText : null; });
    chk('1. «Más → 🕒 Asistencia» abre la ventana con «Marcar entrada»', v && /Asistencia/.test(v) && /Marcar entrada/.test(v), v);
    await p.click('.as-ov [data-as="entrada"]'); await pausa(200);
    v = await p.evaluate(() => ({ txt: document.querySelector('.as-ov').innerText, n: data.asistencia.length, r: window.ventoAsistencia.marcar('ana', 'entrada') }));
    chk('1. Ana marca entrada: «trabajando desde las 3:00 p. m.» y el botón pasa a «Marcar salida»; otra entrada seguida no se deja', /trabajando desde las/.test(v.txt) && /Marcar salida/.test(v.txt) && v.n === 1 && v.r && v.r.error === 'ya_dentro', v);
    v = await p.evaluate(() => { const A = window.ventoAsistencia, h0 = new Date(); h0.setHours(0, 0, 0, 0); const t = (d, h, m) => h0.getTime() - d * 864e5 + (h * 60 + m) * 6e4;
      data.asistencia.push({ id: 'x1', persona: 'Luis', tipo: 'entrada', at: t(1, 8, 0) }, { id: 'x2', persona: 'Luis', tipo: 'salida', at: t(1, 12, 30) }, { id: 'x3', persona: 'Luis', tipo: 'entrada', at: t(0, 8, 0) }, { id: 'x4', persona: 'Luis', tipo: 'salida', at: t(0, 10, 0) });
      const hoy = A.horas(A.rango('hoy').desde, A.rango('hoy').hasta), sem = A.horas(A.rango('semana').desde, A.rango('semana').hasta);
      return { luisHoy: hoy.Luis && hoy.Luis.ms / 6e4, anaHoy: hoy.ana && Math.round(hoy.ana.ms / 6e4), anaDentro: hoy.ana && hoy.ana.dentro, luisSem: sem.Luis && sem.Luis.ms / 6e4, diasSem: sem.Luis && sem.Luis.dias, lunes: new Date().getDay() === 1 }; });
    chk('2. Luis hoy de 8:00 a 10:00 = 120 min; Ana con el turno abierto cuenta hasta ahora (🟢)', v.luisHoy === 120 && v.anaDentro === true && v.anaHoy >= 0, v);
    chk('2. En la semana Luis suma ayer (4 h 30) + hoy (2 h) = 390 min en 2 días (si hoy es lunes, solo hoy)', v.lunes ? (v.luisSem === 120 && v.diasSem === 1) : (v.luisSem === 390 && v.diasSem === 2), v);
    await p.fill('.as-ov .as-otro', 'Marta'); await p.click('.as-ov [data-as="otro-entrada"]'); await pausa(200);
    await p.click('.as-ov [data-per="semana"]'); await pausa(200);
    v = await p.evaluate(() => ({ marta: window.ventoAsistencia.estado('Marta'), txt: document.querySelector('.as-ov').innerText, por: (data.asistencia.find(x => x.persona === 'Marta') || {}).por }));
    chk('3. El dueño marca la entrada de Marta (sin usuario); queda quién la marcó', v.marta.dentro && v.por === 'ana', v);
    chk('3. … y el resumen de la semana muestra a Luis con sus días', /Luis/.test(v.txt) && /días?/.test(v.txt) && /Marta/.test(v.txt), v.txt);
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.message)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
