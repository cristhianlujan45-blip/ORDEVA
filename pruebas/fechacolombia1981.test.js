// 🕖 1.99.81 · Fechas con la hora de Colombia, no la de UTC. Después de las 7 p. m. en UTC ya es «mañana»: una promo de la
// vitrina «hasta hoy» se vencía a las 7 p. m. y «Rango» de ventas a Excel proponía la fecha de mañana. Revisa (reloj a las
// 8:30 p. m. del 25/11 en Colombia = 01:30 UTC del 26/11):
//  1. La promo que vence HOY se sigue publicando en la vitrina (y una de ayer no).
//  2. «Rango» propone desde/hasta = 2026-11-25.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 500) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, timezoneId: 'America/Bogota' });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-guia-tour', '1'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.clock.install({ time: new Date('2026-11-26T01:30:00Z') });
    await p.goto(BASE); await p.clock.runFor(1500);
    await p.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); });
    const env = await p.evaluate(async () => {
      data.vitrina = { ocasion: '', nombre: '', mensaje: '', saludo: true, promos: [{ id: 'a', e: '🔥', t: 'Hoy', d: '', p: 1000, hasta: '2026-11-25' }, { id: 'b', e: '🔥', t: 'Ayer', d: '', p: 1000, hasta: '2026-11-24' }] };
      const real = window.vitoQCfg; window.vitoQCfg = () => ({ topic: 'tst', url: 'http://localhost/pedido.html' });
      let cuerpo = null; const f0 = window.fetch; window.fetch = (u, o) => { if(String(u).indexOf('canal.vento.local') >= 0){ cuerpo = o && o.body; return Promise.resolve(new Response('{}')); } return f0(u, o); };
      await window.vitrinaPublicar(true); window.fetch = f0; window.vitoQCfg = real;
      return cuerpo ? JSON.parse(cuerpo).pr.map(x => x[1]) : null; });
    chk('1. la promo que vence hoy sigue en la vitrina a las 8:30 p. m. (la de ayer no)', Array.isArray(env) && env.includes('Hoy') && !env.includes('Ayer'), env);
    const r = await p.evaluate(() => { const ov = document.getElementById('exportOverlay'); if(ov) ov.classList.add('show'); document.querySelector('#exportPeriodBtns button[data-per="rango"]').click(); return [document.getElementById('exportFrom').value, document.getElementById('exportTo').value]; });
    chk('2. «Rango» propone el 25/11 (no el 26)', r[0] === '2026-11-25' && r[1] === '2026-11-25', r);
    chk('3. sin errores de página', errs.length === 0, errs);
  }catch(e){ mal++; console.log('❌ excepción: ' + e.message); }
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
