# ORDEVA 1.99.49 — Un pago que llega tarde dice de cuándo es

Pedido del dueño (23/11): «me llegó una transacción de 3.500 y después me notificó otra de 1.400 que habían puesto antes;
que no suceda eso, que me la notifique al instante y que no haya confusión».

## Qué pasó (registro real del celular, sin nombres ni valores)
- En el Xiaomi, hacia la 1:53 p. m. Android dejó de pasarle a ORDEVA los avisos del banco; volvió a conectar la lectura a
  las 2:02 p. m. y ahí ORDEVA encontró el aviso en la barra: «Vento lo leyó 595 s después». Se dijo como si fuera nuevo.
- En el Samsung, otro pago: «el banco lo mandó 370 s tarde» (la app del banco).

## Arreglo
- Un pago que llegó tarde (el banco lo mandó tarde, o Android se lo pasó tarde a ORDEVA) se dice con su hora:
  «Llegaron 1400 pesos por Nequi. Es de hace 10 minutos.» y la notificación: «💜 Recibiste $1.400 por Nequi · de hace 10 min».
  Uno de ahora (menos de 2 min) suena igual que siempre.
- Lo que se toma al reconectar (hasta 30 min) ya no queda «callado» para que lo diga la página sin la hora: lo dice la voz
  de los pagos del celular, con «Es de hace…».
- Lo que la app no entiende y pasa a la página también lleva la hora (la página dice «Es de hace N minutos»).
- No se tocó el ritmo con el que la app revisa los avisos (lo que ya funciona con el celular bloqueado).

## Pruebas
- Android (sin celular): 378/378 (+10 nuevas: pago de ahora, Android 10 min tarde, banco 6 min tarde, menos de 2 min).
- Página: pagosdiag1946 9/9 (pago tardío por la página), pagosaviso 95, confirmapago 61, alertaspagos 13, pagosequipos 51,
  pagosguia 29, pagosprivados 12, pagossuenan 13, pagostodos 17, pagocuenta1948 8.
