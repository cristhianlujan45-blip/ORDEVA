# ORDEVA 1.98.0 · 🏆 ORDEVA PLAY (fase 2): torneos entre mesas

**Pedido del dueño:** la fase 2 de ORDEVA PLAY («multijugador y torneos: salas, equipos, partidas en tiempo real,
puntuaciones y torneos entre mesas»). Después de publicar la fase 1: «Continúa».

**Lo que ya traía la fase 1 (1.97.0):** salas con código, partidas al día en varios celulares, puntos que calcula el
servidor, y jugar con la mesa o contra las otras mesas. **Lo nuevo:** los equipos (la mesa) y los torneos.

## Qué es un torneo
- Un rato de competencia entre las mesas del local: **30 minutos, 1 hora, 1 hora y media o 2 horas**.
- Lo **empieza y lo termina el dueño o el administrador**, en **Más → 🎮 ORDEVA Play → 🏆 Torneo entre mesas**. Un torneo a
  la vez.
- Mientras dura, **las partidas que terminen** suman a la mesa donde se jugaron. No hay llaves ni eliminatorias: las mesas
  pueden llegar y salir.
- Al final se anuncia la mesa ganadora, con los apodos de quienes sumaron. **Sin premios** en esta fase (son la fase 3).

## La regla de los puntos
**«Cada partida le da a tu mesa hasta 100 puntos (los de su mejor jugador). Cuentan las 5 mejores partidas de la mesa.»**
- Los puntos de la partida se pasan a una escala de 0 a 100 según el juego.
- **La Ruleta no suma** (es por diversión: sus puntos son aplausos que regalan los demás).
- Una mesa de 2 personas compite igual que una de 10.
- Abrir más celulares en la misma partida no suma más.
- **Empate:** gana la mesa que llegó primero a ese puntaje.

## Qué ve cada uno
- **El cliente, en la pestaña Play:**
  - una tarjeta «🏆 Torneo de mesas · faltan 42 min · tu mesa va 2.ª de 5»;
  - una pantalla con la tabla de mesas, la regla y el tiempo que falta;
  - al terminar una partida, si sumó al torneo o no (lo dice el servidor);
  - al final, «Ganó la Mesa 4 · Caro, Pipe», visible unas 3 horas.
- **El negocio, en el panel de ORDEVA Play:**
  - empezar el torneo, cuánto falta y la tabla de mesas, que se refresca sola;
  - «Terminar ahora», que pregunta antes;
  - el resultado del último torneo, para anunciarlo.

## Lo que se cuidó
- **No toca lo que ya funciona:** pedidos, pagos, ingreso, carta del QR y música siguen igual. `tv.html` no se tocó.
- **No cambia las funciones de la fase 1.** Cada partida que termina pasa por un paso nuevo que la marca con su torneo; si
  ese paso falla, la partida termina igual, sin torneo.
- **Cada negocio ve solo su torneo.**
- **El torneo no castiga a quien ya jugó mucho hoy:** usa los puntos de la partida, sin el tope del día.
- **La tabla no se calcula en cada consulta:** se guarda y solo se recalcula cuando termina una partida nueva.

## Qué cambió en el código
- **Servidor:** `supabase/migrations/20261204000000_play_torneos.sql` (tabla `play_torneos`, dos columnas nuevas en
  `play_puntos` y funciones nuevas). No borra ni cambia nada de lo que existía.
- **Cliente del QR:** `play/ordeva-play.js` y `play/play.css`.
- **Negocio:** `lib/vento-play.js`.
- **Versión:** `puente/subir-version.sh` ahora también sube la versión con la que `pedido.html` carga los archivos de PLAY.
  Sin eso, el celular del cliente se quedaba con el archivo viejo que tenía guardado.

## Revisión goldfish
- **Del plan** (`puente/egm/PLAN-PLAY-FASE2.md`): «no está listo». 1 bloqueante: mi primera regla de puntos era injusta con
  las mesas de 2 y premiaba abrir varios celulares. Se cambió por la regla de arriba. 9 mayores, todos en el plan.
- **Del código:** sin bloqueantes. 3 mayores (el desempate, la duración que se cambiaba sola en el panel y el aviso «sumó al torneo» que
  podía ser de otra partida) y varios menores, todos corregidos. El detalle está al final del plan.

## Pruebas
- **Servidor nueva:** `pruebas/servidor/playtorneo.test.js`, 72 bien, 0 mal.
- **Navegador nueva, con cuatro celulares en dos mesas:** `pruebas/playtorneo.test.js`, 23 bien, 0 mal.
- **Un defecto que encontró la prueba:** después de jugar, la tarjeta seguía diciendo «tu mesa todavía no suma» hasta por un
  minuto. Corregido: la tabla se pone al día apenas termina una partida.
- **Fase 1 y el resto del servidor:** `play` 38 bien, 0 mal; las otras 31 pruebas del servidor, bien; `modulos` 12 bien (ahora revisa la versión de los archivos de PLAY).
- **Lista completa:** RESULTADOS_AQUI
- **No se probó** con celulares de verdad ni con la base de datos de producción.

## Lo que queda
- **Pregunta para el dueño:** ¿quién más puede empezar un torneo? Hoy solo el dueño o el administrador.
- La mesa es el número, no las personas: si un grupo se va y llega otro a la misma mesa, hereda el puntaje. Por eso el
  torneo dura como mucho 2 horas y el resultado muestra los apodos. En la fase 3 el premio debe ir a esos jugadores.
- Un jugador muy bueno puede cargar a su mesa, y un programa puede llegar al tope de 100. Es condición para dar premios.
- Fase 3: premios y cupones. Fase 4: más estadísticas del panel. Fase 5: la pantalla del televisor. Fase 6: más juegos.
