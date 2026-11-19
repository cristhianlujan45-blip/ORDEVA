# ORDEVA 1.99.17 · Entrar con la huella · La canción del QR ya no corta la que suena

## 1. Entrar con la huella

**Pedido del dueño (19/11):** «revisión de cómo entra el usuario, cómo sale, cómo loguear, que se pueda loguear uno con
huella también».

### Cómo se entra y se sale hoy (revisado)
- **Entrar:** usuario o correo con contraseña. Los empleados también pueden entrar con su PIN, o con un código que llega
  al correo o al celular. Para recuperar el acceso: códigos de recuperación o correo. La sesión queda abierta en el equipo
  hasta que se cierra.
- **Salir:** «Cerrar sesión» guarda todo y vuelve a la entrada. El equipo sigue conectado a la nube, así que no se pierde
  nada. Además están «Cerrar sesión en mis otros equipos» y el bloqueo automático por inactividad.
- **Encontrado y arreglado:** en la pantalla de bloqueo, el empleado con PIN no podía desbloquear con su PIN (solo con la
  contraseña).

### Qué hay nuevo
- **👆 Entrar con huella**, por usuario y por equipo:
  - Se activa en Ajustes → Cuenta (pide la contraseña). También se ofrece después de entrar con la contraseña, no con el
    PIN, como mucho dos veces.
  - En la entrada sale el botón «👆 Entrar con huella · usuario». No se pide sola, porque a la entrada se llega para que
    entre otra persona.
  - En la pantalla de bloqueo, la app de Android la pide sola.
- **App de Android** (`android/…/Huella.java`):
  - Usa la ventana de huella de Android y una llave del Keystore que solo se abre con una huella fuerte.
  - La llave vive solo en ese celular: no viaja en respaldos ni a otro celular.
  - Si alguien agrega otra huella en los Ajustes del celular, Android borra la llave y la huella de ORDEVA se apaga sola.
  - Se necesita el APK nuevo, que GitHub compila solo. Con un APK viejo, la opción no aparece.
- **Navegador:** WebAuthn exigiendo que el equipo verifique a la persona (se revisa la marca UV). Según el equipo, también
  puede servir el PIN del equipo (Windows Hello o Mac), y así se avisa al activarla.
- **Se apaga sola** si cambian la contraseña o el PIN de ese usuario: los cambia él, el administrador, el soporte o se
  cambian en otro equipo.
- **Lo de la huella no va en los respaldos.** Restaurar un respaldo no la trae.
- **No se guarda ninguna huella ni ninguna contraseña.**

### Revisión independiente (goldfish)
- **Bloqueante:** un respaldo llevaba la huella activada a otro celular.
  → Se sacó del respaldo y, en Android, la huella quedó atada a la llave del Keystore.
- **Mayor:** sin llave, cualquiera que supiera el PIN del celular podía agregar su propia huella y entrar.
  → Se usa la llave, que se invalida cuando se agrega una huella.
- **Mayor:** se ofrecía la huella después de entrar con el PIN, y cambiar el PIN no la apagaba.
  → Ahora solo se ofrece tras entrar con la contraseña, y la marca incluye el PIN.
- **Mayor:** `hidden` no escondía el botón ni la fila de Ajustes.
  → Se agregó CSS `[hidden]{display:none!important}`.
- **Mayor:** se pedía sola al cambiar de usuario.
  → Ya no se pide sola en la entrada.
- **Menores corregidos:**
  - Se revisa el estado después de poner la huella.
  - Se cancela la ventana de huella de Android si nadie la contesta.
  - Solo se pinta Ajustes cuando Ajustes está a la vista.
  - Las cuentas que entraron con un código pueden activarla con la contraseña de la cuenta.
  - `activar` ya no se expone.
  - No se ofrece en modo demo.
  - No se duplican las llaves web.

## 2. Música: «cuando alguien pone una canción del QR, se quita la que está sonando»

### Diagnóstico
En los errores del servidor (solo lectura) no hay errores de música. Pero sí aparece **«Android cerró la página de ORDEVA
por falta de memoria» 47 veces en un día en el Xiaomi** (1.99.16). En el código salieron cuatro causas:

1. **Celular:** cada canción nueva del QR se probaba reproduciéndola en silencio en un segundo reproductor escondido,
   mientras sonaba la otra. Eran dos videos a la vez y Android cerraba la página por memoria.
2. **Celular:** al volver a abrir, la canción que sonaba se daba por saltada: se quitaba.
3. **YouTube del TV:** un comercial de YouTube (estado 1081) o el cambio entre canciones (-1) se leían como «TV quieto». La
   canción nueva mandaba «lista nueva» (setPlaylist), que reemplaza lo que suena. Además, después de agregar una canción,
   si el TV no decía «sonando», se le volvía a poner la cola, y eso también cortaba.
4. **Chromecast:** sin noticias del TV, la canción se daba por terminada a los 15 s.

### Qué cambia
- **Celular:** mientras suena una canción, la nueva solo se carga sin reproducir (cue). Si alguna versión no se deja poner,
  el reproductor principal busca otra al llegar a ella, como ya hacía.
- **Celular:** si la página se cierra a la mitad de una canción, al volver se retoma desde donde iba (si fue hace menos de
  10 minutos y no estaba por terminar).
- **TV:**
  - Un comercial cuenta como «sonando», y el cambio de canción como «no se sabe».
  - Si terminó una de ORDEVA y quedan más en el TV, se agrega al final.
  - Mientras hay un comercial no se toca la cola.
  - Después de agregar, solo se manda «play», sin reemplazar la cola.
- **Chromecast:** no se corta una canción que según su duración todavía suena.

### Revisión independiente de la música (goldfish)
- **Bloqueante:** si el TV dejaba de decir qué hacía (se reinició YouTube en el TV), la canción nueva solo se «agregaba» a
  una cola que ya no existía y no sonaba.
  → La excepción quedó solo para «cambiando de canción» y comerciales; el resto se recupera como antes.
- **Mayor:** «cambiando de canción» (-1) y los comerciales no tenían tope de tiempo. Un TV pegado ahí se quedaba callado.
  → Tope de 15 s en -1 y de 3 min en comerciales, con el mismo video. Pasado el tope se trata como quieto: «play», y si no
  arranca, se le vuelve a poner la cola. El canal en vivo usa la misma regla.
- **Menores corregidos:**
  - La canción retomada guarda su posición desde el primer momento: si la página se cae otra vez, no vuelve a empezar.
  - Solo se retoma si este celular sigue siendo el que pone la música (no si pasó al TV o a otro equipo).
  - El probador no acepta la respuesta tardía de otro video.
- **Queda por comprobar en un celular real:** que YouTube avise «no se deja poner» al solo cargar (cue). Si alguna versión
  bloqueada se escapa, el reproductor principal ya busca otra versión al llegar a ella.

## Pruebas
- Nueva `pruebas/huella.test.js` (35/35): navegador con lector de huella de prueba de Chromium, app de Android con puente
  simulado y los casos de la revisión.
- Nueva `pruebas/musicacorte.test.js` (18/18):
  - TV simulado con comercial y con cambio de canción: la nueva se agrega, sin lista nueva.
  - Reproductor del celular simulado: la nueva solo se carga sin reproducir, y al volver a abrir se retoma desde donde iba.
  - Regresiones: un TV que ya no dice qué hace igual recibe la cola, y un TV pegado en -1 se recupera.
- Las dos se agregaron a la lista de CI.
- El Java de la huella se compiló contra Android 34 (`javac` con `android.jar`). El APK completo lo compila GitHub.

## Pendiente visto en los errores
«Cannot read properties of null (reading 'products')» ×12 en el Xiaomi con 1.99.16 (17/11 16:39). Es otro lugar que lee
los datos antes de que existan. No se tocó en esta versión.
