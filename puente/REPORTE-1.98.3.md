# ORDEVA 1.98.3 · Primer lote de las auditorías: compras que no se borran, avisos de pago y arreglos de diseño

**Pedido del dueño:** después de las tres auditorías (`puente/egm/AUDITORIA-1.98-FACTURAS.md`, `-GENERAL.md`, `-DISENO.md`)
y de proponerle el orden: «Hazlo».

## 1. Facturas de compra
- **Ya no se recortan a 300.** Antes cada factura nueva borraba la más vieja en todos los equipos, y con ella cambiaban los
  gastos, el IVA descontable y el historial de costos de los meses pasados.
  - Lo que ya se había recortado antes de esta versión no vuelve solo (habría que mirar un respaldo).
  - El documento del negocio crece más: por eso el archivo por meses queda más urgente (va con su propio plan).
- **Una foto pesada ya no se queda sin subir en silencio.** A la nube va una copia más liviana (el celular conserva la de
  alta calidad). Si ni así cabe, sale un aviso.

## 2. Avisos de pago
- **«Detener» ya no apaga el fondo para siempre.** Con la lectura de pagos prendida, el botón desaparece de la notificación
  permanente; y si llega la orden, el fondo vuelve al abrir ORDEVA. Antes un toque sin querer dejaba los avisos llegando
  solo al abrir la app.
- **El registro de Ajustes → Pagos dice cómo estaba el celular cuando un aviso se demoró:** en ahorro de batería, ORDEVA
  sin el permiso de batería, hace cuántos minutos se apagó la pantalla, y si la lectura de avisos estaba desconectada.
- **Lo que el dueño paga no se anota dos veces** cuando el banco manda el aviso de la app y el SMS (mismo valor, menos de 3
  minutos, uno por cada camino). Dos pagos iguales por el mismo camino siguen siendo dos.
- **Otros falsos «llegó plata» cerrados:** «Realizaste un abono a tu crédito», «Pago recibido… en tu tarjeta de crédito»,
  «Recibiste 500 puntos» y el aviso de ingreso a la sucursal virtual.
- **Lo que NO se tocó, a propósito:** cómo se reconecta la lectura de avisos con el celular bloqueado. El propio código
  advierte que cambiarlo sin probar en un celular bloqueado ya dañó los avisos dos veces.
- **Para que llegue:** hay que actualizar la app Android.

## 3. Arreglos de diseño
- «Agregar» (guardar un producto) y «💳 Planes y pagos» ya no salen aplastados.
- En Cobrar, los botones de billetes ya no se cortan en el celular.
- Ajustes › Negocio ya no se ensancha más que la pantalla; «Volver a categorías» es más alto.
- El enlace de la licencia se lee en la pantalla de entrar.
- Ya no dice «Vito» ni «mesora» en los ejemplos de los campos.
- **Queda para después:** la pantalla de entrar con los colores de adentro.

## Pruebas
- Reglas de la app Android con la lectura completa simulada: 354 bien, 0 mal.
- Página: `facturascan` 35, `pagosaviso` 95, `salidas` 28, `pagosguia` 29, `confirmapago` 61, sin fallas.
- Diseño: medido en un navegador a 390 px (los 8 botones de billetes caben; «Agregar» 324 × 48; Ajustes 390 de ancho).
- **Lista completa:** RESULTADOS_AQUI
- **No se probó** en un celular de verdad.

## Lo que sigue (mismo «hazlo»)
4. Facturas mejor organizadas: buscador, por día y por mes, número y forma de pago a la vista, y el libro en Excel.
5. La cuenta de la mesa: barra de pie, sin micrófono encima, botones más grandes.
6. Anular en vez de borrar y guardar el «antes» al corregir.
