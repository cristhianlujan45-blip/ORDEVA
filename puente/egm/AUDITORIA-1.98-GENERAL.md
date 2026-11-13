# Auditoría 1.98 · General (qué más mejorar)

**Pedido del dueño (13/11):** «Revisa más, ¿qué más mejorarías?… haz como una auditoría». Un revisor con contexto limpio
partió del plan y de `AUDITORIA-1.95.3.md` y buscó lo que NO estaba. Leyó código; no corrió nada ni usó un celular.
**No revisó:** el menú «Más», el cierre de caja, pagos por partes, propinas ni devoluciones.
La de facturas está en `AUDITORIA-1.98-FACTURAS.md`. La de diseño quedó a medias (límite de uso) y falta.

## Hallazgos
| # | Prioridad | Qué pasa | Arreglo | Tamaño | Estado |
|---|---|---|---|---|---|
| 1 | P1 | La regla contra cobranzas de la 1.98.1 vetaba siempre: «JUAN MORA te envió $20.000» se callaba. | Solo veta si no hay una frase fuerte de pago. | Pequeño | **Hecho en la 1.98.2** |
| 2 | P1 | Otros falsos «llegó plata»: «Realizaste un abono a tu crédito», «pago recibido… tarjeta de crédito», «Recibiste 500 puntos», el aviso de ingreso a la sucursal virtual («de 2026» leído como $2.026). | Los verbos flojos (abono, ingreso, recepción) piden destino («a tu cuenta»); el valor sin signo no va después de «de» + año ni antes de «puntos». | Mediano | Nuevo |
| 3 | P1 | Lo que el dueño paga se anota dos veces si el banco manda aviso y SMS. | Emparejar por valor en unos 3 minutos. | Pequeño | Nuevo |
| 4 | P1 | Por qué no se anotan salidas: formatos «Compra por $…», «Transferencia por $…» sin cubrir; una salida sin valor se pierde sin rastro; y muchas apps de banco no avisan cuando uno paga desde adentro (ahí no hay nada que leer). | Agregar formatos; guardar «sin valor, toca para ponerlo»; decirle al dueño el límite; «compartir comprobante» como respaldo. | Pequeño a mediano | En parte nuevo |
| 5 | P1 | Dos equipos que cierran la misma mesa (uno sin internet) dejan dos ventas. | La venta lleva un id fijo por cuenta abierta. | Mediano | Familia de «una sola vez» del plan |
| 6 | P2 | «Detener» en la notificación permanente apaga el fondo para siempre: un toque sin querer y los avisos solo llegan al abrir la app. | Quitar el botón mientras la lectura de pagos esté prendida, o que dure hasta abrir la app; aviso rojo en Ajustes → Pagos. | Pequeño | Nuevo |
| 7 | P2 | El gasto de batería invita al celular a matar la app: una consulta cada 2,5 s todo el día. | Con la conexión en vivo sana, consultar cada 30 a 60 s. | Mediano | Nuevo |
| 8 | P2 | Los avisos a los otros equipos no tienen un canal que sobreviva al ahorro de batería. | Mensaje de alta prioridad del servidor (Firebase). Va con su propio plan. | Grande | Nuevo |
| 9 | P2 | El diagnóstico no dice de dónde viene la demora. | Anotar en cada aviso: ahorro de batería, permiso de batería, segundos con la pantalla apagada y si la lectura estaba conectada. | Pequeño | Nuevo |
| 10 | P2 | La reconexión de la lectura de avisos apaga y prende el componente con el celular bloqueado (lo que el propio código dice que la corta). | Con el celular bloqueado, solo pedir reconexión. | Pequeño | Nuevo |
| 11 | P2 | La copia de seguridad de Android incluye la llave del equipo que autoriza avisos de pago. | Sacarla de la copia. | Pequeño | Nuevo |
| 12 | P2 | Las huellas de los PIN de empleados viajan en los datos compartidos (un PIN de 4 a 6 cifras se adivina sin conexión). | Revisar el PIN en el servidor, con límite de intentos. | Mediano | En parte conocido |
| 13 | P2 | Las pruebas de GitHub tardan una hora y dependen de esperas fijas. | Partirlas en 4 a 6 grupos en paralelo. | Mediano | Nuevo |
| 14 | P2 | Nada prueba el celular bloqueado de verdad. | Una lista de revisión por versión en un Samsung y un Xiaomi. | Pequeño | Plan 6c.1 |
| 15 | P3 | Todavía se ve «Vento» en el registro de pagos y otros textos. | Cambiar el texto. | Pequeño | Nuevo |
| 16 | P3 | ntfy: no queda ninguna dependencia viva (solo un alias para QR viejos). | Nada. | — | Confirmado |
| 17 | P3 | Cada guardado escribe todo el documento; tres librerías bloquean el arranque. | `defer` en las tres ya; el fondo es archivar (ver facturas). | Pequeño ahora | Conocido |

## Avisos con el celular bloqueado: qué se puede y qué no
- **Se puede en el código:** 6, 7, 9 y 10; un recordatorio permanente si falta el permiso de batería; y 8 (con su plan).
- **Ya está bien:** el servicio permanente, la lectura directa de SMS y la voz no dependen de la página.
- **Solo lo puede hacer el dueño en el celular:** batería «sin restricciones» para ORDEVA **y para Nequi y DaviPlata** (si
  el celular las duerme, su aviso llega tarde y ORDEVA no tiene qué leer); inicio automático en Xiaomi, Oppo, Vivo, Huawei
  y Samsung; no tocar «Detener» ni cerrar ORDEVA desde el panel de apps activas.
- **Nadie de ORDEVA lo puede cambiar:** la prioridad con la que el banco manda su aviso. El SMS es el único camino que no
  espera, y ya se lee directo.

## Recomendación del revisor
Las reglas de pagos son siete listas de palabras copiadas a mano en el celular y en la página, y cada arreglo agrega
palabras que crean nuevos errores. Antes de agregar más: una sola colección de avisos reales que lean las dos pruebas, y
«vetar solo si no hay frase fuerte».
