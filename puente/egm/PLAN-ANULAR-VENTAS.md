# Plan · Anular en vez de borrar, y guardar el «antes» al corregir (punto 6 del «hazlo»)

**De dónde sale:** `AUDITORIA-1.98-FACTURAS.md`, hallazgos A2, A3 y A4 (mejoras 3, 4 y 5 de su tabla).
**Estado:** plan para revisión goldfish. No hay código todavía.

## El problema hoy
- **Borrar una venta** (`app/28-corregir-liberar-borrar.js`, `borrar`) la saca de `data.history`. No queda fila, solo un
  renglón de texto en la actividad del equipo. Queda un hueco en la numeración.
- **«Borrar historial de un día»** (`app/04g…`, `deleteHistoryDay`) saca todas las ventas y los cierres del día. No deja
  rastro ni en la actividad del equipo.
- **Corregir** (`corregir`) cambia la venta en su sitio y solo marca `h.corregida = {t, por}`. Cómo estaba antes queda
  solo como texto en la actividad del equipo.

## Lo que el dueño va a ver
1. En Facturas, un filtro nuevo **«🚫 Anuladas»** junto a Todos / Pagaron / Deben. Ahí salen las ventas borradas, con
   «ANULADA», quién, cuándo y por qué. Son de solo lectura: se pueden abrir y ver, no corregir ni borrar.
2. Al borrar una venta se pregunta **el motivo** (opcional, una línea). El botón pasa a decir «🚫 Anular».
3. «Borrar historial de un día» pasa a decir **«Anular las ventas de un día»**: las ventas quedan en «Anuladas» con el
   motivo «día anulado». Los cierres de caja de ese día se guardan también ahí (para poder consultarlos).
4. Una venta corregida muestra en su detalle **«✏️ Corregida el … por …: antes … ($X) → ahora … ($Y)»**, una línea por
   cada corrección.
5. El libro de facturas en Excel trae una columna **«Estado»** (vacía, «Corregida» o «ANULADA»); las anuladas solo salen
   al descargar con el filtro «Anuladas».

## Decisión de diseño: las anuladas viven aparte
Las ventas anuladas **no se quedan en `data.history`**. Pasan a una lista nueva `data.anuladas`.

- **Por qué:** `data.history` se suma en muchos sitios (cierres, estadísticas, contabilidad, motor financiero, Laya, las
  tablas del servidor que se llenan desde el documento). Dejar la venta ahí con una marca obligaría a tocar todas esas
  sumas, y una que se olvide contaría plata anulada como vendida. Con la lista aparte ninguna suma cambia.
- **Forma de cada registro:** `{ id: 'an-' + idDeLaVenta, t, por, como, motivo, tipo: 'venta' | 'cierre', venta: {…copia…} }`.
- **Entre equipos:** el documento ya junta por `id` cualquier lista cuyos elementos tienen `id`
  (`nube/vento-nube.js`, «lista con id»). `data.anuladas` no necesita cambios en el servidor.
- **Sin tope:** no se recorta (la lección de las 300 facturas de compra). El archivo por meses, cuando exista, la incluye.
- **Correcciones:** `h.correcciones = [{ t, por, antes: { items, total, payments, debt } }]`, un campo más en la venta.
  `h.corregida` se sigue escribiendo igual (hay código que lo lee).

## Lo que NO cambia
- El inventario: anular una venta sigue devolviendo lo vendido (igual que hoy); anular un día sigue sin devolverlo (igual
  que hoy; se avisa en el texto de confirmación).
- La DIAN: se siguen llamando `ventoDian.alBorrar` y `alCorregir` igual que hoy.
- Los permisos: dueño y administrador directo; el equipo con la clave de autorización.
- Los totales, cierres y estadísticas: una venta anulada deja de contar, igual que hoy una borrada.
- «Liberar» una venta (vuelve a la mesa para cobrarla bien) no es una anulación: no deja registro en «Anuladas».

## Riesgos que veo
- **Un equipo con la versión vieja** no conoce `data.anuladas`: la conserva al juntar (no la toca) pero sus borrados
  siguen sin dejar registro hasta que se actualice.
- **Una venta borrada puede volver desde un equipo viejo** (hallazgo A7). Este plan no lo arregla. Posible paso
  siguiente: al aplicar datos, quitar de `history` lo que esté en `anuladas`. Lo dejo fuera para no tocar la fusión.
- **Tamaño:** anular un día con 200 ventas mueve 200 registros; el documento no crece (pasan de una lista a otra).
- **«Restablecer todo»** y **restaurar un respaldo** deben limpiar o traer `data.anuladas` como el resto.
- **Quien solo ve «hoy»** no debe ver el filtro «Anuladas» de otros días.

## Pruebas previstas
- Anular una venta: sale de la lista normal, aparece en «Anuladas» con quién, cuándo y motivo; el inventario vuelve; los
  totales del resumen bajan; la actividad del equipo lo anota.
- Anular un día: ventas y cierres pasan a «Anuladas»; el día desaparece del resumen.
- Corregir dos veces: dos líneas «antes → ahora» en el detalle; totales correctos.
- Libro en Excel con la columna «Estado».
- Empleado con clave: puede anular; sin permiso de historial completo no ve «Anuladas» de otros días.
- «Restablecer todo» deja `data.anuladas` vacía.
- Las pruebas que ya hay de corregir, liberar, borrar y cierre de caja siguen pasando.

## Preguntas para el revisor
1. ¿Lista aparte (`data.anuladas`) o marca en la misma venta? ¿Ves un sitio donde la lista aparte falle?
2. ¿Guardar los cierres de caja del día anulado en la misma lista es buena idea, o mejor no dejar borrar cierres?
3. ¿Falta algún sitio que lea `h.corregida` o que dependa de que la venta desaparezca del todo?

## Revisión goldfish del plan (14/11)
**Veredicto: «no está listo».** Sin bloqueantes; la lista aparte es la decisión correcta y la fusión y el servidor la
aceptan tal cual (no hay lista blanca de claves ni tope; las tablas del servidor solo leen `history` y `closures`).
Seis mayores, que entran al plan así:

- **M1 · Equipo sin copia base** (`nube/vento-nube.js:963`, `REGISTROS`): agregar `'anuladas'`, y quitar de `history`
  toda venta cuyo id esté en `anuladas` (ahí y al cargar). De paso cierra el hallazgo A7 (la venta borrada que vuelve).
- **M2 · Corregir hasta dejar 0 productos** hoy borra la venta sin registro (`app/28…:129`): pasa a ser una anulación con
  motivo «corregida a cero».
- **M3 · DIAN:** la respuesta de la nota crédito busca la venta solo en `history` (`nube/vento-dian.js:123-137`): debe
  buscar también en `anuladas[].venta`.
- **M4 · Ids:** `'an-v-' + id` para ventas y `'an-c-' + id` para cierres; si falta el id, uno generado. Se insertan al
  comienzo de la lista.
- **M5 · La pantalla trabaja por índice de `data.history`:** las anuladas llevan su propia rutina de pintado, por id, sin
  botones de corregir ni borrar, y la pantalla vacía no debe tapar «Anuladas».
- **M6 · El rastro lo puede borrar el mismo equipo auditado.** Protegerlo exige un cambio en el servidor
  (`datos_proteger_equipo`). **Queda fuera de esta entrega y es decisión del dueño**; mientras tanto, la actividad del
  equipo (que sí está protegida) sigue anotando cada anulación.

Menores que entran: saneado al abrir (`app/12…:3168`, `app/04a…:313`); anular un día pasa por la autorización, la
actividad del equipo y `ventoDian.alBorrar` por cada venta; la confirmación avisa que un abono ya recibido de un fiado no
se devuelve solo; un día que ya tiene cierre de caja pide una confirmación más fuerte.
