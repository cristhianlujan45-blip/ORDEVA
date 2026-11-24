# ORDEVA 1.99.52 — Un pago por SMS ya no vuelve a sonar cuando llega el siguiente

## La causa real del «me sonó 3.500 y después 1.400 que habían puesto antes» (23/11)
Registros del servidor de esa franja (sin nombres): en el Samsung los pagos de Nequi llegan por SMS (código 890806).
- 3:31:29 p. m. llega el SMS de $1.400 → se toma y suena (bien).
- 3:37:36 p. m. llega el SMS de $3.500 → suena (bien).
- 3:37:41 p. m. el de $1.400 se toma OTRA VEZ (mismo texto, misma hora del banco 3:31) → sonó y quedó anotado dos veces.
Igual con $6.000 (3:25 → otra vez 3:28) y $8.100 (3:28 → otra vez 3:30).

Por qué: el SMS llega por dos lados (directo y en el aviso de la app de mensajes). El lector directo dejaba una marca para
que el aviso no lo repitiera, y el aviso la GASTABA. Cuando llegaba el SMS siguiente, la app de mensajes volvía a publicar la
conversación con el SMS anterior; ya no había marca y ese pago viejo se tomaba como nuevo.

Arreglo: cada mensaje de la conversación (su hora + su texto) se maneja una sola vez. Dos pagos iguales de verdad (dos SMS
de $1.400 a distinta hora) siguen sonando los dos.

## Pruebas
- Android (sin celular): 380/380, con el caso real (antes: «1400, 3500, 1400, 3500»; ahora «1400, 3500»). Sin el arreglo la
  prueba falla.

## Diagnósticos nuevos (solo lectura)
- `diagnostico-pagos`: ventana de tiempo de un negocio (eventos y pagos con hora del banco y del celular, sin nombres).
- `diagnostico-formatos`: ¿se escapó un pago? (avisos no entendidos por las reglas, solo palabras clave, nunca el texto).
- `diagnostico-fiados`: integridad de los datos y qué parte pesa más.

# 1.99.53 — Auditoría de la Caja POS y de Laya
- **Caja POS (un día simulado en la agropecuaria):** efectivo con vueltas, pago mixto, descuento 10 % y fiado a Tania →
  FV-0001 a FV-0004, inventario descontado, caja $88.000, Contabilidad $73.000 vendido / $15.000 por cobrar / costo
  $49.000. Todo cuadra, sin errores.
- **Laya («no debe inventar cifras»):** a «¿cuánto hay en caja?» respondía $73.000 (TODO lo vendido, con transferencias y
  fiado). Ahora dice el efectivo del cajón: «En la caja debe haber $88.000 en efectivo: base $50.000 + ventas en efectivo
  $38.000», y aclara que lo de transferencias y lo fiado no está en la caja. Sin caja abierta, el efectivo que entró.
- «¿Cuánto vendí hoy?» decía «4 cuentas cobradas» aunque una quedó fiada: ahora «4 ventas (de eso $15.000 quedó fiado)».
- «¿Cómo va todo?» decía «0 facturas este mes» (eran las de proveedor): ahora «facturas de proveedor».
- Aviso «el equipo de la música no da señales»: se recuerda en el equipo (antes volvía a salir a los 5 min de abrir ORDEVA).
- Pruebas: `laya1953` 6/6 (nueva), musicaautoplay 13, layafinanzas 10, vozcomandos 109, guia 47, resumendia 7, agencia 13,
  musicaanuncios 22, pagosguia 29, proveedores 8.
