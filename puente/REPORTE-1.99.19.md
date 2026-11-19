# ORDEVA 1.99.19 · Los pendientes de la auditoría de la música

**Pedido del dueño (19/11):** «corrige todos los puntos pendientes» (de `puente/AUDITORIA-MUSICA-1.99.18.md`).

## Qué cambia
1. **La misma canción pedida por dos mesas suena UNA vez.**
   - El pedido repetido se une al que ya está esperando, y no gasta cupo. Vale aunque esté escrito distinto, si da el
     mismo video.
   - A esa mesa se le dice «Ya la pidió otra mesa: suena una sola vez». Después recibe igual «sonando» y «ya sonó».
   - No se une a una canción que YA está sonando: esa se pone otra vez, para que esa mesa sí la escuche.
   - Tampoco se une a las que van a la lista de YouTube Music.
   - Si el celular del cliente reenvía el mismo pedido, no se duplica.
2. **Tope de duración** (Ajustes → Música → «⏱️ Lo más que puede durar una canción pedida», 12 min por defecto).
   - Si la versión encontrada dura más, se busca otra.
   - Si no hay, al cliente le dice «Es muy larga: pide otra canción», también a las mesas unidas.
   - Lo que pone el personal no tiene tope.
3. **Filtro del QR** (Ajustes → Música):
   - **🚫 Palabras que no se dejan pedir** (separadas por coma): el pedido no entra y al cliente le dice «Esa canción no
     se puede pedir aquí».
   - **🛡️ Revisar las canciones del QR antes de que suenen**: lo que piden las mesas queda «🛡️ Por aprobar» en Música.
     - Suena solo con ✅; con 🚫 se quita. Se puede aprobar desde cualquier equipo.
     - Las que nadie aprueba en 2 horas se quitan.
     - Al apagar la opción, las que esperaban entran a la cola.
   - Lo que pone el personal (también desde otro equipo) no pasa por el filtro.
4. **Lista de YouTube Music en el mismo celular:**
   - ORDEVA no puede saber en qué canción va esa lista. Por eso recomienda, una sola vez, su propio reproductor
     (Música → «Activar música automática»).
   - No lo cambia solo, porque hay quien usa YouTube Music a propósito con un parlante. Al principio se probó cambiarlo
     solo, y la revisión mostró que podían sonar dos a la vez.
   - Transmitiendo YouTube Music al TV, la lista se limpia sola: lo agregado hace más de 6 h se quita, de a 5 por hora.
5. **Parlante de avisos:** de las canciones dice la mesa y el nombre de la canción solo si es corto y no tiene ninguna de
   las palabras bloqueadas.
6. **Historial de música:** máximo 400 canciones (antes 2000, más de 800 KB que el celular releía a cada rato).

## Revisión independiente (goldfish)
- **Bloqueante:** se unían pedidos a canciones mandadas a la lista de YouTube Music, que nunca terminan, y esa mesa no la
  escuchaba nunca.
  → Ahora solo se une a las que esperan o ya están en la cola del TV.
- **Mayores corregidos:**
  - «Es muy larga» no les llegaba a las mesas unidas.
  - Se unía a la que ya sonaba.
  - Un reenvío del cliente terminaba en «La quitaron».
  - Forzar el reproductor de ORDEVA podía hacer sonar dos cosas a la vez. → Ahora solo se recomienda.
  - Las canciones del personal mandadas desde otro equipo se filtraban como si fueran del QR.
  - «Revisar» solo funcionaba en el equipo de la música, y las pendientes no vencían.
- **Menores corregidos:**
  - El tope de duración ya no toma un corte de internet como «muy larga».
  - Las versiones largas se recuerdan para no volver a probarlas.
  - Las canciones por aprobar no frenan la música de fondo.
  - El limpiador de la lista solo marca lo que de verdad se borró.

## Pruebas
- **Nueva `pruebas/musicapendientes.test.js` (17/17).** Cubre:
  - dos mesas con la misma canción, con reenvío, y los avisos de «sonando» y «ya sonó» a ambas;
  - que no se une a la que suena;
  - el tope de duración;
  - las palabras bloqueadas;
  - aprobar y quitar;
  - el consejo de YouTube Music;
  - el parlante.
- **Ajustadas:** `parlante` (11/11) y `sincupo` (11/11, sin cambios: YouTube Music sigue funcionando como antes).
- **Las 19 pruebas de música pasan.**
