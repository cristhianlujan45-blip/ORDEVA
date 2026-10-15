// Mesa con varias personas: quién pagó, cuánto y cuánto le falta a cada uno.
// Antes: cada persona solo contaba SUS pagos; si la cuenta principal pagaba toda la mesa, las personas seguían saliendo
// como si debieran, los pagos no decían quién pagó y los chips mostraban el total (no lo que falta).
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    p.on('dialog', d => d.accept());
    await p.goto(BASE + '/index.html', { waitUntil: 'load' }); await p.waitForTimeout(3000);
    const preparar = async (mesa) => p.evaluate(m => {
      try{ document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); }catch(e){}
      data.products = [{ id: 'ag', name: 'Águila', price: 4000, stock: 200 }, { id: 'pk', name: 'Poker', price: 5000, stock: 200 }, { id: 'cc', name: 'Club Colombia', price: 6000, stock: 200 }];
      data.tables[m] = { items: [
        { productId: 'ag', name: 'Águila', price: 4000, qty: 2, personId: null, history: [] },
        { productId: 'pk', name: 'Poker', price: 5000, qty: 2, personId: 'pa', history: [] },
        { productId: 'cc', name: 'Club Colombia', price: 6000, qty: 1, personId: 'pl', history: [] }],
        people: [{ id: 'pa', name: 'Ana' }, { id: 'pl', name: 'Luis' }], payments: [] };
      saveData(); renderMesas(); openTableModal(m);
    }, mesa);
    const pagarMesa = async v => { await p.fill('#paymentAmount', String(v)); await p.click('#addPaymentBtn'); await p.waitForTimeout(150); };
    const pagarPersona = async (id, v) => { await p.evaluate(id => openPersonModal(id), id); await p.fill('#personPaymentAmount', String(v)); await p.click('#personAddPaymentBtn'); await p.waitForTimeout(150); await p.evaluate(() => closePersonModal()); };
    const txt = sel => p.evaluate(s => (document.querySelector(s) || {}).textContent || '', sel);
    await p.evaluate(async () => { try{ await enterApp('test', null); }catch(x){} localStorage.setItem('cm-tutorial-seen', '1'); });

    // ===== Mesa 1: general $8.000 (2 Águila) · Ana $10.000 · Luis $6.000 = $24.000 =====
    await preparar(1);
    chk('1. Sin pagos: «👥 Quién pagó · 0 de 3» y cuánto le falta a cada uno', /0 de 3/.test(await txt('#mesaQuienPago')) && /Falta \$\s?10\.000/.test(await txt('#mesaQuienPago')), await txt('#mesaQuienPago'));
    chk('1. Los chips dicen cuánto DEBE cada persona (no el total sin más)', /Ana\s*debe \$\s?10\.000/.test(await txt('#peopleChips')) && /Luis\s*debe \$\s?6\.000/.test(await txt('#peopleChips')), await txt('#peopleChips'));

    await pagarPersona('pa', 10000);
    chk('2. Ana paga lo suyo: chip «✅ pagó» y «Ana · ✅ Pagó $10.000»', /Ana\s*✅ pagó/.test(await txt('#peopleChips')) && /✅ Pagó \$\s?10\.000/.test(await txt('#mesaQuienPago')) && /1 de 3/.test(await txt('#mesaQuienPago')), [await txt('#peopleChips'), await txt('#mesaQuienPago')]);
    chk('2. El pago dice QUIÉN pagó («👤 Ana»)', /👤 Ana/.test(await txt('#paymentsContainer')), await txt('#paymentsContainer'));
    chk('2. El saldo de la mesa baja a $14.000', /14\.000/.test(await txt('#modalTotal')), await txt('#modalTotal'));

    await pagarMesa(14000);
    chk('3. La cuenta principal paga el resto: Luis queda «✅ Pagado por Cuenta general» (ya no debe)', /Luis[\s\S]*✅ Pagado por Cuenta general/.test(await txt('#mesaQuienPago')) && /Luis\s*✅ pagó/.test(await txt('#peopleChips')), [await txt('#mesaQuienPago'), await txt('#peopleChips')]);
    chk('3. «3 de 3 cuentas pagadas» y saldo de la mesa $0', /3 de 3/.test(await txt('#mesaQuienPago')) && /\$\s?0$/.test((await txt('#modalTotal')).trim()), [await txt('#mesaQuienPago'), await txt('#modalTotal')]);
    chk('3. La cuenta general dice cuánto pagó por los demás', /Cuenta general[\s\S]*también pagó \$\s?6\.000 de los demás/.test(await txt('#mesaQuienPago')), await txt('#mesaQuienPago'));
    chk('3. El pago de la cuenta principal dice «👤 Cuenta general»', /👤 Cuenta general/.test(await txt('#paymentsContainer')));
    await p.evaluate(() => openPersonModal('pl'));
    chk('3. En la cuenta de Luis: pagado $6.000, saldo $0 y «Incluye $6.000 que pagó Cuenta general»', /6\.000/.test(await txt('#personModalPagado')) && /\$\s?0$/.test((await txt('#personModalTotal')).trim()) && /Incluye \$\s?6\.000 que pagó Cuenta general/.test(await txt('#personModalCubierto')), [await txt('#personModalPagado'), await txt('#personModalTotal'), await txt('#personModalCubierto')]);
    chk('3. Sus abonos dicen «Cuenta general pagó $6.000 de su cuenta»', /Cuenta general pagó \$\s?6\.000 de su cuenta/.test(await txt('#personPaymentsContainer')));

    // Cerrar la cuenta de Luis: el pago de la cuenta general se va con él (la mesa no queda descuadrada)
    await p.evaluate(() => { window.__conf = window.showConfirm; window.showConfirm = async () => true; });
    await p.click('#personChargeBtn'); await p.waitForTimeout(400);
    const h = await p.evaluate(() => data.history[0]);
    chk('4. Cerrar la cuenta de Luis: en su historial queda «Pagado por Cuenta general $6.000» y sin deuda', h && h.person === 'Luis' && h.payments.some(x => /Pagado por Cuenta general/.test(x.note) && x.amount === 6000) && !(h.debt > 0), h && h.payments);
    chk('4. La mesa sigue cuadrada: pagos de la mesa $18.000 (Ana 10.000 + general 8.000) y saldo $0', await p.evaluate(() => tablePaid(1) === 18000 && tableBalance(1) === 0 && tableTotal(1) === 18000), await p.evaluate(() => [tablePaid(1), tableTotal(1), tableBalance(1)]));

    // ===== Mesa 2: la cuenta principal abona parcial =====
    await preparar(2);
    await pagarMesa(10000);
    chk('5. La cuenta principal abona $10.000: cubre lo general ($8.000) y $2.000 de Ana', /Ana[\s\S]*Abonó \$\s?2\.000 · falta \$\s?8\.000/.test(await txt('#mesaQuienPago')), await txt('#mesaQuienPago'));
    chk('5. Luis sigue debiendo lo suyo', /Luis[\s\S]*Falta \$\s?6\.000/.test(await txt('#mesaQuienPago')));

    // ===== Mesa 3: una persona paga de más (invita a otra) =====
    await preparar(3);
    await pagarPersona('pa', 16000);
    chk('6. Ana paga $16.000 (de más): lo que sobra va primero a lo de todos (cuenta general) y Ana «también pagó $6.000 de los demás»', /Cuenta general[\s\S]*Abonó \$\s?6\.000 · falta \$\s?2\.000/.test(await txt('#mesaQuienPago')) && /Ana[\s\S]*también pagó \$\s?6\.000 de los demás/.test(await txt('#mesaQuienPago')), await txt('#mesaQuienPago'));
    await pagarPersona('pa', 8000);
    chk('6. Si Ana paga $8.000 más: completa la cuenta general y cubre a Luis («✅ Pagado por Ana»)', /Luis[\s\S]*✅ Pagado por Ana/.test(await txt('#mesaQuienPago')) && /3 de 3/.test(await txt('#mesaQuienPago')), await txt('#mesaQuienPago'));
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); renderMesas(); });
    chk('7. En el menú de mesas: «👥 1/3 pagaron» en la mesa 2 y «👥 3/3 pagaron» en la 3', await p.evaluate(() => { const l = [...document.querySelectorAll('.ticket .items-count')].map(t => t.textContent); return l.some(t => /👥 1\/3 pagaron/.test(t)) && l.some(t => /👥 3\/3 pagaron/.test(t)); }), await p.evaluate(() => [...document.querySelectorAll('.ticket .items-count')].map(t => t.textContent)));
    await p.evaluate(() => openBillSummary(3));
    chk('8. «Cuenta de la mesa» (voz) también dice quién pagó', /Quién pagó \(3 de 3\)/.test(await txt('#billSummaryOverlay')) && /Pagado por Ana/.test(await txt('#billSummaryOverlay')));

    // ===== Mesa 5: «¿Quién paga?» con el nombre de una persona =====
    await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    await preparar(5);
    await p.fill('#paymentNote', 'luis'); await pagarMesa(6000);
    chk('10. En el pago de la mesa, «¿Quién paga? luis» → el pago queda a nombre de Luis (no de la cuenta general)', /Luis[\s\S]*✅ Pagó \$\s?6\.000/.test(await txt('#mesaQuienPago')) && await p.evaluate(() => data.tables[5].payments[0].personId === 'pl'), await txt('#mesaQuienPago'));

    // ===== Mesa sin personas: igual que siempre =====
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); data.tables[4] = { items: [{ productId: 'ag', name: 'Águila', price: 4000, qty: 3, personId: null, history: [] }], people: [], payments: [] }; saveData(); openTableModal(4); });
    await pagarMesa(5000);
    chk('9. Mesa sin personas: no sale «Quién pagó» y el saldo es el de siempre ($7.000)', !(await p.isVisible('#mesaQuienPago')) && /7\.000/.test(await txt('#modalTotal')) && !/👤/.test(await txt('#paymentsContainer')));
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
