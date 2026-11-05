# ORDEVA 1.82.0 · Lector de códigos en las mesas, propinas aparte, INC 8 %, comanda impresa, hoteles y agencias

**Pedidos del dueño:**
- «escanear el código de barras con el celular… también en las mesas… productos que no estén inventariados… que funcione
  como un lector normal de una caja».
- «haz las mejoras que me mencionaste y mira qué más mejorarías».

## 1. 🔳 Código de barras (auditoría, 1.81.5)
Se probó todo, de punta a punta, con la cámara del celular, un lector USB o Bluetooth y el celular como lector del
computador. Prueba nueva `codigobarras`, 25 revisiones, sin internet.

**Lo que fallaba y se arregló:**
- **El lector USB o Bluetooth no hacía nada en la cuenta de una mesa** (ni en la venta rápida). Solo funcionaba en la Caja
  POS. Esto también afectaba al celular usado como teclado Bluetooth («pistola lectora»).
  - Ahora el código se suma a la cuenta abierta.
  - Funciona aunque el cursor esté en el buscador: el buscador queda limpio.
  - Escribir a mano en el buscador sigue buscando normal, aunque se escriba rápido y con Enter.
- **Un producto nuevo cortaba el escaneo.** Al escanear con la cámara un código que no está en la lista, después de
  crearlo había que tocar «Escanear» otra vez. Ahora la cámara vuelve sola, también si se elige un producto o se cancela.

**Lo que ya funcionaba y se comprobó:**
- Escanear en la mesa con la cámara:
  - el mismo código quieto frente a la cámara no se repite;
  - si se retira y se vuelve a pasar, sí se suma otra vez.
- Un código nuevo en la mesa:
  - «Es un producto nuevo» abre la ficha; con el precio queda en Productos con su código y en la cuenta;
  - o se elige un producto que ya existe pero no tenía código: queda con ese código y la próxima vez se reconoce solo.
- El celular como lector del computador manda a la cuenta de la mesa que esté abierta.

Con la versión anterior, la prueba falla en la mesa: la cámara no vuelve y el lector USB no suma.

## 2. 🤝 Las propinas ya no cuentan como venta
La propina es de los empleados (Ley 1935 de 2018). Antes sumaba a «Vendido», a las entradas por ventas de Contabilidad y
al cierre.

**Ahora:**
- **Cierre de caja:** «Total vendido» sin la propina, y aparte «🤝 Propinas (de los empleados)» con lo de cada quien.
  El efectivo que debe haber en la caja sí la incluye, porque la plata está ahí.
- **Contabilidad:** «Vendido» y lo cobrado en ventas, sin la propina. La propina sale aparte (🤝): no es venta ni ganancia.
  En el Excel dice «Propina (de los empleados)».
- **El inicio y el tablero:** las ventas de hoy, sin la propina.
- **Las ventas viejas** (de antes de esta versión) también se separan.

Prueba nueva: `propinas` (12).

## 3. 🍽️ Impuesto al consumo (INC 8 %) para restaurantes y bares
- En Ajustes → Facturación: «🍽️ Impuesto al consumo (INC 8 %)».
  - Prenderlo apaga el IVA de las ventas, porque no van juntos.
  - Prender el IVA apaga el INC.
- **El recibo** (en pantalla, WhatsApp, impresora del navegador y térmica) dice:
  - «Subtotal (sin INC)»;
  - «INC 8 % (impuesto al consumo)».
- **La propina no lleva INC.**
- **Contabilidad** muestra «🍽️ INC 8 % por pagar» del período, para la declaración bimestral (formulario 310).
- **Pendiente:** la factura electrónica DIAN de un negocio con INC todavía sale con IVA. Necesita el código del INC en el
  servidor de facturación y probarlo con el proveedor.

Prueba nueva: `impuestoconsumo` (10).

## 4. 🖨️ Comanda impresa en la cocina y en la barra
- En Ajustes → Balanza, impresora y cajón: «🍳 Comanda impresa».
  - **Lo de la cocina y lo de la barra**, cada uno en su lugar: la impresora de facturas, una impresora de red (con su IP,
    en la app Android) o ninguna.
  - **Cada categoría** va a la cocina, a la barra o a ninguna. Las de bebidas (cervezas, licores, jugos, gaseosas, café…)
    van solas a la barra.
- **Al «🍳 Enviar a cocina»:** sale el papel con lo nuevo («COCINA · Mesa 1 · 2 x Bandeja paisa»). Lo que se quita después
  de mandarlo sale como «ANULAR - COCINA».
- **Cada equipo con sus impresoras:** se guarda en ese equipo.
- **Pendiente:** los pedidos que llegan por el QR o la app de meseros todavía no se imprimen solos. Llegan a la pantalla
  de la cocina como siempre.

Prueba nueva: `comandaimpresa` (12). La impresora se simula, igual que la de la app Android.

## 5. 🏨 Hoteles: el día del hotel
- **Arriba de las habitaciones:** «🏨 Hoy: 6 de 10 ocupadas (60 %) · 🧳 Salen hoy: 2 · $245.000 por cobrar».
- **Al tocarla:**
  - quién sale hoy (de las 📅 Reservas), con lo que debe y «💰 Cobrar»;
  - los indicadores del mes:
    - **ocupación %:** noches vendidas ÷ (habitaciones × días);
    - **tarifa promedio (ADR):** lo de las noches ÷ noches vendidas;
    - **RevPAR:** lo de las noches ÷ (habitaciones × días).
- **De dónde salen:**
  - de las cuentas cobradas (la venta guarda llegada y noches) y de las habitaciones ocupadas ahora;
  - solo lo de las noches, sin minibar ni desayuno;
  - una estadía que empezó el mes pasado solo cuenta las noches de este mes.

Prueba nueva: `hoteldia` (11).

## 6. ✈️ Agencias de viajes
- **Cupos reales:** si un plan tiene «Cupos disponibles», no deja venderlo de más. Cuentan los vendidos y los que están en
  cuentas abiertas. Avisa cuando quedan 3 o menos.
- **«🎫 Voucher y viajeros» en la cuenta del cliente:**
  - los viajeros con documento, nacimiento y contacto de emergencia;
  - el voucher, para imprimir, guardar en PDF o mandar por WhatsApp. Lleva el plan (destino, duración, salida, incluye,
    no incluye), los viajeros, el total, lo pagado, el saldo y el **RNT**.
- **RNT** en Ajustes → Facturación. Sale en el voucher y en el recibo; si falta, el voucher lo avisa.
- **Al cobrar:** los viajeros quedan guardados con la venta.

Prueba nueva: `agencia` (13).

## 7. Pruebas
RESULTADOS_AQUI

## 8. Lo que mejoraría después
Por orden de importancia:
1. **Estado de resultados del mes en Excel para el contador:** ventas, costo, gastos y utilidad, comparado con el mes
   anterior. Hoy solo lo dice el asistente en texto.
2. **Factura electrónica DIAN con INC,** para restaurantes con facturación electrónica.
3. **Comanda impresa también para los pedidos del QR y de los meseros:** que salgan solos en la cocina sin que nadie
   toque «Enviar».
4. **Comisiones de Booking y Airbnb:** descontar la comisión de cada reserva que llega por una plataforma, para ver la
   ganancia real.
5. **Domicilios con estados y repartidor:**
   - recibido → en preparación → en camino → entregado;
   - aviso por WhatsApp al cliente.
6. **Tarifas por temporada en hoteles:** alta, baja, fines de semana y festivos, puestas solas en la cuenta y en el agente.
7. **IVA exento para extranjeros no residentes en hoteles** (el registro 🪪 ya lo propone por la nacionalidad) y el cálculo
   de **FONTUR**.
8. **Tiendas:**
   - avisos de stock bajo en la caja, con «pedir al proveedor» a un toque;
   - productos por vencer en el inicio, con «poner en promoción».
9. **Menú del día en restaurantes** (sopa, principio, proteína), ofrecido por el QR y el agente.
10. **Primera carga más rápida en 4G:** juntar y comprimir los 87 archivos de código, 2 a 3 veces más rápido. No cambia
    nada de lo que hace la app.
11. **Pruebas con equipos de verdad:** celulares, lectores, impresoras térmicas y TVs. Todo se prueba con simuladores.
