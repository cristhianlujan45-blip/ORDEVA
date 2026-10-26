# ORDEVA 1.65.0 · 📱 El celular como lector de códigos (inalámbrico o por cable)

## Qué se pidió
Conectar el celular al programa de PC (y a la app) por cable o inalámbrico para escanear códigos QR con su cámara.

## Qué quedó
En la ventana **🔳 Escanear código** (mesa, Venta rápida, caja del modo fácil, Productos, Inventario por código, editar
producto, facturas) hay tres maneras de leer:

1. **La cámara del propio equipo**, ahora también en el programa de PC en Windows y en iPhone. Antes decía «Tu navegador
   no soporta lectura de códigos» porque esos equipos no traen `BarcodeDetector`. Ahora se carga ZXing
   (`lib/zxing/`, barcode-detector 3.2.3 + zxing-wasm 3.1.6, MIT) desde el mismo sitio, solo cuando hace falta
   (`lib/vento-codigos.js`). Lee QR y códigos de barras (EAN, UPC, Code 128, Code 39, ITF, Codabar).
2. **📱 Celular inalámbrico** (`lib/vento-lector-cel.js` + `lector.html`): «Usar el celular como lector» muestra un QR.
   Se escanea una vez con el celular y abre el lector. Lo que lee la cámara del celular llega al equipo por un canal
   del servidor de ORDEVA. Sirve con wifi o datos, sin estar en la misma red. El emparejamiento queda guardado.
   - El celular muestra si el computador está escaneando y «✅ recibido» por cada código.
   - Si el computador no está escaneando, el código **no** se manda (ni se suma después).
   - Se puede escribir el código a mano. Hay linterna y cambio de cámara.
   - «🔄 Desconectar celulares» cambia el código: los celulares viejos dejan de mandar.
   - El QR de emparejar también se puede leer con «📷 Escanear» de ORDEVA en el celular: abre ahí el lector.
3. **🔌 Celular por cable USB**: Android 14 o más trae el modo *Cámara web* por USB (también DroidCam o Iriun). El
   computador lo ve como una cámara. Con más de una cámara sale «📷 Cámara» para elegirla, y queda recordada.

## Pruebas
- `pruebas/lectorcel.test.js` (18 ✅): computador y celular con cámaras de mentira que muestran un EAN-13 y un QR de
  verdad. El Chrome de Linux no trae lector, así que pasa por ZXing, igual que en Windows. Recorre: emparejar → leer
  en el celular → llega al computador → ✅ en el celular, más los casos de «Escanear» cerrado, desconectar y QR leído
  desde ORDEVA. El servidor de canales se simula en la prueba.
- Siguen bien: cajaqr, facturascan, facil, cajapos, iphone, hola, modulos, mejoras, abririnstante, vistasencilla.

## Lo que no se pudo probar
- Un celular y un computador de verdad: la velocidad real del canal. Con el aviso al instante (Realtime) llega casi
  de una; sin él, el canal revisa cada 2,5 s.
- El modo *Cámara web* por USB de Android con el programa de PC en Windows. Usa la cámara normal del navegador, así
  que debería salir en la lista como cualquier cámara web, pero no se probó con el aparato.
- ZXing en iPhone (Safari) dentro de lector.html: se probó en Chrome sin lector propio, que es el mismo camino.
