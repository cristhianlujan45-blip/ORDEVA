# ORDEVA 1.74.0 · 🗺️ Mapa profesional de mesas y habitaciones

## Qué pidió el dueño
«Que el mapeo de las mesas, de las habitaciones, dependiendo del tipo del negocio, se vea más profesional. Y vuelve a
hacer una auditoría.»

## Cómo lo hacen los sistemas serios
Los sistemas de restaurante (Toast, Square, OpenTable) y de hotel (Cloudbeds, Little Hotelier) muestran cada mesa o
habitación con su **estado** y un **color fijo**. Arriba ponen un **conteo que filtra**, y los avisos de lo que hay que
atender ya resaltan la mesa. ORDEVA ahora hace lo mismo, en la lista y en el «Mapa del local» (`lib/vento-mapa.js`).

## Lo nuevo
- **Un color por estado:** el mismo en la lista y en el mapa.

  | Estado | Color | Qué muestra |
  |---|---|---|
  | Libre | 🟢 | «Libre» |
  | Ocupada | 🟠 | El valor y **el tiempo que lleva** («Ocupada · 35 min») |
  | Reservada | 🔵 | Cuando llega pronto: en 3 horas en el restaurante, hoy en el hotel. Con hora, nombre y personas |
  | Por limpiar | 🟤 | Hoteles, hostales, apartamentos y moteles |
  | Fuera de servicio | ⚫ | Para una habitación dañada |
  | Para atender | 🔴 | Resalta y titila suave: «🔔 Pedido listo para servir», «🆕 Pedido nuevo por aceptar» o «⚠️ Reservada a las 8:00 p. m.» (una mesa ocupada con una reserva encima) |

- **Conteo arriba:** libres, ocupadas, reservadas, por limpiar, para atender y por cobrar.
  - Al tocar uno se ven solo esas: «Mostrando: Ocupadas (3) · Ver todas».
  - En el mapa, las demás quedan tenues.
- **Mapa del local:**
  - borde del color del estado;
  - insignia (📅 🧹 🔧 🔔);
  - el valor y el tiempo («$54.000 · 35′»);
  - «Libre» en vez de «Vacía».
- **Hoteles:**
  - **Al cobrar, la habitación queda «🧹 Por limpiar».** En la tarjeta aparece «✅ Ya está limpia» y, al tocarlo, queda libre sin
    abrir la cuenta.
  - En una habitación vacía: «Estado de la habitación: ✅ Limpia · 🧹 Por limpiar · 🔧 Fuera de servicio».
  - «🧳 Sale hoy 12:00 p. m.» cuando la reserva termina hoy.
  - Si una habitación reservada para hoy está sucia, avisa «Hay que limpiarla antes de que llegue».
  - Las habitaciones 101, 102… 201… se agrupan por piso.
- **Capacidad:** «👥 4» en la tarjeta cuando está configurada en «📅 Reservas → 🤖 En línea».
- **Se actualiza solo:** el tiempo y los avisos se refrescan cada 20 s, solo si se está viendo Cuentas sin nada abierto encima.
- **No cambia cómo se abre ni se cobra una cuenta.**

## Pruebas
- **`mapa` (nueva, 21 ✅):**
  - en el restaurante: estados, tiempo, conteo y filtro, pedido listo, reserva y el mapa del local con colores e insignias;
  - en el hotel: pisos, por limpiar al cobrar, «Ya está limpia» y «Fuera de servicio».
- **`modos`:** estaba desactualizada (buscaba el botón de cobrar de antes de la 1.72.5). Ya está arreglada (55 ✅) y ahora
  también corre en GitHub.
- **Siguen bien:**

  | Prueba | ✅ |
  |---|---|
  | `hotel` | 15 |
  | `reservas` | 14 |
  | `agente` | 17 |
  | `servidor/reservas` | 28 |
  | `ordeva2pantallas` | 20 |
  | `mesapersonas` | 22 |
  | `facil` | 47 |
  | `mesa` | 51 |
  | `comanda` | 12 |
  | `vistasencilla` | 45 |
  | `modulos` | 11 |

## Auditoría: lo que sigue (en orden)
1. **Restaurante · anular en cocina:** si se quita de la cuenta algo que ya se mandó a cocina, la cocina no se entera.
   - Hoy `lib/vento-comanda.js` solo manda lo que falta.
   - Debe mandar «❌ ANULAR 1 × …» a la pantalla de preparación.
2. **Hotel · «Fuera de servicio» en línea:** hoy solo se ve en la app. El agente todavía podría ofrecer esa habitación.
   Hay que bloquearla en el servidor mientras esté así.
3. **Restaurante · opciones del producto:** término de la carne, sin cebolla, adiciones con precio. Se eligen al anotar y
   llegan a la cocina.
4. **Tienda · compra sugerida:** qué pedirle a cada proveedor según lo que se vende y lo que queda.
5. **Dueño · resumen del día:** que llegue como notificación al cerrar la caja: ventas, ganancia, lo más vendido y lo que se
   está acabando.
6. **Más adelante:**
   - WhatsApp directo para el agente, con la cuenta de WhatsApp Business de Meta del dueño;
   - calendario con Booking y Airbnb (iCal).
