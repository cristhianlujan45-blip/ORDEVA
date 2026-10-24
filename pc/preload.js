// Vento para PC · lo único que la página ve del programa: que corre en el computador y su versión.
// (La página es la misma de siempre; el programa solo le da ventana propia, la balanza, la impresora y el cajón.)
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('ventoPC', {
  version: () => ipcRenderer.sendSync('vento-version'),
  plataforma: process.platform,
  inicioConWindows: (si) => ipcRenderer.invoke('vento-inicio', si),
  buscarActualizacion: () => ipcRenderer.invoke('vento-actualizar'),
  // Errores del programa mismo desde la última vez (se borran al leerlos): la página los manda a ORDEVA Admin.
  errores: () => ipcRenderer.sendSync('vento-errores')
});
