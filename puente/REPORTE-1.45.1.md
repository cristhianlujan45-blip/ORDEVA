# Vento 1.45.1 — Bloquear un negocio o un usuario desde Vento Admin (al instante) y «sin base de datos no funciona» de verdad

## Qué faltaba
- **Bloquear un usuario** (Vento Admin → «⛔ Bloquear la cuenta») solo impedía que volviera a **entrar**. En los equipos
  donde ya tenía la sesión abierta, Vento seguía funcionando.
- **No había cómo bloquear un negocio** completo.
- **Sin internet,** la app seguía funcionando hasta **72 horas** con el último estado guardado. El pedido era que ningún
  equipo funcione sin estar conectado a la base de datos.

## Ahora
- **🔒 Bloquear negocio** (Vento Admin → Negocios → el negocio):
  - pide el motivo (lo ve el cliente) y una confirmación;
  - todos los equipos del negocio quedan **al instante** en «🔒 Esta cuenta está bloqueada», con el motivo, porque les
    llega el aviso en vivo del canal `vs-<negocio>`;
  - siguen bloqueados aunque se vuelvan a abrir sin internet;
  - **🔓 Desbloquear negocio** los abre solos;
  - en la lista de negocios se ve «⛔ Bloqueado»;
  - queda en la auditoría (`negocio_bloqueado` / `negocio_desbloqueado`).
- **⛔ Bloquear la cuenta de un usuario:** ahora también corta **al instante** en sus equipos («🔒 Tu usuario está
  bloqueado»): el servidor avisa en vivo a todos sus negocios y `/estado` responde «bloqueado». Al desbloquearlo
  vuelve a funcionar solo.
- **Siempre conectada:**
  - si un equipo no puede hablar con la base de datos de Vento por más de **60 segundos** (sin internet o el servidor
    no responde), queda en «📡 Sin conexión con Vento», aunque tenga el plan guardado;
  - se reintenta solo cada 15 s y se quita apenas vuelve la conexión, dejándote donde ibas;
  - las páginas del mesero, preparación, pedir por QR y el TV ya lo hacían.

## Técnico
- **Migración `20261028000000_bloqueos.sql`:**
  - columnas `negocios.bloqueado_en` y `bloqueo_motivo`;
  - funciones `srv_negocio_bloquear`, `srv_bloqueo_de`, `srv_negocio_avisar` y `srv_usuario_avisar` (aviso en vivo con
    `realtime.send`, como en `20261018000000_suscripciones_tiempo_real.sql`), que solo puede llamar el servidor;
  - disparador del bloqueo del negocio;
  - `srv_admin_negocios` y `srv_admin_negocio` devuelven el bloqueo.
- **`vento-suscripciones`:**
  - `/estado` devuelve `bloqueado` (sin token) si el negocio o la cuenta están bloqueados;
  - acción nueva `admin/negocio_bloquear`;
  - `usuario_bloquear` avisa en vivo a los negocios del usuario.
- **App:**
  - `nube/vento-suscripcion.js` guarda el bloqueo (`vento_sub_bloqueo:<negocio>`) y aplica el límite de 60 s;
  - `lib/vento-puerta.js` tiene la pantalla «bloqueado» y el «Sin conexión» corto.
- **`admin.html`:** botones 🔒 Bloquear / 🔓 Desbloquear negocio y la etiqueta «⛔ Bloqueado».

## Pruebas
- **`servidor/bloqueos` (nueva),** 18 comprobaciones contra PostgreSQL real.
- **`puertabloqueo` (nueva),** 12 comprobaciones.
- **`adminsubreal`:** 39 comprobaciones, con el botón de bloquear contra el servidor real.
- **`puertaytiemporeal`:** sigue con sus 34 comprobaciones.
