// 🚨 ALERTAS DE PAGOS (ORDEVA etapa 6): en Ajustes → Pagos, una sola lista con todo lo que hace falta para que un pago
// suene con el celular bloqueado, cada cosa con su botón para arreglarla, la conexión, el último pago y las pruebas.
// El puente nativo (VentoAndroid) se simula en la página; lo demás es la app de verdad.
//  1. App Android con todo mal: dice cuántas cosas faltan y cada botón abre el ajuste que es (permiso, notificaciones,
//     batería de Vento, trabajar de fondo, batería de Nequi).
//  2. Con todo bien: «🟢 Todo listo».
//  3. Último pago y último aviso del banco; «Probar el sonido» dice la voz; «Probar la alerta completa» pasa un aviso de
//     prueba por el camino de verdad (no se registra como pago); «Elegir el sonido y la vibración» abre los ajustes de Android.
//  4. Vento Web (sin la app): explica que la lectura la hace la app y ofrece probar la vibración del navegador.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';

(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 500) : '')); } };
  const abrir = async (ctx) => {
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1500);
    await p.fill('#authBiz', 'Bar A'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1200);
    await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    await p.click('#navMoreBtn'); await p.click('.more-tile[data-go="ajustes"]');
    if(await p.isVisible('#ajustesBackBtn')) await p.click('#ajustesBackBtn');
    await p.click('.ajustes-cat[data-cat="negocio"]');
    await p.waitForSelector('#pgOn', { state: 'attached', timeout: 5000 });
    await p.evaluate(() => { const i = document.getElementById('pgOn'); i.checked = true; i.dispatchEvent(new Event('change')); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); });
    return p;
  };
  const pulsar = (p, k) => p.evaluate(k => document.querySelector('#pgAlertas [data-pga="' + k + '"]').click(), k);
  const base = () => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} };
  try{
    // ---------- 1-3. App Android ----------
    let ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(base);
    await ctx.addInitScript(() => {
      const A = window.__and = { on: true, permiso: false, notif: false, bat: false, fondo: false, nequiLibre: false, abierto: [], pruebas: [], voz: 0, cola: [] };
      window.VentoAndroid = {
        pagosAvisos: v => { A.on = !!v; }, pagosAvisosEstado: () => JSON.stringify({ on: A.on, permiso: A.permiso }),
        pagosAvisosTomar: () => { const s = JSON.stringify(A.cola); A.cola = []; return s; }, pagosLectura: () => 1,
        pagosAvisosDiag: () => JSON.stringify({ ultimo: Date.parse('2026-10-23T15:04:00'), lista: [], traza: [] }),
        mediosPermiso: () => A.abierto.push('permiso'), avisosEstado: () => JSON.stringify({ prendidos: A.notif, permiso: A.notif }),
        avisosActivar: () => A.abierto.push('notif'), avisosAjustes: () => A.abierto.push('ajustesAvisos'),
        permisos: () => JSON.stringify({ bateria: A.bat, fondo: A.fondo }), ajustesBateria: () => A.abierto.push('bateria'), fondoActivar: v => A.abierto.push('fondo:' + v),
        bancosBateria: () => JSON.stringify([{ pkg: 'com.nequi.MobileApp', nombre: 'Nequi', sinRestriccion: A.nequiLibre }]), bancoAjustes: pkg => A.abierto.push('banco:' + pkg),
        pagosProbarVoz: () => { A.voz++; }, pagosVozOn: () => {}, pagosVolumen: () => {},
        pagosPrueba: (app, tit, txt, sms) => { A.pruebas.push(txt); return JSON.stringify({ ok: true, r: '✅ tomado' }); },
        notificar: () => true,
      };
    });
    let p = await abrir(ctx);
    let res = await p.textContent('#pgAlertasRes');
    chk('1. Con todo mal dice cuántas cosas faltan (permiso, notificaciones, batería, fondo, Nequi)', /🟠 5 cosas por arreglar/.test(res), res);
    chk('1. La lista sale abierta cuando falta algo', await p.evaluate(() => document.querySelector('#pgAlertas details').open));
    for(const k of ['permiso', 'notif', 'bateria', 'fondo', 'banco:com.nequi.MobileApp']) await pulsar(p, k);
    let A = await p.evaluate(() => window.__and);
    chk('1. Cada botón abre el ajuste que es', ['permiso', 'notif', 'bateria', 'fondo:true', 'banco:com.nequi.MobileApp'].every(x => A.abierto.includes(x)), A.abierto);

    await p.evaluate(() => Object.assign(window.__and, { permiso: true, notif: true, bat: true, fondo: true, nequiLibre: true }));
    await p.evaluate(() => window.pgRepintar());
    res = await p.textContent('#pgAlertasRes');
    chk('2. Con todo bien: «🟢 Todo listo»', /🟢 Todo listo/.test(res) && await p.evaluate(() => !document.querySelector('#pgAlertas [data-pga="permiso"]')), res);

    await p.evaluate(() => { window.__and.cola.push({ id: 'k1:1', txt: 'Nequi | Nequi | ANA RUIZ te envió $12.000', t: Date.now() }); window.ventoAvisosNativos(); });
    await p.waitForTimeout(300);
    const txt = await p.textContent('#pgAlertas');
    chk('3. Muestra el último pago y el último aviso del banco', /Último pago: \$12\.000 por Nequi/.test(txt) && /Último aviso de un banco/.test(txt), txt.slice(0, 600));
    await pulsar(p, 'probar');
    const nPagos = await p.evaluate(() => data.pagos.lista.length);
    await pulsar(p, 'completa');
    await pulsar(p, 'sonido');
    A = await p.evaluate(() => window.__and);
    chk('3. «Probar el sonido» dice la voz de los pagos', A.voz === 1, A.voz);
    chk('3. «Probar la alerta completa» pasa un aviso de prueba por el camino de verdad', A.pruebas.length === 1 && /2\.500/.test(A.pruebas[0]), A.pruebas);
    chk('3. … y no se registra como pago', await p.evaluate(() => data.pagos.lista.length) === nPagos);
    chk('3. «Elegir el sonido y la vibración» abre los ajustes de avisos de Android', A.abierto.includes('ajustesAvisos'), A.abierto);
    await ctx.close();

    // ---------- 4. Vento Web ----------
    ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(base);
    await ctx.addInitScript(() => { window.__vib = []; navigator.vibrate = (x) => { window.__vib.push(x); return true; }; });
    p = await abrir(ctx);
    const web = await p.textContent('#pgAlertas');
    chk('4. En Vento Web explica que la lectura la hace la app en el celular de Nequi', /Aquí no se leen los avisos del banco/.test(web) && !!(await p.$('#pgAlertas [data-pga="app"]')), web.slice(0, 400));
    chk('4. Sin «alerta completa» ni ajustes de Android; sí «Probar la vibración»', !(await p.$('#pgAlertas [data-pga="completa"]')) && !(await p.$('#pgAlertas [data-pga="sonido"]')) && !!(await p.$('#pgAlertas [data-pga="vibrar"]')));
    await pulsar(p, 'vibrar');
    chk('4. «Probar la vibración» hace vibrar el equipo (si puede)', (await p.evaluate(() => window.__vib)).length === 1);
    await ctx.close();
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
