# ORDEVA 1.63.0 · Las recargas de Nequi sin el nombre del banco · Pantallazos girados y la lista de movimientos · Vista sencilla

## 1. 💜 «Recarga desde Bancolombia» que no sonó
- **Lo que pasó:** el 24 de octubre llegaron $1.950 a Nequi como «Recarga desde Bancolombia» y no sonó, ni con la
  pantalla bloqueada ni prendida.
- **Lo que ya se reconocía:** desde la 1.57.1 el aviso «Recarga desde Bancolombia por $…» se toma como plata que llegó.
- **Lo que NO se reconocía:** si el aviso no trae el nombre del banco, no se tomaba. Ejemplos:
  - «Recarga exitosa por $1.950»
  - «Recarga realizada $1.950»
  - «Recargamos $1.950 a tu Nequi»
  - «Tu Nequi fue recargado con $1.950»
  - «Se recargó tu Nequi con $1.950»
  - «Recargaste $1.950»
- **El arreglo:** ahora estas formas cuentan como plata que llegó, con la misma regla en los tres lugares:
  - la app Android (`AvisoPago.RECARGA`);
  - la página (`PG_RECARGA`), que también recibe los avisos que la app Android no entiende;
  - el servidor (`vento-pagos/avisos.ts`).
- **Lo que sigue sin contar como pago:**
  - la recarga de un celular (minutos, datos, operador o un número);
  - la recarga de TuLlave, TransMilenio, SITP, Cívica, peajes o Flypass;
  - una recarga fallida o pendiente;
  - la publicidad «Recarga tu Nequi y gana…».
- **Lo que NO pude comprobar:**
  - No tengo el texto exacto del aviso que mandó Nequi ese día, así que no sé si el problema era el texto.
  - También pudo ser otra cosa: el permiso de notificaciones apagado, Android cerrando ORDEVA, o ese equipo marcado
    «🔕 No suena».
- **Para salir de la duda, dos cosas nuevas:**
  1. **El reporte trae los avisos de pago del equipo.** «🐞 Reportar un problema» ahora incluye:
     - si el lector de avisos está vivo;
     - si en ese equipo suenan los pagos;
     - cuándo llegó el último aviso de un banco;
     - los últimos 8 avisos y qué hizo ORDEVA con cada uno. Van sin nombres ni números.
  2. **Se ve en ORDEVA Admin → Soporte**, en el diagnóstico del caso («💜 Avisos de pago en este equipo»).
     - El servidor lo recorta: máximo 8 avisos y nada de campos raros.
     - Migración `20261116000000_soporte_diag_pagos.sql`: la misma función con un campo más. No borra nada.
- **Lo que ya existía:** los avisos de banco que ORDEVA no toma siguen llegando solos a ORDEVA Admin → 🐞 Errores
  («Aviso del banco que ORDEVA no tomó»), y también salen en Ajustes → 💜 Pagos → «📋 Últimos avisos del banco y qué
  hizo ORDEVA».
- **Pruebas:**
  - `AvisoPagoPrueba` (Java): 203/203, con las 6 formas nuevas y 3 que no son pago.
  - `servidor/avisos`: 34/34.
  - `pagosaviso`: pasa.
  - `servidor/admin`: 169/169, con el diagnóstico de pagos en el reporte.
- **La app Android:** la regla nueva entra con el APK nuevo, que compila GitHub (Actions → android). Mientras tanto,
  la página también reconoce estas formas, siempre que la página esté despierta.

## 2. 🔎 Pantallazos de Nequi: foto girada, «$» mal leído y la lista de movimientos
- **Foto al revés o de lado:** si no se entiende nada, se gira sola y se vuelve a leer, en este orden:
  - foto horizontal: de lado, del otro lado y al revés;
  - foto vertical: al revés primero.
- **Resultados con las fotos que mandaste:**
  - **La foto al revés** se lee completa: $11.000, referencia M05698629 y 24 oct 10:37 a. m.
  - **La foto de lado** da la referencia M07383225, 24 oct 11:34 a. m. y «Recarga realizada».
    - El valor no lo saca el lector sin internet, porque la foto tiene reflejos.
    - Con internet lo lee la IA del negocio, marcado 🤖, y solo vale si coincide con un pago que de verdad llegó.
- **El «$» leído como «5» o «6»:**
  - «5 11.000,00» es $11.000.
  - «51.950,00» sin «$» puede ser $1.950 o $51.950. Se guardan los dos y vale el que coincide con un pago que de verdad
    llegó.
  - Si ninguno coincide, la app avisa que lo mires en el pantallazo.
- **La «O» leída como cero:** «MO5698629» se arregla a «M05698629».
- **«Recarga desde Bancolombia» en el comprobante:** cuenta como Nequi y como exitosa.
- **La lista de movimientos de Nequi** antes se leía como un solo comprobante por $14.400. Ahora sale
  «📋 Movimientos de Nequi»:
  - cada llegada en su fila: $2.800, $4.300, $2.500, $11.000 y $14.400;
  - cada fila dice si ya llegó («✅ Llegó a las 10:37») o todavía no;
  - se toca la que es de la cuenta y se verifica como un comprobante;
  - con «Registrar», ese valor va a la cuenta.
- **Un comprobante con varios valores no se confunde con la lista:** si dice «exitosa», «aprobación», «referencia» o
  «¿Cuánto?», es un comprobante.
- **Prueba:** `comprobantepantallazo` 39/39. Las 10 nuevas usan el texto tal como salió de tus fotos, más una foto al
  revés hecha en la prueba.

## 3. 🧭 Vista sencilla (Ajustes → Apariencia)
- **Es opcional y va por equipo.** El diseño de siempre sigue igual y es el de fábrica. Se prende en Ajustes →
  Apariencia → «🧭 Vista sencilla», de primera en la lista.
- **Muestra lo mismo más simple; no cambia ninguna función:**
  - **Abajo, solo 4 botones:** Cuentas · Productos · 💵 Caja · Más. La Caja solo sale para el dueño o el
    administrador.
  - **«Más» en una lista por grupos,** cada cosa con su nombre:
    - **Mi negocio:** Contabilidad, Estadísticas, Carta, Historial, Pantalla de pedidos, Música, Libreta y Pagos.
    - **Ayudantes:** ORDEVA IA y Calculadora.
    - **Mi cuenta:** Plan, Ajustes, Reportar y Salir.
  - **💵 Caja,** desde el último cierre, con las mismas cuentas del cierre de caja (no se calcula nada aparte):
    - lo vendido y en cuántas cuentas;
    - efectivo, Nequi y transferencias, y lo que quedaron debiendo;
    - lo que falta cobrar en las cuentas abiertas;
    - botones Historial, Quién me debe, Cuenta general y «Cerrar caja del día», que pregunta antes de cerrar, como
      siempre.
  - **En Cuentas:** «Cuenta general», «Número de mesas» y «Lista / Mapa» quedan en «⋯ Más opciones».
  - **En la cuenta:**
    - los iconos sin nombre pasan a «⋯ Opciones»: Cambiar el nombre, Pasar a otra mesa, Juntar con otra mesa,
      Sonido y, de último y en rojo, Vaciar la mesa;
    - abajo queda fija una barra con lo que falta por pagar y el botón «Cobrar»;
    - «Cobrar» pone el total en el pago; no registra nada solo;
    - los botones Efectivo / Transferencia / Queda debiendo son más grandes.
- **Apagarla deja todo como estaba.**
- **Archivo nuevo:** `lib/vento-sencilla.js`. No se tocó ninguna pantalla existente.
- **Lo que quedó fuera de la propuesta:**
  - Ajustes por 4 grupos con buscador: Ajustes ya tiene sus categorías y no las cambié.
  - «Primeros pasos» más corto.
- **Prueba:** `vistasencilla` 39/39 (nueva), en celular y computador:
  - apagada de fábrica, y prenderla desde Ajustes;
  - las 4 de abajo y «Más» por grupos;
  - las cifras de la Caja, incluido que no suma lo de antes del último cierre;
  - «Cerrar caja» pregunta antes;
  - «Opciones» hace lo mismo que el icono;
  - «Cobrar» no registra solo;
  - un empleado no ve la Caja;
  - al apagarla vuelve todo igual.

## Resultado de las pruebas
- **App:** 100 archivos, en 4 partes a la vez.
  - Las que fallaron por la carga de la máquina pasan corridas solas: appoweb, cuentas, usuariosequipo, entrar,
    recuperacion, cajapos, pinempleado, adminsubreal y cuentacliente.
  - `almacen` (6. «lo que escribió una versión vieja») falla a veces:
    - pasa 1 de cada 2 o 3 veces, igual con la 1.62.0 sin estos cambios (la revisé en la misma máquina);
    - es la prueba misma: la app guarda sola justo mientras la prueba simula la versión vieja;
    - no la toqué.
- **Servidor:** 21/21.
- **Java (reglas de los avisos):** 203/203.
