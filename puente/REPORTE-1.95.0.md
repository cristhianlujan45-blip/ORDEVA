# ORDEVA 1.95.0 · 🍾 Consumo mínimo por mesa

**Pedido del dueño:** «continuemos».

**Por qué esto:** en bares, discotecas y gastrobares, las mesas VIP o reservadas suelen tener un consumo mínimo. ORDEVA
no lo manejaba: el mesero tenía que acordarse y sumar la diferencia a mano.

## Qué hace
- **Dónde se pone:**
  - **para una mesa:** Ajustes → Negocio → «🍾 Consumo mínimo por mesa». Se escriben las mesas («1-4, 10») y el valor; queda
    para todas las cuentas de esas mesas;
  - **para una sola cuenta:** en la cuenta → «🍾 Consumo mínimo». Con «Siempre para esta mesa» queda para la mesa.
  - Solo lo ponen o cambian el dueño y el administrador.
- **En la cuenta:** «🍾 Consumo mínimo $300.000 · lleva $215.000 · faltan $85.000», o «✅ ya cumplió». La propina no cuenta
  como consumo.
- **Al cobrar sin llegar al mínimo,** ORDEVA pregunta:
  - **Cobrar el mínimo:** suma la línea «🍾 Consumo mínimo (diferencia)» por lo que falta;
  - **Cobrar solo lo consumido:** la venta queda anotada con quién lo dejó así;
  - **Cancelar:** no cobra.
- **La venta guarda** el mínimo, lo consumido y la diferencia.
- **Si se cancela el pago** después de sumar la diferencia y la mesa sigue pidiendo, al volver a cobrar la diferencia se
  recalcula: no se cobra dos veces.
- **El mínimo de una sola cuenta** se va al cobrarla; el de la mesa queda.
- **Dónde funciona:** bares, discotecas, karaokes, gastrobares y restaurantes. En los demás negocios no aparece.

## Cómo está hecho
- `lib/vento-minimo.js`:
  - `data.minimoMesas`: el mínimo de cada mesa;
  - `t.minimo`: el de la cuenta;
  - `antesDeCobrar(id)`: devuelve `true` al instante si no hay nada que preguntar, igual que el motel;
  - envuelve `closeTableToHistory`, llevando las marcas de los demás módulos.
- **Ganchos** en el botón «Cobrar» de la cuenta (`app/04c-personas-voz-ia.js`) y en `ventoPOS.cobrarMesa`, con
  `minimoVisto` para no preguntar dos veces.
- **Sin migraciones.**

## Pruebas
- **Nueva:** `v195` (22). Cubre Ajustes, la cuenta, los tres botones al cobrar y la diferencia de un cobro cancelado. Revisa
  que el mínimo de la cuenta se vaya y el de la mesa quede, que un mesero no lo pueda cambiar y que el botón «Cobrar»
  pregunte una sola vez.
- RESULTADOS_AQUI
- **No se probó en un bar de verdad.**

## Lo que queda
- **Cover consumible:** el cover de la entrada como saldo para consumir.
- **Hoteles:** IVA exento para extranjeros no residentes, revisándolo antes con el contador.
- **Apartados (plan separe)** para tiendas de ropa.
- **Pruebas con equipos de verdad.**
