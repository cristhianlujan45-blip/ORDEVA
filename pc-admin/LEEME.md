# ORDEVA Admin para PC (Windows)

Programa de escritorio del **proveedor** de ORDEVA: abre el panel de administración (`admin.html`) en su propia
ventana, con un icono **ORDEVA Admin** en el Escritorio y en el menú Inicio. Es el mismo panel de la web y de la app
Android de Administrador (`vento-admin.apk`); para entrar sigue pidiendo el correo, la contraseña y el código personal.

**Descarga:** https://github.com/cristhianlujan45-blip/ORDEVA/releases/download/admin-pc/ORDEVA-Admin-Setup.exe

**Sin instalar nada (web):** https://cristhianlujan45-blip.github.io/ORDEVA/admin.html — en Chrome o Edge, menú ⋮ →
«Instalar ORDEVA Admin» lo deja como aplicación con su propio icono (`admin.webmanifest`).

## Qué hace
- **Siempre la última versión del panel:** es la misma página de la web, así que lo nuevo llega solo.
- **Avisos de soporte y pagos** como notificaciones de Windows (`window.VentoAdmin.notificar`, igual que la app Android).
- **Respaldos y archivos** que baja el panel: Windows pregunta dónde guardarlos (`window.VentoAdmin.guardar`).
- **Cerrar la ventana no lo cierra:** sigue junto al reloj y los avisos siguen llegando. Para cerrarlo del todo: icono
  junto al reloj → **Salir**. Ahí también: «Abrir al prender el computador» y «Buscar actualización del programa».
- **Los enlaces de afuera** (WhatsApp, GitHub, el APK) se abren en el navegador del computador.
- **Sus datos van aparte** de ORDEVA para PC (carpeta «ORDEVA Admin»): los dos programas pueden estar instalados a la vez.
- **Se actualiza solo:** busca versiones nuevas en el release «admin-pc» (`latest.yml`) y las instala al cerrar.

## Instalar
1. Descarga `ORDEVA-Admin-Setup.exe` y ábrelo.
2. Si Windows dice **«Windows protegió su PC»**, toca **«Más información» → «Ejecutar de todas formas»** (el instalador
   todavía no tiene firma digital de pago).
3. Sigue los pasos. Queda el icono **ORDEVA Admin** en el Escritorio.

## Cómo se arma
- **En GitHub:** `.github/workflows/admin-pc.yml` lo compila en Windows (electron-builder, instalador NSIS) cada vez que
  cambia esta carpeta en la rama principal, y lo publica en el release «admin-pc» (nunca marcado como «latest»).
- **En el equipo:**
  - `npm install && npm start` abre el programa;
  - `VENTO_ADMIN_URL=http://localhost:8765/admin.html npm start` lo abre con la copia local;
  - `npm run dist` arma el instalador (en Windows; en Linux necesita `wine` y `wine32`).
- **Prueba:** `pruebas/pcadmin.test.js` abre el programa de verdad (Electron) y revisa la ventana, los avisos, guardar
  archivos, los enlaces, que siga abierto al cerrar la ventana y la pantalla sin conexión.
