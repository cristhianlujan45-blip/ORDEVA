# ORDEVA 1.73.0 · 📅 Reservas sin duplicados y 🤖 agente de IA para reservas y domicilios

## Qué pidió el dueño
«Un agente de IA para que los hoteles o restaurantes reciban domicilios automáticamente o hagan reservas automáticamente,
habitaciones y todo. Que queden reservadas automáticamente, que no se dupliquen. Apenas hacemos una atención, ponerla ya no
disponible.»

## Cómo lo hacen las apps que funcionan (y cómo quedó ORDEVA)
- **Reservas:** las reservas viven en un solo lugar y la base de datos impide que se crucen. ORDEVA lo hace con una
  restricción de exclusión con rangos de tiempo en PostgreSQL, como recomienda Supabase.
- **Agentes de IA:** entienden lo que pide el cliente, leen la carta o las habitaciones, confirman y pasan a una persona
  cuando hace falta. En ORDEVA **la IA nunca reserva ni pide sola**: la disponibilidad, los precios y el total los pone el
  sistema, y nada se crea sin que el cliente toque «Confirmar».

## 📅 Reservas (`lib/vento-reservas.js` y la migración `20261125000000_reservas.sql`)
- **Sin duplicados:**
  - La base de datos rechaza dos reservas que se crucen en la misma habitación o mesa.
  - Probado con 10 reservas al mismo tiempo: queda 1 sola. También se rechaza si alguien lo intenta por SQL directo.
- **Atender = ocupada:**
  - Al anotar en una habitación o mesa sin reserva, queda ocupada en el servidor y el agente ya no la ofrece.
  - Al cobrar se libera.
  - Si la ocupación sigue, se alarga sola (un día en el hotel, una hora en el restaurante) sin pisar la siguiente
    reserva.
  - Si llega quien reservó, se usa su reserva: no se crea otra.
- **«📅 Reservas»** está en Cuentas y en Inicio, para hoteles, hostales, apartamentos, restaurantes, cafeterías y bares:
  - **Hoy y próximas:** con «✅ Llegó» (abre la cuenta), «👍 Confirmar», «🚫 No llegó», «❌ Cancelar» y WhatsApp del
    cliente.
  - **Calendario:** habitaciones × 14 días, o mesas × horas. Se toca un espacio libre para reservar.
  - **Reserva nueva:** si choca, dice con cuál.
  - Lo que se está escribiendo no se borra cuando llegan reservas.
- **Tarjeta de la mesa o habitación:** «📅 Reservada hoy 8:00 p. m. · Carlos (2)».
- **Reserva en línea nueva:** avisa con voz y notificación.

## 🤖 El agente (`agente.html`)
- **Un link por negocio**, para WhatsApp, Instagram o Google. Se configura en «📅 Reservas → 🤖 En línea». En tiendas se
  llama «🤖 Agente».
- **Reservas:**
  - El cliente escribe como a una persona: «una habitación para 2 del 5 al 7», «mesa para 4 mañana a las 8».
  - El agente muestra la **disponibilidad real** con precios. Para un hotel, el valor es el precio por noche por las
    noches.
  - Pide nombre y celular. Al confirmar, entrega un **código de reserva**.
  - Con ese código y el celular, el cliente consulta o cancela.
- **Domicilios:**
  - El agente arma el pedido **con la carta del negocio**: lo que no está o está agotado no entra.
  - Pide nombre, celular y dirección. Al confirmar, le llega al negocio **como cualquier domicilio**.
- **Si la IA falla**, se puede reservar y pedir igual con las opciones.
- **«💬 Hablar con una persona»** abre el WhatsApp del negocio.
- **Contra abuso:** 30 reservas en línea por hora por negocio y 3 por celular al día. La respuesta pública nunca trae
  datos de otros clientes.
- **Para quién:**
  - hoteles: reservas;
  - restaurantes y bares: reservas de mesa y domicilios;
  - tiendas: domicilios.

## Pruebas
- **`servidor/reservas` (nueva, 28 ✅):** sin duplicados (también 10 al tiempo y por SQL directo), atender y cobrar,
  llegó, lo público, código y celular, topes y permisos.
- **`reservas` (nueva, 14 ✅):** de punta a punta en un hotel: reserva, choque, en línea, aviso, marca en la tarjeta,
  atender, cobrar y «Llegó».
- **`agente` (nueva, 17 ✅):** la IA se simula; la disponibilidad, las reservas y los pedidos son reales.
  - Hotel: disponibilidad, confirmar, sin disponibilidad, consultar y cancelar.
  - Restaurante: mesa y domicilio con la carta.
  - Sin IA, y un link que no existe.
- **Siguen bien:** `hotel` 15, `comanda` 12, `ordeva2` 30, `mesa` 51, `mesacomoda` 16 y `vistasencilla` 45.

## Lo que sigue
- **WhatsApp directo**, que el agente conteste dentro de WhatsApp: necesita la cuenta de WhatsApp Business de Meta
  (número verificado). Por ahora el cliente abre el link desde WhatsApp.
- **Sincronizar con Booking y Airbnb** por calendario (iCal).
