# ORDEVA 1.84.0 · Comisiones del personal y arqueo ciego

**Pedido del dueño:** «empieza la 1.84». Es la sección 3 del plan `puente/egm/POS-COMPLETO.md`: lo que el catálogo de
negocios prometía y no cumplía.

## 1. ✂️ Comisiones del personal
Para barberías, salones de belleza, uñas, lavaderos y todo negocio donde cada persona gana un porcentaje.

### Cómo se pone
- **Dónde:** Ajustes → Negocio → «✂️ Comisiones del personal». Solo lo ven el dueño y el administrador.
- **Las personas:** se agrega cada una con su nombre y su porcentaje:
  - **% de servicios:** lo que no lleva inventario (corte, barba, manicure, lavada);
  - **% de productos:** si también gana por vender ceras, champús…; empieza en 0.
- Agregar la primera persona prende las comisiones. Con el interruptor se apagan.
- **Quitar a alguien:** deja de salir al cobrar, y lo que ya ganó y le pagaron sigue en el informe.

### Al cobrar
- **«¿Quién atendió?»:** sale en la caja, en la cuenta de la silla o mesa y en la cuenta de una persona.
  - Un toque al nombre sirve para todos los servicios de la venta.
  - «Uno distinto por servicio» sirve cuando el corte lo hizo Juan y la barba Pedro.
  - «Sin comisión» cobra sin persona.
- **Con una sola persona** no se pregunta: queda ella.
- **En el carrito de la caja,** cada servicio muestra «✂️ ¿Quién?» o «✂️ Juan», y con un toque se cambia. Si ya tiene a
  alguien, al cobrar no se pregunta.
- **La propina** no lleva comisión.

### Lo que guarda la venta
- Cada renglón guarda la persona, su porcentaje y el valor de la comisión **de ese momento**. Si después le suben el
  porcentaje a Juan, lo que ya ganó no cambia.
- **Deshacer una venta** quita su comisión.
- **Una devolución** descuenta la comisión de lo devuelto.

### Informe y pagos
- **Dónde:** Ajustes → «📊 Ver comisiones y pagar», o el botón «✂️ Comisiones» de la caja (solo el dueño o el
  administrador).
- **El período:** hoy, la semana, la quincena, el mes o el mes pasado.
- **Por persona:**
  - cuántos servicios hizo, cuánto vendió y su comisión;
  - **lo que falta por pagar,** que es todo lo ganado menos todo lo pagado, sin importar el período;
  - el detalle de cada servicio y sus pagos.
- **«💵 Pagar»:**
  - queda en la lista de pagos de la persona;
  - queda como gasto «Comisiones» en Contabilidad;
  - si se paga **con el efectivo de la caja,** también es una salida de la caja, así el arqueo cuadra;
  - si se paga más de lo que tiene por pagar, se pregunta y queda como adelanto.

## 2. 🙈 Arqueo ciego
- **Dónde:** Ajustes → Negocio → «🙈 Arqueo ciego». Lo prende el dueño.
- **Dónde se guarda:** en los permisos del equipo, que el servidor no deja cambiar desde el equipo de un empleado.
- **Lo que deja de ver el cajero:** el efectivo que debe haber. No sale en:
  - la ventana de la caja: base, entradas y salidas sí, pero no las ventas en efectivo ni lo que debe haber;
  - el arqueo: solo dice «Contado: $…», sin «faltan», «sobran» ni «cuadra»;
  - «📊 Caja de hoy»: ni el efectivo ni lo que debe haber;
  - el corte X: ni el efectivo ni lo que debe haber;
  - la pregunta antes de cerrar la caja.
- **Al cerrar:** el cierre sí guarda la diferencia, pero al cajero solo le dice «el dueño ve si cuadra».
- **El dueño y el administrador** siguen viendo todo, también si faltó o sobró.
- **Lo esperado y la diferencia de un cierre** se calculan al mostrarlo (base + ventas en efectivo + entradas − salidas),
  no se toma el número guardado. Así salen bien también los cierres que se juntaron entre dos equipos.
- **Límite:** el cajero todavía ve el total de ventas y cada venta. Restando los otros medios de pago podría sacar el
  efectivo a mano. El arqueo ciego quita el número a la vista, no impide esa cuenta.

## 3. Pruebas
- **Prueba nueva `v184`:** 24 de 24 (comisiones y arqueo ciego).
- RESULTADOS_AQUI
- **No se probó con equipos de verdad.**

## 4. Lo que sigue
- **1.85: apartados (plan separe),** sobre la cotización.
- **Preguntas que siguen abiertas:**
  - ¿qué tipos de negocio usan más ORDEVA?
  - ¿los apartados se pagan solo en la tienda donde se hicieron?
