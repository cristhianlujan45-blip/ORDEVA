# ORDEVA 1.67.5 · 🏷️📝⏸️🔁 Fase 4: descuentos autorizados, notas, ventas suspendidas y repetir (Caja)

El cobro con efectivo y vueltas de la fase 4 ya quedó en la 1.67.0. Esta versión completa lo que la auditoría marcó
como inexistente en la Caja (punto 3 del plan).

## Qué quedó (`lib/vento-pos.js`)
Debajo de los productos del carrito hay cuatro botones: **🏷️ Descuento · 📝 Nota · ⏸️ Suspender · 📂 Pendientes (n)**.

### 🏷️ Descuento autorizado
- En **%** (con botones rápidos de 5, 10, 15 y 20 %) o en **pesos**. Nunca pasa del total.
- **Quién puede hacerlo:**
  - el dueño o el administrador, directo;
  - el equipo, solo con la **clave de autorización del dueño** (la misma de corregir y borrar ventas, con bloqueo tras
    5 intentos). Sin clave puesta o con la clave equivocada, no hay descuento.
- **Cómo se guarda:**
  - Se **reparte en el precio de cada producto** y queda guardado su `precioLista`. No hay líneas negativas, así que el
    total, la rentabilidad, el inventario y la factura electrónica cuadran.
  - Lo que sobra por redondeo va al renglón de 1 unidad: el total queda exacto.
  - La venta guarda `descuento` con el valor, el total antes del descuento, el tipo, el porcentaje y si fue «autorizado
    con clave».
  - Queda en la actividad del equipo.
- El carrito muestra «🏷️ Descuento 10 % −$2.600» y el total ya descontado, con ✕ para quitarlo.

### 📝 Nota de la venta
Por ejemplo «para llevar, sin hielo». Queda en `observacion` y se ve en el historial.

### ⏸️ Suspender y 📂 Pendientes
- **Suspender** guarda la venta (productos, descuento y nota) en este equipo, con un nombre opcional («Pedido de
  Juan»), y deja la caja libre.
- **Pendientes** lista las suspendidas, con productos, hora y total, para **Recuperar** o **Borrar**. Borrar pide
  confirmación.
- No se recupera encima de otra venta: primero hay que cobrar o suspender la que esté en la caja.

### 🔁 Repetir una venta
- En «📊 Caja de hoy», cada venta tiene 🔁. Sus productos pasan a la caja **con el precio de hoy**.
- Avisa si alguno ya no existe.

### Historial
Cada venta muestra, cuando aplica:
- 🏷️ el descuento (y el total antes del descuento);
- 💵 lo que entregó el cliente y el cambio;
- 📝 la nota.

## Errores encontrados al probar (corregidos)
- **Las confirmaciones («¿Seguro…?») quedaban detrás de la Caja y de otras ventanas**, porque estaban en la capa 50 y la
  Caja en la 8500. No se podían tocar. Ahora la confirmación siempre va encima de todo.
- Al borrar una venta pendiente, la lista se cierra antes de preguntar y se vuelve a abrir después.

## Pruebas
- `pruebas/cajaextra.test.js` (14 ✅, nueva, en CI). Cubre:
  - el descuento del 10 % repartido y el cierre de caja;
  - el descuento en pesos con redondeo exacto;
  - un empleado sin clave, con clave equivocada y con la clave;
  - la nota y el historial;
  - suspender, «Pendientes (1)», no recuperar encima de otra venta y recuperar con el descuento;
  - borrar con confirmación;
  - 🔁 repetir con el precio de hoy.
- Los resultados de la lista crítica completa están en el mensaje de publicación.

## Pendiente
- Las ventas suspendidas viven en el equipo donde se suspendieron (no se comparten entre equipos).
- Anular una venta ya existe en Historial (corregir, liberar o borrar con la clave del dueño).
