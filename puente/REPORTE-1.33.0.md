# Vento 1.33.0 — Todo sincronizado al instante, panel de YouTube, modo para mayores, suscripción y esquinas como CamScanner

## 1. Mismo correo = mismos datos en el celular y en el computador, al instante
- **Al instante:** al guardar, el equipo sube los datos en ~1 s y avisa a los demás equipos de la cuenta por un canal en
  vivo; ellos bajan lo nuevo enseguida. Si el aviso no llega (internet malo), igual revisan cada 5 s (antes cada 15 s).
- **Las fotos ahora viajan.** Antes quedaban solo en el equipo donde se tomaron; ahora van a la nube y los demás equipos
  las bajan solos:
  - fotos de productos (también cuando se cambian o se quitan);
  - facturas escaneadas en HD y la foto original de la factura;
  - recibos de gastos;
  - comprobantes de pago.
- Las fotos que ya estaban guardadas en un celular de antes se suben solas a la nube.
- Sin internet al guardar una foto: queda en cola y se sube sola cuando vuelve la conexión.
- **Arreglo:** la «reparación» automática de datos le borraba la foto a un producto en un equipo que no la tenía, y ese
  borrado se sincronizaba a todos. Ya no lo hace.
- **Servidor:** tabla nueva `archivos_negocio`. Solo los miembros del negocio pueden ver sus archivos; se guardan y se
  borran por funciones que revisan que seas miembro; máximo 6 MB por archivo. Se crea sola al publicar (flujo
  «Servidor Vento»).
- **Prueba nueva `sincroniza`:** dos equipos (celular y computador) contra PostgreSQL real. Los cambios llegaron solos en
  1,4 s y 2,6 s, en los dos sentidos, solo con la revisión de respaldo (la base de pruebas no tiene el canal en vivo).

## 2. Panel de YouTube dentro de la app
- Se abre desde Música → «▶️ Abrir el panel de YouTube», o tocando la barrita «🎵 sonando» que aparece abajo en toda la
  app.
- **Lo que suena:** el video, si suena en este equipo (el reproductor ahora vive fuera de la pantalla de Música, así
  sigue sonando en cualquier pantalla); o la portada, si suena en el TV. Muestra título, quién la pidió, el tiempo,
  ⏯ pausa y ⏭ siguiente.
- **🔎 Poner canción:** buscar con portadas; «⏭ Que siga» la pone de primera, «➕ Cola» la deja en su turno.
- **📃 Mis listas:**
  - las guardadas;
  - pegar el link de una lista;
  - buscar listas por nombre;
  - **las listas de tu cuenta de YouTube, también las privadas**, al conectar Google.
- **🎵 En cola:** con portadas; ⏭ adelanta una canción y 🗑 la quita.
- **Arreglo:** con Google conectado y la app reproduciendo, las canciones se copiaban a YouTube Music y quedaban marcadas
  como enviadas, así que el reproductor de la app ya no las tocaba. Ya no pasa.

## 3. Modo fácil para personas mayores, con la guía de Vento
Basado en lo que funciona en los celulares y apps para mayores (BIG Launcher, BaldPhone, GrandPad):
- **Una pregunta por pantalla**, letra grande, un dibujo, y la voz de Vento lo dice («🔊 Repetir» lo dice otra vez).
  Se puede contestar hablando (🎤): nombres, precios («dos mil quinientos») y cantidades («veinticuatro»).
- **«🙋 Ayúdame» siempre arriba**, en amarillo. Se dice o se escribe qué se necesita («quiero agregar una cerveza»,
  «¿dónde veo las facturas?», «me llegaron 3 canastas»):
  - Vento abre la guía de esa tarea;
  - si es una pregunta, la responde con los datos del negocio o con la IA, en 3 pasos sencillos;
  - si no entiende, ofrece las opciones o hablar con una persona por WhatsApp.
- **Guías:**
  - Agregar un producto: nombre → precio → cuántas hay → foto → ✅. Si ya existe, ofrece sumar unidades o cambiar el
    precio, sin crear repetidos.
  - Llegó mercancía.
  - Foto a un producto.
  - Cambiar un precio (también se actualiza en la cuenta abierta).
  - Escanear una factura: explica cómo tomar la foto, y en la revisión aparece una pista «Revise… toque Aplicar» con voz.
  - Mis facturas: con pista y voz.
  - ¿Cuánto vendí hoy?
  - ¿Cómo vendo?: señala la mesa y sigue sola cuando se toca.
  - Música.
- **Recorrido de bienvenida** la primera vez: señala cada botón (mesas → Hoy → Más → Ayúdame) y lo explica con voz.
- **«Más» rediseñado** con tarjetas grandes (≥ 140 px) por tarea. Todos los botones miden ≥ 56 px.
- Opciones: voz sí/no y letra más grande. El botón Atrás del celular cierra la guía.
- Detalle: la app cambia la palabra «mesa» por el nombre del negocio (p. ej. «cuenta»). Dentro de la guía, «ponga la
  factura sobre una mesa» ya no dice «sobre una cuenta»; las mesas de vender sí usan el nombre del negocio.

## 4. Menú de suscripciones
- **Falla:** se veía «una barra» y no el menú. La barra de la suscripción tenía un estilo que no la dejaba ocultarse:
  - cuando no había nada que avisar, quedaba una franja vacía;
  - la ✕ tampoco la quitaba.
- Ahora la barra se oculta de verdad. La ✕ la esconde 3 días, o hasta que cambie lo que avisa, y no abre los planes.
- **«💳 Mi plan» siempre en ⋯ Más**, con el plan o los días de prueba. Solo lo ven el dueño o el administrador.

## 5. Ajustar las esquinas de la factura, como CamScanner
- En «📷 Revisa la foto», el botón **«✂️ Ajustar esquinas»** abre la foto original con las 4 esquinas que detectó Vento.
- Se arrastran las esquinas, o los bordes (mueven 2 esquinas), con **lupa** mientras se arrastra.
- También: «🔍 Detectar otra vez», «⬜ Toda la foto», «↻ Girar».
- «✅ Listo» recorta, endereza y mejora con esas esquinas. **El escaneo HD que se guarda también usa tus esquinas.**
- **«📚 Facturas anteriores» → «✂️ Corregir el recorte»:** abre la foto original de la página con las esquinas que se
  pusieron (se puede elegir la página). Se corrigen y se reemplaza la página guardada en HD; el texto se vuelve a
  detectar.
- La foto original de cada página queda guardada en el equipo para poder corregirla después.

## Pruebas nuevas

| Prueba | Resultado |
|---|---|
| sincroniza (dos equipos, PostgreSQL real) | 22 / 22 |
| panelyoutube | 25 / 25 |
| guia (modo para mayores) | 47 / 47 |
| subbarra (suscripción) | 15 / 15 |
| esquinas (CamScanner) | 22 / 22 |
| Batería completa | ver abajo |
