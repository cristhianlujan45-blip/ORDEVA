# ORDEVA 1.67.3 · Corrección para Safari de iPhone

## Qué pasó
- En la 1.67.1 el catálogo colombiano se deja listo en segundo plano con `requestIdleCallback`.
- La llamada se hacía sin `window.` delante. En los Safari de iPhone que no traen esa función (iOS 15.4–16.3), una
  llamada así rompe el archivo.
- En la práctica, `lib/vento-producto-codigo.js` (reconocer productos por su código) no habría funcionado en esos
  iPhone.
- La prueba `iphone` de GitHub lo detectó al publicar la 1.67.2.

## Corrección
- Ahora se llama `window.requestIdleCallback(…)` solo si existe. Si no existe, el catálogo se baja directamente.
- La prueba `iphone` vuelve a pasar (9 ✅).

## Lección
- Antes de publicar se corre la **lista crítica completa de CI**, no solo las pruebas de lo que se tocó.
- Los resultados de esa lista para esta versión están en el mensaje de publicación.
