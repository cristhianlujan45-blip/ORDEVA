# ORDEVA 1.99.27 · Los productos nuevos de la mesa quedan inventariados · Auditoría de diseño

## 1. «Que los productos nuevos que uno agrega en la mesa queden inventariados de una vez» (pedido del dueño, 22/11)
- Desde la mesa, «📷 … no está — tómale una foto para agregarlo» abre «Producto nuevo». Ese producto quedaba **sin control de
  inventario** (stock vacío), así que no aparecía contado en Inventario.
- **Ahora** (`index.html`, `app/04g`), el formulario tiene **«📦 ¿Cuántas tienes? (queda en el inventario)»**:
  - Con la cantidad: queda con esa cantidad y se descuenta lo que va a la mesa (24 → 23).
  - Sin la cantidad: queda en el inventario con 0 para que le pongan la cantidad, y lo avisa. No se inventa una cantidad.
  - Un producto que ya existía sin inventario: con la cantidad escrita, queda inventariado.
- **Prueba nueva:** `pruebas/productomesa.test.js` (7/7).

## 2. Auditoría de diseño
El informe completo está en `puente/AUDITORIA-DISENO-1.99.27.md`. Se arregló:
- botones de 44 px en Inicio, Música, Estadísticas, Carta, Libreta, primeros pasos y «Producto nuevo»;
- letra de 12 px como mínimo en las tarjetas de Inicio y Contabilidad, Estadísticas, Mesas, Música y Productos;
- Contabilidad › IVA, que se leía «IVA generado$0»;
- la Libreta en celulares de 320 px (un botón se salía);
- el nombre del negocio y la barra de abajo en 320 px (se cortaban).

**Prueba nueva:** `pruebas/diseno1927.test.js` (14/14).
