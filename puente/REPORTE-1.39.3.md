# Vento 1.39.3 — Licencias únicas de un solo equipo (el cliente la pasa a su celular nuevo) y Vento Admin que se actualiza solo

## 1. Licencias con código: únicas y de UN solo equipo
- **Una licencia = un cliente.** Se crea con un solo uso y máximo un correo. Si piden más usos o más correos, el
  servidor no lo deja («Una licencia es para un solo cliente»). Las licencias viejas con varios usos quedaron con los
  usos que ya tenían: ninguna se puede seguir repartiendo.
- **Funciona en un solo dispositivo:** queda en el equipo que la activó. Las activadas antes de esta versión quedan en el
  primer equipo que abra Vento. En otro celular u otro computador del mismo negocio aparece
  «📲 Tu licencia está en otro equipo» (con el código) y la app no funciona allí.
- **Otra sede = otra licencia.** Así lo dice la misma pantalla.
- **El cliente la pasa él mismo a su equipo nuevo:** botón «📲 Pasar mi licencia a este equipo» (dueño o administrador,
  con confirmación). El equipo anterior se bloquea al instante (tiempo real). **Máximo un cambio cada 30 días**; si ya
  la cambió, la pantalla dice desde qué fecha podrá volver a pasarla.
- **Solo licencias con código.** Los planes pagados por Nequi/DaviPlata o activados por el administrador siguen
  sirviendo en todos los equipos del negocio.
- Lo decide el servidor: el estado «otro_equipo» va en el token firmado, así que no se puede falsear en el celular.
- **Panel → 🔑 Licencias:** campo «Correo del cliente (uno solo)», sin «Usos». Cada licencia muestra
  «✅ Activada / ⏳ Sin activar», en qué equipo está y cuántas veces cambió de equipo.

## 2. Vento Admin se actualiza solo
- Revisa `version.txt` al abrir, cada 2 minutos y al volver a la app.
- Con una versión nueva: si recién abre, está bloqueado o vuelve después de un rato, se **recarga solo sin caché**.
  Si estás escribiendo o tienes una ventana abierta, muestra arriba «🔄 Actualizar ahora» para no cortarte.
- Si el servidor todavía entrega la página vieja, no se queda recargando: deja el aviso.
- Así la app de Administrador toma sola los botones nuevos («✅ Activar» y «⛔ Cancelar» en 💳 Suscripciones).

## Servidor
- Migración `20261020000000_licencias_un_equipo.sql`: `licencia_usos.equipo / movida_en / cambios`,
  `srv_lic_equipo`, `srv_lic_mover` y las funciones de licencias con el equipo.
- `POST /estado` y `POST /licencia` reciben `equipo`. Ruta nueva `POST /licencia-mover` {negocio, equipo}.

## Pruebas
- `servidor/admin` (82, PostgreSQL real): un correo y un uso; en otro equipo «otro_equipo» con el token firmado; sin
  equipo tampoco; mover (permisos, equipo inválido, repetido, 30 días); un plan que no es de licencia sirve en todos los
  equipos; las migraciones se vuelven a correr sin perder el equipo.
- `puertaytiemporeal` (33): pantalla «otro equipo», pasarla a este equipo y abrir con PRO, y sin botón si cambió hace poco.
- `adminversion` (7, nueva): se recarga sola con versión nueva, no entra en bucle y no corta si estás escribiendo.
- `adminreal` (39): licencia para el correo del cliente, sin «➕ Correo».
