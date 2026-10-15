# Vento 1.38.2 — Cada pago suena («Pago confirmado. 200 pesos desde DaviPlata»), también en segundo plano, y la música del panel de YouTube sí suena

# A. Pagos: sonaba el primero y el siguiente no

## Por qué no sonaba
1. **Dos pagos iguales se tomaban como uno.** El aviso de la app Android se reconocía por su texto. Si llegaba otro pago
   del mismo valor y la misma persona, era «el mismo aviso» y no se registraba ni sonaba.
2. **Un pago enlazado al servidor se comía el siguiente.** Cuando el Servidor Vento enlazaba el primer pago, durante 3
   minutos cualquier otro pago del mismo valor por la misma app se tomaba como repetido.
3. **El servidor también los juntaba,** y además no entendía DaviPlata cuando escribe de «usted» («¡Le llegó plata!»,
   «Le pasó», «Recibió»). Por eso los demás celulares del negocio no se enteraban.
4. **Avisos agrupados.** Cuando la app del banco junta varios avisos («2 mensajes nuevos»), solo se leía el resumen.
5. **La voz dependía de la página.** Con la app minimizada o la pantalla apagada podía no decirse, y cualquier otra frase
   de la página la cortaba.

## Qué cambió
- **La voz la dice Android al instante,** aunque Vento esté minimizada o la pantalla apagada:
  - DaviPlata: **«Pago confirmado. 200 pesos desde DaviPlata.»**
  - Nequi: **«Pago confirmado. 15000 pesos desde Nequi.»**
  - También dice el valor con Bancolombia y Davivienda.
- **La voz de los pagos es propia:**
  - otra frase de la app ya no la corta;
  - si llegan varios pagos seguidos, los dice todos, uno tras otro;
  - mientras habla, la música baja un momento para que se oiga en el negocio.
- **Aviso del celular:** «💜 Pagaron $200 por DaviPlata». Se apaga en Ajustes → Avisos → Pagos.
- **Cada aviso del banco se cuenta una vez, y dos pagos iguales cuentan como dos.** El mismo aviso que el banco vuelve a
  publicar no se repite.
- **Se leen los avisos agrupados,** uno por uno.
- **La página registra el pago** (en la mesa, en el historial y en pantalla) sin repetir la voz que ya dijo Android.
- **Servidor Vento:**
  - recibe cada aviso con su número propio, así que dos pagos iguales llegan como dos a los demás celulares;
  - entiende DaviPlata de «usted».
- **Hay que instalar la app Android nueva** para la voz en segundo plano. La página sigue funcionando con la app vieja,
  pero entonces la voz depende de la página, como antes.

## Pruebas de los pagos
- **`pagosaviso` (nueva),** 15 comprobaciones:
  - dos pagos iguales seguidos suenan los dos;
  - el mismo aviso no se repite;
  - si Android ya habló, la página no repite la voz;
  - un pago propio enlazado al servidor no se come el siguiente;
  - lo que reenvió otro celular no se duplica;
  - la frase «desde DaviPlata» / «desde Nequi»;
  - el interruptor del aviso.
- **`servidor/avisos` (nueva),** 15 comprobaciones contra PostgreSQL real: dos pagos iguales con su número son dos, el
  mismo aviso es uno, MacroDroid igual que antes y DaviPlata de «usted».
- **`AvisoPagoPrueba` (Java, nueva),** 26 comprobaciones: qué es plata recibida, el valor y la frase.
- **Actualizadas:** `avisosandroid`, `pagosguia`, `daviplatacobro`, `mesapersonas` y `canalvivo` pasan.

# B. La música del panel de YouTube sí suena (navegadores que bloquean la reproducción automática)

## Por qué no sonaba
1. **El navegador bloqueaba el sonido.**
   - Al tocar «⏭ Que siga», Vento primero revisaba el video en un reproductor escondido y lo ponía unos segundos
     después, ya fuera del toque.
   - Brave, Chrome y otros navegadores bloquean el sonido que arranca sin un toque de la persona, así que el video
     quedaba cargado pero en silencio.
2. **«Este equipo pone la música» en otro equipo.**
   - Si se había tocado en otro equipo (por ejemplo la app Android), las canciones se mandaban allá y aquí no sonaba
     nada.
   - Si ese equipo estaba cerrado, no sonaba en ninguno.

## Qué cambió
- **«⏭ Que siga» con nada sonando** arranca la canción dentro del mismo toque, así que el navegador sí deja sonar. Si
  esa versión no se deja poner, se cambia sola.
- **«▶ Toca aquí para que suene»:** si el navegador no dejó arrancar solo el video (por ejemplo la primera vez), aparece
  este botón grande en el panel. Un toque lo arranca.
- **Otro equipo pone la música:**
  - el panel dice dónde suena («🔊 La música suena en «App Android de…»») y ofrece **«🎶 Que suene aquí»**;
  - si ese equipo no responde (cerrado o sin internet), este equipo toma la música solo al poner una canción.
- **Soporte:**
  - los avisos de música que llegan a Vento Admin → 🐞 Errores dicen el navegador y el estado del reproductor;
  - `window.vitoMusicaDiag()` da el diagnóstico completo.

## Pruebas
- **Nueva: `musicaautoplay`**, 10 comprobaciones, con un reproductor simulado que, como el navegador más estricto, solo
  suena si se le pide dentro de un toque.
  - Con el código anterior reproduce el silencio: el video queda quieto.
  - Con el arreglo suena dentro del toque; la primera vez sale «Toca aquí» y al tocar suena; y toma la música cuando el
    otro equipo no responde.
- **Actualizada: `musicaanuncios`**, 22 comprobaciones. El simulador ahora solo avisa del video actual, como el de
  verdad.
- **Música:** las 12 pruebas pasan.
