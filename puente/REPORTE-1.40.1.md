# Vento 1.40.1 · Avisos de pago de DaviPlata, Nequi y la llave Bre-B

## Lo que fallaba
- **La voz podía quedarse callada.** Desde la 1.40.0 la frase del pago se graba primero (para que suene pareja). Hay
  motores de voz que graban pero nunca avisan que terminaron: ese pago no sonaba. Ahora, si en 6 s no avisa, se dice
  directo.
- **Pagos de verdad descartados.** Un aviso como «JUAN le envió $30.000 a su DaviPlata. Nunca comparta su clave» se
  tomaba como mensaje privado por la palabra «clave». Ahora, con una frase fuerte de plata recibida, es pago. Los
  códigos de seguridad («código de verificación», «clave dinámica», OTP) nunca son pago.
- **Más formas de la llave Bre-B y de los bancos:** «Transferencia entrante», «Abono recibido por Bre-B», «Recibiste
  un pago en tu llave», «Ingreso de $…», «Llegó una transferencia», «Recibio» sin tilde.
- **Más bancos** que reciben por Bre-B: Itaú, Banco Popular, Banco de Bogotá, Pibank, Coltefinanciera, Bancamía,
  Mibanco, Falabella, Finandina, Serfinanza, Confiar, Global66, Ban100, Coomeva, cooperativas, Tpaga, Bold, Agrario,
  GNB Sudameris.
- **El valor en otra parte del aviso.** Si una app pone el valor en el subtítulo, el resumen, el texto de la barra o
  en un aviso dibujado por ella, ahora también se lee.
- **Avisos agrupados** («2 mensajes nuevos»): un pago viejo que seguía en el grupo podía volver a sonar. Ahora solo
  suena el nuevo.

## Nuevo
- La voz y el aviso dicen cuando llegó por la llave: «Pago confirmado. 20000 pesos por Bre-B, en Nequi».
- Ajustes → 💜 Pagos:
  - Muestra cuándo llegó el último aviso de un banco a ese celular.
  - Muestra «🔎 Avisos del banco que Vento no tomó como pago», sin nombres ni valores. Esos avisos también llegan a
    Vento Admin (Errores) para aprender el formato.
- Si Android desconectó la lectura de avisos (ahorro de batería, actualización), Vento le pide reconectarla y lo dice
  en Ajustes.

## Para que se aplique
- Hay que **instalar la app Vento nueva** (la compila el flujo «App Android» en GitHub). Se instala encima y no se borra
  nada.
- En el celular que recibe los pagos:
  - Ajustes → 💜 Pagos → «Leer los avisos de este celular» prendido.
  - Vento sin ahorro de batería.
  - Inicio automático activado (Xiaomi, Oppo, Vivo…).

## Pruebas
- `AvisoPagoPrueba` (Java) 116.
- `pagosaviso` 46: nuevo paso 16 con las formas nuevas y los avisos que no se tomaron.
- `avisosandroid`, `daviplatacobro` y `pagosguia` en verde.
