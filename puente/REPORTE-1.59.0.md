# ORDEVA 1.59.0 · Reporte de errores al Admin, abrir más rápido, iPhone y Mac afinados, programa de PC al día

La auditoría completa, con lo que falta y lo que necesita de ti, está en `puente/AUDITORIA-1.59.0.md`.

## 1. 🐞 Errores al Admin con su código y su explicación
- **«🐞 Reportar un problema»**: está en Más y en Ajustes → Guía y soporte.
  - La persona escribe qué pasó y puede agregar un pantallazo.
  - Llega a ORDEVA Admin → 🐞 Errores («📝 Reportado por el cliente») con los códigos E-XXXX de los errores que tuvo
    ese equipo justo antes.
  - También queda como caso de soporte.
- **Llegan solos también:**
  - los cierres de la app Android y la página que Android cerró por falta de memoria;
  - los errores del programa de PC y Mac;
  - los del propio panel Admin.
- **En cada error del Admin:**
  - 🧠 Qué significa;
  - 📍 Dónde (archivo, línea y función);
  - **📋 Copiar para arreglar**: código, mensaje, explicación, pila y equipos en un solo texto;
  - filtros nuevos;
  - el equipo claro (iPhone, iPad, Mac, PC, app Android…).
- **Probado** con la base de datos y el servidor reales: `erroresreal` 30/30.

## 2. Abre más rápido
- La app estaba toda dentro de `index.html` (2,5 MB). Ahora son 30 archivos en `app/`, en el mismo orden y **sin
  cambiar el código**.
- **Medido** con un celular de gama media simulado:
  - lista en **1,25 s en vez de 1,85 s**;
  - el trabajo al abrir baja de 1,0 s a 0,65 s.
- **Cada archivo lleva la versión**, así nunca se mezcla un archivo viejo con uno nuevo. Lo revisa
  `pruebas/modulos.test.js`, que también compara la versión del panel Admin.
- **La imagen del recibo (html2canvas)** ya no frena la app.

## 3. Comprobantes (pantallazos)
- El lector queda cargado mientras está abierta la cuenta de una mesa (y la pantalla está quieta).
- Si el pantallazo no dice «¿Cuánto?» / «Valor» junto al valor y hay internet, **también lo lee la IA del negocio**.
  - Sale marcado 🤖.
  - Solo se registra si coincide con un pago que de verdad llegó. La IA nunca da un pago por recibido.
- **Prueba:** `comprobantepantallazo` 29/29.

## 4. iPhone, Mac, Windows, Android
- **iPhone:**
  - revisión automática de todo el código contra Safari 15.4–16.3 (`pruebas/iphone.test.js`);
  - colores mezclados calculados en iOS 15/16.0–16.1;
  - guía de instalación en iPhone;
  - prueba con el motor de Safari (WebKit) en GitHub (`pruebas/safari.test.js`).
- **Mac:**
  - Cmd+C, Cmd+V, Cmd+Z y Cmd+Q funcionan (menú mínimo de Mac);
  - abre escondido al prender el computador.
- **Windows y Mac:** el motor del programa pasa de **Electron 33** (sin arreglos de seguridad) a **44.9.3**. `pc` 14/14
  con el programa de verdad.
- **Android:**
  - los cierres llegan al Admin;
  - la página de descargas dice «ORDEVA para Android».
- **GitHub:** los talleres de Android y PC solo publican desde la rama principal.

## 5. Arreglo
- **ORDEVA Admin tenía su versión atrasada** (1.58.2) y por eso pedía «Actualizar» todo el tiempo.
- Ahora es 1.59.0, y la prueba de módulos revisa que no vuelva a pasar.
