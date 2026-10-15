# Vento 1.38.4 — Botón directo para bajar la app (vento.apk) desde Vento Web

- **Qué confundía:** en Vento Web el paso a paso solo tenía «📲 Abrir la app Vento». Ese botón abre la app si ya está
  instalada (y si no, la descarga), así que no quedaba claro si daba la APK o la web.
- **Ahora** hay dos botones separados:
  - **«⬇️ Descargar la app (vento.apk)»:** baja el archivo de la app Android, con los pasos para instalarlo («Permitir
    de esta fuente» → Instalar → Abrir);
  - **«📲 Ya la tengo: abrir la app Vento».**
- **Lo mismo en Ajustes → 💜 Pagos** cuando estás en Vento Web.
- **Se revisó el enlace** https://github.com/cristhianlujan45-blip/cuentas/releases/latest/download/vento.apk: baja el
  instalador de Android de verdad (`vento.apk`, 3,4 MB, firmado), no la web.
- **Pruebas:** `appoweb` (20 comprobaciones), `pagosguia`, `pagosaviso` y `avisosandroid` pasan.
