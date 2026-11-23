// 📺 1.99.39 · La pantalla del TV (tv.html) se lee desde lejos (a 3 m): en 1280 × 720 y 1920 × 1080 la mesa que pidió cada
// canción (antes 2 % del alto de la pantalla), «Siguen» y el estado se ven más grandes, y un título largo de la cola usa
// dos renglones en vez de cortarse con «…».
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/tv.html#pruebalejos1';
const MSG = JSON.stringify({ b: 'Bar de prueba', q: [{ i: 'a1', s: 'La Gota Fría', a: 'Carlos Vives', m: 'Mesa 4', v: 'abc123def45' }, { i: 'a2', s: 'Cali Pachanguero en vivo desde el Teatro', a: 'Grupo Niche', m: 'Mesa 12', v: 'abc123def46' }, { i: 'a3', s: 'Bichota', a: 'Karol G', m: 'Barra', v: 'abc123def47' }] });
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 400) : '')); } };
  try{
    for(const [w, h] of [[1280, 720], [1920, 1080]]){
      const ctx = await b.newContext({ viewport: { width: w, height: h } }); let dado = false;
      await ctx.route('**/*', r => { const u = r.request().url();
        if(/rpc\/canal_leer/.test(u)){ const body = dado ? '[]' : JSON.stringify([{ id: 1, time: Math.floor(Date.now() / 1000), message: MSG }]); dado = true; return r.fulfill({ status: 200, contentType: 'application/json', body }); }
        if(/rpc\//.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        return new URL(u).hostname === 'localhost' ? r.continue() : r.abort(); });
      const p = await ctx.newPage(); p.on('pageerror', e => errs.push(w + ': ' + e.message));
      await p.goto(BASE); await p.waitForTimeout(3500);
      const m = await p.evaluate(() => { const vh = innerHeight / 100, f = s => { const e = document.querySelector(s); return e ? parseFloat(getComputedStyle(e).fontSize) / vh : 0; };
        const largo = [...document.querySelectorAll('#next li b')].find(x => /Pachanguero/.test(x.textContent));
        return { mesa: f('#next li span'), titulo: f('#next li b'), siguen: f('h2'), estado: f('#state'), n: document.querySelectorAll('#next li').length, largo: largo ? { sh: largo.scrollHeight, ch: largo.clientHeight, lineas: Math.round(largo.clientHeight / parseFloat(getComputedStyle(largo).lineHeight)) } : null }; });
      chk(w + '×' + h + ' · La cola muestra las 3 canciones', m.n === 3, m);
      chk(w + '×' + h + ' · La mesa (2,4 % del alto), el título (2,9 %), «Siguen» (2,7 %) y el estado (2,2 %) más grandes', m.mesa >= 2.35 && m.titulo >= 2.85 && m.siguen >= 2.65 && m.estado >= 2.15, m);
      chk(w + '×' + h + ' · Un título largo usa dos renglones (no un solo renglón cortado)', m.largo && m.largo.lineas === 2, m.largo);
      await ctx.close();
    }
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
