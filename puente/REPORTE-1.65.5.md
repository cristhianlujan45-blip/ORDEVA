# ORDEVA 1.65.5 · El aviso del pago, al mismo tiempo en todos los equipos aunque estén bloqueados

## Qué pidió el dueño
«Que el aviso llegue al mismo tiempo en todos los dispositivos, así estén bloqueados.»

## Cada tipo de equipo, bloqueado
| Equipo | Cómo le llega el pago bloqueado | Qué faltaba | Qué cambia |
|---|---|---|---|
| Celular o tableta con la **app Android** | Conexión en vivo desde el servicio de fondo (1.65.3), voz y notificación de Android | — (1.65.1 avisa si tiene ahorro de batería o el trabajo de fondo apagado) | — |
| **Computador con el programa ORDEVA** | La página sigue trabajando junto al reloj: voz, sonido y notificación de Windows | Con la pantalla bloqueada, Windows **suspende** el computador a los pocos minutos y ya no llega nada hasta desbloquearlo | Mientras ORDEVA está abierto, **el computador no se suspende** (la pantalla sí se apaga y se bloquea). Al desbloquear o volver de una suspensión, revisa los pagos de una vez. Se puede quitar en el icono junto al reloj. |
| **Computador o tableta con navegador**, ORDEVA abierta de fondo | Aviso en vivo (1.65.4) y notificación del sistema | La notificación de la página y la push del servidor del mismo pago **sonaban dos veces** | La push ve que ese pago ya está en pantalla y no vuelve a sonar. La de un pago queda fija hasta que la toquen. |
| **Navegador cerrado o tableta dormida** | Notificación push del servidor (`Urgency: high`, sale apenas se aprueba el pago) | Ningún equipo la tenía activada | Se ofrece en el navegador (1.65.4). |
| **iPhone / iPad** | Push solo si ORDEVA está en la pantalla de inicio (iOS 16.4 o más) | No se decía nada | Sale la guía: Compartir → «Agregar a pantalla de inicio», abrir desde ese icono y aceptar las notificaciones. |

## Pruebas
- **`pagostodos` (14 ✅):** PostgreSQL real, Servidor ORDEVA y la app de verdad en un celular Android, un computador y
  una tableta, con el Supabase Realtime simulado igual que el de verdad.
  - El pago aparece en los tres en 65–170 ms, con 20 ms de diferencia entre ellos.
  - Con el computador y la tableta en segundo plano (bloqueados o escondidos), la notificación del sistema
    «💜 Recibiste $15.000» sale en los dos en 109 y 125 ms, con la misma marca que la push del servidor.
  - El iPad en Safari muestra la guía de la pantalla de inicio.
- **`swpush` (nueva, 3 ✅):** `sw.js` de verdad.
  - Un pago nuevo suena y queda fijo.
  - Un pago que ORDEVA ya mostró no vuelve a sonar.
  - Otra push sale normal.
- **`pc` (15 ✅):** el programa de PC de verdad (Electron 44 en pantalla virtual). Mientras ORDEVA está abierto, el
  computador no se suspende.
- **Siguen bien:** `abririnstante` 11, `pagosequipos` 50, `pagossuenan` 13, `confirmapago` 61, `alertaspagos` 13,
  `fondoapp` 7 y `javaenvivo` 12.

## Lo que no se pudo probar
- **Equipos reales bloqueados.** Lo de Android depende de que el celular no tenga a ORDEVA con ahorro de batería
  (1.65.1 lo avisa).
- **El programa de PC nuevo** se instala con su actualización automática (release «pc») cuando esta rama se une a la
  principal.
