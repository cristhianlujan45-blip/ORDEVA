// App Android: los avisos de plata recibida de DaviPlata/Nequi de ESTE celular llegan a Vento sin MacroDroid, y cada pago
// que llega (de otro celular o de la API de DaviPlata) suena como aviso del celular aunque Vento esté cerrada.
// El puente nativo (VentoAndroid: VentoEscucha + notificar) se simula en la página; lo demás es la app de verdad.
//  1. Ajustes → Verificar pagos → «📲 Leer los avisos de ESTE celular»: sin permiso abre «Acceso a notificaciones».
//  2. Aviso «DaviPlata | ¡Recibiste plata! | JUAN PEREZ te envió $25.000» → pago confirmado, de la mesa que debe $25.000.
//  3. El mismo aviso otra vez (Android lo vuelve a publicar) → no se repite.
//  4. Un pago que llega por el Servidor Vento → aviso del celular «💜 Llegó un pago» (con N.º de aprobación de DaviPlata).
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
      const A = window.__and = { on: false, permiso: false, cola: [], notifs: [], permisoAbierto: 0 };
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

    // 1. Ajustes: interruptor del celular
    await p.evaluate(() => { data.pagos = data.pagos || {}; data.pagos.on = true; saveData(); });
    await p.click('#navMoreBtn'); await p.click('.more-tile[data-go="ajustes"]');
    if(await p.isVisible('#ajustesBackBtn')) await p.click('#ajustesBackBtn');
    await p.click('.ajustes-cat[data-cat="negocio"]');
    await p.waitForSelector('#pgAndOn', { state: 'attached', timeout: 5000 });
    chk('1. En Ajustes aparece «📲 Leer los avisos de ESTE celular (sin MacroDroid)»', /Leer los avisos de ESTE celular/.test(await p.textContent('#pgAndFila')));
    await p.evaluate(() => { const i = document.getElementById('pgAndOn'); i.checked = true; i.dispatchEvent(new Event('change')); });
    let A = await p.evaluate(() => window.__and);
    chk('1. Al prenderlo queda prendido en el celular y, sin permiso, abre «Acceso a notificaciones»', A.on && A.permisoAbierto === 1, A);
    chk('1. Dice que falta el permiso', /Falta el permiso/.test(await p.textContent('#pgAndTxt')));
    await p.evaluate(() => { window.__and.permiso = true; document.getElementById('pgAndOn').dispatchEvent(new Event('change')); });
    chk('1. Con el permiso: «🟢 Leyendo los avisos…»', /Leyendo los avisos/.test(await p.textContent('#pgAndTxt')));

    // 2. Llega un aviso de DaviPlata
    await p.evaluate(() => {
      document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.products = [{ id: 'pk', name: 'Poker', price: 12500 }]; data.tables[1] = { items: [{ productId: 'pk', name: 'Poker', price: 12500, qty: 2, personId: null }], people: [] }; saveData();
      window.__and.cola.push({ id: 'k1:123', txt: 'DaviPlata | ¡Recibiste plata! | JUAN PEREZ te envió $25.000', t: Date.now() });
      window.ventoAvisosNativos();
    });
    const x = await p.evaluate(() => (data.pagos.lista || [])[0] || null);
    chk('2. Aviso de DaviPlata → pago de $25.000 confirmado por la app', x && x.monto === 25000 && x.app === 'Daviplata' && x.estado === 'app' && x.de === 'Juan Perez', x);
    chk('2. … y es de la mesa que debe $25.000', x && x.mesa === 1, x);

    // 3. El mismo aviso otra vez
    await p.evaluate(() => { window.__and.cola.push({ id: 'k1:123', txt: 'DaviPlata | ¡Recibiste plata! | JUAN PEREZ te envió $25.000', t: Date.now() }); window.ventoAvisosNativos(); });
    chk('3. El mismo aviso otra vez no se repite', await p.evaluate(() => data.pagos.lista.filter(y => y.monto === 25000).length) === 1);
    await p.evaluate(() => { window.__and.cola.push({ id: 'k2:9', txt: 'Nequi | Nequi | Tu código de seguridad es 123456', t: Date.now() }); window.ventoAvisosNativos(); });
    chk('3. Un aviso que no es plata recibida no cuenta', await p.evaluate(() => data.pagos.lista.length) === 1);

    // 4. Pago por el Servidor Vento (otro celular o la API de DaviPlata)
    await p.evaluate(() => window.ventoPagos.recibir({ id: 'srv-77', estado: 'aprobado', confianza: 'ok', verificado: true, proveedor: 'daviplata', metodo: 'DAVIPLATA', monto: 18000, aprobacion: '604107', creado_en: new Date().toISOString(), actualizado_en: new Date().toISOString() }, true));
    A = await p.evaluate(() => window.__and);
    const n = A.notifs.find(y => /Llegó un pago/.test(y.t));
    chk('4. Aviso del celular «💜 Llegó un pago» con valor, DaviPlata y N.º de aprobación', n && /\$18\.000/.test(n.x) && /DaviPlata/i.test(n.x) && /604107/.test(n.x) && n.c === 'pedidos', A.notifs);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
