# ORDEVA 1.65.10 · 🔄 Los datos de una cuenta vuelven a verse en todos los equipos

## Qué se pidió
«Los datos de una cuenta ya no se ven en otro dispositivo, no se están compartiendo.»

## Qué pasaba
- La sincronización (`nube/vento-nube.js`) no tenía tope de tiempo en ningún paso.
- Si una llamada al servidor no contestaba, ese equipo se quedaba esperando para siempre. Pasa al cambiar de wifi a
  datos o con el celular dormido.
- Lo mismo si la copia local (IndexedDB) no respondía, algo común en Android con poca memoria.
- Mientras esperaba, «subiendo» quedaba prendido: ese equipo no subía lo nuevo ni revisaba la nube hasta cerrar la
  app.
- El diagnóstico del servidor muestra **30 cierres por falta de memoria** en los dos celulares en los últimos días.

## Qué se cambió
- Cada llamada al servidor tiene un tope de 20 s: guardar, leer y revisar la versión. Si no contesta, se da por
  perdida y se vuelve a intentar.
- La copia local tiene un tope de 5 s. Sin ella se sigue sincronizando, porque solo sirve para mezclar.
- **Vigilante:** si subir o bajar lleva más de 1 minuto sin terminar, se suelta solo y vuelve a subir lo pendiente.
  Queda anotado una vez por sesión en los errores del equipo («La sincronización estaba trabada»), visible en
  ORDEVA Admin y en el diagnóstico.
- Arreglo menor: «Cannot read properties of null (reading 'qrPago')» (7 veces en el diagnóstico). El QR de pago se
  publicaba cada 30 min aunque no hubiera datos cargados.

## Pruebas
- `pruebas/nubetrabada.test.js` (12 ✅), contra el Supabase local real con 3 celulares:
  - guardado que no contesta → igual llega al otro equipo;
  - guardado colgado sin tope → el vigilante lo suelta y queda anotado;
  - copia local que nunca contesta → sube y baja igual;
  - una cuenta abierta (mesa) en A se ve en B.
- Con la versión anterior, el caso de la copia local falla: el equipo nunca recibe los datos. Así se confirma que esta
  falla existía.
- Siguen bien:
  - `cuentas` (43), `flujocompleto` (87), `mesarepetida` (12), `pagosequipos` (50), `entrar` (35);
  - `equipoactividad` (32), que pasó al correrla sola;
  - servidor: `equiponoreescribe`, `permisos` y `respaldos`.

## Lo que no se pudo probar
- Los celulares de verdad: no se puede reproducir aquí la falta de memoria de Android.
- Si vuelve a pasar, el vigilante lo anota y se verá en el diagnóstico con el nombre «La sincronización estaba
  trabada».
