# ORDEVA 1.99.1 · Anular en vez de borrar, y el «antes» de cada corrección

**Pedido del dueño:** punto 6 del orden aprobado con «Hazlo» (auditoría de facturas, hallazgos A2, A3 y A4).
**Plan y revisión:** `puente/egm/PLAN-ANULAR-VENTAS.md`.

## Qué cambia para el negocio
- **Una venta ya no se borra sin rastro: se anula.** Sale de las ventas (deja de contar en todos los totales, igual que
  antes) y queda guardada en **Facturas → «🚫 Anuladas»**, con quién la anuló, cuándo y por qué.
- Al anular se pregunta **el motivo** (opcional). El botón de cada venta ahora dice «🚫 Anular».
- **Las anuladas son de solo lectura:** se abren y se ven; no se corrigen ni se vuelven a anular. Se pueden buscar (también
  por motivo), filtrar por mes y descargar en Excel con la columna «Estado = ANULADA».
- **Una venta corregida muestra cómo estaba antes:** «✏️ Corregida el … por …: antes … ($X) → ahora … ($Y)», una línea
  por cada corrección.
- **Corregir hasta dejar 0 productos** ya no borra la venta en silencio: queda anulada con el motivo «corregida a cero».
- **«Borrar historial de un día» ahora es «Anular las ventas de un día».** Las ventas y los cierres de caja de ese día
  pasan a «Anuladas»; pregunta el motivo, avisa si el día ya tenía cierre de caja y queda en la actividad del equipo.
  **Sigue reservado al proveedor de ORDEVA**, como antes.
- **Una venta anulada no vuelve como vendida** aunque otro equipo todavía la tuviera guardada.

## Lo que NO cambia
- Los totales, los cierres y las estadísticas: una venta anulada deja de contar, igual que antes una borrada.
- El inventario: anular una venta devuelve lo vendido; anular un día no lo devuelve (igual que antes, y ahora lo avisa).
- La DIAN: anular una venta pide la nota crédito igual que antes; su respuesta ahora se anota también en la copia anulada.
  **Cambio:** «anular un día» ahora SÍ pide la nota crédito de cada venta del día (antes las borraba sin nota). La
  confirmación lo dice.
- Los permisos: dueño y administrador directo; el equipo con la clave de autorización.
- El servidor y la app Android: sin cambios.

## Cómo quedó hecho
- Las anuladas viven en una lista aparte del documento (`data.anuladas`), no en las ventas. Así ninguna suma cambia.
- No se recorta. Se junta entre equipos como las demás listas.
- De paso: se corrigió un error escondido de la ventanita de corregir (después de corregir una venta, escribir en la
  ventanita de la clave o del motivo lanzaba un error interno).

## Queda pendiente (decisión del dueño)
- **Proteger la lista de anuladas en el servidor.** Hoy alguien del equipo con conocimientos técnicos podría quitar un
  registro de esa lista. La actividad del equipo, que sí está protegida, sigue anotando cada anulación.
- **¿El dueño debe poder anular un día?** Hoy solo el proveedor. Como ahora deja rastro, podría abrirse al dueño.

## Revisión goldfish
- **Del plan:** «no está listo», sin bloqueantes; 6 mayores. 5 entraron al código (equipo sin copia base, corregir a
  cero, DIAN, ids, pintado propio de las anuladas); el sexto es la protección en el servidor, pendiente de decisión.
- **Del código:** sin bloqueantes. 1 mayor y 7 menores; corregidos los que tocan plata o datos:
  - **Mayor:** en un equipo sin copia de referencia, una venta anulada en otro equipo podía volver a contar después de
    cerrar y abrir la app (lo guardado iba sin filtrar y el filtro podía no estar cargado). Ahora el filtro vive en el
    archivo de la nube, que carga primero, y lo que se guarda al aplicar datos de la nube ya va sin las anuladas.
  - Restaurar un punto viejo ya no borra el registro de anuladas ni revive una venta anulada.
  - El filtro de Facturas ya no se queda trabado en «Anuladas» (todas las ventas escondidas) al cambiar de sede.
  - Anular un día vuelve a leer las ventas y los cierres después de escribir el motivo (no se pierde un cierre que llegó
    por la nube mientras tanto).
  - Anular o corregir una venta que cambió en otro equipo mientras estaba abierta la ventanita ahora avisa en vez de
    perder la corrección en silencio.
  - Buscar por motivo no exige tildes.
  - Quedan anotados sin cambio: la fusión entre equipos puede quitar un registro de «Anuladas» si un equipo lo borra a
    mano (es la protección en el servidor, decisión del dueño); y mientras un equipo siga en 1.99.0, una venta anulada
    puede contar en su cierre hasta que se actualice.

## Pruebas
- **Nueva:** `pruebas/anularventas.test.js`, 27 bien, 0 mal (entra a la lista de GitHub).
- Las que tocan lo mismo: `facturasorden` 21, `equipoactividad` 32, `ordeva2pantallas` 20, `cerrarcaja` 26, sin fallas
  (`equipoactividad` falló una vez en un paso que no toca este cambio y pasó al repetirla).
- **Lista completa:** 136 pruebas en el navegador, 3.165 bien, 0 mal, sobre el commit e434ae1 (con los arreglos de la revisión del código). `safari` no corre aquí (no hay WebKit en esta máquina). Las pruebas del servidor no se repitieron: este lote no toca el servidor.
- **No se probó** en un celular de verdad, ni con dos equipos reales a la vez, ni con la DIAN de verdad.
