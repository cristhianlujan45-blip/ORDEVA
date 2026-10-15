# Vento 1.39.3 — Licencias únicas, un negocio por cuenta y Vento Admin que se actualiza solo

## 1. Licencias únicas y un negocio por cuenta
- **Una licencia = un cliente y un negocio.** Se crea con un solo uso y máximo un correo; el servidor no deja más
  («Una licencia es para un solo cliente»). Las licencias viejas con varios usos quedaron con los usos que ya tuvieron.
- **La suscripción o licencia sirve en TODOS los equipos del negocio a la vez** (computador, tablet, celular…).
- **Lo que no se puede: otro negocio u otra sede con la misma cuenta.**
  - El servidor no deja crear un segundo negocio a una cuenta que ya es dueña de uno (`un_negocio_por_cuenta`).
  - No deja pasar un negocio a una cuenta que ya tiene el suyo.
  - Si un correo ya tiene una licencia vigente en un negocio, otra licencia no se le activa en otro negocio.
  - En la app, «Agregar sede» con cuenta de Vento dice: «Tu cuenta es de un solo negocio. Para otra sede u otro negocio
    crea otra cuenta de Vento con su propia suscripción o licencia».
  - Las cuentas que ya tenían varios negocios los conservan.
- **Panel → 🔑 Licencias:** «Correo del cliente (uno solo)», sin «Usos»; «✅ Activada / ⏳ Sin activar».

## 2. Plan vencido → modo gratis (cancelada → solo pagar)
- **Vencida, pago rechazado, sin pagar o pago en revisión:** la app NO se bloquea. Sigue en el plan **Gratis** con sus
  funciones limitadas (vender, mesas, inventario y gastos, según el plan Gratis del panel). Las funciones PRO (voz,
  cámara con IA, estadísticas avanzadas…) piden el plan, y desde «Mi plan» se puede pagar.
- **Cancelada por el administrador:** sigue bloqueada con un solo botón, «💳 Pagar para reactivar» (1.39.2).

## 3. Vento Admin se actualiza solo
- Revisa `version.txt` al abrir, cada 2 minutos y al volver a la app.
- Con una versión nueva: si recién abre, está bloqueado o vuelve después de un rato, se **recarga solo sin caché**. Si
  estás escribiendo o tienes una ventana abierta, muestra «🔄 Actualizar ahora» para no cortarte. Sin bucles.
- Así la app de Administrador toma sola los botones «✅ Activar» y «⛔ Cancelar» de 💳 Suscripciones.

## Servidor
- Migración `20261020000000_licencias_un_negocio.sql`: `crear_negocio`, `pasar_negocio_a`, `srv_lic_crear`,
  `srv_lic_correos`, `srv_lic_activar` con las reglas, y `mi_negocio_propio()`.

## Pruebas
- `servidor/admin` (73), `servidor/suscripciones` (154), `adminsubreal` (35), `adminreal` (39), `adminversion` (7, nueva).
