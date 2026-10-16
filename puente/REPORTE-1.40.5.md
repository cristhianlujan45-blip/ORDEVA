# Vento 1.40.5 · Los avisos de pago no dependen de reinstalar la app

El dueño (16-oct-2026): «todavía no me avisa cuando me envían plata por Bre-B o por llave desde otro banco, ni por
Nequi ni por DaviPlata».

## Por qué
1. **Las reglas que entienden los avisos del banco vivían solo en la app Android.** Cada arreglo (1.40.1 a 1.40.4)
   solo llegaba al reinstalar `vento.apk`, y el archivo de la 1.0.31 tenía 0 descargas. Si un banco cambiaba la
   forma de escribir el aviso, la app lo descartaba sin que nadie se enterara.
2. **Al reinstalar la app se borran sus ajustes.** «Leer los avisos de este celular» quedaba APAGADO y el permiso
   «Acceso a notificaciones» se perdía. En Vento los pagos seguían prendidos, pero el celular ya no leía nada y no lo
   decía.

3. **Regresión desde la 1.40.4 con los SMS del 85888.** Hasta la 1.39 (cuando sí sonaba) la app leía SIEMPRE el
   último SMS de la conversación. La 1.40.4 solo tomaba los mensajes con hora de los últimos 3 min: si el 85888 manda
   el SMS con retraso, o con la hora de la red corrida, el pago se ignoraba por completo.
4. **El micrófono se podía quedar «escuchando» para siempre.** Al parar, Vento espera que Android avise «terminé»; si el
   reconocedor del celular se trababa, el aviso nunca llegaba y tocar el botón otra vez no hacía nada.

## Arreglo
- **SMS como en la 1.39:** el mensaje más nuevo de la conversación se lee siempre, traiga la hora que traiga (el mismo
  nunca suena dos veces). Los anteriores, solo si son de los últimos 10 min.
- **El registro de avisos llega solo al panel:** cada aviso del banco que Vento no tomó, no entendió o pasó crudo llega a
  🐞 Errores del panel de administrador, sin nombres ni valores. Antes solo se mandaba al abrir Ajustes → Pagos.
- **Micrófono:** si en 2,5 s no termina, se cierra a la fuerza y anota lo que ya se oyó. Un segundo toque lo cierra
  al instante y nunca escucha más de 35 s. Otra escucha trabada (producto por voz) ya no bloquea el botón.
- **La app le pasa a la página todos los avisos del banco que no entiende** (avisos «crudos»), si hablan de plata.
  Entran los de las apps de bancos y los SMS de los números cortos de los bancos (como el 85888). Nunca se pasan los
  códigos de seguridad, la plata que sale ni los SMS de un contacto. La página siempre está al día: si ella lo
  entiende, lo registra y dice «Recibiste … pesos por …». Si tampoco lo entiende, lo reporta sin nombres ni valores
  en 🐞 Errores del panel, para aprender ese formato.
- **La lectura se prende sola** en el celular del dueño o del administrador si en Vento los pagos están prendidos.
  No pasa si el dueño la apagó a propósito, ni en el celular de un mesero (leería su banco personal).
- **Aviso fijo arriba cuando los pagos no van a sonar**, con su botón:
  - falta el permiso → «🔓 Dar el permiso»;
  - Android desconectó la lectura → «🔄 Reconectar»;
  - la app es vieja → «⬇️ Instalar la nueva».
  Cada uno se reporta también en 🐞 Errores, una vez al día.

## Pruebas
- `javaavisos`: `AvisoPagoPrueba` 130 y `EscuchaPrueba` 20. Hay 6 nuevas: SMS con retraso, crudo de app y de SMS del
  85888, sin repetir, y qué nunca se pasa.
- `microfono`: 26 comprobaciones; 4 nuevas con el reconocedor trabado: se cierra solo, anota lo oído, el botón vuelve
  a funcionar y el segundo toque lo cierra.
- `pagosaviso`: 64 (8 nuevas: aviso crudo entendido o reportado, lectura que se prende sola, aviso fijo de permiso,
  desconectada o app vieja, apagada a propósito, celular de mesero).

## Lo que necesita el dueño
Instalar una vez la app nueva (el aviso fijo trae el botón). Después, los arreglos de los avisos llegan solos con la
página.
