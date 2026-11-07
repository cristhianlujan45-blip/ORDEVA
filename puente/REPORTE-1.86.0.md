# ORDEVA 1.86.0 · Domicilios con estados, en todos los equipos

**Para:** la tienda de barrio, el restaurante y el bar. Es la sección 6b del plan `puente/egm/POS-COMPLETO.md`.

## 1. Lo que estaba mal
- **El domicilio que llega por el link** (página web, Instagram, WhatsApp) quedaba guardado solo en el celular que lo
  recibió:
  - otro equipo no lo veía, o lo tenía aparte;
  - si dos equipos lo recibían, los dos lo podían facturar.
- **Una vez facturado** no se sabía si ya había salido ni si ya había llegado.

## 2. Lo nuevo
- **Por facturar, en todos los equipos:**
  - los domicilios que entran por el link o por la IA quedan en los datos del negocio, y se ven en todos los equipos;
  - los que estaban guardados en un celular se pasan solos;
  - cuando un equipo factura uno, desaparece de «por facturar» en los demás.
- **Sin repetidos:**
  - el domicilio del link lleva el número del mensaje del canal, que es el mismo en todos los equipos, así no queda dos
    veces;
  - si otro equipo ya lo facturó, ORDEVA avisa y no lo vuelve a facturar.
- **Estados.** Al facturar queda «🍳 Preparando». Después:
  - «🛵 Salió»: pregunta, si se quiere, quién lo lleva;
  - «✅ Entregado».

  El estado y su historial (quién y a qué hora) quedan en la misma venta.
- **El tablero:** el botón «🛵 Domicilio (N)» de siempre lo abre. Muestra:
  - 📥 Por facturar → 🍳 Preparando → 🛵 En camino → ✅ Entregado (los de hoy);
  - de cada domicilio, el cliente, la dirección, el total, si está pago o se paga al recibir, hace cuánto entró y quién
    lo lleva.
- **«📲 Avisar»:** abre el WhatsApp del cliente con el mensaje del estado. Por ejemplo: «Tu pedido ya va en camino 🛵 con
  Carlos. Total: $43.000 (se paga al recibir)».
- **Deshacer la venta** devuelve el domicilio del link a «por facturar».
- **«✕ Descartar»** quita un pedido que no se va a facturar.
- **Limpieza:** los facturados y descartados de hace más de 2 días se quitan de la lista de por facturar. La venta guarda
  el cliente, el teléfono y la dirección, y no se toca.

## 3. Pruebas
- **Prueba nueva `v186`:** 15 de 15.
- **Las 15 pruebas de lo que toca la 1.86:** 318 revisiones bien, 0 mal. Son `agente`, `ajustesorden`, `finanzas`, `modos`,
  `parlante`, `qrprivado`, `recetas`, `seguridadqr`, `sincstress`, `tablero`, `v184`, `v185`, `ventasfiados`, `cajamas` y
  `sincroniza`.
- **La lista completa (109 pruebas, todas las de GitHub + `facturascan`):** 2.544 revisiones bien, 0 mal.
- **Las 27 del servidor:** pasan.
- **Android (`javaavisos`, con la librería `android-all`):** 328 de 328.
- **No se probó con equipos de verdad** (dos celulares a la vez, WhatsApp real).

## 4. Lo que sigue
- **1.87, hoteles:**
  - tarifas por temporada y fin de semana;
  - la comisión de Booking o Airbnb en la ganancia de cada reserva.
