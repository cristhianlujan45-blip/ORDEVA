// 📒 La libreta por voz y su contabilidad (ORDEVA 1.65.7): «me debe», «me pagó», pagos a empleados y, nuevo, PROVEEDORES.
//  1. Fiados por voz, como se dicen: «Juan me debe 20 mil», «anótale a doña Rosa 8.500», «Pedro quedó debiendo…»,
//     «anota que Camilo debe 6 mil» (antes «Camilo 6 no te debe nada»), «súmale a Juan 5 mil» (antes iba a la
//     calculadora), «José me debe 2 cervezas» (el valor sale del precio del producto).
//  2. «Me pagó», «pagó todo», «¿quién me debe?».
//  3. Proveedores: «le pagué a Postobón 200 mil» es un PROVEEDOR (antes quedaba como pago a un empleado), «le debo a
//     Postobón 300 mil», «¿cuánto le debo a los proveedores?», «le pagué a Postobón todo». El pago de una factura ya
//     escaneada se enlaza y no se cuenta dos veces.
//  4. Contabilidad: fiados cobrados = entradas; sueldos = Nómina; pagos a proveedores = Proveedores; «Te deben hoy» y
//     «Debes a proveedores».
//  5. Los botones de la libreta: «📦 Pagué a un proveedor» y «🧾 Le debo a un proveedor».
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1000);
    await p.fill('#authBiz', 'Tienda Libreta'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1500);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); window.speakVoice = () => {};
      data.products = [{ id: 'c1', name: 'Cerveza Águila', price: 3500 }]; data.libreta = { movs: [] };
      data.purchases = [{ id: 'pu1', supplier: 'Alpina S.A.', total: 120000, date: new Date().toISOString().slice(0, 10), at: new Date().toISOString(), items: [] }]; saveData(); });
    const di = t => p.evaluate(t => { const r = window.libretaEntender(t, true); return r ? r.texto : null; }, t);

    // ===== 1. Fiados =====
    chk('1. «Juan me debe 20 mil»', /Juan te debe \$20\.000/.test(await di('Juan me debe 20 mil')));
    chk('1. «Anótale a doña Rosa 8.500»', /Doña Rosa te debe \$8\.500/.test(await di('anótale a doña Rosa 8.500')));
    chk('1. «Pedro quedó debiendo 30 mil»', /Pedro te debe \$30\.000/.test(await di('Pedro quedó debiendo 30 mil')));
    let r = await di('anota que Camilo debe 6 mil');
    chk('1. «Anota que Camilo debe 6 mil» (antes respondía «Camilo 6 no te debe nada»)', /Camilo te debe \$6\.000/.test(r), r);
    r = await di('súmale a Juan 5 mil');
    chk('1. «Súmale a Juan 5 mil» suma a la deuda de Juan (antes iba a la calculadora)', /Juan te debe \$5\.000.*En total te debe \$25\.000/.test(r), r);
    r = await di('José me debe 2 cervezas');
    chk('1. «José me debe 2 cervezas»: 2 × Cerveza Águila = $7.000', /José te debe \$7\.000 \(2 × Cerveza Águila\)/.test(r), r);

    // ===== 2. Pagos y preguntas =====
    r = await di('Juan me pagó 10 mil');
    chk('2. «Juan me pagó 10 mil»: le quedan $15.000', /Juan te pagó \$10\.000.*Todavía te debe \$15\.000/.test(r), r);
    r = await di('Pedro pagó todo');
    chk('2. «Pedro pagó todo»', /Pedro pagó todo \(\$30\.000\)/.test(r), r);
    r = await di('quién me debe');
    chk('2. «¿Quién me debe?»: total y la lista', /Te deben \$36\.500/.test(r) && /Juan \$15\.000/.test(r), r);

    // ===== 3. Proveedores =====
    r = await di('le pagué al proveedor de Postobón 200 mil');
    chk('3. «Le pagué al proveedor de Postobón 200 mil»: PROVEEDOR (antes quedaba como pago a un empleado)', /le pagaste \$200\.000 a Postobón.*gasto de proveedores/.test(r), r);
    r = await di('le pagué a Pedro el sueldo 50 mil');
    chk('3. «Le pagué a Pedro el sueldo 50 mil» sigue siendo un empleado', /👷.*\$50\.000 a Pedro/.test(r), r);
    r = await di('le debo a Postobón 300 mil');
    chk('3. «Le debo a Postobón 300 mil» (por pagar; el pago de contado de antes no lo descuenta)', /le debes \$300\.000 a Postobón\. En total le debes \$300\.000/.test(r), r);
    r = await di('le pagué a Postobón 100 mil');
    chk('3. «Le pagué a Postobón 100 mil»: todavía le debes $200.000', /Todavía le debes \$200\.000/.test(r), r);
    r = await di('cuánto le debo a los proveedores');
    chk('3. «¿Cuánto le debo a los proveedores?»', /Les debes \$200\.000 a los proveedores: Postobón \$200\.000/.test(r), r);
    r = await di('le pagué a Postobón todo');
    chk('3. «Le pagué a Postobón todo»', /le pagaste \$200\.000 a Postobón.*Ya no le debes nada/.test(r), r);
    r = await di('pagué la factura de Alpina 120 mil');
    chk('3. El pago de la factura de Alpina que ya se escaneó se enlaza (no se cuenta dos veces)', /factura escaneada/.test(r) && await p.evaluate(() => !!data.purchases[0].pagadoMov), r);

    // ===== 4. Contabilidad =====
    const ct = await p.evaluate(() => {
      document.querySelector('nav button[data-view="contabilidad"]') ? document.querySelector('nav button[data-view="contabilidad"]').click() : (typeof showView === 'function' && showView('contabilidad'));
      try{ renderConta(); }catch(e){}
      const m = ctMovimientos(ctRango()).mov;
      return { fiado: m.filter(x => /Fiado cobrado · (Juan|Pedro) \(libreta\)/.test(x.desc)).reduce((a, x) => a + x.monto, 0),
        nomina: m.filter(x => x.tipo === 'gasto' && x.cat === 'nomina').reduce((a, x) => a + x.monto, 0),
        prov: m.filter(x => x.tipo === 'gasto' && x.cat === 'proveedores' && /libreta/.test(x.desc)).reduce((a, x) => a + x.monto, 0),
        alpina: m.filter(x => /Alpina/.test(x.desc)).map(x => x.desc + ' ' + x.monto),
        kpis: (document.getElementById('ctKpis') || {}).innerText || '' };
    });
    chk('4. Contabilidad: lo que pagaron los fiados son ENTRADAS ($40.000)', ct.fiado === 40000, ct);
    chk('4. … los sueldos son gasto de Nómina ($50.000)', ct.nomina === 50000, ct);
    chk('4. … los pagos a proveedores son gasto de Proveedores ($500.000 de Postobón)', ct.prov === 500000, ct);
    chk('4. … y la factura de Alpina cuenta UNA sola vez (la compra escaneada)', ct.alpina.length === 1 && /factura escaneada/.test(ct.alpina[0]), ct.alpina);
    chk('4. «📕 Te deben hoy» en Contabilidad', /Te deben hoy/.test(ct.kpis) && /36\.500/.test(ct.kpis), ct.kpis);

    // ===== 5. Botones =====
    await p.evaluate(() => window.libretaAbrir());
    await p.click('#libretaOverlay [data-t="pdeb"]');
    await p.fill('#lbPersona', 'Colanta'); await p.fill('#lbMonto', '80000'); await p.click('#lbFormSi');
    await p.click('#libretaOverlay [data-t="prov"]');
    await p.fill('#lbPersona', 'Colanta'); await p.fill('#lbMonto', '30000'); await p.click('#lbFormSi');
    const pan = await p.evaluate(() => ({ debo: document.getElementById('lbDebo').innerText, prov: document.getElementById('lbProv').innerText, resp: document.getElementById('lbRespuesta').textContent }));
    chk('5. Botones «🧾 Le debo a un proveedor» y «📦 Pagué a un proveedor»: Colanta queda debiendo $50.000', /Colanta\s*\$50\.000/.test(pan.debo) && /Colanta\s*\$30\.000/.test(pan.prov) && /Todavía le debes \$50\.000/.test(pan.resp), pan);
    // «borra lo último» deshace el pago
    r = await di('borra lo último'); r = r || await p.evaluate(() => { const x = window.libretaEntender('borra lo último'); return x && x.texto; });
    chk('5. «Borra lo último» quita el pago (vuelve a deber $80.000)', /borré/.test(r) && await p.evaluate(() => /Colanta\s*\$80\.000/.test(document.getElementById('lbDebo').innerText)), r);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
