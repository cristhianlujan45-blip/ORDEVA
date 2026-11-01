# ORDEVA 1.72.5 · Cobrar una cuenta en un solo paso

**Pedido del dueño:** «Simplifica el método de cobro».

## Lo que pasaba
Para cobrar una mesa (o habitación, silla…) había **tres caminos** que se pisaban:

1. **«💰 Cobrar todo y liberar mesa»:** preguntaba efectivo, transferencia o debe, y **no calculaba el vuelto**.
2. **El cuadro «Registrar un pago o abono»:** tenía ¿quién paga?, ¿con cuánto paga?, Todo / La mitad / ÷2, tres medios de
   pago, Productos, Comprobante y Registrar pago.
3. **El «Cobrar» de abajo:** solo llenaba ese cuadro y dejaba la mesa abierta. Para cerrarla había que volver al camino 1.

## Lo que cambió (`lib/vento-cobro-simple.js`, nuevo; `app/04c`, `lib/vento-pos.js`)
- **Un solo «Cobrar».**
  - Abajo dice «Falta por pagar $35.500 · Cobrar».
  - Sin la vista sencilla, el botón de la cuenta dice «💰 Cobrar $35.500».
- **Abre la ventana de cobro de la Caja POS:**
  - «¿con cuánto paga?» con el **vuelto en grande**;
  - efectivo, Nequi, DaviPlata, transferencia, tarjeta, pago mixto y fiado con el nombre;
  - el teclado (Enter, flechas).
- **Al pagar:**
  - la mesa queda cobrada y libre;
  - sale el aviso «✅ Cobrado $35.500 · Mesa 1 · Vueltas $14.500» con **«Deshacer»**.
- **Siguen igual:**
  - la propina (primero la pregunta y después cobra);
  - los clientes frecuentes y la factura DIAN;
  - el fiado va a la libreta con el nombre.
- **Abonos y dividir la cuenta:** quedan **plegados** en «➕ Abono o dividir la cuenta». Adentro está todo lo de antes:
  pagar por partes, por persona, por productos y el comprobante. **No se quitó ninguna función.**
- **Si ya pagaron todo con abonos:** «✅ Cerrar la cuenta (ya pagaron)».
- **Cobrar desde la Caja POS y desde el modo fácil** sigue igual.

## Pruebas
- **`pruebas/cobrosimple.test.js`** (nueva, en CI; 21 revisiones):
  - un solo «Cobrar» y el monto en el botón;
  - efectivo con vuelto, y «Deshacer»;
  - Nequi, fiado con nombre y pago mixto;
  - abono y después cobrar lo que falta;
  - cuenta ya pagada;
  - propina;
  - cancelar sin cambiar nada.
- **Actualizadas al cobro nuevo:**
  - `vistasencilla`: «Cobrar» abre el cobro con lo que falta;
  - `mesacomoda`: el abono va en el plegable;
  - `hotel`: el aviso de cobro;
  - `flujocompleto`.
- **Pasan:** `modos` y `sonidos`, sin cambios.
