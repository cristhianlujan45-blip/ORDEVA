/* =====================================================================
   ORDEVA Admin para PC (Windows) · programa de escritorio del PROVEEDOR
   • Abre el panel de administración (admin.html) en su propia ventana, siempre en la última versión (es la misma
     página de la web; se actualiza sola). Sigue pidiendo el correo, la contraseña y el código personal para entrar.
   • Avisos de soporte y pagos con notificaciones de Windows (window.VentoAdmin.notificar, igual que la app Android).
   • Respaldos y archivos que baja el panel: Windows pregunta dónde guardarlos (window.VentoAdmin.guardar).
   • Sigue trabajando al cerrar la ventana (icono junto al reloj): los avisos siguen llegando. «Salir» lo cierra.
   • Los enlaces de afuera (WhatsApp, GitHub, el APK) se abren en el navegador del computador.
   • Se actualiza solo (el programa) desde las Descargas de ORDEVA (release «admin-pc»).
   ===================================================================== */
'use strict';
const { app, BrowserWindow, shell, session, Menu, Tray, dialog, nativeImage, ipcMain, Notification } = require('electron');
const path = require('path');
const fs = require('fs');

const URL_ADMIN = 'https://cristhianlujan45-blip.github.io/ORDEVA/admin.html';
const HOST_VENTO = 'cristhianlujan45-blip.github.io';
// Pruebas: VENTO_ADMIN_URL=http://localhost:8765/admin.html abre la copia local (solo para probar el programa).
const INICIO = process.env.VENTO_ADMIN_URL || URL_ADMIN;
const ORIGEN_PRUEBA = process.env.VENTO_ADMIN_URL ? new URL(process.env.VENTO_ADMIN_URL).origin : null;
const ICONO = path.join(__dirname, 'icono.png');

let ventana = null, bandeja = null, saliendo = false, avisoFondo = false;

// Datos propios (sesión, llave de firma guardada, clientes): carpeta aparte de la de ORDEVA para PC.
try{ app.setPath('userData', path.join(app.getPath('appData'), 'ORDEVA Admin')); }catch(e){}
if(!app.requestSingleInstanceLock()){ app.quit(); }
app.on('second-instance', () => mostrar());
app.setAppUserModelId('co.vento.admin.pc');   // notificaciones de Windows con el nombre «ORDEVA Admin»

function esVento(u){
  try{
    const x = new URL(u);
    if(ORIGEN_PRUEBA && x.origin === ORIGEN_PRUEBA) return true;
    return x.protocol === 'https:' && x.hostname === HOST_VENTO && x.pathname.startsWith('/ORDEVA/');
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
    width: 1280, height: 860, minWidth: 360, minHeight: 560, title: 'ORDEVA Admin', show: false,
    icon: ICONO, backgroundColor: '#0f0f16', autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false,
      backgroundThrottling: false,   // con la ventana escondida el panel sigue escuchando los mensajes de soporte
      spellcheck: true
    }
  });
  Menu.setApplicationMenu(null);
  ventana.webContents.setUserAgent(ventana.webContents.getUserAgent() + ' VentoAdminPC/' + app.getVersion());
  const escondido = process.argv.includes('--escondido');
  ventana.once('ready-to-show', () => { if(!escondido) ventana.show(); });
  ventana.loadURL(INICIO);

  // Enlaces: los del panel se quedan en la ventana; los demás (WhatsApp, GitHub, imágenes firmadas…) en el navegador.
  ventana.webContents.setWindowOpenHandler(({ url }) => {
    if(esVento(url) && /\/admin\.html/.test(new URL(url).pathname)) ventana.loadURL(url);
    else if(/^(https?|mailto|tel|sms|whatsapp):/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  ventana.webContents.on('will-navigate', (e, url) => {
    if(esVento(url) || url.startsWith('file:')) return;
    e.preventDefault();
    if(/^(https?|mailto|tel|sms|whatsapp):/i.test(url)) shell.openExternal(url);
  });
  // Sin internet: «Sin conexión», que vuelve sola al panel al reconectar.
  ventana.webContents.on('did-fail-load', (e, codigo, desc, url, principal) => {
    if(principal && codigo !== -3) ventana.loadFile(path.join(__dirname, 'sin-internet.html'));
  });
  ventana.webContents.on('render-process-gone', () => { setTimeout(() => { if(ventana) ventana.loadURL(INICIO); }, 1000); });

  // Cerrar la ventana = sigue junto al reloj (los avisos de soporte siguen llegando). «Salir» lo cierra del todo.
  ventana.on('close', e => {
    if(saliendo || !bandeja) return;
    e.preventDefault(); ventana.hide();
    if(!avisoFondo){
      avisoFondo = true;
      try{ new Notification({ title: 'ORDEVA Admin sigue abierto', body: 'Los avisos de soporte y pagos siguen llegando. Para cerrarlo del todo: icono junto al reloj → Salir.', icon: ICONO }).show(); }catch(x){}
    }
  });
  ventana.on('closed', () => { ventana = null; });
}

// ---------- Permisos: solo el panel de ORDEVA ----------
const PERMISOS = ['notifications', 'clipboard-read', 'clipboard-sanitized-write', 'fullscreen', 'media'];
function permisos(){
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((wc, permiso, listo, det) => listo(PERMISOS.includes(permiso) && esVento((det && det.requestingUrl) || wc.getURL())));
  ses.setPermissionCheckHandler((wc, permiso, origen) => PERMISOS.includes(permiso) && (esOrigenVento(origen) || (wc && esVento(wc.getURL()))));
}

// ---------- Lo que la página le pide al programa (preload.js → window.VentoAdmin) ----------
// Solo responde a la página del panel (no a otra que se hubiera abierto por error en la ventana).
const delPanel = e => { try{ return esVento(e.senderFrame ? e.senderFrame.url : e.sender.getURL()); }catch(x){ return false; } };
ipcMain.on('admin-notificar', (e, titulo, cuerpo, tag) => {
  if(!delPanel(e) || !Notification.isSupported()) return;
  try{
    const n = new Notification({ title: String(titulo || 'ORDEVA Admin').slice(0, 120), body: String(cuerpo || '').slice(0, 400), icon: ICONO });
    n.on('click', () => { mostrar(); if(ventana && tag && /^sp|soporte/.test(String(tag))) ventana.webContents.executeJavaScript("location.hash='soporte'").catch(() => {}); });
    n.show();
  }catch(x){}
});
ipcMain.handle('admin-guardar', async (e, nombre, tipo, texto) => {
  if(!delPanel(e) || typeof texto !== 'string') return false;
  const sugerido = String(nombre || 'ordeva-admin.json').replace(/[\\/:*?"<>|]/g, '-').slice(0, 120);
  const r = await dialog.showSaveDialog(ventana, { title: 'Guardar', defaultPath: path.join(app.getPath('downloads'), sugerido) });
  if(r.canceled || !r.filePath) return false;
  fs.writeFileSync(r.filePath, texto, 'utf8');
  return true;
});
ipcMain.on('admin-version', e => { e.returnValue = app.getVersion(); });

// ---------- Icono junto al reloj ----------
function crearBandeja(){
  try{ bandeja = new Tray(nativeImage.createFromPath(ICONO).resize({ width: 16, height: 16 })); }
  catch(e){ bandeja = null; return; }
  bandeja.setToolTip('ORDEVA Admin');
  const menu = () => Menu.buildFromTemplate([
    { label: 'Abrir ORDEVA Admin', click: mostrar },
    { type: 'separator' },
    { label: 'Abrir al prender el computador', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin,
      click: it => { app.setLoginItemSettings({ openAtLogin: it.checked, openAsHidden: true, args: ['--escondido'] }); } },
    { label: 'Buscar actualización del programa', click: () => actualizar(true) },
    { type: 'separator' },
    { label: 'Salir', click: () => { saliendo = true; app.quit(); } }
  ]);
  bandeja.setContextMenu(menu());
  bandeja.on('click', mostrar);
  bandeja.on('right-click', () => bandeja.setContextMenu(menu()));
}

// ---------- Actualización del programa (release «admin-pc») ----------
let actualizador = null;
function actualizar(aMano){
  if(!app.isPackaged || process.env.VENTO_ADMIN_URL) return Promise.resolve(false);
  try{ if(!actualizador){ actualizador = require('electron-updater').autoUpdater; actualizador.autoDownload = true; actualizador.autoInstallOnAppQuit = true;
    actualizador.on('update-downloaded', i => {
      dialog.showMessageBox(ventana, { type: 'info', title: 'ORDEVA Admin', message: 'Hay una versión nueva del programa ORDEVA Admin (' + i.version + ').', detail: 'Se instala al cerrarlo, o ahora mismo.', buttons: ['Instalar ahora', 'Después'], cancelId: 1 })
        .then(r => { if(r.response === 0){ saliendo = true; actualizador.quitAndInstall(); } }).catch(() => {});
    }); } }
  catch(e){ return Promise.resolve(false); }
  return actualizador.checkForUpdates().then(r => {
    if(aMano && (!r || !r.updateInfo || r.updateInfo.version === app.getVersion())) dialog.showMessageBox(ventana, { type: 'info', title: 'ORDEVA Admin', message: 'Tienes la última versión del programa (' + app.getVersion() + ').' }).catch(() => {});
    return true;
  }).catch(() => { if(aMano) dialog.showMessageBox(ventana, { type: 'warning', title: 'ORDEVA Admin', message: 'No se pudo buscar la actualización. Revisa el internet.' }).catch(() => {}); return false; });
}

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
