# Vento 1.41.5 · La ventana del pago en todo tipo de celular (también Nequi y bloqueado)

El dueño: «No solamente mi celular, también un Samsung. Que funcione en todos los dispositivos: que con la pantalla
bloqueada abra la ventana emergente, así como ya funciona con DaviPlata. Haz lo mismo con Nequi».

## Por qué con DaviPlata sí y con Nequi no
- Los pagos que entiende la **app Android** (DaviPlata) sacan la notificación **y** la ventana, también bloqueado.
- El Nequi «te envió 1500» lo entendió la **página** (la app de antes no entendía el valor sin «$»). La página solo
  sacaba la notificación: la ventana fuera de Vento nunca se abría. Lo mismo pasaba con cualquier formato nuevo o con
  las frases del administrador.

## Arreglo
- **Todo pago que entiende la página va por el MISMO camino que DaviPlata** (`pagoNotificar` → `notificarPago`):
  notificación, ventana encima de la pantalla de bloqueo o de la otra app, y pantalla prendida.
  - Pago confirmado: ventana morada.
  - SMS por revisar: ventana naranja.
  - SMS falso: ventana roja.
  - Frase de pago sin valor: «Llegó plata».
- **Un solo plan para todos los celulares** (`PlanVentana`):
  - Bloqueado o pantalla apagada: SIEMPRE la notificación de pantalla completa **y** la ventana directo.
  - En Android 15 con el permiso de encima, una ventanita invisible de Vento (el «ancla») para que Android deje abrirla.
  - Usando otra app: encima de esa app; sin el permiso, como pantalla.
  - Con Vento a la vista: la página (no sale doble).
  - El permiso que falte en ese celular se pide con su botón: encima de otras apps, pantalla completa o los dos de
    Xiaomi.
- «▶ Probar la ventana» usa ahora el mismo camino que un pago de verdad (notificación + ventana).

## Pruebas
- `PlanVentanaPrueba` (nueva): 160 combinaciones de celular y permisos, bloqueado, usando otra app y con Vento a la
  vista. Celulares: Samsung A14 (Android 14), A54 (15), A10 (11); Xiaomi Redmi Note 12 (HyperOS), Redmi 9 (MIUI 10),
  POCO X5; Motorola (15); OPPO (12); Huawei (9); Android 7.
  - Bloqueado: siempre pantalla completa + directo.
  - Fuera de Vento: siempre se intenta.
  - Con Vento a la vista: nunca doble.
  - Se pide el permiso correcto.
- `pagosaviso` 90: el Nequi «te envió 1500» que entiende la página va por la app Android con «$1.500 · Nequi», y el SMS
  falso abre su ventana roja.
- `javaavisos` 187; compila todo el código Android.
- Estas pruebas son de la lógica (en el computador). En los celulares de verdad, la confirmación es el próximo pago.
