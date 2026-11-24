// 📒 1.99.62 · «¿Quién me debe?» al asistente decía solo las cuentas fiadas del Historial; la libreta («Me deben») suma
// también lo anotado ahí («Rosa me debe 20 mil»). Con los datos reales del negocio: el asistente habría dicho $328.600 y la
// libreta $355.125. Ahora dicen lo mismo.
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
    await p.goto(BASE); await p.waitForTimeout(1000);
    const r = await p.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); window.speakVoice = () => {};
      const ayer = new Date(Date.now() - 864e5).toISOString();
      data.history = [{ id: 'f1', invoiceNo: 'FV-1', date: ayer, table: 1, total: 30000, debt: 30000, items: [], payments: [{ method: 'debe', amount: 30000, note: 'Juan' }] },
        { id: 'f2', invoiceNo: 'FV-2', date: ayer, table: 3, total: 12000, debt: 12000, items: [], payments: [{ method: 'debe', amount: 12000, note: 'Saldo sin registrar al cerrar' }] }];
      data.libreta = { movs: [] }; await saveData();
      await window.libretaEntender('Rosa me debe 20 mil'); await window.libretaEntender('Juan me debe 5 mil');
      window.libretaAbrir(); await new Promise(r2 => setTimeout(r2, 300));
      const lib = document.getElementById('lbTotDeben').textContent;
      const a1 = asisLocalMas('quien me debe'), a2 = asisLocalMas('cuanto me deben');
      await window.libretaEntender('Rosa me pagó 20 mil'); await window.libretaEntender('Juan me pagó 35 mil');
      const a3 = asisLocalMas('quien me debe');
      await window.libretaEntender('Sin nombre me pagó 12000');
      data.history.forEach(h => { h.debt = 0; }); await saveData();
      const a4 = asisLocalMas('quien me debe');
      return { lib, a1, a2, a3, a4 }; });
    chk('Libreta «Me deben»: $67.000 entre 3', /\$\s?67\.000/.test(r.lib), r.lib);
    chk('Asistente «¿quién me debe?»: lo mismo ($67.000, Juan $35.000, Rosa $20.000, la mesa sin nombre $12.000)', /Te deben \$\s?67\.000 entre 3 personas/.test(r.a1) && /Juan: \$\s?35\.000/.test(r.a1) && /Rosa: \$\s?20\.000/.test(r.a1) && /Mesa 3.*\$\s?12\.000/.test(r.a1), r.a1);
    chk('«¿Cuánto me deben?»: igual', /Te deben \$\s?67\.000/.test(r.a2), r.a2);
    chk('Cuando Rosa y Juan pagan: solo queda la mesa sin nombre ($12.000)', /Te deben \$\s?12\.000:/.test(r.a3) && !/• (Rosa|Juan)/.test(r.a3), r.a3);
    chk('Sin deudas: «Nadie te debe»', /Nadie te debe/.test(r.a4), r.a4);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
