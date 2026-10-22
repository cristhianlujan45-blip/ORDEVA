// App Android: los avisos de plata recibida de DaviPlata/Nequi de ESTE celular llegan a Vento sin MacroDroid, y cada pago
// que llega (de otro celular o de la API de DaviPlata) suena como aviso del celular aunque Vento esté cerrada.
// El puente nativo (VentoAndroid: VentoEscucha + notificar) se simula en la página; lo demás es la app de verdad.
//  1. Ajustes → «Recibir avisos de pagos»: en la app lee DIRECTO los avisos del banco (sin MacroDroid); sin permiso abre «Acceso a notificaciones».
//  2. Aviso «DaviPlata | ¡Recibiste plata! | JUAN PEREZ te envió $25.000» → pago confirmado, de la mesa que debe $25.000.
//  3. El mismo aviso otra vez (Android lo vuelve a publicar) → no se repite.
//  2b. Como el parlante de Bold: suena el sonido de éxito y dice en voz alta «Pago confirmado. 25000 pesos desde DaviPlata, de Juan Perez…».
//  4. Un pago que llega por el Servidor Vento → aviso del celular «✅ Pago confirmado» y la voz (con N.º de aprobación de DaviPlata).
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';

(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => {
      try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){}
      const A = window.__and = { on: false, permiso: false, cola: [], notifs: [], permisoAbierto: 0, voz: [], sonidos: 0 };
      window.VentoAndroid = {
        pagosAvisos: v => { A.on = !!v; }, pagosAvisosEstado: () => JSON.stringify({ on: A.on, permiso: A.permiso }),
        pagosAvisosTomar: () => { const s = JSON.stringify(A.cola); A.cola = []; return s; },
        mediosPermiso: () => { A.permisoAbierto++; }, notificar: (t, x, c, siempre) => { A.notifs.push({ t, x, c }); return true; },
      };
    });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1500);
    await p.fill('#authBiz', 'Bar A'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1200);
    await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));

    // 1. Ajustes: en la app, prender «Recibir avisos de pagos» = la app lee directo los avisos del banco (sin MacroDroid)
    await p.click('#navMoreBtn'); await p.click('.more-tile[data-go="ajustes"]');
    if(await p.isVisible('#ajustesBackBtn')) await p.click('#ajustesBackBtn');
    await p.click('.ajustes-cat[data-cat="negocio"]');
    await p.waitForSelector('#pgOn', { state: 'attached', timeout: 5000 });
    const desc = await p.textContent('#pgGrupo');
    chk('1. Explica que la app de Vento lee directamente el aviso del banco y dice «Pago confirmado»', /la app de Vento lee directamente el aviso del banco/.test(desc) && /Pago confirmado/.test(desc), desc.slice(0, 300));
    chk('1. MacroDroid queda solo como «otro método», plegado', await p.evaluate(() => { const d = document.querySelector('#pgGrupo details'); return !!d && !d.open && /NO usas la app Vento/.test(d.querySelector('summary').textContent); }));
    await p.evaluate(() => { const i = document.getElementById('pgOn'); i.checked = true; i.dispatchEvent(new Event('change')); });
    let A = await p.evaluate(() => window.__and);
    chk('1. Al prender «Recibir avisos de pagos» queda leyendo los avisos de este celular y, sin permiso, abre «Acceso a notificaciones»', A.on && A.permisoAbierto === 1 && await p.evaluate(() => data.pagos.on === true), A);
    chk('1. Dice que falta el permiso', /Falta el permiso/.test(await p.textContent('#pgAndTxt')) && /Falta el permiso/.test(await p.textContent('#pgEstado')));
    await p.evaluate(() => { window.__and.permiso = true; document.getElementById('pgAndOn').dispatchEvent(new Event('change')); });
    chk('1. Con el permiso: «🟢 La app lee directo los avisos de pagos de este celular»', /Leyendo los avisos/.test(await p.textContent('#pgAndTxt')) && /La app lee directo/.test(await p.textContent('#pgEstado')));

    // 2. Llega un aviso de DaviPlata
    await p.evaluate(() => {
      const h = window.ventoHablar; window.ventoHablar = (t, o) => { window.__and.voz.push(String(t)); try{ h && h(t, o); }catch(e){} };
      if(window.ventoSonidos){ const s0 = window.ventoSonidos.success; window.ventoSonidos.success = () => { window.__and.sonidos++; return s0(); }; }
      document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.products = [{ id: 'pk', name: 'Poker', price: 12500 }]; data.tables[1] = { items: [{ productId: 'pk', name: 'Poker', price: 12500, qty: 2, personId: null }], people: [] }; saveData();
      window.__and.cola.push({ id: 'k1:123', txt: 'DaviPlata | ¡Recibiste plata! | JUAN PEREZ te envió $25.000', t: Date.now() });
      window.ventoAvisosNativos();
    });
    const x = await p.evaluate(() => (data.pagos.lista || [])[0] || null);
    const voz2 = await p.evaluate(() => window.__and.voz.slice());
    chk('2b. Dice en voz alta «Pago confirmado» con el valor, DaviPlata y quién pagó', voz2.some(t => /^Llegaron 25000 pesos por DaviPlata/.test(t)), voz2);
    chk('2b. Suena el sonido de éxito (como el parlante de Bold)', await p.evaluate(() => window.__and.sonidos) >= 1);
    chk('2b. En pantalla: «✅ Pago confirmado · $25.000 por DaviPlata de Juan Perez»', /Pago confirmado · \$25\.000 por DaviPlata de Juan Perez/.test(await p.evaluate(() => document.body.innerText)));
    chk('2. Aviso de DaviPlata → pago de $25.000 confirmado por la app', x && x.monto === 25000 && x.app === 'DaviPlata' && x.estado === 'app' && x.de === 'Juan Perez', x);
    chk('2. … y es de la mesa que debe $25.000', x && x.mesa === 1, x);

    // 3. El mismo aviso otra vez
    await p.evaluate(() => { window.__and.cola.push({ id: 'k1:123', txt: 'DaviPlata | ¡Recibiste plata! | JUAN PEREZ te envió $25.000', t: Date.now() }); window.ventoAvisosNativos(); });
    chk('3. El mismo aviso otra vez no se repite', await p.evaluate(() => data.pagos.lista.filter(y => y.monto === 25000).length) === 1);
    await p.evaluate(() => { window.__and.cola.push({ id: 'k2:9', txt: 'Nequi | Nequi | Tu código de seguridad es 123456', t: Date.now() }); window.ventoAvisosNativos(); });
    chk('3. Un aviso que no es plata recibida no cuenta', await p.evaluate(() => data.pagos.lista.length) === 1);

    // 4. Pago por el Servidor Vento (otro celular o la API de DaviPlata)
    await p.evaluate(() => window.ventoPagos.recibir({ id: 'srv-77', estado: 'aprobado', confianza: 'ok', verificado: true, proveedor: 'daviplata', metodo: 'DAVIPLATA', monto: 18000, aprobacion: '604107', creado_en: new Date().toISOString(), actualizado_en: new Date().toISOString() }, true));
    A = await p.evaluate(() => window.__and);
    const n = A.notifs.find(y => /Pago confirmado/.test(y.t));
    chk('4. Dice «Pago confirmado» en voz alta en los demás celulares', A.voz.some(t => /^Llegaron 18000 pesos por DaviPlata/.test(t)), A.voz);
    chk('4. Aviso del celular «✅ Pago confirmado» con valor, DaviPlata y N.º de aprobación', n && /\$18\.000/.test(n.x) && /DaviPlata/i.test(n.x) && /604107/.test(n.x) && n.c === 'pedidos', A.notifs);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
