# ORDEVA 1.99.24 · Auditoría de los fiados: las personas que deben quedan guardadas con su nombre

**Pedido del dueño (20/11):** «hazme una auditoría de cómo se están guardando las personas que están debiendo y la libreta
de los fiados… no están quedando bien guardados cuando abro… revisa la aplicación, corrige los demás errores».

## Lo que se encontró en el negocio real (diagnóstico nuevo, solo lectura y sin nombres)
Se usó `.github/workflows/diagnostico-fiados.yml` con Tienda Vito (adc9bb00). Revisa el negocio de hoy y los 50 respaldos
de la nube.

- **En la nube no se perdió ningún fiado.**
  - La libreta tiene 3 apuntes de 2 personas ($26.525), igual desde el 13/11.
  - Las cuentas que quedaron debiendo pasaron de 11 a 15 ($419.500) y nunca bajaron.
- **De esas 15 cuentas, 7 estaban sin el nombre de quien debe.** En la libreta salían todas juntas como «Sin nombre» o con
  el nombre de la mesa. Esto es lo que se veía al abrir.
  - **Causa:** cuando una persona de la mesa quedaba debiendo desde su cuenta, el fiado guardaba solo su número de persona.
    Ese número se borra al cerrar la mesa.
  - Además, si dos personas de la mesa quedaban debiendo, todo se le cargaba a una sola.
  - Un pago de alguien así («Juan me pagó 5000») lo dejaba en **−$5.000**, porque la app no sabía que Juan debía.
- **«negocioCodigo» se guardó 274 veces en 2 h 20 min**, unas 1.300 versiones en un día sin ventas.
  - Dos celulares tenían códigos de negocio distintos (uno estuvo conectado a otro negocio) y se lo cambiaban entre sí sin
    parar.
  - Cada vuelta era una subida y una mezcla de datos entre los equipos. Junto con lo arreglado en 1.99.23, podía hacer que
    algo anotado en un celular se pisara.

## Qué cambia
1. **Al cerrar la mesa** (`app/04a`):
   - El fiado de cada persona queda con su nombre.
   - Si toda la deuda es de una sola persona, la cuenta queda a su nombre.
   - Si además quedó un saldo sin registrar, ese saldo no se le carga a ella.
2. **Libreta** (`app/13`):
   - Cada persona debe lo suyo, aunque en la misma cuenta deban varias.
   - Los abonos bajan solo lo de quien pagó.
   - Los abonos viejos, que no dicen de quién son, se cuentan como antes: para la primera persona.
   - Lo que no tiene nombre va aparte.
   - **Las cuentas viejas sin nombre** salen cada una aparte, con su mesa, su día y su hora. Tienen **«✏️ ¿Quién es?»**: se le
     pone el nombre y queda guardado en la cuenta, en todos los equipos.
   - «Borra lo último» borra el apunte más reciente por fecha. Antes borraba el último de la lista, que con varios equipos
     puede ser otro.
   - Los últimos apuntes salen por fecha.
3. **Corregir una venta y las devoluciones** (`app/28`, `lib/vento-inventario.js`):
   - Lo que ya se abonó de una deuda sigue abonado.
   - Antes la deuda se volvía a sacar solo de los pagos fiados, y lo ya pagado volvía a deberse. Esto pasaba también antes
     de esta versión.
4. **Historial** (`app/04g`):
   - Muestra a todos los que quedaron debiendo, no solo a uno.
   - Los nombres escritos se muestran como texto, sin ejecutarse.
5. **Código del negocio** (`app/12`):
   - Manda el que viaja con los datos del negocio.
   - Si hay una suscripción vigente en los datos para el código de un celular, se queda ese, y todos los equipos llegan al
     mismo.
   - Si la suscripción está solo en un celular, ese celular la usa, pero no cambia el código de los datos.
   - Así no hay ida y vuelta, y no se pierde una suscripción.

## Revisión independiente (goldfish)
- **Mayor:** con una persona que debía lo suyo y el resto de la mesa sin registrar, todo se le cargaba a esa persona.
  → Lo sin nombre va aparte.
- **Mayor:** los abonos hechos con la versión anterior se le restaban a otra persona. → Se cuentan para la primera, como
  antes.
- **Menores corregidos:**
  - Dos cuentas sin nombre de la misma mesa y el mismo día se juntaban. → Ahora llevan la hora.
  - Al corregir o devolver aparecía una deuda fantasma. → Corregido junto con el punto 3.
  - El historial de quien queda con el resto mostraba la deuda completa.
  - El código todavía podía ir y volver con suscripciones guardadas solo en cada celular.
  - El Historial mostraba un solo deudor.
  - El Historial mostraba sin protección los nombres escritos.

## Pruebas
- **Nueva `pruebas/fiadosnombres.test.js`** (28/28). Con el código anterior falla: «Sin nombre $50.000», Juan en −$5.000.
  Cubre:
  - dos personas que deben;
  - los abonos de cada una;
  - una sola persona;
  - las cuentas viejas sin nombre, «¿Quién es?» y «Pagó todo»;
  - volver a abrir;
  - los casos de la revisión;
  - corregir y devolver con abonos;
  - el Historial;
  - el código del negocio, en 4 casos.
- **Siguen bien:**
  - `libreta`, `ventasfiados`, `cobrosimple`, `facil`, `herramientas`, `tablero`, `v189`, `vozcomandos`, `mesapersonas`, `mesa`;
  - `divtest`, `suscrip`, `suscripnube`, `adminsub`, `cajapos`, `cajapro`, `cerrarcaja`, `ordeva2pantallas`, `facilpantallas`.

## Qué hacer en el celular
Abrir 📒 La Libreta. Las cuentas que quedaron sin nombre salen como «❓ Sin nombre · Mesa · día y hora». Tocar
**«✏️ ¿Quién es?»** y escribir el nombre.
