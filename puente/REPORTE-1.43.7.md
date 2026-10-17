# Vento 1.43.7 · La llave Bre-B de Nequi dice el valor: «Recibiste, tanto, pesos, por Bre-B, en Nequi»

El dueño: «Cuando ponen por la llave de Nequi, por Bre-B, que también me diga el valor y suene. Que me diga recibiste
tanto».

## Lo que no se entendía (solo esto cambió)
- **El valor en el diseño propio del aviso.** Algunos avisos de la llave Bre-B traen en el texto solo «¡Te llegó plata
  por Bre-B!» y el valor va en el diseño propio del aviso. Vento solo miraba ese diseño cuando el aviso no traía nada de
  texto, así que decía «Llegó plata por Bre-B» sin el valor.
  - **Ahora:** si el aviso dice que llegó plata pero el valor no está en el texto, también se lee el diseño del aviso y
    el texto corto.
- **Miles separados con espacio («$ 50 000»).** Antes daba «50».
- **«Movimiento recibido +$15.000».** Antes no se tomaba como pago.

Con el valor, suena: «Recibiste, 50000 pesos, por Bre-B, en Nequi», con su notificación y la ventana de 15 s. Si el
aviso no trae el valor por ningún lado («Ingresa a Nequi para ver el detalle»), igual suena «Llegó plata por Bre-B, en
Nequi»: el valor solo se ve en la app de Nequi.

## Revisado
16 formas de avisar Bre-B por llave (con @alias o con el celular como llave): todas dan el valor correcto. La llave
(un número de celular) nunca se toma como el valor, y la plata que sale nunca se toma como pago.

## Pruebas
- `AvisoPagoPrueba`: 156 comprobaciones (6 nuevas de Bre-B).
- `javaavisos` 212. Compila todo el código Android (con `android-all`).

## Lo que necesita el dueño
Nada: app 1.0.50, se actualiza sola.
