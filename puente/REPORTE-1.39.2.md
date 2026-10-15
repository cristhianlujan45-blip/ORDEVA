# Vento 1.39.2 — Sin plan pago, la app solo ofrece pagar para reactivarla

## Qué pasaba
Cuando el administrador cancelaba un plan, o el negocio no pagaba (vencida, pago rechazado), la app seguía abierta en
el plan gratis, con todas sus opciones.

## Ahora
- **Cancelada, vencida, pago rechazado o sin pagar → la app queda bloqueada.** La pantalla dice qué pasó
  («⛔ Tu suscripción fue cancelada», «⌛ Tu suscripción venció», «❌ Tu pago no fue aprobado» con el motivo…) y trae
  **un solo botón: «💳 Pagar para reactivar»**. Nada de opciones de la nube ni nada más.
- Ese botón abre los planes **solo con los planes pagos** (sin el plan gratis ni «Tengo un código de licencia»).
  Cerrar los planes vuelve al bloqueo.
- **Pago enviado → «⏳ Tu pago está en revisión»**, sin botón de pagar otra vez. Apenas el administrador lo aprueba o
  activa el plan, la app se abre sola al instante (tiempo real).
- **Cajero o mesero:** ven el bloqueo sin botón («el dueño o el administrador del negocio debe pagar el plan»).
- El equipo del proveedor no se bloquea. La página del cliente por QR no cambia.

## Pruebas
- `puertaytiemporeal` (27): cancelar → bloqueada con un solo botón; pagar abre solo planes pagos; cerrar no abre la app;
  en revisión sin botón; aprobado → se abre sola; vencida y rechazada (con motivo) bloquean; cajero sin botón;
  reactivar → se abre.
- Siguen en verde: suscripnube, flujocompleto, cuentacliente, suscrip, adminsub, googletest, pasos.
