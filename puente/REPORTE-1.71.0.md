# ORDEVA 1.71.0 · La cuenta de la mesa se ve completa, sin desplazarse

**Pedido del dueño:** «cuando abro una mesa, que sea más fácil ver todos los datos, que no tenga que estar desplazándome
hacia arriba y hacia abajo… en celular, tabletas y computadores».

## Lo que pasaba
- En el computador la cuenta se abría como una columna angosta (≈ 540 px) en la mitad de la pantalla.
- Medía el **doble del alto de la pantalla**:
  - arriba quedaba lo pedido;
  - abajo, los pagos, el saldo, «Registrar un pago», compartir y cerrar.
- En la tableta pasaba igual.
- En el celular, el bloque «Registrar un pago o abono» ocupaba más de media pantalla.
- Los botones − / + de cada producto se veían como **cuadros negros** en el diseño ORDEVA 2.0, porque el fondo y el signo
  eran del mismo color.

## Lo que cambió (`lib/vento-mesa-comoda.js`, nuevo)
### Tableta y computador (desde 760 px de ancho)
La cuenta usa la pantalla y va en **dos columnas**:

| Izquierda: lo pedido | Derecha: pagos y cobro |
|---|---|
| Buscar y agregar | Pagos registrados |
| Los productos con − / + | Consumo, pagado y **saldo pendiente** |
| Total | Registrar un pago o abono, más bajo («¿Quién paga?» y «¿Con cuánto paga?» lado a lado) |
| Enviar por WhatsApp e imprimir | «Falta por pagar» y **Cobrar**, siempre abajo |
| Cerrar y «Cobrar todo y liberar» | |

- El título y «⋯ Opciones» quedan arriba.
- Cada columna se desplaza sola solo si hace falta, por ejemplo con muchísimos productos.

**Medido con 7 productos y un abono:**
- en 1366×768 (portátil), 820×1180 (tableta vertical) y 1180×820 (tableta horizontal) se ve **todo sin desplazar**;
- antes medía 1489 px en una pantalla de 768 px.

### La cuenta de una persona dentro de la mesa
Va igual: dos columnas y todo a la vista en el computador.

### Celular
- Una columna, como siempre, pero más compacta:
  - registrar un pago más bajo;
  - los medios de pago en una fila;
  - compartir en una fila.
- El título con «⋯ Opciones» queda **fijo arriba** y «Cobrar» **fijo abajo** mientras se baja.

### Otros cambios
- **Los − / + de cada producto** se leen en todos los diseños y son un poco más grandes para el dedo.
- **«Falta por pagar»** (abajo) se actualiza en 0,25 s (antes 0,7 s, y al abrir alcanzaba a verse «$0»).

No cambia nada de lo que hace la cuenta: solo se mueven las partes, con sus mismos nombres, a dos columnas.

## Pruebas
- **`pruebas/mesacomoda.test.js`** (nueva, en CI; 16 revisiones):
  - en computador y tableta, que la cuenta quepa y se vea todo, sin nada tapado;
  - «+» suma, un abono se registra y el saldo baja;
  - la cuenta de una persona también cabe;
  - en el celular, una columna, con el título y Cobrar fijos;
  - los − / + se leen.
- **La lista completa de CI** y las de mesas, personas, voz, sincronización y caja: ver el mensaje de la publicación.

## Lo que no se probó
- En una tableta o un celular de verdad. Se probó con las medidas de pantalla en Chromium y en WebKit (Safari).
