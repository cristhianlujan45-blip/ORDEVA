# ORDEVA 1.72.3 · Auditoría de hoteles y restaurantes

**Pedido del dueño:** «sigue con toda la auditoría que estaba haciendo del hotel y todo eso de los restaurantes».

**Cómo se hizo:**
- Se creó un negocio nuevo de cada tipo (Hotel, Restaurante, Bar y Tienda) como lo haría un dueño, con el asistente de
  bienvenida.
- Se recorrieron todas las pantallas, se abrió y cobró una habitación / mesa y se revisó la pantalla de preparación.
- Se compararon las palabras y lo que el catálogo de negocios **promete** («Cómo te ayuda ORDEVA») contra lo que la app
  hace de verdad.

## Hallazgos y lo que se hizo

| # | Hallazgo | Gravedad | Estado |
|---|---|---|---|
| R1 | **Restaurantes:** lo que el cajero anota en una mesa **nunca llegaba a la cocina**. Ni el tablero de la Cocina ni la pantalla de preparación (`preparacion.html`) lo mostraban; solo llegaban los pedidos del QR y de la app de meseros. El catálogo promete «comandas a cocina». | **Alta** | ✅ «🍳 Enviar a cocina» |
| H1 | **Hotel:** el catálogo promete «cuenta por habitación con noches», pero la habitación no sabía desde cuándo estaba ocupada. La tarjeta decía «Desde las 3:10 p. m.» sin el día, y si el huésped llevaba 3 noches y se anotó 1, nada lo avisaba: plata que se pierde. | **Alta** | ✅ Llegada y noches |
| H2 | Menú del hotel con «Tarifas y consumos» **y** «Tarifas» (la carta del QR). En motel y apartamentos salían **dos «Tarifas»** iguales. | Media | ✅ La carta se llama «Lista de precios» |
| H3 | La ventana «¿Cerrar esta cuenta?» decía «Sí, liberar **mesa**» en hoteles, barberías, consultorios… El título se traducía, el botón no. | Media | ✅ Ya usa la palabra del negocio |
| H4 | La tarjeta de la habitación decía «3 **productos**» en vez de «3 tarifas y consumos» (igual en barberías: «servicios»). | Baja | ✅ |
| H5 | «Primeros pasos»: «Revisa tus tarifas y consumos **y precios**». En consultorios y grupos decía «Tócala» por «Tócalo». | Baja | ✅ |
| H6 | Las cuentas abiertas de días anteriores (un bar que pasa la medianoche) decían «Desde las 11:40 p. m.» sin el día. | Baja | ✅ «Desde el vie 30 oct, 11:40 p. m.» |

## R1 · «🍳 Enviar a cocina» desde la cuenta de la mesa (`lib/vento-comanda.js`, nuevo)
- **Dónde está:** en la cuenta de la mesa, encima de los productos: «🍳 Enviar a Cocina · 3 nuevos», con lo que va
  («2 Bandeja paisa, 1 Limonada»).
- **Qué hace:** manda **solo lo nuevo**. Si después se suma una limonada, el siguiente envío lleva solo esa limonada.
  - Llega como pedido «📥 Recibido» al tablero de la Cocina y a la pantalla de preparación, con quién lo mandó.
  - Sigue el mismo camino de la app de meseros: **no se suma otra vez a la cuenta**.
  - Si la cocina lo cancela, se descuenta de la cuenta, igual que con los meseros.
- **Nada se manda dos veces:**
  - lo que llegó por la app de meseros o por el QR ya pasó por cocina, y el botón no lo repite;
  - un doble toque manda una sola comanda;
  - al cobrar y abrir otra cuenta en la misma mesa, empieza de cero.
- **Nombre:** usa el de la pantalla de preparación (Cocina, Barra, Despacho…).
- **Cuándo aparece:** solo con la «Pantalla de preparación» prendida (Ajustes → 🧩 Funciones). En tiendas no sale.
- **Datos:** no guarda nada nuevo en los datos del negocio. Lo enviado se calcula con los pedidos que ya existen.

## H1 · Llegada y noches de cada habitación (`lib/vento-hotel.js`, nuevo)
Aplica a hotel, hostal y apartamentos. No aplica al motel (que va por horas) ni al salón de eventos.

- **En la cuenta:** «🛏️ Llegó el jue 29 oct, 10:19 p. m. · 2 noches».
  - La llegada es la hora del primer producto anotado.
  - Se corrige con «✏️ Cambiar llegada», si el huésped llegó antes de abrir la cuenta.
- **Cómo se cuentan las noches:** por fecha. Llegó hoy o ayer = 1 noche; antier = 2…
- **Aviso:** si la cuenta tiene **menos noches** de habitación que las que lleva, dice «⚠️ Lleva 2 noches y la cuenta
  tiene 1» con el botón «Poner 2 noches».
  - **No cambia nada solo:** el dueño decide, porque puede ser una noche de cortesía.
  - El botón solo aparece cuando hay una sola tarifa de habitación, para saber a cuál sumarle.
- **Si la cuenta tiene más noches que las que lleva** (reserva anticipada o varias habitaciones), solo lo anota, sin
  aviso.
- **En la tarjeta de la habitación:** «⏱ Desde el jue 29 oct, 10:19 p. m. · 2 noches».
- **Al cobrar:**
  - la venta guarda la llegada y las noches;
  - la habitación queda libre y sin hora de llegada para el siguiente huésped.

## Pruebas
- **Nuevas, en CI:**
  - **`pruebas/comanda.test.js`** (12 revisiones): enviar, solo lo nuevo, doble toque, la app de meseros, cancelar
    desde la cocina, cuenta nueva y que no salga en tiendas.
  - **`pruebas/hotel.test.js`** (15 revisiones): el menú, los primeros pasos, la llegada y las noches, el aviso, poner
    las noches, cambiar la llegada, cobrar (la venta guarda las noches), las palabras de los botones y que no salga en
    un bar.
- **La lista completa de CI:** 65 de 66 pasaron. `codigoproducto` (intermitente conocida) marcó falla con sus 22 revisiones bien y pasó 2 de 2 al repetirla.
- **Arreglos de pruebas que fallaban en GitHub:**
  - `cajapro` (1.71.0): tocaba COBRAR dentro del medio segundo en que la caja ignora toques después de cobrar; ahora espera como una persona.
  - `qrprivado` (1.72.1): el canal queda a nombre del negocio cuando suben los datos; en GitHub con carga tardó más de 12 s y ahora espera hasta 30 s. La revisión sigue igual de estricta.

## Lo que queda (no se hizo en esta versión)
- **Reservas por fechas y calendario de ocupación** del hotel: el catálogo ya lo muestra como «Próximamente».
- **Producto quitado después de mandarlo a cocina:** si se quita de la cuenta un producto que ya estaba en cocina, la
  cocina no recibe un «cancelar» automático; hay que decírselo o cancelarlo desde el tablero.
- **La voz:** «Prueba la voz» sigue diciendo «dos gaseosas» de ejemplo en todos los negocios.
- **Pantalla de preparación real:** no se probó en una pantalla de cocina de verdad (tableta o TV). Las pruebas usan el
  tablero de la Cocina dentro de ORDEVA.
