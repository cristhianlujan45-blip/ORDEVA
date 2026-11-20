// 📒 1.99.24 · «Las personas que me deben no quedan bien guardadas» (pedido del dueño, 20/11). En su negocio, 7 de las 15
// cuentas que deben estaban SIN el nombre de quien debe: el fiado de una persona de la mesa guardaba solo su número, que
// se borra al cerrar la mesa. Revisa:
//  1. Dos personas de la mesa quedan debiendo (desde su cuenta): al cerrar, cada fiado queda con su nombre, y la libreta
//     muestra a Juan y a Pedro aparte, cada uno con lo suyo (antes todo a una sola o «Sin nombre»).
//  2. Abonos: «Juan me pagó 5000» solo baja lo de Juan; «Pedro pagó todo» deja a Pedro en cero y a Juan con lo suyo.
//  3. Una sola persona debiendo: la cuenta queda a su nombre (Historial y avisos).
//  4. Cuentas viejas sin nombre: salen aparte (mesa y día), no juntas en una «Sin nombre»; con «✏️ ¿Quién es?» se les pone
//     el nombre y queda guardado en la cuenta. Una mesa con nombre («Don Pedro») sigue saliendo con ese nombre.
//  5. Al volver a abrir ORDEVA todo sigue igual (nombres, abonos y libreta).
//  6. Código del negocio: manda el que viaja con los datos (dos celulares ya no se lo cambian entre sí sin parar); si una
//     suscripción se activó para el del celular, se queda ese.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
  const entrar = async p => { await p.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); window.speakVoice = () => {}; }); await p.waitForTimeout(500); };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('vento-guia-tour', '1'); localStorage.setItem('cm-tutorial-seen', '1'); }catch(e){} });
    let p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(800); await entrar(p);
    const saldos = () => p.evaluate(() => { const o = {}; ['Juan', 'Pedro', 'Ana', 'Rosa', 'Don Pedro'].forEach(n => { o[n] = window.libretaSaldo(n); }); return o; });

    // ===== 1. Dos personas de la mesa quedan debiendo =====
    const h1 = await p.evaluate(() => {
      data.libreta = { movs: [] }; data.history = [];
      data.tables[3] = { items: [{ productId: 'x', name: 'Cerveza', price: 5000, qty: 4, personId: 'pj' }, { productId: 'x', name: 'Cerveza', price: 5000, qty: 6, personId: 'pp' }],
        people: [{ id: 'pj', name: 'Juan' }, { id: 'pp', name: 'Pedro' }],
        payments: [{ note: '', amount: 20000, method: 'debe', personId: 'pj' }, { note: '', amount: 30000, method: 'debe', personId: 'pp' }] };
      const e = closeTableToHistory(3); saveData();
      return { notas: e.payments.map(x => x.note), debt: e.debt, person: e.person || null };
    });
    chk('1. Al cerrar la mesa, cada fiado queda con el nombre de su persona (Juan y Pedro)', JSON.stringify(h1.notas) === '["Juan","Pedro"]' && h1.debt === 50000, h1);
    let s = await saldos();
    chk('1. La libreta muestra a Juan con $20.000 y a Pedro con $30.000 (cada uno lo suyo)', s.Juan === 20000 && s.Pedro === 30000, s);
    await p.evaluate(() => window.libretaAbrir());
    const filas = await p.evaluate(() => [...document.querySelectorAll('#lbDeben .lb-deudor')].map(f => f.dataset.persona + '=' + f.querySelector('b').textContent));
    chk('1. En la pantalla de la libreta salen los dos, aparte', filas.some(f => /^Juan=\$20\.000$/.test(f)) && filas.some(f => /^Pedro=\$30\.000$/.test(f)) && !filas.some(f => /Sin nombre/.test(f)), filas);

    // ===== 2. Abonos =====
    await p.evaluate(() => window.libretaEntender('Juan me pagó 5000'));
    s = await saldos();
    chk('2. «Juan me pagó 5000» solo baja lo de Juan (queda $15.000; Pedro sigue en $30.000)', s.Juan === 15000 && s.Pedro === 30000, s);
    await p.evaluate(() => window.libretaEntender('Pedro pagó todo'));
    s = await saldos();
    chk('2. «Pedro pagó todo»: Pedro en cero y Juan con lo suyo', s.Pedro === 0 && s.Juan === 15000, s);
    chk('2. La cuenta de la mesa queda debiendo solo lo de Juan', await p.evaluate(() => data.history[0].debt === 15000), await p.evaluate(() => data.history[0].debt));

    // ===== 3. Una sola persona =====
    const h3 = await p.evaluate(() => {
      data.tables[4] = { items: [{ productId: 'x', name: 'Cerveza', price: 5000, qty: 2, personId: 'pa' }], people: [{ id: 'pa', name: 'Ana' }], payments: [{ note: '', amount: 10000, method: 'debe', personId: 'pa' }] };
      const e = closeTableToHistory(4); saveData(); return { person: e.person, nota: e.payments[0].note };
    });
    chk('3. Una sola persona debiendo: la cuenta queda a su nombre (Ana)', h3.person === 'Ana' && h3.nota === 'Ana', h3);
    chk('3. … y en la libreta Ana debe $10.000', (await saldos()).Ana === 10000, await saldos());

    // ===== 4. Cuentas viejas sin nombre =====
    await p.evaluate(() => {
      const viejo = (id, mesa, dia, extra) => Object.assign({ id, table: mesa, tableName: null, total: 8000, debt: 8000, date: '2026-11-' + dia + 'T20:00:00.000Z', items: [{ name: 'Cerveza', qty: 2, price: 4000 }], payments: [{ note: 'Saldo sin registrar al cerrar', amount: 8000, method: 'debe' }] }, extra || {});
      data.history.push(viejo('v1', 2, '10'), viejo('v2', 5, '12'), viejo('v3', 6, '14', { tableName: 'Don Pedro' }));
      saveData(); window.libretaPintar();
    });
    const sin = await p.evaluate(() => [...document.querySelectorAll('#lbDeben .lb-deudor')].map(f => f.dataset.persona).filter(n => /Sin nombre/.test(n)));
    chk('4. Las dos cuentas viejas sin nombre salen aparte (con su mesa y su día), no juntas', sin.length === 2 && sin.every(n => /^❓ Sin nombre · .+ · \d+/.test(n)), sin);
    chk('4. La mesa con nombre («Don Pedro») sigue saliendo con ese nombre', (await saldos())['Don Pedro'] === 8000, await saldos());
    await p.evaluate(() => { window.showPrompt = () => Promise.resolve('Rosa'); document.querySelector('#lbDeben [data-nombrar]').click(); });
    await p.waitForTimeout(400);
    const tras = await p.evaluate(() => ({ rosa: window.libretaSaldo('Rosa'), sin: [...document.querySelectorAll('#lbDeben .lb-deudor')].map(f => f.dataset.persona).filter(n => /Sin nombre/.test(n)).length,
      cuenta: data.history.filter(h => h.person === 'Rosa').map(h => ({ id: h.id, nota: h.payments[0].note })) }));
    chk('4. «✏️ ¿Quién es?» → «Rosa»: la cuenta queda a nombre de Rosa ($8.000) y queda una sola sin nombre', tras.rosa === 8000 && tras.sin === 1 && tras.cuenta.length === 1 && tras.cuenta[0].nota === 'Rosa', tras);
    // «Pagó todo» en la que sigue sin nombre
    await p.evaluate(() => document.querySelector('.lb-deudor[data-persona^="❓"] [data-pagotodo]').click());
    await p.waitForTimeout(300);
    chk('4. «Pagó todo» en una cuenta sin nombre la salda (ya no sale)', await p.evaluate(() => ![...document.querySelectorAll('#lbDeben .lb-deudor')].some(f => /Sin nombre/.test(f.dataset.persona)) && data.history.filter(h => (h.id === 'v1' || h.id === 'v2') && h.person !== 'Rosa').every(h => h.debt === 0)), await p.evaluate(() => data.history.filter(h => h.id === 'v1' || h.id === 'v2').map(h => [h.id, h.person, h.debt])));

    // ===== 5. Volver a abrir =====
    await p.evaluate(async () => { await guardadoAhora(); });
    await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1200); await entrar(p);
    s = await saldos();
    chk('5. Al volver a abrir: Juan $15.000, Pedro $0, Ana $10.000, Rosa $8.000, Don Pedro $8.000', s.Juan === 15000 && s.Pedro === 0 && s.Ana === 10000 && s.Rosa === 8000 && s['Don Pedro'] === 8000, s);
    chk('5. … y los apuntes de la libreta siguen (3 abonos)', await p.evaluate(() => (data.libreta.movs || []).filter(m => m.tipo === 'abono').length === 3), await p.evaluate(() => data.libreta.movs));

    // ===== 6. Código del negocio =====
    const c6 = await p.evaluate(() => {
      data.negocioCodigo = 'BBBB-2222'; localStorage.setItem('vento-negocio', 'AAAA-1111');
      let guardados = 0; const sd = window.saveData; window.saveData = function(){ guardados++; return sd.apply(this, arguments); };
      const c1 = codigoNegocio(), ls1 = localStorage.getItem('vento-negocio'), c1b = codigoNegocio();
      // Una suscripción firmada para el código del celular (AAAA-1111): se queda ese
      const b64 = o => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      data.licencias = [b64({ d: 'AAAA-1111', m: 'mensual', v: Date.now() + 864e5 }) + '.firma'];
      localStorage.setItem('vento-negocio', 'AAAA-1111');
      const c2 = codigoNegocio();
      window.saveData = sd;
      return { c1, ls1, c1b, guardadosAntes: guardados, c2, dc2: data.negocioCodigo };
    });
    chk('6. Manda el código de los datos (BBBB-2222), el celular lo copia y no se guarda nada', c6.c1 === 'BBBB-2222' && c6.ls1 === 'BBBB-2222' && c6.c1b === 'BBBB-2222', c6);
    chk('6. Si la suscripción es del código del celular (AAAA-1111), se queda ese y pasa a los datos', c6.c2 === 'AAAA-1111' && c6.dc2 === 'AAAA-1111', c6);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
