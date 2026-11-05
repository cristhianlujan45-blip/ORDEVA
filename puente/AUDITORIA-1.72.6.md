# ORDEVA 1.72.6 · Auditoría completa y avisos de pago más rápidos

**Pedido del dueño:** «hazme una auditoría otra vez y mejora los pagos por transferencia, QR y todo eso. Antes el aviso
llegaba más rápido cuando pagaban por Nequi y DaviPlata; ahora se demora más. Todo tiene que ser inmediato».

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
- **Servidor de pagos siempre despierto** (migración `20261125000000_pagos_despierto.sql`):
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

## 3. Auditoría de todo
### Seguridad
- **Archivos públicos** (página, Android y programa de PC): solo está la clave **pública** (anon). No hay `service_role`,
  claves privadas ni tokens del servidor; se revisó el token de `nube/config.js` y es «anon».
- **ntfy:** no se usa ni hay dependencias. `lib/vento-canal.js` solo convierte las direcciones viejas de ntfy que hayan
  quedado guardadas en un equipo para que vayan al servidor de ORDEVA; nunca se conecta a ntfy.
- **Base de datos:**
  - las 53 migraciones se aplican sobre una base vacía;
  - **todas** las tablas tienen RLS;
  - las migraciones nuevas no borran datos;
  - las funciones de administrador y del servidor no las puede llamar ni un usuario ni un visitante (comprobado).
- **Pruebas del servidor:** las 25 contra PostgreSQL real pasan (aislamiento entre negocios, permisos, pagos privados,
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

### Pruebas
- **La lista completa de CI (72):** ver el resultado al final.
- **Las 25 del servidor:** pasan.

### Pendientes conocidos (sin cambio)
- **`codigoproducto` y `equipoactividad`:** fallan de vez en cuando con la máquina muy cargada; al repetirlas pasan.
- **Un toque perdido** en `sincmesas` con mucha carga: no se pudo repetir en más de 44 corridas.
- **Equipos de verdad:** no hay pruebas con celulares, TVs, lectores ni impresoras reales. Todo se prueba con simuladores
  y con el servidor de pruebas.
- **La dirección vieja `…/cuentas/`:** falta el reenvío a `…/ORDEVA/`, que necesita al dueño en GitHub.
