# ORDEVA 1.99.4 · Auditoría de diseño, tercer lote (encabezado, versión y Ajustes › Negocio)
Incluye la 1.99.3, que no se publicó sola: se probaron juntas con una sola lista completa.

## Qué cambia
- **Encabezado en el celular (hallazgo 12, 1.99.3):** en pantallas de 600 px o menos ya no aparecen «Salir» al lado de la
  campana ni el reloj (el teléfono ya muestra la hora arriba). Cerrar sesión sigue en **Más → Mi cuenta → Cerrar sesión**,
  con su pregunta de siempre. El nombre del negocio gana espacio (a 390 px pasa de «Restaurante …» a «Restaurante La S…»)
  y el subtítulo va en una sola línea. Bajo 380 px el nombre baja a 20 px. En el computador todo sigue igual.
- **Versión en Ajustes (hallazgo 13):** se lee «ORDEVA 1.99.4 · 15 nov 2026» (antes «ORDEVA · versión v1.99.3 (2026-11-15)»)
  y sale solo en la lista de categorías, no encima de cada sección.
- **Ajustes › Negocio y facturación más corto (hallazgo 5):** nuevo `lib/vento-ajustes-indice.js`.
  - Arriba, un índice «En esta sección» (una fila que se desliza de lado, botones de 44 px): Plan, Mi negocio, Tipo y
    funciones, Usuarios y seguridad, Caja y personal, Más opciones, Facturación. Lleva directo; no esconde nada.
  - Plegado el buscador de tipo de negocio (se ve el tipo actual y «🔁 Cambiar tipo de negocio») y la lista de
    🧩 Funciones de este negocio («N de M funciones prendidas» y «🧩 Ver y cambiar funciones»).
  - Si el 🔎 buscador de Ajustes lleva a algo plegado, se despliega solo.
  - Con el restaurante de ejemplo a 390 px la página pasa de 9.939 px a ~8.700 px y cada parte queda a un toque.
    **No es una partición completa en sub-páginas**: «Permisos del equipo» (650 px) y la Factura de venta (1.700 px)
    siguen abiertas porque son campos que se llenan (y pruebas los tocan directamente).
- **Arreglo de paso:** los dos campos «Singular / Plural» de la unidad propia se veían siempre aunque estuvieran
  escondidos (tenían `display:grid` en línea); ahora solo salen al elegir «Otro».

## Archivos
- `index.html`: CSS del encabezado (600 px / 380 px), del índice y los plegables; `<script>` de `lib/vento-ajustes-indice.js`.
- `app/12-fotos-productos-fondo.js`: texto de `#appVersionEl`.
- `lib/vento-ajustes-indice.js` (nuevo).
- `pruebas/diseno199.test.js`: puntos 6, 7 y 8.

## Pruebas
- `diseno199`: 25 bien, 0 mal (celular 390 y 320 px, computador 1280 px, versión, Negocio con índice, plegables y buscador).
- **Lista completa:** RESULTADOS_AQUI

## No probado
- Teléfonos reales.
