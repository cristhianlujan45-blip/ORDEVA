# Vento 1.40.4 · Los pagos de DaviPlata por SMS (85888) suenan siempre

Con la captura del dueño (15-oct-2026, 9:52 p. m.): llegaron «Recibiste 65,000.», «Recibiste 100.», «Recibiste 1,000.»,
«DaviPlata: recibiste 20,000 en tu DaviPlata» y «Recibiste 200.» por SMS del 85888, y la app no dijo nada.

## Por qué
1. **El valor de DaviPlata llega SOLO por SMS del 85888 y sin el signo $.** La 1.40.1 solo entendía valores con $:
   esos SMS se ignoraban. La 1.40.2 ya los entendía, pero los trataba como «revísalo en la app del banco».
2. **Dos pagos seguidos por SMS: solo sonaba el último.** Se guardaba un solo SMS pendiente a la vez.
3. **La conversación de SMS trae los mensajes viejos**: al llegar uno nuevo se podían volver a decir los de antes.
4. **La llave Bre-B sin valor se podía juntar con el SMS de OTRO pago** de hasta 3 min antes.
5. Si Android desconectaba la lectura de avisos en segundo plano, los pagos no volvían a sonar hasta abrir Vento.

## Arreglo
- El **85888 es el número oficial de DaviPlata**: su SMS cuenta como pago confirmado y suena
  **«Recibiste 200 pesos por DaviPlata.»**, con el aviso del celular «💜 Pagaron $200», también con el celular
  bloqueado.
- De una conversación solo cuentan los **mensajes nuevos** (cada uno con su hora, últimos 3 min). Dos pagos iguales
  seguidos suenan los dos.
- **Llave Bre-B:** el aviso de la app (sin valor) se junta con su SMS, llegue primero el que llegue. Solo con un SMS
  de hace menos de 1 min, y el SMS puede llegar hasta 2 min después. Suena **«Recibiste 140000 pesos por Bre-B, en
  DaviPlata.»** una sola vez.
- **Segundo plano:** cada minuto, el servicio de Vento revisa si Android desconectó la lectura de avisos. Si es así,
  pide reconectarla y, si no funciona, apaga y prende el lector para que Android lo conecte otra vez.

## Prueba nueva (sin celular)
`javaavisos`: corre el MISMO código de la app Android (`VentoEscucha` + `AvisoPago`) con los SMS reales de la
captura.
- `AvisoPagoPrueba`: 130 comprobaciones.
- `EscuchaPrueba`: 14 situaciones. Así encontré los errores 2 y 4.
