# ORDEVA 1.97.0 · 🎮 ORDEVA PLAY (fase 1): juegos para los clientes desde el QR de la mesa

**Pedido del dueño:** ORDEVA PLAY, con LA BOMBA, EL IMPOSTOR, RULETA DEL CAOS, ÚLTIMO SOBREVIVIENTE y EL SHOW DE LA MESA.
Después de la auditoría (fase 0, `puente/egm/PLAY-FASE0.md`): «continúa como creas mejor; el tema de premios es opcional».

## Qué es
- El cliente escanea el **QR de su mesa** y, si el negocio lo activó, ve una pestaña nueva **«🎮 Play»** al lado de Pedir,
  Canción y Mi cuenta.
- Entra **sin registrarse y sin instalar nada**: solo un apodo y un avatar.
- Crea una sala o se une con un **código de 4 letras**. Juega con su mesa o, si el negocio lo permite, contra las otras
  mesas.
- **Viene apagado.** Cada negocio lo prende en **Más → 🎮 ORDEVA Play** (dueño o administrador) y escoge qué juegos y qué
  tipos de retos ofrece.

## Los 5 juegos
| Juego | Cómo es | Jugadores |
|---|---|---|
| 🎤 El Show de la Mesa | 8 preguntas con 4 opciones y 20 segundos. Más rápido, más puntos. | 2 o más |
| 💣 La Bomba | Quien tiene la bomba responde una cuenta para pasarla. Nadie sabe cuándo explota. Si falla, queda 3 segundos bloqueado. | 2 o más |
| 🕵️ El Impostor | Todos tienen la palabra menos uno. Cada uno da una pista y después votan. 3 rondas. | 3 o más |
| 🎡 Ruleta del Caos | La ruleta elige a alguien y un reto. Puede cumplirlo, cambiarlo una vez o pasar. Los puntos se los dan los aplausos de los demás. | 2 o más |
| 🏆 Último Sobreviviente | Cuentas cada vez más rápidas. Quien falla o no responde, sale. | 2 o más |

## Reglas que se cumplen
- **Retos sin alcohol:** ningún reto habla de beber ni de brindar, nada peligroso, nada privado. **Todos se pueden pasar.**
- **El servidor manda:** las respuestas correctas, el tiempo, los puntos y quién gana los decide el servidor. La respuesta
  correcta no viaja al celular antes de tiempo.
- **Cada negocio ve solo lo suyo:** un jugador de otro negocio no ve ni entra a las salas, ni ve la clasificación.
- **No toca lo que ya funciona:** pedidos, pagos, ingreso, la carta del QR y la música siguen igual. PLAY se carga solo al
  tocar la pestaña y **no usa los canales de los pedidos** (no les quita cupo).
- **`tv.html` no se tocó.**
- **Premios:** no van en esta fase. La clasificación del día es solo para mostrar.

## Lo que ve el negocio
- **Más → 🎮 ORDEVA Play:** prender o apagar, juegos, tipos de retos, «permitir jugar contra otras mesas» (viene apagado),
  y las partidas, los jugadores y la clasificación de hoy.
- Apagarlo, o quitar un juego, termina las partidas abiertas de ese juego.

## Contra abusos
- 25 jugadas cada 10 segundos por jugador (cuentan también las que no valen).
- 60 jugadores nuevos por minuto por IP y 400 por hora por negocio; 60 salas abiertas por negocio.
- 3.000 puntos por jugador por día en la clasificación.
- Apodos y pistas con groserías no pasan (filtro básico). El avatar sale de una lista fija.
- La limpieza corre sola cada 10 minutos: jugadores y salas de más de 2 días, puntos de más de 90 días.

## Qué cambió en el código
- **Servidor:** `supabase/migrations/20261203000000_play.sql`. Tablas nuevas (`play_…`), sin acceso directo: todo pasa por
  funciones que validan. No borra ni cambia nada de lo que existía.
- **Cliente del QR:** `play/ordeva-play.js` y `play/play.css` (se cargan solo al tocar «Play»); en `pedido.html`, la
  pestaña y su panel.
- **Negocio:** `lib/vento-play.js` (el panel) y la casilla en «Más»; la carta publicada lleva `pl:1` cuando está prendido.
- **Pruebas:** un arreglo en el ayudante de pruebas (`pruebas/servidor/supabase-local.js`): una petición en el aire al
  cerrar ya no tumba la prueba. Eso hizo fallar `pedidostienda` en GitHub con la 1.96, después de pasar sus 29
  comprobaciones.

## Revisión goldfish
`puente/egm/REVISION-GOLDFISH-PLAY.md`. La primera ronda (diseño y código) dijo «no está listo»: 3 bloqueantes y unas 30
correcciones, todas hechas. RONDA2_AQUI

## Pruebas
- **Servidor:** `pruebas/servidor/play.test.js`, SERVIDOR_AQUI.
- **Navegador, con varios celulares a la vez:** `pruebas/play.test.js`, NAVEGADOR_AQUI. Cubre activar, entrar, los 5
  juegos, el aviso sin conexión, la pestaña escondida, un pedido durante el juego y un celular de 320 px.
- **Las otras 30 pruebas del servidor:** bien.
- **Lista completa:** RESULTADOS_AQUI
- **No se probó** con celulares de verdad ni con la base de datos de producción.

## Lo que queda
- Premios y cupones (opcionales para cada negocio; los premios con alcohol, apagados).
- Los otros 7 juegos de la definición oficial.
- Pantalla del televisor para PLAY (sin tocar `tv.html`).
- Más preguntas, palabras y retos; contenido propio del negocio.
