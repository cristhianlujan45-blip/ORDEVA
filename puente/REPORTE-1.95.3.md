# ORDEVA 1.95.3 · 🚑 El menú de abajo vuelve a caber en el celular

**Reporte del dueño:** «en el celular no me está saliendo el menú, los productos, el inventario, ya no los veo, los ajustes».

## Qué se encontró
- **En un celular simulado** (Pixel 7, tienda con cuenta en la nube) todo funcionaba:
  - el menú de abajo (Cuentas, Caja POS, Productos, Cuadre, Más);
  - «Más» → Ajustes;
  - Productos;
  - el aviso de pedidos del QR.
- **La causa más probable** está en la app de Android, desde la 1.88 (`lib/vento-igual.js`):
  - si el celular tiene el zoom de pantalla aumentado, ORDEVA cambiaba el ancho de la página para que se viera como con el
    tamaño normal;
  - si el WebView del celular no vuelve a ajustar la página a la pantalla después de ese cambio, la página queda más ancha
    que la pantalla;
  - **lo de la derecha queda por fuera:** Productos, Cuadre/Inventario y «Más» → Ajustes. Es justo lo que pasa.
- **No se pudo probar con ese WebView aquí.** Es la causa más probable, no una confirmada.

## Qué cambió
- **ORDEVA ya no cambia el ancho de la página.** Solo anota la escala del celular (`data-escala`) para revisarla si hace
  falta.
- **La letra grande del celular sigue sin afectar a ORDEVA:** `setTextZoom(100)` en la app y `text-size-adjust` en las
  páginas.
- **Todas las páginas** (meseros, pedidos, admin, cocina, TV…) cargan la versión nueva del archivo. Antes tenían fija la de
  la 1.87, y el celular podía seguir usando la copia vieja.

## Pruebas
- `v188` actualizada (12): con el zoom al 125 %, el ancho ya no cambia (360) y la escala queda anotada.
- `ordeva2` (30), `modos` (55), `vistasencilla` (45) y `pedidostienda` (29): pasan.
- **Lista completa,** corrida después de publicar por la urgencia: 121 pruebas, 2.710 revisiones, 0 fallas.
- **Falta confirmarlo en el celular del dueño.** Si el menú sigue sin salir, hace falta un pantallazo para seguir.
