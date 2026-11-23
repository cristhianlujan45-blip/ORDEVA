# ORDEVA 1.99.42 — Libreta (Camila / Tania) y Productos más ordenado

## 1. «Camila no aparece en la libreta de quién me debe»
Revisado con el diagnóstico de solo lectura en la nube (factura FV-0131 y el nombre «camila», sin mostrar otros nombres):
- La cuenta de Camila **sí estaba bien guardada**: debe $52.500, el pago «Debe» a su nombre, sin abonos.
- El problema era otro: «Tania» estaba escrita de 3 formas («Tania», «Tânia», «tania»). La libreta la mostraba **3 veces**,
  cada vez con TODAS sus cuentas ($93.800), así que el «Me deben» sumaba **$187.600 de más** ($766.125 en vez de
  $578.525) y Camila ($52.500) quedaba muy abajo en la lista, después de Alberto.

Arreglo:
- Una sola fila por persona aunque el nombre se haya escrito con o sin tilde o mayúscula (como ya se juntaban sus cuentas).
- Los abonos de la libreta escritos distinto («TANIA») también le bajan a esa persona.
- «Me deben» ahora dice cuántas personas son.
- Con 6 o más personas sale un buscador «🔎 Buscar quién me debe».

## 2. Productos: «organiza estos menús»
- Categorías en **una fila que se desliza de lado** (antes 10 renglones), con «Categorías · 16» y «Ver todas ▾ / Ver menos ▴».
- La ✕ para borrar una categoría solo aparece en la categoría escogida (antes cada una tenía su ✕). Sigue preguntando antes de borrar.
- La categoría «es:Mercado/Bebidas/Gaseosas y sodas ›» se ve «Gaseosas y sodas» (lo guardado no cambia). Los productos nuevos
  por código de barras ya no traen ese nombre largo.
- Agotados / por agotarse / con stock: 3 cuadros iguales en una fila, con el número grande.
- «97 producto(s) sin control de stock» en una línea con el botón a la derecha.

## Pruebas
- Nuevas: `libretanombres1942` (8/8) y `productosorden1942` (12/12).
- Libreta y fiados: fiadosnombres 28/28, libreta 24/24, ventasfiados 16/16.
