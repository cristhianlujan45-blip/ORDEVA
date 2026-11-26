// 🕒💵 1.99.87 · Asistencia y tasa del dólar. Revisa:
//  1. Un turno normal (8 h) cuenta 8 h, sin aviso.
//  2. Entró hace 30 h y no marcó la salida: cuenta 16 h y sale «⚠️ no marcó la salida»; no aparece «trabajando».
//  3. La salida marcada al día siguiente (turno de 30 h): cuenta 16 h y sale «⚠️ … revisa».
//  4. La tasa del dólar como la dicen las noticias: «4.152,35» → 4152, «4152.35» → 4152, «4.150» → 4150.
//  5. Guardar «4152.35» en Ajustes: el total en dólares de $41.520 da US$ 10 (antes la tasa quedaba en 415235).
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 500) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 412, height: 915 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-guia-tour', '1'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE); await p.waitForTimeout(900);
    await p.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); });
    const r = await p.evaluate(() => { const A = window.ventoAsistencia, h = 36e5, now = Date.now();
      data.asistencia = [
        { id: 'a1', persona: 'Ana', tipo: 'entrada', at: now - 10 * h }, { id: 'a2', persona: 'Ana', tipo: 'salida', at: now - 2 * h },
        { id: 'b1', persona: 'Beto', tipo: 'entrada', at: now - 30 * h },
        { id: 'c1', persona: 'Caro', tipo: 'entrada', at: now - 31 * h }, { id: 'c2', persona: 'Caro', tipo: 'salida', at: now - 1 * h } ];
      const x = A.horas(now - 48 * h, now + h); A.abrir(); const txt = document.querySelector('.as-ov').textContent; document.querySelector('.as-ov').remove();
      return { ana: x.Ana, beto: x.Beto, caro: x.Caro, txt }; });
    chk('1. turno normal: 8 h sin aviso', Math.round(r.ana.ms / 36e5) === 8 && !r.ana.olvido && !r.ana.largo, r.ana);
    chk('2. sin salida hace 30 h: cuenta 16 h, «no marcó la salida», no «trabajando»', Math.round(r.beto.ms / 36e5) === 16 && r.beto.olvido && !r.beto.dentro && /no marcó la salida/.test(r.txt), { beto: r.beto });
    chk('3. salida al día siguiente (30 h): cuenta 16 h y «revisa»', Math.round(r.caro.ms / 36e5) === 16 && r.caro.largo && /revisa/.test(r.txt), r.caro);
    const t = await p.evaluate(() => ['4.152,35', '4152.35', '4,152.35', '4.150', '4150'].map(x => window.ventoDolares.leerTasa(x)));
    chk('4. tasa: 4.152,35 / 4152.35 / 4,152.35 → 4152; 4.150 / 4150 → 4150', JSON.stringify(t) === '[4152,4152,4152,4150,4150]', t);
    const usd = await p.evaluate(() => { const g = document.querySelector('#view-ajustes .settings-group[data-cat="pagos"]'); if(!g) return 'sin grupo';
      window.ventoDolares.pintarAjustes(); const box = document.getElementById('usdBox'); box.querySelector('#usdOn').checked = true; box.querySelector('#usdTasa').value = '4152.35';
      box.querySelector('#usdTasa').dispatchEvent(new Event('change')); return { tasa: data.usdCfg.tasa, usd: window.ventoDolares.usdDe(41520) }; });
    chk('5. guardar «4152.35»: tasa 4152 y $41.520 = US$ 10', usd && usd.tasa === 4152 && usd.usd === 10, usd);
    chk('6. sin errores de página', errs.length === 0, errs);
  }catch(e){ mal++; console.log('❌ excepción: ' + e.message); }
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
