# ORDEVA 1.81.3 · Auditoría y avisos de pago más rápidos (trabajo de la 1.72.6, puesto sobre la 1.81.2)

**Pedido del dueño:** «hazme una auditoría otra vez y mejora los pagos por transferencia, QR y todo eso. Antes el aviso
llegaba más rápido cuando pagaban por Nequi y DaviPlata; ahora se demora más. Todo tiene que ser inmediato».

> **Nota:** este trabajo se hizo sobre la 1.72.5. Mientras tanto se publicaron la 1.73 a la 1.81.2, así que se juntó con
> la 1.81.2 y sale como **1.81.3**. La migración se llama `20261128000000_pagos_despierto.sql` para no chocar con
> `20261125000000_reservas.sql`. Al volver a correr todas las pruebas sobre la 1.81.2 apareció un error de la 1.81.2 en el
> cierre de caja (ver «Error del cierre de caja» abajo), ya arreglado.

## 1. El aviso de pago, paso por paso (medido)
Un pago por Nequi o DaviPlata hace este camino:

| Paso | Qué pasa | Medido | ¿Cambió desde que llegaba rápido? |
|---|---|---|---|
| 1 | El banco manda la notificación al celular | Depende del banco y de Google | No depende de ORDEVA |
| 2 | ORDEVA Android la lee y **la dice en voz alta de una** en ese celular | Al instante, sin pasar por la página | No: el código de Android es el mismo desde la 1.66.5 |
| 3 | Android la manda al Servidor ORDEVA | Una conexión (corta a los 8–10 s si no hay red, y reintenta) | No |
| 4 | El servidor la guarda y avisa en vivo a los demás equipos | **0,1–0,2 s** a los tres equipos de la prueba | No: el servidor de pagos es el mismo desde la 1.65.7 |
| 5 | Cada equipo pregunta por el pago y lo dice | Android pregunta al instante; respaldo cada 2,5 s | No |

**Pruebas de punta a punta (todas pasan):**
- `pagostodos`: celular, computador y tableta reciben el pago en 107, 113 y 146 ms;
- `javaenvivo`: la app Android pregunta 1 ms después del aviso en vivo;
- también `pagosaviso` (94), `pagosequipos` (50), `confirmapago` (61), `daviplatacobro` (28) y `abririnstante` (11).

**La página no está ocupada.** Con un negocio grande (300 productos, 2.000 ventas, 30 cuentas abiertas) se midieron 10 s
en reposo, con la cuenta abierta y con la Caja POS abierta:
- **ninguna** tarea larga;
- un aviso se atiende en **4–10 ms**.

Las funciones nuevas de las últimas versiones no frenan el aviso.

**Conclusión:** en el laboratorio no aparece ninguna demora que venga de ORDEVA. Cuando un aviso llega tarde en la vida
real, casi siempre es que **el banco mandó tarde la notificación** al celular (pasa con Nequi y DaviPlata cuando el
celular está en ahorro de batería, o en horas de mucho movimiento).

**Para saberlo con certeza:** en ese celular, **Ajustes → Pagos → «📋 Últimos avisos del banco»**. Cada pago dice si «el
banco lo mandó X s tarde» o si «ORDEVA lo leyó X s después». Los que pasan de 20 s (banco) o 5 s (ORDEVA) le llegan
también a **ORDEVA Admin → 🐞 Errores** como «Pago avisado tarde», con el modelo del celular.

## 2. Lo que se mejoró
- **Servidor de pagos siempre despierto** (migración `20261128000000_pagos_despierto.sql`):
  - **Por qué:** el Servidor ORDEVA de pagos se «duerme» si pasa un rato sin uso, y el primer pago después de un rato
    quieto esperaba a que arrancara (uno o dos segundos más). Antes solo lo despertaba el repaso de cobros cada 5 minutos.
  - **Qué cambió:** cada minuto una pregunta liviana (`/vento-pagos/salud`, sin consultar bancos ni tocar datos) lo
    mantiene listo.
  - **Seguridad:** solo función y tarea programada nuevas; no borra nada y solo el servidor la puede llamar.
- **Cobro con QR de la Caja** (`nube/vento-pagos.js`):
  - **Qué cambió:** mientras el cliente paga el QR, ORDEVA le pide al servidor que consulte al banco **cada 2 s** durante
    los primeros 3 minutos. Antes era cada 10 s. El aviso del banco (webhook) sigue siendo lo primero.
  - **Después de 3 minutos:** vuelve a cada 10 s. Con la pantalla escondida no consulta.
  - **Prueba nueva:** `qrrapido`. Con la versión anterior, 1 consulta en 10 s; ahora, 5.

- **Error encontrado en la auditoría: la cantidad que llegó podía quedar con el costo** (`lib/vento-producto-codigo.js`).
  - **Qué pasaba:** al escanear un producto que llegó, la ventana «📥 ¿Cuántas llegaron?» ponía el cursor en la cantidad
    50 ms después de abrir. En un equipo lento ese salto llegaba tarde: si la persona ya había tocado el **costo** y estaba
    escribiendo, lo que escribía terminaba en la cantidad. Un costo de $1.800 quedaba como **1.800 unidades** en la
    entrada de mercancía, y el costo sin cambiar.
  - **Cómo se encontró:** la prueba `codigoproducto` lo mostró con la máquina cargada (cantidad 6 + 1.800).
  - **Arreglo:** el cursor solo va a la cantidad si la persona no tocó ya otro campo. Igual en la ficha de producto nuevo,
    que saltaba al precio cuando terminaba de buscar el producto por su código (puede tardar segundos).
  - **Prueba:** `codigoproducto` tiene la revisión nueva 9. Con la versión anterior falla (el cursor se va a la cantidad);
    ahora pasa 23 de 23.

- **«Fijar mis QR impresos» ya no dejaba subir los QR** (`app/16-pago-dueno-sube.js`, `app/09-cuentas-mesa-modulo.js`).
  - **Qué pasaba:** para leer la foto del QR se usaba el lector del navegador, que **no existe en Chrome de Windows ni en
    el programa de PC**. Después se usaba uno que se baja de internet. Si no cargaba, salía «⚠️ No pude leer ningún código
    QR en esos archivos» y no había cómo subir los QR que ya están impresos en las mesas.
  - **Arreglo:** ahora usa el lector propio de ORDEVA, el mismo de la cámara de la caja, que funciona en todos los equipos
    y sin internet.
  - **Nuevo, «📷 Escanear con la cámara el QR pegado en la mesa»:** se apunta el celular a cada QR, mesa por mesa, y se van
    agregando sin repetirse.
  - **Los QR impresos no cambian:** se usa exactamente su mismo link, el canal y el código de cada mesa.
  - **Prueba nueva `qrimpresos`** (8 revisiones, sin internet): con la versión anterior falla con ese mismo mensaje; ahora
    lee la foto del QR de un link viejo `…/cuentas/`, lo agrega con la cámara sin repetir y lo fija.

- **Error del cierre de caja (venía de la 1.81.2): ningún cierre guardaba el arqueo** (`app/04g-productos-historial-caja.js`).
  - **Qué pasaba:** el cierre tenía dos veces el dato «caja». El nombre de la caja (que trajo «varias cajas») pisaba el
    arqueo. Desde la 1.81.2 (4 de noviembre, 17:08 UTC) ningún cierre guardó **lo contado, el «faltan / sobran», los
    billetes ni las entradas y salidas**. El resumen por WhatsApp y la pantalla del cierre salían sin la caja.
  - **Cómo se encontró:** la prueba `mejoras` falló 4 revisiones en la 1.81.2 tal como está publicada, sin estos cambios.
    También fallaba esa noche en GitHub.
  - **Arreglo:** el nombre de la caja va ahora en su propio dato («cajaNombre»). Los cierres hechos en la 1.81.2 se siguen
    leyendo bien: dicen su caja y no se rompe nada.
  - **Lo que no se puede recuperar:** el conteo de los cierres hechos entre la 1.81.2 y esta versión. Nunca se guardó. Las
    ventas, los totales y los medios de pago de esos cierres sí están completos.
  - **Prueba:** `mejoras` pasa 32 de 32 (antes 28 y 4 mal). `cajamas` tiene 2 revisiones nuevas, 45 de 45: el cierre de
    la «Caja 2» guarda su arqueo, y un cierre guardado en la 1.81.2 se sigue leyendo.

## 3. Auditoría de todo
### Seguridad
- **Archivos públicos** (página, Android y programa de PC): solo está la clave **pública** (anon). No hay `service_role`,
  claves privadas ni tokens del servidor; se revisó el token de `nube/config.js` y es «anon».
- **ntfy:** no se usa ni hay dependencias. `lib/vento-canal.js` solo convierte las direcciones viejas de ntfy que hayan
  quedado guardadas en un equipo para que vayan al servidor de ORDEVA; nunca se conecta a ntfy.
- **Base de datos:**
  - las 56 migraciones se aplican sobre una base vacía;
  - **todas** las tablas tienen RLS;
  - las migraciones nuevas no borran datos;
  - las funciones de administrador y del servidor no las puede llamar ni un usuario ni un visitante (comprobado).
- **Pruebas del servidor:** las 27 contra PostgreSQL real pasan (aislamiento entre negocios, permisos, pagos privados,
  canales, respaldos, DIAN, Wompi, DaviPlata, suscripciones…).
- **Contraseñas:** no se pueden ver ni desde ORDEVA Admin; el servidor solo guarda una huella cifrada.

### Lo que se arregló en las últimas versiones (1.72.2 a 1.72.6)
- **Caja POS:** su propia entrada en el menú y manejo con el teclado (1.72.2), modo escáner con la cámara (1.72.4) y
  cobro de una mesa en un solo paso (1.72.5).
- **Restaurantes y hoteles:** «Enviar a cocina» y las noches de las habitaciones (1.72.3).
- **Errores y contraseñas:** «Laya dice que hay un error» al abrir, y la contraseña que «funciona una vez y después no»
  (1.72.4).
- **Sincronización:** un dato que podía no subir nunca a la nube al crear el negocio. Por eso el canal del QR podía quedar
  sin proteger (1.72.4).

### Pruebas (sobre la 1.81.2 + estos cambios)
- **La lista completa de CI (94):** 2.296 revisiones bien. La única que falló fue `mejoras`, por el error del cierre de
  caja de la 1.81.2; ya arreglado, pasa 32 de 32.
- **Repetidas después de los arreglos:**
  - `mejoras` 32/32, `cajamas` 45/45, `cajapos` 27/27, `cajapro` 56/56;
  - `codigoproducto` 23/23, `qrimpresos` 8/8, `qrrapido` 6/6, `qrprivado` 9/9, `pagostodos` 17/17.
- **Antes de juntarlo con la 1.81.2:** la lista de entonces (72) pasaba 71 de 72. La que fallaba, `codigoproducto`, tenía
  detrás el error de la cantidad, ya arreglado.
- **Las 27 del servidor:** pasan. Las 56 migraciones se aplican sobre una base vacía y la revisión dice «se puede
  desplegar».

### Pendientes conocidos (sin cambio)
- **`equipoactividad`:** falla de vez en cuando con la máquina muy cargada; al repetirla pasa. (`codigoproducto`, que también
  fallaba así, tenía detrás el error de la cantidad de arriba, ya arreglado.)
- **Un toque perdido** en `sincmesas` con mucha carga: no se pudo repetir en más de 44 corridas.
- **Equipos de verdad:** no hay pruebas con celulares, TVs, lectores ni impresoras reales. Todo se prueba con simuladores
  y con el servidor de pruebas.
- **La dirección vieja `…/cuentas/`:** falta el reenvío a `…/ORDEVA/`, que necesita al dueño en GitHub.
