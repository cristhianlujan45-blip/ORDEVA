# ORDEVA 1.65.3 · El aviso de pago, al instante en todos los celulares

## Qué pidió el dueño
«Apenas una persona me paga, no debe demorarse nada en notificarme. Todo muy instantáneo, en todos los celulares al
tiempo.»

## Cómo viajaba un pago (revisado en el código)
1. **El celular que lee el aviso del banco** (hoy el Samsung A34) lo dice en voz alta y saca la notificación al
   instante, desde Android, sin esperar a la página. Enseguida lo manda al servidor.
2. **Los demás celulares** se enteraban preguntándole al servidor **cada 2,5 s** (`Cruce.revisar`). Por eso entre un
   celular y otro había hasta 2,5 s de diferencia, más lo que tarda la red.

## Qué cambia
- **Aviso empujado por el servidor** (migración `20261119000000_pagos_al_instante.sql`):
  - Cada negocio tiene un canal secreto en vivo, `vp-<32 letras al azar>`, que no es el id del negocio.
  - Apenas un pago queda **aprobado** (o se marca **falso**), el servidor avisa por ese canal. Usa Supabase Realtime,
    el mismo de los canales de la página. Cubre todos los caminos: aviso del celular, Wompi, Nequi y DaviPlata.
  - El aviso no lleva datos del pago, solo «hay algo nuevo». El pago se pide con el token del celular, como siempre.
  - `pagos_dispositivo` le da a cada app Android ese canal (`vivo`).
- **Conexión en vivo en la app Android** (`EnVivo.java`, nuevo):
  - El servicio de fondo deja abierta la conexión, también con el celular bloqueado.
  - Al llegar el aviso, pregunta en ese mismo instante y suena.
  - Manda su latido cada 25 s.
  - Si se cae la conexión, vuelve a conectarse sola (1 s, 2 s, 4 s… hasta 30 s) y pregunta otra vez por si llegó algo
    mientras tanto.
  - La pregunta cada 2,5 s queda **de respaldo**.
- **Si llega un aviso mientras ya hay una pregunta en camino,** se hace otra apenas termine (`Cruce.revisar`, «otra
  vez»). Así no se espera a la siguiente vuelta.
- **El celular que lee el banco reutiliza su conexión segura con el servidor** (keep-alive). Antes la cerraba en cada
  aviso y la siguiente vez tenía que volver a negociar el cifrado (unos 200-400 ms con datos móviles).

## Pruebas
- **`javaenvivo` (nuevo, 12 ✅):** el cliente Java de verdad contra un servidor igual al de Supabase Realtime.
  - Se une al canal secreto con la llave pública. Sus mensajes van enmascarados.
  - Al quedar unido pregunta una vez.
  - Un pago avisado → pregunta en ~1 ms (la condición de la prueba es menos de 300 ms).
  - Ping/pong y latido.
  - Ignora otros canales y entiende mensajes en partes.
  - Se reconecta solo si se cae la conexión, y los pagos siguen llegando al instante.
- **Servidor** (`pagosprivados`, PostgreSQL real), 32 ✅:
  - el canal en vivo es secreto y es el mismo para todos los celulares del negocio;
  - un pago aprobado avisa por ese canal, sin datos del pago;
  - un cobro pendiente no avisa, y avisa en el instante en que queda pagado;
  - cambiar otra cosa del pago no vuelve a avisar.
- **Las 45 migraciones** se aplican sobre una base vacía (`revisar-migraciones`).
- **App Android:** compila en GitHub (`android.yml` en esta rama, sin publicar).

## Lo que no se pudo probar
El tiempo real entre dos celulares de verdad. Con esto, lo que queda es el tiempo de la red (normalmente menos de un
segundo con buena señal). La voz del celular que lee el banco ya era inmediata y no cambia.
