# ORDEVA 1.65.8 · La libreta por voz, con proveedores y ordenada para la contabilidad

## Qué pidió el dueño
«Los comandos para decir cuando alguien me debe no funcionan muy bien. Dame la opción de anotar cuando le pago a un
proveedor. Todo muy bien organizado para la contabilidad del negocio.»

## Lo que fallaba (probado con 40 frases como se dicen)
| Frase | Antes | Ahora |
|---|---|---|
| «Le pagué al proveedor de Postobón 200 mil» (también Coca-Cola, Bavaria, «la factura de Alpina») | 👷 pago a un empleado llamado «Proveedor Postobón» | 📦 pago al **proveedor** Postobón, gasto de Proveedores |
| «Anota que Camilo debe 6 mil» | «Camilo 6 no te debe nada» | 📕 Camilo te debe $6.000 |
| «Súmale a Juan 5 mil» | calculadora: «+ $5.000» | 📕 se suma a la deuda de Juan |
| «José me debe 2 cervezas» | no se entendía | 📕 $7.000 (2 × Cerveza Águila, con el precio del producto) |
| «Le pagué al mesero Andrés 40 mil» | a «Mesero Andrés» | 👷 a Andrés |
| Sueldos, pagos a proveedores y fiados cobrados en la libreta | no llegaban a Contabilidad | llegan (ver abajo) |

## Nuevo: proveedores
- **📦 Pagué a un proveedor:** por voz («le pagué a Postobón 200 mil», «pagué la factura de Alpina 120 mil») o con el
  botón de la libreta. Reconoce un proveedor por palabras como proveedor, factura, pedido o mercancía, por las marcas y
  distribuidores comunes, o porque ya se le compró.
- **🧾 Le debo a un proveedor** (cuentas por pagar): «le debo a Postobón 300 mil», «me fiaron en Colanta 50 mil», o con el
  botón.
  - Pagarle descuenta lo que se le debe.
  - «Le pagué a Postobón todo» paga todo lo que se le debe.
  - Un pago cuando no se le debía nada es una compra de contado: no deja saldo a favor.
- **Preguntas:** «¿Cuánto le debo a Postobón?», «¿cuánto le debo a los proveedores?», «¿cuánto les he pagado a los
  proveedores?».
- **Factura ya escaneada:** si el pago es de una factura escaneada (mismo proveedor y valor, en los últimos 60 días), se
  enlaza. La compra ya estaba en Contabilidad y no se cuenta dos veces.
- **Pantalla de la libreta:** secciones «🧾 Le debo a proveedores» y «📦 Pagado a proveedores este mes». «Borra lo último»
  también deshace estos apuntes.

## Contabilidad
- ✅ **Fiados cobrados** con la libreta → **Entradas** («Fiado cobrado · Juan (libreta)»).
- 👷 **Pagos a empleados** → gasto **Nómina / sueldos**.
- 📦 **Pagos a proveedores** → gasto **Proveedores / mercancía**, salvo que sea una factura ya escaneada.
- Nuevos totales: **📕 Te deben hoy** (fiados de las mesas y de la libreta) y **🧾 Debes a proveedores**.

## Pruebas
- **`libreta` (nueva, 24 ✅):** fiados y pagos por voz, proveedores, cuentas por pagar, factura enlazada, contabilidad
  (entradas, nómina, proveedores, sin contar doble) y los botones nuevos.
- **Siguen bien:** `vozcomandos` 109, `vozpausas` 9, `voz1ra` 7, `mejoras` 32, `practica` 25, `facil` 47,
  `herramientas` 28 y `tablero` 26.
- **GitHub:** las pruebas usan Playwright 1.63.0, la misma versión de aquí. Con la 1.47.2, `pagostodos` y
  `equiposprobar` no podían correr. En `safari` ya no se cuentan como errores los bloqueos que hace la propia prueba.
