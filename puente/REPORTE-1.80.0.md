# ORDEVA 1.80.0 · 🧾 Caja POS completa (y ordenada)

## Lo que pidió el dueño
- «Agrega lo que le falta a la caja» (las 8 del análisis de la 1.79.0) «y vuelve a hacer una revisión».
- Con una foto de la Caja POS en el computador: «Arréglame este menú, se ve muy abultado; corrige los menús».
- «Cuando termina una venta no vuelve a cero, se queda pegado en el vuelto.»
- «La app no me da el QR para conectar el celular como lector de código de barras.»

## Arreglado primero (salió en la 1.79.1)
- **Caja ordenada:**
  - **en el computador**, el teclado va en la columna de la venta, arriba del total, como en una registradora;
  - **el estado de la caja** queda en una línea delgada;
  - **la fila de atajos repetida** se quitó (los atajos F1–F9 siguen bajo COBRAR);
  - **la barra de la voz** solo aparece cuando se usa;
  - **en el celular**, el teclado queda detrás del botón 🧮 junto al buscador y la barra de arriba va en una sola línea.
- **Vuelve a cero después de cobrar:**
  - el vuelto se ve unos segundos, con una barrita que muestra el tiempo;
  - después la caja queda limpia para el siguiente cliente: venta en $0, buscador y teclado limpios, y el cursor en el
    buscador.
  - El recibo y «Deshacer» siguen en el aviso de abajo y en «📊 Caja de hoy».
- **«📱 Celular lector» arriba en la Caja POS:** abre el QR para conectar el celular. Antes quedaba escondido dentro
  del 📷.

## Lo nuevo de la caja (`lib/vento-caja-mas.js`)
1. **📄 Cotizaciones**
   - Se arma la venta y se toca «📄 Cotizar». Queda numerada (COT-0001), con el cliente, la validez (15 días) y una nota.
   - La caja queda libre y no se descuenta nada del inventario.
   - Se envía por **📲 WhatsApp** (al celular del cliente) o como **🖨️ PDF**, una hoja con el nombre del negocio, NIT,
     productos, total y validez.
   - **«🛒 Pasar a venta»** la lleva a la caja con los precios cotizados, aunque el producto haya subido. Al cobrarla
     queda «✅ Vendida».
   - Desde «📄 Cotizaciones» se busca por número, cliente o producto, y se ve cuáles están vencidas.
2. **↩️ Devolución desde la caja**
   - Se busca la venta por producto, valor, cliente o número de factura, y se elige qué se devuelve.
   - Es la misma devolución del historial: vuelve al inventario, la venta baja y sale la nota crédito si tenía factura
     electrónica DIAN.
   - El dinero se devuelve **en efectivo** (sale de la caja) o queda **💳 como saldo a favor del cliente**.
   - Un empleado necesita la clave del dueño.
3. **📄 Corte X y 🔁 cambio de turno**
   - **Corte X:** lo vendido desde que se abrió la caja, por medio de pago y por cajero, con descuentos, devoluciones y
     el efectivo que debe haber. **No cierra la caja.** Se imprime o se manda por WhatsApp.
   - **Cambio de turno:**
     - el que entrega cuenta el efectivo con el mismo arqueo de billetes y monedas;
     - queda su corte, con lo que sobró o faltó;
     - la caja sigue abierta con quien llega, y su base es lo contado;
     - queda en el historial de turnos y en la actividad.
4. **⚡ Teclas rápidas**
   - Son botones de un toque para lo que no es un producto: 📱 Recarga, 🛍️ Bolsa $200, 📄 Fotocopia, 🧊 Hielo,
     🛵 Domicilio…
   - **Con valor fijo** van directo a la venta. **Sin valor**, se usa lo escrito antes en el teclado o se pregunta.
   - Las configura el dueño, con ✏️ al lado de las teclas.
5. **👥 Precio por cliente**
   - Al tocar «👤 Cliente» en la venta se busca por nombre o celular, o se crea.
   - **Lista de precios:**
     - **Normal**;
     - **Mayorista:** usa el precio mayorista del producto, que se pone en *Inventario por código → consultar*, o si no,
       el % del cliente;
     - **Especial:** un % menos en todo.
6. **⭐ Puntos y 💳 saldo a favor**
   - Con cliente, cada compra suma **1 punto por cada $1.000**.
   - Con 100 o más aparece «⭐ Canjear N pts»: cada punto vale $10 de descuento.
   - El saldo a favor (de una devolución) aparece como «💳 Usar saldo» y **paga** la compra.
   - El saldo no es un descuento: la venta vale lo mismo, solo que no entra efectivo, y queda en el medio de pago «Saldo a
     favor».
7. **🧾 IVA separado por tarifa en el recibo**
   - Cuando la venta tiene productos al 19 %, al 5 % o exentos, el recibo (pantalla, impresión, WhatsApp y la impresora
     térmica) muestra la base y el IVA de cada tarifa, y aparte lo exento o excluido.
   - Con una sola tarifa sale como siempre.
8. **📺 Pantalla del cliente** (`pantalla.html`)
   - **En otra ventana (segundo monitor):** muestra lo que se registra y el total. Al cobrar muestra el total a pagar con
     el QR de pago del negocio, y luego «🎉 ¡Gracias por su compra!» con el cambio.
   - **En una tablet o celular:** se conecta escaneando un QR, como el celular lector.

## Pruebas
- **`cajamas` (nueva, 24 ✅):** cubre las 8 mejoras de la caja:
  - teclas rápidas;
  - cliente mayorista con sus precios;
  - cotización: guardar, WhatsApp/PDF, pasar a venta con los precios cotizados y quedar vendida;
  - puntos: ganar, canjear y descontar;
  - devolución con saldo a favor y la siguiente compra pagada con el saldo;
  - Corte X y cambio de turno con faltante;
  - IVA por tarifa;
  - pantalla del cliente con «¡Gracias!».
- **`cajalibre` (29 ✅):** ahora también revisa que la caja vuelva sola a cero después de cobrar. `lectorcel` (30 ✅)
  revisa el «📱 Celular lector» a la vista.
- **Siguen bien:** las demás pruebas de caja, cobro, voz, escáner, cierre, inventario, finanzas y vistas.
- **En GitHub ya no fallan:**
  - `reservas`: la reserva de «hoy» caía mañana cuando la prueba corría de noche;
  - `pinempleado`: la huella del PIN podía traer «2468» por casualidad;
  - `plano`: revisaba antes de que el plano terminara de montarse.

## 🔎 Nueva revisión: qué más le falta a la caja (por orden de importancia)
1. **Pagos con datáfono integrado (Bold, Wompi, Redeban):** que la tarjeta se cobre desde la caja sin digitar el valor
   dos veces, y que el pago confirmado cierre la venta solo.
2. **Cierre Z con numeración y reporte para el contador:** un número consecutivo por cierre, el cuadre por medio de pago
   y por cajero, y el Excel de cierres del mes.
3. **Precios y promociones por horario:** «hora feliz», combos por día y descuentos programados que la caja ponga
   solos.
4. **Varias cajas a la vez en el mismo negocio:** caja 1 y caja 2 con su propio turno y arqueo, y el cierre del día
   sumando las dos.
5. **Venta a crédito con plazos (para tiendas y ferreterías):** cuotas con fecha, recordatorio por WhatsApp y abono desde
   la caja. El fiado de hoy no tiene fechas.
6. **Vender sin existencias, con clave:** hoy la caja muestra «Quedan 2» y «Agotado», pero deja vender igual. Falta la
   opción de pedir la clave del dueño para vender lo que no hay.
7. **Productos con variantes (talla, color, sabor):** un solo producto con sus variantes y el stock de cada una. Hoy
   cada variante es un producto aparte.
8. **Reimprimir recibos de días anteriores desde la caja:** hoy «📊 Caja de hoy» solo tiene los recibos de hoy. Faltan los
   de antes, buscando la venta, sin ir al historial.

**Recomendación:** hacer primero la 1 (datáfono) y la 2 (cierre Z con numeración). Son las que más piden los negocios
que facturan y las que más tiempo ahorran al cerrar el día.
