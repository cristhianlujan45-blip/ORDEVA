# Revisión Goldfish de ORDEVA PLAY (fase 1, 1.97.0)

**Por qué:** PLAY agrega un servidor de juegos abierto a los clientes del QR (sin cuenta). La regla del plan es revisión
goldfish del diseño **y** del cambio antes de publicar. Dos revisores con contexto limpio (diseño y código) dijeron
«no está listo». Esto es lo que encontraron y lo que se hizo.

## Ronda 1 · Diseño y código
| Hallazgo | Gravedad | Qué se hizo |
|---|---|---|
| PLAY escribía un aviso en `canal_mensajes` en cada jugada. El tope global de 6.000 mensajes por minuto es el mismo de los pedidos: unas 250 salas jugando a la vez cortaban los pedidos, las canciones y el QR de pago de **todos** los negocios. Además, las jugadas repetidas y `play_salir` avisaban sin límite. | 🔴 Bloqueante | PLAY ya no escribe en `canal_mensajes` ni manda mensajes de Realtime. El celular pregunta con `play_estado(…, su versión)` y, si nada cambió, la respuesta es corta. Prueba: 0 mensajes `ply…` después de todas las partidas. |
| El impostor podía descubrir la palabra: su pista se rechazaba si la tenía, y probando palabras de la categoría la encontraba. Los intentos fallidos no contaban para el límite. | 🔴 Bloqueante | Al impostor no se le revisa la pista. Las jugadas que no valen ya no lanzan error (devuelven la vista con `error`), así el límite sí las cuenta. Prueba. |
| Un reto decía «brindis… con lo que estés tomando». | 🔴 Bloqueante | Cambiado. La prueba busca también `brind`, `tomando`, `licor`, `guaro` y `aguardiente`. |
| `play_salir` no pedía estar en la sala ni tenía límite. | Mayor | Pide estar en la sala y tiene límite. Prueba. |
| LA BOMBA se ganaba tocando al azar: fallar no costaba nada. | Mayor | Si falla, sigue la misma pregunta y queda 3 s bloqueado. Una respuesta a una pregunta vieja no vale. Pruebas en el servidor y en el navegador. |
| Quien salía de la partida seguía jugando y contando: las fases se cerraban antes de tiempo. | Mayor | Solo cuentan y juegan los que siguen (`play_revisar`). Si se va quien tiene la bomba, la bomba pasa; si se va el elegido de la ruleta, pasa; si se va el impostor, se revela. Pruebas. |
| La limpieza corría dentro de `play_entrar`, sin índices: se podía pasar del tiempo y tumbar la entrada. | Mayor | La limpieza corre con pg_cron cada 10 minutos (`play_limpiar`, en lotes). Índices nuevos en eventos, miembros, salas y puntos. Los puntos se borran a los 90 días. Prueba. |
| La clasificación se podía inflar: en la ruleta cada uno decía «lo hice» (+100), `acerte` decía si una opción era la correcta antes de tiempo y las opciones siempre salían en el mismo orden. | Mayor | En la ruleta los puntos salen solo de los aplausos de los demás (+25 cada uno). `acerte` se dice solo al cerrar la pregunta. Las opciones salen revueltas. Tope de 3.000 puntos por jugador por día. Pruebas. |
| El celular preguntaba dos veces (sondeo + EventSource), sin parar al terminar ni con la pestaña escondida, varias preguntas a la vez y cada 250 ms con el reloj en 0. | Mayor | Una pregunta a la vez, 2 s jugando y 3,5 s esperando. No pregunta con la pestaña «Pedido» abierta ni con el celular bloqueado, y para al terminar. Cada llamada tiene 8 s de tiempo. Pruebas en el navegador. |
| Los límites solo contaban las jugadas que salían bien. Varias funciones no tenían límite. | Mayor | `play_cupo`: 25 llamadas cada 10 s por jugador, en todas las funciones menos `play_estado`, que es una lectura corta con la versión. Prueba. |
| Abusos: muchos jugadores o salas por negocio, avatar libre, apodos y pistas groseros, «contra otras mesas» prendido para todos. | Mayor | 400 jugadores nuevos por hora por negocio y 60 por minuto por IP (un local entero sale por la misma IP del wifi). 60 salas abiertas por negocio. Avatar solo de la lista. Filtro básico de groserías. «Contra otras mesas» apagado hasta que el negocio lo prenda. Pruebas. |
| Los retos de «tu mesa» o «tu derecha» salían en el modo «todo el local». | Menor | `solo_mesa`: no salen en ese modo. Prueba. |
| EL IMPOSTOR: las pistas solo se veían al final; solo 2 rondas. | Menor | Las pistas se ven a medida que llegan. 3 rondas, y cada ronda revisa que sigan siendo 3 o más. Pruebas. |
| `hecho` contaba la pista como voto: en «votar» la pantalla decía «Votaste» sin haber votado. | Mayor (se encontró al probar) | `hecho` mira solo la jugada de la fase. Prueba. |
| Preguntas con dos respuestas buenas (el Carnaval de Barranquilla y el de Pasto son patrimonio; el río más largo es discutido). | Menor | «¿En qué ciudad se celebra el Carnaval de Negros y Blancos?» y «¿Cuál es el río más caudaloso?». No se repiten preguntas en el local en 6 h. |
| Empates en la pantalla final. | Menor | «¡Empate! A y B». |
| Sala de espera: sin reglas, sin aviso de conexión, el anfitrión ausente la dejaba trabada. | Menor | Reglas en la sala, aviso «Sin conexión… reintentando», y si el anfitrión lleva más de 60 s sin aparecer la empieza el siguiente. Pruebas. |
| `play_tick` antes de revisar que fuera de la sala; apagar PLAY no paraba las partidas; prender sin juegos; el apodo viejo en la clasificación. | Menor | El reloj se mueve después de revisar. Apagar PLAY (o quitar un juego) termina las partidas. No se prende sin juegos. Se usa el apodo más reciente. Pruebas. |
| Códigos de sala con I, L u O; dos salas con el mismo código al mismo tiempo. | Menor | `upper` antes de quitar letras; si choca, otro código. |
| Una respuesta después de «Salir» volvía a pintar la sala vieja; `data.playOn` se podía desfasar del servidor. | Menor | Se revisa la sala antes de pintar. Al abrir el panel, la pestaña sigue al servidor. |
| Accesibilidad: avisos sin `aria-live`, avatares sin `aria-pressed`, bordes claros fijos. | Menor | Arreglado (`role="status"`, `aria-pressed`, `var(--line)`, foco visible). |
| Las secuencias de las tablas tenían los permisos de siempre. | Menor | Quitados a `anon` y `authenticated`. |

## Pruebas después de los arreglos
- `pruebas/servidor/play.test.js`: **75 bien, 0 mal** (antes 49).
- `pruebas/play.test.js` (navegador, varios celulares): **37 bien, 0 mal** (antes 19). Cubre los 5 juegos, las pistas y los
  votos del impostor, la bomba bloqueada, la ruleta con aplausos, sin conexión, la pestaña escondida y que no escribe en
  los canales.

## Lo que queda (decisiones, no errores)
- `play_estado` no tiene límite por jugador: es una lectura corta con la versión (no escribe, salvo `visto` cada 10 s).
- Una persona con varios celulares puede sumar en la clasificación. Hay topes, pero no hay forma de saber que son la misma
  persona sin pedir datos (y PLAY no los pide). Por eso los premios son opcionales y no van en esta fase.
- «Hoy» es la hora de Colombia (`play_hoy()`): todos los negocios de ORDEVA están en Colombia.
- El filtro de groserías es básico (palabras completas).
