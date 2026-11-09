# ORDEVA PLAY · Fase 0: auditoría y plan técnico

*08/11/2026. Solo lectura: no se modificó ningún archivo. Espera tu aprobación antes de escribir código.*

## 0. Estado de Git (regla 1)
- **Producción:** rama `claude/precio-margen-productos-tabla-mioclt`, en `4888937` (1.95.4).
- **Trabajo:** la copia de trabajo está limpia, sin cambios sin guardar. Tiene 2 commits más que producción, ya guardados en
  la rama de trabajo `ccr-41bb424c-ri1zdh`:
  - la 1.95.5 en pruebas;
  - el plan de la 1.96.
- **No se hizo** reset, checkout destructivo ni force push.
- **Propuesta:** ORDEVA PLAY en su propia rama (`play/fase1`), creada desde la rama de trabajo cuando la apruebes. **Sin
  commits ni push a esa rama sin tu autorización**, como pediste.

## 1. Cómo está hecho hoy el QR de la mesa
- **`pedido.html` (2.132 líneas):** una sola página estática, sin framework y con el código adentro. Tiene tres pestañas:
  - 🍽️ Pedir (`#vp`);
  - 🎵 Canción (`#vc`);
  - 🧾 Mi cuenta (`#vq`).

  Habla 6 idiomas y guarda lo suyo en el celular (`localStorage`) por canal.
- **Lo que trae el QR de cada mesa:**
  - `mesa`;
  - `c`: el canal del negocio;
  - `v`: el código secreto de la mesa;
  - opcionales: `nq` y `nqn` (Nequi), `wa` (WhatsApp).
- **Comunicación:** `lib/vento-canal.js` convierte `fetch`/`EventSource` hacia `canal.vento.local` en llamadas a
  Supabase:
  - `canal_publicar` y `canal_leer`, que escriben y leen mensajes guardados 8 días;
  - Realtime `broadcast` (`vc-<canal>`) para el aviso al instante;
  - cada 2,5 s revisa de respaldo.
- **Los canales de hoy:**
  - `c`: pedidos y canciones. Solo el negocio lo lee (1.54);
  - `c+e`: estados;
  - `c+k`: carta;
  - `c+f`: fotos y QR de pago;
  - `c+a`: ambiente;
  - `<código de mesa>`: la cuenta en vivo.

  Los derivados de `c` todavía se pueden escribir sin sesión; los cierra la 1.96.
- **El negocio:** `index.html` + `app/09-cuentas-mesa-modulo.js` (`procesar`, `pedidoEntrante`, `agregarCancion`…).
  Valida el código de la mesa (`qMesaCodigos`) y responde por `c+e`.
- **El servidor:**
  - Supabase PostgreSQL, 60 migraciones, RLS en todas las tablas;
  - `es_miembro(negocio)` y `rol_en(negocio)` (dueño, admin, cajero, mesero, empleado);
  - funciones `security definer` con validación;
  - límites por IP (`canal_origen`) y en todo el sistema;
  - operaciones de una sola vez con referencia (`bono_redimir`/`bono_devolver`);
  - repasos con `pg_cron`.
- **El TV musical:** `tv.html`, que se vincula con un código (`mesoratv<código>`) y es independiente. ORDEVA PLAY TV no lo
  toca.
- **Las pruebas:** Playwright contra un Supabase local con PostgreSQL de verdad (`pruebas/servidor/supabase-local.js`), 130
  pruebas de la app y 29 del servidor, más GitHub Actions al publicar y cada noche.

## 2. Qué se reutiliza
| Para | Se reutiliza |
|---|---|
| Entrar desde la mesa sin registrarse | El QR con `mesa` + `v`. El servidor ya tiene los códigos de cada mesa en los datos del negocio (`qrCodigos`), así que puede comprobar que el jugador está en esa mesa. |
| Tiempo real | La misma tubería de `vento-canal.js` (Realtime + respaldo cada 2,5 s + reconexión), con canales propios de PLAY que solo escribe el servidor. |
| Seguridad del servidor | `es_miembro`/`rol_en`, el patrón `security definer` + RLS, los límites por IP, `servidor_config` y `pg_cron`. |
| Premios y cupones | El patrón de los bonos: código único, una sola vez por referencia, registro de movimientos y quién los validó. Es otra tabla, porque un premio no siempre es plata. |
| Panel del negocio | Un módulo `lib/vento-*.js` como los demás (Más → 🎮 ORDEVA Play), con la apariencia ORDEVA 2.0. |
| Voz del presentador (opcional) | La voz del navegador que ya usa la app. |
| Pruebas | `supabase-local`, `correr.sh` y la lista del CI. |

## 3. Archivos nuevos propuestos
- `play/ordeva-play.js`: el motor del cliente (salas, jugadores, estados, temporizador, reconexión). **Se carga solo al
  tocar la pestaña 🎮**, así que el menú no se vuelve más lento.
- `play/juegos/bomba.js`, `impostor.js`, `ruleta.js`, `sobreviviente.js`, `show.js`: los 5 de lanzamiento. Cada uno trae
  su pantalla de presentación, instrucciones cortas, juego, resultados y «volver».
- `play/play.css`: el estilo ORDEVA, oscuro y claro.
- `play/contenido/*.json`: preguntas, palabras y retos, sin alcohol ni nada peligroso, por categoría y nivel.
- `playtv.html`: ORDEVA PLAY TV, separado de `tv.html`.
- `lib/vento-play.js`: el panel del negocio (activar, juegos, horarios, torneos, premios, validar cupones, estadísticas).
- `supabase/migrations/2026120x_play.sql`: tablas y funciones.
- **Pruebas:** `pruebas/servidor/play.test.js`, más `pruebas/play*.test.js` con varios celulares a la vez.

## 4. Archivos existentes que cambiarían (poco y sin tocar lo que ya funciona)
- `pedido.html`:
  - una cuarta pestaña «🎮 Play», visible solo si el negocio lo activa;
  - cargar `play/ordeva-play.js` al tocarla.

  No cambia Pedir, Canción ni Mi cuenta.
- `index.html` y `lib/vento-play.js`: el panel del negocio y la validación de cupones en la caja.
- **La carta que publica el negocio** (`vitoPublicarCatalogo`): una marca `pl:1` para que el QR sepa que PLAY está
  activo, como ya hace la música con `mz`.
- `.github/workflows/pruebas-app.yml`: las pruebas nuevas.
- **No se tocan:** `tv.html`, la música, los pagos, la autenticación ni los canales de pedidos.

## 5. Cómo no afectar pedidos, pagos, autenticación ni el TV musical
1. **Código aparte y carga diferida:** si PLAY falla, el menú y los pedidos siguen igual. Va envuelto en `try` y no toca
   variables de `pedido.html`.
2. **Canales propios (`ply_…`) que solo escribe el servidor.** El cliente juega llamando funciones del servidor, no
   escribiendo en canales. No comparten los topes de los pedidos.
3. **Sin cuentas nuevas:** el jugador recibe un token temporal del servidor. No se crea otro sistema de autenticación.
4. **TV aparte:** `playtv.html` con su propio código de vínculo.
5. **Interruptor general por negocio,** apagado por defecto.
6. **Lista completa de pruebas** antes de publicar cada fase.

## 6. Base de datos propuesta (nombres en español, como el repositorio)
| Tabla | Para qué |
|---|---|
| `play_config` | Por negocio: activo, juegos, horarios, reglas, categorías de retos, TV sí o no. |
| `play_jugadores` | Identidad temporal: id, negocio, mesa, alias, avatar, token (guardado cifrado), creado y visto. Vence en 12 h. |
| `play_salas` | Sala: negocio, juego, modo (mesa o establecimiento), código corto, estado, ronda, fecha límite, versión (para la concurrencia). |
| `play_eventos` | Lo que hace cada jugador (respuesta, voto, paso), con un id del cliente **único** (sin duplicados ni reintentos dobles). |
| `play_resultados` | Lo que el servidor calcula por ronda y por partida (puntos, eliminados, ganador). |
| `play_puntos` | Libro de puntos (sumas y restas con su motivo). La clasificación sale de aquí. |
| `play_torneos` | Torneos del negocio: fecha, juegos, reglas de puntos, premios. |
| `play_premios` | Premios que define el negocio (descuento, producto, beneficio), con condiciones y vigencia. |
| `play_cupones` | Cupones emitidos por el servidor: código único, estado, quién lo ganó, cuándo, quién lo validó. Se redime una sola vez. |
| `play_auditoria` | Registro de lo importante (premios, cupones, cambios de configuración). |

**Funciones:**
- **Para el jugador, con su token:**
  - `play_entrar(c, mesa, v, alias, avatar)`: comprueba el código de la mesa contra `qrCodigos`;
  - `play_sala_crear`, `play_unirse`, `play_jugar(evento)`, `play_estado(sala)`, `play_mis_cupones`.
- **Para el negocio, con su sesión:**
  - `play_config_guardar`, `play_torneo_*`, `play_premio_*`;
  - `play_cupon_validar` (rol dueño, admin o cajero), `play_estadisticas`.

## 7. Cómo se protegen los datos de cada negocio
- **RLS en todas las tablas, sin acceso directo para `anon`:** todo pasa por funciones que comprueban el negocio, el token
  y el rol.
- **El jugador solo ve su sala y su negocio.** El token se guarda cifrado (`sha256`) y vence.
- **Puntos, ganadores, premios y cupones los decide el servidor:**
  - las respuestas correctas viven solo en el servidor;
  - el tiempo lo mide el servidor (fecha límite por ronda);
  - un evento por jugador y por ronda (índice único);
  - tope de puntos por jugador al día;
  - premios con una referencia de una sola vez.
- **Límites:** por token, por IP (`canal_origen`) y por sala.
- **Sin datos personales:** solo alias y avatar (Ley 1581/2012). Nada de teléfono ni nombre real.

## 8. Tiempo real
- **El servidor manda:** al recibir un evento válido, la función calcula el nuevo estado y lo publica en el canal de la sala
  (`ply_<id aleatorio>`), con la misma tubería que ya existe (Realtime + respaldo cada 2,5 s). Cada mensaje lleva su
  `versión`; el celular ignora los repetidos o viejos y, si se perdió alguno, pide `play_estado`.
- **Temporizadores:** se guarda la fecha límite. Cualquier llamada después de esa fecha cierra la ronda (sin hacer daño si
  se repite), y `pg_cron` cierra las salas abandonadas.
- **Reconexión:** al volver, el celular pide `play_estado` con su token y sigue en la misma ronda. Las desconexiones no
  dañan la partida (el jugador queda «ausente» y la ronda sigue).
- **Escala:** los mensajes de PLAY tienen su propio tope, así que no compiten con los pedidos (hoy 240 por canal por minuto y
  6.000 en todo el sistema). En el piloto se mide cuánto pesa.

## 9. Riesgos técnicos
1. **La 1.96 (canales del negocio) va primero.** PLAY abre canales nuevos, y conviene cerrar antes el hueco del QR de pago
   y fijar la regla de los canales que solo escribe el servidor.
2. **Celulares de gama baja:** carga diferida, sin librerías pesadas, animaciones con CSS y `prefers-reduced-motion`.
3. **Costo de Supabase:** muchos mensajes por partida. Se agrupan las actualizaciones (una por ronda o por evento, no por
   segundo) y se miden en el piloto.
4. **Trampas:** nada importante se decide en el celular; todo se valida en el servidor (punto 7).
5. **Contenido inapropiado:** retos sin alcohol, sin peligro, sin datos privados y sin acoso, siempre con «pasar». El negocio
   escoge las categorías. Los retos que escribe el negocio, solo él los ve y los aprueba.
6. **«Adivina la canción»:** tomar fragmentos de YouTube para un concurso puede ir contra sus condiciones y los derechos de
   autor. Propuesta: solo pistas de texto o emoji, o música con licencia que el negocio suba.
7. **Premios con alcohol:** apagados por defecto. Nunca como premio por consumir (normativa colombiana).
8. **`pedido.html` ya es grande:** PLAY va en archivos aparte para no hacerla más pesada.

## 10. Plan de pruebas
- **Servidor** (`play.test.js`, PostgreSQL de verdad):
  - entrar con el código de mesa bueno y con uno malo;
  - aislamiento entre negocios;
  - el puntaje no se puede inventar (enviar puntos o respuestas fuera de tiempo);
  - eventos repetidos;
  - el cupón se redime una sola vez;
  - solo dueño, admin o cajero validan;
  - los límites;
  - el cierre de rondas vencidas.
- **App** (Playwright, varios celulares a la vez):
  - cada juego de punta a punta (presentación → partida → resultados);
  - tres jugadores en la misma mesa y dos mesas compitiendo;
  - desconexión y vuelta;
  - funciona sin TV, y con PLAY TV sin tocar `tv.html`;
  - celular de 320 px.
- **Que no se rompa nada:** la lista completa (pedidos, pagos, cuentas, autenticación, música, TV) en cada fase.
- **Nada se declara probado sin correrlo.**

## 11. Fases y decisiones que necesito de ti
**Orden propuesto:**
1. 1.96 (seguridad de los canales).
2. PLAY Fase 1: el motor + LA BOMBA, EL IMPOSTOR, RULETA DEL CAOS, ÚLTIMO SOBREVIVIENTE y EL SHOW DE LA MESA, en modo mesa y
   establecimiento.
3. Fase 2: torneos.
4. Fase 3: premios y cupones.
5. Fase 4: el panel.
6. Fase 5: PLAY TV.
7. Fase 6: los otros 7 juegos.

**Decisiones:**
1. **Identidad del jugador:** ¿token del servidor (recomendado) o el inicio anónimo de Supabase, que hay que prender en el
   proyecto?
2. **¿PLAY como cuarta pestaña dentro del QR (recomendado)** o una página aparte enlazada desde el menú?
3. **Cupones:** ¿tabla propia (recomendado) o reutilizar los bonos de regalo?
4. **¿Hacer la 1.96 antes que PLAY** (recomendado)?
5. **«Adivina la canción»:** ¿solo pistas de texto o emoji, o música propia del negocio?
6. **Premios con alcohol:** ¿apagados del todo (recomendado) o con condiciones?
