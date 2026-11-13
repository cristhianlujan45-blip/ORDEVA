# ORDEVA PLAY · Fase 2: torneos entre mesas (plan, 1.98.0)

**Pedido del dueño (definición de ORDEVA PLAY):** «FASE 2: MULTIJUGADOR Y TORNEOS. Implementar salas, equipos, partidas en
tiempo real, puntuaciones y torneos entre mesas.» Después de la fase 1 (1.97.0): «Continúa».

**Lo que ya existe (fase 1):** salas con código, partidas al día en varios celulares, puntos que calcula el servidor, modo
«mi mesa» y «todo el local», y la clasificación del día por jugadores y por mesas. **Falta:** los equipos y los torneos.

## Decisiones que tomé (el dueño dijo «continúa como creas mejor»)
1. **El equipo es la mesa.** No hay equipos dentro de una mesa: nadie tiene que armar equipos, y «mesas contra mesas» es lo
   que pide la definición.
2. **Un torneo es un rato de competencia** (30, 60, 90 o 120 minutos) que el negocio empieza desde su panel. Mientras dura,
   las partidas que **terminen** dentro del torneo suman a la mesa. No hay llaves ni eliminatorias: las mesas llegan y se
   van.
3. **Cómo se cuentan los puntos de una mesa** (regla que salió de la revisión goldfish del plan):
   **«Cada partida le da a tu mesa hasta 100 puntos (los de su mejor jugador). Cuentan las 5 mejores partidas de la mesa.»**
   - Los puntos de la partida se pasan a una escala de 0 a 100 según el juego (referencias: show 1.600, bomba 600,
     impostor 600, sobreviviente 560), con tope en 100.
   - **La Ruleta no suma** («es por diversión»): sus puntos son aplausos que regalan los demás.
   - Una mesa de 2 compite igual que una de 10. Abrir más pestañas en la misma partida no suma nada. Un jugador flojo no
     perjudica a su mesa.
   - Cuenta la mesa donde se jugó cada partida (la que quedó escrita con los puntos).
   - **Empate:** gana la mesa que llegó primero a ese puntaje.
   - **Lo que la regla no evita:** un jugador muy bueno puede cargar a su mesa, y un programa puede llegar al tope. Por eso
     esta fase no da premios; es condición para la fase 3.
4. **Lo empieza y lo termina el dueño o el administrador**, igual que el resto de la configuración de PLAY.
5. **Un torneo a la vez por negocio.**
6. **Sin premios en esta fase.** Al final se anuncia la mesa ganadora. Los premios y cupones son la fase 3.
7. **Las partidas cuentan en los dos modos** («mi mesa» y «todo el local»): el torneo no obliga a prender «contra otras
   mesas».

## Qué ve cada uno
- **El negocio (Más → 🎮 ORDEVA Play → 🏆 Torneo entre mesas):**
  - sin torneo: duración y «Empezar torneo». Si «contra otras mesas» está apagado, un aviso: una persona sola no puede
    jugar;
  - con torneo: cuánto falta, la tabla de mesas (se refresca sola) y «Terminar ahora» (pregunta antes y avisa que las
    partidas sin terminar no suman);
  - el resultado del último torneo, en grande, para anunciarlo: «🏆 Mesa 4 · Caro, Pipe».
- **El cliente (pestaña Play):**
  - en el inicio, una tarjeta «🏆 Torneo de mesas · faltan 42 min · tu mesa va 2.ª»; en los últimos 5 minutos avisa que
    una partida larga puede no alcanzar;
  - si el torneo empieza mientras está en otra pantalla de Play, un aviso (se revisa cada minuto);
  - una pantalla con la tabla de mesas, la regla de los puntos en una línea y el tiempo;
  - al terminar una partida: «✅ Esta partida sumó al torneo», «no alcanzó a sumar» o «la Ruleta no suma», según diga el
    servidor;
  - cuando acaba: «🏆 Ganó la Mesa 4 · Caro, Pipe», visible unas 3 horas. Si nadie jugó: «Nadie jugó». Si solo jugó una
    mesa, se dice así.

## Servidor (migración nueva `20261204000000_play_torneos.sql`; no cambia las funciones de la fase 1)
- **Tabla `play_torneos`:** negocio, inicio, fin, cerrado (cuándo), la tabla de mesas guardada (`tabla`, `tabla_en`), el
  resultado congelado (con la regla usada y los apodos de quienes sumaron) y quién lo creó. Sin nombre: no hace falta.
  Índice único: un solo torneo sin cerrar por negocio. RLS sin políticas, como las demás.
- **`play_puntos` gana dos columnas:** `torneo_id` y `brutos` (los puntos de la partida sin el tope del día: el torneo no
  debe castigar a quien ya jugó mucho antes).
- **Un disparador en `play_puntos`** (antes de insertar) pone `brutos` y, si hay un torneo abierto, `torneo_id`. Así no hay
  que volver a definir `play_terminar`.
  - **Nunca tumba una partida:** si algo falla adentro, la fila se guarda sin torneo (las partidas de todos los negocios
    pasan por ahí, haya torneo o no).
  - **Sin carrera con el cierre:** el disparador lee el torneo con candado compartido; el cierre toma el candado exclusivo y
    solo después calcula. Una partida que alcanzó a ver el torneo abierto queda en el resultado.
- **La tabla de mesas se guarda** y solo se recalcula cuando terminó una partida nueva del torneo (no en cada lectura ni por
  tiempo: al probarlo, con «cada 8 segundos» la tarjeta seguía diciendo «tu mesa todavía no suma» después de jugar). El
  cliente manda la versión que ya tiene y, si no cambió, recibe una respuesta corta. Se devuelven las 10 primeras mesas más
  la del que pregunta.
- **Cierre:** a mano o cuando pasa su hora. Se cierra al leerlo y con pg_cron cada 5 minutos, por si nadie lo mira. El
  resultado de un torneo se muestra hasta 3 horas después de su **hora de fin** (no de cuándo se cerró).
- **Para el negocio (con su sesión):**
  - `play_torneo_crear(negocio, minutos)`: dueño o administrador; PLAY prendido; 15 a 120 minutos. Cierra primero el que
    ya venció; si hay uno abierto, lo dice (no un error raro);
  - `play_torneo_cerrar(negocio)`: dueño o administrador;
  - `play_torneo_ver(negocio)`: cualquier miembro; el torneo abierto o el que terminó en las últimas 12 horas (así no se
    pierde al pasar la medianoche).
- **Para el cliente (con su token):** `play_torneo(token, versión)`: el torneo abierto o el que terminó hace menos de 3
  horas, con la tabla, su mesa, su puesto y **si su última partida sumó** (lo dice el servidor, no lo adivina el celular).
  Cuenta para el límite de llamadas y no lanza error después de contar. Con PLAY apagado no devuelve nada.
- **Permisos:** las funciones internas y el disparador, sin acceso para `anon` ni `authenticated`.
- **Limpieza:** los torneos de más de 90 días se borran en el mismo repaso de pg_cron.
- **Apagar PLAY** no cierra el torneo: sin partidas no suma nada y se cierra a su hora. El panel lo avisa.

## Aislamiento y abusos
- Todo se filtra por el negocio del token o por `es_miembro` / `rol_en`.
- Entrar otra vez sin token crea otro jugador, pero de cada partida solo cuenta el mejor de la mesa.
- Un rival puede entrar a una partida de «todo el local» y salirse para dañarla: la regla lo aguanta (cuentan las 5
  mejores).
- La mesa es el número, no las personas: si un grupo se va y llega otro a la misma mesa, hereda el puntaje. Por eso el
  torneo dura como mucho 2 horas y el resultado muestra los apodos de quienes sumaron. En la fase 3 el premio debe ir a
  esos jugadores, no al número de la mesa.

## Celular del cliente
- La tarjeta del torneo se pide al abrir el inicio de Play, al terminar una partida y cada minuto mientras Play se ve.
- La pantalla del torneo se refresca cada 15 segundos, solo mientras se ve.

## Pruebas
- **Servidor (`pruebas/servidor/playtorneo.test.js`):**
  - roles (mesero no; dueño sí), un torneo a la vez, crear justo después de vencer el anterior, PLAY apagado no deja;
  - una partida que terminó antes del torneo no cuenta; una que termina después tampoco;
  - la regla: tope de 100 por partida, solo el mejor de la mesa por partida, las 5 mejores, la Ruleta no suma, la misma
    persona con tres tokens no suma más, dos mesas en una sala de «todo el local», una mesa de 2, el empate;
  - `brutos` trae el +200 del final y no lo recorta el tope del día;
  - si el disparador falla, la partida termina igual (sin torneo); un negocio sin torneo no cambia;
  - cierre a mano y por tiempo; el resultado queda congelado, con los apodos; torneo sin partidas;
  - se ve 3 horas desde la hora de fin (un cierre tardío no muestra el ganador de ayer); el negocio lo ve 12 horas;
  - la versión corta si nada cambió; el límite de llamadas devuelve `{error}`;
  - otro negocio no ve ni toca el torneo; `anon` no puede llamar las funciones internas ni las del negocio;
  - volver a correr la migración.
- **Navegador (`pruebas/playtorneo.test.js`):** el dueño empieza el torneo en el panel; dos mesas juegan; la tarjeta y la
  tabla en los celulares; el dueño lo termina y los clientes ven la mesa ganadora.
- **Que no se rompa nada:** `play` (fase 1), las pruebas del servidor y la lista completa.

## Lo que NO va en esta fase
- Premios, cupones y billetera (fase 3). Más estadísticas del panel (fase 4). La pantalla del televisor (fase 5).
- Llaves o eliminatorias. Equipos dentro de una mesa. Empezar el torneo a una hora programada.

## Pregunta para el dueño (no frena la fase)
- ¿Quién más puede empezar un torneo? Hoy: dueño o administrador. A las 11 de la noche muchas veces manda el cajero.

## Revisión goldfish del plan
Un revisor de diseño con contexto limpio dijo «no está listo»: 1 bloqueante (la regla de puntos: injusta con las mesas de
2, premiaba abrir varias pestañas y no tenía tope por partida) y 9 mayores (el disparador sin red, la carrera con el
cierre, crear después de vencer, el ganador de ayer, la medianoche, los permisos, calcular la tabla en cada lectura, el
mensaje «suma al torneo» sin que lo diga el servidor, y la mesa que no es el grupo). Todo quedó en este plan.

## Revisión goldfish del código
Un revisor con contexto limpio leyó todo el cambio: sin bloqueantes, 3 mayores y varios menores. Lo que se hizo:

| Hallazgo | Gravedad | Qué se hizo |
|---|---|---|
| El desempate usaba la última partida contada, aunque fuera de 0 puntos: una mesa que llegó primero perdía el empate por jugar después una partida mala. | Mayor | «Llegó» es la última partida que le dio puntos. Prueba. |
| En el panel, con un torneo recién terminado, la pantalla se repintaba cada minuto y la duración elegida para el siguiente volvía sola a «1 hora». | Mayor | Los minutos solo cuentan con el torneo abierto. Prueba en el navegador. |
| El aviso «esta partida sumó» podía ser de la partida anterior (si fallaba la conexión) o de otro torneo. | Mayor | El servidor manda la sala y la hora de la última partida; el celular solo habla si contestó ahora y es de esa sala. Prueba. |
| «Terminar ahora» cerraba el torneo que estuviera abierto, no el que el dueño estaba viendo. | Menor | Se manda el id del torneo. Prueba. |
| Si el disparador fallaba, nadie se enteraba. | Menor | Deja un aviso en el registro del servidor. |
| La hora de fin podía quedar antes del inicio con un reloj atrasado. | Menor | Nunca queda antes. |
| El panel mostraba 10 mesas de las 20 que manda el servidor; la regla estaba escrita dos veces; un parámetro sin uso; faltaba un índice para borrar los viejos. | Menor | Arreglado. |
| Al volver a la pestaña Play la tarjeta no se ponía al día; al recargar se anunciaba como nuevo un torneo de hace una hora; dos preguntas cruzadas; la sesión vencida dejaba la pantalla quieta; la tarjeta se rehacía cada 15 s; se preguntaba cada minuto aunque no hubiera torneo. | Menor | Arreglado (sin torneo se pregunta cada 2 minutos; en «entrar» o con PLAY apagado, no). |
| El panel podía pintar una respuesta vieja encima; sin conexión no avisaba. | Menor | Arreglado. |
| Nada revisaba que `pedido.html` cargara los archivos de PLAY con la versión. | Menor | `pruebas/modulos.test.js` lo revisa. |

**Pruebas que pidió y se agregaron:** el cierre contra una partida que se está guardando (dos conexiones), las funciones
internas con la sesión de un mesero, el rol de administrador, y `miUltima` con una partida de antes del torneo.

**No se cambió:** un paso guardado por cada fila de puntos (solo pesa si el negocio apaga PLAY con muchas salas abiertas);
la duración en el servidor acepta de 15 a 120 minutos y el panel ofrece cuatro.
