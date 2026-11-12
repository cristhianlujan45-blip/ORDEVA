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
| LA BOMBA se ganaba tocando al azar: fallar no costaba nada. | Mayor | Si falla, queda 3 s bloqueado (y, desde la ronda 2, sale otra pregunta). Una respuesta a una pregunta vieja no vale. Pruebas en el servidor y en el navegador. |
| Quien salía de la partida seguía jugando y contando: las fases se cerraban antes de tiempo. | Mayor | Solo cuentan y juegan los que siguen (`play_revisar`). Si se va quien tiene la bomba, la bomba pasa; si se va el elegido de la ruleta, pasa; si se va el impostor, se revela. Pruebas. |
| La limpieza corría dentro de `play_entrar`, sin índices: se podía pasar del tiempo y tumbar la entrada. | Mayor | La limpieza corre con pg_cron cada 10 minutos (`play_limpiar`, en lotes). Índices nuevos en eventos, miembros, salas y puntos. Los puntos se borran a los 90 días. Prueba. |
| La clasificación se podía inflar: en la ruleta cada uno decía «lo hice» (+100), `acerte` decía si una opción era la correcta antes de tiempo y las opciones siempre salían en el mismo orden. | Mayor | En la ruleta los puntos salen solo de los aplausos de los demás (+25 cada uno). `acerte` se dice solo al cerrar la pregunta. Las opciones salen revueltas. Tope de 3.000 puntos por jugador por día. Pruebas. |
| El celular preguntaba dos veces (sondeo + EventSource), sin parar al terminar ni con la pestaña escondida, varias preguntas a la vez y cada 250 ms con el reloj en 0. | Mayor | Una pregunta a la vez, 2 s jugando y 3,5 s esperando. No pregunta con la pestaña «Pedido» abierta ni con el celular bloqueado, y para al terminar. Cada llamada tiene 8 s de tiempo. Pruebas en el navegador. |
| Los límites solo contaban las jugadas que salían bien. Varias funciones no tenían límite. | Mayor | `play_cupo`: 25 llamadas cada 10 s por jugador, en todas las funciones menos `play_estado`, que es una lectura corta con la versión. Prueba. |
| Abusos: muchos jugadores o salas por negocio, avatar libre, apodos y pistas groseros, «contra otras mesas» prendido para todos. | Mayor | 60 jugadores nuevos por minuto por IP (un local entero sale por la misma IP del wifi) y topes por negocio de jugadores y de salas (los números quedaron en la ronda 2). Avatar solo de la lista. Filtro básico de groserías. «Contra otras mesas» apagado hasta que el negocio lo prenda. Pruebas. |
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

## Ronda 2 · Verificación de los arreglos
Un revisor con contexto limpio comprobó cada fila de la ronda 1: 20 verificadas y 2 a medias, sin bloqueantes. Además
encontró esto:

| Hallazgo | Gravedad | Qué se hizo |
|---|---|---|
| En EL SHOW el marcador subía apenas alguien acertaba, y todos ven el marcador: con celulares de más se probaban las opciones y el marcador delataba la correcta (lo mismo que se había cerrado con `acerte`). | Mayor | Los puntos se anotan en la jugada y se suman al cerrar la pregunta. Pruebas en el servidor y en el navegador. |
| El límite de llamadas no contaba las que terminaban en error (el error deshace el contador): unirse con códigos al azar o jugar en salas ajenas no tenía freno. | Mayor | Después de contar, las funciones del cliente no lanzan error: devuelven `{error}` y el celular lo muestra igual. Pruebas con códigos al azar y con salas ajenas. |
| El tope de 60 salas por negocio lo llenaba una sola mesa con unas 70 llamadas, y dejaba al local sin PLAY 3 horas. | Mayor | 8 salas abiertas por mesa. Las salas de espera sin movimiento en 10 minutos dejan de contar, y la limpieza las cierra a los 30 (se terminó de cerrar en la ronda 3). Pruebas. |
| El tope de 400 jugadores nuevos por hora por negocio se gastaba desde una sola IP en 7 minutos. | Mayor | 40 jugadores nuevos por hora por mesa y 1.500 por negocio. Quien ya tiene su token sigue entrando. Pruebas. |
| `play_entrar` no frenaba los intentos fallidos (código de mesa malo) y leía los datos del negocio en cada llamada. | Mayor | 120 entradas por minuto por IP, contadas antes de leer nada, también las que fallan. Volver con el mismo token a la misma mesa ya no lee los datos del negocio. Prueba. |
| LA BOMBA: con la misma pregunta se podía ir descartando opciones (3 fallos como mucho). | Menor | Al fallar sale otra pregunta, además de los 3 s. Pruebas. |
| Si la bomba ya había explotado y quien la tenía salía, se la pasaba a otro. | Menor | `play_salir` mueve el reloj primero. |
| Ganar +200 porque el otro se salió, o porque el negocio apagó PLAY; las salas de espera quedaban como partidas de 0 puntos. | Menor | Sin el +200 en esos casos, y las salas de espera solo se cierran. Prueba. |
| RULETA: se podía aplaudir antes de que hiciera el reto, y quien pasaba se quedaba con los puntos. | Menor | Solo se aplaude después de «¡Lo hice!» (10 s). Pruebas. |
| En la sala de espera, después de pasar el anfitrión, salía el nombre del anterior. | Menor | La vista trae quién es el anfitrión. |
| Una respuesta vieja podía pisar una más nueva en la pantalla; el aviso de «sesión vencida» se borraba; el reloj no volvía después de cerrar. | Menor | Se ignoran las versiones viejas; primero la pantalla y después el aviso; el reloj vuelve al abrir. |

**No se cambió (y por qué):**
- Volver a correr la migración sobre un borrador anterior no quita el contenido viejo: ningún servidor corrió el borrador
  (la migración solo se despliega desde la rama de producción).
- `play_estado` sigue sin límite: es la lectura corta con la versión.
- El límite por IP confía en la primera dirección de `x-forwarded-for`, igual que el de los canales (de antes).
- El tope de puntos por día es por jugador: quien entra de nuevo sin su token empieza otra cuenta.

## Ronda 3 · Verificación de la ronda 2
Otro revisor con contexto limpio leyó solo los cambios de la ronda 2: las 11 filas están hechas como dicen, sin
bloqueantes. Encontró esto:

| Hallazgo | Gravedad | Qué se hizo |
|---|---|---|
| El tope de 8 salas por mesa se podía rodear: las partidas empezadas y abandonadas contaban 3 horas (una mesa se dejaba sin PLAY a sí misma), y juntando salas de espera viejas y empezándolas todas, 2 o 3 mesas llenaban el tope del local. | Mayor | Solo cuentan las salas con movimiento: una partida abandonada deja de contar a los 15 minutos y la limpieza la cierra a los 30. Una sala de espera vieja no se puede empezar si la mesa o el local ya están en el tope. Pruebas. |
| Una sala de espera con gente esperando se escondía de la lista a los 10 minutos y la limpieza la cerraba a los 30. | Menor | Mientras alguien la mira, queda «con movimiento» (una marca cada 2 minutos). La limpieza sube la versión para que el celular lo vea. Prueba. |
| Si EL SHOW se acababa con una pregunta abierta (apagaron PLAY, se fueron todos), las respuestas buenas ya dadas no sumaban. | Menor | Se suman al terminar. Prueba. |
| El contador por IP crecía sin límite si no hay pg_cron. | Menor | Se limpia solo de vez en cuando. |
| Un código de mesa guardado como «nulo» dejaba pasar la revisión (hoy la app no guarda eso). | Menor | Si no se puede comparar, no entra. |
| Al volver a entrar con «vas muy rápido» no salía el aviso. | Menor | Sale. |

**No se cambió (y por qué):** los topes cuentan y después insertan, sin candado: varias llamadas a la vez pueden pasarse por
unas pocas. Son topes contra abusos, no cuentas exactas.

## Pruebas después de los arreglos
- `pruebas/servidor/play.test.js`: **91 bien, 0 mal** (49 al empezar, 75 después de la ronda 1, 86 después de la 2).
- `pruebas/play.test.js` (navegador, varios celulares): **38 bien, 0 mal** (19 al empezar, 37 después de la ronda 1). Cubre los 5 juegos, las pistas y los
  votos del impostor, la bomba bloqueada, la ruleta con aplausos, sin conexión, la pestaña escondida y que no escribe en
  los canales.

## Lo que queda (decisiones, no errores)
- `play_estado` no tiene límite por jugador: es una lectura corta con la versión (no escribe, salvo `visto` cada 10 s).
- Una persona con varios celulares puede sumar en la clasificación. Hay topes, pero no hay forma de saber que son la misma
  persona sin pedir datos (y PLAY no los pide). Por eso los premios son opcionales y no van en esta fase.
- «Hoy» es la hora de Colombia (`play_hoy()`): todos los negocios de ORDEVA están en Colombia.
- El filtro de groserías es básico (palabras completas).
