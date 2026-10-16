# Vento 1.41.0 · La app Android se actualiza sola

El dueño: «La aplicación tiene que actualizarse sola, no que tenga que estar instalándola cada rato».

## Cómo funciona
- La página (casi todo Vento) ya se actualizaba sola siempre. Ahora también la **app Android** (Vento y Vento Admin).
- Cada vez que se publica una versión, el taller publica junto al APK un `version.json` (`version-admin.json` para
  Vento Admin) con el número de versión.
- La app lo revisa sola al abrirse y cada 3 h desde el servicio de fondo (cada 5 min mira si ya es momento). Si hay
  una nueva:
  - baja el APK;
  - lo instala con el instalador de Android (`PackageInstaller`), cuando Vento **no se está usando** y no acaba de
    llegar un pago;
  - al terminar, Android vuelve a prender Vento de fondo sola (`MY_PACKAGE_REPLACED`). Los avisos del banco que
    lleguen en esos segundos se toman al reconectar.
- **Seguro:** Android solo deja instalar una actualización firmada con la MISMA llave de Vento.
- Máximo 3 intentos por versión, para no bajar el archivo una y otra vez si algo falla.

## Lo que pide Android (una sola vez)
- El permiso **«Instalar apps desconocidas» / «Permitir de esta fuente»** para Vento.
  - Aviso abajo con «🔓 Dar el permiso»: sale una vez al abrir, se esconde solo a los 20 s y no tapa la pantalla.
  - Línea fija en Ajustes, debajo de la versión.
  - Vento Admin lo pide con una ventana.
- La **primera** actualización automática pide tocar «Actualizar»: sale la pregunta si Vento está abierta, o una
  notificación «🔄 Vento tiene una actualización». Desde ahí (Android 12 o más nuevo) se instala **sin preguntar**,
  porque Vento queda como quien instala sus propias actualizaciones.

## En Ajustes
Debajo de la versión, una de estas:
- «📲 App Android 1.0.36 · ✅ se actualiza sola»;
- «⚠️ falta el permiso… 🔓 Permitir»;
- «🔄 hay una nueva (1.0.37): se instala sola cuando no estés usando Vento · Actualizar ahora».

Con una app de antes (sin el actualizador): «Instálala una última vez», con el enlace al APK.

## Pruebas
- `pagosaviso` 85 (4 nuevas):
  - app sin el actualizador;
  - permiso;
  - al día;
  - hay una nueva + «Actualizar ahora».
- Compilan las dos apps Android (Vento y Vento Admin) con `android-all`.
