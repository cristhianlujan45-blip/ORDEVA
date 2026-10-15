# Vento 1.35.0 — Sin ntfy, notificaciones a tu gusto, Ajustes ordenados, música con la app minimizada y lectura más rápida

## 1. Se quitó ntfy: todo pasa por el servidor de Vento
- **Todo lo que usaba ntfy.sh ahora va por canales propios del servidor de Vento:**
  - pedidos y canciones por QR;
  - el estado del pedido que ve el cliente;
  - la carta;
  - la cuenta en vivo de la mesa;
  - la app de meseros;
  - la pantalla de preparación;
  - el TV de la música;
  - los avisos de pagos por MacroDroid y el puente de WhatsApp.
- **Ya no hay límite diario de un servicio público:** antes ntfy cortaba con «demasiados mensajes desde esta conexión».
- **Igual de seguro que antes:** el canal sigue siendo secreto (12+ letras al azar), y los mensajes se borran solos a
  los 8 días.
- **Rapidez:** los pedidos llegan en 1-3 s. Si el servidor tiene el aviso al instante (Realtime), llegan enseguida.
- Se quitó de Ajustes la sección de la app ntfy.
- **MacroDroid y el puente de WhatsApp tienen dirección nueva** (Ajustes → Pagos y Ajustes → Pedidos → WhatsApp): hay
  que pegarla otra vez. En el puente de WhatsApp la variable ahora se llama **VENTO_CANAL**.
- **Servidor:**
  - migración `20261016000000_canales.sql` (funciones `canal_publicar` y `canal_leer`, con límite de tamaño y de
    velocidad);
  - ruta `POST /functions/v1/vento-pagos/canal/<canal>` para quien publica desde afuera.

## 2. Notificaciones: prende o apaga cada una
- Ajustes → Notificaciones del celular → **«🔔 Qué avisos quieres recibir»**, con un interruptor para cada aviso:
  - pedidos;
  - piden la cuenta o avisan que pagaron;
  - domicilios;
  - **canciones pedidas**;
  - respuestas del soporte;
  - avisos de Vento IA.
- **Apagado = no sale ni suena.**
- **Botones de prueba:** «Probar pedido», «Probar canción» y «Probar aviso».
- **Arreglo:** «no me dejaba activar las notificaciones de música». La categoría «Canciones pedidas» del celular no
  existía hasta que llegaba la primera canción. Ahora la app crea todas las categorías apenas abre (requiere la app de
  Android nueva).

## 3. Ajustes ordenados, sin repetidos
- **💜 Pagos** reúne la pasarela de Nequi y los avisos de pagos al instante.
- **Domicilios** por página web y **WhatsApp con IA** pasan a **Pedidos**.
- **«Anunciar los pedidos en voz alta»** también está en **Voz**: es el mismo ajuste de la campana, que antes solo se
  encontraba ahí.
- **Textos corregidos:**
  - «Mensaje fijo de la página» y «Mensaje de la ocasión» ya no se llaman igual;
  - «Restablecer colores» ya no dice «verde».
- **Buscador más preciso:**
  - no cuenta palabras como «de» o «la»;
  - busca por comienzo de palabra;
  - prefiere la categoría que nombra lo que buscas.

## 4. Música sola con Vento minimizada (app de Android)
- La página ya no se pausa en segundo plano: YouTube sigue sonando con la app minimizada o la pantalla apagada.
- El servicio de fondo revisa cada 5 s:
  - si el celular frenó el video, le da play;
  - si terminó, pone la siguiente.
- Ya no descarta canciones buenas por tardar en arrancar estando minimizada.
- En la app de Android la música automática arranca sin tocar la pantalla.
- Prender «Música automática» deja a Vento trabajando de fondo.
- Una pausa hecha por ti se respeta.
- **Requiere la app de Android nueva** (se compila sola con esta versión).

## 5. Lectura del texto de las facturas (sin internet) más rápida y exacta
- **La hoja se endereza antes de leer.** Antes, una foto de lado se leía 3-4 veces girada.
- **El texto sale con sus espacios**, tal cual está en la factura.
- **Medido con una factura de prueba (lector sin internet):**

  | Foto | Tiempo | Caracteres iguales |
  |---|---|---|
  | Derecha | 1,3 s | 99,7 % |
  | De lado | 3,6 s | 99,7 % |

  En los dos casos separó los 5 productos.

## 6. Arreglo de la publicación
- La 1.34.0 no alcanzó a verse en la página porque un archivo de pruebas se coló en el repositorio y rompió la
  compilación de GitHub Pages. Se quitó: esta versión publica también todo lo de la 1.34.0 (Vento Admin, soporte,
  licencias, recuperar cuentas, facturas que se giran solas).

## Pruebas nuevas

| Prueba | Resultado |
|---|---|
| canalvivo (QR, estado, canción, meseros, preparación, TV, MacroDroid/WhatsApp, servidor real) | 17 / 17 |
| ajustesorden (Ajustes, notificaciones y buscador) | 17 / 17 |
| musicafondo (música con la app minimizada) | 8 / 8 |
| ocrlectura (lector de texto real) | 7 / 7 |
| **Batería completa (46 pruebas + 3 del servidor)** | **todas en verde** |
