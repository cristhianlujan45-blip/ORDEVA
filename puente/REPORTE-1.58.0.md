# ORDEVA 1.58.0 · etapa 8 (2/2): la marca visible pasa de Vento a ORDEVA

Servidor de pagos 1.24.1 (solo cambian textos). La app Android sale en una versión nueva (nombre e ícono) y se actualiza sola.

## Qué cambia para el usuario
- **Páginas:** todas las pantallas, avisos, ayudas y guías dicen **ORDEVA**: app del negocio, administrador, meseros,
  pedidos del cliente, preparación, TV, licencias y tipos de negocio. Unas 1.400 menciones.
  - Se dice «ORDEVA Nube», «ORDEVA IA», «ORDEVA Admin» y «ORDEVA Web».
- **App Android:**
  - se llama **ORDEVA**, también en la lista de «Acceso a notificaciones», así que las instrucciones coinciden con lo
    que muestra el celular;
  - sus avisos y canales («ORDEVA trabajando de fondo», «🔄 ORDEVA tiene una actualización») dicen ORDEVA;
  - ORDEVA Admin igual.
- **Programa de PC:** ventana y pantalla «Sin conexión con ORDEVA».
- **Servidor:** los mensajes de error y de ayuda dicen ORDEVA.
- **Correos y SMS** de inicio de sesión: «Tu código de ORDEVA».
- **Voz:** Laya responde a **«Hola ORDEVA»** y **sigue respondiendo** a «Hola Vento» y «Bento». Así nadie tiene que
  cambiar la costumbre de un día para otro.

## Qué NO cambia (a propósito)
- **Nombres internos:** ids, claves de almacenamiento, funciones del servidor, tablas, el paquete Android
  (`co.vento.app`) y el archivo `vento.apk`. Cambiarlos rompería las instalaciones y los datos que ya existen.
- **Facturación electrónica:** el nombre del software y del fabricante registrados ante la DIAN / MATIAS
  (`VENTO_SOFTWARE`, `VENTO_FABRICANTE`). Ese nombre está registrado; cambiarlo se hace primero con MATIAS. Se puede
  cambiar con esas variables del servidor, sin tocar el código.
- **Referencias internas:** las que van en los cobros de Nequi y el prefijo de los códigos de cuenta.
- **Descargas:** la carpeta `Descargas/Vento`, donde ya están los respaldos guardados.
- **Diagnóstico:** las líneas del registro de avisos que la página lee para medir demoras, y la revisión de los puentes
  viejos (que responden «Vento»).
- **Avisos ya creados:** en los celulares que ya tenían la app, Android conserva el nombre de los canales de avisos
  hasta reinstalar. El aviso en sí ya dice ORDEVA.

## Pruebas
- **Prueba de voz:** «Hola ORDEVA» anota y «Oye Vento» / «Bento» siguen funcionando.
- **Expectativas de texto:** se cambiaron igual en las pruebas de la app (297 menciones), con las mismas reglas. Las
  del servidor se revisan con la batería del servidor.
- **No probado:** si el reconocimiento de voz del celular escribe «ORDEVA» tal cual; se aceptan también «Hordeva» y
  «Or deva». Si no la reconoce bien, «Hola Vento» sigue sirviendo.
