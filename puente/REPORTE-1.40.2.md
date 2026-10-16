# Vento 1.40.2 · Pagos de DaviPlata con el valor, parlante de avisos y recuperar la cuenta más fácil

## Pagos: se dice cuánto llegó (con los avisos REALES de DaviPlata)
Con las capturas del dueño (15-oct-2026) se vio el problema:
- La app DaviPlata, cuando llega plata por la **llave Bre-B**, avisa **sin el valor**: «Transacción exitosa:
  Recibiste Plata de otra entidad usando Llaves…».
- El valor llega por **SMS del 85888** y **sin el signo $**: «DaviPlata: recibiste 100,000 en tu DaviPlata» o solo
  «Recibiste 140,000. Para saber mas…», sin decir DaviPlata. La app Android no entendía valores sin $, así que
  esos SMS se ignoraban.

Ahora:
- Se entienden los valores sin $ («recibiste 100,000», «Recibiste 140,000.», «recibiste 1000»). Un número de
  celular nunca se toma como valor.
- El **85888 es DaviPlata**, aunque el SMS no lo diga.
- El aviso de la app y el SMS del mismo pago **se juntan**, llegue primero el que llegue. La app confirma y el SMS
  dice cuánto: **«Recibiste 140000 pesos por Bre-B, en DaviPlata.»** Una sola vez.
  - Si el SMS no llega en 20 s: «Llegó plata por DaviPlata. Mira el valor en la aplicación».
  - Si el SMS llega después (hasta 3 min), igual se dice el valor.
- «Pasaste $100 a otro DaviPlata» y «Compra exitosa…» **no** son pagos.
- La voz dice **«Recibiste X pesos por DaviPlata/Nequi…»** cada vez que llega plata, también con el celular
  bloqueado o Vento en segundo plano (Android la dice directo).

## ¿A quién le llega el aviso de un pago?
- **Solo al dueño, a los administradores y a quien está cobrando o atiende ESA mesa** (mesero, empleado o cajero).
  A los demás meseros y cajeros ya no les sale ni les suena: antes les llegaba a todos y se repetía.
- Cada mesa guarda quién la atiende (quien le anota pedidos) y quién la está cobrando (quien abre su cuenta para
  cobrar o le crea un cobro de Nequi o DaviPlata; vale 30 min).
- El aviso del celular (push) del servidor también va solo a esas personas: migración
  `20261025000000_avisos_pago_a_quien_cobra`.
- Si un pago no es de ninguna mesa: solo el dueño y el administrador.
- El celular que lee el aviso del banco (el que recibe la plata) siempre lo dice.
- Si DaviPlata avisa sin el valor y no llega el SMS, sale qué mesa estaba esperando el pago y por cuánto, para
  confirmarlo en la app del banco.
- Se siguen leyendo SIEMPRE los avisos de la app de Nequi y de DaviPlata; el SMS solo completa el valor cuando la app
  no lo trae.

## 🔊 Parlante de avisos (Ajustes → Notificaciones del celular)
- Se elige un parlante **Bluetooth o por cable** (también USB) y qué avisos suenan en él: pagos, pedidos, piden la
  cuenta, domicilios, canciones pedidas (solo el aviso), soporte, Vento IA.
- Cada aviso elegido se dice en voz alta **solo en ese parlante**, sin bajar ni mover la música del celular.
- Hay botón «▶ Probar».
- Si el parlante no está conectado, lo dice en Ajustes y los pagos suenan en el celular.
- Con Bluetooth: si el mismo celular pone música, Android también la manda a ese parlante. Vento no lo puede
  cambiar. Para los avisos conviene un parlante por cable, o la música en el TV.

## Recuperar la cuenta
- Al abrir el enlace del correo **no se vuelve a pedir el correo**: solo la contraseña nueva **dos veces**, cada una
  con **👁 para verla** (🙈 la tapa). Si no son iguales, lo dice.
- Funciona en el celular que no tiene la cuenta guardada (enlace de cambiar contraseña o de código).
- El panel de administrador hace lo mismo.
- La pantalla de entrada y la de recuperar también tienen 👁.

## Pruebas
- `AvisoPagoPrueba` (Java) 126, con los avisos reales.
- `pagosaviso` 53.
- `servidor/admin` 136 (destinos del aviso de pago).
- `parlante` 11 (nueva).
- `recuperacion` 25.
- `avisosandroid`, `pagosguia`, `cuentacliente`, `adminreal`, `adminsubreal`, `adminversion`, `flujocompleto`,
  `tipofijo`, `equipoactividad` y `puertaytiemporeal` en verde.
