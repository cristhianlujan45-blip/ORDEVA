# Auditoría · restaurantes, tiendas y agencias de turismo (con 1.77.0)

Se revisó cada sección con la app abierta en el celular y buscando en el código lo que ya existe, para no proponer lo que
ya hay. Los hoteles quedaron en `REPORTE-1.77.0.md`.

## Ya arreglado en esta revisión
- **Agencias de viajes** (y negocios por clientes, pedidos, eventos, vehículos o mascotas):
  - El conteo de arriba decía «4 libres / 0 ocupadas» y cada cliente «Libre», como si fueran mesas. Ahora dice «abiertas» y
    «Vacía».
  - Lo dañó el mapa de la 1.74.0. La prueba `mapa` ahora lo revisa (24 ✅).

## 🍽️ Restaurantes
**Lo que ya tienen:** mesas con mapa y estados, comanda a cocina con anular, opciones del plato, tiempo en cocina, QR para
pedir, reservas de mesa y domicilios por el agente, propina, dividir la cuenta, recetas que descuentan insumos, cierre con
resumen.

**Qué falta, por orden de impacto:**
1. **Comanda impresa en cocina y en barra:**
   - La impresora térmica (`lib/vento-equipos.js`) hoy solo imprime la factura.
   - Muchos restaurantes trabajan con papel en cocina. Hace falta que «Enviar a Cocina» imprima en la impresora de la
     cocina, y que bebidas y comida vayan cada una a su impresora.
2. **Domicilios con estados y repartidor:**
   - Hoy el domicilio del link entra como una venta.
   - Faltan los estados (recibido → en preparación → en camino → entregado), a quién se le entregó y avisarle al cliente
     por WhatsApp «tu pedido va en camino».
3. **Pagar la cuenta desde el QR de la mesa:**
   - El cliente ve su cuenta y paga por Nequi, DaviPlata o Bre-B.
   - El pago ya lo confirma el aviso del banco que ORDEVA lee, y la mesa queda pagada sin esperar al mesero.
4. **Menú del día:** el «almuerzo del día» aparece en el catálogo de tipos, pero no hay una función. Falta poner cada día
   la sopa, el principio y la proteína, y que el QR y el agente lo ofrezcan.
5. **Platos más y menos rentables:** con las recetas ya hay costo por plato. Falta un informe semanal: «la bandeja deja
   38 %, el ajiaco 22 %».

## 🛒 Tiendas
**Lo que ya tienen:** caja POS con lector y báscula, cajón de dinero, fiados, precio por cantidad (mayorista), lotes por
vencer, pedido a proveedores por WhatsApp con «Llegó», factura electrónica DIAN, combos y promociones, agente de
domicilios.

**Qué falta, por orden de impacto:**
1. **Domicilios con estados y repartidor:** lo mismo que en restaurantes. Sirve igual para minimercados y droguerías.
2. **Productos por vencer en el inicio:** hoy solo se ven en Estadísticas. Falta que aparezcan en el inicio con «poner en
   promoción».
3. **Cotizaciones:** ferreterías, depósitos y distribuidoras cotizan antes de vender. Falta una cuenta «Cotización» que se
   manda por WhatsApp o en PDF y con un toque pasa a venta.
4. **Varias sedes:** hoy cada negocio es aparte. Falta ver juntas las ventas y el inventario de dos o tres tiendas del
   mismo dueño y pasar mercancía de una a otra.
5. **Clientes frecuentes con puntos:** la tarjeta de puntos existe. Falta que avise por WhatsApp al cliente cuántos lleva y
   le recuerde volver.

## ✈️ Agencias de turismo (`agencia_viajes`)
**Lo que ya tienen:** el tipo de negocio con sus palabras («Clientes», «Vuelos y planes»), las fichas de cada plan
(destino, días y noches, incluye, no incluye, fecha de salida, cupos), abonos y saldo por cliente, y recibos.

**Lo que promete el catálogo y no hace:** «datos del viajero». Hoy no hay dónde anotarlos (el registro de huéspedes 🪪 es
solo para hoteles).

**Qué falta, por orden de impacto:**
1. **Viajeros de cada venta:** nombre, documento, fecha de nacimiento, celular y contacto de emergencia de cada pasajero.
   Es lo mismo que el 🪪 del hotel, adaptado. Se exporta a Excel para la aseguradora, la aerolínea o el operador.
2. **Salidas con cupos de verdad:**
   - Hoy la «fecha de salida» es un texto y los cupos, un número.
   - Debería ser cada salida (por ejemplo «San Andrés · 15 de junio») con sus cupos, que bajen solos al vender.
   - Que no se pueda vender más de lo que hay, igual que las habitaciones sin duplicar.
   - Y la lista de pasajeros de cada salida.
3. **Plan de pagos:** el abono existe. Falta la fecha límite de cada cuota, el recordatorio por WhatsApp al cliente y el
   aviso al dueño de quién está atrasado antes de la salida.
4. **Voucher o confirmación en PDF** para el cliente: plan, fechas, viajeros, lo que incluye, lo pagado, el saldo y los
   datos de contacto.
5. **El agente de IA para tours:**
   - Hoy está apagado para agencias.
   - Que responda qué planes hay, para qué fechas, cuántos cupos quedan y cuánto vale.
   - Que tome el apartado con el abono.
6. **Registro Nacional de Turismo (RNT):** el número en los recibos y vouchers, que es obligatorio para agencias en
   Colombia.

## Recomendación de orden
1. **Agencias, puntos 1 y 2 (viajeros y salidas con cupos):** es lo que más falta para que una agencia pueda trabajar con
   ORDEVA. Se reutiliza lo del hotel: el registro 🪪 y la reserva sin duplicar.
2. **Domicilios con estados y repartidor:** sirve a la vez a restaurantes y tiendas.
3. **Comanda impresa en cocina:** es muy pedida en restaurantes con papel.
4. **Lo demás**, en el orden de cada lista.
