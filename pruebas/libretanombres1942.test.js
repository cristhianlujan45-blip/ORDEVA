// 📒 1.99.42 · «Camila me quedó debiendo y en la libreta de quién me debe no aparece» (pedido del dueño, 22/11). En su
// negocio la cuenta de Camila ($52.500) sí estaba guardada, pero «Tania» salía 3 veces (escrita «Tania», «Tânia» y «tania»),
// cada vez con TODAS sus cuentas: el «Me deben» sumaba $187.600 de más y Camila quedaba muy abajo. Revisa:
//  1. «Tania», «Tânia» y «tania» salen en UNA sola fila, con lo que de verdad debe (no 3 veces).
//  2. El total de «Me deben» es la suma real, y dice cuántas personas son.
//  3. Camila sale con lo suyo.
//  4. Un abono de la libreta escrito «TANIA» le baja a Tania (aunque se escribió distinto).
//  5. Con 6 o más personas hay un buscador: «cami» deja solo a Camila; un nombre que no está dice que nadie con ese nombre debe.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('vento-guia-tour', '1'); localStorage.setItem('cm-tutorial-seen', '1'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(800);
    await p.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); window.speakVoice = () => {}; });
    await p.waitForTimeout(400);
    await p.evaluate(() => {
      const c = (id, n, m, d) => ({ id, invoiceNo: 'FV-' + id, date: new Date(2026, 10, d, 20).toISOString(), table: 1, total: m, debt: m, items: [{ name: 'Aguila', price: m, qty: 1 }], payments: [{ method: 'debe', amount: m, note: n }] });
      data.libreta = { movs: [] };
      data.history = [c('1', 'Tania', 30000, 10), c('2', 'Tânia', 20000, 11), c('3', 'tania', 10000, 12), c('4', 'Camila', 52500, 22),
        c('5', 'Alberto', 88400, 5), c('6', 'Camilo', 95300, 6), c('7', 'Rosa', 15000, 7), c('8', 'Pedro', 12000, 8)];
      saveData(); window.libretaAbrir();
    });
    await p.waitForTimeout(300);
    const filas = () => p.evaluate(() => [...document.querySelectorAll('#lbDeben .lb-deudor')].filter(f => !f.hidden).map(f => f.dataset.persona + '=' + f.querySelector('b').textContent));
    const f1 = await filas();
    const tanias = f1.filter(f => /^t[aâ]nia=/i.test(f));
    chk('1. «Tania», «Tânia» y «tania» salen en una sola fila con $60.000', tanias.length === 1 && /=\$60\.000$/.test(tanias[0]), f1);
    const tot = await p.evaluate(() => document.getElementById('lbTotDeben').textContent);
    chk('2. «Me deben» suma lo real ($323.200) y dice «6 personas»', /\$323\.200/.test(tot) && /6 personas/.test(tot), tot);
    chk('3. Camila sale con $52.500', f1.includes('Camila=$52.500'), f1);
    await p.evaluate(() => { data.libreta.movs.push({ id: 'a1', tipo: 'abono', persona: 'TANIA', monto: 5000, fecha: new Date().toISOString() }); saveData(); window.libretaAbrir(); });
    await p.waitForTimeout(200);
    const f4 = (await filas()).filter(f => /^t[aâ]nia=/i.test(f));
    chk('4. Un abono escrito «TANIA» le baja a Tania ($55.000), sin otra fila', f4.length === 1 && /=\$55\.000$/.test(f4[0]), f4);
    const bus = await p.evaluate(() => { const b = document.getElementById('lbBuscarDeben'); return !!b && !b.hidden && b.getBoundingClientRect().height >= 44; });
    chk('5. Con 6 personas hay buscador (de 44 px)', bus);
    await p.fill('#lbBuscarDeben', 'cami'); await p.waitForTimeout(150);
    const f5 = await filas();
    chk('5. «cami» deja a Camila (y a Camilo)', f5.length === 2 && f5.includes('Camila=$52.500'), f5);
    await p.fill('#lbBuscarDeben', 'zoila'); await p.waitForTimeout(150);
    chk('5. Un nombre que no está dice «Nadie con ese nombre te debe»', (await filas()).length === 0 && await p.evaluate(() => !document.getElementById('lbDebenNada').hidden));
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
