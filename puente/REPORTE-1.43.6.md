# Vento 1.43.6 · Pagos de Nequi que se perdían y voz que sale más rápido

El dueño: «Que responda más rápido a las notificaciones, tanto de Nequi, DaviPlata y Bre-B. Y haz que lleguen todas,
que a veces no están llegando, las de Nequi mayormente».

## 1. Pagos que se perdían: los avisos «resumen»
Cuando llegan varios avisos seguidos, las apps los agrupan en uno «resumen». Vento ignoraba siempre los resúmenes.
Algunas apps (Nequi a veces) ponen el pago **solo** en el resumen o en sus líneas, y ese pago nunca sonaba.

**Ahora:**
- El resumen se lee: su texto y cada línea («ANA te envió 2000», «JUAN te envió 5000»…).
- Lo que ya se dijo no se repite.
- Si el resumen llega antes que el aviso normal del mismo pago, el aviso normal no lo repite (por 30 s). Dos pagos
  iguales de verdad suenan los dos.
- Los resúmenes de la app de mensajes (SMS) siguen como antes: los SMS ya se leen por conversación.

## 2. Más rápido: la voz lista de antemano
La voz de los pagos se preparaba recién cuando llegaba el primer pago. En Xiaomi el motor de voz tarda segundos en
arrancar, y por eso el primer «Recibiste…» salía tarde.

**Ahora:**
- El motor de voz queda listo desde que Vento arranca, con el idioma español ya cargado.
- Cada 5 min se revisa que siga listo; si Android lo cerró, se vuelve a preparar.
- El pago sale de una.

(La notificación y la ventana ya salían al instante. Si el aviso de Nequi llega tarde al celular, es el ahorro de
batería de Nequi: Vento ya pide ponerlo «Sin restricciones» en el aviso de la 🔔 campanita.)

## Pruebas
- `EscuchaPrueba`: 33 comprobaciones (4 nuevas del resumen).
  - Lo dicho desde el resumen no se repite en el aviso normal, y solo una vez.
  - Lo que no vino del resumen no se salta.
  - Es por app.
- `javaavisos` 206. Compila todo el código Android (con `android-all`).

## Lo que necesita el dueño
Nada: app 1.0.49, se actualiza sola.
