# ORDEVA 1.99.42 — Libreta (Camila / Tania) y Productos más ordenado

Incluye también lo que estaba listo sin publicar: 1.99.40 (memoria del celular), 1.99.41 (mapa del local) y el arreglo de
fechas de las reservas (rango «28 al 2 de diciembre»).

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
- El último fiado anotado (en la última hora) sale de PRIMERO, marcado «🆕 Recién anotado».

Comprobado con la libreta real y los datos del negocio (diagnóstico, solo el nombre pedido): con la versión publicada Camila
estaba en el puesto 7 ($52.500) de 15 filas y el total era $766.125; con 1.99.42 son 13 personas, $578.525, y Camila en el 5
(de primera si se acaba de anotar). Camila y Camilo siempre fueron filas aparte.

## 2. Productos: «organiza estos menús»
- Categorías en **una fila que se desliza de lado** (antes 10 renglones), con «Categorías · 16» y «Ver todas ▾ / Ver menos ▴».
- La ✕ para borrar una categoría solo aparece en la categoría escogida (antes cada una tenía su ✕). Sigue preguntando antes de borrar.
- La categoría «es:Mercado/Bebidas/Gaseosas y sodas ›» se ve «Gaseosas y sodas» (lo guardado no cambia). Los productos nuevos
  por código de barras ya no traen ese nombre largo.
- Agotados / por agotarse / con stock: 3 cuadros iguales en una fila, con el número grande.
- «97 producto(s) sin control de stock» en una línea con el botón a la derecha.

## Pruebas
- Nuevas: `libretanombres1942` (10/10) y `productosorden1942` (12/12).
- Libreta y fiados: fiadosnombres 28/28, libreta 24/24, ventasfiados 16/16.

# 1.99.43 — El último fiado, siempre de primero
Pedido del dueño: «quiero que el último fiado que anotes salga de primero en la lista». En 1.99.42 salía de primero solo
durante la primera hora; ahora siempre, marcado «🆕 Último fiado · hace 5 min / hoy 10:01 p. m. / ayer …». Si esa persona ya
pagó todo, sale de primero el último fiado de quien todavía debe. Prueba `libretanombres1942` 12/12.
