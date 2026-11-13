# Auditoría 1.98 · Cómo se guardan y se encuentran las facturas

**Pedido del dueño (13/11):** «Mejórame el tema de cómo se guardan las facturas, que esté mejor organizado».
Un revisor de diseño con contexto limpio leyó el código (no corrió nada; los tamaños son estimados). «Facturas» son dos
cosas: **A) las de venta** (`data.history`, pantalla «Facturas») y **B) las de compra** al proveedor (`data.purchases`).

## Lo más grave
- **B1 · Solo se guardan las últimas 300 facturas de compra.** Cada factura nueva borra la más vieja
  (`app/04e…:1485`, `slice(0, 300)`), y el borrado se riega a todos los equipos. Contabilidad, el IVA descontable y el
  historial de costos salen de ahí: los meses viejos cambian. Las fotos quedan guardadas pero nada apunta a ellas.
- **B2 ·** El registro de entradas de inventario se recorta igual (5.000 → 4.000).
- **B3 · Una foto de factura muy grande no sube y no avisa** (más de 6 millones de caracteres): queda solo en el celular
  que la escaneó.
- **A2/A3 · Borrar una venta la quita del todo** (queda un hueco en la numeración, sin fila «anulada»). «Borrar historial
  de un día» no deja rastro, ni nota en la DIAN, ni devuelve inventario.
- **A4 · «Corregir» cambia la venta cerrada en su sitio** y no guarda cómo estaba: cambian cierres y meses ya entregados.
- **A1 · Solo las cuentas de mesa reciben número de factura.** Mostrador, rápidas, domicilios, la caja y los pagos por
  persona quedan sin consecutivo (si la DIAN no está prendida).
- **A5 ·** La cola de envío a la DIAN vive en un solo celular: si se daña, la venta queda «enviando».
- **A6/A7 ·** Un número se puede repetir si se devuelve el contador; una venta borrada puede volver desde un equipo viejo.

## Difícil de encontrar
- **A8/A9 · La pantalla «Facturas» no tiene buscador.** Solo «Todos / Pagaron / Deben» y «Ver 60 más». La fila no muestra
  el número, la forma de pago ni el documento de la DIAN. No hay fecha, mes ni agrupación por día.
- **A10 ·** Sí hay un buscador, escondido en la caja («Recibos»), y solo mira las últimas 800 ventas.
- **A11 ·** Se exporta un solo archivo, por producto, sin número de factura ni estado de la DIAN.
- **B6/B7 ·** El proveedor es texto libre («Coca Cola» y «Coca-Cola FEMSA» son dos). No hay «pagada / por pagar». La
  búsqueda de compras no filtra por valor, fechas ni mes.
- **A12/B8 ·** Nada se archiva: todo el negocio viaja en un solo documento que crece con cada venta y cada compra.

## Mejoras, en orden
| # | Prioridad | Qué vería el dueño | Tamaño | ¿Cambia datos? |
|---|---|---|---|---|
| 1 | P1 | Las facturas de compra viejas dejan de borrarse | Pequeño | No (lo ya recortado no se recupera del documento; mirar respaldos) |
| 2 | P1 | Aviso «foto sin subir» y reintento | Mediano | Solo agrega |
| 3 | P1 | Una venta anulada queda en la lista como «ANULADA», con quién, cuándo y por qué | Mediano | Solo agrega un campo |
| 4 | P1 | «Borrar un día» pasa a ser «anular el día», con rastro | Pequeño | No |
| 5 | P1 | Una venta corregida muestra «antes / después» | Mediano | Solo agrega |
| 6 | P1 | Todas las ventas con número; aviso si el contador se pone en uno ya usado | Pequeño a mediano | No. **Decisión del dueño o del contador** |
| 7 | P1 | «DIAN pendientes» y reintento desde cualquier equipo | Mediano | No |
| 8 | P2 | Buscador en «Facturas» (número, cliente, mesa, producto, valor, fecha), filtros de pago y DIAN, por día con subtotal y por mes | Mediano | No |
| 9 | P2 | Libro de facturas en Excel (una fila por factura), también de compras | Pequeño | No |
| 10 | P2 | Lista de proveedores, «pagada / por pagar», compras por mes | Mediano | Solo agrega |
| 11 | P2 | Aplicar una factura repetida pide confirmar; una aplicada se puede anular (devuelve inventario y costo) | Mediano | Solo agrega |
| 12 | P1 (grande) | Archivo por meses en el servidor: la app sigue rápida con miles de facturas | Grande, con su propio plan | Solo agrega |

## Lo que ya estaba en el plan
- El archivo por meses (12) es «archivar las ventas viejas» de `POS-COMPLETO.md` §6 y §6c; hay que extenderlo a compras.
- 3, 5 y B1 comparten raíz con §6c punto 4 («una devolución no debe cambiar un mes ya entregado al contador»).
- El resto es nuevo frente a `AUDITORIA-1.95.3.md`.

## Por dónde empezar (recomendación del revisor)
1. Dejar de borrar las compras (1) y avisar la foto que no subió (2).
2. Anular en vez de borrar y guardar el «antes» al corregir (3, 4, 5).
3. Buscador y días en «Facturas» (8) con el libro en Excel (9): es lo que el dueño pidió con «mejor organizado».
