# ORDEVA 1.72.4 · Escáner con la cámara, error al abrir, contraseñas y ORDEVA Admin

**Pedidos del dueño:**
- «Cuando uso el celular para escanear, que la cámara quede activa y se vayan agregando los productos, como un POS, sin
  abrir la cámara cada vez; que se oculte el menú».
- «Cada vez que inicio la app, Laya dice que hay un error y que recargue».
- «Pongo la misma contraseña en otros equipos y no funciona; la cambio, funciona una vez y después deja de funcionar».
- «En ORDEVA Admin: más datos de los usuarios y de los errores, ver la contraseña de cada usuario, que sea más fácil
  entrar, que quede guardada la contraseña y entrar con huella».

## 1. Modo escáner en la Caja POS (`lib/vento-escaner-caja.js`, nuevo)
- **Qué cambió:** el 📷 de la Caja POS prende la cámara **dentro de la caja**, arriba. Antes era una ventana que tapaba la
  venta y el total, y había que cerrarla para cobrar.
- **Cómo se usa:** se pasan los productos y se agregan solos.
  - El mismo código quieto frente a la cámara no se suma dos veces; para otra unidad se retira y se vuelve a pasar.
  - Varios productos juntos frente a la cámara se agregan todos.
- **Mientras escanea:** se esconden el menú de abajo, el micrófono flotante y, en el celular, los botones de productos.
  Quedan la cámara, el buscador, la venta, el total y COBRAR. Tiene linterna si la cámara la tiene, y «✕ Apagar cámara».
- **Al cobrar:**
  - con la ventana de cobro abierta no lee nada (no se cuela un producto en el cobro);
  - después sigue prendida para el siguiente cliente.
- **Se acuerda:** la próxima vez que se abre la Caja POS en ese equipo, la cámara prende sola. Al cerrar la caja se suelta la
  cámara (no gasta batería).
- **Agrega por el mismo camino de la pistola lectora:** balanza, códigos nuevos («es un producto nuevo»), igual que siempre.
- **Lector USB o Bluetooth:** sigue funcionando como antes, sin cámara.

## 2. «Laya dice que hay un error y que recargue» al abrir
- **Qué pasaba:** ORDEVA tiene dos registros de errores:
  - el que va a ORDEVA Admin ya ignoraba el «ruido» normal de un celular;
  - el local (el que muestra «Algo falló · Toca y lo arreglo» y el que lee Laya al saludar) **no lo ignoraba**.
- **El ruido:** el sonido que el celular bloquea hasta que se toca la pantalla (`NotAllowedError: play() failed`) y los cortes
  de red al abrir (`Failed to fetch`, `Load failed`, `NetworkError`). Eso pasaba casi en cada arranque, y Laya decía «vi un
  error, recarga la app» sin que nada estuviera mal.
- **Arreglo (`index.html`, `app/12-fotos-productos-fondo.js`):** los dos registros ignoran lo mismo. Lo que quedó anotado
  con versiones anteriores y es ruido ya no cuenta. Un error de verdad se sigue anotando, sale «Algo falló» y Laya lo dice.
- **Prueba:** `errorarranque` (4 revisiones).
- **Si el aviso sigue saliendo:** es un error real. Aparece en ORDEVA Admin → 🐞 Errores con el modelo del celular.

## 3. Contraseñas
- **Lo que se encontró:** desde ORDEVA Admin, «✏️ Ponerle una contraseña» traía marcado de fábrica «Pedirle que ponga una
  propia al entrar». Eso causaba dos problemas:
  - **Se trababa:** si en esa ventana se escribía la **misma** contraseña, el servidor la rechazaba con «New password
    should be different from the old password.» (en inglés) y la ventana quedaba trabada, sin salida.
  - **Dejaba de servir:** si se ponía otra, la del administrador dejaba de servir en los demás equipos. Eso es «funciona una
    vez y después no».
- **Arreglos:**
  - **En la app (`lib/vento-cuenta.js`):**
    - escribir la misma se toma como «seguir con esa»;
    - hay un botón nuevo, «Seguir con la que acabo de usar»;
    - la ventana avisa que, si se pone otra, la anterior deja de servir en los otros equipos.
  - **En ORDEVA Admin:** en la cuenta de cliente del propio administrador (`+cliente`) la casilla va **sin marcar**, y
    explica qué pasa si se marca.
- **Pruebas (`clavevarios`, 24 revisiones contra el servidor de pruebas real):**
  - cambiar la contraseña en un equipo y entrar en otro, recargar, esperar, salir y volver a entrar (3 veces), un equipo
    nuevo, la vieja que ya no sirve;
  - la contraseña puesta por el administrador, con la misma y con «Seguir con la que acabo de usar».
  - Con la versión anterior, el caso de la misma contraseña falla: la ventana queda trabada con el error en inglés.
- **Servidor de pruebas:** ahora imita la regla del servidor real que rechaza poner la misma contraseña (`same_password`).

## 4. ORDEVA Admin
- **Ver la contraseña de cada usuario: no se puede.** El servidor no guarda las contraseñas, solo una huella cifrada de una
  sola vía; nadie las puede leer, ni ORDEVA ni el administrador. La ficha de la cuenta lo dice y lleva a «✏️ Ponerle una
  contraseña» y «🔑 Contraseña temporal».
- **Más datos de cada cuenta** (migración `20261124000000_admin_mas_datos.sql`; solo lectura, no cambia tablas ni borra):
  - **Perfil:** nombre, cuándo se puso la contraseña, si debe cambiarla al entrar, cuándo se cerraron sus sesiones y cuándo
    aceptó la licencia.
  - **«📊 Cómo va su negocio»:** tipo, ventas de hoy y de 30 días (cantidad y plata), última venta, cuentas abiertas,
    productos y cuándo se guardaron los datos.
  - **«🐞 Errores de sus equipos»:** los últimos 15, con el modelo del celular. Tocando uno se abre el error.
- **Más datos de los errores:** por cada equipo, el modelo del celular, desde cuándo pasa y «👤 Ver la cuenta».
- **Entrar más fácil:**
  - **Guardar la contraseña:** la entrada ahora es un formulario de verdad. Al entrar, el celular o el computador ofrecen
    **«¿Guardar contraseña?»**. La próxima vez la ponen solos y entra; en el celular, con la huella o la cara si el equipo
    lo tiene configurado así.
  - **Lo demás:** queda escrito el correo de la última vez, Enter entra una sola vez, y la sesión sigue guardada como antes.
  - **App de los negocios:** también ofrece guardar la contraseña al entrar.
- **Pruebas:**
  - `adminmasdatos` (16 revisiones, pantalla contra el servidor de pruebas);
  - `pruebas/servidor/adminmasdatos.test.js` (11 revisiones contra PostgreSQL; incluye que nunca sale la contraseña ni su
    huella, y que solo el servidor puede llamar las funciones);
  - `adminreal` 50/50, `errores` 37/37, `admin` 169/169 y las 52 migraciones se aplican.

## 5. Sincronización: un dato podía no llegar nunca a la nube (`nube/vento-nube.js`)
Lo encontró la prueba `qrprivado`. Fallaba de vez en cuando en GitHub (1.72.1) y aquí, con la máquina cargada.
- **Qué pasaba:**
  - Al crear el negocio en la nube, ORDEVA mandaba los datos del equipo.
  - Cuando el servidor respondía, guardaba como «copia de referencia» los datos **de ese momento**, no los que había
    mandado.
  - Si algo cambió en ese par de segundos (por ejemplo el canal de pedidos del QR, que se anota al abrir), la referencia
    creía que ya estaba en la nube. La subida por partes solo manda lo distinto a la referencia, así que ese dato **no se
    subía nunca**.
- **Consecuencias:**
  - el canal de pedidos del QR no quedaba protegido en el servidor (con la clave pública se podían leer los pedidos);
  - un ajuste hecho en esos segundos podía no llegar a los otros equipos.
- **Arreglo:** la referencia es la foto que de verdad se mandó. Si algo cambió mientras tanto, queda pendiente y se sube.
- **Comprobado con carga:**
  - antes del arreglo, 2 de 4 copias de `qrprivado` fallaban;
  - después, las que corrieron pasaron 9 de 9 (otras 2 no arrancaron porque chocaron al armar la base de pruebas, que es
    del montaje y no de la app).
- **Diagnóstico nuevo:** si `qrprivado` vuelve a fallar, ahora muestra el rastreo de la sincronización.

## 6. Pruebas ajustadas
- **`escanear`:** prueba con una cámara falsa que muestra un código de barras EAN-13 **de verdad** y el lector real (ZXing).
  Ahora prueba el modo escáner dentro de la caja:
  - abre en 310 ms y lee el código de verdad;
  - cinco toques abren una sola cámara;
  - funciona con el permiso lento y con la cámara ocupada;
  - sin permiso lo explica, y al tocar 📷 otra vez abre;
  - al cerrar se apaga.

  Pasa 13 de 13. Mientras la cámara abre, más toques en 📷 no hacen nada (pedirla otra vez la deja ocupada en muchos
  celulares).
- **`clavevarios`:** la espera de la prueba leía la pantalla de entrada mientras la página se recargaba. Era de la prueba,
  no de la app.

## Lo que no se probó
- **Cámara:** con un celular de verdad y su cámara. Las pruebas usan la cámara falsa de Chromium y un lector simulado.
- **Guardar la contraseña con huella:** en un Android, iPhone o Windows de verdad. Depende del administrador de contraseñas
  del equipo; la prueba usa uno simulado.
- **La app Android:** dentro de la app el guardado de la contraseña lo hace el autocompletar de Android, si está prendido.
