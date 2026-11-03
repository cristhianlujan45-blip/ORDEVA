# ORDEVA 1.77.0 · ⚡ Reservas de Booking y Airbnb casi al instante, con los datos del huésped

## Qué pidió el dueño
«Que cuando alguien haga una reservación por Airbnb, Booking o cualquier página donde tenga las habitaciones publicadas,
automáticamente en ORDEVA ya quede reservada con los datos del cliente y la persona que va a llegar, instantáneamente y
muy organizado. Y vuelve a hacer una auditoría.»

## Lo que se puede y lo que no
Booking y Airbnb **no dejan** que un programa como ORDEVA lea sus reservas directo: esa conexión (API) solo la dan a
empresas certificadas («channel managers»). Lo que sí entregan es:

| | Cuándo llega | Qué trae |
|---|---|---|
| **El calendario iCal** de cada habitación | Cuando ORDEVA lo lee | Fechas ocupadas. Casi nunca el nombre. Airbnb trae el código de la reserva y los 4 últimos dígitos del celular |
| **El aviso de su app** en el celular del dueño (Booking.com Pulse, Airbnb…) | **Al instante** | El nombre del huésped, las fechas, cuántas personas y a veces el código |

ORDEVA 1.77.0 **junta los dos**.

## Cómo quedó
1. **⚡ El aviso del celular:**
   - Llega el aviso, por ejemplo «¡Nueva reserva! Juan Pérez reservó del 5 al 7 de noviembre. 2 huéspedes».
   - La app Android de ORDEVA lo lee, con el mismo permiso de «Acceso a notificaciones» de los pagos.
   - ORDEVA lo entiende, en español o inglés: si es nueva, cancelada o un cambio, el nombre, las fechas, las personas y el
     código.
   - Lo guarda en el servidor y le pide leer **ya** el calendario de esa plataforma.
   - Resultado: la reserva queda **en su habitación, con el nombre y las personas**, en segundos.
2. **🔄 El servidor revisa los calendarios cada 5 minutos**, aunque ORDEVA esté cerrado en todos los equipos.
   - Antes era cada 30 minutos y solo con la app abierta.
   - Si el dueño no tiene la app Android, igual queda reservada en máximo 5 minutos, aunque sin el nombre.
3. **Sin duplicados:** el aviso y el calendario se juntan.
   - Si llega primero el aviso, la reserva toma el nombre cuando llega el calendario.
   - Si llega primero el calendario, toma el nombre cuando llega el aviso.
   - El mismo aviso en dos celulares cuenta una sola vez.
4. **«📲 Avisos de reservas»** (en 📅 Reservas):
   - lo que llegó de cada plataforma y en qué habitación quedó;
   - lo que el calendario todavía no trae se asigna a una habitación con un toque.
5. **Cancelaciones:** avisa al instante, con voz y notificación, y el calendario la libera.
6. **Al llegar el huésped** («✅ Llegó»): el registro del huésped (🪪) ya viene con su nombre, celular y personas.
7. **Se corrigió:** Booking exporta sus reservas como «CLOSED - Not available» y no se deben marcar como bloqueo. Solo
   «Airbnb (Not available)» es un día que cerró el dueño.

## Lo que necesita el dueño (una vez)
- **En su celular Android:**
  - la app de ORDEVA con «Acceso a notificaciones» (el mismo de los pagos de Nequi);
  - la app **Booking.com Pulse** y la app de **Airbnb** con las notificaciones prendidas.
- **En 📅 Reservas → 🔗 Booking y Airbnb:** el link de cada habitación pegado en cada plataforma, y el link iCal de cada
  plataforma pegado en ORDEVA. Así se sabe en qué habitación cae cada reserva.

## Pruebas
- **`reservasavisos` (nueva, 19 ✅):** PostgreSQL de verdad, Servidor ORDEVA, la app y un Booking de mentira.
  - Se entienden los avisos de Booking y de Airbnb, en español e inglés.
  - El repaso del servidor necesita su clave.
  - El aviso hace que el servidor lea el calendario ya, con el nombre y las personas.
  - Si el aviso llega primero y el calendario después, se juntan.
  - Un aviso repetido no se duplica.
  - Asignar a mano y avisar una cancelación funcionan.
- **`ReservaAvisoPrueba` (Java, nueva, 11 ✅):** qué apps son de reservas (y no la de viajes de Booking, Nequi ni
  WhatsApp) y qué avisos son una reserva.
- **Siguen bien:** `reservas` (26), `servidor/ical` (17), las 55 migraciones y `javaavisos` (258).

## Auditoría: lo que sigue
1. **Mapear «anuncio → habitación» automático:**
   - El problema: cuando un hotel tiene varias habitaciones iguales en un mismo anuncio de Booking, el aviso no dice cuál
     es. Hoy se asigna con un toque.
   - La mejora: recordar la última habitación asignada para ese anuncio y sugerirla.
2. **Correo de confirmación como tercera fuente:**
   - Booking y Airbnb también mandan un correo con todos los datos (celular completo, hora de llegada, país).
   - Con un correo de reenvío propio del negocio, ORDEVA lo leería sin tener el celular a mano.
   - Necesita configurar un servicio de correo entrante.
3. **Precio y comisión:**
   - Guardar el valor de la reserva y la comisión de Booking o Airbnb para el cuadre.
   - El aviso a veces trae el valor; el iCal nunca lo trae.
4. **Recordatorio al huésped por WhatsApp un día antes**, con la hora de entrada y la ubicación. Ya tenemos el celular
   cuando el aviso lo trae.
5. **Channel manager certificado:** para conexión directa y al segundo (precios y disponibilidad también hacia Booking), lo
   profesional es conectarse por medio de uno certificado: Cloudbeds, Beds24 o Smoobu, que ORDEVA ya acepta en la lista de
   calendarios. Su API sí entrega todos los datos. Necesita la cuenta del dueño con ese proveedor.
