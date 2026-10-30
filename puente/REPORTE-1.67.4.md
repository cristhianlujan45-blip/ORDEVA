# ORDEVA 1.67.4 · 🎨 Fase 3: diseño ORDEVA 2.0 en Facturas, Libreta, Laya, Ajustes e Historial

## Errores encontrados al revisar las pantallas (corregidos)
- **📒 Libreta: el botón «🎤 Toca y habla» no se leía.**
  - Tenía letra casi negra (`#1a1410`) sobre el color de acento del negocio, que en ORDEVA 2.0 es negro.
  - Lo mismo pasaba con los botones de operación de la calculadora y con el botón flotante de la Libreta.
  - Ahora usan `--on-amber`, el color de texto que cada apariencia calcula para su acento. Queda bien en todas.
- **🧾 Revisión de factura: los campos salían con el borde del navegador** (2 px, con relieve), porque no tenían estilo
  propio.

## Qué quedó (`lib/ordeva2.css`, solo con la apariencia ORDEVA 2.0)
- **Campos sin estilo propio** dentro de ventanas y Ajustes: borde fino, redondeados y foco negro.
  - Con `:where()`: cualquier estilo que un campo ya tenga sigue mandando. No se rompe nada que ya estuviera bien.
- **Revisión de factura:**
  - etiquetas más claras;
  - los datos «Revisar dato» con fondo naranja suave;
  - los renglones como tarjetas.
- **Libreta:**
  - los ejemplos de voz en un recuadro gris, alineados a la izquierda;
  - los botones como tarjetas blancas con la franja de su color a la izquierda.
- **Ajustes:** «Configurar mi negocio», «Primeros pasos» y demás tarjetas de acción, blancas y planas (antes con
  degradado gris).
- **Historial:** «🗑️ Borrar historial de un día» es un botón rojo suave. Antes era un rectángulo con borde rojo suelto.
- **Laya:** ya tenía saludo, sugerencias y el diseño nuevo. Solo se ajustaron las esquinas de la ventana.

## Pruebas
- `ordeva2pantallas` amplía a 20 revisiones (3 nuevas):
  - el contraste del micrófono de la Libreta (≥ 4,5);
  - los campos de la factura sin el borde del navegador;
  - el botón de borrar del Historial.
- La lista crítica completa de CI corre antes de publicar. Sus resultados están en el mensaje de publicación.

## Pendiente del diseño
- Compras y proveedores (historial de compras) e informes con filtros: van con las fases 5 y 7, cuando se amplíen
  esas pantallas.
