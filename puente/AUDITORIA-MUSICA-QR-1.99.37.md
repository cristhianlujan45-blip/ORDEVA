# Auditoría de la música por QR (YouTube y YouTube Premium) · 22/11/2026

**Pedido del dueño:** «que la gente pueda poner música por el QR de las mesas, rápido y sin problemas; que puedan poner
cualquier canción; que suene en mi cuenta de YouTube Music Premium, sin comerciales; busca la forma que quede mejor; que
no haya límites en la búsqueda; lo de las 10 canciones por mesa sí déjalo».

## Cómo se revisó
- El camino completo:
  1. El cliente busca en el QR (`pedido.html`).
  2. El Servidor ORDEVA busca en YouTube.
  3. El pedido llega al negocio (canal en vivo).
  4. ORDEVA lo pone en la cola.
  5. La canción suena en el celular, en la pantalla de ORDEVA o en el YouTube del TV.
- **La búsqueda real contra YouTube** se probó desde aquí con la misma función del servidor.
- **Errores reales de producción de música:** no hay ninguno en los últimos 30 días. Se agregó al «Diagnóstico de
  errores» un filtro por tipo, de solo lectura, para poder mirarlo.
- **Pruebas:** las 14 de música y las 20 de la página del QR, más una nueva.

## Lo que encontré y qué se hizo

### 1. Sin comerciales con tu Premium: la mejor forma es el YouTube del TV, y solo funcionaba desde la app de Android
- YouTube quita los comerciales cuando sabe que eres tú, con tu Premium iniciado **en el reproductor que suena**.
- El reproductor que va dentro de ORDEVA (o de cualquier app o página) no puede iniciar tu sesión. Google bloquea casi
  siempre entrar dentro de una app: «Este navegador o app no es seguro». ORDEVA no hace trucos para saltarse eso.
- Donde **sí** se nota tu Premium es en **la app de YouTube del TV**, con tu cuenta iniciada. ORDEVA se vincula con el
  código del TV («Vincular con código de TV») y le va mandando cada canción de las mesas: suenan allá, una tras otra,
  **sin comerciales y sin límite**.
- **El problema:** esa vinculación necesita un «puente». Solo la app de Android lo traía. Desde un computador, un iPhone
  o una tableta había que crear un puente propio en Cloudflare (5 pasos técnicos).
- **Arreglo:** el **Servidor ORDEVA ahora es el puente** (`vento-ia/lounge`).
  - En cualquier equipo basta con escribir el código del TV. El paso «Puente gratis» ya no aparece.
  - Si alguien ya tenía su puente propio, se sigue usando ese.
- **Seguridad del puente:**
  - solo deja pasar las 3 llamadas del TV, solo desde la página de ORDEVA y con mensajes de hasta 64 KB;
  - tiene un tope de 240 por minuto por conexión;
  - no guarda nada.
- **La guía «🚫 Música sin comerciales»** ahora pone primero el TV con tu Premium («⭐ La mejor forma»). Entrar en la
  app o en el navegador queda como otra forma.

### 2. «Cualquier canción»
- La búsqueda del QR y la del negocio leen la página pública de resultados de YouTube: **no gastan cupo de Google**.
- Probado con YouTube real (Diomedes, Karol G, Peso Pluma, Joe Arroyo, Silvestre, Carlos Vives, Jhonny Rivera, Bad
  Bunny, Grupo Niche): **10 resultados cada una, en 0,4 a 1,2 s**. Una canción ya buscada responde al instante (caché).
- **En el YouTube del TV suena cualquier video.** El revisor de videos que no se dejan poner en otras páginas solo
  trabaja cuando la música suena en el propio equipo o en la pantalla de ORDEVA. Ahí, si un video oficial no se deja
  poner, ORDEVA busca otra versión de la misma canción.
- Siguen igual, porque los decides tú:
  - el tope de duración;
  - el filtro de palabras;
  - «aprobar las canciones del QR».

### 3. «Sin límites en la búsqueda»
- El servidor tenía un tope de **150 búsquedas por minuto por conexión**. Todo el wifi de un bar lleno sale por una
  sola conexión, y cada búsqueda del cliente son 2 llamadas: con el bar lleno, el cliente podía ver «Muchas búsquedas,
  espera un momento».
- **Arreglo:**
  - el tope sube a **600 por minuto**, y lo que ya está en caché no cuenta;
  - si alguna vez se llega, **el QR reintenta solo** (a los 1,5 s y a los 3 s) sin decirle nada al cliente;
  - la app del negocio reintenta una vez.
  - El tope queda solo para que nadie use el servidor para leer YouTube sin fin.

### 4. Rapidez del pedido
- **El pedido llega al negocio** en menos de 2,5 s (revisa cada 2,5 s y, si el servidor puede, avisa al instante).
- **Buscar la canción en el servidor:** 0,4 a 1,2 s.
- **El cupo de 10 canciones por mesa** (cada una se libera a los 15 minutos) **no se tocó**.

## Lo que solo se puede comprobar con un TV de verdad
- Vincular un TV real con su código a través del puente del servidor. Probado con YouTube simulado. Desde aquí YouTube
  sí responde a la llamada de vincular (dice «código no válido» con un código inventado, como debe ser).
- Que el TV no ponga comerciales depende de que **la cuenta iniciada en la app de YouTube del TV sea la de Premium**.

## Cambios
- `supabase/functions/vento-ia/index.ts`: puente del TV (`/lounge/…`) y tope de búsquedas de 150 a 600.
- `app/12-fotos-productos-fondo.js`: el puente por defecto es el del servidor, y «Probar conexión» lo revisa.
- `app/09-cuentas-mesa-modulo.js`: un reintento en la búsqueda y la guía «sin comerciales» con el TV primero.
- `pedido.html`: reintentos silenciosos de la búsqueda.
- `.github/workflows/diagnostico-errores.yml`: filtro opcional por tipo (solo lectura).
- **Prueba nueva:** `pruebas/puentetv1937.test.js`, con `pruebas/servidor/ventoia-lounge.mts`: 13/13. Con la 1.99.35
  falla 8 de 9 revisiones.
