// 👆 ORDEVA 1.99.17 · Entrar con la huella (lib/vento-huella.js) — con la app real.
//  A. En el navegador (WebAuthn, con un lector de huella de prueba de Chromium):
//   1. Al entrar con la contraseña, ORDEVA ofrece «¿Entrar con tu huella?» y se activa.
//   2. Al cerrar sesión, la entrada muestra «👆 Entrar con huella» y entra con la huella (sin contraseña).
//   3. Si el celular NO verifica a la persona (huella que no es), no entra.
//   4. La pantalla de bloqueo se desbloquea con la huella.
//   5. Si la contraseña cambia, la huella se apaga sola para ese usuario.
//   6. Ajustes → Cuenta: «Quitar» la apaga.
//   7. El empleado con PIN desbloquea la pantalla de bloqueo con su PIN.
//  B. En la app de Android (puente VentoAndroid.huella* simulado, con la llave del Keystore):
//   8. Se activa desde Ajustes (pide la contraseña). En la entrada NO se pide sola (a la entrada se llega para que entre
//      otra persona); se toca «👆 Entrar con huella». Con «Usar contraseña» no entra.
//   9. La pantalla de bloqueo pide la huella sola y desbloquea.
//  10. Si alguien agrega otra huella al celular (la llave se invalida) o es otro celular, la huella se apaga.
//  C. Lo que encontró la revisión:
//  11. Lo de la huella no va en el respaldo (restaurar en otro celular no la trae) ni se recibe de uno.
//  12. Entrar con el PIN no ofrece la huella; cambiar el PIN la apaga.
//  13. El botón escondido de verdad no se ve (en «Crear cuenta», o con otro usuario escrito).
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const { contestar } = require('./ventanas');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';

(async () => {
  let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 400) : '')); } };
  const b = await chromium.launch();
  try{ await pruebas(); } catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);

  async function pruebas(){
    const esperar = (p, fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 8000, polling: 150 }).then(() => true, () => false);
    async function equipo(nombre, puente, descargas){
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: !!descargas });
      await ctx.route('**/*', rt => { const u = new URL(rt.request().url()); return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') ? rt.continue() : rt.abort(); });
      await ctx.addInitScript(() => { try{ localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-hola', '0'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '', off: true })); }catch(e){} });
      if(puente) await ctx.addInitScript(() => {
        // Puente de la app de Android: solo lo de la huella (lo demás no existe, como en un APK viejo sin esas funciones).
        window.__huellas = 0; window.__huellaRespuesta = 'ok';
        // La llave del Keystore sigue en el celular aunque se recargue la página (aquí se guarda en sessionStorage).
        Object.defineProperty(window, '__llave', { get: () => sessionStorage.getItem('mock-llave') || 'sin-llave', set: v => sessionStorage.setItem('mock-llave', v) });
        const responder = (id, crear) => { window.__huellas++; setTimeout(() => { const ok = window.__huellaRespuesta === 'ok'; if(ok && crear) window.__llave = 'ok'; window.__ventoHuellaRespuesta(id, ok && (crear || window.__llave === 'ok'), ok ? (crear || window.__llave === 'ok' ? 'ok' : window.__llave) : window.__huellaRespuesta); }, 80); };
        const A = { huellaEstado: () => 'ok', huellaLista: () => window.__llave, huellaPedir: id => responder(id, false), huellaActivar: id => responder(id, true), huellaCancelar(){} };
        window.VentoAndroid = new Proxy(A, { get: (o, k) => o[k] });
      });
      const p = await ctx.newPage(); p.on('pageerror', e => errs.push(nombre + ': ' + e.message)); p.on('crash', () => errs.push(nombre + ': la página se cerró (crash)')); p.on('close', () => process.env.DEP && console.log('· cerrada ' + nombre));
      await p.goto(BASE + '/index.html');
      await p.waitForSelector('#authOverlay:not([hidden])', { timeout: 15000 });
      return { ctx, p };
    }
    const dentro = p => esperar(p, () => document.getElementById('authOverlay').hidden, null, 10000);
    const fuera = p => esperar(p, () => !document.getElementById('authOverlay').hidden, null, 10000);
    const cerrar = p => p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));

    // ===================== A. Navegador (WebAuthn) =====================
    const L = t => process.env.DEP && console.log('· ' + t);
    const W = await equipo('navegador'); L('equipo');
    const cdp = await W.ctx.newCDPSession(W.p);
    await cdp.send('WebAuthn.enable');
    const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
    // Crear la cuenta (sin nube) y salir, para entrar con la contraseña.
    L('cdp'); await W.p.fill('#authBiz', 'Tienda Huella'); await W.p.fill('#authUser', 'dueno'); await W.p.fill('#authPass', 'clave-dueno-1'); await W.p.click('#authBtn');
    await dentro(W.p); await cerrar(W.p);
    await W.p.evaluate(() => { localStorage.removeItem('cm-session'); });
    await W.p.reload(); await fuera(W.p);
    chk('Sin huella activada, la entrada no muestra el botón de huella', await W.p.evaluate(() => { const b = document.getElementById('authHuellaBtn'); return !b || b.hidden; }));
    await W.p.click('#authTabs [data-tab="entrar"]').catch(() => {});
    await W.p.fill('#authUser', 'dueno'); await W.p.fill('#authPass', 'clave-dueno-1'); await W.p.click('#authBtn');
    await dentro(W.p);
    chk('1. Al entrar con la contraseña ofrece «¿Entrar con tu huella?»', await esperar(W.p, () => /Entrar con tu huella/.test((document.querySelector('#confirmOverlay.show') || {}).textContent || ''), null, 8000));
    await W.p.click('#confirmOverlay.show #confirmOkBtn');
    chk('1. …y queda activada para «dueno» en este equipo', await esperar(W.p, () => window.ventoHuella.tiene('dueno'), null, 8000), await W.p.evaluate(() => localStorage.getItem('vento-huella')));
    chk('1. No se guarda ninguna contraseña con la huella', await W.p.evaluate(() => !/clave-dueno/.test(localStorage.getItem('vento-huella'))));

    // 2. Cerrar sesión y entrar con la huella
    await cerrar(W.p);
    await W.p.evaluate(() => { cerrarSesion(); });
    await contestar(W.p, true).catch(() => {});
    await W.p.waitForSelector('#authOverlay:not([hidden])', { timeout: 15000 });
    chk('2. La entrada muestra «👆 Entrar con huella · dueno»', await esperar(W.p, () => { const b = document.getElementById('authHuellaBtn'); return b && !b.hidden && b.offsetParent && /dueno/.test(b.textContent); }));
    await W.p.click('#authHuellaBtn');
    chk('2. …y entra con la huella, sin escribir la contraseña', await dentro(W.p) && await W.p.evaluate(() => authUser === 'dueno'));

    // 3. La huella no es (el equipo no verifica a la persona): no entra
    await cerrar(W.p);
    await W.p.evaluate(() => { localStorage.removeItem('cm-session'); });
    await W.p.reload(); await fuera(W.p);
    await cdp.send('WebAuthn.setUserVerified', { authenticatorId, isUserVerified: false });
    await esperar(W.p, () => { const b = document.getElementById('authHuellaBtn'); return b && !b.hidden; });
    await W.p.click('#authHuellaBtn');
    await W.p.waitForTimeout(1500);
    chk('3. Si el celular no verifica la huella, NO entra', await W.p.evaluate(() => !document.getElementById('authOverlay').hidden));
    await cdp.send('WebAuthn.setUserVerified', { authenticatorId, isUserVerified: true });
    await W.p.click('#authHuellaBtn'); await dentro(W.p); await cerrar(W.p);

    // 4. Pantalla de bloqueo
    await W.p.evaluate(() => bloquearApp());
    chk('4. La pantalla de bloqueo tiene «👆 Desbloquear con huella»', await esperar(W.p, () => !!document.getElementById('lockHuella')));
    await W.p.click('#lockHuella');
    chk('4. …y se desbloquea con la huella', await esperar(W.p, () => !document.getElementById('lockOv')));

    // 6. Ajustes → Cuenta → Quitar (antes del 5, que cambia la contraseña)
    chk('6. En Ajustes → Cuenta está «👆 Entrar con huella» activada', await W.p.evaluate(async () => { window.ventoHuella.pintar(); await new Promise(r => setTimeout(r, 200)); const f = document.getElementById('accHuellaRow'); return !f.hidden && /Activada/.test(document.getElementById('accHuellaTxt').textContent) && document.getElementById('accHuellaBtn').textContent === 'Quitar'; }));
    await W.p.evaluate(() => document.getElementById('accHuellaBtn').click());
    await W.p.waitForSelector('#confirmOverlay.show', { timeout: 5000 }); await W.p.click('#confirmOverlay.show #confirmOkBtn');
    chk('6. «Quitar» la apaga', await esperar(W.p, () => !window.ventoHuella.tiene('dueno')));
    // Activarla otra vez desde Ajustes: pide la contraseña (mal → no; bien → sí)
    await W.p.evaluate(() => document.getElementById('accHuellaBtn').click());
    await W.p.waitForSelector('#promptOverlay.show', { timeout: 5000 }); await W.p.fill('#promptInput', 'mala-mala'); await W.p.click('#promptOkBtn');
    await W.p.waitForTimeout(800);
    chk('6. Activar desde Ajustes con la contraseña mal: no se activa', await W.p.evaluate(() => !window.ventoHuella.tiene('dueno')));
    await W.p.evaluate(() => document.getElementById('accHuellaBtn').click());
    await W.p.waitForSelector('#promptOverlay.show', { timeout: 5000 }); await W.p.fill('#promptInput', 'clave-dueno-1'); await W.p.click('#promptOkBtn');
    chk('6. …con la contraseña bien: se activa', await esperar(W.p, () => window.ventoHuella.tiene('dueno')));

    // 5. La contraseña cambia → la huella se apaga sola
    await W.p.evaluate(async () => { await authPonerClaveLocal('dueno', 'clave-NUEVA-2'); });
    chk('5. Si la contraseña cambia, la huella se apaga sola', await W.p.evaluate(() => !window.ventoHuella.tiene('dueno')));

    // 7. Empleado con PIN: desbloquea con el PIN
    await W.p.evaluate(async () => { await authAddUser('cajero1', 'clave-cajero-1', 'staff'); await authPonerPin('cajero1', '4321'); authUser = 'cajero1'; bloquearApp(); });
    await W.p.waitForSelector('#lockOv', { timeout: 5000 });
    chk('7. La pantalla de bloqueo del empleado dice «PIN o contraseña»', await W.p.evaluate(() => /PIN o contraseña/.test(document.getElementById('lockPassTxt').textContent)));
    await W.p.fill('#lockPass', '1111'); await W.p.click('#lockOv button[type=submit]');
    chk('7. Con el PIN malo no desbloquea', await esperar(W.p, () => /incorrectos/.test(document.getElementById('lockErr').textContent)) && await W.p.evaluate(() => !!document.getElementById('lockOv')));
    await W.p.fill('#lockPass', '4321'); await W.p.click('#lockOv button[type=submit]');
    chk('7. Con su PIN desbloquea', await esperar(W.p, () => !document.getElementById('lockOv')));
    await W.ctx.close();

    // ===================== B. App de Android (puente simulado) =====================
    const A = await equipo('android', true);
    await A.p.fill('#authBiz', 'Tienda Android'); await A.p.fill('#authUser', 'ana'); await A.p.fill('#authPass', 'clave-ana-1'); await A.p.click('#authBtn');
    await dentro(A.p); await cerrar(A.p);
    await A.p.evaluate(() => { window.ventoHuella.pintar(); });
    chk('8. Ajustes → Cuenta muestra «👆 Entrar con huella» (Android)', await esperar(A.p, () => !document.getElementById('accHuellaRow').hidden && getComputedStyle(document.getElementById('accHuellaRow')).display !== 'none'));
    await A.p.evaluate(() => document.getElementById('accHuellaBtn').click());
    await A.p.waitForSelector('#promptOverlay.show', { timeout: 5000 });
    chk('8. Al activarla avisa que cualquier huella del celular podrá entrar', await A.p.evaluate(() => /cualquier huella/.test(document.getElementById('promptMessage').textContent)));
    await A.p.fill('#promptInput', 'clave-ana-1'); await A.p.click('#promptOkBtn');
    chk('8. Se activa con la ventana de huella de Android (y la llave del celular)', await esperar(A.p, () => window.ventoHuella.tiene('ana') && window.__huellas === 1 && window.__llave === 'ok'), await A.p.evaluate(() => ({ h: window.__huellas, r: localStorage.getItem('vento-huella'), l: window.__llave })));
    await A.p.evaluate(() => { localStorage.removeItem('cm-session'); });
    await A.p.reload(); await fuera(A.p);
    await A.p.waitForTimeout(1500);
    chk('8. En la entrada NO se pide sola (se toca el botón)', await A.p.evaluate(() => window.__huellas === 0 && !document.getElementById('authOverlay').hidden), await A.p.evaluate(() => window.__huellas));
    await A.p.evaluate(() => { window.__huellaRespuesta = 'cancelado'; });
    await A.p.click('#authHuellaBtn');
    await A.p.waitForTimeout(800);
    chk('8. Con «Usar contraseña» no entra y queda para escribirla', await A.p.evaluate(() => !document.getElementById('authOverlay').hidden && document.getElementById('authUser').value === 'ana'));
    await A.p.evaluate(() => { window.__huellaRespuesta = 'ok'; });
    await A.p.click('#authHuellaBtn');
    chk('8. …y con la huella sí entra', await dentro(A.p));
    await cerrar(A.p);
    // 9. Bloqueo: se pide sola
    const h9 = await A.p.evaluate(() => window.__huellas);
    await A.p.evaluate(() => bloquearApp());
    chk('9. La pantalla de bloqueo pide la huella sola y desbloquea', await esperar(A.p, h => !document.getElementById('lockOv') && window.__huellas === h + 1, h9));
    // 10. Se agregó otra huella al celular: la llave ya no sirve
    await A.p.evaluate(() => { window.__llave = 'invalidada'; });
    await A.p.waitForTimeout(5200);                                  // (lo que se sabe de la llave se refresca cada 5 s)
    chk('10. Si se agrega otra huella al celular, la huella de ORDEVA se apaga', await A.p.evaluate(() => !window.ventoHuella.tiene('ana')));
    await A.p.evaluate(() => { cerrarSesion(); });
    await contestar(A.p, true).catch(() => {});
    await A.p.waitForSelector('#authOverlay:not([hidden])', { timeout: 15000 });
    chk('10. …y la entrada ya no ofrece «Entrar con huella»', await A.p.evaluate(() => { const b = document.getElementById('authHuellaBtn'); return !b || getComputedStyle(b).display === 'none'; }));
    await A.ctx.close();

    // ===================== C. Lo que encontró la revisión =====================
    const C = await equipo('revision', false, true);
    const cdp2 = await C.ctx.newCDPSession(C.p); await cdp2.send('WebAuthn.enable');
    await cdp2.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
    await C.p.fill('#authBiz', 'Tienda C'); await C.p.fill('#authUser', 'dueno'); await C.p.fill('#authPass', 'clave-dueno-1'); await C.p.click('#authBtn');
    await dentro(C.p); await cerrar(C.p);
    await C.p.evaluate(() => document.getElementById('accHuellaBtn').click());
    await C.p.waitForSelector('#promptOverlay.show', { timeout: 5000 }); await C.p.fill('#promptInput', 'clave-dueno-1'); await C.p.click('#promptOkBtn');
    await esperar(C.p, () => window.ventoHuella.tiene('dueno'));
    // 11. Respaldo
    const respaldo = await Promise.all([C.p.waitForEvent('download', { timeout: 10000 }), C.p.evaluate(() => document.getElementById('btSave').click())])
      .then(async ([dl]) => JSON.parse(require('fs').readFileSync(await dl.path(), 'utf8'))).catch(e => ({ error: e.message }));
    const claves = Object.keys((respaldo && respaldo.localStorage) || {});
    chk('11. El respaldo NO lleva lo de la huella (sí lleva los usuarios)', claves.includes('cm-users') && !claves.some(k => /^vento-huella/.test(k)), respaldo.error || claves.filter(k => /huella|cm-users/.test(k)));
    chk('11. …ni se recibe de uno (al restaurar no se ponen claves «vento-huella»)', await C.p.evaluate(() => /!\/\^vento-huella\/\.test\(k\)/.test(String(window.importBackup))));
    // 12. PIN: entrar con el PIN no ofrece; cambiar el PIN apaga
    await C.p.evaluate(async () => { await authAddUser('cajero1', 'clave-cajero-1', 'staff'); await authPonerPin('cajero1', '4321'); });
    await C.p.evaluate(() => { localStorage.removeItem('cm-session'); });
    await C.p.reload(); await fuera(C.p);
    await C.p.click('#authTabs [data-tab="entrar"]').catch(() => {});
    await C.p.fill('#authUser', 'cajero1'); await C.p.fill('#authPass', '4321'); await C.p.click('#authBtn');
    await dentro(C.p);
    await C.p.waitForTimeout(2500);
    chk('12. Entrar con el PIN NO ofrece activar la huella', await C.p.evaluate(() => !document.querySelector('#confirmOverlay.show')));
    await cerrar(C.p);
    // cajero1 activa su huella con la contraseña, y luego el administrador le cambia el PIN
    await C.p.evaluate(() => document.getElementById('accHuellaBtn').click());
    await C.p.waitForSelector('#promptOverlay.show', { timeout: 5000 }); await C.p.fill('#promptInput', 'clave-cajero-1'); await C.p.click('#promptOkBtn');
    chk('12. (cajero1 activa la huella con su contraseña)', await esperar(C.p, () => window.ventoHuella.tiene('cajero1')));
    await C.p.evaluate(async () => { await authPonerPin('cajero1', '9999'); });
    chk('12. Si le cambian el PIN, la huella de cajero1 se apaga', await C.p.evaluate(() => !window.ventoHuella.tiene('cajero1') && window.ventoHuella.tiene('dueno')));
    // 13. El botón escondido no se ve
    await C.p.evaluate(() => { localStorage.removeItem('cm-session'); });
    await C.p.reload(); await fuera(C.p);
    await C.p.click('#authTabs [data-tab="entrar"]').catch(() => {});
    chk('13. Con la huella de «dueno», la entrada muestra su botón', await esperar(C.p, () => { const b = document.getElementById('authHuellaBtn'); return b && getComputedStyle(b).display !== 'none' && /dueno/.test(b.textContent); }));
    await C.p.fill('#authUser', 'cajero1');
    chk('13. Si se escribe otro usuario (sin huella), el botón NO se ve', await esperar(C.p, () => { const b = document.getElementById('authHuellaBtn'); return b && getComputedStyle(b).display === 'none'; }));
    await C.p.fill('#authUser', '');
    await C.p.click('#authTabs [data-tab="crear"]');
    chk('13. En «Crear cuenta» el botón NO se ve', await esperar(C.p, () => { const b = document.getElementById('authHuellaBtn'); return !b || getComputedStyle(b).display === 'none'; }));
    await C.ctx.close();
  }
})();
