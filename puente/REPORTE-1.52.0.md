# Vento 1.52.0 · La voz de los pagos suena también en Samsung (y en todas las marcas)

El dueño: «En el Samsung no está sonando la notificación de llegada, en el Xiaomi sí. La idea es que funcione en todo tipo de
dispositivos y en todas las marcas. Revísame el código, si toca reescribirlo».

## La causa (revisando el código; no se pudo probar en un Samsung real)
- La app decía cada pago con el **motor de voz de fábrica del celular**:
  - en Samsung es «Samsung TTS», que muchas veces **no trae descargada la voz en español**;
  - en Xiaomi casi siempre es el de Google, que sí la trae.
- Con el motor de Samsung sin español, la frase se mandaba a decir y no sonaba nada.
- El reintento abría **el mismo motor**, y la voz de respaldo de la página también usaba ese motor. Así que en Samsung
  todo quedaba callado.

## El arreglo (app Android, `VentoApp.java`)
- **Se usa el motor de voz de Google** («Servicios de voz de Google»), que viene instalado en casi todos los Android,
  también en Samsung. Si no está, el del celular.
- **Se revisa que el motor de verdad hable español:** de Colombia, de Estados Unidos o el general. Si no habla
  español o no arranca, se pasa al otro motor en vez de insistir con el mismo, y queda anotado en el registro de avisos.
- **Los reintentos alternan de motor:** si una frase no suena, se vuelve a decir con el otro motor.
- **Canal de alarma también por parámetro en cada frase:** hay motores que no leen la forma moderna de pedir el canal
  de audio y la voz salía por el de la música, bajito o en silencio en el negocio.
- La **voz de respaldo de la página** usa el mismo motor elegido y la misma búsqueda de español.
- El **🩺 chequeo** (Ajustes → Pagos → «Revisar») dice qué motor de voz se usa: Google, Samsung u otro. Si es el de
  Samsung, sugiere instalar «Servicios de voz de Google».

## Pruebas
- Todo el código Android compila con `android-all`.
- `javaavisos`: 252 comprobaciones.
- `pagosaviso` 92, `pagosequipos` 40, `confirmapago` 61.
- La elección del motor de voz necesita un Android real: se verifica en el celular con «▶ Probar la voz» y el chequeo.

## Lo que necesita el dueño
- Instalar la app nueva en el Samsung con «Actualizar ahora» en la 🔔 campanita.
- Probar con Ajustes → Pagos → «▶ Probar la voz».
- Si aun así no suena:
  1. Abrir el 🩺 chequeo y mirar qué motor de voz dice.
  2. Si dice Samsung, instalar «Servicios de voz de Google» desde la Play Store.
  3. En Ajustes del celular → Administración general → Texto a voz, elegir Google y descargar «Español».
