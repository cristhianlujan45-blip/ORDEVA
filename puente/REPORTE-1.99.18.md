# ORDEVA 1.99.18 · Correo que sí exista · Entrada más fácil · Errores · Arreglos de la auditoría de la música

**Pedido del dueño (19/11):** «Continúa solucionando todos los errores. Revisa el tema de entrar con un correo: que sea un
correo que sí exista, porque al momento el usuario puede entrar con cualquier cosa que escriba ahí. El sistema para entrar
a ORDEVA, que sea muy fácil también. Y haz una auditoría completa de cómo se reproduce la música en YouTube, del QR y todo
eso».

## 1. Errores reales de producción
Se agregó un diagnóstico de solo lectura, `.github/workflows/diagnostico-errores.yml`, que dice el archivo, la línea y la
pila de cada error, sin datos personales.

- **«Cannot read properties of null (reading 'products' / 'history' / 'closures' / 'pagos')»**: 12, 4, 3, 2 y 1 veces.
  - Causa: cuando Android volvía a abrir la página, ORDEVA intentaba regresar a la sección donde estabas a los 0,6 s, antes
    de cargar los datos.
  - Arreglo: ahora espera a que ORDEVA haya entrado con los datos. Además, Inventario, Estadísticas, Carta, Historial, Caja
    y Pagos ya no se dibujan sin datos.
- **«No se pudo publicar en un canal del negocio (sin permiso)»** ×25. Era del Xiaomi conectado al otro negocio; quedó
  resuelto con 1.99.16 (el último fue el 17/11).
- **Avisos de pago que ORDEVA no tomó.** Son avisos del banco que no son plata recibida (registros normales). Hay uno que
  sí requiere acción en el celular: «la ventana del pago no se abrió (usando otra app, Xiaomi)». En el Xiaomi falta el
  permiso «Mostrar ventanas emergentes en segundo plano» (Ajustes del celular → Apps → ORDEVA → Otros permisos).

## 2. Que el correo exista de verdad
**Lo que se encontró:** el servidor crea la cuenta al instante, sin confirmar el correo. Además, **no tiene un servicio de
correos propio (SMTP)**: con el de prueba de Supabase solo salen 2 correos por hora y solo al equipo de Supabase. Por eso
hoy a los clientes no les llegan los códigos de «Entrar con un código» ni los de «¿Olvidaste tu contraseña?».

**Qué cambia** (`lib/vento-correo.js`): antes de crear la cuenta (y al guardar el correo de recuperación):
- **Forma de correo real:** «hola@hola» no sirve.
- **Errores de dedo** («gmial.com», «gmail.co», «hotmial.com», «gmail.com.co»…): no crea la cuenta y ofrece «✏️ Usar
  juan@gmail.com» de un toque. Se avisa apenas se termina de escribir el correo.
- **Correos temporales** (mailinator, yopmail…): no.
- **El dominio tiene que existir y recibir correos:** se pregunta al DNS público. Gmail, Hotmail, Outlook, Yahoo e iCloud se
  dan por buenos sin preguntar. Sin internet se deja pasar.
  - Probado con el DNS real: rechaza «asdkjhqwe123zz.com», «hola.hola» y «example.com».
  - Acepta «unal.edu.co», «bancolombia.com.co» y «gmx.com».
- **El buzón** (lo que va antes de la @): eso solo se sabe mandando un código. Quedó listo. En ORDEVA Admin → Configurar la
  app → **«📧 El servidor ya manda correos»**. Al encenderlo, la cuenta nueva se crea solo con el código que le llega al
  correo, y aparece «📲 Entrar fácil con un código». **Enciéndelo solo después de poner un servicio de correo en Supabase**
  (Authentication → Emails → SMTP; por ejemplo Resend o Brevo, que tienen plan gratis).

## 3. Entrada más fácil
- **Al crear la cuenta:**
  - Dice «Tu correo», con un ejemplo y el teclado del correo.
  - Dice «Contraseña (mínimo 6)».
  - El navegador ya no muestra sus avisos en inglés: los avisos son los de ORDEVA.
- **Al entrar:**
  - Con un correo mal escrito ofrece la corrección.
  - «📲 Entrar fácil con un código» ya no sale mientras los correos no lleguen, porque no servía.
- **¿Olvidaste tu contraseña?** tiene «💬 ¿No te llega el código? Escríbenos por WhatsApp», con el número de soporte de
  ORDEVA Admin.
- **Mensajes de error:** los de correo ya no dicen «revisa el correo de envío en Supabase» al cliente.

## 4. Auditoría de la música
El informe completo está en `puente/AUDITORIA-MUSICA-1.99.18.md`. En esta versión se arregló:
- **«Equipo que pone la música»:** cuando el equipo de la música tardaba 90 s en dar señales (Android cerró su página, un
  corte de internet), el siguiente pedido del QR hacía que OTRO equipo tomara la música, y el primero cortaba la canción.
  - Ahora los pedidos se le mandan siempre al equipo de la música.
  - A los 5 min sin señales se avisa; la música la toma una persona con «🎶 Que suene aquí». Tomarla sola podía caer en el
    equipo equivocado.
  - El equipo de la música también da señales con la app minimizada.
- **Al volver a abrir la página no se repiten** los ⏭, pausas ni «que siga» de los últimos 2 minutos.
- **YouTube del TV que no dice qué hace:** los comerciales adelantaban el reloj de ORDEVA y la canción del QR mandaba
  «lista nueva». Ahora, hasta 10 min de margen, solo se agrega.
- **Música de fondo en el YouTube del TV:** antes le mandaba toda la lista al TV y la canción del QR quedaba de 20.ª. Ahora
  entra de a 2 canciones.
- **Al cliente:** «⏭ La saltaron (sonó un ratico)» en vez de «✅ Ya sonó» cuando sonó menos de la mitad.
- **Lista negra:** solo para los videos que YouTube no deja poner (100, 101, 150), no por errores pasajeros.
- **Búsquedas colgadas:** tienen tiempo máximo y ya no traban la fila.
- **Memoria:**
  - «Sonando» solo se dibuja con Música a la vista.
  - El avance de la canción ya no rehace el respaldo completo.
  - En la app de Android y en modo TV, el probador solo carga, no reproduce.

## Revisión independiente (goldfish)
- **Bloqueante:** faltaba subir el número de versión. Sin eso, los celulares seguían con el código viejo guardado. Se subió
  a 1.99.18.
- **Mayor:** la toma automática de la música a los 10 min podía caer en un celular recién abierto con la cola de ayer, en
  uno sin reproductor, o en varios a la vez. → Ahora solo se avisa y la toma una persona.
- **Mayor:** con el código encendido, en modo avión se creaba la cuenta sin código. → Sin internet ya no se crea. Para
  que el SERVIDOR también lo exija, en Supabase hay que activar «Confirm email» (el aviso de ORDEVA Admin lo dice).
- **Mayor:** se rechazaban correos reales con «_» o «-» al final (carlos_@hotmail.com). → Arreglado.
- **Mayor:** cada código mal escrito mandaba otro correo. → Ahora son 3 intentos con el mismo código.
- **Mayor:** si el correo ya tenía cuenta, se le cambiaba la contraseña a esa cuenta sin avisar. → Ahora entra a esa
  cuenta, no cambia nada y lo dice.
- **Menores corregidos:**
  - Un DNS que falla no se toma como «el dominio no existe».
  - La revisión del correo dura como mucho 8 s.
  - «Ese correo no tiene cuenta» ya no dice que los correos no llegan.
  - «La saltaron» solo para canciones que sí empezaron a sonar.

## Pruebas
- **Nueva `pruebas/correoreal.test.js` (13/13).**
  - Usa el Supabase local real y un DNS simulado.
  - Cubre: error de dedo y su corrección, dominio inexistente, correo desechable, dominio real, corrección al entrar, y la
    cuenta creada con el código del correo (con un código malo no; con el bueno sí, y se entra con la contraseña en otro
    celular).
- **`pruebas/musicaautoplay.test.js` ajustada** (12/12): un pedido ya no toma la música; sin señales se avisa, y con
  «🎶 Que suene aquí» la música pasa a ese equipo.
- **`pruebas/cuentas.test.js` ajustada:** «Tu correo» en lugar de «Correo o usuario».
- **Las reproducciones de la auditoría ya no fallan con este código:**
  - un pedido no toma la música;
  - el ⏭ no se repite al volver;
  - el TV sin informe no recibe «lista nueva»;
  - la música de fondo no inunda el TV.
- **El servidor local de pruebas** crea la cuenta al mandar un código, como lo hace Supabase.
