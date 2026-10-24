/* =====================================================================
   Vento para PC (Windows) · programa de escritorio
   • Abre Vento en su propia ventana, siempre en la última versión (es la misma página de la app; se actualiza sola).
   • Funciona solo conectado a la base de datos de Vento: sin internet muestra «Sin conexión con Vento» y entra solo
     apenas vuelve.
   • Balanza, impresora de facturas y cajón de dinero por puerto COM / USB (Web Serial y WebUSB de Chrome): cuando la
     página pide un aparato, el programa muestra la lista de los conectados para elegirlo.
   • Sigue trabajando al cerrar la ventana (icono junto al reloj): los avisos de pagos y pedidos siguen sonando.
     «Salir» en ese icono lo cierra del todo. Puede abrirse solo al prender el computador.
   • Micrófono («Hola Vento», pedidos por voz), cámara (facturas, códigos) y avisos: solo para la página de Vento.
   • Los enlaces de afuera (WhatsApp, Google, bancos) se abren en el navegador del computador.
   • Se actualiza solo (el programa) desde las Descargas de Vento (release «pc»).
   ===================================================================== */
'use strict';
const { app, BrowserWindow, shell, session, Menu, Tray, dialog, nativeImage, ipcMain, Notification } = require('electron');
const path = require('path');

const URL_VENTO = 'https://cristhianlujan45-blip.github.io/ORDEVA/';   // 1.55.2: el repositorio ahora es ORDEVA (antes …/cuentas/)
const HOST_VENTO = 'cristhianlujan45-blip.github.io';
// Pruebas: VENTO_PC_URL=http://localhost:8765/ abre la copia local (solo para probar el programa).
const INICIO = process.env.VENTO_PC_URL || URL_VENTO;
const ORIGEN_PRUEBA = process.env.VENTO_PC_URL ? new URL(process.env.VENTO_PC_URL).origin : null;

let ventana = null, bandeja = null, saliendo = false, avisoFondo = false;

// ---------- 🐞 Errores del programa (no de la página) → ORDEVA Admin ----------
// Lo que falla en el programa mismo (un error suyo, la página que se cae) queda en un archivo; la página lo lee al abrir
// (ventoPC.errores) y lo manda a ORDEVA Admin → 🐞 Errores con su pila. Máximo 10. Nunca datos del negocio.
const fs = require('fs');
const archivoErrores = () => path.join(app.getPath('userData'), 'errores-programa.json');
function leerErrores(){ try{ const l = JSON.parse(fs.readFileSync(archivoErrores(), 'utf8')); return Array.isArray(l) ? l : []; }catch(e){ return []; } }
function anotarError(tipo, mensaje, pila){
  try{
    const l = leerErrores().slice(-9);
    l.push({ tipo, mensaje: String(mensaje || '').slice(0, 400), pila: String(pila || '').slice(0, 1500), app: app.getVersion(), so: process.platform + ' ' + (process.getSystemVersion ? process.getSystemVersion() : ''), t: Date.now() });
    fs.writeFileSync(archivoErrores(), JSON.stringify(l));
  }catch(e){}
}
process.on('uncaughtException', e => { anotarError('programa', e && e.message || String(e), e && e.stack); });
process.on('unhandledRejection', e => { anotarError('programa', e && e.message || String(e), e && e.stack); });
app.on('child-process-gone', (ev, d) => { if(d && d.reason !== 'clean-exit' && d.reason !== 'killed') anotarError('proceso', 'Se cayó una parte del programa (' + d.type + ': ' + d.reason + ')', 'código ' + d.exitCode); });
ipcMain.on('vento-errores', e => { const l = leerErrores(); try{ fs.unlinkSync(archivoErrores()); }catch(x){} e.returnValue = l; });

// 1.58.2: el programa se llama ORDEVA, pero sus datos siguen en la MISMA carpeta de siempre («Vento»): con otro nombre
// Electron buscaría una carpeta nueva y vacía y este computador parecería haber perdido lo guardado (sesión, datos).
// Va antes del «una sola copia», que también depende de esa carpeta.
try{ app.setPath('userData', path.join(app.getPath('appData'), 'Vento')); }catch(e){}
// Una sola copia del programa: abrirlo otra vez trae la ventana que ya está.
if(!app.requestSingleInstanceLock()){ app.quit(); }
app.on('second-instance', () => mostrar());
app.setAppUserModelId('co.vento.pc');   // avisos de Windows con el nombre «ORDEVA»

function esVento(u){
  try{
    const x = new URL(u);
    if(ORIGEN_PRUEBA && x.origin === ORIGEN_PRUEBA) return true;
    return x.protocol === 'https:' && x.hostname === HOST_VENTO && (x.pathname.startsWith('/ORDEVA') || x.pathname.startsWith('/cuentas'));
  }catch(e){ return false; }
}
const esOrigenVento = o => { try{ return esVento(String(o).replace(/\/?$/, '/ORDEVA/')) || esVento(o); }catch(e){ return false; } };

function mostrar(){
  if(!ventana) return crearVentana();
  if(ventana.isMinimized()) ventana.restore();
  ventana.show(); ventana.focus();
}

function crearVentana(){
  ventana = new BrowserWindow({
    width: 1280, height: 820, minWidth: 360, minHeight: 560, title: 'ORDEVA', show: false,
    icon: path.join(__dirname, 'icono.png'), backgroundColor: '#0b0a12', autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false,
      backgroundThrottling: false,   // con la ventana escondida los avisos y los relojes de la página siguen
      spellcheck: false
    }
  });
  // En Mac sin menú no funcionan Cmd+C / Cmd+V / Cmd+Z (copiar, pegar, deshacer) ni Cmd+Q: se deja el menú mínimo de Mac.
  // En Windows sigue sin menú, como siempre.
  Menu.setApplicationMenu(process.platform === 'darwin' ? Menu.buildFromTemplate([
    { label: 'ORDEVA', submenu: [{ role: 'about', label: 'Acerca de ORDEVA' }, { type: 'separator' }, { role: 'hide', label: 'Ocultar ORDEVA' }, { role: 'hideOthers', label: 'Ocultar otros' }, { type: 'separator' },
      { label: 'Salir de ORDEVA', accelerator: 'Command+Q', click: () => { saliendo = true; app.quit(); } }] },
    { label: 'Editar', submenu: [{ role: 'undo', label: 'Deshacer' }, { role: 'redo', label: 'Rehacer' }, { type: 'separator' }, { role: 'cut', label: 'Cortar' }, { role: 'copy', label: 'Copiar' }, { role: 'paste', label: 'Pegar' }, { role: 'selectAll', label: 'Seleccionar todo' }] },
    { label: 'Ver', submenu: [{ role: 'reload', label: 'Volver a cargar' }, { role: 'togglefullscreen', label: 'Pantalla completa' }, { role: 'resetZoom', label: 'Tamaño normal' }, { role: 'zoomIn', label: 'Más grande' }, { role: 'zoomOut', label: 'Más pequeño' }] },
    { label: 'Ventana', submenu: [{ role: 'minimize', label: 'Minimizar' }, { role: 'close', label: 'Cerrar ventana' }] }
  ]) : null);
  // La página sabe que corre en el programa de PC («🔎 Este equipo: Vento para PC»). Sigue diciendo que es Chrome:
  // no se esconde nada.
  ventana.webContents.setUserAgent(ventana.webContents.getUserAgent() + ' VentoPC/' + app.getVersion());
  // Al prender el computador abre escondido (sigue sonando junto al reloj). En Mac los «args» no llegan: se usa openAsHidden.
  const escondido = process.argv.includes('--escondido') || (process.platform === 'darwin' && (() => { try{ return app.getLoginItemSettings().wasOpenedAsHidden; }catch(e){ return false; } })());
  ventana.once('ready-to-show', () => { if(!escondido) ventana.show(); });
  ventana.loadURL(INICIO);

  // Enlaces: los de Vento se quedan en la ventana; los demás (WhatsApp, Google, bancos…) en el navegador.
  ventana.webContents.setWindowOpenHandler(({ url }) => {
    if(esVento(url)) ventana.loadURL(url);
    else if(/^(https?|mailto|tel|whatsapp):/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  ventana.webContents.on('will-navigate', (e, url) => {
    if(esVento(url) || url.startsWith('file:')) return;
    e.preventDefault();
    if(/^(https?|mailto|tel|whatsapp):/i.test(url)) shell.openExternal(url);
  });
  // Sin internet (o el servidor no responde): «Sin conexión con Vento», que vuelve sola a Vento al reconectar.
  ventana.webContents.on('did-fail-load', (e, codigo, desc, url, principal) => {
    if(principal && codigo !== -3) ventana.loadFile(path.join(__dirname, 'sin-internet.html'));
  });
  ventana.webContents.on('render-process-gone', (e, d) => {
    if(d && d.reason !== 'clean-exit') anotarError('pagina', 'La página de ORDEVA se cayó en el programa (' + (d.reason || '') + ')', 'código ' + (d.exitCode != null ? d.exitCode : ''));
    setTimeout(() => { if(ventana) ventana.loadURL(INICIO); }, 1000);
  });

  // Cerrar la ventana = sigue trabajando junto al reloj (como la app Android). «Salir» lo cierra del todo.
  ventana.on('close', e => {
    if(saliendo || !bandeja) return;
    e.preventDefault(); ventana.hide();
    if(!avisoFondo){
      avisoFondo = true;
      try{ new Notification({ title: 'ORDEVA sigue trabajando', body: 'Los avisos de pagos y pedidos siguen sonando. Para cerrarlo del todo: icono de ORDEVA junto al reloj → Salir.', icon: path.join(__dirname, 'icono.png') }).show(); }catch(x){}
    }
  });
  ventana.on('closed', () => { ventana = null; });
}

// ---------- Permisos: solo la página de Vento ----------
const PERMISOS = ['media', 'notifications', 'clipboard-read', 'clipboard-sanitized-write', 'fullscreen', 'serial', 'usb', 'hid', 'geolocation', 'idle-detection', 'speaker-selection'];
function permisos(){
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((wc, permiso, listo, det) => listo(PERMISOS.includes(permiso) && esVento((det && det.requestingUrl) || wc.getURL())));
  ses.setPermissionCheckHandler((wc, permiso, origen) => PERMISOS.includes(permiso) && (esOrigenVento(origen) || (wc && esVento(wc.getURL()))));
  // Aparatos ya elegidos (balanza, impresora, cajón): Vento los vuelve a usar sin preguntar al abrir.
  ses.setDevicePermissionHandler(d => esOrigenVento(d.origin));
  ses.setUSBProtectedClassesHandler && ses.setUSBProtectedClassesHandler(d => d.protectedClasses.filter(c => c !== 'printer'));

  // La página pide un aparato (navigator.serial.requestPort / navigator.usb.requestDevice): lista para elegir.
  ses.on('select-serial-port', (event, puertos, wc, listo) => {
    event.preventDefault();
    elegir('⚖️🧾 Elige el aparato (puerto COM / USB)', puertos.map(p => ({ id: p.portId, nombre: (p.displayName || p.portName || 'Puerto') + (p.portName && p.displayName ? ' (' + p.portName + ')' : '') })), listo);
  });
  ses.on('select-usb-device', (event, det, listo) => {
    event.preventDefault();
    elegir('🧾 Elige la impresora o el aparato USB', (det.deviceList || []).map(d => ({ id: d.deviceId, nombre: (d.productName || 'Aparato USB') + (d.manufacturerName ? ' · ' + d.manufacturerName : '') })), listo);
  });
  ses.on('select-hid-device', (event, det, listo) => {
    event.preventDefault();
    elegir('⚖️ Elige el aparato', (det.deviceList || []).map(d => ({ id: d.deviceId, nombre: d.name || 'Aparato' })), listo);
  });
}
function elegir(titulo, lista, listo){
  if(!lista.length){
    dialog.showMessageBox(ventana, { type: 'info', title: 'ORDEVA', message: 'No se encontró ningún aparato conectado.', detail: 'Conecta la balanza, la impresora o el cajón por USB (o el adaptador USB-serial), espera unos segundos y vuelve a intentar. Si es nuevo, instala primero el controlador que trae.' }).catch(() => {});
    return listo('');
  }
  const botones = lista.slice(0, 8).map(x => x.nombre).concat(['Cancelar']);
  dialog.showMessageBox(ventana, { type: 'question', title: 'ORDEVA', message: titulo, buttons: botones, cancelId: botones.length - 1, noLink: true })
    .then(r => listo(r.response < lista.length ? lista[r.response].id : '')).catch(() => listo(''));
}

// ---------- Icono junto al reloj ----------
function crearBandeja(){
  try{
    bandeja = new Tray(nativeImage.createFromPath(path.join(__dirname, 'icono.png')).resize({ width: 16, height: 16 }));
  }catch(e){ bandeja = null; return; }
  bandeja.setToolTip('ORDEVA');
  const menu = () => Menu.buildFromTemplate([
    { label: 'Abrir ORDEVA', click: mostrar },
    { type: 'separator' },
    { label: 'Abrir ORDEVA al prender el computador', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin,
      click: it => { app.setLoginItemSettings({ openAtLogin: it.checked, openAsHidden: true, args: ['--escondido'] }); } },
    { label: 'Buscar actualización del programa', click: () => actualizar(true) },
    { type: 'separator' },
    { label: 'Salir', click: () => { saliendo = true; app.quit(); } }
  ]);
  bandeja.setContextMenu(menu());
  bandeja.on('click', mostrar);
  bandeja.on('right-click', () => bandeja.setContextMenu(menu()));
}

// ---------- Actualización del programa ----------
let actualizador = null;
function actualizar(aMano){
  if(!app.isPackaged || process.env.VENTO_PC_URL) return Promise.resolve(false);
  // En Mac el programa no va firmado por Apple, y así la actualización sola no se puede instalar: se baja a mano.
  // (La página de ORDEVA, que es casi todo, se actualiza sola igual que en Windows.)
  if(process.platform === 'darwin'){
    if(aMano) dialog.showMessageBox(ventana, { type: 'info', title: 'ORDEVA', message: 'Tienes ORDEVA para Mac ' + app.getVersion() + '.', detail: 'Las versiones nuevas del programa para Mac se descargan de la página de ORDEVA para PC (ORDEVA-Mac.dmg). Lo de adentro de ORDEVA ya se actualiza solo.', buttons: ['Abrir la descarga', 'Cerrar'], cancelId: 1 })
      .then(r => { if(r.response === 0) shell.openExternal('https://github.com/cristhianlujan45-blip/ORDEVA/releases/tag/pc'); }).catch(() => {});
    return Promise.resolve(false);
  }
  try{ if(!actualizador){ actualizador = require('electron-updater').autoUpdater; actualizador.autoDownload = true; actualizador.autoInstallOnAppQuit = true;
    actualizador.on('update-downloaded', i => {
      dialog.showMessageBox(ventana, { type: 'info', title: 'ORDEVA', message: 'Hay una versión nueva del programa ORDEVA (' + i.version + ').', detail: 'Se instala al cerrar ORDEVA, o ahora mismo.', buttons: ['Instalar ahora', 'Después'], cancelId: 1 })
        .then(r => { if(r.response === 0){ saliendo = true; actualizador.quitAndInstall(); } }).catch(() => {});
    }); } }
  catch(e){ return Promise.resolve(false); }
  return actualizador.checkForUpdates().then(r => {
    if(aMano && (!r || !r.updateInfo || r.updateInfo.version === app.getVersion())) dialog.showMessageBox(ventana, { type: 'info', title: 'ORDEVA', message: 'Tienes la última versión del programa (' + app.getVersion() + ').' }).catch(() => {});
    return true;
  }).catch(() => { if(aMano) dialog.showMessageBox(ventana, { type: 'warning', title: 'ORDEVA', message: 'No se pudo buscar la actualización. Revisa el internet.' }).catch(() => {}); return false; });
}

ipcMain.on('vento-version', e => { e.returnValue = app.getVersion(); });
ipcMain.handle('vento-inicio', (e, si) => { app.setLoginItemSettings({ openAtLogin: !!si, openAsHidden: true, args: ['--escondido'] }); return app.getLoginItemSettings().openAtLogin; });
ipcMain.handle('vento-actualizar', () => actualizar(true));

app.whenReady().then(() => {
  permisos();
  crearBandeja();
  crearVentana();
  setTimeout(() => actualizar(false), 15000);
  setInterval(() => actualizar(false), 6 * 3600e3);
});
app.on('window-all-closed', () => { if(!bandeja || saliendo) app.quit(); });
app.on('before-quit', () => { saliendo = true; });
app.on('activate', mostrar);
