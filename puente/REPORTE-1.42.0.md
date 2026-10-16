# Vento 1.42.0 · 🧾 Caja (POS) en cualquier modo, con lector de código de barras

El dueño quería un modo de ventas rápidas, también en el modo tienda y en cualquier modo, que funcione como un POS
normal:
- productos registrados por código;
- lector de código de barras;
- ventas por código de barras;
- registrar pagos.

Se construyó sobre la caja que ya existía. No cambia cómo se registran las ventas ni cómo se descuenta el inventario.

## Lo nuevo
- **«🧾 Caja (POS)»** en la pantalla de mesas, al lado de «⚡ Venta rápida». Abre la caja en pantalla completa en el modo
  restaurante y en el mixto. En el modo tienda, la caja ya es la pantalla principal.
- **Lector de código de barras USB o Bluetooth.** El lector escribe como un teclado muy rápido y termina en Enter.
  - Con la caja a la vista, Vento toma el código aunque el cursor no esté en el buscador.
  - Las teclas lentas de una persona no se confunden con el lector.
  - Con otra ventana abierta encima, el lector no agrega nada a la caja.
  - Cada lectura suma 1. Para varias unidades, escribe «3*» antes de leer el código (o «3*código» en el buscador).
- **Código nuevo:** si el código no está, sale «¿Qué producto es?». Ahí puedes enlazarlo a un producto o crear uno
  nuevo, y desde ese momento se reconoce solo.
- **Pagos:** efectivo (con vueltas), Nequi, DaviPlata, tarjeta, fiado y ahora **➗ Pago mixto**.
  - Pones cuánto va por cada medio y Vento dice «Faltan…», «Vueltas…» o «Lo digital pasa del total».
  - La venta queda con un pago por cada medio. Por ejemplo, $3.500 en efectivo + $10.000 por Nequi y vueltas de $6.500.
- **🧾 Recibo:** sale al lado de «↩ Deshacer» después de cada venta. Se puede imprimir, mandar por WhatsApp o guardar
  como imagen. Usa el mismo recibo de siempre.
- **📊 Caja de hoy** (arriba en la caja, y en la caja del modo tienda) muestra:
  - las ventas del día y el total;
  - cuánto entró por cada medio (efectivo, Nequi, DaviPlata, tarjeta, transferencia, fiado);
  - las últimas ventas, con su recibo.
- `window.ventoPOS` también tiene `abrirCaja`, `cerrarCaja`, `cajaDeHoy`, `recibo` y `leerCodigo`.

## Parlante solo para los avisos
Ya existe en **Ajustes → Notificaciones → «🔊 Parlante de avisos»**. Conecta un parlante por Bluetooth o por cable, y
por él salen solo los avisos de Vento que elijas (pagos, pedidos, cuenta, domicilios…). La música y YouTube no salen
por ahí.

## Pruebas
- `cajapos` (nueva): 27 comprobaciones.
  - El botón en restaurante abre la caja.
  - Lector: agrega, suma, «3*» y «2*» antes de leer. Las teclas lentas no cuentan.
  - Un código nuevo lleva a crear el producto.
  - Pago mixto: faltan, se pasa, vueltas, 2 pagos que suman el total y el inventario descontado.
  - Recibo y Caja de hoy por medio de pago.
  - Al cerrar la caja el lector no hace nada.
  - En tienda funcionan el lector y Caja de hoy. Con otra ventana encima, el lector no agrega nada.
- Se revisó a 390 px de ancho (celular): sin desbordes.
- Suite completa.
