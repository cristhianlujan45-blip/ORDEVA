# Vento 1.55.2 · La app vuelve a abrir en la dirección nueva (repositorio ORDEVA)

## Qué pasó
- El repositorio pasó de «cuentas» a **«ORDEVA»**, decisión del dueño: ORDEVA es el nombre nuevo.
- La página quedó en **https://cristhianlujan45-blip.github.io/ORDEVA/**. GitHub Pages **no** redirige la dirección
  vieja (`…github.io/cuentas/`), que ahora da 404.
- Quedaron mostrando 404:
  - **Los QR impresos de las mesas:** pasan por Netlify, que reenviaba a `…/cuentas/`.
  - **La app Android de Vento y la del panel administrador:** abrían `…/cuentas/`.
  - **La app de PC:** también abría `…/cuentas/`.
- **El actualizador de Android y de PC sigue funcionando:** las descargas de `github.com/…/cuentas/releases` sí
  redirigen a ORDEVA.

## El arreglo
- **QR de las mesas:** el reenvío de Netlify (`netlify-qr/index.html`) ahora va a `…/ORDEVA/`. Los QR impresos no
  cambian.
- **App Android:**
  - `VentoApp.URL_VENTO` ahora apunta a `…/ORDEVA/`.
  - El panel (`AdminActivity.URL_ADMIN`) también.
  - Las descargas de las actualizaciones (`Actualizador.BASE`) van al repositorio ORDEVA.
  - Lo de `/ORDEVA` y lo de `/cuentas` se sigue abriendo dentro de la app.
  - Cada celular **se actualiza solo** (revisa cada 30 min) y vuelve a abrir.
- **App de PC:**
  - Abre `…/ORDEVA/` y descarga las actualizaciones del repositorio ORDEVA.
  - Acepta las dos carpetas.
- **Servidor:** `SITIO` de `vento-pagos` (1.23.2) y de `vento-suscripciones` apunta a `…/ORDEVA/`.
  - El despliegue ya calcula solo la dirección permitida para los correos de recuperación, con el nombre del
    repositorio.
- **Enlaces de descarga de los APK y del instalador de PC** en la app y en el panel: repositorio ORDEVA.

## Pendiente (fuera del código)
- **Los que tienen el acceso directo o la PWA de `…/cuentas/`, enlaces guardados y correos viejos:** necesitan un
  sitio de reenvío en `cristhianlujan45-blip.github.io` que mande `/cuentas/…` a `/ORDEVA/…`. Se prepara aparte.
- **Inicio con Google para YouTube:** si se usa desde el navegador, hay que agregar
  `https://cristhianlujan45-blip.github.io/ORDEVA/` como dirección de regreso autorizada en Google Cloud.

## Pruebas
- `appoweb`: 25.
- `recuperacion`: 25 (`404.html` calcula la carpeta sola).
- `javaavisos`: 224.
- `daviplata`: 102 (servidor 1.23.2).
- `node --check pc/main.js`: sin errores.
