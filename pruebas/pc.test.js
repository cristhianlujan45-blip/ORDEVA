// ORDEVA para PC (programa de escritorio, carpeta pc/): se abre el programa DE VERDAD (Electron) con la copia local de
// ORDEVA y se revisa:
//  1. Abre ORDEVA en su ventana («ORDEVA»), con «VentoPC/<versión>» en el navegador y window.ventoPC para la página.
//  2. Los enlaces de afuera (WhatsApp, Google…) no abren ventanas dentro del programa (van al navegador).
//  3. Pedir la balanza / impresora (puerto serial) pasa por el programa (lista para elegir; sin aparatos: aviso).
//  4. Cerrar la ventana NO cierra el programa: sigue trabajando junto al reloj (los avisos siguen sonando).
//  5. Sin conexión con ORDEVA → «📡 Sin conexión con ORDEVA» (y se abre solo al volver).
// Necesita Electron (pc/node_modules o ELECTRON_PATH); sin él se omite (como las pruebas con PostgreSQL).
const { _electron } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('fs'), path = require('path');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
const PC = path.join(__dirname, '..', 'pc');
const exe = process.env.ELECTRON_PATH || [path.join(PC, 'node_modules', 'electron', 'dist', 'electron')].find(f => fs.existsSync(f));

// Linux sin pantalla (servidor de pruebas): se vuelve a correr dentro de xvfb-run (pantalla virtual) si está.
if(exe && process.platform === 'linux' && !process.env.DISPLAY && !process.env.VENTO_PC_XVFB){
  const { spawnSync } = require('child_process');
  const r = spawnSync('xvfb-run', ['-a', process.execPath, __filename], { stdio: 'inherit', env: Object.assign({}, process.env, { VENTO_PC_XVFB: '1' }) });
  if(!r.error) process.exit(r.status == null ? 1 : r.status);
}
(async () => {
  if(!exe){ console.log('ℹ️ Sin Electron en este equipo: se omite (cd pc && npm install, o ELECTRON_PATH).'); console.log('RESULTADO 0 bien 0 mal'); process.exit(0); }
  let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x) : '')); } };
  const abrir = url => _electron.launch({ executablePath: exe, args: [PC, '--no-sandbox'], env: Object.assign({}, process.env, { VENTO_PC_URL: url, ELECTRON_DISABLE_SECURITY_WARNINGS: '1' }) });
  let app = null;
  try{
    app = await abrir(BASE + '/');
    const w = await app.firstWindow();
    w.on('pageerror', e => errs.push(e.message));
    await w.waitForLoadState('domcontentloaded'); await w.waitForTimeout(1500);
    chk('1. Abre ORDEVA en su propia ventana (la entrada de ORDEVA)', await w.isVisible('#authBtn') && /ORDEVA/.test(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getTitle())));
    // 1.58.2: el programa se llama ORDEVA, pero sus datos siguen en la carpeta de siempre («Vento»): no se pierde nada.
    const ud = await app.evaluate(({ app }) => app.getPath('userData'));
    chk('1. Los datos del programa siguen en la MISMA carpeta de antes («Vento»), aunque se llame ORDEVA', /[\\/]Vento$/.test(ud), ud);
    const ua = await w.evaluate(() => navigator.userAgent);
    chk('1. El navegador dice «VentoPC/<versión>» (la página sabe que es el programa de PC)', /VentoPC\/\d+\.\d+\.\d+/.test(ua) && /Chrome\//.test(ua), ua);
    const pc = await w.evaluate(() => window.ventoPC ? { v: window.ventoPC.version(), p: window.ventoPC.plataforma, i: typeof window.ventoPC.inicioConWindows } : null);
    chk('1. window.ventoPC: versión, plataforma y «abrir al prender el computador»', pc && /^\d+\.\d+\.\d+$/.test(pc.v) && pc.p && pc.i === 'function', pc);
    chk('1. La página NO tiene acceso a Node (seguro)', await w.evaluate(() => typeof require === 'undefined' && typeof process === 'undefined'));
    // 1.65.5: con la pantalla bloqueada Windows suspendía el computador y los pagos llegaban al desbloquear.
    chk('1. Mientras ORDEVA está abierto el computador no se suspende (para que los pagos lleguen con la pantalla bloqueada)',
      await app.evaluate(({ powerSaveBlocker }) => [0, 1, 2, 3, 4, 5].some(i => powerSaveBlocker.isStarted(i))));
    const inst = await w.evaluate(() => ({ t: (document.getElementById('instAqui') || {}).textContent || '', pc: getComputedStyle(document.getElementById('instPc')).display, apk: getComputedStyle(document.getElementById('instApk')).display }));
    chk('1. La app lo reconoce: «✅ Este computador ya tiene ORDEVA para PC» (y no ofrece descargarlo otra vez)', /ya tiene ORDEVA para PC \(versión \d+\.\d+\.\d+\)/.test(inst.t) && inst.pc === 'none' && inst.apk !== 'none', inst);

    // 2. Enlaces de afuera
    await app.evaluate(({ shell }) => { global.__abiertos = []; shell.openExternal = u => { global.__abiertos.push(u); return Promise.resolve(); }; });
    await w.evaluate(() => { window.open('https://wa.me/573001234567?text=hola', '_blank'); });
    await w.waitForTimeout(500);
    const v2 = await app.evaluate(({ BrowserWindow }) => ({ n: BrowserWindow.getAllWindows().length, ab: global.__abiertos }));
    chk('2. WhatsApp se abre en el navegador del computador (no otra ventana dentro de ORDEVA)', v2.n === 1 && v2.ab.some(u => /wa\.me/.test(u)), v2);

    // 3. Balanza / impresora por puerto serial: la página lo pide y el programa responde (sin aparatos: no hay)
    await app.evaluate(({ dialog }) => { global.__dlg = []; dialog.showMessageBox = (w, o) => { global.__dlg.push((o || w).message); return Promise.resolve({ response: 0 }); }; });
    const r3 = await w.evaluate(() => navigator.serial ? navigator.serial.requestPort().then(() => 'puerto', e => e.name) : 'sin-serial');
    const d3 = await app.evaluate(() => global.__dlg);
    // Con puertos en el equipo: sale la lista «Elige el aparato» y lo elegido le llega a la página. Sin puertos: el aviso.
    chk('3. Pedir la balanza/impresora (puerto serial) pasa por el programa: lista para elegir el aparato (o «No se encontró ningún aparato»)',
      (r3 === 'puerto' && d3.some(m => /Elige el aparato/.test(m))) || (r3 === 'NotFoundError' && d3.some(m => /No se encontró ningún aparato/.test(m))), { r3, d3 });
    if(r3 === 'puerto'){
      await app.evaluate(({ dialog }) => { dialog.showMessageBox = (w, o) => { global.__dlg.push((o || w).message); return Promise.resolve({ response: ((o || w).buttons || []).length - 1 }); }; });
      chk('3. «Cancelar» en la lista: la página no recibe ningún aparato', (await w.evaluate(() => navigator.serial.requestPort().then(() => 'puerto', e => e.name))) === 'NotFoundError');
    }
    chk('3. El permiso del puerto serial y del micrófono es solo para ORDEVA', await w.evaluate(() => navigator.permissions.query({ name: 'microphone' }).then(p => p.state !== 'denied', () => true)));

    // 4. Cerrar la ventana: sigue trabajando
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
    await new Promise(r => setTimeout(r, 800));
    const v4 = await app.evaluate(({ BrowserWindow }) => { const ws = BrowserWindow.getAllWindows(); return { n: ws.length, visible: ws.length ? ws[0].isVisible() : null }; });
    chk('4. Cerrar la ventana NO cierra el programa: queda trabajando junto al reloj (ventana escondida)', v4.n === 1 && v4.visible === false, v4);
    await app.evaluate(({ app }) => app.emit('second-instance'));
    await new Promise(r => setTimeout(r, 500));
    chk('4. Abrir ORDEVA otra vez trae la misma ventana (una sola copia del programa)', await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length === 1 && BrowserWindow.getAllWindows()[0].isVisible()));
    await app.evaluate(({ app }) => { app.emit('before-quit'); app.quit(); }).catch(() => {});
    await app.close().catch(() => {}); app = null;

    // 5. Sin conexión
    app = await abrir('http://127.0.0.1:9/');
    const w5 = await app.firstWindow();
    await w5.waitForTimeout(2500);
    const t5 = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.executeJavaScript('document.title + " | " + document.body.innerText'));
    chk('5. Sin conexión con ORDEVA → «📡 Sin conexión con ORDEVA» con «Reintentar»', /Sin conexión con ORDEVA/.test(t5) && /Reintentar/.test(t5), t5.slice(0, 160));
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  finally{ if(app) await app.close().catch(() => {}); }
  chk('Sin errores de página', !errs.length, errs);
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
