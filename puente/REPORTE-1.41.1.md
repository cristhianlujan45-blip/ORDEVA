# Vento 1.41.1 · La llave Bre-B suena de una, también con la pantalla apagada

El dueño: «Quedó perfecta. Lo único: la llave no suena con la pantalla apagada (me toca desbloquear) y se demora un
poquito más. Que sea como DaviPlata, que llegue de una. De resto no mueva nada».

## Por qué
DaviPlata avisa la llave Bre-B SIN el valor; el valor llega después por SMS del 85888. Vento esperaba 5 s ese SMS antes de
hablar (y el SMS esperaba 1,5 s el aviso de la app). Con la pantalla apagada, Android duerme el celular y esas esperas se
quedaban dormidas hasta desbloquearlo.

## Arreglo (solo esto)
- La llave suena **de una**: «Llegó plata por Bre-B, en DaviPlata.», con su notificación y su ventana.
- El SMS con el valor suena **de una**: «Recibiste 65000 pesos por Bre-B, en DaviPlata.», con el valor en la
  notificación y en la ventana.
- Ninguna espera: cada aviso se dice en el instante en que llega, que es cuando Android sí deja hablar con la pantalla
  apagada.
- El mismo pago no suena dos veces:
  - si llegó primero el SMS, la llave no lo repite;
  - si DaviPlata avisa con el valor por la app y por SMS, suena una sola vez.

## Pruebas
- `javaavisos`: `EscuchaPrueba` 26 comprobaciones, con los avisos reales.
  - La llave suena de una y sin esperas pendientes.
  - Llega el SMS y suena el valor.
  - SMS primero y luego la llave: una sola voz.
  - El mismo pago por SMS y por la app: una sola voz.
- `pagosaviso`, `pagosguia` y `avisosandroid` pasan; compila todo el código Android.
