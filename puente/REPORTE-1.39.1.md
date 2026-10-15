# Vento 1.39.1 — Activar suscripciones desde el panel de Administrador

## Qué pasaba
En 💳 Suscripciones solo había «🔀 Plan», «🎁 Dar meses» y «⛔ Cancelar». No había un botón para **activar** un plan,
y una suscripción cancelada no se podía volver a encender con la fecha que ya tenía.

## Ahora: botón «✅ Activar»
- Aparece en toda suscripción que **no esté pagada y vigente**: cancelada, vencida, rechazada, en revisión, en prueba o
  sin suscripción (también en el detalle del negocio, 🏪 Negocios).
- **Cancelada con días por delante:** ofrece «↩️ Reactivar con su fecha de antes (vence …)», marcado por defecto. Vuelve
  a «Activa» sin cambiar las fechas. También se puede elegir «📅 Activar por meses desde hoy».
- **Vencida, sin suscripción o sin días:** pide el plan y los meses (1, 3, 6, 12 o los que escribas, hasta 36). Empieza
  hoy; si ya tenía ese mismo plan pago y vigente, los meses se suman al final.
- El negocio lo ve **al instante** en todos sus celulares (tiempo real de 1.39.0).
- Queda en el historial del negocio («↩️ Suscripción reactivada» / «Suscripción activada») y en la auditoría.

## Servidor
- Rutas nuevas del panel: `POST /admin/activar` {negocio, plan, meses} y `POST /admin/reactivar` {negocio}.
  Solo administradores de Vento.
- Migración `20261019000000_suscripciones_reactivar.sql`: función `srv_sub_reactivar` (solo el servidor la puede usar)
  y el evento `subscription_reactivated` en el historial. Sin días por delante responde `sin_periodo` («actívala por meses»).

## Pruebas
- `adminsub` (71): Activar en la vencida y no en la paga vigente; activar por meses (envía negocio, plan y meses);
  cancelada → reactivar con su fecha (oculta plan y meses) y vuelve a «Activa».
- `servidor/suscripciones` (153, PostgreSQL real): reactivar conserva la fecha y enciende PRO; repetido no cambia nada;
  sin días → 409 sin_periodo; activar 3 meses desde hoy; el plan Gratis no se activa; un no-admin no puede.
