# ORDEVA 1.62.0 · Pantallazo automático al reportar · PIN para los empleados · Elegir dónde suenan los pagos

## 5. 📷 «🐞 Reportar un problema» con pantallazo automático
- **Al abrir «🐞 Reportar un problema»,** la app toma sola un pantallazo de lo que se veía: sin la ventana del reporte,
  sin el menú «Más» y sin los avisos encima. Toma unos 0,6 s y no hay que hacer nada.
- **Se ve en miniatura con la casilla** «📷 Enviar también lo que se veía en la pantalla. Solo lo ve el soporte de
  ORDEVA; quítalo si muestra algo que no quieres mandar». Viene marcada; se puede desmarcar.
- **Llega con el reporte al caso de soporte,** en el mismo almacenamiento privado de las fotos de soporte (solo tú lo
  abres desde ORDEVA Admin). Se pueden seguir agregando fotos propias, máximo 3 en total.
- **El arreglo de fondo:** html2canvas, el que ya hacía la imagen del recibo, no entiende los colores modernos de la
  app (`color-mix`) y fallaba con la pantalla completa.
  - En la copia del pantallazo esos colores van ya calculados, con el mismo traductor que usan los iPhone con iOS
    15/16 (`lib/vento-colormix.js`).
  - Ese traductor ahora se puede usar en todos los navegadores, pero solo se aplica solo donde hace falta, como antes.
- **Si no se puede tomar** (sin internet la primera vez, equipo muy lento), el reporte se manda igual, sin pantallazo.
- **Prueba:** `erroresreal` 33/33, con el servidor real. Toma el pantallazo, lo muestra con la casilla y llega al caso
  de soporte como JPEG. Además abrí la imagen que se tomó: muestra la pantalla de la app tal como estaba.

## 6. 🔢 PIN para los empleados
- **El dueño (o el administrador), en Ajustes → usuarios, toca «🔢»** en la fila del empleado y le pone un PIN de 4 a 6
  números.
  - Vacío lo quita; con PIN el botón queda «🔢✓».
  - **Solo para el equipo** (mesero, cajero, empleado). Un administrador no puede tener PIN: un PIN de 4 números no es
    bastante para manejar todo el negocio.
- **En la entrada:** al tocar el nombre del empleado, el campo pasa a «🔢 PIN o contraseña» con teclado de números.
  Con el PIN entra como equipo; la contraseña sigue sirviendo.
- **Cambiar de mesero rápido:** tocando su nombre arriba (🧑‍🍳 juan), la app pregunta «¿Cambiar de usuario?», guarda
  todo y vuelve a la entrada para el siguiente.
- **Bloqueo:**
  - Cada PIN malo dice cuántos intentos quedan.
  - Al 5.º seguido el PIN queda bloqueado: ni el correcto entra.
  - Se desbloquea entrando con la contraseña o cuando el administrador le pone uno nuevo.
- **Se guarda la huella del PIN (PBKDF2, como la contraseña), nunca el PIN.**
- **En todos los equipos del negocio:** el PIN viaja con el usuario (1.60.0). Si juan estaba adentro en otro celular,
  sigue adentro.
  - Los equipos que todavía tengan la versión anterior no borran el PIN al cambiar una contraseña.
- **Pruebas:**
  - `pinempleado` 17/17 (nueva): poner el PIN, entrar, cambiar de usuario, bloqueo y desbloqueo, quitar.
  - `usuariosequipo` 27/27: el PIN puesto en un celular sirve en el otro.
  - `servidor/usuariosequipo` 25/25: permisos, administrador sin PIN, la versión anterior no lo borra, al quitar el
    usuario se borra.

## 7. 🔊 Tú eliges en qué equipos suenan los avisos de pago
**Dónde:** Ajustes → 💜 Pagos → «🔊 Equipos y dónde suenan los pagos». Solo lo ven el dueño y el administrador.

**Qué hay en la lista:**
- Todos los celulares, tablets y computadores que entraron a ORDEVA con tu negocio.
- **«🔊 Suena» / «🔕 No suena»:** un toque cambia cada uno.
- **✏️ Ponerles nombre** (Caja, Barra, Celular de Ana…) para reconocerlos.
- **Retirar** uno perdido, como antes.
- Si los apagas todos, avisa «⚠️ Ningún equipo va a sonar».

**En un equipo con «🔕 No suena»:**
- El pago llega igual y queda en su lista, con un aviso en pantalla sin sonido (🔕).
- No hay voz, ni sonido, ni vibración, ni notificación, ni ventana con el valor.

**Funciona en todos los equipos:**
- en la app abierta;
- en la app Android aunque ORDEVA esté cerrada o el celular bloqueado, también en el celular que lee los avisos de
  Nequi/DaviPlata;
- en las notificaciones del navegador o el computador con ORDEVA cerrada: el servidor ya no se las manda.

**Cuándo se entera cada equipo:** al instante con el aviso en vivo, cada 5 minutos y al volver a la app. Le sale «🔕 El
administrador eligió que en este equipo no suenen los avisos de pago».

**Lo que queda igual:**
- Al principio suenan todos, como hasta ahora.
- Sigue la regla de antes: a un mesero solo le llega el pago de la mesa que atiende.
- Cada cambio queda en la actividad del negocio.

**Pruebas:**
- `pagossuenan` 12/12 (nueva, con un celular Android, una tablet Android y un computador): la lista con los 3, nombre a
  la tablet, la tablet sin sonar; llega un pago, el computador suena y la tablet no, pero lo tiene en su lista; se
  vuelve a prender y el siguiente pago sí suena.
- `servidor/admin` 168/168: la notificación con la app cerrada solo a los que suenan; un empleado no puede cambiarlo; el
  administrador sí; nombre; auditoría.

**App Android:** necesita la versión nueva del APK, que se publica sola con esta versión. Con el APK anterior, en ese
celular la página respeta la elección, pero el aviso que da Android con ORDEVA cerrada sigue sonando hasta actualizar.

## Base de datos (sin borrar nada)
- `20261115000000_dispositivos_suenan.sql`:
  - columna nueva `dispositivos.suena` (por defecto sí);
  - `dispositivos_lista`, `dispositivo_sonar`, `dispositivo_nombre`, `dispositivo_suena`;
  - `srv_push_destinos` solo a los que suenan.
- `20261114000000_usuarios_pin.sql`:
  - columna nueva `usuarios_equipo.pin`;
  - `usuarios_equipo_lista` la devuelve;
  - función nueva `usuarios_equipo_guardar_v2` (la anterior queda igual para los equipos con 1.60/1.61).

## Lo que no se pudo probar aquí
- **El pantallazo en un iPhone y en la app Android de verdad.** Se probó en Chrome; en Safari lo revisa la prueba de
  compatibilidad de código (`iphone`).
- **La parte de la app Android (Java) de «dónde suenan»** no se pudo compilar aquí (no hay Android SDK en este equipo).
  Se compila en GitHub al publicar; en la prueba, la app Android está simulada. Son 3 líneas: «si este equipo no suena,
  no hablar ni notificar».
