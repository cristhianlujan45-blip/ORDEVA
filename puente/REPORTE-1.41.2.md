# Vento 1.41.2 · Plata desde otra entidad por la llave

El dueño: «Está perfecto. Solo que cuando me envían de OTRA entidad por llave se demora en llegar, y que con la pantalla
bloqueada también me llegue la notificación».

## Qué cambió (solo esto)
- **La app Android entiende más formas de escribir la plata que llega desde otro banco:**
  - «Te enviaron $45.000 desde otra entidad»;
  - «Transferencia interbancaria recibida»;
  - «Tienes un nuevo abono»;
  - «Nuevo ingreso por Bre-B»;
  - y sin valor: «dinero de otra entidad por tu llave».

  Antes, un aviso con otra forma se le pasaba a la página. Con la pantalla apagada, Android duerme la página, y por eso
  sonaba tarde y sin notificación hasta desbloquear. Ahora la app lo entiende y suena de una, con su notificación y su
  ventana. La página tiene la misma regla.
- **⏱ El registro dice de dónde viene una demora** (Ajustes → 💜 Pagos → «📋 Últimos avisos del banco y qué hizo Vento»):
  - «el banco lo mandó N s tarde»: la hora del pago que trae el aviso o el SMS, frente a cuando llegó al celular;
  - «Vento lo leyó N s después».

  Vento habla en el instante en que el aviso llega; si el banco lo manda tarde, ahí queda dicho.
- Recordatorio: la 1.41.1 (app 1.0.37) quitó las esperas de la llave que Android dormía con la pantalla apagada. Esta
  versión necesita la app 1.0.38, que se instala sola.

## Pruebas
- `javaavisos`: `AvisoPagoPrueba` 140 comprobaciones; 10 nuevas de otra entidad (con valor, sin valor y lo que NO es
  plata recibida). `EscuchaPrueba` 27, con «⏱ el banco lo mandó 40 s tarde».
- `pagosaviso` 86: la página entiende otra entidad ($45.000, $30.000, $12.500) y no toma «Enviaste… a otra entidad».
- `pagosguia`, `avisosandroid` y `daviplatacobro` pasan; compila todo el código Android.
