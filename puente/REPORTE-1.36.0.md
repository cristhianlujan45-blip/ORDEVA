# Vento 1.36.0 — Ventana de YouTube grande, DaviPlata que avisa «Pagaron $X», 10 canciones por mesa y sonido de la mesa a tu gusto

## 1. Ventana de YouTube grande, como YouTube normal
- **Se abre como una ventana nueva y ocupa toda la pantalla.** En el computador deja un margen pequeño.
- **Buscador arriba**, como en YouTube.
- **Seis secciones:**
  - **🏠 Inicio:** géneros para buscar con un toque (vallenato, salsa, reggaetón, merengue, popular…), tus canciones
    guardadas, lo que sonó hace poco y tus listas.
  - **🔎 Buscar:** resultados en tarjetas grandes con la portada y la duración. Tocar la portada = «Que siga».
  - **🎵 En cola:** lo que suena y lo que sigue. ⏭ adelanta una canción y 🗑 la quita.
  - **❤️ Mis canciones:**
    - toca 🤍 en cualquier canción para guardarla; quedan en todos tus equipos;
    - «▶ Poner todas» y «🔀 Al azar»;
    - «🔥 Las que más suenan aquí» y el historial.
  - **📃 Mis listas:**
    - pega el link de una lista o busca por nombre;
    - **«👁 Ver»** muestra las canciones de cualquier lista para poner **una sola**;
    - «▶ Poner» la deja sonando de fondo.
  - **👤 Mi YouTube** (con tu cuenta de Google): tus listas (también las privadas), **los videos que te gustan**, **tus
    videos** y **tus suscripciones**. Al tocar un canal ves sus videos.
- **Bien distribuido:**
  - **Computador:** secciones a la izquierda, contenido al centro, y el video con «A continuación» a la derecha.
  - **Tableta:** el video va arriba del contenido.
  - **Celular:** pantalla completa, con las secciones como pestañas y los resultados en lista. El video queda arriba y
    no se mueve al bajar.

## 2. DaviPlata: ahora sí se agrega y avisa «Pagaron $X»
- **El arreglo:**
  - **Por qué fallaba:** DaviPlata escribe sus avisos de «usted» («¡Le llegó plata!», «MARÍA LÓPEZ le pasó $30.000»,
    «Recibió $15.000»). Vento solo entendía la forma de «tú» que usa Nequi («Te llegó plata»), así que los pagos de
    DaviPlata no salían.
  - **Dónde quedó arreglado:** en la app y en la lectura de avisos de la app Android.
  - **Lo que sigue sin tomarse:** la plata que **sale** («Usted pasó…»), los códigos y las claves.
- **Aviso del celular «💜 Pagaron $30.000 por DaviPlata»:**
  - dice de quién es y de qué mesa;
  - suena aunque Vento esté minimizada.
- **Una sola vez:** el mismo aviso que llega por la app Vento y por MacroDroid no se cuenta dos veces. Dos clientes que
  pagan lo mismo sí son dos pagos.
- **Interruptor «💜 Pagos que te llegan»** en Ajustes → Notificaciones.
- **Paso a paso en la app: «📘 Paso a paso: agregar DaviPlata o Nequi».**
  - **Dónde está:**
    - Ajustes → 💜 Pagos;
    - el panel de pagos;
    - «Conectar DaviPlata»;
    - el asistente («¿cómo agrego DaviPlata?»).
  - **Cómo funciona:** cada paso muestra si ya está listo ✅ y tiene su botón:
    1. Instalar la app Vento para Android en el celular donde tienes DaviPlata (botón de descarga).
    2. «Prender ahora» los avisos de pagos.
    3. Dar el permiso «Acceso a notificaciones» (botón que abre la pantalla del celular).
    4. Dejar prendidas las notificaciones de DaviPlata (Ajustes → Aplicaciones → DaviPlata → Notificaciones).
    5. Quitar el ahorro de batería para Vento.
    6. Probar: que te pasen $1.000. También hay una prueba simulada.
  - **No necesitas convenio con Davivienda.** «Conectar DaviPlata» (la API oficial) es solo para cobrar con código.
- **Arreglo:** el botón «⚙️» del panel de pagos abría Ajustes → Negocio. Ahora abre Ajustes → 💜 Pagos.

## 3. 10 canciones por MESA (no por celular)
- **Cuenta toda la mesa:** el cupo de 10 canciones cada 15 minutos suma lo que piden **todos los celulares** de esa mesa.
- **Cupo en vivo:** la cuenta en vivo de la mesa lleva las canciones que ya pidió. Cada celular ve el cupo real («6 de
  10») aunque no haya pedido nada.
- **Al llegar a 10,** ningún celular de la mesa puede pedir otra: «Esta mesa ya pidió 10 canciones. Podrán pedir otra
  en N min.»
- **Si un celular la manda igual** (por ejemplo, sin señal de la cuenta en vivo), Vento la rechaza y **le avisa a ese
  celular**. Su contador no se queda con la canción que no entró.

## 4. Sonido al agregar o quitar de una mesa: prender o apagar
- **Botón 🔊/🔇 dentro de la mesa abierta** (arriba, junto a los otros íconos). Apaga o prende juntos el «tún» de
  agregar y el «tic» de quitar.
- **El mismo interruptor en Ajustes → Notificaciones:** «🔊 Sonido al agregar o quitar de una mesa».
- **Sincronizado** con Ajustes → Sonidos, y se recuerda al recargar. El sonido al cobrar no cambia.

## Pruebas
- **Nuevas:**
  - `ventanayoutube`: 30 comprobaciones, en computador y celular;
  - `pagosguia`: 29 comprobaciones;
  - `cancionesmesa`: 14 comprobaciones, contra el servidor local real;
  - `sonidomesa`: 13 comprobaciones.
- **Actualizadas:** `panelyoutube` (búsqueda en la barra de arriba) y `ajustesorden` (aviso de pagos).
- **Suite completa:** pasa.

## Para que funcione en tu celular
- **App Android:** hay que instalar la **app Android nueva** para que el celular entienda los avisos de DaviPlata. Se
  compila sola con este cambio.
- **Página web:** lo demás funciona apenas se actualice la página.
