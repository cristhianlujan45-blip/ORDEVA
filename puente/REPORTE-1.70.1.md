# ORDEVA 1.70.1 · Entrar en otro dispositivo ya no reinicia ni borra las cuentas

**Reporte del dueño:** «cuando inicio sesión en otro dispositivo se me reiniciaron todas las cuentas y me borró las
cuentas».

## Qué pasaba
Al entrar con el correo en un equipo que ya había tenido la cuenta (por ejemplo, después de «Cerrar sesión»), ORDEVA
juntaba la copia que tenía guardada ese equipo con la de la nube.

- **El problema:** la juntaba **sin la copia de referencia**, es decir, sin saber qué había sincronizado ese equipo la
  última vez.
- **Lo que pasaba entonces:**
  - Las cantidades se **sumaban**: la cuenta de la mesa 1 con 4 Águila quedaba en **7** (las 3 de la copia vieja más
    las 4 de la nube).
  - Las cuentas que ya se habían **cobrado volvían a aparecer**.
- **Lo más grave:** esa mezcla se **subía y pisaba a todos los equipos**, así que las cuentas abiertas quedaban con
  números equivocados en todas partes.

Se reprodujo contra el servidor de pruebas (PostgreSQL real): con la 1.70.0 fallaron 11 de 16 revisiones.

## Qué se cambió (`nube/vento-nube.js`, `vincular`)
- **Con la copia de referencia del equipo** (lo último que sincronizó con ese negocio; se guarda aunque se cierre la
  sesión):
  - se hace la mezcla de 3 vías de verdad;
  - solo se conserva lo que ese equipo cambió y la nube no tiene;
  - nada se suma dos veces y nada revive.
- **Sin la copia de referencia** (por ejemplo, se borró el almacenamiento del navegador):
  - **manda la nube**;
  - del equipo solo se agregan las ventas, cierres, compras y gastos que la nube no tiene, así que no se pierde una venta
    hecha sin internet.
- **Siempre:** antes de poner los datos queda un punto de restauración local («antes de la nube»).
- **Lo propio del equipo** se sube después por partes, como cualquier cambio.
- **Sin cambios:** un celular nuevo o sin nada propio sigue bajando los datos de la nube tal cual.

## Pruebas
- **`pruebas/loginotro.test.js`** (nueva, en CI): 21 revisiones en 7 casos. Celular nuevo, volver a entrar con copia vieja,
  equipo con otro negocio, recargar, cuenta cobrada que no debe revivir, lo hecho sin internet antes de cerrar sesión, y
  lo mismo sin copia de referencia.
  - Con la 1.70.0: 5 bien y 11 mal.
  - Con la 1.70.1: 21 bien.
- **Pruebas de servidor y entrada** (todas las que usan el servidor de pruebas) y la caja (`cajapro`): ver el mensaje de
  la publicación.

## Si a alguien ya le pasó
- **En la nube:** quedan respaldos automáticos, uno por hora, los últimos 48. Los restaura el soporte de ORDEVA (no están
  en la app del dueño).
- **En el equipo que entró:** quedó un punto de restauración «antes de la nube» en Ajustes → «💾 Respaldo y transferir
  datos».
- **Antes de restaurar:** restaurar devuelve los datos de ese momento, así que conviene revisar primero las ventas hechas
  después.
