# ORDEVA 1.76.0 · Las siete mejoras de la auditoría

El dueño pidió: «Haz todas esas mejoras». Son las siete de `REPORTE-1.75.0.md`, en el mismo orden.

## 1. 🪪 Hotel: registro de huéspedes (Tarjeta de Registro Hotelero) · `lib/vento-huespedes.js`
- **En la cuenta de la habitación:** «🪪 Registrar huésped» al hacer el check-in.
  - Datos: nombre completo, tipo y número de documento, nacionalidad, fecha de nacimiento, residencia, procedencia, destino,
    motivo del viaje, celular, correo, placa y acompañantes (nombre, documento y parentesco).
  - Si la habitación ya tiene cuenta y no tiene registro: «⚠️ Falta el registro del huésped».
- **Si llegó por una reserva** («✅ Llegó»): nombre, celular y una fila por acompañante ya vienen puestos.
- **Al cobrar:** el registro queda con la venta (llegada, salida, noches y valor).
- **«🪪 Huéspedes»** (en Cuentas): los registros del mes y un buscador por nombre o documento.
  - «⬇️ Excel» trae las columnas de la tarjeta.
- Solo hoteles, hostales, apartamentos y moteles.

## 2. 🔗 Hotel: calendario con Booking y Airbnb (iCal)
- **«📅 Reservas → 🔗 Booking y Airbnb»**, por cada habitación:
  - **📤 ORDEVA → plataforma:** el link del calendario para pegar allá. En Booking: Tarifas y disponibilidad → Sincronizar
    calendarios. En Airbnb: Calendario → Disponibilidad → Conectar calendarios. Solo lleva fechas ocupadas, nunca datos del
    cliente.
  - **📥 Plataforma → ORDEVA:** se pega el link iCal de allá. Sus reservas bloquean la habitación aquí; si se cancelan allá,
    se cancelan aquí.
- **Se sincroniza solo** cada 30 minutos con ORDEVA abierto, y con «🔄 Sincronizar ahora».
- **Doble reserva:** si algo de afuera choca con una reserva de ORDEVA, la base de datos no lo guarda y avisa «⚠️ Doble
  reserva…» (aviso y notificación).
- **Servidor:**
  - migración `20261126000000_reservas_ical`;
  - Edge Function nueva `vento-ical`, que se publica sola con «Servidor Vento». Solo lee calendarios de plataformas conocidas,
    por https y con sesión de ORDEVA.

## 3. 🧩 Restaurante: opciones del producto · `lib/vento-opciones.js`
- **En Productos → editar → «🧩 Opciones al vender»:** una línea por grupo. Ejemplo:
  - `Término: Roja, Medio, Bien asada` (se elige una y es obligatoria);
  - `Sin: cebolla, tomate` (se eligen varias);
  - `Adiciones: Queso extra 3000` (el número suma al precio).

  Hay botones rápidos para cada grupo.
- **Al anotarlo:** sale «¿Cómo lo quiere?».
  - En la cuenta queda «Hamburguesa · Término medio · Sin cebolla · +Queso extra» con su precio.
  - Cada combinación va en su línea.
- **En la cocina:** llega igual. Anular y «Todo está en Cocina» también tienen en cuenta cada combinación.
- **Desde el QR:** el cliente también elige. El negocio vuelve a calcular el precio con sus opciones, no con el que mande el
  celular.
- **Precios:** cambiar el precio del producto no borra lo elegido en las cuentas abiertas.
- **Carta del QR:** si la carta no cabe (tope de unos 4 KB), se quitan primero las opciones y nunca un plato.

## 4. ⏱ Restaurante: tiempo en cocina · `lib/vento-cocina-tiempo.js`
- **Pantalla de Cocina:** «⏱ Hoy: 14 pedidos · promedio 11 min hasta «Listo» · 2 pasaron de 20 min».
  - El límite se cambia ahí mismo: «Avisar a los [20] min».
- **Pedido demorado:**
  - se resalta en rojo;
  - avisa una vez, con aviso, voz y notificación: «⏰ Mesa 4 lleva 22 min esperando: 2 Bandeja paisa»;
  - la tarjeta de la mesa dice «⏰ Pedido hace 22 min en cocina».

## 5. 🛒 Tienda: pedido a cada proveedor
- **La lista de compras va por proveedor:**
  - su WhatsApp se guarda;
  - «📲 Enviar» abre WhatsApp a ese número con su parte del pedido.
- **«📦 Pedidos por llegar»:**
  - «✅ Llegó» suma lo pedido al inventario;
  - «📸 Escanear la factura»;
  - «✕» si no va a llegar.
- **En 📦 Inventario:** botón «🛒 Pedido a proveedores».

## 6. 📊 Resumen del día al cerrar la caja · `lib/vento-resumen-dia.js`
- **En el informe del cierre:** «📊 Resumen para el dueño».
  - Trae la ganancia estimada, la comparación con el cierre anterior, lo más vendido y lo que se está acabando.
  - «📲 Enviar resumen por WhatsApp» manda el texto completo: efectivo, transferencias, fiado y si faltó o sobró plata en la
    caja.
- **En los equipos del dueño o del administrador:** el cierre llega con los datos del negocio y sale una notificación, una
  sola vez: «📊 Cierre de caja | $1.250.000 en 48 cuentas (+12%) · ganancia ~$410.000 · más vendido: …».
- Los meseros no la reciben.

## 7. 🏷️ Registro: el tipo de negocio se elige
- **Al crear la cuenta:** 🍽️ Restaurante · 🏨 Hotel · 🛒 Tienda · 🔎 Otro (abre el buscador de tipos).
- **Sin elegir no se crea la cuenta:** antes quedaba «Tienda» sin preguntar.
- **En las pruebas automáticas** (`navigator.webdriver`) sigue «Tienda» por defecto, para no cambiar las 97 pruebas que
  crean cuentas.

## Además
- **Hotel:** «✏️ Cambiar llegada» se cerraba solo al cambiar el minuto, porque la hora de ahora estaba en lo que se comparaba
  para volver a pintar. Por eso falló la prueba `hotel` en GitHub con la 1.75.0. Arreglado.
- **`comandaanula`:** el «❌» en los nombres de las pruebas contaba como falla en GitHub. Arreglado.

## Pruebas
- **Nuevas:**

  | Prueba | ✅ |
  |---|---|
  | `huespedes` | 12 |
  | `servidor/ical` | 17 |
  | `opciones` (con el QR) | 20 |
  | `cocinatiempo` | 8 |
  | `proveedores` | 8 |
  | `resumendia` | 7 |
  | `registrotipo` | 6 |

- **Ampliada:** `reservas`, ahora con 26 (+8 de Booking y Airbnb).
- **Siguen bien:**
  - las de pedidos, QR y cocina: `canalseguro`, `qrprivado`, `seguridadqr`, `comanda`, `comandaanula`, `pedidodesliza`;
  - las de mesas, caja y hotel: `mejoras`, `mesa`, `mesacomoda`, `cajapos`, `hotel`;
  - `mapa` y `agente`.

## Lo que necesita el dueño
- **Booking / Airbnb:** pegar en cada plataforma el link de cada habitación, y pegar en ORDEVA el link iCal que da cada una.
- **Proveedores:** la primera vez, escribir el WhatsApp de cada uno en la lista de compras.
- **Opciones del producto:** escribirlas en cada plato que las tenga (Productos → editar → 🧩).
