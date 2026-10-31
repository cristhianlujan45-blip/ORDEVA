# ORDEVA 1.72.2 · La Caja POS con su propia sección y manejada con el teclado

**Pedido del dueño:** «que la caja POS tenga su sección aparte y que se vea muy claramente… cada vez que le dé cobrar, que
solamente digite con el teclado, sin mover el mouse: cuánta cantidad, con cuánto me pagaron… o que me pueda mover con
las flechitas».

## 1. «Caja POS» con su propia entrada en el menú
- **Dónde está:**
  - En el computador, en el menú de la izquierda, debajo de Cuentas / Mesas.
  - En el celular, en la barra de abajo: Cuentas · **Caja POS** · Productos · Cuadre · Más.
- **Qué hace:** abre la caja en pantalla completa, titulada «🧾 Caja POS», con el cursor listo en el buscador.
- **El nombre «Cuadre»:** el resumen del día del dueño (antes «Caja», en la vista sencilla) ahora se llama «Cuadre», para
  no confundirlo con la caja donde se vende.
- **Quién la ve:** la ven los que venden. No aparece en el modo mesero ni en el modo fácil, que ya tienen la suya.

## 2. Vender con el teclado, sin mouse

| Tecla | Qué hace |
|---|---|
| Escribir + `Enter` | Agrega el producto, por nombre o código |
| `3` + `Enter` | Deja **3** del último producto agregado (1 a 3 cifras, si no hay un producto con ese código) |
| `+` / `−` | Suma o resta uno al último producto, con el buscador vacío |
| `Supr` | Quita el último producto, con el buscador vacío |
| `↓` | Pasa a los productos (favoritos y cuadrícula) |
| Flechas | Se mueven entre los productos |
| `Enter` | Agrega el producto que tiene el foco |
| Una letra o `Esc` | Vuelve al buscador |
| `F2` | Cobrar |

- El último producto agregado queda resaltado en la venta.
- Debajo del buscador hay una línea con estas teclas, solo en equipos con teclado.

## 3. Cobrar con el teclado
- **Al cobrar (`F2`):** el cursor queda en «¿Con cuánto paga el cliente?».
- **Efectivo:** se escribe, por ejemplo, `50000` y `Enter`. Cobra en efectivo y muestra el vuelto grande.
- **Otro medio:** `↓` baja a los medios de pago, las flechas se mueven entre Efectivo, Nequi, DaviPlata, Transferencia y
  Tarjeta, y `Enter` cobra con ese medio.
- **Corregir el monto:** un número desde un medio de pago vuelve al campo del monto.
- **Ayuda en la ventana:** la ventana dice cómo se maneja: «Escribe con cuánto paga y Enter cobra en efectivo · ↓ ← →
  otro medio · Esc cancela».
- **Seguridad:**
  - un `Enter` inmediato al abrir el cobro **no cobra** si el monto está vacío; así no se cobra por accidente;
  - `Esc` cancela.

## 4. Arreglo de paso
- **Qué pasaba:** un doble toque en «Efectivo» podía caer en el botón «Enviar recibo» del panel de venta lista.
- **Arreglo:** ahora, durante medio segundo después de cobrar, ningún botón de la caja responde.

## Pruebas
- **`pruebas/cajateclado.test.js`** (nueva, en CI; 17 revisiones), sin tocar el mouse:
  - el menú;
  - buscar + Enter, «3» + Enter, + / −, flechas, Supr;
  - F2 + 50000 + Enter con vuelto de $36.800;
  - F2 + flechas a DaviPlata + Enter.
- **Actualizadas** al menú nuevo: `vistasencilla` y `ordeva2`.
- **Pasaron:** cajapro, cajavoz, modos, vueltas, cajapos, cajaextra, facil, vistasencilla, ordeva2pantallas, ordeva2,
  guia y pasos.

## Lo que no se probó
- Con un teclado y un lector de código de barras físicos. Las pruebas usan el teclado simulado de Chromium.
