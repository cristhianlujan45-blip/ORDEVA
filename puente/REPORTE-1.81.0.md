# ORDEVA 1.81.0 · 🧾 La caja: lo que faltaba de la revisión 1.80.0

El dueño dijo «continúa». Se hizo toda la lista de la revisión de la 1.80.0.

## 1. 💳 Datáfono que confirma solo
- Se prende en Ajustes → Pedidos, QR y caja → «💳 Datáfono».
- Al cobrar con 💳 Tarjeta sale «Pase la tarjeta en el datáfono por $X».
- Cuando llega el aviso del pago por ese valor exacto (de Bold u otro datáfono, al celular del negocio), la venta se cobra
  sola como «Tarjeta». Es la misma lectura de avisos de Ajustes → Pagos.
- Si el datáfono no avisa al celular, sirve «✅ Ya pasó», como siempre.
- **Lo que no hay todavía:** mandarle el valor al datáfono desde ORDEVA. Eso necesita la API de cada datáfono (Bold,
  Redeban) y las credenciales del comercio.

## 2. 🔒 Cierre Z numerado (y un error que se encontró)
- **El error:** el cierre de caja solo separaba efectivo, transferencia y fiado. Lo cobrado por **Nequi, DaviPlata,
  tarjeta, Bre-B o saldo a favor** quedaba revuelto dentro de «transferencia». Ahora cada medio va aparte en el cierre,
  el Corte X, el WhatsApp y la imagen.
- **Cierre Z N.º 0001, 0002…:**
  - un número consecutivo por cierre y quién cerró;
  - descuentos, devoluciones y ventas por cajero.
- **«📊 Cierres Z en Excel (para el contador)»** está en el historial, debajo de «Caja: base, entradas y salidas». Baja el
  mes actual o el anterior:
  - cada cierre con su número, fecha y quién cerró;
  - ventas por medio de pago, fiado, descuentos y devoluciones;
  - el arqueo: lo que debía haber, lo contado y la diferencia.

## 3. 🎉 Promociones por horario (hora feliz)
- Se crean en Ajustes → Pedidos, QR y caja → «🎉 Promociones por horario»:
  - nombre, de qué hora a qué hora (también la que pasa de medianoche) y qué días;
  - el % de descuento, en todo o en una categoría.
- En esa hora la caja baja el precio sola y lo muestra en la venta («🎉 Hora feliz: −20 % en Cervezas…»).

## 4. 🧾 Varias cajas
- Cada equipo puede tener nombre de caja, por ejemplo «Caja 2» o «Caja barra». Se pone en Ajustes → Pedidos, QR y caja.
- **Cada caja lleva lo suyo:**
  - su turno, su base, sus entradas y salidas;
  - su arqueo, su Corte X y su cambio de turno.
- Las ventas quedan marcadas con la caja que las cobró, tanto las de la caja POS como las de las mesas. El efectivo de una
  caja no se mezcla con el de otra.
- **Sin nombre**, el equipo es la caja principal, igual que antes.

## 5. 📅 Venta a crédito con cuotas
- Al fiar en la caja se elige el plan: sin fechas (el fiado de siempre), 1 pago con fecha, o 2, 3, 4, 6 o 12 cuotas.
- Las cuotas van cada semana, quincena o mes, y se anota el celular del cliente.
- **«📅 Créditos» en la caja:** quién debe, la próxima cuota y las vencidas primero, en rojo. El botón dice «(N vencidos)».
- **«💵 Abonar»:** se escoge el medio de pago.
  - La deuda baja y las cuotas se van marcando pagadas.
  - El abono entra a Contabilidad el día en que se paga, como «Abono de crédito».
  - En efectivo, entra también a la caja abierta.
- **«📲 Recordar»:** le escribe por WhatsApp con la cuota, el valor, la fecha y el saldo.

## 6. 🔒 Clave del dueño para vender lo agotado
- Se prende en Ajustes → Pedidos, QR y caja.
- Al vender más de lo que hay (con el producto, con «+» o por código):
  - **el dueño** confirma «Sin existencias, ¿venderlo igual?»;
  - **el equipo** necesita la clave del dueño.
- Queda en la actividad.

## 7. 🎨 Productos con variantes (talla, color, sabor)
- Se ponen en Inventario por código → consultar el producto → «🎨 Variantes». Cada una con su nombre, su stock, su código
  y su precio si es distinto.
- **En la caja:** al tocar el producto se elige la variante, o se escanea su código. La línea queda «Camiseta · Roja M».
- **Al cobrar:** bajan la variante y el producto, y la venta dice la variante.

## 8. 🧾 Recibos de cualquier día desde la caja
- «🧾 Recibos» busca la venta por producto, valor, cliente, fecha o factura, y la imprime, la manda o la guarda como imagen.

## Pruebas
- **`cajamas` (41 ✅):** ahora también cubre:
  - sin existencias;
  - hora feliz;
  - datáfono con el aviso de Bold;
  - recibos de hace 5 días;
  - cierre Z con cada medio y el Excel;
  - crédito con 3 cuotas: la vencida, el abono por Nequi, Contabilidad y el WhatsApp;
  - variantes con su stock;
  - «Caja 2» con su turno.
- **En GitHub, la 1.80.0 había fallado en 2 pruebas:**
  - `reservas`: un comentario puesto en medio de una línea dañaba la prueba (error mío de la 1.79.1). Además, ahora la
    prueba espera a que la ventana se vuelva a pintar después de guardar.
  - `escanear`: esperaba que no hubiera botón «📱 Celular» en la caja. Ahora está a propósito, arriba.
- **Siguen bien:** las demás pruebas de caja, cobro, cierre, inventario, finanzas, historial, DIAN y vistas.

## 🔎 Revisión: qué más le falta a la caja
1. **Mandar el valor al datáfono** (API de Bold o Redeban) para no digitarlo en el datáfono. Necesita las credenciales del
   comercio.
2. **Inventario con alertas en la caja:** «quedan 2 de Águila: ¿pedir al proveedor?», con un toque al pedido por WhatsApp
   que ya existe.
3. **Combos y «lleve 3 pague 2»** que la caja aplique sola. Hoy los combos se arman como producto.
4. **Lista de espera de clientes en la pantalla del cliente**, con turnos «Siguiente: 23», para panaderías y droguerías.
5. **Modo sin internet para varias cajas:** que dos cajas sin internet no pisen el mismo turno al volver la conexión.
6. **Devolución de una variante al stock de la variante** (hoy vuelve al producto) y deshacer el stock de la variante al
   anular la venta.
