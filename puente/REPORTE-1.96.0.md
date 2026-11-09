# ORDEVA 1.96.0 · 🔒 El QR de pago, la carta y los estados solo los publica el negocio

**Pedido del dueño:** «continúa como creas mejor». Es el punto que seguía en el plan: lo que quedaba de la auditoría 1.95.3
en el servidor (`puente/egm/PLAN-1.96.md`).

## Qué pasaba
- **S1 · QR de pago falso:** cualquiera que viera el QR de una mesa conocía el canal del negocio. Con eso podía publicar, sin
  cuenta:
  - un **QR de pago falso con otra llave Bre-B**, y los clientes le pagarían a otro;
  - una carta falsa;
  - estados de pedidos falsos.
- **S10 · Datos de pago a la vista:** el mesero recibía del servidor el código de comercio de Nequi, la terminal de
  DaviPlata y la llave de Wompi.
- **S6 · Bonos sin control de rol:** cualquier miembro (un mesero) podía crear bonos con valor y ver todos los códigos, que
  valen como plata.
- **Búsquedas de música frenadas:** todo el Wi-Fi de un bar comparte una IP. Con 40 búsquedas por minuto, un bar lleno veía
  «muchas búsquedas».

## Qué cambió
- **Los canales del negocio** (estados, carta, fotos y QR de pago, ambiente) **solo los escribe un miembro del negocio, con
  su sesión.**
  - El canal de pedidos sigue abierto: el cliente del QR manda pedidos y canciones igual que antes.
  - Cada mensaje queda **firmado** o no. Desde el cierre, al cliente solo le llegan los firmados, así que un QR falso
    publicado antes desaparece.
  - El **QR de pago** solo lo cambian el **dueño o el administrador**.
  - **Nadie se puede apropiar del canal de otro negocio**, en ninguna dirección. Un negocio no puede registrar el canal de
    la carta o del QR de pago de otro, ni registrar el nombre «sin la última letra» para quitarle el canal de pedidos.
  - Si alguien ya lo había registrado antes de esta versión, el negocio dueño sigue publicando y sus clientes siguen
    leyendo.
  - **Gracia de 72 horas** para que los celulares del negocio se actualicen. La versión sube a 1.96.0 y la app se actualiza
    sola.
  - Al abrir la versión nueva, la app vuelve a publicar firmados la carta, las fotos y el QR de pago.
  - Un QR guardado en el celular del cliente se olvida si el local no lo volvió a publicar en 12 h.
  - Si un equipo no puede publicar, el dueño ve un aviso con qué hacer.
  - Los estados de pedidos y canciones se reintentan 3 veces si no salieron.
- **Nequi y los demás datos de pago:** solo para dueño y administrador. El cajero, el mesero y el empleado siguen viendo que
  Nequi o DaviPlata están conectados, y el botón «Cobrar cuenta» sigue igual.
- **Bonos:**
  - **crear y ver la lista con los códigos:** solo dueño, administrador o cajero. Cobrar con un bono sigue abierto a todos;
  - **devolver el saldo:** esos roles o quien hizo la redención. Si no tiene permiso, se le dice a quién pedirlo, sin
    reintentar para siempre;
  - **los códigos van tapados** (`•••ABC`) en los datos que ve todo el equipo: caja, auditoría y pagos.
- **Búsquedas de música:** el servidor deja 150 por minuto por conexión (antes 40) y guarda 10 minutos lo que ya buscó.
  Lo que ya está guardado no gasta del límite.

## Cómo está hecho
- **`supabase/migrations/20261202000000_canales_del_negocio.sql`:**
  - **Canales:**
    - `canal_publicar`: firma, permiso y QR solo para dueño o administrador;
    - `canal_leer`: entrega solo lo firmado después del cierre, y siempre lee los canales del negocio;
    - `canal_privado_anotar`: sin choques entre negocios;
    - `canal_dueno_derivado`: el primero que registra gana;
    - `canal_escribir_activo`: con una fecha mala no cierra.
  - **Pagos y bonos:** `pagos_estado`, `bono_crear`, `bono_lista`, `bono_devolver`.
  - **Para el dueño de ORDEVA:** `canal_choques()`, `canal_registros_sospechosos()` y `canal_sin_firmar_resumen()`.
  - Un índice nuevo para leer rápido lo firmado.
  - No borra nada.
- **La app:**
  - `lib/vento-canal.js`: publica con la sesión y la espera en los canales del negocio;
  - `app/09`: reintentos y aviso;
  - `app/16`: el QR solo dueño o administrador, y vuelve a publicar firmado;
  - `app/12`: las fotos se vuelven a publicar;
  - `lib/vento-bonos.js` y `lib/vento-pos.js`: códigos tapados, permisos y mensajes;
  - `pedido.html`: el QR viejo se olvida.
- **El servidor de búsquedas:** `supabase/functions/vento-ia/index.ts`.

## Revisión goldfish (EGM)
Dos revisiones antes de publicar, cada una con dos revisores sin la conversación. Detalle:
`puente/egm/REVISION-GOLDFISH-1.96.md`.
- **Del plan:**
  - el bloqueante de «el primero que registra se queda con todo»;
  - la gracia;
  - la ruta abierta del servidor de pagos;
  - los mensajes falsos que sobreviven;
  - los bonos.
- **Del cambio:**
  - el bloqueante del registro «al revés», que permitía cortarle los pedidos a otro;
  - la versión sin subir;
  - los registros viejos;
  - el reintento sin fin de los bonos;
  - los códigos de los bonos en los datos compartidos;
  - el QR de pago para cualquier miembro.

Todo quedó corregido y con prueba.

## Pruebas
- **Servidor nueva:** `canalescritura` (49), con estos casos:
  - gracia y cierre por cada canal;
  - miembros y desconocidos;
  - otro negocio y la ruta abierta del servidor de pagos;
  - el registro «al revés» y los registros viejos;
  - el QR de pago por rol;
  - S10 con 5 roles, también por `/vento-pagos/config`;
  - S6 con 5 roles y devoluciones;
  - volver a correr la migración.
- **App nueva:** `v196` (10), de punta a punta:
  - la app del negocio publica firmado;
  - un QR falso de un desconocido no le llega al cliente;
  - los pedidos y sus estados siguen funcionando.
- **Después de los arreglos:** las 30 pruebas del servidor pasan, y la revisión de migraciones pasa (no borra datos y las 61
  se aplican). También pasan `v1954` y `v193`.
- **Lista completa:** 129 pruebas en el navegador, 2.837 bien, 0 mal (incluye `v196` y `facturascan`). Más las 30 pruebas del servidor y la revisión de migraciones, todas bien.
- **No se probó** con celulares de verdad ni con la base de datos de producción.

## Para el dueño de ORDEVA, durante las 72 h
- **`select * from canal_choques();`:** registros que chocan entre negocios. Hay que revisarlos uno por uno; no se borra nada
  sin tu autorización.
- **`select * from canal_sin_firmar_resumen();`:** si quedan muchos mensajes sin firmar de un negocio, ese negocio tiene
  celulares sin actualizar.
- **La fecha del cierre:** está en `servidor_config` (`canal_escribir_desde`) y se puede mover.

## Lo que queda para el plan
- **Los canales de la pantalla del cliente (`pt…`) y de la cuenta de cada mesa (`v`)** todavía no están protegidos. Van con
  S2 (códigos por cuenta abierta).
- **Un negocio que nunca usó la nube** no tiene su canal registrado. Si otro lo registra primero, se queda con él. Hace
  falta una prueba de que el canal es suyo.
- **Los estados que no salieron** se reintentan solo mientras la app sigue abierta; no quedan en una cola guardada.
- **La firma es «sí o no».** Debería decir de qué negocio es, por si algún día se reasigna un canal.
- **El botón de bonos** usa el rol de la nube. Un mesero que entra con PIN en el celular del dueño lo sigue viendo: es el
  límite conocido de los PIN.
- **Quien cobró con un bono puede devolver su saldo** aunque la venta siga registrada. Habría que atarlo a deshacer la venta
  en el servidor.
