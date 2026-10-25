// ORDEVA Admin para PC (programa de escritorio, carpeta pc-admin/): se abre el programa DE VERDAD (Electron) con la copia
// local del panel y se revisa:
//  1. Abre ORDEVA Admin (admin.html) en su ventana, con «VentoAdminPC/<versión>» y window.VentoAdmin para el panel.
//  2. Los avisos del panel (VentoAdmin.notificar) salen como notificación de Windows; «guardar» pregunta dónde.
//  3. Los enlaces de afuera (WhatsApp, GitHub…) no abren ventanas dentro del programa (van al navegador).
//  4. Cerrar la ventana NO cierra el programa: sigue junto al reloj (los avisos de soporte siguen llegando).
//  5. Sin conexión → «📡 Sin conexión con ORDEVA».
// Necesita Electron (pc-admin/node_modules o ELECTRON_PATH); sin él se omite.
const { _electron } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
const ADMIN = path.join(__dirname, '..', 'pc-admin');
const exe = process.env.ELECTRON_PATH || [path.join(ADMIN, 'node_modules', 'electron', 'dist', 'electron')].find(f => fs.existsSync(f));

// Linux sin pantalla (servidor de pruebas): se vuelve a correr dentro de xvfb-run (pantalla virtual) si está.
if(exe && process.platform === 'linux' && !process.env.DISPLAY && !process.env.VENTO_PC_XVFB){
  const { spawnSync } = require('child_process');
  const r = spawnSync('xvfb-run', ['-a', process.execPath, __filename], { stdio: 'inherit', env: Object.assign({}, process.env, { VENTO_PC_XVFB: '1' }) });
  if(!r.error) process.exit(r.status == null ? 1 : r.status);
}
(async () => {
  if(!exe){ console.log('ℹ️ Sin Electron en este equipo: se omite (cd pc-admin && npm install, o ELECTRON_PATH).'); console.log('RESULTADO 0 bien 0 mal'); process.exit(0); }
  let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x) : '')); } };
  const abrir = url => _electron.launch({ executablePath: exe, args: [ADMIN, '--no-sandbox'], env: Object.assign({}, process.env, { VENTO_ADMIN_URL: url, ELECTRON_DISABLE_SECURITY_WARNINGS: '1' }) });
  let app = null;
  try{
    app = await abrir(BASE + '/admin.html');
    const w = await app.firstWindow();
    w.on('pageerror', e => errs.push(e.message));
    await w.waitForLoadState('domcontentloaded'); await w.waitForTimeout(1500);
    const titulo = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getTitle());
    chk('1. Abre el panel ORDEVA Admin (admin.html) en su propia ventana', /\/admin\.html/.test(w.url()) && /ORDEVA Admin/.test(titulo), { url: w.url(), titulo });
    const ud = await app.evaluate(({ app }) => app.getPath('userData'));
    chk('1. Sus datos van en su propia carpeta («ORDEVA Admin»), aparte de ORDEVA para PC', /[\\/]ORDEVA Admin$/.test(ud), ud);
    const ua = await w.evaluate(() => navigator.userAgent);
    chk('1. El navegador dice «VentoAdminPC/<versión>»', /VentoAdminPC\/\d+\.\d+\.\d+/.test(ua) && /Chrome\//.test(ua), ua);
    const va = await w.evaluate(() => window.VentoAdmin ? { n: typeof VentoAdmin.notificar, g: typeof VentoAdmin.guardar, v: VentoAdmin.version() } : null);
    chk('1. window.VentoAdmin: notificar, guardar y versión (los mismos puentes que la app Android)', va && va.n === 'function' && va.g === 'function' && /^\d+\.\d+\.\d+$/.test(va.v), va);
    chk('1. La página NO tiene acceso a Node (seguro)', await w.evaluate(() => typeof require === 'undefined' && typeof process === 'undefined'));

    // 2. Avisos y guardar
    await app.evaluate(({ ipcMain }) => {
      global.__avisos = [];
      ipcMain.removeAllListeners('admin-notificar');
      ipcMain.on('admin-notificar', (e, t, c, tag) => global.__avisos.push([t, c, tag]));
    });
    await w.evaluate(() => VentoAdmin.notificar('💬 Mensaje de soporte', 'Bar X: ayuda con la caja', 'soporte'));
    await w.waitForTimeout(300);
    const av = await app.evaluate(() => global.__avisos);
    chk('2. VentoAdmin.notificar llega al programa (notificación de Windows)', av.length === 1 && av[0][0] === '💬 Mensaje de soporte' && av[0][2] === 'soporte', av);
    const destino = path.join(os.tmpdir(), 'ordeva-admin-prueba-' + process.pid + '.json');
    await app.evaluate(({ dialog }, d) => { dialog.showSaveDialog = () => Promise.resolve({ canceled: false, filePath: d }); }, destino);
    await w.evaluate(() => VentoAdmin.guardar('respaldo.json', 'application/json', '{"clientes":[]}'));
    await w.waitForTimeout(500);
    const guardado = fs.existsSync(destino) ? fs.readFileSync(destino, 'utf8') : null;
    chk('2. VentoAdmin.guardar pregunta dónde y guarda el archivo', guardado === '{"clientes":[]}', guardado);
    try{ fs.unlinkSync(destino); }catch(e){}

    // 3. Enlaces de afuera
    await app.evaluate(({ shell }) => { global.__abiertos = []; shell.openExternal = u => { global.__abiertos.push(u); return Promise.resolve(); }; });
    await w.evaluate(() => { window.open('https://wa.me/573001234567?text=hola', '_blank'); });
    await w.waitForTimeout(500);
    const v3 = await app.evaluate(({ BrowserWindow }) => ({ n: BrowserWindow.getAllWindows().length, ab: global.__abiertos }));
    chk('3. WhatsApp se abre en el navegador del computador (no otra ventana dentro del programa)', v3.n === 1 && v3.ab.some(u => /wa\.me/.test(u)), v3);

    // 4. Cerrar la ventana: sigue junto al reloj
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
    let v4 = null;
    for(let i = 0; i < 15; i++){
      await new Promise(r => setTimeout(r, 200));
      v4 = await app.evaluate(({ BrowserWindow }) => { const ws = BrowserWindow.getAllWindows(); return { n: ws.length, visible: ws.length ? ws[0].isVisible() : null }; });
      if(v4.visible === false) break;
    }
    chk('4. Cerrar la ventana NO cierra el programa: queda junto al reloj (ventana escondida)', v4.n === 1 && v4.visible === false, v4);
    await app.evaluate(({ app }) => app.emit('second-instance'));
    await new Promise(r => setTimeout(r, 500));
    chk('4. Abrirlo otra vez trae la misma ventana (una sola copia del programa)', await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length === 1 && BrowserWindow.getAllWindows()[0].isVisible()));
    await app.evaluate(({ app }) => { app.emit('before-quit'); app.quit(); }).catch(() => {});
    await app.close().catch(() => {}); app = null;

    // 5. Sin conexión
    app = await abrir('http://127.0.0.1:9/admin.html');
    const w5 = await app.firstWindow();
    await w5.waitForTimeout(2500);
    const t5 = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.executeJavaScript('document.title + " | " + document.body.innerText'));
    chk('5. Sin conexión → «📡 Sin conexión con ORDEVA» con «Reintentar»', /Sin conexión con ORDEVA/.test(t5) && /Reintentar/.test(t5), t5.slice(0, 160));
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  finally{ if(app) await app.close().catch(() => {}); }
  chk('Sin errores de página', !errs.length, errs);
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
