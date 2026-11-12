# ORDEVA PLAY · Fase 2: torneos entre mesas (plan, 1.98.0)

**Pedido del dueño (definición de ORDEVA PLAY):** «FASE 2: MULTIJUGADOR Y TORNEOS. Implementar salas, equipos, partidas en
tiempo real, puntuaciones y torneos entre mesas.» Después de la fase 1 (1.97.0): «Continúa».

**Lo que ya existe (fase 1):** salas con código, partidas al día en varios celulares, puntos que calcula el servidor, modo
«mi mesa» y «todo el local», y la clasificación del día por jugadores y por mesas. **Falta:** los equipos y los torneos.

## Decisiones que tomé (el dueño dijo «continúa como creas mejor»)
1. **El equipo es la mesa.** No hay equipos dentro de una mesa: nadie tiene que armar equipos, y «mesas contra mesas» es lo
   que pide la definición.
2. **Un torneo es un rato de competencia** (30, 60, 90 o 120 minutos) que el negocio empieza desde su panel. Mientras dura,
   las partidas que terminen suman a la mesa de cada jugador. No hay llaves ni eliminatorias: las mesas llegan y se van.
3. **Cómo se cuentan los puntos de una mesa:** de cada jugador cuentan sus **3 mejores partidas** del torneo, y de cada mesa
   cuentan sus **3 mejores jugadores**. Así una mesa de 10 no le gana a una de 3 solo por ser más, y jugar muchas partidas
   cortas no sirve (cuenta la calidad).
4. **Lo empieza y lo termina el dueño o el administrador**, igual que el resto de la configuración de PLAY.
5. **Un torneo a la vez por negocio.**
6. **Sin premios en esta fase.** Al final se anuncia la mesa ganadora. Los premios y cupones son la fase 3.
7. **Las partidas cuentan en los dos modos** («mi mesa» y «todo el local»): el torneo no obliga a prender «contra otras
   mesas».

## Qué ve cada uno
- **El negocio (Más → 🎮 ORDEVA Play → 🏆 Torneo entre mesas):**
  - sin torneo: nombre (opcional), duración y «Empezar torneo»;
  - con torneo: cuánto falta, la tabla de mesas y «Terminar ahora» (pregunta antes);
  - el resultado del último torneo de hoy.
- **El cliente (pestaña Play):**
  - en el inicio, una tarjeta «🏆 Torneo de mesas · faltan 42 min · tu mesa va 2.ª»;
  - una pantalla con la tabla de mesas, la regla de los puntos en una línea y el tiempo;
  - al terminar una partida: «Esta partida suma al torneo»;
  - cuando acaba: «🏆 Ganó la Mesa 4», visible unas 3 horas.

## Servidor (migración nueva `20261204000000_play_torneos.sql`; no cambia las funciones de la fase 1)
- **Tabla `play_torneos`:** negocio, nombre, inicio, fin, cerrado (cuándo), resultado (la tabla final, congelada) y quién lo
  creó. Índice único: un solo torneo sin cerrar por negocio. RLS sin políticas, como las demás.
- **`play_puntos` gana dos columnas:** `torneo_id` y `brutos` (los puntos de la partida sin el tope del día: el torneo no
  debe castigar a quien ya jugó mucho antes).
- **Un disparador en `play_puntos`** (antes de insertar) pone `brutos` y, si hay un torneo abierto del negocio, `torneo_id`.
  Una partida cuenta si la sala se creó después de empezar el torneo y termina antes de que acabe. Así no hay que volver a
  definir `play_terminar`.
- **`play_torneo_tabla(torneo)`:** la tabla de mesas con la regla de la decisión 3.
- **Cierre:** un torneo se cierra a mano o cuando pasa su hora. El cierre guarda el resultado. Se cierra al leerlo
  (`play_torneos_al_dia`) y con pg_cron cada 5 minutos, por si nadie lo mira.
- **Para el negocio (con su sesión):**
  - `play_torneo_crear(negocio, nombre, minutos)`: dueño o administrador; PLAY prendido; 15 a 240 minutos;
  - `play_torneo_cerrar(negocio)`: dueño o administrador;
  - `play_torneo_ver(negocio)`: cualquier miembro; el torneo abierto o el último de hoy.
- **Para el cliente (con su token):** `play_torneo(token)`: el torneo abierto, o el último cerrado hace menos de 3 horas, con
  la tabla, su mesa y su puesto. Cuenta para el límite de llamadas y no lanza error después de contar.
- **Apagar PLAY** no cierra el torneo: sin partidas no suma nada y se cierra a su hora.

## Aislamiento y abusos
- Todo se filtra por el negocio del token o por `es_miembro` / `rol_en`.
- El nombre del torneo lo escribe el negocio: se limita a 40 caracteres y se muestra escapado.
- Entrar otra vez sin token crea otro jugador, pero de una mesa solo cuentan 3.
- La tabla del torneo se calcula al leerla. Con el índice por `torneo_id` y el límite de llamadas, es una consulta corta.

## Celular del cliente
- La tarjeta del torneo se pide al abrir el inicio de Play y al terminar una partida.
- La pantalla del torneo se refresca cada 15 segundos, solo mientras se ve.

## Pruebas
- **Servidor (`pruebas/servidor/playtorneo.test.js`):**
  - roles (mesero no; dueño sí), un torneo a la vez, PLAY apagado no deja;
  - una partida de antes del torneo no cuenta; una que termina después tampoco;
  - 3 mejores partidas por jugador y 3 mejores jugadores por mesa;
  - el tope del día no afecta al torneo;
  - cierre a mano y por tiempo; el resultado queda congelado;
  - otro negocio no ve ni toca el torneo; el cliente ve su mesa y su puesto.
- **Navegador (`pruebas/playtorneo.test.js`):** el dueño empieza el torneo en el panel; dos mesas juegan; la tarjeta y la
  tabla en los celulares; el dueño lo termina y los clientes ven la mesa ganadora.
- **Que no se rompa nada:** `play` (fase 1), las pruebas del servidor y la lista completa.

## Lo que NO va en esta fase
- Premios, cupones y billetera (fase 3). Más estadísticas del panel (fase 4). La pantalla del televisor (fase 5).
- Llaves o eliminatorias. Equipos dentro de una mesa.
