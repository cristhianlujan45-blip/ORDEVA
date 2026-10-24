// 🔢 PIN de los empleados (ORDEVA 1.62.0), con la app de verdad:
//  1. El dueño le pone un PIN de 4 a 6 números a «juan» (Ajustes → usuarios → 🔢). Los administradores no tienen PIN.
//  2. En la entrada: toca «juan», escribe el PIN y entra (como equipo, no como dueño).
//  3. Tocar su nombre arriba = cambiar de usuario (guarda todo y vuelve a la entrada).
//  4. 5 PIN malos seguidos: el PIN queda bloqueado (ni el correcto entra); con la contraseña entra y se desbloquea.
//  5. El PIN no se guarda: solo su huella. Quitar el PIN.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 500) : '')); } };
  const b = await chromium.launch();
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    let respuesta = '2468'; p.on('dialog', d => d.type() === 'prompt' ? d.accept(respuesta) : d.accept());
    const esperar = (fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 10000, polling: 200 }).then(() => true, () => false);
    const dentro = () => esperar(() => document.getElementById('authOverlay').hidden, null, 15000);
    const afuera = () => esperar(() => !document.getElementById('authOverlay').hidden, null, 15000);
    const entrar = async (u, c) => { await p.fill('#authUser', u); await p.fill('#authPass', c); await p.click('#authBtn'); };
    const fila = (nombre, txt) => p.evaluate(([n, t]) => { const r = [...document.querySelectorAll('#accUsersList .acc-user')].find(x => x.querySelector('b').textContent.startsWith(n)); const bt = r && [...r.querySelectorAll('button')].find(x => x.textContent.trim().startsWith(t)); if(bt) bt.click(); return !!bt; }, [nombre, txt]);

    await p.goto(BASE + '/index.html');
    await p.waitForSelector('#authOverlay:not([hidden])');
    await p.fill('#authBiz', 'Bar PIN'); await entrar('dueno', 'clave-dueno-1');
    chk('El dueño entra', await dentro());
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); document.getElementById('accNewUser').value = 'juan'; document.getElementById('accNewPass').value = 'juan-clave-1'; document.getElementById('accNewRole').value = 'staff'; document.getElementById('accAddBtn').click(); accUsuariosPintar(); });
    await esperar(() => document.querySelectorAll('#accUsersList .acc-user').length === 2);

    // 1. Ponerle el PIN
    chk('1. El administrador no tiene botón de PIN (solo el equipo)', !(await p.evaluate(() => { const r = [...document.querySelectorAll('#accUsersList .acc-user')].find(x => x.querySelector('b').textContent.startsWith('dueno')); return [...r.querySelectorAll('button')].some(x => /🔢/.test(x.textContent)); })));
    respuesta = '12a4'; await fila('juan', '🔢');
    chk('1. Un PIN con letras no se acepta', await esperar(() => /4 a 6 números/.test(document.getElementById('toast').textContent)) && !(await p.evaluate(() => !!JSON.parse(localStorage.getItem('cm-users')).find(u => u.user === 'juan').pin)));
    respuesta = '2468'; await fila('juan', '🔢');
    chk('1. «🔢» le pone el PIN 2468 a juan', await esperar(() => { const u = JSON.parse(localStorage.getItem('cm-users')).find(x => x.user === 'juan'); return !!(u && u.pin && u.pin.h); }));
    chk('5. El PIN no se guarda en el equipo: solo su huella', !(await p.evaluate(() => localStorage.getItem('cm-users'))).includes('2468'));

    // 2. Entrar con el PIN
    await p.evaluate(() => { localStorage.removeItem('cm-session'); }); await p.reload(); await afuera();
    await p.evaluate(() => [...document.querySelectorAll('#authUsers button')].find(x => /juan/.test(x.textContent)).click());
    chk('2. Al tocar «juan» pide «PIN o contraseña» con teclado de números', await p.evaluate(() => document.getElementById('authPass').inputMode === 'numeric' && /PIN/.test(document.getElementById('authPass').placeholder)));
    await p.fill('#authPass', '2468'); await p.click('#authBtn');
    chk('2. Juan entra con su PIN', await dentro());
    chk('2. … como equipo (no como dueño)', await esperar(() => document.body.classList.contains('modo-mesero')));

    // 3. Cambiar de usuario tocando su nombre
    await p.evaluate(() => document.getElementById('meseroChip').click());
    await p.click('#confirmOkBtn');
    chk('3. Tocar su nombre arriba = cambiar de usuario (vuelve a la entrada)', await afuera());

    // 4. Bloqueo por intentos
    for(let i = 1; i <= 4; i++){ await entrar('juan', '1111'); await esperar(() => /PIN incorrecto/.test(document.getElementById('authErr').textContent)); }
    chk('4. PIN malo: avisa cuántos intentos quedan', /Te queda 1 intento/.test(await p.textContent('#authErr')), await p.textContent('#authErr'));
    await entrar('juan', '1111');
    chk('4. Al quinto queda bloqueado', await esperar(() => /quedó bloqueado/.test(document.getElementById('authErr').textContent)));
    await entrar('juan', '2468');
    chk('4. … y ni el PIN correcto entra', await esperar(() => /quedó bloqueado/.test(document.getElementById('authErr').textContent)) && !(await p.evaluate(() => document.getElementById('authOverlay').hidden)));
    await entrar('juan', 'juan-clave-1');
    chk('4. Con su contraseña sí entra', await dentro());
    await p.evaluate(() => { localStorage.removeItem('cm-session'); }); await p.reload(); await afuera();
    await entrar('juan', '2468');
    chk('4. … y el PIN vuelve a servir', await dentro());

    // 5. Quitar el PIN
    await p.evaluate(() => { localStorage.removeItem('cm-session'); }); await p.reload(); await afuera();
    await entrar('dueno', 'clave-dueno-1'); await dentro();
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); accUsuariosPintar(); });
    respuesta = ''; await fila('juan', '🔢');
    chk('5. Dejarlo vacío quita el PIN', await esperar(() => !JSON.parse(localStorage.getItem('cm-users')).find(x => x.user === 'juan').pin));
    await p.evaluate(() => { localStorage.removeItem('cm-session'); }); await p.reload(); await afuera();
    await entrar('juan', '2468');
    chk('5. … y ya no entra con él', await esperar(() => /incorrect/i.test(document.getElementById('authErr').textContent)) && !(await p.evaluate(() => document.getElementById('authOverlay').hidden)), await p.textContent('#authErr'));
    chk('Sin errores de página', !errs.length, errs);
    await ctx.close();
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
