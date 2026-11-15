# ORDEVA 1.99.3 · Auditoría de diseño, tercer lote (encabezado y versión)

## Qué cambia
- **Encabezado en el celular (hallazgo 12):** en pantallas de 600 px o menos ya no aparecen «Salir» al lado de la campana
  ni el reloj (el teléfono ya muestra la hora arriba). Cerrar sesión sigue en **Más → Mi cuenta → Cerrar sesión**, con su
  pregunta de siempre. El nombre del negocio gana espacio (a 390 px pasa de «Restaurante …» a «Restaurante La S…») y el
  subtítulo va en una sola línea. Bajo 380 px el nombre baja a 20 px. En el computador todo sigue igual.
- **Versión en Ajustes (hallazgo 13):** se lee «ORDEVA 1.99.3 · 15 nov 2026» en vez de «ORDEVA · versión v1.99.3 (2026-11-15)».

## Archivos
- `index.html`: bloque CSS `@media (max-width:600px)` y `(max-width:380px)` del encabezado.
- `app/12-fotos-productos-fondo.js`: texto de `#appVersionEl`.
- `pruebas/diseno199.test.js`: puntos 6 y 7.

## Pruebas
- `diseno199`: 15 bien, 0 mal (celular 390 y 320 px, computador 1280 px, versión).
- **Lista completa:** RESULTADOS_AQUI

## No probado
- Teléfonos reales.
