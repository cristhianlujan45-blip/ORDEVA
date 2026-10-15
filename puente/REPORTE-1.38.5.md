# Vento 1.38.5 — Por fin se publica la app Android nueva (la descarga seguía dando la 1.0.15)

## La causa de «estoy en la app y me dice que es Vento Web»
- **El APK que se descargaba era la 1.0.15 del 4 de octubre.** Se revisó el archivo publicado: no traía los avisos de
  pagos, ni la voz, ni los SMS, ni YouTube Premium.
- **Por qué:** el 5 de octubre la llave de firma salió del repositorio por seguridad. Desde entonces la compilación
  quedó esperando dos secretos de GitHub que nunca se configuraron. Cada compilación «pasaba», pero el paso «Publicar»
  se saltaba.
- **Por eso,** aunque se reinstalara, el celular seguía con la app vieja, y la página nueva no encontraba en ella las
  funciones de los pagos.

## Arreglo (decidido por el dueño)
- **El flujo «App Android» firma con la misma llave de las versiones ya instaladas** (comprobada por su huella
  `3D:DC:CB:…:D4:0D`) y publica.
  - La app nueva se **instala encima** de la 1.0.15, sin desinstalar ni perder nada.
  - Si la huella no coincide, no publica.
- **Cuando estén los secretos de una llave nueva,** los usa. Para pasar a una llave privada sin que los clientes
  reinstalen, ver android/LEEME.md → Firma.

## La app vieja ya no se confunde con Vento Web
- **El paso a paso dice:** «Estás en la app Vento, pero es una versión VIEJA (1.0.15)… actualízala», con el botón
  **«⬇️ Descargar la app nueva (vento.apk)»** y qué hacer si dice «No se instaló la app».
- **«🔎 Este equipo»** dice «App Vento para Android 1.0.15 — VIEJA».
- **Ajustes → 💜 Pagos** también lo dice.
- **Prueba `appoweb`:** 25 comprobaciones.
