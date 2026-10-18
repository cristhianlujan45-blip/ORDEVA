# Vento para PC (Windows)

Programa de escritorio de Vento: abre la página de Vento en su propia ventana, con un icono en el Escritorio y en el
menú Inicio.

**Descarga:** https://github.com/cristhianlujan45-blip/cuentas/releases/download/pc/Vento-Setup.exe

## Qué hace
- **Siempre la última versión de Vento:** es la misma página de la app, así que lo nuevo llega solo.
- **Solo funciona conectado** a la base de datos de Vento. Sin internet muestra «📡 Sin conexión con Vento» y entra
  solo apenas vuelve.
- **Balanza, impresora de facturas y cajón de dinero** por puerto COM o USB. Cuando Vento pide un aparato, el programa
  muestra la lista de los conectados para elegirlo, y los recuerda.
- **Cerrar la ventana no lo cierra:** sigue junto al reloj, y los avisos de pagos y pedidos siguen sonando. Para
  cerrarlo del todo: icono de Vento junto al reloj → **Salir**.
  - En ese icono: «Abrir Vento al prender el computador» y «Buscar actualización del programa».
- **Micrófono, cámara y avisos** solo para la página de Vento.
- **Los enlaces de afuera** (WhatsApp, Google, bancos) se abren en el navegador del computador.
- **Se actualiza solo:** busca versiones nuevas en el release «pc» (`latest.yml`) y las instala al cerrar.

## Instalar
1. Descarga `Vento-Setup.exe` y ábrelo.
2. Si Windows dice **«Windows protegió su PC»**, toca **«Más información» → «Ejecutar de todas formas»**. Sale porque el
   instalador todavía no tiene firma digital de pago.
3. Sigue los pasos. Queda el icono **Vento** en el Escritorio.

## Cómo se arma
- **En GitHub:** `.github/workflows/pc.yml` lo compila en Windows (electron-builder, instalador NSIS) cada vez que
  cambia esta carpeta, y lo publica en el release «pc». Ese release nunca se marca como «latest», porque el enlace del
  APK de Android depende de eso.
- **En el equipo:**
  - `npm install && npm start` abre el programa;
  - `VENTO_PC_URL=http://localhost:8765/ npm start` lo abre con la copia local;
  - `npm run dist` arma el instalador (en Windows).
- **Prueba:** `pruebas/pc.test.js` abre el programa de verdad (Electron) y revisa la ventana, los enlaces, el puerto
  serial, que siga trabajando al cerrar la ventana y la pantalla sin conexión.
