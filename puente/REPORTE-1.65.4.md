# ORDEVA 1.65.4 · El pago llega al mismo tiempo a TODOS los equipos

## Qué pidió el dueño
«No solo en los celulares: en todos los dispositivos. Si tengo la cuenta abierta en un celular, en un computador y en
una tableta, tiene que llegar simultáneamente en todos los equipos.»

## Cómo le llegaban los pagos a la página (computador, tableta, navegador)
- **Dueño y administrador:** tiempo real de la tabla de pagos (`postgres_changes`). Depende de la sesión y del permiso
  de la tabla. Si se caía, esperaba **15 s** para volver a conectarse y mientras tanto preguntaba cada 6 s.
- **Caja y empleados:** solo preguntaban **cada 6 s**.
- **Con ORDEVA cerrada en el navegador:** solo llega por notificación push, y **ningún equipo la tenía activada**
  (diagnóstico: `con_push = 0`).

## Qué cambia
- **La página escucha el mismo aviso en vivo del servidor que la app Android (1.65.3):**
  - Usa el canal secreto del negocio `vp-…`. La función `pagos_canal_vivo` (migración
    `20261120000000_pagos_canal_pagina.sql`) se lo da solo a quien es miembro del negocio.
  - Al aviso, trae los pagos en ese instante.
  - Sirve igual en el programa de PC, en una tableta o en cualquier navegador, y para todos los roles.
  - Si se cae, vuelve a conectarse a los **3 s** (antes 15) y al volver internet.
- **Si llega un aviso mientras ya está trayendo pagos,** vuelve a preguntar apenas termine (`sincronizar`).
- **Notificación push en computadores y tabletas con navegador**, para cuando ORDEVA esté cerrada:
  - Se ofrece una vez a dueño, administrador y caja: «Que los pagos te lleguen aunque cierres ORDEVA». Si dice
    «Luego», se ofrece otra vez a los 3 días.
  - No se ofrece en la app Android (ella misma avisa) ni en el programa de PC (sigue trabajando junto al reloj).
  - El servidor ya mandaba ese push apenas se aprobaba el pago.
- **La pregunta cada 6 / 20 s sigue de respaldo.**

## Pruebas
- **`pagostodos` (nueva, 11 ✅):** de punta a punta con PostgreSQL real, el Servidor ORDEVA y la app de verdad, en un
  celular Android, un computador y una tableta. El Supabase Realtime se simula igual que el de verdad.
  - Los tres equipos se unen al mismo canal secreto.
  - **El pago aparece en los tres en 57–111 ms**, con 14–41 ms de diferencia entre ellos. Un segundo pago, igual.
  - Si se cae la conexión de la tableta, vuelve sola y el siguiente pago le llega en 78 ms.
  - El computador ofrece la notificación push; el celular Android no.
  - **Comprobación al revés:** con el aviso en vivo de la página apagado, el pago no llega a ningún equipo en 8 s.
- **Siguen bien:** `pagosequipos` 50, `pagossuenan` 13, `confirmapago` 61, `pagosaviso` 94, `alertaspagos` 13,
  `cerrarcaja` 26, `canalvivo` 17 y `entrar` 35.
- **Servidor:** `pagosprivados` 32, y las 46 migraciones se aplican sobre una base vacía.

## Lo que no se pudo probar
Equipos reales en redes reales: queda lo que tarde internet en cada uno (normalmente menos de un segundo). En un
navegador cerrado, el push depende de que la persona haya tocado «Permitir».
