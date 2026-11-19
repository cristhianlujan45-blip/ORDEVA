# ORDEVA 1.99.20 · Arreglos de las pruebas nocturnas

Las pruebas completas de cada noche (todas las de la app) fallaban desde el 17/11 en tres pruebas: `dian`, `appoweb` y
`equipoactividad`. Se revisó cada una.

## dian: arreglo real de la app
`nube/vento-dian.js`. Si se tocaba «💾 Guardar» y enseguida el interruptor «Prender facturación electrónica», los dos
guardados viajaban a la vez. La respuesta del primero (todavía apagada) podía llegar después y dejar en pantalla lo
contrario de lo elegido. Ahora los guardados van uno detrás del otro.
- Se encontró buscando automáticamente el cambio que la rompió (git bisect). Fue la 1.99.12: los botones de 44 px en
  Ajustes cambiaron el tiempo entre los dos toques.
- La prueba: 29/29, dos veces seguidas.

## appoweb y equipoactividad: solo las pruebas
- **`appoweb`:** una carga de página esperaba a que la página terminara de cargar del todo. Con la máquina de pruebas
  cargada pasaba de 30 s. Ahora espera solo el contenido, como las demás, con 60 s de margen (25/25).
- **`equipoactividad`:** la lista de actividad se abría antes de que el servidor guardara lo que mandó el asesor. Ahora la
  prueba la vuelve a abrir, como haría la persona (32/32).

## Diagnóstico de errores (últimas 48 h)
Ningún error nuevo de la app. «Android cerró la página por falta de memoria»: el último fue el 18/11 a las 13:50, en la
versión 1.99.16; desde la 1.99.17 no ha vuelto a aparecer (todavía es poco tiempo para darlo por resuelto).
