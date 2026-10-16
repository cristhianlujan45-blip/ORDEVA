# Vento 1.43.2 · Avisos de Vento en la campanita, herramientas según el negocio y la actualización que no se instalaba

El dueño pidió tres cosas:
- que los avisos de Vento lleguen a la campanita y no salgan en la pantalla;
- quitar «Venta rápida» de la tienda y poner algo que sí se use;
- que cada herramienta salga solo en los negocios que la usan.

Y además: «me sale que hay una actualización, la descarga, pero no la instala».

Lo que eligió:
- en la campanita, los avisos fijos de arriba;
- «Caja (POS)» en todos los negocios menos los servicios;
- «📒 Fiados» en lugar de «Venta rápida».

## 1. 🔔 Los avisos de Vento van a la campanita
Ya no salen en la pantalla principal. Quedan en la campanita, en «📣 Avisos de Vento», con sus mismos botones:
- ⚠️ Los pagos no van a sonar, falta un permiso o apps de banco con ahorro de batería («Dar el permiso»,
  «Reconectar», «Permitir»…).
- 🔄 Hay una versión nueva de Vento («Actualizar ahora» / «Luego»). Ya no se esconde sola a los 20 s: queda hasta
  actualizar o tocar «Luego».
- 🎁 Prueba gratis, plan por vencer, pago en revisión…

Cómo se comportan:
- La campanita los cuenta en su número, se ilumina y se mueve cuando llega uno nuevo.
- Al tocar un botón se cierra la campanita, para que se vea lo que abre.
- Cuando el aviso se resuelve, sale de la cuenta.
- La lógica de cada aviso no cambió: solo cambia dónde se ve.

## 2. Herramientas según el negocio
- **«🧾 Caja (POS)»** sale en tiendas, comidas, bares y restaurantes. No sale en barberías, estéticas, hoteles,
  consultorios, lavaderos, talleres y demás servicios.
- **Tienda:** ya no sale «⚡ Venta rápida» (la caja ya lo hace). En su lugar sale **«📒 Fiados»**, que abre la libreta
  «📕 Me deben».
  - En el modo tienda, «📒 Fiados» también está en la caja, junto a «📊 Caja de hoy».
  - Vale para todas las tiendas: minimercado, droguería, ferretería, papelería…
  - También para un negocio de antes, sin tipo elegido, que se llama «Tienda…», como «Tienda Vito» en la captura del
    dueño.
- Lo demás no cambia: bares y restaurantes siguen con «Venta rápida». Con «Mostrar todas las funciones» se ve todo.

## 3. 🔄 «Hay una actualización» que bajaba pero no se instalaba
**Por qué:** «Actualizar ahora» instalaba con el instalador silencioso de Android, de fondo. Varios celulares (Xiaomi,
Redmi y otros) lo bloquean. El error quedaba escondido en Ajustes y el aviso seguía diciendo «Hay una versión nueva».

**Arreglo (app 1.0.45):**
- **«Actualizar ahora»** baja el archivo y abre la pantalla de siempre de Android, «¿Quieres actualizar esta app?» →
  «Actualizar». Funciona en todos los celulares: es la misma con la que se instaló a mano.
- Si se toca mientras ya se está bajando de fondo, el instalador se abre apenas termina la descarga.
- **La actualización automática de fondo** sigue igual. Si Android la bloquea:
  - con Vento abierta, sale de una la pantalla «¿Actualizar?»;
  - si no, llega un aviso «🔄 Vento tiene una actualización · Toca aquí y luego Actualizar».
- El archivo bajado se le pasa al instalador de forma segura, solo para leerlo (`FileProvider`, carpeta de caché).
- **Nota:** esta versión todavía hay que instalarla con el instalador que ya tienes. Si «Actualizar ahora» no la
  instala, se baja `vento.apk` una vez desde la página de descargas. Desde ahí, las siguientes ya abren la pantalla
  «¿Actualizar?».

## 4. 🍺 Los pedidos de la gente, en la campanita
El dueño: «En el panel de notificaciones, donde dice pedidos, ahí tienen que mostrarme los pedidos que va montando la
gente por la aplicación».

**Por qué no salían:** la campanita armaba su lista con una copia guardada solo en el celular que recibió cada pedido.
En los otros celulares, o si el pedido entraba por otro camino, decía «Todavía no hay pedidos».

**Ahora** lee la lista de pedidos del negocio, que es la misma en todos los equipos: la llena la app de los clientes,
el QR de la mesa, los meseros y WhatsApp. Muestra:
- **Por enviar:** los que esperan que los aceptes, con «✅ Enviar pedido» y «❌ Rechazar».
- **En curso:** recibidos, en preparación y listos. Cada uno con la mesa, lo que pidió, la nota y de dónde llegó (📱 App,
  💬 WhatsApp, 🧑‍🍳 Mesero).
- **Pedidos de hoy:** entregados y cancelados.

Al tocar un pedido se abre la cuenta de esa mesa. El número de la campanita cuenta los pedidos por enviar y en curso,
además de los avisos de Vento.

## Pruebas
- `herramientas` (nueva): 24 comprobaciones.
  - Herramientas por tipo: bar, arepería, barbería, hotel, tienda, minimercado.
  - Las de «Tienda Vito» sin tipo, y las de una cervecería sin tipo.
  - «Fiados» abre la libreta.
  - «Mostrar todas las funciones».
  - Avisos en la campanita: prueba gratis y aviso de pagos de primero; el número sube y baja; tocar un botón la cierra.
  - Pedidos en la campanita: sin pedidos lo dice; un pedido de la app sale en curso con mesa, productos, nota y
    «📱 App» y se cuenta; uno que llegó a otro celular sale «Por enviar»; «Enviar pedido» lo suma a la cuenta; el
    entregado queda en «Pedidos de hoy»; tocarlo abre la cuenta.
- `subbarra` (16), `suscripnube` (67) y `flujocompleto` ahora abren la campanita para ver el aviso del plan.
- Compila todo el código Android (con `android-all`).
- Suite completa.
