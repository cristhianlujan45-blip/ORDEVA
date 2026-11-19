# Auditoría de la música de ORDEVA (YouTube, QR, TV) · 19/11/2026

**Pedido del dueño:** «la música no suena bien; cuando alguien pone una canción del QR se quita la que está sonando… haz una
auditoría completa de cómo se reproduce la música en YouTube, del QR y todo eso».

**Cómo se hizo:**
- Se recorrió el camino completo:
  1. El cliente pide la canción en el QR (`pedido.html`).
  2. El pedido viaja por el canal en vivo.
  3. ORDEVA recibe el pedido y lo pone en la cola, en orden justo.
  4. ORDEVA busca el video en YouTube.
  5. ORDEVA comprueba que el video se deje poner.
  6. La canción suena en una de cinco formas: el celular, la pantalla del TV (`tv.html`), el YouTube del TV, Chromecast o
     la lista de YouTube Music.
  7. ORDEVA le contesta al cliente cómo va su canción.
- Además:
  - Se miraron los errores reales que mandan los equipos (servidor, solo lectura).
  - Una revisión independiente reprodujo los fallos con pruebas.
  - Las 17 pruebas de música pasan.

## Lo que más pasaba: «la canción del QR quita la que suena»
Son cinco causas distintas. Depende de cómo tengas puesta la música:

| # | Cuando pasa | Qué pasaba | Arreglado en |
|---|---|---|---|
| 1 | Música en el **celular** (app de Android) | Cada canción nueva del QR se probaba reproduciéndola escondida, mientras sonaba la otra: dos videos a la vez. Android cerraba la página por memoria (47 veces en un día en el Xiaomi). Al volver, la que sonaba se daba por saltada. | 1.99.17 (solo se carga sin reproducir, y la cortada se retoma desde donde iba) |
| 2 | **YouTube del TV** que sí dice qué hace | Un comercial de YouTube o el cambio de canción se tomaban como «TV quieto». La canción nueva mandaba «lista nueva», que reemplaza lo que suena. | 1.99.17 (con tope de tiempo) |
| 3 | **YouTube del TV** que NO dice qué hace (muchos TV sin Premium) | ORDEVA lleva la cuenta por la duración de los videos, sin contar los comerciales. A las 2 o 3 canciones creía que el TV ya estaba quieto, y la del QR mandaba «lista nueva» y cortaba. | **1.99.18** (10 min de margen: solo se agrega) |
| 4 | Varios equipos con **«Equipo que pone la música»** | Si el equipo de la música tardaba 90 s en dar señales (Android cerró su página, un corte de internet), el siguiente pedido del QR hacía que OTRO equipo tomara la música. El primero cortaba la canción. | **1.99.18** (los pedidos ya no toman la música; solo se avisa a los 5 min, y se toma a los 10 min sin señales) |
| 5 | Lo mismo, al volver a abrir la página | Al volver, se repetían los botones tocados en los últimos 2 minutos (⏭, pausa, «que siga»). Saltaba la canción que se acababa de retomar. | **1.99.18** (lo hecho se recuerda) |

## Otros hallazgos, de mayor a menor

### Arreglado en 1.99.18
- **Al cliente le decía «✅ Ya sonó» aunque se la hubieran saltado a los 10 s.** Ahora le dice «⏭ La saltaron (sonó un
  ratico)» si sonó menos de la mitad.
- **Con la música de fondo en el YouTube del TV, la canción del QR quedaba de 20.ª (más de una hora).** ORDEVA le mandaba
  al TV toda la lista de una vez y la seguía rellenando sin fin. Ahora la música de fondo entra al TV de a 2 canciones. Las
  de las mesas se siguen mandando enseguida.
- **Canciones buenas quedaban vetadas para siempre** por un error pasajero (memoria, red). Ahora solo se vetan las que
  YouTube dice que no se dejan poner (códigos 100, 101 y 150). El probador tampoco culpa a una canción por un error tardío
  de otra.
- **Una búsqueda colgada (internet malo) dejaba todas las demás «En la cola» para siempre.** Ahora cada búsqueda tiene
  tiempo máximo (15 s) y la fila sigue a los 45 s.
- **Gasto de memoria en el celular:**
  - El cuadro «Sonando» se rehacía cada segundo aunque no se viera. Ahora solo con Música a la vista.
  - Cada 5 s se reescribía el respaldo completo de la cola y el historial. Ahora solo al cambiar de canción.
  - En la app de Android y en modo TV, el probador solo carga, no reproduce.
- **El equipo de la música dejaba de dar señales con la app minimizada.** Ahora también las da con la app minimizada.

### Queda pendiente (no se tocó en esta versión)
- **Lista de YouTube Music** (Google conectado, sin TV ni reproductor de ORDEVA):
  - Las canciones nuevas se insertan cerca del principio de la lista y la lista nunca se limpia. Con el tiempo quedan
    detrás de lo que suena y no suenan.
  - El cliente nunca recibe «sonando».
  - **Recomendación:** usar el reproductor de ORDEVA o el TV en vez de esa forma.
- **La misma canción pedida por dos mesas suena dos veces seguidas.** Solo se evita si la repite la misma mesa en 3 minutos.
- **No hay tope de duración:** alguien puede pedir un mix de 1 hora y tapar la cola.
- **Sin filtro de contenido:** en la mayoría de las búsquedas, quien tiene el QR puede poner cualquier video con su
  título exacto. Se podría agregar «aprobar las canciones del QR» y palabras prohibidas.
- **Si activaste que el parlante lea las canciones,** lee el texto que escribió el cliente tal cual. Debería leer solo la
  mesa y el título.
- **El historial de música** guarda hasta 2000 canciones en el almacenamiento del celular y se relee muy seguido. Bajarlo
  a unas 300 ayudaría a la memoria.
- **El estado de las canciones de todas las mesas** se puede leer desde el QR (sin datos personales).

### Lo que está bien
- Un mismo pedido no se repite aunque el celular del cliente lo reenvíe.
- El cupo por mesa funciona, con el código secreto de cada QR.
- El video que toca el cliente solo se acepta si sale en la búsqueda de esa canción.
- Los estados del cliente solo avanzan.
- Si una forma de buscar falla, se busca de otra.
- `tv.html` (la pantalla del TV) es sólida.
- Los títulos se muestran sin riesgo.

## Lo que solo se puede comprobar en un celular o TV de verdad
- **Qué forma de música usas.** Lo dicen estos ajustes del equipo de la música:
  - «Equipo que pone la música»;
  - «YouTube del TV» (y si el TV informa lo que hace);
  - «Pantalla del TV»;
  - «Música automática»;
  - «Música de fondo».
- **Cuánto baja de verdad** el «Android cerró la página por falta de memoria» después de estos cambios. Se verá en el
  diagnóstico de errores en uno o dos días.
- **Si YouTube avisa «no se deja poner»** cuando solo se carga el video sin reproducirlo. Si no avisa, el reproductor busca
  otra versión al llegar a esa canción.
