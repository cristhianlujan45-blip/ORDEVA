# ORDEVA 1.70.1 · Entrar en otro dispositivo ya no reinicia ni borra las cuentas · el texto se ve en todos los diseños

Tres arreglos:
1. Entrar en otro dispositivo ya no reinicia las cuentas abiertas.
2. Lo que se escribe se ve en todos los diseños.
3. La actividad del dueño no se pierde cuando llegan datos de otro equipo.

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

## 2. «Cuando voy a poner el nombre o escribir un texto, no se ve el texto»
- **Qué pasaba:** varios campos tenían el fondo **blanco fijo** (`#fff`) pero la letra del diseño (`var(--ink)`). En los
  diseños oscuros la letra es clara, así que quedaba letra clara sobre blanco.
- **Dónde:**
  - Renombrar mesa y la ficha del producto (15 campos);
  - las listas al agregar, el buscador de productos y sus sugerencias;
  - elegir persona, cerrar la cuenta y el nombre de la pantalla de preparación.
- **Arreglo:** el fondo ahora es el del diseño (`var(--surface-2)`). El recibo para imprimir sigue blanco a propósito.
- **Prueba nueva `contraste`** (en CI):
  - revisa el contraste de TODOS los campos (298) en los 16 diseños, también los de las ventanas de la caja;
  - con la 1.70.0 fallaban todos los diseños oscuros; con la 1.70.1 pasan los 16.

## 3. «📜 Actividad del equipo» no perdía cambios del dueño
- **Qué pasaba:** con la sincronización de menos de 1 s, los datos de otro equipo podían llegar en los 0,3 s entre un
  cambio de este celular y su anotación. Ese cambio (ej. «Precio cambiado») no quedaba en la actividad.
- **Arreglo:** antes de poner los datos que llegan se anota lo pendiente (`app/30-actividad-equipo-huella.js`).
- **Prueba:** `equipoactividad`:
  - con la 1.70.0, 0 fallas en 3 corridas;
  - con el arreglo de la entrada y sin este, 3 fallas en 6 corridas;
  - con este arreglo, 4 de 4 bien.
  - No es seguro que la diferencia venga del arreglo de la entrada: esta prueba no vuelve a entrar en ningún equipo y
    las muestras son pequeñas.

## Si a alguien ya le pasó
- **En la nube:** quedan respaldos automáticos, uno por hora, los últimos 48. Los restaura el soporte de ORDEVA (no están
  en la app del dueño).
- **En el equipo que entró:** quedó un punto de restauración «antes de la nube» en Ajustes → «💾 Respaldo y transferir
  datos».
- **Antes de restaurar:** restaurar devuelve los datos de ese momento, así que conviene revisar primero las ventas hechas
  después.
