# Vento 1.39.0 — Suscripciones en tiempo real y apps que solo funcionan conectadas a la base de datos

## 1. Activar, cambiar o cancelar una suscripción: se ve al instante
- **Qué pasaba:** el administrador activaba o cancelaba un plan, pero la app del negocio se enteraba hasta 30 minutos
  después (refresco de respaldo).
- **Ahora:** la base de datos avisa en el mismo momento (Realtime, canal `vs-<negocio>`) cuando cambia la suscripción o
  un pago de ese negocio: activar, dar meses, cambiar plan, cancelar, aprobar o rechazar un pago, o vencer por fecha.
  - Lo escuchan **todos los celulares y todos los roles** del negocio (dueño, administrador, caja, mesero).
  - El aviso **no lleva datos**: solo dice «cambió». Cada app vuelve a pedir su estado **firmado** al servidor, así que
    quien decide el plan sigue siendo la base de datos.
  - Varios avisos seguidos (aprobar = pago + suscripción) hacen **una sola consulta**.
  - Respaldo: si el tiempo real se cae, la app reintenta sola y revisa **cada minuto** (antes, cada 30).
- **Panel de Administrador (💳 Suscripciones):** también se pone al día solo (canal `vs-admin`) cuando llega un pago
  nuevo, otro equipo aprueba o vence una suscripción. Sin tocar 🔄.
- **Migración:** `20261018000000_suscripciones_tiempo_real.sql` (triggers en `subscriptions` y `payment_records`).
  Hay que correrla en Supabase para que el aviso funcione.

## 2. Ninguna app funciona sin la base de datos
- **La app del negocio (`index.html`)** queda tapada por la **puerta** (`lib/vento-puerta.js`):
  - **Sin cuenta de Vento Nube** en el equipo → «🔐 Conecta Vento a tu cuenta», con el botón para entrar o crear la cuenta.
  - **Con cuenta, mientras llega el estado firmado del servidor** → «⏳ Conectando con Vento…» (con Reintentar).
  - **Sin internet:** sigue con el último estado firmado hasta su vencimiento (**72 h**). Pasado ese tiempo y sin poder
    renovarlo → «📡 Sin conexión con Vento», hasta que vuelva la conexión (abre sola).
  - Ya no hay modo local sin cuenta. El equipo del **proveedor** (licencia «proveedor») no se bloquea.
  - En `localhost`/archivo local (desarrollo y pruebas) la puerta no se activa, salvo con `?puerta=1`.
- **Mesero, pantalla de preparación y TV:** si no hay respuesta de la base de datos (4 s después de fallar, o 12 s sin
  haber conectado nunca) se tapan con «📡 Sin conexión con Vento» y se destapan solas al volver.
- **La página del cliente por QR (`pedido.html`) no cambia.**

## Pruebas
- Nueva `puertaytiemporeal`: sin cuenta (tapa y botón), con cuenta (abre), activar PRO al instante (< 3 s), tres avisos =
  una consulta, cancelar al instante, reactivar, sin internet con estado vigente, estado vencido sin poder renovar →
  «Sin conexión», y al volver el internet abre sola.
