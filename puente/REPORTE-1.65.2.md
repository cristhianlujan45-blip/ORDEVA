# ORDEVA 1.65.2 · Los pagos suenan con el celular bloqueado + elegir fácil en qué celular suenan

## Qué dijo el dueño
- «Con el celular bloqueado no suenan los pagos: me toca desbloquearlo para que suene.»
- «No llegan en todos los celulares.»
- «Quiero ver claro cuál es cada celular para elegir en cuál suena.»

## Lo que se revisó contra la versión que funcionaba (1.55.3 / 1.57.1)
- **Código Android que lee los avisos del banco** (VentoEscucha, VentoServicio): es el mismo de la 1.57.1. Después
  solo cambiaron:
  - el «suena aquí» de la 1.62.0;
  - el registro de cierres de la app;
  - las reglas de recargas.
- **Datos del servidor** (diagnóstico de solo lectura del 26/10):
  - El celular que lee los avisos del banco es el **Samsung A34** (105 avisos en 3 días; el Xiaomi solo 3).
  - Desde el 24/10 la app no ha registrado ningún aviso **leído tarde**: el Samsung recibe el aviso del banco a tiempo.
  - Los pagos llegan al servidor en tandas a la hora en que se despierta la página. Por ejemplo, 3 pagos de Nequi en
    el mismo segundo (26/10 10:28:20).

## Los dos fallos (1.62.0) y su arreglo

### 1. Android se callaba con el celular bloqueado
- **Cómo funcionaba:** desde la 1.62.0, la app Android solo suena en los equipos que eligió el dueño. Ese «suena aquí»
  solo lo actualizaba la **página**.
- **El fallo:** con el celular bloqueado la página duerme. Si ese dato quedaba viejo, Android no decía el pago ni
  sacaba la notificación. Al desbloquear, la página tomaba el pago y ahí sí sonaba: «me toca desbloquearlo».
- **Arreglo:**
  - **Servidor:** `pagos_dispositivo` (migración `20261118000000_pagos_dispositivo_suena.sql`) ahora dice si ESE
    celular suena. Android le pregunta cada 2,5 s con el token del celular, sin la página.
  - **Android:** `Cruce.java` toma ese dato del servidor y lo guarda.

### 2. Android perdía su conexión directa con el servidor
- **Cuándo pasaba:** cuando el servidor rechazaba el celular, la página le quitaba a Android su conexión directa
  mientras lo volvía a autorizar.
- **El fallo:** si esa autorización no salía (la página dormida con el celular bloqueado, o sin internet un momento),
  Android quedaba sin conexión hasta abrir la app. Mientras tanto:
  - no mandaba los pagos al instante a los otros celulares;
  - no oía los pagos de los otros celulares.
- **Arreglo:** Android conserva su conexión mientras tanto (`nube/vento-pagos.js`, `cruceAndroid`). Si el token de
  verdad ya no sirve, el servidor se lo dice a Android y la página lo vuelve a autorizar, como antes.

## Elegir en cuál celular suena (Ajustes → 💜 Pagos → «🔊 Celulares y dónde suenan los pagos»)
- **Cada equipo con su marca y modelo:** «📱 Samsung Galaxy A34 (SM-A346M)», «📱 Xiaomi 24090RA29G», «💻 Computador
  Windows». Antes todos decían «Dueño · Android». Si se le pone nombre (✏️ Nombre), sale el nombre y el modelo.
- **El equipo donde se está mirando** dice **ESTE CELULAR** y va primero.
- **Estado de cada uno:**
  - 🟢 «Conectado ahora»;
  - 🟡 «Visto hace X min»;
  - ⚪ «cerrado o dormido: no va a sonar».
- **Botón grande:** **🔊 SUENA** (verde) / **🔕 NO SUENA**.

## Pruebas
- **Servidor (PostgreSQL real):**
  - `pagosprivados` 27 ✅, con lo nuevo: «pagos_dispositivo dice suena» y «no suena en el que se eligió callar»;
  - las 44 migraciones se aplican sobre una base vacía (`revisar-migraciones`).
- **App:**
  - `pagosequipos` 50 ✅. La prueba nueva 9 («Android conserva su conexión mientras se vuelve a autorizar») falla con
    el código anterior: Android quedaba sin token.
  - `pagossuenan` 13 ✅, con la lista nueva.
  - También bien: `entrar` 35, `pagosaviso` 94, `confirmapago` 61, `alertaspagos` 13, `avisosandroid` 15,
    `javaavisos` 244 y `fondoapp` 7.

## Para que llegue a los celulares
1. Unir esta rama a la principal.
   - El servidor aplica la migración solo.
   - GitHub compila la app Android nueva. Los celulares la instalan solos, o se baja `vento.apk`.
2. Abrir ORDEVA en el Samsung y en el Xiaomi una vez.
3. En Ajustes → 💜 Pagos, revisar que cada celular diga **🔊 SUENA**.
4. Probar: bloquear el Samsung, que manden $1.000 por Nequi, y ver que suene sin desbloquear, en el Samsung y en el
   Xiaomi.

## Lo que no se pudo probar
Los celulares reales. Si con la app nueva el Samsung sigue callado bloqueado, 🐞 Errores dirá si fue ahorro de batería
o trabajo de fondo apagado (1.65.1).
