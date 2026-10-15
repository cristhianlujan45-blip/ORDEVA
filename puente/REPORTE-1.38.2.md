# Vento 1.38.2 — La música del panel de YouTube sí suena (navegadores que bloquean la reproducción automática)

## Por qué no sonaba
1. **El navegador bloqueaba el sonido.**
   - Al tocar «⏭ Que siga», Vento primero revisaba el video en un reproductor escondido y lo ponía unos segundos
     después, ya fuera del toque.
   - Brave, Chrome y otros navegadores bloquean el sonido que arranca sin un toque de la persona, así que el video
     quedaba cargado pero en silencio.
2. **«Este equipo pone la música» en otro equipo.**
   - Si se había tocado en otro equipo (por ejemplo la app Android), las canciones se mandaban allá y aquí no sonaba
     nada.
   - Si ese equipo estaba cerrado, no sonaba en ninguno.

## Qué cambió
- **«⏭ Que siga» con nada sonando** arranca la canción dentro del mismo toque, así que el navegador sí deja sonar. Si
  esa versión no se deja poner, se cambia sola.
- **«▶ Toca aquí para que suene»:** si el navegador no dejó arrancar solo el video (por ejemplo la primera vez), aparece
  este botón grande en el panel. Un toque lo arranca.
- **Otro equipo pone la música:**
  - el panel dice dónde suena («🔊 La música suena en «App Android de…»») y ofrece **«🎶 Que suene aquí»**;
  - si ese equipo no responde (cerrado o sin internet), este equipo toma la música solo al poner una canción.
- **Soporte:**
  - los avisos de música que llegan a Vento Admin → 🐞 Errores dicen el navegador y el estado del reproductor;
  - `window.vitoMusicaDiag()` da el diagnóstico completo.

## Pruebas
- **Nueva: `musicaautoplay`**, 10 comprobaciones, con un reproductor simulado que, como el navegador más estricto, solo
  suena si se le pide dentro de un toque.
  - Con el código anterior reproduce el silencio: el video queda quieto.
  - Con el arreglo suena dentro del toque; la primera vez sale «Toca aquí» y al tocar suena; y toma la música cuando el
    otro equipo no responde.
- **Actualizada: `musicaanuncios`**, 22 comprobaciones. El simulador ahora solo avisa del video actual, como el de
  verdad.
- **Música:** las 12 pruebas pasan.
