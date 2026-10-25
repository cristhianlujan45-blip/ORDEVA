// ORDEVA Admin para PC · lo único que el panel ve del programa: los mismos dos puentes que la app Android de
// Administrador (avisos y guardar archivos) y la versión del programa.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('VentoAdmin', {
  notificar: (titulo, cuerpo, tag) => ipcRenderer.send('admin-notificar', String(titulo || ''), String(cuerpo || ''), String(tag || '')),
  guardar: (nombre, tipo, texto) => { ipcRenderer.invoke('admin-guardar', String(nombre || ''), String(tipo || ''), String(texto || '')); },
  version: () => ipcRenderer.sendSync('admin-version'),
  plataforma: process.platform
});
