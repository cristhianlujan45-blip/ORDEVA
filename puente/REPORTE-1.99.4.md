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
- **Tipos de negocio y Libreta (hallazgo 20):**
  - Sin escribir nada, la lista de tipos de negocio empieza por Restaurante, Tienda de barrio, Comidas rápidas, Cafetería,
    Bar y Barbería; después el resto en orden alfabético (antes empezaba por «Academia»). Buscar escribiendo no cambia.
  - La Libreta muestra 2 ejemplos y «Ver más ejemplos» para el resto (antes 11 renglones), y su ✕ mide 44 px y va a la derecha.
- **Arreglo de paso:** los dos campos «Singular / Plural» de la unidad propia se veían siempre aunque estuvieran
  escondidos (tenían `display:grid` en línea); ahora solo salen al elegir «Otro».

## Archivos
- `index.html`: CSS del encabezado (600 px / 380 px), del índice y los plegables; `<script>` de `lib/vento-ajustes-indice.js`.
- `app/12-fotos-productos-fondo.js`: texto de `#appVersionEl`.
- `lib/vento-ajustes-indice.js` (nuevo).
- `app/03-catalogo-tipos-negocio.js`: orden sin búsqueda. `app/13-libreta-abuela-cuaderno.js`: ejemplos plegados y ✕.
- `pruebas/diseno199.test.js`: puntos 6 a 9.

## Pruebas
- `diseno199`: 29 bien, 0 mal (celular 390 y 320 px, computador 1280 px, versión, Negocio con índice, plegables y buscador, tipos y Libreta).
- Tipos y Libreta se agregaron después de lanzar la lista completa; aparte pasaron: libreta 24/0, tipofijo 16/0, registrotipo 6/0,
  modulosnegocio 33/0, ajustesequipo 17/0, modulos 12/0, flujocompleto 87/0, daviplatacobro 28/0.
- **Lista completa:** se corrió una sola, junto con la 1.99.5: ver `REPORTE-1.99.5.md`.

## No probado
- Teléfonos reales.
