# ORDEVA 1.99.40 · Menos memoria en el celular

## Pedido del dueño (23/11): «Publícala y continúa»

### Auditoría
- **Ventanas que se abren encima**, con la letra ancha y en 360 px (89 botones tocados, 15 ventanas): ningún texto cortado
  ni botón pequeño.
- **Avisos de pago de DaviPlata que ORDEVA no entendió:**
  - Los 6 que se guardaron como «no entendidos» no dicen «recibiste plata» ni «llegó dinero»: lo más probable es que no
    fueran pagos.
  - No se leyeron sus textos: pueden traer nombres de tus clientes y quedarían a la vista en los registros de GitHub.
- **Memoria (error real de producción: «Android cerró la página de ORDEVA por falta de memoria»):** se midió con un negocio
  de 300 productos y 2500 ventas.
  - No hay fugas: la memoria de JavaScript queda en unos 12 MB después de recorrer todo y de 3 minutos quieta.
  - Pero la página tenía **~27.700 elementos**, y ~15.300 eran de la lista de Productos, aunque esté escondida.

### Lo que se arregló
1. **Lista de Productos:**
   - El detalle de cada producto se dibuja **la primera vez que se abre**. Antes venía dibujado en todos: cuentas,
     botones de inventario y acciones.
   - La lista bajó de ~15.300 a ~4.200 elementos, y la página entera de ~21.900 a ~10.800.
   - Los botones del detalle hacen lo mismo de siempre: Entrada, Contar, Aviso, Rápido, Etiqueta, Editar y Eliminar con
     confirmación. Ahora la lista los atiende con un solo «escuchador», en vez de 7 por producto.
2. **Lluvia del tema Matrix:**
   - Se revisaba cada 45 ms (22 veces por segundo) aunque no se viera, y eso despertaba el celular todo el tiempo.
   - Escondida (otros diseños, o la app en segundo plano) ahora se revisa una vez por segundo. Cuando se ve, es igual de
     fluida.

### Comprobado
- **Prueba nueva:** `pruebas/memoria1940.test.js` (10/10). Con la 1.99.39 fallan las 3 revisiones de memoria; los botones
  funcionan igual en las dos.
