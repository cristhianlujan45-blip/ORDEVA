# ORDEVA 1.72.0 · URGENTE: un equipo con los datos reiniciados ya no borra la nube · música del QR · panel de música simple

## 0. URGENTE: un equipo con los datos reiniciados borraba las cuentas y las ventas de la nube
**Reporte del dueño:** «abro mi cuenta en otro dispositivo (Samsung) y no me carga los datos ya guardados ni las
cuentas».

### Qué pasaba (desde la 1.70.1)
- Un equipo que ya había tenido la cuenta guarda su «copia de referencia» del negocio.
- Si después sus datos se reiniciaban (se limpió el almacenamiento, se reinstaló, o el celular los borró por falta de
  espacio) y se volvía a entrar, la mezcla de 3 vías entendía «este equipo borró todo».
- **Subía ese vacío:** se borraban las cuentas abiertas y las ventas de la nube y de los demás equipos.
- Se reprodujo contra el servidor de pruebas: la nube quedó sin cuentas y sin ventas.

### Qué se cambió (`nube/vento-nube.js`)
- **Al entrar:** si los datos del equipo parecen reiniciados frente a su copia, **manda la nube**. Cuenta como reiniciado
  si faltan muchas ventas o productos, o si había cuentas abiertas y no queda ninguna sin una venta nueva. Del equipo
  solo se agregan los registros que la nube no tiene.
- **Red de seguridad al subir:** si lo que se va a subir perdió más de la mitad de las ventas de la copia (mínimo 3),
  **no se sube**.
  - Se vuelven a bajar los datos de la nube, con un punto de restauración local.
  - Queda anotado para el administrador («nube-vaciado»).
  - En el uso normal las ventas se borran de a una, así que esto no bloquea nada legítimo.

### Prueba
`loginotro` tiene los casos nuevos 8 y 9:
- 8: entrar con los datos reiniciados;
- 9: los datos borrados con la sesión abierta.

Con la versión anterior fallaron los dos (la nube quedó vacía). Con esta, 26 de 26.

### Si a alguien ya le pasó
La nube guarda un respaldo cada hora (los últimos 48); el soporte de ORDEVA puede restaurar el de antes.

**Reportes del dueño:**
- «La gente está poniendo la música por el QR, pero no se están cargando en la lista, no salen. Que se pongan a
  continuación, no de una».
- «Detecta todo y el dispositivo que está reproduciendo, pero no me deja agregar una canción. Arregla el panel de YouTube
  para que sea más cómodo y elegante, quita lo repetido, que sea muy fácil de conectar y sin límite».

## 1. Las canciones del QR se perdían (arreglado)
### Qué pasaba
- Con varios equipos en la misma cuenta, se elige uno como «el equipo de la música».
- Cada equipo decide por su cuenta si recibe los pedidos del QR, y muchas veces el que pone la música (el computador o
  el TV Box del parlante) **no los recibía**: los recibía el celular.
- El celular guardaba la canción en su cola, pero **no se la mandaba** («la pone el equipo de la música»).
- A los 20 segundos la borraba al recibir la cola del otro equipo.
- La canción nunca sonaba ni aparecía en la lista.

### Qué se cambió (`app/09-cuentas-mesa-modulo.js`)
- **Mandar la canción:** el equipo que recibe una canción del QR y no es el de la música **se la manda** a ese equipo.
  - Allá entra a la cola normal, **a continuación** de lo que suena, con el turno justo entre mesas.
  - No se repite: se reconoce por el número del pedido.
  - Mientras llega, el celular la sigue mostrando, hasta 2 minutos.
- **Equipo que no responde:** si el equipo de la música lleva más de 90 s sin responder (cerrado o sin internet), el
  que recibe la canción **toma la música** para que no quede en silencio. Ya se hacía igual con el panel.

### Prueba
`musicaequipo` tiene un caso nuevo (5b): la canción llega **solo** al celular.
- Con la versión anterior: 2 fallas (no entraba a la cola del computador ni sonaba).
- Con esta: suena en el computador una sola vez, a continuación, y el celular no suena.

## 2. «➕ Poner aquí las canciones de las mesas» en lo que ya suena en un TV (app de Android)
- La tarjeta «Reproduciendo ahora en YouTube on TV» ahora tiene un botón de un toque.
- **Si encuentra un TV en el wifi:** se une al que tiene YouTube abierto (o al único que haya), sin cortar lo que suena.
  Las canciones entran en su cola, a continuación.
- **Si no encuentra TV:** primero lo busca, y si no aparece pide el código del TV.
- Antes había que leer las instrucciones y escribir el código de 12 números.

## 3. La pantalla de Música, simple (`lib/vento-musica-facil.js`, nuevo)
### Arriba, una sola tarjeta
- Lo que suena (con la carátula), lo que sigue y cuántas canciones hay en cola.
- **«➕ Poner una canción»** (abre el panel de YouTube) y **«⏭ Siguiente»**.
- **«¿Dónde suena la música?»**, con tres caminos grandes, todos **sin límite de canciones**:

  | Camino | Qué hace |
  |---|---|
  | 📺 En el TV | Busca el TV del wifi y se toca |
  | 🔢 Con el código del TV | YouTube del TV → Configuración → Vincular con código |
  | 🔊 En este equipo | Computador o celular conectado al parlante |

- El camino que está en uso queda marcado ✓.
- Si hay canciones esperando y nada dónde sonar, lo avisa.

### Debajo
- La cola, sin los botones repetidos: «Abrir el panel» (estaba dos veces), «Siguiente canción», «Saltar» y «Activar
  música» ahora están en la tarjeta.
- Mis playlists.

### «⚙️ Más opciones» (plegado)
- El reproductor, todo lo del TV (transmitir, código, puente, diagnóstico).
- YouTube Music con cuenta de Google: este es el único camino que tiene límite diario de Google.
- No se quitó ninguna función.

### Resultado
- La pantalla mide ≈ 1396 px en el celular; antes ≈ 2381.
- Ninguno de los tres caminos gasta el cupo de Google, así que **no hay límite de canciones**.

## Pruebas
- **`pruebas/musicafacil.test.js`** (nueva, en CI; 13 revisiones):
  - la tarjeta, sus 3 caminos y el aviso de canciones esperando;
  - «En este equipo» prende el reproductor;
  - «Poner una canción» abre el panel, sin botones repetidos;
  - «Más opciones» plegado y «Con el código del TV» lleva al campo;
  - el botón de un toque en el TV que ya suena;
  - la pantalla mide menos.
- **`tvocupado`:** ahora entra por «📺 En el TV» de la tarjeta.
- **Todas las pruebas de música:** cancionesmesa, musicaanuncios, musicaautoplay, musicaequipo, musicafondo,
  panelyoutube, pedidomusica, playlists, tvocupado, ventanayoutube, youtubesincupo y desplazamiento.
- **La lista completa de CI:** ver el mensaje de la publicación.

## Lo que no se probó
- Con TV, celular y parlante de verdad. Las pruebas usan el reproductor de YouTube simulado, TVs del wifi simulados y el
  canal real del servidor de pruebas.
- Que un TV en particular (LG, Samsung, Fire TV) acepte la unión a su sesión de YouTube depende del TV: si no la acepta,
  queda el código del TV.
