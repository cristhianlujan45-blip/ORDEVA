# Vento 1.40.8 · Notificación de cada pago (también bloqueado) y más rápido

El dueño: «Está funcionando bien. Que funcione un poco más rápido y que me salga una notificación con el valor y el
texto en la pantalla principal o bloqueada, así no esté la aplicación abierta, cada vez que me llegue un pago».

## Notificación de cada pago
- **Sale SIEMPRE**: con Vento abierta, cerrada o el celular bloqueado. Antes, con Vento abierta no salía.
- **Título con el valor**: «💜 Recibiste $20.000 por Nequi» o «… por Bre-B en DaviPlata».
- **Texto**: la frase («Recibiste 20000 pesos por Nequi, de Ana Ruiz. Mesa 3.») y debajo lo que dijo el banco.
- **Se ve completa en la pantalla de bloqueo** (versión pública de la notificación), aunque el celular oculte el
  contenido de las notificaciones.
- **Prende la pantalla unos segundos** si estaba apagada, para que se vea sin tocar el celular.
- **También salen**:
  - plata sin valor: «💜 Llegó plata por DaviPlata»;
  - SMS por revisar: «⚠️ Aviso de $X por SMS: revísalo»;
  - app no oficial: «⚠️ Aviso de $X: revísalo»;
  - SMS desde un celular: «🚨 Mensaje de pago FALSO».
- Se apaga en Notificaciones → «💜 Pagos que te llegan», como antes.

## Más rápido
- El SMS del banco (85888) se dice 1,5 s después de llegar (antes 4 s).
- La llave Bre-B sin valor espera el SMS 5 s (antes 8 s). Si el SMS llega después, igual dice el valor.
- El silencio antes de hablar bajó de 0,4 s a 0,2 s.

## Pruebas
- `javaavisos`: `EscuchaPrueba` 23 comprobaciones; 4 nuevas de notificación: SMS confirmado, Nequi con el texto del
  banco, llave sin valor y SMS falso.
- `pagosaviso`: la notificación de la página sale siempre, en el canal de pagos, con la frase y el texto del banco.
- `pagosguia`, `parlante` y `avisosandroid`: pasan.

## Lo que necesita el dueño
Instalar la app nueva una vez. La notificación, la pantalla que se prende y la rapidez viven en la app Android.
