# Vento 1.37.0 — Errores que llegan solos a Vento Admin y un solo equipo pone la música

## 1. 🐞 Errores de los equipos → Vento Admin
Lo que falla en los equipos de los clientes llega solo a **Vento Admin → 🐞 Errores**. Así se arregla antes de que el
cliente tenga que avisar (como pasó con el panel de YouTube que no ponía las canciones).

- **Qué se reporta:**
  - **Errores de la app** en cualquier página: la app, la página del QR de los clientes, la app de meseros, el TV y la
    pantalla de preparación. Llegan con la parte de la página donde pasó.
  - **Música:**
    - canciones esperando y ningún reproductor prendido;
    - reproductor prendido que no arranca (con su estado);
    - reproductor pegado;
    - canciones sin ninguna versión que se pueda poner;
    - el equipo que pone la música no responde.
  - **Pedidos por QR:**
    - el local no confirmó un pedido en 3 minutos;
    - un pedido o una canción no se pudo enviar teniendo internet.

    Esto lo reporta el celular del cliente.
  - **Pagos:** un aviso de plata recibida que Vento no supo leer. Va sin nombres ni valores, solo el formato, para
    enseñárselo a Vento (como pasó con DaviPlata).
- **Privacidad:**
  - Solo va el error, la versión, el equipo y el nombre del negocio.
  - **Nunca:** ventas, productos, datos de clientes, contraseñas ni el link secreto de los QR (de la dirección solo va el
    nombre de la página).
- **Sin ruido:**
  - el mismo error se agrupa y se manda como mucho una vez cada 10 minutos, sumando las veces;
  - sin internet se guarda y se manda después;
  - se ignora lo que no es de Vento (extensiones del navegador, cortes de red).
- **Límites en el servidor:**
  - máximo 60 errores distintos por equipo cada hora, y 3.000 en todo Vento;
  - lo que ya está resuelto se borra solo a los 60 días.
- **Vento Admin → pestaña 🐞 Errores:**
  - un globito con cuántos hay sin resolver;
  - filtro por tipo (música, pedidos, pagos, app) y buscador;
  - en cada error: cuántas veces, en cuántos equipos y negocios, y la versión;
  - el detalle dice dónde pasó: negocio, usuario, plataforma y datos técnicos;
  - **«✅ Ya lo arreglé».** Si vuelve a pasar, aparece otra vez contando desde cero.
- **Servidor:**
  - migración `20261017000000_errores_app.sql`:
    - tabla `app_errores`;
    - `reportar_error`, que funciona con o sin cuenta;
    - funciones del administrador;
  - acciones `errores`, `errores_abiertos` y `error_resolver` en `vento-suscripciones`.

## 2. 🎶 Un solo equipo pone la música
Con la misma cuenta en varios equipos (por ejemplo el celular y el computador), ya no pueden sonar dos a la vez.

- **Dónde:** Música → Reproductor en la app → **«🎶 Equipo que pone la música»**.
- **«Este equipo pone la música»:** ese equipo prende su reproductor y es el único que suena.
- **Los demás equipos:**
  - **muestran** lo que suena allá y su cola (en el panel de YouTube dice «🔊 En «Computador de ana · K7QX»»);
  - **mandan allá** todo lo que hagan: «⏭ Que siga», «➕ Cola», ⏭, ⏯, 🗑, poner o quitar una lista;
  - aunque tengan prendido su reproductor, no suenan.
- **Canciones del QR:** llegan a todos los equipos pero suenan una sola vez, en el equipo de la música.
- **Cambiar:** «🎶 Que suene en este equipo» desde otro equipo. El anterior se calla solo.
- **«Cada equipo por su cuenta»** vuelve a como era antes.
- **Equipo que no responde:** si está cerrado o sin internet, los demás lo dicen y llega un aviso a 🐞 Errores.
- **Seguridad:** las órdenes van por un canal privado del negocio que solo conocen los equipos con tu cuenta. No es el
  de los QR, así que un cliente no puede saltar canciones.

## Pruebas
- **Nuevas:**
  - `servidor/errores`: 20 comprobaciones, contra PostgreSQL real;
  - `erroresreal`: 15 comprobaciones, de punta a punta: la app, el QR y Vento Admin con el servidor local;
  - `musicaequipo`: 17 comprobaciones, con dos equipos de la misma cuenta y los canales reales.
- **Suite completa:** ver el resultado al publicar.
