# ORDEVA 1.99.28 · Un solo sistema de botones (colores, bordes y esquinas)

## Pedido del dueño (22/11): «Continúa con lo de los colores de los botones»
Última parte del hallazgo 7 de la auditoría de diseño (ver `puente/AUDITORIA-DISENO-1.99.27.md`, punto pendiente).
Solo cambia la apariencia **ORDEVA 2.0** (`body.o2`, en `lib/ordeva2.css`). No cambia ningún texto, función ni dato.

### Cómo se midió
Se midieron los 322 botones de 15 pantallas (fondo, letra, borde y esquina). Había 66 combinaciones distintas.

### Qué estaba mal y cómo queda
| Botón | Antes | Ahora |
|---|---|---|
| «Cerrar» / «✕» (ventanas y Caja POS) | borde negro, letra gris, esquina 10 px | borde gris claro como los demás, letra oscura, 12 px |
| «📷 Tomar foto / subir imagen» | degradado gris con sombra, 14 px | blanco con borde claro, 12 px |
| Botón negro, botón claro, «Eliminar» | 10 px | 12 px (la misma esquina para todos) |
| Periodos de Inicio (Hoy · 7 días · Mes · Fechas) | cuadrados de 9 px | píldoras, como los demás periodos |
| Enlaces de las tarjetas («Contabilidad ›») | azul | oscuro y subrayado |
| «Eliminar» de cada producto | otro rojo | el mismo rojo de «Eliminar» |
| Acciones de cada producto, herramientas y botones de arriba de la Caja POS | 9–10 px | 12 px |

Se dejaron como están, a propósito: las tarjetas y mosaicos (Mesas, «Más», Ajustes, Música), que no son botones;
las píldoras (filtros, categorías) y el botón de «Renombrar mesa» (8 px, va dentro del título).

### Comprobado
- Fotos de antes y después en Inicio, Productos, cuenta de la mesa, «Producto nuevo» y Caja POS.
- **Prueba nueva:** `pruebas/botones1928.test.js` (10/10 con el cambio; sin el cambio falla en 8 de 10).
- Pruebas de diseño y pantallas: ver el resultado en la sección de abajo.

### Resultado de las pruebas (en este contenedor)
- diseno199 50/50 · diseno1927 14/14 · apariencias 16/16 · facilpantallas 28/28 · libreta 24/24 · mesa 51/51
- cajapos 27/27 · musicaqr 26/26 · tablero 26/26 · productomesa 7/7 · botones1928 10/10
- ordeva2pantallas 20/20: la revisión 7 exigía **exactamente** 10 px en «Anular las ventas de un día»; ahora es 12 px
  como todos los botones. Se cambió para que pida una esquina redondeada (10 px o más), que es lo que revisa.
- ordeva2: aquí se cae al recargar con el tema de halloween, **igual sin este cambio** (con la 1.99.27 tal cual).
  En GitHub pasó con la 1.99.26. Queda para revisar en GitHub con esta versión.
