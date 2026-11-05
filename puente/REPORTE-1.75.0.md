# ORDEVA 1.75.0 · Auditoría completa (restaurante, hotel y tienda) y lo que se arregló

## Qué pidió el dueño
«Haz una auditoría de todo el programa: qué corregirías y qué mejorarías para implementarlo. Prioridades: restaurante,
hoteles y tienda. Que todo sea más automatizado y más fácil de usar.»

## Cómo se auditó
1. **Las 70 pruebas que GitHub no corría**, contra la versión publicada y contra la nueva. En total hay 147 pruebas.
2. **Velocidad:** la app se midió en un celular lento simulado (CPU 4 veces más lenta), para un restaurante, un hotel y una
   tienda.
3. **Pantallas:** se revisaron en el celular para los tres tipos de negocio.
4. **Código:** se revisó lo que falta para cada tipo de negocio y lo que quedó pendiente de la auditoría anterior.

## Errores encontrados y arreglados
| # | Qué pasaba | Arreglo |
|---|---|---|
| 1 | **«🚀 Primeros pasos» no avanzaba** (se quedaba en «2 de 5» aunque abrieran cuentas o cobraran). Lo dañó el mapa nuevo de la 1.74.0: reemplazaba el conteo de arriba y ya no avisaba a «Primeros pasos». | El conteo nuevo se pinta después del de siempre, que sigue avisando. La prueba `pasos` ahora corre en GitHub. |
| 2 | **Minimercado, droguería, ferretería… que saltaban el asistente quedaban como restaurante**, con «cuentas libres / ocupadas» en vez de la caja. | Si el dueño eligió un tipo de tienda, queda en modo caja aunque salte el asistente. «Tienda» a secas, que es lo que viene marcado al registrarse, sigue igual. |
| 3 | **Restaurante:** si se quitaba de la cuenta algo que **ya estaba en cocina**, la cocina no se enteraba y lo preparaba igual. | La cuenta muestra «❌ Avisar a Cocina: no preparar · Quitaste 1 Bandeja paisa…». Al tocarlo, la cocina recibe «❌ ANULAR Bandeja paisa» con la nota «ya no lo preparen». Más abajo, los detalles. |
| 4 | **Hotel:** una habitación «🔧 Fuera de servicio» solo se veía así en la app; el agente en línea la podía seguir ofreciendo. | Queda **bloqueada en el servidor** y el agente ya no la ofrece. Al ponerla «Limpia» se desbloquea. Más abajo, los detalles. |
| 5 | **Conteo de arriba:** mostraba «0 reservadas» en negocios que no usan reservas, y «libres / ocupadas» en negocios por cuentas u órdenes (no son lugares). | «Reservadas» solo sale si se usan las reservas. Por cuentas u órdenes dice «abiertas». |
| 6 | **Hotel:** si se anotaba en una habitación que estaba «Por limpiar», seguía diciendo «Por limpiar» al salir el huésped. | Al ocuparla, deja de estar por limpiar o fuera de servicio. |

**Detalle del arreglo 3 (anular en cocina):**
- La cuenta **no cambia**: no suma ni resta nada, aunque la cocina la marque o la cancele.
- Si la cocina la cancela, vuelve a pedir el aviso.
- También funciona si se quita todo de la cuenta.
- Al cobrar no pide nada.

**Detalle del arreglo 4 (fuera de servicio):**
- Se bloquea hasta 30 días.
- Si tiene una reserva antes, se bloquea solo hasta esa reserva y avisa: «muévela en 📅 Reservas».
- Ese bloqueo no se cuenta como reserva ni dice «Reservada» en la tarjeta.

## Pruebas que estaban viejas (la app estaba bien)
- **`sonidos`:** buscaba el botón de cobrar de antes de la 1.72.5. Ya está arreglada y en GitHub.
- **`appoweb`:** la vuelta desde Google al conectar YouTube en el navegador. Falla igual en la versión publicada y no es de
  estas prioridades. Queda anotada.
- **`esquinas`:** falló una vez por carga de la máquina; repetida, pasa.

## Medidas
- **Abrir la app** en un celular lento (CPU ×4): entre 1,6 y 2,7 s hasta la pantalla de entrar.
- **Entrar:** 1,2 a 1,4 s.
- **Sin errores de página** en restaurante, hotel ni tienda.
- **Peso:** 78 archivos de código (3,5 MB) en cada carga. El celular los guarda en memoria, así que es rápido desde la
  segunda vez. El lector de fotos (OCR, 10 MB) solo carga cuando se usa.

## Pruebas nuevas o en GitHub
- **`comandaanula` (nueva, 12 ✅):** anular en cocina, de punta a punta.
- **`reservas` (+4, 18 ✅):** «Fuera de servicio» bloqueado en el servidor de verdad, hasta la reserva siguiente, y
  desbloqueado al ponerla limpia.
- **`mapa` (+2, 23 ✅):** el minimercado queda en modo caja; el conteo dice «abiertas».
- **Ahora también en GitHub:** `comandaanula`, `pasos`, `guia` y `sonidos`.
- **Siguen bien:**

  | Prueba | ✅ |
  |---|---|
  | `vozcomandos` | 109 |
  | `guia` | 47 |
  | `vistasencilla` | 45 |
  | `modos` | 55 |
  | `comanda` | 12 |
  | `agente` | 17 |
  | `cajapos` | 27 |
  | `facil` | 47 |
  | `mesa` | 51 |
  | `hotel` | 15 |
  | `cobrosimple` | 21 |
  | `modulosnegocio` | 33 |
  | `ordeva2pantallas` | 20 |

## Lo que sigue (en orden de lo que más le sirve al negocio)
### Hotel
1. **Registro de huéspedes:** nombre, documento, nacionalidad, procedencia, acompañantes y motivo del viaje, al hacer el
   check-in. En Colombia los hoteles deben llevar la **Tarjeta de Registro Hotelero**. Hoy ORDEVA no pide estos datos.
   - Que quede en la cuenta de la habitación.
   - Que se pueda exportar en Excel.
   - Que la reserva del agente llegue con el nombre ya puesto.
2. **Calendario con Booking y Airbnb** (iCal): que las reservas de allá bloqueen la habitación aquí, y al revés.
3. **Check-out automático:** a la hora de salida, avisar «Habitación 203 sale hoy: ¿cobrar?».

### Restaurante
4. **Opciones del producto:**
   - término de la carne;
   - «sin cebolla»;
   - adiciones con precio (queso extra +$3.000);
   - acompañamiento a elegir.

   Se eligen al anotar o desde el QR y llegan a la cocina con el plato. Hoy solo hay tamaño y una nota por pedido.
5. **Tiempo en cocina:** cuántos minutos lleva cada comanda y el promedio del día, con alerta si una pasa de 20 min.

### Tienda
6. **Pedido al proveedor de un toque:** la «lista de compras» ya existe en el asistente. Falta enviarla por WhatsApp a cada
   proveedor y, cuando llegue, sumar el inventario con la foto de la factura.
7. **Productos por vencer** en el inicio, con «poner en promoción».

### Para todos
8. **Resumen del día al dueño:** que llegue como notificación al cerrar la caja (ventas, ganancia, lo más vendido y lo que se
   está acabando). Hoy solo se ve al día siguiente en el inicio («Ayer vendiste…»).
9. **WhatsApp directo para el agente:** que conteste dentro de WhatsApp. Necesita la cuenta de WhatsApp Business de Meta del
   dueño, con un número verificado.
10. **Registro sin elegir tipo:** hoy, si el dueño no elige el tipo al registrarse, queda como «Tienda». Sería mejor que sea
    obligatorio elegirlo (con «Restaurante», «Hotel» y «Tienda» de primeros).
