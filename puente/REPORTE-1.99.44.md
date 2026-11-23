# ORDEVA 1.99.44 — Auditoría del mapa del local: mesas en tiendas, habitaciones en hoteles

Pedido del dueño (23/11): «haz una auditoría al mapeo del local; mira la opción de agregarle mesas, para bares o tiendas que
tienen mesas, cigarrerías, y para hotel serían habitaciones».

## Lo que se encontró
1. **Tiendas, cigarrerías, licoreras, agropecuarias:** no se podían poner mesas en el plano (el botón «➕ Mesa» no salía),
   aunque muchas tienen mesas para tomarse algo.
2. **Nombres cortados:** «DJ / Tar…» en el bar; «A…» (ascensor) y «Es…» (escaleras) en el hotel; «Habitación 1» no cabía
   en la habitación.
3. **Hotel con pocas habitaciones:** quedaban pegadas a las esquinas.
4. En una tienda, la app cambiaba la palabra «Mesa» por «Cuenta» también en los NOMBRES que pone el dueño.

## Lo que se arregló
- **«➕ Mesa» en tiendas:** pone una mesa en el plano usando una cuenta libre (sin productos ni nombre) y le pone «Mesa 1,
  Mesa 2…»; si no hay libres, crea una cuenta nueva. Las cuentas con productos o con nombre no se tocan. Al tocar la mesa en
  el plano se abre su cuenta para venderle.
- **«📤 Quitar del plano»:** saca la mesa del plano sin borrar la cuenta ni lo que tenga. «↩ Deshacer» la devuelve.
- **Plantilla nueva «🏪 Tienda con mesas»** (sugerida en tienda de barrio y cigarrería/licorera): góndolas, neveras, caja,
  baños, entrada y 4 mesas.
- La plantilla «🛒 Tienda» sigue sin mesas (solo el local).
- **Formas de mesa en tiendas:** cuadrada, redonda, rectangular, alta/barra, con sombrilla y puesto.
- **Hoteles:** «➕ Habitación»; las habitaciones dicen «Hab. 101» completo; ascensor y escaleras más grandes; con pocas
  habitaciones quedan centradas a lado y lado del pasillo.
- **Ningún nombre cortado:** si no cabe en una línea pasa a dos; si tampoco, queda el ícono (el nombre completo al tocarlo).
- Los nombres de las mesas y cuentas que pone el dueño ya no se cambian («Mesa 1» sigue «Mesa 1» en una tienda).

Restaurantes y bares: sin cambios en sus mesas (todas siguen en el plano).

## Pruebas
- Nueva: `planomesas1944` (15/15): cigarrería con «Tienda con mesas», tocar una mesa abre su cuenta, agropecuaria con 10
  cuentas («➕ Mesa» usa la libre, no toca la que tiene productos ni la de «Camila»), quitar del plano y deshacer, hotel,
  bar y restaurante.

# 1.99.45 — Mapa: un toque desde «Vender» y entero en la pantalla
- Tienda / cigarrería con mesas en el plano: en «Vender», junto a «📊 Caja de hoy» y «📒 Fiados», sale «🗺️ Mesas · N
  ocupadas», que abre el mapa en un toque (antes: Más → Mapa del local).
- Tableta y computador: el plano cabe entero en la pantalla (en un computador medía 840 px de alto y había que bajar para ver
  la entrada). «🔍 Acercar» sigue agrandándolo.
- Prueba `planomesas1944` 18/18.
