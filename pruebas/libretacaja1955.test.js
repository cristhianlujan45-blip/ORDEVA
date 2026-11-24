// 📒💵 1.99.55 · Libreta y caja. Revisa:
//  1. «… por Nequi / por transferencia» ya no se vuelve parte del nombre («Pedro Nequi», «Agro Sur Transferencia») y el
//     pago queda como transferencia.
//  2. Con la caja abierta: pagarle en efectivo a un empleado o a un proveedor desde la libreta es una SALIDA de la caja
//     (antes solo entraban los fiados cobrados); por transferencia no; y «me equivoqué» quita la salida.
//  3. Sin caja abierta, «Cuadre» resta lo pagado en efectivo desde la libreta (y lo muestra en su renglón).
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 500) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 412, height: 915 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-guia-tour', '1'); localStorage.setItem('vento_vista_sencilla', '1'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE); await p.waitForTimeout(1000);
    await p.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); window.speakVoice = () => {}; window.showConfirm = async () => true;
      data.closures = [{ id: 'c1', date: new Date(Date.now() - 3600e3).toISOString(), from: null, ticketCount: 0, totalSold: 0 }];
      data.history = [{ id: 'v1', invoiceNo: 'FV-1', date: new Date().toISOString(), table: null, tableName: 'Mostrador', total: 10000, debt: 0, items: [{ name: 'x', price: 10000, qty: 1 }], payments: [{ method: 'efectivo', amount: 10000 }] }];
      data.libreta = { movs: [] }; data.turno = null; await saveData(); });
    const ult = () => p.evaluate(() => { const m = data.libreta.movs[data.libreta.movs.length - 1]; return { t: m.tipo, p: m.persona, met: m.metodo || 'efectivo', caja: !!m.cajaMov }; });
    // 1. Por voz
    await p.evaluate(() => window.libretaEntender('le pagué a Pedro 50 mil por nequi'));
    let m = await ult(); chk('1. «le pagué a Pedro 50 mil por nequi» → Pedro, transferencia', m.t === 'emp' && m.p === 'Pedro' && m.met === 'transferencia', m);
    await p.evaluate(() => window.libretaEntender('le pagué al proveedor Agro Sur 100 mil por transferencia'));
    m = await ult(); chk('1. «… Agro Sur 100 mil por transferencia» → Agro Sur, transferencia', m.t === 'prov' && m.p === 'Agro Sur' && m.met === 'transferencia', m);
    await p.evaluate(() => window.libretaEntender('Juan me debe 20 mil'));
    await p.evaluate(() => window.libretaEntender('Juan me pagó 5 mil con daviplata'));
    m = await ult(); chk('1. «Juan me pagó 5 mil con daviplata» → abono de Juan, transferencia', m.t === 'abono' && m.p === 'Juan' && m.met === 'transferencia', m);
    await p.evaluate(() => window.libretaEntender('le pagué a Pedro 30 mil'));
    m = await ult(); chk('1. Sin decir cómo: efectivo, y es el mismo Pedro', m.t === 'emp' && m.p === 'Pedro' && m.met === 'efectivo', m);
    // 3. Cuadre sin caja abierta: 10.000 de ventas − 30.000 a Pedro en efectivo (los de transferencia no)
    const leer = () => p.evaluate(async () => { document.getElementById('vsCajaNav').click(); await new Promise(r => setTimeout(r, 300));
      const ov = document.getElementById('vsCajaOv'); const f = [...ov.querySelectorAll('.vs-caja-filas div')].map(d => d.innerText.replace(/\s+/g, ' ').trim()); ov.classList.remove('show'); return f; });
    let f = await leer();
    chk('3. Renglón «Pagos en efectivo de la libreta» −$30.000', f.some(x => /Pagos en efectivo de la libreta .*−\$\s?30\.000/.test(x)), f);
    chk('3. «Efectivo que debe haber» = $10.000 − $30.000 = −$20.000 (con el signo bien puesto y la nota)', f.some(x => /Efectivo que debe haber −\$\s?20\.000/.test(x)) && f.some(x => /Salió más efectivo del que entró/.test(x)), f);
    const ly = await p.evaluate(() => window.Laya.responder('cuánto hay en caja').text);
    chk('3. Laya «¿cuánto hay en caja?» dice lo mismo que Cuadre (−$20.000, con el detalle)', /debe haber −\$\s?20\.000 en efectivo/.test(ly) && /pagos en efectivo de la libreta \$\s?30\.000/.test(ly), ly);
    // 2. Con la caja abierta
    await p.evaluate(() => { ventoTurno.ponerTurno({ abierto_en: new Date().toISOString(), base: 100000, por: 'ana', movs: [] }); });
    await p.evaluate(() => window.libretaEntender('le pagué a Pedro 40 mil'));
    let T = await p.evaluate(() => ventoTurno.resumen());
    chk('2. Pago en efectivo a Pedro → salida de $40.000 en la caja', T.salidas === 40000 && T.movs.some(x => x.tipo === 'salida' && /Pago a Pedro/.test(x.motivo)), T.movs);
    await p.evaluate(() => window.libretaEntender('le pagué a Pedro 15 mil por nequi'));
    T = await p.evaluate(() => ventoTurno.resumen());
    chk('2. Por Nequi no sale de la caja', T.salidas === 40000, T.movs);
    await p.evaluate(() => window.libretaEntender('le pagué al proveedor Agro Sur 25 mil'));
    T = await p.evaluate(() => ventoTurno.resumen());
    chk('2. Pago en efectivo al proveedor → salida', T.salidas === 65000 && T.movs.some(x => /Pago al proveedor Agro Sur/.test(x.motivo)), T.movs);
    await p.evaluate(() => window.libretaEntender('me equivoqué'));
    T = await p.evaluate(() => ventoTurno.resumen());
    chk('2. «Me equivoqué» quita esa salida', T.salidas === 40000, T.movs);
    f = await leer();
    chk('2. Con caja abierta el Cuadre usa la caja: $100.000 − $40.000 (la venta fue antes de abrirla), sin el renglón aparte', !f.some(x => /Pagos en efectivo de la libreta/.test(x)) && f.some(x => /Efectivo que debe haber \(con la base \$\s?100\.000\) \$\s?60\.000/.test(x)), f);
    // 4. El formulario de la libreta (botones) también pregunta cómo se pagó
    const form = (t, quien, n, met) => p.evaluate(async ([t, quien, n, met]) => { window.libretaAbrir(); await new Promise(r => setTimeout(r, 200));
      document.querySelector('#libretaOverlay .lb-b[data-t="' + t + '"]').click(); const vis = !document.getElementById('lbMet').hidden;
      document.getElementById('lbPersona').value = quien; document.getElementById('lbMonto').value = n;
      if(met) document.querySelector('#lbMet [data-met="' + met + '"]').click();
      document.getElementById('lbFormSi').click(); await new Promise(r => setTimeout(r, 200)); return vis; }, [t, quien, n, met]);
    let vis = await form('prov', 'Agro Sur', 70000, 'transferencia');
    m = await ult(); T = await p.evaluate(() => ventoTurno.resumen());
    chk('4. Formulario «pagué a proveedor» con 📱 Transferencia: queda transferencia y no sale de la caja', vis && m.t === 'prov' && m.met === 'transferencia' && !m.caja && T.salidas === 40000, { m, s: T.salidas });
    vis = await form('emp', 'Pedro', 10000);
    m = await ult(); T = await p.evaluate(() => ventoTurno.resumen());
    chk('4. Formulario «pagué a empleado» sin tocar nada: efectivo y sale de la caja', m.t === 'emp' && m.met === 'efectivo' && m.caja && T.salidas === 50000, { m, s: T.salidas });
    await p.evaluate(() => window.libretaEntender('Rosa me debe 20 mil'));
    await form('abono', 'Rosa', 8000, 'transferencia');
    m = await ult(); T = await p.evaluate(() => ventoTurno.resumen());
    chk('4. Formulario «me pagaron» con 📱 Transferencia: abono de Rosa sin entrada a la caja', m.t === 'abono' && m.p === 'Rosa' && m.met === 'transferencia' && T.entradas === 0, { m, e: T.entradas });
    vis = await form('debe', 'Rosa', 1000);
    chk('4. «Me deben» no muestra efectivo / transferencia', vis === false, vis);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
