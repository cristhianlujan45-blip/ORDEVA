# ORDEVA 1.99.0 · Facturas mejor organizadas y la cuenta de la mesa más cómoda

**Pedido del dueño:** «Mejórame también el tema de cómo se guardan las facturas, que esté mejor organizado» y, después de
las auditorías, «Hazlo». Son los puntos 4 y 5 del orden aprobado (`puente/egm/AUDITORIA-1.98-FACTURAS.md` y
`AUDITORIA-1.98-DISENO.md`).

## Facturas (ventas cerradas)
- **Buscador:** por número, cliente, mesa, producto, forma de pago o valor. No importan tildes ni mayúsculas.
- **Por mes:** un selector con los meses que tienen ventas. Se combina con el buscador y con «Pagaron / Deben».
- **Por día:** cada día tiene su encabezado con cuántas facturas y cuánto sumó («Hoy · 2 facturas · $50.500»).
- **Cada fila** muestra el número de la factura (el de la DIAN si lo tiene) y la forma de pago («N.º F-104 · Nequi»).
- **Libro de facturas para Excel:** una fila por factura (fecha, hora, número, mesa o cliente, productos, forma de pago,
  total, propina, descuento, lo que queda debiendo, quién atendió). Baja solo lo que se ve con el filtro.
- **«Borrar historial de un día»** pasó al final de la pantalla, lejos de «Cerrar caja».
- Quien solo puede ver las ventas de hoy no ve totales, ni el mes, ni el libro.
- **No cambia ningún dato:** solo cómo se muestran y se encuentran.

## La cuenta de la mesa (celular)
- La barra «Falta por pagar · Cobrar» ahora es el pie de la ventana. Antes flotaba 120 px arriba y tapaba productos.
- El micrófono queda arriba de esa barra, no encima.
- − / +, el reloj y la ✕ de cada producto miden 44 px (antes 30 y 21). También el lector y los botones plegables.
- En un celular muy angosto (320 px) el precio baja a su propio renglón en vez de montarse sobre el +.

## Qué cambió en el código
- `index.html` (buscador, mes, libro y estilos), `app/04g-productos-historial-caja.js` (filtro, días, número, libro).
- `lib/vento-sencilla.js` (pie de la ventana), `lib/vento-mesa-comoda.js` (tamaños para el dedo).
- Sin cambios en el servidor ni en la app Android.

## Pruebas
- **Nueva:** `pruebas/facturasorden.test.js`, 21 bien, 0 mal (entra a la lista de GitHub).
- Diseño mirado en capturas a 390 px y 320 px.
- **Lista completa:** RESULTADOS_AQUI
- **No se probó** en un celular de verdad.

## Lo que sigue
6. Anular en vez de borrar y guardar el «antes» al corregir. Toca plata y cierres: lleva plan y revisión goldfish antes.
- De las facturas de **compra**: lista de proveedores, «pagada / por pagar» y compras por mes.
